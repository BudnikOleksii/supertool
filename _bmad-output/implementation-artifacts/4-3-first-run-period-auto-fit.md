---
baseline_commit: 6f0292716a9320d94c2c6118b9ce980c3d8ea745
---

# Story 4.3: First-Run Period Auto-Fit

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii opening the tracker for the first time after importing years of history,
I want the dashboard and list to open on a period that actually has data,
so that I see my money instead of an empty "No data" current month (RP-U5).

## Context & Why This Story

Both the dashboard and the transactions list are **month-scoped** and, when no `?period=` is in the URL, default to **the current month** (`getCurrentPeriod()` → today, e.g. `2026-06`). But the seeded operator's data lives entirely in **2025** (latest seeded transaction is `02/03/2025` → period **`2025-02`**), and a real user importing years of history is in the same boat. The result: a brand-new visit lands on an empty current month and shows "No transactions for this month" / "No activity this month" — exactly the spike's **RP-U5** finding. The reference (`example/track-my-life`) shares this defect; **this story must exceed it, not replicate it** (gap backlog §5).

This is a **pure default-resolution change** — no new product capability, no new UI chrome. When (and only when) the URL carries no period, the default auto-fits to the month of the user's **latest transaction**. The hard constraint: **URL-driven period state stays authoritative and shareable (D9)** — a period explicitly in the URL always wins; auto-fit is the *absence-of-period* default only.

**Evidence (cite in the Dev Agent Record):**
- supertool baseline (near-empty on the current month): `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/supertool/` (dashboard + list on June 2026). Capture log: `…/spike-reference-parity/42-supertool-capture-log.md`.
- reference target / shared defect: `…/spike-reference-parity/reference/dashboard--overview*.png`, `…/reference/transactions--list--*.png` (auth-app log `41-ref-capture-authenticated-log.md`).
- Gap detail: `_bmad-output/planning-artifacts/reference-parity-gap-backlog.md` lines 58, 81, 85 (RP-U5 — empty/first-run states, "auto-fit the period to the data's date range on first load", P1).

## Recommended Approach (binding direction — prevents the two obvious wrong paths)

> ⚠️ **Do NOT add a new API endpoint and do NOT migrate the schema.** The latest-transaction lookup is achievable with the **existing generated client** — reuse `TransactionsApiService.transactionsFindAll` with `page=1, limit=1, sortBy=date, sortOrder=desc` and **no date filter**; the first row is the user's most recent transaction. A new `GET /transactions/latest-date` endpoint is over-engineering and violates the "reuse first" intent (NFR6 is still honored either way, but the endpoint is unnecessary). **Do NOT implement a month-by-month walk-back loop** ("is this month empty? try the previous month…") — that is the "infinite look-back" AC #4 forbids. One bounded query finds the latest month directly.

The auto-fit is **async** (it requires a fetch), so resolution moves into the async server pages (both already `async`). Recommended shape — a thin new read action + a shared resolver + a tiny pure util:

