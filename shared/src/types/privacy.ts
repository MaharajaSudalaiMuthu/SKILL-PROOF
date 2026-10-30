export type DeletionTier = 'ANALYSIS_DATA' | 'ACCOUNT';

export interface DeletionPurgedCounts {
  evidenceRecords: number;
  fileAttributions: number;
  antiGamingFlags: number;
  analysisJobs: number;
  assessmentAttempts: number;
  sandboxRuns: number;
  repositories: number;
  skillClaims: number;
  skillSnapshots: number;
  shareGrants: number;
  credentialsRevoked: number;
  userDeleted?: boolean;
  consentDeleted?: boolean;
}

export interface DeletionRequestRecord {
  id: string;
  userId: string;
  tier: DeletionTier;
  status: 'COMPLETED' | 'FAILED';
  purgedCounts: DeletionPurgedCounts;
  requestedAt: string;
  completedAt: string;
}

export interface PrivacySummaryResponse {
  userId: string;
  githubLogin: string;
  consentGiven: boolean;
  consentTimestamp?: string;
  dataCounts: {
    evidenceRecords: number;
    repositories: number;
    assessmentAttempts: number;
    sandboxRuns: number;
    skillClaims: number;
    credentials: number;
    shareGrants: number;
  };
}
