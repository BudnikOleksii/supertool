---
baseline_commit: eea87c2113c9ae19e581e33d3b865e4475ec891d
---

# Story 6.4: Search Transactions

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to search my transactions by note text with a search box on the list — composing with the type/category filters, period, sort, and pagination I already have —
so that I can find specific entries across a large history (RP-B9), while this story also closes the repo-wide shape-only date-validation debt on the same date-composed surface (Epic 5 retro Action #1).

## Context & Why This Story

This is the **fourth story of Epic 6 (Manage Transactions at Scale)**. It adds free-text search over the transaction **note** column to the existing transactions list, and — because 6.4 introduces another date-range-composed query surface — it is the **assigned owner of the repo-wide date-validation hardening** (Epic 5 retro **Action #1**: "Close the shape-only date-validation debt repo-wide in Story 6-4"). Both pieces converge on the same file (`transaction-filter-query.dto.ts`), so they ship together.

**Scoping fact — search EXTENDS the existing list endpoint; it is NOT a new endpoint.** epics.md Story 6.4 is explicit: `GET /api/v1/transactions?search=<text>` "composing with the existing type/category filters, period, sort, and offset pagination `{ data, meta }`". A code audit confirms `transactionsFindAll` (`apps/api/src/modules/transactions/transactions.controller.ts` `@Get()` → `TransactionsService.findAll` → `TransactionsRepository.findAllByUserId` → `buildScopedConditions`) already owns every one of those composing filters. This story adds an optional `search` query param to that operation, a parameterized `ILIKE` predicate in the repository's shared `buildScopedConditions`, a `pg_trgm` GIN index on `note`, regenerates + commits the client (additive drift only), and builds the debounced search box + search-aware empty state on top — mirroring the reuse-first, contract-additive shape of 6-1/6-2/6-3.

**The searchable field is `note` (FR6), not "description".** supertool's free-text transaction column is `note` (`apps/api/src/database/schemas/transactions.ts` — `text('note').notNull().default('')`); the reference backend's equivalent is `description`. Search matches `note` only — category name is NOT searched (epics.md 6.4: "by note/description text"; the trigram index backs the note column). See D-4.

**The parity bar is exceed-where-forced, mirror-otherwise.** The reference (`example/tracker-backend-api`) does LIKE-escaped `ilike(description, '%term%')` backed by a `gin (description gin_trgm_ops)` index, with the extension enabled via a docker init file. supertool mirrors the query + index but must diverge on extension delivery (migrations run at boot via the drizzle migrator — there is no docker-init path, so the extension lives in the migration, D-6) and on the searched column (`note`, D-4). There is **no frontend search-input reference** in `example/track-my-life` (its filter hooks wire no search field) — the search UI is net-new (D-7/D-8). Where a hard rule or a supertool structural fact forces a divergence, it carries a `D-x` + rationale (Epic 5 retro D2).

**Evidence base (binding, per the Epic 4+ evidence-reference convention):**
- Reference code to adapt from (ED1 — study, never copy/import):
  - Backend query: `example/tracker-backend-api/src/modules/transactions/transactions.repository.ts` (~L141-144) — `const escaped = search.trim().replace(/[\\%_]/g, '\\$&'); conditions.push(ilike(transactions.description, `%${escaped}%`));` (LIKE-metachar escaping + `ilike`, AND-combined with the other filters).
  - Backend DTO: `example/tracker-backend-api/src/modules/transactions/dtos/transaction-query.dto.ts` — optional `search?: string` with `@ApiPropertyOptional`.
  - Backend controller: `example/tracker-backend-api/src/modules/transactions/transactions.controller.ts` (~L76) — forwards `search` into the service.
  - Trigram index: `example/tracker-backend-api/drizzle/0016_lazy_johnny_blaze.sql` (L51) — `CREATE INDEX ... USING gin ("description" gin_trgm_ops);`; extension in `example/tracker-backend-api/docker/init/01-extensions.sql` — `CREATE EXTENSION IF NOT EXISTS pg_trgm;`.
  - Frontend: **no counterpart** — `example/track-my-life/.../transactions/hooks/use-transaction-filters.ts` and `.../src/hooks/use-url-filters.ts` wire NO search field and NO debounce. Search box + debounce are new ground.
- epics.md Story 6.4 + Epic 6 charter; `epic-5-retro-2026-07-05.md` (Action #1 date-validation, #5 divergence checklist, #6 pre/post-QA baseline); Story 5-1 (`checkIsCalendarDate` round-trip proof), Story 6-3 (`6-3-export-transactions-csv-json.md` — the DTO base refactor this story builds on, and its explicit "export gets no `search` param" out-of-scope note).

## Recommended Approach (binding direction)

### 1. Backend — add `search` to the list contract (additive)

- **Shared search constant** `packages/shared/src/constants/transaction-search.ts` — `TRANSACTION_SEARCH_MAX_LENGTH = 200` (cap request abuse; single-sourced per memory `shared-constants-no-duplication`, read by both the API DTO `@MaxLength` and, if the frontend caps input, the search box).
- **DTO** — add `search` to **`FindTransactionsQueryDto` only**, NOT to the shared `TransactionFilterQueryDto` base (D-3). `FindTransactionsQueryDto` currently is `extends IntersectionType(PaginationQueryDto, TransactionFilterQueryDto)` with an empty body (`apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts`) — give it a body:
  ```ts
  export class FindTransactionsQueryDto extends IntersectionType(
    PaginationQueryDto,
    TransactionFilterQueryDto,
  ) {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(TRANSACTION_SEARCH_MAX_LENGTH)
    search?: string;
  }
  ```
  This keeps `ExportTransactionsQueryDto extends TransactionFilterQueryDto` (6-3) untouched, so the export contract gains no `search` param (honors 6-3's explicit out-of-scope note) and the generated `transactionsExport` op stays byte-identical. Only `transactionsFindAll` gains the optional `search` query param.
- **Repository** `transactions.repository.ts` — add optional `search?: string` to the `TransactionFilterQuery` interface and one predicate in the shared `buildScopedConditions`, so scoping/joins/filters stay single-sourced (both `findAllByUserId` and `findAllForExport` build through it; export simply never sets `search`):
  ```ts
  const normalizedSearch = query.search?.trim();
  if (normalizedSearch !== undefined && normalizedSearch !== '') {
    const escaped = normalizedSearch.replace(/[\\%_]/gu, '\\$&');
    conditions.push(ilike(transactions.note, `%${escaped}%`));
  }
  ```
  Add `ilike` to the existing `drizzle-orm` import in the repository (it is a standard drizzle operator but is NOT yet imported there — the current import list is `aliasedTable, and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, sql`). **Parameterization is automatic** — Drizzle binds `` `%${escaped}%` `` as a query parameter (`$n`), never string-interpolated into SQL (no injection). The `replace(/[\\%_]/gu, '\\$&')` escapes LIKE metacharacters (`\`, `%`, `_`) so a user typing `50%` or `a_b` matches literally; Postgres's default LIKE escape char is `\`, so no explicit `ESCAPE` clause is needed. Whitespace-only search → no predicate (returns the unfiltered period view). See AC 3 for the exact escaping/injection test matrix.
- **Service** `transactions.service.ts` — thread `search: query.search` into the `findAllByUserId` call in `findAll` (the only new line; `exportTransactions` is NOT touched — export never receives `search`).
- **Controller** — no change: `@Get()` `findAll` already binds the whole `FindTransactionsQueryDto` via `@Query()`.
- **Migration `0006` — `pg_trgm` + GIN index on `note` (D-6).** In `apps/api/src/database/schemas/transactions.ts` add the trigram index to the table builder: `index('transactions_note_trgm_idx').using('gin', sql`${table.note} gin_trgm_ops`)`. Run `pnpm --filter @supertool/api db:generate` to emit `0006_*.sql` (drizzle-kit emits the `USING gin (... gin_trgm_ops)` index but does **not** emit `CREATE EXTENSION`). **Hand-add `CREATE EXTENSION IF NOT EXISTS pg_trgm;` as the FIRST statement (with a `--> statement-breakpoint`) of the generated `0006` migration**, before the `CREATE INDEX`, because the index's `gin_trgm_ops` operator class requires the extension and supertool applies migrations at boot via the drizzle migrator (`apps/api/src/database/run-migrations.ts`) — there is no docker-init path like the reference. Verify the migration applies cleanly on a fresh Testcontainers Postgres.
- **Regenerate + commit the client:** `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`) → `pnpm --filter @supertool/shared generate:client`. Drift gate green; the diff is **additive-only** — `transactionsFindAll`'s `query` gains an optional `search`; `transactionsExport` and all other ops unchanged. (The date-hardening decorators in step 3 are custom class-validators and are NOT lifted into the spec, so they cause no drift.)

### 2. Frontend — debounced search box, composes with existing filters

- **Search param** — add `SEARCH_SEARCH_PARAM = 'search'` to `apps/money-tracker/src/app/[locale]/transactions/constants.ts` (component-scoped, beside `TYPE_SEARCH_PARAM` etc.). Value `search` matches epics.md `?search=` and the reference (D-1).
- **Parser** `utils/parse-transactions-search-params.ts` — add `search?: string` to `TransactionsSearchParams` and a `parseSearch` (trim; empty → `undefined`; optionally clamp to `TRANSACTION_SEARCH_MAX_LENGTH`) reading `searchParams[SEARCH_SEARCH_PARAM]` via `normalizeSearchParam`.
- **Compose through the existing plumbing** (search must travel with every other list param, D9 — shareable/back-button-safe):
  - `utils/build-transactions-suspense-key.ts` — append `params.search ?? ''` so the Suspense boundary resets on a new search.
  - `utils/build-transactions-redirect-query.ts` — add `search` to `TransactionViewParams` + `buildViewQuery` (so out-of-range-page redirects preserve the search term).
  - `utils/check-has-active-filters.ts` — treat a non-empty `search` as active (drives the empty-state variant; see below).
  - `components/transaction-list-server/TransactionListServer.tsx` — accept a `search` prop and pass it to `fetchTransactions`; forward a `variant` signal for the empty state (D-9).
  - `actions/fetch-transactions.ts` — add optional `search` to `FetchTransactionsParams` and to `buildFindAllQuery` (`if (params.search !== undefined) query.search = params.search;`). Consumed via the generated `TransactionsApiService.transactionsFindAll` (NFR6 — no hand-written fetch).
  - `page.tsx` — pass `params.search` into `<TransactionListServer>` and into `<TransactionFilters>`.
- **Search input** — add a text `Input` (`packages/ui` atom) to `TransactionFilters.tsx` (the client filter bar), labelled/placeholdered via `useTranslations(`${I18N_NAMESPACE.transactionsPage}.filters`)`. It is **debounced** (D-7): the input holds local state seeded from `params.search`, and a debounced (~300 ms) callback writes the URL param through the existing `use-transaction-filters` `writeParams` pattern (which already `next.delete(PAGE_SEARCH_PARAM)` — so a new search resets pagination). Clearing the box removes the param. Debounce is a **tiny local hook** (`useEffect` + `setTimeout` + cleanup, or a `useDebouncedCallback` util under `apps/money-tracker/src/utils/`) — **no new dependency** (no debounce util exists in the repo; architecture new-dep rule).
- **Empty state (D-9)** — distinguish "nothing matches your search" from "no transactions this period" (epics.md 6.4). `TransactionEmptyState` already has `variant: 'emptyMonth' | 'noMatches'`; **add a third `noSearchMatches` variant** with its own copy (`noSearchMatches.title/description/clear`), and select it when a search term is present (search takes priority over the generic filter `noMatches`). The "clear" affordance for the search-empty variant should clear the search (link back to the same period without `search`). `checkHasActiveFilters` already gates `noMatches` vs `emptyMonth`; extend the server wrapper's variant choice: search present → `noSearchMatches`, else other active filters → `noMatches`, else → `emptyMonth`.
- **Scope: search box on the by-date list ONLY** (D-8) — not the by-category detail. Reference parity: search is a list feature.

### 3. Companion cleanup — close the repo-wide shape-only date-validation debt (Epic 5 retro Action #1)

Deferred in Epics 2, 3, and 5; 6.4 is the assigned trigger. Do it once, repo-wide (the `checkIsCalendarDate` helper already exists and was proven at the 5-1 import boundary; `is-calendar-date.decorator.ts` already wraps it).

- **Backend — add real-calendar validation** to every DTO date field that is still shape-only (`@Matches(CALENDAR_DATE_PATTERN)` with no calendar check). Follow the existing `create-transaction.dto.ts` pattern (keep `@Matches(CALENDAR_DATE_PATTERN)` for the OpenAPI `pattern` lift AND add `@IsCalendarDate()`). Fields to harden:
  - `apps/api/src/modules/transactions/dtos/transaction-filter-query.dto.ts` — `dateFrom`, `dateTo` (shared by find + export).
  - `apps/api/src/modules/analytics/dtos/`: `find-summary-query.dto.ts`, `find-breakdown-query.dto.ts`, `find-trend-query.dto.ts`, `find-daily-spending-query.dto.ts`, `find-top-categories-query.dto.ts`, `find-by-category-query.dto.ts` — `dateFrom`, `dateTo` on each.
  - `create-transaction.dto.ts` / `update-transaction.dto.ts` already carry `@IsCalendarDate()` — no change.
- **Backend — cross-field range-order guard** (`dateFrom <= dateTo`): add a shared pure predicate `checkIsOrderedDateRange(from, to)` (to `packages/shared/src/constants/transaction-validation.ts`) + a class-validator decorator `IsOrderedDateRange(fromField, toField)` (`apps/api/src/shared/validators/is-ordered-date-range.decorator.ts`, mirroring `is-calendar-date.decorator.ts`). Apply at class level to `TransactionFilterQueryDto` (covers find + export) and the six analytics DTOs. It fires only when both fields are present-and-valid (both-required on analytics; both-optional on the filter DTO). No client drift (custom validator, not lifted).
- **Frontend** — `apps/money-tracker/src/utils/parse-dashboard-search-params.ts` currently uses `CALENDAR_DATE_PATTERN.test(...)` (shape-only) for `dateFrom`/`dateTo`; swap to `checkIsCalendarDate(...)` (already exported from `@supertool/shared`), closing the 5-5 re-flagged frontend gap. It already guards `dateTo < dateFrom`. The transactions parser (`parse-transactions-search-params.ts`) carries `period` (a month string), not raw `dateFrom`/`dateTo`, so it needs no date-validity change.
- **Tests** — DTO validation specs asserting shaped-but-invalid dates are rejected (`2025-02-31`, `2025-13-01`, `2025-00-10`, `2025-04-31`) and `dateTo < dateFrom` is rejected, across the hardened DTOs; a `parse-dashboard-search-params` test that a calendar-invalid date falls back to the default range.

## Acceptance Criteria

1. **Search extends the list endpoint, user-scoped, composing with all existing filters (RP-B9, FR21, D7).** Given the transactions module, when `GET /api/v1/transactions?search=<text>` is called by an authenticated user, then it returns **user-scoped** transactions (repository `eq(userId)` — no cross-user rows) whose **`note`** matches the text case-insensitively, **composing** (AND) with the existing `dateFrom`/`dateTo`, `type`, `categoryId` (subtree-aware), `sortBy`/`sortOrder`, and offset pagination `{ data, meta: { page, limit, total } }`. Search is a new optional param on the **existing** `transactionsFindAll` operation (no new endpoint); the predicate lives in the repository's shared `buildScopedConditions` (D7 — repository is the only DB layer) and the query reuses `getCategorySubtreeIds`/`buildOrderBy`/`selectJoinedTransactions` unchanged. An absent/empty/whitespace-only `search` returns the unfiltered period view (no predicate added). `meta.total` reflects the search-filtered count.
2. **Searched field is `note` only; single-default-currency preserved (FR6, RP-D1, D1).** Given a search, then it matches the `note` column only — not category name, amount, or date (D-4). No currency picker/param is added (RP-D1). Money stays string-typed and dates bare `YYYY-MM-DD` end-to-end (D1/RP-D5) — search adds no numeric coercion. A `search` longer than `TRANSACTION_SEARCH_MAX_LENGTH` (shared constant) returns 400 `VALIDATION_ERROR` (shared envelope).
3. **Search predicate is parameterized and LIKE/injection-safe (security).** Given the repository predicate, then it uses Drizzle `ilike(transactions.note, pattern)` where `pattern` is a **bound parameter** (never string-interpolated into SQL), and the user input has LIKE metacharacters escaped (`\` → `\\`, `%` → `\%`, `_` → `\_` via `replace(/[\\%_]/gu, '\\$&')`) so wildcards are matched literally (Postgres default `\` escape; no explicit `ESCAPE` clause needed). Unit/integration tests prove: a term with `%` / `_` matches those characters literally (not as wildcards); a classic SQL-injection payload (e.g. `'; DROP TABLE transactions;--` or `%' OR '1'='1`) returns zero/normal rows and does not execute or widen the result set; Cyrillic/Unicode note text matches; case-insensitivity holds; leading/trailing whitespace is trimmed.
4. **pg_trgm GIN index + extension via migration (D-6).** Given migration `0006`, then it runs `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (first statement) followed by `CREATE INDEX transactions_note_trgm_idx ... USING gin ("note" gin_trgm_ops);`, generated from the Drizzle schema index declaration with the extension statement hand-added (drizzle-kit does not emit it). The migration applies cleanly on a fresh Postgres (asserted by the Testcontainers suite booting through the migrator), and the search integration tests pass with the index present.
5. **Search box on the list, debounced, URL-carried, composes with filters/period/sort/page (D9, RP-B9).** Given the by-date transactions list, when I type in the search box, then the term is **debounced** (~300 ms) and written to a camelCase `search` URL search param via the existing filter-write path (which resets `page`), so it is shareable/back-button-safe and results update server-side; clearing the box removes the param; the search **composes** with the active type/category/sort and the current period (search is within the selected period, per epics.md); debounce uses a small local hook with **no new dependency**. The search box is on the by-date list only, not the by-category detail (D-8).
6. **Search-empty state is distinct from period-empty (epics.md 6.4).** Given a search that matches nothing in the current period, when viewed, then a localized empty state says "nothing matches your search" (a dedicated `noSearchMatches` variant of `TransactionEmptyState`) with an affordance to clear the search — visibly distinct from the "no transactions this period" (`emptyMonth`) and generic filter (`noMatches`) states. Both locales.
7. **Repo-wide date-validation debt closed (Epic 5 retro Action #1).** Given the query DTOs that were shape-only, then calendar-invalid dates are rejected: `transaction-filter-query.dto.ts` (dateFrom/dateTo) and all six analytics DTOs (`find-summary`, `find-breakdown`, `find-trend`, `find-daily-spending`, `find-top-categories`, `find-by-category`) reject `2025-02-31` / `2025-13-01` / `2025-00-10` / `2025-04-31` (via `@IsCalendarDate()` alongside the retained `@Matches` pattern), and reject `dateTo < dateFrom` (via the shared `IsOrderedDateRange` class-validator). The frontend `parse-dashboard-search-params.ts` uses `checkIsCalendarDate` (not shape-only `CALENDAR_DATE_PATTERN.test`). Tests cover each. This adds **no generated-client drift** (custom validators are not lifted to OpenAPI). Recorded as the retro-Action-#1 companion cleanup.
8. **Backend contract regenerated + committed (NFR6/D8).** Given the new `search` param, when the API builds, then `openapi.json`'s `transactionsFindAll` operation includes the optional `search` query param, the generated client is regenerated into `packages/shared/src/generated/` and **committed**, the drift gate is green, and the diff is **additive-only** — `transactionsExport` and every other operation's generated types are unchanged (verify with `git status --porcelain packages/shared/src/generated`). The frontend consumes search **only** through the generated client.
9. **i18n parity (FR19/FR20).** All new user-facing strings — the search label/placeholder, the `noSearchMatches` title/description/clear copy — land in `apps/money-tracker/messages/{en,uk}/transactions-page.json` in the same commit (real Ukrainian, ICU interpolation only, no concatenation); `pnpm i18n:parity` green.
10. **Tests ship with the feature (NFR1).** Backend: repository/service unit + Testcontainers integration (`apps/api/test/integration/`) covering search matching on `note`, **composition** with type/category-subtree/date-range/sort/pagination, **user-scoping** (user A's search never returns user B's rows), **LIKE-wildcard-escaping** (literal `%`/`_`), **injection-safety** (payload returns normal/empty result, no execution), **empty-result** (search with no matches → empty `data`, correct `meta.total`), Cyrillic/case-insensitive matching, and the `0006` migration applying (extension + index). Plus the date-hardening validation specs (AC 7). Frontend: component test for the debounced search box (typing debounces then writes the `search` URL param; clearing removes it), the `noSearchMatches` empty-state variant, and the `fetch-transactions`/parser/builders threading `search`. All repo gates green (`TURBO_FORCE=true` where turbo may replay stale logs); client-drift gate green.
11. **Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/6-4-search-transactions/` contains captures named `<scenario>--<viewport>--<theme>.png` covering **light + dark × 390px + desktop** for: the list header/filter bar with the search box (empty), an **active search with results** (term typed, filtered list), and the **no-search-matches** empty state. Verify no horizontal overflow at 390px (`document.documentElement.scrollWidth === window.innerWidth`) with the search box present and focused. Captured on `:3000` with the pre-QA environment checklist honored (verify `:3000` cwd is this checkout; DB baseline latest txn = 2025-02-03); search is read-only and does not mutate the baseline. Observations recorded in the Dev Agent Record (no frontend search reference exists — net-new surface; note this in the comparison).

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — carry patterns, never code): `example/tracker-backend-api/src/modules/transactions/transactions.repository.ts` (search escaping + `ilike`), `.../dtos/transaction-query.dto.ts` (`search?`), `.../transactions.controller.ts` (forward), `example/tracker-backend-api/drizzle/0016_lazy_johnny_blaze.sql` (`USING gin gin_trgm_ops`), `docker/init/01-extensions.sql` (extension). Note supertool divergences: column `note` not `description` (D-4), extension in-migration not docker-init (D-6), search on `FindTransactionsQueryDto` only (D-3), net-new search UI/debounce (D-7/D-8).
  - [x] Read in full the files this story updates: `apps/api/src/modules/transactions/transactions.{controller,service,repository}.ts` + `dtos/{find-transactions-query,transaction-filter-query}.dto.ts`, `apps/api/src/database/schemas/transactions.ts`, `apps/api/src/database/{run-migrations,prepare-database}.ts`, `apps/api/src/shared/validators/is-calendar-date.decorator.ts`, `packages/shared/src/constants/transaction-validation.ts`, the six `apps/api/src/modules/analytics/dtos/find-*-query.dto.ts`, `apps/api/test/integration/transactions.integration.spec.ts` (harness to extend); frontend `apps/money-tracker/src/app/[locale]/transactions/page.tsx`, `components/transaction-filters/{TransactionFilters.tsx,hooks/use-transaction-filters.ts}`, `components/transaction-empty-state/TransactionEmptyState.tsx`, `components/transaction-list-server/TransactionListServer.tsx`, `utils/{parse-transactions-search-params,build-transactions-suspense-key,build-transactions-redirect-query,check-has-active-filters}.ts`, `actions/fetch-transactions.ts`, `utils/parse-dashboard-search-params.ts`, `constants.ts`, `packages/ui/src/components/atoms/input/*`.
- [x] **Task 2 — Shared search constant** (AC: 1, 2)
  - [x] New `packages/shared/src/constants/transaction-search.ts`: `TRANSACTION_SEARCH_MAX_LENGTH = 200` (no magic numbers; single source read by the API DTO and, if used, the frontend cap).
- [x] **Task 3 — Backend DTO + repository predicate + service thread** (AC: 1, 2, 3)
  - [x] Add `search` to `FindTransactionsQueryDto` body only (`@IsOptional`/`@IsString`/`@MaxLength(TRANSACTION_SEARCH_MAX_LENGTH)`/`@ApiPropertyOptional`) — leave `TransactionFilterQueryDto` (shared with export) unchanged (D-3).
  - [x] Add optional `search` to the repo `TransactionFilterQuery` interface + the escaped-`ilike(transactions.note, …)` predicate in `buildScopedConditions` (trim; empty → skip; `replace(/[\\%_]/gu, '\\$&')`).
  - [x] Thread `search: query.search` into `findAllByUserId` from `TransactionsService.findAll` (do NOT touch `exportTransactions`).
- [x] **Task 4 — Migration 0006: pg_trgm extension + GIN index on note** (AC: 4)
  - [x] Declare `index('transactions_note_trgm_idx').using('gin', sql`${table.note} gin_trgm_ops`)` in `schemas/transactions.ts`; run `db:generate`; hand-add `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (with `--> statement-breakpoint`) as the first statement of `0006_*.sql`; verify clean apply on fresh Testcontainers Postgres.
- [x] **Task 5 — Regenerate + commit the generated client (additive)** (AC: 8)
  - [x] `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`; commit; confirm `transactionsFindAll` gains optional `search` and `transactionsExport`/others are byte-identical (`git status --porcelain packages/shared/src/generated`); drift gate green.
- [x] **Task 6 — Date-validation hardening, repo-wide (Epic 5 retro Action #1)** (AC: 7)
  - [x] Add `@IsCalendarDate()` (alongside the retained `@Matches(CALENDAR_DATE_PATTERN)`) to `transaction-filter-query.dto.ts` (dateFrom/dateTo) and the six analytics `find-*-query.dto.ts` DTOs.
  - [x] Add shared `checkIsOrderedDateRange` (to `transaction-validation.ts`) + `IsOrderedDateRange` class-validator decorator; apply to `TransactionFilterQueryDto` and the six analytics DTOs.
  - [x] Swap `parse-dashboard-search-params.ts` shape-only `CALENDAR_DATE_PATTERN.test` → `checkIsCalendarDate`.
  - [x] Re-run `generate:client` and confirm NO drift from the validation changes (custom validators not lifted).
- [x] **Task 7 — Frontend: search param plumbing** (AC: 5)
  - [x] `SEARCH_SEARCH_PARAM = 'search'` in transactions `constants.ts`; extend `parse-transactions-search-params.ts` (`search?`), `build-transactions-suspense-key.ts`, `build-transactions-redirect-query.ts` (`TransactionViewParams` + `buildViewQuery`), `check-has-active-filters.ts`; thread `search` through `fetch-transactions.ts`, `TransactionListServer.tsx`, `page.tsx`.
- [x] **Task 8 — Frontend: debounced search box + search-empty state** (AC: 5, 6, 9)
  - [x] Add the `Input`-based search box to `TransactionFilters.tsx` with a local debounce hook (no new dep) writing the `search` param via `use-transaction-filters` `writeParams` (page reset preserved); local state seeded from `params.search`; clearing removes the param.
  - [x] Add `noSearchMatches` variant + copy to `TransactionEmptyState.tsx`; select it in `TransactionListServer` when a search term is present (priority over `noMatches`), with a clear-search affordance.
- [x] **Task 9 — i18n** (AC: 9)
  - [x] Add `filters.searchLabel`, `filters.searchPlaceholder`, and `noSearchMatches.{title,description,clear}` to `messages/{en,uk}/transactions-page.json` — real Ukrainian, ICU. `pnpm i18n:parity` green.
- [x] **Task 10 — Tests** (AC: 3, 4, 7, 10)
  - [x] Backend: repository/service unit (escaping, empty-skip) + Testcontainers integration (matching, composition, user-scoping, wildcard-escaping, injection-safety, empty-result, Cyrillic/case-insensitive, migration apply). Date-hardening DTO validation specs + `parse-dashboard-search-params` test.
  - [x] Frontend: debounced search box (debounce→URL write, clear removes), `noSearchMatches` empty state, parser/builders/`fetch-transactions` threading.
- [x] **Task 11 — Gates, visual QA, record** (AC: 8, 10, 11)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where turbo may replay; plus the client-drift gate.
  - [x] Capture + commit the visual-QA matrix per AC 11 under `visual-qa/6-4-search-transactions/`; verify `:3000` cwd + seed baseline before capture.
  - [x] Record in the Dev Agent Record: D-1…D-10 decisions and the flagged divergences (D-3 search-on-find-only, D-4 note-not-description, D-6 extension-in-migration, D-7 debounce-no-dep, D-8 list-only, D-10 date-hardening scope) as a short operator checklist for PR (Epic 5 retro Action #5).

## Dev Notes

### Decisions (D-x) — reference-consistent unless flagged; recorded for operator confirmation at PR

- **D-1 — Search URL/query param name = `search`.** Matches epics.md 6.4 (`?search=<text>`) and the reference backend's `search`; camelCase-consistent with the existing `sortBy`/`categoryId` params. (The task offered `q` as an alternative; `search` is the epics-specified name — chosen for spec fidelity.)
- **D-2 — Extend the existing `transactionsFindAll` operation, NOT a new endpoint.** epics.md 6.4 is explicit (`GET /api/v1/transactions?search=`) and the list endpoint already owns every composing filter (type/category/period/sort/pagination). One additive optional param is strictly simpler and keeps search composing for free. A separate `/transactions/search` endpoint would duplicate the whole filter+pagination surface (reuse-first violation).
- **D-3 — `search` on `FindTransactionsQueryDto` only, not the shared `TransactionFilterQueryDto` base.** 6-3 refactored the query DTOs so `FindTransactionsQueryDto extends IntersectionType(PaginationQueryDto, TransactionFilterQueryDto)` and `ExportTransactionsQueryDto extends TransactionFilterQueryDto`. Adding `search` to the shared base would leak it into the export contract — which 6-3 explicitly declared out-of-scope ("No `search` param is added to the export DTO"). Putting `search` in the `FindTransactionsQueryDto` body keeps export byte-identical. The repository's shared `buildScopedConditions` still gains the predicate (single-sourced scoping); export just never sets `search`, so its behavior is unchanged.
- **D-4 — Search matches `note` only (not category name).** epics.md 6.4: "by note/description text"; the trigram index backs the `note` column. supertool's free-text column is `note` (the reference's is `description`). Category-name search is not in scope (a future enhancement could join category names, but it would not use the note trigram index). FR6 = the note field.
- **D-5 — Parameterized `ILIKE` with LIKE-metachar escaping (adapt reference).** `ilike(transactions.note, `%${escaped}%`)` binds the pattern as a query parameter (no raw interpolation → no injection); `replace(/[\\%_]/gu, '\\$&')` escapes `\`/`%`/`_` so wildcards match literally. Postgres's default LIKE escape char is `\`, so no explicit `ESCAPE` clause is needed. Mirrors `example/tracker-backend-api`'s exact approach, adapted to `note` and supertool's Drizzle imports. Trigram search vs plain `ILIKE`: the query is `ILIKE '%term%'`; the `gin_trgm_ops` index (D-6) accelerates it — behavior identical, latency lower.
- **D-6 — `pg_trgm` extension + GIN index delivered IN migration 0006 (divergence from the reference's docker-init).** The reference enables the extension via `docker/init/01-extensions.sql`. supertool applies migrations at boot through the drizzle migrator (`run-migrations.ts` → `prepareDatabase`) with no docker-init hook, so the extension must live in the migration. drizzle-kit emits the `USING gin (... gin_trgm_ops)` index from the schema declaration but does NOT emit `CREATE EXTENSION` — hand-add `CREATE EXTENSION IF NOT EXISTS pg_trgm;` as the first statement of `0006_*.sql`. Flagged: the only hand-edit to a generated migration in the repo so far; kept minimal and idempotent (`IF NOT EXISTS`).
- **D-7 — Debounced search input via a small local hook, NO new dependency (net-new; no reference).** No debounce util exists in the repo and `example/track-my-life` wires no search field, so this is new ground. A `useEffect`+`setTimeout`+cleanup (or `useDebouncedCallback`) local hook (~300 ms) writes the URL param through the existing `use-transaction-filters` `writeParams` (which already resets `page`). Adding a `use-debounce`/lodash dep is avoided per the architecture new-dep rule. Flagged as a UX choice (debounce interval) for operator confirmation.
- **D-8 — Search box on the by-date list ONLY, not the by-category detail.** Reference parity — search is a transactions-list feature; the by-category drill-down is a category-scoped view. The backend `search` param is technically reachable by any `transactionsFindAll` caller, but no search UI is added to the detail. Flagged (a later story could add it if warranted).
- **D-9 — Dedicated `noSearchMatches` empty-state variant.** epics.md 6.4 requires distinguishing "nothing matches your search" from "no transactions this period". `TransactionEmptyState` already has `emptyMonth`/`noMatches`; adding a third search-specific variant (selected when a search term is present, priority over the generic filter `noMatches`) gives the exact copy the AC asks for, with a clear-search affordance. (Alternative considered: reuse the generic `noMatches` copy — rejected because the AC wants search-specific wording.)
- **D-10 — Repo-wide date-validation hardening folded into this story (Epic 5 retro Action #1).** 6.4 adds a new date-composed surface and touches `transaction-filter-query.dto.ts` directly, making it the natural, retro-assigned trigger to close a 3-epic-old shape-only-date debt in one pass: `@IsCalendarDate()` across the filter DTO + six analytics DTOs, a shared `IsOrderedDateRange` guard, and the `parse-dashboard-search-params` frontend swap. Bounded and additive; no client drift (custom validators aren't lifted). Flagged: if the operator prefers to keep 6.4 search-pure, this cleanup can split into a companion story — but the retro explicitly assigns it here, so it ships together by default.

### Out of scope (explicitly — later Epic 6 stories / deferred)

- **Analytics response caching → Story 6-5** (Epic 5 retro Action #2, incl. the analytics range-robustness items). Search is not cached; do NOT pull caching in.
- **Export gets no `search` param** (6-3 out-of-scope note honored via D-3) — export continues to honor only the existing list filters.
- No category-name/amount/date text search (D-4); no fuzzy/similarity ranking or `word_similarity` scoring (plain `ILIKE`-class substring match per epics.md); no search on the by-category detail (D-8); no cross-period "search all history" (search composes within the selected period, per epics.md — a full-history search mode is a possible later enhancement, recorded, not built); no search highlighting in results; no recent-searches/autocomplete.

### Epic 5 retro action items that apply to this story

- **Action #1 — Close the shape-only date-validation debt repo-wide (this story).** Delivered via D-10 / AC 7 (backend DTOs + shared range guard + frontend parser). This is the explicit reason 6-4 owns the hardening.
- **Action #5 — Make divergence-flag resolution explicit at PR time:** list D-3, D-4, D-6, D-7, D-8, D-10 in the PR description as an operator checklist.
- **Action #6 — Pre-QA + post-QA DB-baseline checklist:** `lsof`-verify the `:3000` cwd is this checkout, capture on the clean seed baseline (latest txn = 2025-02-03); search is read-only, no restore needed.
- **Contract-first / additive (Epic 5 retro D1):** the endpoint change + Testcontainers suite + regenerated client land with the UI in one cohesive story (a thin additive param + its consumer — acceptable per the 5-6/6-2/6-3 precedent).

### Reference patterns (ED1 — study, adapt, never copy/import)

- Backend query + escaping: `example/tracker-backend-api/src/modules/transactions/transactions.repository.ts` (search branch), `.../dtos/transaction-query.dto.ts` (`search?`), `.../transactions.controller.ts` (forward). Adapt: column `note` (D-4), add Drizzle `ilike` to the repository import (not yet imported), supertool DTO base (`FindTransactionsQueryDto` only, D-3), `@supertool/shared` constant for max length.
- Trigram index/extension: `example/tracker-backend-api/drizzle/0016_lazy_johnny_blaze.sql` (`USING gin gin_trgm_ops`) + `docker/init/01-extensions.sql`. Adapt: extension in migration 0006 (D-6), target `note`.
- **No reference counterpart — new ground:** the frontend search box + debounce (reference wires no search field), the `noSearchMatches` empty-state variant, the extension-in-migration delivery, and the `IsOrderedDateRange` cross-field validator.

### Hard-rule guardrails (CLAUDE.md / architecture.md — binding)

- Money is strings end-to-end; no float math (D1). Dates bare `YYYY-MM-DD`, no timezone math (RP-D5). Single default currency, no currency param (RP-D1).
- API access ONLY via the generated client (NFR6) — search flows through the generated `transactionsFindAll` via the existing `fetch-transactions` RSC read; a hand-written `fetch`/raw query to `/api/*` is a defect. controller→service→repository layering; the repository is the only DB-touching layer (D7); explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable.
- **Search is user-scoped (FR21)** — the predicate composes with `eq(transactions.userId, userId)` in `buildScopedConditions`; never a cross-user match. **No raw string interpolation into SQL** — Drizzle `ilike` binds a parameter; LIKE metachars escaped (D-5). Regenerate + commit the generated client; drift additive-only; drift gate green.
- REST: `/api/v1/...`, camelCase JSON, error envelope `{ statusCode, code, message, details? }` with the shared `ErrorCode` enum; offset pagination `{ data, meta }`.
- next-intl ICU (no concatenation); `FC<Props>`; PascalCase component files; kebab-case dirs; SCSS design tokens only; mobile-first; URL search params carry search + filter/sort/period/page (D9).
- Routes only via `ROUTES`/`get*Path`; navigation via `@supertool/next-shared` i18n, never `next/navigation`/`next/link` directly (the filter hook already uses the i18n `useRouter`/`usePathname`).
- No barrel files, no re-exports, no code comments; `list` suffix for arrays; `get/check/format/parse/convert/build` function prefixes; `as const` objects over TS enums (derive unions via `ObjectValuesUnion`); no `as` assertions in production code (narrow with `checkIs*` guards); new deps exact-pinned — **none expected** (debounce hand-rolled, `Input` atom already present).

### Testing standards summary

- API: co-located `*.spec.ts` (Vitest + SWC decorators) for the repository search branch / service thread and the date-hardening DTO validation; Testcontainers integration in `apps/api/test/integration/` (extend `transactions.integration.spec.ts`; reuse `test/helpers/postgres-container.ts`) — search matching on `note`, composition with every other filter, user-scoping, LIKE-wildcard-escaping, injection-safety, empty-result, Cyrillic/case-insensitivity, and the `0006` extension+index migration applying on a fresh container. Frontend: co-located `*.test.ts(x)` (Vitest + @testing-library/react) — the debounced search box (fake timers: type → debounce → URL write; clear → param removed), the `noSearchMatches` empty state, and the parser/builders/`fetch-transactions` search threading. Run via pnpm scripts; `TURBO_FORCE=true` when verifying gates (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`).

### Project Structure Notes

- Backend: extend existing `apps/api/src/modules/transactions/` (no new provider); new shared constant `packages/shared/src/constants/transaction-search.ts`; new `apps/api/src/shared/validators/is-ordered-date-range.decorator.ts`; new migration `apps/api/src/database/migrations/0006_*.sql`; regenerated client in `packages/shared/src/generated/` (committed).
- Frontend: search box + debounce hook under `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/` (extend the existing filter bar + `use-transaction-filters` hook, or a co-located sibling hook); `noSearchMatches` in the existing `transaction-empty-state/`; new i18n keys in `messages/{en,uk}/transactions-page.json`.
- New visual-QA directory: `_bmad-output/implementation-artifacts/visual-qa/6-4-search-transactions/`.
- Branch: `TOOLS-6-4/search-transactions` off `main`; conventional commits; PR via `create-pr` (memory `story-work-via-pr`). This story's branch also carries the pending `sprint-status.yaml` edits (6-3 → done, 6-4 → ready-for-dev) already in the working tree — do NOT commit story creation to `main`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4] and [#Epic 6: Manage Transactions at Scale] (charter + RP-B9 + evidence-reference convention; `GET /api/v1/transactions?search=`, note field, empty-state distinction)
- [Source: _bmad-output/planning-artifacts/epics.md#RP-B9] (full-text search) and [#RP-D1] (single currency) and [#RP-D5] (bare date)
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — D1 (money strings), D7 (layering + repository-only DB + error envelope + offset pagination), D8/NFR6 (generated client + drift gate), D9 (RSC reads + URL search params for filter state), D3 (class-validator + swagger CLI), D10 (Vitest + Testcontainers)
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-05.md#Action Items] (Action #1 date-validation repo-wide → owned by 6-4, #5 divergence checklist, #6 pre/post-QA baseline) and [#Challenges & Recurring Patterns] (§3 shape-only date validation) and [#Next Epic Preview — Epic 6]
- [Source: _bmad-output/implementation-artifacts/6-3-export-transactions-csv-json.md#Out of scope] (export gets no `search` param — the DTO-base boundary this story respects; the `TransactionFilterQueryDto`/`FindTransactionsQueryDto`/`ExportTransactionsQueryDto` refactor)
- [Source: _bmad-output/implementation-artifacts/5-1-transaction-import-endpoint.md] (`checkIsCalendarDate` round-trip proof — the date-hardening helper already exists and is proven)
- [Source: apps/api/src/modules/transactions/transactions.repository.ts] (`buildScopedConditions`, `getCategorySubtreeIds`, `buildOrderBy`, `selectJoinedTransactions`, `TransactionFilterQuery` — extend with the search predicate)
- [Source: apps/api/src/modules/transactions/dtos/{find-transactions-query,transaction-filter-query}.dto.ts] and [apps/api/src/shared/dtos/pagination-query.dto.ts] (DTO composition — add `search` to find only)
- [Source: apps/api/src/database/schemas/transactions.ts] (`note` column + existing indexes — add the trigram index) and [apps/api/src/database/{run-migrations,prepare-database}.ts] (boot migrator — why the extension lives in the migration) and [apps/api/drizzle.config.ts] (`out`/`db:generate`)
- [Source: apps/api/src/shared/validators/is-calendar-date.decorator.ts] and [packages/shared/src/constants/transaction-validation.ts] (`checkIsCalendarDate`, `CALENDAR_DATE_PATTERN` — the hardening helpers; add `checkIsOrderedDateRange`)
- [Source: apps/api/src/modules/analytics/dtos/find-{summary,breakdown,trend,daily-spending,top-categories,by-category}-query.dto.ts] (the six shape-only date DTOs to harden)
- [Source: apps/money-tracker/src/app/[locale]/transactions/page.tsx + components/transaction-filters/{TransactionFilters.tsx,hooks/use-transaction-filters.ts} + components/transaction-empty-state/TransactionEmptyState.tsx + components/transaction-list-server/TransactionListServer.tsx] (list surfaces to wire search into)
- [Source: apps/money-tracker/src/app/[locale]/transactions/utils/{parse-transactions-search-params,build-transactions-suspense-key,build-transactions-redirect-query,check-has-active-filters}.ts + constants.ts + actions/fetch-transactions.ts] (search plumbing)
- [Source: apps/money-tracker/src/utils/parse-dashboard-search-params.ts] (frontend shape-only date check to swap for `checkIsCalendarDate` — 5-5 re-flagged gap)
- [Reference: example/tracker-backend-api/src/modules/transactions/{transactions.repository.ts,transactions.controller.ts,dtos/transaction-query.dto.ts} + drizzle/0016_lazy_johnny_blaze.sql + docker/init/01-extensions.sql] (ED1 — search query, trigram index, extension)
- [Source: .claude/rules/{nestjs-apis.md,javascript.md,typescript.md,react.md,i18n.md,styles.md}] (conventions)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- Gates (all green, `TURBO_FORCE=true` on turbo-backed): `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test` (45 api test files / 364 tests, incl. Testcontainers search + migration suites; money-tracker + shared unit), `pnpm i18n:parity`, `pnpm build`.
- Client-drift gate: after `pnpm --filter @supertool/api build` + `pnpm turbo run generate:client`, `git status --porcelain packages/shared/src/generated` shows only `types.gen.ts` with the single additive line `search?: string` on `TransactionsFindAllData.query`; `transactionsExport` and all other ops byte-identical. `openapi.json` is git-ignored (build artifact).
- Migration `0006_swift_mattie_franklin.sql` verified applying on a fresh Testcontainers Postgres via the boot migrator (integration `beforeAll` → `prepareDatabase`); explicit specs assert `pg_trgm` in `pg_extension` and `transactions_note_trgm_idx` (gin / gin_trgm_ops) in `pg_indexes`.

### Completion Notes List

- **Search extends the existing list endpoint (D-2/D-3):** `search` added to `FindTransactionsQueryDto` body ONLY (`@IsOptional`/`@IsString`/`@MaxLength(TRANSACTION_SEARCH_MAX_LENGTH=200)`); the shared `TransactionFilterQueryDto` base is untouched, so `ExportTransactionsQueryDto` (6-3) gains no `search` param and the export contract stays byte-identical.
- **Parameterized, LIKE/injection-safe predicate (D-5):** repository `buildSearchCondition` uses Drizzle `ilike(transactions.note, \`%${escaped}%\`)` (bound param — no interpolation); `escapeLikePattern` escapes `\ % _` via `replace(/[\\%_]/gu, String.raw\`\$&\`)`. Whitespace-only → no predicate. Added `ilike` to the repo's `drizzle-orm` import. Integration tests prove: `%`/`_` matched literally (vs wildcard decoys `5000off`/`axb`), a `'; DROP TABLE transactions;--` payload is inert (table survives), Cyrillic + case-insensitive match, empty-result total, user-scoping, and composition with type + offset pagination.
- **pg_trgm GIN index (D-6):** schema declares `index('transactions_note_trgm_idx').using('gin', sql\`${table.note} gin_trgm_ops\`)`; `CREATE EXTENSION IF NOT EXISTS pg_trgm;` hand-added as the first statement of the generated `0006` migration (drizzle-kit does not emit it), applied at boot by the drizzle migrator.
- **Debounced search box, no new dep (D-7):** local `useDebouncedCallback` hook (`apps/money-tracker/src/utils/`, ~300 ms `SEARCH_DEBOUNCE_MS`); the `Input` atom in `TransactionFilters` seeds from `params.search`, writes the `search` URL param via the existing `use-transaction-filters` `writeParams` (which already resets `page`), and clearing removes the param. Search composes through the whole plumbing (parser, suspense key, redirect query, `check-has-active-filters`, `fetch-transactions` → generated `transactionsFindAll`, list-server, page). List-only (D-8).
- **`noSearchMatches` empty-state variant (D-9):** added a third variant to `TransactionEmptyState` with dedicated copy + a "Clear search" affordance that preserves the other filters (drops only `search`); the server wrapper selects search-present → `noSearchMatches`, else active filters → `noMatches`, else → `emptyMonth`.
- **Date-validation hardening (D-10 / Epic 5 retro Action #1):** `@IsCalendarDate()` added alongside the retained `@Matches(CALENDAR_DATE_PATTERN)` on `transaction-filter-query.dto.ts` (dateFrom/dateTo, propagated through IntersectionType to find + inherited by export) and the six analytics find-query DTOs. New shared pure predicate `checkIsOrderedDateRange` + class-level `IsOrderedDateRange('dateFrom','dateTo')` validator applied to all seven DTOs. **Decision (recorded):** the pre-existing `IsOnOrAfter` property validator on four analytics DTOs did exactly `dateTo >= dateFrom`; to give one uniform range guard repo-wide (and honor the retro's consistency intent) it was replaced by `IsOrderedDateRange` and `is-on-or-after.decorator.ts` was deleted (no remaining references). The new validator registers the error on the `toField` ('dateTo'), so existing analytics specs stay green. Frontend `parse-dashboard-search-params.ts` swapped from shape-only `CALENDAR_DATE_PATTERN.test` to `checkIsCalendarDate`. No client drift (custom validators are not lifted to OpenAPI).
- **Lint refactors (repo rules):** `buildScopedConditions` rewritten as an optional-condition list + filter (max-statements); `buildFindAllQuery` compacted to spreads; `TransactionListServer` empty state extracted to `renderEmptyTransactionState`; `TransactionFilters` option lists extracted to `buildFilterOptionLists`; two sort handlers merged via `useMemo`.
- **Operator divergence checklist for PR (Epic 5 retro Action #5):** D-3 (search on find DTO only), D-4 (note not description), D-6 (extension in migration), D-7 (debounce, no dep), D-8 (list only), D-10 (date hardening scope + `IsOnOrAfter`→`IsOrderedDateRange` consolidation).

### Visual QA

- Captured on `:3000` served by `next dev` from THIS checkout; api restarted from the fresh build on `:3001` (verified process cwd; stale pre-change api killed). Migration `0006` confirmed applied to the live DB (`pg_trgm` extension + `transactions_note_trgm_idx` present). DB baseline verified: 1880 rows, latest txn `2025-02-03`, operator signed in with seeded creds.
- **Seed data has zero notes** — so a note search over the real baseline returns nothing. To capture "active search with results", 3 noted operator transactions were inserted in Feb 2025, captured, then **deleted to restore the baseline** (re-verified 1880 rows / latest 2025-02-03 / 0 notes). Search is read-only in normal use.
- Verified live: typing "Coffee" debounces → `?search=Coffee` and filters to the 2 Coffee-noted rows; Cyrillic "Кава" → 1 row ("Кава ранкова у кафе"); `search=Coffee&type=expense` → 2 rows, `&type=income` → 0 (noSearchMatches). No horizontal overflow at 390px with the search box focused (`documentElement.scrollWidth === innerWidth === 390`).
- 12 screenshots (search-empty / search-results / no-search-matches × 390 + desktop × light + dark) in `_bmad-output/implementation-artifacts/visual-qa/6-4-search-transactions/`. No frontend search reference exists in `example/track-my-life` — this is a net-new surface; layout mirrors the existing filter-bar/empty-state patterns.

### File List

- apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts (search param)
- apps/api/src/modules/transactions/dtos/find-transactions-query.dto.spec.ts (new)
- apps/api/src/modules/transactions/dtos/transaction-filter-query.dto.ts (date hardening)
- apps/api/src/modules/transactions/transactions.repository.ts (ilike import, escaped search predicate)
- apps/api/src/modules/transactions/transactions.service.ts (thread search)
- apps/api/src/modules/transactions/transactions.service.spec.ts (search forward test)
- apps/api/src/database/schemas/transactions.ts (trigram index)
- apps/api/src/database/migrations/0006_swift_mattie_franklin.sql (new: pg_trgm + gin index)
- apps/api/src/database/migrations/meta/* (drizzle snapshot/journal for 0006)
- apps/api/src/shared/validators/is-ordered-date-range.decorator.ts (new)
- apps/api/src/shared/validators/is-on-or-after.decorator.ts (deleted)
- apps/api/src/modules/analytics/dtos/find-summary-query.dto.ts + .spec.ts (new spec)
- apps/api/src/modules/analytics/dtos/find-breakdown-query.dto.ts + .spec.ts (new spec)
- apps/api/src/modules/analytics/dtos/find-trend-query.dto.ts + .spec.ts
- apps/api/src/modules/analytics/dtos/find-daily-spending-query.dto.ts + .spec.ts
- apps/api/src/modules/analytics/dtos/find-top-categories-query.dto.ts + .spec.ts
- apps/api/src/modules/analytics/dtos/find-by-category-query.dto.ts + .spec.ts
- apps/api/test/integration/transactions.integration.spec.ts (search + migration suites)
- packages/shared/src/constants/transaction-search.ts (new)
- packages/shared/src/constants/transaction-validation.ts (checkIsOrderedDateRange)
- packages/shared/src/constants/transaction-validation.spec.ts
- packages/shared/src/generated/types.gen.ts (regenerated: additive search)
- apps/money-tracker/src/utils/use-debounced-callback.ts (new) + .test.ts (new)
- apps/money-tracker/src/utils/parse-dashboard-search-params.ts (checkIsCalendarDate)
- apps/money-tracker/src/actions/fetch-transactions.ts (search)
- apps/money-tracker/src/app/[locale]/transactions/constants.ts (SEARCH_SEARCH_PARAM)
- apps/money-tracker/src/app/[locale]/transactions/page.tsx (pass search)
- apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.ts + .test.ts
- apps/money-tracker/src/app/[locale]/transactions/utils/build-transactions-suspense-key.ts
- apps/money-tracker/src/app/[locale]/transactions/utils/build-transactions-redirect-query.ts
- apps/money-tracker/src/app/[locale]/transactions/utils/check-has-active-filters.ts + .test.ts
- apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.tsx + .test.tsx
- apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/constants.ts (SEARCH_DEBOUNCE_MS)
- apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/hooks/use-transaction-filters.ts (handleSearchChange)
- apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx (search prop, empty-state variant)
- apps/money-tracker/src/app/[locale]/transactions/components/transaction-empty-state/TransactionEmptyState.tsx + .test.tsx (noSearchMatches)
- apps/money-tracker/messages/en/transactions-page.json + uk/transactions-page.json (search + noSearchMatches copy)
- _bmad-output/implementation-artifacts/visual-qa/6-4-search-transactions/*.png (12 captures)
- _bmad-output/implementation-artifacts/sprint-status.yaml (6-4 → review)

### Change Log

- 2026-07-05 — Story 6.4 implemented: note search on the transactions list (additive `search` param on `transactionsFindAll`, parameterized escaped `ilike`, pg_trgm GIN index via migration 0006, debounced search box + `noSearchMatches` empty state) plus repo-wide date-validation hardening (`@IsCalendarDate()` + shared `IsOrderedDateRange` across the filter DTO and six analytics DTOs; `parse-dashboard-search-params` calendar check). All gates green; client drift additive-only. Status → review.
- 2026-07-05 — Code review APPROVE (3 adversarial layers, 0 must-fix; search escape/injection + date refactor independently verified; 4 non-blocking nice-to-haves noted as follow-ups). PR opened: https://github.com/BudnikOleksii/supertool/pull/44
