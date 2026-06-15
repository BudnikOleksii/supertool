---
baseline_commit: 3198cc0
---

# Story 2.5: Filter & Sort the List

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to filter my transactions by type and category, and sort by date or amount,
so that I can find and inspect exactly the records I care about (FR9).

This is the **last story of Track A** (the transactions module). It **extends the existing read path built in 2.2** — `GET /api/v1/transactions` (`FindTransactionsQueryDto` → service → repository), the `/transactions` page, `parse-transactions-search-params`, `fetch-transactions`, `MonthStepper`, `TransactionListServer`, and the empty state — to add server-side **filters** (`type`, `categoryId`) and **sorting** (`sortBy=date|amount`, `sortOrder=asc|desc`), all carried in **camelCase URL search params**. It also **lands the within-month pagination UI explicitly deferred from 2.2** (the `page` param is already parsed/sent/Suspense-keyed but no control renders and `meta.total` is never read). It adds **no new endpoint** — only new query params on the existing one — and **no new transactions table columns**.

**Scope note (decided 2026-06-15):** FR9 names a currency filter, but currency is being simplified product-wide — a user picks one default currency at onboarding and uses it everywhere — so **there is no currency filter** in this story. The currency *column* still renders in the list; it is just not a filter dimension. The **category filter includes descendants**: selecting a parent category returns transactions in that parent *and* its child categories.

## Acceptance Criteria

