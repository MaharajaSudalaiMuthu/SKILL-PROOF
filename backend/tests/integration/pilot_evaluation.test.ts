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
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { seedChallenges } from '../../src/seeds/seedChallenges.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { generatePseudonymizedSubjectId } from '../../src/evaluation/exportService.js';
import { SKILL_SLUGS } from '@skillproof/shared';

describe('Pilot Evaluation Support (R26)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let userASubjectId: string;
  let userBSubjectId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || config.env.MONGODB_URI);
    }

    await seedSkills();
    await seedChallenges();

    // Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await UserSkillClaimModel.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});
    await SandboxRun.deleteMany({});

    // Setup User A
    const encryptedTokenA = encryptToken('gho_eval_token_a');
    const userA = await UserModel.create({
      githubUserId: 77101,
      githubLogin: 'pilot-student-alpha',
      name: 'Pilot Student Alpha',
      avatarUrl: 'https://avatars.githubusercontent.com/u/77101',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();
    userASubjectId = generatePseudonymizedSubjectId(userAId);

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

    // Setup User B
    const encryptedTokenB = encryptToken('gho_eval_token_b');
    const userB = await UserModel.create({
      githubUserId: 77102,
      githubLogin: 'pilot-student-beta',
      name: 'Pilot Student Beta',
      avatarUrl: 'https://avatars.githubusercontent.com/u/77102',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();
    userBSubjectId = generatePseudonymizedSubjectId(userBId);

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

    // Populate data for User A:
    // 1. Claimed 'rest-controller-design', evidence count = 2, assessment passed, level = SUPPORTED
    const repoA = await Repository.create({
      userId: userA._id,
      githubRepoId: 9001,
      fullName: 'pilot-student-alpha/spring-service',
      cloneUrl: 'https://github.com/pilot-student-alpha/spring-service.git',
      isFork: false,
      defaultBranch: 'main',
    });

    await UserSkillClaimModel.create({
      userId: userA._id,
      skillSlug: 'rest-controller-design',
      claimed: true,
      claimedAt: new Date(),
    });

    await EvidenceRecord.create([
      {
        userId: userA._id,
        skillSlug: 'rest-controller-design',
        evidenceType: 'STATIC',
        validityStatus: 'VALID',
        attributionStatus: 'CONFIRMED',
        repositoryId: repoA._id,
        filePath: 'src/main/java/com/example/Controller.java',
        startLine: 1,
        endLine: 20,
        commitSha: 'c1d2e3f405162738495a6b7c8d9e0f1234567890',
        commitDate: new Date(),
        detectorName: 'rest-detector',
        matchedPattern: '@RestController',
        dedupeKey: 'eval_dedupe_a_1',
        rawDetails: {},
        recencyWeight: 1.0,
      },
      {
        userId: userA._id,
        skillSlug: 'rest-controller-design',
        evidenceType: 'STATIC',
        validityStatus: 'VALID',
        attributionStatus: 'CONFIRMED',
        repositoryId: repoA._id,
        filePath: 'src/main/java/com/example/Controller2.java',
        startLine: 1,
        endLine: 20,
        commitSha: 'd2e3f405162738495a6b7c8d9e0f1234567890c1',
        commitDate: new Date(),
        detectorName: 'rest-detector',
        matchedPattern: '@GetMapping',
        dedupeKey: 'eval_dedupe_a_2',
        rawDetails: {},
        recencyWeight: 1.0,
      },
    ]);

    await AssessmentAttempt.create({
      userId: userA._id,
      skillSlug: 'rest-controller-design',
      status: 'COMPLETED',
      score: 100,
      passed: true,
      startedAt: new Date(),
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 86400000),
      questionIds: ['q1', 'q2', 'q3'],
      answers: [],
    });

    await SkillLevelSnapshot.create({
      userId: userA._id,
      skillSlug: 'rest-controller-design',
      currentLevel: 'SUPPORTED',
      evaluatedAt: new Date(),
      totalRecencyWeight: 2.0,
      qualifyingFindingsCount: 2,
    });

    // 2. User A: 'jpa-hibernate-persistence' -> level = OBSERVED
    await UserSkillClaimModel.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      claimed: true,
      claimedAt: new Date(),
    });

    await EvidenceRecord.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoA._id,
      filePath: 'src/main/java/com/example/Order.java',
      startLine: 1,
      endLine: 25,
      commitSha: 'e3f405162738495a6b7c8d9e0f1234567890c1d2',
      commitDate: new Date(),
      detectorName: 'jpa-detector',
      matchedPattern: '@Entity',
      dedupeKey: 'eval_dedupe_a_jpa_1',
      rawDetails: {},
      recencyWeight: 1.0,
    });

    await SkillLevelSnapshot.create({
      userId: userA._id,
      skillSlug: 'jpa-hibernate-persistence',
      currentLevel: 'OBSERVED',
      evaluatedAt: new Date(),
      totalRecencyWeight: 1.0,
      qualifyingFindingsCount: 1,
    });

    // Populate data for User B:
    // User B: 'input-validation' -> VERIFIED (passed sandbox challenge)
    const repoB = await Repository.create({
      userId: userB._id,
      githubRepoId: 9002,
      fullName: 'pilot-student-beta/secure-vault',
      cloneUrl: 'https://github.com/pilot-student-beta/secure-vault.git',
      isFork: false,
      defaultBranch: 'main',
    });

    await UserSkillClaimModel.create({
      userId: userB._id,
      skillSlug: 'input-validation',
      claimed: true,
      claimedAt: new Date(),
    });

    await SandboxRun.create({
      runId: 'sandbox_run_eval_b_1',
      userId: userB._id,
      challengeSlug: 'rest-api-secure-vault',
      status: 'COMPLETED',
      passed: true,
      score: 100,
      totalTests: 5,
      passedTests: 5,
      logs: 'All tests passed.',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    await SkillLevelSnapshot.create({
      userId: userB._id,
      skillSlug: 'input-validation',
      currentLevel: 'VERIFIED',
      evaluatedAt: new Date(),
      totalRecencyWeight: 1.0,
      qualifyingFindingsCount: 1,
    });
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
  });

  describe('1. Pseudonymized Data Export (GET /api/evaluation/export)', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/evaluation/export');
      expect(res.status).toBe(401);
    });

    it('returns structured pseudonymized records with zero PII leakage', async () => {
      const res = await request(app)
        .get('/api/evaluation/export')
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.totalSubjects).toBe(2);
      expect(res.body.totalRecords).toBe(16); // 2 users * 8 canonical skills
      expect(Array.isArray(res.body.records)).toBe(true);

      const records = res.body.records;

      // Verify User A records exist under pseudonymized subjectId
      const userARecords = records.filter((r: any) => r.subjectId === userASubjectId);
      expect(userARecords).toHaveLength(8);

      const restDesignA = userARecords.find((r: any) => r.skillSlug === 'rest-controller-design');
      expect(restDesignA).toBeDefined();
      expect(restDesignA.claimed).toBe(true);
      expect(restDesignA.staticEvidenceCount).toBe(2);
      expect(restDesignA.assessmentPassed).toBe(true);
      expect(restDesignA.assessmentScore).toBe(100);
      expect(restDesignA.platformLevel).toBe('SUPPORTED');

      const jpaA = userARecords.find((r: any) => r.skillSlug === 'jpa-hibernate-persistence');
      expect(jpaA.platformLevel).toBe('OBSERVED');
      expect(jpaA.staticEvidenceCount).toBe(1);

      // Verify User B input-validation verified
      const userBRecords = records.filter((r: any) => r.subjectId === userBSubjectId);
      expect(userBRecords).toHaveLength(8);

      const inputValB = userBRecords.find((r: any) => r.skillSlug === 'input-validation');
      expect(inputValB.platformLevel).toBe('VERIFIED');
      expect(inputValB.sandboxPassed).toBe(true);

      // Verify Strict Zero PII: raw JSON payload must NOT contain usernames, emails, or repo names
      const rawPayload = JSON.stringify(res.body);
      expect(rawPayload).not.toContain('pilot-student-alpha');
      expect(rawPayload).not.toContain('pilot-student-beta');
      expect(rawPayload).not.toContain('Pilot Student Alpha');
      expect(rawPayload).not.toContain('spring-service');
      expect(rawPayload).not.toContain('secure-vault');
      expect(rawPayload).not.toContain('gho_eval_token');
    });
  });

  describe('2. Inter-Rater Agreement Endpoint (POST /api/evaluation/agreement)', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/evaluation/agreement')
        .send({ ratings: [] });
      expect(res.status).toBe(401);
    });

    it('rejects request with invalid or empty ratings body', async () => {
      const res = await request(app)
        .post('/api/evaluation/agreement')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({ ratings: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one/i);
    });

    it('computes agreement metrics matching expert ratings against platform levels', async () => {
      // Expert rates User A rest-controller-design as SUPPORTED (exact match)
      // and jpa-hibernate-persistence as SUPPORTED (1-level off from OBSERVED)
      // and User B input-validation as VERIFIED (exact match)
      const res = await request(app)
        .post('/api/evaluation/agreement')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({
          ratings: [
            {
              subjectId: userASubjectId,
              skillSlug: 'rest-controller-design',
              expertLevel: 'SUPPORTED',
              confidence: 5,
            },
            {
              subjectId: userASubjectId,
              skillSlug: 'jpa-hibernate-persistence',
              expertLevel: 'SUPPORTED',
              confidence: 4,
            },
            {
              subjectId: userBSubjectId,
              skillSlug: 'input-validation',
              expertLevel: 'VERIFIED',
              confidence: 5,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.evaluatedAt).toBeDefined();

      const { metrics } = res.body;
      expect(metrics.totalPairs).toBe(3);
      // 2 exact matches out of 3 -> percentAgreement = 0.6667
      expect(metrics.percentAgreement).toBeCloseTo(0.6667, 2);
      expect(metrics.confusionMatrix).toBeDefined();
      expect(metrics.confusionMatrix.SUPPORTED.SUPPORTED).toBe(1);
      expect(metrics.confusionMatrix.OBSERVED.SUPPORTED).toBe(1);
      expect(metrics.confusionMatrix.VERIFIED.VERIFIED).toBe(1);

      // Weighted kappa should be higher than unweighted kappa because the 1 mismatch is adjacent
      expect(metrics.weightedKappaLinear).toBeGreaterThan(metrics.cohensKappa);
      expect(metrics.weightedKappaQuadratic).toBeGreaterThan(metrics.cohensKappa);
    });

    it('computes perfect 1.0 agreement when expert ratings match platform levels exactly', async () => {
      const res = await request(app)
        .post('/api/evaluation/agreement')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({
          ratings: [
            {
              subjectId: userASubjectId,
              skillSlug: 'rest-controller-design',
              expertLevel: 'SUPPORTED',
            },
            {
              subjectId: userASubjectId,
              skillSlug: 'jpa-hibernate-persistence',
              expertLevel: 'OBSERVED',
            },
            {
              subjectId: userBSubjectId,
              skillSlug: 'input-validation',
              expertLevel: 'VERIFIED',
            },
          ],
        });

      expect(res.status).toBe(200);
      const { metrics } = res.body;
      expect(metrics.totalPairs).toBe(3);
      expect(metrics.percentAgreement).toBe(1.0);
      expect(metrics.cohensKappa).toBe(1.0);
      expect(metrics.weightedKappaLinear).toBe(1.0);
      expect(metrics.weightedKappaQuadratic).toBe(1.0);
    });
  });
});
