import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import {
  IssueCredentialSchema,
  VerifyCredentialPastedSchema,
  VerifiableCredential,
  CredentialSummary,
  VerifyCredentialResponse,
  SkillLevel,
} from '@skillproof/shared';
import { Credential } from '../models/Credential.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { SkillModel } from '../models/Skill.js';
import { UserModel } from '../models/User.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { SandboxRun } from '../models/SandboxRun.js';
import { Challenge } from '../models/Challenge.js';
import { canonicalizeJson } from '../utils/canonicalJson.js';
import {
  signWithEd25519,
  verifyWithEd25519,
  getPublicKeyPem,
} from '../utils/keyManager.js';

export const credentialRouter = Router();

const LEVEL_MIN_ELIGIBLE: Record<SkillLevel, boolean> = {
  NONE: false,
  CLAIMED: false,
  OBSERVED: true,
  SUPPORTED: true,
  VERIFIED: true,
};

/**
 * Public Key Discovery Endpoints (R16, R17)
 */
credentialRouter.get('/public-key', (_req: Request, res: Response) => {
  res.json({
    format: 'SPKI-PEM',
    algorithm: 'Ed25519',
    publicKey: getPublicKeyPem(),
  });
});

/**
 * Public Verification by Credential ID (R17)
 */
credentialRouter.get('/:credentialId/verify', async (req: Request, res: Response): Promise<void> => {
  const credentialId = req.params.credentialId as string;
  const credRecord = await Credential.findOne({ credentialId });

  if (!credRecord) {
    const notFoundRes: VerifyCredentialResponse = {
      valid: false,
      status: 'NOT_FOUND',
      reason: 'Credential ID not registered in SkillProof ledger',
      verifiedAt: new Date().toISOString(),
    };
    res.status(404).json(notFoundRes);
    return;
  }

  // Check expiration
  if (credRecord.status === 'ACTIVE' && new Date() > credRecord.validUntil) {
    credRecord.status = 'EXPIRED';
    await credRecord.save();
  }

  // Cryptographic signature check
  const payload = credRecord.credentialPayload;
  const { proof, ...unsignedDoc } = payload;
  const canonical = canonicalizeJson(unsignedDoc);
  const sigValid = verifyWithEd25519(canonical, proof?.proofValue);

  if (!sigValid) {
    const invalidSigRes: VerifyCredentialResponse = {
      valid: false,
      status: 'INVALID_SIGNATURE',
      reason: 'Cryptographic signature verification failed - payload tampering detected',
      credential: credRecord.credentialPayload,
      verifiedAt: new Date().toISOString(),
    };
    res.status(200).json(invalidSigRes);
    return;
  }

  if (credRecord.status !== 'ACTIVE') {
    const inactiveRes: VerifyCredentialResponse = {
      valid: false,
      status: credRecord.status,
      reason: `Credential is ${credRecord.status}${credRecord.revocationReason ? `: ${credRecord.revocationReason}` : ''}`,
      credential: credRecord.credentialPayload,
      verifiedAt: new Date().toISOString(),
    };
    res.status(200).json(inactiveRes);
    return;
  }

  const successRes: VerifyCredentialResponse = {
    valid: true,
    status: 'ACTIVE',
    credential: credRecord.credentialPayload,
    verifiedAt: new Date().toISOString(),
  };
  res.json(successRes);
});

/**
 * Public Verification by Pasted JSON Payload (R17)
 * Tampering with any field makes cryptographic verification fail.
 */
