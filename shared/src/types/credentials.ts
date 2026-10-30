import { SkillLevel, CredentialStatus } from './levels.js';

export interface VerifiableCredentialSubject {
  id: string; // urn:skillproof:user:<userId>
  githubLogin: string;
  skillSlug: string;
  skillName: string;
  level: SkillLevel;
  evidenceSummary: {
    staticEvidenceCount: number;
    assessmentPassed: boolean;
    challengePassed: boolean;
    earliestEvidenceExpiry?: string;
  };
  evidenceDigest: string; // SHA-256 hex digest of evidence trail
}

export interface CredentialProof {
  type: 'Ed25519Signature2020';
  created: string; // ISO timestamp
  verificationMethod: string; // URL or relative path to public key endpoint
  canonicalizationRule: 'RFC8785';
  proofValue: string; // base64url encoded Ed25519 signature
}

export interface VerifiableCredential {
  id: string; // urn:skillproof:credential:<uuid>
  type: string[]; // ['VerifiableCredential', 'SkillProofCapabilityCredential']
  issuer: {
    id: string;
    name: string;
  };
  issuanceDate: string; // ISO timestamp
  validUntil: string; // ISO timestamp
  credentialSubject: VerifiableCredentialSubject;
  proof: CredentialProof;
}

export interface CredentialSummary {
  credentialId: string;
  skillSlug: string;
  skillName: string;
  level: SkillLevel;
  status: CredentialStatus;
  issuedAt: string;
  validUntil: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface VerifyCredentialResponse {
  valid: boolean;
  status: CredentialStatus | 'INVALID_SIGNATURE' | 'NOT_FOUND';
  reason?: string;
  credential?: VerifiableCredential;
  verifiedAt: string;
}
