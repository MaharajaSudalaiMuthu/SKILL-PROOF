import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { REPO_FULL_NAME_REGEX } from '@skillproof/shared';
import { logger } from '../middleware/pinoLogger.js';

const execFileAsync = promisify(execFile);

export const WORKSPACE_BASE_DIR = path.join(os.tmpdir(), 'skillproof-workspaces');

export interface CloneOptions {
  cloneUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  maxFiles?: number;
  maxSizeBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_FILES = 10_000;
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Validates repository name/URL and resolves safe clone URL.
 * Supports arbitrary public GitHub URLs, owner/repo, and authenticated private repos.
 */
export function validateAndResolveCloneUrl(
  repoFullName: string,
  customCloneUrl?: string,
  authToken?: string
): string {
  if (!repoFullName || typeof repoFullName !== 'string') {
    throw new Error('Repository name is required.');
  }

  const trimmed = repoFullName.trim();
  if (
    !trimmed ||
    trimmed.includes(';') ||
    trimmed.includes('|') ||
    trimmed.includes('&') ||
    trimmed.includes('\n') ||
    trimmed.includes('\r') ||
    trimmed.includes(' ') ||
    trimmed.includes('..') ||
    trimmed.startsWith('http://')
  ) {
    throw new Error(`Security violation: Invalid characters or insecure protocol detected in '${repoFullName}'.`);
  }

  // Allow local fixture path override in test environment
  if (
    process.env.NODE_ENV === 'test' &&
    customCloneUrl &&
    (customCloneUrl.startsWith('/') || customCloneUrl.startsWith('file://'))
  ) {
    return customCloneUrl;
  }

  let url = (customCloneUrl || '').trim();
  if (!url) {
    url = trimmed;
  }

  if (url.startsWith('http://')) {
    throw new Error(`Security violation: Insecure HTTP protocol not allowed in '${url}'.`);
  }

  // Parse GitHub URL: https://github.com/owner/repo(.git)?
  const ghUrlMatch = url.match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/i);
  let owner = '';
  let repo = '';

  if (ghUrlMatch && ghUrlMatch[1] && ghUrlMatch[2]) {
    owner = ghUrlMatch[1];
    repo = ghUrlMatch[2];
  } else {
    // Check owner/repo format
    const nameMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/);
    if (nameMatch && nameMatch[1] && nameMatch[2]) {
      owner = nameMatch[1];
      repo = nameMatch[2];
    }
  }

  if (!owner || !repo) {
    throw new Error(
      `Invalid repository name or URL: '${repoFullName}'. Expected a GitHub repository (e.g. owner/repo or https://github.com/owner/repo).`
    );
  }

  if (authToken && authToken.trim().length > 0) {
    return `https://x-access-token:${encodeURIComponent(authToken.trim())}@github.com/${owner}/${repo}.git`;
  }
  return `https://github.com/${owner}/${repo}.git`;
}

/**
 * Safely extracts an uploaded project ZIP archive into an isolated per-job workspace.
 */
