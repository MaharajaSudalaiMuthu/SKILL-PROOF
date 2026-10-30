import { z } from 'zod';
import { SKILL_SLUGS } from '../types/skills.js';
import { SKILL_LEVELS } from '../types/levels.js';

export const ExpertRatingEntrySchema = z.object({
  subjectId: z.string().min(1, 'Subject ID is required'),
  skillSlug: z.enum(SKILL_SLUGS),
  expertLevel: z.enum(SKILL_LEVELS),
  confidence: z.number().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
});

export const ComputeAgreementRequestSchema = z.object({
  ratings: z.array(ExpertRatingEntrySchema).min(1, 'At least one expert rating entry is required'),
});

export type ExpertRatingEntryInput = z.infer<typeof ExpertRatingEntrySchema>;
export type ComputeAgreementRequestInput = z.infer<typeof ComputeAgreementRequestSchema>;
