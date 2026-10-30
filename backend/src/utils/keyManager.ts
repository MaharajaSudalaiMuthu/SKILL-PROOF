import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as jose from 'jose';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedPrivateKey: crypto.KeyObject | null = null;
let cachedPublicKey: crypto.KeyObject | null = null;

function resolveKeyPath(): string {
  const configured = config.env.SIGNING_KEY_PATH;
  if (path.isAbsolute(configured)) {
    return configured;
  }
  // Relative to backend root
  return path.resolve(__dirname, '../../', configured);
}

/**
 * Initializes or loads the Ed25519 signing keypair.
 * If the key file doesn't exist, generates one and writes it with 0600 permissions.
 */
export function initializeKeypair(): { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject } {
  if (cachedPrivateKey && cachedPublicKey) {
    return { privateKey: cachedPrivateKey, publicKey: cachedPublicKey };
  }

  const keyPath = resolveKeyPath();

  if (fs.existsSync(keyPath)) {
    try {
      const pem = fs.readFileSync(keyPath, 'utf8');
      cachedPrivateKey = crypto.createPrivateKey(pem);
      cachedPublicKey = crypto.createPublicKey(cachedPrivateKey);
      return { privateKey: cachedPrivateKey, publicKey: cachedPublicKey };
    } catch (err) {
      console.warn(`Failed reading signing key from ${keyPath}, regenerating:`, err);
    }
  }

  // Generate a new Ed25519 keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  cachedPrivateKey = privateKey;
  cachedPublicKey = publicKey;

  try {
    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    fs.writeFileSync(keyPath, privPem, { mode: 0o600 });
  } catch (err) {
    console.warn(`Could not persist generated key to ${keyPath} (operating in-memory):`, err);
  }

  return { privateKey, publicKey };
}

/**
 * Signs data using the Ed25519 private key.
 * @param data Canonical string or buffer to sign
 * @returns base64url encoded signature
 */
export function signWithEd25519(data: string | Buffer): string {
  const { privateKey } = initializeKeypair();
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const signature = crypto.sign(null, buffer, privateKey);
  return signature.toString('base64url');
}

/**
 * Verifies an Ed25519 signature against data.
 * @param data Canonical string or buffer
 * @param signatureBase64url base64url encoded signature
 * @param optionalPublicKey Optional public key override (for remote verification)
 * @returns boolean true if signature is valid
 */
export function verifyWithEd25519(
  data: string | Buffer,
  signatureBase64url: string,
  optionalPublicKey?: crypto.KeyObject | string
): boolean {
  try {
    const key = optionalPublicKey
      ? typeof optionalPublicKey === 'string'
        ? crypto.createPublicKey(optionalPublicKey)
        : optionalPublicKey
      : initializeKeypair().publicKey;

    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const signature = Buffer.from(signatureBase64url, 'base64url');
    return crypto.verify(null, buffer, key, signature);
  } catch {
    return false;
  }
}

/**
 * Exports the public key in SPKI PEM format.
 */
export function getPublicKeyPem(): string {
  const { publicKey } = initializeKeypair();
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Exports the public key in RFC 8037 JWK format.
 */
export async function getPublicKeyJwk(): Promise<jose.JWK> {
  const { publicKey } = initializeKeypair();
  return await jose.exportJWK(publicKey);
}
