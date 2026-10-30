import { describe, it, expect } from 'vitest';
import { CANONICAL_CHALLENGES } from '../../src/seeds/seedChallenges.js';
import { CANONICAL_SKILLS, SKILL_SLUGS, SkillSlug } from '@skillproof/shared';

describe('Canonical Challenge Catalog Definitions (R9, R10)', () => {
  it('contains exactly the 3 required practical coding challenges', () => {
    expect(CANONICAL_CHALLENGES).toHaveLength(3);
    const slugs = CANONICAL_CHALLENGES.map((c) => c.slug);
    expect(slugs).toContain('rest-api-secure-vault');
    expect(slugs).toContain('order-persistence-engine');
    expect(slugs).toContain('enterprise-account-service');
  });

  it('each challenge has title, instructions, time limit, starter files, and hidden tests', () => {
    for (const c of CANONICAL_CHALLENGES) {
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.instructions).toBeTruthy();
      expect(c.instructions!.length).toBeGreaterThan(100);
      expect(c.timeLimitMinutes).toBeGreaterThanOrEqual(30);

      expect(c.starterFiles).toBeDefined();
      expect(c.starterFiles!.length).toBeGreaterThan(0);
      for (const file of c.starterFiles!) {
        expect(file.path).toMatch(/\.java$/);
        expect(file.content.length).toBeGreaterThan(20);
      }

      expect(c.hiddenTestFiles).toBeDefined();
      expect(c.hiddenTestFiles!.length).toBeGreaterThan(0);
      for (const testFile of c.hiddenTestFiles!) {
        expect(testFile.path).toMatch(/Test\.java$/);
        expect(testFile.content).toContain('SKILLPROOF_TEST_SUMMARY:');
        expect(testFile.content).toContain('public static void main');
      }
    }
  });

  it('maps all 7 verifiable skills and excludes unit-tests-meaningful-assertions (R11 cap)', () => {
    const allMappedSkills = new Set<SkillSlug>();
    for (const c of CANONICAL_CHALLENGES) {
      for (const s of c.mappedSkills!) {
        allMappedSkills.add(s as SkillSlug);
      }
    }

    // unit-tests-meaningful-assertions is capped at SUPPORTED per R11
    expect(allMappedSkills.has('unit-tests-meaningful-assertions')).toBe(false);

    // The other 7 skills must each be mapped to at least one challenge
    const expectedVerifiableSkills: SkillSlug[] = [
      'rest-controller-design',
      'jpa-hibernate-persistence',
      'transaction-management',
      'structured-exception-handling',
      'spring-security-configuration',
      'jwt-issuance-validation',
      'input-validation',
    ];

    for (const skill of expectedVerifiableSkills) {
      expect(allMappedSkills.has(skill)).toBe(true);
    }
  });

  it('ensures each challenge mapped skills are valid canonical skill slugs', () => {
    for (const c of CANONICAL_CHALLENGES) {
      expect(c.mappedSkills!.length).toBeGreaterThan(0);
      for (const s of c.mappedSkills!) {
        expect(SKILL_SLUGS).toContain(s);
      }
    }
  });
});
