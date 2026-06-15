---
title: "PRD: supertool — Money Tracker v1"
status: final
created: 2026-06-09
updated: 2026-06-10
---

# PRD: supertool — Money Tracker v1

## Overview

supertool is an umbrella web platform for personal internal tools, delivered as a single pnpm + Turborepo monorepo (Next.js frontend apps + NestJS API). Tools are **separate apps** sharing a common shell, shared packages, and a single user identity. v1 ships the platform foundation and the first tool: **Money Tracker**, a trimmed-core web analog of RealByte's Money Manager, seeded with 1,880 real transactions.

This PRD covers two products at once, deliberately: the tracker itself, and the development process — this project is the proving ground for BMad + Fable 5 (Claude Code), and its artifact trail and commit history are the pitch material for the Howly team. Requirements that exist purely to make the pitch credible (test-per-feature, traceable commits) are first-class here, not process trivia.

Source inputs: product brief and addendum at `_bmad-output/planning-artifacts/briefs/brief-supertool-2026-06-09/`, plus digests of two reference repos in `example/` (never to be committed).

## Goals

1. **Daily-use tracker**: Oleksii records transactions daily and reviews a month at a glance — fast entry, monthly view, stats.
2. **Platform foundation**: a shell, package structure, and single account that let tool #2 (planner/notes) be added later without reworking tool #1.
3. **Pitch-grade process**: every feature lands as a story-mapped commit with tests; a reviewer can trace idea → brief → PRD → architecture → stories → commits.

### Success metrics

- **Product**: Oleksii uses the tracker daily after v1 (≥5 transactions/week sustained); monthly review answers "where did money go" in one screen without exporting anywhere.
- **Process**: 100% of commits on `main` map to a planned story; CI (lint, fmt, type-check, stylelint, build, tests, i18n parity) green on every merge; every feature merged with its tests.
- **Platform**: adding a second app requires no changes to auth, shell, or shared packages beyond registering the new tool. Verified at architecture time by the FR4 acceptance check (passed 2026-06-10), not by building tool #2 in v1.

### Counter-metrics

- Velocity must not hollow out review: CodeRabbit findings are resolved or explicitly dismissed, never ignored.
- Test count is not the metric — tests must assert behavior (money math, import integrity, auth), not exist for coverage optics.

## Users

**Primary — Oleksii (sole operator in v1).** Daily personal finance tracking; mixed-currency real data; expects the example app's UX patterns (which already satisfy him) with no redesign.

**Secondary — teammates/others (post-v1).** Self-hosting the tool suite. No sharing or multi-tenant features in v1; sign-up simply isn't restricted.

### Primary usage flows

**Daily entry.** Oleksii opens Money Tracker (already signed in — session persists), hits "add transaction", enters amount, picks type (expense/income), category, currency, date (defaults to today), saves. Total interaction should feel under ~10 seconds; this flow dominates usage and gets first call on UX and performance budgets.

**Monthly review.** He opens the dashboard, confirms the month (defaults to current) — figures are shown in his profile-default currency, no currency picker — scans income/expense/net summary, looks at the category breakdown to spot outliers, steps back a month to compare. Done in one or two screens, no configuration ceremony.

## Functional requirements

### F1 — Platform shell & identity

