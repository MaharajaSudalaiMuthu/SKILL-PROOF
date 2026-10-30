import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { ExpertRatingEntry, SkillLevel } from '@skillproof/shared';
import { config } from '../config/index.js';
import { exportPseudonymizedEvaluationData } from '../evaluation/exportService.js';
import { computeInterRaterAgreement, RatingPair } from '../evaluation/agreementService.js';

/**
 * Parses simple CSV content: subject_id,skill_slug,expert_level,confidence,notes
 */
export function parseExpertRatingCsv(csvContent: string): ExpertRatingEntry[] {
  const lines = csvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const startIndex = firstLine && firstLine.toLowerCase().startsWith('subject') ? 1 : 0;
  const entries: ExpertRatingEntry[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim());
    const subjectId = parts[0];
    const skillSlug = parts[1];
    const expertLevelRaw = parts[2];
    if (subjectId && skillSlug && expertLevelRaw) {
      entries.push({
        subjectId,
        skillSlug: skillSlug as any,
        expertLevel: expertLevelRaw.toUpperCase() as SkillLevel,
        confidence: parts[3] ? Number(parts[3]) : undefined,
        notes: parts[4] || undefined,
      });
    }
  }

  return entries;
}

async function main() {
  const inputFilePath = process.argv[2];
  if (!inputFilePath) {
    console.error('Usage: tsx src/scripts/computeAgreement.ts <path-to-ratings.csv|json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(process.cwd(), inputFilePath), 'utf-8');
  let ratings: ExpertRatingEntry[] = [];

  if (inputFilePath.endsWith('.json')) {
    ratings = JSON.parse(raw);
  } else {
    ratings = parseExpertRatingCsv(raw);
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || config.env.MONGODB_URI);
  }

  const exportPayload = await exportPseudonymizedEvaluationData();
  const platformMap = new Map<string, string>();
  for (const rec of exportPayload.records) {
    platformMap.set(`${rec.subjectId}:${rec.skillSlug}`, rec.platformLevel);
  }

  const pairs: RatingPair[] = [];
  for (const rating of ratings) {
    const key = `${rating.subjectId}:${rating.skillSlug}`;
    const platformLevel = (platformMap.get(key) || 'NONE') as SkillLevel;
    pairs.push({
      platformLevel,
      expertLevel: rating.expertLevel,
    });
  }

  const metrics = computeInterRaterAgreement(pairs);

  console.log('\n======================================================');
  console.log('SKILLPROOF PILOT EVALUATION — INTER-RATER AGREEMENT');
  console.log('======================================================');
  console.log(`Total Evaluated Skill Pairs: ${metrics.totalPairs}`);
  console.log(`Exact Percentage Agreement:  ${(metrics.percentAgreement * 100).toFixed(2)}%`);
  console.log(`Cohen's Kappa (Unweighted):  ${metrics.cohensKappa.toFixed(4)}`);
  console.log(`Linear Weighted Kappa:       ${metrics.weightedKappaLinear.toFixed(4)}`);
  console.log(`Quadratic Weighted Kappa:    ${metrics.weightedKappaQuadratic.toFixed(4)}`);
  console.log('------------------------------------------------------');
  console.log('Confusion Matrix (Rows: Platform, Columns: Expert):');
  console.log('------------------------------------------------------');
  console.table(metrics.confusionMatrix);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

if (process.argv[1]?.endsWith('computeAgreement.ts') || process.argv[1]?.endsWith('computeAgreement.js')) {
  main().catch((err) => {
    console.error('Agreement calculation failed:', err);
    process.exit(1);
  });
}
