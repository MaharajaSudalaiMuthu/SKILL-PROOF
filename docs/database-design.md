# SkillProof Database Design Document (MongoDB / Mongoose)

## 1. Principles & Design Rules

The SkillProof database schema is built on MongoDB using Mongoose with strict schema validation:
- **Replica Set & Transactions**: MongoDB runs as a single-node replica set (`rs0`) in Docker Compose to enable multi-document ACID transactions for multi-collection operations (such as level snapshot recomputations, credential status updates, and privacy deletion).
- **Temporal Standards**: All timestamps are ISO 8601 UTC dates (`Date` objects in Mongoose).
- **Embedding vs. Referencing**:
  - **Embedded**: Data that is strictly bounded in size and always queried/mutated together (e.g. assessment question options, assessment attempt responses, attributed line ranges per file document).
  - **Referenced**: Unbounded or independently accessed data (users, repositories, analysis jobs, evidence records, credentials, share grants).
- **Index Management via `migrate-mongo`**: All unique, compound, and search indexes are version-controlled and applied idempotently via `migrate-mongo` migrations in `backend/migrations/`.
- **Security & NoSQL Injection Protection**: Schemas enforce `strict: true` and `sanitizeFilter: true`. All query inputs are validated with Zod before reaching Mongoose queries.

---

## 2. Collection Specifications & Mongoose Schemas

### 2.1 Users (`users`)
- `_id`: ObjectId
- `githubUserId`: Number (Required, Unique index)
- `githubLogin`: String (Required, Unique index, lowercase)
- `name`: String
- `avatarUrl`: String
- `encryptedAccessToken`: String (Required, hex encoded AES-256-GCM ciphertext)
- `tokenIv`: String (Required, 24-char hex string)
- `tokenAuthTag`: String (Required, 32-char hex string)
- `createdAt`: Date
- `updatedAt`: Date

### 2.2 Consents (`consents`)
- `_id`: ObjectId
- `userId`: ObjectId (Ref: `users`, Required, Index)
- `consentVersion`: String (Required)
- `agreedAt`: Date (Required)
- `ipHash`: String (SHA-256 hashed IP for audit)

### 2.3 Skills (`skills`) & Claims (`userSkillClaims`)
- **`skills`** (Reference catalog of 8 capabilities):
  - `_id`: ObjectId
  - `slug`: String (Required, Unique index) - *e.g., `rest-controller-design`*
  - `name`: String (Required)
  - `description`: String (Required)
  - `displayOrder`: Number (Required)
- **`userSkillClaims`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required)
  - `skillSlug`: String (Required)
  - `claimedAt`: Date (Required)
  - *Compound unique index*: `{ userId: 1, skillSlug: 1 }`

### 2.4 Repositories (`repositories`) & Analysis Jobs (`analysisJobs`)
- **`repositories`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required)
  - `githubRepoId`: Number (Required)
  - `fullName`: String (Required) - *e.g., `octocat/hello-world`*
  - `cloneUrl`: String (Required)
  - `isFork`: Boolean (Required)
  - `defaultBranch`: String (Required)
  - `createdAt`: Date
  - *Compound unique index*: `{ userId: 1, githubRepoId: 1 }`
- **`analysisJobs`**:
  - `_id`: ObjectId
  - `repositoryId`: ObjectId (Ref: `repositories`, Required, Index)
  - `userId`: ObjectId (Ref: `users`, Required, Index)
  - `status`: String (Enum: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`)
  - `progressPercent`: Number (0-100)
  - `errorMessage`: String
  - `startedAt`: Date
  - `completedAt`: Date
  - `createdAt`: Date

### 2.5 File Attributions (`fileAttributions`)
One document per analysed `.java` file, containing embedded attributed line ranges (bounded per file):
- `_id`: ObjectId
- `analysisJobId`: ObjectId (Ref: `analysisJobs`, Required, Index)
- `userId`: ObjectId (Ref: `users`, Required)
- `filePath`: String (Required)
- `ranges`: Array of embedded objects:
  - `startLine`: Number (Required)
  - `endLine`: Number (Required)
  - `commitSha`: String (Required)
  - `commitDate`: Date (Required)
  - `authorLogin`: String
  - `status`: String (Enum: `CONFIRMED`, `UNCERTAIN`, `OTHER`, Required)

### 2.6 Evidence Records (`evidenceRecords`)
- `_id`: ObjectId
- `userId`: ObjectId (Ref: `users`, Required, Index)
- `skillSlug`: String (Required, Index)
- `evidenceType`: String (Enum: `STATIC`, `ASSESSMENT`, `CHALLENGE`, Required)
- `validityStatus`: String (Enum: `VALID`, `EXPIRED`, `SUPERSEDED`, `EXCLUDED`, Required)
- `attributionStatus`: String (Enum: `CONFIRMED`, `UNCERTAIN`, `OTHER`, Required)
- `repositoryId`: ObjectId (Ref: `repositories`)
- `filePath`: String
- `startLine`: Number
- `endLine`: Number
- `commitSha`: String
- `commitDate`: Date
- `detectorName`: String
- `matchedPattern`: String
- `dedupeKey`: String (Required, Unique index)
- `rawDetails`: Object
- `recencyWeight`: Number (Default 1.0)
- `createdAt`: Date
- *Compound index*: `{ userId: 1, skillSlug: 1, validityStatus: 1 }`

### 2.7 Anti-Gaming Flags (`antiGamingFlags`) & Reference Fingerprints (`referenceFingerprints`)
- **`antiGamingFlags`**:
  - `_id`: ObjectId
  - `repositoryId`: ObjectId (Ref: `repositories`, Required, Index)
  - `userId`: ObjectId (Ref: `users`, Required)
  - `flagType`: String (Enum: `UNMODIFIED_FORK`, `TUTORIAL_SIMILARITY`, `LARGE_INITIAL_COMMIT`)
  - `severity`: String (Enum: `BLOCKING`, `WARNING`, Required)
  - `explanation`: String (Required)
  - `metricValue`: Number (Required)
  - `createdAt`: Date
- **`referenceFingerprints`**:
  - `_id`: ObjectId
  - `projectName`: String (Required)
  - `commitSha`: String (Required)
  - `fingerprintHash`: String (Required, Index)

### 2.8 Assessments (`assessmentQuestions`, `assessmentAttempts`)
- **`assessmentQuestions`**:
  - `_id`: ObjectId
  - `skillSlug`: String (Required, Index)
  - `questionText`: String (Required)
  - `explanation`: String (Required)
  - `difficulty`: String (Enum: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`)
  - `version`: Number (Default 1)
  - `options`: Array of embedded objects:
    - `_id`: ObjectId
    - `optionText`: String (Required)
    - `isCorrect`: Boolean (Required)
