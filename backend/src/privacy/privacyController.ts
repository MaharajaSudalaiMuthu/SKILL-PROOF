import { Router, Response } from 'express';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  DeleteAnalysisSchema,
  DeleteAccountSchema,
  PrivacySummaryResponse,
} from '@skillproof/shared';
import { purgeAnalysisData, purgeUserAccount } from './privacyService.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { Repository } from '../models/Repository.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { SandboxRun } from '../models/SandboxRun.js';
import { UserSkillClaimModel } from '../models/UserSkillClaim.js';
import { Credential } from '../models/Credential.js';
import { ShareGrant } from '../models/ShareGrant.js';
import { ConsentModel } from '../models/Consent.js';

export const privacyRouter = Router();

// All privacy endpoints require active authentication
privacyRouter.use(requireAuth as any);

/**
 * Get privacy summary and counts of stored data for current user (R19)
 */
privacyRouter.get('/summary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;

  const [
    evidenceCount,
    repoCount,
    assessmentCount,
    sandboxCount,
    claimCount,
    credCount,
    shareCount,
    consent,
  ] = await Promise.all([
    EvidenceRecord.countDocuments({ userId }),
    Repository.countDocuments({ userId }),
    AssessmentAttempt.countDocuments({ userId }),
    SandboxRun.countDocuments({ userId }),
    UserSkillClaimModel.countDocuments({ userId }),
    Credential.countDocuments({ userId, status: 'ACTIVE' }),
    ShareGrant.countDocuments({ userId, status: 'ACTIVE' }),
    ConsentModel.findOne({ userId }),
  ]);

  const summary: PrivacySummaryResponse = {
    userId: userId.toString(),
    githubLogin: req.user!.githubLogin,
    consentGiven: !!consent,
    consentTimestamp: consent ? consent.agreedAt.toISOString() : undefined,
    dataCounts: {
      evidenceRecords: evidenceCount,
      repositories: repoCount,
      assessmentAttempts: assessmentCount,
      sandboxRuns: sandboxCount,
      skillClaims: claimCount,
      credentials: credCount,
      shareGrants: shareCount,
    },
  };

  res.json(summary);
});

/**
 * Tier 1: Delete Analysis Data (R19)
 * Purges evidence, attempts, repositories, snapshots, claims, and share grants.
 * Converts active credentials into minimal REVOKED tombstones.
 */
privacyRouter.post(
  '/delete-analysis',
  requireCsrf,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = DeleteAnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "Confirmation required: please confirm with 'DELETE ANALYSIS DATA'"
      );
    }

    const auditContext = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const purgedCounts = await purgeAnalysisData(req.user!._id, auditContext);

    res.json({
      message: 'Analysis data successfully purged from SkillProof.',
      purgedCounts,
    });
  }
);

/**
 * Tier 2: Delete Account & All Associated Data (R19)
 * Executes Tier 1, removes consent and user record, and clears session cookie.
 */
privacyRouter.post(
  '/delete-account',
  requireCsrf,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parsed = DeleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "Confirmation required: please confirm with 'DELETE MY ACCOUNT'"
      );
    }

    const auditContext = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const purgedCounts = await purgeUserAccount(req.user!._id, auditContext);

    // Clear session cookie immediately
    res.clearCookie('SKILLPROOF_SESSION', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      message: 'Account and all associated records permanently purged from SkillProof.',
      purgedCounts,
    });
  }
);
