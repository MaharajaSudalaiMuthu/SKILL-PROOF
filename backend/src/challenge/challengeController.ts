import { Router, Response } from 'express';
import crypto from 'crypto';
import {
  SkillSlug,
  SubmitChallengeSchema,
  ChallengeSummary,
  ChallengeDetailResponse,
  ChallengeRunResult,
  SkillLevel,
} from '@skillproof/shared';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { Challenge } from '../models/Challenge.js';
import { SandboxRun } from '../models/SandboxRun.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { recomputeUserSnapshots } from '../engine/snapshotService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../middleware/pinoLogger.js';

export const challengeRouter = Router();

const RUNNER_SECRET = process.env.SANDBOX_RUNNER_SECRET || 'temporary_runner_secret_min_32_chars_for_hmac_auth';
const RUNNER_URL = process.env.SANDBOX_RUNNER_URL || 'http://127.0.0.1:8081';

// GET /api/challenges — List practical coding challenges with completion status
challengeRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;

  const challenges = await Challenge.find({}).lean();
  const userRuns = await SandboxRun.find({ userId }).lean();

  const passedSlugs = new Set<string>(userRuns.filter((r) => r.passed).map((r) => r.challengeSlug));
  const lastAttemptMap = new Map<string, string>();

  for (const r of userRuns) {
    const existing = lastAttemptMap.get(r.challengeSlug);
    const time = r.completedAt ? r.completedAt.toISOString() : new Date().toISOString();
    if (!existing || time > existing) {
      lastAttemptMap.set(r.challengeSlug, time);
    }
  }

  const summaries: ChallengeSummary[] = challenges.map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    mappedSkills: c.mappedSkills as SkillSlug[],
    timeLimitMinutes: c.timeLimitMinutes,
    passed: passedSlugs.has(c.slug),
    lastAttemptAt: lastAttemptMap.get(c.slug) || null,
  }));

  res.status(200).json({ challenges: summaries });
});

// GET /api/challenges/:slug — Challenge details with starter files (hidden tests strictly excluded)
challengeRouter.get('/:slug', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { slug } = req.params;
  const userId = req.user!._id;

  const challenge = await Challenge.findOne({ slug }).lean();
  if (!challenge) {
    throw new AppError(404, 'CHALLENGE_NOT_FOUND', `Coding challenge '${slug}' not found.`);
  }

  const latestRun = await SandboxRun.findOne({ userId, challengeSlug: slug }).sort({ completedAt: -1 }).lean();
  const isPassed = await SandboxRun.exists({ userId, challengeSlug: slug, passed: true });

  const detail: ChallengeDetailResponse = {
    slug: challenge.slug,
    title: challenge.title,
    description: challenge.description,
    mappedSkills: challenge.mappedSkills as SkillSlug[],
    timeLimitMinutes: challenge.timeLimitMinutes,
    starterFiles: challenge.starterFiles,
    instructions: challenge.instructions,
    passed: !!isPassed,
    lastAttemptAt: latestRun?.completedAt ? latestRun.completedAt.toISOString() : null,
  };

  res.status(200).json({ challenge: detail });
});

// POST /api/challenges/:slug/submit — Submit code solution for automated sandbox grading
challengeRouter.post('/:slug/submit', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const { slug } = req.params;
  const userId = req.user!._id;

  // 1. Validate submission payload
  const parseResult = SubmitChallengeSchema.safeParse(req.body);
  if (!parseResult.success) {
    const formattedIssues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid challenge submission format: ${formattedIssues}`);
  }

  const challenge = await Challenge.findOne({ slug }).lean();
  if (!challenge) {
    throw new AppError(404, 'CHALLENGE_NOT_FOUND', `Coding challenge '${slug}' not found.`);
  }

  // 2. Eligibility verification: user must have at least one mapped skill at SUPPORTED or higher
  const userSnapshots = await SkillLevelSnapshot.find({
    userId,
    skillSlug: { $in: challenge.mappedSkills },
  }).lean();

  const isEligible = userSnapshots.some(
    (s) => s.currentLevel === 'SUPPORTED' || s.currentLevel === 'VERIFIED'
  );

  if (!isEligible) {
    throw new AppError(
      403,
      'INELIGIBLE_FOR_CHALLENGE',
      'You must attain the Supported level on at least one mapped capability before submitting this coding challenge.'
    );
  }

  // 3. Dispatch to isolated sandbox runner with HMAC signature
  const payload = {
    challengeSlug: slug,
    files: parseResult.data.files,
    testFiles: challenge.hiddenTestFiles,
  };

  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', RUNNER_SECRET).update(rawBody).digest('hex');

  let runnerResponse: any;
  try {
    const resRunner = await fetch(`${RUNNER_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-SHA256': signature,
      },
      body: rawBody,
    });

    if (!resRunner.ok) {
      const errText = await resRunner.text();
      logger.error({ status: resRunner.status, errText }, 'Sandbox runner request failed');
      throw new AppError(502, 'SANDBOX_RUNNER_ERROR', `Sandbox runner returned status ${resRunner.status}`);
    }

    runnerResponse = await resRunner.json();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Error connecting to sandbox runner service');
    throw new AppError(503, 'SANDBOX_SERVICE_UNAVAILABLE', `Unable to connect to sandbox runner at ${RUNNER_URL}: ${msg}`);
  }

  const totalTests = runnerResponse.totalTests || 0;
  const passedTests = runnerResponse.passedTests || 0;
  const score = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  const passed = Boolean(runnerResponse.passed);

  // 4. Record SandboxRun
  const sandboxRun = await SandboxRun.create({
    runId: runnerResponse.runId || crypto.randomUUID(),
    userId,
    challengeSlug: slug,
    passed,
    score,
    totalTests,
    passedTests,
    failedTests: runnerResponse.failedTests || 0,
    testOutput: runnerResponse.testOutput || '',
    executionTimeMs: runnerResponse.executionTimeMs || 0,
    submittedFiles: parseResult.data.files,
    completedAt: new Date(),
  });

  // 5. Recompute snapshot levels if passed (or refresh)
  await recomputeUserSnapshots(userId);

  const updatedSnapshots = await SkillLevelSnapshot.find({ userId }).lean();
  const capabilityLevels: Partial<Record<SkillSlug, SkillLevel>> = {};
  const promotedSkills: SkillSlug[] = [];

  for (const s of updatedSnapshots) {
    capabilityLevels[s.skillSlug as SkillSlug] = s.currentLevel as SkillLevel;
    if (challenge.mappedSkills.includes(s.skillSlug as SkillSlug) && s.currentLevel === 'VERIFIED') {
      promotedSkills.push(s.skillSlug as SkillSlug);
    }
  }

  const result: ChallengeRunResult = {
    runId: sandboxRun.runId,
    challengeSlug: String(slug),
    passed: sandboxRun.passed,
    score: sandboxRun.score,
    totalTests: sandboxRun.totalTests,
    passedTests: sandboxRun.passedTests,
    failedTests: sandboxRun.failedTests,
    testOutput: sandboxRun.testOutput,
    executionTimeMs: sandboxRun.executionTimeMs,
    completedAt: sandboxRun.completedAt ? sandboxRun.completedAt.toISOString() : new Date().toISOString(),
    promotedSkills,
    capabilityLevels: capabilityLevels as Record<SkillSlug, SkillLevel>,
  };

  res.status(200).json(result);
});
