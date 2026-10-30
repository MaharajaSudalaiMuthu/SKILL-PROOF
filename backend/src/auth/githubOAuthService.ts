import crypto from 'crypto';
import { config } from '../config/index.js';
import { encryptToken } from '../utils/encryption.js';
import { UserModel, IUser } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

export interface GitHubUserProfile {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getGitHubAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user', // Minimal read-only profile access
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForAccessToken(code: string, redirectUri: string): Promise<string> {
  const tokenUrl = `${config.skillproof.github.cloneBaseUrl === 'https://github.com' ? 'https://github.com' : config.skillproof.github.apiBaseUrl}/login/oauth/access_token`;
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.env.GITHUB_CLIENT_ID,
      client_secret: config.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new AppError(502, 'OAUTH_EXCHANGE_FAILED', `GitHub token exchange responded with HTTP ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (data.error || !data.access_token) {
    throw new AppError(400, 'OAUTH_ERROR', data.error_description || data.error || 'Failed to obtain access token from GitHub');
  }

  return data.access_token;
}

export async function fetchGitHubUserProfile(accessToken: string): Promise<GitHubUserProfile> {
  const userUrl = `${config.skillproof.github.apiBaseUrl}/user`;
  const response = await fetch(userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SkillProof-Verification-Platform',
    },
  });

  if (!response.ok) {
    throw new AppError(502, 'GITHUB_API_ERROR', `GitHub user profile API returned HTTP ${response.status}`);
  }

  const profile = (await response.json()) as GitHubUserProfile;
  if (!profile.id || !profile.login) {
    throw new AppError(502, 'INVALID_GITHUB_PROFILE', 'Received incomplete profile data from GitHub');
  }

  return profile;
}

export async function upsertGitHubUser(profile: GitHubUserProfile, accessToken: string): Promise<IUser> {
  const { ciphertext, iv, authTag } = encryptToken(accessToken);

  const user = await UserModel.findOneAndUpdate(
    { githubUserId: profile.id },
    {
      githubUserId: profile.id,
      githubLogin: profile.login.toLowerCase(),
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      encryptedAccessToken: ciphertext,
      tokenIv: iv,
      tokenAuthTag: authTag,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return user;
}
