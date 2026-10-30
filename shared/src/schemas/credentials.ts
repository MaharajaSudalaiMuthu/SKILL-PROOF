import { z } from 'zod';

export const IssueCredentialSchema = z.object({
  skillSlug: z.string().min(1, 'Skill slug is required'),
  validMonths: z.number().int().min(1).max(12).default(12),
});

export type IssueCredentialInput = z.infer<typeof IssueCredentialSchema>;

export const VerifyCredentialPastedSchema = z.object({
  credential: z.record(z.any()),
});

export type VerifyCredentialPastedInput = z.infer<typeof VerifyCredentialPastedSchema>;

export const CreateShareSchema = z.object({
  skillSlug: z.string().min(1, 'Skill slug is required'),
  expiryDays: z.number().int().min(1).max(365).default(30),
});

export type CreateShareInput = z.infer<typeof CreateShareSchema>;
