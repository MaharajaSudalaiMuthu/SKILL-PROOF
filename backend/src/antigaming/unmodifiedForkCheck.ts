import { AntiGamingFlagRecord } from '@skillproof/shared';
import { config } from '../config/index.js';

export interface ForkCheckInput {
  repositoryId: string;
  userId: string;
  isFork: boolean;
  totalJavaLines: number;
  confirmedJavaLines: number;
}

export function checkUnmodifiedFork(input: ForkCheckInput): AntiGamingFlagRecord | null {
  if (!input.isFork) {
    return null;
  }

  const minLines = config.skillproof.antiGaming.forkMinLines;
  const minRatio = config.skillproof.antiGaming.forkMinRatio;

  const ratio = input.totalJavaLines > 0 ? input.confirmedJavaLines / input.totalJavaLines : 0;

  if (input.confirmedJavaLines < minLines || ratio < minRatio) {
    return {
      repositoryId: input.repositoryId,
      userId: input.userId,
      flagType: 'UNMODIFIED_FORK',
      severity: 'BLOCKING',
      explanation: `Repository is a fork with only ${input.confirmedJavaLines} confirmed Java lines (${Math.round(
        ratio * 100
      )}%), below threshold of ${minLines} lines or ${Math.round(minRatio * 100)}%.`,
      metricValue: Math.round(ratio * 100) / 100,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}
