import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const RUNNER_SECRET = process.env.SANDBOX_RUNNER_SECRET || 'temporary_runner_secret_min_32_chars_for_hmac_auth';

export const verifyHmacSignature = (req: Request, res: Response, next: NextFunction): void => {
  const signature = req.headers['x-signature-sha256'] as string;
  if (!signature) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing X-Signature-SHA256 header' });
    return;
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expectedSignature = crypto
    .createHmac('sha256', RUNNER_SECRET)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid HMAC signature' });
    return;
  }

  next();
};
