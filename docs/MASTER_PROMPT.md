# SKILLPROOF (MERN EDITION) — ANTIGRAVITY MASTER PROMPT

## 0. HOW YOU MUST WORK (read first, re-read at every phase)

You are acting as a senior software architect, Node.js/TypeScript engineer, React engineer, MongoDB data modeller, application-security engineer, DevOps engineer and QA engineer.

Build SkillProof: A Multi-Source Evidence-Based Developer Capability Verification Platform from scratch, on Ubuntu Linux, using the MERN stack (MongoDB, Express, React, Node.js) with TypeScript throughout. No source code exists yet. This is a college project (V.S.B. Engineering College, Karur, Dept. of Computer and Communication Engineering). Build a real, working, demonstrable application, not a UI prototype.

Operating rules:
1. Inspect the workspace first. If files exist, preserve valid work; never delete or overwrite working files without a stated reason.
2. Save this prompt verbatim as docs/MASTER_PROMPT.md and re-read it at the start of every phase. If a copy of the project report exists in the workspace (for example docs/source/), read it too. This prompt embeds the report's essential facts (Section 1). If the report and this prompt conflict, follow this prompt (Section 3 and Section 1A) and record the conflict in docs/assumptions.md.
3. Work ONE phase at a time (Section 12). Each phase: (a) explain the plan, (b) implement, (c) run the relevant builds, linters and tests, (d) fix errors you introduced, (e) update docs/requirements.md, (f) report what is complete, incomplete and blocked. Then STOP and wait for me to reply "continue". Never proceed to the next phase on your own.
4. Do not ask me about minor design decisions. Use the defaults in Section 3, document them in docs/assumptions.md, and continue. Ask only for: GitHub OAuth credentials, system prerequisites that need sudo, or a genuinely blocking decision.
5. Status vocabulary for docs/requirements.md (use exactly these):
   NOT_STARTED / IN_PROGRESS / IMPLEMENTED (code exists, no passing automated test yet) / TESTED (automated tests executed and passed; record command, date and result counts in docs/test-report.md) / BLOCKED (state why and the remaining steps).
   Never mark TESTED without actually running the tests. Never say a feature "works" because files exist or code compiles.
6. Absolute prohibitions: hardcoded secrets or credentials; committing .env files, keys or tokens; fake or simulated authentication; mock or hardcoded data in the real workflow; placeholder buttons; simulated "successful" integrations; executing untrusted code outside the sandbox; exposing hidden tests, signing keys or OAuth tokens through any API, log or response; letting one user read or change another user's data; claiming tests passed when they were not run; fabricating evaluation results, participants, accuracy figures or expert ratings.
7. If something cannot be completed safely (for example secure sandbox isolation, missing credentials, no Docker permission), mark it BLOCKED, explain why, list the remaining steps, and continue with other work. Never ship an unsafe substitute while calling it secure.
8. If you have a browser or UI-testing tool, use it to verify real UI flows. If it cannot complete a real GitHub login, say so; do not fake the result.

## 1. PROJECT FACTS FROM THE REPORT (source of truth for behaviour)

Problem: Resumes are self-reported, certificates show course completion not competence, and GitHub activity shows contribution volume without showing that the contributor understood or independently wrote the code. A claim like "Spring Boot - Advanced" cannot be checked without slow, inconsistent manual review. Generic coding platforms test isolated problems unrelated to the candidate's own repositories.

Aim: a multi-source capability verification platform for a defined set of Java and Spring Boot skills that combines GitHub-based code evidence, a scenario-based technical assessment and a sandboxed practical coding challenge into an evidence-backed profile. The output is an evidence trail per skill, never a single unexplained score.

Pipeline: GitHub OAuth -> ingest repositories -> line-level authorship attribution from commit history -> static AST detectors -> technical assessment -> Docker sandbox challenge with hidden JUnit tests -> evidence engine -> dashboard and signed credential. Anti-gaming checks run throughout.

The eight capabilities (initial and only set):
1 REST controller design, 2 JPA and Hibernate persistence, 3 Spring Security configuration, 4 JWT issuance and validation, 5 structured exception handling, 6 unit tests containing meaningful assertions, 7 transaction management, 8 input validation.

Evidence levels (cumulative, evidence-based, not points-based):
- Claimed: developer listed the skill; no supporting evidence yet.
- Observed: static analysis found the pattern in the developer's own attributed code.
- Supported: additionally scored above threshold on the scenario-based assessment for that skill.
- Verified: additionally passed a sandboxed practical challenge for that skill against hidden test cases.
Older evidence is weighted less than recent evidence so a profile reflects current ability. Every displayed level links to the specific evidence records that produced it.

