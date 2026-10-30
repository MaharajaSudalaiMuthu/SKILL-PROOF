import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { Repository } from '../../src/models/Repository.js';
import { EvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { UserSkillClaimModel } from '../../src/models/UserSkillClaim.js';
import { SkillLevelSnapshot } from '../../src/models/SkillLevelSnapshot.js';
import { AssessmentAttempt } from '../../src/models/AssessmentAttempt.js';
import { SandboxRun } from '../../src/models/SandboxRun.js';
import { Credential } from '../../src/models/Credential.js';
import { ShareGrant } from '../../src/models/ShareGrant.js';
import { DeletionRequest } from '../../src/models/DeletionRequest.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { signWithEd25519 } from '../../src/utils/keyManager.js';
import { canonicalizeJson } from '../../src/utils/canonicalJson.js';

describe('Privacy Controls and Data Deletion (R19)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let credAId: string;
  let credBId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || config.env.MONGODB_URI);
    }

    await seedSkills();

    // Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await UserSkillClaimModel.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});
    await SandboxRun.deleteMany({});
    await Credential.deleteMany({});
    await ShareGrant.deleteMany({});
    await DeletionRequest.deleteMany({});
    await AuditEntry.deleteMany({});

    // Setup User A
    const encryptedTokenA = encryptToken('gho_privacy_token_a');
    const userA = await UserModel.create({
      githubUserId: 99101,
      githubLogin: 'privacy-user-a',
      name: 'Privacy User A',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99101',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();

    await ConsentModel.create({
      userId: userA._id,
      consentVersion: '1.0.0',
      agreedAt: new Date(),
    });

    const tokenA = await signSessionToken({
      userId: userAId,
      githubLogin: userA.githubLogin,
    });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    // Setup User B (for cross-tenant isolation testing)
    const encryptedTokenB = encryptToken('gho_privacy_token_b');
    const userB = await UserModel.create({
      githubUserId: 99102,
      githubLogin: 'privacy-user-b',
      name: 'Privacy User B',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99102',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();

    await ConsentModel.create({
      userId: userB._id,
      consentVersion: '1.0.0',
      agreedAt: new Date(),
    });

    const tokenB = await signSessionToken({
      userId: userBId,
      githubLogin: userB.githubLogin,
    });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    // Populate data for User A
    const repoA = await Repository.create({
      userId: userA._id,
      githubRepoId: 5001,
      fullName: 'privacy-user-a/repo-user-a',
      cloneUrl: 'https://github.com/privacy-user-a/repo-user-a.git',
      isFork: false,
      defaultBranch: 'main',
    });

    await EvidenceRecord.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoA._id,
      filePath: 'src/main/java/com/example/Entity.java',
      startLine: 1,
      endLine: 20,
      commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      commitDate: new Date(),
      detectorName: 'jpa-detector',
      matchedPattern: '@Entity',
      dedupeKey: 'privacy_dedupe_user_a_1',
      rawDetails: {},
      recencyWeight: 1.0,
    });

    await UserSkillClaimModel.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      claimed: true,
      claimedAt: new Date(),
    });

    await SkillLevelSnapshot.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      currentLevel: 'OBSERVED',
      evaluatedAt: new Date(),
      reasons: ['Static evidence matched'],
      supportingEvidenceIds: ['privacy_dedupe_user_a_1'],
      totalRecencyWeight: 1.0,
      qualifyingFindingsCount: 1,
    });

    await ShareGrant.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      tokenHash: 'sampletokenhashuserA1234567890abcdef',
      expiresAt: new Date(Date.now() + 86400000),
      status: 'ACTIVE',
    });

    // Create an active credential for User A
    const credSubjectA = {
      id: `urn:github:${userA.githubLogin}`,
      githubLogin: userA.githubLogin,
      skillSlug: 'jpa-hibernate-persistence',
      level: 'OBSERVED' as const,
      evidenceSummary: { staticEvidenceCount: 1, assessmentPassedCount: 0, sandboxChallengePassed: false },
    };
    const unsignedDocA = {
      id: 'urn:skillproof:credential:cred-user-a-001',
      type: ['VerifiableCredential', 'SkillProofCapabilityCredential'],
      issuer: { id: 'https://skillproof.example.com', name: 'SkillProof Verification Engine' },
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      credentialSubject: credSubjectA,
    };
    const sigA = signWithEd25519(canonicalizeJson(unsignedDocA));
    const createdCredA = await Credential.create({
      credentialId: 'urn:skillproof:credential:cred-user-a-001',
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      level: 'OBSERVED',
      status: 'ACTIVE',
      issuedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 86400000),
      credentialPayload: {
        ...unsignedDocA,
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date().toISOString(),
          verificationMethod: 'urn:skillproof:key:skillproof-key-1',
          proofPurpose: 'assertionMethod',
          proofValue: sigA,
          canonicalizationRule: 'RFC8785',
        },
      },
    });
    credAId = createdCredA._id.toString();

    // Populate data for User B
    const repoB = await Repository.create({
      userId: userB._id,
      githubRepoId: 5002,
      fullName: 'privacy-user-b/repo-user-b',
      cloneUrl: 'https://github.com/privacy-user-b/repo-user-b.git',
      isFork: false,
      defaultBranch: 'main',
    });

    await EvidenceRecord.create({
      userId: userB._id,
      skillSlug: 'jpa-hibernate-persistence',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoB._id,
      filePath: 'src/main/java/com/example/EntityB.java',
      startLine: 1,
      endLine: 20,
      commitSha: 'b1c2d3e4f5a60718293a4b5c6d7e8f9012345678',
      commitDate: new Date(),
      detectorName: 'jpa-detector',
      matchedPattern: '@Entity',
      dedupeKey: 'privacy_dedupe_user_b_1',
      rawDetails: {},
      recencyWeight: 1.0,
    });

    const credSubjectB = {
      id: `urn:github:${userB.githubLogin}`,
      githubLogin: userB.githubLogin,
      skillSlug: 'jpa-hibernate-persistence',
      level: 'OBSERVED' as const,
      evidenceSummary: { staticEvidenceCount: 1, assessmentPassedCount: 0, sandboxChallengePassed: false },
    };
    const unsignedDocB = {
      id: 'urn:skillproof:credential:cred-user-b-001',
      type: ['VerifiableCredential', 'SkillProofCapabilityCredential'],
      issuer: { id: 'https://skillproof.example.com', name: 'SkillProof Verification Engine' },
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      credentialSubject: credSubjectB,
    };
    const sigB = signWithEd25519(canonicalizeJson(unsignedDocB));
    const createdCredB = await Credential.create({
      credentialId: 'urn:skillproof:credential:cred-user-b-001',
      userId: userB._id,
      skillSlug: 'jpa-hibernate-persistence',
      level: 'OBSERVED',
      status: 'ACTIVE',
      issuedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 86400000),
      credentialPayload: {
        ...unsignedDocB,
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date().toISOString(),
          verificationMethod: 'urn:skillproof:key:skillproof-key-1',
          proofPurpose: 'assertionMethod',
          proofValue: sigB,
          canonicalizationRule: 'RFC8785',
        },
      },
    });
    credBId = createdCredB._id.toString();
  });

  afterAll(async () => {
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await UserSkillClaimModel.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});
    await SandboxRun.deleteMany({});
    await Credential.deleteMany({});
    await ShareGrant.deleteMany({});
    await DeletionRequest.deleteMany({});
    await AuditEntry.deleteMany({});
  });

  describe('1. Data Inventory & Summary (GET /api/privacy/summary)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/privacy/summary');
      expect(res.status).toBe(401);
    });

    it('should return accurate inventory counts for authenticated User A', async () => {
      const res = await request(app)
        .get('/api/privacy/summary')
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(userAId);
      expect(res.body.githubLogin).toBe('privacy-user-a');
      expect(res.body.consentGiven).toBe(true);
      expect(res.body.dataCounts.repositories).toBe(1);
      expect(res.body.dataCounts.evidenceRecords).toBe(1);
      expect(res.body.dataCounts.credentials).toBe(1);
      expect(res.body.dataCounts.skillClaims).toBe(1);
      expect(res.body.dataCounts.shareGrants).toBe(1);
    });
  });

  describe('2. Tier 1: Analysis Data Purge (POST /api/privacy/delete-analysis)', () => {
    it('should reject request when confirmation string is incorrect', async () => {
      const res = await request(app)
        .post('/api/privacy/delete-analysis')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({ confirmText: 'WRONG_CONFIRMATION' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/confirm/i);
    });

    it('should successfully purge all analysis data while keeping user account', async () => {
      const res = await request(app)
        .post('/api/privacy/delete-analysis')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({ confirmText: 'DELETE ANALYSIS DATA' });

      expect(res.status).toBe(200);
      expect(res.body.purgedCounts.evidenceRecords).toBe(1);
      expect(res.body.purgedCounts.repositories).toBe(1);
      expect(res.body.purgedCounts.skillClaims).toBe(1);
      expect(res.body.purgedCounts.skillSnapshots).toBe(1);
      expect(res.body.purgedCounts.shareGrants).toBe(1);
      expect(res.body.purgedCounts.credentialsRevoked).toBe(1);

      // Verify DB collections are cleared for User A
      const userAObjId = new mongoose.Types.ObjectId(userAId);
      expect(await EvidenceRecord.countDocuments({ userId: userAObjId })).toBe(0);
      expect(await Repository.countDocuments({ userId: userAObjId })).toBe(0);
      expect(await UserSkillClaimModel.countDocuments({ userId: userAObjId })).toBe(0);
      expect(await SkillLevelSnapshot.countDocuments({ userId: userAObjId })).toBe(0);
      expect(await ShareGrant.countDocuments({ userId: userAObjId })).toBe(0);

      // Verify credential converted to REVOKED tombstone
      const tombstone = await Credential.findById(credAId);
      expect(tombstone).not.toBeNull();
      expect(tombstone?.status).toBe('REVOKED');
      expect(tombstone?.revocationReason).toBe('Developer deleted analysis data');
      expect(tombstone?.revokedAt).not.toBeNull();

      // Verify public verification of tombstone reports REVOKED
      const verifyRes = await request(app).get(`/api/credentials/${tombstone?.credentialId}/verify`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(false);
      expect(verifyRes.body.status).toBe('REVOKED');
      expect(verifyRes.body.reason).toMatch(/Developer deleted analysis data/);

      // Verify User A still exists and can access privacy summary
      const summaryAfter = await request(app)
        .get('/api/privacy/summary')
        .set('Cookie', userACookie);
      expect(summaryAfter.status).toBe(200);
      expect(summaryAfter.body.dataCounts.evidenceRecords).toBe(0);
      expect(summaryAfter.body.dataCounts.credentials).toBe(0);

      // Verify DeletionRequest and AuditEntry logged
      const delReq = await DeletionRequest.findOne({ userId: userAObjId, tier: 'ANALYSIS_DATA' });
      expect(delReq).not.toBeNull();
      expect(delReq?.status).toBe('COMPLETED');

      const audit = await AuditEntry.findOne({ userId: userAObjId, action: 'DELETE_ANALYSIS_DATA' });
      expect(audit).not.toBeNull();
    });

    it('should NOT affect User B data during User A analysis purge (Multi-Tenant Isolation)', async () => {
      const userBObjId = new mongoose.Types.ObjectId(userBId);
      const bEvidences = await EvidenceRecord.countDocuments({ userId: userBObjId });
      expect(bEvidences).toBe(1);

      const bRepos = await Repository.countDocuments({ userId: userBObjId });
      expect(bRepos).toBe(1);

      const bCred = await Credential.findById(credBId);
      expect(bCred?.status).toBe('ACTIVE');

      const bSummary = await request(app)
        .get('/api/privacy/summary')
        .set('Cookie', userBCookie);
      expect(bSummary.status).toBe(200);
      expect(bSummary.body.dataCounts.evidenceRecords).toBe(1);
      expect(bSummary.body.dataCounts.credentials).toBe(1);
    });
  });

  describe('3. Tier 2: Account and All Data Purge (POST /api/privacy/delete-account)', () => {
    it('should reject request when confirmText string is incorrect', async () => {
      const res = await request(app)
        .post('/api/privacy/delete-account')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({ confirmText: 'WRONG' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/confirm/i);
    });

    it('should completely purge User A account, clear session cookie, and record audit', async () => {
      const res = await request(app)
        .post('/api/privacy/delete-account')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({ confirmText: 'DELETE MY ACCOUNT' });

      expect(res.status).toBe(200);
      expect(res.body.purgedCounts.userDeleted).toBe(true);
      expect(res.body.purgedCounts.consentDeleted).toBe(true);

      // Check cookie clear header
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const sessionCookieClear = Array.isArray(setCookie)
        ? setCookie.find((c: string) => c.includes('SKILLPROOF_SESSION='))
        : setCookie;
      expect(sessionCookieClear).toBeDefined();

      // Verify User A document and Consent are gone from DB
      const userAObjId = new mongoose.Types.ObjectId(userAId);
      const userDoc = await UserModel.findById(userAObjId);
      expect(userDoc).toBeNull();

      const consentDoc = await ConsentModel.findOne({ userId: userAObjId });
      expect(consentDoc).toBeNull();

      // Subsequent authenticated requests with userACookie must fail with 401
      const failRes = await request(app)
        .get('/api/privacy/summary')
        .set('Cookie', userACookie);
      expect(failRes.status).toBe(401);

      // Verify DeletionRequest recorded for ACCOUNT
      const accDelReq = await DeletionRequest.findOne({ userId: userAObjId, tier: 'ACCOUNT' });
      expect(accDelReq).not.toBeNull();
      expect(accDelReq?.status).toBe('COMPLETED');

      // Verify AuditEntry recorded
      const accAudit = await AuditEntry.findOne({ userId: userAObjId, action: 'DELETE_ACCOUNT' });
      expect(accAudit).not.toBeNull();
    });

    it('should ensure User B remains completely intact after User A account deletion', async () => {
      const userBObjId = new mongoose.Types.ObjectId(userBId);
      const userBDoc = await UserModel.findById(userBObjId);
      expect(userBDoc).not.toBeNull();
      expect(userBDoc?.githubLogin).toBe('privacy-user-b');

      const consentB = await ConsentModel.findOne({ userId: userBObjId });
      expect(consentB).not.toBeNull();
      expect(consentB?.consentVersion).toBe('1.0.0');

      const bCred = await Credential.findById(credBId);
      expect(bCred?.status).toBe('ACTIVE');

      const bSummary = await request(app)
        .get('/api/privacy/summary')
        .set('Cookie', userBCookie);
      expect(bSummary.status).toBe(200);
      expect(bSummary.body.githubLogin).toBe('privacy-user-b');
    });
  });
});
