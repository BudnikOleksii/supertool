---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-06-10'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
parityRound:
  startedAt: '2026-06-16'
  status: complete
  completedAt: '2026-06-16'
  stepsCompleted: [1, 2, 3, 4]
  inputDocuments:
    - _bmad-output/planning-artifacts/reference-parity-gap-backlog.md
    - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md
    - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md
    - _bmad-output/planning-artifacts/architecture.md
    - _bmad-output/planning-artifacts/epics.md
---

# supertool - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for supertool, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**F1 — Platform shell & identity**

- FR1: A user can sign up and sign in with email + password (better-auth). No email verification, OAuth, or password recovery in v1.
- FR2: All tool apps share a single account store — one email + password works everywhere — but sessions are per-app; multiple concurrent sessions per user are supported. (Operator override at architecture, D5.)
- FR3: A shared shell wraps every tool app: tool navigation, user menu (profile, sign out), and locale switcher. v1 renders one tool entry (Money Tracker).
- FR4: A second tool app can be added by registering it — no rework of existing apps. Acceptance verified at architecture via the "register tool #2" walkthrough: new app + one tool-registry entry + infra additions; zero diffs to shell, shared UI/widgets, auth, or existing apps.
- FR5: A user can view and edit minimal profile settings: name, default currency, locale. The default currency is the single currency lists and the dashboard are scoped to — not a selectable filter (2026-06-15).
- FR21: Every user has a role (`user` or `admin`) from day one; v1 ships no admin features; promotion via seed/DB only. All data access is scoped to the authenticated user — no cross-user access paths in v1. (Architecture D6.)

**F2 — Transactions**

- FR6: A user can create a transaction with: type (income/expense), amount, currency, category, date (defaults to today), optional note. Creation optimized for speed (NFR5). Imported seed records get an empty note.
- FR7: A user can edit and delete any of their transactions.
- FR8: A user can view transactions for a date range, defaulting to the current month, with previous/next month navigation.
- FR9: The transaction list can be filtered by type and category, and sorted by date or amount. (Currency dropped as a filter — single default currency, 2026-06-15.)

**F3 — Categories**

- FR10: A user can create, rename, and delete categories, organized in a parent/child hierarchy.
- FR11: The category set is initially populated from the seed data as a two-level hierarchy — each distinct `Category` becomes a top-level category and each distinct `Subcategory` a child under its parent (`Subcategory` on ~57% of records); the user can restructure them afterwards. (Corrected 2026-06-15: two-level, not flat top-level-only.)
- FR12: Deleting a category that has transactions or child categories requires reassigning them (transactions to another category, children to another parent or top level) — no orphaned or silently uncategorized data.

**F4 — Dashboard & stats**

- FR13: The dashboard shows, for a selected period (default: current month): total income, total expense, and net — in the user's profile-default currency (FR5). No currency picker.
- FR14: All dashboard figures are scoped to the user's profile-default currency (FR5); no currency picker and no cross-currency aggregation in v1. Aggregations stay per-currency in SQL for correctness, but currency is not user-selectable. (Simplified 2026-06-15 — supersedes the data-derived currency filter + most-frequent fallback.)
- FR15: The dashboard shows an expense breakdown by category for the selected period (in the profile-default currency), grouped by top-level category where a hierarchy exists.
- FR16: The dashboard shows a month-over-month trend (income/expense) across a trailing 12-month window.

**F5 — Data seeding & integrity**

- FR17: A repeatable, idempotent seed imports `transactions-02.03.25.json` (1,880 records): derives the category set, preserves every amount, currency, and date exactly, attaches all records to the operator's account. Re-running does not duplicate.
- FR18: All money values are stored and computed with decimal-safe arithmetic — no floating-point drift, asserted by tests on stats math and import totals.

**F6 — Internationalization**

- FR19: All user-facing strings are localized; v1 ships English and Ukrainian, switchable from the shell, with the choice persisted per user.
- FR20: CI enforces locale key parity — a missing translation key fails the pipeline.

### NonFunctional Requirements

- NFR1 — Tests per feature: every feature merges with its tests in the same story; CI runs them as a required check. Priority targets: money math, seed/import integrity, auth/sessions and per-user data scoping.
- NFR2 — Quality gates: oxlint, oxfmt, type-check, stylelint, commitlint (conventional commits), CodeRabbit review on every PR. No eslint/prettier anywhere.
- NFR3 — Local-first runtime: entire platform runs locally via Docker (PostgreSQL + apps) with documented single-command startup. No deployment in v1.
- NFR4 — Privacy posture: private repo; real seed committed; no analytics or external telemetry — nothing may expose data beyond the local environment.
- NFR5 — Entry speed: transaction form reachable in one interaction from the tracker's main view; submit-to-visible-in-list without full page reload.
- NFR6 — API contract: frontend consumes the API exclusively through the client generated from the NestJS OpenAPI spec; hand-written fetches are defects.
- NFR7 — Design system: shared UI package + Storybook; tracker screens follow the example app's approved UX patterns.
- NFR8 — Mobile-usable: daily-entry flow and transaction list fully usable in a mobile browser (responsive layout). No native app or PWA in v1.

### Additional Requirements

**Engineering & delivery (PRD ED1–ED4):**

- ED1: `example/` repos are reference-only — code is never committed; features are rebuilt, not pasted.
- ED2: Every commit on `main` traces to a planned story; planning artifacts committed in-repo.
- ED3: Base setup carried/merged from example repos as configuration with exact versions: oxlint/oxfmt/stylelint configs, commitlint/husky/lint-staged, merged CI workflows, merged `.coderabbit.yaml`, merged AI setup (CLAUDE.md, skills, agents, commands, rules, hooks, MCP).
- ED4: Stack locked: Next.js 16 / React 19 / TypeScript / SCSS · next-intl · NestJS · Drizzle ORM + PostgreSQL · better-auth · pnpm + Turborepo · Docker (local) · @hey-api/openapi-ts from NestJS Swagger.

**Starter template (architecture — impacts Epic 1 Story 1):**

