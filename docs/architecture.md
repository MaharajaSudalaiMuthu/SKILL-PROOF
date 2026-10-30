# SkillProof Architecture Document (MERN Edition)

## 1. System Overview

SkillProof is a multi-source evidence-based developer capability verification platform focusing on eight defined Java and Spring Boot competencies. It transforms raw developer activity and repository code into a cryptographically signed, evidence-backed skill profile through a deterministic four-tier progression pipeline:

$$\text{Claimed} \longrightarrow \text{Observed} \longrightarrow \text{Supported} \longrightarrow \text{Verified}$$

```
+-------------------------------------------------------------------------------------------------+
|                                          SkillProof Platform                                    |
|                                                                                                 |
|   +-------------------+          +----------------------------------------------------------+   |
|   |  React Frontend   |  /api    |            Express + TypeScript Backend                  |   |
|   |  (Vite + TS +     +--------->+ - Auth (GitHub OAuth, JWT HttpOnly Cookie, CSRF)         |   |
|   |   TanStack Query) |  (Proxy) | - Ingestion & Safe Git Clone Worker (execFile array)     |   |
|   +-------------------+          | - Git Blame & Authorship Attribution Engine              |   |
|             ^                    | - Tree-sitter Java AST Detectors (8 Capabilities)        |   |
|             |                    | - Anti-Gaming Checks (Forks, Winnowing, Initial Commit)  |   |
|             | imports            | - Deterministic Evidence Engine & Recency Decay          |   |
|             v                    | - Assessment Engine (Scenario Bank, Rubric Scoring)      |   |
|   +-------------------+          | - VC-Style Credential Issuer (Node crypto Ed25519)       |   |
|   |  shared Package   |          | - Revocable Sharing & Privacy Deletion Service           |   |
|   |  (Types, Zod      |          | - OpenAPI / Swagger Documentation (/api/docs)            |   |
|   |   Schemas, Enums) |          +-------------+-----------------------------+--------------+   |
|   +-------------------+                        |                             |                  |
|             ^                                  |                             |                  |
|             +----------------------------------+                             v (HMAC Auth)      |
|                                                v                         +---+--------------+   |
|                                  +-------------+-----------+             | Host Sandbox     |   |
|                                  |   MongoDB (Replica Set) |             | Runner (Node.js) |   |
|                                  |   (Mongoose, Strict     |             | 127.0.0.1:8081   |   |
|                                  |    Schemas, TX Support) |             +---+--------------+   |
|                                  +-------------------------+                 |                  |
|                                                                              v (execFile / API) |
|                                                                  +-----------+--------------+   |
|                                                                  | Isolated Hardened Docker |   |
|                                                                  | Containers (No Network,  |   |
|                                                                  | Read-Only Root, Limits)  |   |
|                                                                  +--------------------------+   |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Monorepo Architecture & Workspaces

The repository is organized as an npm workspace monorepo:

```
skillproof/
├── shared/                      # Isomorphic library (Node & Browser)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types/               # Skill slugs, level enums, evidence models
│       ├── schemas/             # Zod validation schemas for requests/responses
│       └── constants/           # Global capability definitions and thresholds
├── backend/                     # Express 5 + TypeScript REST API
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── auth/                # GitHub OAuth2, JWT cookie issuance, CSRF
│   │   ├── user/                # User profile, consent management
│   │   ├── repository/          # Repository catalog, safe git clone operations
│   │   ├── authorship/          # Porcelain blame & commit-login resolution
│   │   ├── detector/            # 8 Tree-sitter Java AST detectors
│   │   ├── antigaming/          # Fork checks, winnowing token containment, large commits
│   │   ├── evidence/            # Evidence persistence & 4-tier level engine
│   │   ├── assessment/          # Scenario question bank, attempt management, scoring
│   │   ├── challenge/           # Practical challenge submission coordinator
│   │   ├── sandbox/             # Client proxy to host sandbox-runner
│   │   ├── credential/          # Ed25519 canonical JSON VC issuance & verification
│   │   ├── sharing/             # Per-skill random hashed token share grants
│   │   ├── privacy/             # Consent recording, data wipe, account deletion
│   │   ├── config/              # Zod-validated application configuration
│   │   └── middleware/          # Helmet, rate-limit, auth, error handling
│   └── migrations/              # migrate-mongo scripts for collections and indexes
├── frontend/                    # Single-page application
│   ├── package.json
│   ├── vite.config.ts           # Development dev-server with /api reverse proxy
│   └── src/                     # Views, components, API client, hooks, CSS
├── sandbox-runner/              # Host-side execution daemon
│   ├── package.json
│   ├── src/
│   │   ├── server.ts            # Localhost-only Express server
│   │   ├── docker.ts            # Docker execution service via execFile
│   │   └── security.ts          # HMAC-SHA256 signature middleware
│   └── challenges/              # Hidden test suites and challenge starter bundles
├── docs/                        # Architecture, API, security, test reports
├── scripts/                     # Operational scripts (check-prereqs, seed, evaluation)
├── .github/workflows/           # GitHub Actions CI workflow definitions
├── docker-compose.yml           # Local dev services (MongoDB single-node replica set)
├── .env.example                 # Environment variable templates (no secrets)
├── .gitignore                   # Ignored files (secrets, build outputs, clones)
└── README.md                    # Setup, running, and verification instructions
```

---

## 3. Core Technical Decisions

### 3.1 Asynchronous Job Processing via In-Process Queue
Repository ingestion, git blame resolution, and AST analysis are executed asynchronously. Rather than introducing external queue infrastructure (such as Redis or BullMQ), jobs are tracked within the `analysisJobs` MongoDB collection and processed by a bounded `p-queue` instance with configurable concurrency. On startup, orphaned `RUNNING` jobs are detected and transitioned to `FAILED` with retryable metadata.

### 3.2 Java Parsing Architecture & Phase 1 Spike Result
Java files are parsed into concrete syntax trees using `java-parser` (with Tree-sitter WASM evaluated). In the Phase 1 parser spike (`scripts/spike-java-parser.ts`), `java-parser` was executed against a comprehensive Java 17 fixture (`scripts/fixtures/ModernJavaSample.java`) and verified 100% compliance across modern language syntax:
- Java 17 Sealed Interfaces (`sealed interface ... permits ...`)
- Java 16 Records with Bean Validation annotations (`record PaymentRequest(...)`)
- Java 15 Multi-line Text Blocks (`"""..."""`)
- Java 17 Switch Expressions with pattern matching and `yield`
- Spring Framework annotations (`@RestController`, `@PostMapping`, `@Transactional`, `@Valid`)

As established in the spike, `java-parser` provides pure JavaScript AST/CST generation without requiring native node-gyp bindings or external WASM files, making it completely stable and portable across all Ubuntu environments while eliminating CPU-blocking via worker threads. Semantic symbol resolution is handled by constructing a repository-wide type symbol index mapping class declarations and package imports.

### 3.3 Data Isolation & Authorization
Every protected endpoint queries MongoDB using a filter that strictly includes the authenticated `userId` extracted from the verified application JWT. Mongoose schemas utilize `sanitizeFilter: true` to eliminate NoSQL injection risks.

---

## 4. Host Sandbox Runner Architecture & Security Rationale

1. **The Backend Never Touches Docker**: The primary backend web application runs without Docker socket privileges (`/var/run/docker.sock`).
2. **Localhost Binding & HMAC Authentication**: The runner binds exclusively to `127.0.0.1:8081`. Requests from the backend must carry an `X-Signature-SHA256` header calculated using a shared secret (`SANDBOX_RUNNER_SECRET`).
3. **No Database Access**: The sandbox runner has no MongoDB connection or credentials.
4. **No Signing Key Access**: The Ed25519 private keys used for credential signing are accessible exclusively by the backend credential module.
5. **Hidden Test Isolation**: Hidden JUnit test files reside exclusively in `sandbox-runner/challenges/` on the host. They are never transmitted over HTTP.

---

## 5. Justified Extra Tools

In strict accordance with Section 5 of the Master Prompt, every additional library or tool added beyond the standard framework is explicitly justified:

| Tool | Purpose & Justification |
|---|---|
| **zod & zod-to-openapi** | Provides runtime type validation for all incoming requests and outgoing responses in `shared`, and automatically generates OpenAPI 3.0 documentation at `/api/docs`. |
| **migrate-mongo** | Provides deterministic, version-controlled MongoDB schema initialization and index creation (unique, compound, TTL). |
| **tree-sitter-java** | Fast, concrete syntax tree parsing for Java source files directly in Node.js without requiring a host Java runtime for static analysis. |
| **jose** | Standards-compliant, lightweight JWT generation and verification in Node.js using modern Web Cryptography API standards. |
| **canonicalize (RFC 8785)** | Implements JSON Canonicalization Scheme (JCS) to produce deterministic byte representations for cryptographic Ed25519 signing. |
| **p-queue** | In-process bounded concurrency job queue avoiding external Redis or message broker dependencies. |
| **express-rate-limit** | Protects sensitive endpoints (login, analysis dispatch, assessment submissions, public verification) from denial-of-service abuse. |
| **pino & pino-http** | High-performance structured JSON logging with automatic redaction of secrets, tokens, authorization headers, and cookies. |
| **Vitest & React Testing Library** | Modern, fast TypeScript unit and integration testing across shared, backend, and frontend packages. |
| **Testcontainers for Node / MongoMemoryServer** | Provides isolated MongoDB instances during integration testing. |
| **Playwright** | Performs end-to-end browser testing of critical user flows against stubbed GitHub APIs. |
