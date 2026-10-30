import { describe, it, expect } from 'vitest';
import { computeInterRaterAgreement, RatingPair } from '../../src/evaluation/agreementService.js';
import { parseExpertRatingCsv } from '../../src/scripts/computeAgreement.js';

describe('Pilot Evaluation Agreement Service (R26)', () => {
  describe('1. Perfect Agreement Cases', () => {
    it('returns kappa = 1.0, linear kappa = 1.0, and 100% agreement when all ratings match', () => {
      const pairs: RatingPair[] = [
        { platformLevel: 'NONE', expertLevel: 'NONE' },
        { platformLevel: 'CLAIMED', expertLevel: 'CLAIMED' },
        { platformLevel: 'OBSERVED', expertLevel: 'OBSERVED' },
        { platformLevel: 'SUPPORTED', expertLevel: 'SUPPORTED' },
        { platformLevel: 'VERIFIED', expertLevel: 'VERIFIED' },
      ];

      const metrics = computeInterRaterAgreement(pairs);
      expect(metrics.totalPairs).toBe(5);
      expect(metrics.percentAgreement).toBe(1.0);
      expect(metrics.cohensKappa).toBe(1.0);
      expect(metrics.weightedKappaLinear).toBe(1.0);
      expect(metrics.weightedKappaQuadratic).toBe(1.0);

      // Check confusion matrix diagonal
      expect(metrics.confusionMatrix.NONE.NONE).toBe(1);
      expect(metrics.confusionMatrix.CLAIMED.CLAIMED).toBe(1);
      expect(metrics.confusionMatrix.OBSERVED.OBSERVED).toBe(1);
      expect(metrics.confusionMatrix.SUPPORTED.SUPPORTED).toBe(1);
      expect(metrics.confusionMatrix.VERIFIED.VERIFIED).toBe(1);
      expect(metrics.confusionMatrix.NONE.VERIFIED).toBe(0);
    });

    it('gracefully handles empty ratings without dividing by zero', () => {
      const metrics = computeInterRaterAgreement([]);
      expect(metrics.totalPairs).toBe(0);
      expect(metrics.percentAgreement).toBe(1.0);
      expect(metrics.cohensKappa).toBe(1.0);
      expect(metrics.weightedKappaLinear).toBe(1.0);
    });
  });

  describe('2. Weighted Kappa & Distance Sensitivity', () => {
    it('penalizes adjacent level differences less than distant differences', () => {
      // Set 1: Adjacent differences (distance 1: OBSERVED vs SUPPORTED)
      const adjacentPairs: RatingPair[] = [
        { platformLevel: 'OBSERVED', expertLevel: 'SUPPORTED' },
        { platformLevel: 'SUPPORTED', expertLevel: 'OBSERVED' },
        { platformLevel: 'CLAIMED', expertLevel: 'OBSERVED' },
        { platformLevel: 'SUPPORTED', expertLevel: 'VERIFIED' },
      ];

      // Set 2: Distant differences (distance 4: NONE vs VERIFIED)
      const distantPairs: RatingPair[] = [
        { platformLevel: 'NONE', expertLevel: 'VERIFIED' },
        { platformLevel: 'VERIFIED', expertLevel: 'NONE' },
        { platformLevel: 'NONE', expertLevel: 'VERIFIED' },
        { platformLevel: 'VERIFIED', expertLevel: 'NONE' },
      ];

      const adjacentMetrics = computeInterRaterAgreement(adjacentPairs);
      const distantMetrics = computeInterRaterAgreement(distantPairs);

      // Both have 0% exact agreement
      expect(adjacentMetrics.percentAgreement).toBe(0);
      expect(distantMetrics.percentAgreement).toBe(0);

      // But weighted kappa for adjacent differences is substantially higher than distant
      expect(adjacentMetrics.weightedKappaLinear).toBeGreaterThan(distantMetrics.weightedKappaLinear);
      expect(adjacentMetrics.weightedKappaQuadratic).toBeGreaterThan(distantMetrics.weightedKappaQuadratic);
    });

    it('calculates substantial agreement (kappa > 0.6) on realistic mixed dataset', () => {
      // 10 pairs: 8 exact matches, 2 adjacent 1-step differences
      const realisticPairs: RatingPair[] = [
        { platformLevel: 'OBSERVED', expertLevel: 'OBSERVED' },
        { platformLevel: 'SUPPORTED', expertLevel: 'SUPPORTED' },
        { platformLevel: 'VERIFIED', expertLevel: 'VERIFIED' },
        { platformLevel: 'CLAIMED', expertLevel: 'CLAIMED' },
        { platformLevel: 'NONE', expertLevel: 'NONE' },
        { platformLevel: 'OBSERVED', expertLevel: 'OBSERVED' },
        { platformLevel: 'SUPPORTED', expertLevel: 'SUPPORTED' },
        { platformLevel: 'VERIFIED', expertLevel: 'VERIFIED' },
        { platformLevel: 'SUPPORTED', expertLevel: 'OBSERVED' }, // 1-step off
        { platformLevel: 'OBSERVED', expertLevel: 'SUPPORTED' }, // 1-step off
      ];

      const metrics = computeInterRaterAgreement(realisticPairs);
      expect(metrics.totalPairs).toBe(10);
      expect(metrics.percentAgreement).toBe(0.8);
      expect(metrics.cohensKappa).toBeGreaterThan(0.6); // Substantial agreement
      expect(metrics.weightedKappaLinear).toBeGreaterThan(0.7);
      expect(metrics.weightedKappaQuadratic).toBeGreaterThan(0.7);
    });

    it('correctly reports negative kappa for systematic inverse disagreement', () => {
      // Systematic inverse: When platform says VERIFIED, expert says NONE and vice versa
      const inversePairs: RatingPair[] = [
        { platformLevel: 'VERIFIED', expertLevel: 'NONE' },
        { platformLevel: 'NONE', expertLevel: 'VERIFIED' },
        { platformLevel: 'VERIFIED', expertLevel: 'NONE' },
        { platformLevel: 'NONE', expertLevel: 'VERIFIED' },
      ];

      const metrics = computeInterRaterAgreement(inversePairs);
      expect(metrics.percentAgreement).toBe(0);
      expect(metrics.cohensKappa).toBeLessThanOrEqual(0);
    });
  });

  describe('3. CSV Parser for Expert Ratings', () => {
    it('successfully parses formatted CSV lines and skips header', () => {
      const csv = `
subject_id,skill_slug,expert_level,confidence_1_to_5,notes
SUBJ_001,rest-controller-design,OBSERVED,5,Valid rest controller
SUBJ_001,jpa-hibernate-persistence,SUPPORTED,4,Good assessment
SUBJ_002,spring-security-configuration,VERIFIED,5,Challenge passed
`;
      const entries = parseExpertRatingCsv(csv);
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        subjectId: 'SUBJ_001',
        skillSlug: 'rest-controller-design',
        expertLevel: 'OBSERVED',
        confidence: 5,
        notes: 'Valid rest controller',
      });
      expect(entries[1].skillSlug).toBe('jpa-hibernate-persistence');
      expect(entries[1].expertLevel).toBe('SUPPORTED');
      expect(entries[2].subjectId).toBe('SUBJ_002');
      expect(entries[2].expertLevel).toBe('VERIFIED');
    });

    it('returns empty array when CSV is blank', () => {
      expect(parseExpertRatingCsv('')).toEqual([]);
      expect(parseExpertRatingCsv('   \n  \n  ')).toEqual([]);
    });
  });
});
