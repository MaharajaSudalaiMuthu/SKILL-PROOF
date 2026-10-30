import { Types } from 'mongoose';
import {
  SKILL_SLUGS,
  SkillSlug,
  StaticEvidenceItem,
  SkillEvaluationResult,
  AntiGamingFlagRecord,
  AssessmentAttemptItem,
  ChallengeRunItem,
} from '@skillproof/shared';
import { UserSkillClaimModel } from '../models/UserSkillClaim.js';
import { Repository } from '../models/Repository.js';
import { AntiGamingFlag } from '../models/AntiGamingFlag.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { Challenge } from '../models/Challenge.js';
import { SandboxRun } from '../models/SandboxRun.js';
import { Credential } from '../models/Credential.js';
import { evaluateSkillLevel } from './capabilityEngine.js';
import { config } from '../config/index.js';
import { logger } from '../middleware/pinoLogger.js';

export async function recomputeUserSnapshots(
  userId: string | Types.ObjectId
): Promise<SkillEvaluationResult[]> {
  const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  // 1. Fetch user's skill claims
  const claims = await UserSkillClaimModel.find({ userId: userObjId });
  const claimsMap = new Map<string, Date>();
  for (const c of claims) {
    claimsMap.set(c.skillSlug, c.claimedAt ?? new Date());
  }

  // 2. Fetch user's repositories
  const repos = await Repository.find({ userId: userObjId });
  const repoMap = new Map<string, { fullName: string; isFork: boolean }>();
  for (const r of repos) {
    repoMap.set(r._id.toString(), { fullName: r.fullName, isFork: r.isFork });
  }

  // 3. Fetch user's anti-gaming flags
  const flags = await AntiGamingFlag.find({ userId: userObjId });
  const blockingRepoIds = new Set<string>();
  const antiGamingFlagRecords: AntiGamingFlagRecord[] = [];

  for (const f of flags) {
    if (f.severity === 'BLOCKING') {
      blockingRepoIds.add(f.repositoryId.toString());
    }
    antiGamingFlagRecords.push({
      repositoryId: f.repositoryId.toString(),
      userId: f.userId.toString(),
      flagType: f.flagType,
      severity: f.severity,
      explanation: f.explanation,
      metricValue: f.metricValue,
      createdAt: f.createdAt.toISOString(),
    });
  }

  // 4. Fetch static evidence records
  const evidenceDocs = await EvidenceRecord.find({ userId: userObjId });
  const staticEvidenceBySkill = new Map<SkillSlug, StaticEvidenceItem[]>();

  for (const doc of evidenceDocs) {
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

    const item: StaticEvidenceItem = {
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

    const existing = staticEvidenceBySkill.get(doc.skillSlug) ?? [];
    existing.push(item);
    staticEvidenceBySkill.set(doc.skillSlug, existing);
  }

  // 5. Fetch user's completed assessment attempts
  const completedAttempts = await AssessmentAttempt.find({
    userId: userObjId,
    status: 'COMPLETED',
  });
  const assessmentAttemptsBySkill = new Map<SkillSlug, AssessmentAttemptItem[]>();
  for (const a of completedAttempts) {
    const item: AssessmentAttemptItem = {
      id: a._id.toString(),
      skillSlug: a.skillSlug,
      score: a.score,
      passed: a.passed,
      completedAt: (a.completedAt ?? a.updatedAt).toISOString(),
    };
    const list = assessmentAttemptsBySkill.get(a.skillSlug) ?? [];
    list.push(item);
    assessmentAttemptsBySkill.set(a.skillSlug, list);
  }

  // 6. Fetch user's passed coding challenge runs and challenge skill mappings
  const allChallenges = await Challenge.find({}).lean();
  const challengeSkillMap = new Map<string, SkillSlug[]>();
  for (const c of allChallenges) {
    challengeSkillMap.set(c.slug, c.mappedSkills as SkillSlug[]);
  }

  const passedSandboxRuns = await SandboxRun.find({
    userId: userObjId,
    passed: true,
  }).lean();

  const challengeRuns: ChallengeRunItem[] = passedSandboxRuns.map((r) => ({
    id: r._id.toString(),
    challengeId: r.challengeSlug,
    mappedSkills: challengeSkillMap.get(r.challengeSlug) ?? [],
    passed: r.passed,
    completedAt: r.completedAt ? r.completedAt.toISOString() : new Date().toISOString(),
  }));

  // 7. Evaluate all 8 canonical skills
  const results: SkillEvaluationResult[] = [];
  const engineConfig = {
    recencyHalfLifeMonths: config.skillproof.recency.halfLifeMonths,
    minQualifyingFindings: 2,
    minRecencyWeight: 1.0,
    assessmentValidityMonths: 12,
    challengeValidityMonths: 12,
  };

  for (const slug of SKILL_SLUGS) {
    const isClaimed = claimsMap.has(slug);
    const claimedAt = claimsMap.get(slug)?.toISOString() ?? null;
    const evidenceList = staticEvidenceBySkill.get(slug) ?? [];
    const assessmentList = assessmentAttemptsBySkill.get(slug) ?? [];

    const evalResult = evaluateSkillLevel({
      skillSlug: slug,
      isClaimed,
      claimedAt,
      staticEvidence: evidenceList,
      assessmentAttempts: assessmentList,
      challengeRuns,
      antiGamingFlags: antiGamingFlagRecords,
      now: new Date(),
      config: engineConfig,
    });

    results.push(evalResult);

    // Upsert snapshot document
    await SkillLevelSnapshot.findOneAndUpdate(
      { userId: userObjId, skillSlug: slug },
      {
        $set: {
          currentLevel: evalResult.currentLevel,
          awardedAt: evalResult.awardedAt ? new Date(evalResult.awardedAt) : null,
          reasons: evalResult.reasons,
          supportingEvidenceIds: evalResult.supportingEvidenceIds,
          missingRequirements: evalResult.missingRequirements,
          totalRecencyWeight: evalResult.totalRecencyWeight,
          qualifyingFindingsCount: evalResult.qualifyingFindingsCount,
          limitations: evalResult.limitations,
          nextAction: evalResult.nextAction,
          evaluatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  // 8. Automatically supersede active credentials if capability level dropped below credential level (R16)
  try {
    const activeCredentials = await Credential.find({
      userId: userObjId,
      status: 'ACTIVE',
    });

    const levelRanks: Record<string, number> = {
      NONE: 0,
      CLAIMED: 1,
      OBSERVED: 2,
      SUPPORTED: 3,
      VERIFIED: 4,
    };

    for (const cred of activeCredentials) {
      const currentSnap = results.find((r) => r.skillSlug === cred.skillSlug);
      if (currentSnap) {
        const currentRank = levelRanks[currentSnap.currentLevel] ?? 0;
        const credRank = levelRanks[cred.level] ?? 0;
        if (currentRank < credRank) {
          cred.status = 'SUPERSEDED';
          cred.revokedAt = new Date();
          cred.revocationReason = `Capability level degraded from ${cred.level} to ${currentSnap.currentLevel}`;
          await cred.save();
          logger.info(
            { credentialId: cred.credentialId, skillSlug: cred.skillSlug, from: cred.level, to: currentSnap.currentLevel },
            'Credential automatically superseded due to capability level drop.'
          );
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed checking active credentials for superseding.');
  }

  logger.info({ userId: userObjId.toString() }, 'Successfully recomputed skill level snapshots.');
  return results;
}

