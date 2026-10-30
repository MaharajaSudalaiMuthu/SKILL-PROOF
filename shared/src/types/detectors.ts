import { SkillSlug } from './skills.js';
import { AttributionStatus, FlagSeverity, AntiGamingFlagType, EvidenceValidityStatus, EvidenceType } from './levels.js';

export interface DetectorFinding {
  skillSlug: SkillSlug;
  detectorName: string;
  detectorVersion: string;
  filePath: string;
  startLine: number;
  endLine: number;
  matchedPattern: string;
  keyAttributes: Record<string, unknown>;
  whatThisShows: string;
  whatThisDoesNotProve: string;
  supportingCommitSha?: string;
  supportingCommitDate?: string;
  attributionStatus?: AttributionStatus;
}

export interface AntiGamingFlagRecord {
  id?: string;
  repositoryId: string;
  userId: string;
  flagType: AntiGamingFlagType;
  severity: FlagSeverity;
  explanation: string;
  metricValue: number;
  createdAt: string;
}

export interface EvidenceRecordSummary {
  id: string;
  userId: string;
  skillSlug: SkillSlug;
  evidenceType: EvidenceType;
  validityStatus: EvidenceValidityStatus;
  attributionStatus: AttributionStatus;
  repositoryId?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  commitSha?: string;
  commitDate?: string;
  detectorName?: string;
  matchedPattern?: string;
  dedupeKey: string;
  rawDetails: Record<string, unknown>;
  recencyWeight: number;
  createdAt: string;
}
