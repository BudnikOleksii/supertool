---
baseline_commit: a5355c38bc60cfccdc90a8208129bee598b08089
---

# Story 5.4: Dashboard Analytics Endpoints — Top Categories & Daily Spending

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the operator-developer,
I want `top-categories` and `daily-spending` analytics endpoints,
so that the new dashboard widgets (5.5) have exact, user-scoped, single-currency data to render (RP-B2).

## Context & Why This Story

The `analytics` module already ships **three** endpoints from Epic 3 — `GET /api/v1/analytics/summary` (3.1), `/breakdown` (3.2), `/trend` (3.3). This story adds the **two missing endpoints** the reference has and supertool lacks (RP-B2, P0): `top-categories` (ranked category spend) and `daily-spending` (per-day expense totals). They are the data contract for the new dashboard widgets in Story 5.5 (top-categories + daily-spending bar); 5.5 consumes them via the generated client, so the endpoints land first.

This is a **backend-only** story: endpoints + DTOs + repository SQL + regenerated client + tests. **No widgets, no fetch actions, no page changes, no i18n keys, no visual/mobile QA** — those are Story 5.5's scope. Keeping 5.4 to the contract mirrors how Epic 5 split 5.1 (import endpoint) from 5.2 (import page).

The work is a near-clone of the existing `/breakdown` and `/trend` endpoints — reuse their exact patterns (recursive-CTE top-level roll-up, `generate_series` zero-fill, `numeric(14,2)::text` money casting, per-currency scoping via `UsersRepository`, `NO_CURRENCY` short-circuit). Two deliberate reference divergences: (1) `daily-spending` buckets by a **caller-selected `dateFrom`/`dateTo` range** (fixing the reference §5 defect where daily-spending is pinned to the current month and ignores the range); (2) currency stays the **single profile-default** (RP-D1 — no `currencyCode` query param, no `type` picker), unlike the reference's optional currency/type params.

**Evidence base:** reference backend `example/tracker-backend-api/src/modules/transactions-analytics/` — `getTopCategories`/`getDailyTotals` in `transactions-analytics.repository.ts`, `top-categories-*.dto.ts`, `daily-spending-*.dto.ts` (adapt, never copy — ED1). Reference dashboard captures `…/visual-qa/spike-reference-parity/reference/dashboard--overview*` (widget targets for 5.5, context only). Gap rows RP-B2 / RP-F3 in `reference-parity-gap-backlog.md`; §5 defect "daily-spending chart ignores selected range".

## Recommended Approach (binding direction)

**Contract — two new `@Get` routes on the existing `AnalyticsController`, mirroring `/breakdown` and `/trend` exactly:**

- `GET /api/v1/analytics/top-categories?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&limit=N` → ranked top-level categories by expense (roll-up), string totals + share-of-total + transaction count, capped by `limit`.
- `GET /api/v1/analytics/daily-spending?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` → per-day expense totals **for that exact range** (zero days filled as `0.00`), string totals + per-day transaction count.

Both are `@UseGuards(AuthGuard)`, `@Session() session`, `@Query() dto`, `@ApiOkResponse`/`@ApiUnauthorizedResponse`/`@ApiBadRequestResponse` — copy the `getCategoryBreakdown`/`getMonthlyTrend` decorator stack verbatim. Add the `oxlint-disable-next-line typescript/consistent-type-imports` comment above each new query-DTO **value** import (the `@Query` paramtype metadata needs the runtime import — same as the three existing query DTOs). operationIds derive from method names via the OpenAPI builder — name the controller methods `getTopCategories` and `getDailySpending`.

**Both endpoints are expense-only and profile-default-currency-scoped** (D1/RP-D1/FR14): the service resolves the user's `defaultCurrency` via the already-injected `UsersRepository.findByIdScoped(userId)` (reuse — no new injection), and on `null` returns an empty payload with `currency: NO_CURRENCY` and `totalExpense: '0.00'` **without querying** — identical to `getCategoryBreakdown`/`getMonthlyTrend`. `daily-spending` sums **expense** transactions (it is "spending"); `top-categories` filters `type = 'expense'` like `/breakdown`.

### top-categories — reuse the `/breakdown` recursive CTE

`top-categories` is `/breakdown` + a `limit` + a `rank` + a `transactionCount`. Add `getTopCategories({ userId, currency, dateFrom, dateTo, limit })` to `analytics.repository.ts` by adapting `getCategoryBreakdown`'s recursive-CTE roll-up (`transactions.repository.ts` `getCategorySubtreeIds`, ~line 263, `WITH RECURSIVE subtree`, is the CTE precedent):

