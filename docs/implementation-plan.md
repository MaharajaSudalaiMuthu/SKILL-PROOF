# SkillProof Phased Implementation Plan

## Overview
SkillProof is constructed strictly phase-by-phase in accordance with Section 12 of the Master Prompt. At the completion of each phase, all relevant builds, linters, and automated tests are executed, errors resolved, `docs/requirements.md` and `docs/test-report.md` updated, and execution pauses for user review before proceeding.

---

## Phase Roadmap & Exit Criteria

### Phase 1: Foundation (Current Phase)
- **Monorepo Layout**: Root package.json configuring npm workspaces for `shared`, `backend`, `frontend`, and `sandbox-runner`.
- **Planning Documentation**:
  - `docs/requirements.md` (Requirement register R1-R26)
  - `docs/architecture.md` (System architecture, workspaces, extra tools justification)
  - `docs/database-design.md` (MongoDB schemas, indexes, embedded vs referenced collections)
  - `docs/api-specification.md` (REST API catalog & OpenAPI details)
  - `docs/security-design.md` (Threat models, mitigations, container isolation)
  - `docs/implementation-plan.md` (This document)
  - `docs/testing-plan.md` (Unit, integration, sandbox, E2E test strategy)
  - `docs/assumptions.md` (Configuration defaults, limits, attribution rules)
  - `docs/deviations.md` (MERN stack deviations from initial report)
- **Shared Package (`shared`)**:
  - TypeScript types, skill slug constants, level enums, and base Zod schemas.
- **Backend Skeleton (`backend`)**:
  - Express 5 application with TypeScript, Pino logging, Zod validation, error handling, health endpoint (`GET /api/health`).
- **Frontend Skeleton (`frontend`)**:
  - Vite + React + TypeScript with React Router, health check indicator, Vite dev proxy (`/api` $\rightarrow$ `http://localhost:8080`).
- **Database & Migration Baseline**:
  - `docker-compose.yml` with single-node MongoDB replica set (`rs0`).
  - `migrate-mongo` configuration and initial baseline migration for collections and indexes.
- **CI & Operational Tooling**:
  - `.github/workflows/ci.yml` matrix testing backend, frontend, and shared workspaces.
  - `scripts/check-prereqs.sh` automated host environment verification.
  - `.env.example` with documented environment variable placeholders.
- **Java Parsing Spike**:
  - Automated spike test proving Tree-sitter (or pure fallback) successfully parses modern Java syntax (records, switch expressions, text blocks, sealed classes, annotations).
- **Exit Criteria**: Backend starts, frontend reaches backend via proxy, migrations succeed, CI workflow valid, parser spike passing.

---

### Phase 2: Authentication and Data Model
- GitHub OAuth 2.0 authorization code flow with cryptographically random state parameter.
- Application JWT issuance in HttpOnly, SameSite=Lax cookie with CSRF header validation.
- User session isolation middleware (`req.user`).
- Explicit versioned consent recording (`consents` collection).
- Skill catalog seed data and self-reported claims management (`userSkillClaims`).
- **Exit Criteria**: OAuth flow tested via stubs; protected routes reject unauthenticated requests; user claims persisted.

---

### Phase 3: Ingestion and Authorship
- Listing of user's public repositories via GitHub API.
- Safe repository cloning into ephemeral directory with security caps (size, timeout, symlink rejection).
- Git porcelain blame parser extracting line-level commit SHAs.
- GitHub commit author login resolution with SHA caching and rate-limit backoff.
- Line attribution status assignment (`CONFIRMED`, `UNCERTAIN`, `OTHER`).
- In-process bounded job queue (`p-queue`) tracking job lifecycle.
- **Exit Criteria**: Multi-commit fixture git repository analysed end-to-end with verified line attribution.

---