**AC1 — Filters + sorting applied server-side on the existing endpoint (FR9, D7, D1, FR21, NFR6)**
**Given** the existing `transactions` module,
**When** `GET /api/v1/transactions` is called with any of `type` (`income`/`expense`), `categoryId`, `sortBy` (`date`/`amount`), `sortOrder` (`asc`/`desc`) **in addition to** the existing `dateFrom`/`dateTo`/`page`/`limit`,
**Then** the repository (the only DB-touching layer, D7) applies the `type` filter as an `eq` condition and the `categoryId` filter as a **subtree match** (the selected category **and its descendant category ids**, resolved user-scoped — so picking a parent returns its children's transactions too), every condition added **after** the always-present `eq(transactions.userId, userId)` scope (FR21); orders by the chosen column + direction with `desc(transactions.id)` retained as the **stable tiebreaker**; returns `{ data, meta: { page, limit, total } }` with amounts as **strings** (D1); and `total` reflects the **filtered** count (same `whereClause` on data + count queries). The new params reach the endpoint through the **regenerated generated client** (drift gate green, NFR6/D8). **No `currency` filter param exists.**

**AC2 — All filter/sort/page state travels via camelCase URL search params; defaults are stable (D9/D7)**
**Given** the `/transactions` view,
**When** I apply a filter, change the sort, or page within a month,
**Then** the state is written to **camelCase** search params (`?type=&categoryId=&sortBy=&sortOrder=&page=&period=`) via `router.replace` (shareable, back-button-safe — D9), the RSC re-fetches, and the URL is the single source of truth (no client list state). With **no** sort params present the list defaults to `sortBy=date`, `sortOrder=desc` (matching today's behavior). Applying or clearing any filter, or changing the sort, **resets `page` to 1**.

**AC3 — Filters persist across month navigation (FR9 + AC continuity)**
**Given** one or more active filters/sort,
**When** I step to the previous/next month with the `MonthStepper`,
**Then** the active `type`/`categoryId`/`sortBy`/`sortOrder` params **persist** (only `period` changes and `page` resets to 1) — stepping months never silently drops filters. The list then honors **every** active criterion against the new month window.

**AC4 — Within-month pagination UI (closes the 2.2 deferral)**
**Given** a month/filter combination whose filtered `total` exceeds `TRANSACTIONS_PAGE_SIZE` (50),
**When** the list renders,
**Then** a pagination control (the `@supertool/ui` `Pagination` molecule) renders using `meta.{page,limit,total}`, prev/next update the `page` search param (preserving all other params), and rows beyond page 1 become reachable. When filtered `total ≤ limit` the control renders nothing (the molecule already returns `null` for a single page). `page` is bounded server-side (`@Max`) so an out-of-range `?page=N` cannot produce an unbounded `OFFSET`.

**AC5 — Empty state distinguishes "empty month" from "no matches" (FR19/FR20)**
**Given** a filtered view with zero results,
**When** it is viewed,
**Then** the empty state distinguishes **"no transactions this month"** (no filters active) from **"nothing matches the filters"** (one or more filters active), with a **clear-filters** affordance shown in the no-matches case. Both copy variants exist in **both** `en` and `uk` in the same commit (FR19/FR20 key-parity gate).

**AC6 — Filter & sort controls are localized, responsive, and use design-system primitives (NFR8, FR19)**
**Given** the filter/sort UI,
**When** it renders,
**Then** it is built from `@supertool/ui` primitives (`Select` atom for type/sort; `Combobox` molecule for category — searchable), all labels/placeholders/aria-labels are localized in both locales (no concatenation; ICU interpolation), and the layout is responsive via the shared breakpoint mixins + design tokens (NFR8 — no ad-hoc `@media`/literals). The category options are fetched server-side (`fetchCategoryList`) and passed in; they show "Parent / Child" labels like the form's category picker (selecting a parent filters its whole subtree per AC1).

**AC7 — Tests merge with the story (NFR1, D10)**
**Given** the feature,
**When** tests run,
**Then** they include: a **Testcontainers integration spec** proving the `type` filter, the `categoryId` filter **including descendants** (selecting a parent returns its children's rows; selecting a leaf returns only its own), a **combination** (type + category), and **both** sort orders on **both** sort columns against real seeded Postgres (asserting filtered `total` and stable order); updated service/controller unit specs (new params forwarded, sort defaults applied); frontend tests for the filter controls (each updates the right URL param + resets page), the pagination control (prev/next updates `page` preserving other params), the `MonthStepper` **filter-preservation** regression, and the search-param parser for the new params. All new strings exist in both locales.

## Tasks / Subtasks

> Read every file marked **UPDATE** in "Source tree" before editing it — this story is almost entirely *extension* of 2.2/2.3/2.4 code, so preserving current behavior is the dominant risk. The in-repo templates to mirror: `TransactionForm.tsx` (Combobox/Select control + `Controller` pattern, `CURRENCY_OPTION_LIST`, `buildCategoryOptionList`), `MonthStepper.tsx` (client URL writer), `parse-transactions-search-params.ts` (param parsing), `create-transaction.dto.ts` (`@ApiProperty({ enum, enumName })` + `@IsIn`).

### API — query params (filters + sort) on the existing endpoint

- [x] **Task 1 — Shared sort constants + OpenAPI enum names (AC1) — single source of truth, no TS `enum`**
  - [x] New `packages/shared/src/constants/transaction-sort.ts`: `TRANSACTION_SORT_BY = { date: 'date', amount: 'amount' } as const` and `TRANSACTION_SORT_ORDER = { asc: 'asc', desc: 'desc' } as const`; derive unions via `ObjectValuesUnion<typeof ...>` (`packages/shared/src/types/object-values-union.ts`) → `TransactionSortBy`, `TransactionSortOrder`; export `TRANSACTION_SORT_BY_LIST = Object.values(TRANSACTION_SORT_BY)` and `TRANSACTION_SORT_ORDER_LIST`, plus `DEFAULT_SORT_BY: TransactionSortBy = 'date'` and `DEFAULT_SORT_ORDER: TransactionSortOrder = 'desc'` (no re-listing literals; **no `enum`** — typescript.md rule). **Do not** create a barrel.
  - [x] Add `transactionSortBy: 'TransactionSortBy'` and `sortOrder: 'SortOrder'` to `OPENAPI_ENUM_NAME` (`apps/api/src/shared/constants/openapi-enum-name.ts`) — so the generated client emits **named** reusable types (per `nestjs-apis.md`: enum/union fields MUST set `enumName`, sourced from this map, never a hardcoded literal). `type` reuses `OPENAPI_ENUM_NAME.transactionType`. (No currency filter → no `currencyCode` use here.)

- [x] **Task 2 — Extend `FindTransactionsQueryDto` (AC1) + add `@Max` on `page` (closes 2.2 deferral)**
  - [x] UPDATE `apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts` — add four optional params, each `@IsOptional()`:
    - `type?: TransactionType` — `@ApiPropertyOptional({ enum: transactionTypeEnum.enumValues, enumName: OPENAPI_ENUM_NAME.transactionType })` + `@IsIn(TRANSACTION_TYPE_LIST)` (mirror `create-transaction.dto.ts`).
    - `categoryId?: string` — `@ApiPropertyOptional()` + `@IsString()` + `@IsNotEmpty()` (UUID string; an empty-string param must not become a `WHERE categoryId = ''`).
    - `sortBy?: TransactionSortBy` — `@ApiPropertyOptional({ enum: TRANSACTION_SORT_BY_LIST, enumName: OPENAPI_ENUM_NAME.transactionSortBy })` + `@IsIn(TRANSACTION_SORT_BY_LIST)`.
    - `sortOrder?: TransactionSortOrder` — `@ApiPropertyOptional({ enum: TRANSACTION_SORT_ORDER_LIST, enumName: OPENAPI_ENUM_NAME.sortOrder })` + `@IsIn(TRANSACTION_SORT_ORDER_LIST)`.
    - **No `currency` param** (currency is not a filter). Preserve the existing `dateFrom`/`dateTo` and the inherited `page`/`limit`. Keep the existing `oxlint-disable` for the value-import of this DTO if present (it is a `@Query()` DTO — see 2.2 Dev Notes: SWC would erase an `import type`).
  - [x] UPDATE `apps/api/src/shared/dtos/pagination-query.dto.ts` — add `@Max(MAX_PAGE)` to `page` (deferred from 2.2: `page` had only `@Min`, allowing unbounded `OFFSET`). Add `MAX_PAGE` to `apps/api/src/shared/constants/pagination.ts` (a generous bound, e.g. `MAX_PAGE = 10_000`, UPPER_SNAKE — no magic numbers). This is shared infra; **preserve** `limit`'s existing `@Max(MAX_PAGE_SIZE)`.

- [x] **Task 3 — Repository: filter conditions (incl. category subtree) + dynamic ORDER BY (AC1, D7, FR21)**
  - [x] UPDATE `apps/api/src/modules/transactions/transactions.repository.ts`:
    - Extend `FindAllByUserIdQuery` with `type?`, `categoryId?`, `sortBy: TransactionSortBy`, `sortOrder: TransactionSortOrder` (sort is required at the repository boundary — service supplies defaults). **No `currency`.**
    - **Category subtree resolution:** when `categoryId` is supplied, the filter must match the selected category **and its descendants**. Resolve the id set user-scoped: the selected id plus all `transactionCategories` rows whose `parentId` is the selected id (the seed hierarchy is two-level, so direct children cover it; if you want to be subtree-general, BFS the children — but a single `WHERE parentId = :id AND userId = :userId` query is sufficient for the current data and acceptable). Then filter with `inArray(transactions.categoryId, [selectedId, ...childIdList])` (import `inArray` from `drizzle-orm`). Add a small private helper (e.g. `getCategorySubtreeIds(userId, categoryId)`); user-scope it (a category id not owned by the user resolves to just `[categoryId]` and matches nothing — safe). Because resolving the subtree is async, do it **before** building the conditions (the conditions builder can stay sync taking the resolved id list).
    - In `buildScopedConditions`, after the existing `userId`/`dateFrom`/`dateTo` conditions, push `eq(transactions.type, query.type)` when defined and `inArray(transactions.categoryId, subtreeIdList)` when a category is selected. **`userId` stays first/always-present** (FR21).
    - Replace the hard-coded `.orderBy(desc(transactions.date), desc(transactions.id))` with a derived primary column + direction: map `sortBy` → `transactions.date` | `transactions.amount`, `sortOrder` → `asc`/`desc` (import `asc` from `drizzle-orm`). Build the primary `SQL` via the chosen `asc(col)`/`desc(col)`, then **always append `desc(transactions.id)`** as the deterministic tiebreaker (UUIDv7 = time-ordered; without it, equal-key rows shuffle across pages). Note: ordering by the `numeric` `amount` column sorts **numerically** in Postgres (correct — do not cast to text).
    - The count query keeps using the **same `whereClause`** so `total` is the filtered count. No change to the category self-join or `mapRowToResponse`.
  - [x] `findOneByUserIdAndId`/`create`/`updateScoped`/`deleteScoped` are **unchanged** — do not touch them.

- [x] **Task 4 — Service: thread params + apply sort defaults (AC1, AC2)**
  - [x] UPDATE `apps/api/src/modules/transactions/transactions.service.ts` `findAll`: pass `type`, `categoryId` straight through; default `sortBy = query.sortBy ?? DEFAULT_SORT_BY` and `sortOrder = query.sortOrder ?? DEFAULT_SORT_ORDER` (import from `@supertool/shared`); keep the existing `page`/`limit` defaulting and the `{ data, meta: { page, limit, total } }` assembly. No other methods change.

- [x] **Task 5 — Regenerate the client + drift gate (NFR6, D8)**
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`), then `pnpm --filter @supertool/shared generate:client` (and `pnpm --filter @supertool/shared build` — money-tracker consumes `@supertool/shared` from `dist/`, see 2.2 Dev Notes). Commit the regenerated `packages/shared/src/generated/*`. Confirm `transactionsFindAll`'s query type now carries `type`/`categoryId`/`sortBy`/`sortOrder` with the **named** `TransactionSortBy`/`SortOrder` types. CI drift gate must be green.

- [x] **Task 6 — API tests (AC7, NFR1, D10)**
  - [x] UPDATE `transactions.service.spec.ts` — assert `sortBy`/`sortOrder` defaulting (`date`/`desc` when absent) and that supplied filters/sort forward to the repository.
  - [x] UPDATE `transactions.controller.spec.ts` — assert it forwards the new query params alongside `session.user.id`.
  - [x] UPDATE `apps/api/test/integration/transactions.integration.spec.ts` (reuse the existing container lifecycle + operator/seed helpers — do **not** re-scaffold): query the repository against seeded data and assert — (a) `type=expense` returns only expense rows; (b) `categoryId=<seeded leaf/child id>` returns only that category's rows and `total` matches; (c) **category descendants** — `categoryId=<seeded parent id>` returns the parent's own rows **plus** all its children's rows (assert a child's row is present and that the count equals parent + children); (d) a **combination** (type + category) honors all conditions; (e) `sortBy=amount` `asc` vs `desc` orders rows by **numeric** amount in the right direction (assert first/last rows, and that the `id` tiebreaker keeps it deterministic); (f) `sortBy=date asc` reverses today's default order. Harden the 2.2 second-user-isolation assertion if convenient (deferred note: avoid the `HIGH_LIMIT=1000` truncation false-pass) — optional.

### Frontend — filter/sort controls, pagination UI, param plumbing

- [x] **Task 7 — Parse the new search params (AC2, AC3) — extend, don't replace**
  - [x] UPDATE `apps/money-tracker/src/app/[locale]/transactions/constants.ts` — add `TYPE_SEARCH_PARAM = 'type'`, `CATEGORY_SEARCH_PARAM = 'categoryId'`, `SORT_BY_SEARCH_PARAM = 'sortBy'`, `SORT_ORDER_SEARCH_PARAM = 'sortOrder'`. (No currency param.) Reuse `TRANSACTION_SORT_BY`/`DEFAULT_SORT_BY`/`DEFAULT_SORT_ORDER` from `@supertool/shared`; reuse `TRANSACTION_TYPE_LIST` (`src/constants/transaction.ts`) for validation — **do not re-list** values.
  - [x] UPDATE `parse-transactions-search-params.ts` — extend `TransactionsSearchParams` with `type?: TransactionType`, `categoryId?: string`, `sortBy: TransactionSortBy`, `sortOrder: TransactionSortOrder`. Parse each via `normalizeParam`; validate `type` against `TRANSACTION_TYPE_LIST`, `sortBy`/`sortOrder` against the shared lists (fall back to `DEFAULT_SORT_BY`/`DEFAULT_SORT_ORDER`); an invalid/absent filter parses to `undefined`. `categoryId` is passed through as a trimmed non-empty string or `undefined`. Keep the existing `period`/`page` logic intact. UPDATE `parse-transactions-search-params.test.ts` accordingly.
  - [x] Add a small pure helper `check-has-active-filters.ts` (`checkHasActiveFilters(params): boolean` — true when `type` **or** `categoryId` is set; **sort is not a filter**) + test. Used by the page to pick the empty-state variant (AC5).

- [x] **Task 8 — Extend `fetch-transactions` params (AC1)**
  - [x] UPDATE `apps/money-tracker/src/actions/fetch-transactions.ts` — add optional `type`/`categoryId`/`sortBy`/`sortOrder` to `FetchTransactionsParams` and forward them in the `query` object to `transactionsFindAll`. Keep the `cache()` wrapper, cookie forwarding, and the discriminated `FetchTransactionsResult`. **Note** the `cache()` identity caveat (2.2): the params object is the cache key — callers must pass a stable shape.

- [x] **Task 9 — `TransactionFilters` client component + category fetch in the page (AC2, AC3, AC5, AC6)**
  - [x] New `components/transaction-filters/TransactionFilters.tsx` (`'use client'`): controls for **type** (`Select` atom — options All/Income/Expense, "All" = clear), **category** (`Combobox` — options "Parent / Child", with an "All categories" clear path; selecting a parent filters its whole subtree server-side per AC1), **sort by** (`Select` — Date/Amount), **sort order** (`Select` — Newest/Oldest or High→Low/Low→High; label depends on column — keep copy generic: "Descending"/"Ascending" is acceptable), and a **Clear filters** `Button` shown when `checkHasActiveFilters`. **No currency control.** Each control writes its param via `router.replace` (locale-aware `useRouter`/`usePathname` from `@supertool/next-shared`, mirroring `MonthStepper`), **merging into the current `useSearchParams`** (so it preserves `period` + the other filters/sort), **always resetting `page`** (omit it or set 1). Build the merge with `URLSearchParams` from `useSearchParams()`; deleting a param = clearing that filter. Receives `categoryList: CategoryResponseDto[]` + the current parsed params as props.
  - [x] Category options for the filter must show **all** categories (both income and expense parents + children), unlike the form's `buildCategoryOptionList` which filters by a single `type` arg. Add a sibling builder (e.g. `buildFilterCategoryOptionList` — all parents + their children, "Parent / Child" labels; optionally scope to the active `type` when one is selected) rather than mutating the form's builder; cover it with a unit test.
  - [x] UPDATE `apps/money-tracker/src/app/[locale]/transactions/page.tsx` — after the `fetchProfile` gate, `fetchCategoryList()` (server) and parse the full param set; render `<TransactionFilters categoryList={...} ...currentParams />` in the header area near `MonthStepper`. Keep the existing `MonthStepper` + Add-transaction button. Extend the `Suspense key` to include the filter/sort params (so the boundary resets on any change), and pass them into `TransactionListServer`.
  - [x] All `.module.scss` co-located, PascalCase; responsive via `@use '@supertool/ui/src/styles/breakpoints'`; tokens not literals. On mobile the filters should stack/wrap (NFR8).

- [x] **Task 10 — Pagination UI + filtered fetch + empty-vs-no-match (AC4, AC5)**
  - [x] New `components/transaction-pagination/TransactionPagination.tsx` (`'use client'`) wrapping the `@supertool/ui` `Pagination` molecule: props `page`, `limit`, `total`; `onPageChange` writes the `page` param via `router.replace` **merging current `useSearchParams`** (preserve period + filters + sort). Localize `previousLabel`/`nextLabel`/`renderInfo` (e.g. ICU `"Page {page} of {total}"`). The molecule returns `null` when `totalPages ≤ 1`, so no guard needed for the small-list case.
  - [x] UPDATE `TransactionListServer.tsx` — accept the new filter/sort params + `hasActiveFilters: boolean`; pass filters/sort into `fetchTransactions`; on success read `result.transactions.meta` and render `<TransactionPagination page limit total />` **below** `<TransactionList />`. On empty (`data.length === 0`) render `<TransactionEmptyState variant={hasActiveFilters ? 'noMatches' : 'emptyMonth'} />`. Error path unchanged (`TransactionError`).
  - [x] UPDATE `TransactionEmptyState.tsx` — add a `variant: 'emptyMonth' | 'noMatches'` prop selecting between the existing `empty.*` copy and new `noMatches.*` copy; in the `noMatches` case render a **Clear filters** control (a `Link`/`Button` to `ROUTES.transactions` with only `period` preserved, or a client clear button). Keep it a server component if possible (the clear affordance can be a `Link` to the period-only URL). UPDATE its test for both variants.
  - [x] Decide where `TransactionPagination` lives relative to `TransactionList` — `TransactionListServer` is the natural place (it already has `meta`). Keep `TransactionList` presentational.

- [x] **Task 11 — Preserve filters across month-step and mutation redirects (AC3) — regression guard**
  - [x] UPDATE `MonthStepper.tsx` `handleNavigate` — currently sets `query: { [PERIOD_SEARCH_PARAM]: targetPeriod }`, which **drops all filters/sort** (AC3 violation). Read `useSearchParams()`, clone into `URLSearchParams`, set `period = targetPeriod`, **delete `page`** (reset), and keep the filter/sort params. UPDATE `MonthStepper.test.tsx` to assert filters survive a prev/next step and `page` resets.
  - [x] UPDATE `build-transactions-redirect-query.ts` + its callers so editing/deleting a row returns the user to their **filtered/sorted** view: thread the active `type`/`categoryId`/`sortBy`/`sortOrder` through `buildTransactionsRedirectQuery`, `redirectToTransactionMonth`, `redirectAfterTransactionDelete`, and the `TransactionRowActions` → `use-delete-transaction` chain (these currently pass only `period`+`page`). **Known interaction (acceptable):** `getTransactionPage`/`getLastPageForPeriod` compute the target page from the *unfiltered* month total; with filters active the computed page can be approximate (it already is an approximation for same-date clusters — see deferred 2.4). Preserve the params in the URL; do **not** attempt exact filtered-page math in this story — note it in Dev Notes / deferred-work if it proves visible. If threading the full param set through the delete hook is disproportionately invasive, at minimum preserve `period` (current behavior) and **record the filter-loss-on-mutation gap in `deferred-work.md`** rather than shipping a half-done thread.

- [x] **Task 12 — i18n: extend `transactionsPage`, both locales (FR19/FR20)**
  - [x] UPDATE `apps/money-tracker/messages/en/transactions-page.json` **and** `messages/uk/transactions-page.json` (identical key sets, same commit): add a `filters` block (labels + placeholders + aria-labels for type/category/sortBy/sortOrder, "All …" option labels, `clear` action — **no currency keys**), a `pagination` block (`previous`, `next`, `info` with ICU `{page}`/`{total}`), and a `noMatches` block (`title`, `description`, `clear`). Real Ukrainian (not transliteration). `pnpm i18n:parity` is a merge-blocking gate.

- [x] **Task 13 — Frontend tests (AC7, NFR1)**
  - [x] `TransactionFilters.test.tsx` — each control writes the correct param and **resets `page`**, "Clear filters" removes all filter params (mock the locale-aware router + `useSearchParams`; assert the merged URL preserves `period` and untouched params).
  - [x] `TransactionPagination.test.tsx` — prev/next update `page` while preserving other params; renders nothing for a single page.
  - [x] `MonthStepper.test.tsx` (UPDATE) — filters/sort persist across a step; `page` resets.
  - [x] Unit specs for the new param parsing (`parse-transactions-search-params.test.ts` UPDATE), `check-has-active-filters.test.ts`, and the category-option builder for the filter (all-categories / type-scoped).
  - [x] `TransactionEmptyState.test.tsx` (UPDATE) — both `emptyMonth` and `noMatches` variants render their copy; `noMatches` shows the clear affordance.

### Verification

- [x] **Gate locally with `--force`** (turbo cache replays stale logs — memory `turbo-cache-masks-gate-results`): `pnpm --filter @supertool/api type-check lint test` and `pnpm --filter @supertool/money-tracker type-check lint test`, plus `pnpm --filter @supertool/shared type-check lint test build`, `pnpm i18n:parity`, `pnpm stylelint`, `pnpm fmt:check`. Integration tests need Docker running. Run `pnpm` package scripts, not `node_modules/.bin`; retry on the transient pnpm `H.replace` crash (memory `run-tests-via-pnpm-scripts`).
- [x] **Visual QA (mandatory — 1.4/1.8 shipped broken UI behind green gates, memory `ui-stories-need-visual-qa` / `visual-qa-via-playwright-cli`):** run the app against seeded Postgres and screenshot, in **both themes** + **both locales**, on desktop and mobile widths: (a) the filter/sort controls (collapsed + with a `Select`/`Combobox` **open**), (b) a filtered list, (c) the **pagination control** on a >50-row filtered/month result (prev/next reachable), (d) the **no-matches** empty state (with the clear affordance) vs the **empty-month** state, (e) filters persisting after a month step. Record evidence (paths + what each shows) in the Dev Agent Record. Green gates alone are not sign-off.

### Review Findings (code review 2026-06-15)

- [x] [Review][Patch] Make category subtree resolution recursive (resolved decision 2026-06-15 — option c) — DONE: `getCategorySubtreeIds` now uses a `WITH RECURSIVE` CTE (user-scoped, depth-capped at 100) mirroring `transaction-categories.repository.isDescendantOf`; integration test "resolves multi-level descendants when filtering by an ancestor id" proves a 3-level grandparent filter returns the leaf transaction (old one-level code returned total 0). — `getCategorySubtreeIds` currently collects only direct children (`eq(parentId, categoryId)`), but the create flow enforces no depth cap and the frontend's `getDescendantIdSet` already resolves the full transitive subtree, so a 3-level hierarchy mis-filters (grandchild rows dropped, wrong `total`). Fix: resolve the full user-scoped subtree to any depth (recursive CTE or BFS) so it matches the frontend. [apps/api/src/modules/transactions/transactions.repository.ts `getCategorySubtreeIds`]
- [x] [Review][Patch] Out-of-range `page` strands the user with no recovery — DONE: `parsePage` now clamps to `MAX_PAGE` (10000) so a too-large page no longer 400s into the error card (unit test "clamps a page above the maximum to the maximum bound"); `TransactionListServer` gates the empty-state on `meta.total === 0` (a count, renamed the shared `0` constant `EMPTY_LIST_LENGTH` → `EMPTY_COUNT`); when `total > 0` but the requested page is past the last page it redirects to the last valid page (`redirectWhenPageOutOfRange` helper, preserving period + filters/sort) so the user lands on real data instead of a blank list. — when a `page` past the last page is requested (stale/hand-edited URL), `TransactionListServer`'s `transactionList.length === 0` branch returns the empty-state before rendering `TransactionPagination`, so a month/filter that actually has data falsely shows "No transactions for this month" (or "no matches") with no pagination control to get back. Additionally, `page > MAX_PAGE` (10000) now 400s at the API (new `@Max`) and surfaces as a full `TransactionError` card because the frontend `parsePage` only lower-bounds. Minimal fix: clamp `parsePage` to `MAX_PAGE`, and render `TransactionPagination` in the empty branch when `meta.total > 0` (the molecule clamps `currentPage`, so prev/next recover). [apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx; apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.ts]

## Dev Notes

### Contract decisions baked into this story (read first)

- **Query-param names are fixed by architecture:** `?categoryId=&sortBy=date&sortOrder=desc` — camelCase, exactly these names (architecture.md "Naming Patterns", line ~238). `type` follows the same camelCase rule. Do not invent `sort_by`, `order`, `cat`, etc.
- **No currency filter (decided 2026-06-15).** Currency is simplified product-wide to one onboarding-default per user, so currency is not a filter dimension — no `currency` query param, no currency control, no currency i18n keys. The currency *column* still renders in the list. Don't add a currency filter "for completeness."
- **No new endpoint, no new table column.** This is purely additive query params on `GET /api/v1/transactions`. The `transactions` table already has `type`, `categoryId`, `amount`, `date` indexed appropriately (the `(userId, date desc)` index from 2.1 still backs the default sort). Do not add migrations.
- **Sort columns are `date` and `amount` only** (FR9). `amount` is `numeric(14,2)` → Postgres orders it **numerically** (not lexically) — order by the column directly, never cast to text, never `parseFloat` (D1). Always keep `desc(transactions.id)` as the final tiebreaker for deterministic pagination (this is why same-date rows don't shuffle today).
- **Filters are server-side, additive `WHERE` conditions** appended after the mandatory `eq(userId)` scope (FR21). An absent filter param must contribute **no** condition (not `WHERE x = ''` / `WHERE x IS NULL`). **Category filter includes descendants (decided 2026-06-15):** selecting a parent matches `categoryId IN (parent + descendant ids)`, resolved user-scoped in the repository; selecting a leaf matches just that id. The seed hierarchy is two-level, so resolving direct children of the selected id is sufficient (BFS the subtree if you want generality). A category id not owned by the user resolves to a single-id list that matches nothing — safe.
- **Sort has defaults; filters do not.** Service applies `DEFAULT_SORT_BY='date'`/`DEFAULT_SORT_ORDER='desc'` so the un-parameterized list is byte-identical to today's 2.2 behavior. Filters default to "none."
- **Page resets to 1 on any filter/sort change** (else you can land past `total`). Month-step also resets page (already true; preserve it). The `Pagination` molecule clamps `currentPage` into range defensively, and `@Max(MAX_PAGE)` bounds the server `OFFSET`.
- **Empty-vs-no-match (AC5)** is driven by `checkHasActiveFilters` (type/categoryId only — sort never makes a result "filtered"). Sort being non-default does not turn an empty month into "no matches."
- **This story closes three 2.2 deferrals** (see `deferred-work.md`): the within-month pagination UI (AC4), the missing `@Max` on `page` (Task 2), and partially the second-user-isolation test hardening (Task 6, optional). The `dateFrom>dateTo` / calendar-validity cross-field check remains deferred (direct-API hardening; the UI still derives both bounds from one `period`, so it cannot trigger it) — do **not** expand scope into it unless trivial.

### Enum/union → generated-client typing (the part most likely to be done wrong)

- `sortBy`/`sortOrder` are **API-only** unions (no DB column). Per `typescript.md`: **no TS `enum`** — define `as const` objects in `@supertool/shared` and derive unions with `ObjectValuesUnion`. Per `nestjs-apis.md`: the DTO field MUST set `enumName` (from `OPENAPI_ENUM_NAME`) or hey-api inlines the literal union at every occurrence and the request copy silently drifts from any response copy. Use `@IsIn(TRANSACTION_SORT_BY_LIST)` for validation and `enum: TRANSACTION_SORT_BY_LIST` for the schema — the `classValidatorShim` lifts `@IsIn` into the spec but `enumName` is still required for a **named** type. `type` reuses the already-registered `transactionType` (no currency filter, so `currencyCode` is not used here).
- After regen, prefer importing the generated `TransactionSortBy`/`SortOrder` types from `@supertool/shared/generated/types.gen` at the frontend call sites (hey-api-owned, structurally compatible with the `@supertool/shared` constant types).

### Architecture hard rules binding this story

- **D1 — money is strings end-to-end.** Sorting by `amount` happens in SQL on the `numeric` column; the DTO/UI still treat `amount` as a string formatted via `Intl` only at the boundary. No `parseFloat`/`Number(amount)` for comparison or storage.
- **D7 — layering + REST.** Controller → service → repository; the **repository is the only place** that builds `WHERE`/`ORDER BY`. `{ data, meta:{page,limit,total} }` unchanged. camelCase JSON + query params.
- **NFR6 / D8 — generated client only.** No hand-written `fetch`. Build API → regenerate → commit → drift gate green.
- **FR21 — user scoping in the repository.** `eq(transactions.userId, userId)` stays the first, always-present condition; filters never widen scope. Second-user isolation is an integration assertion.
- **D9 — URL search params are the only filter/sort/page state.** No global store, no client list state, no duplicating server data in client state. Client components write params via `router.replace` (locale-aware) and the RSC re-fetches off the `Suspense key`.
- **NestJS DI** — explicit `@Inject(ClassName)`; never `import type` an injectable (`nest-di-explicit-inject.md`). The `@Query()` DTO must stay a value import (SWC erases `import type` → `ValidationPipe` loses metadata; the 2.2 `oxlint-disable` shim covers it).
- **FR19/FR20 — both locales same commit;** ICU interpolation, no concatenation; EN is the parity reference. Real Ukrainian.
- **NFR8 — responsive via shared breakpoint mixins** + design tokens, never ad-hoc `@media`/literals.
- **Naming/conventions** (`javascript.md`/`react.md`): kebab-case dirs, PascalCase component + co-located `.module.scss`/`.test.tsx`; `fetch-*` reads are plain async (React `cache`); function prefixes (`parse*`, `get*`, `build*`, `check*`, `format*`); array vars end in `List`; constants UPPER_SNAKE in `constants.ts`; callbacks prefixed `on`, handlers `handle`; no code comments; use `cn` for class composition; `ROUTES` for paths; locale-aware `useRouter`/`Link`/`redirect` from `@supertool/next-shared`.
- **Exact dependency versions only; never introduce eslint/prettier.** This story needs **no new dependencies** (drizzle `asc`, class-validator, `@supertool/ui` `Select`/`Combobox`/`Pagination`, next-intl are all present).

### Source tree — what this story touches

NEW (frontend):
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../components/transaction-pagination/TransactionPagination.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../utils/check-has-active-filters.ts` (+ `.test.ts`)
- `.../utils/build-filter-category-option-list.ts` (+ `.test.ts`) — all-categories "Parent / Child" option list for the filter (distinct from the form's type-scoped `build-category-option-list.ts`)

NEW (shared):
- `packages/shared/src/constants/transaction-sort.ts`

UPDATE (read fully before editing — current behavior to preserve):
- `apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts` — add 5 params; keep dateFrom/dateTo + inherited page/limit.
- `apps/api/src/shared/dtos/pagination-query.dto.ts` + `apps/api/src/shared/constants/pagination.ts` — add `@Max`/`MAX_PAGE`.
- `apps/api/src/shared/constants/openapi-enum-name.ts` — add `transactionSortBy`, `sortOrder`.
- `apps/api/src/modules/transactions/transactions.repository.ts` — extend `FindAllByUserIdQuery` + `buildScopedConditions` (type `eq` + category subtree `inArray`, with a private `getCategorySubtreeIds` helper) + dynamic `orderBy`; **leave `findOne/create/update/delete` untouched**.
- `apps/api/src/modules/transactions/transactions.service.ts` — thread params + sort defaults.
- `apps/api/src/modules/transactions/transactions.{service,controller}.spec.ts`, `apps/api/test/integration/transactions.integration.spec.ts`.
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx` — fetch category list, render filters, extend Suspense key + props.
- `.../utils/parse-transactions-search-params.ts` (+ test), `.../constants.ts`.
- `apps/money-tracker/src/actions/fetch-transactions.ts` — new optional params.
- `.../components/transaction-list-server/TransactionListServer.tsx` — pass filters/sort, render pagination, empty-variant.
- `.../components/transaction-empty-state/TransactionEmptyState.tsx` (+ test) — variant prop + clear affordance.
- `.../components/month-stepper/MonthStepper.tsx` (+ test) — preserve filters, reset page.
- `.../utils/build-transactions-redirect-query.ts`, `.../utils/redirect-to-transaction-month.ts`, `.../utils/redirect-after-transaction-delete.ts`, `.../components/transaction-row-actions/TransactionRowActions.tsx` + `hooks/use-delete-transaction.ts` — thread filter/sort params (or document the gap, Task 11).
- `apps/money-tracker/messages/{en,uk}/transactions-page.json`.
- `packages/shared/src/generated/*` — regenerated by Task 5 (do not hand-edit).

### Reference patterns (study before implementing — `example/` is reference-only, ED1: adapt, never copy/import)

In-repo templates (primary — prefer these over `example/`):
- **Client URL writer (locale-aware `router.replace` + `usePathname`):** `MonthStepper.tsx`. This story generalizes it to *merge* into `useSearchParams` instead of replacing the whole query — the key behavioral change.
- **Select/Combobox controls + option lists:** `TransactionForm.tsx` (`Combobox` for category via `Controller`), `utils/build-category-option-list.ts` (+ `categories/utils/category-hierarchy.ts` for the Parent/Child tree — `buildCategoryHierarchy`/`childrenByParentId` also helps resolve the subtree on the API side conceptually). The filter controls are the un-form-bound (URL-bound) analogue.
- **Search-param parsing:** `utils/parse-transactions-search-params.ts` + `utils/period.ts` (validate-then-fallback pattern).
- **Server fetch + cookie forwarding:** `actions/fetch-transactions.ts`, `actions/fetch-category-list.ts` (the page will call `fetchCategoryList`).
- **API enum DTO + `@IsIn` + `enumName`:** `apps/api/src/modules/transactions/dtos/create-transaction.dto.ts` (the exact `@ApiProperty({ enum, enumName })` + `@IsIn(LIST)` shape to copy for `type`/`sortBy`/`sortOrder`).
- **Repository conditions array + `Promise.all` data/count + self-join:** the current `transactions.repository.ts` — extend `buildScopedConditions` and the `orderBy`, nothing structural.
- **`as const` object + `ObjectValuesUnion` union:** `packages/shared/src/constants/error-codes.ts` + `packages/shared/src/types/object-values-union.ts` (template for `transaction-sort.ts`).
- **Pagination molecule:** `packages/ui/src/components/molecules/pagination/Pagination.tsx` (`page`/`limit`/`total`/`onPageChange`/`renderInfo`; returns `null` for ≤1 page). `Select` atom: `packages/ui/src/components/atoms/select/Select.tsx` (`value`/`onValueChange`/`optionList`). `Combobox`: `packages/ui/src/components/molecules/combobox/Combobox.tsx`.

Reference repos (adapt patterns only — never import/copy, ED1):
- `example/track-my-life/.../transactions/` — its multi-param filter set + sort selector + pagination is the closest reference for the control layout and the searchParams→Suspense-key flow. **Diverge:** supertool param names (`sortBy`/`sortOrder`/`categoryId`/`type`), **no currency filter**, category filter is subtree-aware, `{data,meta}` envelope, no timezone math, `@supertool/ui` primitives + tokens, two-locale i18n, no global state.

### Decisions resolved (2026-06-15, by Oleksii)

- **No currency filter.** Currency is being simplified product-wide — one default currency chosen at onboarding, used everywhere — so the currency filter named in FR9 is dropped from this story. (FR9's currency-filter clause is superseded by this product decision; flag it at the Epic-2 retro so the FR text is reconciled.) The list still shows the currency column.
- **Category filter includes descendants.** Selecting a parent returns transactions in the parent and its child categories (`categoryId IN (parent + descendants)`, resolved user-scoped in the repository). The seed hierarchy is two-level.
- **Type filter control — `Select` atom with All/Income/Expense.** A 3-state segmented control is an acceptable alternative if it matches the form's segmented type control visually; pick one and keep it consistent.

### Testing standards

- Vitest + SWC decorators for API (`apps/api/vitest.config.ts`); `@testing-library/react` for money-tracker (`apps/money-tracker/vitest.config.ts` — Next-app oxc `jsx:'react-jsx'` override already configured, `next-app-vitest-jsx-preserve.md`). The money-tracker `vitest.config.ts` `include` already covers `*.test.{ts,tsx}` (widened in 2.2) — pure helper specs run.
- Co-located `*.spec.ts` (API) / `*.test.ts(x)` (frontend); Testcontainers integration in `apps/api/test/integration/*.integration.spec.ts` (`postgres:16-alpine`), reuse the existing container lifecycle + seed/operator helpers verbatim.
- Arrange-Act-Assert; name vars `inputX`/`mockX`/`actualX`/`expectedX`. App-level lint enforces `no-magic-numbers`/`id-length` in source AND tests (2.2 note) — extract named constants, alias async server components to lowercase locals in tests.
- Run gates with `--force`; `pnpm` scripts not `.bin`; retry on the pnpm `H.replace` crash.

### Project Structure Notes

- New frontend components live under `app/[locale]/transactions/components/<feature>/`; new utils under `.../transactions/utils/`; the shared sort constant under `packages/shared/src/constants/` (it is consumed by both the API DTO and the frontend parser, so it belongs in `shared`, below both — matches the `i18n-namespace`/`currency` precedent). No barrels.
- No new dependencies expected; if one is unavoidable, pin exact + record in Dev Agent Record (consult `architecture.md` first).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5: Filter & Sort the List] (FR9)
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] (D7 — pagination/layering; line 238 query-param convention `?categoryId=&sortBy=date&sortOrder=desc`)
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] (D1 — money strings)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] (D9 — RSC + searchParams, no global state)
- [Source: _bmad-output/implementation-artifacts/2-2-browse-transactions-by-month.md] (the read path this story extends; deferred pagination/@Max/isolation items)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (2.2 deferrals closed here; 2.4 redirect page-math approximation)
- [Source: _bmad-output/implementation-artifacts/epic-2-parallelization.md] (2.5 depends on 2.2; last Track A story)
- [Source: apps/api/src/modules/transactions/{transactions.repository,transactions.service,transactions.controller}.ts, dtos/{find-transactions-query,create-transaction}.dto.ts]
- [Source: apps/api/src/shared/dtos/pagination-query.dto.ts, src/shared/constants/{pagination,openapi-enum-name}.ts]
- [Source: apps/money-tracker/src/app/[locale]/transactions/{page.tsx, utils/parse-transactions-search-params.ts, constants.ts}]
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/{month-stepper/MonthStepper.tsx, transaction-list-server/TransactionListServer.tsx, transaction-empty-state/TransactionEmptyState.tsx, transaction-form/TransactionForm.tsx, transaction-row-actions/TransactionRowActions.tsx}]
- [Source: apps/money-tracker/src/actions/{fetch-transactions,fetch-category-list}.ts]
- [Source: packages/ui/src/components/molecules/{pagination,combobox}/*, atoms/select/Select.tsx]
- [Source: packages/shared/src/constants/{currency,error-codes}.ts, src/types/object-values-union.ts]
- [Source: .claude/rules/{typescript,nestjs-apis,react,i18n,javascript}.md]
- Project memory: `turbo-cache-masks-gate-results.md`, `run-tests-via-pnpm-scripts.md`, `nest-di-explicit-inject.md`, `next-app-vitest-jsx-preserve.md`, `ui-stories-need-visual-qa.md`, `visual-qa-via-playwright-cli.md`, `seed-data-has-subcategory.md`, `follow-example-repo-patterns.md`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — Claude Code dev-story workflow.

### Debug Log References

- All gates run via `pnpm` package scripts (memory `run-tests-via-pnpm-scripts`); full repo `type-check`/`test` run with `--force` to bypass turbo cache (memory `turbo-cache-masks-gate-results`).
- Testcontainers integration suite runs against ephemeral `postgres:16-alpine`; Docker was available.

### Completion Notes List

- **API (Tasks 1–6):** Added shared `transaction-sort.ts` (`TRANSACTION_SORT_BY`/`TRANSACTION_SORT_ORDER` as-const + `ObjectValuesUnion` unions + `DEFAULT_SORT_BY`/`DEFAULT_SORT_ORDER`, no TS `enum`), registered `transactionSortBy`/`sortOrder` in `OPENAPI_ENUM_NAME`. Extended `FindTransactionsQueryDto` with `type`/`categoryId`/`sortBy`/`sortOrder` (`@IsIn` + `enumName`); added `@Max(MAX_PAGE=10_000)` on `page` (closes 2.2 deferral). Repository: `type` → `eq`, category → **subtree** `inArray` via new private `getCategorySubtreeIds` (selected id + user-scoped direct children; seed hierarchy is two-level), dynamic `orderBy` mapping `sortBy`→`date`/`amount` column with `desc(transactions.id)` retained as the stable tiebreaker; `userId` stays the first always-present condition (FR21); same `whereClause` on data + count so `total` is the filtered count. Service threads filters + applies sort defaults. Regenerated client emits named `TransactionSortBy`/`SortOrder` query types (drift gate green).
- **Frontend (Tasks 7–13):** `parse-transactions-search-params` extended (validate-then-fallback for `type`/`sortBy`/`sortOrder`, trimmed-non-empty `categoryId`); `check-has-active-filters` (type/category only — sort is not a filter); `build-filter-category-option-list` (all categories, type-scoped when a type is active); `fetch-transactions` forwards the new params (conditional query build to satisfy `exactOptionalPropertyTypes`). New client components: `TransactionFilters` (Select type/sort + Combobox category + Clear-filters, URL-writing via a `use-transaction-filters` hook that merges `useSearchParams` and always resets `page`) and `TransactionPagination` (wraps the `@supertool/ui` `Pagination` molecule). `TransactionListServer` renders pagination from `meta` and selects `emptyMonth` vs `noMatches`; `TransactionEmptyState` gained a `variant` prop + Clear-filters Link in the no-matches case. `MonthStepper` now preserves filters/sort and resets `page` (AC3 regression guard).
- **Task 11 scope decision:** filter/sort view params are threaded through the **delete** redirect chain (params are live on the list at delete time). The **create/edit** redirects originate on form pages that do not carry list filter state, so they preserve `period` only; this gap (and the unfiltered page-math approximation) is recorded in `deferred-work.md`.
- **Verification:** API 27 files / 149 tests (incl. 6 new filter/sort integration tests + 14 existing, against real seeded Postgres); money-tracker 28 files / 117 tests; full-repo `type-check` (9 pkgs) + `lint` + `i18n:parity` + `stylelint` + `fmt:check` all green.
- **Visual QA (mandatory — memories `ui-stories-need-visual-qa`/`visual-qa-via-playwright-cli`):** ran the dev stack against the seeded local Postgres + a throwaway `playwright-core` harness driving the cached Chromium (no browser tooling added to the repo). Captured and **inspected** screenshots in both themes, both locales, desktop + mobile, including an open Select dropdown. Evidence in `/tmp/tx-visual-qa/shots/`:
  - `a-filters-desktop-{light,dark}-{en,uk}.png`, `a-filters-mobile-{light,dark}-en.png` — filter bar (`All types | All categories | Date | Descending` / `Усі типи | Усі категорії | Дата | Спадання`) stacks full-width on mobile (NFR8); pagination shows `Page 1 of 3` / `Сторінка 1 з 3`.
  - `b-filtered-expense-{light,dark}-en.png` — type filter applied.
  - `c-page2-light-en.png`, `c-category-subtree-light-en.png` — page 2 reachable; selecting parent `Транспорт` returns its child `Транспорт / Таксі` rows (subtree).
  - `d-empty-month-true-light-en.png` — "No transactions for this month" with **no** clear affordance; `d-no-matches-light-en.png` / `d-no-matches-dark-uk.png` — "No transactions match your filters" / "Немає транзакцій за вашими фільтрами" **with** Clear-filters affordance (AC5 variant switch confirmed).
  - `e-sorted-amount-asc-light-en.png`, `f-type-select-open-{light,dark}-en.png` — sort applied; open Select dropdown renders with the selected-option checkmark.

### File List

NEW:
- `packages/shared/src/constants/transaction-sort.ts`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.module.scss`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/constants.ts`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/hooks/use-transaction-filters.ts`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-pagination/TransactionPagination.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-pagination/TransactionPagination.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-filter-category-option-list.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-filter-category-option-list.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/check-has-active-filters.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/check-has-active-filters.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-transactions-suspense-key.ts`

UPDATED (API):
- `apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.service.spec.ts`
- `apps/api/src/modules/transactions/transactions.controller.spec.ts`
- `apps/api/test/integration/transactions.integration.spec.ts`
- `apps/api/src/shared/constants/openapi-enum-name.ts`
- `apps/api/src/shared/constants/pagination.ts`
- `apps/api/src/shared/dtos/pagination-query.dto.ts`

UPDATED (frontend):
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/constants.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-transactions-redirect-query.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/redirect-after-transaction-delete.ts`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-empty-state/TransactionEmptyState.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-empty-state/TransactionEmptyState.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/month-stepper/MonthStepper.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/month-stepper/MonthStepper.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/hooks/use-delete-transaction.ts`
- `apps/money-tracker/src/actions/fetch-transactions.ts`
- `apps/money-tracker/src/actions/delete-transaction.ts`
- `apps/money-tracker/src/actions/delete-transaction.test.ts`
- `apps/money-tracker/messages/en/transactions-page.json`
- `apps/money-tracker/messages/uk/transactions-page.json`
- `packages/shared/src/generated/types.gen.ts` (regenerated — do not hand-edit)
- `packages/shared/src/generated/index.ts` (regenerated — do not hand-edit)

DOCS:
- `_bmad-output/implementation-artifacts/deferred-work.md` (create/edit redirect filter-loss + filtered page-math gaps)

## Change Log

| Date | Change |
|---|---|
| 2026-06-15 | Story 2.5 drafted — server-side filters (type + subtree-aware category) + sort (date/amount, asc/desc) on the existing GET endpoint, within-month pagination UI (closes 2.2 deferral) + `@Max` on page, filter-preserving month-step/redirects, empty-vs-no-match states, shared sort enum-name constants, regen client, en/uk i18n. **Currency filter dropped** (product simplification — single onboarding-default currency); **category filter includes descendants** (decisions by Oleksii). Status → ready-for-dev. |
| 2026-06-15 | Post-review refactor — extracted pagination bounds (`FIRST_PAGE`, `MAX_PAGE`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`) into `packages/shared/src/constants/pagination.ts` (single source of truth); deleted `apps/api/src/shared/constants/pagination.ts` and the frontend `transactions/constants.ts` duplicates; repointed API DTO/service + frontend parser/redirect utils/`TransactionListServer` (`TRANSACTIONS_PAGE_SIZE` → shared `DEFAULT_PAGE_SIZE`) and both test suites. API 150 + money-tracker 118 tests green; type-check/lint/fmt green. |
| 2026-06-15 | Story 2.5 implemented — all 13 tasks + verification complete. API filters/sort + subtree-aware category + dynamic ORDER BY + `@Max` on page; client regenerated (named `TransactionSortBy`/`SortOrder`); frontend `TransactionFilters` + `TransactionPagination` + empty-vs-no-match + MonthStepper filter-preservation; delete redirect threads filter/sort (create/edit gap deferred). API 149 + money-tracker 117 tests green; type-check/lint/i18n-parity/stylelint/fmt all green; visual QA captured + inspected (both themes/locales, desktop+mobile, open Select). Status → review. |