1. **New read action** `src/actions/fetch-latest-transaction-date.ts` — mirrors `fetch-transactions.ts` exactly (cookie forwarding via `createServerApiClient`, `cache()` wrap, `{ data, error }` handling). Calls `TransactionsApiService.transactionsFindAll` with `{ page: FIRST_PAGE, limit: 1, sortBy: DEFAULT_SORT_BY, sortOrder: DEFAULT_SORT_ORDER }` (no `dateFrom`/`dateTo`). Returns the first row's `date` (`"YYYY-MM-DD"`) or `null` when the user has no transactions / on error. Reuse `DEFAULT_SORT_BY` (=`date`) and `DEFAULT_SORT_ORDER` (=`desc`) and `FIRST_PAGE` from `@supertool/shared/constants/*` — no hardcoded `'date'`/`'desc'`/`1` literals.
2. **New pure util** `getPeriodFromDate(date: string): string` in `src/utils/period.ts` — `"YYYY-MM-DD"` → `"YYYY-MM"` (recommended: `formatPeriod(parsePeriod(date.slice(0, PERIOD_LENGTH)))` so it reuses existing validation/formatting; define `PERIOD_LENGTH = 7` as a named constant, no magic number).
3. **New async resolver** `src/utils/resolve-default-period.ts` exporting `resolveDefaultPeriod(rawPeriod: string | undefined): Promise<string>`:
   - If `rawPeriod` is present **and valid** → return `formatPeriod(parsePeriod(rawPeriod))` and **do not fetch** (URL wins — AC #3).
   - Else → `await fetchLatestTransactionDate()`; if `null` → `getCurrentPeriod()` (AC #4); otherwise compute `latestPeriod = getPeriodFromDate(latestDate)` and **return the chronological min of `latestPeriod` and `getCurrentPeriod()`** — `'YYYY-MM'` strings compare correctly lexicographically, so `latestPeriod < currentPeriod ? latestPeriod : currentPeriod`. This satisfies all four ACs *and* defensively clamps a future-dated transaction back to the current month (AC #2's "current month preserved" never regresses).
4. **Validity guard:** extract a `checkIsValidPeriod(value: string): boolean` predicate in `period.ts` (the pattern + range check currently inlined in `parsePeriod`) and reuse it in **both** `parsePeriod` and the resolver — single source of truth, so "present & valid" means the same thing everywhere. (Distinguishing absent-or-invalid from valid is why the resolver can't just lean on `parsePeriod`'s silent current-month fallback.)

**Wiring (single source for `period` — no duplication):**
- **Dashboard** (`dashboard/page.tsx:45`): replace `formatPeriod(parsePeriod(normalizeSearchParam(...)))` with `await resolveDefaultPeriod(normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM]))`. Drop now-unused `formatPeriod`/`parsePeriod` imports if nothing else uses them.
- **Transactions** (`transactions/page.tsx` + `parse-transactions-search-params.ts`): the parse util currently owns the period default (`rawPeriod ?? getCurrentPeriod()`, lines 61-62). Refactor `parseTransactionsSearchParams(searchParams, period: string)` to **accept the already-resolved period** and just assign it (remove its internal period read/default). The page does `const period = await resolveDefaultPeriod(normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM])); const params = parseTransactionsSearchParams(searchParams, period);`. Keeps `period` single-sourced through `params.period` (MonthStepper, suspense key, `TransactionListServer` unchanged).

**Why this is cheap:** the extra query runs **only on a bare first visit** (no `?period`). The moment `MonthStepper` navigates, `?period=` is in the URL and the resolver short-circuits — no fetch. `cache()` further de-dupes within a request.

## Acceptance Criteria

1. **Auto-fit to latest-transaction month (RP-U5).** Given a user whose most recent transaction is before the current month, when they open the dashboard **or** the transactions list with **no `period` in the URL**, then the default period auto-fits to the **month of the user's latest transaction** (not the empty current month), so data is visible on first load. With the seed, a bare `/dashboard` and `/transactions` open on **`2025-02`** and render seeded data.
2. **Current-month default preserved.** Given a user with transactions in the current month, when they open with no `period` in the URL, then the period defaults to the current month (existing behaviour preserved). (The min-clamp guarantees a latest-transaction in the current month — or any future-dated one — resolves to the current month.)
3. **URL period wins (D9 — protect it).** Given a valid `period` explicitly present in the URL search params, when either screen loads, then **that period wins** and **no latest-transaction lookup occurs** — auto-fit applies only when no (valid) period is specified. Verify live: `?period=2026-06` (empty current month) still renders the empty state, proving the URL is authoritative and shareable. The existing `MonthStepper` write-to-URL behaviour is unchanged.
4. **No-data is graceful, bounded.** Given a user with no transactions at all, when they open either screen, then the resolver returns the current month and the **existing localized empty state** renders in both locales — no crash, and the lookup is a **single bounded query** (no month-by-month look-back loop).
5. **Tests (NFR1).** Given the resolver, when tests run, then unit tests cover all four cases — (a) valid URL period → returned verbatim, latest-fetch **not** called; (b) no URL period + latest tx before current → fits to that month; (c) no URL period + latest tx in current month → current month; (d) no URL period + no transactions → current month — **plus** a defensive (e) future-dated latest tx → clamped to current month. `getPeriodFromDate` and `checkIsValidPeriod` get unit coverage, and `parse-transactions-search-params.test.ts` is updated for the new signature. Tests control the clock (`vi.setSystemTime`) so "current month" is deterministic. All existing `period.test.ts` / dashboard / transactions tests stay green.
6. **Visual QA evidence (Story 1.9 protocol, NFR8 — epic-mandated).** Given the rendered screens, the Dev Agent Record carries screenshots proving the behavioral outcome in **light + dark** themes at **mobile (390px) + desktop (≥1024px)**: (i) bare `/dashboard` and `/transactions` (no `?period`) opening on **Feb 2025** with data visible (MonthStepper shows the auto-fit month, widgets/list populated — not "No data"); (ii) `?period=2026-06` still showing the empty state (URL-wins proof). Captured live as the seeded operator on `:3000`, compared against the reference captures, dark-mode tokens intact. Store under `_bmad-output/implementation-artifacts/visual-qa/4-3-first-run-period/`.

## Tasks / Subtasks

- [x] **Task 1 — Study current period resolution + reference before writing code** (AC: 1, 2, 3)
  - [x] Read in full: `src/utils/period.ts` (parser, `getCurrentPeriod`, `formatPeriod`, `getMonthDateRange`, the inlined pattern/range check inside `parsePeriod`), `src/app/[locale]/dashboard/page.tsx:44-45`, `src/app/[locale]/transactions/page.tsx:41-42`, `src/app/[locale]/transactions/utils/parse-transactions-search-params.ts:58-72`, and `src/actions/fetch-transactions.ts` (the action you mirror). Confirm both pages funnel through `parsePeriod`/`getCurrentPeriod` and that `period` is single-sourced downstream.
  - [x] Reference parity: `example/track-my-life` shares the empty-default-period defect (gap backlog §5) — there is **no reference counterpart to copy** for the fix; this is supertool ground that *exceeds* the reference. Note that explicitly (ED1).
- [x] **Task 2 — `period.ts` helpers** (AC: 1, 4, 5)
  - [x] Extract `checkIsValidPeriod(value: string): boolean` (pattern + `MIN_YEAR`/month-range check) and reuse it inside `parsePeriod` (no behavior change to `parsePeriod`). Add `getPeriodFromDate(date: string): string` (`"YYYY-MM-DD"` → `"YYYY-MM"`) with a named `PERIOD_LENGTH` constant. Named exports only, arrow functions, `check`/`get` prefixes.
  - [x] Extend `period.test.ts`: `checkIsValidPeriod` (valid, bad pattern, out-of-range year/month) and `getPeriodFromDate` (normal date, year boundary).
- [x] **Task 3 — `fetch-latest-transaction-date` read action** (AC: 1, 2, 4)
  - [x] New `src/actions/fetch-latest-transaction-date.ts` mirroring `fetch-transactions.ts`: `cache()`-wrapped async, `await cookies()` → `cookieHeader`, `createServerApiClient({ cookieHeader })`, `TransactionsApiService.transactionsFindAll({ client, query: { page: FIRST_PAGE, limit: LATEST_LIMIT, sortBy: DEFAULT_SORT_BY, sortOrder: DEFAULT_SORT_ORDER } })`. Define `LATEST_LIMIT = 1` as a named constant; import `FIRST_PAGE`, `DEFAULT_SORT_BY`, `DEFAULT_SORT_ORDER` from `@supertool/shared/constants/{pagination,transaction-sort}`. Return `data.data[0]?.date ?? null`; `return null` on `error || !data`. **NFR6: generated client only** — never a hand `fetch`. **D1**: do not touch the amount; you only read `.date`.
- [x] **Task 4 — `resolveDefaultPeriod` resolver** (AC: 1, 2, 3, 4)
  - [x] New `src/utils/resolve-default-period.ts`: `resolveDefaultPeriod(rawPeriod: string | undefined): Promise<string>` per the Recommended Approach (valid-URL short-circuit → return verbatim, no fetch; else fetch latest → `null`⇒`getCurrentPeriod()`, else min(`getPeriodFromDate(latest)`, `getCurrentPeriod()`)). No `as` casts.
  - [x] New `resolve-default-period.test.ts`: the five cases in AC #5, mocking `fetch-latest-transaction-date` (`vi.mock`) and pinning the clock with `vi.setSystemTime`. Assert the latest-fetch is **not** called when a valid URL period is supplied (AC #3).
- [x] **Task 5 — Wire both pages** (AC: 1, 2, 3)
  - [x] Dashboard `page.tsx`: `const period = await resolveDefaultPeriod(normalizeSearchParam(searchParams[PERIOD_SEARCH_PARAM]));`. Remove now-dead imports.
  - [x] `parse-transactions-search-params.ts`: change signature to `(searchParams, period: string)`, assign `period` directly, drop the internal `rawPeriod`/`parsePeriod`/`getCurrentPeriod` period default (keep all other param parsing). Transactions `page.tsx`: resolve period first, then `parseTransactionsSearchParams(searchParams, period)`. Update `parse-transactions-search-params.test.ts` for the new signature (the period-default cases now live in the resolver test).
- [x] **Task 6 — i18n check** (AC: 4)
  - [x] No new visible strings expected — the empty states (`transactions-page.json` `empty.*`, `dashboard-page.json` `empty.*` + nested widget `empty.*`) already exist in **both** `en` and `uk` (verified). Only if you introduce genuinely new copy, add it to both locales same commit (real Ukrainian, ICU). Run `pnpm i18n:parity` regardless.
- [x] **Task 7 — Gates + Visual QA (Story 1.9 protocol, NFR8)** (AC: 5, 6)
  - [x] Run via `pnpm` scripts (never `node_modules/.bin`; retry the transient `H.replace` crash; use `--force` where turbo may replay stale logs): type-check, oxlint, stylelint, the money-tracker test suite, `i18n:parity`.
  - [x] Run the dev stack and **verify it is THIS checkout serving `:3000`** (a stale `next-server` from another `.claude/worktrees/*` can occupy the port and serve old code — memory `worktree-dev-server-stale-qa`). Sign in as the seeded operator on `:3000` (creds in `apps/api/.env.example`; trusted-origins pinned to `:3000` — alt ports 403).
  - [x] Capture the matrix in AC #6: bare `/dashboard` + `/transactions` (no `?period`) → confirm MonthStepper reads **Feb 2025** and data renders; `?period=2026-06` → empty state. `{light, dark} × {390px, ≥1024px}`. View every shot (not just file existence); record results in the Dev Agent Record and store under `…/visual-qa/4-3-first-run-period/`.

## Dev Notes

### Files to TOUCH / CREATE (read each fully before editing)
| File | Action | Why |
|---|---|---|
| `apps/money-tracker/src/utils/period.ts` | UPDATE | Add `checkIsValidPeriod` (reuse in `parsePeriod`) + `getPeriodFromDate` + `PERIOD_LENGTH`. Current default lives here (`getCurrentPeriod`, `parsePeriod` lines 30-50). |
| `apps/money-tracker/src/utils/period.test.ts` | UPDATE | Cover the two new helpers; keep existing cases green. |
| `apps/money-tracker/src/actions/fetch-latest-transaction-date.ts` | NEW | Read action: latest tx via `transactionsFindAll` (page 1, limit 1, date desc), generated client only. Mirror `fetch-transactions.ts`. |
| `apps/money-tracker/src/utils/resolve-default-period.ts` | NEW | Async default-period resolver (URL-wins short-circuit; else auto-fit; else current; min-clamp). |
| `apps/money-tracker/src/utils/resolve-default-period.test.ts` | NEW | Five-case unit test with mocked fetch + fake timers. |
| `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` | UPDATE | `await resolveDefaultPeriod(...)` replaces the sync `formatPeriod(parsePeriod(...))` at line 45. |
| `apps/money-tracker/src/app/[locale]/transactions/page.tsx` | UPDATE | Resolve period first; pass into `parseTransactionsSearchParams`. |
| `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.ts` | UPDATE | Accept resolved `period` arg; stop owning the period default (lines 61-65). |
| `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.test.ts` | UPDATE | Adapt to the new signature; period-default cases move to the resolver test. |
| `_bmad-output/implementation-artifacts/visual-qa/4-3-first-run-period/` | NEW | Visual-QA evidence (AC #6). |

### Current state of the system this story modifies (preserve, don't break)
- **`src/utils/period.ts`** is the single period authority. `parsePeriod(value)` (lines 36-50): pattern `^\d{4}-\d{2}$` + range (`MIN_YEAR`, months 1-12); **falls back to `getCurrentPeriod()` for `undefined` or invalid** — this silent fallback is exactly why the resolver needs its own explicit `checkIsValidPeriod` (it must tell "absent/invalid" from "valid" to honor AC #3). `getMonthDateRange` / `getTrailingMonthsRange` already accept any `PeriodParts` — no changes needed there; only *where the default comes from* changes.
- **Dashboard** (`dashboard/page.tsx`) resolves `period` (line 45), feeds it to `MonthStepper` and three `<Suspense>`-wrapped server widgets keyed on `period`. **Empty handling is downstream and already correct**: `DashboardSummary` renders its empty state when no currency / no transactions in the month; breakdown + trend have their own `empty.*`. Don't touch the widgets.
- **Transactions** (`transactions/page.tsx`) resolves `params` via `parseTransactionsSearchParams` (line 42), feeds `params.period`/`params.*` to `MonthStepper`, the suspense key, and `TransactionListServer`. **`TransactionListServer` owns empty/error/out-of-range-page handling** (renders `TransactionEmptyState` when `meta.total === 0`) — Story 4.2 explicitly left first-run to **this** story; do not duplicate empty-state logic, just feed it the auto-fit period.
- **`MonthStepper`** (`src/components/month-stepper/MonthStepper.tsx`) writes `?period=YYYY-MM` via `router.replace` and clears `page`. It is the mechanism that makes every post-first-load visit carry a period (so the resolver short-circuits). **Do not change it.**
- **`fetch-transactions.ts`** is the action to mirror: `cache()`, `await cookies()`, `createServerApiClient({ cookieHeader })`, `{ data, error }` from `TransactionsApiService.transactionsFindAll`, graceful `{ status: 'error' }`. Note `buildFindAllQuery` always sets `dateFrom`/`dateTo`; your new action **omits them** (the API treats them as optional → returns across all dates). Your return type is simpler (`string | null`), not the `FetchTransactionsResult` union.
- **API side (no change needed):** `transactions.repository.ts` applies `gte(date, dateFrom)`/`lte(date, dateTo)` **only when present**, and sorts by `SORT_COLUMN_BY_KEY[sortBy]` then `desc(id)`. So `findAll` with no date filter, `sortBy=date`, `sortOrder=desc`, `limit=1` returns the single most-recent transaction. **No new endpoint, no migration, no DTO/client regeneration.**

### Seed reality (for tests + QA)
- Real seed JSON `apps/api/src/database/data/transactions-02.03.25.json` is `MM/DD/YYYY` (`parseSeedDate` → `YYYY-MM-DD`). **Latest row is `02/03/2025` (Feb 3, 2025) → auto-fit target `2025-02`.** Data spans 2021–2025 (gap backlog). So the seeded operator's bare first-load must land on **`2025-02`** — assert this in QA. (Story 4.2 QA also used `2025-02`/`2024-12` as data-bearing months.)

### Conventions to honor (.claude/rules + memories)
- **D9 (binding):** URL search params carry period state; a present valid period is authoritative and shareable — auto-fit is strictly the no-period default. (`architecture.md` line 202.)
- **NFR6:** API access only through the generated client (`TransactionsApiService`) — the new action is the wrapper; never a hand `fetch`. (memory `sdk-service-classes-and-example-repo`.)
- **D1:** money stays string end-to-end; you read only `.date` here — never coerce or arithmetic amounts.
- **Shared constants, no duplication** (memory `shared-constants-no-duplication`): reuse `FIRST_PAGE`, `DEFAULT_SORT_BY`, `DEFAULT_SORT_ORDER`; define `LATEST_LIMIT`/`PERIOD_LENGTH` as named constants, no magic numbers/strings.
- **JS/TS:** named exports only, no barrels/re-exports, no comments, arrow functions, `get`/`fetch`/`check`/`parse` prefixes, `as const` the only sanctioned assertion, prefer interfaces, no enums. Files kebab-case (non-component).
- **RSC:** resolution stays server-side in the async pages (`react.md` data-fetching); no `'use client'`, no client period state.

### Testing standards
- Vitest + jsdom (frontend). Co-locate `*.test.ts`. Mock the new action with `vi.mock`; pin the clock with `vi.setSystemTime` (then `vi.useRealTimers()` in teardown) so `getCurrentPeriod()` is deterministic and the before/in/after-current cases are stable across calendar time. Run via `pnpm --filter @supertool/money-tracker` scripts; retry the transient `H.replace` crash; verify gates with `--force` (turbo cache replays stale logs — memory `turbo-cache-masks-gate-results`).

### Verify-live requirements (do not skip)
- A green gate is **not** done (1.4/1.8 shipped green-but-broken). The AC #6 screenshot matrix is the acceptance evidence — actually look at the rendered screens (memories `ui-stories-need-visual-qa`, `visual-qa-via-playwright-cli`). Confirm the dev server on `:3000` is THIS checkout (memory `worktree-dev-server-stale-qa`) before trusting any capture.

### Out of scope (explicit guardrails)
- No new API endpoint, no schema/migration, no client regeneration. No changes to `MonthStepper`, `TransactionListServer`, the dashboard widgets' fetch/empty logic, the `Table`/card layout (Story 4.2), filters/sort, or the currency model. No new dashboard widgets (Epic 5). No persisted "last viewed period" preference — auto-fit is computed per request from the latest transaction, nothing stored. No month-by-month look-back loop. No reference copying (ED1).

### Project Structure Notes
- New action sits beside the existing `src/actions/fetch-*.ts`; new utils beside `src/utils/period.ts`. No structural conflicts — consistent with current layout. Both new files are server-context utilities (the resolver composes a server action), used only from the two async pages.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3] — story statement + 4 BDD AC blocks (RP-U5), "exceed the reference, don't replicate", D9 protection
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — epic intent, binding rules, evidence base, per-story Story 1.9 visual-QA protocol
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-U5 (empty/first-run, P1): "auto-fit the period to the data's date range on first load" (lines 58, 81, 85)
- [Source: _bmad-output/planning-artifacts/architecture.md] — D9 RSC + URL-driven filter/period state (line 202); NFR8 responsive duty (line 419)
- [Source: _bmad-output/implementation-artifacts/4-2-mobile-usable-transactions-list.md] — 4.2 explicitly deferred first-run/empty work to this story; `TransactionListServer` owns empty/error
- [Source: apps/money-tracker/src/utils/period.ts] — period authority (`parsePeriod`/`getCurrentPeriod`/`formatPeriod`/`getMonthDateRange`)
- [Source: apps/money-tracker/src/actions/fetch-transactions.ts] — read-action pattern to mirror (generated client, cookie forwarding, cache)
- [Source: apps/money-tracker/src/app/[locale]/dashboard/page.tsx, …/transactions/page.tsx, …/transactions/utils/parse-transactions-search-params.ts] — period resolution call sites to rewire
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx] — empty/error/pagination owner (do not duplicate)
- [Source: apps/api/src/modules/transactions/transactions.repository.ts] — optional `dateFrom`/`dateTo` + date-desc sort confirm the limit-1 lookup; no API change needed
- [Source: apps/api/src/database/data/transactions-02.03.25.json + seeds/parse-seed-date.ts] — latest seed date Feb 3 2025 → `2025-02` auto-fit target
- [Source: packages/shared/src/constants/transaction-sort.ts, …/pagination.ts] — `DEFAULT_SORT_BY=date`, `DEFAULT_SORT_ORDER=desc`, `FIRST_PAGE` to reuse
- [Source: apps/money-tracker/messages/{en,uk}/{transactions-page,dashboard-page}.json] — existing `empty.*` keys in both locales (reuse; no new strings expected)
- [Source: .claude/rules/react.md, javascript.md, typescript.md, i18n.md] — conventions

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story workflow.

### Debug Log References

- Branch: `TOOLS-4-3/first-run-period-auto-fit` (created off `main` per branch-guard).
- Gates (all green): `pnpm type-check --force --filter @supertool/money-tracker`, `pnpm lint` (0 warnings/0 errors), `pnpm stylelint` (no SCSS touched), `pnpm i18n:parity` (OK, 1 messages dir), `pnpm exec vitest run` (34 files / 169 tests pass). Two oxlint nits surfaced and were fixed before commit: `no-magic-numbers` on the `0` slice index in `getPeriodFromDate` (extracted `PERIOD_START_INDEX`) and `arrow-body-style` on the now-trivial `parseTransactionsSearchParams` body (collapsed to an implicit object return).
- **Live verification gotcha (root cause of an initial false negative):** the bare `/dashboard` first opened on **June 2026**, not Feb 2025. This was NOT a code defect — `resolveDefaultPeriod` was correct: the operator's actual latest transaction was a stray **2026-06-15** row (note "E2E visual QA entry", ₴42.50, duplicated ×2) left over from a previous QA session, so the min-clamp correctly returned the current month. Confirmed by querying the API with the session cookie (latest = 2026-06-15) and seeing only 2 such rows, with zero transactions between 2025-02-04 and 2026-05-31. Per user decision, re-seeded the DB to the documented state: `TRUNCATE TABLE transactions` (seed is idempotent via `onConflictDoNothing` on `importKey`, so a plain re-seed would not have removed the API-created rows) then `pnpm --filter @supertool/api db:seed` (1880 inserted). New latest = **2025-02-03** → bare load then auto-fit to **February 2025** as designed.

### Completion Notes List

- **Behavioral outcome (RP-U5) achieved and exceeds the reference.** `example/track-my-life` shares the empty-default defect; there was no reference counterpart to copy — this is supertool ground (ED1).
- **Pure default-resolution change.** No new API endpoint, no schema/migration, no client regeneration, no `MonthStepper`/`TransactionListServer`/widget changes. The latest-transaction lookup reuses the existing generated client (`TransactionsApiService.transactionsFindAll`, page 1 / limit 1 / date desc, no date filter) — NFR6 honored, D1 honored (only `.date` is read).
- **D9 protected.** A present & valid URL period short-circuits the resolver (no fetch); auto-fit is strictly the absent/invalid-period default. `checkIsValidPeriod` (extracted from `parsePeriod`, no behavior change) is the single source of truth for "valid", letting the resolver distinguish absent/invalid from valid — `parsePeriod`'s silent current-month fallback could not.
- **Min-clamp** of `getPeriodFromDate(latest)` against `getCurrentPeriod()` guarantees AC #2 (current-month default preserved) and defensively clamps future-dated transactions back to the current month.
- **Single-sourced period.** `parseTransactionsSearchParams` now accepts the already-resolved `period` and no longer owns the period default; both pages resolve once and pass it through.
- **Tests:** 6 resolver cases (incl. the defensive future-dated clamp), `checkIsValidPeriod` + `getPeriodFromDate` unit coverage, and `parse-transactions-search-params.test.ts` adapted to the new signature. `vi.setSystemTime` pins the clock so "current month" is deterministic. All pre-existing `period.test.ts` / dashboard / transactions tests stay green.
- **Visual QA (Story 1.9 protocol, NFR8) — 18 screenshots captured live as the seeded operator on `:3000` (verified THIS checkout's `next-server`, cwd `apps/money-tracker`) and each one viewed:**
  - `autofit-{dashboard,transactions}-{light,dark}-{desktop,mobile}.png` (8): bare `/dashboard` + `/transactions` (no `?period`) → MonthStepper reads **February 2025**, widgets/list fully populated (dashboard Expense UAH 4,542.29 + breakdown + trend; transactions grouped cards Feb 3/2/1 2025). Dark-mode chart/token re-color intact (no story-4-4 regression).
  - `urlwins-{dashboard,transactions}-{light,dark}-{desktop,mobile}.png` (8): `?period=2026-06` → stays on **June 2026** with the existing localized empty states ("No activity this month" / "No transactions for this month"), proving the URL is authoritative and shareable (D9 / AC #3). No latest-transaction lookup overrides it.
  - `autofit-transactions-uk-light-desktop.png` + `urlwins-dashboard-uk-light-desktop.png` (2): Ukrainian locale renders auto-fit (Лютий 2025 data) and the localized empty states ("Немає руху коштів за цей місяць", etc.) under URL-wins (Червень 2026) — AC #4 both-locales graceful, no crash.
  - Stored under `_bmad-output/implementation-artifacts/visual-qa/4-3-first-run-period/`.

### File List

- `apps/money-tracker/src/utils/period.ts` (UPDATE) — extracted `checkIsValidPeriod`, added `getPeriodFromDate` + `PERIOD_LENGTH`/`PERIOD_START_INDEX` constants; `parsePeriod` now reuses `checkIsValidPeriod`.
- `apps/money-tracker/src/utils/period.test.ts` (UPDATE) — added `checkIsValidPeriod` and `getPeriodFromDate` suites.
- `apps/money-tracker/src/actions/fetch-latest-transaction-date.ts` (NEW) — `cache()`-wrapped read action; latest transaction via `transactionsFindAll` (page 1 / limit 1 / date desc, no date filter); returns `date` or `null`.
- `apps/money-tracker/src/utils/resolve-default-period.ts` (NEW) — async default-period resolver (URL-wins short-circuit; else auto-fit; else current; min-clamp).
- `apps/money-tracker/src/utils/resolve-default-period.test.ts` (NEW) — six-case unit test (five ACs + defensive future-dated clamp) with mocked fetch + fake timers.
- `apps/money-tracker/src/app/[locale]/dashboard/page.tsx` (UPDATE) — `await resolveDefaultPeriod(...)`; dropped dead `formatPeriod`/`parsePeriod` imports.
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx` (UPDATE) — resolve period first, pass into `parseTransactionsSearchParams`.
- `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.ts` (UPDATE) — accepts resolved `period` arg; no longer owns the period default.
- `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.test.ts` (UPDATE) — adapted to the new signature.
- `_bmad-output/implementation-artifacts/visual-qa/4-3-first-run-period/` (NEW) — 18 visual-QA screenshots (AC #6).

### Change Log

| Date | Change |
|---|---|
| 2026-06-17 | Story created — ready-for-dev. |
| 2026-06-17 | Implemented first-run period auto-fit: `checkIsValidPeriod`/`getPeriodFromDate` helpers, `fetch-latest-transaction-date` read action, `resolveDefaultPeriod` resolver (URL-wins + min-clamp), wired both pages, single-sourced period through `parseTransactionsSearchParams`. Tests added/updated (169 pass). All gates green. 18 visual-QA screenshots captured & verified (auto-fit Feb 2025 + URL-wins empty, light/dark × mobile/desktop, EN + UK). DB re-seeded to clear stray current-month QA rows. Status → review. |
| 2026-06-17 | Code review (3-layer adversarial: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Gates re-run green (type-check, 169 tests, oxlint 0/0, i18n parity). 0 blocking, 0 high. All 6 ACs satisfied at code level; all hard rules (D1/NFR6/reuse-first/shared-constants/conventions/out-of-scope) pass; Dev Agent Record claims verified accurate. 0 decision-needed, 0 patch, 3 deferred, 7 dismissed as by-design/handled. |

### Review Findings

_3-layer adversarial code review, 2026-06-17. No blocking or high-severity findings. All six ACs satisfied at the code/static level; all merge-blocking hard rules pass. The only acceptance item requiring human action is AC #6 pixel-level visual confirmation (18 screenshots present and correctly named under `visual-qa/4-3-first-run-period/`; static review cannot inspect pixels)._

- [x] [Review][Defer] `getPeriodFromDate` silently coerces a malformed/short/empty API `date` to the current month (inherited from `parsePeriod`'s silent fallback), with no test for that branch [apps/money-tracker/src/utils/period.ts:60-61] — deferred, safe given the API `date`-column contract (always `YYYY-MM-DD`); optional defensive test only.
- [x] [Review][Defer] "Latest date" lookup is implicitly coupled to `DEFAULT_SORT_BY`/`DEFAULT_SORT_ORDER` remaining date-descending; a future UX change to the default list sort would silently return the wrong "latest" date [apps/money-tracker/src/actions/fetch-latest-transaction-date.ts:16-24] — deferred, spec-mandated to reuse those shared constants (no magic strings); decouple via a dedicated `LATEST_SORT_*` constant only if the default list sort ever changes.
- [x] [Review][Defer] `getCurrentPeriod()` reads server-local timezone (`new Date().getFullYear()/.getMonth()`) while transaction dates are timezone-free `YYYY-MM-DD`, so the auto-fit/clamp boundary is environment-sensitive near a month edge [apps/money-tracker/src/utils/period.ts:32-36] — deferred, pre-existing (`getCurrentPeriod` unchanged by this story); revisit if multi-timezone deployment is introduced.
