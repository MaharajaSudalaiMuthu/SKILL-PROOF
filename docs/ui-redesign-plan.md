# SkillProof — Premium Frontend UI Redesign Plan

## 1. Overview & Objective
Transform the SkillProof user interface into a refined, high-performance developer SaaS product combining:
- **SaaSUI Dashboard Layouts**: Clean information hierarchy, persistent shell, contextual headers, balanced padding.
- **Linear's Visual Refinement**: Micro-interactions, crisp 1px borders (`#E5E7EB`), restrained semantic badges, neutral typographic contrast.
- **Vercel's Developer-Focused Interface**: Clean monospace code tags (`SFMono`, `ui-monospace`), branch/commit metadata pills, fast responsive tabs.

## 2. Color Palette & Token Architecture
- **Main Canvas**: `#F8FAFC`
- **Surface Primary**: `#FFFFFF`
- **Surface Secondary**: `#F1F5F9`
- **Text Primary**: `#111827`
- **Text Secondary**: `#64748B`
- **Primary Accent**: `#4F46E5` (Hover: `#4338CA`, Subtle tint: `#EEF2FF`)
- **Neutral Border**: `#E5E7EB`
- **Semantic Statuses**:
  - Success: `#15803D` (Subtle bg: `#F0FDF4`, Border: `#BBF7D0`)
  - Warning: `#B45309` (Subtle bg: `#FEF3C7`, Border: `#FDE68A`)
  - Error: `#B91C1C` (Subtle bg: `#FEF2F2`, Border: `#FECACA`)

## 3. Scope & Strict Preservation
- **Frontend Presentation Only**: No changes to backend APIs, schemas, controllers, business logic, or authentication.
- **No Mock or Fabricated Data**: Preserve every real endpoint, data binding, state hook, and prop contract.
- **Full Route & Feature Coverage**:
  1. `frontend/src/index.css` — Global design tokens, typography, button/card primitives, table/form controls, modal backdrop/container.
  2. `frontend/src/App.tsx` — 64px header, Linear-style subnav tabs, institutional banner, brand logo, user identity menu, public verify button.
  3. `frontend/src/components/DashboardView.tsx` — Developer identity hero, 5-level stat counters, anti-gaming banner, canonical capabilities 8-card grid.
  4. `frontend/src/components/RepositoriesView.tsx` — GitHub-style repository cards, branch tags, Java language dot (`#b07219`), blame line attributions accordion, and import modal.
  5. `frontend/src/components/SkillDetailView.tsx` — Breadcrumbs, level badge, evidence audit trail with line ranges and GitHub links, two-column next action cards, anti-gaming disclosures.
  6. `frontend/src/components/AssessmentRunnerModal.tsx` — Clean scenario modal, question counter, code snippet context block, 4-option cards, countdown pill, question-by-question technical rubric.
  7. `frontend/src/components/ChallengeWorkspaceModal.tsx` — Dark IDE editor workspace with file tabs, countdown timer, instructions/console toggle, JUnit test output logs.
  8. `frontend/src/components/ConsentModal.tsx` — GDPR Article 6(1)(a) consent modal with clean bullets and confirmation action.
  9. `frontend/src/components/CredentialModal.tsx` — Signed digital credential card with Ed25519 signature details, download JSON button, online verify button.
  10. `frontend/src/components/ShareSkillModal.tsx` — 256-bit revocable token generator with expiration select and revocable share links list.
  11. `frontend/src/views/PrivacySettingsView.tsx` — Ephemeral workspace disclosures, data inventory stat cards, tier 1 & 2 deletion controls with typed confirmation modal.
  12. `frontend/src/views/EvaluationView.tsx` — Faculty pilot evaluation suite, zero-PII export (JSON/CSV), 5x5 confusion matrix with Cohen's Kappa interpretation.
  13. `frontend/src/views/PublicVerifyView.tsx` — Standalone public verification interface with Ed25519 signature validation pills and credential payload breakdown.
  14. `frontend/src/views/PublicShareView.tsx` — Standalone shared capability view with level badge, code evidence trail, and anti-gaming integrity checks.

## 4. Verification Plan
- Build check: `npm run build -w frontend` (Vite + TypeScript).
- Run server and verify endpoints over live public HTTPS tunnel.
