import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import { httpLogger, logger } from './middleware/pinoLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './auth/authController.js';
import { consentRouter } from './user/consentController.js';
import { skillRouter } from './skill/skillController.js';
import { seedSkills } from './seeds/seedSkills.js';
import { seedAssessmentQuestions } from './seeds/seedAssessmentQuestions.js';
import { seedChallenges } from './seeds/seedChallenges.js';
import { seedReferenceCorpus } from './antigaming/seedReferenceCorpus.js';
import { repositoryRouter, analysisRouter } from './repository/repositoryController.js';
import { repoQuizRouter } from './repository/repoQuizController.js';
import { capabilityRouter } from './capability/capabilityController.js';
import { assessmentRouter } from './assessment/assessmentController.js';
import { challengeRouter } from './challenge/challengeController.js';
import { credentialRouter } from './credential/credentialController.js';
import { shareRouter } from './share/shareController.js';
import { privacyRouter } from './privacy/privacyController.js';
import { evaluationRouter } from './evaluation/evaluationController.js';
import { getPublicKeyJwk } from './utils/keyManager.js';

import { recoverOrphanedJobs } from './ingestion/jobQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Security & Parsing Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: config.env.APP_BASE_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(httpLogger);

// Health Check Endpoint (Unauthenticated)
app.get('/api/health', (req: Request, res: Response) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: isMongoConnected,
      readyState: mongoose.connection.readyState,
    },
    version: '1.0.0',
    edition: 'MERN',
  });
});

// Mount Feature Routers
app.use('/api/auth', authRouter);
app.use('/api/user/consent', consentRouter);
app.use('/api/skills', skillRouter);
app.use('/api/capabilities', capabilityRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/challenges', challengeRouter);
app.use('/api/credentials', credentialRouter);
app.use('/api/shares', shareRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/evaluation', evaluationRouter);
app.use('/api/repositories', repoQuizRouter);
app.use('/api/repositories', repositoryRouter);

app.use('/api/analysis', analysisRouter);

// RFC 7517 / RFC 8037 Well-Known JWKS Endpoint
app.get('/.well-known/skillproof-keys.json', async (_req: Request, res: Response) => {
  try {
    const jwk = await getPublicKeyJwk();
    res.json({ keys: [jwk] });
  } catch (err) {
    res.status(500).json({ error: 'Failed retrieving JWKS' });
  }
});

// Static frontend serving and SPA fallback
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req: Request, res: Response, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/.well-known')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    next();
  });
}

// 404 Fallback for unknown API routes
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    timestamp: new Date().toISOString(),
    status: 404,
    error: 'NOT_FOUND',
    message: `API route '${req.method} ${req.originalUrl}' does not exist.`,
    path: req.originalUrl,
  });
});

// Central Error Handler
app.use(errorHandler);

let embeddedReplSet: any = null;

// Database Connection & Server Bootstrap
export async function startServer(): Promise<void> {
  let connected = false;
  try {
    logger.info({ uri: config.env.MONGODB_URI }, 'Connecting to MongoDB...');
    await mongoose.connect(config.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
      autoIndex: false, // Indexes are managed deterministically via migrate-mongo
    });
    connected = true;
    logger.info('Connected to MongoDB replica set successfully.');
  } catch (err) {
    if (config.env.NODE_ENV !== 'production') {
      logger.info('External MongoDB not reachable. Bootstrapping embedded MongoDB Replica Set...');
      try {
        const { MongoMemoryReplSet } = await import('mongodb-memory-server');
        embeddedReplSet = await MongoMemoryReplSet.create({
          replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger', dbName: 'skillproof' },
        });
        await embeddedReplSet.waitUntilRunning();
        const memUri = embeddedReplSet.getUri('skillproof');
        logger.info({ memUri }, 'Embedded MongoDB Replica Set is online. Connecting...');
        await mongoose.connect(memUri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
        connected = true;
        logger.info('Connected to embedded MongoDB replica set successfully.');
      } catch (memErr) {
        logger.warn({ memErr }, 'Could not start embedded MongoDB replica set.');
      }
    } else {
      logger.warn({ err }, 'Could not connect to MongoDB on startup. Server running in degraded mode for health checks.');
    }
  }

  if (connected) {
    // Seed the 8 canonical capabilities idempotently
    await seedSkills();

    // Seed 48 scenario questions for all 8 canonical skills
    await seedAssessmentQuestions();

    // Seed 3 practical coding challenges
    await seedChallenges();

    // Seed reference project fingerprints for tutorial anti-gaming checks
    await seedReferenceCorpus();

    // Recover any jobs orphaned from previous process termination
    await recoverOrphanedJobs();
  }

  const server = app.listen(config.env.PORT, '0.0.0.0', () => {
    logger.info(`SkillProof server listening on http://localhost:${config.env.PORT} [${config.env.NODE_ENV}]`);
  });

  server.on('error', (err) => {
    logger.error({ err }, 'Server listen error');
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await mongoose.disconnect();
      if (embeddedReplSet) {
        await embeddedReplSet.stop();
      }
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error({ err }, 'Fatal startup failure');
    process.exit(1);
  });
}