- **FR1**: A user can sign up and sign in with email + password (better-auth). No email verification, OAuth, or password recovery in v1 — acceptable for a single known operator.
- **FR2**: All tool apps share a single account store — one email + password works everywhere — but sessions are per-app: a user signs in to each tool app separately, and multiple concurrent sessions per user are supported. (Supersedes the original cross-app shared session — operator override at architecture; see `architecture.md`, decision D5.)
- **FR3**: A shared shell wraps every tool app: tool navigation, user menu (profile, sign out), and locale switcher. v1 renders one tool entry (Money Tracker).
- **FR4**: The shell, auth, and shared packages are structured so a second tool app can be added by registering it — no rework of existing apps. Acceptance (verified at architecture via the "register tool #2" walkthrough): adding `apps/planner` requires only (a) the new app itself, (b) one entry in the shared tool registry — shell navigation renders it automatically, and (c) infrastructure additions (docker-compose service, env example). Zero diffs to the shell, shared UI/widgets, auth, or existing apps; new API modules are additive only.
- **FR5**: A user can view and edit minimal profile settings: name, default currency, locale. The default currency is the single currency the dashboard and lists are scoped to — it is not a selectable filter (see FR9, FR14). (This deliberately supersedes the brief's blanket "settings deferred" — only this minimal subset ships; full settings remain out of scope.)
- **FR21**: Every user has a role — `user` or `admin` — from day one. v1 ships no admin-facing features: everyone signs up as `user`, and promotion is an operational act (seed/DB only). The role model exists so a future admin capability (e.g. default-category management) lands as an additive epic. All data access is scoped to the authenticated user; there are no cross-user access paths in v1. (Added at architecture — operator decision D6.)

### F2 — Transactions

- **FR6**: A user can create a transaction with: type (income/expense), amount, currency, category, date (defaults to today), optional note. Creation is optimized for speed (see NFR5). The seed data has no notes; imported records get an empty note.
- **FR7**: A user can edit and delete any of their transactions.
- **FR8**: A user can view transactions for a date range, defaulting to the current month, with previous/next month navigation.
- **FR9**: The transaction list can be filtered by type and category, and sorted by date or amount. (Currency is not a filter dimension — every transaction is in the user's single default currency; superseded 2026-06-15, see decision log.)

### F3 — Categories

- **FR10**: A user can create, rename, and delete categories, organized in a parent/child hierarchy (as in the example app).
- **FR11**: The category set is initially populated from the seed data as a two-level hierarchy — each distinct `Category` becomes a top-level category and each distinct `Subcategory` becomes a child under its parent (the seed carries a `Subcategory` on ~57% of records); the user can restructure them afterwards. (Corrected 2026-06-15: the seed is two-level, not flat top-level-only — see decision log.)
- **FR12**: Deleting a category that has transactions or child categories requires reassigning them (transactions to another category, children to another parent or top level) — no orphaned or silently uncategorized data.

### F4 — Dashboard & stats

- **FR13**: The dashboard shows, for a selected period (default: current month): total income, total expense, and net — all in the user's profile-default currency (FR5). No currency picker.
- **FR14**: All dashboard figures are scoped to the user's profile-default currency (FR5); there is no currency picker and no cross-currency aggregation in v1. Aggregations remain per-currency in SQL for correctness, but currency is not user-selectable. (Currency simplified to a single profile default, 2026-06-15 — supersedes the original data-derived currency filter with most-frequent fallback; see decision log.)
- **FR15**: The dashboard shows an expense breakdown by category for the selected period (in the profile-default currency), grouped by top-level category where a hierarchy exists.
- **FR16**: The dashboard shows a month-over-month trend (income/expense) across a trailing 12-month window.

### F5 — Data seeding & integrity

- **FR17**: A repeatable, idempotent seed imports `transactions-02.03.25.json` (1,880 records, `{Date, Category, Type, Amount, Currency, Subcategory?}`): derives the two-level category set (Category → top-level, Subcategory → child), preserves every amount, currency, and date exactly, and attaches all records to the operator's account. Re-running does not duplicate.
- **FR18**: All money values are stored and computed with decimal-safe arithmetic — no floating-point drift, asserted by tests on stats math and import totals.

### F6 — Internationalization

- **FR19**: All user-facing strings are localized; v1 ships English and Ukrainian, switchable from the shell, with the choice persisted per user.
- **FR20**: CI enforces locale key parity — a missing translation key fails the pipeline.

## Non-functional requirements

- **NFR1 — Tests per feature**: every feature merges with its tests in the same story; CI runs them as a required check. Priority test targets: money math, seed/import integrity, auth/sessions and per-user data scoping.
- **NFR2 — Quality gates**: oxlint, oxfmt, type-check, stylelint, commitlint (conventional commits), and CodeRabbit review on every PR. Backend uses oxlint/oxfmt — no eslint/prettier anywhere in the monorepo.
- **NFR3 — Local-first runtime**: the entire platform runs locally via Docker (PostgreSQL + apps) with a documented single-command startup. No deployment in v1.
- **NFR4 — Privacy posture**: the repository is private; the real seed file is committed. Nothing in v1 may expose the data beyond the local environment (no analytics, no external telemetry).
- **NFR5 — Entry speed**: the daily-entry flow (FR6) is the performance budget anchor — transaction form reachable in one interaction from the tracker's main view, submit-to-visible-in-list without full page reload.
- **NFR6 — API contract**: the frontend consumes the API exclusively through a client generated from the NestJS OpenAPI spec; hand-written fetch calls to API routes are a defect.
- **NFR7 — Design system**: UI is built from the carried-over design-system approach (shared UI package + Storybook); tracker screens follow the example app's UX patterns, which the operator has approved as-is.
- **NFR8 — Mobile-usable**: the product replaces a mobile-first app and entry happens daily, wherever the spend happens — the daily-entry flow and transaction list must be fully usable in a mobile browser (responsive layout). No native app or PWA in v1.

## Engineering & delivery requirements

These are product requirements here, because the development process is half the product (the pitch):

- **ED1**: The `example/` repos are reference material only — their code is never committed. Features are rebuilt, not pasted.
- **ED2**: Every commit on `main` traces to a planned story; planning artifacts (`_bmad-output/`) are committed so the trail is reviewable in-repo.
- **ED3**: The base setup is carried over and merged from the example repos as configuration — deduplicated, exact dependency versions:
  - oxlint/oxfmt configs, stylelint
  - commitlint/husky/lint-staged
  - merged CI workflows (frontend + backend jobs + new test job)
  - one merged `.coderabbit.yaml` covering frontend and backend paths
  - a merged AI setup (CLAUDE.md, skills, agents, commands, rules, hooks, MCP)
- **ED4 — Stack (locked, from the brief)**: Next.js 16 / React 19 / TypeScript / SCSS · next-intl · NestJS · Drizzle ORM + PostgreSQL · better-auth · pnpm + Turborepo · Docker (local) · OpenAPI client generation (@hey-api/openapi-ts) from the NestJS Swagger spec. Architecture decides *how*, not *whether*.

## Out of scope for v1 (future epics)

Recurring transactions · Budgets · Accounts/wallets and transfers · Onboarding flow · CSV import/export UI · OAuth (Google/GitHub), email verification, password recovery · Full settings (password change, account deletion) · Cross-app shared session / single sign-on across tools (superseded by FR2's per-app sessions) · Admin features (role infrastructure ships in FR21; admin panel is a future epic) · Multi-currency exchange rates and cross-currency aggregation · Redis caching · Deployment (Vercel/Railway) · Additional locales · Sharing/multi-tenant features · Native/PWA mobile · Tool #2 (planner/notes).

Each deferred item is a candidate future epic, intentionally extending the feature-by-feature commit narrative.

## Risks & open questions

- **better-auth × NestJS boundary** (resolved at architecture, 2026-06-10): auth is mounted in the NestJS API via better-auth's Nest integration; each tool app proxies its API calls same-origin, which yields FR2's per-app sessions by construction. Details in `architecture.md` (decision D5).
- **oxlint on NestJS** (risk): decorator-heavy backend code is the likely migration friction; budget a story.
- **Seed category fidelity** (risk): category strings in the seed may contain duplicates/variants needing normalization rules — surface them at import, don't silently merge.
- **Scope gravity** (risk): the examples are ~80% complete and tempting to copy; ED1 is the guardrail.

### Assumptions status

All draft assumptions were reviewed with the operator on 2026-06-09 and confirmed (no password recovery, unrestricted sign-up, minimal profile settings, note field, delete-requires-reassignment, 12-month trend, design-verified platform readiness); their tags have been resolved into plain requirements above. The two that remained open — **FR15** (breakdown grouped by top-level category) and **NFR8** (mobile-browser usability) — were confirmed by the operator on 2026-06-10 during the architecture-sync update. No open assumptions remain. Full audit trail in `.decision-log.md`.

## Next steps

Architecture is complete (`architecture.md`, finalized 2026-06-10; this PRD synced to it the same day). Next: `bmad-create-epics-and-stories` → `bmad-check-implementation-readiness` → sprint planning. A UX phase (`bmad-ux`) is likely skippable: UI mirrors the approved example patterns (NFR7).
