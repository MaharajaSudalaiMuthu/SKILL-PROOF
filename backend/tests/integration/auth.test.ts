import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import nock from 'nock';
import { app } from '../../src/server.js';
import { config } from '../../src/config/index.js';
import { UserModel } from '../../src/models/User.js';
import { decryptToken } from '../../src/utils/encryption.js';

describe('Auth Endpoints & OAuth Integration', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.env.MONGODB_URI);
    }
    await UserModel.deleteMany({ githubLogin: 'test-octocat' });
  });

  afterAll(async () => {
    await UserModel.deleteMany({ githubLogin: 'test-octocat' });
  });

  it('GET /api/auth/github should generate state cookie and redirect to GitHub', async () => {
    const res = await request(app).get('/api/auth/github');

    expect(res.status).toBe(302);
    expect(res.header['location']).toContain('https://github.com/login/oauth/authorize');
    expect(res.header['location']).toContain('scope=read%3Auser');

    const cookies = res.header['set-cookie'];
    expect(cookies).toBeDefined();
    const stateCookie = cookies.find((c: string) => c.startsWith('SKILLPROOF_OAUTH_STATE='));
    expect(stateCookie).toBeDefined();
  });

  it('GET /api/auth/github/callback should reject request with state mismatch', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback?code=mock_code&state=wrong_state')
      .set('Cookie', ['SKILLPROOF_OAUTH_STATE=correct_state']);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('STATE_MISMATCH');
  });

  it('GET /api/auth/github/callback should exchange code, persist user, encrypt token, and issue session cookie', async () => {
    const mockState = 'valid_oauth_state_1234567890abcdef';
    const mockCode = 'valid_github_auth_code_xyz';
    const mockAccessToken = 'gho_realSimulatedAccessTokenFromOAuthExchange999';

    // 1. Stub GitHub OAuth Token Exchange
    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(200, {
        access_token: mockAccessToken,
        token_type: 'bearer',
        scope: 'read:user',
      });

    // 2. Stub GitHub User Profile API
    nock('https://api.github.com')
      .get('/user')
      .reply(200, {
        id: 99887766,
        login: 'test-octocat',
        name: 'The Test Octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/99887766?v=4',
      });

    const res = await request(app)
      .get(`/api/auth/github/callback?code=${mockCode}&state=${mockState}`)
      .set('Cookie', [`SKILLPROOF_OAUTH_STATE=${mockState}`]);

    expect(res.status).toBe(302);
    expect(res.header['location']).toBe(`${config.env.APP_BASE_URL}/dashboard`);

    // Verify Session Cookie was set
    const cookies = res.header['set-cookie'];
    const sessionCookie = cookies.find((c: string) => c.startsWith('SKILLPROOF_SESSION='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    // Verify User record in MongoDB
    const userInDb = await UserModel.findOne({ githubUserId: 99887766 });
    expect(userInDb).not.toBeNull();
    expect(userInDb?.githubLogin).toBe('test-octocat');
    expect(userInDb?.name).toBe('The Test Octocat');

    // Verify token is encrypted at rest (NOT plaintext)
    expect(userInDb?.encryptedAccessToken).not.toBe(mockAccessToken);
    const decrypted = decryptToken({
      ciphertext: userInDb!.encryptedAccessToken,
      iv: userInDb!.tokenIv,
      authTag: userInDb!.tokenAuthTag,
    });
    expect(decrypted).toBe(mockAccessToken);
  });

  it('GET /api/auth/me should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me should return authenticated user details with valid session', async () => {
    const user = await UserModel.findOne({ githubLogin: 'test-octocat' });
    expect(user).not.toBeNull();

    const { signSessionToken } = await import('../../src/utils/jwt.js');
    const token = await signSessionToken({
      userId: user!._id.toString(),
      githubLogin: user!.githubLogin,
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`SKILLPROOF_SESSION=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.githubLogin).toBe('test-octocat');
    expect(res.body.githubUserId).toBe(99887766);
    expect(res.body.consentGiven).toBe(false);
  });

  it('POST /api/auth/logout should require CSRF header and clear session cookie', async () => {
    const user = await UserModel.findOne({ githubLogin: 'test-octocat' });
    const { signSessionToken } = await import('../../src/utils/jwt.js');
    const token = await signSessionToken({
      userId: user!._id.toString(),
      githubLogin: user!.githubLogin,
    });

    // Attempt without CSRF header
    const failRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`SKILLPROOF_SESSION=${token}`]);

    expect(failRes.status).toBe(403);
    expect(failRes.body.error).toBe('CSRF_VALIDATION_FAILED');

    // Attempt with CSRF header
    const successRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`SKILLPROOF_SESSION=${token}`])
      .set('X-SkillProof-Request', 'true');

    expect(successRes.status).toBe(200);
    const cookies = successRes.header['set-cookie'];
    const sessionCookie = cookies.find((c: string) => c.startsWith('SKILLPROOF_SESSION=;'));
    expect(sessionCookie).toBeDefined();
  });
});
