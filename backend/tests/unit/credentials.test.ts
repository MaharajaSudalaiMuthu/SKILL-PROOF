import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { canonicalizeJson } from '../../src/utils/canonicalJson.js';
import {
  signWithEd25519,
  verifyWithEd25519,
  getPublicKeyPem,
  getPublicKeyJwk,
  initializeKeypair,
} from '../../src/utils/keyManager.js';

describe('Cryptographic Engine & Credentials (R16, R17)', () => {
  describe('RFC 8785 Canonical JSON Serialization', () => {
    it('sorts object keys lexicographically by UTF-16 code units', () => {
      const input = {
        z: 1,
        a: 2,
        m: 3,
        _b: 4,
      };
      const canonical = canonicalizeJson(input);
      expect(canonical).toBe('{"_b":4,"a":2,"m":3,"z":1}');
    });

    it('strips unnecessary whitespace and handles nested objects and arrays', () => {
      const input = {
        skills: [
          { name: 'Rest', level: 'VERIFIED' },
          { name: 'Auth', level: 'SUPPORTED' },
        ],
        issuer: {
          url: 'https://skillproof.dev',
          name: 'SkillProof',
        },
      };
      const canonical = canonicalizeJson(input);
      expect(canonical).toBe(
        '{"issuer":{"name":"SkillProof","url":"https://skillproof.dev"},"skills":[{"level":"VERIFIED","name":"Rest"},{"level":"SUPPORTED","name":"Auth"}]}'
      );
    });

    it('omits undefined properties from serialized objects', () => {
      const input = {
        id: '123',
        description: undefined,
        active: true,
      };
      const canonical = canonicalizeJson(input);
      expect(canonical).toBe('{"active":true,"id":"123"}');
    });

    it('normalizes -0 to 0 according to RFC 8785', () => {
      const input = { val: -0 };
      const canonical = canonicalizeJson(input);
      expect(canonical).toBe('{"val":0}');
    });
  });

  describe('Ed25519 Signing & Verification', () => {
    it('signs canonical payload and verifies successfully with public key', () => {
      const payload = {
        id: 'urn:skillproof:credential:test-uuid',
        skillSlug: 'rest-controller-design',
        level: 'VERIFIED',
      };
      const canonical = canonicalizeJson(payload);
      const signature = signWithEd25519(canonical);

      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(40);

      const isValid = verifyWithEd25519(canonical, signature);
      expect(isValid).toBe(true);
    });

    it('tampering with any field causes cryptographic verification to FAIL', () => {
      const originalPayload = {
        id: 'urn:skillproof:credential:test-uuid',
        subject: {
          githubLogin: 'octocat',
          level: 'SUPPORTED',
        },
      };
      const canonical = canonicalizeJson(originalPayload);
      const signature = signWithEd25519(canonical);

      // Verify original succeeds
      expect(verifyWithEd25519(canonical, signature)).toBe(true);

      // Attempt 1: Tamper with level
      const tamperedPayload1 = {
        id: 'urn:skillproof:credential:test-uuid',
        subject: {
          githubLogin: 'octocat',
          level: 'VERIFIED', // Elevated level
        },
      };
      const tamperedCanonical1 = canonicalizeJson(tamperedPayload1);
      expect(verifyWithEd25519(tamperedCanonical1, signature)).toBe(false);

      // Attempt 2: Tamper with subject handle
      const tamperedPayload2 = {
        id: 'urn:skillproof:credential:test-uuid',
        subject: {
          githubLogin: 'attacker',
          level: 'SUPPORTED',
        },
      };
      const tamperedCanonical2 = canonicalizeJson(tamperedPayload2);
      expect(verifyWithEd25519(tamperedCanonical2, signature)).toBe(false);

      // Attempt 3: Tamper with signature bytes
      const corruptedSignature = signature.slice(0, -4) + 'AAAA';
      expect(verifyWithEd25519(canonical, corruptedSignature)).toBe(false);
    });

    it('exports public key in SPKI PEM and RFC 8037 JWK format', async () => {
      const pem = getPublicKeyPem();
      expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(pem).toContain('-----END PUBLIC KEY-----');

      const jwk = await getPublicKeyJwk();
      expect(jwk.kty).toBe('OKP');
      expect(jwk.crv).toBe('Ed25519');
      expect(typeof jwk.x).toBe('string');
      expect(jwk.x?.length).toBeGreaterThan(30);
    });

    it('generates 256-bit random tokens with matching SHA-256 hash', () => {
      const plainToken = crypto.randomBytes(32).toString('base64url');
      expect(plainToken.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url is 43 chars

      const hash1 = crypto.createHash('sha256').update(plainToken).digest('hex');
      const hash2 = crypto.createHash('sha256').update(plainToken).digest('hex');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });
});
