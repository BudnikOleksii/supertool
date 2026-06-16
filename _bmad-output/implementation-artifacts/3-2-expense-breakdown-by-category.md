---
baseline_commit: 70419cb
---

# Story 3.2: Expense Breakdown by Category

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to see expenses broken down by category for the selected month,
so that I can spot outliers — where the money actually went (FR15).

This is the **second story of Epic 3 (Dashboard & Stats)**. It extends the existing `analytics` API module (created by 3.1) with a breakdown endpoint and adds a second widget to the existing `/dashboard` page. **No new module, no new route** — it builds on 3.1's foundation. Like every dashboard figure, it is scoped to the user's profile-default currency (no picker).

## Acceptance Criteria

> **Currency model (settled 2026-06-15, Epic 2 retro — same as 3.1):** figures are ALWAYS in the user's profile-default currency (FR5). There is **no currency picker**, **no most-frequent fallback**, **no cross-currency aggregation**. The breakdown is computed per-currency in SQL (scoped to the one default currency). [Source: epics.md#Story-3.2; prds/.../prd.md#FR5,FR14,FR15; addendum.md#Currency-handling]

1. **(AC1) Breakdown endpoint — top-level roll-up, SQL aggregation, string amounts (D1).** The `analytics` module exposes `GET /api/v1/analytics/breakdown` taking the same month date range as the summary (`dateFrom`, `dateTo` as `YYYY-MM-DD`). It returns expenses **grouped by top-level category** — child-category spend rolls up into its top-level ancestor (FR15) — computed entirely as Postgres `numeric` SQL aggregation (cast `::text`), never `number`, never JS float math. The response is user-scoped (`session.user.id`), scoped to the profile-default currency, and filtered to `type = 'expense'` only (this is an *expense* breakdown — income is excluded). Consumed via the regenerated client (`AnalyticsApiService`), never hand-written fetch (NFR6).

2. **(AC2) Roll-up handles a restructured (arbitrary-depth) hierarchy.** A transaction's spend is attributed to the **top-level ancestor** of its category, not just its direct parent. The seed ships a two-level hierarchy, but after a user restructures categories (Story 2.6) the tree can be deeper — every descendant's spend must roll up to its root. Categories with no expenses in the period do **not** appear.

3. **(AC3) Breakdown renders ordered, with totals + share-of-total.** On the dashboard, the breakdown renders as a ranked list ordered by amount **descending**, each row showing the top-level category name, its expense total (formatted via the money formatter in the profile-default currency), and its **share-of-total** as a percentage with a proportional bar. It honors the **same period selection** as the summary (the shared `period=YYYY-MM` URL param + `MonthStepper`). A localized empty state renders when there are no expenses in the period (both locales).

4. **(AC4) Totals reconcile + roll-up correctness — decimal-safe integration tests against seeded data.** Testcontainers integration tests assert: (a) roll-up correctness for a **restructured** hierarchy — a child category's spend appears under its top-level parent, not standalone; (b) the sum of all breakdown category totals **reconciles exactly** with the summary endpoint's `expense` figure for the same period (FR18 — no float drift); (c) ordering is amount-descending; (d) cross-currency rows are excluded; (e) cross-user rows are excluded. Reuses the shared helpers in `apps/api/test/helpers/`.

5. **(AC5) Loading + responsive + both locales.** A skeleton shows during load (the breakdown widget has its own `<Suspense>` boundary, independent of the summary); the widget is usable on mobile (NFR8); all new strings localized in **both** `en` and `uk` (FR19/FR20 — same commit, CI key-parity gate).

6. **(AC6) Visual QA evidence recorded (lesson from 1.4/1.8).** Screenshots of the rendered breakdown in **both themes** (light + dark), at desktop and mobile widths, plus the empty state, with the share-of-total bars visible. Evidence recorded in the Dev Agent Record. Green gates + green axe are NOT sufficient — an actual look at the rendered output is mandatory. [Source: memory — ui-stories-need-visual-qa; visual-qa-via-playwright-cli]

## Tasks / Subtasks

