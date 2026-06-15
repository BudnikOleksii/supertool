---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-10'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/review-rubric.md
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/reconcile-brief.md
  - _bmad-output/planning-artifacts/briefs/brief-supertool-2026-06-09/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-supertool-2026-06-09/addendum.md
  - example/track-my-life/CLAUDE.md (reference)
  - example/tracker-backend-api/CLAUDE.md (reference)
workflowType: 'architecture'
project_name: 'supertool'
user_name: 'Oleksii'
date: '2026-06-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Operator pre-decisions (captured at initialization, 2026-06-09)

- **No cross-app shared session — FR2 overridden by operator.** Users sign in to each tool app separately. The PRD's FR2 ("one session works across all platform apps") is superseded by this decision; PRD update to follow via correct-course/PRD edit.
- **Single shared account, multiple concurrent sessions (confirmed).** One users table, one API, same credentials everywhere. Multiple sessions per app are allowed (e.g., one from mobile, one from laptop).
- **better-auth lives in the NestJS API (confirmed).** This resolves the "where auth lives" half of the PRD's top blocking question. The Next.js tool apps are auth *clients* of the API. Remaining design work for the auth decision step: session validation mechanics (cookie/token handling between Next.js apps and the NestJS-hosted better-auth), better-auth's NestJS integration approach, and how the generated OpenAPI client handles auth.
- **New `packages/widgets` package (confirmed).** A monorepo package for reusable widgets shared across tool apps; first occupant: auth widgets (sign-in/sign-up) so each app reuses the same login UX without session sharing.

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

20 FRs in 6 groups, two architectural centers of gravity:

- **Platform (F1, FR1–FR5)**: email+password auth via better-auth, shared shell package (navigation, user menu, locale switcher), minimal profile settings (name, default currency, locale). Per operator pre-decision: sessions are per-app (FR2 overridden), accounts are shared, auth UI ships as reusable widgets. FR4 is the platform's acceptance gate: a hypothetical `apps/planner` must be addable via configuration only — this document must demonstrate that walkthrough.
- **Money Tracker (F2–F4, FR6–FR16)**: transaction CRUD with filters/sorting (type, category; date/amount sort), hierarchical categories with reassignment-on-delete (no orphaned data, FR12), dashboard with summary/breakdown/12-month trend. All figures are scoped to the user's single profile-default currency (FR5) — no currency picker on lists or dashboard (simplified 2026-06-15). Aggregations stay per-currency in SQL for correctness; no cross-currency aggregation in v1.
- **Data & i18n (F5–F6, FR17–FR20)**: idempotent seed of 1,880 real transactions with exact preservation and category derivation; decimal-safe money math asserted by tests; EN+UK locales with per-user persistence and CI-enforced key parity.

**Non-Functional Requirements:**

- **NFR1/NFR2 (process)**: tests merge with their feature; oxlint, oxfmt, type-check, stylelint, commitlint, CodeRabbit on every PR; no eslint/prettier anywhere. Architecture must make the test infrastructure (frontend + backend) a foundation-level concern.
- **NFR3 (runtime)**: everything runs locally via Docker (PostgreSQL + apps), single documented startup command, seed included in startup intent. No deployment target in v1.
- **NFR4 (privacy)**: private repo, real financial seed committed, zero external telemetry/analytics — constrains any third-party service choices to "none."
- **NFR5 (performance anchor)**: daily-entry flow — form in one interaction, submit-to-visible without full page reload. Shapes the transaction-entry component and data-mutation strategy.
- **NFR6 (API contract)**: frontend talks to the API only through the client generated from the NestJS OpenAPI spec; hand-written fetches are defects. Generation pipeline and its Turborepo build ordering are architectural.
- **NFR7 (design system)**: shared UI package + Storybook; screens follow the approved example-app UX patterns.
- **NFR8 (mobile)**: daily entry and transaction list fully usable in a mobile browser; responsive layout, no PWA/native.

**Scale & Complexity:**

- Primary domain: full-stack web monorepo (Next.js 16 tool apps + NestJS API)
- Complexity level: medium — single operator, no real-time/multi-tenant/compliance demands; rigor concentrates in process traceability, contract discipline, and money correctness
- Estimated architectural components: 2 apps (money-tracker, api) + ~7 packages (shell, widgets, ui, shared, next-shared-equivalent, lint/stylelint/ts configs) + Storybook + CI pipeline + seed subsystem; API modules: auth, users/profile, transactions, categories, analytics, seed/import

### Technical Constraints & Dependencies

