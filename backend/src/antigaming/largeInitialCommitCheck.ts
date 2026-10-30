import { execFile } from 'child_process';
import { promisify } from 'util';
import { AntiGamingFlagRecord } from '@skillproof/shared';
import { FileAttribution } from '../models/FileAttribution.js';
import { config } from '../config/index.js';
import { logger } from '../middleware/pinoLogger.js';

const execFileAsync = promisify(execFile);

export interface InitialCommitCheckInput {
  repositoryId: string;
  userId: string;
  workspacePath: string;
  totalJavaLines: number;
}

export async function checkLargeInitialCommit(
  input: InitialCommitCheckInput
): Promise<AntiGamingFlagRecord | null> {
  if (input.totalJavaLines === 0) {
    return null;
  }

  let rootCommitSha = '';
  try {
    const { stdout } = await execFileAsync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: input.workspacePath,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
    // First line is the root commit
    rootCommitSha = stdout.trim().split('\n')[0]?.trim() || '';
  } catch (err) {
    logger.warn({ err }, 'Failed to determine root commit via git rev-list.');
    return null;
  }

  if (!rootCommitSha) {
    return null;
  }

  // Count lines in FileAttribution belonging to root commit
  const attributions = await FileAttribution.find({ repositoryId: input.repositoryId });
  let rootCommitLines = 0;

  for (const attr of attributions) {
    for (const range of attr.ranges) {
      if (range.commitSha === rootCommitSha) {
        rootCommitLines += range.endLine - range.startLine + 1;
      }
    }
  }

  const thresholdRatio = config.skillproof.antiGaming.initialCommitRatio;
  const ratio = rootCommitLines / input.totalJavaLines;

  if (ratio >= thresholdRatio) {
    return {
      repositoryId: input.repositoryId,
      userId: input.userId,
      flagType: 'LARGE_INITIAL_COMMIT',
      severity: 'WARNING',
      explanation: `Initial commit (${rootCommitSha.substring(0, 7)}) contributes ${Math.round(
        ratio * 100
      )}% of current Java lines in repository.`,
      metricValue: Math.round(ratio * 100) / 100,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}
