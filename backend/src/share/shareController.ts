import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import {
  CreateShareSchema,
  ShareGrantItem,
  SharedSkillViewResponse,
  SharedEvidenceItem,
} from '@skillproof/shared';
import { ShareGrant } from '../models/ShareGrant.js';
import { SkillModel } from '../models/Skill.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { Repository } from '../models/Repository.js';
import { AntiGamingFlag } from '../models/AntiGamingFlag.js';
import { UserModel } from '../models/User.js';

export const shareRouter = Router();

// Rate limiter for public share viewing
const publicShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded for public sharing' },
});

/**
 * Public Endpoint: View Shared Skill Profile (R18)
 * Unauthenticated, rate-limited, strictly isolates single skill.
 */
shareRouter.get('/:token', publicShareLimiter, async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token as string;
  if (!token) {
    throw new AppError(400, 'BAD_REQUEST', 'Share token is required');
  }

  // Look up by SHA-256 hash of token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const grant = await ShareGrant.findOne({ tokenHash });

  if (!grant) {
    res.status(404).json({
      error: 'SHARE_NOT_FOUND',
      message: 'Share link not found or invalid',
    });
    return;
  }

  if (grant.status === 'REVOKED') {
    res.status(410).json({
      error: 'SHARE_REVOKED',
      message: 'This share link has been revoked by the owner',
      revokedAt: grant.revokedAt ? grant.revokedAt.toISOString() : undefined,
    });
    return;
  }

  const now = new Date();
  if (now > grant.expiresAt || grant.status === 'EXPIRED') {
    if (grant.status !== 'EXPIRED') {
      grant.status = 'EXPIRED';
      await grant.save();
    }
    res.status(410).json({
      error: 'SHARE_EXPIRED',
      message: 'This share link has expired',
      expiresAt: grant.expiresAt.toISOString(),
    });
    return;
  }

  // Grant is active! Increment view counter
  grant.viewCount += 1;
  await grant.save();

  // Retrieve skill & snapshot
  const skill = await SkillModel.findOne({ slug: grant.skillSlug }).lean();
  const snapshot = await SkillLevelSnapshot.findOne({
    userId: grant.userId,
    skillSlug: grant.skillSlug,
  }).lean();
  const user = await UserModel.findById(grant.userId).lean();

  if (!skill || !user) {
    res.status(404).json({
      error: 'SHARE_DATA_NOT_FOUND',
      message: 'Associated capability data could not be found',
    });
    return;
  }

  // Fetch qualifying evidence records
  const evidenceRecords = await EvidenceRecord.find({
    userId: grant.userId,
    skillSlug: grant.skillSlug,
    validityStatus: 'VALID',
  }).lean();

  // Resolve repository URLs for direct commit blob links
  const repoIds = [...new Set(evidenceRecords.map((e) => e.repositoryId?.toString()).filter(Boolean))] as string[];
  const repos = await Repository.find({ _id: { $in: repoIds } }).lean();
  const repoMap = new Map<string, { repoUrl: string }>();
  for (const r of repos) {
    const repoUrl = `https://github.com/${r.fullName}`;
    repoMap.set(r._id.toString(), { repoUrl });
  }

  const evidenceItems: SharedEvidenceItem[] = evidenceRecords
    .filter((e) => e.filePath && e.startLine !== undefined && e.endLine !== undefined)
    .map((e) => {
      const repoKey = e.repositoryId ? e.repositoryId.toString() : '';
      const repo = repoMap.get(repoKey);
      const repoUrl = repo?.repoUrl || '';
      let githubBlobUrl: string | undefined;
      if (repoUrl && e.commitSha && e.filePath) {
        githubBlobUrl = `${repoUrl}/blob/${e.commitSha}/${e.filePath}#L${e.startLine}-L${e.endLine}`;
      }

      return {
        repositoryUrl: repoUrl,
        filePath: e.filePath || '',
        startLine: e.startLine || 0,
        endLine: e.endLine || 0,
        detectorName: e.detectorName || '',
        matchedPattern: e.matchedPattern || '',
        commitSha: e.commitSha || '',
        commitDate: e.commitDate ? e.commitDate.toISOString() : new Date().toISOString(),
        githubBlobUrl,
      };
    });

  // Fetch anti-gaming flags on these repositories
  const flags = await AntiGamingFlag.find({
    userId: grant.userId,
    repositoryId: { $in: repoIds },
  }).lean();

  const publicResponse: SharedSkillViewResponse = {
    skillSlug: skill.slug,
    skillName: skill.name,
    category: skill.description || 'Core Java',
    level: snapshot?.currentLevel || 'NONE',
    developerHandle: user.githubLogin,
    evaluatedAt: snapshot?.evaluatedAt ? snapshot.evaluatedAt.toISOString() : grant.createdAt.toISOString(),
    evidence: evidenceItems,
    flags: flags.map((f) => ({
      type: f.flagType,
      severity: f.severity,
      explanation: f.explanation,
    })),
    limitationNotice:
      'Levels describe evidence strength, not a guarantee of on-the-job performance.',
    sharedAt: grant.createdAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
  };

  res.json(publicResponse);
});

