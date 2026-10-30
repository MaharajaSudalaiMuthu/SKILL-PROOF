import { SkillSlug } from './skills.js';
import { SkillLevel, AttributionStatus, EvidenceValidityStatus } from './levels.js';
import { AntiGamingFlagRecord } from './detectors.js';

export interface StaticEvidenceItem {
  id: string;
  skillSlug: SkillSlug;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  isFork: boolean;
  hasBlockingFlag: boolean;
  filePath: string;
  startLine: number;
  endLine: number;
  commitSha: string;
  commitDate: string;
  detectorName: string;
  matchedPattern: string;
  validityStatus: EvidenceValidityStatus;
  attributionStatus: AttributionStatus;
  recencyWeight: number;
  whatThisShows?: string;
  whatThisDoesNotProve?: string;
  rawDetails?: Record<string, unknown>;
  githubBlobUrl?: string;
}

export interface AssessmentAttemptItem {
  id: string;
  skillSlug: SkillSlug;
  score: number;
  passed: boolean;
  completedAt: string;
}

export interface ChallengeRunItem {
  id: string;
  challengeId: string;
  mappedSkills: SkillSlug[];
  passed: boolean;
  completedAt: string;
}

export interface SkillEvaluationInput {
  skillSlug: SkillSlug;
  isClaimed: boolean;
  claimedAt?: string | null;
  staticEvidence: StaticEvidenceItem[];
  assessmentAttempts?: AssessmentAttemptItem[];
  challengeRuns?: ChallengeRunItem[];
  antiGamingFlags?: AntiGamingFlagRecord[];
  now?: Date;
  config?: {
    recencyHalfLifeMonths?: number;
    minQualifyingFindings?: number;
    minRecencyWeight?: number;
    assessmentValidityMonths?: number;
    challengeValidityMonths?: number;
  };
}

export interface SkillEvaluationResult {
  skillSlug: SkillSlug;
  currentLevel: SkillLevel;
  awardedAt: string | null;
  reasons: string[];
  supportingEvidenceIds: string[];
  missingRequirements: string[];
  totalRecencyWeight: number;
  qualifyingFindingsCount: number;
  limitations: string[];
  nextAction: string | null;
}

export interface SkillCapabilitySummary {
  slug: SkillSlug;
  name: string;
  description: string;
  displayOrder: number;
  maxAttainableLevel: 'SUPPORTED' | 'VERIFIED';
  currentLevel: SkillLevel;
  isClaimed: boolean;
  claimedAt: string | null;
  awardedAt: string | null;
  totalRecencyWeight: number;
  qualifyingFindingsCount: number;
  reasons: string[];
  missingRequirements: string[];
  nextAction: string | null;
  limitations: string[];
  flagsCount: number;
}

export interface SkillDetailResponse {
  summary: SkillCapabilitySummary;
  evidenceTrail: StaticEvidenceItem[];
  relevantFlags: AntiGamingFlagRecord[];
  assessmentEligible: boolean;
  challengeEligible: boolean;
  reportLimitationNote: string;
}
