# SkillProof Comprehensive Testing Plan

## 1. Testing Philosophy & Verification Pyramid

Testing in SkillProof strictly adheres to Operating Rule 5: **A feature is never marked `TESTED` without running real automated tests and recording the exact command, execution date, and pass/fail counts in `docs/test-report.md`**. Simulated successes, placeholder tests, or test skips are strictly forbidden.

```
                  / \
                 /   \      E2E Browser Tests (Playwright)
                / E2E \     - Full developer lifecycle against stubbed GitHub
               /-------\
              /         \   Integration Tests (Supertest + Testcontainers/MemoryServer)
             /  INTEGR.  \  - HTTP routes, Mongoose transactions, Git blame fixtures
            /-------------\
           /               \ Unit Tests (Vitest)
          /      UNIT       \ - Detectors, Anti-gaming, Pure Evidence Engine, Ed25519
         /-------------------\
```

---

## 2. Test Suites Specification

### 2.1 Backend Unit Tests (`npm run test:unit -w backend`)
- **Java AST Detectors (8 suites)**:
  - Each detector tested against both positive and negative Java syntax fixtures.
  - Near-miss fixtures: imports present without actual usage, annotations on unsupported elements, empty methods, trivial assertions like `assertTrue(true)`.
- **Pure Evidence Engine**:
  - Table-driven unit tests verifying level transitions (`Claimed` $\rightarrow$ `Observed` $\rightarrow$ `Supported` $\rightarrow$ `Verified`).
  - Handling of expired evidence (recency decay $< 1.0$), non-confirmed attribution, and blocking anti-gaming flags.
- **Authorship Attribution**:
  - Calculation of non-blank line ratios, `CONFIRMED` threshold ($\ge 50\%$), and handling of unknown commit logins.
- **Anti-Gaming Algorithms**:
  - Winnowing token k-gram algorithm with seeded clones ($\ge 60\%$ containment).
  - Fork check threshold validation and single large initial commit check ($\ge 80\%$).
- **Cryptographic Signatures**:
  - Ed25519 key generation, canonical RFC 8785 JSON encoding, base64url signing, and tamper verification (tampering with any field causes verification failure).
- **Zod Validation & Sanitization**:
  - Testing rejection of malformed payloads and NoSQL operator objects (`$ne`, `$gt`).

### 2.2 Backend Integration Tests (`npm run test:int -w backend`)
- **Database & Migrations**:
  - Verified against a real MongoDB replica set using Testcontainers (or MongoMemoryServer replica set).
  - Validation of unique indexes, compound indexes, and multi-document ACID transactions.
- **User Isolation & Protected Routes**:
  - Supertest tests proving User A cannot read, query, or mutate User B's repositories, analysis jobs, evidence, or shares.
- **GitHub Integration Stubs**:
  - Nock / MSW stubs replicating GitHub OAuth token exchange and GitHub Commits/Repos API.
  - Zero mock bypasses in production code paths.
- **Local Git Repository Analysis**:
  - Creation of on-the-fly fixture Git repositories with multi-commit, multi-author histories to test safe cloning and porcelain blame end-to-end.

### 2.3 Sandbox Runner Isolation Tests (`npm run test:sandbox -w sandbox-runner`)
- Passing Spring Boot submission returns correct pass count.
- Failing Spring Boot submission returns test failure messages without leaking hidden test expectations.
- Wall-clock timeout enforcement (infinite loop killed at limit).
- Network isolation verification: container blocked from connecting to public internet or host.
- Memory & process limit enforcement (fork bomb killed gracefully).
- Verification that hidden JUnit test files are not readable by untrusted source code.
- Workspace cleanup verification after execution failure or cancellation.

### 2.4 Frontend Unit & Component Tests (`npm run test -w frontend`)
- Route guards and unauthenticated redirects.
- Loading skeletons, empty states, and error boundary rendering.
- Dashboard capability cards and level badge styling.
- Assessment question interaction and score submission feedback.
- Share link creation and immediate revocation UI.

### 2.5 End-to-End Tests (`npm run test:e2e`)
- Playwright automated browser flow against local test server with stubbed GitHub OAuth:
  1. Login via GitHub OAuth stub.
  2. Accept versioned privacy consent.
  3. Select public repository and trigger analysis job.
  4. View real-time progress until `SUCCEEDED`.
  5. Inspect evidence trail and awarded `Observed` level.
  6. Claim additional skill.
  7. Start and pass scenario-based assessment ($\ge 66\%$) $\rightarrow$ `Supported`.
  8. Submit practical challenge $\rightarrow$ `Verified` (for mapped skills only).
  9. Issue Ed25519 VC credential, download payload, and verify on public `/verify` route.
  10. Tamper with downloaded JSON and confirm verification failure.
  11. Create revocable share link, view in incognito, revoke link, confirm 410 Gone.
  12. Execute "Delete my analysis data" and confirm evidence records and credentials are wiped.
