import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import pino from 'pino';
import { verifyHmacSignature } from './security.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
});

export const app = express();

// Capture raw body for HMAC signature verification
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

const PORT = parseInt(process.env.SANDBOX_RUNNER_PORT || '8081', 10);
const HOST = '127.0.0.1'; // Strictly localhost only

// Health check (Local diagnostic only)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'RUNNER_UP',
    host: HOST,
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

export interface RunFile {
  path: string;
  content: string;
}

export interface RunPayload {
  challengeSlug: string;
  files: RunFile[];
  testFiles: RunFile[];
  timeoutMs?: number;
}

function findJavaFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJavaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractTestClass(testFiles: RunFile[]): string | null {
  for (const file of testFiles) {
    if (file.path.endsWith('Test.java') || file.content.includes('public static void main')) {
      const pkgMatch = file.content.match(/package\s+([\w\.]+);/);
      const classMatch = file.content.match(/public\s+class\s+(\w+)/);
      if (classMatch && classMatch[1]) {
        const className = classMatch[1];
        return pkgMatch && pkgMatch[1] ? `${pkgMatch[1]}.${className}` : className;
      }
    }
  }
  return null;
}

// POST /run — HMAC-authenticated Java execution endpoint
app.post('/run', verifyHmacSignature, async (req: Request, res: Response): Promise<void> => {
  const { challengeSlug, files = [], testFiles = [], timeoutMs = 25000 } = req.body as RunPayload;

  if (!challengeSlug || (!files.length && !testFiles.length)) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'challengeSlug and code files must be provided',
    });
    return;
  }

  const runId = crypto.randomUUID();
  const runDir = path.join('/tmp', 'skillproof-sandbox', runId);
  const outDir = path.join(runDir, 'build');
  const startTime = Date.now();

  try {
    fs.mkdirSync(runDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    // Write all user and hidden test files
    const allFiles = [...files, ...testFiles];
    for (const f of allFiles) {
      const resolved = path.resolve(runDir, f.path);
      if (!resolved.startsWith(runDir)) {
        res.status(400).json({ error: 'SECURITY_ERROR', message: 'Path traversal detected in file path' });
        return;
      }
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, f.content, 'utf8');
    }

    const javaFiles = findJavaFiles(runDir);
    if (javaFiles.length === 0) {
      res.status(400).json({
        runId,
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        testOutput: 'No Java source files found to compile',
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // Step 1: Compile with javac
    let compileOutput = '';
    try {
      const { stdout, stderr } = await execFileAsync(
        'javac',
        ['-encoding', 'UTF-8', '-d', outDir, ...javaFiles],
        { timeout: 15000, cwd: runDir }
      );
      compileOutput = [stdout, stderr].filter(Boolean).join('\n');
    } catch (compileErr: unknown) {
      const err = compileErr as { stdout?: string; stderr?: string; message?: string };
      const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
      res.status(200).json({
        runId,
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        testOutput: `[COMPILATION ERROR]\n${output}`,
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // Step 2: Identify Test Class
    const testClass = extractTestClass(testFiles);
    if (!testClass) {
      res.status(200).json({
        runId,
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        testOutput: `${compileOutput}\n[ERROR] Unable to locate executable test class in hiddenTestFiles`,
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // Step 3: Run Test Class in isolated JVM with -Xmx256m and timeout
    let testStdout = '';
    let testStderr = '';
    let testExitCode = 0;

    try {
      const runResult = await execFileAsync(
        'java',
        ['-Xmx256m', '-cp', outDir, testClass],
        { timeout: timeoutMs, cwd: runDir }
      );
      testStdout = runResult.stdout || '';
      testStderr = runResult.stderr || '';
    } catch (execErr: unknown) {
      const err = execErr as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
      testStdout = err.stdout || '';
      testStderr = err.stderr || '';
      testExitCode = err.code ?? (err.killed ? 124 : 1);
    }

    const executionTimeMs = Date.now() - startTime;
    const combinedOutput = [compileOutput, testStdout, testStderr].filter(Boolean).join('\n');

    // Step 4: Parse SKILLPROOF_TEST_SUMMARY:P/T
    const summaryMatch = combinedOutput.match(/SKILLPROOF_TEST_SUMMARY:(\d+)\/(\d+)/);
    let passed = false;
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    if (summaryMatch && summaryMatch[1] && summaryMatch[2]) {
      passedTests = parseInt(summaryMatch[1], 10);
      totalTests = parseInt(summaryMatch[2], 10);
      failedTests = Math.max(0, totalTests - passedTests);
      passed = testExitCode === 0 && passedTests === totalTests && totalTests > 0;
    } else {
      passed = testExitCode === 0;
      totalTests = 1;
      passedTests = passed ? 1 : 0;
      failedTests = passed ? 0 : 1;
    }

    res.status(200).json({
      runId,
      passed,
      totalTests,
      passedTests,
      failedTests,
      testOutput: combinedOutput,
      executionTimeMs,
    });
  } catch (fatalErr: unknown) {
    const message = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    logger.error({ fatalErr }, 'Internal runner error');
    res.status(500).json({
      runId,
      passed: false,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testOutput: `[RUNNER SYSTEM ERROR]: ${message}`,
      executionTimeMs: Date.now() - startTime,
    });
  } finally {
    // Clean up temporary run directory
    try {
      if (fs.existsSync(runDir)) {
        fs.rmSync(runDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      logger.warn({ cleanupErr, runDir }, 'Failed to clean up sandbox directory');
    }
  }
});

let serverInstance: ReturnType<typeof app.listen> | null = null;

export function startRunner(port: number = PORT): Promise<ReturnType<typeof app.listen>> {
  return new Promise((resolve) => {
    serverInstance = app.listen(port, HOST, () => {
      logger.info(`SkillProof Sandbox Runner listening strictly on http://${HOST}:${port}`);
      resolve(serverInstance!);
    });
  });
}

export function stopRunner(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!serverInstance) {
      resolve();
      return;
    }
    serverInstance.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  startRunner(PORT);
}