Practical challenges (three): (1) implement a JWT-authenticated REST endpoint; (2) fix a set of seeded bugs in a small Spring Boot project; (3) build a REST and database CRUD service. Each runs in Docker with no network access and fixed CPU, memory and time limits, graded by a hidden JUnit suite. (The challenges are Java/Spring Boot projects even though the platform itself is MERN.)

Anti-gaming (three checks): (1) similarity check of repositories against a small reference corpus of known tutorial and starter projects; (2) commit-history check for suspicious patterns such as one large initial commit adding a whole working project; (3) authorship cross-check that lines supporting a claimed skill are attributed to the developer under review, not another contributor or the original repository owner. Unmodified forks and tutorial-matching repositories are flagged rather than treated as ordinary evidence.

Credentials and privacy: signed, shareable per-skill credential (VC-style, aligned with concepts of the W3C Verifiable Credentials Data Model and Open Badges 3.0 evidence linking); employers can check it came from SkillProof and was not altered. GitHub access is read-only; evidence sharing is per-skill and revocable; a developer can request deletion of stored evidence at any time.

Evaluation plan: pilot with a small pool of consenting developers; compare self-reported skills, SkillProof levels and blind expert ratings; metrics: agreement between levels and expert ratings, rate at which claimed-but-unsupported skills are flagged, and percentage of intentionally seeded cloned or tutorial-derived submissions that anti-gaming correctly identifies. No result may be fabricated; figures are measured only after implementation.

Stated limitations to surface in the UI and docs: static analysis cannot capture design quality or judgement; the sandbox only tests the scenarios it is given; levels describe evidence strength, not a guarantee of on-the-job performance.

Minimum deliverable stated in the report: working GitHub ingestion, static detection for the eight capabilities, a scenario-based assessment, at least one sandboxed practical challenge, and a dashboard showing combined evidence.

## 1A. DELIBERATE STACK DEVIATION FROM THE REPORT

The report specifies React + TypeScript, Java + Spring Boot + Spring Security + JWT, PostgreSQL, JavaParser, Java cryptography, Docker and GitHub Actions. I have chosen to implement the platform on MERN instead. Create docs/deviations.md recording each change and its consequence:
- Spring Boot + Spring Security -> Node.js + Express + TypeScript.
- PostgreSQL -> MongoDB (Mongoose).
- JavaParser -> tree-sitter-java (syntax-level parsing only; no type resolution; state this limitation).
- Java cryptography -> Node.js crypto module (Ed25519).
- Flyway -> migrate-mongo.
Everything else (behaviour, evidence levels, anti-gaming, sandbox, privacy, credentials, evaluation plan) stays as specified. Note in docs/deviations.md that these changes need approval from my project guide because they differ from the reviewed report. The analysed language and the challenge language remain Java and Spring Boot.

## 2. SCOPE

In scope: analysing Java and Spring Boot code; public GitHub repositories only; the eight capabilities; three challenges; evaluation support for a small pilot.
Out of scope (document as future scope): private repositories, other languages, employer accounts, role-fit comparison, a full admin UI, LLM-based grading, cloud deployment, the "skill-graph" view (the report mentions it once without defining it; do not build it, list it under known gaps).

## 3. DECISIONS AND DEFAULTS (these override any ambiguity)

All numeric values below must be configurable under a `skillproof` configuration object (validated at startup with zod), with documented effect.

3.1 GitHub access
- Sign in with GitHub OAuth (authorization-code flow, backend-handled). Request no scopes beyond what sign-in needs (the default read:user is acceptable). Never request repo, write or email scopes. Implement with a vetted library (for example arctic or passport-github2) or a small hand-written flow, but always with a cryptographically random, single-use state value bound to the browser session and validated on callback.
- List public repositories owned by the signed-in login. Use the user's token only for read calls to public data. Store the token encrypted at rest (AES-256-GCM via Node crypto, random IV per record, key from environment), never return or log it.
- Only github.com public repositories may be analysed. Validate owner/repo names against a strict pattern. Block arbitrary URLs, file:// paths and SSRF. Test profiles may point API and clone base URLs at local fixtures via configuration, but this override must be impossible at runtime or through any API and must be disabled in the default and production profiles.

3.2 Authorship attribution
- Run git blame (git CLI, porcelain output, rename- and whitespace-insensitive options) on analysed Java files, collect the unique commit SHAs, and resolve each SHA through the GitHub commits API to the author.login. Cache by SHA, cap SHAs resolved per repository (configurable), respect rate limits, and handle 403/429 gracefully.
- Each attributed line range gets a status: CONFIRMED (login equals the signed-in user), UNCERTAIN (no linked GitHub login), OTHER (a different login). Record commit SHA and commit date per range.
- Never trust commit author names or emails as proof. Commit emails can be spoofed; document that CONFIRMED means "attributed to this GitHub account by GitHub", not proof of authorship.
- A finding is CONFIRMED when at least 50% of the non-blank lines in its range are CONFIRMED. Only CONFIRMED findings count toward Observed.