- Custom scaffold following the `example/track-my-life` blueprint, built in the existing repo root (no generator CLI, no `git init`): `pnpm-workspace.yaml` (apps/*, packages/*), `turbo.json` task graph, root configs, config packages, all dependency versions pinned exact to the latest-stable table in architecture.md.
- Target shape: `apps/{money-tracker, api, storybook}` + `packages/{shell, widgets, ui, shared, next-shared, lint-config, stylelint-config, typescript-config}`.

**Architecture decisions affecting stories (D1–D10):**

- D1 — Money: Postgres `numeric(14,2)`; stats via SQL aggregation; amounts are strings in every DTO and in JS (never `number`); `Intl.NumberFormat` display; decimal.js only where app-level arithmetic is unavoidable.
- D2 — Seed idempotency: `import_key` = SHA-256 of normalized record + row index, unique-indexed, `ON CONFLICT DO NOTHING`; near-duplicate category strings surfaced in an import report, never silently merged.
- D3 — Validation: class-validator + @nestjs/swagger CLI plugin for DTOs → OpenAPI; zod for env validation and frontend forms.
- D4 — Primary keys: UUIDv7, generated app-side, all entities.
- D5 — Same-origin proxy sessions: each Next.js app rewrites `/api/*` → NestJS; better-auth mounted in Nest via `@thallesp/nestjs-better-auth` (body parser disabled for auth routes); `next-shared` client factory owns the browser-proxy vs server-direct (`API_URL` + cookie forwarding) duality.
- D6 — Roles: `role` enum on users; role guard + `@Roles()` decorator in API shared layer; repositories scope every query by authenticated user.
- D7 — REST conventions: `/api/v1/...` URI versioning; global exception filter `{ statusCode, code, message, details? }` with shared error-code enum; offset pagination `{ data, meta }`; DELETE → 204; controller/service/repository layering (repository is the only DB-touching layer).
- D8 — Contract pipeline: API build emits `openapi.json` → turbo task generates client into `packages/shared/src/generated/` → committed; CI regenerates and fails on diff (drift gate).
- D9 — Frontend data flow: RSC reads via `fetch-*` actions; mutations via server actions; `revalidatePath` after mutations (NFR5); URL search params carry filter/period state; react-hook-form + zod forms; next-intl.
- D10 — Tests: Vitest everywhere (API via SWC decorators, frontend via @testing-library/react); Testcontainers for repository/seed/auth integration tests against real Postgres; Playwright deferred (config slot reserved).

**Infrastructure & process:**

- Docker compose: PostgreSQL 16 + api + web; API entrypoint runs `migrate` then idempotent `seed` before listening (dashboard meaningful on first boot).
- Migrations via drizzle-kit; schema one-file-per-table in `apps/api/src/database/schemas/`; better-auth tables generated via its Drizzle adapter CLI into the same pipeline.
- Per-app zod-validated env schemas; `.env` git-ignored, `.env.example` committed; Pino logging in API, console-only.
- CI (merged workflows): lint, fmt-check, type-check, stylelint, build, test, i18n key parity, client-drift gate.
- i18n key-parity check needs a small custom script/CI step — lands with the i18n story.
- oxlint on decorator-heavy NestJS code is a budgeted friction risk — allow remediation room in the story that wires backend linting.
- Auth rate limiting (differentiated: auth vs general endpoints) is the one hardening item carried from the example.
- Implementation patterns (naming, structure, formats, error handling, loading states) and the seven agent MUSTs in architecture.md are binding for every story.

**From PRD addendum:**

- Currency is a single per-user profile default (FR5) — no currency filter, no most-frequent fallback (simplified 2026-06-15). Dashboard figures are scoped to the profile-default currency; analytics keep per-currency SQL aggregation for correctness only.
- Seed source: `example/tracker-backend-api/src/database/data/transactions-02.03.25.json` — `{Date, Category, Type, Amount, Currency, Subcategory?}` (two-level; `Subcategory` on ~57% of records — corrected 2026-06-15); no note field — imported transactions get empty notes.

### UX Design Requirements

No UX Design document exists — `bmad-ux` was deliberately skipped. Per NFR7 and the PRD decision log, tracker screens mirror the example app's UX patterns, which the operator approved as-is; UI is built from the carried-over design-system approach (shared `ui` package + Storybook). Mobile-browser usability (NFR8) and the entry-speed budget (NFR5) act as the binding UX constraints.

### FR Coverage Map

- FR1: Epic 1 — email+password sign-up/sign-in (better-auth)
- FR2: Epic 1 — single account store, per-app sessions
- FR3: Epic 1 — shared shell (nav, user menu, locale switcher)
- FR4: Epic 1 — tool-registry platform readiness (zero-diff walkthrough)
- FR5: Epic 1 — minimal profile settings (name, default currency, locale)
- FR6: Epic 2 — fast transaction creation
- FR7: Epic 2 — edit/delete own transactions
- FR8: Epic 2 — month-windowed transaction list with prev/next
- FR9: Epic 2 — filters (type/category) and sorting (date/amount) — currency dropped 2026-06-15
- FR10: Epic 2 — hierarchical category CRUD
- FR11: Epic 2 — two-level category set derived from seed (Category→top-level, Subcategory→child)
- FR12: Epic 2 — reassign-on-delete, no orphaned data
- FR13: Epic 3 — period totals (income/expense/net)
- FR14: Epic 3 — dashboard scoped to the profile-default currency (no picker; per-currency SQL aggregation retained) — 2026-06-15
- FR15: Epic 3 — expense breakdown grouped by top-level category
- FR16: Epic 3 — trailing 12-month income/expense trend
- FR17: Epic 2 — idempotent seed of 1,880 records
- FR18: Epic 2 — decimal-safe money math, test-asserted
- FR19: Epic 1 — EN+UK i18n machinery, shell switcher, per-user persistence (both-locales rule binds every story in all epics)
- FR20: Epic 1 — CI locale key-parity gate
- FR21: Epic 1 — roles from day one, per-user data scoping

## Epic List

### Epic 1: Platform Foundation & Identity
A user can run the platform locally with one command, sign up and sign in with email + password (per-app session, shared account), move around the shared shell (tool navigation, user menu, EN/UK locale switcher), and edit minimal profile settings. The monorepo scaffold (blueprint story), quality gates and CI, Docker runtime, DB foundation with roles and per-user scoping, the OpenAPI→generated-client pipeline, and test infrastructure all land here so every subsequent feature story obeys NFR1/NFR2/NFR6 from day one.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR19, FR20, FR21

### Epic 2: Transactions & Categories
A user can record and browse real money data daily: fast transaction entry (NFR5, mobile-usable per NFR8), month-windowed transaction list with filters and sorting, hierarchical categories with reassign-on-delete, and the idempotent seed importing 1,880 real records with category derivation, import report, and decimal-safe integrity tests.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR17, FR18

### Epic 3: Dashboard & Stats
A user can answer "where did money go" in one screen: per-period totals (income/expense/net) in the profile-default currency (no currency picker — simplified 2026-06-15; per-currency SQL aggregation retained for correctness), expense breakdown grouped by top-level category, and a trailing 12-month income/expense trend — all computed as SQL aggregations (D1).
**FRs covered:** FR13, FR14, FR15, FR16

### Spike: Reference-Parity Gap Analysis (pre-Epic-4 — BLOCKS next-epic planning)
supertool money-tracker is a PoC, not an MVP (Epic 3 retro 2026-06-16). Before planning Epic 4, run the reference money tracker (`example/track-my-life`) locally and capture its full UI (all screens, mobile especially) and feature set; diff against the current supertool money-tracker to produce a prioritized gap backlog (`reference-parity-gap-backlog.md`). That backlog is the input to `create-epics-and-stories` for Epic 4+. Parity bar: **same features as the reference, and UI/UX at least as good as the reference.**

### Epic 4: Mobile-First & Existing-Screen Quality
The tracker that already ships becomes fully usable and polished on a phone, beating the reference on every screen touched — no new features, just fixing and elevating what exists: a mobile nav drawer + in-app navigation, a stacked/touch-usable transactions list, first-run period auto-fit (killing the empty "No data" state), and QA fixes to the shipped dashboard widgets. The spike's central finding — supertool's mobile is broken while the reference's is solid — is closed here first (operator focus: UI/UX + current features before net-new). A mobile-QA check rides along in every later story.
**Parity items covered:** RP-U1, RP-U2, RP-U3, RP-U4, RP-U5, RP-F3 (defect-fix side)

### Epic 5: Import Your Data & See Your Money
A new user onboards (default currency → seed/import categories → dashboard), imports their own CSV/JSON file (upload → validate → preview → execute, auto-creating categories via the reused seed ingest), and lands on a complete dashboard — top-categories, daily-spending, recent-transactions widgets + filter bar on top of the existing summary/breakdown/trend — plus a by-category drill-down with the per-category totals/counts the reference omits. The "import your data and see your money" spine, built on Epic 4's solid mobile baseline.
**Parity items covered:** RP-F1, RP-F2, RP-F4, RP-F3 (new-widget side), RP-B1, RP-B2

### Epic 6: Manage Transactions at Scale
Power-user management of a large transaction set: list UX enrichment (duplicate/copy, month/year navigator, richer hierarchical category picker), bulk delete done right (consistent across list + by-category, touch-usable, cap 100), export (CSV/JSON), optional full-text search, and in-memory analytics caching once the dashboard is heavier. (Time-of-day picker dropped — depends on the deferred `timestamptz` migration.)
**Parity items covered:** RP-F5, RP-F7, RP-F9, RP-B3, RP-B6, RP-B9

### Epic 7: Account & Landing
Complete account self-service (change-password, delete-account with confirm dialog, first/last name collected) and a credible public face (a real marketing landing page replacing the bare placeholder), with cheap helmet/compression hardening folded in.
**Parity items covered:** RP-F8, RP-F10, RP-U6, RP-B10

### Deferred (tracked, not dropped — future epics)
Recurring & automation (RP-F6 / RP-B5 / RP-B7) · Budgets + audit log (RP-F11 / RP-B8) · Backend Redis rate-limit (RP-B4) · transaction `date`→`timestamptz` (`implementation-artifacts/tech-debt-transaction-date-to-timestamptz.md`).

**Dependencies:** strictly forward — Epic 2 builds on Epic 1 (auth, shell, pipeline); Epic 3 builds on Epic 2 (transaction/category data). The parity epics continue forward-only: Epic 4 stabilizes the mobile baseline on existing screens; Epic 5 builds the import→dashboard spine on that baseline; Epic 6 enriches/scales the (now mobile-solid) transactions surface; Epic 7 completes account + landing. Each epic delivers standalone user value and does not require a later epic to function.

## Epic 1: Platform Foundation & Identity

A user can run the platform locally, sign up and sign in with email + password (per-app session, shared account store), move around the shared shell in English or Ukrainian, and edit minimal profile settings. The scaffold, quality gates, CI, contract pipeline, and test infrastructure land here so every later story merges gated and traceable (NFR1, NFR2, NFR6, ED2/ED3).

### Story 1.1: Monorepo Scaffold & Quality Gates

As the operator-developer,
I want the monorepo workspace scaffolded with every quality gate wired,
So that every subsequent story lands as a gated, traceable commit — the pitch-grade trail.

**Acceptance Criteria:**

**Given** a fresh clone of the existing repo root (no `git init`, no generator CLI),
**When** `pnpm install` runs on Node 22 LTS,
**Then** the workspace resolves with `pnpm-workspace.yaml` (`apps/*`, `packages/*`), pinned `packageManager` and `engines`, and exact dependency versions throughout (no `^`/`~`), matching the version table in architecture.md.

**Given** the scaffolded workspace,
**When** `turbo run build lint type-check fmt stylelint test` executes,
**Then** the task graph runs (empty targets pass trivially) and the config packages (`lint-config`, `stylelint-config`, `typescript-config`) are consumed by root configs — with no eslint or prettier anywhere (NFR2).

**Given** a commit with a malformed message or staged lint/format violations,
**When** the commit is attempted,
**Then** husky + commitlint + lint-staged block it (conventional commits enforced).

**Given** a pull request,
**When** CI runs,
**Then** the merged workflow (ED3) executes lint, fmt-check, type-check, stylelint, and build jobs, and a single merged `.coderabbit.yaml` covers frontend and backend paths.

**Given** the repo root,
**Then** the merged AI setup (CLAUDE.md, skills, agents, commands, rules, hooks, MCP) is in place (ED3), `example/` is git-ignored and never committed (ED1), and the README documents the workspace layout.

### Story 1.2: API Foundation — Health Check & Database Baseline

As the operator-developer,
I want a bootable NestJS API with validated config, contract conventions, and a working migration pipeline,
So that every feature module lands on identical rails (D7) and the database is owned by exactly one app.

**Acceptance Criteria:**

**Given** PostgreSQL 16 running via `docker compose up postgres`,
**When** the API starts,
**Then** zod-validated env loading either succeeds or fails fast with a clear message (no partial boot), and Pino logs to console only (NFR4).

**Given** the running API,
**When** `GET /api/v1/health` is called,
**Then** it returns 200 with a body that includes database connectivity status — URI versioning `/api/v1` from day one (D7).

**Given** any thrown `HttpException`,
**When** the response is shaped,
**Then** the global exception filter emits `{ statusCode, code, message, details? }` using the shared error-code enum, exposed through OpenAPI (D7).

**Given** the API build,
**When** it completes,
**Then** `openapi.json` is emitted as an artifact via @nestjs/swagger CLI plugin + class-validator DTO decoration (D3), and Swagger UI is served in dev.

**Given** drizzle-kit configured (schema dir `src/database/schemas/`, one file per table),
**When** `generate` and `migrate` run,
**Then** migrations apply cleanly against Postgres.

**Given** Vitest configured with SWC decorators (D10),
**When** `turbo run test --filter api` executes,
**Then** the health module spec passes in CI; oxlint passes on the decorator-heavy code or remediation is applied within this story (budgeted risk).

### Story 1.3: OpenAPI → Generated Client Pipeline

As the operator-developer,
I want the typed API client generated from the OpenAPI spec, committed, and drift-gated,
So that the frontend can only ever speak to the API through the contract (NFR6, D8).

**Acceptance Criteria:**

**Given** the API build emitting `openapi.json`,
**When** the turbo client-generation task runs,
**Then** @hey-api/openapi-ts writes the client into `packages/shared/src/generated/`, it type-checks, and turbo task ordering guarantees API build precedes generation (D8).

**Given** the generated client is committed,
**When** CI runs,
**Then** a drift gate regenerates the client and fails the pipeline on any diff.

**Given** `packages/next-shared`,
**When** the client factory is consumed,
**Then** it exposes the D5+D9 duality: browser bundles target `/api/*` (proxied), server contexts target `API_URL` directly with incoming session-cookie forwarding.

**Given** the health endpoint,
**When** called through the generated client in a test,
**Then** a typed response is returned — proving spec → client → call end-to-end.

**Given** `packages/shared` is scaffolded by this story,
**When** shared primitives are placed,
**Then** the cross-app primitives that temporarily live in `apps/api/src/shared/` move into the package — `ErrorCode` constants → `packages/shared/src/constants/error-codes.ts`, the `ObjectValuesUnion` type utility → `packages/shared/src/types/object-values-union.ts` — plus new `HTTP_STATUS_CODE` constants (`packages/shared/src/constants/http-status-code.ts`), with the API consuming them from `@supertool/shared` (carried-over task from Story 1.2 review).

### Story 1.4: Money Tracker Shell, Design System & i18n Foundation

As Oleksii,
I want to open Money Tracker in English or Ukrainian and see the platform shell,
So that the platform frame (navigation, locale, design system) exists for every feature that follows.

**Acceptance Criteria:**

**Given** the dev stack running,
**When** I open the money-tracker app,
**Then** it renders inside `AppShell` from `packages/shell` — tool navigation driven by the `tools.ts` registry in `packages/shared` (one Money Tracker entry), user-menu placeholder, and locale switcher (FR3).

**Given** the tool registry,
**When** a second tool entry is added to `tools.ts`,
**Then** shell navigation renders it with zero changes to `packages/shell` source (FR4 registry mechanism in place).

**Given** the locale switcher,
**When** I switch between EN and UK,
**Then** every visible string changes (next-intl, `app/[locale]` routing, ICU interpolation — no concatenation) and the choice persists across reloads (cookie; per-user persistence arrives with profile, FR19).

**Given** `packages/ui`,
**When** Storybook runs,
**Then** the initial framework-pure primitives (button, input, select, dialog, table) render with SCSS + stylelint and shared responsive breakpoint mixins (NFR7, NFR8 foundation).

**Given** a translation key present in `en.json` but missing from `uk.json` (or vice versa),
**When** CI runs,
**Then** the i18n key-parity job fails the pipeline (FR20 — custom parity script, EN as reference locale).

**Given** the shell components,
**When** `turbo run test` executes,
**Then** @testing-library/react component tests cover navigation rendering and locale switching (NFR1).

### Story 1.5: Sign Up & Sign In

As Oleksii,
I want to create an account and sign in with email + password,
So that my financial data belongs to my identity and nobody else's.

**Acceptance Criteria:**

**Given** the API,
**When** auth is mounted,
**Then** better-auth runs in NestJS via `@thallesp/nestjs-better-auth` (body parser disabled for auth routes, D5), its tables are generated via the Drizzle adapter into the standard migration pipeline, and the `users` table carries a `role` enum (`user`/`admin`) defaulting to `user` (D6, FR21).

**Given** an unregistered visitor on `/sign-up`,
**When** they submit email + password through the `SignUpForm` widget (`packages/widgets`, consuming `packages/ui`),
**Then** the account is created through the `/api/*` proxy and they land signed in — no email verification, OAuth, or recovery flows (FR1).

**Given** a registered user on `/sign-in`,
**When** they authenticate,
**Then** the session cookie is scoped to the app origin (per-app session, FR2), the user menu shows their name, and sign-out ends the session.

**Given** the same account signed in from two browsers,
**When** both sessions are active,
**Then** both remain valid concurrently (FR2 — multiple concurrent sessions).

**Given** an unauthenticated request to a protected page or API endpoint,
**When** it arrives,
**Then** middleware redirects to sign-in (web) and guards return 401 (API); the auth guard + `@Roles()` decorator exist in the API shared layer, and repositories scope queries by authenticated `userId` (FR21).

**Given** the auth endpoints,
**When** request rates spike,
**Then** differentiated rate limiting applies (stricter on auth than general endpoints — carried hardening item).

**Given** Testcontainers integration tests (D10),
**When** the test suite runs,
**Then** sign-up, sign-in, session validation, and cross-user scoping (user A cannot read user B) are asserted against real Postgres (NFR1 priority target), and all auth UI strings exist in both locales.

### Story 1.6: Profile Settings

As Oleksii,
I want to view and edit my name, default currency, and locale,
So that the platform reflects my preferences — and the dashboard later opens on my currency (FR5).

**Acceptance Criteria:**

**Given** a signed-in user,
**When** they open the settings page,
**Then** the `users` module serves their profile through the generated client (regenerated for the new endpoints, drift gate green), showing name, default currency, and locale.

**Given** the settings form (react-hook-form + zod, server action returning discriminated `ActionState`),
**When** valid changes are submitted,
**Then** the profile updates, `revalidatePath` refreshes the view without a full reload, and validation errors surface as i18n messages resolved by error code — never raw API text.

**Given** a signed-in user switching locale (shell switcher or settings),
**When** the change is saved,
**Then** it persists to the profile and is applied on next sign-in from any session (FR19 per-user persistence).

**Given** the default-currency field,
**When** edited,
**Then** only valid currency codes are accepted.

**Given** the users module and settings page,
**When** tests run,
**Then** module specs (including user-scoping) and a component test for the form merge with this story (NFR1).

### Story 1.7: One-Command Local Runtime

As Oleksii,
I want to start the entire platform with one documented command,
So that the whole stack runs locally without ceremony (NFR3).

**Acceptance Criteria:**

**Given** a machine with Docker,
**When** the single documented command from the README runs,
**Then** docker compose brings up PostgreSQL 16 + api + money-tracker, the API runs migrations before listening, and the app is reachable in the browser with sign-in working through the proxied stack (D5).

**Given** the compose setup,
**Then** `.env.example` files are committed per app, real `.env` files are git-ignored, and a seed hook slot exists in the API entrypoint (migrate → [seed] → listen) ready for Epic 2.

**Given** the running stack,
**When** network traffic is inspected,
**Then** no external calls leave the environment — telemetry disabled everywhere (NFR4).

### Story 1.8: Design System Repair & Theming

> Added 2026-06-12 (sprint change): Story 1.4 shipped the ui package with visually broken/incomplete primitives; this story repairs the design system against the `example/track-my-life` reference and brings in runtime theming. Scheduled BEFORE 1.5 — the auth widgets build on these primitives.

As Oleksii,
I want the design-system primitives to render correctly on the generated token system with light/dark theming,
So that every feature that follows builds on polished, themeable UI instead of compounding visual debt.

**Acceptance Criteria:**

**Given** the `packages/ui` primitives (button, input, select, dialog, table),
**When** each renders in Storybook and in the money-tracker shell,
**Then** it displays correctly and consistently on the M3 token system (`tokens/{palette,theme,metrics,shadows,fonts}.scss`), with the visual defects introduced in 1.4 identified and fixed — `example/track-my-life/packages/ui` is the reference for markup, styling, and component APIs (used as reference, never copied).

**Given** the app shell,
**When** the user switches theme (light/dark/system),
**Then** `next-themes` drives the `[data-theme]` attribute (new sanctioned dependency, exact pin), the choice persists across reloads, and the hardcoded `data-theme="light"` in the locale layout is gone — theme switcher control in the shell header, localized in both locales.

**Given** Storybook,
**When** stories render,
**Then** a theme toolbar switches every story between light and dark, and the a11y addon passes for both themes.

**Given** the primitives the upcoming auth forms need (typography, label),
**When** they are added to `packages/ui` following the reference atoms,
**Then** they ship with stories and smoke tests like the existing primitives (NFR1).

### Story 1.9: Design System Structure & Visual QA Baseline

> Added 2026-06-12 (sprint change): Story 1.8 repaired token usage and theming but its verification was mechanical (tests, axe, attribute checks) — nobody **looked** at the rendered components, and Select shipped visibly broken again. The reference also organizes `packages/ui` into `atoms/` and `molecules/`, which supertool never adopted. This story restructures the package, fixes the diagnosed defects, and establishes the screenshot-based visual QA protocol every later design-system story must pass. Scheduled BEFORE 1.5.

As Oleksii,
I want `packages/ui` restructured into atoms/molecules with every existing component visually verified against the reference,
So that the design system has the reference's shape and a repeatable visual QA gate before more components pile on.

**Acceptance Criteria:**

**Given** `packages/ui/src/components`,
**When** the story completes,
**Then** components live in `components/atoms/{button,input,label,select,typography}` and `components/molecules/{dialog,table}` mirroring `example/track-my-life/packages/ui/src/components` (PascalCase filenames kept), every import across shell/apps/stories is updated, and no compatibility re-exports remain (no barrels).

**Given** the Select defects diagnosed 2026-06-12,
**When** the Select story renders with the dropdown OPEN,
**Then** items span the full content panel (root cause: `.popperViewport` pins `width: var(--radix-select-trigger-width)` — 75px — while the panel is `min-width: 8rem` — 128px; the fix moves trigger-width matching to a `min-width` on the content so items fill it), the check indicator sits at the panel's right edge, and the highlight pill covers the full item row — verified by screenshot in both themes. (The reference carries the same latent bug masked by full-width usage — documented improvement, like the 1.8 `color-mix` focus rings.)

**Given** Storybook,
**When** any story renders,
**Then** Poppins is actually loaded in the Storybook preview (today it silently falls back to the system font, which masked every typography judgment; the reference does not load it either — documented improvement), and the docs/canvas render the true type system.

**Given** EVERY component in `packages/ui` (the five 1.8 primitives plus typography/label),
**When** the story completes,
**Then** the Dev Agent Record contains side-by-side visual evidence per component: Storybook screenshots in light AND dark, including OPEN/interactive states (select expanded, dialog open), compared against the reference rendering, with every divergence either fixed or recorded as a documented API divergence. A story claiming "displays correctly" without screenshots in the record is incomplete.

### Story 1.10: Design System Atom Parity

> Added 2026-06-12 (sprint change): the reference atom catalog is 15 components; supertool has 5. This story closes the atom gap. Runs after 1.9 (structure + QA protocol in place).

As Oleksii,
I want every reference atom available in `packages/ui/src/components/atoms`,
So that feature stories compose existing primitives instead of inventing one-off UI.

**Acceptance Criteria:**

**Given** the reference atoms missing from supertool (`alert`, `aspect-ratio`, `avatar`, `badge`, `checkbox`, `radio-group`, `separator`, `skeleton`, `time-picker`, `underline-link`),
**When** each is added under `components/atoms/` following its `example/track-my-life/packages/ui/src/components/atoms/<name>/` counterpart (adapted, never copied — ED1),
**Then** each ships with its `.module.scss` (token-only values), a co-located smoke test, and a CSF3 story showing all variants (NFR1).

**Given** the new Radix primitives these atoms need (`@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-separator`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`),
**When** they are added to `packages/ui` dependencies,
**Then** they are exact-pinned, sanctioned by this story, and recorded in the Dev Agent Record (architecture.md new-dependency rule).

**Given** every new atom,
**When** the story completes,
**Then** the 1.9 visual QA protocol has been executed for it (light + dark screenshots incl. interactive states, reference comparison in the Dev Agent Record) and the Storybook a11y addon passes in both themes.

### Story 1.11: Design System Molecule Parity

> Added 2026-06-12 (sprint change): closes the molecule gap against the reference (`accordion`, `alert-dialog`, `breadcrumb`, `card`, `combobox`, `dropdown-menu`, `error-state`, `field`, `pagination`, `toaster`). Runs after 1.10; `field`/`alert-dialog` feed the 1.5 auth forms and the 2.x delete confirmations.

As Oleksii,
I want the reference molecules available in `packages/ui/src/components/molecules`,
So that forms, confirmations, navigation, and feedback UI in feature stories are composed from the design system.

**Acceptance Criteria:**

**Given** the reference molecules missing from supertool (`accordion`, `alert-dialog`, `breadcrumb`, `card`, `combobox`, `dropdown-menu`, `error-state`, `field`, `pagination`, `toaster`),
**When** each is added under `components/molecules/` following its reference counterpart (adapted, never copied — ED1),
**Then** each ships with token-only styles, a co-located smoke test, and a CSF3 story (NFR1), and the existing `Dialog` keeps its API alongside the new reference-style `alert-dialog` (documented divergence from 1.8 stands).

**Given** the new dependencies these molecules need (`@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover` for combobox, `sonner` for toaster),
**When** they are added to `packages/ui` dependencies,
**Then** they are exact-pinned, sanctioned by this story, and recorded in the Dev Agent Record.

**Given** the reference toaster imports `next-themes` inside the ui package,
**When** the supertool toaster is implemented,
**Then** `packages/ui` stays framework-pure — the theme reaches the toaster via prop from the shell (documented divergence; architecture boundary holds).

**Given** every new molecule,
**When** the story completes,
**Then** the 1.9 visual QA protocol has been executed for it (light + dark screenshots incl. OPEN states — combobox expanded, dropdown open, toast visible — reference comparison in the Dev Agent Record) and the Storybook a11y addon passes in both themes.

## Epic 2: Transactions & Categories

A user can record and browse real money data daily: the idempotent seed lands first so every subsequent story works against the 1,880 real records, then fast entry, month-windowed browsing, editing, filtering, and full hierarchical category management.

### Story 2.1: Seed the Real Data

As Oleksii,
I want my 1,880 real transactions imported automatically, exactly, and idempotently,
So that the tracker is meaningful from the first boot — no manual data entry marathon.

**Acceptance Criteria:**

**Given** the domain schema created by this story (`transactions`, `transaction_categories` — one file per table, snake_case, UUIDv7 app-side keys, `user_id` on every row, `numeric(14,2)` amounts, `date` column for transaction dates, unique-indexed `import_key`),
**When** migrations run,
**Then** the schema applies cleanly and shared enums derive from the Drizzle schema (single source of truth).

**Given** the seed source `transactions-02.03.25.json` (`{Date, Category, Type, Amount, Currency, Subcategory?}` — two-level, `Subcategory` on ~57% of records),
**When** the seed runs,
**Then** each distinct `Category` becomes a top-level category and each distinct `Subcategory` a child under its parent (two-level hierarchy, FR11), all 1,880 records import attached to the operator's account with amounts, currencies, and dates preserved exactly and empty notes (FR17), and near-duplicate category strings are surfaced in an import report — never silently merged (D2).

**Given** a completed seed,
**When** the seed runs again,
**Then** zero duplicates result — `import_key` = SHA-256 of normalized record + row index with `ON CONFLICT DO NOTHING` (FR17, D2).

**Given** Testcontainers integration tests,
**When** the suite runs,
**Then** re-run safety, per-currency total sums matching the source exactly (verified with decimal.js — FR18), record count, and category derivation are asserted against real Postgres (NFR1 priority target).

**Given** the docker compose runtime (Story 1.7's hook),
**When** the API container starts,
**Then** migrate → seed → listen executes, making the dashboard meaningful on first boot (NFR3); the seed also ensures the operator account exists (role promotion is a seed concern, D6).

### Story 2.2: Browse Transactions by Month

As Oleksii,
I want to see my transactions for a month and step to adjacent months,
So that I can review what happened and when.

**Acceptance Criteria:**

**Given** the `transactions` module,
**When** `GET /api/v1/transactions` is called with a date range,
**Then** it returns offset-paginated `{ data, meta }` (D7), amounts as strings (D1), scoped to the authenticated user by the repository (FR21), through the regenerated client (drift gate green).

**Given** a signed-in user opening the transactions view,
**When** the page loads,
**Then** it defaults to the current month (FR8), shows date, category, type, amount, currency, and note — amounts and dates formatted via Intl/next-intl, never ad-hoc — with Suspense skeletons while loading.

**Given** the month stepper,
**When** I navigate previous/next,
**Then** the period travels via URL search params (D9 — shareable, back-button-safe) and the list updates accordingly.

**Given** a month with no transactions,
**When** viewed,
**Then** a localized empty state renders (both locales, FR19 rule).

**Given** a mobile-browser viewport,
**When** the list renders,
**Then** it is fully usable — responsive layout via shared breakpoint mixins (NFR8).

**Given** the module and components,
**When** tests run,
**Then** repository specs (range windowing, scoping, pagination) and a list component test merge with this story (NFR1).

### Story 2.3: Fast Transaction Entry

As Oleksii,
I want to add a transaction in seconds,
So that daily tracking happens at the moment of spending — anywhere, including my phone.

**Acceptance Criteria:**

**Given** the tracker's main view,
**When** I want to record a spend,
**Then** the transaction form is reachable in one interaction (NFR5) and offers: type (expense/income), amount, currency, category (hierarchical picker), date defaulting to today, optional note (FR6).

**Given** the form (react-hook-form + zod),
**When** I submit a valid entry,
**Then** the server action calls `POST /api/v1/transactions` via the generated client (201 + body), `revalidatePath` makes it visible in the list without a full page reload (NFR5), and the submit button is disabled while pending.

**Given** invalid input (e.g. non-positive or malformed amount),
**When** submission is attempted,
**Then** zod blocks client-side with localized messages; API validation errors map to i18n messages by error code — amounts are strings end-to-end, two decimals, dot separator (D1).

**Given** a mobile-browser viewport,
**When** I complete the entry flow,
**Then** it is fully usable (NFR8) — this flow is the performance budget anchor.

**Given** the feature,
**When** tests run,
**Then** form component tests (validation, pending state) and transactions-module create specs merge with this story; all strings in both locales (NFR1, FR19).

### Story 2.4: Edit & Delete Transactions

As Oleksii,
I want to correct or remove any of my transactions,
So that my records stay accurate.

**Acceptance Criteria:**

**Given** a transaction in the list,
**When** I open it for editing,
**Then** the form pre-fills with current values and a valid submission updates it via the generated client, visible without a full reload (FR7, NFR5 pattern).

**Given** a transaction,
**When** I delete it,
**Then** a confirmation is required, the API returns 204 (D7), and the list updates.

**Given** a transaction belonging to another user,
**When** edit or delete is attempted,
**Then** the repository scoping denies it (not-found behavior, no cross-user path — FR21), asserted by an integration test.

**Given** the feature,
**When** tests run,
**Then** update/delete module specs and component tests merge with this story; all strings in both locales.

### Story 2.5: Filter & Sort the List

As Oleksii,
I want to filter my transactions by type and category, and sort by date or amount,
So that I can find and inspect exactly the records I care about (FR9).

**Acceptance Criteria:**

> Currency was dropped as a filter (2026-06-15 — single profile-default currency); the category filter is subtree-aware (selecting a parent includes its descendants). As shipped.

**Given** the transactions list,
**When** I apply filters (type, category) or sorting (date or amount, asc/desc),
**Then** all state travels via camelCase URL search params (D9/D7 — shareable, back-button-safe) and the API applies them server-side.

**Given** multiple filters at once,
**When** combined with month navigation,
**Then** filters persist while stepping months, and results honor every active criterion.

**Given** a filter combination with no matches,
**When** viewed,
**Then** the localized empty state distinguishes "no transactions this month" from "nothing matches the filters."

**Given** the feature,
**When** tests run,
**Then** repository specs cover each filter, combinations, and both sort orders; component tests cover filter controls; all strings in both locales (NFR1).

### Story 2.6: Organize Categories

As Oleksii,
I want to create, rename, restructure, and safely delete categories in a hierarchy,
So that my seeded two-level category set becomes the structure I actually think in (FR10, FR11, FR12).

**Acceptance Criteria:**

**Given** the categories page,
**When** it loads,
**Then** the `transaction-categories` module serves the user-scoped hierarchy rendered as a tree (top-level + children) via the regenerated client.

**Given** the tree,
**When** I create or rename a category, or move one to a different parent or to top level,
**Then** the change persists (FR10) — enabling restructuring of the seeded two-level set (FR11) — and moving a category under its own descendant is rejected (cycle prevention).

**Given** a category with no transactions and no children,
**When** I delete it,
**Then** a simple confirmation suffices and the category is removed.

**Given** a category that has transactions and/or child categories,
**When** I delete it,
**Then** the API contract requires reassignment targets (transactions → another category; children → another parent or top level) as mandatory parameters — no request shape allows orphaned or silently uncategorized data (FR12, D7).

**Given** Testcontainers integration tests,
**When** the suite runs,
**Then** reassignment integrity (counts before/after, no orphans), cycle prevention, and user scoping are asserted (NFR1); all strings in both locales; tree usable on mobile (NFR8).

## Epic 3: Dashboard & Stats

A user can answer "where did money go" in one screen: per-period and per-currency totals, category breakdown, and a 12-month trend — all computed as exact SQL aggregations (D1), verified against the seeded data.

### Story 3.1: Monthly Money Summary

As Oleksii,
I want the dashboard to show total income, expense, and net for a month,
So that one glance tells me where the month stands (FR13, FR14).

**Acceptance Criteria:**

> Currency simplified 2026-06-15: figures are always in the user's profile-default currency (FR5). There is no currency picker. The summary endpoint aggregates per-currency in SQL (scoped to the profile-default currency) so multi-currency data never cross-aggregates, but currency is not a user-facing selection.

**Given** the `analytics` module,
**When** the summary endpoint is called for a period (in the user's profile-default currency),
**Then** income, expense, and net are computed as SQL aggregations returning string amounts (D1), scoped to the authenticated user and to the profile-default currency (no cross-currency aggregation), via the regenerated client.

**Given** a signed-in user opening the dashboard,
**When** it loads,
**Then** the period defaults to the current month and figures are shown in the profile-default currency (FR5/FR14); if the profile-default currency has no transactions in the period, the figures are zero with a localized empty state (no currency picker, no most-frequent fallback).

**Given** the month stepper,
**When** I navigate to a previous month,
**Then** summary figures update for comparison (the monthly-review flow).

**Given** integration tests against the seeded data,
**When** the suite runs,
**Then** summary figures match independently computed expected totals exactly — no floating-point drift (FR18, NFR1 priority); skeletons during load; usable on mobile (NFR8); both locales.

### Story 3.2: Expense Breakdown by Category

As Oleksii,
I want to see expenses broken down by category for the selected month,
So that I can spot outliers — where the money actually went (FR15).

**Acceptance Criteria:**

**Given** the analytics breakdown endpoint,
**When** called for a period (in the user's profile-default currency),
**Then** expenses are grouped by top-level category — child-category spend rolls up into its parent (FR15) — as SQL aggregation with string amounts (D1), user-scoped and scoped to the profile-default currency.

**Given** the dashboard,
**When** the breakdown renders,
**Then** categories are ordered by amount descending with per-category totals and share-of-total, honoring the same period selection as the summary (in the profile-default currency, FR14), with a localized empty state when no expenses exist.

**Given** integration tests against the seeded data,
**When** the suite runs,
**Then** roll-up correctness is asserted for a restructured hierarchy (child sums appear under the parent) and totals reconcile exactly with the summary's expense figure (FR18, NFR1).

### Story 3.3: Twelve-Month Trend

As Oleksii,
I want a month-over-month income/expense view across the trailing 12 months,
So that I can see the direction my finances are moving (FR16).

**Acceptance Criteria:**

**Given** the analytics trend endpoint,
**When** called (in the user's profile-default currency),
**Then** it returns income and expense per month for the trailing 12-month window as SQL aggregation with string amounts (D1), user-scoped and scoped to the profile-default currency, including zero months as zeros.

**Given** the dashboard,
**When** the trend renders,
**Then** the 12 months display as a month-by-month income-vs-expense visual in the profile-default currency (FR14), localized month labels via Intl in both locales; any charting dependency introduced is recorded per the architecture's new-dependency rule.

**Given** integration tests against the seeded data,
**When** the suite runs,
**Then** per-month figures match independently computed expectations exactly across the window boundary (months with no data, FR18, NFR1); the view is usable on mobile (NFR8).

---

# Epic 4+ Planning — Reference Parity

> **Added 2026-06-16 (parity-planning round).** Epics 1–3 above shipped the trimmed v1 core. The reference-parity spike (`reference-parity-gap-backlog.md`) is complete and is the input for Epic 4+. **Parity bar:** same features as the reference (`example/track-my-life` + `example/tracker-backend-api`), UI/UX **at least as good**, **mobile-first**. The requirements below extend the PRD's FR set — they are parity-driven product requirements derived from the reference, not new PRD FRs. **NFR1–NFR8, ED1–ED4, and architecture decisions D1–D10 remain binding for every Epic 4+ story** (money-as-strings/D1, generated-client-only/NFR6, repository layering/D7, both-locales-per-commit/FR19–FR20, tests-in-story/NFR1, exact-pins + adapted-never-copied/ED1).
>
> Priority: **P0** = required for parity / blocks the import→see-your-money spine · **P1** = expected for a credible product · **P2** = polish or explicit decision.
>
> **Focus (operator decision 2026-06-16):** prioritize **better UI/UX and improving current features** over net-new heavy features. The mobile-first quality pass (RP-U) and improving what already ships (dashboard, transactions list, by-category) come first; recurring (RP-F6) and budgets (RP-F11) are deferred to later epics. Decisions RP-D1–RP-D6 are now **settled** (see below) — currency stays single-default, auth stays better-auth, error envelope + pagination stay supertool's, `date` is **not** migrated to `timestamptz` (logged as tech debt: `implementation-artifacts/tech-debt-transaction-date-to-timestamptz.md`), budgets deferred.
>
> **Evidence-reference convention (binding for every Epic 4+ story):** each story MUST cite, in its context, (a) the relevant **reference screenshots** by path (`_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/<name>.png`) and the matching **supertool baseline** capture (`…/supertool/<name>.png`) so the gap is visual and unambiguous, and (b) the **reference code path** under `example/track-my-life` (frontend) / `example/tracker-backend-api` (backend) to adapt from — **adapted, never copied (ED1)**. The capture-name keys are in the gap-backlog "Evidence" column. A story that says "match the reference" without naming the screenshot(s) and reference path is under-specified.

## Reference-Parity Requirements Inventory

### Frontend feature gaps (RP-F)

- **RP-F1 (P0) — Onboarding flow.** Post-signup flow: choose default currency → seed categories (assign reference defaults OR import a file) → land on dashboard. supertool currently drops signup straight into the app. (Reference: 2 live steps; its unused 3rd `password` step is not parity.)
- **RP-F2 (P0) — User-facing transaction import.** Upload → validate → preview row counts → summary → server execute; auto-creates categories/subcategories; CSV (papaparse) + JSON. Wired into onboarding (RP-F1) **and** a first-class standalone page. Reuses the existing seed/ingest logic (Story 2.1). Exceed the reference, whose standalone import is a bare `<input>` with no drag-drop/preview (§5).
- **RP-F3 (P0) — Full dashboard widget set.** Add the 3 widgets supertool lacks — **top-categories (ranked)**, **daily-spending (bar)**, **recent-transactions list** — plus a dashboard date-range/type filter bar, to the existing summary + breakdown + 12-month-trend. Fix the reference's dashboard bugs in the process (§5: empty default period, daily-spending ignoring range, donut rendering only its legend). Honors the single-default-currency model (no picker).
- **RP-F4 (P1) — Transactions by-category drill-down.** Accordion of categories → category-detail view with a per-category transaction list. Add the per-category totals/counts the reference omits (§5).
- **RP-F5 (P1) — Bulk delete.** Multi-select + fixed action bar (N selected / select-all / clear / delete), batch cap 100, partial-failure re-selection. Must be **consistent across the by-date list AND the by-category view** (reference only wired it on by-category, §5) and **touch-usable**, not hover-only.
- **RP-F6 (P1) — Recurring transactions.** Net-new subtree: list, create (frequency/interval), pause/resume (optimistic), status filter, bulk delete. Largest single FE+BE item (pairs with RP-B5/RP-B7).
- **RP-F7 (P1) — Export.** Server-generated CSV + JSON from the transactions list, scoped + all (pairs with RP-B6).
- **RP-F8 (P1) — Marketing landing page.** Real single-page marketing site (hero, advantages, reviews, FAQ, footer) replacing the bare 3-link placeholder at `/`. Low bar to beat — reference is sparse, emoji icons, **broken FAQ accordion** (§5).
- **RP-F9 (P1 — current-feature improvement) — Transactions list UX enrichment.** Copy/duplicate a transaction; month/year navigator; richer hierarchical category picker. _Time-of-day picker dropped_ — it requires `timestamptz` (RP-D5, deferred to tech debt). Strong fit for the UI/UX-and-current-features focus.
- **RP-F10 (P2) — Settings completion.** Add change-password and delete-account (with confirm dialog) to the existing name/locale/default-currency settings; actually collect first/last name.
- **RP-F11 (DEFERRED) — Budgets.** Reference is a **stub** (heading only, no CRUD; a `Budget` table exists). **Deferred to a future epic** (RP-D6, operator decision 2026-06-16) — not implemented in either project, low value to mirror a stub, and out of step with the UI/UX-and-current-features focus. Revisit when a real budgets feature is prioritized (would also pull in RP-B7 budget-overspend + RP-B8 audit log).

### Backend capability gaps (RP-B)

- **RP-B1 (P0) — `POST /transactions/import`.** Multipart JSON/CSV ingest, auto-creates categories. Powers RP-F2. Built on the existing seed ingest logic.
- **RP-B2 (P0) — Missing analytics endpoints.** Add `top-categories` and `daily-spending` to the existing summary/breakdown/trend. Powers RP-F3. SQL aggregation, string amounts (D1), user-scoped + profile-default-currency-scoped.
- **RP-B3 (P1) — Caching layer.** Reference caches analytics + list responses (Redis `CacheModule`, TTLs, cache-tag invalidation); supertool hits cold Postgres every call. **Decision (RP-D, local-PoC):** Redis vs in-memory.
- **RP-B4 (P2) — Backend rate limiting.** Reference uses a Redis-backed throttler on auth + expensive routes; supertool has in-memory throttle on auth only. Decide whether Redis-backed throttling is worth it locally.
- **RP-B5 (P1) — Recurring engine.** Table + CRUD + `@nestjs/schedule` processor. Behind RP-F6.
- **RP-B6 (P1) — Export endpoint.** `GET /transactions/export`. Behind RP-F7.
- **RP-B7 (P1, tied to RP-F6) — Scheduled tasks.** `@nestjs/schedule`: recurring processor + expired-token sweep. Budget-overspend dropped (budgets deferred, RP-F11). Only if RP-F6 (recurring) is built — itself deferred behind the UI/UX-and-current-features focus.
- **RP-B8 (DEFERRED) — Audit log.** Reference has an `AuditLog` table + global mutation interceptor. Overkill for a PoC; **deferred** alongside budgets (RP-F11).
- **RP-B9 (P2) — Full-text search.** Reference: GIN `pg_trgm` on `transaction.description` + `?search=`. Add if list UX (RP-F9) warrants.
- **RP-B10 (P2) — Security middleware.** Reference uses helmet + compression + cookie-parser; supertool has none. Cheap hardening — add helmet/compression.

### UI/UX & mobile-first deltas (RP-U) — highest-value UI work

> Central spike finding: the reference's mobile is "genuinely solid"; **supertool's mobile is currently broken.** Fold a mobile-QA check into every P0/P1 story.

- **RP-U1 (P0) — Mobile navigation.** Build a responsive mobile nav drawer + dimmed backdrop. Today supertool has no mobile drawer — the desktop header renders as-is at 390px, "Operator" overflows the edge, user menu clipped.
- **RP-U2 (P0) — Mobile transactions table.** Card/stacked layout on mobile. Today a fixed wide HTML table overflows horizontally — Amount/Currency/Note/Actions clipped off-screen, no scroll affordance. Worst offender.
- **RP-U3 (P1) — In-app navigation.** Add primary app navigation; today there's a single top header and you move between screens via landing links / direct URLs.
- **RP-U4 (P1) — Touch-usable row actions.** Make row actions touch-reachable (long category names clip Edit/Delete on mobile). Exceed the reference's hover-only actions (§5).
- **RP-U5 (P1) — Empty / first-run states.** Auto-fit the dashboard/list period to the data's actual date range on first load (data lives in 2025; current month June 2026 is empty). Reference shares this bug — exceed it (§5).
- **RP-U6 (P1) — Landing.** See RP-F8.

### Reference defects — exceed, never replicate (spike §5)

Empty default period ("No data"/"No transactions" on first load) · daily-spending chart ignores selected range · category donut renders only its legend · bulk-delete inconsistent (only by-category) · hover-only row actions (touch-unusable) · by-category list shows no totals/counts · standalone import is a bare file input · landing FAQ accordion non-functional · auth forms duplicate helper text · empty user menu · no dark mode anywhere · profile names not collected at signup. **Any screen Epic 4+ touches must beat the reference, not inherit its bug.**

### supertool strengths — protect (spike §6)

Token-based theme toggle + dark mode (charts preserved) · locale switcher UI + genuine en/uk ICU i18n · cleaner auth forms (no duplicate helper text) · single per-user default-currency model (intentional simplification) · URL-driven period state (shareable, back-button-safe). **Epic 4+ must not regress these.**

### Decisions — all settled (spike §7, operator 2026-06-16)

- **RP-D1 — Currency: SETTLED — keep single per-user default.** Do NOT re-introduce the reference's currency filter/picker or cross-currency aggregation (decided 2026-06-15). _Guard against reintroduction in every Epic 4+ story._
- **RP-D2 — Auth architecture: SETTLED — keep better-auth.** The reference's custom JWT/Passport/refresh-tokens/CSRF/OAuth/email-verification stack is not a parity gap (FR1 descoped OAuth + email verification).
- **RP-D3 — Error envelope: SETTLED — keep supertool's** `{ statusCode, code, message, details? }`. RFC-7807 switch rejected: breaking cross-cutting change (generated client + every error path), not worth it for a PoC.
- **RP-D4 — Pagination shape: SETTLED — keep supertool's** `{ data, meta }`. Reference's richer shape + RFC-5988 Link headers is cosmetic divergence.
- **RP-D5 — Transaction date type: SETTLED — do NOT migrate; keep bare `date`.** `timestamptz` migration deferred to tech debt (`implementation-artifacts/tech-debt-transaction-date-to-timestamptz.md`). Consequence: RP-F2 import truncates source time-of-day (acceptable — seed already does), RP-F6 recurring runs at day granularity, **RP-F9 time-of-day picker dropped**. Revisit only if intra-day analytics / due-at-time recurring / time-preserving import become requirements.
- **RP-D6 — Budgets: SETTLED — defer to a future epic.** Not implemented in either project; mirroring the reference stub is low value and off-focus. Pulls RP-B7 budget-overspend + RP-B8 audit log out of Epic 4+ with it.
- **RP-D7 — Caching / rate-limit / security backend (RP-B3/B4/B10):** local-PoC scope. Caching (RP-B3) only matters once analytics get heavier (Epic 5); recommend in-memory over Redis for a local PoC. helmet/compression (RP-B10) is cheap hardening, fold in opportunistically. Backend Redis rate-limit (RP-B4) — defer. _Confirm during epic design; none block the UI/UX-and-current-features focus._

### Parity Requirements Coverage Map (Epic 4–7, finalized & approved 2026-06-16)

- RP-F1 onboarding → **Epic 5**
- RP-F2 user-facing import → **Epic 5** (with RP-B1)
- RP-F3 dashboard widgets → **Epic 4** (defect-fixes on shipped widgets) + **Epic 5** (new top-categories/daily-spending/recent widgets + filter bar, with RP-B2)
- RP-F4 by-category drill-down → **Epic 5**
- RP-F5 bulk delete → **Epic 6**
- RP-F6 recurring → **Deferred**
- RP-F7 export → **Epic 6** (with RP-B6)
- RP-F8 landing page → **Epic 7**
- RP-F9 list UX enrichment → **Epic 6** (time-of-day sub-item dropped, RP-D5)
- RP-F10 settings completion → **Epic 7**
- RP-F11 budgets → **Deferred**
- RP-B1 import endpoint → **Epic 5**
- RP-B2 top-categories + daily-spending analytics → **Epic 5**
- RP-B3 caching (in-memory) → **Epic 6**
- RP-B4 backend Redis rate-limit → **Deferred**
- RP-B5 recurring engine → **Deferred**
- RP-B6 export endpoint → **Epic 6**
- RP-B7 scheduled tasks → **Deferred** (tied to RP-F6)
- RP-B8 audit log → **Deferred** (tied to RP-F11)
- RP-B9 full-text search → **Epic 6**
- RP-B10 security middleware (helmet/compression) → **Epic 7** (opportunistic)
- RP-U1 mobile nav → **Epic 4**
- RP-U2 mobile transactions table → **Epic 4**
- RP-U3 in-app navigation → **Epic 4**
- RP-U4 touch row actions → **Epic 4**
- RP-U5 empty/first-run period auto-fit → **Epic 4**
- RP-U6 landing → **Epic 7** (= RP-F8)

Cross-cutting: a mobile-QA check (light + dark, both viewports, against the reference capture) is folded into **every** Epic 4–7 story per the evidence-reference convention above. Every item maps to an epic or to Deferred — none dropped.

### Candidate epic themes — re-ordered for the UI/UX-and-current-features focus (FINALIZED into Epics 4–7 above, 2026-06-16)

> ⚠️ **SUPERSEDED (2026-06-16).** This section is the historical theme-proposal that was finalized into the fully-specified **Epic 4–7** sections above (with stories + acceptance criteria). It is retained for the planning trail only — **the Epic 4–7 sections above are canonical.** Do not treat the boundaries below as open/proposed.

Reflecting the operator focus: fix/improve what ships and make it mobile-first **before** net-new heavy features. Recurring (RP-F6) and budgets (RP-F11) are deferred to later epics.

1. **Epic 4 — Mobile-first quality + current-feature polish (P0, do first):** the mobile pass (RP-U1 nav drawer, RP-U2 stacked transactions table, RP-U3 in-app nav, RP-U4 touch row actions, RP-U5 auto-fit period) + dashboard bug-fixes that need no new endpoints (RP-F3's empty-period/donut/daily-range defects, RP-U5). Make existing screens beat the reference and work on a phone. Mobile-QA check baked into every story.
2. **Epic 5 — Complete the money loop to parity (P0):** onboarding (RP-F1) + user-facing import (RP-F2/RP-B1) + the remaining dashboard widgets (RP-F3 top-categories/daily-spending/recent + RP-B2 endpoints) + by-category drill-down (RP-F4). The "import your data and see your money" spine, built on the now-solid mobile baseline.
3. **Epic 6 — Manage at scale + current-feature enrichment (P1):** list UX enrichment (RP-F9 duplicate/navigator/category-picker), bulk delete done right (RP-F5), export (RP-F7/RP-B6), search if warranted (RP-B9), caching once analytics are heavier (RP-B3, in-memory).
4. **Epic 7 — Settings & landing (P1/P2):** change-password + delete-account (RP-F10), real landing page (RP-F8/RP-U6).
5. **Later / deferred:** recurring & automation (RP-F6/RP-B5/RP-B7), budgets (RP-F11/RP-B8), backend Redis rate-limit (RP-B4). helmet/compression (RP-B10) folded in opportunistically.

> **Note (historical):** these boundaries were a starting proposal; epic design has since finalized them into the Epic 4–7 sections above (canonical). The ordering principle is fixed by the operator: UI/UX + current features first.

---

## Epic 4: Mobile-First & Existing-Screen Quality

The tracker that already ships becomes fully usable and polished on a phone — closing the spike's central finding (supertool mobile broken, reference mobile solid) before any net-new feature. No new capabilities: a responsive shell with a mobile nav drawer and real in-app navigation, a transactions list that stacks and is touch-usable on small screens, a first-run period that auto-fits the data instead of showing "No data," and a visual-QA pass on the already-shipped dashboard widgets. Every story carries the binding rules (D1 money-as-strings, NFR6 generated-client-only, FR19/FR20 both-locales, NFR1 tests-in-story) and the evidence-reference convention (cite reference + supertool capture + `example/` path; adapt, never copy — ED1). Each story executes the Story 1.9 visual-QA protocol (light + dark, both viewports, reference comparison in the Dev Agent Record).

> **Evidence base for this epic:** reference captures `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/` (auth-app screens logged in `…/spike-reference-parity/41-ref-capture-authenticated-log.md`); supertool baseline `…/visual-qa/spike-reference-parity/supertool/` (logged in `…/42-supertool-capture-log.md`, the `42-…` keys). Reference code to adapt from: `example/track-my-life/` (frontend shell, list, dashboard).

### Story 4.1: Mobile Navigation Drawer & In-App Navigation

As Oleksii on my phone,
I want a navigation drawer and real in-app navigation,
So that I can move between the tracker's screens without overflowing headers or hunting for direct URLs (RP-U1, RP-U3).

**Acceptance Criteria:**

> Evidence: reference drawer + dimmed backdrop in `41-…`/`reference/` (mobile viewport); supertool's broken 390px header — "Operator" overflowing the edge, user menu clipped — in `42-…`/`supertool/`. Adapt from `example/track-my-life` shell nav. Lives in `packages/shell` (FR3/FR4: zero changes to tool-registry mechanism; nav still driven by `tools.ts`).

**Given** a mobile-browser viewport (≤ the shared breakpoint),
**When** I open any tracker screen,
**Then** the shell renders a hamburger trigger that opens a nav drawer with a dimmed backdrop, the drawer lists the primary destinations (dashboard, transactions, categories, settings), nothing in the header overflows the viewport edge, and the user menu is fully reachable.

**Given** the desktop viewport,
**When** the shell renders,
**Then** the existing header layout is preserved (no regression) and primary navigation is visible without the drawer.

**Given** the drawer open,
**When** I select a destination or tap the backdrop,
**Then** the drawer closes and navigation occurs via the app router, with the active destination indicated.

**Given** the protected-route and locale behaviour,
**When** I navigate between screens,
**Then** auth redirects and next-intl locale routing keep working (no redirect loops — verified in a running app), and every drawer/nav string exists in both `en.json` and `uk.json` (FR19/FR20).

**Given** the shell components,
**When** tests run,
**Then** @testing-library/react tests cover drawer open/close and navigation rendering, and the Dev Agent Record carries light+dark mobile+desktop screenshots vs the reference (NFR1, Story 1.9 protocol).

### Story 4.2: Mobile-Usable Transactions List

As Oleksii on my phone,
I want the transactions list to stack readably and expose row actions to touch,
So that I can review and act on transactions on a small screen — today's worst offender (RP-U2, RP-U4).

**Acceptance Criteria:**

> Evidence: supertool's fixed-width table overflowing horizontally with Amount/Currency/Note/Actions clipped off-screen in `42-…`/`supertool/`; reference's readable stacked mobile rows in `41-…`/`reference/`. Exceed the reference's hover-only actions (§5). Existing list component in `apps/money-tracker`.

**Given** a mobile-browser viewport,
**When** the transactions list renders,
**Then** rows display as a stacked/card layout (no horizontal overflow, no off-screen clipping) showing date, category, type, amount, currency, and note — amounts/dates via Intl/next-intl (D1, never ad-hoc).

**Given** the desktop viewport,
**When** the list renders,
**Then** the existing tabular layout is preserved (no regression).

**Given** a row on any viewport (especially touch, and rows with long category names),
**When** I want to edit or delete it,
**Then** the row actions are reachable without hover and without being clipped — touch-usable, exceeding the reference's hover-only actions.

**Given** the list,
**When** tests run,
**Then** a component test asserts the responsive layout switch and action reachability, all strings are in both locales, and the Dev Agent Record carries light+dark mobile+desktop screenshots vs the reference (NFR1, NFR8).

### Story 4.3: First-Run Period Auto-Fit

As Oleksii opening the tracker for the first time after importing years of history,
I want the dashboard and list to open on a period that actually has data,
So that I see my money instead of an empty "No data" current month (RP-U5).

**Acceptance Criteria:**

> Evidence: §5 reference defect — defaults to current period (June 2026) vs data in 2025 → "No data"; supertool shares it (`42-…`/`supertool/` dashboard + list near-empty on June 2026). Exceed the reference, don't replicate. URL-driven period state (D9) — protect it (§6).

**Given** a user whose most recent transaction is before the current month,
**When** they open the dashboard or transactions list with no period in the URL,
**Then** the default period auto-fits to the month of the user's latest transaction (not the empty current month), so data is visible on first load.

**Given** a user with transactions in the current month,
**When** they open with no period in the URL,
**Then** the period defaults to the current month (existing behaviour preserved).

**Given** a period explicitly present in the URL search params,
**When** the screen loads,
**Then** that period wins — auto-fit only applies when no period is specified (URL-driven state stays authoritative and shareable, D9).

**Given** a user with no transactions at all,
**When** they open either screen,
**Then** a localized empty state renders (both locales) — no crash, no infinite look-back.

**Given** the behaviour,
**When** tests run,
**Then** unit/component tests cover all four cases (latest-month fit, current-month default, URL override, no-data), and figures still reconcile with the seeded data (NFR1).

### Story 4.4: Dashboard Widget Visual QA & Defect Fixes

As Oleksii,
I want the already-shipped dashboard widgets to render correctly in both themes and on mobile,
So that the summary, breakdown, and trend I rely on are trustworthy and beat the reference's broken rendering (RP-F3 defect side).

**Acceptance Criteria:**

> Evidence: §5 reference defects — spending-by-category donut renders only its legend (graphic missing). Verify supertool's breakdown (Story 3.2) and trend (Story 3.3) do not share it; fix if they do. Reference dashboard in `41-…`/`reference/dashboard--overview*`; supertool in `42-…`/`supertool/`. Charts must be preserved in dark mode — protect this strength (§6).

**Given** the shipped breakdown (donut) and 12-month trend widgets,
**When** they render in light and dark themes at desktop and mobile viewports,
**Then** the chart graphics render fully (not legend-only), are legible, and dark-mode token theming is preserved (§6 strength) — any defect found is fixed, any intentional divergence recorded.

**Given** a period with no expenses or a zero-net month,
**When** the widgets render,
**Then** localized empty/zero states display cleanly (both locales) rather than broken or blank charts.

**Given** the widgets on a mobile viewport,
**When** they render,
**Then** they are fully usable and do not overflow (NFR8).

**Given** the dashboard widgets,
**When** the story completes,
**Then** the Dev Agent Record contains side-by-side light+dark, mobile+desktop screenshots per widget compared against the reference (Story 1.9 protocol), and any chart-library behaviour touched is re-verified by the existing analytics tests (NFR1).

## Epic 5: Import Your Data & See Your Money

A new user onboards (default currency → seed default categories or import a file → land on the dashboard), brings their own data in through a first-class import flow (upload → validate → preview → execute, CSV + JSON, auto-creating categories), and sees a complete dashboard — top-categories, daily-spending, and recent-transactions widgets with a filter bar, on top of the existing summary/breakdown/trend — plus a by-category drill-down with the per-category totals/counts the reference omits. This is the "import your data and see your money" spine, built on Epic 4's solid mobile baseline. Binding throughout: D1 money-as-strings, NFR6 generated-client-only, D7 controller→service→repository, FR19/FR20 both-locales, NFR1 tests-in-story, the import idempotency pattern (D2: `import_key` = SHA-256 + index, `ON CONFLICT DO NOTHING`), the single-default-currency model (RP-D1 — no picker), bare `date` granularity (RP-D5 — import truncates source time-of-day, a known accepted truncation), and the evidence-reference convention (adapt from `example/`, never copy — ED1). A mobile-QA check rides in every story.

> **Evidence base for this epic:** reference captures `…/reference/onboarding--currency`, `onboarding--categories`, `import--upload`, `import--preview`, `import--result`, `import--page`, `dashboard--overview*`, `transactions--by-category`, `transactions--category-detail` (auth-app log `41-…`). Reference code to adapt from: `example/track-my-life` (onboarding, import UI, dashboard widgets, by-category) and `example/tracker-backend-api` (import endpoint, analytics endpoints). The seed ingest to reuse is supertool's own Story 2.1 code in `apps/api`.

### Story 5.1: Transaction Import Endpoint

As the operator-developer,
I want a `POST /transactions/import` endpoint that ingests CSV/JSON and auto-creates categories,
So that the user-facing import (5.2) and onboarding (5.3) have a contract to call, reusing the proven seed ingest (RP-B1).

**Acceptance Criteria:**

> Evidence/reference: `example/tracker-backend-api` import module (multipart JSON/CSV, auto-creates categories/subcategories). Reuse supertool's Story 2.1 seed ingest (category derivation, decimal-safe amounts, `import_key` dedup). No schema change — uses the existing `transactions`/`transaction_categories` tables (RP-D5: stored at `date` granularity; source time-of-day truncated, asserted as a documented behaviour).

**Given** the `transactions` module,
**When** `POST /api/v1/transactions/import` receives a multipart CSV or JSON payload (shape `{Date, Category, Type, Amount, Currency, Subcategory?}`),
**Then** it validates the payload, derives the two-level category set (Category→top-level, Subcategory→child) auto-creating missing categories scoped to the authenticated user (FR21), preserves amounts/currencies/dates exactly with decimal-safe arithmetic (D1/FR18), and persists via the repository layer (D7).

**Given** a request that only asks for a preview (no commit),
**When** the endpoint runs in preview mode,
**Then** it returns validated row counts, the categories that would be created, and a summary — without writing — so the UI can show a preview before execute.

**Given** the same file imported twice (or rows overlapping existing data),
**When** import executes,
**Then** `import_key` = SHA-256 of the normalized record + index with `ON CONFLICT DO NOTHING` yields zero duplicates (D2), and near-duplicate category strings are surfaced in the import report, never silently merged.

**Given** a malformed payload (bad amount, unknown type, wrong file shape),
**When** it is submitted,
**Then** the endpoint fails with the shared error envelope `{ statusCode, code, message, details? }` (D7/RP-D3) and writes nothing (all-or-nothing per import run).

**Given** Testcontainers integration tests,
**When** the suite runs,
**Then** preview counts, execute correctness, re-run idempotency, decimal-safe per-currency sums, category auto-creation, user-scoping, and time-of-day truncation are asserted against real Postgres (NFR1 priority target); the generated client is regenerated for the new endpoint (drift gate green, NFR6/D8).

### Story 5.2: Standalone Import Page

As Oleksii,
I want a first-class page to upload a file, preview what will import, and execute,
So that I can bring my own data in confidently — exceeding the reference's bare file input (RP-F2).

**Acceptance Criteria:**

> Evidence: reference `import--upload`/`--preview`/`--result`/`--page` (`41-…`); §5 defect — reference's standalone import is a bare native `<input>` with no drag-drop/preview → exceed it. Consumes 5.1 via the generated client (NFR6). CSV parsing via papaparse (new dep — exact-pin, sanctioned + recorded per architecture new-dependency rule).

**Given** the import page,
**When** I select or drag-drop a CSV or JSON file,
**Then** the file is parsed client-side (papaparse for CSV), basic shape validation runs, and I see a clear pre-upload state — not a bare native input.

**Given** a parsed file,
**When** I proceed to preview,
**Then** the page calls the 5.1 preview mode and shows row counts, categories that will be created, and a summary, with any validation problems surfaced row-aware before I commit.

**Given** a previewed import,
**When** I confirm execute,
**Then** the server action calls the import endpoint, a pending state disables the control, and on success I see a result summary (imported/skipped-duplicate counts) and can navigate to the now-populated list/dashboard; `revalidatePath` refreshes affected views (D9).

**Given** an import error or partial validation failure,
**When** it returns,
**Then** errors map to localized messages by error code (never raw API text), and I can correct and retry.

**Given** a mobile-browser viewport,
**When** I run the whole upload→preview→execute flow,
**Then** it is fully usable (NFR8).

**Given** the feature,
**When** tests run,
**Then** component tests cover upload/preview/execute states and error handling, all strings exist in both locales (FR19/FR20), and the Dev Agent Record carries light+dark mobile+desktop screenshots vs the reference (Story 1.9 protocol, NFR1).

### Story 5.3: Onboarding Flow

As a brand-new user who just signed up,
I want a short guided setup — pick my currency, then seed default categories or import my file — that lands me on the dashboard,
So that I start with a usable, populated tracker instead of an empty app (RP-F1).

**Acceptance Criteria:**

> Evidence: reference `onboarding--currency`, `onboarding--categories` (`41-…`; reference has 2 live steps — its unused `password` step is NOT parity). Reuses 5.2's import path and the existing profile/default-currency (FR5) + Story 2.1 default-category derivation. Single-default-currency model (RP-D1).

**Given** a user who has just completed sign-up and has no transactions/categories,
**When** they next enter the app,
**Then** they are routed into the onboarding flow rather than a blank app (and existing users with data are never forced into it).

**Given** step one (currency),
**When** I choose my default currency,
**Then** it is saved to my profile (FR5) and becomes the single scoping currency for lists and the dashboard (no picker later, RP-D1).

**Given** step two (categories),
**When** I choose to seed a default category set OR import a file,
**Then** the default-set path creates a starter two-level category hierarchy, and the import path reuses the 5.2 import (upload→preview→execute) — both scoped to my user.

**Given** I finish onboarding (or explicitly skip the optional category step),
**When** the flow completes,
**Then** I land on the dashboard, which — with imported data — shows real figures (and with the first-run auto-fit from 4.3, on a period that has data).

**Given** the flow,
**When** tests run,
**Then** routing (new-user-in / existing-user-out), currency persistence, both category paths, and completion→dashboard are covered; all strings in both locales; the flow is mobile-usable (NFR8); Dev Agent Record carries screenshots vs the reference (NFR1).

### Story 5.4: Dashboard Analytics Endpoints — Top Categories & Daily Spending

As the operator-developer,
I want `top-categories` and `daily-spending` analytics endpoints,
So that the new dashboard widgets (5.5) have exact, user-scoped, single-currency data to render (RP-B2).

**Acceptance Criteria:**

> Evidence/reference: `example/tracker-backend-api` analytics module (`top-categories`, `daily-spending`). Follows the existing supertool analytics endpoints (summary/breakdown/trend) exactly — SQL aggregation, string amounts (D1), profile-default-currency scoping (RP-D1/FR14), per-currency SQL retained for correctness. Daily-spending buckets by `date` (RP-D5, day granularity) — and must honour the selected range (fixing §5 reference defect where daily-spending ignores the range).

**Given** the `analytics` module,
**When** the top-categories endpoint is called for a period (in the profile-default currency),
**Then** it returns the ranked categories by spend (top-level roll-up where a hierarchy exists) with string amounts and share-of-total, as SQL aggregation, scoped to the authenticated user and the profile-default currency.

**Given** the daily-spending endpoint,
**When** it is called for a selected period,
**Then** it returns per-day expense totals **for that exact range** (not pinned to the current month — §5 defect fixed), string amounts (D1), user- and currency-scoped, including zero days as zeros.

**Given** the new endpoints,
**When** the contract is built,
**Then** the generated client is regenerated (drift gate green, NFR6/D8) and the shared error envelope applies (D7).

**Given** Testcontainers integration tests against the seeded data,
**When** the suite runs,
**Then** ranked totals and per-day figures match independently computed expectations exactly (no float drift, FR18/NFR1), range honouring is asserted, and currency scoping is verified.

### Story 5.5: Dashboard Widgets — Top Categories, Daily Spending, Recent Transactions & Filter Bar

As Oleksii,
I want the dashboard to add top-categories, daily-spending, and recent-transactions widgets plus a filter bar,
So that one screen answers "where did my money go" as completely as the reference — but without its bugs (RP-F3 new-widget side).

**Acceptance Criteria:**

> Evidence: reference `dashboard--overview*` (6 widgets + filter bar, `41-…`); supertool today has 3 widgets (`42-…`). §5 defects to exceed: empty default period (handled by 4.3), daily-spending range, donut render (handled by 4.4). Single-default-currency: the filter bar is date-range + type only — NO currency picker (RP-D1). Consumes 5.4 via the generated client.

**Given** the dashboard (existing summary/breakdown/trend),
**When** it loads for the selected period,
**Then** three new widgets render — top-categories (ranked, with share-of-total), daily-spending (bar, honouring the selected range), and recent-transactions (latest N) — all in the profile-default currency (FR14), consuming 5.4's endpoints.

**Given** the dashboard filter bar,
**When** I change the date range or transaction type,
**Then** all widgets update consistently, the state travels via URL search params (D9 — shareable, back-button-safe), and there is no currency control (RP-D1).

**Given** a period with no data in the profile-default currency,
**When** the widgets render,
**Then** each shows a localized empty/zero state (both locales) — never a broken chart or "No data" wall (exceeding §5).

**Given** light/dark themes and a mobile viewport,
**When** the widgets render,
**Then** charts render fully in both themes (§6 strength protected) and the layout is usable on mobile (NFR8).

**Given** the feature,
**When** tests run,
**Then** component tests cover each widget and the filter bar (incl. URL-state round-trip), all strings exist in both locales, and the Dev Agent Record carries light+dark mobile+desktop screenshots vs the reference (Story 1.9 protocol, NFR1).

### Story 5.6: Transactions By-Category Drill-Down

As Oleksii,
I want to drill from a category into its transactions and see per-category totals,
So that I can investigate exactly where a category's money went — with the totals the reference forgot to show (RP-F4).

**Acceptance Criteria:**

> Evidence: reference `transactions--by-category`, `transactions--category-detail` (`41-…`); §5 defect — reference's by-category list shows no totals/counts → add them (exceed). Builds on the existing transactions + transaction-categories modules; user-scoped (FR21); profile-default currency (RP-D1).

**Given** the by-category view,
**When** it loads,
**Then** it renders the user's categories as an accordion/drill-down (top-level → children), each showing a per-category total and transaction count (in the profile-default currency) — the totals/counts the reference omits.

**Given** a category,
**When** I open its detail,
**Then** I see that category's transactions (child spend rolling up under a parent where a hierarchy exists), formatted via Intl/next-intl (D1), scoped to me, with the same period selection honoured.

**Given** a category with no transactions in the period,
**When** viewed,
**Then** a localized empty state renders (both locales).

**Given** a mobile-browser viewport,
**When** the drill-down renders,
**Then** it is fully usable (NFR8).

**Given** the feature,
**When** tests run,
**Then** repository/module specs cover the per-category aggregation and roll-up (reconciling exactly with the dashboard breakdown, FR18) and user-scoping; component tests cover the accordion + detail; all strings in both locales; Dev Agent Record carries screenshots vs the reference (NFR1).

## Epic 6: Manage Transactions at Scale

Power-user management of a large transaction set on the now mobile-solid surface: list UX enrichment (duplicate/copy, month/year navigator, richer hierarchical category picker), bulk delete done right (consistent across the by-date list AND by-category, touch-usable, batch cap 100, partial-failure re-selection), export (CSV + JSON, scoped + all — the round-trip partner to Epic 5's import), optional full-text search, and in-memory analytics caching once the dashboard is heavier. Binding throughout: D1/NFR6/D7/FR19-20/NFR1, the single-default-currency model (RP-D1), bare `date` granularity (RP-D5 — no time-of-day picker), and the evidence-reference convention (adapt from `example/`, never copy — ED1). Mobile-QA check in every story.

> **Evidence base for this epic:** reference captures `…/reference/transactions--bulk-delete-bar`, `transactions--export`, `transactions--create-category-picker` (auth-app log `41-…`). §5 defects to exceed: bulk-delete inconsistent (only by-category wired) and hover-only actions. Reference code to adapt from: `example/track-my-life` (list UX, bulk-delete bar, export trigger) and `example/tracker-backend-api` (export endpoint, `pg_trgm` search, `CacheModule`).

### Story 6.1: Transactions List UX Enrichment

As Oleksii,
I want to duplicate a transaction, jump months/years quickly, and pick categories from a real hierarchy,
So that repetitive entry and navigation over a large history are fast (RP-F9).

**Acceptance Criteria:**

> Evidence: reference `transactions--create-category-picker` (`41-…`) — hierarchical picker; reference also offers copy/duplicate + month/year navigator. **Time-of-day picker is dropped** (RP-D5, deferred `timestamptz`). Builds on Epic 4's mobile-solid list and the existing create/edit form.

**Given** a transaction in the list,
**When** I choose duplicate/copy,
**Then** the entry form opens pre-filled from that transaction (date defaulting to today), and saving creates a new transaction via the generated client — visible without a full reload (NFR5/D9).

**Given** the period navigation,
**When** I use the month/year navigator,
**Then** I can jump directly to any month/year (not only step previous/next), the period travels via URL search params (D9 — shareable, back-button-safe), and it composes with the 4.3 first-run auto-fit.

**Given** the category field in create/edit,
**When** I pick a category,
**Then** a hierarchical picker presents the two-level tree (parent → children) clearly — replacing any flat list — and supports the user's restructured hierarchy.

**Given** a mobile-browser viewport,
**When** I use duplicate, the navigator, and the picker,
**Then** all are fully usable (NFR8).

**Given** the feature,
**When** tests run,
**Then** component tests cover duplicate pre-fill, navigator URL round-trip, and the hierarchical picker; all strings in both locales; Dev Agent Record carries screenshots vs the reference (Story 1.9 protocol, NFR1).

### Story 6.2: Bulk Delete Transactions

As Oleksii,
I want to select many transactions and delete them in one action — on both the list and by-category views,
So that cleaning up a large or mis-imported set is fast and touch-usable (RP-F5).

**Acceptance Criteria:**

> Evidence: reference `transactions--bulk-delete-bar` (`41-…`); §5 defects to exceed — reference wires the action bar on by-category ONLY (by-date checkboxes show no bar) and actions are hover-only. supertool must be **consistent across both** views and **touch-usable**. Builds on the by-category drill-down (5.6) and the mobile list (4.2). New batch-delete endpoint (D7) or repeated scoped deletes — repository-scoped (FR21).

**Given** the transactions list AND the by-category detail view,
**When** I enter multi-select,
**Then** both views present the same selection model and a fixed action bar showing "N selected", select-all, clear, and delete — consistently (exceeding the reference's by-category-only wiring).

**Given** a selection,
**When** I confirm bulk delete,
**Then** the API deletes the selected transactions in a single batch scoped to the authenticated user (FR21), respects a batch cap of 100, returns the count deleted, and the views update without a full reload (D9).

**Given** a partial failure (some ids invalid/not owned),
**When** the batch returns,
**Then** the still-failing rows remain selected for retry and a localized message explains the partial result — never a silent drop or cross-user delete.

**Given** a touch/mobile viewport,
**When** I select and act,
**Then** the action bar and checkboxes are touch-reachable and not clipped (NFR8, exceeding the reference's hover-only actions).

**Given** the feature,
**When** tests run,
**Then** integration specs cover batch delete, the 100 cap, partial-failure re-selection, and user-scoping (user A cannot bulk-delete user B's rows); component tests cover the selection bar on both views; all strings in both locales (NFR1).

### Story 6.3: Export Transactions — CSV & JSON

As Oleksii,
I want to export my transactions as CSV or JSON, either the current view or everything,
So that I have my data outside the app — the round-trip partner to import (RP-F7 / RP-B6).

**Acceptance Criteria:**

> Evidence: reference `transactions--export` (`41-…`) — server-generated CSV + JSON, scoped + all. Mirrors Epic 5's import CSV/JSON format for a clean round-trip. Endpoint `GET /api/v1/transactions/export` (D7), repository-scoped (FR21), amounts as strings (D1).

**Given** the transactions list,
**When** I choose export,
**Then** I can pick format (CSV or JSON) and scope (current filters/period, or all my transactions).

**Given** an export request,
**When** `GET /api/v1/transactions/export` runs (via the generated client, NFR6),
**Then** it streams/returns a server-generated file scoped to the authenticated user (FR21), with amounts as strings preserving exact values (D1), dates as `"YYYY-MM-DD"`, and CSV columns matching the import shape so an exported CSV/JSON re-imports cleanly (round-trip with 5.1/5.2).

**Given** the "current view" scope,
**When** I export with active filters/period,
**Then** the export honours exactly those filters (type/category, period) — the same criteria the list shows.

**Given** an empty result (no transactions in scope),
**When** I export,
**Then** a well-formed empty file (header-only CSV / empty JSON array) is returned with a localized notice — no error.

**Given** the feature,
**When** tests run,
**Then** integration specs assert CSV and JSON output correctness (values, columns, scoping, filter honouring) and round-trip re-import equivalence; a component test covers the export control; the generated client is regenerated (drift gate green); all strings in both locales (NFR1).

### Story 6.4: Search Transactions

As Oleksii,
I want to search my transactions by note/description text,
So that I can find specific entries across a large history (RP-B9).

**Acceptance Criteria:**

> Evidence/reference: `example/tracker-backend-api` GIN `pg_trgm` index on `transaction.description` + `?search=`. supertool's text field is the note (FR6). P2 — include if the list UX warrants it; keep it within the single-currency, user-scoped model.

**Given** the `transactions` module and a `pg_trgm` GIN index on the note column (migration in this story),
**When** `GET /api/v1/transactions?search=<text>` is called,
**Then** it returns user-scoped transactions whose note matches (trigram/`ILIKE`-class search), composing with the existing type/category filters, period, sort, and offset pagination `{ data, meta }` (D7/FR21).

**Given** the list,
**When** I type in a search box,
**Then** the query travels via a camelCase URL search param (D9 — shareable, back-button-safe) and results update server-side.

**Given** a search with no matches,
**When** viewed,
**Then** the localized empty state distinguishes "nothing matches your search" from "no transactions this period" (both locales).

**Given** the feature,
**When** tests run,
**Then** integration specs cover search matching, composition with other filters, and user-scoping; a component test covers the search box; the generated client is regenerated; all strings in both locales (NFR1).

### Story 6.5: Analytics Response Caching

As the operator-developer,
I want analytics responses cached in-memory with invalidation on mutation,
So that the now-heavier dashboard stays fast without standing up Redis for a local PoC (RP-B3).

**Acceptance Criteria:**

> Evidence/reference: `example/tracker-backend-api` `CacheModule` (Redis, TTLs, cache-tag invalidation). Decision RP-D7: **in-memory over Redis** for a local PoC. Scope is the analytics endpoints (summary/breakdown/trend/top-categories/daily-spending), which recompute SQL aggregations on every call today.

**Given** the analytics endpoints,
**When** the same user requests the same period/scope repeatedly,
**Then** responses are served from an in-memory cache (per-user, per-query-key) with a sane TTL, avoiding redundant SQL aggregation — correctness unchanged (string amounts, exact figures, D1/FR18).

**Given** a transaction mutation (create/edit/delete/import/bulk-delete) for a user,
**When** it commits,
**Then** that user's affected analytics cache entries are invalidated, so the dashboard never serves stale figures after a change.

**Given** the cache layer,
**When** it is added,
**Then** it sits behind the service layer (D7) and is invisible to the contract — no generated-client or DTO change; behaviour is identical to the uncached path apart from latency.

**Given** the feature,
**When** tests run,
**Then** specs assert cache hit/miss behaviour, invalidation on each mutation type, and per-user isolation (no cross-user cache leakage, FR21); existing analytics correctness tests still pass unchanged (NFR1).

## Epic 7: Account & Landing

Complete account self-service and give the platform a credible public face: capture first/last name (at sign-up and editable in settings), let the user change their password and delete their account (with a confirmation dialog), replace the bare placeholder at `/` with a real marketing landing page, and fold in cheap helmet/compression hardening. Auth stays on **better-auth** (RP-D2) — change-password and delete-account use its flows, not a custom stack. Binding throughout: D1/NFR6/D7/FR19-20/NFR1, the evidence-reference convention (adapt from `example/`, never copy — ED1), and protecting supertool's existing strengths (§6: clean auth forms with no duplicate helper text, theme toggle, locale switcher). Mobile-QA check in every story.

> **Evidence base for this epic:** reference captures `…/reference/settings--*`, `landing--*` (public log `40-…`, auth log `41-…`). §5 defects to exceed: landing FAQ accordion non-functional, auth forms duplicate helper text, empty user menu, profile names not collected at signup. Reference code to adapt from: `example/track-my-life` (settings pages, landing page, change-password/delete-account UI) and `example/tracker-backend-api` (helmet/compression middleware) — and better-auth's own change-password/delete-account capabilities.

### Story 7.1: First & Last Name Capture

As Oleksii,
I want my first and last name collected at sign-up and editable in settings,
So that the app addresses me properly instead of leaving names uncollected (RP-F10 — names).

**Acceptance Criteria:**

> Evidence: §5 defect — reference does not collect profile names at signup. supertool today has a single `name`. This story moves to first/last name. Touches the better-auth user/profile schema (migration), the `SignUpForm` widget, and the settings form. Protect the clean-auth-form strength (§6 — no duplicate helper text).

**Given** the user/profile schema,
**When** the migration runs,
**Then** first-name and last-name fields exist (back-filling the existing single `name` safely), surfaced through the users module and the regenerated generated client (drift gate green, NFR6).

**Given** the sign-up form,
**When** a new user registers,
**Then** first and last name are collected (react-hook-form + zod) alongside email + password, without duplicating helper text (placeholder ≠ description — §6), and persisted to the profile.

**Given** the settings page,
**When** I edit my first/last name,
**Then** changes save via the server action returning discriminated `ActionState`, `revalidatePath` refreshes without a full reload, and the shell user menu shows my name (closing the "empty user menu" §5 defect direction).

**Given** the feature,
**When** tests run,
**Then** module specs (incl. user-scoping) and component tests for the sign-up and settings forms merge with this story; all strings in both locales (FR19/FR20); Dev Agent Record carries screenshots vs the reference (NFR1).

### Story 7.2: Change Password

As Oleksii,
I want to change my password from settings,
So that I can rotate my credentials without admin intervention (RP-F10 — change-password).

**Acceptance Criteria:**

> Evidence: reference `settings--*` change-password. Uses **better-auth**'s change-password flow (RP-D2), not a custom stack. Differentiated auth rate limiting already exists (Story 1.5) — applies here.

**Given** a signed-in user on the settings page,
**When** they submit current password + new password (react-hook-form + zod),
**Then** better-auth verifies the current password and updates it; an incorrect current password fails with a localized error resolved by error code (never raw API text).

**Given** a successful change,
**When** it completes,
**Then** the user is informed (localized confirmation) and session behaviour follows better-auth's default (FR2 per-app sessions preserved); the new password works on next sign-in.

**Given** the change-password endpoint,
**When** requests spike,
**Then** the existing differentiated auth rate limiting applies (carried hardening item, Story 1.5).

**Given** the feature,
**When** tests run,
**Then** integration specs assert success, wrong-current-password rejection, and validation; a component test covers the form; all strings in both locales (NFR1).

### Story 7.3: Delete Account

As Oleksii,
I want to delete my account and data after an explicit confirmation,
So that I can remove myself from the platform cleanly (RP-F10 — delete-account).

**Acceptance Criteria:**

> Evidence: reference `settings--*` delete-account with confirm dialog. Uses better-auth (RP-D2). All user data is per-user scoped (FR21) — deletion must cascade the user's transactions and categories.

**Given** a signed-in user on settings,
**When** they choose delete-account,
**Then** a confirmation dialog (the design-system `alert-dialog`/confirm pattern) requires an explicit confirm step — no single-click destructive action.

**Given** confirmation,
**When** delete executes,
**Then** the account is deleted via better-auth and the user's data (transactions, categories, profile) is removed/cascaded so no orphaned per-user data remains (FR21), the session ends, and the user lands on a signed-out/landing state.

**Given** another user's data,
**When** a delete is processed,
**Then** only the authenticated user's data is affected — asserted by an integration test (no cross-user deletion path).

**Given** the feature,
**When** tests run,
**Then** integration specs assert cascade completeness (no orphans), session termination, and user-scoping; a component test covers the confirm dialog; all strings in both locales (NFR1).

### Story 7.4: Marketing Landing Page

As a first-time visitor,
I want a real landing page that explains the product,
So that the platform has a credible public face instead of a bare placeholder (RP-F8 / RP-U6).

**Acceptance Criteria:**

> Evidence: reference `landing--*` (public log `40-…`) — hero, advantages, reviews, FAQ, footer; §5 defects to exceed — sparse, emoji icons, **broken FAQ accordion**. supertool today: bare H1 + 3 links (`42-…`). Use the design-system primitives (incl. the working `accordion` molecule from Story 1.11). Protect theme + locale strengths (§6).

**Given** the route `/`,
**When** a visitor opens it,
**Then** a real landing page renders — hero, advantages/features, (optional) reviews, an FAQ, and a footer — with clear calls-to-action to sign up / sign in, replacing the placeholder.

**Given** the FAQ section,
**When** a visitor expands a question,
**Then** the answer is reachable (using the working `accordion` molecule) — exceeding the reference's broken FAQ (§5).

**Given** theme and locale,
**When** the visitor toggles theme or switches locale on the landing page,
**Then** dark mode and en/uk both render correctly (protecting §6 strengths) and every landing string exists in both locales (FR19/FR20).

**Given** a mobile-browser viewport,
**When** the landing page renders,
**Then** it is fully responsive and usable (NFR8).

**Given** the page,
**When** tests run,
**Then** component tests cover the section rendering and the working FAQ accordion; all strings in both locales; the Dev Agent Record carries light+dark mobile+desktop screenshots vs the reference (Story 1.9 protocol, NFR1).

### Story 7.5: Security Hardening — Helmet & Compression

As the operator-developer,
I want helmet and compression middleware on the API,
So that the platform gets cheap, standard hardening the reference has and supertool lacks (RP-B10).

**Acceptance Criteria:**

> Evidence/reference: `example/tracker-backend-api` uses helmet + compression + cookie-parser; supertool has none (§2). New deps exact-pinned and recorded per the architecture new-dependency rule. Local-PoC scope (NFR3/NFR4) — must not break the same-origin proxy (D5) or auth (cookie forwarding).

**Given** the NestJS API,
**When** it boots,
**Then** helmet sets standard security response headers and compression is applied to responses, with exact-pinned dependencies recorded in the Dev Agent Record.

**Given** the same-origin proxy and auth flows (D5),
**When** the middleware is enabled,
**Then** sign-up/sign-in, the `/api/*` proxy, cookie forwarding, and Swagger UI in dev all keep working — verified in a running stack (no broken CSP/headers regressions).

**Given** the hardening,
**When** the contract is checked,
**Then** there is no generated-client or DTO change (middleware is transparent to the contract).

**Given** the feature,
**When** tests run,
**Then** a spec/integration check asserts the security headers are present and a representative endpoint still responds correctly through the stack (NFR1).
