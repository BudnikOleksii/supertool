---
baseline_commit: d753efd
---

# Story 3.3: Twelve-Month Trend

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want a month-over-month income/expense view across the trailing 12 months,
so that I can see the direction my finances are moving (FR16).

This is the **third and final story of Epic 3 (Dashboard & Stats)**. It extends the existing `analytics` API module (created by 3.1, extended by 3.2) with a **trend** endpoint and adds a third widget to the existing `/dashboard` page. **It is the charting story** — 3.1 and 3.2 deliberately deferred charts to here. It introduces the **first charting dependency** (`recharts`), which must be recorded per the architecture's new-dependency rule. Like every dashboard figure, it is scoped to the user's profile-default currency (no picker). **No new module, no new route.**

## Acceptance Criteria

> **Currency model (settled 2026-06-15, Epic 2 retro — same as 3.1/3.2):** figures are ALWAYS in the user's profile-default currency (FR5). There is **no currency picker**, **no most-frequent fallback**, **no cross-currency aggregation**. The trend is computed per-currency in SQL (scoped to the one default currency). [Source: epics.md#Story-3.3; prds/.../prd.md#FR5,FR14,FR16; addendum.md#Currency-handling]

1. **(AC1) Trend endpoint — 12 monthly buckets, zero months filled, SQL aggregation, string amounts (D1).** The `analytics` module exposes `GET /api/v1/analytics/trend` taking the trailing-12-month window as `dateFrom`/`dateTo` (`YYYY-MM-DD`, same DTO shape as summary). It returns **exactly 12 monthly rows** — one per calendar month in the window, **in ascending chronological order** — each with `{ month: 'YYYY-MM'; income: string; expense: string }`. Months with **no transactions appear as zeros** (`'0.00'`), produced by a Postgres `generate_series` over months LEFT JOINed to transactions. Income and expense are computed entirely as Postgres `numeric` aggregation cast `::numeric(14,2)::text` — never `number`, never JS float math (D1). Response is user-scoped (`session.user.id`) and scoped to the profile-default currency. Consumed via the regenerated client (`AnalyticsApiService`), never hand-written fetch (NFR6).

2. **(AC2) Trend window honors the selected period.** The 12-month window is the **selected month and the 11 months preceding it** (window ends at the `period` URL param, same param that drives the summary and breakdown). Stepping the month moves all three widgets together. The frontend computes the window (`dateFrom` = first day of the month 11 months before the anchor; `dateTo` = last day of the anchor month) and passes the two `YYYY-MM-DD` strings — no timezone math (dates are `date` columns / `YYYY-MM-DD` strings). [Decision: see Resolved Decisions; trailing-12-ending-at-selected-period keeps all three dashboard widgets coherent for one `period`.]

3. **(AC3) Trend renders as a month-by-month income-vs-expense chart.** On the dashboard, below the breakdown, the trend renders as a **grouped bar chart** (income bar + expense bar per month) across the 12 months using `recharts`. Month labels are localized via `Intl.DateTimeFormat` in **both** locales (e.g. `Feb 25` / `лют. 25`) built from the `YYYY-MM` parts — never `new Date('YYYY-MM-01')` (TZ-shift anti-pattern), never string concatenation. Income/expense series colors come from **M3 design tokens** (no hardcoded hex), legible in **both themes** (axis ticks, legend, tooltip all themed). A localized empty state renders when `currency === NO_CURRENCY` or the entire window is zero (no income and no expense across all 12 months), in both locales.

