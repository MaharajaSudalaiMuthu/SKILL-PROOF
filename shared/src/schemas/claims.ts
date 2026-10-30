import { z } from 'zod';
import { SKILL_SLUGS } from '../types/skills.js';

export const CreateClaimSchema = z.object({
  skillSlug: z.enum(SKILL_SLUGS),
});

export type CreateClaimDto = z.infer<typeof CreateClaimSchema>;