- [x] **Task 1 — API: breakdown DTOs** (AC: 1, 3)
  - [x] `dtos/find-breakdown-query.dto.ts`: identical shape to `find-summary-query.dto.ts` (`dateFrom`/`dateTo` as `YYYY-MM-DD`, `@IsString()` + `@Matches(CALENDAR_DATE_PATTERN)`). Do NOT add a `type` param — the breakdown is expense-only by definition.
  - [x] `dtos/category-breakdown-item.dto.ts`: `{ categoryId: string; categoryName: string; total: string; share: number }`. `total` is a **money string** — `@ApiProperty({ type: 'string', example: '420.00' })`. `share` is a presentation percentage (0–100, NOT money) — `@ApiProperty({ type: 'number', example: 37.5 })`.
  - [x] `dtos/category-breakdown-response.dto.ts`: `{ breakdown: CategoryBreakdownItemDto[]; totalExpense: string; currency: string }`. `@ApiProperty({ type: [CategoryBreakdownItemDto] })` for the array, `total`/`totalExpense` as string. Single export per file; no barrels.
- [x] **Task 2 — API: repository SQL aggregation with top-level roll-up (decimal-safe)** (AC: 1, 2, 4)
  - [x] Add `getCategoryBreakdown(query: { userId; currency; dateFrom; dateTo })` to `analytics.repository.ts`. Use a **recursive CTE** that maps every category to its top-level (root) ancestor, then joins `transactions` and groups by the root. Precedent for the recursive-CTE shape: `transactions.repository.ts:173-189` (`getCategorySubtreeIds`). Walk DOWN from roots so each category carries its root id+name:
    ```sql
    WITH RECURSIVE category_roots AS (
      SELECT id, id AS root_id, name AS root_name
      FROM transaction_categories
      WHERE user_id = ${userId} AND parent_id IS NULL
      UNION ALL
      SELECT tc.id, cr.root_id, cr.root_name
      FROM transaction_categories tc
      INNER JOIN category_roots cr ON tc.parent_id = cr.id
      WHERE tc.user_id = ${userId}
    )
    SELECT
      cr.root_id   AS "categoryId",
      cr.root_name AS "categoryName",
      SUM(t.amount)::numeric(14,2)::text AS total,
      (SUM(t.amount) / NULLIF(SUM(SUM(t.amount)) OVER (), 0) * 100)::float8 AS share
    FROM transactions t
    INNER JOIN category_roots cr ON cr.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.currency = ${currency}
      AND t.type::text = ${EXPENSE_TYPE}
      AND t.date >= ${dateFrom} AND t.date <= ${dateTo}
    GROUP BY cr.root_id, cr.root_name
    ORDER BY SUM(t.amount) DESC
    ```
    - **D1 discipline:** `total` and `totalExpense` are produced by Postgres `numeric` arithmetic cast `::numeric(14,2)::text` — never summed in JS. `share` is the ONLY value allowed to be a float (it is a display ratio, not money). Reuse the `MONEY_PRECISION`/`MONEY_SCALE`/`sql.raw` casting style already in `analytics.repository.ts`.
    - Compute `totalExpense` as the SQL `SUM` over the same filtered rows (so it equals the summary's expense by construction — AC4b). Either a second small aggregate query or `result.rows.reduce` over the **string** totals via decimal-safe addition — prefer SQL to avoid any JS money math.
  - [x] Use the parameterized `this.db.execute<{ ... }>(sql\`...\`)` form (matches `getMonthlySummary`). Type the row generic explicitly.
- [x] **Task 3 — API: service wiring** (AC: 1)
  - [x] Add `getCategoryBreakdown(userId, query)` to `analytics.service.ts`. Resolve the user's `defaultCurrency` via the already-injected `UsersRepository.findByIdScoped(userId)` (reuse — do NOT add a second injection or duplicate the query). If `defaultCurrency` is null → return `{ breakdown: [], totalExpense: ZERO_AMOUNT, currency: NO_CURRENCY }` without querying. Import `NO_CURRENCY` from `@supertool/shared/constants/currency` (the single source already used by the summary).
- [x] **Task 4 — API: controller endpoint** (AC: 1)
  - [x] Add `@Get('breakdown')` to `analytics.controller.ts`, mirroring `getMonthlySummary` exactly: `@UseGuards(AuthGuard)`, `@Session() session`, `@Query() query: FindBreakdownQueryDto`, `@ApiOkResponse({ type: CategoryBreakdownResponseDto })`, `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse`. Add the `oxlint-disable-next-line typescript/consistent-type-imports` comment on the `FindBreakdownQueryDto` value import (the `@Query` paramtype metadata needs the runtime import — same as line 16 for `FindSummaryQueryDto`).
- [x] **Task 5 — Regenerate the OpenAPI client** (AC: 1)
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`), then `pnpm --filter @supertool/shared generate:client`. Confirm `AnalyticsApiService.analyticsGetCategoryBreakdown` (or the by-tags name the generator emits) + `CategoryBreakdownResponseDto` + `CategoryBreakdownItemDto` appear in `packages/shared/src/generated/`. Commit the regenerated client. [Source: rules/nestjs-apis.md#DTOs-and-the-generated-OpenAPI-client; memory — sdk-service-classes-and-example-repo]
- [x] **Task 6 — Frontend: fetch action** (AC: 1, 3)
  - [x] Create `apps/money-tracker/src/actions/fetch-category-breakdown.ts` — **mirror `fetch-monthly-summary.ts` exactly**: `cache()`-wrapped plain async (NOT `'use server'` — reads are importable by RSCs), forward cookies via `createServerApiClient({ cookieHeader })`, call `AnalyticsApiService.analyticsGetCategoryBreakdown`, return `{ status: 'success'; breakdown } | { status: 'error' }`. NEVER hand-write fetch (NFR6).
- [x] **Task 7 — Frontend: breakdown widget** (AC: 3, 5)
  - [x] Create `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx` (async RSC). Props `{ period: string; locale: string }` — identical to `DashboardSummary`. Compute `getMonthDateRange(parsePeriod(period))`, call `fetchCategoryBreakdown`, render inside `@supertool/ui` `Card`/`CardContent`. PascalCase file + co-located `.module.scss` + `.test.tsx`.
  - [x] Render: a title (`Typography variant="title-s"`), then the ranked list. Each row: category name, formatted total (`formatAmount(item.total, currency, locale)` — reuse `apps/money-tracker/src/utils/format-amount.ts`), and a share-of-total bar. Bar = a track div + a fill div whose width is driven by `--bar-width: {item.share}%` via inline `style` (CSS custom property), colored with an M3 design token (no hardcoded hex). **Reference for the list+bar markup:** `example/track-my-life/.../dashboard/components/top-category-list/TopCategoryList.tsx` (adapt, never copy — ED1; drop the `CHART_COLOR_LIST` palette, use a single token-based fill).
  - [x] Error state (`result.status === 'error'`) and empty state (`breakdown.length === 0` or `currency === NO_CURRENCY`): render the localized message in a `Card`/`CardContent`, mirroring `DashboardSummary`'s `error`/`empty` blocks. Import `NO_CURRENCY` from `@supertool/shared/constants/currency`.
  - [x] Skeleton: `dashboard-breakdown-skeleton/DashboardBreakdownSkeleton.tsx` using `@supertool/ui` `Skeleton` (mirror `DashboardSummarySkeleton`) — a few placeholder rows.
- [x] **Task 8 — Frontend: mount the widget on the dashboard page** (AC: 3, 5)
  - [x] Edit `apps/money-tracker/src/app/[locale]/dashboard/page.tsx`: add a **second** `<Suspense key={period} fallback={<DashboardBreakdownSkeleton />}>` wrapping `<DashboardBreakdown period={period} locale={locale} />`, placed BELOW the existing summary Suspense. Keep the existing summary block and `MonthStepper` untouched — the breakdown shares the same `period`. *Preserve* the existing page structure; only add.
- [x] **Task 9 — Frontend: i18n (both locales, same commit)** (AC: 5)
  - [x] Extend the existing `apps/money-tracker/messages/en/dashboard-page.json` AND `uk/dashboard-page.json` (the `dashboardPage` namespace already exists from 3.1 — do NOT add a new namespace). Add a `breakdown` block: `title`, `share` label if shown, `empty.title`/`empty.description`, `error.title`/`error.description`. Identical key sets in both files. Use `translate` (next-intl), ICU interpolation only — no concatenation. CI key-parity gate fails on divergence (FR20). [Source: memory — follow-example-repo-patterns split i18n]
- [x] **Task 10 — API integration + unit tests** (AC: 4)
  - [x] `apps/api/test/integration/analytics.integration.spec.ts` (extend the existing file): add a `describe('GET /analytics/breakdown')`. Seed a known hierarchy with a **restructured/nested** category (a grandchild under a child under a top-level parent) and expense transactions across the tree; assert (a) the grandchild + child spend rolls up under the top-level parent's row, (b) `sum(breakdown.total) === summary.expense` for the same period (decimal-safe, exact strings — reuse the decimal-safety helper), (c) rows are amount-descending, (d) a different-currency expense is excluded, (e) a second user's expense is excluded. Reuse `startPostgresContainer`, `runMigrations`, boot/seed helpers from `apps/api/test/helpers/` — do NOT redefine container/migration logic. [Source: tech-debt-integration-test-helper-dedup.md]
  - [x] Service unit spec: extend `analytics.service.spec.ts` — null `defaultCurrency` → empty breakdown without hitting the repository; non-null → delegates to the repository with the resolved currency. Controller spec: `session.user.id` is passed through (extend `analytics.controller.spec.ts`).
- [x] **Task 11 — Frontend tests** (AC: 3, 5)
  - [x] Co-located `DashboardBreakdown.test.tsx`: renders an ordered list with totals + bar widths (assert the `--bar-width` style reflects `share`), renders the empty state when `breakdown` is empty / currency is `NO_CURRENCY`, renders the error state. Mock `fetchCategoryBreakdown`. Mirror `DashboardSummary.test.tsx`. Cover both-locale string rendering where practical.
- [x] **Task 12 — Visual QA** (AC: 6)
  - [x] Run the dev stack, sign in (creds from `.env.example`), open `/dashboard` on a month with expense data (e.g. Feb 2025 from the seed), capture breakdown screenshots: light + dark themes, desktop + mobile widths, plus the empty-month state (e.g. Jan 1990). Confirm bars are proportional and the list is descending. Compare against `example/track-my-life` `TopCategoryList`. Record paths/observations in the Dev Agent Record. [Source: memory — visual-qa-via-playwright-cli]
- [x] **Task 13 — Gates** (AC: all)
  - [x] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm i18n:parity` all green. Run with `--force` where turbo may replay stale cache. [Source: memory — turbo-cache-masks-gate-results, run-tests-via-pnpm-scripts]

## Dev Notes

### What this story is (and is NOT)

- **IS:** one new endpoint on the existing `analytics` module + one new widget on the existing `/dashboard` page. The module, the dashboard route, the `MonthStepper`, the `period` URL param, the currency model, and the fetch-action pattern all already exist from 3.1 — reuse them verbatim.
- **IS NOT:** a new module, a new route, a charting library, an income breakdown, or a currency picker. **No new dependency is expected** (charts arrive in 3.3). The breakdown is a ranked list with CSS share-of-total bars — exactly the reference's `TopCategoryList` shape, not its `CategoryBreakdownChart`.

### Top-level roll-up — the one genuinely new piece of logic

The schema is `transaction_categories.parent_id` (self-referential, `null` = top-level) and `transactions.category_id` (FK to a category). The seed ships two levels, but Story 2.6 lets the user restructure to **arbitrary depth**, so the roll-up MUST walk to the root, not just one level up. Use the recursive-CTE precedent (`transactions.repository.ts:173-189`) but invert the direction: anchor on roots (`parent_id IS NULL`), recurse downward carrying `root_id`/`root_name`, then join transactions and group by root. Categories with zero expenses simply don't appear (INNER JOIN). [Source: schemas/transaction-categories.ts; schemas/transactions.ts]

### D1 — money is strings end-to-end (merge-blocking)

Postgres `numeric(14,2)`; string amounts in every DTO and in JS; SQL does all the money arithmetic cast `::numeric(14,2)::text`. Each `total` and `totalExpense` is a string. **The only number in the response is `share`** — a presentation percentage (0–100) for the bar width, explicitly NOT a money value. Do not sum money in JS; `totalExpense` comes from SQL so it reconciles exactly with the summary's `expense` (AC4b). [Source: CLAUDE.md hard rule 1; architecture.md#D1; 3-1 Dev Notes]

### Currency model — do NOT reintroduce a picker

Same as 3.1: figures are always in `users.defaultCurrency`. No selector, no most-frequent fallback. Scope the WHERE clause to the one default currency so multi-currency rows never cross-aggregate. Null default currency → empty breakdown + `NO_CURRENCY`, no query. [Source: epics.md Epic 3; addendum.md#Currency-handling; 3-1 Dev Notes]

### Architecture compliance (guardrails)

- **Layering (D7):** controller → service → repository. The recursive CTE lives in the repository only. No Drizzle in the service/controller.
- **Generated client only (NFR6):** the frontend reads the breakdown exclusively through `AnalyticsApiService` from `packages/shared/src/generated/`. A hand-written `fetch('/api/...')` is a defect.
- **Read path:** RSC → `fetch-category-breakdown` action → generated client (cookie forwarded via `next-shared` factory) → proxy rewrite → API → SQL aggregation → camelCase JSON (string totals) → RSC render. [architecture.md#read-path]
- **API conventions:** `/api/v1/...`, camelCase JSON, errors `{ statusCode, code, message, details? }`, auth via `@UseGuards(AuthGuard)` + `@Session()`.
- **Dates:** `date` is a `date` column / `YYYY-MM-DD` string — no timezone math. Range built client-side by `getMonthDateRange`, passed as two `YYYY-MM-DD` strings (same as summary).
- **DI (merge-blocking):** explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable (SWC erases it → DI breaks under Vitest). The service already injects `AnalyticsRepository` + `UsersRepository`; reuse them. [Source: memory — nest-di-explicit-inject]

### Source tree — files to touch

**API (NEW):**
- `apps/api/src/modules/analytics/dtos/find-breakdown-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/category-breakdown-item.dto.ts`
- `apps/api/src/modules/analytics/dtos/category-breakdown-response.dto.ts`

**API (UPDATE):**
- `apps/api/src/modules/analytics/analytics.controller.ts` — *current state:* one `@Get('summary')`. Add `@Get('breakdown')` alongside it. *Preserve* the summary endpoint and its decorators.
- `apps/api/src/modules/analytics/analytics.service.ts` — *current state:* `getMonthlySummary` + the `NO_CURRENCY`/`ZERO_AMOUNT` handling and the two injected repositories. Add `getCategoryBreakdown`. *Preserve* the existing method and injections.
- `apps/api/src/modules/analytics/analytics.repository.ts` — *current state:* `getMonthlySummary` with the `numeric(14,2)::text` casting helpers. Add `getCategoryBreakdown` with the recursive CTE. *Preserve* the existing aggregation and constants.
- `apps/api/src/modules/analytics/analytics.service.spec.ts`, `analytics.controller.spec.ts` — extend.
- `apps/api/test/integration/analytics.integration.spec.ts` — extend with a `breakdown` describe block.
- `packages/shared/src/generated/**` — regenerated (not hand-edited).
- `apps/api/openapi.json` — regenerated.

**Frontend (NEW):**
- `apps/money-tracker/src/actions/fetch-category-breakdown.ts`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown-skeleton/DashboardBreakdownSkeleton.tsx` (+ `.module.scss`)

**Frontend (UPDATE):**
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` — add the second `<Suspense>` block. *Preserve* the summary block, header, and `MonthStepper`.
- `apps/money-tracker/messages/en/dashboard-page.json` AND `uk/dashboard-page.json` — add the `breakdown` block (same keys both files).

### Reference patterns (study before implementing — `example/track-my-life`, reference-only ED1)

- Breakdown list + share bar: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/dashboard/components/top-category-list/TopCategoryList.tsx` (+ its `.module.scss` for the `barTrack`/`barFill` pattern). **This is the model for 3.2** — adapt to the single-currency, token-based fill, `translate` (not `t`), PascalCase, `@supertool` scope.
- Fetch action shape: `…/dashboard/actions/fetch-category-breakdown.ts` (reference) — but mirror the **local** `fetch-monthly-summary.ts` for the actual client/cookie wiring.
- Chart version (NOT used in 3.2 — for context only): `…/dashboard/components/category-breakdown-chart/`.
- **Adapt, never copy (ED1).** No `CHART_COLOR_LIST` palette, no `convertFilterDateList`/timezone offset (the local app uses `YYYY-MM-DD` strings + `getMonthDateRange`), no currency filter.

### Local patterns to reuse (do NOT reinvent)

- **Analytics module (3.1):** `apps/api/src/modules/analytics/{controller,service,repository}.ts` + `dtos/` — the breakdown is a direct sibling of the summary; copy its structure, decorators, and casting helpers.
- **Recursive CTE:** `apps/api/src/modules/transactions/transactions.repository.ts:173-189` (`getCategorySubtreeIds`) — the shape to adapt for root resolution.
- **Frontend widget pattern:** `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary/DashboardSummary.tsx` (+ `.module.scss`, `.test.tsx`) and `dashboard-summary-skeleton/` — `DashboardBreakdown` mirrors these (Card/CardContent, error/empty/success branches, `getMonthDateRange`, `formatAmount`, `NO_CURRENCY`).
- **Fetch action:** `apps/money-tracker/src/actions/fetch-monthly-summary.ts`.
- **Money formatting:** `apps/money-tracker/src/utils/format-amount.ts` (`formatAmount(amount, currency, locale)`).
- **Period utils:** `apps/money-tracker/src/utils/period.ts` (`parsePeriod`, `getMonthDateRange`, `formatPeriod`), `constants/search-params.ts` (`PERIOD_SEARCH_PARAM`).
- **Shared constants:** `NO_CURRENCY` in `@supertool/shared/constants/currency`; `I18N_NAMESPACE.dashboardPage` (already exists). [Source: memory — shared-constants-no-duplication]
- **Test helpers:** `apps/api/test/helpers/{postgres-container,integration-app,decimal-safe-sums}.ts`.
- **UI primitives:** `@supertool/ui` `Card`/`CardContent` (`molecules/card/Card`), `Typography` (`atoms/typography/Typography`), `Skeleton` (`atoms/skeleton`), `cn` (`lib/utils`).

### Coding conventions (merge-blocking subset)

- No comments — self-documenting names. Follow-up work goes in story/epic files, never code TODOs.
- Arrow functions; `get`/`fetch`/`check`/`format`/`parse` prefixes; array vars carry `list` suffix; `UPPER_SNAKE_CASE` constants.
- TS: prefer interfaces; NO enums (`as const` + `ObjectValuesUnion`); no `as` assertions in prod code (narrow with `checkIs*`); single source of truth for value sets.
- One export per file; named exports; no barrel files.
- Files/dirs kebab-case; component files + co-located `.module.scss`/`.test.tsx` PascalCase. [Source: memory — pascalcase-component-filenames]
- Tests ship in the SAME story as the feature (NFR1).
- Exact dependency versions (no `^`/`~`); never introduce eslint/prettier (oxlint + oxfmt only). **No new dependency expected** for this story.
- FC typing: `Component: FC<Props>` per react conventions (manually verified — not lint-enforced). [Source: memory — fc-props-convention-not-lint-enforced, follow-example-repo-patterns]

### Testing standards

- API: Vitest (SWC decorators) for unit specs; Testcontainers against real Postgres for integration. Given-When-Then for module acceptance; Arrange-Act-Assert for units; `inputX`/`mockX`/`actualX`/`expectedX` naming.
- Money assertions compare exact strings; the breakdown total must reconcile **exactly** with the summary expense — assert no float drift (FR18, the marquee correctness test for this story).
- Frontend: co-located `*.test.tsx`; assert bar widths reflect `share`; cover empty/error states; both-locale coverage where strings render.

### Previous-work intelligence

- **Story 3.1 (Monthly Summary)** created the `analytics` module, the `/dashboard` page, the fetch-action pattern, the `NO_CURRENCY` sentinel handling, the seed operator `defaultCurrency = UAH` backfill, and the shared period/`MonthStepper`/`formatAmount` utilities. 3.2 extends every one of these — do not duplicate or fork them. The summary's `getMonthlySummary` repository method is the casting/aggregation template; the breakdown is its sibling with a recursive-CTE join.
- **Story 2.5 (Filter & Sort)** built the subtree-aware category filter using a recursive CTE (`getCategorySubtreeIds`) — the same CTE technique powers the roll-up here (inverted to resolve roots).
- **Story 2.6 (Organize Categories)** made the hierarchy restructurable to arbitrary depth — this is exactly why the roll-up must walk to the root, not one level (AC2). A naive "join on parent_id" would silently under-count after a user nests categories.
- **Epic 2 retro (2026-06-15)** settled the single-default-currency model; AC4 cross-currency exclusion guards it.
- **Tech-debt (done):** integration test helpers are consolidated in `apps/api/test/helpers/` — import, don't redefine.
- **1.4 / 1.8 lesson:** both shipped broken UI with green gates because nobody looked. AC6 visual QA in both themes is mandatory.

### Git intelligence (recent commits)

`70419cb` 3-1 monthly summary (analytics module + `/dashboard`) · `dbcd0a5` epic-2 retro + currency reconciliation · `82fdadb` 2-5 filter/sort (subtree CTE) · `3198cc0` 2-4 edit/delete. Pattern: each analytics story adds an endpoint to the `analytics` module + a dashboard widget + co-located tests, then regenerates the client. The recursive-CTE precedent and the dashboard-widget scaffolding both already exist in the tree.

### Project Structure Notes

- Aligns with `architecture.md` component tree: `modules/analytics` (summary/**breakdown**/trend) and the `category-breakdown` dashboard component named in the F4 mapping. No `currency-filter` (removed 2026-06-15).
- Dependency direction respected: `shared` (i18n namespace, `NO_CURRENCY`) → `ui` (Card/Typography/Skeleton) → app. The breakdown is app-level; no new `@supertool/ui` primitive expected.
- The reference nests the same widget under `/dashboard`; supertool matches (3.1 decision — `/dashboard` route, `/` stays landing).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2-Expense-Breakdown-by-Category]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3-Dashboard-and-Stats]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#FR5,FR14,FR15,FR18,FR19,FR20]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md#Currency-handling-superseded-2026-06-15]
- [Source: _bmad-output/planning-artifacts/architecture.md#D1-Money] · [#component-tree (modules/analytics, category-breakdown)] · [#read-path]
- [Source: CLAUDE.md#Hard-rules] · [.claude/rules/nestjs-apis.md] · [.claude/rules/typescript.md]
- [Source: _bmad-output/implementation-artifacts/3-1-monthly-money-summary.md — analytics module + dashboard patterns established]
- [Source: apps/api/src/modules/analytics/* — summary controller/service/repository/dto template]
- [Source: apps/api/src/modules/transactions/transactions.repository.ts:173-189 — recursive-CTE precedent]
- [Source: apps/api/src/database/schemas/transaction-categories.ts — parent_id hierarchy]
- [Source: apps/money-tracker/src/app/[locale]/dashboard/ — page, DashboardSummary, skeleton, fetch-monthly-summary]
- [Source: example/track-my-life/.../dashboard/components/top-category-list/TopCategoryList.tsx — list+bar reference]
- [Source: _bmad-output/implementation-artifacts/tech-debt-integration-test-helper-dedup.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- API build initially failed: `db.execute<CategoryBreakdownRow>` — a named interface does not satisfy the `Record<string, unknown>` generic constraint. Resolved by inlining the row generic (matching the existing `getMonthlySummary`/`getCategorySubtreeIds` style).
- Lint `max-statements`: `seedBreakdownFixture` exceeded 10 statements. Split into `insertUser` / `insertBreakdownHierarchy` / `insertBreakdownTransactions` / `insertCrossUserExpense`.
- Visual QA: first capture pass produced sign-in pages for some theme/viewport contexts — better-auth rate-limited the repeated UI sign-ins. Reworked the harness to sign in **once**, persist `storageState`, and reuse it across all contexts (theme applied via `addInitScript` setting `localStorage.theme` for next-themes). Browser version mismatch (playwright wanted chromium-1219, cache had 1208) resolved with `executablePath` → cached chrome-for-testing binary.

### Completion Notes List

- **API:** `GET /api/v1/analytics/breakdown` added to the existing `analytics` module (no new module/route). Top-level roll-up via a recursive CTE anchored on `parent_id IS NULL` roots, recursing downward carrying `root_id`/`root_name`, INNER JOIN to transactions, GROUP BY root, ORDER BY `SUM(amount)` DESC. All money arithmetic is Postgres `numeric(14,2)::text` (D1) — `total` and `totalExpense` are strings; `share` is the only float (a display percentage from `SUM/SUM-OVER()`). `totalExpense` derived from the window `SUM(SUM(...)) OVER ()` so it reconciles with the summary's `expense` by construction. Expense-only (`type = 'expense'`), scoped to `userId` + profile-default currency; null currency → empty breakdown + `NO_CURRENCY` without querying.
- **Client regenerated:** `AnalyticsApiService.analyticsGetCategoryBreakdown` + `CategoryBreakdownResponseDto` (`total`/`totalExpense` string, `share` number) committed in `packages/shared/src/generated/`.
- **Frontend:** `fetchCategoryBreakdown` cache()-wrapped read action (generated client, cookie forwarded — NFR6). `DashboardBreakdown` RSC renders a ranked list (name, localized share %, `formatAmount` total, proportional CSS bar via `--bar-width` custom property, `--primary` token fill — no palette). Independent `<Suspense>` on the dashboard page below the summary, sharing the same `period` URL param. Error + empty states mirror `DashboardSummary`. `DashboardBreakdownSkeleton` added.
- **i18n:** `breakdown` block added to `en/uk dashboard-page.json` (same keys, real Ukrainian) under the existing `dashboardPage` namespace. CI key-parity green.
- **Tests:** service + controller unit specs extended; integration spec extended with a controlled **restructured 3-level** hierarchy (Food → Restaurants → Fast Food) asserting roll-up to root, amount-descending ordering, exact reconciliation `sum(breakdown.total) === summary.expense === totalExpense` (decimal-safe via `Decimal`), share correctness, and cross-currency + cross-user exclusion. Co-located `DashboardBreakdown.test.tsx` asserts ordering, `--bar-width` reflects `share`, empty (no expenses / `NO_CURRENCY`), and error states.
- **Visual QA (AC6) — actually looked at all renders:** captured `/dashboard?period=2024-12` (114 seeded UAH expenses) and the empty month `1990-01` in **both themes** at **desktop (1280) + mobile (390)**. Evidence in `/tmp/qa-3-2/`:
  - `breakdown-light-desktop.png`, `breakdown-dark-desktop.png`, `breakdown-light-mobile.png`, `breakdown-dark-mobile.png`
  - `empty-light-desktop.png`, `empty-dark-desktop.png`, `empty-light-mobile.png`, `empty-dark-mobile.png`
  - Observations: list ranked descending (Базові потреби 23.2% → Розваги 0.4%), bars proportional to share, `--primary` fill contrasts on the `--surface-container-high` track in both themes, responsive single-column on mobile, both localized empty cards render. **Reconciliation confirmed visually:** breakdown totals sum to UAH 76,213.90 = the summary's Expense exactly (FR18).
  - Compared against the reference `TopCategoryList` shape — adopted its list+bar layout (header row + `barTrack`/`barFill`), dropped the `CHART_COLOR_LIST` palette and rank chips per story scope.
- **Gates:** `pnpm type-check`, `lint`, `stylelint`, `test` (run `--force`, 0 cached, 169 API tests incl. 6 new integration), `fmt:check`, `i18n:parity` — all green.

### File List

**API (new):**
- `apps/api/src/modules/analytics/dtos/find-breakdown-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/category-breakdown-item.dto.ts`
- `apps/api/src/modules/analytics/dtos/category-breakdown-response.dto.ts`

**API (modified):**
- `apps/api/src/modules/analytics/analytics.repository.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.service.spec.ts`
- `apps/api/src/modules/analytics/analytics.controller.spec.ts`
- `apps/api/test/integration/analytics.integration.spec.ts`
- `apps/api/openapi.json` (regenerated)

**Shared (regenerated):**
- `packages/shared/src/generated/sdk.gen.ts`
- `packages/shared/src/generated/types.gen.ts`
- `packages/shared/src/generated/index.ts`

**Frontend (new):**
- `apps/money-tracker/src/actions/fetch-category-breakdown.ts`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.module.scss`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.test.tsx`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown-skeleton/DashboardBreakdownSkeleton.tsx`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown-skeleton/DashboardBreakdownSkeleton.module.scss`

**Frontend (modified):**
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx`
- `apps/money-tracker/messages/en/dashboard-page.json`
- `apps/money-tracker/messages/uk/dashboard-page.json`

### Change Log

- 2026-06-16 — Implemented Story 3.2 (Expense Breakdown by Category): analytics `breakdown` endpoint with recursive-CTE top-level roll-up (decimal-safe), regenerated client, `DashboardBreakdown` widget + skeleton on `/dashboard`, both-locale i18n, unit + integration + frontend tests, visual QA in both themes/widths. Status → review.

## Review Findings

_Code review 2026-06-16 (3-layer adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). All gates green (type-check, lint, stylelint, 169 API tests + frontend, fmt, i18n parity)._

- [x] [Review][Decision] AC6 visual QA evidence lives in ephemeral `/tmp/qa-3-2/` — the recorded notes are specific and credible (both themes, desktop+mobile, empty state, bars visible, exact `UAH 76,213.90` reconciliation matching the seed), satisfying the evidence gate's content requirement; but the screenshots cannot be re-verified statically. **Resolved 2026-06-16 — Oleksii accepted the recorded evidence as genuine; AC6 satisfied.**
- [x] [Review][Defer] Breakdown CTE trusts category-tree integrity the reconciling summary query does not [apps/api/src/modules/analytics/analytics.repository.ts] — deferred, defensive/robustness. The `category_roots` CTE only seeds from user-owned `parent_id IS NULL` roots; any category whose ancestor chain doesn't resolve to such a root is dropped by the `INNER JOIN`, silently removing its expense from `total`/`totalExpense`/`share` while `getMonthlySummary` (flat sum) still counts it → FR18 reconciliation could diverge. Happy path is fully guarded (same-user parent scoping, `onDelete: restrict`, type-match, cycle prevention at write time), so this is unreachable via the application surface — robustness hardening only, no current bug.

### Dismissed as noise (recorded for traceability)

- Recursive CTE has no `CYCLE` guard — unreachable: `assertValidNewParent` blocks self/descendant cycles at write time.
- Displayed category shares need not sum to 100% after 1-dp rounding — display-only, conventional breakdown UX; money totals are exact.
- `defaultCurrency === ''` bypasses the `null` short-circuit and runs a guaranteed-empty query — harmless (empty result + `NO_CURRENCY`); onboarding only writes codes from `CURRENCY_CODE_LIST`.
- breakdown/summary date-window coupling — both derive `getMonthDateRange(parsePeriod(period))` from the same `period` prop today; latent coupling only.
