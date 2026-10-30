import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import {
  generateOAuthState,
  getGitHubAuthorizeUrl,
  exchangeCodeForAccessToken,
  fetchGitHubUserProfile,
  upsertGitHubUser,
} from './githubOAuthService.js';
import { signSessionToken } from '../utils/jwt.js';
import { encryptToken } from '../utils/encryption.js';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { ConsentModel } from '../models/Consent.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

const OAUTH_STATE_COOKIE = 'SKILLPROOF_OAUTH_STATE';
const SESSION_COOKIE = 'SKILLPROOF_SESSION';

function getCallbackUri(req: Request): string {
  return `${config.env.API_BASE_URL}/api/auth/github/callback`;
}

// 1. Initiate GitHub OAuth Flow
authRouter.get('/github', (req: Request, res: Response) => {
  const state = generateOAuthState();
  const callbackUri = getCallbackUri(req);

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/api/auth',
  });

  const authorizeUrl = getGitHubAuthorizeUrl(state, callbackUri);
  res.redirect(authorizeUrl);
});

// 2. GitHub OAuth Callback
authRouter.get('/github/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (typeof code !== 'string' || typeof state !== 'string') {
    throw new AppError(400, 'INVALID_CALLBACK_PARAMS', 'Missing code or state query parameters.');
  }

  const storedState = req.cookies[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth' });

  if (!storedState || storedState !== state) {
    throw new AppError(403, 'STATE_MISMATCH', 'OAuth state verification failed. Possible CSRF attempt.');
  }

  const callbackUri = getCallbackUri(req);
  const accessToken = await exchangeCodeForAccessToken(code, callbackUri);
  const profile = await fetchGitHubUserProfile(accessToken);
  const user = await upsertGitHubUser(profile, accessToken);

  const sessionToken = await signSessionToken({
    userId: user._id.toString(),
    githubLogin: user.githubLogin,
  });

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: config.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  res.redirect(`${config.env.APP_BASE_URL}/dashboard`);
});

// 3. Current Authenticated User Profile
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const consent = await ConsentModel.findOne({ userId: user._id });

  res.status(200).json({
    id: user._id.toString(),
    githubUserId: user.githubUserId,
    githubLogin: user.githubLogin,
    name: user.name,
    avatarUrl: user.avatarUrl,
    consentGiven: !!consent,
    createdAt: user.createdAt,
  });
});

// 4. Logout
authRouter.post('/logout', requireAuth, requireCsrf, (req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(200).json({
    status: 200,
    message: 'Logged out successfully.',
  });
});

// 5. Dev Mode Auto-Login (Available in non-production)
if (config.env.NODE_ENV !== 'production') {
  authRouter.get('/dev-login', async (req: Request, res: Response) => {
    let user = await UserModel.findOne({ githubLogin: 'dev_expert' });
    const demoToken = encryptToken('ghp_demo_token_skillproof');
    if (!user) {
      user = await UserModel.create({
        githubUserId: '999999',
        githubLogin: 'dev_expert',
        name: 'SkillProof Lead Developer',
        avatarUrl: 'https://avatars.githubusercontent.com/u/999999?v=4',
        email: 'dev@skillproof.internal',
        encryptedAccessToken: demoToken.ciphertext,
        tokenIv: demoToken.iv,
        tokenAuthTag: demoToken.authTag,
        tokenScope: 'read:user,repo',
      });
      await ConsentModel.create({
        userId: user._id,
        consentVersion: '1.0.0',
        grantedScopes: ['PUBLIC_METRICS', 'CODE_CONTRIBUTION', 'BLAME_ANALYSIS'],
        grantedAt: new Date(),
        ipAddress: '127.0.0.1',
      });
    } else {
      user.encryptedAccessToken = demoToken.ciphertext;
      user.tokenIv = demoToken.iv;
      user.tokenAuthTag = demoToken.authTag;
      await user.save();
    }

    const sessionToken = await signSessionToken({
      userId: user._id.toString(),
      githubLogin: user.githubLogin,
    });

    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect('/');
  });
}

// 6. Sign In or Create Developer Account
authRouter.post('/signin', requireCsrf, async (req: Request, res: Response) => {
  const { username, name } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new AppError(400, 'INVALID_USERNAME', 'Please enter a valid GitHub username or developer handle.');
  }

  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
  let user = await UserModel.findOne({ githubLogin: cleanUsername });
  const demoToken = encryptToken('ghp_demo_token_skillproof');

  if (!user) {
    const randomId = Math.floor(Math.random() * 899999) + 100000;
    user = await UserModel.create({
      githubUserId: randomId,
      githubLogin: cleanUsername,
      name: name && typeof name === 'string' && name.trim() ? name.trim() : cleanUsername,
      avatarUrl: `https://github.com/${cleanUsername}.png`,
      encryptedAccessToken: demoToken.ciphertext,
      tokenIv: demoToken.iv,
      tokenAuthTag: demoToken.authTag,
    });

    await ConsentModel.create({
      userId: user._id,
      consentVersion: '1.0.0',
      grantedScopes: ['PUBLIC_METRICS', 'CODE_CONTRIBUTION', 'BLAME_ANALYSIS'],
      grantedAt: new Date(),
      ipAddress: req.ip || '127.0.0.1',
    });
  }

  const sessionToken = await signSessionToken({
    userId: user._id.toString(),
    githubLogin: user.githubLogin,
  });

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.status(200).json({
    user: {
      id: user._id.toString(),
      githubLogin: user.githubLogin,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    message: 'Signed in successfully.',
  });
});

