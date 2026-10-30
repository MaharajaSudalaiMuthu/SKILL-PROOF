import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import { config } from '../../src/config/index.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { UserSkillClaimModel } from '../../src/models/UserSkillClaim.js';
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { signSessionToken } from '../../src/utils/jwt.js';

describe('Consent & Skills Claims with User Isolation', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.env.MONGODB_URI);
    }

    await seedSkills();

    // Create User A
    const userA = await UserModel.findOneAndUpdate(
      { githubUserId: 11111 },
      {
        githubUserId: 11111,
        githubLogin: 'user-a',
        name: 'Alice',
        encryptedAccessToken: 'mock_encrypted_a',
        tokenIv: '0123456789abcdef01234567',
        tokenAuthTag: '0123456789abcdef0123456789abcdef',
      },
      { upsert: true, new: true }
    );
    userAId = userA._id.toString();
    userAToken = await signSessionToken({ userId: userAId, githubLogin: 'user-a' });

    // Create User B
    const userB = await UserModel.findOneAndUpdate(
      { githubUserId: 22222 },
      {
        githubUserId: 22222,
        githubLogin: 'user-b',
        name: 'Bob',
        encryptedAccessToken: 'mock_encrypted_b',
        tokenIv: '0123456789abcdef01234567',
        tokenAuthTag: '0123456789abcdef0123456789abcdef',
      },
      { upsert: true, new: true }
    );
    userBId = userB._id.toString();
    userBToken = await signSessionToken({ userId: userBId, githubLogin: 'user-b' });

    // Clean test state
    await ConsentModel.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    await UserSkillClaimModel.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  });

  afterAll(async () => {
    await ConsentModel.deleteMany({ userId: { $in: [userAId, userBId] } });
    await UserSkillClaimModel.deleteMany({ userId: { $in: [userAId, userBId] } });
    await UserModel.deleteMany({ _id: { $in: [userAId, userBId] } });
  });

  describe('Consent Management (R19 Baseline)', () => {
    it('GET /api/user/consent should report false before consent is granted', async () => {
      const res = await request(app)
        .get('/api/user/consent')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consentGiven).toBe(false);
    });

    it('POST /api/user/consent should record explicit versioned consent with CSRF header', async () => {
      const res = await request(app)
        .post('/api/user/consent')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`])
        .set('X-SkillProof-Request', 'true')
        .send({
          consentVersion: '1.0',
          agree: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.consentVersion).toBe('1.0');
      expect(res.body.agreedAt).toBeDefined();

      // Verify GET /api/user/consent reflects agreement
      const getRes = await request(app)
        .get('/api/user/consent')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`]);

      expect(getRes.status).toBe(200);
      expect(getRes.body.consentGiven).toBe(true);
      expect(getRes.body.consentVersion).toBe('1.0');
    });

    it('User B should still have no consent granted (Isolation check)', async () => {
      const res = await request(app)
        .get('/api/user/consent')
        .set('Cookie', [`SKILLPROOF_SESSION=${userBToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consentGiven).toBe(false);
    });
  });

  describe('Skills Catalog & User Claims (R23)', () => {
    it('GET /api/skills should return all 8 canonical capabilities', async () => {
      const res = await request(app)
        .get('/api/skills')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);

      const slugs = res.body.map((s: { slug: string }) => s.slug);
      expect(slugs).toContain('rest-controller-design');
      expect(slugs).toContain('jpa-hibernate-persistence');
      expect(slugs).toContain('unit-tests-meaningful-assertions');
    });

    it('POST /api/skills/claims should record claim for User A', async () => {
      const res = await request(app)
        .post('/api/skills/claims')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`])
        .set('X-SkillProof-Request', 'true')
        .send({ skillSlug: 'rest-controller-design' });

      expect(res.status).toBe(201);
      expect(res.body.skillSlug).toBe('rest-controller-design');

      // Verify User A sees the claim
      const listA = await request(app)
        .get('/api/skills')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`]);

      const restSkillA = listA.body.find((s: { slug: string }) => s.slug === 'rest-controller-design');
      expect(restSkillA.claimed).toBe(true);
      expect(restSkillA.claimedAt).not.toBeNull();
    });

    it('User B should NOT see User A claims (Strict User Isolation)', async () => {
      const listB = await request(app)
        .get('/api/skills')
        .set('Cookie', [`SKILLPROOF_SESSION=${userBToken}`]);

      const restSkillB = listB.body.find((s: { slug: string }) => s.slug === 'rest-controller-design');
      expect(restSkillB.claimed).toBe(false);
      expect(restSkillB.claimedAt).toBeNull();
    });

    it('DELETE /api/skills/claims/:skillSlug should remove claim for User A', async () => {
      const delRes = await request(app)
        .delete('/api/skills/claims/rest-controller-design')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`])
        .set('X-SkillProof-Request', 'true');

      expect(delRes.status).toBe(200);

      const listA = await request(app)
        .get('/api/skills')
        .set('Cookie', [`SKILLPROOF_SESSION=${userAToken}`]);

      const restSkillA = listA.body.find((s: { slug: string }) => s.slug === 'rest-controller-design');
      expect(restSkillA.claimed).toBe(false);
    });
  });
});
