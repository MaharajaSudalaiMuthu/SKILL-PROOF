import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../utils/jwt.js';
import { UserModel, IUser } from '../models/User.js';
import { ConsentModel } from '../models/Consent.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extract token from HttpOnly cookie or Authorization header
  let token = req.cookies?.['SKILLPROOF_SESSION'];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication session required.');
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    throw new AppError(401, 'INVALID_SESSION', 'Session is invalid or expired. Please sign in again.');
  }

  const user = await UserModel.findById(payload.userId);
  if (!user) {
    throw new AppError(401, 'USER_NOT_FOUND', 'User account associated with this session no longer exists.');
  }

  req.user = user;
  req.userId = user._id.toString();
  next();
}

export function requireCsrf(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  // Custom header verification protects against standard cross-site form submissions
  const csrfHeader = req.headers['x-skillproof-request'];
  if (csrfHeader !== 'true') {
    throw new AppError(403, 'CSRF_VALIDATION_FAILED', 'Missing required X-SkillProof-Request security header.');
  }

  next();
}

export async function requireConsent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const consent = await ConsentModel.findOne({ userId: req.user?._id });
  if (!consent) {
    throw new AppError(403, 'CONSENT_REQUIRED', 'Explicit platform consent must be granted before accessing this feature.');
  }

  next();
}
