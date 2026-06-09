---
title: "Product Brief: supertool"
status: final
created: 2026-06-09
updated: 2026-06-09
---

# Product Brief: supertool

## What is supertool

supertool is an umbrella web platform for personal internal tools — "all my tools in one place," built for Oleksii first and useful to others later. It ships as a single pnpm + Turborepo monorepo containing both frontend (Next.js) and backend (NestJS), grown one tool at a time. The first tool is **Money Tracker**, a web analog of RealByte's Money Manager. A planner/notes tool is next; the platform's structure must anticipate tool #2 without building it.

## Why this exists (dual purpose)

1. **The product**: a self-owned, web-first money tracker seeded with 1,880 real personal transactions, replacing dependence on a mobile-first commercial app — and a home for every future personal tool.
2. **The pitch**: this project is the proving ground for the BMad method + Fable 5 (Claude Code). Its development history *is* the deliverable for pitching the Howly team: planning artifacts, clean feature-by-feature commits, and tested code produced by an AI-driven workflow.

Both purposes are first-class. A working tracker with a messy history fails; a beautiful history with a broken tracker fails.

## What success looks like

- **Clean commit history**: every commit maps to a planned story/feature; no "big bang" dumps. The two `example/` repos are reference material only and are **never committed**.
- **Tested by default**: every feature lands with its tests in the same story; CI runs them — a deliberate break from the example repos' 0% coverage.
- **Quality gates green**: oxlint, oxfmt, type-check, stylelint, CodeRabbit review on every PR.
- **Real data day one**: the database seeds from `transactions-02.03.25.json` (1,880 records, flat `{Date, Category, Type, Amount, Currency}` shape), so the dashboard is meaningful immediately.
- **Pitch-ready**: a teammate reviewing the repo + `_bmad-output/` artifacts can trace idea → brief → PRD → architecture → stories → commits.

## Users

- **Primary**: Oleksii — sole user of v1, tracking his own finances. [ASSUMPTION] Single-user posture: sign-up exists (via better-auth) but no sharing, collaboration, or multi-tenant concerns in v1.
- **Secondary (later)**: teammates and others who want a self-hosted personal tool suite.

## v1 scope — Money Tracker, trimmed core

| In v1 | Deliberately deferred (later epics) |
|---|---|
| Transactions: create, edit, delete, list with filters | Recurring transactions |
| Categories: CRUD, mapped from seed data strings | Budgets |
| Dashboard: summary, trends, category breakdown | Accounts/wallets (the Money Manager signature) |
| Seed/import of the 1,880-record JSON | Onboarding flow, CSV import/export UI |
| Auth: better-auth, email + password | OAuth (Google/GitHub), email verification |
| i18n from day one (next-intl, CI key-parity check) | Additional locales beyond the initial set |
| Local run via Docker (Postgres + apps) | Deployment (Vercel/Railway), Redis caching |
| | Tool #2: planner/notes |

Deferring is strategic, not just scope control: each deferred item becomes a future epic, extending the feature-by-feature commit narrative the pitch depends on.

## Foundation carried over from the example repos

The `example/track-my-life` (frontend monorepo) and `example/tracker-backend-api` (NestJS API) repos prove the stack and provide the base setup. What carries over — configuration and structure, not app code:

- **Tooling**: oxlint + oxfmt everywhere (the backend migrates off eslint/prettier), stylelint, commitlint + husky + lint-staged, exact dependency versions.
- **Design system**: the UI package (Radix-based) + Storybook approach.
- **CI**: merged GitHub Actions covering lint, fmt-check, type-check, stylelint, build, i18n parity — extended with a new test job and backend jobs.
- **Review**: one merged `.coderabbit.yaml` with path instructions for both frontend (`apps/`, `packages/`) and backend (`apps/api` or equivalent).
- **AI setup**: merged CLAUDE.md, skills, agents, commands, rules, and MCP config from both repos, deduplicated into one coherent setup for the monorepo.

## Stack (locked)

Next.js 16 / React 19 / TypeScript / SCSS · next-intl · NestJS · Drizzle ORM + PostgreSQL · better-auth · pnpm + Turborepo · Docker (local) · OpenAPI client generation (@hey-api/openapi-ts) from the NestJS Swagger spec.

## Known risks and open questions

- **better-auth × NestJS split**: better-auth is Next.js-centric; the API is NestJS. Where auth lives and how the API validates sessions is the top open question — resolve it in the architecture phase, before any auth story.
- **Seed mapping**: category strings and multi-currency values in the seed file must map to real entities; money math and import mapping are priority test targets.
- **oxlint migration for NestJS**: decorator-heavy code is the likely friction point migrating the backend off eslint; budget a story for it.
- **Scope gravity**: the examples are ~80% complete and tempting to copy. The rebuild discipline (reference, don't paste) is what keeps the commit history honest.

## What happens next

PRD for the supertool platform + Money Tracker v1 (`bmad-prd`), then architecture (`bmad-create-architecture`) — where the better-auth question, monorepo layout, and seed strategy get decided — then epics & stories.
