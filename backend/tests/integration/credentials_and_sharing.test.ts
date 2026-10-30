import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { app } from '../../src/server.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { Repository } from '../../src/models/Repository.js';
import { EvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { SkillLevelSnapshot } from '../../src/models/SkillLevelSnapshot.js';
import { Credential } from '../../src/models/Credential.js';
import { ShareGrant } from '../../src/models/ShareGrant.js';
import { seedSkills } from '../../src/seeds/seedSkills.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { recomputeUserSnapshots } from '../../src/engine/snapshotService.js';
import { canonicalizeJson } from '../../src/utils/canonicalJson.js';
import { verifyWithEd25519 } from '../../src/utils/keyManager.js';

describe('Cryptographic Credentials & Revocable Public Sharing (R16, R17, R18)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let issuedCredential: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || config.env.MONGODB_URI);
    }

    // Seed canonical skills
    await seedSkills();

    // Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await Credential.deleteMany({});
    await ShareGrant.deleteMany({});

    // Create User A
    const encryptedTokenA = encryptToken('gho_mock_token_for_user_a');
    const userA = await UserModel.create({
      githubUserId: 88101,
      githubLogin: 'crypto-user-a',
      name: 'Crypto User A',
      avatarUrl: 'https://avatars.githubusercontent.com/u/88101',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();

    const tokenA = await signSessionToken({
      userId: userAId,
      githubLogin: userA.githubLogin,
    });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    // Create User B
    const encryptedTokenB = encryptToken('gho_mock_token_for_user_b');
    const userB = await UserModel.create({
      githubUserId: 88102,
      githubLogin: 'crypto-user-b',
      name: 'Crypto User B',
      avatarUrl: 'https://avatars.githubusercontent.com/u/88102',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();

    const tokenB = await signSessionToken({
      userId: userBId,
      githubLogin: userB.githubLogin,
    });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    // Create a repository and qualifying evidence for User A on 'rest-controller-design'
    const repoA = await Repository.create({
      userId: userA._id,
      githubRepoId: 55501,
      fullName: 'crypto-user-a/spring-api',
      cloneUrl: 'https://github.com/crypto-user-a/spring-api.git',
      isFork: false,
      defaultBranch: 'main',
    });

    const commitDate = new Date();
    await EvidenceRecord.create([
      {
        userId: userA._id,
        skillSlug: 'rest-controller-design',
        evidenceType: 'STATIC',
        validityStatus: 'VALID',
        attributionStatus: 'CONFIRMED',
        repositoryId: repoA._id,
        filePath: 'src/main/java/com/example/OrderController.java',
        startLine: 15,
        endLine: 45,
        commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
        commitDate,
        detectorName: 'rest-controller-design-detector',
        matchedPattern: '@RestController with GET/POST handlers',
        dedupeKey: 'dedupe_key_cred_1',
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
        filePath: 'src/main/java/com/example/UserController.java',
        startLine: 10,
        endLine: 50,
        commitSha: 'b2c3d4e5f60718293a4b5c6d7e8f9012345678a1',
        commitDate,
        detectorName: 'rest-controller-design-detector',
        matchedPattern: '@RestController with multiple verbs',
        dedupeKey: 'dedupe_key_cred_2',
        rawDetails: {},
        recencyWeight: 1.0,
      },
    ]);

    // Recompute snapshots to award OBSERVED to User A
    await recomputeUserSnapshots(userAId);
  });

  afterAll(async () => {
    await UserModel.deleteMany({});
    await Repository.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await SkillLevelSnapshot.deleteMany({});
    await Credential.deleteMany({});
    await ShareGrant.deleteMany({});
  });

  describe('Public Key Discovery Endpoints', () => {
    it('GET /api/credentials/public-key returns SPKI-PEM formatted public key', async () => {
      const res = await request(app).get('/api/credentials/public-key');

      expect(res.status).toBe(200);
      expect(res.body.format).toBe('SPKI-PEM');
      expect(res.body.algorithm).toBe('Ed25519');
      expect(res.body.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    it('GET /.well-known/skillproof-keys.json returns RFC 8037 JWKS format', async () => {
      const res = await request(app).get('/.well-known/skillproof-keys.json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys[0].kty).toBe('OKP');
      expect(res.body.keys[0].crv).toBe('Ed25519');
      expect(typeof res.body.keys[0].x).toBe('string');
    });
  });

  describe('Credential Issuance (R16)', () => {
    it('rejects credential issuance if capability level is CLAIMED (insufficient level)', async () => {
      // User A has not earned evidence on jpa-hibernate-persistence
      const res = await request(app)
        .post('/api/credentials/issue')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({
          skillSlug: 'jpa-hibernate-persistence',
          validMonths: 12,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INSUFFICIENT_LEVEL');
    });

    it('successfully issues signed VC-style credential for OBSERVED capability', async () => {
      const res = await request(app)
        .post('/api/credentials/issue')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({
          skillSlug: 'rest-controller-design',
          validMonths: 12,
        });

      expect(res.status).toBe(201);
      issuedCredential = res.body;

      // Validate VC-style structure
      expect(issuedCredential.id).toMatch(/^urn:skillproof:credential:/);
      expect(issuedCredential.type).toContain('VerifiableCredential');
      expect(issuedCredential.type).toContain('SkillProofCapabilityCredential');
      expect(issuedCredential.issuer.name).toBe('SkillProof Verification Engine');
      expect(issuedCredential.credentialSubject.skillSlug).toBe('rest-controller-design');
      expect(issuedCredential.credentialSubject.level).toBe('OBSERVED');
      expect(issuedCredential.credentialSubject.githubLogin).toBe('crypto-user-a');
      expect(issuedCredential.credentialSubject.evidenceSummary.staticEvidenceCount).toBe(2);

      // Validate cryptographic proof block
      expect(issuedCredential.proof.type).toBe('Ed25519Signature2020');
      expect(issuedCredential.proof.canonicalizationRule).toBe('RFC8785');
      expect(typeof issuedCredential.proof.proofValue).toBe('string');
      expect(issuedCredential.proof.proofValue.length).toBeGreaterThan(40);

      // Verify the signature mathematically
      const { proof, ...unsignedDoc } = issuedCredential;
      const canonical = canonicalizeJson(unsignedDoc);
      const isSigValid = verifyWithEd25519(canonical, proof.proofValue);
      expect(isSigValid).toBe(true);
    });

    it('GET /api/credentials returns list of issued credentials for authenticated developer', async () => {
      const res = await request(app)
        .get('/api/credentials')
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.credentials)).toBe(true);
      expect(res.body.credentials.length).toBe(1);
      expect(res.body.credentials[0].credentialId).toBe(issuedCredential.id);
      expect(res.body.credentials[0].status).toBe('ACTIVE');
    });
  });

  describe('Verification Endpoints (R17)', () => {
    it('GET /api/credentials/:credentialId/verify verifies active credential by ID', async () => {
      const res = await request(app).get(`/api/credentials/${issuedCredential.id}/verify`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.credential.id).toBe(issuedCredential.id);
    });

    it('GET /api/credentials/:credentialId/verify returns 404 for unknown credential ID', async () => {
      const res = await request(app).get('/api/credentials/urn:skillproof:credential:unknown-9999/verify');

      expect(res.status).toBe(404);
      expect(res.body.valid).toBe(false);
      expect(res.body.status).toBe('NOT_FOUND');
    });

    it('POST /api/credentials/verify verifies pasted JSON document', async () => {
      const res = await request(app)
        .post('/api/credentials/verify')
        .send({ credential: issuedCredential });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('POST /api/credentials/verify detects tampering with any payload field', async () => {
      // Create a copy and elevate level from OBSERVED to VERIFIED
      const tamperedDoc = JSON.parse(JSON.stringify(issuedCredential));
      tamperedDoc.credentialSubject.level = 'VERIFIED';

      const res = await request(app)
        .post('/api/credentials/verify')
        .send({ credential: tamperedDoc });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.status).toBe('INVALID_SIGNATURE');
      expect(res.body.reason).toContain('tampered');
    });
  });

  describe('Credential Revocation & Superseding (R16, R17)', () => {
    it('developer can revoke their own active credential with immediate effect', async () => {
      const res = await request(app)
        .post(`/api/credentials/${issuedCredential.id}/revoke`)
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({ reason: 'Found obsolete implementation' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REVOKED');

      // Subsequent verification reports REVOKED
      const verifyRes = await request(app).get(`/api/credentials/${issuedCredential.id}/verify`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(false);
      expect(verifyRes.body.status).toBe('REVOKED');

      // Pasted JSON verification also reports REVOKED
      const pastedRes = await request(app)
        .post('/api/credentials/verify')
        .send({ credential: issuedCredential });
      expect(pastedRes.status).toBe(200);
      expect(pastedRes.body.valid).toBe(false);
      expect(pastedRes.body.status).toBe('REVOKED');
    });

    it('automatically supersedes active credentials if capability level drops', async () => {
      // 1. Issue a new credential for rest-controller-design
      const issueRes = await request(app)
        .post('/api/credentials/issue')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({
          skillSlug: 'rest-controller-design',
          validMonths: 12,
        });
      expect(issueRes.status).toBe(201);
      const newCred = issueRes.body;

      // Verify active
      const checkRes = await request(app).get(`/api/credentials/${newCred.id}/verify`);
      expect(checkRes.body.status).toBe('ACTIVE');

      // 2. Invalidate evidence (simulating expired or excluded evidence)
      await EvidenceRecord.updateMany(
        { userId: userAId, skillSlug: 'rest-controller-design' },
        { $set: { validityStatus: 'EXPIRED' } }
      );

      // 3. Trigger recomputation
      await recomputeUserSnapshots(userAId);

      // 4. Verify credential was automatically marked SUPERSEDED
      const supersededRes = await request(app).get(`/api/credentials/${newCred.id}/verify`);
      expect(supersededRes.body.valid).toBe(false);
      expect(supersededRes.body.status).toBe('SUPERSEDED');
    });
  });

  describe('Per-Skill Revocable Public Sharing (R18)', () => {
    let shareToken: string;
    let shareId: string;

    it('POST /api/shares creates a share grant storing ONLY SHA-256 hash in database', async () => {
      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true')
        .send({
          skillSlug: 'rest-controller-design',
          expiryDays: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.skillSlug).toBe('rest-controller-design');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(40);
      shareToken = res.body.token;
      shareId = res.body.id;

      // Verify only SHA-256 hash is in DB
      const expectedHash = crypto.createHash('sha256').update(shareToken).digest('hex');
      const grantInDb = await ShareGrant.findById(shareId);
      expect(grantInDb).toBeDefined();
      expect(grantInDb?.tokenHash).toBe(expectedHash);
      // Ensure plain token is NOT stored anywhere in the database document
      expect(JSON.stringify(grantInDb)).not.toContain(shareToken);
    });

    it('GET /api/shares/:token returns public shared skill without authentication', async () => {
      const res = await request(app).get(`/api/shares/${shareToken}`);

      expect(res.status).toBe(200);
      expect(res.body.skillSlug).toBe('rest-controller-design');
      expect(res.body.skillName).toBe('REST Controller Design');
      expect(res.body.developerHandle).toBe('crypto-user-a');
      expect(res.body.limitationNotice).toContain('Levels describe evidence strength');

      // Verify grant viewCount incremented
      const grantInDb = await ShareGrant.findById(shareId);
      expect(grantInDb?.viewCount).toBe(1);
    });

    it('share endpoint strictly isolates single skill (no access to other skills or sensitive fields)', async () => {
      const res = await request(app).get(`/api/shares/${shareToken}`);

      expect(res.status).toBe(200);
      // Must not expose email or tokens
      expect(res.body.encryptedAccessToken).toBeUndefined();
      expect(res.body.email).toBeUndefined();
      // Must not include other skill evaluations
      expect(res.body.allSkills).toBeUndefined();
    });

    it('revoking a share grant immediately returns 410 SHARE_REVOKED', async () => {
      const revokeRes = await request(app)
        .post(`/api/shares/${shareId}/revoke`)
        .set('Cookie', userACookie)
        .set('X-SkillProof-Request', 'true');

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.status).toBe('REVOKED');

      // Public call now returns 410 SHARE_REVOKED
      const publicRes = await request(app).get(`/api/shares/${shareToken}`);
      expect(publicRes.status).toBe(410);
      expect(publicRes.body.error).toBe('SHARE_REVOKED');
    });

    it('expired share grant returns 410 SHARE_EXPIRED', async () => {
      // Create a share grant with past expiry
      const pastToken = crypto.randomBytes(32).toString('base64url');
      const pastHash = crypto.createHash('sha256').update(pastToken).digest('hex');

      await ShareGrant.create({
        userId: userAId,
        skillSlug: 'rest-controller-design',
        tokenHash: pastHash,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'ACTIVE',
      });

      const res = await request(app).get(`/api/shares/${pastToken}`);
      expect(res.status).toBe(410);
      expect(res.body.error).toBe('SHARE_EXPIRED');
    });

    it('enforces multi-tenant isolation: User B cannot revoke User A credentials or share grants', async () => {
      // User B tries to revoke User A's share grant
      const shareRes = await request(app)
        .post(`/api/shares/${shareId}/revoke`)
        .set('Cookie', userBCookie)
        .set('X-SkillProof-Request', 'true');

      expect(shareRes.status).toBe(404);

      // User B tries to revoke User A's credential
      const credRes = await request(app)
        .post(`/api/credentials/${issuedCredential.id}/revoke`)
        .set('Cookie', userBCookie)
        .set('X-SkillProof-Request', 'true');

      expect(credRes.status).toBe(404);
    });
  });
});
