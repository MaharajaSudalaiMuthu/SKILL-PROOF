import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../middleware/pinoLogger.js';

const execFileAsync = promisify(execFile);

export interface ParsedBlameLine {
  lineNumber: number;
  commitSha: string;
  commitDate: Date;
  isBlank: boolean;
}

export interface BlameRange {
  startLine: number;
  endLine: number;
  commitSha: string;
  commitDate: Date;
  lineCount: number;
  nonBlankCount: number;
}

export interface FileBlameResult {
  filePath: string;
  totalLines: number;
  ranges: BlameRange[];
  uniqueShas: Set<string>;
}

/**
 * Recursively discovers candidate Java source files under src/main and src/test.
 * Excludes build outputs, caches, and vendored folders.
 */
export async function findTargetJavaFiles(workspacePath: string): Promise<string[]> {
  const javaFiles: string[] = [];

  const ignoredDirs = new Set([
    '.git',
    'target',
    'build',
    '.gradle',
    '.mvn',
    'node_modules',
    'bin',
    'out',
    '.idea',
    '.settings',
  ]);

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.java')) {
        // Enforce restriction: only files under src/main/ or src/test/
        if (relativePath.startsWith('src/main/') || relativePath.startsWith('src/test/')) {
          javaFiles.push(relativePath);
        }
      }
    }
  }

  await walk(workspacePath);
  return javaFiles.sort();
}

/**
 * Parses raw git blame porcelain text output into parsed lines and grouped ranges.
 */
export function parsePorcelainBlame(porcelainOutput: string): {
  totalLines: number;
  ranges: BlameRange[];
  uniqueShas: Set<string>;
} {
  const lines = porcelainOutput.split('\n');
  const commitMetadata = new Map<string, { commitDate: Date }>();
  const parsedLines: ParsedBlameLine[] = [];
  const uniqueShas = new Set<string>();

  let currentSha = '';
  let currentFinalLine = 0;
  let currentAuthorTime = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // A tab indicates the actual line source content, terminating the header block for this line
    if (line.startsWith('\t')) {
      const lineContent = line.slice(1);
      const isBlank = lineContent.trim().length === 0;

      let date = commitMetadata.get(currentSha)?.commitDate;
      if (!date && currentAuthorTime > 0) {
        date = new Date(currentAuthorTime * 1000);
        commitMetadata.set(currentSha, { commitDate: date });
      } else if (!date) {
        date = new Date();
      }

      parsedLines.push({
        lineNumber: currentFinalLine,
        commitSha: currentSha,
        commitDate: date,
        isBlank,
      });

      // Reset line tracking
      currentSha = '';
      currentFinalLine = 0;
      currentAuthorTime = 0;
      continue;
    }

    // Check if this is the start of a line block: "<sha> <origLine> <finalLine> [<count>]"
    const headerMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)(?:\s+\d+)?$/);
    if (headerMatch && headerMatch[1] && headerMatch[3]) {
      currentSha = headerMatch[1];
      currentFinalLine = parseInt(headerMatch[3], 10);
      uniqueShas.add(currentSha);
      continue;
    }

    // Parse commit author time if present in header block
    if (line.startsWith('author-time ')) {
      currentAuthorTime = parseInt(line.substring('author-time '.length), 10);
      if (currentSha && !commitMetadata.has(currentSha)) {
        commitMetadata.set(currentSha, { commitDate: new Date(currentAuthorTime * 1000) });
      }
    }
  }

  // Sort parsed lines by line number
  parsedLines.sort((a, b) => a.lineNumber - b.lineNumber);

  // Group contiguous lines with identical commitSha into BlameRange blocks
  const ranges: BlameRange[] = [];
  if (parsedLines.length === 0) {
    return { totalLines: 0, ranges: [], uniqueShas };
  }

  const firstLine = parsedLines[0];
  if (!firstLine) {
    return { totalLines: 0, ranges: [], uniqueShas };
  }

  let currentRange: BlameRange = {
    startLine: firstLine.lineNumber,
    endLine: firstLine.lineNumber,
    commitSha: firstLine.commitSha,
    commitDate: firstLine.commitDate,
    lineCount: 1,
    nonBlankCount: firstLine.isBlank ? 0 : 1,
  };

  for (let i = 1; i < parsedLines.length; i++) {
    const p = parsedLines[i];
    if (!p) continue;

    if (p.commitSha === currentRange.commitSha) {
      currentRange.endLine = p.lineNumber;
      currentRange.lineCount++;
      if (!p.isBlank) {
        currentRange.nonBlankCount++;
      }
    } else {
      ranges.push(currentRange);
      currentRange = {
        startLine: p.lineNumber,
        endLine: p.lineNumber,
        commitSha: p.commitSha,
        commitDate: p.commitDate,
        lineCount: 1,
        nonBlankCount: p.isBlank ? 0 : 1,
      };
    }
  }
  ranges.push(currentRange);

  return {
    totalLines: parsedLines.length,
    ranges,
    uniqueShas,
  };
}

/**
 * Runs git blame --porcelain on a specific file in the workspace.
 */
export async function blameFile(workspacePath: string, relativeFilePath: string): Promise<FileBlameResult> {
  const args = ['blame', '--porcelain', '-w', '-M', '-C', relativeFilePath];

  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: workspacePath,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
      },
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = parsePorcelainBlame(stdout);
    return {
      filePath: relativeFilePath,
      totalLines: parsed.totalLines,
      ranges: parsed.ranges,
      uniqueShas: parsed.uniqueShas,
    };
  } catch (err: unknown) {
    logger.warn({ relativeFilePath, err }, 'Git blame returned error or file is empty.');
    return {
      filePath: relativeFilePath,
      totalLines: 0,
      ranges: [],
      uniqueShas: new Set<string>(),
    };
  }
}
