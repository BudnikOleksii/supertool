---
baseline_commit: dbcd0a578c1f0750891c620dc872f72190413bb1
---

# Story 3.1: Monthly Money Summary

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want the dashboard to show total income, expense, and net for a month,
so that one glance tells me where the month stands (FR13, FR14).

This is the **first story of Epic 3 (Dashboard & Stats)**. It stands up the new `analytics` API module (the foundation that 3.2 breakdown and 3.3 trend build on) and turns the placeholder root page into the real dashboard, scoped to the user's profile-default currency.

## Acceptance Criteria

> **Currency model (settled 2026-06-15, Epic 2 retro):** figures are ALWAYS in the user's profile-default currency (FR5). There is **no currency picker**, **no most-frequent fallback**, **no cross-currency aggregation**. The summary is computed per-currency in SQL (scoped to the one default currency) so multi-currency data never cross-aggregates, but currency is not a user-facing selection. [Source: epics.md#Story-3.1; prds/.../prd.md#FR5,FR13,FR14; addendum.md#Currency-handling]

1. **(AC1) Analytics summary endpoint — SQL aggregation, string amounts (D1).** A new `analytics` module exposes `GET /api/v1/analytics/summary` taking a month date range (`dateFrom`, `dateTo` as `YYYY-MM-DD`). It returns `{ income, expense, net, currency }` where `income`/`expense`/`net` are **string** amounts computed entirely as Postgres `numeric` SQL aggregation (cast `::text`) — never `number`, never JS float math. The response is user-scoped (`session.user.id`) and scoped to the authenticated user's profile-default currency (no cross-currency aggregation). Consumed via the regenerated client (`AnalyticsApiService`), never hand-written fetch.

2. **(AC2) Dashboard loads, defaults to current month, profile-default currency.** Opening the dashboard (the `/dashboard` route; `/` stays the landing page) defaults the period to the current month and shows income/expense/net in the profile-default currency (FR5/FR14). **Net is rendered signed and color-coded** (positive/surplus and negative/deficit visually distinguished via design tokens). If the default currency has no transactions in the period, figures render as zero with a localized empty state — **no currency picker, no most-frequent fallback**. If the user has no default currency set, the figures render as zero/empty (defensive; onboarding sets it per FR5).

3. **(AC3) Month stepper navigates periods.** A month stepper lets the user step to a previous/next month; summary figures update for comparison (the monthly-review flow). The period lives in the URL search param (`period=YYYY-MM`), reusing the exact mechanism Story 2.2 established for the transactions list. Navigating months on the dashboard must NOT regress the transactions list month navigation.

4. **(AC4) Decimal-safe integration tests against seeded data.** Testcontainers integration tests assert summary figures match independently computed expected totals **exactly** — no floating-point drift (FR18, NFR1 priority). Covers: a normal month, the empty-month boundary (zeros), and that `net = income − expense` exactly. Reuses the shared test helpers in `apps/api/test/helpers/`.

5. **(AC5) Loading + responsive + both locales.** Skeletons show during load; the dashboard is usable on mobile (NFR8); all strings localized in **both** `en` and `uk` (FR19/FR20 — same commit, CI key-parity gate).

6. **(AC6) Visual QA evidence recorded (lesson from 1.4/1.8).** Screenshots of the rendered dashboard in **both themes** (light + dark), at desktop and mobile widths, plus the empty-month state, compared against the reference dashboard summary. Evidence recorded in the Dev Agent Record. Green gates + green axe are NOT sufficient — an actual look at the rendered output is mandatory.

## Tasks / Subtasks

