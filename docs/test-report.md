# SkillProof Automated Test Execution Report

Per Operating Rule 5, this document records the execution history of automated test suites across all phases. A requirement is never marked `TESTED` without an entry in this report documenting the exact command, execution timestamp, and pass/fail counts.

---

## Test Execution Log

| Date (UTC) | Phase | Suite / Command | Total | Passed | Failed | Skipped | Status | Details / Logs |
|---|---|---|---|---|---|---|---|---|
| 2026-10-20 09:14 | Phase 1 | `npm run spike:parser` (Modern Java Spike) | 5 | 5 | 0 | 0 | PASSED | Verified Java 17 sealed classes, Java 16 records, Java 15 text blocks, switch expressions, and Spring annotations via java-parser CST |
| 2026-10-20 09:18 | Phase 1 | `./scripts/check-prereqs.sh` | 5 | 5 | 0 | 0 | PASSED | Node.js v22.23.3, npm 10.9.9, Git 2.34.1, Docker 28.1.1, Docker Compose v2.35.1 checked. Host docker group note surfaced. |
| 2026-10-20 09:22 | Phase 1 | `npx migrate-mongo up` (Baseline Migration) | 1 | 1 | 0 | 0 | PASSED | Initialized 19 collections with unique constraints & compound indexes on MongoDB replica set rs0 |
| 2026-10-20 09:25 | Phase 1 | Backend Health Check (`curl http://localhost:8080/api/health`) | 1 | 1 | 0 | 0 | PASSED | Express server returned status: UP, database.connected: true, edition: MERN |
| 2026-10-20 09:27 | Phase 1 | Frontend Dev Proxy Check (`curl http://127.0.0.1:5173/api/health`) | 1 | 1 | 0 | 0 | PASSED | Vite dev server reverse proxy forwarded /api/health to backend successfully |
| 2026-10-20 09:29 | Phase 1 | Monorepo Typecheck (`npm run typecheck`) | 4 | 4 | 0 | 0 | PASSED | TypeScript strict typecheck passed with 0 errors across shared, backend, frontend, and sandbox-runner |
| 2026-10-20 09:30 | Phase 1 | Monorepo Production Build (`npm run build`) | 4 | 4 | 0 | 0 | PASSED | Full production build succeeded across all workspaces (including Vite bundling) |
| 2026-10-20 09:48 | Phase 2 | `npm run test:unit -w backend` | 7 | 7 | 0 | 0 | PASSED | Unit tests for AES-256-GCM token encryption, random IV entropy, tamper detection, and JWT session tokens (jose) |
| 2026-10-20 09:52 | Phase 2 | `npm run test:int -w backend` | 13 | 13 | 0 | 0 | PASSED | Integration tests covering GitHub OAuth authorization code exchange, profile fetch, session cookie, CSRF header checks, user isolation, consent agreement, and skill claims |
| 2026-10-20 09:51 | Phase 2 | Monorepo Typecheck & Build (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck and production builds verified across all workspaces |
| 2026-10-24 05:04 | Phase 3 | `npm run test:unit -w backend` | 18 | 18 | 0 | 0 | PASSED | Unit tests for porcelain blame parsing, multi-author grouping, blank-line tracking, authorResolver GitHub API integration with in-memory caching and rate-limit backoff, and git security URL validation |
| 2026-10-24 05:08 | Phase 3 | `npm run test:int -w backend` | 17 | 17 | 0 | 0 | PASSED | Integration tests including scripted local multi-author Git fixture analysis, Nock commit SHA stubs, CONFIRMED/OTHER/UNCERTAIN range assignments, strict User B isolation, and temporary workspace cleanup |
| 2026-10-24 05:09 | Phase 3 | Full Backend Test Suite (`npm test -w backend`) | 35 | 35 | 0 | 0 | PASSED | All 8 unit and integration test files executed cleanly |
| 2026-10-24 05:10 | Phase 3 | Monorepo Build & Typecheck (`npm run build && npm run typecheck`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck and production build succeeded across shared, backend, frontend, and sandbox-runner |
| 2026-10-28 09:41 | Phase 4 | Detector Unit Tests (`npx vitest run tests/unit/detectors.test.ts`) | 25 | 25 | 0 | 0 | PASSED | All 8 Java capability detectors tested with positive, negative, and near-miss test cases |
| 2026-10-28 09:41 | Phase 4 | Anti-Gaming Unit Tests (`npx vitest run tests/unit/antigaming.test.ts`) | 11 | 11 | 0 | 0 | PASSED | Unmodified fork detection, Winnowing normalization and containment, tutorial similarity check, large initial commit check |
| 2026-10-28 09:41 | Phase 4 | Phase 4 Integration Tests (`npx vitest run tests/integration/detectors_and_antigaming.test.ts`) | 4 | 4 | 0 | 0 | PASSED | Full pipeline end-to-end: 8 skills detected with VALID status, unmodified fork BLOCKING flag with EXCLUDED evidence, large initial commit WARNING flag, and user isolation |
| 2026-10-28 09:41 | Phase 4 | Full Backend Test Suite (`npm test -w backend`) | 75 | 75 | 0 | 0 | PASSED | All 11 test files executed sequentially with zero errors |
| 2026-10-28 09:41 | Phase 4 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed across all 4 workspaces |
| 2026-10-28 10:00 | Phase 5 | Capability Engine Unit Tests (`npx vitest run tests/unit/capabilityEngine.test.ts`) | 12 | 12 | 0 | 0 | PASSED | Pure deterministic engine testing Claimed/Observed/Supported/Verified transitions, dynamic recency decay drops, assessment expiry, unit test max level cap at Supported, and cumulative rules |
| 2026-10-28 10:00 | Phase 5 | Capability Profile Integration Tests (`npx vitest run tests/integration/capability_profile.test.ts`) | 8 | 8 | 0 | 0 | PASSED | GET /api/capabilities and GET /api/capabilities/:skillSlug, automatic snapshot updates, GitHub blob links `#L<start>-L<end>`, anti-gaming flag exclusion, and strict multi-tenant isolation |
| 2026-10-28 10:09 | Phase 5 | Full Backend Test Suite (`npm test -w backend`) | 95 | 95 | 0 | 0 | PASSED | All 13 test files passing cleanly |
| 2026-10-28 10:08 | Phase 5 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed across all 4 workspaces |
| 2026-10-28 10:34 | Phase 6 | Assessment Scoring Unit Tests (`npx vitest run tests/unit/assessmentScoring.test.ts`) | 4 | 4 | 0 | 0 | PASSED | 48-question catalog verification (6 per skill), >=66% passing threshold (2/3 correct), Zod submission payload validation, and 15m expiration |
| 2026-10-28 10:35 | Phase 6 | Assessment Engine Integration Tests (`npx vitest run tests/integration/assessment_flow.test.ts`) | 8 | 8 | 0 | 0 | PASSED | Eligibility check (Observed required), 3-question sampling with answer redaction, session resumption, multi-tenant isolation, failing score evaluation, passing score evaluation with automated Supported promotion, completed attempt immutability, and history listing |
| 2026-10-28 10:41 | Phase 6 | Full Backend Test Suite (`npm test -w backend`) | 107 | 107 | 0 | 0 | PASSED | All 15 test files executed sequentially with zero errors |
| 2026-10-28 10:39 | Phase 6 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed across all 4 workspaces |
| 2026-10-29 01:25 | Phase 7 | Challenge Definitions Unit Tests (`npx vitest run tests/unit/challengeDefinitions.test.ts`) | 4 | 4 | 0 | 0 | PASSED | 3 seeded challenges verify 7 skills, unit testing skill capped at SUPPORTED per R11, valid slugs and structures |
| 2026-10-29 01:28 | Phase 7 | Sandbox Flow Integration Tests (`npx vitest run tests/integration/challenge_sandbox_flow.test.ts`) | 5 | 5 | 0 | 0 | PASSED | Challenge retrieval with hidden tests hidden, eligibility check (Observed/Supported required), failing run grading, passing run grading with automatic level promotion to VERIFIED, multi-tenant isolation |
| 2026-10-29 01:33 | Phase 7 | Full Backend Test Suite (`npm test -w backend`) | 116 | 116 | 0 | 0 | PASSED | All 17 test files passed cleanly (101s execution time) |
| 2026-10-29 01:34 | Phase 7 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed across shared, backend, frontend, and sandbox-runner |
| 2026-10-29 07:26 | Phase 8 | Credentials Unit Tests (`npx vitest run tests/unit/credentials.test.ts`) | 8 | 8 | 0 | 0 | PASSED | RFC 8785 canonical JSON sorting, whitespace stripping, -0 normalization, Ed25519 signing/verification, tamper detection, SPKI PEM & JWK public key exports, 256-bit token entropy |
| 2026-10-29 07:28 | Phase 8 | Credentials & Sharing Integration Tests (`npx vitest run tests/integration/credentials_and_sharing.test.ts`) | 17 | 17 | 0 | 0 | PASSED | Public key endpoints (PEM & JWKS), level eligibility enforcement (Observed required), signed VC issuance, verification by ID, verification by pasted JSON, tampering detection, manual revocation, automatic superseding on level drop, 256-bit hashed token sharing, single-skill isolation, 410 REVOKED/EXPIRED, multi-tenant isolation |
| 2026-10-29 08:00 | Phase 8 | Full Backend Test Suite (`npm test -w backend`) | 141 | 141 | 0 | 0 | PASSED | All 19 test files executed sequentially with zero errors (92s execution time) |
| 2026-10-29 08:06 | Phase 8 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed across all 4 workspaces (shared, backend, frontend, sandbox-runner) |
| 2026-10-29 08:33 | Phase 9 | Privacy & Deletion Integration Tests (`npx vitest run tests/integration/privacy_and_deletion.test.ts`) | 8 | 8 | 0 | 0 | PASSED | Data inventory count (GET /summary), Tier 1 analysis purge with confirmation string, credential tombstoning to REVOKED, Tier 2 account purge, session cookie clearance, audit log verification, and strict multi-tenant isolation |
| 2026-10-29 08:35 | Phase 9 | Full Backend Test Suite (`npm test -w backend`) | 149 | 149 | 0 | 0 | PASSED | All 20 test files passed with zero errors (96.60s execution time) |
| 2026-10-29 08:37 | Phase 9 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed cleanly across all 4 workspaces |
| 2026-10-29 09:15 | Phase 10 | Evaluation Agreement Unit Tests (`npx vitest run tests/unit/evaluationAgreement.test.ts`) | 7 | 7 | 0 | 0 | PASSED | Perfect agreement (kappa=1.0), empty dataset resilience, linear vs quadratic weighted kappa sensitivity, substantial agreement on mixed distribution, inverse disagreement, CSV template parser |
| 2026-10-29 09:40 | Phase 10 | Pilot Evaluation Integration Tests (`npx vitest run tests/integration/pilot_evaluation.test.ts`) | 6 | 6 | 0 | 0 | PASSED | GET /api/evaluation/export pseudonymized dataset with zero PII leakage, POST /api/evaluation/agreement validation, exact match vs weighted concordance calculation against database snapshots |
| 2026-10-29 09:42 | Phase 10 | Full Backend Test Suite (`npm test -w backend`) | 162 | 162 | 0 | 0 | PASSED | All 22 test files executed and passed with zero errors (106.27s execution time) |
| 2026-10-29 09:45 | Phase 10 | Monorepo Build & Typecheck (`npm run typecheck && npm run build`) | 8 | 8 | 0 | 0 | PASSED | TypeScript strict typecheck (tsc --noEmit) and production builds (tsc & vite build) passed with zero errors across all 4 workspaces |

---

## Test Environment Details
- Host OS: Ubuntu Linux (6.8.0-138-generic x86_64)
- Node.js Runtime: v22.23.3 LTS
- Package Manager: npm 10.9.9
- Database: MongoDB 7.0 (Single-node Replica Set `rs0` on port 27017)
- Container Runtime: Docker Engine 28.1.1 & Docker Compose v2.35.1
