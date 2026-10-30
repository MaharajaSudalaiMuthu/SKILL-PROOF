import crypto from 'crypto';
import { Router, Response } from 'express';
import { ConsentSchema } from '@skillproof/shared';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { ConsentModel } from '../models/Consent.js';

export const consentRouter = Router();

// GET /api/user/consent
consentRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const consent = await ConsentModel.findOne({ userId: req.user?._id });
  if (!consent) {
    res.status(200).json({
      consentGiven: false,
      consentVersion: null,
      agreedAt: null,
    });
    return;
  }

  res.status(200).json({
    consentGiven: true,
    consentVersion: consent.consentVersion,
    agreedAt: consent.agreedAt,
  });
});

// POST /api/user/consent
consentRouter.post('/', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const payload = ConsentSchema.parse(req.body);

  const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
  const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

  const consent = await ConsentModel.findOneAndUpdate(
    { userId: req.user?._id },
    {
      userId: req.user?._id,
      consentVersion: payload.consentVersion,
      agreedAt: new Date(),
      ipHash,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({
    message: 'Consent recorded successfully.',
    consentVersion: consent.consentVersion,
    agreedAt: consent.agreedAt,
  });
});
