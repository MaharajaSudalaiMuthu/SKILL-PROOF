import { z } from 'zod';

export const ChallengeFileSubmissionSchema = z.object({
  path: z.string().min(1, 'File path is required'),
  content: z.string(),
});

export const SubmitChallengeSchema = z.object({
  files: z.array(ChallengeFileSubmissionSchema).min(1, 'At least one file is required'),
});

export type SubmitChallengeInput = z.infer<typeof SubmitChallengeSchema>;
