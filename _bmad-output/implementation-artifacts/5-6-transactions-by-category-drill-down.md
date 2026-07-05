---
baseline_commit: 1e5fa02d233c55b9080117ba324f57e5cdbf1c86
---

# Story 5.6: Transactions By-Category Drill-Down

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to drill from a category into its transactions and see per-category totals,
so that I can investigate exactly where a category's money went — with the totals the reference forgot to show (RP-F4).

## Context & Why This Story

This is the **last story of Epic 5** ("Import Your Data & See Your Money"). Epic 5 has shipped the import spine (5.1 endpoint, 5.2 page, 5.3 onboarding) and the complete dashboard (5.4 analytics endpoints, 5.5 widgets + filter bar). This story adds the **by-category drill-down**: a `/transactions/by-category` view that renders the user's category hierarchy as an accordion — **each node carrying a per-category total + transaction count** (the totals/counts the reference omits, §5) — and a `/transactions/by-category/[categoryId]` detail view that lists that category's transactions with **subtree roll-up** (child spend rolls up under a parent) for the same period.

**The reuse-vs-new-endpoint decision is the core of this story (see D-1).** Investigation of the existing code established:

- **The transaction-detail list is pure reuse.** `GET /api/v1/transactions` (`transactionsFindAll`) already accepts a **subtree-aware** `categoryId` (Story 2.5 — the repository calls `getCategorySubtreeIds` server-side, so filtering by a parent returns the parent's + all descendants' transactions), plus `dateFrom`/`dateTo`/`page`/`limit`/`sortBy`/`sortOrder`. The detail rows need **no backend change** — reuse `fetchTransactions`.
- **The accordion's per-category totals+counts need ONE new backend aggregation endpoint.** D1 (money-is-strings, no client-side money arithmetic) **forbids** summing amounts in JS, so per-category totals MUST come from SQL. The existing analytics endpoints cannot supply them: `top-categories` is hard-capped at `limit ≤ 20`, top-level-roll-up-only, and expense-only; `breakdown` is top-level-only and expense-only. Neither yields **per-node (parent AND child)** totals+counts for **all** categories. The epic's own AC — "repository/module specs cover the per-category aggregation and roll-up (reconciling exactly with the dashboard breakdown, FR18)" — explicitly anticipates a new SQL aggregation in this story. The reference has a dedicated `GET /transactions/by-category/:categoryId` endpoint (adapt, never copy — ED1).

So this story is a **thin backend slice (one new analytics aggregation endpoint + client regen) + a frontend feature (two routes, accordion, detail list, reused primitives, i18n, tests, visual QA)**. Binding throughout: D1 money-as-strings, NFR6 generated-client-only, D7 controller→service→repository, FR19/FR20 both-locales, NFR1 tests-in-story, the single-default-currency model (RP-D1 — no currency picker), bare `date` granularity (RP-D5), and the evidence-reference convention (adapt from `example/`, never copy — ED1).

**Evidence base:** reference captures `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--by-category--{desktop,mobile}.png` and `transactions--category-detail--desktop.png` (the parity target). §5 defect to **exceed**: the reference's by-category list shows **no totals/counts** → add them. No supertool baseline exists (greenfield route). Reference code to adapt (ED1 — study, never copy/import): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/by-category/**` (frontend) + `example/tracker-backend-api/src/modules/transactions/` `by-category` endpoint (backend).

## Recommended Approach (binding direction)

### Backend — one new analytics aggregation endpoint (D-1, D-2, D-3)

Add `GET /api/v1/analytics/by-category` to the **analytics module** (`apps/api/src/modules/analytics/`), mirroring the shape of the existing `top-categories`/`breakdown` endpoints exactly (controller → service → repository, D7):

- **Query DTO** `find-by-category-query.dto.ts`: `dateFrom` (required, `YYYY-MM-DD`), `dateTo` (required, on-or-after `dateFrom`) — copy `find-top-categories-query.dto.ts` minus `limit` (this endpoint is **uncapped** — it returns the full hierarchy, unlike top-N).
- **Response DTOs** `by-category-node.dto.ts` + `by-category-response.dto.ts`: return a **flat** list `{ categories: ByCategoryNodeDto[]; currency: string }` where `ByCategoryNodeDto = { categoryId: string; categoryName: string; parentId: string | null; type: TransactionType; total: string; transactionCount: number }`. **`total` is a string** (D1). Flat + `parentId` lets the client rebuild the tree with the existing `buildCategoryHierarchy` util (D-6) — no nested DTO needed.
- **Repository** `analytics.repository.ts` `getByCategoryTotals(userId, dateFrom, dateTo, currency)`: reuse the existing `WITH RECURSIVE category_roots` roll-up pattern already in `getCategoryBreakdown`/`getTopCategories`, but aggregate **per category node** (each node's `total` = SQL sum of its own subtree's transactions for the period; `transactionCount` = count over the same subtree), scoped to the authenticated user and the profile-default currency. Amounts via the existing `moneyCast()` helper (`::numeric(14,2)::text`). Return **all** the user's categories (nodes with no transactions in the period carry `total: '0.00'`, `transactionCount: 0`) so the accordion always renders the full hierarchy. Roll-up is SQL only — never JS.
- **Service** `analytics.service.ts` `getByCategory(...)`: resolve the profile-default currency the same way the sibling endpoints do (`usersRepository.findByIdScoped(...).defaultCurrency`; `NO_CURRENCY` → empty `categories: []`).
- **Currency/type semantics (D-2):** per-node `total` sums that node's subtree transactions in the profile-default currency **regardless of type** — because categories are single-typed (`transaction_categories.type`), each node's total is naturally one type. Expense categories' rolled-up totals therefore **reconcile exactly with `getCategoryBreakdown`** (the FR18 reconciliation AC); income categories are shown with their income totals (reference-consistent — the reference badges INCOME/EXPENSE). **No `type` query param** (RP-D1-adjacent: keep the contract minimal; do not re-open the 5.4 type-param question).
- **Regenerate + commit the generated client** (drift gate green, NFR6/D8): the new endpoint appears as `AnalyticsApiService.analyticsGetByCategory` with `ByCategoryResponseDto`/`ByCategoryNodeDto` in `packages/shared/src/generated/`.
- **Integration tests** (Testcontainers, `apps/api/test/integration/`): per-category rolled-up totals + counts match independently computed expectations (no float drift, decimal.js), roll-up correctness on a restructured hierarchy (child sums appear under the parent), **reconciliation with the breakdown endpoint** for expense categories, user-scoping (user A cannot read user B), and profile-default-currency scoping.

### Frontend — two routes reusing the transactions surface (D-4, D-5, D-6)

