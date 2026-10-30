# SkillProof Privacy Architecture & GDPR Compliance (R19)

SkillProof is designed with privacy-by-design and GDPR alignment at its core. This document details the platform's data retention policies, authorization scopes, cryptographic credential limitations, and self-service data erasure tiers.

---

## 1. Principles of Data Processing

### 1.1 Minimal Scope Authorization (R1)
- SkillProof authenticates developers exclusively via GitHub OAuth requesting read-only access to public profile data.
- **No write scopes**, **no private repository access**, and **no email access** are requested.
- Access tokens are encrypted at rest using AES-256-GCM with distinct, cryptographically random initialization vectors (IVs) per user and authentication tags for tamper detection.

### 1.2 Ephemeral Ingestion & Zero Code Storage (R2, R3, R6)
- Cloned repository histories are used solely to compute line-level git blame attribution and execute syntax AST detectors.
- Repositories are cloned into ephemeral, isolated directories with strict filesystem escape protections and path traversal guards.
- **No cloned repository files or raw source code files are ever retained on disk or stored in MongoDB.** Workspaces are deleted immediately upon analysis job completion.
- Stored `EvidenceRecord`s contain only structured metadata: repository full name, file path, qualifying start/end line numbers, matched AST detector pattern name, commit SHA, and commit timestamp.

### 1.3 Per-Skill Sharing & Data Minimization (R18)
- Public share links are generated with cryptographically strong 256-bit random tokens (`crypto.randomBytes(32)`).
- The platform stores **only the SHA-256 hash** of the token in the database.
- A share link strictly exposes only the designated capability, its qualifying line numbers, and a direct link to the commit blob on GitHub. It never reveals unshared skills, the developer's full profile, or private details.

---

## 2. Explicit, Versioned Consent (R19 Baseline)

- Developers must explicitly review and grant consent before any repository analysis job can be dispatched.
- Consent records (`consents` collection) store:
  - Developer user ID
  - Explicit agreement boolean
  - UTC timestamp of agreement
  - Version of the terms agreed to (`v1.0.0`)
- Consent status is verified on every ingestion dispatch.

---

## 3. Two-Tier Self-Service Data Deletion (R19)

SkillProof provides two distinct, self-service deletion operations accessible via the Developer Privacy Settings and API:

### Tier 1: Delete Analysis Data (`POST /api/privacy/delete-analysis`)
Purges all analytical and evaluation data while keeping the user account and login session active:
- **Permanently Deleted**:
  - All qualifying static code evidence (`EvidenceRecord`)
  - All line-level authorship attributions (`FileAttribution`)
  - All anti-gaming flags and synthetic containment records (`AntiGamingFlag`)
  - All analysis ingestion jobs and logs (`AnalysisJob`)
  - All scenario assessment attempts and answers (`AssessmentAttempt`)
  - All coding challenge sandbox runs and outputs (`SandboxRun`)
  - All tracked repository connections (`Repository`)
  - All self-declared skill claims (`UserSkillClaim`)
  - All capability snapshots and evaluation histories (`SkillLevelSnapshot`)
  - All active and historical share grants (`ShareGrant`)
  - Any lingering temporary workspaces on the runner host
- **Credential Tombstone Handling**:
  - Active credentials (`credentials` collection) are converted to minimal `REVOKED` tombstones with `revocationReason: 'Developer deleted analysis data'` and raw details stripped.
  - *Rationale*: A third party or employer holding a previously exported credential can still query the verification endpoint (`/api/credentials/:id/verify`). The tombstone guarantees the ledger immediately reports `REVOKED`, preventing stale or revoked capabilities from passing verification.
- **Audit Logging**: An immutable `AuditEntry` (`action: 'DELETE_ANALYSIS_DATA'`) and `DeletionRequest` are logged.

### Tier 2: Delete Account & All Records (`POST /api/privacy/delete-account`)
Permanently removes the user and all associated records from SkillProof:
- **Executes Tier 1** (purging all analytical evidence, snapshots, claims, and repositories).
- **Permanently Deleted**:
  - The developer's consent record (`Consent`)
  - The developer's user record (`User`), including encrypted GitHub access tokens, IVs, and auth tags
- **Session Termination**:
  - Immediately clears the `SKILLPROOF_SESSION` HttpOnly cookie.
- **Audit Logging**: Logs an anonymized `AuditEntry` (`action: 'DELETE_ACCOUNT'`) recording completion of the right to erasure.

---

## 4. Honest Disclosure: Downloaded Credential Recall Limitation

> [!WARNING]
> **Limitations on Recall of Downloaded Credentials**:
> When a developer exports or downloads a Verifiable Credential JSON file, that file exists in the developer's or third party's local possession. SkillProof cannot remotely erase or recall copies stored outside its servers.
>
> **Mitigation via Ledger Revocation**:
> Because third parties verify credentials against SkillProof's public endpoints (`/api/credentials/:id/verify` or `/api/credentials/verify`), SkillProof marks the credential status as `REVOKED` immediately upon deletion. Any subsequent verification attempt by an employer or automated verifier will clearly report:
>
> `status: "REVOKED", reason: "Developer deleted analysis data"`

---

## 5. GDPR Rights Alignment

SkillProof addresses data subject rights under the European Union General Data Protection Regulation (GDPR):

| GDPR Article | Right | SkillProof Implementation |
|---|---|---|
| **Article 15** | Right of Access | Developers can view all stored evidence, line attributions, scores, snapshots, and consent timestamps via `GET /api/capabilities`, `GET /api/privacy/summary`, and the Dashboard. |
| **Article 16** | Right to Rectification | Skills can be unclaimed or re-analyzed at any time; fresh repository ingestion updates attribution and snapshots. |
| **Article 17** | Right to Erasure ("Right to be Forgotten") | Implemented via Tier 1 (`POST /api/privacy/delete-analysis`) and Tier 2 (`POST /api/privacy/delete-account`). |
| **Article 18** | Right to Restriction of Processing | Revoking public share links (`POST /api/shares/:id/revoke`) immediately blocks all third-party access (HTTP 410). |
| **Article 20** | Right to Data Portability | All evidence, snapshots, and signed credentials can be exported and downloaded in standard JSON and W3C-inspired Verifiable Credential format. |
