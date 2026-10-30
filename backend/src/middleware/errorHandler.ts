import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './pinoLogger.js';

export interface AppErrorDetails {
  status: number;
  error: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public status: number,
    public error: string,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;

  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    res.status(400).json({
      timestamp,
      status: 400,
      error: 'VALIDATION_ERROR',
      message: `Invalid request payload: ${formattedIssues}`,
      path,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      timestamp,
      status: err.status,
      error: err.error,
      message: err.message,
      path,
    });
    return;
  }

  // Generic unexpected error - never leak internal stack traces or database errors
  logger.error({ err, path }, 'Unhandled application error');

  res.status(500).json({
    timestamp,
    status: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred. Please try again later.',
    path,
  });
};
