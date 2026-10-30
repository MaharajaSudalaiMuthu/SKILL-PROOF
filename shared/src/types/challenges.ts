import { SkillSlug } from './skills.js';
import { SkillLevel } from './levels.js';

export interface ChallengeFile {
  path: string;
  content: string;
  readOnly?: boolean;
}

export interface ChallengeSummary {
  slug: string;
  title: string;
  description: string;
  mappedSkills: SkillSlug[];
  timeLimitMinutes: number;
  passed: boolean;
  lastAttemptAt?: string | null;
}

export interface ChallengeDetailResponse {
  slug: string;
  title: string;
  description: string;
  mappedSkills: SkillSlug[];
  timeLimitMinutes: number;
  starterFiles: ChallengeFile[];
  instructions: string;
  passed: boolean;
  lastAttemptAt?: string | null;
}

export interface ChallengeSubmitRequest {
  files: { path: string; content: string }[];
}

export interface ChallengeRunResult {
  runId: string;
  challengeSlug: string;
  passed: boolean;
  score: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testOutput: string;
  executionTimeMs: number;
  completedAt: string;
  promotedSkills: SkillSlug[];
  capabilityLevels?: Record<SkillSlug, SkillLevel>;
}
