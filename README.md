# SkillProof: Multi-Source Evidence-Based Developer Capability Verification Platform

SkillProof is a developer capability verification platform focusing on eight defined Java and Spring Boot capabilities. It produces an auditable, multi-source evidence trail per skill through a 4-tier cumulative progression pipeline:

$$\textbf{Claimed} \longrightarrow \textbf{Observed} \longrightarrow \textbf{Supported} \longrightarrow \textbf{Verified}$$

SkillProof combines public GitHub repository static analysis, scenario-based technical assessments, and sandboxed Docker practical challenges graded by hidden test suites, resulting in Ed25519-signed verifiable credentials.

> **Academic Project Reference**:
> Department of Computer and Communication Engineering, V.S.B. Engineering College, Karur.
> Implemented on the **MERN (TypeScript) stack** (MongoDB, Express, React, Node.js 22 LTS). All deliberate stack refinements are recorded in [`docs/deviations.md`](docs/deviations.md).

---

## 1. System Requirements & Prerequisites

The following software is required on the Ubuntu host:
- **Node.js**: v22 LTS (v20+ supported)
- **npm**: v10+ (included with Node.js)
- **Git**: v2.30+
- **Docker Engine**: v24+ with Docker Compose v2 (required for sandbox execution & production deployment)

### 1.1 Automated Prerequisite Check
Run the included verification script:
```bash
./scripts/check-prereqs.sh
```

### 1.2 Manual Ubuntu Installation Commands
```bash
# Update package index and install Git & curl
sudo apt update && sudo apt install -y curl git build-essential

# Install Node.js LTS (v22) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker Engine & Compose plugin
sudo apt install -y docker.io docker-compose-v2

# Grant non-root user Docker socket access
sudo usermod -aG docker $USER
# (Log out and log back in for group changes to take effect)
```

> [!WARNING]
> **Docker Security Note**: Membership in the `docker` group provides root-equivalent privilege on the host system. The host `sandbox-runner/` service uses this access strictly to execute hardened, network-isolated, read-only containers.

---

## 2. Quickstart & Installation

### 2.1 Clone and Install Monorepo Dependencies
```bash
git clone <repository_url> skillproof
cd skillproof
npm install
```

### 2.2 Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Generate an AES-256 encryption key and Ed25519 signing key pair:
```bash
# Generate 32-byte hex key for at-rest token encryption
openssl rand -hex 32

# Generate Ed25519 private key for VC credential signatures
mkdir -p keys
openssl genpkey -algorithm ed25519 -out keys/ed25519-private.pem
chmod 600 keys/ed25519-private.pem
```

---

## 3. Database Initialisation & Migrations

SkillProof requires a MongoDB replica set (`rs0`) for multi-document ACID transactions.

### Option A: Via Docker Compose (Recommended)
```bash
docker compose up -d mongodb mongodb-init
```

### Option B: Local In-Memory Fallback (No Docker Required)
If Docker permissions are pending or you are running in an isolated environment:
```bash
npm run mongo:local
```

### Execute Database Migrations
Run `migrate-mongo` to initialize collections, unique constraints, and compound indexes:
```bash
npm run migrate:up -w backend
```
To verify migration status:
```bash
npm run migrate:status -w backend
```

---

## 4. Running the Platform Services

### 4.1 Development Mode (All Services)
In separate terminal windows:
```bash
# 1. Start Express Backend (Port 8080)
npm run dev:backend

# 2. Start React Frontend (Port 5173 with /api dev proxy)
npm run dev:frontend

# 3. Start Sandbox Execution Runner (Host 127.0.0.1:8081)
npm run dev:runner
```
Open **`http://localhost:5173`** in your browser.

---

## 5. Automated Testing & Verification

```bash
# Execute Java AST Parser Spike (Validates modern Java syntax)
npm run spike:parser

# Typecheck all TypeScript workspaces
npm run typecheck

# Run unit and integration test suites
npm run test

# Build all monorepo packages for production
npm run build
```

---

## 6. GitHub OAuth Application Setup (Phase 2 Preparation)

1. Navigate to **GitHub Settings** $\rightarrow$ **Developer Settings** $\rightarrow$ **OAuth Apps** $\rightarrow$ **New OAuth App**.
2. Set **Application Name**: `SkillProof Developer Verification`
3. Set **Homepage URL**: `http://localhost:5173`
4. Set **Authorization callback URL**: `http://localhost:8080/api/auth/github/callback`
5. Save and copy `Client ID` and `Client Secret` into your `.env` file:
   ```env
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```

---

## 7. Troubleshooting

- **EADDRINUSE (Port 8080 or 5173 already in use)**:
  Identify and terminate the occupying process:
  ```bash
  lsof -i :8080
  kill -9 <PID>
  ```
- **Docker Permission Denied (`/var/run/docker.sock`)**:
  Ensure user belongs to the `docker` group (`sudo usermod -aG docker $USER`) or run `npm run mongo:local` for the standalone MongoDB replica set.
- **MongoDB Connection Refused (`127.0.0.1:27017`)**:
  Ensure either `docker compose up -d mongodb` or `npm run mongo:local` is running and healthy.
- **OAuth Callback Mismatch**:
  Verify the GitHub OAuth App callback URL matches `http://localhost:8080/api/auth/github/callback` exactly.
