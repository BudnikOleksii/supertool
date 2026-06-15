---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-06-10'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
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
- FR11: The category set is initially populated from distinct category strings in the seed data as top-level categories; the user can restructure them afterwards.
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

**Dependencies:** strictly forward — Epic 2 builds on Epic 1 (auth, shell, pipeline); Epic 3 builds on Epic 2 (transaction/category data). Each epic delivers standalone user value.

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
