---
baseline_commit: fa58f370bb0ecbe453af1e160e8849c75305e597
---

# Story 5.5: Dashboard Widgets — Top Categories, Daily Spending, Recent Transactions & Filter Bar

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want the dashboard to add top-categories, daily-spending, and recent-transactions widgets plus a filter bar,
so that one screen answers "where did my money go" as completely as the reference — but without its bugs (RP-F3 new-widget side).

## Context & Why This Story

The dashboard today (`apps/money-tracker/src/app/[locale]/dashboard/`) renders **three** widgets from Epic 3 — summary (3.1), breakdown (3.2), trend (3.3) — driven by a single `period=YYYY-MM` URL param stepped by `MonthStepper`. Story 5.4 shipped the **two backend endpoints** this story needs (`analyticsGetTopCategories`, `analyticsGetDailySpending`), already regenerated into the client. This story is the **frontend consumer**: it adds the three missing widgets the reference has — **top-categories** (ranked, share-of-total), **daily-spending** (bar chart honouring the selected range), **recent-transactions** (latest N) — plus a **filter bar** (date-range + transaction-type, **no currency control** per RP-D1), and wires the whole dashboard to one shared URL filter state so every widget updates together.

This is a **frontend-only** story: widgets + fetch actions + a filter-bar client component + a search-params parser + i18n (en/uk) + component tests + committed visual-QA evidence. **No new backend endpoints, no DTO/repository changes, no schema change, no new runtime dependency** (recharts 3.8.1 already exists — reuse it). It consumes 5.4 exclusively through the generated `AnalyticsApiService` (NFR6). Scope mirrors how Epic 5 split 5.1 (endpoint) from 5.2 (page), and 5.4 (endpoints) from this 5.5 (widgets).

