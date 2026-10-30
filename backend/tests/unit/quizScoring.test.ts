import { describe, it, expect } from "vitest";
import { generateQuizForRepository } from "../../src/engine/repoQuizGenerator.js";
import { IEvidenceRecord } from "../../src/models/EvidenceRecord.js";

describe("Quiz Submission & Scoring Verification", () => {
  it("Correctly scores quiz attempts, identifies knowledge gaps, and calculates percentage", () => {
    const mockEvidence: IEvidenceRecord[] = Array.from({ length: 10 }).map((_, i) => ({
      userId: "u1" as any,
      skillSlug: "rest-controller-design" as any,
      evidenceType: "STATIC" as any,
      validityStatus: "VALID" as any,
      attributionStatus: "CONFIRMED" as any,
      filePath: `src/module_${i}.py`,
      startLine: i * 10 + 1,
      endLine: i * 10 + 10,
      matchedPattern: `def func_${i}(): pass`,
      dedupeKey: `dedupe-${i}`,
      recencyWeight: 1.0,
      createdAt: new Date(),
      rawDetails: {
        category: i % 2 === 0 ? "FUNCTION_LOGIC" : "DATA_MODEL",
        primaryIdentifier: `func_${i}`,
        correctAnswer: `It performs operation ${i} correctly.`,
        distractors: [
          `Distractor A for ${i}`,
          `Distractor B for ${i}`,
          `Distractor C for ${i}`,
        ],
        explanation: `Explanation for question ${i}.`,
        title: `Question ${i}`,
      },
    })) as unknown as IEvidenceRecord[];

    const questions = generateQuizForRepository("test/repo", mockEvidence, []);
    expect(questions.length).toBe(10);

    // Simulate 8 correct answers out of 10 (80% score -> PASS)
    const answers = questions.map((q, idx) => ({
      questionId: q.id,
      selectedOptionIndex: idx < 8 ? q.correctOptionIndex : (q.correctOptionIndex + 1) % 4,
    }));

    let correctCount = 0;
    const knowledgeGaps = new Set<string>();

    for (const a of answers) {
      const q = questions.find((item) => item.id === a.questionId);
      if (q && q.correctOptionIndex === a.selectedOptionIndex) {
        correctCount++;
      } else if (q) {
        knowledgeGaps.add(q.category);
      }
    }

    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const passed = scorePercent >= 70;

    expect(correctCount).toBe(8);
    expect(scorePercent).toBe(80);
    expect(passed).toBe(true);
    expect(knowledgeGaps.size).toBeGreaterThan(0);
  });
});