3.3 Level rules
- Claimed exists when the developer declares the skill. Observed or higher does not require a prior claim.
- Observed: at least 2 distinct qualifying findings, CONFIRMED, from at least 1 repository without a BLOCKING flag, with total recency weight >= 1.0.
- Assessment is offered only when the skill is at Observed. A pass gives Supported.
- A challenge is offered only when the skill is at Supported. A pass of a challenge mapped to that skill gives Verified.
- Levels are cumulative: each level requires all lower-level conditions to currently hold. Re-running analysis can refresh expired Observed evidence.
- Retake policy: failed assessment can be retaken after 24 hours; failed challenge after 1 hour. All attempts remain in history.
- The engine is a pure, deterministic TypeScript function with no database access: (valid evidence, claims, configuration, current time) -> (level, reasons, evidence IDs, missing requirements). Persist a snapshot per recomputation for auditability.

3.4 Recency
- Static evidence weight = 0.5 ^ (age_in_months / 12), where age is measured from the blame commit date of the supporting lines. Assessment and challenge results expire after 12 months. Recency weighting alone can never raise a level.

3.5 Assessment
- Question bank: at least 6 scenario-based questions per skill (48 minimum), each with 4 options, exactly one best answer, an explanation, and a difficulty tag. Scenarios describe realistic situations (for example the symptoms of an N+1 query in a JPA repository) and ask what the developer would investigate or change, not for textbook definitions. Be technically accurate; state in docs that the team must review all questions before the pilot.
- 3 questions per attempt (configurable 2-3), randomly selected, not repeating the previous attempt's questions where possible. Pass threshold: score >= 0.66 (2 of 3). Scoring is server-side and deterministic. Never send correct answers or explanations before submission; return explanations after submission.

3.6 Challenge-to-skill mapping (Verified applies ONLY to mapped skills)
- Challenge 1 (JWT-authenticated REST endpoint): REST controller design, JWT issuance and validation, Spring Security configuration.
- Challenge 2 (fix seeded bugs): structured exception handling, transaction management, input validation.
- Challenge 3 (REST + database CRUD): REST controller design, JPA/Hibernate persistence, input validation.
- Unit tests with meaningful assertions: no challenge verifies it. Its maximum level is Supported. Show this limitation in the UI.

