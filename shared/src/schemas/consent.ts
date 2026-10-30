import { z } from 'zod';

export const ConsentSchema = z.object({
  consentVersion: z.string().min(1),
  agree: z.literal(true),
});

export type ConsentDto = z.infer<typeof ConsentSchema>;
