import {
  SkillLevel,
  AgreementMetrics,
  ConfusionMatrix,
} from '@skillproof/shared';

export interface RatingPair {
  platformLevel: SkillLevel;
  expertLevel: SkillLevel;
}

const LEVEL_INDEX: Record<SkillLevel, number> = {
  NONE: 0,
  CLAIMED: 1,
  OBSERVED: 2,
  SUPPORTED: 3,
  VERIFIED: 4,
};

const ORDERED_LEVELS: readonly SkillLevel[] = ['NONE', 'CLAIMED', 'OBSERVED', 'SUPPORTED', 'VERIFIED'] as const;
const K = ORDERED_LEVELS.length; // 5 categories

/**
 * Initializes an empty 5x5 confusion matrix
 */
function createEmptyConfusionMatrix(): ConfusionMatrix {
  const matrix = {} as ConfusionMatrix;
  for (const rowLevel of ORDERED_LEVELS) {
    matrix[rowLevel] = {
      NONE: 0,
      CLAIMED: 0,
      OBSERVED: 0,
      SUPPORTED: 0,
      VERIFIED: 0,
    };
  }
  return matrix;
}

/**
 * Round a floating-point number to specified decimal places
 */
function roundTo(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Computes inter-rater agreement between SkillProof automated levels and expert ratings.
 * Computes:
 * 1. Percentage Agreement (Exact matches / total pairs)
 * 2. Unweighted Cohen's Kappa (kappa)
 * 3. Linear Weighted Cohen's Kappa (penalizes distance linearly: |i - j| / (k - 1))
 * 4. Quadratic Weighted Cohen's Kappa (penalizes distance quadratically: (i - j)^2 / (k - 1)^2)
 * 5. Full 5x5 Confusion Matrix
 */
export function computeInterRaterAgreement(pairs: RatingPair[]): AgreementMetrics {
  const N = pairs.length;
  const confusionMatrix = createEmptyConfusionMatrix();

  if (N === 0) {
    return {
      totalPairs: 0,
      percentAgreement: 1.0,
      cohensKappa: 1.0,
      weightedKappaLinear: 1.0,
      weightedKappaQuadratic: 1.0,
      confusionMatrix,
    };
  }

  // Populate 5x5 confusion matrix (Rows = Platform, Columns = Expert)
  for (const pair of pairs) {
    const rowLevel: SkillLevel = pair.platformLevel in LEVEL_INDEX ? pair.platformLevel : 'NONE';
    const colLevel: SkillLevel = pair.expertLevel in LEVEL_INDEX ? pair.expertLevel : 'NONE';
    confusionMatrix[rowLevel][colLevel]++;
  }

  // Row and Column marginal sums
  const rowSums: number[] = new Array(K).fill(0);
  const colSums: number[] = new Array(K).fill(0);

  for (let i = 0; i < K; i++) {
    const rLevel = ORDERED_LEVELS[i]!;
    for (let j = 0; j < K; j++) {
      const cLevel = ORDERED_LEVELS[j]!;
      const count = confusionMatrix[rLevel][cLevel];
      rowSums[i] = (rowSums[i] ?? 0) + count;
      colSums[j] = (colSums[j] ?? 0) + count;
    }
  }

  // Exact agreement
  let exactMatches = 0;
  for (let i = 0; i < K; i++) {
    const level = ORDERED_LEVELS[i]!;
    exactMatches += confusionMatrix[level][level];
  }
  const percentAgreement = exactMatches / N;

  // Unweighted Cohen's Kappa
  const pObserved = percentAgreement;
  let pExpected = 0;
  for (let i = 0; i < K; i++) {
    const rSum = rowSums[i] ?? 0;
    const cSum = colSums[i] ?? 0;
    pExpected += (rSum / N) * (cSum / N);
  }

  let cohensKappa: number;
  if (Math.abs(1 - pExpected) < 1e-12) {
    cohensKappa = pObserved === 1.0 ? 1.0 : 0.0;
  } else {
    cohensKappa = (pObserved - pExpected) / (1 - pExpected);
  }

  // Weighted Kappa (Linear & Quadratic)
  // Linear weight: w_ij = 1 - (|i - j| / (K - 1))
  // Quadratic weight: w_ij = 1 - ((i - j)^2 / (K - 1)^2)
  const maxDistance = K - 1; // 4
  const maxDistanceSq = maxDistance * maxDistance; // 16

  let pObsLinear = 0;
  let pExpLinear = 0;
  let pObsQuad = 0;
  let pExpQuad = 0;

  for (let i = 0; i < K; i++) {
    const rLevel = ORDERED_LEVELS[i]!;
    const rSum = rowSums[i] ?? 0;
    for (let j = 0; j < K; j++) {
      const cLevel = ORDERED_LEVELS[j]!;
      const cSum = colSums[j] ?? 0;
      const count = confusionMatrix[rLevel][cLevel];
      const dist = Math.abs(i - j);
      const wLinear = 1 - dist / maxDistance;
      const wQuad = 1 - (dist * dist) / maxDistanceSq;

      const pActual = count / N;
      const pChance = (rSum / N) * (cSum / N);

      pObsLinear += wLinear * pActual;
      pExpLinear += wLinear * pChance;

      pObsQuad += wQuad * pActual;
      pExpQuad += wQuad * pChance;
    }
  }

  let weightedKappaLinear: number;
  if (Math.abs(1 - pExpLinear) < 1e-12) {
    weightedKappaLinear = pObsLinear === 1.0 ? 1.0 : 0.0;
  } else {
    weightedKappaLinear = (pObsLinear - pExpLinear) / (1 - pExpLinear);
  }

  let weightedKappaQuadratic: number;
  if (Math.abs(1 - pExpQuad) < 1e-12) {
    weightedKappaQuadratic = pObsQuad === 1.0 ? 1.0 : 0.0;
  } else {
    weightedKappaQuadratic = (pObsQuad - pExpQuad) / (1 - pExpQuad);
  }

  return {
    totalPairs: N,
    percentAgreement: roundTo(percentAgreement),
    cohensKappa: roundTo(cohensKappa),
    weightedKappaLinear: roundTo(weightedKappaLinear),
    weightedKappaQuadratic: roundTo(weightedKappaQuadratic),
    confusionMatrix,
  };
}
