import { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { DeletionPurgedCounts } from '@skillproof/shared';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { FileAttribution } from '../models/FileAttribution.js';
import { AntiGamingFlag } from '../models/AntiGamingFlag.js';
import { AnalysisJob } from '../models/AnalysisJob.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { SandboxRun } from '../models/SandboxRun.js';
import { Repository } from '../models/Repository.js';
import { UserSkillClaimModel } from '../models/UserSkillClaim.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { ShareGrant } from '../models/ShareGrant.js';
import { Credential } from '../models/Credential.js';
import { ConsentModel } from '../models/Consent.js';
import { UserModel } from '../models/User.js';
import { DeletionRequest } from '../models/DeletionRequest.js';
import { AuditEntry } from '../models/AuditEntry.js';
import { logger } from '../middleware/pinoLogger.js';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Tier 1: Purge Analysis Data
 * Purges all evidence, attempts, repositories, claims, snapshots, and share links.
 * Converts active credentials into minimal REVOKED tombstones.
 * Preserves the User record and authentication session.
 */
export async function purgeAnalysisData(
  userId: string | Types.ObjectId,
  auditContext?: AuditContext
): Promise<DeletionPurgedCounts> {
  const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  logger.info({ userId: userObjId.toString() }, 'Executing Tier 1 Analysis Data Purge...');

  // 1. Delete Evidence Records
  const evRes = await EvidenceRecord.deleteMany({ userId: userObjId });

  // 2. Delete File Attributions
  const attrRes = await FileAttribution.deleteMany({ userId: userObjId });

  // 3. Delete Anti-Gaming Flags
  const flagRes = await AntiGamingFlag.deleteMany({ userId: userObjId });

  // 4. Delete Analysis Jobs
  const jobRes = await AnalysisJob.deleteMany({ userId: userObjId });

  // 5. Delete Assessment Attempts
  const assessRes = await AssessmentAttempt.deleteMany({ userId: userObjId });

  // 6. Delete Sandbox Runs
  const runRes = await SandboxRun.deleteMany({ userId: userObjId });

  // 7. Delete Repository records
  const repoRes = await Repository.deleteMany({ userId: userObjId });

  // 8. Delete User Skill Claims
  const claimRes = await UserSkillClaimModel.deleteMany({ userId: userObjId });

  // 9. Delete Skill Level Snapshots
  const snapRes = await SkillLevelSnapshot.deleteMany({ userId: userObjId });

  // 10. Delete Share Grants
  const shareRes = await ShareGrant.deleteMany({ userId: userObjId });

  // 11. Revoke active credentials with minimal tombstone (R16, R17, R19)
  // Per Master Prompt 6.8: credentials become REVOKED with minimal tombstone so verification reports revoked
  const credRes = await Credential.updateMany(
    { userId: userObjId, status: { $ne: 'REVOKED' } },
    {
      $set: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revocationReason: 'Developer deleted analysis data',
      },
    }
  );

  // 12. Clean up any lingering temporary workspaces on disk
  try {
    const userWorkspaceDir = path.resolve(`/tmp/skillproof-workspaces/${userObjId.toString()}`);
    if (fs.existsSync(userWorkspaceDir)) {
      fs.rmSync(userWorkspaceDir, { recursive: true, force: true });
    }
  } catch (err) {
    logger.warn({ err, userId: userObjId.toString() }, 'Error cleaning up local workspace directory during purge');
  }

  const purgedCounts: DeletionPurgedCounts = {
    evidenceRecords: evRes.deletedCount || 0,
    fileAttributions: attrRes.deletedCount || 0,
    antiGamingFlags: flagRes.deletedCount || 0,
    analysisJobs: jobRes.deletedCount || 0,
    assessmentAttempts: assessRes.deletedCount || 0,
    sandboxRuns: runRes.deletedCount || 0,
    repositories: repoRes.deletedCount || 0,
    skillClaims: claimRes.deletedCount || 0,
    skillSnapshots: snapRes.deletedCount || 0,
    shareGrants: shareRes.deletedCount || 0,
    credentialsRevoked: credRes.modifiedCount || 0,
  };

  // Record DeletionRequest
  await DeletionRequest.create({
    userId: userObjId,
    tier: 'ANALYSIS_DATA',
    status: 'COMPLETED',
    purgedCounts,
    requestedAt: new Date(),
    completedAt: new Date(),
  });

  // Record AuditEntry
  await AuditEntry.create({
    userId: userObjId,
    action: 'DELETE_ANALYSIS_DATA',
    details: purgedCounts,
    timestamp: new Date(),
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent,
  });

  logger.info({ userId: userObjId.toString(), purgedCounts }, 'Tier 1 Analysis Data Purge completed successfully.');
  return purgedCounts;
}

/**
 * Tier 2: Purge User Account
 * Executes Tier 1, then purges Consent and User account records (including tokens).
 */
export async function purgeUserAccount(
  userId: string | Types.ObjectId,
  auditContext?: AuditContext
): Promise<DeletionPurgedCounts> {
  const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  logger.info({ userId: userObjId.toString() }, 'Executing Tier 2 Account Purge...');

  // 1. Execute Tier 1 purge first
  const tier1Counts = await purgeAnalysisData(userObjId, auditContext);

  // Retrieve user for audit reference prior to deletion
  const user = await UserModel.findById(userObjId);
  const userRef = user ? { githubLogin: user.githubLogin, githubUserId: user.githubUserId } : {};

  // 2. Delete Consent record
  const consentRes = await ConsentModel.deleteMany({ userId: userObjId });

  // 3. Delete User account (including encrypted access tokens)
  const userRes = await UserModel.deleteOne({ _id: userObjId });

  const purgedCounts: DeletionPurgedCounts = {
    ...tier1Counts,
    userDeleted: (userRes.deletedCount || 0) > 0,
    consentDeleted: (consentRes.deletedCount || 0) > 0,
  };

  // Record DeletionRequest for Account
  await DeletionRequest.create({
    userId: userObjId,
    tier: 'ACCOUNT',
    status: 'COMPLETED',
    purgedCounts,
    requestedAt: new Date(),
    completedAt: new Date(),
  });

  // Record AuditEntry for Account Deletion
  await AuditEntry.create({
    userId: userObjId,
    action: 'DELETE_ACCOUNT',
    details: {
      ...userRef,
      purgedCounts,
    },
    timestamp: new Date(),
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent,
  });

  logger.info({ userId: userObjId.toString(), purgedCounts }, 'Tier 2 Account Purge completed successfully.');
  return purgedCounts;
}
