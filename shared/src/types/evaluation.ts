import { SkillSlug } from './skills.js';
import { SkillLevel } from './levels.js';

export interface PseudonymizedSubjectRecord {
  subjectId: string;
  skillSlug: SkillSlug;
  claimed: boolean;
  staticEvidenceCount: number;
  assessmentPassed: boolean;
  assessmentScore: number | null;
  sandboxPassed: boolean;
  platformLevel: SkillLevel;
  evaluatedAt: string;
}

export interface ExpertRatingEntry {
  subjectId: string;
  skillSlug: SkillSlug;
  expertLevel: SkillLevel;
  confidence?: number;
  notes?: string;
}

export interface ConfusionMatrixRow {
  NONE: number;
  CLAIMED: number;
  OBSERVED: number;
  SUPPORTED: number;
  VERIFIED: number;
}

export type ConfusionMatrix = Record<SkillLevel, ConfusionMatrixRow>;

export interface AgreementMetrics {
  totalPairs: number;
  percentAgreement: number;
  cohensKappa: number;
  weightedKappaLinear: number;
  weightedKappaQuadratic: number;
  confusionMatrix: ConfusionMatrix;
}

export interface EvaluationExportPayload {
  exportedAt: string;
  totalSubjects: number;
  totalRecords: number;
  records: PseudonymizedSubjectRecord[];
}

export interface ComputeAgreementRequest {
  ratings: ExpertRatingEntry[];
}

export interface ComputeAgreementResponse {
  metrics: AgreementMetrics;
  evaluatedAt: string;
}
