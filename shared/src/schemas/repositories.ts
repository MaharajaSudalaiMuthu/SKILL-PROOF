import { z } from 'zod';

export const REPO_FULL_NAME_REGEX = /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/;

export const SelectRepoSchema = z.object({
  githubRepoId: z.number().int().optional(),
  fullName: z
    .string()
    .min(1)
    .max(200),
  cloneUrl: z.string().min(1),
  isFork: z.boolean().optional().default(false),
  defaultBranch: z.string().min(1).default('main'),
  sourceType: z.enum(['GITHUB', 'ZIP_UPLOAD']).optional().default('GITHUB'),
  isPrivate: z.boolean().optional().default(false),
  accessToken: z.string().optional(),
});

export type SelectRepoInput = z.infer<typeof SelectRepoSchema>;