### Phase 4: Detectors, Evidence & Anti-Gaming
- Eight independent AST detectors for the canonical capabilities:
  1. `rest-controller-design`
  2. `jpa-hibernate-persistence`
  3. `spring-security-configuration`
  4. `jwt-issuance-validation`
  5. `structured-exception-handling`
  6. `unit-tests-meaningful-assertions`
  7. `transaction-management`
  8. `input-validation`
- Cross-file symbol index for type and annotation resolution.
- Evidence deduplication and persistence (`evidenceRecords`).
- Three anti-gaming algorithms:
  - Unmodified / near-unmodified fork detector (severity `BLOCKING`).
  - Winnowing token k-gram similarity checker against reference corpus (severity `BLOCKING`).
  - Single large initial commit checker (severity `WARNING`).
- **Exit Criteria**: Positive and negative unit tests passing for all 8 detectors; anti-gaming synthetic fixture harness passing.

---

### Phase 5: Evidence Engine & Dashboard
- Pure deterministic evidence engine function:
  $$\text{computeSkillLevels}(\text{evidence}, \text{claims}, \text{config}, \text{now}) \longrightarrow (\text{levels}, \text{reasons}, \text{evidenceIds}, \text{missingRequirements})$$
- Recency weighting decay ($0.5^{\text{age} / 12}$).
- Auditable snapshot persistence (`skillLevelSnapshots`).
- Responsive React dashboard: 8 skill cards, level badges, evidence links to GitHub file/lines, anti-gaming notices.
- **Exit Criteria**: Unit tests for all level transitions; dashboard displays live backend evidence data.

---

### Phase 6: Assessments
- Scenario-based question bank (minimum 48 technical questions, $\ge 6$ per skill).
- Randomized 2-3 questions per attempt with cooldown enforcement (24h).
- Deterministic server-side rubric scoring ($\ge 66\%$ threshold promotes to `Supported`).
- Client UI for question presentation, countdown timer, and post-submission explanations.
- **Exit Criteria**: Automated tests for score calculation, cooldowns, and level promotion to `Supported`.

---

### Phase 7: Sandbox Runner & Practical Challenges
- Standalone Node.js/Express `sandbox-runner/` service with Docker socket access.
- Hardened container runtime: `--network none`, `--read-only`, `--cap-drop ALL`, CPU/RAM/tmpfs limits.
- Pre-built offline challenge image with cached Maven dependencies.
- Three practical challenges:
  1. JWT-authenticated REST endpoint.
  2. Seeded bug fixes (exceptions, transactions, validation).
  3. REST + DB CRUD with H2.
- Whitelisted in-browser code editor with size caps (no zip uploads).
- Progression to `Verified` for mapped skills only.
- **Exit Criteria**: Sandbox isolation tests (timeout, network block, fork bomb); end-to-end challenge grading.

---

### Phase 8: Signed Credentials & Sharing
- RFC 8785 canonical JSON credential generator.
- Ed25519 cryptographic signing via Node.js `crypto` with external private key.
- Public key publication endpoint (`/api/public/credentials/public-key`).
- Public verification endpoint checking signature and server status (`ACTIVE`, `REVOKED`, `EXPIRED`, `SUPERSEDED`).
- Revocable per-skill share grants with random 256-bit hashed tokens.
- **Exit Criteria**: Cryptographic tamper detection tests; share creation and immediate revocation verification.

---

### Phase 9: Privacy, Hardening & Accessibility
- Explicit data deletion workflows:
  - "Delete my analysis data" (revokes credentials, clears evidence/repos).
  - "Delete my account" (full purge of user identity and tokens).
- Rate limiting, NoSQL injection audit (`sanitizeFilter`), and CSP headers.
- WCAG 2.1 AA accessibility pass across frontend components.
- **Exit Criteria**: Integration tests for GDPR deletion workflows; zero critical security lints.

---

### Phase 10: Final Verification & Handover
- Execution of complete test pyramid (Unit, Integration, E2E).
- Clean-machine setup verification from `README.md`.
- Evaluation support scripts (pseudonymized export, expert rating template, agreement calculator).
- Final comprehensive report matching all handover requirements.