4. **(AC4) New charting dependency recorded (architecture new-dependency rule).** `recharts` is added to `apps/money-tracker/package.json` at an **exact version** (no `^`/`~`) — newest stable `3.8.1` (verified against the npm registry 2026-06-16; supports React 19). The dependency is **recorded in `architecture.md`** (the Technical Stack / new-dependency note) per Enforcement rule 6 and "Pattern changes happen by editing this document first, code second." `recharts` lives in the **app** (`apps/money-tracker`), NOT in `packages/ui` (matches the reference and the architecture component tree's app-level `trend-chart/`). The chart-rendering code is a `'use client'` component loaded via `next/dynamic` so `recharts` stays out of the server bundle.

5. **(AC5) Per-month decimal-safe integration tests against seeded data, including the window boundary.** Testcontainers integration tests assert: (a) each of the 12 monthly `income`/`expense` figures matches independently computed expected strings **exactly** — no float drift (FR18); (b) a month with **no transactions inside the window returns `'0.00'`/`'0.00'`** and still appears (the zero-month / `generate_series` correctness — the marquee test); (c) exactly 12 rows, ascending chronological order; (d) cross-currency transactions are excluded; (e) cross-user transactions are excluded; (f) a transaction **just outside** the window (the month before `dateFrom`) does NOT appear. Reuses the shared helpers in `apps/api/test/helpers/`.

6. **(AC6) Loading + responsive + both locales.** A skeleton shows during load (the trend widget has its own `<Suspense>` boundary, independent of summary and breakdown); the chart is usable on mobile (NFR8 — `recharts` `ResponsiveContainer`); all new strings localized in **both** `en` and `uk` (FR19/FR20 — same commit, CI key-parity gate).

7. **(AC7) Visual QA evidence recorded (lesson from 1.4/1.8).** Screenshots of the rendered trend chart in **both themes** (light + dark), at desktop and mobile widths, plus the empty state, with bars + axis labels + legend + tooltip visible and legible in dark mode. Evidence recorded in the Dev Agent Record. Green gates + green axe are NOT sufficient — an actual look at the rendered output is mandatory, with **special attention to dark-theme chart legibility** (axis ticks, tooltip background, legend text) — this is exactly the class of defect visual QA exists to catch. [Source: memory — ui-stories-need-visual-qa; visual-qa-via-playwright-cli]

## Tasks / Subtasks

- [x] **Task 1 — Add the `recharts` dependency + record it (architecture rule)** (AC: 4)
  - [x] Add `"recharts": "3.8.1"` to `apps/money-tracker/package.json` `dependencies` (EXACT version, no `^`/`~` — hard rule 6). Run `pnpm install`. If pnpm reports a missing `react-is` peer, add `react-is` at the exact version pnpm resolves for it (recharts peer).
  - [x] **Record the new dependency in `architecture.md`** BEFORE writing chart code: add `recharts 3.8.1` to the Technical Stack / dependency notes (the doc is the source of truth — "this document first, code second"; Enforcement rule 6; epics.md line 698 "any charting dependency introduced is recorded per the architecture's new-dependency rule"). One-line note: app-level dashboard charting, exact version, React 19 compatible.
  - [x] Confirm `recharts` is app-level only — do NOT add it to `packages/ui` (framework-pure design-system primitives have no charting awareness; the architecture tree places `trend-chart/` under the app's dashboard components). [Source: architecture.md#component-tree line 348, F4 mapping line 376; memory — new-deps-newest-stable]
- [x] **Task 2 — API: trend DTOs** (AC: 1)
  - [x] `dtos/find-trend-query.dto.ts`: identical shape to `find-summary-query.dto.ts` (`dateFrom`/`dateTo` as `YYYY-MM-DD`, `@IsString()` + `@Matches(CALENDAR_DATE_PATTERN)`). No `type`, no `granularity` (the window is always 12 monthly buckets).
  - [x] `dtos/trend-month.dto.ts`: `{ month: string; income: string; expense: string }`. `month` is `'YYYY-MM'` — `@ApiProperty({ example: '2025-02' })`. `income`/`expense` are **money strings** — `@ApiProperty({ type: 'string', example: '1234.56' })`. Single export per file; no barrels.
  - [x] `dtos/trend-response.dto.ts`: `{ trend: TrendMonthDto[]; currency: string }`. `@ApiProperty({ type: [TrendMonthDto] })` for the array. Single export per file.
- [x] **Task 3 — API: repository SQL aggregation with zero-month fill (decimal-safe)** (AC: 1, 5)
  - [x] Add `getMonthlyTrend(query: { userId; currency; dateFrom; dateTo })` to `analytics.repository.ts`. Use `generate_series` over months LEFT JOINed to transactions so **every month in the window appears, zero or not**. Reuse the `MONEY_PRECISION`/`MONEY_SCALE`/`moneyCast()` helpers + `[INCOME_TYPE, EXPENSE_TYPE]` already in the file. Pattern:
    ```sql
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', ${query.dateFrom}::date),
        date_trunc('month', ${query.dateTo}::date),
        interval '1 month'
      )::date AS month_start
    )
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS month,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type::text = ${INCOME_TYPE}), 0)::numeric(14,2)::text  AS income,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type::text = ${EXPENSE_TYPE}), 0)::numeric(14,2)::text AS expense
    FROM months m
    LEFT JOIN transactions t
      ON date_trunc('month', t.date)::date = m.month_start
      AND t.user_id = ${query.userId}
      AND t.currency = ${query.currency}
    GROUP BY m.month_start
    ORDER BY m.month_start ASC
    ```
    - **CRITICAL: the user/currency filters belong in the LEFT JOIN `ON` clause, NOT a `WHERE` clause.** A `WHERE t.user_id = ...` would convert the LEFT JOIN to an inner join and drop the zero months — defeating AC1/AC5b. Keep `months` as the driving table.
    - Use the `${transactions...}`-style column refs / `sql.raw(String(...))` precision casting style already in `getMonthlySummary` for consistency (or inline `::numeric(14,2)::text` via `moneyCast()` as `getCategoryBreakdown` does — match the file's existing style).
    - **D1:** income/expense are produced by Postgres `numeric` arithmetic cast `::numeric(14,2)::text` — never summed in JS. `COALESCE(..., 0)` makes zero months `'0.00'`.
  - [x] Use the parameterized `this.db.execute<{ month: string; income: string; expense: string }>(sql\`...\`)` form (inline the row generic — a named interface won't satisfy the `Record<string, unknown>` constraint; this bit 3.2, see its Debug Log). Map `result.rows` straight through to `{ trend: rows, currency: query.currency }`.
- [x] **Task 4 — API: service wiring** (AC: 1)
  - [x] Add `getMonthlyTrend(userId, query)` to `analytics.service.ts`. Resolve `defaultCurrency` via the already-injected `UsersRepository.findByIdScoped(userId)` (reuse — do NOT add a second injection). If `defaultCurrency` is null → return `{ trend: [], currency: NO_CURRENCY }` without querying (mirror the summary/breakdown null short-circuit). Reuse the existing `NO_CURRENCY` import.
- [x] **Task 5 — API: controller endpoint** (AC: 1)
  - [x] Add `@Get('trend')` to `analytics.controller.ts`, mirroring `getCategoryBreakdown` exactly: `@UseGuards(AuthGuard)`, `@Session() session`, `@Query() query: FindTrendQueryDto`, `@ApiOkResponse({ type: TrendResponseDto })`, `@ApiUnauthorizedResponse`, `@ApiBadRequestResponse`. Add the `oxlint-disable-next-line typescript/consistent-type-imports` comment on the `FindTrendQueryDto` value import (the `@Query` paramtype metadata needs the runtime import — same as the existing two query DTO imports).
- [x] **Task 6 — Regenerate the OpenAPI client** (AC: 1)
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`), then `pnpm --filter @supertool/shared generate:client`. Confirm `AnalyticsApiService.analyticsGetMonthlyTrend` (or the by-tags name the generator emits) + `TrendResponseDto` + `TrendMonthDto` appear in `packages/shared/src/generated/`. Commit the regenerated client. [Source: rules/nestjs-apis.md#DTOs-and-the-generated-OpenAPI-client; memory — sdk-service-classes-and-example-repo]
- [x] **Task 7 — Frontend: trailing-12-month window util** (AC: 2)
  - [x] Add `getTrailingMonthsRange(anchor: PeriodParts, monthCount: number): MonthDateRange` to `apps/money-tracker/src/utils/period.ts`. It returns `dateFrom` = first day of the month `(monthCount - 1)` before `anchor`, `dateTo` = last day of `anchor` (reuse the existing `getMonthDateRange` for the anchor's `dateTo`, and step back with the existing month arithmetic — do NOT use raw `Date` month math that risks day-overflow; build from `{year, month}` parts like the existing helpers). Add `getTrailingMonthsRange` unit tests to `period.test.ts` covering a same-year window, a year-boundary-crossing window (e.g. anchor `2025-03` → `dateFrom = 2024-04-01`), and `monthCount = 12`.
- [x] **Task 8 — Frontend: fetch action** (AC: 1, 3)
  - [x] Create `apps/money-tracker/src/actions/fetch-monthly-trend.ts` — **mirror `fetch-category-breakdown.ts` exactly**: `cache()`-wrapped plain async (NOT `'use server'` — reads are importable by RSCs), forward cookies via `createServerApiClient({ cookieHeader })`, call `AnalyticsApiService.analyticsGetMonthlyTrend`, return `{ status: 'success'; trend } | { status: 'error' }`. NEVER hand-write fetch (NFR6).
- [x] **Task 9 — Frontend: trend widget (server shell + client chart)** (AC: 3, 6)
  - [x] Create `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrend.tsx` (async RSC). Props `{ period: string; locale: string }` — identical to `DashboardBreakdown`/`DashboardSummary`. Compute the window via `getTrailingMonthsRange(parsePeriod(period), 12)`, call `fetchMonthlyTrend`, render inside `@supertool/ui` `Card`/`CardContent` with a `Typography variant="title-s"` title. Build the localized month label for each row from the `YYYY-MM` string via `Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' })` using `new Date(year, monthIndex, 1)` (parse the parts — NEVER `new Date('YYYY-MM-01')`, the TZ-shift anti-pattern). Map to `{ label, income: Number(...), expense: Number(...) }` for the chart (numbers are presentation-only here, exactly like `share` in 3.2 — the money strings stay strings up to the chart boundary; the chart axis is not money-of-record).
  - [x] Create `dashboard-trend/DashboardTrendContent.tsx` — a **`'use client'`** component that renders the `recharts` chart. Load it from `DashboardTrend.tsx` via `next/dynamic(() => import('./DashboardTrendContent').then((m) => m.DashboardTrendContent), { loading: () => null })` (mirror the reference `TrendsChart`/`TrendsChartContent` split). Chart: `ResponsiveContainer` (width `100%`, fixed height) → `BarChart` with `XAxis dataKey="label"`, `YAxis`, `Tooltip`, `Legend`, and two `<Bar>` (income, expense). **Colors from M3 tokens, both themes** — see Dev Notes "Chart colors must be M3 tokens" for the exact approach (read tokens on the client via `getComputedStyle`, re-read on theme change via `next-themes useTheme()`); also theme axis ticks/tooltip/legend so dark mode is legible. Pass localized series names (`translate('trend.income')`, `trend.expense`) and tooltip currency formatting in from props. `FC<Props>` typing.
  - [x] Error state (`result.status === 'error'`) and empty state (`currency === NO_CURRENCY` OR every month's income and expense are `'0.00'`): render the localized message in a `Card`/`CardContent`, mirroring `DashboardBreakdown`'s `error`/`empty` blocks. Import `NO_CURRENCY` from `@supertool/shared/constants/currency`.
  - [x] Skeleton: `dashboard-trend-skeleton/DashboardTrendSkeleton.tsx` using `@supertool/ui` `Skeleton` (mirror `DashboardBreakdownSkeleton`) — a chart-shaped placeholder block.
  - [x] PascalCase component files + co-located `.module.scss`/`.test.tsx`; dirs kebab-case.
- [x] **Task 10 — Frontend: mount the widget on the dashboard page** (AC: 3, 6)
  - [x] Edit `apps/money-tracker/src/app/[locale]/dashboard/page.tsx`: add a **third** `<Suspense key={\`trend-${period}\`} fallback={<DashboardTrendSkeleton />}>` wrapping `<DashboardTrend period={period} locale={locale} />`, placed **below** the existing breakdown Suspense. Keep the summary + breakdown blocks, header, and `MonthStepper` untouched — the trend shares the same `period`. *Preserve* the existing page structure; only add.
- [x] **Task 11 — Frontend: i18n (both locales, same commit)** (AC: 3, 6)
  - [x] Extend the existing `apps/money-tracker/messages/en/dashboard-page.json` AND `uk/dashboard-page.json` (the `dashboardPage` namespace already exists — do NOT add a new namespace). Add a `trend` block: `title`, `income` (legend/series label), `expense`, `empty.title`/`empty.description`, `error.title`/`error.description`. Identical key sets in both files. Use `translate` (next-intl), ICU interpolation only — no concatenation. CI key-parity gate fails on divergence (FR20). [Source: memory — follow-example-repo-patterns split i18n]
- [x] **Task 12 — API integration + unit tests** (AC: 5)
  - [x] `apps/api/test/integration/analytics.integration.spec.ts` (extend the existing file): add a `describe('GET /analytics/trend')`. Seed transactions across several months inside a known 12-month window (income + expense), **leave at least one month inside the window empty**, and seed one transaction in the month **just before `dateFrom`** (must be excluded). Assert: (a) exactly 12 rows, ascending chronological; (b) each month's `income`/`expense` matches independently computed expected strings exactly (decimal-safe — reuse the `decimal-safe-sums` helper); (c) the empty in-window month is `'0.00'`/`'0.00'` and present; (d) the out-of-window transaction is excluded; (e) a different-currency transaction is excluded; (f) a second user's transaction is excluded. Reuse `startPostgresContainer`, `runMigrations`, boot/seed helpers from `apps/api/test/helpers/` — do NOT redefine container/migration logic. [Source: tech-debt-integration-test-helper-dedup.md]
  - [x] Service unit spec: extend `analytics.service.spec.ts` — null `defaultCurrency` → empty trend without hitting the repository; non-null → delegates to the repository with the resolved currency. Controller spec: `session.user.id` is passed through (extend `analytics.controller.spec.ts`).
- [x] **Task 13 — Frontend tests** (AC: 3, 6)
  - [x] Co-located `DashboardTrend.test.tsx`: renders the chart container with 12 mapped data points and localized month labels; renders the empty state when `currency === NO_CURRENCY` and when all months are zero; renders the error state. Mock `fetchMonthlyTrend`. Mirror `DashboardBreakdown.test.tsx`. Mock/stub `recharts` `ResponsiveContainer` if jsdom can't measure (it returns 0×0 without a width) — assert on the mapped chart data / labels rather than rendered SVG geometry. Cover both-locale month-label formatting where practical.
- [x] **Task 14 — Visual QA** (AC: 7)
  - [x] Run the dev stack, sign in (creds from `.env.example`), open `/dashboard` on a period with multiple months of seeded data (the seed is UAH; pick a period whose trailing 12 months overlap the seeded transactions, e.g. an early-2025 anchor). Capture trend-chart screenshots: **light + dark themes, desktop + mobile widths**, plus an **empty window** (e.g. anchor `1990-12`). **Confirm dark-theme legibility specifically:** axis ticks, legend, and tooltip text/background must be readable on the dark surface (tokenized, not default white-on-white or black-on-dark). Confirm income/expense bars use the M3 tokens and bars are grouped per month with localized labels. Compare against `example/track-my-life` `TrendsChart`. Record paths/observations in the Dev Agent Record. [Source: memory — visual-qa-via-playwright-cli, ui-stories-need-visual-qa]
- [x] **Task 15 — Gates** (AC: all)
  - [x] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm i18n:parity` all green. Run with `--force` where turbo may replay stale cache. Confirm the regenerated client has no drift (CI client-drift gate). [Source: memory — turbo-cache-masks-gate-results, run-tests-via-pnpm-scripts]

### Review Findings

Code review 2026-06-16 (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). Gates all green at review time: type-check, oxlint, stylelint, 138 frontend tests, 178 API tests (incl. Testcontainers integration). All seven ACs verified Met, including AC7 visual evidence (both themes, desktop + mobile, empty state, dark-legibility confirmed by direct inspection).

- [x] [Review][Patch] Trend DTO has no window validation — `find-trend-query.dto.ts` validated `dateFrom`/`dateTo` independently with no `dateFrom <= dateTo` guard. **Fixed:** added a reusable `IsOnOrAfter('dateFrom')` cross-field validator (`shared/validators/is-on-or-after.decorator.ts`, mirrors the `is-calendar-date` decorator pattern) on `dateTo`; a reversed window now fails validation (400) instead of returning a silent empty series. Co-located `find-trend-query.dto.spec.ts` added (accepts after/equal, rejects reversed/malformed). [apps/api/src/modules/analytics/dtos/find-trend-query.dto.ts]
- [x] [Review][Patch] D1 money-as-`Number` hygiene at two presentation boundaries — **Fixed:** (a) `checkIsEmptyTrend` now compares the string amounts against the canonical `ZERO_AMOUNT` (`'0.00'`) instead of `Number(...) === 0`; (b) the tooltip formats from the original `month.income`/`expense` strings (carried in the datum as `incomeAmount`/`expenseAmount` and read off the recharts payload) rather than the lossy `String(numericValue)` round-trip. Bar-height `Number()` mapping is sanctioned and unchanged. [apps/money-tracker/.../dashboard-trend/DashboardTrend.tsx; DashboardTrendContent.tsx]
- [x] [Review][Defer] Client chart component degrades to a permanent blank placeholder with no fallback — `DashboardTrendContent` reads M3 tokens via `getComputedStyle`; if a token returns empty (renamed/missing CSS var) the 300px placeholder never resolves to a chart, with no error/fallback. Also the recharts client component has no automated render test (jsdom can't measure `ResponsiveContainer`; AC7 manual QA covers it). [apps/money-tracker/.../dashboard-trend/DashboardTrendContent.tsx] — deferred, defensive hardening; renders correctly today
- [x] [Review][Defer] Missing real-DB integration coverage for the two empty states — no Testcontainers assertion for the NO_CURRENCY path end-to-end, nor for an all-zero window with a real currency. Logic is unit-tested (mocked) and mirrors integration-tested 3.1/3.2. [apps/api/test/integration/analytics.integration.spec.ts] — deferred, low-risk coverage gap
- [x] [Review][Defer] `date_trunc('month', dateFrom)` month-snap coupling — a mid-month `dateFrom` would pull partial-month transactions before the requested start; safe only because the frontend always sends first-of-month. Latent, untested. [apps/api/src/modules/analytics/analytics.repository.ts] — deferred, contract is month-granular by design
- [x] [Review][Defer] AC7 visual-QA screenshots referenced by ephemeral `/tmp/vqa/` absolute paths — images are not committed; only the textual observations in the Dev Agent Record are durable. [_bmad-output/implementation-artifacts/3-3-twelve-month-trend.md] — deferred, operator decides whether to archive

Dismissed as noise (2): `getTrailingMonthsRange` rollover/leap-year math (verified correct, no defect); light-theme empty-state screenshot absent (empty state is plain Card/Typography — no chart or dark-legibility risk, single-theme evidence adequate).

## Dev Notes

### What this story is (and is NOT)

- **IS:** one new endpoint (`GET /api/v1/analytics/trend`) on the existing `analytics` module + one new widget (a grouped bar chart) on the existing `/dashboard` page + the project's **first charting dependency** (`recharts`, recorded in the architecture doc). The module, the dashboard route, the `MonthStepper`, the `period` URL param, the currency model, the fetch-action pattern, and the widget+skeleton+Suspense scaffolding all already exist from 3.1/3.2 — reuse them verbatim.
- **IS NOT:** a new module, a new route, a currency picker, a granularity/type selector, a daily-spending chart, or a `packages/ui` primitive. The reference repo also has `daily-spending-chart` and `category-breakdown-chart` — **out of scope**; this story is only the 12-month income-vs-expense trend (FR16).

### The two genuinely new pieces of logic

1. **Zero-month fill via `generate_series`** (Task 3). The summary/breakdown queries only return rows that exist; the trend MUST return all 12 months even when some are empty (AC1/AC5b). Drive the query from a generated month series and LEFT JOIN transactions — **the user/currency filters go in the JOIN `ON` clause, not `WHERE`**, or the LEFT JOIN collapses to an inner join and zero months vanish. This is the single most likely correctness mistake; the integration test (AC5b) exists specifically to catch it.
2. **`recharts` with M3 token colors in both themes** (Task 9). See "Chart colors must be M3 tokens" below — this is the trickiest UI detail and the highest visual-QA risk.

### Trend window — trailing 12 ending at the selected period

The window is the **selected month + the 11 months before it** (ends at the `period` param), so all three dashboard widgets stay coherent for one `period` and the month stepper drives the whole dashboard. The frontend computes it with `getTrailingMonthsRange(parsePeriod(period), 12)` and passes two `YYYY-MM-DD` strings; the server fills the 12 buckets. [Decision recorded below; flagged for confirmation.]

### Chart colors must be M3 tokens (both themes) — do NOT hardcode hex

The reference `TrendsChartContent` hardcodes `#22c55e`/`#ef4444`. **supertool forbids hardcoded hex — colors come from M3 design tokens** (stylelint + the design-system convention). Reuse the same color language as the summary's signed net: **income → the success/positive token (e.g. `--on-success-container`), expense → `--error`** (the tokens 3.1 used for net). Pitfall: **SVG `fill="var(--token)"` as an attribute is NOT reliably resolved by browsers** — `var()` only resolves inside the CSS `style` property, not presentation attributes. Robust approach for the `'use client'` content:

- Read the concrete token values on the client: `getComputedStyle(document.documentElement).getPropertyValue('--token').trim()`, store in state, and **re-read when the theme changes** (depend on `resolvedTheme` from `next-themes` `useTheme()` in the effect) so the bars recolor on theme toggle. Pass the resolved color strings to `<Bar fill={...}>`.
- Also theme the **axis ticks, legend, and tooltip** (recharts defaults to dark text + a white tooltip box, illegible on the dark surface): set `tick={{ fill: <on-surface-variant token> }}`, `contentStyle`/`wrapperStyle`/`labelStyle` on `<Tooltip>` from surface/on-surface tokens, and legend text color likewise. The dark-theme legibility check is an explicit AC7 requirement — it is the exact defect class that shipped broken in 1.4/1.8.
- Acceptable alternative: target the rendered recharts SVG nodes from `*.module.scss` (CSS `fill` property beats the presentation attribute and resolves `var()` live with the theme). If you take this route, keep selectors scoped and document them; the client-read approach is preferred for being explicit and testable.

[Source: 3-1 net color tokens; packages/ui design tokens; memory — ui-stories-need-visual-qa]

### `recharts` integration specifics

- **App-level only.** Add to `apps/money-tracker/package.json` (exact `3.8.1`), NOT `packages/ui`. The architecture tree places `trend-chart/` under the app's dashboard components.
- **Keep it out of the server bundle.** The chart renderer is `'use client'`; the RSC shell (`DashboardTrend`) fetches data and `next/dynamic`-imports the content (mirror the reference). Do NOT use `{ ssr: false }` in `next/dynamic` from a Server Component (not allowed in the App Router) — the `'use client'` boundary already handles client-only rendering; `{ loading: () => null }` is enough.
- **Record it in `architecture.md` first** (AC4 / Enforcement rule 6). The doc is the pattern authority; code follows.
- **Peer deps:** recharts declares a `react-is` peer. If `pnpm install` warns it's missing, add `react-is` at the exact resolved version.

### D1 — money is strings end-to-end (merge-blocking)

Postgres `numeric(14,2)`; string amounts in every DTO and in JS; SQL does all the money arithmetic cast `::numeric(14,2)::text`. Each month's `income`/`expense` is a string in the DTO and the generated client. The chart converts them to `number` ONLY at the rendering boundary for the bar heights (presentation-only, exactly as 3.2 did with `share`) — the money-of-record never goes through JS float math. [Source: CLAUDE.md hard rule 1; architecture.md#D1; 3-1/3-2 Dev Notes]

### Currency model — do NOT reintroduce a picker

Same as 3.1/3.2: figures are always in `users.defaultCurrency`. No selector, no most-frequent fallback. Scope the JOIN to the one default currency so multi-currency rows never cross-aggregate. Null default currency → empty trend + `NO_CURRENCY`, no query. [Source: epics.md Epic 3; addendum.md#Currency-handling; 3-1/3-2 Dev Notes; memory — currency-simplified-single-default]

### Architecture compliance (guardrails)

- **Layering (D7):** controller → service → repository. The `generate_series` query lives in the repository only. No Drizzle in the service/controller.
- **Generated client only (NFR6):** the frontend reads the trend exclusively through `AnalyticsApiService` from `packages/shared/src/generated/`. A hand-written `fetch('/api/...')` is a defect.
- **Read path:** RSC (`DashboardTrend`) → `fetch-monthly-trend` action → generated client (cookie forwarded via `next-shared` factory) → proxy rewrite → API → SQL aggregation → camelCase JSON (string amounts) → RSC maps → `'use client'` chart. [architecture.md#read-path]
- **API conventions:** `/api/v1/...`, camelCase JSON, errors `{ statusCode, code, message, details? }`, auth via `@UseGuards(AuthGuard)` + `@Session()`.
- **Dates:** `date` is a `date` column / `YYYY-MM-DD` string — no timezone math. Window built client-side by `getTrailingMonthsRange`; month labels built from `YYYY-MM` parts via `Intl` with `new Date(year, monthIndex, 1)` (never `new Date('YYYY-MM-01')`).
- **DI (merge-blocking):** explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable (SWC erases it → DI breaks under Vitest). The service already injects `AnalyticsRepository` + `UsersRepository`; reuse them. [Source: memory — nest-di-explicit-inject]

### Source tree — files to touch

**Dependency (UPDATE):**
- `apps/money-tracker/package.json` — add `recharts: "3.8.1"` (exact). *Preserve* the existing deps.
- `_bmad-output/planning-artifacts/architecture.md` — record the new charting dependency. *Preserve* the rest of the doc.

**API (NEW):**
- `apps/api/src/modules/analytics/dtos/find-trend-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/trend-month.dto.ts`
- `apps/api/src/modules/analytics/dtos/trend-response.dto.ts`

**API (UPDATE):**
- `apps/api/src/modules/analytics/analytics.controller.ts` — *current state:* `@Get('summary')` + `@Get('breakdown')`. Add `@Get('trend')` alongside them. *Preserve* the existing endpoints and decorators.
- `apps/api/src/modules/analytics/analytics.service.ts` — *current state:* `getMonthlySummary` + `getCategoryBreakdown` + the `NO_CURRENCY`/`ZERO_AMOUNT` handling and two injected repositories. Add `getMonthlyTrend`. *Preserve* existing methods and injections.
- `apps/api/src/modules/analytics/analytics.repository.ts` — *current state:* `getMonthlySummary` + `getCategoryBreakdown` with the `numeric(14,2)::text` casting helpers (`moneyCast`, `MONEY_PRECISION`/`MONEY_SCALE`, `[INCOME_TYPE, EXPENSE_TYPE]`). Add `getMonthlyTrend` with the `generate_series` LEFT JOIN. *Preserve* the existing aggregations and constants.
- `apps/api/src/modules/analytics/analytics.service.spec.ts`, `analytics.controller.spec.ts` — extend.
- `apps/api/test/integration/analytics.integration.spec.ts` — extend with a `trend` describe block.
- `packages/shared/src/generated/**` — regenerated (not hand-edited).
- `apps/api/openapi.json` — regenerated.

**Frontend (NEW):**
- `apps/money-tracker/src/actions/fetch-monthly-trend.ts`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrend.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrendContent.tsx` (`'use client'`, recharts)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend-skeleton/DashboardTrendSkeleton.tsx` (+ `.module.scss`)

**Frontend (UPDATE):**
- `apps/money-tracker/src/utils/period.ts` — add `getTrailingMonthsRange` (+ `period.test.ts`).
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` — add the third `<Suspense>` block. *Preserve* the summary + breakdown blocks, header, and `MonthStepper`.
- `apps/money-tracker/messages/en/dashboard-page.json` AND `uk/dashboard-page.json` — add the `trend` block (same keys both files).

### Reference patterns (study before implementing — `example/track-my-life`, reference-only ED1)

- **Trend chart (THE model for this story):** `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/dashboard/components/trends-chart/TrendsChart.tsx` (server shell: fetch + `next/dynamic`) and `TrendsChartContent.tsx` (`'use client'`: `recharts` `BarChart` with two `Bar`s). **Adapt, never copy (ED1):** single profile-default currency (no currency/type/granularity filters), `YYYY-MM-DD` strings + `getTrailingMonthsRange` (no `convertFilterDateList`/timezone offset), **M3 token colors instead of `#22c55e`/`#ef4444`**, themed axis/legend/tooltip, `translate` not `t`, PascalCase, `@supertool` scope.
- Fetch action shape: mirror the **local** `fetch-category-breakdown.ts` / `fetch-monthly-summary.ts` for the client/cookie wiring.
- `recharts` version in the reference: `3.8.1` (same as the newest stable to pin).

### Local patterns to reuse (do NOT reinvent)

- **Analytics module (3.1/3.2):** `apps/api/src/modules/analytics/{controller,service,repository}.ts` + `dtos/` — the trend is a direct sibling of summary/breakdown; copy its structure, decorators, casting helpers, and the `NO_CURRENCY` null short-circuit.
- **Frontend widget pattern:** `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/` and `dashboard-breakdown-skeleton/` — `DashboardTrend` mirrors these (Card/CardContent, error/empty/success branches, period→range, `NO_CURRENCY`, independent `<Suspense>`).
- **Fetch action:** `apps/money-tracker/src/actions/fetch-category-breakdown.ts`.
- **Money formatting (for tooltip):** `apps/money-tracker/src/utils/format-amount.ts` (`formatAmount(amount, currency, locale)`).
- **Period utils:** `apps/money-tracker/src/utils/period.ts` (`parsePeriod`, `getMonthDateRange`, `formatPeriod`, `getPreviousPeriod`) — extend with `getTrailingMonthsRange`. `constants/search-params.ts` (`PERIOD_SEARCH_PARAM`).
- **Shared constants:** `NO_CURRENCY` in `@supertool/shared/constants/currency`; `I18N_NAMESPACE.dashboardPage` (already exists). [Source: memory — shared-constants-no-duplication]
- **Test helpers:** `apps/api/test/helpers/{postgres-container,integration-app,decimal-safe-sums}.ts`.
- **UI primitives:** `@supertool/ui` `Card`/`CardContent` (`molecules/card/Card`), `Typography` (`atoms/typography/Typography`), `Skeleton` (`atoms/skeleton`).

### Coding conventions (merge-blocking subset)

- No comments — self-documenting names. Follow-up work goes in story/epic files, never code TODOs.
- Arrow functions; `get`/`fetch`/`check`/`format`/`parse` prefixes; array vars carry `list` suffix; `UPPER_SNAKE_CASE` constants (e.g. `TRAILING_MONTHS = 12`, `CHART_HEIGHT`).
- TS: prefer interfaces; NO enums (`as const` + `ObjectValuesUnion`); no `as` assertions in prod code (narrow with `checkIs*`); single source of truth for value sets.
- One export per file; named exports; no barrel files.
- Files/dirs kebab-case; component files + co-located `.module.scss`/`.test.tsx` PascalCase. [Source: memory — pascalcase-component-filenames]
- Tests ship in the SAME story as the feature (NFR1).
- Exact dependency versions (no `^`/`~`); never introduce eslint/prettier (oxlint + oxfmt only). **One new dependency this story: `recharts` 3.8.1** — exact, recorded in architecture.md.
- FC typing: `Component: FC<Props>` per react conventions (manually verified — not lint-enforced). [Source: memory — fc-props-convention-not-lint-enforced]

### Testing standards

- API: Vitest (SWC decorators) for unit specs; Testcontainers against real Postgres for integration. Given-When-Then for module acceptance; Arrange-Act-Assert for units; `inputX`/`mockX`/`actualX`/`expectedX` naming.
- Money assertions compare exact strings; per-month figures must match independently computed expectations exactly — assert no float drift (FR18). The zero-month and window-boundary cases are the marquee correctness tests for this story.
- Frontend: co-located `*.test.tsx`. `recharts`'s `ResponsiveContainer` renders 0×0 in jsdom — stub it or assert on the mapped chart data + localized labels, not SVG geometry. Cover empty (NO_CURRENCY + all-zero) and error states; both-locale month-label coverage where practical.

### Previous-work intelligence

- **Story 3.1 (Monthly Summary)** created the `analytics` module, `/dashboard`, the fetch-action pattern, the `NO_CURRENCY` sentinel, the seed operator `defaultCurrency = UAH` backfill, the shared period/`MonthStepper`/`formatAmount` utilities, and the signed/color-coded net (the income/expense token language the chart reuses). 3.3 extends all of these.
- **Story 3.2 (Expense Breakdown)** is the immediate template: it added the `breakdown` endpoint + `DashboardBreakdown` widget + skeleton + independent `<Suspense>` + i18n block + unit/integration/frontend tests + visual QA, then regenerated the client. 3.3 follows the identical shape, adding the chart and the one new dependency. 3.2 also established the "convert money string → number ONLY at the presentation boundary" pattern (its `share`) — the chart's bar heights follow the same rule. Watch its Debug Log gotchas: inline the `db.execute` row generic (named interfaces fail the `Record<string,unknown>` constraint), and keep helper functions under the `max-statements` lint limit (split seed fixtures).
- **Story 2.2 (Browse by month)** established `period=YYYY-MM` + `MonthStepper` + `getMonthDateRange` — reused verbatim; 3.3 only adds the trailing-window util on top.
- **Epic 2 retro (2026-06-15)** settled the single-default-currency model; the cross-currency exclusion (AC5e) guards it.
- **Tech-debt (done):** integration test helpers are consolidated in `apps/api/test/helpers/` — import, don't redefine.
- **1.4 / 1.8 lesson:** both shipped broken UI with green gates because nobody looked. AC7 visual QA in both themes — with explicit dark-mode chart-legibility scrutiny — is mandatory. A chart is the most likely widget yet to look fine in light theme and broken in dark.

### Git intelligence (recent commits)

`d753efd` 3-2 expense breakdown (analytics `breakdown` endpoint + `DashboardBreakdown` + recursive CTE) · `70419cb` 3-1 monthly summary (analytics module + `/dashboard`) · `dbcd0a5` epic-2 retro + currency reconciliation · `82fdadb` 2-5 filter/sort. Pattern: each analytics story adds an endpoint to the `analytics` module + a dashboard widget + co-located tests, then regenerates the client. 3.3 is the same shape plus the first charting dependency (recorded in the architecture doc).

### Latest technical information (verified 2026-06-16)

- **`recharts` newest stable = `3.8.1`** (`npm view recharts dist-tags.latest`). It is also exactly what the reference pins, and its peer range includes React 19 (`^16.8 || ^17 || ^18 || ^19`). Pin `3.8.1` exact. [Source: memory — new-deps-newest-stable: pin newest stable, which here coincides with the reference pin.]
- recharts declares a `react-is` peer; add it (exact resolved version) only if `pnpm install` flags it missing.

### Project Structure Notes

- Aligns with `architecture.md` component tree: `modules/analytics` (summary/breakdown/**trend**) and the app-level `trend-chart` dashboard component named in the F4 mapping (line 376) and the tree (line 348). No `currency-filter`, no `daily-spending-chart`, no `category-breakdown-chart` (those reference components are out of scope).
- Dependency direction respected: `shared` (i18n namespace, `NO_CURRENCY`) → `ui` (Card/Typography/Skeleton) → app. `recharts` is an app-level dependency; no new `@supertool/ui` primitive.
- This is the **last story of Epic 3**; `epic-3-retrospective` is `optional` in sprint-status.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3-Twelve-Month-Trend]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3-Dashboard-and-Stats]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#FR5,FR14,FR16,FR18,FR19,FR20]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/addendum.md#Currency-handling-superseded-2026-06-15]
- [Source: _bmad-output/planning-artifacts/architecture.md#D1-Money] · [#component-tree (modules/analytics, trend-chart — lines 336,348)] · [#F4-mapping (line 376)] · [#read-path] · [#Enforcement-Guidelines (new-dependency rule, line 290/472)]
- [Source: CLAUDE.md#Hard-rules] · [.claude/rules/nestjs-apis.md] · [.claude/rules/typescript.md] · [.claude/rules/react.md]
- [Source: _bmad-output/implementation-artifacts/3-1-monthly-money-summary.md — analytics module + dashboard + net color tokens]
- [Source: _bmad-output/implementation-artifacts/3-2-expense-breakdown-by-category.md — endpoint+widget+test template; db.execute generic + max-statements gotchas]
- [Source: apps/api/src/modules/analytics/* — summary/breakdown controller/service/repository/dto template + casting helpers]
- [Source: apps/money-tracker/src/app/[locale]/dashboard/ — page, DashboardSummary, DashboardBreakdown, skeletons, fetch actions]
- [Source: apps/money-tracker/src/utils/period.ts — period helpers to extend]
- [Source: example/track-my-life/.../dashboard/components/trends-chart/ — TrendsChart + TrendsChartContent reference]
- [Source: _bmad-output/implementation-artifacts/tech-debt-integration-test-helper-dedup.md]

## Resolved Decisions

1. **Trend window anchoring (default — confirm):** the 12-month window is the **selected month + the 11 months preceding it** (window ends at the `period` param), so the month stepper drives all three dashboard widgets coherently. *Alternative:* always the trailing 12 months from the current calendar month (ignores the stepper). Going with the period-anchored window unless Oleksii prefers a fixed current-month window. [Flagged in Open Questions.]
2. **Chart type:** grouped bar chart (income bar + expense bar per month) — matches the reference `TrendsChart` and FR16's "income-vs-expense visual." Not a line chart.
3. **Chart colors:** reuse the summary's M3 income/expense token language (success/positive + `--error`), read on the client and themed for both light/dark — not hardcoded hex.

## Resolved with Oleksii (2026-06-16)

1. **Trend window:** anchored to the **selected period** (window = the selected month + the 11 preceding). The month stepper drives all three dashboard widgets coherently. (Confirmed — AC2 stands as written.)
2. **Charting approach:** introduce **`recharts`** (the planned charting story; reference + architecture parity). The CSS-bar alternative was declined. (Confirmed — AC4 / Task 1 stand as written.)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — bmad-dev-story workflow.

### Debug Log References

- **Generated client resolves via `dist/`, not `src/`.** `@supertool/shared`'s `exports` map points at `./dist/*`, so after `pnpm --filter @supertool/shared generate:client` the money-tracker type-check still failed (`TrendResponseDto`/`analyticsGetMonthlyTrend` missing) until `pnpm --filter @supertool/shared build` recompiled `dist/`. Sequence is: API build → generate:client → shared build.
- **recharts `Tooltip` formatter typing.** `formatter` expects a function whose `value` param accepts `ValueType | undefined`; an explicit `(value: number | string)` annotation failed assignability. Typed the param as `unknown` and `String(value)` — no `as`.
- **recharts entrance animation hid the bars in screenshots.** First visual-QA pass showed empty plot areas in BOTH themes because the default bar mount animation (~1500ms) was still running when the screenshot fired (token-load gate delays the chart mount). Set `isAnimationActive={false}` on both `<Bar>` — deterministic render, and avoids a re-animation flash on theme toggle.
- **`no-magic-numbers` fires on call-args in test files.** Object-property numbers are exempt but function-call argument numbers are not (per the repo lint convention) — the new `period.test.ts`/`DashboardTrend.test.tsx` call-args needed named constants. The `next/dynamic` mock stub also tripped `unicorn/consistent-function-scoping`; the factory cannot reference a module-scope component (vi.mock is hoisted above declarations → TDZ), so an inline `oxlint-disable-next-line` documents the constraint.

### Completion Notes List

- **API:** `GET /api/v1/analytics/trend` added to the existing `analytics` module (controller → service → repository, no layer skipping). Repository uses a `generate_series` month series LEFT JOINed to transactions — **user/currency filters live in the JOIN `ON` clause, not `WHERE`**, so zero months survive (the AC1/AC5b correctness point). All money math is Postgres `numeric(14,2)::text` (D1) via the existing `moneyCast()` helper; the `db.execute` row generic is inlined (3.2 gotcha). Service reuses the already-injected `UsersRepository` and the `NO_CURRENCY` null short-circuit.
- **Frontend:** `getTrailingMonthsRange` (period util, parts-based math, no `Date` day-overflow) → `fetch-monthly-trend` (cache()-wrapped, generated client only, NFR6) → `DashboardTrend` RSC shell (`next/dynamic` import of the `'use client'` chart) → `DashboardTrendContent` recharts grouped bar chart. **Chart colors are M3 tokens read on the client via `getComputedStyle` and re-read on `resolvedTheme` change** (income → `--on-success-container`, expense → `--error`); axis ticks/legend/tooltip themed from `--on-surface-variant`/`--surface-container`/`--on-surface`/`--outline-variant`. Month labels built from `YYYY-MM` parts via `new Date(year, monthIndex, 1)` + `Intl.DateTimeFormat` (no TZ-shift). Money strings → `Number` only at the chart bar-height boundary; tooltip re-formats via `formatAmount`. Independent `<Suspense>` + chart-shaped skeleton; localized error + empty (NO_CURRENCY OR all-zero) states.
- **i18n:** `trend` block added to `en/dashboard-page.json` + `uk/dashboard-page.json` (same keys, real Ukrainian); `pnpm i18n:parity` green.
- **Dependency:** `recharts 3.8.1` added app-level only (`apps/money-tracker`), recorded in `architecture.md` dependency table (doc-first). No `react-is` peer warning (resolved transitively as 17.0.2). Client regenerated and deterministic (no drift; `openapi.json` is git-ignored).
- **Tests:** repository/service/controller unit specs; 5 new Testcontainers integration tests (12 rows ascending, per-month decimal-safe match, zero-month fill, before-window boundary exclusion, cross-currency + cross-user exclusion) — all green (analytics integration 18/18). Frontend `DashboardTrend.test.tsx` (12 mapped points, en/uk localized labels, empty + NO_CURRENCY + error states) and `getTrailingMonthsRange` unit tests.
- **Gates:** `pnpm lint`, `type-check`, `test` (178 API + money-tracker 138), `stylelint`, `fmt:check`, `i18n:parity`, client-drift — all green.
- **AC7 Visual QA (mandatory):** captured the rendered trend chart via headless Chromium (throwaway `playwright-core` harness in `/tmp/vqa`, no repo tooling added) against the running dev stack, signed in as the seeded UAH operator at `period=2025-01` (trailing 12 = Feb 24 → Jan 25, dense seed data). Verified by looking at each screenshot:
  - `/tmp/vqa/trend-light-desktop.png`, `trend-dark-desktop.png` — grouped income (green) + expense (red/pink) bars, 12 localized month labels, Y-axis, legend all render and are legible in both themes.
  - **Dark legibility (the AC7 focus):** axis ticks `--on-surface-variant` (`#cac4d0`), legend text token-colored, bars `#7ee896`/`#f2b8b5` — all readable on the dark surface; NOT default white-on-dark.
  - `/tmp/vqa/trend-tooltip-dark.png` — tooltip themed (`--surface-container` bg `#211f26`, `--on-surface` text, `--outline-variant` border), values currency-formatted (`UAH 60,799.65`); NOT the default white recharts box.
  - `/tmp/vqa/trend-light-mobile.png`, `trend-dark-mobile.png` — responsive at 390px (`ResponsiveContainer`, ticks auto-thinned), NFR8.
  - `/tmp/vqa/trend-empty-dark.png` — empty window (Dec 1990) shows the localized trend empty state.
  - `/tmp/vqa/trend-uk-light.png` — fully localized: title "Динаміка доходів і витрат", legend "Витрати"/"Дохід", Ukrainian month axis (`лют. 24 р.` … `січ. 25 р.`).

### File List

**Dependency / docs (UPDATE):**
- `apps/money-tracker/package.json` — add `recharts: "3.8.1"` (exact)
- `pnpm-lock.yaml` — recharts + transitive deps
- `_bmad-output/planning-artifacts/architecture.md` — record recharts in the dependency table

**API (NEW):**
- `apps/api/src/modules/analytics/dtos/find-trend-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/trend-month.dto.ts`
- `apps/api/src/modules/analytics/dtos/trend-response.dto.ts`

**API (UPDATE):**
- `apps/api/src/modules/analytics/analytics.repository.ts` — `getMonthlyTrend` (generate_series LEFT JOIN)
- `apps/api/src/modules/analytics/analytics.service.ts` — `getMonthlyTrend` + NO_CURRENCY short-circuit
- `apps/api/src/modules/analytics/analytics.controller.ts` — `@Get('trend')`
- `apps/api/src/modules/analytics/analytics.service.spec.ts` — trend unit specs
- `apps/api/src/modules/analytics/analytics.controller.spec.ts` — trend controller spec
- `apps/api/test/integration/analytics.integration.spec.ts` — trend integration describe blocks
- `packages/shared/src/generated/{index,sdk,types}.gen.ts` (+ `index.ts`) — regenerated client

**Frontend (NEW):**
- `apps/money-tracker/src/actions/fetch-monthly-trend.ts`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrend.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrendContent.tsx`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend-skeleton/DashboardTrendSkeleton.tsx` (+ `.module.scss`)

**Frontend (UPDATE):**
- `apps/money-tracker/src/utils/period.ts` — `getTrailingMonthsRange` (+ `period.test.ts`)
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` — third `<Suspense>` (trend)
- `apps/money-tracker/messages/en/dashboard-page.json`, `apps/money-tracker/messages/uk/dashboard-page.json` — `trend` block

## Change Log

| Date | Change |
|---|---|
| 2026-06-16 | Story 3.3 implemented: `GET /api/v1/analytics/trend` (12-month generate_series aggregation) + `DashboardTrend` recharts grouped-bar widget on `/dashboard`; first charting dependency (`recharts 3.8.1`, recorded in architecture.md); unit + Testcontainers integration + frontend tests; AC7 visual QA in both themes. All gates green. Status → review. |
