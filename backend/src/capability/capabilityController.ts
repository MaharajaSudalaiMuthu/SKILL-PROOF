import { Router, Response } from 'express';
import {
  SkillSlug,
  SKILL_SLUGS,
  SkillCapabilitySummary,
  SkillDetailResponse,
  StaticEvidenceItem,
  AntiGamingFlagRecord,
} from '@skillproof/shared';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { SkillModel } from '../models/Skill.js';
import { UserSkillClaimModel } from '../models/UserSkillClaim.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { AntiGamingFlag } from '../models/AntiGamingFlag.js';
import { Repository } from '../models/Repository.js';
import { recomputeUserSnapshots } from '../engine/snapshotService.js';
import { AppError } from '../middleware/errorHandler.js';

export const capabilityRouter = Router();

// GET /api/capabilities - List capability status for all 8 canonical skills
capabilityRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;

  // Check if snapshots exist; if not, recompute
  let snapshots = await SkillLevelSnapshot.find({ userId });
  if (snapshots.length < SKILL_SLUGS.length) {
    await recomputeUserSnapshots(userId);
    snapshots = await SkillLevelSnapshot.find({ userId });
  }

  const snapshotMap = new Map(snapshots.map((s) => [s.skillSlug, s]));
  const skills = await SkillModel.find().sort({ displayOrder: 1 });
  const claims = await UserSkillClaimModel.find({ userId });
  const claimMap = new Map(claims.map((c) => [c.skillSlug, c.claimedAt]));
  const flags = await AntiGamingFlag.find({ userId });

  const totalFlagsCount = flags.length;
  const blockingFlagsCount = flags.filter((f) => f.severity === 'BLOCKING').length;

  const capabilities: SkillCapabilitySummary[] = skills.map((s) => {
    const slug = s.slug as SkillSlug;
    const snap = snapshotMap.get(slug);
    const isClaimed = claimMap.has(slug);
    const claimedAt = claimMap.get(slug)?.toISOString() ?? null;

    return {
      slug,
      name: s.name,
      description: s.description,
      displayOrder: s.displayOrder,
      maxAttainableLevel: s.maxAttainableLevel as 'SUPPORTED' | 'VERIFIED',
      currentLevel: snap?.currentLevel ?? (isClaimed ? 'CLAIMED' : 'NONE'),
      isClaimed,
      claimedAt,
      awardedAt: snap?.awardedAt ? snap.awardedAt.toISOString() : null,
      totalRecencyWeight: snap?.totalRecencyWeight ?? 0,
      qualifyingFindingsCount: snap?.qualifyingFindingsCount ?? 0,
      reasons: snap?.reasons ?? [],
      missingRequirements: snap?.missingRequirements ?? [],
      nextAction: snap?.nextAction ?? null,
      limitations: snap?.limitations ?? [],
      flagsCount: totalFlagsCount,
    };
  });

  res.status(200).json({
    capabilities,
    totalFlagsCount,
    blockingFlagsCount,
  });
});

