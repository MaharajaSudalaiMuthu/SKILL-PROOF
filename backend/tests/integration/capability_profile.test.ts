import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { SkillModel } from '../../src/models/Skill.js';
import { UserSkillClaimModel } from '../../src/models/UserSkillClaim.js';
import { Repository } from '../../src/models/Repository.js';
import { EvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { AntiGamingFlag } from '../../src/models/AntiGamingFlag.js';
import { SkillLevelSnapshot } from '../../src/models/SkillLevelSnapshot.js';
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { recomputeUserSnapshots } from '../../src/engine/snapshotService.js';
import { SKILL_SLUGS } from '@skillproof/shared';

describe('Capability Engine & Developer Profile Integration (R11, R12, R20)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let repoAId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.env.MONGODB_URI);
    }

    // Seed canonical skills
    await seedSkills();

    // Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await UserSkillClaimModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await AntiGamingFlag.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});

    // 1. Create User A
    const encryptedTokenA = encryptToken('gho_mock_token_for_user_a');
    const userA = await UserModel.create({
      githubUserId: 99101,
      githubLogin: 'dev-profile-user-a',
      name: 'Developer Profile User A',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99101',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();
    const tokenA = await signSessionToken({ userId: userAId, githubLogin: 'dev-profile-user-a' });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    await ConsentModel.create({
      userId: userA._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-cap-a',
      agree: true,
      consentedAt: new Date(),
    });

    // 2. Create User B
    const encryptedTokenB = encryptToken('gho_mock_token_for_user_b');
    const userB = await UserModel.create({
      githubUserId: 99202,
      githubLogin: 'dev-profile-user-b',
      name: 'Developer Profile User B',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99202',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();
    const tokenB = await signSessionToken({ userId: userBId, githubLogin: 'dev-profile-user-b' });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    await ConsentModel.create({
      userId: userB._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-cap-b',
      agree: true,
      consentedAt: new Date(),
    });

    // Create a repository for User A
    const repoA = await Repository.create({
      userId: userA._id,
      githubRepoId: 881234,
      fullName: 'dev-profile-user-a/spring-rest-service',
      cloneUrl: 'https://github.com/dev-profile-user-a/spring-rest-service.git',
      defaultBranch: 'main',
      isFork: false,
    });
    repoAId = repoA._id;
  });

  afterAll(async () => {
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await UserSkillClaimModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await AntiGamingFlag.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
  });

  it('1. returns all 8 canonical skills in GET /api/capabilities with initial NONE status', async () => {
    const res = await request(app)
      .get('/api/capabilities')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.capabilities).toHaveLength(8);
    expect(res.body.totalFlagsCount).toBe(0);
    expect(res.body.blockingFlagsCount).toBe(0);

    for (const cap of res.body.capabilities) {
      expect(SKILL_SLUGS).toContain(cap.slug);
      expect(cap.currentLevel).toBe('NONE');
      expect(cap.isClaimed).toBe(false);
      expect(cap.qualifyingFindingsCount).toBe(0);
      expect(cap.totalRecencyWeight).toBe(0);
      if (cap.slug === 'unit-tests-meaningful-assertions') {
        expect(cap.limitations).toContain(
          'No practical coding challenge verifies unit testing. Maximum verifiable level is Supported.'
        );
      }
    }
  });

  it('2. updates capability to CLAIMED when user self-reports a skill claim', async () => {
    // Post claim for rest-controller-design
    const claimRes = await request(app)
      .post('/api/skills/claims')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({ skillSlug: 'rest-controller-design' })
      .expect(201);

    expect(claimRes.body.skillSlug).toBe('rest-controller-design');

    // Capabilities endpoint should now reflect CLAIMED
    const res = await request(app)
      .get('/api/capabilities')
      .set('Cookie', userACookie)
      .expect(200);

    const restCap = res.body.capabilities.find((c: any) => c.slug === 'rest-controller-design');
    expect(restCap).toBeDefined();
    expect(restCap.currentLevel).toBe('CLAIMED');
    expect(restCap.isClaimed).toBe(true);
    expect(restCap.reasons[0]).toContain('Developer self-declared claim');

    const otherCap = res.body.capabilities.find((c: any) => c.slug !== 'rest-controller-design');
    expect(otherCap.currentLevel).toBe('NONE');
  });

  it('3. transitions capability to OBSERVED when qualifying static evidence is detected', async () => {
    // Seed 2 qualifying evidence records with CONFIRMED authorship & VALID status
    await EvidenceRecord.create({
      userId: new mongoose.Types.ObjectId(userAId),
      skillSlug: 'rest-controller-design',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoAId,
      filePath: 'src/main/java/com/example/UserController.java',
      startLine: 15,
      endLine: 45,
      commitSha: 'commit_sha_abc123',
      commitDate: new Date(),
      detectorName: 'RestControllerDetector',
      matchedPattern: 'class UserController with @RestController',
      dedupeKey: `key_user_a_ev_1`,
      rawDetails: {
        whatThisShows: 'Defines RESTful endpoints using Spring MVC annotations.',
        whatThisDoesNotProve: 'Does not guarantee high concurrency handling or thread safety.',
      },
      recencyWeight: 1.0,
    });

    await EvidenceRecord.create({
      userId: new mongoose.Types.ObjectId(userAId),
      skillSlug: 'rest-controller-design',
      evidenceType: 'STATIC',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      repositoryId: repoAId,
      filePath: 'src/main/java/com/example/OrderController.java',
      startLine: 20,
      endLine: 55,
      commitSha: 'commit_sha_def456',
      commitDate: new Date(),
      detectorName: 'RestControllerDetector',
      matchedPattern: 'class OrderController with @RestController',
      dedupeKey: `key_user_a_ev_2`,
      rawDetails: {
        whatThisShows: 'Defines RESTful endpoints using Spring MVC annotations.',
        whatThisDoesNotProve: 'Does not guarantee high concurrency handling or thread safety.',
      },
      recencyWeight: 1.0,
    });

    // Recompute snapshots
    await recomputeUserSnapshots(userAId);

    // Fetch capabilities
    const res = await request(app)
      .get('/api/capabilities')
      .set('Cookie', userACookie)
      .expect(200);

    const restCap = res.body.capabilities.find((c: any) => c.slug === 'rest-controller-design');
    expect(restCap.currentLevel).toBe('OBSERVED');
    expect(restCap.qualifyingFindingsCount).toBe(2);
    expect(restCap.totalRecencyWeight).toBe(2.0);
    expect(restCap.nextAction).toContain('Take scenario assessment to advance to Supported.');
  });

  it('4. returns detailed evidence trail with valid GitHub links in GET /api/capabilities/:skillSlug', async () => {
    const res = await request(app)
      .get('/api/capabilities/rest-controller-design')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.summary.slug).toBe('rest-controller-design');
    expect(res.body.summary.currentLevel).toBe('OBSERVED');
    expect(res.body.assessmentEligible).toBe(true);
    expect(res.body.challengeEligible).toBe(false);
    expect(res.body.reportLimitationNote).toBeDefined();

    expect(res.body.evidenceTrail).toHaveLength(2);
    const ev1 = res.body.evidenceTrail[0];
    expect(ev1.githubBlobUrl).toMatch(
      /^https:\/\/github\.com\/dev-profile-user-a\/spring-rest-service\/blob\/(commit_sha_abc123|commit_sha_def456)\/src\/main\/java\/com\/example\/(UserController|OrderController)\.java#L\d+-L\d+$/
    );
    expect(ev1.whatThisShows).toBeDefined();
    expect(ev1.whatThisDoesNotProve).toBeDefined();
    expect(ev1.attributionStatus).toBe('CONFIRMED');
    expect(ev1.validityStatus).toBe('VALID');
  });

  it('5. enforces strict multi-tenant isolation: User B cannot see User A evidence or claims', async () => {
    // User B querying list
    const listRes = await request(app)
      .get('/api/capabilities')
      .set('Cookie', userBCookie)
      .expect(200);

    for (const cap of listRes.body.capabilities) {
      expect(cap.currentLevel).toBe('NONE');
      expect(cap.isClaimed).toBe(false);
      expect(cap.qualifyingFindingsCount).toBe(0);
    }

    // User B querying rest-controller-design detail
    const detailRes = await request(app)
      .get('/api/capabilities/rest-controller-design')
      .set('Cookie', userBCookie)
      .expect(200);

    expect(detailRes.body.summary.currentLevel).toBe('NONE');
    expect(detailRes.body.summary.isClaimed).toBe(false);
    expect(detailRes.body.evidenceTrail).toHaveLength(0);
    expect(detailRes.body.assessmentEligible).toBe(false);
  });

  it('6. honors unit-tests-meaningful-assertions maxAttainableLevel of SUPPORTED (R11 limitation)', async () => {
    const res = await request(app)
      .get('/api/capabilities/unit-tests-meaningful-assertions')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.summary.maxAttainableLevel).toBe('SUPPORTED');
    expect(res.body.challengeEligible).toBe(false);
    expect(res.body.summary.limitations).toContain(
      'No practical coding challenge verifies unit testing. Maximum verifiable level is Supported.'
    );
  });

  it('7. drops capability from OBSERVED if repository is flagged with a BLOCKING anti-gaming flag', async () => {
    // Add BLOCKING unmodified fork flag to User A's repo
    await AntiGamingFlag.create({
      repositoryId: repoAId,
      userId: new mongoose.Types.ObjectId(userAId),
      flagType: 'UNMODIFIED_FORK',
      severity: 'BLOCKING',
      explanation: 'Repository is an unmodified fork with 0% confirmed lines.',
      metricValue: 0,
    });

    // Mark evidence validityStatus to EXCLUDED as job queue would
    await EvidenceRecord.updateMany(
      { repositoryId: repoAId, userId: new mongoose.Types.ObjectId(userAId) },
      { $set: { validityStatus: 'EXCLUDED' } }
    );

    // Recompute
    await recomputeUserSnapshots(userAId);

    const res = await request(app)
      .get('/api/capabilities/rest-controller-design')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.summary.currentLevel).toBe('CLAIMED'); // Falls back to CLAIMED because user claimed it
    expect(res.body.summary.qualifyingFindingsCount).toBe(0);
    expect(res.body.relevantFlags).toHaveLength(1);
    expect(res.body.relevantFlags[0].severity).toBe('BLOCKING');
  });

  it('8. rejects invalid skill slug in GET /api/capabilities/:skillSlug with 400', async () => {
    const res = await request(app)
      .get('/api/capabilities/invalid-skill-slug-123')
      .set('Cookie', userACookie)
      .expect(400);

    expect(res.body.error).toBe('INVALID_SKILL_SLUG');
  });
});
