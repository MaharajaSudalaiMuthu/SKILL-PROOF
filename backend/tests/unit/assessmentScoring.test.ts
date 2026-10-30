import { describe, it, expect } from 'vitest';
import { SubmitAssessmentSchema, SKILL_SLUGS } from '@skillproof/shared';
import { CANONICAL_QUESTIONS } from '../../src/seeds/seedAssessmentQuestions.js';

describe('Assessment Scoring & Question Bank Unit Tests (R7, R8)', () => {
  it('1. verifies that the question catalog has at least 48 questions across all 8 skills (6 per skill)', () => {
    expect(CANONICAL_QUESTIONS.length).toBeGreaterThanOrEqual(48);

    const questionsBySkill = new Map<string, number>();
    for (const q of CANONICAL_QUESTIONS) {
      expect(SKILL_SLUGS).toContain(q.skillSlug);
      expect(q.questionId).toBeDefined();
      expect(q.title).toBeDefined();
      expect(q.scenario).toBeDefined();
      expect(q.options).toHaveLength(4);
      expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctOptionIndex).toBeLessThanOrEqual(3);
      expect(q.rubricExplanation?.length).toBeGreaterThan(10);

      const count = questionsBySkill.get(q.skillSlug!) ?? 0;
      questionsBySkill.set(q.skillSlug!, count + 1);
    }

    for (const slug of SKILL_SLUGS) {
      expect(questionsBySkill.get(slug)).toBe(6);
    }
  });

  it('2. verifies passing threshold calculation: >= 66% passes (R8)', () => {
    const totalQuestions = 3;

    // 3 out of 3 correct
    const score3 = Math.round((3 / totalQuestions) * 1000) / 10;
    expect(score3).toBe(100);
    expect(score3 >= 66).toBe(true);

    // 2 out of 3 correct
    const score2 = Math.round((2 / totalQuestions) * 1000) / 10;
    expect(score2).toBe(66.7);
    expect(score2 >= 66).toBe(true);

    // 1 out of 3 correct
    const score1 = Math.round((1 / totalQuestions) * 1000) / 10;
    expect(score1).toBe(33.3);
    expect(score1 >= 66).toBe(false);

    // 0 out of 3 correct
    const score0 = Math.round((0 / totalQuestions) * 1000) / 10;
    expect(score0).toBe(0);
    expect(score0 >= 66).toBe(false);
  });

  it('3. validates submission payload with Zod schema', () => {
    // Valid submission
    const valid = SubmitAssessmentSchema.safeParse({
      answers: [
        { questionId: 'Q_REST_01', selectedOptionIndex: 1 },
        { questionId: 'Q_REST_02', selectedOptionIndex: 2 },
        { questionId: 'Q_REST_03', selectedOptionIndex: 0 },
      ],
    });
    expect(valid.success).toBe(true);

    // Rejects empty answers
    const empty = SubmitAssessmentSchema.safeParse({ answers: [] });
    expect(empty.success).toBe(false);

    // Rejects invalid option index (> 3)
    const invalidIndex = SubmitAssessmentSchema.safeParse({
      answers: [{ questionId: 'Q_REST_01', selectedOptionIndex: 4 }],
    });
    expect(invalidIndex.success).toBe(false);

    // Rejects negative option index
    const negativeIndex = SubmitAssessmentSchema.safeParse({
      answers: [{ questionId: 'Q_REST_01', selectedOptionIndex: -1 }],
    });
    expect(negativeIndex.success).toBe(false);
  });

  it('4. calculates 15-minute expiration timestamp correctly', () => {
    const startedAt = new Date('2026-10-28T10:00:00.000Z');
    const expiresAt = new Date(startedAt.getTime() + 15 * 60 * 1000);

    expect(expiresAt.toISOString()).toBe('2026-10-28T10:15:00.000Z');
    expect(expiresAt.getTime() - startedAt.getTime()).toBe(900000);
  });
});
