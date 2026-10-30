import { z } from 'zod';

export const SkillProofConfigSchema = z.object({
  github: z
    .object({
      apiBaseUrl: z.string().url().default('https://api.github.com'),
      cloneBaseUrl: z.string().url().default('https://github.com'),
      maxShasResolved: z.number().int().positive().default(100),
      rateLimitBackoffMs: z.number().int().positive().default(1000),
    })
    .default({}),
  attribution: z
    .object({
      minConfirmedRatio: z.number().min(0).max(1).default(0.5),
    })
    .default({}),
  level: z
    .object({
      observed: z
        .object({
          minFindings: z.number().int().positive().default(2),
          minRepos: z.number().int().positive().default(1),
          minRecencyWeight: z.number().positive().default(1.0),
        })
        .default({}),
    })
    .default({}),
  recency: z
    .object({
      halfLifeMonths: z.number().positive().default(12.0),
      expiryMonths: z.number().positive().default(12.0),
    })
    .default({}),
  assessment: z
    .object({
      questionsPerAttempt: z.number().int().min(2).max(3).default(3),
      passThreshold: z.number().min(0).max(1).default(0.66),
      retakeCooldownHours: z.number().int().nonnegative().default(24),
    })
    .default({}),
  challenge: z
    .object({
      retakeCooldownHours: z.number().int().nonnegative().default(1),
      defaultTimeoutSeconds: z.number().int().positive().default(180),
    })
    .default({}),
  antiGaming: z
    .object({
      forkMinLines: z.number().int().positive().default(50),
      forkMinRatio: z.number().min(0).max(1).default(0.2),
      initialCommitRatio: z.number().min(0).max(1).default(0.8),
      tutorialSimilarityThreshold: z.number().min(0).max(1).default(0.6),
    })
    .default({}),
  credential: z
    .object({
      validityMonths: z.number().int().positive().default(12),
    })
    .default({}),
  share: z
    .object({
      defaultExpiryDays: z.number().int().positive().default(30),
    })
    .default({}),
});

export type SkillProofConfig = z.infer<typeof SkillProofConfigSchema>;
