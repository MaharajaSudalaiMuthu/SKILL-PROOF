import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { Repository } from '../../src/models/Repository.js';
import { EvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { SkillLevelSnapshot } from '../../src/models/SkillLevelSnapshot.js';
import { AssessmentQuestion } from '../../src/models/AssessmentQuestion.js';
import { AssessmentAttempt } from '../../src/models/AssessmentAttempt.js';
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { seedAssessmentQuestions } from '../../src/seeds/seedAssessmentQuestions.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { recomputeUserSnapshots } from '../../src/engine/snapshotService.js';

describe('Scenario-Based Assessment Engine Integration (R7, R8, R21)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let repoAId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.env.MONGODB_URI);
    }

    // Seed canonical skills and questions
    await seedSkills();
    await seedAssessmentQuestions();

    // Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});

    // 1. Create User A
    const encryptedTokenA = encryptToken('gho_mock_token_for_user_a');
    const userA = await UserModel.create({
      githubUserId: 88101,
      githubLogin: 'assessment-user-a',
      name: 'Assessment User A',
      avatarUrl: 'https://avatars.githubusercontent.com/u/88101',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();
    const tokenA = await signSessionToken({ userId: userAId, githubLogin: 'assessment-user-a' });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    await ConsentModel.create({
      userId: userA._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-asmnt-a',
      agree: true,
      consentedAt: new Date(),
    });

    // 2. Create User B
    const encryptedTokenB = encryptToken('gho_mock_token_for_user_b');
    const userB = await UserModel.create({
      githubUserId: 88202,
      githubLogin: 'assessment-user-b',
      name: 'Assessment User B',
      avatarUrl: 'https://avatars.githubusercontent.com/u/88202',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();
    const tokenB = await signSessionToken({ userId: userBId, githubLogin: 'assessment-user-b' });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    await ConsentModel.create({
      userId: userB._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-asmnt-b',
      agree: true,
      consentedAt: new Date(),
    });

    // Create a repository and qualifying evidence for User A so rest-controller-design is OBSERVED
    const repoA = await Repository.create({
      userId: userA._id,
      githubRepoId: 771234,
      fullName: 'assessment-user-a/spring-rest-api',
      cloneUrl: 'https://github.com/assessment-user-a/spring-rest-api.git',
      defaultBranch: 'main',
      isFork: false,
    });
    repoAId = repoA._id;

    // Seed 2 qualifying evidence records with CONFIRMED authorship & VALID status
    await EvidenceRecord.create({
      userId: userA._id,
      skillSlug: 'rest-controller-design',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoAId,
      filePath: 'src/main/java/com/example/ControllerOne.java',
      startLine: 10,
      endLine: 40,
      commitSha: 'commit_sha_111',
      commitDate: new Date(),
      detectorName: 'RestControllerDetector',
      matchedPattern: 'class ControllerOne with @RestController',
      dedupeKey: `key_asmnt_ev_1`,
      rawDetails: {
        whatThisShows: 'Defines RESTful endpoints',
        whatThisDoesNotProve: 'Does not guarantee thread safety',
      },
      recencyWeight: 1.0,
    });

    await EvidenceRecord.create({
      userId: userA._id,
      skillSlug: 'rest-controller-design',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoAId,
      filePath: 'src/main/java/com/example/ControllerTwo.java',
      startLine: 12,
      endLine: 45,
      commitSha: 'commit_sha_222',
      commitDate: new Date(),
      detectorName: 'RestControllerDetector',
      matchedPattern: 'class ControllerTwo with @RestController',
      dedupeKey: `key_asmnt_ev_2`,
      rawDetails: {
        whatThisShows: 'Defines RESTful endpoints',
        whatThisDoesNotProve: 'Does not guarantee thread safety',
      },
      recencyWeight: 1.0,
    });

    // Recompute snapshots to award OBSERVED to User A
    await recomputeUserSnapshots(userAId);
  });

  afterAll(async () => {
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});
  });

  it('1. rejects assessment attempt if user has not attained OBSERVED level (ineligible)', async () => {
    // User A has NOT attained OBSERVED for spring-security-configuration
    const res = await request(app)
      .post('/api/assessments/spring-security-configuration/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(403);

    expect(res.body.error).toBe('INELIGIBLE_FOR_ASSESSMENT');
    expect(res.body.message).toContain("You must attain the 'Observed' level");
  });

  it('2. starts a 3-question timed assessment and redacts answers and rubric keys', async () => {
    const res = await request(app)
      .post('/api/assessments/rest-controller-design/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(201);

    expect(res.body.attemptId).toBeDefined();
    expect(res.body.skillSlug).toBe('rest-controller-design');
    expect(res.body.timeLimitMinutes).toBe(15);
    expect(res.body.questions).toHaveLength(3);

    for (const q of res.body.questions) {
      expect(q.questionId).toBeDefined();
      expect(q.title).toBeDefined();
      expect(q.scenario).toBeDefined();
      expect(q.options).toHaveLength(4);
      // Redaction check (critical anti-cheat verification)
      expect((q as any).correctOptionIndex).toBeUndefined();
      expect((q as any).rubricExplanation).toBeUndefined();
    }
  });

  it('3. returns existing in-progress attempt if user starts again before expiration', async () => {
    const startRes1 = await request(app)
      .post('/api/assessments/rest-controller-design/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(201);

    const startRes2 = await request(app)
      .post('/api/assessments/rest-controller-design/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(201);

    expect(startRes2.body.attemptId).toBe(startRes1.body.attemptId);
  });

  it('4. prevents User B from submitting or viewing User A assessment attempt (isolation)', async () => {
    const startRes = await request(app)
      .post('/api/assessments/rest-controller-design/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(201);

    const attemptId = startRes.body.attemptId;

    // User B attempts to submit User A's attempt
    const res = await request(app)
      .post(`/api/assessments/${attemptId}/submit`)
      .set('Cookie', userBCookie)
      .set('X-SkillProof-Request', 'true')
      .send({
        answers: [
          { questionId: startRes.body.questions[0].questionId, selectedOptionIndex: 0 },
        ],
      })
      .expect(404);

    expect(res.body.error).toBe('ATTEMPT_NOT_FOUND');
  });

  it('5. evaluates failing score (< 66%) and does NOT promote capability level', async () => {
    const startRes = await request(app)
      .post('/api/assessments/rest-controller-design/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(201);

    const attemptId = startRes.body.attemptId;
    const questions = startRes.body.questions;

    // Fetch the questions from DB to deliberately submit incorrect answers for all 3
    const qDocs = await AssessmentQuestion.find({
      questionId: { $in: questions.map((q: any) => q.questionId) },
    });
    const qMap = new Map(qDocs.map((q) => [q.questionId, q]));

    const failingAnswers = questions.map((q: any) => {
      const doc = qMap.get(q.questionId)!;
      // Pick an incorrect option
      const wrongOption = (doc.correctOptionIndex + 1) % 4;
      return {
        questionId: q.questionId,
        selectedOptionIndex: wrongOption,
      };
    });

    const submitRes = await request(app)
      .post(`/api/assessments/${attemptId}/submit`)
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({ answers: failingAnswers })
      .expect(200);

    expect(submitRes.body.score).toBe(0);
    expect(submitRes.body.passed).toBe(false);
    expect(submitRes.body.correctCount).toBe(0);
    expect(submitRes.body.newLevel).toBe('OBSERVED'); // Stays OBSERVED

    // Rubric explanations are now revealed upon completion
    expect(submitRes.body.questions[0].rubricExplanation).toBeDefined();
    expect(submitRes.body.questions[0].isCorrect).toBe(false);
  });

  it('6. evaluates passing score (>= 66%) and automatically promotes capability to SUPPORTED (R8, R11)', async () => {
    // Start a fresh attempt
    const startRes = await request(app)
      .post('/api/assessments/rest-controller-design/start')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .expect(201);

    const attemptId = startRes.body.attemptId;
    const questions = startRes.body.questions;

    // Look up correct answers from database
    const qDocs = await AssessmentQuestion.find({
      questionId: { $in: questions.map((q: any) => q.questionId) },
    });
    const qMap = new Map(qDocs.map((q) => [q.questionId, q]));

    // Submit 2 correct and 1 incorrect (score: 66.7% -> pass)
    const passingAnswers = [
      { questionId: questions[0].questionId, selectedOptionIndex: qMap.get(questions[0].questionId)!.correctOptionIndex },
      { questionId: questions[1].questionId, selectedOptionIndex: qMap.get(questions[1].questionId)!.correctOptionIndex },
      { questionId: questions[2].questionId, selectedOptionIndex: (qMap.get(questions[2].questionId)!.correctOptionIndex + 1) % 4 },
    ];

    const submitRes = await request(app)
      .post(`/api/assessments/${attemptId}/submit`)
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({ answers: passingAnswers })
      .expect(200);

    expect(submitRes.body.score).toBe(66.7);
    expect(submitRes.body.passed).toBe(true);
    expect(submitRes.body.correctCount).toBe(2);
    expect(submitRes.body.newLevel).toBe('SUPPORTED');

    // Verify capability snapshot was automatically updated to SUPPORTED
    const capRes = await request(app)
      .get('/api/capabilities/rest-controller-design')
      .set('Cookie', userACookie)
      .expect(200);

    expect(capRes.body.summary.currentLevel).toBe('SUPPORTED');
    expect(capRes.body.summary.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Passed scenario-based assessment')])
    );
    expect(capRes.body.assessmentEligible).toBe(false); // No longer eligible for scenario assessment because already Supported
  });

  it('7. rejects submission on already completed attempt with 400', async () => {
    // Attempt from previous test is already completed
    const latestAttempt = await AssessmentAttempt.findOne({ userId: userAId, status: 'COMPLETED' });
    expect(latestAttempt).toBeDefined();

    const res = await request(app)
      .post(`/api/assessments/${latestAttempt!._id}/submit`)
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({
        answers: [{ questionId: 'any', selectedOptionIndex: 0 }],
      })
      .expect(400);

    expect(res.body.error).toBe('ATTEMPT_ALREADY_COMPLETED');
  });

  it('8. lists all completed and historical assessment attempts for user in GET /api/assessments/attempts', async () => {
    const res = await request(app)
      .get('/api/assessments/attempts')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const passedAttempt = res.body.find((a: any) => a.passed === true);
    expect(passedAttempt).toBeDefined();
    expect(passedAttempt.status).toBe('COMPLETED');
    expect(passedAttempt.score).toBe(66.7);
  });
});
