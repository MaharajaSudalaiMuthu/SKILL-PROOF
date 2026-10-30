import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'req.headers["x-signature-sha256"]',
      'res.headers["set-cookie"]',
      'token',
      'accessToken',
      'encryptedAccessToken',
      'password',
      'secret',
    ],
    remove: true,
  },
  transport:
    config.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
});