- **Landing** `apps/money-tracker/src/app/[locale]/transactions/by-category/page.tsx` (+ server wrapper + skeleton): RSC. Parse `period` from the URL (reuse the `period`/`MonthStepper` model — this is a `/transactions/*` sub-route), default via `resolveDefaultPeriod` (4.3 auto-fit), convert to `{ dateFrom, dateTo }` via `getMonthDateRange(parsePeriod(period))`. Guard with `resolveOnboardedProfile(locale)` + `setRequestLocale` (mirror `transactions/page.tsx`). Fetch the aggregation via a new `fetchTransactionsByCategory` `cache()` read → `AnalyticsApiService.analyticsGetByCategory`. Render `<MonthStepper period={period} />` in the header and a **`ByCategoryAccordion`** built from `buildCategoryHierarchy(categories)` using the `@supertool/ui` `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` molecule (Story 1.11): each top-level category is an `AccordionItem` whose trigger shows the category name + `formatAmount(total, currency, locale)` + a localized transaction-count; expanding reveals its child categories, each a row with its own name + total + count linking to the child's detail. The parent trigger also links to its own detail. Branch **error → empty (`currency === NO_CURRENCY` or `categories.length === 0`) → success**.
- **Detail** `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/page.tsx` (+ server wrapper + skeleton): RSC. Same onboarding/locale guard; carry the same `period` param (the "same period honoured" AC). Resolve the category name from the category list (`fetchCategoryList`) for the header + a back-link to the landing (preserving `period`). Fetch rows via the **existing** `fetchTransactions({ dateFrom, dateTo, categoryId, page, limit, sortBy: 'date', sortOrder: 'desc' })` (subtree-aware `categoryId` — child spend rolls up automatically). Render a slim transaction list reusing the transactions-feature presentational primitives (`formatAmount`, `getCategoryLabel`, `formatTransactionDate`, `Badge`) — a widget-local lean item like `DashboardRecentTransactions` (avoid `TransactionCard`'s list-only routing props) — plus `TransactionPagination`. Empty state (localized, both locales) when the category has no transactions in the period.
- **Enable the nav item:** in `AppShellSection.tsx` remove `disabled: true` from the `transactionsByCategory` child (the route constant `ROUTES.transactionsByCategory` and the `navigation.json` label `labels.transactionsByCategory` already exist in both locales — do NOT re-add them).
- **URL/period state (D-4):** reuse `period` (YYYY-MM) + `MonthStepper` + `parseTransactionsSearchParams`-style parsing + 4.3 `resolveDefaultPeriod`. `period` is carried landing → detail via the accordion links and the back-link so the same month is honoured. Pagination on the detail via the existing `PAGE_SEARCH_PARAM`. Write nav via the i18n `Link`/`router` from `@supertool/next-shared` (never `next/navigation`); never hardcode paths — use `ROUTES` + a `getTransactionsByCategoryDetailPath(id)` helper in `routes.ts`.
- **i18n:** new namespace `transactionsByCategoryPage` — add to `I18N_NAMESPACE` (`packages/shared/src/constants/i18n-namespace.ts`), map it in `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts`, and create `messages/en/transactions-by-category-page.json` + `messages/uk/transactions-by-category-page.json` (real Ukrainian, ICU, no concatenation). Keys: `title`, `transactionCount` (ICU plural), `categoryTotal`, `backToCategories`, `empty.*`, `error.*`, detail `title`/back-link. The nav label stays in `navigation.json` (already present).

## Acceptance Criteria

> **Currency model (settled 2026-06-15, RP-D1 — same as every dashboard widget):** all figures are ALWAYS in the user's profile-default currency (FR14). There is **NO currency picker/param/toggle** anywhere in this feature. `null` default currency (`NO_CURRENCY`) → the accordion shows its localized empty state, never a broken view. [Source: epics.md#Story-5.6; RP-D1]

1. **(AC1) New `GET /api/v1/analytics/by-category` endpoint — per-category totals + counts with roll-up, via the generated client.** The analytics module exposes a `by-category` endpoint that, for a period (`dateFrom`/`dateTo`), returns each of the authenticated user's categories with `{ categoryId, categoryName, parentId, type, total (string), transactionCount }` — a **parent's `total`/`transactionCount` roll up its whole subtree** (child spend included) — computed as **SQL aggregation** (D1 — no JS money math), scoped to the user (FR21) and the profile-default currency (`NO_CURRENCY` → empty). Layering is controller→service→repository (D7); the shared error envelope applies (D7/RP-D3); the generated client is **regenerated and committed** (drift gate green, NFR6/D8). Expense-category rolled-up totals **reconcile exactly with the `breakdown` endpoint** (FR18).

2. **(AC2) By-category landing renders an accordion of categories, each with a per-category total + transaction count.** At `/transactions/by-category`, the user's categories render as an **accordion** (top-level → children); **each node shows a per-category total** (`formatAmount(total, currency, locale)` from the string) **and transaction count** (localized ICU plural) — the totals/counts the reference omits (§5 exceeded). Data flows RSC → `fetch-*` (`cache()`, discriminated union) → generated `AnalyticsApiService` — **no hand-written `fetch`** (NFR6). The nav item for this route is enabled (the previously `disabled: true` `transactionsByCategory` entry). Money values render from **strings** via `formatAmount`; only `transactionCount` is a number.

3. **(AC3) Category detail lists that category's transactions with subtree roll-up, same period honoured.** Opening a category (`/transactions/by-category/[categoryId]`) shows that category's transactions — **child spend rolling up under a parent** — via the **existing** `transactionsFindAll` with its subtree-aware `categoryId` and the same period's `dateFrom`/`dateTo` (no new list endpoint). Rows are formatted via Intl/next-intl (D1 — amounts as strings, dates via `formatTransactionDate`, never ad-hoc), scoped to the user (FR21), paginated via the existing pagination. The **same period selection is honoured** between the accordion and the detail (carried in the URL `period` param; a back-link returns to the landing preserving `period`).

4. **(AC4) Empty states are localized (both locales).** A category (or the whole set) with no transactions in the period shows a localized empty state in `en` AND `uk` — the landing accordion when `categories.length === 0` or `currency === NO_CURRENCY`; the detail when the category has zero transactions for the period. Emptiness is decided on canonical checks (`categories.length === 0`, `total === '0.00'`, `transactions.data.length === 0`), never `Number(x) === 0` float coercion.

5. **(AC5) Mobile-usable at 390px (NFR8).** At a 390px viewport the accordion (landing) and the detail list are fully reachable and legible with **no horizontal overflow** (`document.documentElement.scrollWidth === window.innerWidth`), in both themes. Accordion triggers, per-category totals/counts, and row actions are touch-usable (not hover-only — §5, RP-U4). Layout is mobile-first.

6. **(AC6) Tests ship with the feature, both locales in the same commit (NFR1/FR19/FR20).**
   - **Backend (Testcontainers integration, `apps/api/test/integration/`):** per-category rolled-up totals + counts match independently computed expectations exactly (no float drift, decimal.js — FR18); roll-up correctness on a restructured hierarchy (child sums appear under the parent); **reconciliation with the breakdown endpoint** for expense categories; user-scoping (user A cannot read user B); profile-default-currency scoping (`NO_CURRENCY` → empty). Plus controller/service/DTO unit specs mirroring the top-categories specs.
   - **Frontend (Vitest + @testing-library/react, co-located):** the new `fetchTransactionsByCategory` action (mock `next/headers` cookies, `createServerApiClient`, SDK service; success + error arms); the `ByCategoryAccordion` (success / empty / error branches — assert localized labels + mapped totals/counts, tree structure from `buildCategoryHierarchy`); the detail list (success / empty; reuses `fetchTransactions`); any new `parse*SearchParams`/period handling. Never assert accordion internals beyond rendered labels/values.
   - Every new user-facing string exists in **both** `en` and `uk` `transactions-by-category-page.json` in the **same commit** (`pnpm i18n:parity` green). All gates green (`pnpm lint`, `type-check`, `test`, `fmt:check`, `stylelint`, `i18n:parity`, `build`; client-**drift** gate green after regen), run with `TURBO_FORCE=true` where turbo may replay stale cache.

7. **(AC7) Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/5-6-transactions-by-category/` contains screenshots named `<scenario>--<viewport>--<theme>.png` in **light + dark × 390px-mobile + desktop**, committed (NOT `/tmp`), covering at minimum: the by-category **landing accordion** on a data-rich period (e.g. Feb 2025) with a category **expanded** showing children + totals/counts; a **category-detail** view with its transaction list; and at least one **empty-state** capture. Captured against the current shell on the clean seed baseline (latest transaction = 2025-02-03). The Dev Agent Record records an evidence table + observations, confirms no 390px overflow in both themes, and includes a **reference-comparison note** vs `visual-qa/spike-reference-parity/reference/transactions--by-category*` / `transactions--category-detail*` — explicitly noting supertool **adds** the per-category totals+counts the reference lacks.

## Tasks / Subtasks

- [x] **Task 1 — New analytics `by-category` DTOs + query DTO** (AC: 1)
  - [x] `apps/api/src/modules/analytics/dtos/find-by-category-query.dto.ts` (+ `.spec.ts`) — copy `find-top-categories-query.dto.ts`, keep `dateFrom`/`dateTo` (required, `CALENDAR_DATE_PATTERN`, `dateTo >= dateFrom`), **drop `limit`** (uncapped). class-validator + @nestjs/swagger decoration (D3).
  - [x] `apps/api/src/modules/analytics/dtos/by-category-node.dto.ts` — `{ categoryId: string; categoryName: string; parentId: string | null; type: TransactionType; total: string; transactionCount: number }`. `total` is a **string** (D1); `type` from the shared `TransactionType` union (derive from the Drizzle schema, no TS enum).
  - [x] `apps/api/src/modules/analytics/dtos/by-category-response.dto.ts` — `{ categories: ByCategoryNodeDto[]; currency: string }`. [Source: analytics/dtos/top-categories-response.dto.ts pattern]

- [x] **Task 2 — Repository aggregation (SQL roll-up, decimal-safe)** (AC: 1, 6)
  - [x] `analytics.repository.ts` `getByCategoryTotals(userId, dateFrom, dateTo, currency)` — reuse the existing `WITH RECURSIVE category_roots` roll-up pattern from `getCategoryBreakdown`/`getTopCategories`, but aggregate **per category node**: each node's `total` = SQL sum of its subtree's transactions in the period + currency; `transactionCount` = count over the same subtree; amounts via `moneyCast()` (`::numeric(14,2)::text`). Return **all** user categories (empty ones → `'0.00'`/`0`). Roll-up is SQL only — never JS. Scope by `userId` (FR21) + `currency`.

- [x] **Task 3 — Service + controller wiring** (AC: 1)
  - [x] `analytics.service.ts` `getByCategory(userId, query)` — resolve profile-default currency via `usersRepository.findByIdScoped(...).defaultCurrency` (mirror `getTopCategories`); `NO_CURRENCY` → `{ categories: [], currency: NO_CURRENCY }`. Explicit `@Inject(...)` on every constructor dep (never `import type` an injectable). [Source: memory nest-di-explicit-inject]
  - [x] `analytics.controller.ts` — add `GET by-category` returning `ByCategoryResponseDto`, `@ApiResponse` documented, guard-protected like siblings. [Source: analytics.controller.ts top-categories route]

- [x] **Task 4 — Regenerate + commit the generated client** (AC: 1, 6)
  - [x] Run the client-generation turbo task; commit `packages/shared/src/generated/**` so `AnalyticsApiService.analyticsGetByCategory` + `ByCategoryResponseDto`/`ByCategoryNodeDto` exist. Drift gate green (no manual edits to generated files). [Source: architecture.md#D8; CLAUDE.md hard rule 2]

- [x] **Task 5 — Backend tests** (AC: 6)
  - [x] Controller/service/DTO unit specs mirroring `analytics.controller.spec.ts`/`analytics.service.spec.ts`/`find-top-categories-query.dto.spec.ts`.
  - [x] Testcontainers integration spec (`apps/api/test/integration/`): rolled-up totals+counts vs independently computed expectations (decimal.js, no float drift, FR18); roll-up on a restructured hierarchy; **reconciliation with `getCategoryBreakdown`** (expense categories); user-scoping; currency scoping (`NO_CURRENCY` → empty).

- [x] **Task 6 — Routes + fetch action (frontend reads, generated-client only)** (AC: 2, 3)
  - [x] `apps/money-tracker/src/constants/routes.ts` — add `getTransactionsByCategoryDetailPath(id)` helper (`${ROUTES.transactionsByCategory}/${id}`); `ROUTES.transactionsByCategory` already exists. *Preserve* existing.
  - [x] `apps/money-tracker/src/actions/fetch-transactions-by-category.ts` (+ `.test.ts`) — `cache()`, plain async (NOT `'use server'`), forward cookies via `createServerApiClient`, call `AnalyticsApiService.analyticsGetByCategory({ query: { dateFrom, dateTo } })`, return `{ status: 'success'; byCategory: ByCategoryResponseDto } | { status: 'error' }`. Mirror `fetch-top-categories.ts` exactly. Detail rows reuse the existing `fetch-transactions.ts` — **no new action**.

- [x] **Task 7 — By-category landing page + accordion** (AC: 2, 4, 5)
  - [x] `apps/money-tracker/src/app/[locale]/transactions/by-category/page.tsx` (+ `page.module.scss`) — RSC: `resolveOnboardedProfile(locale)` + `setRequestLocale`, parse `period` (reuse transactions parsing + `resolveDefaultPeriod` 4.3), `getMonthDateRange(parsePeriod(period))`, `<MonthStepper period={period} />`, `<Suspense>` (module-const skeleton) around a server wrapper that calls `fetchTransactionsByCategory`.
  - [x] `.../by-category/components/by-category-accordion/ByCategoryAccordion.tsx` (+ `.module.scss`, `.test.tsx`) — `FC<Props>`; branch error → empty (`NO_CURRENCY` / `categories.length === 0`) → success; build the tree with `buildCategoryHierarchy` (reuse `categories/utils/category-hierarchy.ts`); render `@supertool/ui` `Accordion` (`type="multiple"`) — top-level items with name + `formatAmount(total)` + count; expanded content lists child rows (name + total + count) each linking via `getTransactionsByCategoryDetailPath` (i18n `Link`, carry `period`); parent trigger also links to its own detail.
  - [x] `.../by-category/components/by-category-skeleton/ByCategorySkeleton.tsx` (+ `.module.scss`).

- [x] **Task 8 — Category-detail page + transaction list** (AC: 3, 4, 5)
  - [x] `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/page.tsx` (+ `page.module.scss`, skeleton) — RSC: same guards, carry `period` + `page`, resolve category name from `fetchCategoryList`, back-link to landing (preserve `period`), `<Suspense>` around a server wrapper calling `fetchTransactions({ dateFrom, dateTo, categoryId, page, limit, sortBy: 'date', sortOrder: 'desc' })`.
  - [x] `.../by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx` (+ `.module.scss`, `.test.tsx`) — `FC<Props>`; branch error → empty → success; slim widget-local row (reuse `formatAmount`, `getCategoryLabel`, `formatTransactionDate`, `Badge` — NOT `TransactionCard`'s list-routing props, per 5.5 D-5) + `TransactionPagination`.

- [x] **Task 9 — Enable nav item** (AC: 2)
  - [x] `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` — remove `disabled: true` from the `transactionsByCategory` child (leave the `recurring` sibling disabled — that's Epic-6/deferred). Do NOT touch the route constant or nav label (already present, both locales).

- [x] **Task 10 — i18n (both locales, same commit)** (AC: 2, 3, 4, 6)
  - [x] Add `transactionsByCategoryPage` to `I18N_NAMESPACE` (`packages/shared/src/constants/i18n-namespace.ts`) and map it in `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts`.
  - [x] Create `apps/money-tracker/messages/en/transactions-by-category-page.json` AND `messages/uk/transactions-by-category-page.json`: `title`, `transactionCount` (ICU plural), `categoryTotal`, `backToCategories`, `empty.{title,description}`, `error.{title,description}`, detail `title`. Real Ukrainian (not transliterated); ICU interpolation, no concatenation. `translate` (never `t`); namespace via `I18N_NAMESPACE`, never a string literal. [Source: rules/i18n.md]

- [x] **Task 11 — Frontend tests** (AC: 6)
  - [x] `fetch-transactions-by-category.test.ts` (mock `next/headers`, `createServerApiClient`, SDK service; success + error).
  - [x] `ByCategoryAccordion.test.tsx` (success/empty/error; assert localized labels, mapped totals via `formatAmount`, count plural, tree from `buildCategoryHierarchy`; mock `next-intl` identity `translate` with `.has`; mock the fetch action via `vi.hoisted`).
  - [x] `CategoryDetailList.test.tsx` (success/empty; reuses `fetchTransactions`).
  - [x] Any new `parse*`/period helper test. Run via pnpm scripts, `TURBO_FORCE=true` where cache may replay; retry the transient pnpm `H.replace` crash.

- [x] **Task 12 — Visual QA evidence (committed)** (AC: 5, 7)
  - [x] Pre-QA checklist (epic-4 retro Action #4): confirm the `:3000` next-server cwd is THIS checkout (`lsof`; memory `worktree-dev-server-stale-qa`); confirm seed baseline clean (latest txn 2025-02-03; `TRUNCATE` + re-seed if strays; memory `seed-idempotent-truncate-before-reseed`); sign in on `:3000` (trusted origins port-pinned).
  - [x] Capture `<scenario>--<viewport>--<theme>.png` into `_bmad-output/implementation-artifacts/visual-qa/5-6-transactions-by-category/`: landing accordion with a category expanded (data-rich Feb 2025), category-detail list, ≥1 empty-state — each light+dark × mobile(390)+desktop. Toggle theme via the real user-menu switcher; assert `scrollWidth === innerWidth` at 390px both themes. Record the evidence table + reference-comparison notes (supertool adds totals/counts the reference omits) in the Dev Agent Record.

- [x] **Task 13 — Gates** (AC: all)
  - [x] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm fmt:check`, `pnpm stylelint`, `pnpm i18n:parity`, `pnpm build` all green (`--force`/`TURBO_FORCE=true` to defeat stale turbo cache). **Client-drift gate green after regen** (Task 4). [Source: memory turbo-cache-masks-gate-results, run-tests-via-pnpm-scripts]

## Dev Notes

### What this story is (and is NOT)

- **IS:** ONE new analytics endpoint (`GET /api/v1/analytics/by-category`, per-category rolled-up totals+counts, SQL, string amounts) + DTOs + repository/service/controller + integration tests + client regen; a `/transactions/by-category` **landing** (accordion with totals/counts) and `/transactions/by-category/[categoryId]` **detail** (transaction list reusing `transactionsFindAll` subtree-aware `categoryId`); a new `fetchTransactionsByCategory` read; enabling the pre-existing nav item; a new i18n namespace (en+uk); component tests; committed visual-QA evidence.
- **IS NOT:** a new transactions-list endpoint (the detail **reuses** `transactionsFindAll`), a schema/migration change (RP-D5 bare `date`; categories already carry `type`/`parentId`), a currency picker (RP-D1), a `type` filter/param on the new endpoint, a bulk-delete surface (that is **Story 6.2**), an export button (that is **Story 6.3** — the reference detail page has one; do NOT add it here), or a new runtime dependency (Accordion molecule + recharts already exist).

### Decisions (recorded per unattended-run protocol — reference-consistent unless flagged)

- **D-1 — CENTRAL reuse-vs-new decision: split responsibility. NEW `GET /api/v1/analytics/by-category` aggregation endpoint for the accordion's per-category totals+counts; REUSE `transactionsFindAll` (subtree-aware `categoryId`) for the detail transaction rows.** Rationale: D1 forbids client-side money summing, so per-category totals MUST come from SQL. The existing analytics endpoints cannot supply per-node (parent AND child) totals+counts for all categories — `top-categories` is capped at `limit ≤ 20`, top-level-roll-up-only, expense-only; `breakdown` is top-level-only, expense-only. The epic AC "repository/module specs cover the per-category aggregation and roll-up (reconciling exactly with the dashboard breakdown, FR18)" explicitly anticipates a new SQL aggregation. The transaction-detail list needs **zero** backend change: `transactionsFindAll`'s `categoryId` is already subtree-aware server-side (Story 2.5 → `getCategorySubtreeIds`), so filtering by a parent rolls up descendants automatically. This maximizes reuse (one thin new endpoint, not two) while honouring D1.
- **D-2 — the endpoint returns ALL categories (income + expense), per-node `total` = subtree sum in the profile-default currency regardless of type; reconciliation is asserted for expense categories vs `breakdown`.** Categories are single-typed (`transaction_categories.type`), so each node's total is naturally one type; expense nodes reconcile exactly with `breakdown` (the FR18 AC), and income nodes are shown with their income totals — matching the reference, which badges INCOME/EXPENSE categories on the landing. **No `type` query param** — keeps the contract minimal and avoids re-opening the 5.4 D-6 type-param question. *Reference-consistent.*
- **D-3 — the aggregation lives in the ANALYTICS module (not the transactions module where the reference put its `by-category` endpoint); the detail rows reuse the transactions list.** supertool's analytics module owns per-category SQL aggregation (breakdown/top-categories precedent, D1). The reference bundled grouped transactions + per-currency totals into one `GET /transactions/by-category/:categoryId`; supertool splits concerns — aggregation (analytics, single profile-default currency per RP-D1) + transaction rows (the reused subtree-aware list). *Documented divergence from the reference, rationale: cleaner separation + single-currency model + reuse of the proven list.*
- **D-4 — URL/period state reuses `period` (YYYY-MM) + `MonthStepper` + 4.3 `resolveDefaultPeriod` auto-fit, NOT the dashboard's `{dateFrom,dateTo}` filter bar.** This is a `/transactions/*` sub-route; the transactions list already uses `period`/`MonthStepper`, so the drill-down matches that surface (shareable, back-button-safe, D9; first-run auto-fit preserved). `period` is carried landing → detail via accordion links + back-link so "the same period is honoured" (AC3). Parse to `dateFrom`/`dateTo` via `getMonthDateRange` for both the aggregation call and the detail `fetchTransactions`.
- **D-5 — landing = accordion (with totals/counts, exceeding the reference's total-less flat list); detail = flat transaction list.** The epic AC puts the accordion on the by-category **view** with per-node totals+counts, and the detail as that category's **transactions**. The reference inverts this (flat landing → accordion-of-subcategory-groups detail); supertool follows the epic AC literally and thereby **exceeds** the reference (§5: the reference landing shows no totals/counts). Detail rows reuse a slim widget-local item (5.5 D-5 precedent), not `TransactionCard`, to avoid list-route coupling.
- **D-6 — the endpoint returns a FLAT `{categoryId, categoryName, parentId, type, total, transactionCount}[]`; the client rebuilds the tree with the existing `buildCategoryHierarchy` util.** Reuses `apps/money-tracker/src/app/[locale]/categories/utils/category-hierarchy.ts` (no new tree logic, no nested DTO). Include all categories (zero ones carry `'0.00'`/`0`) so the accordion always renders the full two-level hierarchy.
- **D-7 — SQL roll-up reuses existing recursive-CTE patterns; no new algorithm.** The aggregation's parent roll-up follows the `category_roots` CTE already in `analytics.repository.ts`; the detail list's subtree filter reuses `getCategorySubtreeIds` in `transactions.repository.ts` (already subtree-aware, Story 2.5).
- **D-8 — export button and bulk-delete are OUT of scope.** The reference detail page carries an `ExportTransactionButton` and bulk-delete checkboxes; those map to **Story 6.3 (export)** and **Story 6.2 (bulk delete — explicitly "consistent across the by-date list AND the by-category view")**. Adding them here would pull Epic-6 scope forward. The by-category view is built here; Story 6.2 wires bulk-delete onto it later.

### D1 — money is strings end-to-end (merge-blocking)

Every monetary value — `total` per node in the new DTO, transaction `amount` in the detail — is a **string**; render via `formatAmount(amount, currency, locale)`. The ONLY numbers are `transactionCount` and pagination integers. **Never sum money in JS** — per-category totals and roll-up come from the new SQL aggregation (decimal-safe `numeric(14,2)`); the detail list shows individual transaction amounts (already strings from the API). Empty checks prefer canonical string comparison (`total === '0.00'`, `categories.length === 0`, `transactions.data.length === 0`). Backend arithmetic (reconciliation tests) uses decimal.js, never floats. [Source: CLAUDE.md hard rule 1; architecture.md#D1; 3-2/5-4 Dev Notes]

### Currency model — do NOT reintroduce a picker (RP-D1)

All figures are in `users.defaultCurrency`. No currency control, param, or fallback anywhere in this feature. `null` default → `NO_CURRENCY` → localized empty state. This diverges deliberately from the reference's per-currency totals groups. [Source: epics.md Epic 5; RP-D1; memory currency-simplified-single-default]

### Architecture compliance (guardrails)

- **API layering (D7):** controller → service → repository; the repository is the only DB-touching layer; no layer skipping. Explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable (SWC drops the metadata under Vitest). [Source: CLAUDE.md; memory nest-di-explicit-inject]
- **Generated client only (NFR6/D8):** the frontend consumes the new endpoint exclusively via `AnalyticsApiService.analyticsGetByCategory`; the detail via `TransactionsApiService.transactionsFindAll`. Regenerate + commit the client; a hand-written `fetch('/api/...')` is a defect; the drift gate must stay green.
- **Read path (D9):** RSC → `fetch-*` (plain async wrapped in `cache()`, NOT `'use server'`) → generated client (cookie forwarded via `createServerApiClient`) → API. No mutations in this story. [Source: architecture.md#read-path; rules/react.md#RSC]
- **URL state (D9):** `period` (+ `page`) search params; write nav via `Link`/`router` from `@supertool/next-shared` i18n navigation (never `next/navigation`); `<Suspense key>` derived from `period`/`categoryId` to reset boundaries. Never hardcode route literals — use `ROUTES` + the new detail-path helper. [Source: rules/react.md#State-Management; architecture.md#D9]
- **Component boundaries:** the pages/components live in `apps/money-tracker`, composing `@supertool/ui` primitives (`Accordion`, `Card`, `Typography`, `Badge`). `FC<Props>` typing on every component (manual — not lint-enforced; verify in review). One schema file per table (no schema change here). [Source: architecture.md#component-boundaries; memory fc-props-convention-not-lint-enforced]
- **Dates:** `YYYY-MM-DD` strings, no timezone math (RP-D5); dates via `formatTransactionDate(date, locale)`, never ad-hoc `toLocaleDateString`. [Source: architecture.md#Dates]
- **SCSS:** M3 design tokens only (stylelint-enforced — no hardcoded hex), camelCase classes, mobile-first, `.module.scss` co-located PascalCase. Reuse token language: income `--on-success-container`, expense `--error`, surfaces `--surface-container`/`--outline-variant`. [Source: memory follow-example-repo-patterns; 5-5 Dev Notes]

### Source tree — files to touch

**API (NEW):**
- `apps/api/src/modules/analytics/dtos/find-by-category-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/analytics/dtos/by-category-node.dto.ts`
- `apps/api/src/modules/analytics/dtos/by-category-response.dto.ts`
- `apps/api/test/integration/analytics-by-category.integration.spec.ts` (or extend the existing analytics integration spec)

**API (UPDATE):**
- `apps/api/src/modules/analytics/analytics.repository.ts` — add `getByCategoryTotals(...)` (reuse `category_roots` CTE + `moneyCast`). *Preserve* existing methods.
- `apps/api/src/modules/analytics/analytics.service.ts` (+ `.spec.ts`) — add `getByCategory(...)` (profile-currency resolution mirror). *Preserve* existing.
- `apps/api/src/modules/analytics/analytics.controller.ts` (+ `.spec.ts`) — add `GET by-category`. *Preserve* existing routes.

**Generated client (UPDATE — regenerated, committed, not hand-edited):**
- `packages/shared/src/generated/**` — `analyticsGetByCategory` + `ByCategoryResponseDto`/`ByCategoryNodeDto`.

**Shared (UPDATE):**
- `packages/shared/src/constants/i18n-namespace.ts` — add `transactionsByCategoryPage`.

**App (NEW):**
- `apps/money-tracker/src/actions/fetch-transactions-by-category.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/page.tsx` (+ `page.module.scss`)
- `.../by-category/components/by-category-accordion/ByCategoryAccordion.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../by-category/components/by-category-skeleton/ByCategorySkeleton.tsx` (+ `.module.scss`)
- `.../by-category/[categoryId]/page.tsx` (+ `page.module.scss`)
- `.../by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../by-category/[categoryId]/components/category-detail-skeleton/CategoryDetailSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/messages/en/transactions-by-category-page.json` + `messages/uk/transactions-by-category-page.json`

**App (UPDATE):**
- `apps/money-tracker/src/constants/routes.ts` — add `getTransactionsByCategoryDetailPath(id)`. *Preserve* existing.
- `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` — remove `disabled: true` from the `transactionsByCategory` nav child. *Current state:* the child is present but `disabled: true` (route + `navigation.json` label already exist, both locales). *Preserve* the `recurring` child's `disabled: true` (Epic 6/deferred).
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — map the new namespace to `transactions-by-category-page.json`.

**Do NOT touch:** any DB schema/migration (no change — RP-D5, categories already typed/parented); `MonthStepper` (reuse as-is); `transactions/page.tsx` list (reuse `fetchTransactions`); the dashboard (unrelated); `packages/ui` Accordion (reuse as-is).

### Reference patterns (study before implementing — `example/track-my-life` / `example/tracker-backend-api`, reference-only ED1)

- **Frontend by-category:** `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/by-category/page.tsx` + `page.content.tsx` (landing — flat list of category links, **no totals/counts**), `[categoryId]/page.tsx` + `page.content.tsx` (detail — accordion of subcategory groups with per-currency totals), `actions/fetch-transactions-by-category.ts`. **Adapt, never copy (ED1):** put the accordion on the **landing** with per-node totals+counts (exceed §5), single profile-default currency (drop per-currency groups, RP-D1), reuse supertool's subtree-aware `transactionsFindAll` for detail rows, apply `formatAmount`/`translate`/`FC<Props>`/token conventions, and OMIT the reference's export button + bulk-delete (D-8).
- **Backend by-category:** `example/tracker-backend-api/src/modules/transactions/` (`@Get('by-category/:categoryId')`, `getTransactionsByCategory`, `TransactionsByCategoryResponseDto`) — **shape to adapt** for the aggregation semantics (grouped, per-currency totals, `Decimal`). supertool diverges: analytics module, single currency, per-node totals+counts, flat DTO (D-3, D-6).
- **Accordion molecule:** `example/track-my-life/packages/ui/src/components/molecules/accordion/accordion.tsx` — supertool's equivalent already exists at `packages/ui/src/components/molecules/accordion/Accordion.tsx` (Story 1.11) — reuse it, do not re-create.
- Reference captures `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--by-category--{desktop,mobile}.png`, `transactions--category-detail--desktop.png` — the visual parity target for AC7 comparison notes.

### Local patterns to reuse (do NOT reinvent)

- **Analytics endpoint (controller/service/repo/DTO/spec):** `analytics.{controller,service,repository}.ts` + `dtos/{find-top-categories-query,top-category-item,top-categories-response}.dto.ts` + the co-located specs — the exact template for the new endpoint (roll-up CTE, `moneyCast`, profile-currency resolution, `NO_CURRENCY` handling). [Source: 5-4 story]
- **Subtree-aware list filter:** `transactions.repository.ts` `getCategorySubtreeIds` + `findAllByUserId` (Story 2.5) — already powers `transactionsFindAll?categoryId=` roll-up; reuse via the frontend `fetchTransactions`.
- **Fetch action (RSC read):** `actions/fetch-top-categories.ts` — copy for `fetch-transactions-by-category.ts` (`cache()`, `createServerApiClient`, discriminated union). Detail rows reuse `actions/fetch-transactions.ts` (`FetchTransactionsParams` supports `dateFrom`/`dateTo`/`categoryId`/`page`/`limit`/`sortBy`/`sortOrder`).
- **Tree build:** `categories/utils/category-hierarchy.ts` — `buildCategoryHierarchy(list) → { topLevelList, childrenByParentId }`; `getDescendantIdSet` if needed. `fetchCategoryList()` (`actions/fetch-category-list.ts`) for the detail header's category name.
- **Accordion primitive:** `@supertool/ui/src/components/molecules/accordion/Accordion` — `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (usage example: `categories/components/category-tree/CategoryTree.tsx`).
- **Transaction-row primitives:** `utils/format-amount.ts` (`formatAmount(amount, currency, locale)`), `transactions/utils/{format-transaction-date,get-category-label}.ts`, `@supertool/ui` `Badge`; the lean-item pattern from `dashboard/components/dashboard-recent-transactions/DashboardRecentTransactions.tsx` (avoid `TransactionCard` list-routing props); `transactions/components/transaction-pagination/TransactionPagination.tsx`; empty/error via `transaction-empty-state`/`transaction-error` or a page-local variant.
- **Period + URL state:** `utils/period.ts` (`getMonthDateRange`, `parsePeriod`), `utils/resolve-default-period.ts` (4.3 auto-fit), `components/month-stepper/MonthStepper.tsx`, `transactions/utils/parse-transactions-search-params.ts` + `transactions/constants.ts` + `src/constants/search-params.ts` (`PERIOD_SEARCH_PARAM`, `PAGE_SEARCH_PARAM`).
- **Shared constants:** `NO_CURRENCY` (`@supertool/shared/constants/currency`), `CALENDAR_DATE_PATTERN` (`@supertool/shared/constants/transaction-validation`), `I18N_NAMESPACE` (`@supertool/shared/constants/i18n-namespace`), page-size constants. [Source: memory shared-constants-no-duplication]
- **Onboarding/locale guard:** `resolveOnboardedProfile(locale)` + `setRequestLocale` as used in `transactions/page.tsx` and `dashboard/page.tsx`.

### Coding conventions (merge-blocking subset)

- No comments — self-documenting names; follow-up work goes in story/epic files. Arrow functions; `get`/`fetch`/`check`/`format`/`parse` prefixes; array vars carry `List` suffix; `UPPER_SNAKE_CASE` constants.
- `FC<Props>` typing on every component; `on*` callback props / `handle*` handlers; curly braces for handler bodies. Named exports, one export per file, no barrels. No `as` except `as const`; no TS enums (derive unions).
- Files/dirs kebab-case; component files + co-located `.module.scss`/`.test.tsx` PascalCase after the component. `cn` from `@supertool/ui` for conditional classes. `translate` (never `t`); namespace via `I18N_NAMESPACE`, never a string literal.
- API: `/api/v1/...`, camelCase JSON, shared error envelope, DELETE → 204 (n/a here). NestJS explicit `@Inject`; DTOs decorated for OpenAPI (D3).
- Tests ship in the SAME story (NFR1). Exact dependency versions; never introduce eslint/prettier; **no new dependency expected** (Accordion + recharts exist). [Source: CLAUDE.md; rules/javascript.md, react.md, typescript.md, nestjs-apis.md, i18n.md]

### Testing standards

- **API:** Vitest + SWC decorators, co-located `*.spec.ts`; Testcontainers integration in `apps/api/test/integration/` against real Postgres. Assert decimal-safe totals (decimal.js), roll-up, breakdown-reconciliation, user-scoping, currency-scoping. Run via pnpm scripts only. [Source: architecture.md#D10; 5-4 Dev Notes]
- **Frontend:** Vitest + `@testing-library/react` + jsdom, co-located `*.test.tsx`, `pnpm --filter money-tracker test`; `TURBO_FORCE=true` to defeat stale cache; retry the transient pnpm `H.replace` crash. Mock `next-intl` (identity `translate` with `.has`), actions via `vi.hoisted`, `next/headers` cookies + `createServerApiClient` + SDK service for action tests. Assert localized labels + mapped totals/counts, never DOM internals of Radix accordion beyond rendered text/values.
- i18n parity gate must be green (every new key in both locales, same commit).
- **Visual QA is a first-class deliverable** (epic-4 retro D1): committed screenshots, not `/tmp`; green gates + green axe are NOT sufficient. [Source: 5-5 Dev Agent Record; memory ui-stories-need-visual-qa, visual-qa-via-playwright-cli]

### Previous-work intelligence

- **Story 2.5** shipped the subtree-aware `categoryId` filter on the transactions list (`getCategorySubtreeIds`) — the detail list's roll-up is free reuse.
- **Story 5.4** shipped `top-categories`/`daily-spending` analytics endpoints — the exact controller/service/repository/DTO template for the new `by-category` endpoint (roll-up CTE, `moneyCast`, profile-currency resolution, `NO_CURRENCY`). Its D-6 deferred an analytics `type` param — this story does NOT add one (D-2).
- **Story 5.5** shipped the dashboard widgets + the `fetch-top-categories` read + the CSS share-bar + the committed-visual-QA format (`visual-qa/<story>-<slug>/`, `<scenario>--<viewport>--<theme>.png`) + the slim recent-transactions row (5.5 D-5 — reuse for the detail rows) + the 390px `scrollWidth === innerWidth` check. Review left non-blocking patches (empty-date reset, float-coercion emptiness in inherited summary) — do NOT repeat: use canonical string emptiness checks here.
- **Story 1.11** shipped the `Accordion` molecule (reuse). **Story 4.3** shipped `resolveDefaultPeriod` auto-fit (preserve as the landing/detail default period).
- **Nav item + route + label already exist** (`AppShellSection.tsx` child `disabled: true`, `ROUTES.transactionsByCategory`, `navigation.json labels.transactionsByCategory` in en+uk) — enable, don't re-create.

### Git intelligence (recent commits)

`30d1da9` 5-2 import page · `e5fb03c` 5-1 import endpoints · 5-4 analytics endpoints (PR #37, client committed) · 5-5 dashboard widgets (PR #38, merged; sprint-status edit rides into this branch). Pattern: analytics stories add a sibling endpoint (controller/service/repo/DTO + specs) and regenerate the client; frontend stories add sibling widgets/pages + co-located tests + committed visual QA. This story does **both** (one endpoint + a two-route frontend) — the last of Epic 5. Client-drift gate WILL require a regen (Task 4) because the API contract changes.

### Project Structure Notes

- Aligns with `architecture.md`: the analytics module gains a `by-category` endpoint alongside summary/breakdown/trend/top-categories/daily-spending; the money-tracker app gains a `transactions/by-category` route subtree. Dependency direction respected (`shared` generated client → app; `ui` Accordion → app; API owns aggregation). One schema file per table — **no schema change** (RP-D5 bare `date`; `transaction_categories` already carries `type`/`parentId`).
- Variance: the reference places `by-category` in the transactions module and bundles grouped transactions + per-currency totals; supertool places aggregation in the analytics module (single profile-default currency) and reuses the transactions list for rows (D-3). Recorded, rationale given.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.6-Transactions-By-Category-Drill-Down] · [#Epic-5-Import-Your-Data-and-See-Your-Money] · [#RP-F4] · [#RP-D1 currency single-default] · [#RP-D5 bare date] · [#Reference-defects-§5 by-category shows no totals/counts]
- [Source: _bmad-output/planning-artifacts/architecture.md#D1-money-strings] · [#D7-controller-service-repository] · [#D8-contract-pipeline] · [#D9-RSC-server-actions read-path] · [#component-boundaries] · [#Naming] · [#Format-Patterns money/dates/i18n]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#FR14 currency] · [#FR18 decimal-safe] · [#FR19,FR20 i18n] · [#FR21 user-scoping] · [#NFR1 tests] · [#NFR6 generated client] · [#NFR8 mobile]
- [Source: CLAUDE.md#Hard-rules] · [.claude/rules/react.md] · [.claude/rules/nestjs-apis.md] · [.claude/rules/i18n.md] · [.claude/rules/javascript.md] · [.claude/rules/typescript.md]
- [Source: _bmad-output/implementation-artifacts/5-4-dashboard-analytics-endpoints-top-categories-daily-spending.md — analytics endpoint template + D-6 type-param deferral]
- [Source: _bmad-output/implementation-artifacts/5-5-dashboard-widgets-top-categories-daily-spending-recent-transactions-filter-bar.md — fetch-* read, slim row (D-5), visual-QA format, canonical-emptiness]
- [Source: _bmad-output/implementation-artifacts/2-5-filter-sort-the-list.md — subtree-aware categoryId filter] · [4-3-first-run-period-auto-fit.md — resolveDefaultPeriod] · [1-11 — Accordion molecule]
- [Source: apps/api/src/modules/analytics/** — controller/service/repository/dtos to extend] · [apps/api/src/modules/transactions/transactions.repository.ts — getCategorySubtreeIds]
- [Source: apps/money-tracker/src/app/[locale]/transactions/** — list page + primitives + parse-transactions-search-params] · [.../categories/utils/category-hierarchy.ts — buildCategoryHierarchy] · [.../dashboard/components/dashboard-recent-transactions/ — slim row pattern]
- [Source: apps/money-tracker/src/actions/{fetch-top-categories,fetch-transactions,fetch-category-list}.ts] · [src/constants/routes.ts] · [src/app/[locale]/AppShellSection.tsx — nav item to enable]
- [Source: packages/ui/src/components/molecules/accordion/Accordion.tsx] · [packages/shared/src/{generated/{sdk.gen,types.gen}.ts,constants/{currency,i18n-namespace,transaction-validation}.ts}]
- [Source: _bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--by-category--{desktop,mobile}.png, transactions--category-detail--desktop.png — parity target]
- [Source: example/track-my-life/apps/money-tracker/.../transactions/by-category/** + example/tracker-backend-api/src/modules/transactions/ by-category endpoint — reference to adapt, ED1]

## Review Findings

Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), diff `1e5fa02..HEAD`, 2026-07-05. Verdict: **APPROVE** — no MUST-FIX findings. All 7 ACs met; hard rules (D1 money-strings, NFR6 generated-client-only, D7 layering, FR19/FR20 i18n parity, NFR1 tests, NFR2 no-new-dep, ED1 no example imports) all clean. SQL roll-up verified correct (subtree closure, no double-count, user/currency/period scoping, decimal-safe breakdown reconciliation).

Nice-to-have follow-ups (none merge-blocking):

- [ ] [Review][Patch] Out-of-range `?page=` on the detail view shows the "no transactions" empty state before `TransactionPagination`, leaving no in-page control to recover (reachable only via stale/shared URLs; browser-back works) [apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx:61]
- [ ] [Review][Patch] Landing empty-state copy implies period-based emptiness, but `categories.length === 0` only fires for a user with no categories / `NO_CURRENCY`; a zero-transaction month renders every category at `0.00` (intentional per D-6, but copy could mislead) [apps/money-tracker/messages/en/transactions-by-category-page.json]
- [ ] [Review][Patch] Landing accordion shows no income/expense type indicator; income and expense totals sit intermixed alphabetically looking identical (the detail list badges type; the reference badges INCOME/EXPENSE) [apps/money-tracker/src/app/[locale]/transactions/by-category/components/by-category-accordion/ByCategoryAccordion.tsx:89]
- [ ] [Review][Patch] Childless top-level category still renders an expand affordance opening an empty panel (cosmetic; detail chevron is the meaningful action) [apps/money-tracker/src/app/[locale]/transactions/by-category/components/by-category-accordion/ByCategoryAccordion.tsx:113]
- [x] [Review][Defer] Accordion renders only 2 levels; 3rd-level categories are not individually navigable — consistent with the existing `CategoryTree` (also 2-level) and D-6; grandchild spend still rolls up into ancestor totals and is reachable via the subtree-aware detail page — deferred, conscious/pre-existing convention
- [x] [Review][Defer] Task 10's "detail `title`" bullet is stale — no `detail.title` key was created; the detail heading derives from the resolved category name with a `translate('title')` fallback, so i18n parity is intact — deferred, story-file cosmetics only

Dismissed as false positives (verified against project code): (1) "detail list does not roll up subtree" — `transactionsFindAll` IS subtree-aware via `getCategorySubtreeIds` (transactions.repository.ts:246); (2) "type-divergent transactions vanish from the roll-up" — `assertCategoryMatchesType` (transactions.service.ts:114) enforces `transaction.type === category.type` on create/update, and `assertSameType` enforces child-type === parent-type, so the `t.type = c.type` join never drops legitimate rows; (3) "type-scoping narrows AC1" — pre-approved by D-2 and required for FR18 reconciliation; (4) ">100-level depth cap divergence" — unreachable in practice.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Gates (all green, `TURBO_FORCE=true` on turbo-backed tasks): `pnpm type-check` (9/9), `pnpm lint` (0 errors), `pnpm stylelint`, `pnpm fmt:check` (598 files), `pnpm i18n:parity` (OK), `pnpm test` (API 278 tests incl. 9 new by-category integration tests + all money-tracker tests; 8/8 test tasks), `pnpm build` (4/4 — both new routes emitted), client-drift (idempotent regen → only the 3 expected generated files changed).
- Lint fixes applied during dev: `new-cap` on component-in-test calls → aliased renderers (`renderAccordion`/`renderList`, mirroring the 5.5 `DashboardTopCategories` test); `no-map-spread` on the hierarchy mapping → module-level `toHierarchyNode`; `max-statements` on the accordion/detail page/integration fixtures → extracted module-level helpers (`buildDetailHref`, `insertFixtureCategories`, `buildFixtureTransactionList`, `expectNode`); duplicate `next-intl/server` import merged.

### Completion Notes List

- **Backend (AC1):** Added `GET /api/v1/analytics/by-category` (controller→service→repository, D7). Repository `getByCategoryTotals` uses a `WITH RECURSIVE category_subtree` CTE mapping every node to its own subtree (self + all descendants), left-joined to transactions and grouped per node — so each node's `total`/`transactionCount` roll up its whole subtree. `total` is SQL-cast to string via the existing `moneyCast()` (`::numeric(14,2)::text`); only `transactionCount` is a number (D1). Returns ALL user categories (zero ones → `'0.00'`/`0`) so the accordion always renders the full hierarchy (D-6).
- **Type-scoped roll-up (D-2 implementation note):** the transactions join is scoped `AND t.type::text = c.type::text`. Rationale: `getCategoryBreakdown` sums expense-only within a top-level root; the seed/fixture legitimately places an income transaction under an expense root, so an unfiltered subtree sum would break the FR18 reconciliation. Scoping each node to its own (single) type makes expense-node totals reconcile **exactly** with the breakdown endpoint while income nodes show their income totals — matching D-2's "each node's total is naturally one type".
- **Detail list is pure reuse (D-1):** the `[categoryId]` detail page reuses the existing subtree-aware `transactionsFindAll` via `fetchTransactions({ categoryId, dateFrom, dateTo, ... })` — no new list endpoint. Verified in visual QA: transactions of child "Такси" roll up under parent "Транспорт".
- **`buildCategoryHierarchy` generalized:** made generic over `{ id; parentId }` (default `CategoryResponseDto`) so the accordion reuses the existing tree util with the flat by-category nodes (D-6). Existing callers (`CategoryTree`, category-form/delete hooks) unchanged and still green.
- **i18n:** new `transactionsByCategoryPage` namespace registered + mapped; `en`/`uk` files created with real Ukrainian and an ICU plural for `transactionCount`; `pnpm i18n:parity` green. Nav item enabled (removed `disabled: true`); route/label already existed.
- **Landing empty-state reachability:** because the endpoint returns the full hierarchy, `categories.length === 0` only occurs for a user with no categories / `NO_CURRENCY` (covered by unit tests). The genuinely user-reachable empty UI in a data-less period is the **detail** empty state; both are captured in visual QA.

#### Visual QA (AC5, AC7) — evidence in `_bmad-output/implementation-artifacts/visual-qa/5-6-transactions-by-category-drill-down/`

Pre-QA checklist: confirmed the `:3000` (money-tracker) and `:3001` (api) dev servers run with cwd in THIS checkout (not a stale worktree). DB baseline verified intact before AND after (1880 transactions, latest `2025-02-03`, 110 categories, operator `defaultCurrency=UAH`, `onboarding_completed=true`) — no truncate/reseed needed. Signed in at `:3000` with the seeded operator (`operator@supertool.local`). Theme toggled via the `theme` localStorage key that the user-menu switcher writes (next-themes `data-theme`).

| Scenario | Viewport | Themes | File |
| --- | --- | --- | --- |
| Landing accordion, top-level categories expanded (Feb 2025, per-node totals + counts) | desktop 1440 + mobile 390 | light + dark | `landing-expanded--{desktop,mobile}--{light,dark}.png` |
| Category detail (Транспорт, subtree roll-up of "Такси" transactions, Feb 2025) | desktop 1440 + mobile 390 | light + dark | `detail--{desktop,mobile}--{light,dark}.png` |
| Detail empty state ("No transactions in this category", Jan 1990) | desktop 1440 + mobile 390 | light + dark | `detail-empty--{desktop,mobile}--{light,dark}.png` |
| Zero-spend period landing (all categories at UAH 0.00 / "No transactions", Jan 1990) | desktop 1440 + mobile 390 | light + dark | `zero-period-landing--{desktop,mobile}--{light,dark}.png` |

- **No horizontal overflow at 390px** in both themes: `document.documentElement.scrollWidth === window.innerWidth === 390` verified on the landing and detail pages, light and dark.
- **Reference comparison:** vs `visual-qa/spike-reference-parity/reference/transactions--by-category*` / `transactions--category-detail*` — supertool **adds** the per-category **total + transaction count on every node** (parent and child) that the reference's flat by-category list omits (§5 defect exceeded, RP-F4). Divergence per D-3/D-5: supertool puts the accordion (with totals/counts) on the **landing** and a flat transaction list on the **detail**, single profile-default currency (no per-currency groups, RP-D1), and omits the reference's export button + bulk-delete (deferred to Stories 6.3/6.2, D-8).

### File List

**API (new):**
- `apps/api/src/modules/analytics/dtos/find-by-category-query.dto.ts`
- `apps/api/src/modules/analytics/dtos/find-by-category-query.dto.spec.ts`
- `apps/api/src/modules/analytics/dtos/by-category-node.dto.ts`
- `apps/api/src/modules/analytics/dtos/by-category-response.dto.ts`
- `apps/api/test/integration/analytics-by-category.integration.spec.ts`

**API (updated):**
- `apps/api/src/modules/analytics/analytics.repository.ts` — added `getByCategoryTotals`
- `apps/api/src/modules/analytics/analytics.service.ts` — added `getByCategory`
- `apps/api/src/modules/analytics/analytics.service.spec.ts` — by-category service specs
- `apps/api/src/modules/analytics/analytics.controller.ts` — added `GET by-category`
- `apps/api/src/modules/analytics/analytics.controller.spec.ts` — by-category controller spec

**Generated client (regenerated, committed):**
- `packages/shared/src/generated/sdk.gen.ts`, `types.gen.ts`, `index.ts` — `analyticsGetByCategory` + `ByCategoryResponseDto`/`ByCategoryNodeDto`

**Shared (updated):**
- `packages/shared/src/constants/i18n-namespace.ts` — `transactionsByCategoryPage`

**App (new):**
- `apps/money-tracker/src/actions/fetch-transactions-by-category.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/components/by-category-accordion/ByCategoryAccordion.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/components/by-category-skeleton/ByCategorySkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/components/category-detail-skeleton/CategoryDetailSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/messages/en/transactions-by-category-page.json`
- `apps/money-tracker/messages/uk/transactions-by-category-page.json`

**App (updated):**
- `apps/money-tracker/src/constants/routes.ts` — `getTransactionsByCategoryDetailPath`
- `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` — enabled the `transactionsByCategory` nav child
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — mapped the new namespace
- `apps/money-tracker/src/app/[locale]/categories/utils/category-hierarchy.ts` — generalized `buildCategoryHierarchy`/`getDescendantIdSet` to a generic node

**Visual QA evidence (new):**
- `_bmad-output/implementation-artifacts/visual-qa/5-6-transactions-by-category-drill-down/*.png` (16 captures)

**Sprint tracking:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 5-6 → review

### Change Log

| Date | Change |
| --- | --- |
| 2026-07-05 | Implemented Story 5.6: new `analytics/by-category` aggregation endpoint (SQL subtree roll-up, string totals, decimal-safe, breakdown-reconciling) + regenerated client; `/transactions/by-category` landing accordion (per-node totals + counts) and `/transactions/by-category/[categoryId]` detail (reusing subtree-aware `transactionsFindAll`); new `transactionsByCategoryPage` i18n namespace (en+uk); enabled nav item; unit + integration + component tests; committed visual QA (both themes × 390/desktop). All gates green. Status → review. |
