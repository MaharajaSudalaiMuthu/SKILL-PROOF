import * as jose from 'jose';
import { config } from '../config/index.js';

export interface SessionPayload {
  userId: string;
  githubLogin: string;
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(config.env.JWT_SECRET);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return await new jose.SignJWT({
    userId: payload.userId,
    githubLogin: payload.githubLogin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('skillproof')
    .setAudience('skillproof-client')
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret(), {
      issuer: 'skillproof',
      audience: 'skillproof-client',
    });

    if (typeof payload['userId'] === 'string' && typeof payload['githubLogin'] === 'string') {
      return {
        userId: payload['userId'],
        githubLogin: payload['githubLogin'],
      };
    }
    return null;
  } catch {
    return null;
  }
}
