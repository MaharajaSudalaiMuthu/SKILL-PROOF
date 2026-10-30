import { AttributionStatus, JobStatus } from './levels.js';

export interface LineRangeAttribution {
  startLine: number;
  endLine: number;
  commitSha: string;
  commitDate: string; // ISO date string
  authorLogin: string | null;
  status: AttributionStatus;
}

export interface FileAttributionSummary {
  filePath: string;
  totalLines: number;
  confirmedLines: number;
  uncertainLines: number;
  otherLines: number;
  ranges: LineRangeAttribution[];
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  isFork: boolean;
  description: string | null;
  updatedAt: string;
}

export interface RepositorySummary {
  id: string;
  userId: string;
  githubRepoId: number;
  fullName: string;
  cloneUrl: string;
  isFork: boolean;
  defaultBranch: string;
  sourceType?: 'GITHUB' | 'ZIP_UPLOAD';
  isPrivate?: boolean;
  detectedLanguages?: string[];
  detectedFrameworks?: string[];
  lastAnalyzedAt: string | null;
  lastJobStatus: JobStatus | null;
  createdAt: string;
}

export interface AnalysisJobSummary {
  id: string;
  repositoryId: string;
  repositoryFullName?: string;
  userId: string;
  status: JobStatus;
  progressPercent: number;
  stage: string;
  errorMessage: string | null;
  filesAnalyzed: number;
  totalLines: number;
  confirmedLines: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