- **Stack locked (ED4)**: Next.js 16 / React 19 / TypeScript / SCSS · next-intl · NestJS · Drizzle ORM + PostgreSQL · better-auth · pnpm + Turborepo · Docker (local) · @hey-api/openapi-ts from NestJS Swagger. Architecture decides *how*, not *whether*.
- **Operator pre-decisions (recorded at init)**: better-auth hosted in the NestJS API; per-app sessions, multiple concurrent sessions per user allowed; shared account store; `packages/widgets` for reusable auth UI.
- **ED1 (rebuild, don't copy)**: `example/` repos are reference-only and never committed; patterns may be carried (controller/service/repository layering, package layout, design-system approach), code may not.
- **ED3 (carried configuration)**: oxlint/oxfmt/stylelint configs, commitlint/husky/lint-staged, merged CI workflows, merged `.coderabbit.yaml`, merged AI setup (CLAUDE.md, skills, agents, commands, rules, hooks, MCP) — exact dependency versions throughout.
- **Known risks inherited**: oxlint friction on decorator-heavy NestJS code (budget a story); seed category strings may need normalization surfaced at import; scope gravity toward the ~80%-complete examples.

### Cross-Cutting Concerns Identified

1. **Auth boundary**: better-auth in NestJS serving multiple Next.js apps — session validation mechanics, generated-client auth handling, and the widgets package all touch it.
2. **Money representation**: decimal-safe storage and arithmetic must be uniform across DB schema, ORM mapping, API DTOs, and frontend display — a single convention every AI agent follows.
3. **API contract pipeline**: OpenAPI spec → generated client → consuming apps; build ordering, regeneration triggers, and drift prevention.
4. **i18n**: every user-facing string localized (EN/UK), per-user locale persistence, CI key-parity gate — spans shell, widgets, ui, and tool apps.
5. **Package boundaries (FR4)**: what lives in shell vs. widgets vs. ui vs. shared determines whether tool #2 is "registration only" — the central structural decision.
6. **Test strategy per layer**: money math, import integrity, auth — across NestJS units, API integration, and frontend components, wired into CI from the first story.
7. **Mobile responsiveness**: daily-entry flow and list usable on phone browsers — affects component and layout decisions in ui/widgets.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web monorepo (Next.js tool apps + NestJS API) under pnpm + Turborepo — determined by the locked stack (ED4) and platform requirements (FR3/FR4).

### Starter Options Considered

- **External starters/templates (rejected)**: official Turborepo examples and community NestJS+Next.js starters were ruled out by the operator — most are outdated, and none match the project's tooling posture (oxlint/oxfmt instead of eslint/prettier, SCSS instead of Tailwind, generated API client). Source: operator decision, 2026-06-10.
- **`example/track-my-life` as structural blueprint (selected)**: a proven, working monorepo with the exact target stack and conventions. Per ED1 it is reference-only — the structure and configuration approach are *rebuilt*, code is never copied. The backend blueprint is `example/tracker-backend-api` (module/controller/service/repository layering), to be recreated as an app inside the same monorepo.

### Selected Starter: Custom scaffold following the `example/track-my-life` blueprint

**Rationale for Selection:**

The example repo already embodies every structural decision this project needs (workspace layout, package boundaries, turbo task graph, config-package pattern), is known to work with the locked stack, and the operator is satisfied with its conventions. An external starter would import foreign decisions we'd immediately strip out. The only delta from the blueprint: all dependency versions bumped to latest stable (verified against the npm registry, 2026-06-10) and the structure extended with `apps/api` (NestJS) and `packages/widgets` (operator pre-decision).

**Initialization Command:**

No generator CLI, no new directory or `git init` — the repository already exists (BMad artifacts committed at root). The first implementation story scaffolds the workspace in the existing root:

```bash
# in the existing repo root:
# pnpm-workspace.yaml: apps/*, packages/*
# turbo.json: task graph (build, dev, lint, lint:fix, type-check, test, stylelint, fmt)
# Root package.json: engines pinned, packageManager pinned, exact versions only
pnpm install
```

Target workspace shape (extends the blueprint):

```
apps/
  money-tracker/        # Next.js 16 tool app
  api/                  # NestJS API (better-auth host)  ← new vs blueprint
  storybook/            # component playground
packages/
  shell/                # platform shell (nav, user menu, locale switcher)  ← new vs blueprint
  widgets/              # reusable cross-app widgets (auth first)           ← new vs blueprint
  ui/                   # design-system components (Radix-based)
  shared/               # constants, types, generated API client
  next-shared/          # Next.js-specific shared code (i18n routing, providers)
  lint-config/          # oxlint config
  stylelint-config/
  typescript-config/
```

(Exact package set is confirmed in the architectural decisions step — listed here as the blueprint-derived starting point.)

**Versions: blueprint vs. latest stable (npm registry, verified 2026-06-10):**

| Package | Example repo | Latest stable | Note |
|---|---|---|---|
| next | 16.2.2 | **16.2.7** | npm `latest` tag points at 16.3.0-preview.0 — pin stable 16.2.7 |
| react / react-dom | 19.2.3 | **19.2.7** | |
| typescript | 5.9.3 (FE) / 6.0.3 (BE) | **6.0.3** | unify on 6.0.3 monorepo-wide |
| next-intl | 4.8.2 | **4.13.0** | |
| @nestjs/core | 11.1.19 | **11.1.26** | NestJS 12 (ESM, oxlint, Vitest) lands ~Q3 2026 — stay on v11, migration is a future epic |
| drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 | **0.45.2 / 0.31.10** | already latest |
| better-auth | n/a (example uses JWT/Passport) | **1.6.15** | NestJS integration via community module (`@thallesp/nestjs-better-auth`, requires ≥1.5.0) — decided in auth step |
| turbo | 2.5.8 | **2.9.17** | |
| @hey-api/openapi-ts | (in shared pkg) | **0.98.2** | |
| oxlint / oxfmt | 1.42.0 / 0.26.0 | **1.69.0 / 0.54.0** | |
| stylelint | 16.25.0 | **17.13.0** | major bump — config review needed |
| husky / lint-staged | 9.1.7 / 16.2.6 | **9.1.7 / 17.0.7** | |
| @commitlint/cli | 20.4.1 | **21.0.2** | |
| zod | 4.3.6 | **4.4.3** | |
| react-hook-form | 7.71.1 | **7.78.0** | |
| sass | 1.93.3 | **1.100.0** | |
| pg | 8.20.0 | **8.21.0** | |
| pnpm | 10.10.0 | **11.5.2** | major bump — verify Turborepo 2.9 compat at scaffold time |
| node (engines) | 22.15.0 | 22.x LTS line | pin the current 22.x LTS patch at scaffold time |

**Architectural Decisions Provided by the Blueprint:**

- **Language & Runtime**: TypeScript everywhere (strict), Node 22 LTS, ESM-leaning; exact versions, no `^`/`~`.
- **Styling**: SCSS with stylelint; no CSS frameworks.
- **Build Tooling**: Turborepo task graph with caching; per-package builds; `build:packages` for libraries.
- **Testing**: *not provided* — the blueprint has 0% coverage; the test infrastructure is a deliberate break designed fresh in the decisions step (NFR1).
- **Code Organization**: apps/packages split; config-as-package pattern (`lint-config`, `typescript-config`, `stylelint-config`); feature-based organization inside apps; controller/service/repository layering in the API (from the backend blueprint).
- **Development Experience**: `pnpm dev` via turbo, husky + lint-staged + commitlint hooks, format-on-save via oxfmt.

**Note:** Project initialization following this blueprint is the first implementation story. NestJS 12's announced direction (oxlint, Vitest, ESM) validates the tooling bet but we ship on stable v11.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Money representation (D1) — blocks schema, DTOs, stats, seed
- Auth session mechanics (D5) — blocks auth stories, widgets, generated-client config
- DTO validation / OpenAPI source (D3) — blocks API scaffolding and client generation
- OpenAPI → client pipeline (D8) — blocks frontend data layer

**Important Decisions (Shape Architecture):**
- Seed idempotency (D2), primary keys (D4), roles (D6), API conventions (D7), frontend data flow (D9), test stack (D10)

**Deferred Decisions (Post-MVP):**
- Redis caching (PRD-deferred) · cross-currency aggregation · NestJS 12 / ESM migration (re-evaluate D3 then) · Playwright e2e suite (config slot reserved, no suite in v1) · deployment target

### Data Architecture

- **D1 — Money: `numeric(14,2)` + string transport + SQL aggregation.** Postgres `numeric` columns; all stats computed as SQL aggregations (exact); API DTOs carry amounts as strings; frontend formats via `Intl.NumberFormat`; `decimal.js` 10.6.0 only where app-level arithmetic is unavoidable (e.g., seed-total verification). **Rule for AI agents: amounts are never `number` in JS — parse/emit strings; never use float arithmetic on money.** Affects: schema, DTOs, analytics module, seed tests (FR18).
- **D2 — Seed idempotency: content hash.** `import_key` = SHA-256 of normalized source record + source row index, unique-indexed; insert via `ON CONFLICT DO NOTHING`. Survives category restructuring (FR11); re-run safety is a test target (FR17). Near-duplicate category strings surfaced in import report, never silently merged.
- **D3 — Validation: class-validator + @nestjs/swagger CLI plugin** (@nestjs/swagger 11.4.4) for DTOs → OpenAPI; zod 4.4.3 for env validation (and frontend forms). Rationale: spec quality is load-bearing (NFR6); blueprint-proven. Revisit at NestJS 12 epic.
- **D4 — Primary keys: UUIDv7**, generated app-side, for all entities — time-ordered and index-friendly.
- **Migrations: drizzle-kit 0.31.10** `generate` + `migrate` (blueprint pattern); schema lives in `apps/api/src/database/schemas/`, one file per table; shared enums derive from Drizzle schema enums (single source of truth).
- **Caching: none in v1** (Redis is a deferred epic).

### Authentication & Security

- **D5 — Same-origin proxy sessions.** Each Next.js app rewrites `/api/*` → NestJS API; better-auth (1.6.15) mounted in Nest via `@thallesp/nestjs-better-auth` 2.6.1 (the integration documented by better-auth; requires disabling Nest's body parser for auth routes). Cookies are per-app-origin → per-app sessions by construction (FR2 override); one shared account store; multiple concurrent sessions per user supported natively by better-auth's session table.
- **D6 — Roles from day one (operator decision).** `role` enum (`user`, `admin`) on the users table; role guard + `@Roles()` decorator in API shared layer. v1 ships **no admin features** — the infrastructure exists so a future admin panel (default-category management etc.) is an additive epic. Default role: `user`; promotion via DB/seed only in v1.
- **Authorization pattern:** every domain row carries `user_id`; repositories scope every query by the authenticated user; guards authenticate + (where marked) check role. No cross-user access paths in v1.
- **Security posture:** no telemetry/external services (NFR4); secrets via env files, zod-validated at boot; auth rate limiting noted as the one hardening item worth carrying from the example (differentiated auth vs general endpoints).

### API & Communication Patterns

- **D7 — REST conventions:** URI versioning `/api/v1/...` from day one · global exception filter emitting `{ statusCode, code, message, details? }` with a shared error-code enum (exposed through OpenAPI) · offset pagination `{ data, meta: { page, limit, total } }` · DELETE → 204 · controller/service/repository layering, repository is the only DB-touching layer.
- **D8 — Contract pipeline:** API build emits `openapi.json` artifact → turbo task in `packages/shared` runs @hey-api/openapi-ts 0.98.2 → **generated client committed**; CI regenerates and fails on diff (drift gate). Hand-written fetches to API routes are defects (NFR6).

### Frontend Architecture

- **D9 — RSC + server actions** (blueprint pattern): reads are plain async functions in RSC; mutations are server actions; both wrap the generated client server-side, forwarding the session cookie. `revalidatePath` after mutations satisfies NFR5 (submit-to-visible, no reload). No global state library — URL search params carry filter/period state; react-hook-form 7.78.0 + zod for forms; next-intl 4.13.0 for i18n.
- Shell consumed as `packages/shell` layout component; auth UI from `packages/widgets`; design-system primitives from `packages/ui` (framework-agnostic, props-driven).

### Infrastructure & Deployment

- **Local-only runtime (NFR3):** docker compose = PostgreSQL 16 + api + web; documented single command runs compose with migrate + seed executing on api startup (idempotent by D2, satisfying "dashboard meaningful day one"). Native `pnpm dev` remains the inner dev loop.
- **Env config:** per-app zod-validated env schemas (blueprint backend pattern); `.env` files git-ignored, `.env.example` committed.
- **Logging:** Pino 10.3.1 in API; console-only, no external sinks (NFR4).
- **CI (ED3):** merged GitHub Actions — lint (oxlint), fmt-check (oxfmt), type-check, stylelint, build, i18n key parity, **test job (new)**, client-drift gate (D8). Husky + lint-staged + commitlint locally.

### Testing Strategy

- **D10 — Vitest 4.1.8 everywhere**: API (SWC decorators), packages, frontend components (@testing-library/react 16.3.2). **Testcontainers 12.0.1** for repository/seed/auth integration tests against real Postgres. Playwright: deferred epic (config slot reserved). Priority targets per NFR1: money math (D1 invariants), seed integrity (D2 re-run, totals, category derivation), auth/session scoping (D5/D6).

### Decision Impact Analysis

**Implementation Sequence:** scaffold workspace (step-3 blueprint) → DB schema + migrations (D1, D4, D6) → better-auth mounting + proxy (D5) → OpenAPI pipeline (D3, D7, D8) → seed (D2) → frontend data layer (D9) → CI completion (D10 wired throughout, test infra lands with the first feature story).

**Cross-Component Dependencies:** D1 threads schema→DTO→client→UI formatting (string-typed amounts everywhere) · D5 + D9 interlock: server actions must forward per-app cookies through the proxy path · D3 feeds D8 — DTO decoration quality determines generated client quality · D6 touches D2: seed assigns the operator's account; role promotion is a seed concern · D10's Testcontainers setup is reused by D2's integrity tests.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points identified:** 12 areas where AI agents could plausibly diverge (naming ×4, structure ×3, formats ×3, process ×2), each pinned below.

### Naming Patterns

**Database (Drizzle schemas):**
- Tables: `snake_case`, plural — `users`, `transactions`, `transaction_categories`
- Columns: `snake_case` in SQL, camelCase TS properties via Drizzle mapping — `user_id` ↔ `userId`
- Foreign keys: `<entity>_id` (`user_id`, `category_id`); enums in `schemas/enums.ts`, single source of truth for shared TS enums
- Schema files: kebab-case plural, one table per file — `transaction-categories.ts`, plus `index.ts` barrel
- Indexes: `<table>_<column(s)>_idx`; unique: `<table>_<column>_unique`

**API:**
- Endpoints: plural kebab-case resources, URI-versioned — `/api/v1/transactions`, `/api/v1/transaction-categories`
- Route params: `:id` (UUIDv7); query params camelCase — `?categoryId=&sortBy=date&sortOrder=desc`
- JSON fields: **camelCase** everywhere (requests, responses, error envelopes)
- OpenAPI `operationId`: `<resource><Action>` camelCase — `transactionsCreate`, `transactionsFindAll` (drives generated client method names)

**Code:**
- Files & directories: **kebab-case** — `format-category-display-name.ts`; exception: component files and their co-located `.module.scss`/`.test.tsx`/`.stories.tsx` are PascalCase after the component — `TransactionForm.tsx`, `TransactionForm.module.scss`
- Components: PascalCase export AND PascalCase file, one component per kebab-case directory — `components/transaction-form/TransactionForm.tsx` exporting `TransactionForm`
- Backend modules: `<module>.module.ts` / `.controller.ts` / `.service.ts` / `.repository.ts` / `.types.ts` / `.constants.ts`, `dtos/` subfolder
- Functions/variables: camelCase; constants UPPER_SNAKE_CASE; types/interfaces PascalCase, no `I` prefix
- Server actions: verb-first kebab-case files — `create-transaction.ts`; read functions `fetch-*` (plain async), mutations `'use server'`

### Structure Patterns

**Project organization:**
- Frontend apps: type-level dirs `actions/`, `components/`, `constants/`, `hooks/`, `utils/`, `i18n/`, `app/[locale]/` — feature grouping happens *inside* `components/<feature-component>/`
- Shared-code placement follows the blueprint decision table: multi-app → `packages/shared`; framework-free UI → `packages/ui`; Next-specific shared → `packages/next-shared`; cross-app widgets → `packages/widgets`; app-wide single-app → `apps/<app>/src/constants|actions`; single feature → stays in the feature directory
- API: `src/app/` (bootstrap, env), `src/database/` (schemas, migrations, seeds, data), `src/modules/<module>/`, `src/shared/` (guards, decorators, dtos, enums, utils)

**Tests:** co-located with the code under test — API: `<name>.spec.ts` beside the source; frontend/packages: `<name>.test.ts(x)` beside the source; Testcontainers integration tests: `apps/api/test/integration/*.integration.spec.ts`. No `__tests__/` directories.

**Config:** root-level tool configs (`.oxlintrc.json`, `.oxfmtrc.json`, `stylelint.config.js`, `commitlint.config.ts`, `turbo.json`); per-package `tsconfig.json` extending `packages/typescript-config`; env schemas in `src/app/env.schema.ts` (API) / `src/env.ts` (Next apps).

### Format Patterns

**API responses:**
- Success: direct resource or `{ data, meta }` for paginated lists — no universal wrapper
- Errors (D7): `{ statusCode, code, message, details? }`; `code` from the shared error-code enum; 204 for DELETE; 201 + body for create
- Money (D1): amounts are **strings** in every DTO — `"1234.56"`, dot separator, two decimals, no thousands separators

**Dates:** transaction dates are calendar dates, not instants — Postgres `date` column, `"YYYY-MM-DD"` strings in DTOs, no timezone math on them. Timestamps (`createdAt`, `updatedAt`) are `timestamptz`, ISO 8601 UTC strings in JSON. UI formats both via next-intl/`Intl` — never `toLocaleDateString` ad-hoc.

**i18n:** message files per locale per app/package (`messages/en.json`, `messages/uk.json`); keys nested camelCase by feature — `transactions.form.amountLabel`; no string concatenation for sentences (use ICU interpolation); EN is the reference locale for the CI parity check.

### Process Patterns

**Error handling:**
- API: throw Nest `HttpException` subclasses with the shared error code; the global exception filter is the only place shaping error JSON; repositories throw domain errors, never HTTP errors
- Frontend: server actions return a discriminated `ActionState` (`{ status: 'success' | 'error', code?, message? }`) — never throw across the server-action boundary; user-facing messages resolved from i18n by `code`, never raw API messages; route-level `error.tsx` boundaries per app
- Logging: Pino in API only; `console.*` is lint-forbidden in app code

**Loading & mutation states:**
- Reads: RSC + Suspense boundaries with skeleton components (no spinner-flags in client state)
- Mutations: `useActionState` / `useTransition` pending flags; submit buttons disabled while pending; `revalidatePath` after success (D9)

### Enforcement Guidelines

**All AI agents MUST:**
1. Treat money as strings end-to-end (D1) — a `number`-typed amount is a defect
2. Call the API only via the generated client (NFR6) — a hand-written `fetch` to `/api/*` is a defect
3. Touch the DB only from repositories; controllers never call repositories directly
4. Add every user-facing string to *both* locale files in the same commit (FR20 gate will fail otherwise)
5. Ship tests in the same story as the feature (NFR1)
6. Use exact dependency versions; never introduce eslint/prettier
7. Never import from `example/` or copy its code (ED1)

**Enforcement:** oxlint/stylelint/commitlint + CI gates (i18n parity, client-drift, tests) catch most violations mechanically; the rest are named defects in CodeRabbit review instructions (`.coderabbit.yaml` path rules). Pattern changes happen by editing this document first, code second.

### Pattern Examples

**Good:** `apps/api/src/modules/transactions/transactions.repository.ts` exposing `findAllByUserId(userId, filters)`; component `packages/widgets/src/components/sign-in-form/sign-in-form.tsx` exporting `SignInForm`, labels via props/i18n.

**Anti-patterns:** `parseFloat(transaction.amount)` · `fetch('/api/v1/transactions')` in a component · `Users.tsx` PascalCase file · SQL in a service · `new Date('2025-03-02')` on a transaction date (TZ shift bug) · hardcoded English string in JSX.

## Project Structure & Boundaries

### Complete Project Directory Structure

```
supertool/                              # existing repo root
├── package.json                        # turbo scripts, engines/packageManager pinned
├── pnpm-workspace.yaml                 # apps/*, packages/*
├── turbo.json                          # build/dev/lint/lint:fix/type-check/test/stylelint/fmt + openapi/client tasks
├── .oxlintrc.json  .oxfmtrc.json  stylelint.config.js  commitlint.config.ts
├── .lintstagedrc  .editorconfig  .gitignore  .coderabbit.yaml
├── .husky/                             # pre-commit (lint-staged), commit-msg (commitlint)
├── .github/workflows/ci.yml            # lint, fmt-check, type-check, stylelint, build, test, i18n-parity, client-drift
├── docker/
│   ├── docker-compose.yml              # postgres + api + money-tracker
│   └── api.Dockerfile  web.Dockerfile
├── README.md                           # single-command startup (NFR3)
├── _bmad-output/                       # planning artifacts (ED2)
├── example/                            # git-ignored reference repos (ED1)
├── apps/
│   ├── api/                            # NestJS — better-auth host
│   │   ├── nest-cli.json  drizzle.config.ts  vitest.config.ts  .env.example
│   │   ├── src/
│   │   │   ├── main.ts                 # /api/v1 prefix, Swagger setup, openapi.json emission
│   │   │   ├── app/                    # app.module.ts, env.schema.ts (zod), pino setup
│   │   │   ├── auth/                   # better-auth instance + @thallesp/nestjs-better-auth mounting
│   │   │   ├── database/
│   │   │   │   ├── schemas/            # users.ts, transactions.ts, transaction-categories.ts, enums.ts, index.ts (+ better-auth tables)
│   │   │   │   ├── migrations/         # drizzle-kit output
│   │   │   │   ├── seeds/              # seed-transactions.ts (FR17, import_key hashing, category derivation + report)
│   │   │   │   └── data/transactions-02.03.25.json
│   │   │   ├── modules/
│   │   │   │   ├── users/              # profile read/update (FR5)
│   │   │   │   ├── transactions/       # CRUD, filters, sort (FR6–FR9)
│   │   │   │   ├── transaction-categories/  # hierarchy, reassign-on-delete (FR10–FR12)
│   │   │   │   ├── analytics/          # summary, breakdown, trend — SQL aggregation (FR13–FR16)
│   │   │   │   └── health/
│   │   │   └── shared/                 # guards (auth, roles), decorators, error-codes enum, exception filter, pagination DTOs
│   │   └── test/integration/           # Testcontainers: seed, money math, auth scoping
│   ├── money-tracker/                  # Next.js tool app
│   │   ├── next.config.ts              # /api/* rewrites → API (D5)
│   │   ├── vitest.config.ts  .env.example
│   │   ├── messages/en.json  uk.json
│   │   └── src/
│   │       ├── env.ts                  # zod-validated
│   │       ├── app/[locale]/           # layout (shell), page → dashboard, transactions/, categories/, settings/, sign-in/, sign-up/
│   │       ├── actions/                # fetch-* (reads), create/update/delete-* ('use server')
│   │       ├── components/             # transaction-form/, transaction-list/, category-tree/, dashboard-summary/, category-breakdown/, trend-chart/, month-stepper/ … (no currency-filter — single profile-default currency, 2026-06-15)
│   │       ├── constants/  hooks/  utils/  i18n/
│   │       └── middleware.ts           # next-intl locale routing + auth redirect
│   └── storybook/                      # plays ui + widgets components
└── packages/
    ├── shell/                          # @supertool/shell — AppShell layout: tool nav, user menu, locale switcher (FR3)
    │   └── src/components/app-shell/ …  # renders from tool registry, knows nothing about specific tools
    ├── widgets/                        # @supertool/widgets — sign-in-form/, sign-up-form/ (better-auth client wired)
    ├── ui/                             # @supertool/ui — framework-agnostic Radix primitives (button, input, select, dialog, table …)
    ├── shared/                         # @supertool/shared — constants (incl. tools.ts registry, error codes), types, generated/ api client (D8)
    ├── next-shared/                    # @supertool/next-shared — i18n routing helpers, server-side client factory (cookie forwarding), providers
    ├── lint-config/  stylelint-config/  typescript-config/
```

### Architectural Boundaries

- **API boundary:** the only data door is `/api/v1/*` (REST, OpenAPI-described). Browser → Next.js origin → rewrite proxy → NestJS. Auth endpoints (`/api/v1/auth/*`) are better-auth's, mounted in Nest. Inside the API: controller → service → repository → Drizzle; no layer skipping (defects per patterns).
- **Component boundaries:** `ui` is framework-pure (no next-intl, no API awareness) · `widgets` = composed, auth-aware UI consuming `ui` + better-auth client · `shell` = layout chrome consuming `ui` + the tool registry; **shell never imports from tool apps** · tool apps compose everything and own their routes/actions · `shared` is dependency-free except the generated client · `next-shared` may depend on Next.js; nothing below it may.
- **Data boundary:** PostgreSQL owned exclusively by `apps/api`; no other workspace package may hold a DB connection. Frontends are stateless against the API.
- **Auth boundary:** better-auth tables live beside domain tables but are written only by better-auth; domain code reads the session via guards/decorators, never queries auth tables directly.

### Requirements to Structure Mapping

| Requirement | Lives in |
|---|---|
| F1 shell & identity (FR1–FR5) | `packages/shell`, `packages/widgets`, `apps/api/src/auth`, `modules/users`, settings page in tool app |
| F2 transactions (FR6–FR9) | `modules/transactions` + `money-tracker` transactions routes/components/actions |
| F3 categories (FR10–FR12) | `modules/transaction-categories` + `category-tree` components |
| F4 dashboard (FR13–FR16) | `modules/analytics` + dashboard components (`dashboard-summary`, `category-breakdown`, `trend-chart`) — figures scoped to the profile-default currency, no `currency-filter` (2026-06-15) |
| F5 seed & integrity (FR17–FR18) | `database/seeds`, `database/data`, integration tests in `apps/api/test/integration` |
| F6 i18n (FR19–FR20) | `messages/` per app/package, `next-shared` routing, CI parity job |
| ED3 carried config | root configs, `.github/workflows`, `.coderabbit.yaml`, config packages |

### FR4 Acceptance: "Register tool #2" walkthrough

Adding `apps/planner` requires:
1. **Create** `apps/planner` (scaffold from money-tracker's shape: rewrites config, shell layout, widgets sign-in)
2. **Register** it in `packages/shared/src/constants/tools.ts` — one new entry `{ id: 'planner', nameKey, path, icon }`; shell navigation renders it automatically
3. **Add** a `docker/docker-compose.yml` service entry and `.env.example`

**Zero diffs** to: `packages/shell` source, `packages/widgets`, `packages/ui`, `apps/api` auth, `apps/money-tracker`. The tool registry entry is configuration (a constants file), not rework. New API modules for planner features are additive (`modules/notes` etc.) and touch no existing module. ✅ FR4 acceptance satisfied at design level.

### Integration Points & Data Flow

**Read path:** RSC → `fetch-*` action → generated client (server-side, cookie forwarded via `next-shared` client factory) → proxy rewrite → API → SQL aggregation → camelCase JSON (amounts as strings) → RSC render.
**Write path:** form (RHF+zod) → server action → generated client → API → `revalidatePath` → fresh RSC (NFR5).
**Contract flow:** API build emits `openapi.json` → turbo task generates client into `packages/shared/src/generated/` → committed → CI drift gate.
**External integrations:** none (NFR4) — better-auth, Postgres, and everything else run locally.

### Development Workflow Integration

- **Dev:** `pnpm dev` (turbo) runs api + money-tracker + storybook natively; Postgres via `docker compose up postgres`
- **Full local runtime (NFR3):** one documented command brings up compose (postgres + api + web); API entrypoint runs `migrate` then idempotent `seed` before listening — dashboard meaningful on first boot
- **Build:** turbo graph — `typescript-config`/`lint-config` → `ui`/`shared` → `next-shared`/`widgets`/`shell` → apps; `openapi.json` → client generation ordered via task dependencies
- **Tests in CI:** unit/component per package (Vitest), API integration via Testcontainers — all under the single `test` turbo task

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** No conflicts found. The locked stack and verified versions are mutually compatible (Next 16.2.7 + React 19.2.7; NestJS 11 + @nestjs/swagger 11.4.4 + @thallesp/nestjs-better-auth 2.6.1 with better-auth 1.6.15; Drizzle 0.45.2 with better-auth's Drizzle adapter; Vitest 4 with SWC decorators for Nest). One deliberate tension is documented, not hidden: TS 6.0.3 monorepo-wide is newer than the blueprint's frontend TS — pinned exact, validated at scaffold story.

**Pattern Consistency:** Patterns operationalize the decisions — string-money (D1) appears in DTO format rules, anti-patterns, and agent MUSTs; the proxy choice (D5) is reflected in the data-flow paths; kebab-case/layering rules match the structure tree exactly.

**Structure Alignment:** Every package in the tree has a defined boundary and dependency direction (`ui` → `widgets`/`shell` → apps; `shared` at the bottom). The turbo build graph respects the OpenAPI→client ordering (D8). FR4's walkthrough is structurally verified against the tree.

### Requirements Coverage Validation ✅

**Functional:** FR1–FR20 all mapped (see Requirements to Structure Mapping). Notes: FR2 is satisfied in its operator-overridden form (per-app sessions, shared account — recorded at init). FR12's reassignment contract lives in `transaction-categories` delete endpoint design (reassignment targets are required parameters — no orphan path exists). FR19's per-user locale persistence rides on FR5's profile (`locale` column) plus next-intl middleware.

**Non-Functional:** NFR1→D10 · NFR2→ED3 configs + CI · NFR3→compose + migrate/seed-on-boot · NFR4→zero external services anywhere in the design · NFR5→D9 (server actions + revalidate) · NFR6→D8 drift gate · NFR7→`ui` + storybook · NFR8→responsive duty assigned to `ui`/`widgets` components with shared SCSS breakpoint mixins in `packages/ui/src/styles`.

### Implementation Readiness Validation ✅

Decisions carry exact versions; patterns cover the 12 identified conflict points with examples and anti-patterns; the tree is concrete to the file level where it matters (configs, modules, schemas); the seven agent MUSTs are mechanically enforceable via CI gates plus CodeRabbit path rules.

### Validation Issues Addressed

- **Proxy vs. server-side calls (found during validation):** Next.js rewrites apply to *browser* requests only. Server actions and RSC reads run on the Next server and must call the API's base URL directly (`API_URL` env var) while forwarding the incoming session cookie header. The better-auth session token is an opaque DB-backed token, so validation works identically through either path. **Resolution:** the `next-shared` client factory owns this duality — browser bundle targets `/api/*` (proxied), server context targets `API_URL` with cookie forwarding. This is now the binding interpretation of D5+D9.
- **better-auth schema ownership:** better-auth's required tables are generated via its Drizzle adapter CLI into `database/schemas/` and migrated by drizzle-kit like any other table — one migration pipeline, no parallel schema system.

### Gap Analysis Results

- **Critical:** none.
- **Important (process, not architecture):** the PRD still states FR2 as cross-app shared session and lacks the roles addition (D6). Run `bmad-prd` update (or correct-course) to sync FR2's override, D6 roles, and FR4's now-concrete acceptance — keeps the artifact trail honest, which is the pitch.
- **Minor:** i18n parity check needs a small script/CI step (no off-the-shelf gate assumed) — lands with the i18n story. oxlint-on-NestJS friction remains a budgeted story risk (unchanged from PRD). Storybook SCSS wiring is routine.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** high — single deliberate-risk area (better-auth × NestJS) was resolved by operator decision plus a documented integration path with a maintained module; everything else follows a proven blueprint.

**Key Strengths:** auth complexity collapsed early by per-app session decision · money correctness designed end-to-end as one thread (schema→DTO→client→UI) · FR4 verified with a concrete zero-diff walkthrough · process requirements (tests, traceability, gates) designed into CI rather than bolted on.

**Areas for Future Enhancement:** NestJS 12 migration (ESM/Vitest/oxlint alignment — revisit D3 then) · Playwright e2e epic · Redis caching epic · admin panel on the D6 role foundation · PRD sync (important gap above).

### Implementation Handoff

**AI Agent Guidelines:** follow decisions D1–D10 exactly; apply the Implementation Patterns to every file; respect package boundaries and dependency directions; treat the seven agent MUSTs as merge-blocking; consult this document before introducing any new dependency or pattern.

**First Implementation Priority:** the scaffold story — workspace files (`pnpm-workspace.yaml`, `turbo.json`, root configs), config packages, CI skeleton, in the existing repo root per the Starter Template Evaluation. No `mkdir`, no `git init`.