3.7 Anti-gaming
- Flags have severity BLOCKING (evidence excluded from level computation) or WARNING (shown prominently, still counted). Never delete or hide flagged evidence; always show the flag, the reason and the effect on the level.
- Unmodified or near-unmodified fork (GitHub fork flag plus the user's CONFIRMED Java lines below configurable limits, default under 20% of Java lines or under 50 lines): BLOCKING.
- Tutorial similarity: normalised token k-gram fingerprints with winnowing; flag when the containment of the repository's fingerprints in any single reference project is >= 0.60 (configurable): BLOCKING. Wording must say "similar to X", never "plagiarised".
- Single large initial commit (default: the first commit contributes >= 80% of current Java lines): WARNING.
- Authorship cross-check: evidence on non-CONFIRMED lines is excluded (the CONFIRMED rule in 3.2).
- Reference corpus: store fingerprints only, not source. Seed with fingerprints of well-known public Spring starter and tutorial projects, for example spring-projects/spring-petclinic and the spring-guides "gs-*" repositories. Verify that each URL actually resolves; record repository, commit SHA and licence in docs/reference-corpus.md. Provide a documented way to add more.

3.8 Credentials
- Issued for any skill at Observed or higher; the credential states the level. Valid for at most 12 months and never beyond the earliest expiry of the evidence supporting the level. If a recomputation drops the skill below the credential's level, mark the credential REVOKED or SUPERSEDED automatically.
- VC-style JSON: id, type, issuer, issuance timestamp, validUntil, credentialSubject (subject id, GitHub login, skill, level, evidence summary, evidence digest), proof (algorithm Ed25519, created, verificationMethod URL, canonicalisation rule, base64url signature). Canonicalise with JSON Canonicalization Scheme (RFC 8785) using a vetted library; test that re-serialisation is stable and that tampering with any field breaks verification.
- Keys: generate with openssl (Ed25519), store outside the repo, load from an environment-configured path (file mode 600), gitignored. Publish the public key at a public endpoint. Never expose the private key.
- Verification checks the signature AND the server-side status (ACTIVE, REVOKED, EXPIRED, SUPERSEDED). Describe it as "VC-style". Do not claim full W3C Verifiable Credentials or Open Badges compliance.

3.9 Sharing
- Per-skill share grants with a random 256-bit token (crypto.randomBytes, base64url; only its SHA-256 hash is stored), default expiry 30 days, revocable at any time with immediate effect. A share exposes only that skill's level, evidence summary (repository GitHub URL, file path, line range, detector, timestamp, link to the blob at the commit SHA) and flags. It must not expose other skills, the full profile or code excerpts. Rate-limit public endpoints. Return distinct, clear responses for unknown, expired and revoked shares.

3.10 Roles
- Developer: authenticated, can access only their own data. Employer/viewer: unauthenticated, read-only via share link or credential verification. Maintainers: update content (questions, challenges, reference fingerprints) through versioned seed content and documented scripts; no admin UI. Blind expert reviewers are research participants only, not system users.

## 4. REQUIREMENT REGISTER (docs/requirements.md must track each; reference the report section)

R1 GitHub OAuth sign-in with read-only access (s5, s10, s17)
R2 Public repository listing, selection, cloning (s10)
R3 Line-level authorship from commit history (s10)
R4 Flag unmodified forks and tutorial-like histories (s10)
R5 Eight AST detectors with file, line, pattern per finding (s11)
R6 Evidence store: source, file, line, timestamp (s14)
R7 Scenario question bank, 2-3 questions per attempt (s12)
R8 Rubric scoring, threshold promotes to Supported (s12)
R9 Docker sandbox: no network, CPU/memory/time limits (s13)
R10 Three practical challenges graded by hidden JUnit (s13)
R11 Four-level evidence engine linked to evidence (s15)
R12 Recency weighting (s15)
R13 Tutorial similarity check (s16)
R14 Large-initial-commit check (s16)
R15 Authorship cross-check on supporting lines (s16)
R16 Signed per-skill credential (s17)
R17 Employer verification of credential or shared profile (s17)
R18 Per-skill revocable sharing (s17)
R19 Deletion of stored evidence on request (s17)
R20 Dashboard: level and evidence per skill, developer and employer views (s5, s14)
R21 Assessment and challenge interfaces (s14)
R22 Skill-graph view (s14) - NOT BUILT, documented as unclear in the report
R23 Claimed skills input (s15, s18)
R24 Application authentication and authorisation with JWT (s19.1)
R25 Docker deployment and GitHub Actions CI (s19.1)
R26 Pilot evaluation support (s18)

## 5. ARCHITECTURE AND STACK

- Monorepo using npm workspaces: skillproof/{frontend, backend, sandbox-runner, shared, docs, scripts, .github/workflows, docker-compose.yml, .env.example, .gitignore, README.md}. The shared package holds TypeScript types, the eight skill slugs, level enums and zod schemas used by frontend and backend.
- Runtime: a currently supported Node.js LTS (22 or newer). TypeScript in strict mode everywhere. ESLint + Prettier. Lockfile committed.
- Frontend: React + TypeScript + Vite, React Router, TanStack Query, plain CSS variables or CSS modules. The Vite dev proxy forwards /api to the backend so cookies are same-origin.
- Backend: Express 5 (use 4 only if a required middleware is incompatible) with TypeScript, zod for request validation, helmet, express-rate-limit, pino logging with redaction of tokens, cookies and authorisation headers, a central error handler, and OpenAPI documentation generated from the zod schemas (for example zod-to-openapi) served at /api/docs.
- Database: MongoDB (official image, currently supported major version) with Mongoose and strict schemas. Run MongoDB as a single-node replica set in Docker Compose (with an initialisation step) so multi-document transactions are available. Use transactions for level-snapshot writes, credential issuance with status changes, and deletion; elsewhere prefer single-document atomic updates. Set sanitizeFilter and validate every input with zod so objects can never be injected where strings are expected (NoSQL injection). Use unique and compound indexes for ownership, dedupe keys and token hashes.
- Migrations and seeds: migrate-mongo with versioned, idempotent migrations (indexes, collections) and a seeder for content (stable keys, content version).
- Application authentication: after GitHub OAuth succeeds, issue an application JWT (jose library, short expiry with refresh handled server-side) in an HttpOnly, SameSite=Lax cookie (Secure in production), with CSRF protection for state-changing requests (cookie-to-header token or custom-header check). Keep OAuth state validation enabled.
- Java parsing: tree-sitter-java, via web-tree-sitter (WASM, no native compilation) or the native tree-sitter binding, whichever installs and runs reliably on Ubuntu. In Phase 1, run a spike proving it parses modern Java syntax (records, switch expressions, text blocks, sealed classes, annotations) on fixture files; if it fails, fall back to the pure-JavaScript `java-parser` package and record the decision in docs/architecture.md. Run analysis in worker threads (for example piscina) or a child process so CPU-heavy parsing never blocks the API event loop.
- Git: the git CLI invoked only with execFile and argument arrays (never a shell string), minimal environment, GIT_TERMINAL_PROMPT=0, no hooks, no submodules, no LFS.
- Jobs: an in-process bounded-concurrency queue (for example p-queue) with job documents persisted in MongoDB. On startup, mark orphaned RUNNING jobs as FAILED with a retryable reason. No Redis or message brokers.
- Sandbox runner: a SEPARATE Node/Express service (sandbox-runner/) that owns Docker access. It runs on the Ubuntu host, not inside Compose, listens on localhost only, authenticates the backend with a shared secret (HMAC-signed requests), has no access to the application database, secrets or signing keys, and returns structured results. It invokes Docker through execFile with argument arrays or dockerode. The backend never has Docker access and never executes submitted code. Java and Maven exist only inside the challenge image, not on the host.
- Docker Compose: MongoDB replica set for development, and optional containers for backend and frontend. Document the runner being host-side as a deliberate security decision.
- Testing tools: Vitest (backend, shared, frontend), React Testing Library, Supertest, Testcontainers for Node (MongoDB) with mongodb-memory-server (replica set mode) as a fallback, nock or MSW to stub the GitHub API, Playwright for end-to-end.
- Do not add microservices, paid APIs, cloud services, GPUs or an LLM. List the reason for every extra dependency in docs/architecture.md and run npm audit in CI.

## 6. MODULE SPECIFICATIONS

6.1 Ingestion (R2)
- Clone full history (needed for blame) into a temporary workspace per job. Safety: no hooks, no submodules, no LFS, no credential prompts, reject symlinks that leave the workspace, enforce repository size, file count, file size and clone-timeout caps, prevent path traversal. Never run builds or scripts from the cloned repository. Delete workspaces after the job and via a periodic cleanup of stale directories.
- Analyse only .java files under src/main and src/test; skip build output and vendored directories. Job states: QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED, with progress, error message and retry.

6.2 Detectors (R5). One module per capability, each independently testable, using the tree-sitter syntax tree (catch parse errors per file and record them without aborting the run). The parser gives syntax only, so build a repository-wide index of declared types and resolve annotation and type names through imports and same-package rules; where a name is ambiguous or unresolved, mark the finding UNCERTAIN and exclude it from Observed. Each finding records: user, skill, repository, file path, start and end line, detector name and version, matched pattern description, key attributes, attribution status, commit SHA/date, analysis job, timestamp, "what this shows", and "what this does NOT prove". Qualifying criteria (an annotation or import alone is never enough):
1 rest-controller-design: @RestController (or @Controller with @ResponseBody) with >=2 handler methods mapped to different HTTP verbs, at least one binding input via @PathVariable/@RequestParam/@RequestBody, and a non-void return. Record ResponseEntity/@ResponseStatus use. Does not prove API design quality.
2 jpa-hibernate-persistence: an @Entity with @Id AND either a Spring Data repository interface parameterised on that entity or EntityManager persist/merge/find/createQuery used on it. Record relationships, fetch types, @Query. Does not prove correct mapping or performance.
3 spring-security-configuration: a configuration class with @EnableWebSecurity or a SecurityFilterChain bean whose HttpSecurity configuration contains at least one request-authorisation rule (authorizeHttpRequests, requestMatchers, authenticated, hasRole, hasAuthority, permitAll). Record PasswordEncoder, method security, CSRF/CORS/session settings, custom filters. Does not prove the configuration is secure.
4 jwt-issuance-validation: issuance (token builder plus signing call with expiry or claims) and/or validation (signature verification whose failure prevents authentication) using a recognised API (jjwt, auth0 java-jwt, Nimbus, Spring JwtEncoder/JwtDecoder). Record issuance/validation/both, filter integration, expiry checks, and whether the signing secret is a literal (informational). Does not prove secure key management.
5 structured-exception-handling: a @RestControllerAdvice/@ControllerAdvice class with >=2 @ExceptionHandler methods returning a structured body or status (ResponseEntity, ProblemDetail, DTO with @ResponseStatus) AND >=1 custom exception type declared in the repository and thrown elsewhere. Does not prove all errors are covered or that information is not leaked.
6 unit-tests-meaningful-assertions: >=3 non-disabled test methods (@Test, @ParameterizedTest, @RepeatedTest) each with >=1 non-trivial assertion (JUnit Assertions, AssertJ, Hamcrest, Mockito verify, MockMvc andExpect, assertThrows) on a value or behaviour obtained from a call into non-test code. Exclude empty tests, assertTrue(true) and assertNotNull on a freshly constructed object. Record assertion counts and mock usage. Does not prove coverage.
7 transaction-management: @Transactional (Spring or Jakarta) on a non-controller class or method that performs >=1 persistence write (save, saveAll, delete, persist, merge, executeUpdate) or >=2 persistence operations, or TransactionTemplate.execute. Record readOnly, propagation, isolation, rollbackFor. Does not prove correct transaction boundaries.
8 input-validation: a class with Bean Validation constraint annotations (NotNull, NotBlank, Size, Min, Max, Email, Pattern and similar) on fields or record components AND enforcement through that class being a @Valid/@Validated parameter in a handler or service method, or an explicit Validator.validate call. Record constraint types and whether validation errors are handled. Does not prove validation is complete.
Deduplicate findings by (user, skill, repository, file, line range, detector, commit SHA). Guard any regular expressions against catastrophic backtracking (ReDoS) and cap file sizes.

6.3 Anti-gaming (R4, R13-R15) per 3.7, with configurable thresholds, structured flags (type, severity, repository, explanation, effect on levels) and a UI explanation. Build a reproducible evaluation harness (scripts/) that measures detection on seeded cloned submissions made from the reference corpus with controlled modifications. Label its output "synthetic fixture results", never "pilot results".

6.4 Evidence engine (R6, R11, R12) per 3.3-3.4. Recompute whenever evidence, claims or attempts change and when evidence expires. Every awarded level returns evidence IDs; every non-advancement returns the specific missing requirements. Failed attempts stay in history. Exclude BLOCKING-flagged, non-CONFIRMED and expired evidence.

6.5 Assessments (R7, R8, R21): per 3.5, with attempt history, answer feedback after submission, and backend-enforced availability and cool-down rules.

6.6 Challenges and sandbox (R9, R10)
- Each challenge defines: instructions, a starter Spring Boot project, whitelisted editable files, mapped skills, hidden JUnit tests, time and resource limits, pass criteria, result storage and cleanup.
- Submission: an in-browser code editor (CodeMirror or Monaco, or a plain code textarea) that edits ONLY whitelisted starter files, with size limits. No zip or archive uploads (avoids zip-slip and similar attacks).
- Challenge 1 tests: login with valid and invalid credentials, protected endpoint with no token, valid token, expired token and tampered token, token contains subject and expiry. Challenge 2: about five seeded bugs touching exception handling, transactions and validation (for example wrong HTTP status in a handler, swallowed exception, missing rollback, missing validation). Challenge 3: CRUD with validation errors (400), missing resources (404) and persistence verified through the repository, using H2 inside the sandbox. Tests use MockMvc so no network port is required.
- Runner flow: the backend sends challenge id and whitelisted file contents; the runner creates a fresh working directory, merges the submission into the starter, adds the hidden tests, builds OFFLINE (mvn -o) inside a prepared image, runs the tests, kills on timeout, and returns structured results (test name, pass/fail, sanitised message, duration). Hidden tests live only inside sandbox-runner/ and are never sent to the backend, the frontend or any log. Do not return assertion messages that reveal expected values from hidden tests.
- Container hardening (all required): non-root user; no network; read-only root filesystem; all capabilities dropped; no-new-privileges; process, memory, memory-swap, CPU, file-descriptor and disk limits (size-limited tmpfs for the work directory); unique container names and labels; hard wall-clock kill; forced removal after success, failure, timeout or cancellation; a reaper that removes stale labelled containers and work directories. Prefer rootless Docker if available. Document that membership in the docker group is root-equivalent for the runner host.
- Build a challenge image (JDK 17 + Maven + a pre-populated local repository with every dependency the starters and hidden tests need) and prove it works by running the build with the network disabled.
- Residual risk to document honestly: code under test runs in the same JVM as the hidden tests, so a determined submitter could try to read the test classes. Mitigate (mount only compiled tests, only at grading time, restrict editable files, limit output) and list it under known limitations.

6.7 Credentials and sharing (R16-R18) per 3.8-3.9. Provide credential issue, download, public key, verify-by-id and verify-by-pasted-JSON endpoints. Tampering with any field must make verification fail.

6.8 Privacy and deletion (R19)
- Explicit, versioned consent (timestamp stored) before the first repository analysis. Two actions: "Delete my analysis data" (evidence, attempts, claims, repository records, workspaces, share grants; credentials become REVOKED with a minimal tombstone so verification reports "revoked") and "Delete my account" (additionally removes the user record and stored tokens). Explain that a copy of an already-downloaded credential cannot be recalled, only its server-side status revoked. Write docs/privacy.md including retention rules: no repository clone is kept after analysis.

6.9 Content and evaluation support (R26)
- Seed the skill catalogue, questions, challenge metadata and reference fingerprints from versioned content files through the idempotent seeder. Document how maintainers update them in docs/maintaining-content.md.
- Provide a script or endpoint exporting REAL results for pilot users with pseudonymised IDs (claimed skills, levels, evidence counts, flags), plus a blank template for blind expert ratings and an analysis script that computes agreement only on real data. Never generate sample participants or results.

## 7. DATA MODEL (MongoDB collections via Mongoose; migrate-mongo creates indexes)

users (with GitHub identity); encrypted tokens; consents; skills (the eight, with stable slugs: rest-controller-design, jpa-hibernate-persistence, spring-security-configuration, jwt-issuance-validation, structured-exception-handling, unit-tests-meaningful-assertions, transaction-management, input-validation); userSkillClaims; repositories; analysisJobs; fileAttributions (one document per analysed file holding its attributed line ranges, with commit SHA, date and status); evidenceRecords (type STATIC/ASSESSMENT/CHALLENGE, validity status, attribution status, weight inputs, unique dedupe key, job reference, attempt references); antiGamingFlags; referenceFingerprints; assessmentQuestions (options embedded); assessmentAttempts (responses embedded); challenges; sandboxRuns (sanitised logs); skillLevelSnapshots; credentials with status; shareGrants (token hash unique, revocation fields); deletionRequests; auditEntries. Embed data that is always read and written together and bounded in size; reference otherwise; never let a document approach the 16 MB limit. Every query on user data must include the authenticated principal's userId in the filter, enforced in a data-access layer, never taken from the client. Store timestamps in UTC. TTL indexes may be used only for temporary data. Document the model, indexes and any deliberate denormalisation in docs/database-design.md.

## 8. API (docs/api-specification.md plus OpenAPI)

Cover: auth and current user; consent; public repository listing and selection; start and poll analysis jobs; skills, levels and evidence with reasons; claims; anti-gaming flags; assessments (start, submit, history); challenges (list, detail, submit, result); credentials (issue, list, download, revoke); share grants (create, list, revoke); public verification and public shares; privacy settings and deletion. Use zod-validated request bodies, one common error format, correct HTTP status codes, pagination for lists, and authorisation on every protected route. Never return stack traces, tokens, hidden tests, keys or internal file paths.

## 9. FRONTEND (R20, R21, R23)

Routes: /login, /dashboard, /repositories, /analysis/:id, /skills/:skillId, /assessments/:skillId, /challenges, /challenges/:challengeId, /credentials, /verify/:credentialId, /privacy (you may refine; document the final routes). Dashboard: profile, repositories and analysis progress, eight skill cards with level badge, evidence source and timestamp, flags, assessment and challenge status, credentials and sharing. Skill detail page: why the level was awarded, supporting evidence with GitHub links to file and line, what is still missing, flags and their effect, next action, and the limitation notes. The public verification page works without login. Use real backend data only. Provide loading, empty, error and success states; confirmation before destructive actions; responsive layout; accessible contrast and keyboard-operable controls; consistent level badges. Show the report's limitation statement ("levels describe evidence strength, not a guarantee of on-the-job performance").

## 10. SECURITY (document in docs/security-design.md with threats, mitigations and residual risks)

OAuth state and callback protection; secrets only from environment variables or files outside the repo, validated at startup; HTTPS in production; zod validation on every input and output encoding; NoSQL injection prevention (strict schemas, sanitizeFilter, reject operator objects such as $ne or $gt in inputs); prototype-pollution protection (never merge untrusted objects into other objects, reject __proto__ and constructor keys); object-level authorisation on every record; rate limiting for login, analysis start, assessment and challenge submission and public endpoints; strict repository-name validation and no arbitrary fetching; command-injection-safe process execution (execFile with argument arrays only, no shell); path-traversal and symlink protection; no archive extraction of user input; no eval or dynamic code execution; deliberate CORS configuration; secure cookie flags and CSRF protection; helmet with a strict content-security policy; no tokens or sensitive code in logs; least-privilege containers; npm audit in CI. Do not claim production-grade security.

## 11. TESTING (write tests with each phase; record real results in docs/test-report.md)

- Backend unit (Vitest): every detector (a positive and a negative fixture each, including near-miss cases such as an import with no usage), level transitions (table-driven, including failure, expiry and flagged-evidence cases), attribution rules, anti-gaming flags, scoring, recency weighting, credential sign/verify/tamper, authorisation, validation and error handling.
- Backend integration (Supertest + Testcontainers MongoDB replica set): migrations and indexes, protected routes and user isolation, analysis of local fixture repositories (create fixture git repos with scripted multi-author histories, forks, single-commit histories and a seeded tutorial clone), evidence and dashboard data, assessment flow, sharing and immediate revocation, deletion, transactions.
- GitHub in tests: stub OAuth and the GitHub API (nock or MSW) so the real OAuth and attribution code paths are exercised. Do not add a production-reachable authentication bypass.
- Sandbox tests: a passing submission, a failing submission, a timeout, an attempted network call, a memory bomb, a fork bomb or process-limit breach, hidden-test isolation, and cleanup after each failure. If Docker is unavailable, report exactly which tests could not run.
- Frontend (Vitest + React Testing Library): routing, form validation, auth states, loading and error states, dashboard rendering, assessment interaction, sharing and revocation.
- End-to-end (Playwright, against a stubbed GitHub): sign in, consent, select repository, analyse, inspect evidence, claim a skill, pass assessment, submit challenge, see Verified for mapped skills only, issue and verify a credential, tamper and fail verification, share and revoke, request deletion and confirm cleanup.
- Ordinary automated tests must not need real user credentials.

## 12. PHASES (stop and wait for "continue" after each)

Phase 1 Foundation: monorepo layout, planning docs (docs/requirements.md, architecture.md, database-design.md, api-specification.md, security-design.md, implementation-plan.md, testing-plan.md, assumptions.md, deviations.md), Express and React skeletons, MongoDB replica set via Compose, migrate-mongo baseline, .env.example, CI skeleton, prerequisite-check script, and the tree-sitter parsing spike (Section 5). Done when: backend starts, frontend reaches the backend, migrations succeeds, CI runs, and the parser spike result is recorded.
Phase 2 Authentication and data model: GitHub OAuth, application JWT cookie, CSRF, user isolation, claims, skill catalogue, consent. Ask me for GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET at this phase (I create the OAuth app; callback http://localhost:8080/api/auth/github/callback, adjust if the port or route differs). Until supplied, verify with stubs and report real GitHub login as pending.
Phase 3 Ingestion and authorship: repository listing and selection, safe cloning, blame, GitHub login resolution, jobs and cleanup. Done when a fixture repository is analysed reproducibly with correct attribution.
Phase 4 Detectors, evidence and anti-gaming: all eight detectors with positive and negative tests, evidence persistence, the three anti-gaming checks, reference corpus.
Phase 5 Evidence engine and dashboard: Claimed and Observed first, snapshots, dashboard and skill detail pages with real data.
Phase 6 Assessments: question bank (48+), selection, scoring, history, Supported level, UI.
Phase 7 Sandbox and challenges: runner, offline challenge image, hardening, Challenge 1 end to end first, then Challenges 2 and 3; Verified only for mapped skills. Check `docker run --rm hello-world` works for my user; if not, mark BLOCKED with the exact fix instructions.
Phase 8 Credentials and sharing: Ed25519 key tooling, issue, verify, public key, shares, revocation, automatic supersession.
Phase 9 Privacy and hardening: deletion flows, retention, rate limits, error handling, accessibility pass, security tests.
Phase 10 Final verification: run every feasible test suite, clean-machine setup check using only the README, requirement-by-requirement review against Section 4, evaluation-support scripts, final documentation.

## 13. UBUNTU SETUP

Provide scripts/check-prereqs.sh and README instructions for Node.js LTS (via nvm or NodeSource), npm, Git, build-essential (only if a native module is used), Docker Engine (and adding my user to the docker group, with the security note), and MongoDB via Compose. Provide: .env.example with placeholders only; GitHub OAuth app registration steps; database initialisation and migration commands; commands to run backend, frontend and sandbox-runner; commands to build the offline challenge image; test commands; signing-key generation (openssl Ed25519); and troubleshooting for ports, MongoDB replica-set start-up, OAuth callback mismatch and Docker permission errors. Do not assume Docker is installed or that my user may access it. Never write real secrets into files.

## 14. DEFINITION OF DONE AND FINAL HANDOVER

Done only when: frontend and backend build and lint cleanly; migrations run; real GitHub OAuth is configured (or marked BLOCKED); public repositories can be selected and analysed; all eight detectors have positive and negative tests; evidence is persisted and traceable; the engine implements all four levels per Section 3; assessments are scored server-side; challenges run in real isolation with hidden tests; credentials verify cryptographically and fail when tampered; per-skill sharing and revocation work; deletion works and is tested; the dashboard uses real data; setup and API docs exist; every runnable test suite has been executed and its results recorded.

Final report must contain: (1) implemented modules; (2) status of R1-R26 using the status vocabulary; (3) actual build and test results; (4) tests not run and why; (5) required environment variables; (6) exact Ubuntu commands to start everything; (7) GitHub OAuth setup; (8) database initialisation; (9) API documentation location; (10) known bugs, limitations and security risks (including the hidden-test residual risk, spoofable commit emails, syntax-only static analysis, the unverifiable unit-test skill, the missing skill-graph view, and the stack deviation from the report); (11) a step-by-step demonstration script for my college review; (12) features that are IMPLEMENTED but not yet independently verified; (13) a mapping from each report requirement to the feature and the test that covers it.

BEGIN WITH PHASE 1 ONLY. Inspect the workspace, create the planning documents and requirement checklist, build the foundation, run the checks, report, and stop.
