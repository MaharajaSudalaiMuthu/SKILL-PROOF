import { AntiGamingFlagRecord } from '@skillproof/shared';
import { ReferenceFingerprint } from '../models/ReferenceFingerprint.js';
import { computeWinnowingFingerprints, computeContainment } from './winnowing.js';
import { config } from '../config/index.js';

export interface TutorialCheckInput {
  repositoryId: string;
  userId: string;
  javaFileSources: string[];
}

export async function checkTutorialSimilarity(
  input: TutorialCheckInput
): Promise<AntiGamingFlagRecord | null> {
  // Aggregate candidate fingerprints across all Java files in the repo
  const repoFingerprints = new Set<string>();
  for (const source of input.javaFileSources) {
    const fps = computeWinnowingFingerprints(source);
    for (const h of fps) {
      repoFingerprints.add(h);
    }
  }

  if (repoFingerprints.size === 0) {
    return null;
  }

  // Load reference project fingerprints from MongoDB
  const allRefDocs = await ReferenceFingerprint.find({});
  if (allRefDocs.length === 0) {
    return null;
  }

  // Group by project name
  const projects = new Map<string, Set<string>>();
  for (const doc of allRefDocs) {
    let set = projects.get(doc.projectName);
    if (!set) {
      set = new Set<string>();
      projects.set(doc.projectName, set);
    }
    set.add(doc.fingerprintHash);
  }

  const threshold = config.skillproof.antiGaming.tutorialSimilarityThreshold;
  let maxContainment = 0;
  let mostSimilarProject = '';

  for (const [projectName, refHashes] of projects.entries()) {
    const containment = computeContainment(repoFingerprints, refHashes);
    if (containment > maxContainment) {
      maxContainment = containment;
      mostSimilarProject = projectName;
    }
  }

  if (maxContainment >= threshold) {
    return {
      repositoryId: input.repositoryId,
      userId: input.userId,
      flagType: 'TUTORIAL_SIMILARITY',
      severity: 'BLOCKING',
      explanation: `High structural similarity of ${Math.round(
        maxContainment * 100
      )}% detected to reference project '${mostSimilarProject}'.`,
      metricValue: maxContainment,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}
