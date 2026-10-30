import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  SKILL_SLUGS,
  SkillSlug,
  PseudonymizedSubjectRecord,
  EvaluationExportPayload,
} from '@skillproof/shared';
import { UserModel } from '../models/User.js';
import { UserSkillClaimModel } from '../models/UserSkillClaim.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { SandboxRun } from '../models/SandboxRun.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { Challenge } from '../models/Challenge.js';
import { config } from '../config/index.js';
import { logger } from '../middleware/pinoLogger.js';

const EVAL_SALT = process.env.EVALUATION_SALT || config.env.JWT_SECRET || 'skillproof-pilot-eval-salt-2026';

/**
 * Deterministically generates a pseudonymized subject ID (e.g. SUBJ_A1B2C3D4)
 * Hashes MongoDB _id + salt using HMAC-SHA256.
 * Guarantees zero PII leakage while remaining consistent across re-runs.
 */
export function generatePseudonymizedSubjectId(userId: Types.ObjectId | string): string {
  const idStr = typeof userId === 'string' ? userId : userId.toString();
  const hash = crypto
    .createHmac('sha256', EVAL_SALT)
    .update(idStr)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  return `SUBJ_${hash}`;
}

/**
 * Exports pseudonymized evaluation dataset across all registered users and canonical skills.
 * Strictly strips all PII (no usernames, emails, repo URLs, commit SHAs, or IP addresses).
 */
export async function exportPseudonymizedEvaluationData(): Promise<EvaluationExportPayload> {
  logger.info('Starting pseudonymized pilot evaluation data export...');

  const users = await UserModel.find({}, { _id: 1 }).lean();
  const records: PseudonymizedSubjectRecord[] = [];

  // Pre-load all challenges to map which skills are verified by which challenges
  const challenges = await Challenge.find({}, { slug: 1, mappedSkills: 1 }).lean();
  const challengeSkillMap = new Map<string, string[]>();
  for (const c of challenges) {
    challengeSkillMap.set(c.slug, c.mappedSkills || []);
  }

  for (const user of users) {
    const subjectId = generatePseudonymizedSubjectId(user._id);

    // Fetch user claims
    const claims = await UserSkillClaimModel.find({ userId: user._id }).lean();
    const claimSet = new Set(claims.map((c) => c.skillSlug));

    // Fetch snapshots
    const snapshots = await SkillLevelSnapshot.find({ userId: user._id }).lean();
    const snapshotMap = new Map(snapshots.map((s) => [s.skillSlug, s]));

    // Fetch completed assessments
    const attempts = await AssessmentAttempt.find({
      userId: user._id,
      status: 'COMPLETED',
    }).lean();

    // Fetch completed sandbox runs
    const sandboxRuns = await SandboxRun.find({
      userId: user._id,
      status: 'COMPLETED',
      passed: true,
    }).lean();

    const passedChallengeSlugs = new Set(sandboxRuns.map((r) => r.challengeSlug));

    for (const skillSlug of SKILL_SLUGS) {
      // 1. Evidence count
      const evidenceCount = await EvidenceRecord.countDocuments({
        userId: user._id,
        skillSlug,
        validityStatus: 'VALID',
      });

      // 2. Assessment status
      const skillAttempts = attempts.filter((a) => a.skillSlug === skillSlug);
      const passedAttempt = skillAttempts.find((a) => a.passed);
      const assessmentPassed = !!passedAttempt;
      let highestScore: number | null = null;
      if (skillAttempts.length > 0) {
        highestScore = Math.max(...skillAttempts.map((a) => a.score));
      }

      // 3. Sandbox status
      let sandboxPassed = false;
      for (const [chalSlug, mapped] of challengeSkillMap.entries()) {
        if (mapped.includes(skillSlug) && passedChallengeSlugs.has(chalSlug)) {
          sandboxPassed = true;
          break;
        }
      }

      // 4. Snapshot level
      const snap = snapshotMap.get(skillSlug);
      const platformLevel = snap ? snap.currentLevel : claimSet.has(skillSlug) ? 'CLAIMED' : 'NONE';
      const evaluatedAt = snap?.evaluatedAt ? snap.evaluatedAt.toISOString() : new Date().toISOString();

      records.push({
        subjectId,
        skillSlug,
        claimed: claimSet.has(skillSlug),
        staticEvidenceCount: evidenceCount,
        assessmentPassed,
        assessmentScore: highestScore,
        sandboxPassed,
        platformLevel,
        evaluatedAt,
      });
    }
  }

  logger.info(
    { totalSubjects: users.length, totalRecords: records.length },
    'Pseudonymized evaluation export successfully generated.'
  );

  return {
    exportedAt: new Date().toISOString(),
    totalSubjects: users.length,
    totalRecords: records.length,
    records,
  };
}
