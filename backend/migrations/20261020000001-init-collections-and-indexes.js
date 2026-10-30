/**
 * Baseline Migration: Collections and Indexes initialization for SkillProof
 */
export const up = async (db, client) => {
  // 1. Users
  await db.createCollection('users').catch(() => {});
  await db.collection('users').createIndex({ githubUserId: 1 }, { unique: true });
  await db.collection('users').createIndex({ githubLogin: 1 }, { unique: true });

  // 2. Consents
  await db.createCollection('consents').catch(() => {});
  await db.collection('consents').createIndex({ userId: 1 });

  // 3. Skills & Claims
  await db.createCollection('skills').catch(() => {});
  await db.collection('skills').createIndex({ slug: 1 }, { unique: true });

  await db.createCollection('userSkillClaims').catch(() => {});
  await db.collection('userSkillClaims').createIndex({ userId: 1, skillSlug: 1 }, { unique: true });

  // 4. Repositories & Ingestion Jobs
  await db.createCollection('repositories').catch(() => {});
  await db.collection('repositories').createIndex({ userId: 1, githubRepoId: 1 }, { unique: true });
  await db.collection('repositories').createIndex({ userId: 1 });

  await db.createCollection('analysisJobs').catch(() => {});
  await db.collection('analysisJobs').createIndex({ repositoryId: 1 });
  await db.collection('analysisJobs').createIndex({ userId: 1 });
  await db.collection('analysisJobs').createIndex({ status: 1 });

  // 5. File Attributions
  await db.createCollection('fileAttributions').catch(() => {});
  await db.collection('fileAttributions').createIndex({ analysisJobId: 1 });
  await db.collection('fileAttributions').createIndex({ userId: 1 });

  // 6. Evidence Records
  await db.createCollection('evidenceRecords').catch(() => {});
  await db.collection('evidenceRecords').createIndex({ dedupeKey: 1 }, { unique: true });
  await db.collection('evidenceRecords').createIndex({ userId: 1, skillSlug: 1, validityStatus: 1 });

  // 7. Anti-Gaming Flags & Reference Fingerprints
  await db.createCollection('antiGamingFlags').catch(() => {});
  await db.collection('antiGamingFlags').createIndex({ repositoryId: 1 });
  await db.collection('antiGamingFlags').createIndex({ userId: 1 });

  await db.createCollection('referenceFingerprints').catch(() => {});
  await db.collection('referenceFingerprints').createIndex({ fingerprintHash: 1 });

  // 8. Assessments
  await db.createCollection('assessmentQuestions').catch(() => {});
  await db.collection('assessmentQuestions').createIndex({ skillSlug: 1 });

  await db.createCollection('assessmentAttempts').catch(() => {});
  await db.collection('assessmentAttempts').createIndex({ userId: 1, skillSlug: 1 });

  // 9. Challenges & Sandbox Runs
  await db.createCollection('challenges').catch(() => {});
  await db.collection('challenges').createIndex({ slug: 1 }, { unique: true });

  await db.createCollection('sandboxRuns').catch(() => {});
  await db.collection('sandboxRuns').createIndex({ userId: 1 });
  await db.collection('sandboxRuns').createIndex({ challengeSlug: 1 });

  // 10. Snapshots, Credentials & Shares
  await db.createCollection('skillLevelSnapshots').catch(() => {});
  await db.collection('skillLevelSnapshots').createIndex({ userId: 1, skillSlug: 1, evaluatedAt: -1 });

  await db.createCollection('credentials').catch(() => {});
  await db.collection('credentials').createIndex({ userId: 1 });
  await db.collection('credentials').createIndex({ skillSlug: 1 });

  await db.createCollection('shareGrants').catch(() => {});
  await db.collection('shareGrants').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('shareGrants').createIndex({ userId: 1 });

  // 11. Deletion Requests & Audit Entries
  await db.createCollection('deletionRequests').catch(() => {});
  await db.collection('deletionRequests').createIndex({ userId: 1 });

  await db.createCollection('auditEntries').catch(() => {});
  await db.collection('auditEntries').createIndex({ userId: 1 });
  await db.collection('auditEntries').createIndex({ timestamp: -1 });
};

export const down = async (db, client) => {
  const collections = [
    'users',
    'consents',
    'skills',
    'userSkillClaims',
    'repositories',
    'analysisJobs',
    'fileAttributions',
    'evidenceRecords',
    'antiGamingFlags',
    'referenceFingerprints',
    'assessmentQuestions',
    'assessmentAttempts',
    'challenges',
    'sandboxRuns',
    'skillLevelSnapshots',
    'credentials',
    'shareGrants',
    'deletionRequests',
    'auditEntries',
  ];

  for (const col of collections) {
    await db.collection(col).drop().catch(() => {});
  }
};
