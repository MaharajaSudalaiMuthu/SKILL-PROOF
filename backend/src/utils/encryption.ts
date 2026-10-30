import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard for GCM

function getSecretKey(): Buffer {
  const hexKey = config.env.ENCRYPTION_SECRET_KEY;
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('ENCRYPTION_SECRET_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(hexKey, 'hex');
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plainText: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  
  let ciphertext = cipher.update(plainText, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
  };
}

export function decryptToken(encryptedData: EncryptedData): string {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
