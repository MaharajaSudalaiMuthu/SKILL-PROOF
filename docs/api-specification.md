# SkillProof REST API Specification

This document details the public and authenticated REST endpoints exposed by the SkillProof Express + TypeScript backend under the `/api` route prefix. In addition to this document, live interactive OpenAPI 3.0 documentation is served at `/api/docs` generated dynamically from Zod schemas.

---

## 1. Global Standards & Conventions

### 1.1 Authentication & Security
- **Authentication**: Session established via HttpOnly, SameSite=Lax (Secure in production) cookie named `SKILLPROOF_SESSION`.
- **CSRF Protection**: State-changing requests (`POST`, `PUT`, `DELETE`) require the `X-XSRF-TOKEN` header matching the cookie value.
- **Data Isolation**: All operations access and manipulate data exclusively belonging to the authenticated principal.

### 1.2 Error Response Format
All errors return standard HTTP status codes with a consistent JSON envelope:
```json
{
  "timestamp": "2026-10-20T12:00:00Z",
  "status": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed for field 'skillSlug': must not be blank",
  "path": "/api/skills/claims"
}
```
*Note: Stack traces, internal file paths, tokens, and hidden tests are never exposed in responses or logs.*

---

## 2. API Endpoints Catalog

### 2.1 Authentication & Session
- `GET /api/auth/me`
  - **Auth**: Required
  - **Description**: Returns the authenticated user's profile (`id`, `githubLogin`, `name`, `avatarUrl`, `consentGiven`).
- `POST /api/auth/logout`
  - **Auth**: Required
  - **Description**: Invalidates the application session and clears the authentication cookie.

### 2.2 Consent & User Management
- `GET /api/user/consent`
  - **Auth**: Required
  - **Description**: Checks current consent version and agreement timestamp.
- `POST /api/user/consent`
  - **Auth**: Required
  - **Description**: Records explicit consent for repository analysis and data processing.
  - **Body**: `{ "consentVersion": "1.0", "agree": true }`

### 2.3 Repositories & Ingestion Jobs
- `GET /api/repositories/github`
  - **Auth**: Required
  - **Description**: Lists public repositories owned by the user fetched directly from the GitHub API.
- `POST /api/repositories/select`
  - **Auth**: Required
  - **Description**: Adds selected public repository to SkillProof for analysis.
  - **Body**: `{ "githubRepoId": 123456, "fullName": "octocat/hello-world", "cloneUrl": "https://github.com/octocat/hello-world.git", "isFork": false, "defaultBranch": "main" }`
- `POST /api/repositories/{id}/analyze`
  - **Auth**: Required
  - **Description**: Dispatches an asynchronous ingestion and analysis job.
  - **Response**: `{ "jobId": "uuid", "status": "QUEUED" }`
- `GET /api/analysis/{jobId}`
  - **Auth**: Required
  - **Description**: Polls status, progress percentage, and error messages of an analysis job.

### 2.4 Skills, Claims & Evidence
- `GET /api/skills`
  - **Auth**: Required
  - **Description**: Lists the 8 canonical skills, their descriptions, user claims, and current evidence levels.
- `POST /api/skills/claims`
  - **Auth**: Required
  - **Description**: Declares a self-reported claim on a skill.
  - **Body**: `{ "skillSlug": "rest-controller-design" }`
- `DELETE /api/skills/claims/{skillSlug}`
  - **Auth**: Required
  - **Description**: Removes a self-reported claim.
- `GET /api/skills/{skillSlug}/evidence`
  - **Auth**: Required
  - **Description**: Returns detailed evidence trail for a specific skill (qualifying findings, file paths, line ranges, commit links, assessment scores, challenge results, recency weights, anti-gaming flags, and missing requirements).
- `GET /api/dashboard`
  - **Auth**: Required
  - **Description**: Aggregated summary for the developer dashboard (all 8 skills, assigned levels, recent analysis jobs, active credentials, and profile flags).