**Evidence base:** reference dashboard captures `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/dashboard--overview*.png` (6 widgets + filter bar — the parity target). Reference code to adapt (ED1 — study, never copy/import): `example/track-my-life/apps/money-tracker` dashboard widgets + filter bar. Gap rows RP-F3 (new widgets) in `reference-parity-gap-backlog.md`; §5 defects to **exceed** — empty default period (fixed by 4.3), daily-spending range (fixed by 5.4 backend), donut render (avoided by 4.4's CSS-bar approach). The by-category drill-down is **Story 5.6 — out of scope here**.

## Recommended Approach (binding direction)

Follow the **exact Epic 3 widget pattern** already in the dashboard — do not invent a new one:

- **Each widget is an async RSC** `FC<Props>` in its own kebab-case folder under `dashboard/components/`, fetching via a `cache()`-wrapped `fetch-*` action that returns a discriminated union (`{ status: 'success'; … } | { status: 'error' }`), and branching **error → empty/NO_CURRENCY → success**, each branch rendering a `<Card>` (`@supertool/ui`). Precedent: `DashboardSummary.tsx`, `DashboardBreakdown.tsx`, `DashboardTrend.tsx`.
- **Each widget has a matching skeleton** component (`dashboard-*-skeleton/`) used as its `<Suspense>` fallback (module-level constant, per `jsx-no-jsx-as-prop`). Precedent: `dashboard-summary-skeleton/`.
- **The page** (`dashboard/page.tsx`) wraps each widget in its own `<Suspense>` with a `key` derived from the full filter state so boundaries reset on any filter change.
- **Charts are recharts** in a `'use client'` `*Content.tsx` child, loaded via `next/dynamic({ loading: () => null })`, with **theme-token colours resolved at runtime via a `MutationObserver` on `document.documentElement`'s `data-theme` attribute** (the 4.4 fix — NOT a `resolvedTheme`-keyed effect), `isAnimationActive={false}`. Precedent: `DashboardTrendContent.tsx` (reuse its `resolveChartColors`/`checkHasChartColors` helper shape).

### The filter bar & shared URL state (the structural change)

Introduce a **single canonical dashboard filter state** carried in URL search params — `dateFrom`, `dateTo`, `type` — and drive **all six widgets** from it (D-1). Concretely:

- New `parse-dashboard-search-params.ts` util → `{ dateFrom: string; dateTo: string; type: TransactionType | undefined }`. Validate dates against `CALENDAR_DATE_PATTERN` and `dateTo >= dateFrom`; validate `type` against the generated `TransactionType` union (else `undefined` = all). When `dateFrom`/`dateTo` are absent, **default the range to the 4.3 auto-fit month's range** — `getMonthDateRange(parsePeriod(await resolveDefaultPeriod(undefined)))` — so first-run auto-fit (Story 4.3) and the seed baseline are preserved.
- New `dashboard-filters/DashboardFilters.tsx` (`'use client'`) — a date-range control (from/to) + a transaction-type `Select` (All / Income / Expense, using the generated `TransactionType` values + an `ALL_OPTION_VALUE` sentinel), writing state via `router.replace` (from `@supertool/next-shared/src/i18n/navigation/navigation`) using a `writeParams(mutate)` helper that clones `new URLSearchParams`, applies the mutation, and `{ scroll: false }`. Precedent: `transactions/components/transaction-filters/` + `hooks/use-transaction-filters.ts`. **No currency control** (RP-D1).
- `DashboardFilters` **supersedes `MonthStepper` on the dashboard** (D-1 flag). `MonthStepper` stays in use on the transactions list — do not delete it.
- **Migrate the three existing widgets** (`DashboardSummary`, `DashboardBreakdown`, `DashboardTrend`) from a `period` prop to receiving the shared range: the page computes one `{ dateFrom, dateTo }` and passes it to every widget. Summary/breakdown use the range directly (they already compute `dateFrom`/`dateTo` internally — just take them as props instead of deriving from `period`). Trend keeps its trailing-12-months logic anchored on the range's end month. This is the "all widgets update consistently" requirement (AC2) — it is in scope and mechanical.

### The three new widgets

- **`dashboard-top-categories/DashboardTopCategories.tsx`** — async RSC → `fetchTopCategories({ dateFrom, dateTo, limit: TOP_CATEGORIES_DEFAULT_LIMIT })`. Renders a ranked list; **reuse the hand-rolled CSS share-bar** from `DashboardBreakdown` (`.barTrack`/`.barFill`, width via `--bar-width: {share}%` CSS custom property — NOT a chart lib, NOT a donut). Show `rank`, `categoryName`, `formatAmount(total, currency, locale)`, and `share` via `Intl.NumberFormat(locale, { style: 'percent' })`. `transactionCount` optional per row. No `limit` UI control this story (category drill-down is 5.6).
- **`dashboard-daily-spending/DashboardDailySpending.tsx`** (+ `DashboardDailySpendingContent.tsx` client child) — async RSC → `fetchDailySpending({ dateFrom, dateTo })`. **Recharts `BarChart`, reusing the `DashboardTrendContent` client pattern verbatim** (dynamic import, `MutationObserver` theming, `ResponsiveContainer`, `isAnimationActive={false}`, `Tooltip` via `formatAmount`). One `<Bar>` (expense per day); X axis = day label formatted via `Intl.DateTimeFormat`; zero-days render as zero bars (5.4 already zero-fills the range).
- **`dashboard-recent-transactions/DashboardRecentTransactions.tsx`** — async RSC → `fetchTransactions({ dateFrom, dateTo, type, page: 1, limit: RECENT_TRANSACTIONS_LIMIT, sortBy: 'date', sortOrder: 'desc' })` (reuse the existing `fetch-transactions.ts` action). Render the latest N rows reusing the transactions feature's presentational primitives (`formatAmount`, `getCategoryLabel`, `Badge`, `format-transaction-date`); link to the full transactions list. **This is the one widget the `type` filter re-scopes** (its endpoint supports `type`).

## Acceptance Criteria

> **Currency model (settled 2026-06-15, RP-D1 — same as every dashboard widget):** all figures are ALWAYS in the user's profile-default currency (FR14). The filter bar is **date-range + type only — NO currency picker/param/toggle**. `null` default currency (`NO_CURRENCY`) → each widget shows its localized empty state, no broken chart. [Source: epics.md#Story-5.5; RP-D1]

1. **(AC1) Three new widgets render for the selected period, consuming 5.4 via the generated client.** On the dashboard, alongside the existing summary/breakdown/trend, three new widgets render for the selected filter range, all in the profile-default currency: **top-categories** (ranked list with share-of-total, from `analyticsGetTopCategories`), **daily-spending** (recharts bar chart honouring the exact selected range, from `analyticsGetDailySpending`), and **recent-transactions** (latest `RECENT_TRANSACTIONS_LIMIT` rows, from `transactionsFindAll`). Data flows RSC → `fetch-*` (`cache()`, discriminated union) → generated `AnalyticsApiService`/`TransactionsApiService` — **no hand-written `fetch`** (NFR6). Money values (`total`, amounts) are rendered from **strings** via `formatAmount`; only `share`/`rank`/`transactionCount` are numbers, fenced at the render boundary (D1 — no client-side money summing).

2. **(AC2) Filter bar drives all widgets via URL search params (D9).** A `DashboardFilters` bar lets the user change the **date range** and **transaction type**; the state travels via `dateFrom`/`dateTo`/`type` URL search params (shareable, back-button-safe), and **all widgets update consistently** — the date range re-scopes every widget; the type filter re-scopes the recent-transactions widget (D-2). `DashboardFilters` supersedes `MonthStepper` on the dashboard. There is **no currency control** (RP-D1). Each widget's `<Suspense key>` includes the full filter state so boundaries reset on change.

3. **(AC3) Empty/zero states are localized (both locales), never a broken chart.** For a filter range with no data in the profile-default currency (including `currency === NO_CURRENCY`), each widget shows a localized empty/zero state (`en` + `uk`) — top-categories: empty message; daily-spending: an empty/zero-state message, never a legend-only or blank chart (§5 exceeded, 4.4 not regressed); recent-transactions: empty message. Emptiness is decided on canonical string comparison (e.g. `totalExpense === '0.00'` / `categories.length === 0` / `days` all `'0.00'` / `transactions.length === 0`), never `Number(x) === 0` float coercion where a string check suffices.

4. **(AC4) Charts render fully in BOTH themes (§6 protected, 4.4 not regressed).** The daily-spending chart resolves its colours from M3 design tokens at runtime and re-syncs on a **live** light↔dark toggle via a `MutationObserver` on `data-theme` (bars, axes, grid, legend, tooltip all themed; `isAnimationActive={false}`). No hardcoded hex. The top-categories share-bars use the `--primary` token like the breakdown. This is verified by committed screenshots in both themes (AC7), not gates alone.

5. **(AC5) Mobile-usable at 390px (NFR8).** At a 390px viewport the whole dashboard — filter bar, all six widgets, chart — is reachable and legible with **no horizontal overflow** (`document.documentElement.scrollWidth === window.innerWidth`), in both themes. Layout is mobile-first; the chart uses `ResponsiveContainer`.

6. **(AC6) Component tests cover each widget + the filter bar, both locales in the same commit (NFR1/FR19/FR20).** Co-located `*.test.tsx`/`*.test.ts` cover: each new widget's success / empty / error branches (assert localized labels + mapped data, **never recharts SVG geometry** — jsdom cannot measure `ResponsiveContainer`; stub `next/dynamic`/chart and assert on the mapped chart data + labels); the daily-spending chart's `resolveChartColors`/`checkHasChartColors` pure helpers; the two new fetch actions (mock cookies, `createServerApiClient`, the SDK service; success + error arms); `DashboardFilters` URL-state round-trip (changing range/type writes the right params, resets page); `parse-dashboard-search-params` (valid/invalid dates, reversed window, unknown type → undefined, absent → auto-fit default). Every new user-facing string exists in **both** `en` and `uk` `dashboard-page.json` in the **same commit** (`pnpm i18n:parity` green). All gates green (`pnpm lint`, `type-check`, `test`, `fmt:check`, `stylelint`, `i18n:parity`), run `--force`/`TURBO_FORCE=true` where turbo may replay stale cache.

7. **(AC7) Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** Given the rendered dashboard, `_bmad-output/implementation-artifacts/visual-qa/5-5-dashboard-widgets/` contains screenshots named `<scenario>--<viewport>--<theme>.png` in **light + dark × 390px-mobile + desktop**, committed (NOT `/tmp`), covering at minimum: the full dashboard on a **data-rich period** (e.g. Feb 2025) showing all six widgets + filter bar; each new widget close-up (top-categories, daily-spending chart, recent-transactions); the filter bar with the type-select open; and at least one **empty/zero-state** capture. Captures are against the **current shell** on the clean seed baseline (latest transaction = 2025-02-03). The Dev Agent Record records an evidence table + observations, confirms the daily-spending chart renders fully (not legend-only/blank) in dark mode and on a live toggle, confirms no 390px overflow, and includes a **reference-comparison note** per new widget vs `visual-qa/spike-reference-parity/reference/dashboard--overview*`.

## Tasks / Subtasks

- [x] **Task 1 — Search-params constants + dashboard filter-state parser** (AC: 2, 3)
  - [x] Extend `apps/money-tracker/src/constants/search-params.ts` with `DATE_FROM_SEARCH_PARAM = 'dateFrom'`, `DATE_TO_SEARCH_PARAM = 'dateTo'`, `TYPE_SEARCH_PARAM = 'type'` (preserve `PERIOD_SEARCH_PARAM`/`PAGE_SEARCH_PARAM`). Add `RECENT_TRANSACTIONS_LIMIT` (e.g. 5) — place in a route-local `constants.ts` if dashboard-only, or `src/constants/` if shared.
  - [x] Create `apps/money-tracker/src/utils/parse-dashboard-search-params.ts` (+ `.test.ts`) → `{ dateFrom, dateTo, type }`. Validate `dateFrom`/`dateTo` with `CALENDAR_DATE_PATTERN` (`@supertool/shared/constants/transaction-validation`) and `dateTo >= dateFrom`; validate `type` against the generated `TransactionType` union (unknown → `undefined`). When dates absent/invalid, default the range to the 4.3 auto-fit month via `getMonthDateRange(parsePeriod(await resolveDefaultPeriod(undefined)))`. Reuse `normalize-search-param.ts`, `period.ts` helpers. [Source: architecture.md#Naming (`parse*SearchParams`); rules/react.md#RSC]

- [x] **Task 2 — New fetch actions (RSC reads, generated-client only)** (AC: 1)
  - [x] `apps/money-tracker/src/actions/fetch-top-categories.ts` (+ `.test.ts`) — `cache()`, plain async (NOT `'use server'`), forward cookies via `createServerApiClient`, call `AnalyticsApiService.analyticsGetTopCategories({ query: { dateFrom, dateTo, limit } })`, return `{ status: 'success'; topCategories: TopCategoriesResponseDto } | { status: 'error' }`. Mirror `fetch-monthly-trend.ts` exactly.
  - [x] `apps/money-tracker/src/actions/fetch-daily-spending.ts` (+ `.test.ts`) — same pattern → `analyticsGetDailySpending({ query: { dateFrom, dateTo } })` → `{ status: 'success'; dailySpending: DailySpendingResponseDto } | { status: 'error' }`.
  - [x] Recent-transactions **reuses the existing `fetch-transactions.ts`** (`transactionsFindAll`) — no new action needed; it already supports `dateFrom`/`dateTo`/`type`/`page`/`limit`/`sortBy`/`sortOrder`.
  - [x] Import DTO types from `@supertool/shared/generated/types.gen`; services from `@supertool/shared/generated/sdk.gen`. [Source: rules/nestjs-apis.md#generated-client; memory sdk-service-classes-and-example-repo]

- [x] **Task 3 — Top-categories widget + skeleton** (AC: 1, 3, 5)
  - [x] `dashboard/components/dashboard-top-categories/DashboardTopCategories.tsx` (+ `.module.scss`, `.test.tsx`) — async `FC<{ dateFrom; dateTo; locale }>`. Branch error → empty (`currency === NO_CURRENCY` or `categories.length === 0`) → success. Render ranked `<ul>`/`<li>` reusing the `DashboardBreakdown` CSS share-bar (`--bar-width`, `--primary` token); `formatAmount(total, currency, locale)`; `share` via `Intl.NumberFormat(locale, { style: 'percent' })`. Localized `title`/`empty.*`/`error.*`.
  - [x] `dashboard/components/dashboard-top-categories-skeleton/DashboardTopCategoriesSkeleton.tsx` (+ `.module.scss`).

- [x] **Task 4 — Daily-spending widget (recharts) + skeleton** (AC: 1, 3, 4, 5)
  - [x] `dashboard/components/dashboard-daily-spending/DashboardDailySpending.tsx` (+ `.module.scss`, `.test.tsx`) — async server shell: fetch, branch error/empty (all days `'0.00'` or `NO_CURRENCY`)/success, map `days` → chart data (`{ label: formatDayLabel(date, locale), value: Number(total), amount: total }`), render `<DashboardDailySpendingContent>` inside a `<Card>`.
  - [x] `dashboard/components/dashboard-daily-spending/DashboardDailySpendingContent.tsx` (+ `.test.tsx`) — `'use client'`, recharts `BarChart`, dynamically imported by the shell via `next/dynamic({ loading: () => null })`. **Reuse `DashboardTrendContent`'s `MutationObserver`-on-`data-theme` colour resolution + `resolveChartColors`/`checkHasChartColors` + `isAnimationActive={false}` + `Tooltip` via `formatAmount`.** Consider extracting the shared chart-colour hook to `dashboard/hooks/` rather than duplicating (record the choice). Theme tokens for the expense bar: `--error` (match trend/summary expense language).
  - [x] `dashboard/components/dashboard-daily-spending-skeleton/DashboardDailySpendingSkeleton.tsx` (+ `.module.scss`).

- [x] **Task 5 — Recent-transactions widget + skeleton** (AC: 1, 2, 3, 5)
  - [x] `dashboard/components/dashboard-recent-transactions/DashboardRecentTransactions.tsx` (+ `.module.scss`, `.test.tsx`) — async `FC<{ dateFrom; dateTo; type; locale }>` → `fetchTransactions({ dateFrom, dateTo, type, page: 1, limit: RECENT_TRANSACTIONS_LIMIT, sortBy: 'date', sortOrder: 'desc' })`. Branch error → empty (`transactions.data.length === 0`) → success. Render the latest rows reusing transactions-feature presentational primitives (`formatAmount`, `get-category-label`, `Badge`, `format-transaction-date`) — a slim widget-local item is fine (avoid `TransactionCard`'s list-only routing props); a "view all" link → `ROUTES.transactions`. Localized strings.
  - [x] `dashboard/components/dashboard-recent-transactions-skeleton/DashboardRecentTransactionsSkeleton.tsx` (+ `.module.scss`).

- [x] **Task 6 — Dashboard filter bar** (AC: 2, 5)
  - [x] `dashboard/components/dashboard-filters/DashboardFilters.tsx` (+ `.module.scss`, `.test.tsx`) — `'use client'`, `FC<{ dateFrom; dateTo; type }>`. Date-range control (from/to) + type `Select` (`@supertool/ui`; options All/Income/Expense from generated `TransactionType` values + `ALL_OPTION_VALUE` sentinel — reference `transaction-filters/constants.ts`). Write via `router.replace` (i18n navigation) using a `use-dashboard-filters` hook (`dashboard/components/dashboard-filters/hooks/use-dashboard-filters.ts`) modelled on `use-transaction-filters.ts` (`writeParams` clone-mutate-replace, `{ scroll: false }`, delete `PAGE_SEARCH_PARAM`). **No currency control.**

- [x] **Task 7 — Migrate existing widgets to the shared range + wire the page** (AC: 2)
  - [x] `dashboard/page.tsx`: parse the URL via `parseDashboardSearchParams`, compute the single `{ dateFrom, dateTo, type }`, replace `<MonthStepper period={period} />` with `<DashboardFilters dateFrom={…} dateTo={…} type={…} />`, and render six `<Suspense>` boundaries each keyed on the full filter state (e.g. `` `summary-${dateFrom}-${dateTo}` ``, recent keyed also on `type`), with module-level skeleton fallback constants. Preserve `resolveOnboardedProfile` + `setRequestLocale`.
  - [x] Migrate `DashboardSummary`, `DashboardBreakdown` from `{ period }` to `{ dateFrom, dateTo, locale }` props (drop the internal `getMonthDateRange(parsePeriod(period))` — take the range as props). Migrate `DashboardTrend` to anchor its trailing-12-months window on the range's end month. Update their co-located `.test.tsx` to the new props. *Preserve* each widget's error/empty/success behaviour and the 4.4 chart theming.

- [x] **Task 8 — i18n (both locales, same commit)** (AC: 1, 2, 3, 6)
  - [x] Extend `apps/money-tracker/messages/en/dashboard-page.json` AND `messages/uk/dashboard-page.json` with `topCategories.{title,empty.*,error.*}`, `dailySpending.{title,empty.*,error.*}`, `recentTransactions.{title,empty.*,error.*,viewAll}`, and `filters.{dateFrom,dateTo,type,typeAll,typeIncome,typeExpense,…}`. Real Ukrainian (not transliterated); ICU interpolation, no concatenation. Reuse existing `empty`/`error` keys where identical. No new top-level namespace (reuse `I18N_NAMESPACE.dashboardPage`). [Source: rules/i18n.md]

- [x] **Task 9 — Tests** (AC: 6)
  - [x] Widget tests (success/empty/error) for the three new widgets; mock `next-intl` (identity `translate` with `.has`) and the fetch actions via `vi.hoisted`. For daily-spending, stub `next/dynamic`/chart and assert mapped data + labels (no SVG geometry); test `resolveChartColors`/`checkHasChartColors`.
  - [x] `DashboardDailySpendingContent.test.tsx` for the pure colour helpers (mirror `DashboardTrendContent.test.tsx`).
  - [x] Fetch-action tests for `fetch-top-categories`/`fetch-daily-spending` (mock `next/headers`, `createServerApiClient`, SDK service; success + error).
  - [x] `DashboardFilters.test.tsx` — changing range/type calls `router.replace` with the right params and drops the page param.
  - [x] `parse-dashboard-search-params.test.ts` — valid, reversed window, malformed date, unknown type→undefined, absent→auto-fit default (mock `fetchLatestTransactionDate`).
  - [x] Update migrated existing-widget tests. All via pnpm scripts, `TURBO_FORCE=true` where cache may replay.

- [x] **Task 10 — Visual QA evidence (committed)** (AC: 4, 5, 7)
  - [x] Pre-QA checklist (epic-4 retro Action #4): confirm the `:3000` next-server cwd is THIS checkout (`lsof`; memory `worktree-dev-server-stale-qa`); confirm seed baseline clean (latest txn 2025-02-03; `TRUNCATE` + re-seed if strays; memory `seed-idempotent-truncate-before-reseed`); sign in on `:3000` (trusted origins port-pinned).
  - [x] Capture `<scenario>--<viewport>--<theme>.png` into `_bmad-output/implementation-artifacts/visual-qa/5-5-dashboard-widgets/`: full dashboard (data-rich Feb 2025), each new widget, filter bar with type-select open, ≥1 empty/zero-state — each in light+dark × mobile(390)+desktop. Toggle theme via the real user-menu switcher; assert `scrollWidth === innerWidth` at 390px both themes. Record the evidence table + reference-comparison notes + dark-mode/live-toggle confirmation in the Dev Agent Record.

- [x] **Task 11 — Gates** (AC: all)
  - [x] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm fmt:check`, `pnpm stylelint`, `pnpm i18n:parity`, `pnpm build` all green (`--force`/`TURBO_FORCE=true` to defeat stale turbo cache). Client-drift gate stays green (no API change → no client regen expected). [Source: memory turbo-cache-masks-gate-results, run-tests-via-pnpm-scripts]

## Dev Notes

### What this story is (and is NOT)

- **IS:** three new dashboard widgets (top-categories, daily-spending, recent-transactions) + their skeletons, two new `fetch-*` reads, a `DashboardFilters` client bar + hook, a `parse-dashboard-search-params` util, a mechanical migration of the three existing widgets + the page to one shared `{dateFrom,dateTo,type}` URL state, i18n (en+uk), component tests, and committed visual-QA evidence.
- **IS NOT:** a new backend endpoint, a DTO/repository/schema change, a client regeneration, a new runtime dependency (recharts 3.8.1 exists), a currency picker (RP-D1), a donut chart (4.4 — keep CSS bars), a category drill-down (that is **Story 5.6**), or a per-widget `limit` control.

### Decisions (recorded per unattended-run protocol — reference-consistent unless flagged)

- **D-1 — the dashboard adopts one shared date-range filter state (`dateFrom`/`dateTo`/`type`) and `DashboardFilters` supersedes `MonthStepper` on the dashboard.** The epic AC requires a date-range + type filter bar that updates all widgets consistently (AC2). The existing widgets already compute `dateFrom`/`dateTo` internally from a month `period`, so migrating them to receive an explicit range is mechanical and low-risk. Default range (no URL params) = the 4.3 auto-fit month's range, preserving first-run behaviour and the seed baseline. **`MonthStepper` is retained on the transactions list.** *Flag for operator:* this replaces the dashboard's month-stepper UI with a range+type filter bar (reference-consistent — the reference dashboard has a filter bar, not a month stepper).
- **D-2 (FLAG for operator) — the `type` filter re-scopes ONLY the recent-transactions widget in this story; the analytics widgets stay expense-scoped.** Story 5.4 shipped `top-categories`/`daily-spending` **expense-only with no `type` param** and explicitly deferred the optional `type` param to 5.5 planning (5.4 D-6). Because this is a **frontend consumer story** (the task scope and 5.4's just-merged contract), 5.5 consumes 5.4 **as shipped**: the type control drives recent-transactions (its `transactionsFindAll` contract supports `type`), while top-categories/daily-spending/breakdown remain expense analytics by nature and summary/trend remain inherently dual-type. **Deferred:** if the operator wants the type toggle to re-scope the analytics widgets to income, that is a small follow-up adding an optional `type` param (default expense) to the two 5.4 endpoints + client regen (per 5.4 D-6) — deliberately kept out of this UI story to avoid re-opening the merged backend contract. This is the genuine reference divergence to confirm.
- **D-3 — reuse the CSS share-bar for top-categories, recharts `BarChart` for daily-spending.** Top-categories is `/breakdown` + rank/limit, so it reuses the proven hand-rolled CSS bar (`--bar-width`, `--primary`) — no donut (4.4 recorded the donut avoidance as intentional). Daily-spending is a time series, so it reuses the recharts `BarChart` client pattern (the only sanctioned chart lib, already a dep). Consistent with the two existing precedents.
- **D-4 — reuse the 4.4 `MutationObserver`-on-`data-theme` chart-colour pattern; consider extracting a shared hook.** The daily-spending chart must not regress the 4.4 live-toggle fix. Prefer extracting `DashboardTrendContent`'s colour logic (`resolveChartColors`/`checkHasChartColors` + observer) into a shared `dashboard/hooks/` hook consumed by both charts, over copy-paste; if extraction risks touching the trend chart's tested behaviour, duplicate and record it. Either way, no `resolvedTheme`-keyed effect.
- **D-5 — recent-transactions renders a slim widget-local item, not `TransactionCard`.** `TransactionCard` carries list-context routing props (`period`, `page`, `sortBy`, …) irrelevant to a dashboard widget. Reuse the presentational primitives (`formatAmount`, `get-category-label`, `Badge`, `format-transaction-date`) in a lean item to keep the widget decoupled from the list route. `RECENT_TRANSACTIONS_LIMIT = 5` (reference-consistent latest-N).
- **D-6 — default range = 4.3 auto-fit month, expressed as `dateFrom`/`dateTo`.** Preserves the first-run "land on a period with data" behaviour (Story 4.3) and the seed baseline while enabling arbitrary ranges the filter bar and daily-spending's §5 fix require.

### D1 — money is strings end-to-end (merge-blocking)

Every monetary value in the responses (`total` per item/day, `totalExpense`, transaction amounts) is a **string**; render via `formatAmount(amount, currency, locale)`. The ONLY numbers are `share` (display %), `rank`, `transactionCount`, and recharts bar heights (`Number(total)` fenced at the chart-data mapping boundary — never summed or arithmetic'd for display totals). Never sum money in JS: reconciliation totals (`totalExpense`) come from 5.4's SQL. Empty checks prefer canonical string comparison (`total === '0.00'`). [Source: CLAUDE.md hard rule 1; architecture.md#D1; 3-2/3-3 Dev Notes]

### Currency model — do NOT reintroduce a picker (RP-D1)

All figures are in `users.defaultCurrency`. The filter bar is date-range + type only. No currency control, param, or fallback. `null` default → `NO_CURRENCY` → localized empty state per widget. [Source: epics.md Epic 5; RP-D1; 3-1/3-2/3-3 Dev Notes]

### Architecture compliance (guardrails)

- **Read path (D9):** RSC → `fetch-*` (plain async wrapped in `cache()`, NOT `'use server'`) → generated client (cookie forwarded via `createServerApiClient`) → API. Mutations are not part of this story. [Source: architecture.md#read-path; rules/react.md#RSC]
- **Generated client only (NFR6):** consume 5.4 exclusively via `AnalyticsApiService`; recent-transactions via `TransactionsApiService`. A hand-written `fetch('/api/...')` is a defect.
- **Component boundaries:** widgets live in the app route dir (`apps/money-tracker`), composing `@supertool/ui` primitives (`Card`, `Typography`, `Select`, `Badge`). Do NOT put charts or app data-fetching in `packages/ui` (recharts is app-level only). `FC<Props>` typing on every component (manual — not lint-enforced; verify in review). [Source: architecture.md#component-boundaries; memory fc-props-convention-not-lint-enforced]
- **URL state (D9):** `dateFrom`/`dateTo`/`type` search params; write via `router.replace` from `@supertool/next-shared` i18n navigation (never `next/navigation`); `<Suspense key>` derived from filter state to reset boundaries. Never hardcode route literals — use `ROUTES`. [Source: rules/react.md#State-Management; architecture.md#D9]
- **Dates:** `YYYY-MM-DD` strings, no timezone math; day labels via `Intl.DateTimeFormat(locale, …)`, never ad-hoc `toLocaleDateString`. [Source: architecture.md#Dates; RP-D5]
- **SCSS:** M3 design tokens only (stylelint-enforced — no hardcoded hex), camelCase classes, mobile-first, `.module.scss` co-located PascalCase. Reuse token language: income `--on-success-container`, expense `--error`, bars `--primary`, surfaces `--surface-container`/`--outline-variant`. [Source: memory follow-example-repo-patterns; 4-4]

### Source tree — files to touch

**App (NEW):**
- `apps/money-tracker/src/utils/parse-dashboard-search-params.ts` (+ `.test.ts`)
- `apps/money-tracker/src/actions/fetch-top-categories.ts` (+ `.test.ts`)
- `apps/money-tracker/src/actions/fetch-daily-spending.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-top-categories/DashboardTopCategories.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../dashboard-top-categories-skeleton/DashboardTopCategoriesSkeleton.tsx` (+ `.module.scss`)
- `.../dashboard-daily-spending/DashboardDailySpending.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../dashboard-daily-spending/DashboardDailySpendingContent.tsx` (+ `.test.tsx`)
- `.../dashboard-daily-spending-skeleton/DashboardDailySpendingSkeleton.tsx` (+ `.module.scss`)
- `.../dashboard-recent-transactions/DashboardRecentTransactions.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../dashboard-recent-transactions-skeleton/DashboardRecentTransactionsSkeleton.tsx` (+ `.module.scss`)
- `.../dashboard-filters/DashboardFilters.tsx` (+ `.module.scss`, `.test.tsx`), `.../dashboard-filters/hooks/use-dashboard-filters.ts`, `.../dashboard-filters/constants.ts`
- (optional per D-4) `.../dashboard/hooks/use-chart-colors.ts` (extracted shared chart-colour hook)

**App (UPDATE):**
- `apps/money-tracker/src/constants/search-params.ts` — add `dateFrom`/`dateTo`/`type` params (+ `RECENT_TRANSACTIONS_LIMIT` if shared). *Preserve* existing.
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` — parse filter state, swap `MonthStepper`→`DashboardFilters`, add three `<Suspense>` widgets, pass the shared range to all six. *Current state:* renders summary/breakdown/trend via `period` from `PERIOD_SEARCH_PARAM` + `resolveDefaultPeriod`, three `<Suspense key={period}>` blocks, `MonthStepper` in the header. *Preserve* `resolveOnboardedProfile`, `setRequestLocale`, the streaming/skeleton structure.
- `.../dashboard-summary/DashboardSummary.tsx` (+ `.test.tsx`) — props `period`→`{dateFrom,dateTo}`. *Preserve* error/empty/success + net colouring.
- `.../dashboard-breakdown/DashboardBreakdown.tsx` (+ `.test.tsx`) — props `period`→`{dateFrom,dateTo}`. *Preserve* CSS share-bar.
- `.../dashboard-trend/DashboardTrend.tsx` (+ `.test.tsx`) — anchor trailing-12-months on the range's end month. *Preserve* the `DashboardTrendContent` recharts chart + 4.4 theming.
- `apps/money-tracker/messages/en/dashboard-page.json` + `messages/uk/dashboard-page.json` — add `topCategories`/`dailySpending`/`recentTransactions`/`filters` blocks.

**Do NOT touch:** `apps/api/**`, `packages/shared/src/generated/**` (no API change), `packages/ui/**` (unless adding a genuinely reusable primitive — prefer app-level), `MonthStepper` (keep for transactions list).

### Reference patterns (study before implementing — `example/track-my-life`, reference-only ED1)

- `example/track-my-life/apps/money-tracker` dashboard widgets + filter bar — **shape to adapt**: the widget set (top-categories, daily-spending, recent-transactions), the filter-bar layout (date range + type), the empty states. **Adapt, never copy (ED1):** drop any currency picker/param, drop the donut, apply supertool's `formatAmount`/`translate`/`FC<Props>`/token conventions, single-default-currency scoping, and the recharts theming fix.
- Reference captures `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/dashboard--overview*.png` — the visual parity target for the 6-widget + filter-bar layout (context for AC7 comparison notes).

### Local patterns to reuse (do NOT reinvent)

- **Widget shell + fetch action:** `dashboard/components/dashboard-trend/DashboardTrend.tsx` + `actions/fetch-monthly-trend.ts` — the exact server-shell + `cache()` discriminated-union read template.
- **Recharts client chart (theming + dynamic import):** `dashboard/components/dashboard-trend/DashboardTrendContent.tsx` (+ `.test.tsx`) — `MutationObserver` on `data-theme`, `resolveChartColors`/`checkHasChartColors`, `isAnimationActive={false}`, `Tooltip` via `formatAmount`. **Copy this approach for daily-spending; do not use a `resolvedTheme`-keyed effect (4.4 defect).**
- **CSS share-bar:** `dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx` (`--bar-width`, `--primary`) — copy for top-categories.
- **Filter bar + URL hook:** `transactions/components/transaction-filters/TransactionFilters.tsx` + `hooks/use-transaction-filters.ts` + `constants.ts` (`ALL_OPTION_VALUE`) — the closest existing filter-bar pattern (`Select` from `@supertool/ui`, `writeParams` clone-mutate-`router.replace`).
- **Recent-transactions primitives:** `transactions/components/transaction-card/TransactionCard.tsx`, `transactions/utils/{format-transaction-date,get-category-label}.ts`, `actions/fetch-transactions.ts`.
- **Money & period utils:** `utils/format-amount.ts` (`formatAmount(amount, currency, locale)`), `utils/period.ts` (`getMonthDateRange`, `parsePeriod`, `getTrailingMonthsRange`), `utils/resolve-default-period.ts` (4.3 auto-fit), `utils/normalize-search-param.ts`.
- **Shared constants:** `NO_CURRENCY` (`@supertool/shared/constants/currency`), `TOP_CATEGORIES_DEFAULT_LIMIT` (`@supertool/shared/constants/analytics`), `CALENDAR_DATE_PATTERN` (`@supertool/shared/constants/transaction-validation`), `I18N_NAMESPACE.dashboardPage` (`@supertool/shared/constants/i18n-namespace`). [Source: memory shared-constants-no-duplication]
- **Generated client (5.4):** `AnalyticsApiService.analyticsGetTopCategories`/`analyticsGetDailySpending`; types `TopCategoriesResponseDto`/`TopCategoryItemDto`/`DailySpendingResponseDto`/`DailySpendingDayDto` in `packages/shared/src/generated/types.gen`.

### Coding conventions (merge-blocking subset)

- No comments — self-documenting names; follow-up work goes in story/epic files. Arrow functions; `get`/`fetch`/`check`/`format`/`parse` prefixes; array vars carry `List` suffix; `UPPER_SNAKE_CASE` constants.
- `FC<Props>` typing on every component; `on*` callback props / `handle*` handlers; curly braces for handler bodies. Named exports, one export per file, no barrels. No `as` except `as const`; no TS enums (derive unions).
- Files/dirs kebab-case; component files + co-located `.module.scss`/`.test.tsx` PascalCase after the component. `cn` from `@supertool/ui` for conditional classes. `translate` (never `t`); namespace via `I18N_NAMESPACE`, never a string literal.
- Tests ship in the SAME story (NFR1). Exact dependency versions; never introduce eslint/prettier; **no new dependency expected**. [Source: CLAUDE.md; rules/javascript.md, react.md, typescript.md, i18n.md]

### Testing standards

- Frontend: Vitest + `@testing-library/react` + jsdom, co-located `*.test.tsx`, run via pnpm scripts only (`pnpm --filter money-tracker test`); `TURBO_FORCE=true` to defeat stale cache; retry the transient pnpm `H.replace` crash. Mock `next-intl` (identity `translate` with `.has`), actions via `vi.hoisted`, `next/headers` cookies + `createServerApiClient` + SDK service for action tests, `router.replace` for the filter bar.
- **jsdom cannot measure recharts `ResponsiveContainer` (0×0)** — stub `next/dynamic`/`ResponsiveContainer` and assert on the mapped chart data + localized labels, never SVG geometry; do not fake geometry assertions. Test the pure colour helpers (`resolveChartColors`/`checkHasChartColors`) directly.
- After a transition, `await screen.findByRole(...)` for the settled label before re-interacting (race gotcha).
- i18n parity gate must be green (every new key in both locales, same commit).
- **Visual QA is a first-class deliverable** (epic-4 retro D1): committed screenshots, not `/tmp`; green gates + green axe are NOT sufficient (1.4/1.8/3.3 shipped green-but-broken). [Source: 5-2/5-3 Dev Agent Records; 4-4; memory ui-stories-need-visual-qa, visual-qa-via-playwright-cli]

### Previous-work intelligence

- **Story 3.1/3.2/3.3** built the dashboard scaffold, the `fetch-*`+`cache()` read pattern, the CSS share-bar (3.2), and the recharts `BarChart` with theme-token colours (3.3). The three new widgets are direct siblings — copy their structure.
- **Story 4.3** added first-run period auto-fit (`resolve-default-period.ts`) — the default filter range must preserve it (D-6).
- **Story 4.4** fixed the trend dark-mode **live-toggle** defect by switching to a `MutationObserver` on `data-theme` and extracting `resolveChartColors`/`checkHasChartColors`; it also recorded the intentional **no-donut** divergence and the committed-visual-QA standing pattern (retro D1). The daily-spending chart MUST use the observer pattern and MUST NOT introduce a donut. Known-open (do not reintroduce as new): blank `aria-hidden` placeholder has no retry if tokens never resolve; tooltip series matching by translated name is fragile.
- **Story 5.2/5.3** are the most recent frontend work: `fetch-*` reads vs `'use server'` mutations distinction, `ActionState` error-by-code mapping, `revalidatePath`, the visual-QA evidence section format (`visual-qa/<story>-<slug>/`, `<scenario>--<viewport>--<theme>.png`, committed), and the 390px `scrollWidth === innerWidth` check.
- **Story 5.4** shipped the two consumed endpoints; its D-6 pre-authorized (and this story defers, D-2) the optional `type` param for analytics type-rescoping.

### Git intelligence (recent commits)

`30d1da9` 5-2 standalone import page · `e5fb03c` 5-1 import endpoints · `586cfd7` epic-4 retro · `9526412`/`cea3501` 4-3 auto-fit. Pattern: each dashboard/analytics story adds sibling widget(s) + co-located tests; 5.4 (analytics endpoints) merged via PR #37 and its client is already committed. This story adds no API change — the client-drift gate should stay green without regeneration.

### Project Structure Notes

- Aligns with `architecture.md` component tree: `apps/money-tracker` dashboard gains `dashboard-top-categories`, `dashboard-daily-spending`, `dashboard-recent-transactions`, `dashboard-filters` (+ skeletons) alongside the existing three; **no `currency-filter`** (removed 2026-06-15). Dependency direction respected (`shared` generated client → app; `ui` primitives → app; app owns routes/actions). No `packages/api`/`packages/shared` source change (client already generated by 5.4). No schema change (RP-D5 bare `date`).
- Variance: the dashboard's period control changes from `MonthStepper` to `DashboardFilters` (D-1, flagged). No conflict with the transactions list, which keeps `MonthStepper`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.5-Dashboard-Widgets] · [#Epic-5-Import-Your-Data-and-See-Your-Money] · [#RP-F3] · [#RP-D1 currency] · [#RP-D5 bare date] · [#Reference-defects-§5 empty period / daily-spending range / donut / dark theme]
- [Source: _bmad-output/planning-artifacts/architecture.md#D9-RSC-server-actions] · [#read-path] · [#component-boundaries] · [#recharts 3.8.1 (line 147)] · [#Naming parse*SearchParams] · [#Format-Patterns money/dates/i18n]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#FR14 currency] · [#FR19,FR20 i18n] · [#NFR1 tests] · [#NFR6 generated client] · [#NFR8 mobile]
- [Source: CLAUDE.md#Hard-rules] · [.claude/rules/react.md] · [.claude/rules/i18n.md] · [.claude/rules/javascript.md] · [.claude/rules/typescript.md]
- [Source: _bmad-output/implementation-artifacts/5-4-dashboard-analytics-endpoints-top-categories-daily-spending.md — consumed endpoints + D-6 type-param deferral]
- [Source: _bmad-output/implementation-artifacts/3-2-expense-breakdown-by-category.md — CSS share-bar] · [3-3-twelve-month-trend.md — recharts pattern]
- [Source: _bmad-output/implementation-artifacts/4-4-dashboard-widget-visual-qa-defect-fixes.md — MutationObserver theming fix, no-donut divergence, committed-visual-QA standing pattern]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-07-04.md — D1 committed-evidence visual QA; Action #4 pre-QA checklist]
- [Source: _bmad-output/implementation-artifacts/5-2-standalone-import-page.md, 5-3-onboarding-flow.md — recent frontend conventions + visual-QA evidence format]
- [Source: apps/money-tracker/src/app/[locale]/dashboard/** — existing page + widgets + skeletons]
- [Source: apps/money-tracker/src/actions/{fetch-monthly-trend,fetch-transactions}.ts — read-action template]
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/** — filter-bar + URL-hook pattern]
- [Source: packages/shared/src/{generated/{sdk.gen,types.gen}.ts,constants/{analytics,currency,i18n-namespace,transaction-validation}.ts} — client + shared constants]
- [Source: _bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/dashboard--overview*.png — parity target]

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]` — via the `bmad-dev-story` workflow.

### Debug Log References

- Gates run with `TURBO_FORCE=true` (memory `turbo-cache-masks-gate-results`). All green: `type-check`, `lint`, `stylelint`, `fmt:check`, `test` (271 money-tracker tests, 57 files), `i18n:parity` (key parity OK), `build` (4 packages).
- Two mid-run fixes surfaced by gates/QA:
  1. `type-check` — `DashboardTrend` destructured an unused `dateFrom`; removed it (only `dateTo` anchors the trailing-12-months window).
  2. Visual QA — recharts' hidden default tooltip wrapper rendered off-canvas at `right:1070` causing horizontal overflow at 390px (`scrollWidth 1070 ≠ 390`). Fixed by adding `overflow: hidden` to the `.chart` wrapper in BOTH `DashboardDailySpending.module.scss` and `DashboardTrend.module.scss` (pure clip, no behavioural change). Re-verified `scrollWidth === innerWidth === 390` in both themes.

### Completion Notes List

Implemented all 11 tasks. Decisions D-1…D-6 were settled in the story and honoured as written; additional implementation decisions recorded below.

**Implementation decisions (unattended-run protocol):**
- **D-4 resolution — DUPLICATED the chart-colour pattern rather than extracting a shared hook.** `DashboardTrendContent` exports `resolveChartColors`/`checkHasChartColors` that are unit-tested directly (`DashboardTrendContent.test.tsx`) against a 7-key `ChartColors` shape (incl. `income`). The daily-spending chart needs a different 6-key shape (expense via `--error`, no income series). Extracting a generic shared hook would have required rewiring the trend chart and its tested exports — the exact risk D-4 flags. Per D-4's "if extraction risks the trend chart's tested behaviour, duplicate and record it", `DashboardDailySpendingContent` carries its own `resolveChartColors`/`checkHasChartColors` + `MutationObserver`-on-`data-theme` + `isAnimationActive={false}`, with its own co-located colour-helper test. No `resolvedTheme`-keyed effect anywhere.
- **Recent-transactions "view all" link** uses the i18n `Link` from `@supertool/next-shared/.../navigation` (the RSC-safe pattern used across transactions pages), not `NavigationLink` (which is `'use client'` + active-state and unnecessary here). Slim widget-local item per D-5 (no `TransactionCard` routing props); expense/income badge label from the widget's own `typeIncome`/`typeExpense` keys.
- **`DashboardTrend` keeps `dateFrom` in its `Props` interface** (page passes a uniform `{dateFrom,dateTo,locale}` to every widget) but only consumes `dateTo` to anchor the trailing window via `parsePeriod(getPeriodFromDate(dateTo))`.
- **Overflow-clip fix applied to the trend chart too** (not just daily-spending): both charts share the same recharts tooltip-overflow behaviour and both live on the page, so both `.chart` wrappers get `overflow: hidden` to guarantee AC5 regardless of which chart's tooltip is the culprit.
- **Type filter re-scopes recent-transactions only** (D-2 as written) — analytics widgets consume 5.4 as shipped (expense-only, no `type` param).

**Money-is-strings (D1):** every monetary value (`total`, `totalExpense`, summary figures, transaction `amount`) rendered via `formatAmount` from strings; only `share`/`rank`/`transactionCount` and the fenced `Number(day.total)` bar-height are numeric. No client-side money summing. Emptiness decided on canonical string checks (`total === '0.00'`, `categories.length === 0`, `data.length === 0`).

**Visual QA evidence (committed, `visual-qa/5-5-dashboard-widgets/`):**

Captured against the running app in THIS checkout (verified `:3000` next-server cwd via `lsof`), signed in as the seeded operator (`operator@supertool.local`), on the clean seed baseline (1880 txns, latest 2025-02-03, 110 categories, operator onboarded / UAH). DB baseline verified intact before and after (only a better-auth session row added by sign-in — no transactions/categories change). Theme toggled via the real user-menu switcher (live toggle, no reload).

| Scenario | Viewport | Theme | File |
| --- | --- | --- | --- |
| Full dashboard (6 widgets + filter bar), Feb 2025 | desktop 1440 | light | `dashboard-overview--desktop--light.png` |
| Full dashboard | desktop 1440 | dark | `dashboard-overview--desktop--dark.png` |
| Full dashboard | mobile 390 | light | `dashboard-overview--mobile--light.png` |
| Full dashboard | mobile 390 | dark | `dashboard-overview--mobile--dark.png` |
| Top-categories close-up | desktop 1440 | light / dark | `top-categories--desktop--{light,dark}.png` |
| Daily-spending chart close-up | desktop 1440 | light / dark | `daily-spending--desktop--{light,dark}.png` |
| Recent-transactions close-up | desktop 1440 | light / dark | `recent-transactions--desktop--{light,dark}.png` |
| Filter bar with type-select open | desktop 1440 | light | `filter-type-open--desktop--light.png` |
| Empty/zero-state (range 2030-01, no data) | desktop 1440 | light | `dashboard-empty-state--desktop--light.png` |

Observations:
- **AC4 (both themes + live toggle):** the daily-spending recharts `BarChart` renders fully in dark mode (bars = dark-mode `--error` salmon, themed axes/grid/tooltip) and re-syncs colours on a LIVE light↔dark toggle via the user menu (no reload) — confirmed by capturing dark from a light session. Trend chart unaffected (4.4 not regressed). Top-categories share-bars use `--primary` like the breakdown.
- **AC5 (390px):** `document.documentElement.scrollWidth === window.innerWidth === 390` in BOTH themes after the overflow-clip fix. Filter bar and summary stack vertically; charts responsive; sidebar collapses to a hamburger drawer.
- **AC3 (empty/zero):** all six widgets show localized empty states for an empty range — daily-spending shows "No spending in this period", NOT a blank/legend-only chart (§5 exceeded).
- **Reference-comparison (`visual-qa/spike-reference-parity/reference/dashboard--overview*`):** the 6-widget + filter-bar layout matches the reference parity target — top-categories (ranked share list), daily-spending (bar chart over the selected range), recent-transactions (latest N + view-all). Divergences are the intentional supertool ones: no currency picker (RP-D1), no donut (CSS share-bar instead, 4.4), single-default-currency (UAH) figures.

### File List

**New — app source:**
- `apps/money-tracker/src/utils/parse-dashboard-search-params.ts` (+ `.test.ts`)
- `apps/money-tracker/src/actions/fetch-top-categories.ts` (+ `.test.ts`)
- `apps/money-tracker/src/actions/fetch-daily-spending.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-top-categories/DashboardTopCategories.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-top-categories-skeleton/DashboardTopCategoriesSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-daily-spending/DashboardDailySpending.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-daily-spending/DashboardDailySpendingContent.tsx` (+ `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-daily-spending-skeleton/DashboardDailySpendingSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-recent-transactions/DashboardRecentTransactions.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-recent-transactions-skeleton/DashboardRecentTransactionsSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-filters/DashboardFilters.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-filters/constants.ts`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-filters/hooks/use-dashboard-filters.ts`

**Updated — app source:**
- `apps/money-tracker/src/constants/search-params.ts` (added `DATE_FROM_SEARCH_PARAM`, `DATE_TO_SEARCH_PARAM`, `TYPE_SEARCH_PARAM`, `RECENT_TRANSACTIONS_LIMIT`)
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` (parse filter state, `DashboardFilters` replaces `MonthStepper`, six range-keyed `<Suspense>` boundaries)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary/DashboardSummary.tsx` (+ `.test.tsx`) — `period`→`{dateFrom,dateTo}`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx` (+ `.test.tsx`) — `period`→`{dateFrom,dateTo}`
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrend.tsx` (+ `.test.tsx`) — `period`→`{dateFrom,dateTo}`, trailing window anchored on range end month
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrend.module.scss` (`.chart` overflow-clip)
- `apps/money-tracker/messages/en/dashboard-page.json` + `apps/money-tracker/messages/uk/dashboard-page.json` (`filters`/`topCategories`/`dailySpending`/`recentTransactions` blocks)

**New — visual QA evidence:**
- `_bmad-output/implementation-artifacts/visual-qa/5-5-dashboard-widgets/*.png` (12 captures)

**Updated — tracking:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (5-5 → review)
- this story file (frontmatter `baseline_commit`, tasks, Dev Agent Record, Status)

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-05 | Story 5.5 implemented: three new dashboard widgets (top-categories, daily-spending, recent-transactions) + skeletons, two `fetch-*` reads, `DashboardFilters` client bar + hook, `parse-dashboard-search-params` util, migration of summary/breakdown/trend + page to one shared `{dateFrom,dateTo,type}` URL state, i18n (en+uk), component tests, and committed visual-QA evidence. All gates green. Status → review. |