credentialRouter.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const parsed = VerifyCredentialPastedSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request format');
  }

  const credential = parsed.data.credential as VerifiableCredential;
  if (!credential || !credential.id || !credential.proof || !credential.proof.proofValue) {
    const invalidFormatRes: VerifyCredentialResponse = {
      valid: false,
      status: 'INVALID_SIGNATURE',
      reason: 'Credential missing required fields, ID, or cryptographic proof',
      verifiedAt: new Date().toISOString(),
    };
    res.status(200).json(invalidFormatRes);
    return;
  }

  // Reconstruct canonical string without proof
  const { proof, ...unsignedDoc } = credential;
  const canonical = canonicalizeJson(unsignedDoc);
  const sigValid = verifyWithEd25519(canonical, proof.proofValue);

  if (!sigValid) {
    const tamperedRes: VerifyCredentialResponse = {
      valid: false,
      status: 'INVALID_SIGNATURE',
      reason: 'Cryptographic signature verification failed - document has been altered or tampered with',
      credential,
      verifiedAt: new Date().toISOString(),
    };
    res.status(200).json(tamperedRes);
    return;
  }

  // If signature passes, check server status in database
  const dbRecord = await Credential.findOne({ credentialId: credential.id });
  if (dbRecord) {
    if (dbRecord.status === 'ACTIVE' && new Date() > dbRecord.validUntil) {
      dbRecord.status = 'EXPIRED';
      await dbRecord.save();
    }

    if (dbRecord.status !== 'ACTIVE') {
      const revokedRes: VerifyCredentialResponse = {
        valid: false,
        status: dbRecord.status,
        reason: `Credential is ${dbRecord.status} on ledger${dbRecord.revocationReason ? `: ${dbRecord.revocationReason}` : ''}`,
        credential,
        verifiedAt: new Date().toISOString(),
      };
      res.status(200).json(revokedRes);
      return;
    }
  }

  const validRes: VerifyCredentialResponse = {
    valid: true,
    status: 'ACTIVE',
    reason: dbRecord ? 'Cryptographic signature and ledger status valid' : 'Cryptographic signature verified (offline mode)',
    credential,
    verifiedAt: new Date().toISOString(),
  };
  res.json(validRes);
});

/**
 * Developer Endpoints (require authentication and CSRF)
 */
credentialRouter.use(requireAuth as any);

/**
 * List all credentials issued to developer
 */
credentialRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const records = await Credential.find({ userId }).sort({ issuedAt: -1 });

  const skills = await SkillModel.find({}).lean();
  const skillNameMap = new Map<string, string>();
  for (const s of skills) {
    skillNameMap.set(s.slug, s.name);
  }

  const summaries: CredentialSummary[] = records.map((r) => ({
    credentialId: r.credentialId,
    skillSlug: r.skillSlug,
    skillName: skillNameMap.get(r.skillSlug) || r.skillSlug,
    level: r.level,
    status: r.status,
    issuedAt: r.issuedAt.toISOString(),
    validUntil: r.validUntil.toISOString(),
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : undefined,
    revocationReason: r.revocationReason,
  }));

  res.json({ credentials: summaries });
});

/**
 * Download specific credential JSON
 */
credentialRouter.get('/:credentialId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const credentialId = req.params.credentialId as string;
  const record = await Credential.findOne({ userId, credentialId });

  if (!record) {
    throw new AppError(404, 'NOT_FOUND', 'Credential not found');
  }

  res.json(record.credentialPayload);
});

/**
 * Issue a new signed credential for a skill (R16)
 */
