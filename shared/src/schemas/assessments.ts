import { z } from 'zod';

export const AssessmentAnswerSubmissionSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  selectedOptionIndex: z.number().int().min(0).max(3),
});

export const SubmitAssessmentSchema = z.object({
  answers: z.array(AssessmentAnswerSubmissionSchema).min(1, 'At least one answer required'),
});

export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentSchema>;
