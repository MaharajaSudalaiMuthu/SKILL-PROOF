import { SkillLevel } from './levels.js';

export interface ShareGrantItem {
  id: string;
  skillSlug: string;
  skillName: string;
  createdAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  viewCount: number;
  shareUrl: string;
}

export interface SharedEvidenceItem {
  repositoryUrl: string;
  filePath: string;
  startLine: number;
  endLine: number;
  detectorName: string;
  matchedPattern: string;
  commitSha: string;
  commitDate: string;
  githubBlobUrl?: string;
}

export interface SharedSkillViewResponse {
  skillSlug: string;
  skillName: string;
  category: string;
  level: SkillLevel;
  developerHandle: string;
  evaluatedAt: string;
  evidence: SharedEvidenceItem[];
  flags: {
    type: string;
    severity: string;
    explanation: string;
  }[];
  limitationNotice: string;
  sharedAt: string;
  expiresAt: string;
}
