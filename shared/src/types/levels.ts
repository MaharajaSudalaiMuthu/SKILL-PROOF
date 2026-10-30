export const SKILL_LEVELS = [
  'NONE',
  'CLAIMED',
  'OBSERVED',
  'SUPPORTED',
  'VERIFIED',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const ATTRIBUTION_STATUSES = ['CONFIRMED', 'UNCERTAIN', 'OTHER'] as const;
export type AttributionStatus = (typeof ATTRIBUTION_STATUSES)[number];

export const FLAG_SEVERITIES = ['BLOCKING', 'WARNING'] as const;
export type FlagSeverity = (typeof FLAG_SEVERITIES)[number];

export const ANTI_GAMING_FLAG_TYPES = [
  'UNMODIFIED_FORK',
  'TUTORIAL_SIMILARITY',
  'LARGE_INITIAL_COMMIT',
] as const;
export type AntiGamingFlagType = (typeof ANTI_GAMING_FLAG_TYPES)[number];

export const EVIDENCE_TYPES = ['STATIC', 'ASSESSMENT', 'CHALLENGE'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_VALIDITY_STATUSES = [
  'VALID',
  'EXPIRED',
  'SUPERSEDED',
  'EXCLUDED',
] as const;
export type EvidenceValidityStatus = (typeof EVIDENCE_VALIDITY_STATUSES)[number];

export const CREDENTIAL_STATUSES = [
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'SUPERSEDED',
] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