export async function extractZipToWorkspace(
  jobId: string,
  zipFilePath: string,
  options: CloneOptions = {}
): Promise<{ workspacePath: string }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  await fs.promises.mkdir(WORKSPACE_BASE_DIR, { recursive: true });
  const workspacePath = path.join(WORKSPACE_BASE_DIR, jobId);

  await cleanupWorkspace(workspacePath);
  await fs.promises.mkdir(workspacePath, { recursive: true });

  logger.info({ jobId, zipFilePath, workspacePath }, 'Extracting project ZIP archive...');

  try {
    await execFileAsync('unzip', ['-q', '-o', zipFilePath, '-d', workspacePath], {
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err: unknown) {
    await cleanupWorkspace(workspacePath);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to extract ZIP project archive: ${message}`);
  }

  // If the zip contained a single root directory, flatten it to workspacePath
  try {
    const extractedEntries = await fs.promises.readdir(workspacePath);
    if (extractedEntries.length === 1) {
      const singleChild = path.join(workspacePath, extractedEntries[0]!);
      const stat = await fs.promises.stat(singleChild);
      if (stat.isDirectory()) {
        const tempFlatten = path.join(WORKSPACE_BASE_DIR, `${jobId}-flatten`);
        await fs.promises.rename(singleChild, tempFlatten);
        await cleanupWorkspace(workspacePath);
        await fs.promises.rename(tempFlatten, workspacePath);
      }
    }
  } catch (flattenErr) {
    logger.warn({ jobId, flattenErr }, 'Could not inspect/flatten zip root directory');
  }

  // Post-extraction security and resource limits
  try {
    await validateWorkspaceIntegrity(workspacePath, workspacePath, { fileCount: 0, totalSize: 0 }, maxFiles, maxSizeBytes);
  } catch (validationErr) {
    await cleanupWorkspace(workspacePath);
    throw validationErr;
  }

  // If no .git exists, initialize a local git repository so blame and attribution succeed
  const gitDir = path.join(workspacePath, '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      await execFileAsync('git', ['init'], { cwd: workspacePath });
      await execFileAsync('git', ['config', 'user.email', 'student@skillproof.local'], { cwd: workspacePath });
      await execFileAsync('git', ['config', 'user.name', 'Student Developer'], { cwd: workspacePath });
      await execFileAsync('git', ['add', '-A'], { cwd: workspacePath });
      await execFileAsync('git', ['commit', '-m', 'Initial student submission', '--allow-empty'], { cwd: workspacePath });
    } catch (gitErr) {
      logger.warn({ jobId, gitErr }, 'Failed to initialize git for unzipped project; attribution will use fallback');
    }
  }

  logger.info({ jobId, workspacePath }, 'ZIP project archive extracted and validated successfully.');
  return { workspacePath };
}

/**
 * Clones repository into an isolated per-job temporary workspace with strict hardening.
 */
export async function cloneRepository(
  jobId: string,
  repoFullName: string,
  options: CloneOptions = {}
): Promise<{ workspacePath: string }> {
  const cloneUrl = validateAndResolveCloneUrl(repoFullName, options.cloneUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  await fs.promises.mkdir(WORKSPACE_BASE_DIR, { recursive: true });
  const workspacePath = path.join(WORKSPACE_BASE_DIR, jobId);

  // Clean if workspace unexpectedly exists
  await cleanupWorkspace(workspacePath);

  logger.info({ jobId, repoFullName, workspacePath }, 'Starting safe git clone...');

  const gitArgs = [
    '-c',
    'core.hooksPath=/dev/null',
    'clone',
    '--no-recurse-submodules',
    '--config',
    'filter.lfs.smudge=cat',
    '--config',
    'filter.lfs.clean=cat',
    '--config',
    'filter.lfs.process=cat',
    '--config',
    'filter.lfs.required=false',
    cloneUrl,
    workspacePath,
  ];

  try {
    await execFileAsync('git', gitArgs, {
      timeout: timeoutMs,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_LFS_SKIP_SMUDGE: '1',
      },
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err: unknown) {
    await cleanupWorkspace(workspacePath);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Git clone failed: ${message}`);
  }

  // Post-clone security and resource limit validation
  try {
    await validateWorkspaceIntegrity(workspacePath, workspacePath, { fileCount: 0, totalSize: 0 }, maxFiles, maxSizeBytes);
  } catch (validationErr) {
    await cleanupWorkspace(workspacePath);
    throw validationErr;
  }

  logger.info({ jobId, workspacePath }, 'Git clone completed and validated successfully.');
  return { workspacePath };
}

/**
 * Traverses cloned workspace to enforce file count caps, size caps, and prevent symlink escape.
 */
async function validateWorkspaceIntegrity(
  dir: string,
  root: string,
  state: { fileCount: number; totalSize: number },
  maxFiles: number,
  maxSizeBytes: number
): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      try {
        const targetRealPath = await fs.promises.realpath(fullPath);
        const resolvedRoot = await fs.promises.realpath(root);
        if (!targetRealPath.startsWith(resolvedRoot)) {
          throw new Error(`Security violation: Symlink '${entry.name}' points outside workspace directory.`);
        }
      } catch (err: unknown) {
        throw new Error(
          `Security violation: Broken or invalid symlink '${entry.name}' detected: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } else if (entry.isDirectory()) {
      // Don't recurse into .git for file caps to keep analysis focused on source
      if (entry.name !== '.git') {
        await validateWorkspaceIntegrity(fullPath, root, state, maxFiles, maxSizeBytes);
      }
    } else if (entry.isFile()) {
      state.fileCount++;
      const stat = await fs.promises.stat(fullPath);
      state.totalSize += stat.size;

      if (state.fileCount > maxFiles) {
        throw new Error(`Repository exceeds maximum allowed file count (${maxFiles} files).`);
      }
      if (state.totalSize > maxSizeBytes) {
        throw new Error(`Repository exceeds maximum allowed disk size (${Math.round(maxSizeBytes / 1024 / 1024)}MB).`);
      }
    }
  }
}

/**
 * Safely removes a job workspace directory.
 */
export async function cleanupWorkspace(workspacePath: string): Promise<void> {
  try {
    if (fs.existsSync(workspacePath)) {
      await fs.promises.rm(workspacePath, { recursive: true, force: true });
    }
  } catch (err) {
    logger.warn({ workspacePath, err }, 'Failed to cleanly remove workspace directory.');
  }
}

/**
 * Removes any abandoned or stale job workspaces older than maxAgeMs (default: 1 hour).
 */
export async function cleanStaleWorkspaces(maxAgeMs = 3_600_000): Promise<void> {
  try {
    if (!fs.existsSync(WORKSPACE_BASE_DIR)) {
      return;
    }
    const entries = await fs.promises.readdir(WORKSPACE_BASE_DIR, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(WORKSPACE_BASE_DIR, entry.name);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            logger.info({ dir: fullPath }, 'Removing stale workspace directory.');
            await fs.promises.rm(fullPath, { recursive: true, force: true });
          }
        } catch {
          // Ignore individual stat errors
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Error cleaning stale workspaces.');
  }
}
