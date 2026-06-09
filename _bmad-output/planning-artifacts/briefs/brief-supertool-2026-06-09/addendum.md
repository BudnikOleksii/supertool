# Addendum — supertool brief

Depth that belongs downstream (PRD, architecture, solution design) but not in the 2-page brief.

## Example repo inventory (reference material, never committed)

### example/track-my-life (frontend monorepo)

- pnpm workspaces + Turborepo. `apps/money-tracker` (Next.js 16, React 19, TS 5.9, SCSS, next-intl, react-hook-form + zod, Radix via `@track-my-life/ui`), `apps/storybook`.
- Packages: `ui`, `shared` (constants, types, i18n, generated API client), `next-shared` (i18n routing, RSC API client, providers), `lint-config` (oxlint 1.42.0 base/next/library), `stylelint-config`, `typescript-config`.
- Features working: auth pages, multi-step onboarding, dashboard (trends, net worth, currency filter), transactions (filters, create/edit, CSV/JSON import with preview, recurring, by-category), categories CRUD, settings. Budgets UI minimal. 0% tests.
- API integration: `@hey-api/openapi-ts` generating from `http://localhost:3000/swagger-json`; ApiClient with JWT refresh interceptors.
- CI (`.github/workflows/pull-request.yml`): init-env (Node 22.15.0, pnpm 10.10.0) + lint, type-check, stylelint, build, fmt-check, i18n-check. No test job.
- Known gaps (IMPROVEMENTS.md, 112 items): no `.turboignore`, lint not cached in turbo, type-check rebuilds packages, README script-name drift, a11y issues (aria-labels, :focus-visible), perf (currency list virtualization, memoization), TS strictness (unsafe casts, string-typed unions).

### example/tracker-backend-api (NestJS API)

- NestJS + Drizzle + PostgreSQL, Redis 7 caching with domain-event invalidation, Docker multi-stage build, docker-compose (Postgres 15 + Redis).
- Modules: auth (JWT + refresh + GitHub/Google OAuth + email verification + known devices + login logs), users (roles, soft-delete), profile, transactions (CRUD, batch delete, CSV import/export, filters), transaction-categories (hierarchical), default-transaction-categories (onboarding templates), budgets (period, progress, status), recurring-transactions (pause/resume/process), transactions-analytics (summary, breakdown, trends, top categories, daily spending), audit-log, onboarding, health probes. Rate limiting differentiated between auth and general endpoints.
- Tooling to migrate: eslint.config.ts (ts-eslint strict/stylistic, import order, unused-imports, max-params 3, no-console warn/error) + .prettierrc (single quotes, trailing commas, 100 width, 2-space) → oxlint/oxfmt equivalents.
- CI: check-types, lint, format:check. deploy.yml disabled (Railway target sketched).
- Known gaps (IMPROVEMENTS.md, 108 items): no API versioning (P1), budget status race condition, cross-module repository writes, DELETE returns 200 not 204, missing indexes, unbounded analytics cache, 0% tests.

## Deferred-feature detail (future epics)

- **Accounts/wallets**: not present in either example. Money Manager's signature feature: multiple accounts (cash, cards, banks), transfers between them, per-account balances, net worth across accounts. Needs schema design (transfer = paired transactions vs first-class entity).
- **Recurring transactions**: example has full schedule model (frequency, pause/resume, bulk process) — good reference for the later epic.
- **Budgets**: backend model exists in example (category- or user-scoped, MONTHLY/YEARLY/CUSTOM, ACTIVE/EXCEEDED/COMPLETED); frontend was never finished. Known race condition in example (missing FOR UPDATE) — fix in rebuild.
- **Multi-currency**: seed data contains a Currency field; v1 stores it but exchange-rate conversion/aggregation is deferred.
- **Onboarding/default categories**: example clones system category templates per user; v1 seeds categories from the import instead.
- **Tool #2 (planner/notes)**: no requirements yet; platform implications only (shell/navigation/auth shared across tools).

## .coderabbit.yaml merge notes

- Frontend version: path instructions for `apps/money-tracker/**` (Next.js/state/TS), `packages/shared/**`, `packages/ui/**`; excludes `openspec/changes/**`; auto-review on main, drafts off; chat auto-reply.
- Backend version: path instructions for `*.ts` (NestJS best practices), `*.spec.ts`, `.env*`, Dockerfile/docker-compose, manifests, `*.md`; same excludes.
- Merge: one file at monorepo root; keep both exclusion sets; scope backend instructions to the API app path and frontend ones to web app + packages paths; add test-file instructions repo-wide (new test-per-feature bar).

## AI setup merge notes

- Frontend `.claude`: 19 agents, 14 skills (openspec quartet, frontend-design, vercel-react-best-practices, next-best-practices, ui-ux-pro-max, etc.), 6 commands (create-pr, review-pr, fix-issue, …), settings allowlists. MCP: serena, context7.
- Backend `.claude`: 15 agents (nestjs-expert, postgres-pro, api-designer, …), openspec skills, rules/nestjs-apis.md, format-on-write hooks. MCP: context7, postman.
- Merge: dedupe shared agents/skills (openspec, skill-creator, project-context, review-comments appear in both); union of MCP servers; one CLAUDE.md describing the merged monorepo with FE and BE sections; reconcile settings permissions.

## Seed data

- `example/tracker-backend-api/src/database/data/transactions-02.03.25.json`: 1,880 records, flat `{Date, Category, Type, Amount, Currency}`. Import must derive the category set from distinct Category strings, preserve currency codes, and validate money math — priority test target.

## Better-auth notes (architecture input)

- Replaces example's custom JWT/Passport stack. v1: email + password only.
- Open design question: better-auth is Next.js-centric; options include hosting auth in the Next.js app with the NestJS API validating better-auth sessions/tokens, or running better-auth inside NestJS. Decide in architecture before any auth story; the choice affects the OpenAPI client's auth interceptors.