// GET /api/capabilities/:skillSlug - Detailed capability breakdown & evidence trail
capabilityRouter.get('/:skillSlug', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { skillSlug } = req.params;
  const userId = req.user!._id;

  if (!skillSlug || !SKILL_SLUGS.includes(skillSlug as SkillSlug)) {
    throw new AppError(400, 'INVALID_SKILL_SLUG', `Invalid skill slug: '${skillSlug}'.`);
  }

  const slug = skillSlug as SkillSlug;
  const skill = await SkillModel.findOne({ slug });
  if (!skill) {
    throw new AppError(404, 'SKILL_NOT_FOUND', `Skill '${skillSlug}' not found.`);
  }

  let snap = await SkillLevelSnapshot.findOne({ userId, skillSlug: slug });
  if (!snap) {
    await recomputeUserSnapshots(userId);
    snap = await SkillLevelSnapshot.findOne({ userId, skillSlug: slug });
  }

  const claim = await UserSkillClaimModel.findOne({ userId, skillSlug: slug });
  const isClaimed = !!claim;
  const claimedAt = claim?.claimedAt?.toISOString() ?? null;

  const userRepos = await Repository.find({ userId });
  const repoMap = new Map<string, { fullName: string; isFork: boolean }>();
  for (const r of userRepos) {
    repoMap.set(r._id.toString(), { fullName: r.fullName, isFork: r.isFork });
  }

  const flags = await AntiGamingFlag.find({ userId });
  const blockingRepoIds = new Set(
    flags.filter((f) => f.severity === 'BLOCKING').map((f) => f.repositoryId.toString())
  );

  const relevantFlags: AntiGamingFlagRecord[] = flags.map((f) => ({
    repositoryId: f.repositoryId.toString(),
    userId: f.userId.toString(),
    flagType: f.flagType,
    severity: f.severity,
    explanation: f.explanation,
    metricValue: f.metricValue,
    createdAt: f.createdAt.toISOString(),
  }));

  const evidenceDocs = await EvidenceRecord.find({ userId, skillSlug: slug }).sort({ recencyWeight: -1, createdAt: -1 });
  const evidenceTrail: StaticEvidenceItem[] = evidenceDocs.map((doc) => {
    const repoInfo = doc.repositoryId ? repoMap.get(doc.repositoryId.toString()) : undefined;
    const hasBlockingFlag = doc.repositoryId ? blockingRepoIds.has(doc.repositoryId.toString()) : false;
    const repoFullName = repoInfo?.fullName ?? 'unknown/repo';
    const repoName = repoFullName.split('/')[1] ?? repoFullName;

    const start = doc.startLine ?? 1;
    const end = doc.endLine ?? start;
    const githubBlobUrl =
      repoInfo && doc.commitSha && doc.filePath
        ? `https://github.com/${repoFullName}/blob/${doc.commitSha}/${doc.filePath}#L${start}-L${end}`
        : undefined;

    return {
      id: doc._id.toString(),
      skillSlug: doc.skillSlug,
      repositoryId: doc.repositoryId?.toString() ?? '',
      repositoryName: repoName,
      repositoryFullName: repoFullName,
      isFork: repoInfo?.isFork ?? false,
      hasBlockingFlag,
      filePath: doc.filePath ?? '',
      startLine: start,
      endLine: end,
      commitSha: doc.commitSha ?? '',
      commitDate: doc.commitDate ? doc.commitDate.toISOString() : doc.createdAt.toISOString(),
      detectorName: doc.detectorName ?? '',
      matchedPattern: doc.matchedPattern ?? '',
      validityStatus: doc.validityStatus,
      attributionStatus: doc.attributionStatus,
      recencyWeight: doc.recencyWeight,
      whatThisShows: (doc.rawDetails?.whatThisShows as string) ?? undefined,
      whatThisDoesNotProve: (doc.rawDetails?.whatThisDoesNotProve as string) ?? undefined,
      rawDetails: doc.rawDetails,
      githubBlobUrl,
    };
  });

  const currentLevel = snap?.currentLevel ?? (isClaimed ? 'CLAIMED' : 'NONE');
  const summary: SkillCapabilitySummary = {
    slug,
    name: skill.name,
    description: skill.description,
    displayOrder: skill.displayOrder,
    maxAttainableLevel: skill.maxAttainableLevel as 'SUPPORTED' | 'VERIFIED',
    currentLevel,
    isClaimed,
    claimedAt,
    awardedAt: snap?.awardedAt ? snap.awardedAt.toISOString() : null,
    totalRecencyWeight: snap?.totalRecencyWeight ?? 0,
    qualifyingFindingsCount: snap?.qualifyingFindingsCount ?? 0,
    reasons: snap?.reasons ?? [],
    missingRequirements: snap?.missingRequirements ?? [],
    nextAction: snap?.nextAction ?? null,
    limitations: snap?.limitations ?? [],
    flagsCount: flags.length,
  };

  const assessmentEligible = currentLevel === 'OBSERVED';
  const challengeEligible = currentLevel === 'SUPPORTED' && slug !== 'unit-tests-meaningful-assertions';
  const reportLimitationNote =
    'SkillProof capability levels describe static and dynamic evidence strength based on public code artifacts and time-bounded evaluations. They are not a guarantee of future job performance or code quality in private or commercial codebases.';

  const response: SkillDetailResponse = {
    summary,
    evidenceTrail,
    relevantFlags,
    assessmentEligible,
    challengeEligible,
    reportLimitationNote,
  };

  res.status(200).json(response);
});
