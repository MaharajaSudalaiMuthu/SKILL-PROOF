import { z } from 'zod';

export const DeleteAnalysisSchema = z.object({
  confirmText: z.literal('DELETE ANALYSIS DATA', {
    errorMap: () => ({ message: "Must confirm by typing 'DELETE ANALYSIS DATA'" }),
  }),
});

export type DeleteAnalysisInput = z.infer<typeof DeleteAnalysisSchema>;

export const DeleteAccountSchema = z.object({
  confirmText: z.literal('DELETE MY ACCOUNT', {
    errorMap: () => ({ message: "Must confirm by typing 'DELETE MY ACCOUNT'" }),
  }),
});

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
