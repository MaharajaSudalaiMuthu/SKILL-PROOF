import {
  SkillEvaluationInput,
  SkillEvaluationResult,
  SkillLevel,
  SKILL_DEFINITIONS,
} from '@skillproof/shared';

const DEFAULT_HALF_LIFE_MONTHS = 12;
const DEFAULT_MIN_QUALIFYING_FINDINGS = 2;
const DEFAULT_MIN_RECENCY_WEIGHT = 1.0;
const DEFAULT_ASSESSMENT_VALIDITY_MONTHS = 12;
const DEFAULT_CHALLENGE_VALIDITY_MONTHS = 12;

export function evaluateSkillLevel(input: SkillEvaluationInput): SkillEvaluationResult {
  const {
    skillSlug,
    isClaimed,
    claimedAt,
    staticEvidence,
    assessmentAttempts = [],
    challengeRuns = [],
    antiGamingFlags = [],
    now = new Date(),
    config = {},
  } = input;

  const skillDef = SKILL_DEFINITIONS[skillSlug];
  const halfLifeMonths = config.recencyHalfLifeMonths ?? DEFAULT_HALF_LIFE_MONTHS;
  const minFindings = config.minQualifyingFindings ?? DEFAULT_MIN_QUALIFYING_FINDINGS;
  const minWeight = config.minRecencyWeight ?? DEFAULT_MIN_RECENCY_WEIGHT;
  const assessmentValidityMonths = config.assessmentValidityMonths ?? DEFAULT_ASSESSMENT_VALIDITY_MONTHS;
  const challengeValidityMonths = config.challengeValidityMonths ?? DEFAULT_CHALLENGE_VALIDITY_MONTHS;

  const reasons: string[] = [];
  const missingRequirements: string[] = [];
  const supportingEvidenceIds: string[] = [];
  const limitations: string[] = [];

  if (skillDef?.maxAttainableLevel === 'SUPPORTED') {
    limitations.push(
      'No practical coding challenge verifies unit testing. Maximum verifiable level is Supported.'
    );
  }

  // 1. Filter valid, non-blocking, CONFIRMED static evidence
  const validStaticEvidence = staticEvidence.filter((e) => {
    // Must be CONFIRMED attribution
    if (e.attributionStatus !== 'CONFIRMED') return false;
    // Must not be from a repository with BLOCKING flag
    if (e.hasBlockingFlag) return false;
    // Must have validityStatus VALID
    if (e.validityStatus !== 'VALID') return false;
    return true;
  });

  // Calculate dynamic recency weight from blame commit date
  let totalRecencyWeight = 0;
  for (const ev of validStaticEvidence) {
    const commitTime = new Date(ev.commitDate).getTime();
    const ageInMonths = Math.max(0, (now.getTime() - commitTime) / (1000 * 60 * 60 * 24 * 30.4375));
    const dynamicWeight = Math.pow(0.5, ageInMonths / halfLifeMonths);
    totalRecencyWeight += dynamicWeight;
  }
  totalRecencyWeight = Math.round(totalRecencyWeight * 100) / 100;

  const qualifyingFindingsCount = validStaticEvidence.length;

  // 2. Evaluate Observed Conditions
  const hasEnoughFindings = qualifyingFindingsCount >= minFindings;
  const hasEnoughWeight = totalRecencyWeight >= minWeight;
  const isObservedAchieved = hasEnoughFindings && hasEnoughWeight;

  // 3. Evaluate Supported Conditions (Requires Observed + Passed Assessment within 12 months)
  const validAssessments = assessmentAttempts.filter((a) => {
    if (!a.passed || a.skillSlug !== skillSlug) return false;
    const attemptTime = new Date(a.completedAt).getTime();
    const ageInMonths = (now.getTime() - attemptTime) / (1000 * 60 * 60 * 24 * 30.4375);
    return ageInMonths <= assessmentValidityMonths;
  });
  const hasValidAssessment = validAssessments.length > 0;
  const isSupportedAchieved = isObservedAchieved && hasValidAssessment;

  // 4. Evaluate Verified Conditions (Requires Supported + Passed Mapped Challenge within 12 months)
  const canAttainVerified = skillDef ? skillDef.maxAttainableLevel === 'VERIFIED' : true;
  const validChallenges = challengeRuns.filter((c) => {
    if (!c.passed || !c.mappedSkills.includes(skillSlug)) return false;
    const runTime = new Date(c.completedAt).getTime();
    const ageInMonths = (now.getTime() - runTime) / (1000 * 60 * 60 * 24 * 30.4375);
    return ageInMonths <= challengeValidityMonths;
  });
  const hasValidChallenge = validChallenges.length > 0;
  const isVerifiedAchieved = isSupportedAchieved && canAttainVerified && hasValidChallenge;

  // 5. Determine Current Level (Cumulative Evaluation)
  let currentLevel: SkillLevel = 'NONE';
  let awardedAt: string | null = null;
  let nextAction: string | null = null;

  if (isVerifiedAchieved) {
    currentLevel = 'VERIFIED';
    // Supporting evidence includes static evidence, assessment, and challenge
    validStaticEvidence.forEach((e) => supportingEvidenceIds.push(e.id));
    if (validAssessments[0]) supportingEvidenceIds.push(validAssessments[0].id);
    if (validChallenges[0]) supportingEvidenceIds.push(validChallenges[0].id);

    awardedAt = validChallenges[0]?.completedAt ?? now.toISOString();
    reasons.push(
      `Verified via ${qualifyingFindingsCount} observed static findings in repository code (recency weight ${totalRecencyWeight.toFixed(
        2
      )}).`,
      `Passed scenario-based assessment on ${new Date(validAssessments[0]!.completedAt).toLocaleDateString()}.`,
      `Successfully completed practical coding challenge in isolated sandbox on ${new Date(
        validChallenges[0]!.completedAt
      ).toLocaleDateString()}.`
    );
    nextAction = 'Credential ready for issuance and public sharing.';
  } else if (isSupportedAchieved) {
    currentLevel = 'SUPPORTED';
    validStaticEvidence.forEach((e) => supportingEvidenceIds.push(e.id));
    if (validAssessments[0]) supportingEvidenceIds.push(validAssessments[0].id);

    awardedAt = validAssessments[0]?.completedAt ?? now.toISOString();
    reasons.push(
      `Supported via ${qualifyingFindingsCount} observed static findings in repository code (recency weight ${totalRecencyWeight.toFixed(
        2
      )}).`,
      `Passed scenario-based assessment on ${new Date(validAssessments[0]!.completedAt).toLocaleDateString()}.`
    );

    if (canAttainVerified) {
      missingRequirements.push(
        'Complete and pass the mapped offline coding challenge in the isolated sandbox environment.'
      );
      nextAction = 'Take practical coding challenge to advance to Verified.';
    } else {
      nextAction = 'Maximum attainable level (Supported) reached for this capability.';
    }
  } else if (isObservedAchieved) {
    currentLevel = 'OBSERVED';
    validStaticEvidence.forEach((e) => supportingEvidenceIds.push(e.id));
    awardedAt = validStaticEvidence[0]?.commitDate ?? now.toISOString();

    reasons.push(
      `Observed via ${qualifyingFindingsCount} qualifying AST pattern matches with CONFIRMED line authorship.`,
      `Cumulative recency weight is ${totalRecencyWeight.toFixed(2)} (threshold >= ${minWeight.toFixed(1)}).`
    );
    missingRequirements.push(
      `Pass the 3-question scenario assessment with score >= 66% (valid for ${assessmentValidityMonths} months).`
    );
    nextAction = 'Take scenario assessment to advance to Supported.';
  } else if (isClaimed) {
    currentLevel = 'CLAIMED';
    awardedAt = claimedAt ?? now.toISOString();
    reasons.push(`Developer self-declared claim for ${skillDef?.name ?? skillSlug}.`);

    if (qualifyingFindingsCount < minFindings) {
      missingRequirements.push(
        `Requires at least ${minFindings} qualifying static findings with CONFIRMED authorship (currently ${qualifyingFindingsCount}).`
      );
    }
    if (totalRecencyWeight < minWeight) {
      missingRequirements.push(
        `Requires total recency weight >= ${minWeight.toFixed(1)} (currently ${totalRecencyWeight.toFixed(2)}).`
      );
    }
    nextAction = 'Import and analyze a public GitHub repository containing implementation code.';
  } else {
    currentLevel = 'NONE';
    awardedAt = null;
    missingRequirements.push('Declare skill claim or import a repository implementing this capability.');
    nextAction = 'Declare skill claim or import repository.';
  }

  // Check if anti-gaming flags impact this skill
  const blockingFlags = antiGamingFlags.filter((f) => f.severity === 'BLOCKING');
  if (blockingFlags.length > 0) {
    limitations.push(
      `${blockingFlags.length} BLOCKING anti-gaming flag(s) present on analyzed repositories; evidence from flagged repositories is excluded.`
    );
  }

  const warningFlags = antiGamingFlags.filter((f) => f.severity === 'WARNING');
  if (warningFlags.length > 0) {
    limitations.push(
      `${warningFlags.length} WARNING anti-gaming flag(s) noted on repository (visible on profile).`
    );
  }

  return {
    skillSlug,
    currentLevel,
    awardedAt,
    reasons,
    supportingEvidenceIds,
    missingRequirements,
    totalRecencyWeight,
    qualifyingFindingsCount,
    limitations,
    nextAction,
  };
}