### 2.5 Scenario-Based Assessments
- `POST /api/assessments/{skillSlug}/start`
  - **Auth**: Required
  - **Description**: Initiates a 2-3 question assessment attempt if the skill has reached `Observed` and 24h cooldown has elapsed.
  - **Response**: List of questions and options (correct answers omitted).
- `POST /api/assessments/{skillSlug}/submit`
  - **Auth**: Required
  - **Description**: Submits selected options. Evaluates server-side, updates level to `Supported` if $\ge 66\%$, and returns score with explanations.
  - **Body**: `{ "attemptId": "uuid", "responses": [ { "questionId": "uuid", "selectedOptionId": "uuid" } ] }`
- `GET /api/assessments/{skillSlug}/history`
  - **Auth**: Required
  - **Description**: Lists previous assessment attempts, scores, and timestamps.

### 2.6 Sandboxed Practical Challenges
- `GET /api/challenges`
  - **Auth**: Required
  - **Description**: Lists practical coding challenges (1: JWT Endpoint, 2: Seeded Bug Fixes, 3: REST & DB CRUD).
- `GET /api/challenges/{challengeSlug}`
  - **Auth**: Required
  - **Description**: Returns instructions and starter project editable files for a challenge.
- `POST /api/challenges/{challengeSlug}/submit`
  - **Auth**: Required
  - **Description**: Submits code for whitelisted files. Proxied to host `sandbox-runner` via HMAC for offline grading.
  - **Body**: `{ "files": { "src/main/java/.../SecurityConfig.java": "content..." } }`
- `GET /api/challenges/{challengeSlug}/result/{runId}`
  - **Auth**: Required
  - **Description**: Returns sanitized test results (duration, tests passed/failed; no internal expected secrets).

### 2.7 Credentials (VC-Style)
- `POST /api/credentials/{skillSlug}/issue`
  - **Auth**: Required
  - **Description**: Issues an Ed25519-signed credential for any skill at `Observed`, `Supported`, or `Verified`.
- `GET /api/credentials`
  - **Auth**: Required
  - **Description**: Lists all issued credentials for the user.
- `POST /api/credentials/{id}/revoke`
  - **Auth**: Required
  - **Description**: Revokes a credential immediately.
- `GET /api/public/credentials/{id}`
  - **Auth**: Public (Unauthenticated)
  - **Description**: Fetches credential JSON and verifies both cryptographic signature and server status (`ACTIVE`, `REVOKED`, `EXPIRED`, `SUPERSEDED`).
- `POST /api/public/credentials/verify`
  - **Auth**: Public (Unauthenticated)
  - **Description**: Verifies an uploaded or pasted VC JSON payload against the issuer's public key and revocation list.
- `GET /api/public/credentials/public-key`
  - **Auth**: Public (Unauthenticated)
  - **Description**: Returns the issuer's Ed25519 public key.

### 2.8 Share Grants
- `POST /api/shares/{skillSlug}`
  - **Auth**: Required
  - **Description**: Creates a revocable share link for a specific skill (default 30-day expiry).
  - **Response**: `{ "shareToken": "...", "expiresAt": "...", "shareUrl": "..." }`
- `GET /api/shares`
  - **Auth**: Required
  - **Description**: Lists active and expired share links.
- `DELETE /api/shares/{id}`
  - **Auth**: Required
  - **Description**: Immediately revokes a share grant.
- `GET /api/public/shares/{token}`
  - **Auth**: Public (Unauthenticated)
  - **Description**: Returns isolated evidence summary for the shared skill only. Returns 404/410 if unknown, expired, or revoked.

### 2.9 Privacy & Deletion (R19)
- `DELETE /api/privacy/analysis-data`
  - **Auth**: Required
  - **Description**: Deletes all repository records, analysis jobs, blame data, evidence records, assessment attempts, and share grants. Revokes all issued credentials. Retains minimal user account.
- `DELETE /api/privacy/account`
  - **Auth**: Required
  - **Description**: Permanently purges user account, encrypted tokens, and all associated data.