- **`assessmentAttempts`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required, Index)
  - `skillSlug`: String (Required, Index)
  - `score`: Number (Required)
  - `passed`: Boolean (Required)
  - `responses`: Array of embedded objects:
    - `questionId`: ObjectId (Required)
    - `selectedOptionId`: ObjectId (Required)
    - `isCorrect`: Boolean (Required)
  - `completedAt`: Date (Required)

### 2.9 Challenges (`challenges`) & Sandbox Runs (`sandboxRuns`)
- **`challenges`**:
  - `_id`: ObjectId
  - `slug`: String (Required, Unique index)
  - `title`: String (Required)
  - `description`: String (Required)
  - `timeLimitSeconds`: Number (Required)
  - `mappedSkills`: [String] (Required)
- **`sandboxRuns`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required, Index)
  - `challengeSlug`: String (Required)
  - `passed`: Boolean (Required)
  - `durationMs`: Number (Required)
  - `sanitizedOutput`: String
  - `createdAt`: Date

### 2.10 Snapshots, Credentials & Shares
- **`skillLevelSnapshots`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required)
  - `skillSlug`: String (Required)
  - `currentLevel`: String (Enum: `NONE`, `CLAIMED`, `OBSERVED`, `SUPPORTED`, `VERIFIED`, Required)
  - `reasons`: [String] (Required)
  - `missingRequirements`: [String]
  - `supportingEvidenceIds`: [ObjectId]
  - `evaluatedAt`: Date (Required)
  - *Compound index*: `{ userId: 1, skillSlug: 1, evaluatedAt: -1 }`
- **`credentials`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required, Index)
  - `skillSlug`: String (Required, Index)
  - `awardedLevel`: String (Required)
  - `status`: String (Enum: `ACTIVE`, `REVOKED`, `EXPIRED`, `SUPERSEDED`, Required)
  - `canonicalPayload`: String (Required, RFC 8785 canonical JSON)
  - `signatureBase64Url`: String (Required)
  - `issuedAt`: Date (Required)
  - `validUntil`: Date (Required)
- **`shareGrants`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Ref: `users`, Required)
  - `skillSlug`: String (Required)
  - `tokenHash`: String (Required, Unique index, SHA-256)
  - `expiresAt`: Date (Required)
  - `isRevoked`: Boolean (Default false)
  - `createdAt`: Date
- **`deletionRequests`**:
  - `_id`: ObjectId
  - `userId`: ObjectId (Required)
  - `requestType`: String (Enum: `ANALYSIS_DATA`, `FULL_ACCOUNT`, Required)
  - `executedAt`: Date (Required)
- **`auditEntries`**:
  - `_id`: ObjectId
  - `userId`: ObjectId
  - `action`: String (Required)
  - `details`: Object
  - `ipHash`: String
  - `timestamp`: Date (Required)

---

## 3. Deliberate Denormalization Notes

1. **`supportingEvidenceIds` in `skillLevelSnapshots`**: Point-in-time array of Evidence IDs stored directly to freeze audit trails against future evidence changes.
2. **`canonicalPayload` in `credentials`**: Preserves the exact serialized string signed by Ed25519, ensuring byte-identical verification.
3. **`mappedSkills` array in `challenges`**: Kept embedded in the challenge document for atomic reading during challenge selection and verification grading.