- [x] **Task 1 — API: `analytics` module skeleton** (AC: 1)
  - [x] Create `apps/api/src/modules/analytics/` with `analytics.module.ts`, `analytics.controller.ts`, `analytics.service.ts`, `analytics.repository.ts`, and `dtos/`. Mirror the structure of `apps/api/src/modules/transactions/` exactly (controller → service → repository; D7 layering — no layer skipping).
  - [x] Register `AnalyticsModule` in `apps/api/src/app/app.module.ts` imports (after `TransactionsModule`). No `imports` needed in the module itself — `DatabaseModule` is `@Global()` and provides `DRIZZLE`.
  - [x] DI: explicit `@Inject(ClassName)` on every constructor param. `@Inject(DRIZZLE) private readonly db: Database` in the repository. NEVER `import type` an injectable (SWC erases it → DI breaks in Vitest/Testcontainers). [Source: rules/nestjs-apis.md#Dependency-Injection; CLAUDE.md]
- [x] **Task 2 — API: query + response DTOs** (AC: 1)
  - [x] `dtos/find-summary-query.dto.ts`: `dateFrom`/`dateTo` as `YYYY-MM-DD`, validated with `@Matches(CALENDAR_DATE_PATTERN)` + `@IsOptional()`/required as appropriate. Mirror `find-transactions-query.dto.ts` date validation. Add the runtime-import oxlint-disable line on the DTO import in the controller (same as transactions controller line 36) — `@Query` paramtype metadata needs the value import.
  - [x] `dtos/monthly-summary-response.dto.ts`: `{ income: string; expense: string; net: string; currency: string }`. Every amount `@ApiProperty({ type: 'string', example: '1234.56' })`. This is a single object (NOT a `{ data, meta }` list envelope — that envelope is for paginated lists only).
  - [x] Maintain single export per file; no barrel files.
- [x] **Task 3 — API: repository SQL aggregation (decimal-safe)** (AC: 1, 4)
  - [x] Resolve the authenticated user's `defaultCurrency` server-side via `UsersRepository.findByIdScoped(userId)` (returns `defaultCurrency: string | null`). Inject `UsersRepository` into `AnalyticsService` (or expose a thin method) — do NOT duplicate the users query.
  - [x] Repository computes income/expense/net in ONE SQL aggregation returning strings. Pattern (Drizzle `sql\`\`` template, parameterized — see the recursive-CTE precedent at `transactions.repository.ts:175-189`):
    ```sql
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::text  AS income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::text AS expense,
      (COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0))::text AS net
    FROM transactions
    WHERE user_id = ${userId} AND currency = ${currency}
      AND date >= ${dateFrom} AND date <= ${dateTo}
    ```
    `net` is computed in Postgres `numeric` arithmetic then cast `::text` — never subtracted in JS (D1). `COALESCE(..., 0)` makes the empty month return `"0"`.
  - [x] If `defaultCurrency` is null → return `{ income: '0', expense: '0', net: '0', currency: '' }` (or echo null per DTO) without querying; the frontend renders the empty state.
- [x] **Task 4 — API: controller + service wiring** (AC: 1)
  - [x] `@ApiTags('analytics')`, `@Controller('analytics')`, `@Get('summary')`, `@UseGuards(AuthGuard)`, `@Session() session`, `@Query() query: FindSummaryQueryDto`. Pass `session.user.id` to the service. Add `@ApiOkResponse({ type: MonthlySummaryResponseDto })`, `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse` (mirror transactions controller).
  - [x] Set the `enumName` rule only if any new enum/union field is introduced (none expected here — `currency` is a plain string echo). Do NOT inline new unnamed unions.
- [x] **Task 5 — Regenerate the OpenAPI client** (AC: 1)
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`), then `pnpm --filter @supertool/shared generate:client`. Confirm `AnalyticsApiService` (or the by-tags service name the generator emits for the `analytics` tag) and `MonthlySummaryResponseDto` appear in `packages/shared/src/generated/`. Commit the regenerated client. [Source: rules/nestjs-apis.md#DTOs-and-the-generated-OpenAPI-client]
- [x] **Task 6 — Frontend: extract shared period utils + month stepper** (AC: 2, 3)
  - [x] Promote the month-period utilities to an app-shared location so BOTH transactions and dashboard import them: move `apps/money-tracker/src/app/[locale]/transactions/utils/period.ts` and `format-period-label.ts` to `apps/money-tracker/src/utils/` (or a shared `period/` dir). Update the transactions page/components imports accordingly.
  - [x] Reuse the existing `MonthStepper` for the dashboard. It currently deletes the `page` search param on navigate (transactions-specific, harmless on the dashboard) — either keep as-is or parameterize the params-to-reset. **Regression guard:** after the move, the transactions list month navigation must still work exactly as before (run it). [Source: 2-2 month-stepper; `transactions/components/month-stepper/MonthStepper.tsx`]
- [x] **Task 7 — Frontend: fetch action** (AC: 1, 2)
  - [x] Create `apps/money-tracker/src/actions/fetch-monthly-summary.ts` — plain async wrapped in `cache()` (NOT `'use server'`; reads are importable by RSCs). Forward cookies via `createServerApiClient({ cookieHeader })`, call `AnalyticsApiService.<summary method>`, return a discriminated `{ status: 'success'; summary } | { status: 'error' }`. Mirror `fetch-transactions.ts` exactly. NEVER hand-write fetch (NFR6 defect).
- [x] **Task 8 — Frontend: dashboard page + summary widget** (AC: 2, 3, 5)
  - [x] Create the dashboard at `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` (a NEW route; leave the root `page.tsx` landing as-is). RSC reads `searchParams.period` (default `getCurrentPeriod()`), computes `getMonthDateRange(parsePeriod(period))`, renders `MonthStepper` + a `<Suspense>` (keyed on period) wrapping the summary server component with a skeleton fallback.
  - [x] `dashboard/components/dashboard-summary/DashboardSummary.tsx` (async RSC): calls `fetchMonthlySummary`, renders income/expense/net using `@supertool/ui` `Card`/`CardHeader`/`CardContent` + `Typography`. PascalCase file + co-located `DashboardSummary.module.scss`. Format amounts via the money formatter (reuse `format-transaction-amount.ts`; extract to shared util if cross-feature). Use the `currency` returned by the summary for formatting.
  - [x] **Net is signed + color-coded:** render the sign and apply a positive/negative color via SCSS using M3 design tokens (no hardcoded hex — read the token, e.g. an error/success or tertiary token consistent with the reference). Income/expense labels styled per the reference summary widget. [Source: AC2; reference `summary-widget/SummaryWidget.tsx`]
  - [x] Empty/zero state: when all figures are zero (or currency empty), render a localized empty state via the dashboard namespace.
  - [x] Skeleton component `DashboardSummarySkeleton` using `@supertool/ui` `Skeleton` (mirror `TransactionListSkeleton`).
- [x] **Task 9 — Frontend: i18n (both locales, same commit)** (AC: 5)
  - [x] Add `dashboardPage: 'dashboardPage'` to `packages/shared/src/constants/i18n-namespace.ts`; add the file mapping (`[I18N_NAMESPACE.dashboardPage]: 'dashboard-page'`) in `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts`.
  - [x] Create `apps/money-tracker/messages/en/dashboard-page.json` AND `apps/money-tracker/messages/uk/dashboard-page.json` with identical key sets (title, income/expense/net labels, monthNav.previous/next, empty.title/description). Use `translate` (next-intl), NOT `t`; ICU interpolation only, no string concatenation. CI key-parity gate fails if keys diverge (FR20).
- [x] **Task 10 — Nav/route wiring** (AC: 2)
  - [x] Add `dashboard: '/dashboard'` to `apps/money-tracker/src/constants/routes.ts`. Add a nav entry/link to the dashboard (shell nav and/or the landing `/` page links). Keep the existing landing `page.tsx` content; optionally add a "View dashboard" link to it.
- [x] **Task 11 — API integration + unit tests** (AC: 4)
  - [x] `apps/api/test/integration/analytics.integration.spec.ts` (Testcontainers): seed a known set of income/expense transactions in the default currency, assert summary `income`/`expense`/`net` match independently computed expected strings exactly; assert the empty-month boundary returns `"0"`/`"0"`/`"0"`; assert cross-currency data is excluded (insert a transaction in a different currency, confirm it does NOT affect totals). Reuse `startPostgresContainer`, `runMigrations`, `Pool`/`drizzle`, and the decimal-safety assertion approach from `apps/api/test/helpers/`. [Source: tech-debt-integration-test-helper-dedup.md — helpers are consolidated; do not re-define locally]
  - [x] Service unit spec (Vitest, SWC) with a repository test double; controller spec asserting `session.user.id` scoping.
- [x] **Task 12 — Frontend tests** (AC: 2, 5)
  - [x] Co-located `*.test.tsx` for `DashboardSummary` (renders figures, zero/empty state) and the period default. Mirror existing transactions component tests.
- [x] **Task 13 — Visual QA** (AC: 6)
  - [x] Run the dev stack, sign in (creds from `.env.example`), capture dashboard screenshots in light AND dark themes, desktop AND mobile widths, plus the empty-month state. Compare against `example/track-my-life` dashboard summary. Record evidence (paths/observations) in Dev Agent Record. [Source: memory — UI stories need visual QA; visual-qa-via-playwright-cli]
- [x] **Task 14 — Gates** (AC: all)
  - [x] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm stylelint`, `pnpm fmt:check` all green. Run with `--force` where turbo may replay stale cache. [Source: memory — turbo-cache-masks-gate-results]

### Review Findings

_Code review 2026-06-15 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Gates all green. No correctness bugs; all 6 ACs and hard rules D1/NFR6/D7/i18n confirmed satisfied. 4 decisions raised (2 → patches below, 2 dismissed: empty-state message conflation accepted under the single-default-currency model; seed NULL-only backfill accepted as correct idempotency). 5 patches applied; gates re-run green (API 160 tests, money-tracker 124)._

- [x] [Review][Patch] Single-source the `NO_CURRENCY` sentinel — added `NO_CURRENCY` to `@supertool/shared/constants/currency`; `analytics.service.ts` and `DashboardSummary.tsx` now both import it (no more duplicated empty-string declarations). [analytics.service.ts; DashboardSummary.tsx]
- [x] [Review][Patch] Captured the missing AC6 visual evidence — added `dashboard-dark-mobile` (dark theme, mobile width, single-column, signed/red net) and `dashboard-uk-dark` (UK locale, dark theme; `−42,50 ₴` deficit-colored). AC6 now covers both themes × both widths × both locales. [/tmp/vqa/dashboard-dark-mobile.png; /tmp/vqa/dashboard-uk-dark.png]
- [x] [Review][Patch] Added coverage for the signed/color-coded net rendering — `DashboardSummary.test.tsx` now asserts a negative net carries the deficit (expense) class and a positive net the surplus (income) class. [DashboardSummary.test.tsx]
- [x] [Review][Patch] Added a cross-user authz integration test — `analytics.integration.spec.ts` now inserts a second user with a same-currency transaction in the same month and asserts the operator's summary is unaffected while the other user sees only their own. [analytics.integration.spec.ts]
- [x] [Review][Patch] Extracted the shared `normalizeSearchParam` util — `apps/money-tracker/src/utils/normalize-search-param.ts`; the dashboard page and the transactions parser both use it (duplicated `value[0]` logic + `FIRST_ELEMENT_INDEX` removed). [utils/normalize-search-param.ts]
- [x] [Review][Defer] Analytics date DTO is shape-only and has no `dateFrom <= dateTo` guard [find-summary-query.dto.ts:9-15] — deferred, pre-existing repo-wide convention (identical to `transactions/dtos/find-transactions-query.dto.ts`)
- [x] [Review][Defer] Period param has no far-future/far-past bound; the stepper walks arbitrarily [dashboard/page.tsx] — deferred, pre-existing (consistent with the transactions list month nav)

## Dev Notes

### Decision: dashboard lives at `/dashboard`; `/` stays the landing (confirmed 2026-06-15)

The dashboard is a NEW `/dashboard` route. The existing root `apps/money-tracker/src/app/[locale]/page.tsx` landing page **stays** (operator decision) — do not replace it; add a link to the dashboard from it / the nav. This mirrors the reference repo, which nests the dashboard at `/dashboard`.

**Architecture reconciliation needed (doc-only follow-up):** `architecture.md:346` currently reads `page → dashboard, transactions/, …`. That wording implies the root page is the dashboard, which is now superseded. Reconcile it to e.g. `page → landing, dashboard/, transactions/, …`. Non-blocking for dev; flag in the next architecture touch or do a one-line edit.

### Currency model — do NOT reintroduce a picker

Currency was simplified to a single per-user default on 2026-06-15 (Epic 2 retro). FR13/FR14 were reworded; the `currency-filter` component was removed from the architecture component tree. There is **no** currency selector and **no** most-frequent fallback anywhere in this story. Per-currency SQL aggregation is retained ONLY for correctness (scope the WHERE clause to the one default currency so multi-currency rows never cross-aggregate). [Source: prds/.../addendum.md#Currency-handling; .decision-log.md 2026-06-15; epics.md Epic 3 overview]

### D1 — money is strings end-to-end (merge-blocking)

Postgres `numeric(14,2)`; string amounts in every DTO and in JS; SQL does all the arithmetic (income, expense, AND net) cast `::text`. An amount typed as `number` or any float math on money is a defect. The empty month must return `"0"` via `COALESCE`, not `null`/`NaN`. [Source: CLAUDE.md hard rule 1; architecture.md#D1]

### Architecture compliance (guardrails)

- **Layering (D7):** controller → service → repository. Repositories are the ONLY DB-touching layer. Do not query Drizzle from the service or controller.
- **Generated client only (NFR6):** frontend reads the summary exclusively through `AnalyticsApiService` from `packages/shared/src/generated/`. A hand-written `fetch('/api/...')` is a defect.
- **Read path:** RSC → `fetch-*` action → generated client (cookie forwarded via `next-shared` factory) → proxy rewrite → API → SQL aggregation → camelCase JSON (string amounts) → RSC render. [architecture.md:392]
- **API conventions:** `/api/v1/...`, camelCase JSON, errors `{ statusCode, code, message, details? }`, auth via `@UseGuards(AuthGuard)` + `@Session()`.
- **Dates:** transaction `date` is a `date` column / `YYYY-MM-DD` string — no timezone math. Month range is built client-side by `getMonthDateRange` and passed as two `YYYY-MM-DD` strings.

### Source tree — files to touch

**API (NEW):**
- `apps/api/src/modules/analytics/analytics.module.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/analytics/analytics.repository.ts`
- `apps/api/src/modules/analytics/dtos/find-summary-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/monthly-summary-response.dto.ts`
- `apps/api/test/integration/analytics.integration.spec.ts`
- `apps/api/src/modules/analytics/analytics.{controller,service}.spec.ts`

**API (UPDATE):**
- `apps/api/src/app/app.module.ts` — register `AnalyticsModule`. *Current state:* imports Env/Logger/Auth/Database(@Global)/Health/Users/TransactionCategories/Transactions; add Analytics after Transactions. *Preserve* the existing `APP_FILTER` provider and `AuthDatabaseLifecycle`.
- `packages/shared/src/generated/**` — regenerated (not hand-edited).

**Frontend (UPDATE):**
- `apps/money-tracker/src/constants/routes.ts` — add `dashboard: '/dashboard'`.
- `apps/money-tracker/src/app/[locale]/page.tsx` — landing **stays**; add a dashboard link. *Preserve* existing copy + locale handling.
- nav (shell/app nav) — add a dashboard entry.
- `apps/money-tracker/src/app/[locale]/transactions/**` — only the period-util import paths if Task 6 moves them; behavior must be unchanged.
- `packages/shared/src/constants/i18n-namespace.ts` — add `dashboardPage`.
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — add mapping.

**Frontend (NEW):**
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx`
- `apps/money-tracker/src/actions/fetch-monthly-summary.ts`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary/DashboardSummary.tsx` (+ `.module.scss`, `.test.tsx`)
- dashboard summary skeleton component
- `apps/money-tracker/messages/{en,uk}/dashboard-page.json`

### Reference patterns (study before implementing — `example/track-my-life`, reference-only ED1)

- Dashboard page (RSC, Suspense per widget): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/dashboard/page.tsx`
- Summary widget (income/expense/net): `…/dashboard/components/summary-widget/SummaryWidget.tsx`
- Widget card wrapper + empty handling: `…/dashboard/components/widget-card/WidgetCard.tsx`
- Fetch summary action: `…/dashboard/actions/fetch-summary.ts`
- Loading skeleton: `…/dashboard/loading.tsx`
- Reference API analytics service (client shape): `example/track-my-life/packages/shared/src/api/services/transactions-analytics-api.service.ts`
- **Adapt, never copy.** Differences to apply: month-stepper period (`YYYY-MM`) instead of the reference's open date-range filter bar; NO currency filter (single profile-default); `@supertool` scope, PascalCase filenames, `translate` not `t`, M3 design tokens.

### Local patterns to reuse (do NOT reinvent)

- Period utils + month stepper: `apps/money-tracker/src/app/[locale]/transactions/utils/period.ts` (`parsePeriod`, `getCurrentPeriod`, `getMonthDateRange`, `getPreviousPeriod`, `getNextPeriod`), `format-period-label.ts`, `components/month-stepper/MonthStepper.tsx`. Search param: `period=YYYY-MM`.
- Fetch action shape: `apps/money-tracker/src/actions/fetch-transactions.ts` (cache + `createServerApiClient` + generated service).
- Money formatting: `apps/money-tracker/src/app/[locale]/transactions/utils/format-transaction-amount.ts` (cached `Intl.NumberFormat`, parses string → number ONLY for display).
- Skeleton + empty state: `…/transactions/components/transaction-list-skeleton/` and `transaction-empty-state/`.
- API: `apps/api/src/modules/transactions/` (controller/service/repository/dto), `transactions.repository.ts:82-189` (scoped conditions + `sql\`\`` aggregation precedent), `database.constants.ts` (`DRIZZLE` token), `schemas/transactions.ts` (columns), `schemas/enums.ts` (`transactionTypeEnum`), `users.repository.ts` (`findByIdScoped` → `defaultCurrency`).
- Test helpers: `apps/api/test/helpers/{postgres-container,integration-app,decimal-safe-sums}.ts`.

### Coding conventions (merge-blocking subset)

- No comments — self-documenting names. Follow-up work goes in story/epic files, never code TODOs.
- Arrow functions; `get`/`fetch`/`check`/`format`/`parse` prefixes; array vars carry `list` suffix; `UPPER_SNAKE_CASE` constants.
- TS: prefer interfaces; NO enums (use `as const` + `ObjectValuesUnion`); no `as` assertions in prod code (narrow with `checkIs*`); single source of truth for value sets.
- One export per file; named exports; no barrel files.
- Files/dirs kebab-case; component files + co-located `.module.scss`/`.test.tsx` PascalCase after the component.
- Tests ship in the SAME story as the feature (NFR1).
- Exact dependency versions (no `^`/`~`); never introduce eslint/prettier (oxlint + oxfmt only). No new dependency expected for the summary (charts come in 3.3).

### Testing standards

- API: Vitest (SWC decorators) for unit specs; Testcontainers against real Postgres for integration. Given-When-Then for module acceptance; Arrange-Act-Assert for units; `inputX`/`mockX`/`actualX`/`expectedX` naming.
- Money assertions compare exact strings; expected totals computed independently (decimal-safe) — assert no float drift (FR18).
- Frontend: co-located `*.test.tsx`; both-locale coverage where strings render.

### Previous-work intelligence

- **Story 2.2 (Browse by month)** established the `period=YYYY-MM` URL param, `MonthStepper`, and `getMonthDateRange` — this story reuses them verbatim and extends them to the dashboard. Do not invent a parallel period mechanism.
- **Stories 2.3–2.5** built the transactions CRUD + filter/sort endpoints and the generated-client round-trip — the analytics endpoint follows the identical controller/service/repository + DTO + `enumName` discipline.
- **Epic 2 retro (2026-06-15)** simplified currency to a single profile default and explicitly flagged "Epic 3 dashboard currency handling" as the thing to get right here. The summary scopes to `users.defaultCurrency`; there is no picker.
- **Tech-debt (done):** integration test helpers were consolidated into `apps/api/test/helpers/` — import them, don't redefine container/migration/boot logic locally.
- **1.4 / 1.8 lesson:** both shipped broken UI with green gates because nobody looked at the rendered output. AC6 visual QA in both themes is mandatory, not optional.

### Git intelligence (recent commits)

`dbcd0a5` epic-2 retro + currency reconciliation · `82fdadb` 2-5 filter/sort (type/category subtree, pagination) · `3198cc0` 2-4 edit/delete (PATCH/GET/DELETE :id) · `dff76ab` 2-3 fast entry (create endpoint) · `e366177` docker api build fix (`emit-openapi` needs `SEED_OPERATOR_PASSWORD` placeholder). Pattern: each story adds endpoints to an existing module + a Next route + co-located tests, then regenerates the client. Note the docker build placeholder gotcha if you touch env/build.

### Project Structure Notes

- Aligns with `architecture.md` component tree: `modules/analytics` (summary/breakdown/trend) and dashboard at root page. No `currency-filter` (removed 2026-06-15).
- Dependency direction respected: `shared` (i18n namespace const) → `ui` (Card/Typography/Skeleton) → app. The dashboard is app-level; no new `@supertool/ui` primitive expected.
- Variance: dashboard at `/dashboard` with `/` kept as landing (operator decision 2026-06-15) — matches the reference repo and supersedes `architecture.md:346`'s `page → dashboard` wording (doc reconciliation noted above).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1-Monthly-Money-Summary]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3-Dashboard-and-Stats]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#FR5,FR13,FR14,FR18,FR19,FR20]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md#Currency-handling-superseded-2026-06-15]
- [Source: _bmad-output/planning-artifacts/architecture.md#D1-Money] · [#component-tree (lines 330-350)] · [#read-path (line 392)] · [#analytics-module (line 336)]
- [Source: CLAUDE.md#Hard-rules] · [.claude/rules/nestjs-apis.md] · [.claude/rules/typescript.md] · [.claude/rules/javascript.md]
- [Source: apps/api/src/modules/transactions/* — controller/service/repository/dto template]
- [Source: apps/api/src/modules/users/users.repository.ts#findByIdScoped — defaultCurrency]
- [Source: apps/money-tracker/src/app/[locale]/transactions/ — page, period utils, MonthStepper, skeleton, empty-state]
- [Source: example/track-my-life/.../dashboard/ — reference summary widget + fetch-summary]
- [Source: _bmad-output/implementation-artifacts/tech-debt-integration-test-helper-dedup.md]
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-06-15.md — currency handling flag]

## Resolved Decisions (Oleksii, 2026-06-15)

1. **Dashboard route:** dashboard at `/dashboard`; `/` stays the landing page. (Supersedes `architecture.md:346` — doc reconciliation noted in Dev Notes.)
2. **Net display:** signed and color-coded (positive/negative visually distinguished via M3 design tokens).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8

### Debug Log References

- `pnpm --filter @supertool/api build` → emits `apps/api/openapi.json`; `pnpm --filter @supertool/shared generate:client` → `AnalyticsApiService.analyticsGetMonthlySummary` + `MonthlySummaryResponseDto` generated.
- Gates (all green): `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm i18n:parity`.
- Tests: `@supertool/money-tracker` 122 passed (29 files); `@supertool/api` 159 passed (30 files, incl. analytics integration via Testcontainers + full regression).

### Completion Notes List

- **D1 money-as-strings:** income/expense/net all computed in one Postgres `numeric` SQL aggregation with `FILTER (WHERE type = …)`, cast `::numeric(14,2)::text` for deterministic 2-dp strings (`'0.00'`, `'179.50'`). No JS float math. Net = income − expense in SQL.
- **Currency scoping:** `AnalyticsService` resolves the authed user's `defaultCurrency` via `UsersRepository.findByIdScoped`; scopes the WHERE clause to that one currency (no cross-currency aggregation). Null default currency → zeros + empty currency, no query.
- **Seed end-to-end fix (not in original task list, required for "dashboard meaningful day one"):** the seeded operator had `defaultCurrency = null`, so the dashboard would have shown zeros despite 1,880 UAH transactions. `seed-operator.ts` now sets/backfills the operator's `defaultCurrency` to `UAH` (the seed data's single currency), idempotently. Verified in the running DB (`operator@supertool.local → UAH`).
- **Shared extraction (Task 6, no duplication):** moved `period.ts`, `format-period-label.ts`, and a new `format-amount.ts` (renamed from `format-transaction-amount`, `formatAmount`) to `apps/money-tracker/src/utils/`; `MonthStepper` to `apps/money-tracker/src/components/month-stepper/`; `PERIOD_SEARCH_PARAM`/`PAGE_SEARCH_PARAM` to `apps/money-tracker/src/constants/search-params.ts`. `MonthStepper` labels moved from `transactionsPage.monthNav` to the shared `navigation.monthNav` namespace. All transactions-feature importers updated; transactions month-nav verified unbroken (tests + live).
- **Dashboard route:** `/dashboard` (new); `/` landing kept with an added dashboard link. Net rendered signed + color-coded via `--on-success-container` (positive) / `--error` (negative) design tokens.
- **Visual QA (AC6) — captured via headless Chrome for Testing against the live dev stack, all inspected:** `dashboard-light-desktop` (income green, expense/net red, signed −UAH), `dashboard-dark-desktop` (theme tokens correct on dark surface), `dashboard-light-mobile` (single-column responsive, NFR8), `dashboard-empty-month` (Jan 1990 → "No activity this month" localized empty state), `dashboard-uk` (Огляд / Дохід·Витрати·Баланс, `0,00 ₴` / `42,50 ₴` / `−42,50 ₴` UK formatting), `transactions-regression` (Feb 2025 list + relocated MonthStepper intact). Screenshots captured to `/tmp/vqa/` during the run (throwaway harness, not committed).

### File List

**API (new):**
- `apps/api/src/modules/analytics/analytics.module.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/analytics/analytics.repository.ts`
- `apps/api/src/modules/analytics/dtos/find-summary-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/monthly-summary-response.dto.ts`
- `apps/api/src/modules/analytics/analytics.service.spec.ts`
- `apps/api/src/modules/analytics/analytics.controller.spec.ts`
- `apps/api/test/integration/analytics.integration.spec.ts`

**API (modified):**
- `apps/api/src/app/app.module.ts` (register `AnalyticsModule`)
- `apps/api/src/modules/users/users.module.ts` (export `UsersRepository`)
- `apps/api/src/database/seeds/seed-operator.ts` (set/backfill operator `defaultCurrency = UAH`)

**Shared (modified / generated):**
- `packages/shared/src/constants/i18n-namespace.ts` (`dashboardPage`)
- `packages/shared/src/generated/**` (regenerated client — `AnalyticsApiService`, `MonthlySummaryResponseDto`)
- `apps/api/openapi.json` (regenerated)

**Frontend (new):**
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary/DashboardSummary.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary-skeleton/DashboardSummarySkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/actions/fetch-monthly-summary.ts`
- `apps/money-tracker/src/utils/period.ts` (moved) + `period.test.ts` (moved)
- `apps/money-tracker/src/utils/format-period-label.ts` (moved)
- `apps/money-tracker/src/utils/format-amount.ts` (extracted/renamed) + `format-amount.test.ts`
- `apps/money-tracker/src/components/month-stepper/` (moved: `MonthStepper.tsx`, `ChevronIcon.tsx`, `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/constants/search-params.ts`
- `apps/money-tracker/messages/{en,uk}/dashboard-page.json`

**Frontend (modified):**
- `apps/money-tracker/src/constants/routes.ts` (`dashboard`)
- `apps/money-tracker/src/app/[locale]/page.tsx` (dashboard link)
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` (`dashboardPage` mapping)
- `apps/money-tracker/messages/{en,uk}/home-page.json` (`dashboardLink`)
- `apps/money-tracker/messages/{en,uk}/navigation.json` (`monthNav` moved in)
- `apps/money-tracker/messages/{en,uk}/transactions-page.json` (`monthNav` removed)
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx`, `constants.ts`, `utils/parse-transactions-search-params.ts` (+ `.test.ts`), `utils/build-transactions-redirect-query.ts`, `utils/redirect-to-transaction-month.ts`, `utils/redirect-after-transaction-delete.ts`, `components/transaction-list-server/TransactionListServer.tsx`, `components/transaction-list/TransactionList.tsx` (+ `.test.tsx`), `components/transaction-pagination/TransactionPagination.tsx`, `components/transaction-filters/hooks/use-transaction-filters.ts`, `components/transaction-empty-state/TransactionEmptyState.tsx` (import-path updates for the shared utils/constants)

### Change Log

- 2026-06-15 — Implemented Story 3.1 (Monthly Money Summary): new `analytics` API module with decimal-safe SQL summary endpoint; `/dashboard` page with month stepper + signed/colored summary; shared period/format/MonthStepper extraction; seed operator default-currency backfill; full unit + Testcontainers integration tests; visual QA in both themes. Status → review.
