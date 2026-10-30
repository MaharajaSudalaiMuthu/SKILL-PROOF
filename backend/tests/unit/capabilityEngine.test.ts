import { describe, it, expect } from 'vitest';
import { evaluateSkillLevel } from '../../src/engine/capabilityEngine.js';
import { StaticEvidenceItem } from '@skillproof/shared';

describe('Capability Evaluation Engine (R11, R12 Unit Tests)', () => {
  const now = new Date('2026-10-28T12:00:00Z');

  const createMockStaticEvidence = (
    overrides: Partial<StaticEvidenceItem> = {}
  ): StaticEvidenceItem => ({
    id: `ev-${Math.random().toString(36).substring(7)}`,
    skillSlug: 'rest-controller-design',
    repositoryId: 'repo-1',
    repositoryName: 'spring-demo',
    repositoryFullName: 'dev/spring-demo',
    isFork: false,
    hasBlockingFlag: false,
    filePath: 'src/main/java/UserController.java',
    startLine: 10,
    endLine: 40,
    commitSha: 'a1b2c3d4e5f6',
    commitDate: now.toISOString(),
    detectorName: 'rest-controller-design',
    matchedPattern: '@RestController with GET and POST',
    validityStatus: 'VALID',
    attributionStatus: 'CONFIRMED',
    recencyWeight: 1.0,
    ...overrides,
  });

  describe('Level Transitions: None & Claimed', () => {
    it('returns NONE when skill is not claimed and has no evidence', () => {
      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: false,
        staticEvidence: [],
        now,
      });

      expect(result.currentLevel).toBe('NONE');
      expect(result.awardedAt).toBeNull();
      expect(result.missingRequirements).toContain(
        'Declare skill claim or import a repository implementing this capability.'
      );
    });

    it('returns CLAIMED when developer declared claim without qualifying evidence', () => {
      const claimedAt = '2026-10-01T00:00:00Z';
      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        claimedAt,
        staticEvidence: [],
        now,
      });

      expect(result.currentLevel).toBe('CLAIMED');
      expect(result.awardedAt).toBe(claimedAt);
      expect(result.reasons[0]).toContain('Developer self-declared claim');
      expect(result.missingRequirements.some((r) => r.includes('at least 2 qualifying static findings'))).toBe(true);
    });
  });

  describe('Level Transitions: Observed (R11, R12)', () => {
    it('promotes to OBSERVED with >=2 qualifying findings, CONFIRMED lines, weight >= 1.0 (even without prior claim)', () => {
      const ev1 = createMockStaticEvidence({ commitDate: now.toISOString() });
      const ev2 = createMockStaticEvidence({ commitDate: now.toISOString() });

      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: false, // Observed does not require prior claim per Section 3.3
        staticEvidence: [ev1, ev2],
        now,
      });

      expect(result.currentLevel).toBe('OBSERVED');
      expect(result.qualifyingFindingsCount).toBe(2);
      expect(result.totalRecencyWeight).toBeGreaterThanOrEqual(1.0);
      expect(result.supportingEvidenceIds).toContain(ev1.id);
      expect(result.supportingEvidenceIds).toContain(ev2.id);
      expect(result.nextAction).toContain('Take scenario assessment');
    });

    it('rejects OBSERVED if fewer than 2 qualifying findings exist', () => {
      const ev1 = createMockStaticEvidence({ commitDate: now.toISOString() });

      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1],
        now,
      });

      expect(result.currentLevel).toBe('CLAIMED');
      expect(result.missingRequirements.some((r) => r.includes('at least 2 qualifying static findings'))).toBe(true);
    });

    it('excludes evidence with UNCERTAIN or OTHER attribution from Observed', () => {
      const ev1 = createMockStaticEvidence({ attributionStatus: 'CONFIRMED' });
      const ev2 = createMockStaticEvidence({ attributionStatus: 'UNCERTAIN' }); // Not confirmed
      const ev3 = createMockStaticEvidence({ attributionStatus: 'OTHER' }); // Not confirmed

      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1, ev2, ev3],
        now,
      });

      expect(result.currentLevel).toBe('CLAIMED');
      expect(result.qualifyingFindingsCount).toBe(1); // Only ev1 qualifies
    });

    it('excludes evidence from repositories with BLOCKING anti-gaming flags', () => {
      const ev1 = createMockStaticEvidence({ hasBlockingFlag: true }); // e.g. unmodified fork
      const ev2 = createMockStaticEvidence({ hasBlockingFlag: true });

      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1, ev2],
        antiGamingFlags: [
          {
            repositoryId: 'repo-1',
            userId: 'user-1',
            flagType: 'UNMODIFIED_FORK',
            severity: 'BLOCKING',
            explanation: 'Fork with 0 confirmed lines',
            metricValue: 0,
            createdAt: now.toISOString(),
          },
        ],
        now,
      });

      expect(result.currentLevel).toBe('CLAIMED');
      expect(result.qualifyingFindingsCount).toBe(0);
      expect(result.limitations.some((l) => l.includes('BLOCKING anti-gaming flag'))).toBe(true);
    });

    it('drops below OBSERVED when static evidence decays below 1.0 weight (Recency Decay R12)', () => {
      // Half-life is 12 months. Two commits from 24 months ago:
      // Weight each = 0.5 ^ (24/12) = 0.5 ^ 2 = 0.25
      // Total weight = 0.25 + 0.25 = 0.50 < 1.0 threshold
      const date24MonthsAgo = new Date('2024-10-28T12:00:00Z').toISOString();
      const ev1 = createMockStaticEvidence({ commitDate: date24MonthsAgo });
      const ev2 = createMockStaticEvidence({ commitDate: date24MonthsAgo });

      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1, ev2],
        now,
      });

      expect(result.currentLevel).toBe('CLAIMED');
      expect(result.totalRecencyWeight).toBeLessThan(1.0);
      expect(result.missingRequirements.some((r) => r.includes('total recency weight >='))).toBe(true);
    });
  });

  describe('Level Transitions: Supported & Verified (R11)', () => {
    it('promotes to SUPPORTED when Observed holds and assessment passed within 12 months', () => {
      const ev1 = createMockStaticEvidence({ commitDate: now.toISOString() });
      const ev2 = createMockStaticEvidence({ commitDate: now.toISOString() });

      const assessmentDate = new Date('2026-08-15T10:00:00Z').toISOString(); // 2.5 months ago (<12m)
      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1, ev2],
        assessmentAttempts: [
          {
            id: 'attempt-1',
            skillSlug: 'rest-controller-design',
            score: 1.0,
            passed: true,
            completedAt: assessmentDate,
          },
        ],
        now,
      });

      expect(result.currentLevel).toBe('SUPPORTED');
      expect(result.reasons.some((r) => r.includes('Passed scenario-based assessment'))).toBe(true);
      expect(result.nextAction).toContain('Take practical coding challenge to advance to Verified.');
    });

    it('rejects SUPPORTED if assessment is older than 12 months (Assessment Expiry R12)', () => {
      const ev1 = createMockStaticEvidence({ commitDate: now.toISOString() });
      const ev2 = createMockStaticEvidence({ commitDate: now.toISOString() });

      const oldAssessmentDate = new Date('2025-09-01T10:00:00Z').toISOString(); // ~14 months ago (>12m)
      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1, ev2],
        assessmentAttempts: [
          {
            id: 'attempt-old',
            skillSlug: 'rest-controller-design',
            score: 1.0,
            passed: true,
            completedAt: oldAssessmentDate,
          },
        ],
        now,
      });

      expect(result.currentLevel).toBe('OBSERVED'); // Expired assessment drops back to Observed
    });

    it('promotes to VERIFIED when Supported holds and mapped challenge passed within 12 months', () => {
      const ev1 = createMockStaticEvidence({ commitDate: now.toISOString() });
      const ev2 = createMockStaticEvidence({ commitDate: now.toISOString() });

      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [ev1, ev2],
        assessmentAttempts: [
          {
            id: 'att-1',
            skillSlug: 'rest-controller-design',
            score: 0.67,
            passed: true,
            completedAt: new Date('2026-09-01T00:00:00Z').toISOString(),
          },
        ],
        challengeRuns: [
          {
            id: 'chal-1',
            challengeId: 'challenge-1',
            mappedSkills: ['rest-controller-design', 'jwt-issuance-validation'],
            passed: true,
            completedAt: new Date('2026-10-01T00:00:00Z').toISOString(),
          },
        ],
        now,
      });

      expect(result.currentLevel).toBe('VERIFIED');
      expect(result.reasons.some((r) => r.includes('Successfully completed practical coding challenge'))).toBe(true);
      expect(result.nextAction).toContain('Credential ready for issuance');
    });

    it('caps unit-tests-meaningful-assertions at SUPPORTED even if challenge run is supplied', () => {
      const ev1 = createMockStaticEvidence({ skillSlug: 'unit-tests-meaningful-assertions' });
      const ev2 = createMockStaticEvidence({ skillSlug: 'unit-tests-meaningful-assertions' });

      const result = evaluateSkillLevel({
        skillSlug: 'unit-tests-meaningful-assertions',
        isClaimed: true,
        staticEvidence: [ev1, ev2],
        assessmentAttempts: [
          {
            id: 'att-ut',
            skillSlug: 'unit-tests-meaningful-assertions',
            score: 1.0,
            passed: true,
            completedAt: now.toISOString(),
          },
        ],
        challengeRuns: [
          {
            id: 'chal-ut',
            challengeId: 'any-challenge',
            mappedSkills: ['unit-tests-meaningful-assertions'],
            passed: true,
            completedAt: now.toISOString(),
          },
        ],
        now,
      });

      expect(result.currentLevel).toBe('SUPPORTED');
      expect(result.limitations.some((l) => l.includes('Maximum verifiable level is Supported'))).toBe(true);
    });

    it('enforces cumulative requirement: cannot be Supported or Verified if Observed static evidence is missing', () => {
      // Assessment and challenge passed, but NO static evidence
      const result = evaluateSkillLevel({
        skillSlug: 'rest-controller-design',
        isClaimed: true,
        staticEvidence: [], // No static evidence!
        assessmentAttempts: [
          {
            id: 'att-1',
            skillSlug: 'rest-controller-design',
            score: 1.0,
            passed: true,
            completedAt: now.toISOString(),
          },
        ],
        challengeRuns: [
          {
            id: 'chal-1',
            challengeId: 'challenge-1',
            mappedSkills: ['rest-controller-design'],
            passed: true,
            completedAt: now.toISOString(),
          },
        ],
        now,
      });

      // Cumulative rule: each level requires all lower conditions to currently hold
      expect(result.currentLevel).toBe('CLAIMED');
    });
  });
});
