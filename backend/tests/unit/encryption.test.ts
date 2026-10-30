import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../../src/utils/encryption.js';

describe('AES-256-GCM Token Encryption', () => {
  it('should encrypt and successfully decrypt a sensitive token', () => {
    const rawToken = 'gho_secretAccessToken1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = encryptToken(rawToken);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(rawToken);
    expect(encrypted.iv).toHaveLength(24); // 12 bytes hex
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes hex

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('should produce distinct ciphertexts and IVs for identical plaintexts (nondeterministic IV)', () => {
    const rawToken = 'gho_identicalTokenValueForEntropyTest';
    const enc1 = encryptToken(rawToken);
    const enc2 = encryptToken(rawToken);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    expect(decryptToken(enc1)).toBe(rawToken);
    expect(decryptToken(enc2)).toBe(rawToken);
  });

  it('should fail decryption if ciphertext has been tampered with', () => {
    const rawToken = 'gho_tamperTestToken';
    const encrypted = encryptToken(rawToken);

    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith('0') ? '1' : '0'),
    };

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('should fail decryption if authTag is altered', () => {
    const rawToken = 'gho_authTagTamperTest';
    const encrypted = encryptToken(rawToken);

    const tampered = {
      ...encrypted,
      authTag: '00000000000000000000000000000000',
    };

    expect(() => decryptToken(tampered)).toThrow();
  });
});