- Same `category_roots` recursive CTE anchored on `parent_id IS NULL` roots, recursing downward carrying `root_id`/`root_name`, INNER JOIN transactions, `GROUP BY cr.root_id, cr.root_name`, `ORDER BY SUM(t.amount) DESC` — so every descendant's spend rolls up to its **top-level ancestor** (AC2 of 3.2 applies identically after Story 2.6 restructuring).
- `total` = `SUM(t.amount)::numeric(14,2)::text` (money string, D1). `share` = `(SUM(t.amount) / NULLIF(SUM(SUM(t.amount)) OVER (), 0) * 100)::float8` — the **only** float, a display percentage. `totalExpense` = `(SUM(SUM(t.amount)) OVER ())::numeric(14,2)::text` — the grand total across **all** categories (window fn computed before `LIMIT`), so it reconciles exactly with the summary's `expense` even when `limit` truncates the list.
- Add `COUNT(t.id)::int AS "transactionCount"` per group (a count, not money → `number`).
- Append `LIMIT ${query.limit}` after `ORDER BY`.
- Derive `rank` in the JS `.map` as `index + 1` (order is guaranteed by `ORDER BY`) — no extra SQL. Reuse the `moneyCast()` helper and the inlined-row-generic `this.db.execute<{…}>(sql\`…\`)` form already in the file (a named interface does not satisfy the `Record<string, unknown>` generic — inline it, per 3.2's Debug Log).

### daily-spending — reuse the `/trend` `generate_series` zero-fill

Add `getDailySpending({ userId, currency, dateFrom, dateTo })` by adapting `getMonthlyTrend`'s `months` CTE to **days**:

- `WITH days AS (SELECT generate_series(${dateFrom}::date, ${dateTo}::date, interval '1 day')::date AS day)` — zero-fills every day in the **selected range** (fixes the §5 defect; range is caller-supplied, not month-pinned).
- `LEFT JOIN transactions t ON t.date = d.day AND t.user_id = … AND t.currency = … AND t.type::text = ${EXPENSE_TYPE}`.
- `SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COALESCE(SUM(t.amount), 0)::numeric(14,2)::text AS total, COUNT(t.id)::int AS "transactionCount" … GROUP BY d.day ORDER BY d.day ASC`.
- `totalExpense` = the SQL `SUM` over the same expense rows (a second small scalar select, or a window sum) cast `::numeric(14,2)::text` — never summed in JS — so it reconciles with the summary's `expense` for the same range.

**DTOs (new, `dtos/`, one export per file, no barrels — money = string, counts/share/rank = number):**

- `find-top-categories-query.dto.ts` — `{ dateFrom, dateTo, limit? }`. `dateFrom`/`dateTo`: `@IsString() @Matches(CALENDAR_DATE_PATTERN)`, `dateTo` also `@IsOnOrAfter('dateFrom')` (mirror `find-trend-query.dto.ts`). `limit`: `@ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(TOP_CATEGORIES_MIN_LIMIT) @Max(TOP_CATEGORIES_MAX_LIMIT)`.
- `top-category-item.dto.ts` — `{ rank: number; categoryId: string; categoryName: string; total: string; share: number; transactionCount: number }`. `total` → `@ApiProperty({ type: 'string', example: '450.25' })`; `share` → `@ApiProperty({ type: 'number', example: 28.5 })`; `rank`/`transactionCount` → `@ApiProperty({ type: 'number' })`.
- `top-categories-response.dto.ts` — `{ categories: TopCategoryItemDto[]; totalExpense: string; currency: string }`. `@ApiProperty({ type: [TopCategoryItemDto] })`; `totalExpense` string; `currency` bare `@ApiProperty({ example: 'UAH' })` string — **match the existing analytics DTOs' bare-string currency, NOT the reference's `currencyCode` enum** (D-4).
- `find-daily-spending-query.dto.ts` — `{ dateFrom, dateTo }`, identical to `find-trend-query.dto.ts` (`@IsOnOrAfter('dateFrom')` on `dateTo`).
- `daily-spending-day.dto.ts` — `{ date: string; total: string; transactionCount: number }`. `date` → `@ApiProperty({ example: '2025-02-15' })`; `total` → `@ApiProperty({ type: 'string', example: '45.99' })`; `transactionCount` → number.
- `daily-spending-response.dto.ts` — `{ days: DailySpendingDayDto[]; totalExpense: string; currency: string }`.

**Shared limit constants (cross-app — 5.5's client must read the same values, memory `shared-constants-no-duplication`):** new `packages/shared/src/constants/analytics.ts` with `TOP_CATEGORIES_DEFAULT_LIMIT = 5`, `TOP_CATEGORIES_MIN_LIMIT = 1`, `TOP_CATEGORIES_MAX_LIMIT = 20` (reference parity — its `TopCategoriesQueryDto` uses `limit` 1–20 default 5). The DTO `@Min`/`@Max` and the service default (`query.limit ?? TOP_CATEGORIES_DEFAULT_LIMIT`) both read these; 5.5 will clamp against the same MAX.

**Layering (D7 — intact):** controller → service → repository. Both recursive-CTE / `generate_series` queries live in `analytics.repository.ts` only; no Drizzle in service/controller. **DI (merge-blocking):** explicit `@Inject(ClassName)`; never `import type` an injectable — `AnalyticsRepository` + `UsersRepository` are already injected in the service; reuse them.

## Acceptance Criteria

> **Currency model (settled 2026-06-15, RP-D1 — same as 3.1/3.2/3.3):** figures are ALWAYS in the user's `defaultCurrency` (FR5). **No currency picker, no `currencyCode` query param, no cross-currency aggregation, no most-frequent fallback.** Both endpoints scope the WHERE clause to the one default currency; `null` default → empty payload + `NO_CURRENCY`, no query. [Source: epics.md#Story-5.4; addendum.md#Currency-handling; RP-D1]

1. **(AC1) Top-categories endpoint — top-level roll-up, ranked, SQL aggregation, string amounts (D1).** The `analytics` module exposes `GET /api/v1/analytics/top-categories` taking `dateFrom`/`dateTo` (`YYYY-MM-DD`) and an optional `limit`. It returns expense categories **grouped by top-level ancestor** (child spend rolls up to its root, honoring arbitrary-depth hierarchies after Story 2.6), ranked by amount **descending**, capped at `limit`, each item carrying `rank`, `categoryId`, `categoryName`, `total` (money **string**), `share` (display % — the only float), and `transactionCount` (a count → number). All money arithmetic is Postgres `numeric(14,2)::text` — never summed in JS. Filtered to `type = 'expense'`, user-scoped (`session.user.id`) and profile-default-currency-scoped. Consumed via the regenerated `AnalyticsApiService` (NFR6) — no hand-written fetch.

2. **(AC2) Top-categories `limit` bounds + `totalExpense` reconciliation.** `limit` is optional, defaulting to `TOP_CATEGORIES_DEFAULT_LIMIT`, validated to `TOP_CATEGORIES_MIN_LIMIT..TOP_CATEGORIES_MAX_LIMIT` (out-of-range → 400 shared envelope). `totalExpense` is the SQL grand total over **all** expense categories in the period (not just the returned top N), so it equals the summary endpoint's `expense` figure for the same period exactly (FR18 — no float drift), and `share` values are the returned items' shares of that grand total.

3. **(AC3) Daily-spending endpoint — per-day expense totals honoring the exact range (fixes §5 defect).** `GET /api/v1/analytics/daily-spending` takes `dateFrom`/`dateTo` and returns per-day **expense** totals **for that exact range** — **not pinned to a month/current period** (the reference §5 defect is fixed). Every day in `[dateFrom, dateTo]` appears via `generate_series`, including zero days as `total: '0.00'` / `transactionCount: 0`, ordered ascending. `total` is a money **string** from `numeric(14,2)::text` (D1); `transactionCount` is a number. User- and profile-default-currency-scoped. `totalExpense` is the SQL sum over the range and reconciles with the summary's `expense` for the same range.

4. **(AC4) Null default currency → empty payload, no query.** For a user whose `defaultCurrency` is `null`, both endpoints return `{ categories: [], totalExpense: '0.00', currency: NO_CURRENCY }` / `{ days: [], totalExpense: '0.00', currency: NO_CURRENCY }` without hitting the repository (mirrors the existing three endpoints; `NO_CURRENCY` from `@supertool/shared/constants/currency`).

5. **(AC5) Contract regenerated + drift gate green.** After the DTOs land, `pnpm --filter @supertool/api build` emits `openapi.json` and `pnpm --filter @supertool/shared generate:client` regenerates the client; `AnalyticsApiService.analyticsGetTopCategories` / `analyticsGetDailySpending` (or the by-tags names the generator emits) + `TopCategoriesResponseDto`/`TopCategoryItemDto`/`DailySpendingResponseDto`/`DailySpendingDayDto` appear in `packages/shared/src/generated/` and are committed. The shared error envelope `{ statusCode, code, message, details? }` applies to both (D7/RP-D3). CI drift gate passes (NFR6/D8).

6. **(AC6) Decimal-safe integration + unit tests against seeded data (tests-in-story, NFR1).** Testcontainers integration tests (extending `analytics.integration.spec.ts`) assert, against a controlled restructured hierarchy and known transactions: **top-categories** — (a) roll-up: a grandchild/child's spend appears under its top-level root, not standalone; (b) ranked amount-descending; (c) `limit` honored (e.g. `limit=2` returns exactly 2 rows with `rank` 1,2); (d) `sum(returned totals)` ≤ `totalExpense` and `totalExpense === summary.expense` exactly (decimal-safe via `Decimal`); (e) `transactionCount` correct; (f) cross-currency, cross-user, and income rows excluded. **daily-spending** — (g) per-day totals match independently computed expectations exactly; (h) zero days present as `'0.00'`/`0`; (i) range honored across a **partial / multi-month** window (not month-pinned); (j) `totalExpense === summary.expense` for the same range; (k) cross-currency/user/income excluded. Plus service unit specs (null-currency short-circuit + delegation with resolved currency & default limit) and controller specs (`session.user.id` passthrough) and DTO validation specs (`IsOnOrAfter` reversed-window rejection; `limit` out-of-range rejection). Reuse `apps/api/test/helpers/` — do not redefine container/migration logic.

## Tasks / Subtasks

- [x] **Task 1 — Shared: analytics limit constants** (AC: 2)
  - [x] Create `packages/shared/src/constants/analytics.ts` exporting `TOP_CATEGORIES_DEFAULT_LIMIT = 5`, `TOP_CATEGORIES_MIN_LIMIT = 1`, `TOP_CATEGORIES_MAX_LIMIT = 20` (`UPPER_SNAKE_CASE`, `as const` not needed for numbers). One concept per constant; no barrel. This is the single source both the API DTO/service and 5.5's frontend clamp read. [Source: memory — shared-constants-no-duplication; reference `top-categories-query.dto.ts` limit 1–20 default 5]

- [x] **Task 2 — API: top-categories DTOs** (AC: 1, 2)
  - [x] `dtos/find-top-categories-query.dto.ts`: `dateFrom`/`dateTo` mirroring `find-trend-query.dto.ts` (`@IsString()`, `@Matches(CALENDAR_DATE_PATTERN)`, `@IsOnOrAfter('dateFrom')` on `dateTo`); optional `limit` (`@ApiPropertyOptional({ example: 5, minimum: 1, maximum: 20 })`, `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(TOP_CATEGORIES_MIN_LIMIT)`, `@Max(TOP_CATEGORIES_MAX_LIMIT)`).
  - [x] `dtos/top-category-item.dto.ts`: `{ rank; categoryId; categoryName; total; share; transactionCount }` — `total` `@ApiProperty({ type: 'string', example: '450.25' })`; `share` `@ApiProperty({ type: 'number', example: 28.5 })`; `rank`/`transactionCount` numbers.
  - [x] `dtos/top-categories-response.dto.ts`: `{ categories: TopCategoryItemDto[]; totalExpense: string; currency: string }` — `@ApiProperty({ type: [TopCategoryItemDto] })`, `totalExpense` string, `currency` bare string (match existing analytics DTOs — D-4). Single export per file.

- [x] **Task 3 — API: daily-spending DTOs** (AC: 3)
  - [x] `dtos/find-daily-spending-query.dto.ts`: identical to `find-trend-query.dto.ts` (`dateFrom`/`dateTo`, `@IsOnOrAfter`).
  - [x] `dtos/daily-spending-day.dto.ts`: `{ date: string; total: string; transactionCount: number }` — `date` `@ApiProperty({ example: '2025-02-15' })`, `total` `@ApiProperty({ type: 'string', example: '45.99' })`, `transactionCount` number.
  - [x] `dtos/daily-spending-response.dto.ts`: `{ days: DailySpendingDayDto[]; totalExpense: string; currency: string }`.

- [x] **Task 4 — API: repository SQL (decimal-safe)** (AC: 1, 2, 3)
  - [x] Add `getTopCategories(query: { userId; currency; dateFrom; dateTo; limit })` — adapt the existing `getCategoryBreakdown` recursive CTE: same `category_roots` roll-up, add `COUNT(t.id)::int AS "transactionCount"`, `ORDER BY SUM(t.amount) DESC`, `LIMIT ${query.limit}`. `total`/`totalExpense` via `moneyCast()`; `share` the only `float8`; `totalExpense` = window `SUM(SUM(...)) OVER ()` (grand total, computed pre-LIMIT). Derive `rank = index + 1` in the `.map`. Inline the row generic on `this.db.execute<{…}>` (named interface fails the `Record<string, unknown>` constraint).
  - [x] Add `getDailySpending(query: { userId; currency; dateFrom; dateTo })` — adapt `getMonthlyTrend`'s `generate_series` to `interval '1 day'` over `[dateFrom, dateTo]`, LEFT JOIN expense transactions (`t.type::text = EXPENSE_TYPE`, currency, user), `COALESCE(SUM,0)` money-cast per day, `COUNT(t.id)::int` per day, `ORDER BY day ASC`; `totalExpense` = SQL sum over the range (money string). Reuse `EXPENSE_TYPE`, `moneyCast()`, `ZERO_AMOUNT`.
  - [x] *Preserve* the existing `getMonthlySummary`/`getCategoryBreakdown`/`getMonthlyTrend` methods and constants untouched.

- [x] **Task 5 — API: service wiring** (AC: 1, 3, 4)
  - [x] Add `getTopCategories(userId, query)` and `getDailySpending(userId, query)` to `analytics.service.ts`, mirroring `getCategoryBreakdown`: resolve `defaultCurrency` via the already-injected `UsersRepository.findByIdScoped(userId)`; `null` → `{ categories: [], totalExpense: ZERO_AMOUNT, currency: NO_CURRENCY }` / `{ days: [], totalExpense: ZERO_AMOUNT, currency: NO_CURRENCY }` without querying; else delegate to the repository, passing `limit: query.limit ?? TOP_CATEGORIES_DEFAULT_LIMIT` for top-categories. Reuse the existing `ZERO_AMOUNT` const and `NO_CURRENCY` import — no new injection.

- [x] **Task 6 — API: controller endpoints** (AC: 1, 3, 5)
  - [x] Add `@Get('top-categories')` (method `getTopCategories`) and `@Get('daily-spending')` (method `getDailySpending`) to `analytics.controller.ts`, copying the `getCategoryBreakdown`/`getMonthlyTrend` decorator stack (`@UseGuards(AuthGuard)`, `@Session()`, `@Query()`, `@ApiOkResponse({ type: … })`, `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse`). Add the `oxlint-disable-next-line typescript/consistent-type-imports` comment above each new query-DTO value import. *Preserve* the three existing endpoints.

- [x] **Task 7 — Regenerate the OpenAPI client** (AC: 5)
  - [x] `pnpm --filter @supertool/api build`, then `pnpm --filter @supertool/shared generate:client`. Confirm the two new `AnalyticsApiService` methods + the four new response/item DTOs appear in `packages/shared/src/generated/`. Commit the regenerated client. [Source: rules/nestjs-apis.md#DTOs-and-the-generated-OpenAPI-client; memory — sdk-service-classes-and-example-repo]

- [x] **Task 8 — API unit + DTO tests** (AC: 6)
  - [x] `find-daily-spending-query.dto.spec.ts` (mirror `find-trend-query.dto.spec.ts`): accepts `dateTo > dateFrom` and `dateTo == dateFrom`, rejects reversed window (`dateTo`) and malformed date (`dateFrom`).
  - [x] `find-top-categories-query.dto.spec.ts`: valid window + valid `limit`; `limit` below `MIN`/above `MAX` and non-integer → `limit` error; reversed window → `dateTo` error; `limit` omitted → no error (optional).
  - [x] Extend `analytics.service.spec.ts`: for both new methods — null `defaultCurrency` → empty payload without hitting the repository; non-null → delegates with resolved currency (and `limit` default applied for top-categories).
  - [x] Extend `analytics.controller.spec.ts`: both new endpoints pass `session.user.id` + query through to the service.

- [x] **Task 9 — API integration tests (decimal-safe, seeded)** (AC: 6)
  - [x] Extend `apps/api/test/integration/analytics.integration.spec.ts` with `describe('GET /analytics/top-categories')` and `describe('GET /analytics/daily-spending')`. Seed a controlled restructured hierarchy (e.g. Food → Restaurants → Fast Food) + expense/income transactions across days and currencies + a second user. Assert every AC6 point: roll-up to root, amount-descending, `limit` honored, `transactionCount`, `totalExpense === summary.expense` (decimal-safe `Decimal`), zero-day fill, range honored across a partial/multi-month window, cross-currency/user/income exclusion. Reuse `startPostgresContainer`, migrations, boot/seed helpers from `apps/api/test/helpers/`. [Source: tech-debt-integration-test-helper-dedup.md]

- [x] **Task 10 — Gates** (AC: all)
  - [x] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm fmt:check` all green (run `--force` where turbo may replay stale cache). `pnpm stylelint` and `pnpm i18n:parity` are unaffected (no SCSS, no new strings) but must stay green. [Source: memory — turbo-cache-masks-gate-results, run-tests-via-pnpm-scripts]

## Dev Notes

### What this story is (and is NOT)

- **IS:** two new `@Get` endpoints on the **existing** `analytics` module + their DTOs + two repository methods + regenerated client + unit/integration/DTO tests. The module, controller, service, `UsersRepository` injection, `NO_CURRENCY`/`ZERO_AMOUNT` handling, `moneyCast()` helper, recursive-CTE roll-up, and `generate_series` zero-fill all already exist — reuse them verbatim.
- **IS NOT:** a new module/route, a charting library, a dashboard widget, a fetch action, a page edit, an i18n key, a schema change, a new runtime dependency, a currency/type picker, or income analytics. Widgets + filter bar + visual/mobile QA are **Story 5.5**.

### Decisions (recorded per unattended-run protocol — reference-consistent unless flagged)

- **D-1 — daily-spending uses a `dateFrom`/`dateTo` range, NOT the reference's `year`+`month`.** The reference `DailySpendingQueryDto` takes `year`+`month`, which *is* the §5 defect (chart ignores the selected range). Epic 5.4 AC explicitly requires "for that exact range … not pinned to the current month — §5 defect fixed". So daily-spending mirrors supertool's own `summary`/`breakdown`/`trend` `dateFrom`/`dateTo` shape. **Deliberate reference divergence that fixes the reference bug.**
- **D-2 — daily-spending zero-fills every day via `generate_series`.** The reference `getDailyTotals` returns only days with rows; the epic AC requires "including zero days as zeros". Mirror supertool's `getMonthlyTrend` `generate_series` (day interval). Consistent with supertool's existing trend endpoint; exceeds the reference.
- **D-3 — top-categories rolls up to the top-level ancestor (recursive CTE), NOT the reference's leaf-level `categoryId` grouping.** The reference `getTopCategories` groups by the transaction's direct `categoryId` (and by `type`). Epic 5.4 AC requires "top-level roll-up where a hierarchy exists", identical to the shipped `/breakdown` (3.2). Reuse the `getCategoryBreakdown` recursive CTE. Divergence from the reference, consistent with supertool's own breakdown + Story 2.6 arbitrary-depth restructuring.
- **D-4 — response `currency` is a bare string, NOT the reference's `currencyCode` enum with `enumName`.** All three existing supertool analytics response DTOs use `currency: string` (bare `@ApiProperty({ example: 'UAH' })`). Match them for consistency and to keep the generated client uniform across the five endpoints. (The reference emits a `CurrencyCode` enum field named `currencyCode` — not adopted.) Single-default-currency model means the value is always the profile default or `NO_CURRENCY`.
- **D-5 — top-categories includes `rank` and `transactionCount`; daily-spending includes `transactionCount`.** The reference carries both counts and rank; the 5.4 AC names amounts + share for top-categories, but `rank`/`transactionCount` are cheap, reference-parity, and feed 5.5's widget (and align with 5.6's "totals/counts the reference omits"). Counts are integers (`number`), never money — D1 unaffected. `rank` is derived in JS from the guaranteed `ORDER BY` order (`index + 1`), not a SQL window, to keep the query minimal.
- **D-6 (FLAG for operator) — daily-spending is expense-only in 5.4; no `type` param.** Epic 5.4 AC frames daily-spending as "per-day **expense** totals", so 5.4 hardcodes `type = 'expense'`. Story 5.5's dashboard filter bar has a transaction-type toggle; **if** that toggle must re-scope daily-spending to income, 5.5 will add an optional `type` param then (the reference already models an optional `type`). Kept out of 5.4 to respect scope; called out so 5.5 planning decides deliberately.
- **D-7 — `top-categories` share of the grand total (all categories), not of the returned top-N.** `totalExpense` and `share` are computed via `SUM(...) OVER ()` before `LIMIT`, so `totalExpense === summary.expense` and shares are meaningful even when the list is truncated. Matches `/breakdown` semantics.

### D1 — money is strings end-to-end (merge-blocking)

Postgres `numeric(14,2)`; every money value is a string produced by SQL cast `::numeric(14,2)::text` — `total` (per item/day) and `totalExpense` are strings. **The only numbers in the responses are `share` (display %), `rank`, and `transactionCount`** — none are money. Never `SUM` or arithmetic money in JS; `totalExpense` comes from SQL so it reconciles exactly with the summary's `expense` (AC2/AC3/AC6). [Source: CLAUDE.md hard rule 1; architecture.md#D1; 3-2 Dev Notes]

### Currency model — do NOT reintroduce a picker (RP-D1)

Figures are always in `users.defaultCurrency`. No `currencyCode` query param, no selector, no most-frequent fallback, no cross-currency aggregation. Scope both WHERE clauses to the one default currency; `null` default → empty payload + `NO_CURRENCY`, no query. [Source: epics.md Epic 5; addendum.md#Currency-handling; RP-D1; 3-1/3-2/3-3 Dev Notes]

### Architecture compliance (guardrails)

- **Layering (D7):** controller → service → repository. Both queries live in `analytics.repository.ts` only; no Drizzle in service/controller.
- **Generated client only (NFR6):** 5.5 will read these endpoints exclusively through `AnalyticsApiService` from `packages/shared/src/generated/`. This story just regenerates + commits the client and drift-gates it; a hand-written `fetch('/api/...')` anywhere is a defect.
- **API conventions:** `/api/v1/...`, camelCase JSON, errors `{ statusCode, code, message, details? }`, auth via `@UseGuards(AuthGuard)` + `@Session()`, offset conventions unchanged. DTO validation via class-validator; `@Query` paramtypes need runtime value imports (the `oxlint-disable` comment pattern already in the controller).
- **Dates:** `date` is a `date` column / `YYYY-MM-DD` string — no timezone math (RP-D5, bare `date`). Ranges arrive as two `YYYY-MM-DD` strings; `generate_series` casts them `::date`. Day-granularity buckets match the stored granularity.
- **DI (merge-blocking):** explicit `@Inject(ClassName)`; never `import type` an injectable (SWC erases it → DI breaks under Vitest). The service already injects `AnalyticsRepository` + `UsersRepository`; reuse them. [Source: memory — nest-di-explicit-inject]
- **TS/enum rules:** no `as` in prod code, no enums (derive from `pgEnum` — `transactionTypeEnum.enumValues` gives `EXPENSE_TYPE`, already destructured in the repository), one export per file, no barrels. Counts cast `::int` in SQL so they arrive as JS numbers.

### Source tree — files to touch

**Shared (NEW):**
- `packages/shared/src/constants/analytics.ts`

**API (NEW):**
- `apps/api/src/modules/analytics/dtos/find-top-categories-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/top-category-item.dto.ts`
- `apps/api/src/modules/analytics/dtos/top-categories-response.dto.ts`
- `apps/api/src/modules/analytics/dtos/find-daily-spending-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/daily-spending-day.dto.ts`
- `apps/api/src/modules/analytics/dtos/daily-spending-response.dto.ts`
- `apps/api/src/modules/analytics/dtos/find-daily-spending-query.dto.spec.ts`
- `apps/api/src/modules/analytics/dtos/find-top-categories-query.dto.spec.ts`

**API (UPDATE):**
- `apps/api/src/modules/analytics/analytics.repository.ts` — *current state:* `getMonthlySummary` + `getCategoryBreakdown` (recursive CTE + `moneyCast()`) + `getMonthlyTrend` (`generate_series` months). Add `getTopCategories` (roll-up CTE + limit + count) and `getDailySpending` (`generate_series` days). *Preserve* the three existing methods, `moneyCast()`, `ZERO_AMOUNT`, and the `INCOME_TYPE`/`EXPENSE_TYPE` destructure.
- `apps/api/src/modules/analytics/analytics.service.ts` — *current state:* three methods, `NO_CURRENCY`/`ZERO_AMOUNT` handling, two injected repositories. Add `getTopCategories` + `getDailySpending`. *Preserve* the existing methods/injections.
- `apps/api/src/modules/analytics/analytics.controller.ts` — *current state:* `@Get('summary')`/`@Get('breakdown')`/`@Get('trend')`. Add `@Get('top-categories')` + `@Get('daily-spending')` alongside. *Preserve* the three existing endpoints + their `oxlint-disable` import comments.
- `apps/api/src/modules/analytics/analytics.service.spec.ts`, `analytics.controller.spec.ts` — extend.
- `apps/api/test/integration/analytics.integration.spec.ts` — extend with two describe blocks.
- `apps/api/openapi.json` — regenerated (not hand-edited).
- `packages/shared/src/generated/**` — regenerated (not hand-edited).

### Reference patterns (study before implementing — `example/tracker-backend-api`, reference-only ED1)

- `example/tracker-backend-api/src/modules/transactions-analytics/transactions-analytics.repository.ts` — `getTopCategories` (leaf grouping + limit + count) and `getDailyTotals` (day bucket). **Adapt the shape** (limit, count, day bucket) but apply supertool's roll-up CTE (D-3), `generate_series` zero-fill (D-2), range query (D-1), single-currency scoping (D-4), and `numeric::text` casting.
- `example/tracker-backend-api/src/modules/transactions-analytics/dtos/top-categories-*.dto.ts`, `daily-spending-*.dto.ts` — DTO field shape (rank/percentage→share/transactionCount/date/total) to adapt to supertool naming + bare-string currency.
- **Adapt, never copy (ED1).** Drop `currencyCode`/`type` params, the `formatAmount` JS money-formatting helper (supertool does money math in SQL), the `enumName` currency field, and the leaf grouping.

### Local patterns to reuse (do NOT reinvent)

- **Analytics module (3.1–3.3):** `apps/api/src/modules/analytics/{controller,service,repository}.ts` + `dtos/` — the two new endpoints are direct siblings of `breakdown`/`trend`; copy their structure, decorators, casting helpers, and `NO_CURRENCY` short-circuit.
- **Recursive roll-up CTE:** `analytics.repository.ts` `getCategoryBreakdown` (lines ~73-122) — the exact template for `getTopCategories`. CTE origin: `transactions.repository.ts` `getCategorySubtreeIds` (~line 263).
- **`generate_series` zero-fill:** `analytics.repository.ts` `getMonthlyTrend` (lines ~124-150) — the template for `getDailySpending` (swap month interval → day, add expense filter + count).
- **Query DTO + `IsOnOrAfter`:** `dtos/find-trend-query.dto.ts` + `apps/api/src/shared/validators/is-on-or-after.decorator.ts`; DTO spec pattern `dtos/find-trend-query.dto.spec.ts`.
- **Shared constants:** `NO_CURRENCY` in `@supertool/shared/constants/currency`; `CALENDAR_DATE_PATTERN` in `@supertool/shared/constants/transaction-validation`; new `analytics.ts` for limit bounds. [Source: memory — shared-constants-no-duplication]
- **Test helpers:** `apps/api/test/helpers/{postgres-container,…}`; `Decimal` (decimal.js) for exact money assertions; the existing `analytics.integration.spec.ts` seeding/window helpers (`MonthWindow`, `SEED_CURRENCY`, `FOREIGN_CURRENCY`, `EMPTY_MONTH`, `OTHER_USER_EXPENSE`).

### Coding conventions (merge-blocking subset)

- No comments — self-documenting names; follow-up work goes in story/epic files, never code TODOs.
- Arrow functions; `get`/`fetch`/`check`/`format`/`parse` prefixes; array vars carry `list` suffix (note: DTO fields `categories`/`days` mirror the reference/response contract — plural response arrays are the API shape, not local `list` variables); `UPPER_SNAKE_CASE` constants.
- TS: interfaces over types; NO enums (`as const` + `ObjectValuesUnion`); no `as` in prod code (narrow with `checkIs*`); single source of truth for value sets (`transactionTypeEnum.enumValues`).
- One export per file; named exports; no barrels.
- Files/dirs kebab-case; specs co-located `*.spec.ts`.
- Tests ship in the SAME story as the feature (NFR1).
- Exact dependency versions (no `^`/`~`); never introduce eslint/prettier. **No new dependency expected** for this story.

### Testing standards

- API: Vitest (SWC decorators) for unit + DTO specs; Testcontainers against real Postgres for integration. Given-When-Then for module acceptance; Arrange-Act-Assert for units; `inputX`/`mockX`/`actualX`/`expectedX` naming.
- Money assertions compare exact strings; `totalExpense` for both endpoints must reconcile **exactly** with the summary's `expense` over the same period/range — assert no float drift with `Decimal` (FR18 — the marquee correctness test).
- daily-spending: assert the **range is honored** (a partial or multi-month window returns exactly that window's days, zero-filled) — the explicit §5-defect regression guard.
- No frontend tests, no visual QA, no i18n parity additions in this story (no UI, no strings) — Story 5.5 owns those. State this N/A explicitly in the Dev Agent Record so the reviewer does not flag a missing visual-QA gate.

### Previous-work intelligence

- **Story 3.2 (Breakdown)** built the recursive-CTE top-level roll-up (decimal-safe, `share` window fn, `totalExpense` = `SUM(SUM) OVER ()`) — `getTopCategories` is that method + `limit` + `count` + `rank`. Its Debug Log warns: inline the `db.execute<{…}>` row generic (named interface fails `Record<string, unknown>`); watch `max-statements` (extract seed-fixture helpers in the integration spec).
- **Story 3.3 (Trend)** built the `generate_series` zero-fill — `getDailySpending` is that pattern at day granularity + expense filter + count.
- **Story 3.1 (Summary)** established `NO_CURRENCY`/`ZERO_AMOUNT` handling, the `UsersRepository.findByIdScoped` currency resolution, and the seed operator `defaultCurrency = UAH` backfill — both new endpoints reuse all of it.
- **Story 5.1 (Import endpoint)** is the most recent backend work: same D1/D7/NFR6 discipline, same regen-client-and-drift-gate flow, same "counts are numbers, money is strings" rule.
- **Epic 2 retro (2026-06-15) + RP-D1** settled single-default-currency; AC4 + cross-currency exclusion tests guard it.
- **§5 reference defect** "daily-spending ignores selected range" — AC3 + the range-honoring integration test (i) are the explicit exceed-the-reference guard (D-1).
- **Tech-debt (done):** integration test helpers consolidated in `apps/api/test/helpers/` — import, don't redefine.

### Git intelligence (recent commits)

`a5355c3` HEAD (5-3 status ride) · `30d1da9` 5-2 standalone import page · `e5fb03c` 5-1 import endpoints · `586cfd7` epic-4 retro · `cea3501` 4-3 first-run auto-fit. Pattern: each analytics story adds endpoint(s) to the `analytics` module + co-located tests, then regenerates the client; the recursive-CTE and `generate_series` precedents already exist in `analytics.repository.ts`.

### Project Structure Notes

- Aligns with `architecture.md` component tree: `modules/analytics` gains `top-categories` + `daily-spending` alongside summary/breakdown/trend. No new module, no `currency-filter` (removed 2026-06-15).
- Dependency direction respected: `packages/shared` (limit constants, `NO_CURRENCY`) is consumed by the API; the regenerated client lands in `packages/shared/src/generated/` for 5.5 to consume. No `@supertool/ui` or app changes in this story.
- No schema change (RP-D5 bare `date`; existing `transactions`/`transaction_categories` tables).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.4-Dashboard-Analytics-Endpoints-Top-Categories-Daily-Spending]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-5-Import-Your-Data-and-See-Your-Money] · [#RP-B2] · [#Reference-defects-§5 daily-spending ignores range] · [#RP-D1 currency] · [#RP-D5 bare date]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#FR14,FR15,FR18,FR21] · [addendum.md#Currency-handling-superseded-2026-06-15]
- [Source: _bmad-output/planning-artifacts/architecture.md#D1-Money] · [#D7-REST-conventions] · [#component-tree modules/analytics] · [#read-path]
- [Source: CLAUDE.md#Hard-rules] · [.claude/rules/nestjs-apis.md] · [.claude/rules/typescript.md] · [.claude/rules/javascript.md]
- [Source: _bmad-output/implementation-artifacts/3-2-expense-breakdown-by-category.md — recursive-CTE roll-up + decimal-safe reconciliation]
- [Source: _bmad-output/implementation-artifacts/3-3-twelve-month-trend.md — generate_series zero-fill]
- [Source: _bmad-output/implementation-artifacts/5-1-transaction-import-endpoint.md — Epic 5 backend discipline, regen/drift-gate flow]
- [Source: apps/api/src/modules/analytics/* — summary/breakdown/trend controller/service/repository/dto template]
- [Source: apps/api/src/modules/transactions/transactions.repository.ts — getCategorySubtreeIds (~line 263), recursive-CTE precedent]
- [Source: apps/api/test/integration/analytics.integration.spec.ts — integration seeding + window helpers]
- [Source: example/tracker-backend-api/src/modules/transactions-analytics/{transactions-analytics.repository.ts,dtos/top-categories-*.dto.ts,dtos/daily-spending-*.dto.ts} — reference shape to adapt, ED1]
- [Source: _bmad-output/implementation-artifacts/tech-debt-integration-test-helper-dedup.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]` — via bmad-dev-story

### Debug Log References

- **Lint `no-magic-numbers` in the integration spec.** `no-magic-numbers` (`ignore: [0,1]`, `ignoreArrayIndexes`) does NOT check object-property values (so `limit: 5` / `transactionCount: 2` inside object literals are fine) but DOES flag array elements and function arguments. `[1, 2]` (expected rank list) and `.at(-1)` were flagged. Resolved by deriving the expected rank list via `Array.from({ length: TOP_CATEGORIES_ROW_COUNT }, (_unused, index) => index + 1)` and replacing `.at(-1)` with `days[days.length - LAST_INDEX_OFFSET]`.
- **Lint `max-statements` in `analytics.service.spec.ts`.** The outer `describe('AnalyticsService')` callback caps at 10 statements; adding 5 `it`s pushed it to 12. Resolved by nesting the five new cases inside a `describe('top categories and daily spending', ...)` block (outer callback back to 8 statements) — no test logic changed.
- **OpenAPI drift gate.** After adding DTOs, `pnpm --filter @supertool/api build` re-emitted `openapi.json` and `pnpm --filter @supertool/shared generate:client` regenerated the client. Verified determinism: staging the working tree then regenerating produced an empty `git diff` — no drift. `AnalyticsApiService.analyticsGetTopCategories`/`analyticsGetDailySpending` and `TopCategoriesResponseDto`/`TopCategoryItemDto`/`DailySpendingResponseDto`/`DailySpendingDayDto` all present in `packages/shared/src/generated/`.
- **Shared constant build ordering.** `@supertool/shared/constants/analytics` resolves to `dist/constants/analytics.js` via the package `./*` exports map, so the shared package was built (`pnpm --filter @supertool/shared build`) before the API could type-check/test against the new constant.

### Completion Notes List

- Implemented two new backend-only analytics endpoints on the existing `analytics` module — `GET /api/v1/analytics/top-categories` and `GET /api/v1/analytics/daily-spending` — as direct siblings of `/breakdown` and `/trend`. No new module, no frontend, no i18n strings, no schema change, no new dependency.
- **D1 (money is strings) upheld:** every monetary value (`total` per item/day, `totalExpense`) is produced by SQL `::numeric(14,2)::text` and never summed in JS. The only numbers in the responses are `share` (display %, `::float8`), `rank` (JS `index + 1`), and `transactionCount` (`COUNT(t.id)::int`). Decimal-safe reconciliation (`totalExpense === summary.expense`, `Decimal`) asserted in integration tests for both endpoints.
- **top-categories** reuses the `getCategoryBreakdown` recursive `category_roots` CTE (D-3 top-level roll-up), adds `COUNT(t.id)::int`, `ORDER BY SUM(t.amount) DESC`, `LIMIT`, `totalExpense`/`share` from `SUM(SUM(...)) OVER ()` computed pre-LIMIT (D-7), and derives `rank` in the `.map`.
- **daily-spending** reuses the `getMonthlyTrend` `generate_series` zero-fill at `interval '1 day'` over the caller-supplied `[dateFrom, dateTo]` (D-1 range, NOT month-pinned — fixes reference §5 defect), expense-only (D-6), with per-day `COUNT` and range grand-total. The §5 regression is guarded by an integration test using a partial multi-month window (2031-01-30 → 2031-02-03) that also proves a same-month out-of-window transaction (2031-01-15) is excluded.
- **Currency model (RP-D1):** both endpoints scope to `users.defaultCurrency`; `null` default returns the empty payload with `currency: NO_CURRENCY` and `totalExpense: '0.00'` without querying (AC4). No `currencyCode` query param, no picker, no cross-currency aggregation. Response `currency` is a bare string matching the three existing analytics DTOs (D-4).
- **Layering & DI intact:** all SQL lives in `analytics.repository.ts`; the service reuses the already-injected `AnalyticsRepository` + `UsersRepository` (explicit `@Inject`, no new injection, no `import type` on injectables); controller copies the existing decorator stack with the `oxlint-disable` runtime-import comments on the two new query DTOs.
- **Decision recorded (unattended protocol):** story decisions D-1…D-7 were pre-settled and followed verbatim; no new decisions were required. Minor implementation choices — nesting the new service specs to satisfy `max-statements`, deriving the rank list and dropping `.at(-1)` to satisfy `no-magic-numbers` — are lint-conformance refactors with no behavioural effect.
- **Visual QA: N/A.** This is a backend-only story (endpoints + DTOs + SQL + client + tests); it touches no `packages/ui`/`packages/shell` UI or styles and adds no user-facing strings, so no Storybook screenshots or i18n-parity additions apply. Story 5.5 owns the widgets and their visual QA. `pnpm stylelint` and `pnpm i18n:parity` were run and stay green.
- **Gates (all green, run with `TURBO_FORCE=true` where turbo-backed):** `pnpm type-check` ✓, `pnpm lint` ✓, `pnpm stylelint` ✓, `pnpm fmt:check` ✓, `pnpm test` ✓ (API 262, money-tracker 238, ui 77, shell 27, widgets 9, next-shared 10, shared 7 — all pass; analytics integration spec 27 tests incl. the new top-categories + daily-spending blocks), `pnpm i18n:parity` ✓, `pnpm build` ✓, OpenAPI drift ✓ (deterministic regeneration, empty diff).

### File List

**Shared (NEW):**
- `packages/shared/src/constants/analytics.ts`

**API DTOs (NEW):**
- `apps/api/src/modules/analytics/dtos/find-top-categories-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/top-category-item.dto.ts`
- `apps/api/src/modules/analytics/dtos/top-categories-response.dto.ts`
- `apps/api/src/modules/analytics/dtos/find-daily-spending-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/daily-spending-day.dto.ts`
- `apps/api/src/modules/analytics/dtos/daily-spending-response.dto.ts`

**API tests (NEW):**
- `apps/api/src/modules/analytics/dtos/find-top-categories-query.dto.spec.ts`
- `apps/api/src/modules/analytics/dtos/find-daily-spending-query.dto.spec.ts`

**API (UPDATED):**
- `apps/api/src/modules/analytics/analytics.repository.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.service.spec.ts`
- `apps/api/src/modules/analytics/analytics.controller.spec.ts`
- `apps/api/test/integration/analytics.integration.spec.ts`
- `apps/api/openapi.json` (regenerated)

**Generated client (UPDATED — regenerated, not hand-edited):**
- `packages/shared/src/generated/index.ts`
- `packages/shared/src/generated/sdk.gen.ts`
- `packages/shared/src/generated/types.gen.ts`

**BMad tracking (UPDATED):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (5-4 → review)
- `_bmad-output/implementation-artifacts/5-4-dashboard-analytics-endpoints-top-categories-daily-spending.md`

### Change Log

- 2026-07-05 — Implemented Story 5.4: added `top-categories` and `daily-spending` analytics endpoints (controller + service + repository SQL), 6 new DTOs, 1 shared limit-constants module, DTO/unit/controller/integration tests, and regenerated the OpenAPI client. All gates green. Status → review.
