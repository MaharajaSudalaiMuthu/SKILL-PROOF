import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import path from 'path';
import { app } from '../../src/server.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { Repository } from '../../src/models/Repository.js';
import { EvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { SkillLevelSnapshot } from '../../src/models/SkillLevelSnapshot.js';
import { AssessmentAttempt } from '../../src/models/AssessmentAttempt.js';
import { Challenge } from '../../src/models/Challenge.js';
import { SandboxRun } from '../../src/models/SandboxRun.js';
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { seedChallenges } from '../../src/seeds/seedChallenges.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { recomputeUserSnapshots } from '../../src/engine/snapshotService.js';
// @ts-expect-error Import runner from compiled distribution
import { startRunner, stopRunner } from '../../../sandbox-runner/dist/server.js';

describe('Practical Coding Challenges & Isolated Sandbox Grading Integration (R9, R10, R21)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || config.env.MONGODB_URI);
    }

    // 1. Seed canonical skills and practical challenges
    await seedSkills();
    await seedChallenges();

    // 2. Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});
    await SandboxRun.deleteMany({});

    // 3. Start Sandbox Runner on port 8081
    await startRunner(8081);

    // 4. Create User A
    const encryptedTokenA = encryptToken('gho_mock_token_for_user_a');
    const userA = await UserModel.create({
      githubUserId: 99101,
      githubLogin: 'challenge-user-a',
      name: 'Challenge User A',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99101',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();
    const tokenA = await signSessionToken({ userId: userAId, githubLogin: 'challenge-user-a' });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    await ConsentModel.create({
      userId: userA._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-challenge-a',
      agree: true,
      consentedAt: new Date(),
    });

    // 5. Create User B (for multi-tenant isolation verification)
    const encryptedTokenB = encryptToken('gho_mock_token_for_user_b');
    const userB = await UserModel.create({
      githubUserId: 99202,
      githubLogin: 'challenge-user-b',
      name: 'Challenge User B',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99202',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();
    const tokenB = await signSessionToken({ userId: userBId, githubLogin: 'challenge-user-b' });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    await ConsentModel.create({
      userId: userB._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-challenge-b',
      agree: true,
      consentedAt: new Date(),
    });
  }, 60000);

  afterAll(async () => {
    await stopRunner();
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await AssessmentAttempt.deleteMany({});
    await SandboxRun.deleteMany({});
    await mongoose.disconnect();
  }, 30000);

  it('GET /api/challenges lists all 3 challenges with metadata and completion status', async () => {
    const res = await request(app)
      .get('/api/challenges')
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.challenges).toHaveLength(3);
    const slugs = res.body.challenges.map((c: any) => c.slug);
    expect(slugs).toContain('rest-api-secure-vault');
    expect(slugs).toContain('order-persistence-engine');
    expect(slugs).toContain('enterprise-account-service');

    for (const c of res.body.challenges) {
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.timeLimitMinutes).toBe(45);
      expect(c.passed).toBe(false);
      expect(c.mappedSkills.length).toBeGreaterThan(0);
    }
  });

  it('GET /api/challenges/:slug returns challenge detail and strictly hides hidden test suites', async () => {
    const res = await request(app)
      .get('/api/challenges/rest-api-secure-vault')
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.challenge.slug).toBe('rest-api-secure-vault');
    expect(res.body.challenge.instructions).toContain('POST /api/vault/secrets');
    expect(res.body.challenge.starterFiles).toBeDefined();
    expect(res.body.challenge.starterFiles.length).toBeGreaterThan(0);

    // Hidden test files must NOT be leaked
    expect((res.body.challenge as any).hiddenTestFiles).toBeUndefined();
    expect(res.body.challenge.passed).toBe(false);
  });

  it('POST /api/challenges/:slug/submit rejects submissions if user is not at Supported level (403)', async () => {
    // User A currently has NO evidence and is at NONE level
    const res = await request(app)
      .post('/api/challenges/rest-api-secure-vault/submit')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({
        files: [
          {
            path: 'src/main/java/com/skillproof/vault/VaultController.java',
            content: 'package com.skillproof.vault; public class VaultController {}',
          },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INELIGIBLE_FOR_CHALLENGE');
  });

  it('elevating User A to SUPPORTED level allows challenge submission', async () => {
    // 1. Create repository and qualifying static evidence for rest-controller-design
    const repo = await Repository.create({
      userId: new mongoose.Types.ObjectId(userAId),
      githubRepoId: 555001,
      name: 'vault-service',
      fullName: 'challenge-user-a/vault-service',
      ownerLogin: 'challenge-user-a',
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/challenge-user-a/vault-service.git',
      analysisStatus: 'COMPLETED',
    });

    await EvidenceRecord.create({
      userId: new mongoose.Types.ObjectId(userAId),
      repositoryId: repo._id,
      skillSlug: 'rest-controller-design',
      filePath: 'src/main/java/com/example/Controller.java',
      startLine: 10,
      endLine: 25,
      commitSha: 'commit-test-111',
      commitDate: new Date(),
      detectorName: 'SpringRestControllerDetector',
      matchedPattern: '@RestController',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      recencyWeight: 1.0,
      dedupeKey: 'dedupe_key_1',
      rawDetails: { whatThisShows: 'Valid controller mapping' },
    });

    await EvidenceRecord.create({
      userId: new mongoose.Types.ObjectId(userAId),
      repositoryId: repo._id,
      skillSlug: 'rest-controller-design',
      filePath: 'src/main/java/com/example/OtherController.java',
      startLine: 15,
      endLine: 35,
      commitSha: 'commit-test-222',
      commitDate: new Date(),
      detectorName: 'SpringRestControllerDetector',
      matchedPattern: '@GetMapping',
      validityStatus: 'VALID',
      attributionStatus: 'CONFIRMED',
      recencyWeight: 1.0,
      dedupeKey: 'dedupe_key_2',
      rawDetails: { whatThisShows: 'Valid GET mapping' },
    });

    // 2. Complete scenario assessment for rest-controller-design
    await AssessmentAttempt.create({
      userId: new mongoose.Types.ObjectId(userAId),
      skillSlug: 'rest-controller-design',
      status: 'COMPLETED',
      score: 100,
      passed: true,
      timeSpentSeconds: 120,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      completedAt: new Date(),
    });

    // Recompute snapshots to promote rest-controller-design to SUPPORTED
    await recomputeUserSnapshots(userAId);
    const snapBefore = await SkillLevelSnapshot.findOne({
      userId: userAId,
      skillSlug: 'rest-controller-design',
    });
    expect(snapBefore?.currentLevel).toBe('SUPPORTED');

    // 3. Submit failing code to sandbox
    const failRes = await request(app)
      .post('/api/challenges/rest-api-secure-vault/submit')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({
        files: [
          {
            path: 'src/main/java/com/skillproof/vault/VaultController.java',
            content: `package com.skillproof.vault;
public class VaultController {
    public VaultResponse createSecret(String authHeader, SecretRequest request) {
        return new VaultResponse(500, "Not implemented", null);
    }
    public VaultResponse getSecret(String authHeader, String id) {
        return new VaultResponse(500, "Not implemented", null);
    }
    public VaultResponse deleteSecret(String authHeader, String id) {
        return new VaultResponse(500, "Not implemented", null);
    }
}`,
          },
          {
            path: 'src/main/java/com/skillproof/vault/SecretRequest.java',
            content: `package com.skillproof.vault;
public class SecretRequest {
    private String name;
    private String secretValue;
    private Integer ttlSeconds;
    public SecretRequest(String name, String secretValue, Integer ttlSeconds) {
        this.name = name; this.secretValue = secretValue; this.ttlSeconds = ttlSeconds;
    }
    public String getName() { return name; }
    public String getSecretValue() { return secretValue; }
    public Integer getTtlSeconds() { return ttlSeconds; }
}`,
          },
          {
            path: 'src/main/java/com/skillproof/vault/SecretResponse.java',
            content: `package com.skillproof.vault;
public class SecretResponse {
    private String id;
    private String name;
    private String secretValue;
    private long createdAt;
    public SecretResponse(String id, String name, String secretValue, long createdAt) {
        this.id = id; this.name = name; this.secretValue = secretValue; this.createdAt = createdAt;
    }
    public String getId() { return id; }
}`,
          },
          {
            path: 'src/main/java/com/skillproof/vault/VaultResponse.java',
            content: `package com.skillproof.vault;
public class VaultResponse {
    private int status;
    private String message;
    private Object body;
    private String location;
    public VaultResponse(int status, String message, Object body) {
        this.status = status; this.message = message; this.body = body;
    }
    public int getStatus() { return status; }
    public Object getBody() { return body; }
    public String getLocation() { return location; }
    public void setLocation(String loc) { this.location = loc; }
}`,
          },
        ],
      });

    expect(failRes.status).toBe(200);
    expect(failRes.body.passed).toBe(false);
    expect(failRes.body.passedTests).toBe(0);
    expect(failRes.body.totalTests).toBe(4);

    // Verify snapshot remained SUPPORTED, not promoted
    const snapAfterFail = await SkillLevelSnapshot.findOne({
      userId: userAId,
      skillSlug: 'rest-controller-design',
    });
    expect(snapAfterFail?.currentLevel).toBe('SUPPORTED');

    // 4. Submit fully working passing code to sandbox
    const challengeDoc = await Challenge.findOne({ slug: 'rest-api-secure-vault' });
    expect(challengeDoc).toBeDefined();

    const passRes = await request(app)
      .post('/api/challenges/rest-api-secure-vault/submit')
      .set('Cookie', userACookie)
      .set('X-SkillProof-Request', 'true')
      .send({
        files: challengeDoc!.starterFiles,
      });

    expect(passRes.status).toBe(200);
    expect(passRes.body.passed).toBe(true);
    expect(passRes.body.score).toBe(100);
    expect(passRes.body.totalTests).toBe(4);
    expect(passRes.body.passedTests).toBe(4);
    expect(passRes.body.failedTests).toBe(0);
    expect(passRes.body.promotedSkills).toContain('rest-controller-design');

    // 5. Automatic Snapshot Promotion Verification:
    // rest-controller-design must now be VERIFIED!
    const snapAfterPass = await SkillLevelSnapshot.findOne({
      userId: userAId,
      skillSlug: 'rest-controller-design',
    });
    expect(snapAfterPass?.currentLevel).toBe('VERIFIED');
    expect(snapAfterPass?.reasons.some((r) => r.includes('coding challenge'))).toBe(true);
  });

  it('guarantees strict multi-tenant isolation: User B snapshots are unimpacted', async () => {
    const snapB = await SkillLevelSnapshot.findOne({
      userId: userBId,
      skillSlug: 'rest-controller-design',
    });

    // User B must either have no snapshot or level NONE
    expect(snapB?.currentLevel ?? 'NONE').toBe('NONE');
  });
});
