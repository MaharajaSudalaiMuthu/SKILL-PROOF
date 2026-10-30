# SkillProof Assumptions and Design Decisions (MERN Edition)

This document records architectural defaults, operational assumptions, and decisions derived from Section 3 and Section 1A of the Master Prompt (`docs/MASTER_PROMPT.md`), resolving any ambiguities in accordance with the project requirements.

---

## 1. System Defaults and Configuration (`skillproof` Zod Namespace)

All numeric thresholds, timeouts, and rate limits are defined and validated at startup using Zod in the `shared` module:

- `skillproof.github.apiBaseUrl`: Default `https://api.github.com`. Test profile allows local nock/MSW fixture stubs.
- `skillproof.github.cloneBaseUrl`: Default `https://github.com`. Test profile allows local file fixture overrides.
- `skillproof.github.maxShasResolved`: Default `100` commits per repository.
- `skillproof.github.rateLimitBackoffMs`: Default `1000` ms on 403/429 responses.
- `skillproof.attribution.minConfirmedRatio`: Default `0.50` (50% of non-blank lines in finding range must be CONFIRMED).
- `skillproof.level.observed.minFindings`: Default `2` distinct qualifying findings.
- `skillproof.level.observed.minRepos`: Default `1` repository without a BLOCKING flag.
- `skillproof.level.observed.minRecencyWeight`: Default `1.0`.
- `skillproof.recency.halfLifeMonths`: Default `12.0` (weight = $0.5^{\text{age\_in\_months} / 12}$).
- `skillproof.assessment.questionsPerAttempt`: Default `3` (range 2-3).
- `skillproof.assessment.passThreshold`: Default `0.66` (2 of 3 questions).
- `skillproof.assessment.retakeCooldownHours`: Default `24` hours.
- `skillproof.challenge.retakeCooldownHours`: Default `1` hour.
- `skillproof.antiGaming.forkMinLines`: Default `50` Java lines.
- `skillproof.antiGaming.forkMinRatio`: Default `0.20` (20% of Java lines).
- `skillproof.antiGaming.initialCommitRatio`: Default `0.80` (80% of current Java lines in first commit triggers WARNING).
- `skillproof.antiGaming.tutorialSimilarityThreshold`: Default `0.60` (60% winnowing k-gram containment triggers BLOCKING).
- `skillproof.credential.validityMonths`: Default `12` months.
- `skillproof.share.defaultExpiryDays`: Default `30` days.
- `skillproof.security.tokenEncryptionKey`: 32-byte hex string from `ENCRYPTION_SECRET_KEY` (AES-256-GCM via Node `crypto`).
- `skillproof.security.signingKeyPath`: Path to Ed25519 private key (file permissions 600).

---

## 2. GitHub Access & Token Scope Restrictions

- GitHub OAuth uses minimal scope: read-only access (`read:user`).
- No write permissions, no repository management scopes (`repo`), and no email scopes are requested.
- Stored OAuth access tokens are encrypted at rest using AES-256-GCM (Node.js `crypto.createCipheriv`) with a unique 12-byte IV and 16-byte authentication tag per record.
- Only public GitHub repositories (`github.com/<owner>/<repo>`) are eligible for analysis. Private repositories are strictly out of scope.

---

## 3. Authorship Attribution Logic

- Git blame is executed using `execFile('git', ['blame', '--porcelain', ...])` to extract unique commit SHAs.
- Each SHA is resolved to a GitHub author login via the GitHub Commits API (`/repos/{owner}/{repo}/commits/{ref}`).
- Attributed line range statuses:
  - `CONFIRMED`: Commit author login exactly matches the authenticated user's GitHub login.
  - `UNCERTAIN`: No linked GitHub login could be resolved for the SHA.
  - `OTHER`: Resolved to a different GitHub login.
- Commit author email and name headers from Git commit logs are treated as untrusted metadata (since Git commits can be forged). Only GitHub-verified logins from the API are considered.
- A finding is considered `CONFIRMED` only when at least 50% of the non-blank lines within its line range have `CONFIRMED` status.

---

## 4. Evidence Levels & Pure Deterministic Engine

- **Claimed**: User explicitly declared the skill. No automated evidence required.
- **Observed**: Requires $\ge 2$ distinct qualifying findings from $\ge 1$ unblocked repository, with total recency weight $\ge 1.0$. Does not require a prior Claimed level.
- **Supported**: Offered only when skill is at Observed; awarded on passing the scenario-based assessment ($\ge 66\%$ score).
- **Verified**: Offered only when skill is at Supported; awarded on passing a practical coding challenge mapped to that skill.
- Cumulative invariant: If an underlying level condition expires or is invalidated (e.g. static evidence ages out), higher levels are invalidated or marked superseded/revoked.
- **Pure Function**: The engine is implemented as a pure TypeScript function:
  $$\text{computeSkillLevels}(\text{evidence}, \text{claims}, \text{config}, \text{now}) \longrightarrow (\text{levels}, \text{reasons}, \text{evidenceIds}, \text{missingRequirements})$$
  No database queries occur inside the engine function.
- **Unit Tests with Meaningful Assertions**: Verified is unattainable because no practical sandbox challenge is mapped to unit testing. Maximum attainable level is `Supported`. This limitation is surfaced explicitly in the UI and documentation.

---

## 5. Host Sandbox Runner Architecture & Security Rationale

- The sandbox runner is a standalone Node.js/Express service (`sandbox-runner/`) listening exclusively on `127.0.0.1:8081`.
- The runner executes on the Ubuntu host with access to Docker Engine (`/var/run/docker.sock`).
- The primary backend application running in Docker Compose has **no** Docker socket access and cannot execute host or container commands directly.
- Communication between backend and sandbox-runner is authenticated using HMAC-SHA256 request signatures over a shared secret (`SANDBOX_RUNNER_SECRET`).
- Runner executes student code in hardened, non-root, read-only rootfs, zero-network Docker containers with strict CPU, memory, and wall-clock execution limits.

---

## 6. Out of Scope Features (Future Scope)

The following items mentioned in preliminary or generic project materials are explicitly declared out of scope per Section 2 of the Master Prompt:
- Private repository ingestion.
- Programming languages other than Java.
- Employer enterprise accounts and recruitment workflows.
- Role-fit matching engine.
- Full administrative management UI (all content is version-seeded).
- LLM-based code grading or assessment generation.
- Cloud-native deployment (Kubernetes, AWS/GCP services).
- "Skill-Graph" visualization (not defined in project report; documented under known gaps).