credentialRouter.post('/issue', requireCsrf, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const parsed = IssueCredentialSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid credential request');
  }

  const { skillSlug, validMonths } = parsed.data;

  // 1. Verify skill exists
  const skill = await SkillModel.findOne({ slug: skillSlug });
  if (!skill) {
    throw new AppError(404, 'SKILL_NOT_FOUND', 'Skill not found');
  }

  // 2. Check snapshot and eligibility (must be >= OBSERVED)
  const snapshot = await SkillLevelSnapshot.findOne({ userId, skillSlug });
  const currentLevel: SkillLevel = snapshot?.currentLevel || 'NONE';

  if (!LEVEL_MIN_ELIGIBLE[currentLevel]) {
    throw new AppError(
      400,
      'INSUFFICIENT_LEVEL',
      `Cannot issue credential: skill must reach at least Observed level (current level: ${currentLevel})`
    );
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // 3. Evidence summary & earliest expiry
  const qualifyingEvidence = await EvidenceRecord.find({
    userId,
    skillSlug,
    validityStatus: 'VALID',
  }).sort({ commitDate: 1 });

  const staticEvidenceCount = qualifyingEvidence.length;

  // Static evidence valid for 12 months from commit date
  let earliestEvidenceExpiry: Date | undefined;
  if (qualifyingEvidence.length > 0 && qualifyingEvidence[0]?.commitDate) {
    const oldestCommit = qualifyingEvidence[0].commitDate;
    earliestEvidenceExpiry = new Date(oldestCommit.getTime() + 365 * 24 * 3600 * 1000);
  }

  // Check assessment pass
  const passedAssessment = await AssessmentAttempt.findOne({
    userId,
    skillSlug,
    passed: true,
  });
  const assessmentPassed = !!passedAssessment;

  // Check challenge pass
  const challengesForSkill = await Challenge.find({ mappedSkills: skillSlug }).lean();
  const challengeSlugs = challengesForSkill.map((c) => c.slug);
  const passedChallenge = await SandboxRun.findOne({
    userId,
    challengeSlug: { $in: challengeSlugs },
    passed: true,
  });
  const challengePassed = !!passedChallenge;

  // Calculate validity period: at most 12 months, and not beyond earliestEvidenceExpiry if present
  const now = new Date();
  const maxValidDate = new Date(now.getTime() + validMonths * 30 * 24 * 3600 * 1000);
  let validUntil = maxValidDate;
  if (earliestEvidenceExpiry && earliestEvidenceExpiry > now && earliestEvidenceExpiry < maxValidDate) {
    validUntil = earliestEvidenceExpiry;
  }

  // Evidence digest (SHA-256 hash of sorted evidence IDs)
  const evidenceIdList = qualifyingEvidence.map((e) => e._id.toString()).sort();
  if (passedAssessment) evidenceIdList.push(`assessment:${passedAssessment._id.toString()}`);
  if (passedChallenge) evidenceIdList.push(`challenge:${passedChallenge._id.toString()}`);
  const evidenceDigest = crypto
    .createHash('sha256')
    .update(evidenceIdList.join(','))
    .digest('hex');

  // Supersede existing active credential for this skill
  await Credential.updateMany(
    { userId, skillSlug, status: 'ACTIVE' },
    {
      $set: {
        status: 'SUPERSEDED',
        revokedAt: now,
        revocationReason: 'Replaced by newly issued credential',
      },
    }
  );

  // 4. Construct VC-style JSON document
  const uuid = crypto.randomUUID();
  const credentialId = `urn:skillproof:credential:${uuid}`;

  const doc = {
    id: credentialId,
    type: ['VerifiableCredential', 'SkillProofCapabilityCredential'],
    issuer: {
      id: `${config.env.API_BASE_URL}/api/credentials/issuer`,
      name: 'SkillProof Verification Engine',
    },
    issuanceDate: now.toISOString(),
    validUntil: validUntil.toISOString(),
    credentialSubject: {
      id: `urn:skillproof:user:${userId.toString()}`,
      githubLogin: user.githubLogin,
      skillSlug: skill.slug,
      skillName: skill.name,
      level: currentLevel,
      evidenceSummary: {
        staticEvidenceCount,
        assessmentPassed,
        challengePassed,
        earliestEvidenceExpiry: earliestEvidenceExpiry?.toISOString(),
      },
      evidenceDigest,
    },
  };

  // 5. Sign with RFC 8785 canonical JSON
  const canonical = canonicalizeJson(doc);
  const signature = signWithEd25519(canonical);

  const proof = {
    type: 'Ed25519Signature2020' as const,
    created: now.toISOString(),
    verificationMethod: `${config.env.API_BASE_URL}/api/credentials/public-key`,
    canonicalizationRule: 'RFC8785' as const,
    proofValue: signature,
  };

  const verifiableCredential: VerifiableCredential = {
    ...doc,
    proof,
  };

  // 6. Persist in database
  await Credential.create({
    credentialId,
    userId,
    skillSlug,
    level: currentLevel,
    status: 'ACTIVE',
    issuedAt: now,
    validUntil,
    credentialPayload: verifiableCredential,
  });

  res.status(201).json(verifiableCredential);
});

/**
 * Revoke an active credential (R16, R17)
 */
credentialRouter.post('/:credentialId/revoke', requireCsrf, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const credentialId = req.params.credentialId as string;
  const reason = req.body?.reason;

  const record = await Credential.findOne({ userId, credentialId });
  if (!record) {
    throw new AppError(404, 'NOT_FOUND', 'Credential not found');
  }

  if (record.status === 'REVOKED') {
    res.json({ message: 'Credential already revoked', status: record.status });
    return;
  }

  record.status = 'REVOKED';
  record.revokedAt = new Date();
  record.revocationReason = reason || 'Revoked by developer';
  await record.save();

  res.json({
    message: 'Credential successfully revoked',
    credentialId: record.credentialId,
    status: record.status,
    revokedAt: record.revokedAt.toISOString(),
  });
});
