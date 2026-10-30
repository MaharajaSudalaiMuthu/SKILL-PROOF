import { describe, it, expect } from 'vitest';
import { signSessionToken, verifySessionToken } from '../../src/utils/jwt.js';

describe('JWT Application Session Tokens', () => {
  it('should sign and verify valid session token', async () => {
    const payload = {
      userId: '652f1e28b12e4d0012a45678',
      githubLogin: 'octocat',
    };

    const token = await signSessionToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(payload.userId);
    expect(verified?.githubLogin).toBe(payload.githubLogin);
  });

  it('should return null for malformed or tampered token', async () => {
    const payload = {
      userId: '652f1e28b12e4d0012a45678',
      githubLogin: 'octocat',
    };

    const token = await signSessionToken(payload);
    const tampered = token.slice(0, -5) + 'abcde';

    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  it('should return null for garbage string input', async () => {
    const verified = await verifySessionToken('invalid.jwt.token');
    expect(verified).toBeNull();
  });
});