/**
 * Developer Endpoints (require authentication)
 */
shareRouter.use(requireAuth as any);

/**
 * List all share grants created by user
 */
shareRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const grants = await ShareGrant.find({ userId }).sort({ createdAt: -1 });

  const skills = await SkillModel.find({}).lean();
  const skillNameMap = new Map<string, string>();
  for (const s of skills) {
    skillNameMap.set(s.slug, s.name);
  }

  const items: ShareGrantItem[] = grants.map((g) => {
    return {
      id: g._id.toString(),
      skillSlug: g.skillSlug,
      skillName: skillNameMap.get(g.skillSlug) || g.skillSlug,
      createdAt: g.createdAt.toISOString(),
      expiresAt: g.expiresAt.toISOString(),
      status: g.status,
      viewCount: g.viewCount,
      shareUrl: `${config.env.APP_BASE_URL}/shared/${g._id.toString()}`,
    };
  });

  res.json({ shares: items });
});

/**
 * Create a new per-skill revocable share grant (R18)
 */
shareRouter.post('/', requireCsrf, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const parsed = CreateShareSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid share request');
  }

  const { skillSlug, expiryDays } = parsed.data;

  // 1. Verify skill exists
  const skill = await SkillModel.findOne({ slug: skillSlug });
  if (!skill) {
    throw new AppError(404, 'SKILL_NOT_FOUND', 'Skill not found');
  }

  // 2. Generate cryptographically strong 256-bit token
  const plainToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

  const expiresAt = new Date(Date.now() + expiryDays * 24 * 3600 * 1000);

  const grant = await ShareGrant.create({
    userId,
    skillSlug,
    tokenHash,
    expiresAt,
    status: 'ACTIVE',
    viewCount: 0,
  });

  res.status(201).json({
    id: grant._id.toString(),
    skillSlug,
    skillName: skill.name,
    token: plainToken,
    shareUrl: `${config.env.APP_BASE_URL}/shared/${plainToken}`,
    expiresAt: expiresAt.toISOString(),
    status: grant.status,
  });
});

/**
 * Revoke a share grant with immediate effect (R18)
 */
shareRouter.post('/:id/revoke', requireCsrf, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const shareId = req.params.id as string;

  const grant = await ShareGrant.findOne({ _id: shareId, userId });
  if (!grant) {
    throw new AppError(404, 'NOT_FOUND', 'Share grant not found');
  }

  grant.status = 'REVOKED';
  grant.revokedAt = new Date();
  await grant.save();

  res.json({
    message: 'Share grant successfully revoked',
    id: grant._id.toString(),
    status: grant.status,
    revokedAt: grant.revokedAt.toISOString(),
  });
});

/**
 * DELETE alias for revoking a share grant
 */
shareRouter.delete('/:id', requireCsrf, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const shareId = req.params.id as string;

  const grant = await ShareGrant.findOne({ _id: shareId, userId });
  if (!grant) {
    throw new AppError(404, 'NOT_FOUND', 'Share grant not found');
  }

  grant.status = 'REVOKED';
  grant.revokedAt = new Date();
  await grant.save();

  res.json({
    message: 'Share grant successfully revoked',
    id: grant._id.toString(),
    status: grant.status,
    revokedAt: grant.revokedAt.toISOString(),
  });
});
