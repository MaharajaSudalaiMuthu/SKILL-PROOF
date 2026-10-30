# SkillProof Architectural Stack Deviations

> [!IMPORTANT]
> **Project Guide / Supervisor Review Note**:
> The project report submitted for the V.S.B. Engineering College Capstone (Dept. of Computer and Communication Engineering) specifies a reference stack comprising Java, Spring Boot, Spring Security, PostgreSQL, JavaParser, and Flyway.
> By student choice and architecture refinement, this implementation is built on the **MERN (TypeScript) stack** (MongoDB, Express, React, Node.js) while maintaining all verification behavior, eight Java/Spring Boot capability detectors, anti-gaming algorithms, sandboxed Docker challenges, and cryptographic credential integrity.
> **These deviations require formal review and acknowledgement from the project guide.**

---

## 1. Summary of Deliberate Deviations

| Reference Component (Report) | Adopted MERN Component | Technical Rationale & Operational Consequence |
|---|---|---|
| **Spring Boot 3 + Spring Security** | **Node.js (v22 LTS) + Express 5 + TypeScript** | Unified TypeScript codebase across frontend, backend, shared validation schemas (`zod`), and AST analysis rules. Simplifies full-stack type safety and reduces deployment footprint while maintaining strict security via HttpOnly JWT session cookies and CSRF headers. |
| **PostgreSQL Relational DB** | **MongoDB (v7+) with Mongoose** | Document-oriented storage with schema validation. Document embedding is utilized for atomic, bounded sub-objects (assessment options, attempt responses, attributed line ranges) while referencing is used for unbounded collections. Multi-document transactions enabled via a single-node replica set. |
| **JavaParser (with symbol solver)** | **tree-sitter-java (via web-tree-sitter / tree-sitter)** | High-performance concrete syntax tree (CST) parsing in Node.js. **Limitation**: Tree-sitter performs syntax-level parsing without JVM classpath symbol resolution; type disambiguation relies on a repository-wide index of declared types and lexical import analysis. Ambiguous types are flagged `UNCERTAIN`. |
| **Java Cryptography Architecture (JCA)** | **Node.js Native `crypto` Module** | Ed25519 asymmetric key pair generation, RFC 8785 canonical JSON serialization, and cryptographic signing/verification performed directly using Node.js built-in OpenSSL-backed cryptographic primitives. |
| **Flyway Database Migrations** | **migrate-mongo** | Version-controlled, idempotent schema initialization, index creation (unique, compound, and TTL), and data collection migrations managed in JavaScript/TypeScript. |

---

## 2. Invariant Capabilities Preserved

Despite the host framework transition, all domain behavior specified in the college project report remains identical:
1. **Target Analysed Language**: Remains **Java and Spring Boot**. Detectors parse and evaluate Java source files (`.java`).
2. **Practical Challenges**: Starters and hidden grading suites remain **Spring Boot 3 Maven projects** executing inside isolated Docker containers.
3. **Four Evidence Levels**: Exact transition requirements ($\text{Claimed} \rightarrow \text{Observed} \rightarrow \text{Supported} \rightarrow \text{Verified}$).
4. **Three Anti-Gaming Checks**: Unmodified fork detection, Winnowing token k-gram similarity ($\ge 0.60$), and single large initial commit check ($\ge 80\%$).
5. **W3C VC-Style Signed Credentials**: Ed25519 signature over deterministic RFC 8785 canonical JSON payloads with independent verification.
6. **Privacy & GDPR-Aligned Rights**: Immediate per-skill share revocation, analysis data purging, and full account deletion.
