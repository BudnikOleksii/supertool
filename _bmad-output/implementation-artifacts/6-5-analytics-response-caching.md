---
baseline_commit: 0860d68b501d6bc38db11d1ced6463976510b4ac
---

# Story 6.5: Analytics Response Caching

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the operator-developer,
I want analytics responses cached in-memory per user with invalidation on every mutation, plus deterministic ordering and a bounded date range on the analytics endpoints,
so that the now-heavier dashboard stays fast and correct without standing up Redis for a local PoC (RP-B3), and never serves stale, non-deterministic, or unboundedly-expensive analytics.

## Story Context

Scope is the six analytics GET endpoints, all of which recompute SQL aggregations on every call today (no cache layer exists — architecture.md: "Caching: none in v1"):

- `GET /api/v1/analytics/summary` — `getMonthlySummary`
- `GET /api/v1/analytics/breakdown` — `getCategoryBreakdown`
- `GET /api/v1/analytics/trend` — `getMonthlyTrend`
- `GET /api/v1/analytics/top-categories` — `getTopCategories`
- `GET /api/v1/analytics/daily-spending` — `getDailySpending`
- `GET /api/v1/analytics/by-category` — `getByCategory`

This is the **LAST story of Epic 6** and the first runtime caching layer since the backend was stood up. It is **backend-only and transparent**: the API contract, generated client, and DTO shapes are unchanged — behaviour is identical to the uncached path apart from latency and (new) a rejected over-large range. It also folds in the two analytics robustness items assigned to 6-5 by the Epic 5 retrospective (Action #2): a deterministic tie-break secondary sort in `getTopCategories`, and a shared max-range/span clamp across the analytics endpoints.

**Decision RP-D7 (from epics.md / reference-parity backlog): in-memory over Redis** for a local single-instance PoC. The reference (`example/tracker-backend-api`) uses a Redis `CacheModule` + an event-listener; we adapt the *design* (service-layer caching, user-scoped keys, coarse per-user invalidation, TTL backstop) to an in-process implementation with **zero new dependencies** — see D-1, D-6.

## Acceptance Criteria

1. **In-memory per-user, per-query cache serves repeat analytics reads.** Given a user requests the same endpoint + period/scope repeatedly, when the cache is warm, then the response is served from an in-memory cache keyed by `userId` + endpoint + all query params + the user's default currency, avoiding redundant SQL aggregation. The cached payload is **identical byte-for-byte** to the cold (uncached) payload — string amounts, exact figures, and `currency` preserved unchanged (D1/FR18).

2. **A sane TTL bounds staleness as a backstop.** Given a cache entry, when `ANALYTICS_CACHE_TTL_MS` has elapsed since it was written, then the next read recomputes from SQL and refreshes the entry (lazy expiry on read — no background timer). TTL is a *backstop*; explicit invalidation (AC 3) is the primary freshness mechanism.

3. **Every mutation invalidates the affected user's analytics cache — no stale figures after a change.** Given a create / edit / delete / bulk-delete / import of transactions, or an assign-default-categories / category create / edit / delete for a user, when the mutation commits successfully, then that user's *entire* analytics cache is invalidated, so the next analytics read for that user recomputes. Invalidation runs unconditionally on successful mutation completion (over-invalidation is acceptable; under-invalidation is a defect).

4. **Per-user isolation — no cross-user cache leakage (FR21, security).** Given users A and B, when A's analytics response is cached, then B requesting the same endpoint/params receives B's own freshly-computed data (never A's cached payload); and a mutation by B invalidates only B's cache (A's stays warm), and vice versa. A cross-user cache leak is a security defect and MUST be covered by an integration test.

5. **Cache sits behind the service layer and is invisible to the contract (D7, NFR6).** Given the cache layer, when it is added, then it lives at/below the `AnalyticsService` layer (controllers → services → repositories preserved; the cache never touches controllers or the DB directly). `apps/api/openapi.json`, the generated client (`packages/shared/src/generated/`), and all analytics DTO shapes are **unchanged** — the OpenAPI drift gate is a no-op (no regeneration needed). If any incidental drift appears, regenerate + commit it.

6. **Deterministic tie-break secondary sort in `getTopCategories` (retro Action #2a).** Given two or more root categories with equal expense totals in a period, when top-categories is computed, then the result order is deterministic across repeated calls (secondary sort by category name, then id) so the `LIMIT` is stable and cached payloads never differ run-to-run. The same tie-break is applied to `getCategoryBreakdown` for consistency (stable ordering of its returned array).

7. **Bounded date range across all analytics endpoints (retro Action #2b).** Given an analytics request whose `dateTo − dateFrom` span exceeds `ANALYTICS_MAX_RANGE_DAYS`, when it is validated, then it is rejected with a standard `400` validation error (same error shape as the existing ordered-range guard). Spans within the bound behave exactly as today. The cap is single-sourced in `@supertool/shared` and applied to all six analytics query DTOs via a reusable class-level validator, sized to never reject the dashboard's legitimate 12-month trend request.

8. **Tests ship with the feature (NFR1).** Unit specs cover the cache-key builder, the cache service (miss→compute→set, hit-without-recompute, TTL expiry, `invalidateUser` scoping, returned-object isolation), and the bounded-range validator. Testcontainers integration specs prove: cache hit returns an identical payload; each mutation type invalidates; cross-user isolation (AC 4); tie-break determinism; and the max-range clamp (over → 400, within → 200). All existing analytics correctness suites pass unchanged.

9. **No new runtime dependency (NFR2 / hard rule 6).** The cache is an in-house `AnalyticsCacheService`; `@nestjs/cache-manager`, `cache-manager`, Redis, and `@nestjs/event-emitter` are NOT added. If the dev finds a compelling reason to add a dep, it must be pinned exact and justified against architecture.md in the Dev Agent Record before use.

10. **Visual QA: N/A (backend-only).** This story adds no user-facing surface; visual QA is explicitly not applicable (recorded like 5-1/5-4). No i18n keys are added (en.json/uk.json unchanged). The frontend surfaces the new over-range `400` via its existing generic validation-error handling; a dedicated "range too large" UI message is out of scope.

## Tasks / Subtasks

- [x] **Task 1 — Shared constants (AC: 2, 7)**
  - [x] Add `ANALYTICS_CACHE_TTL_MS` and `ANALYTICS_MAX_RANGE_DAYS` to `packages/shared/src/constants/analytics.ts` (single source of truth — memory `shared-constants-no-duplication`). Propose `ANALYTICS_CACHE_TTL_MS = 300_000` (5 min backstop) and `ANALYTICS_MAX_RANGE_DAYS = 400` (comfortably covers a 12-month trend ≈ 366 days with margin; rejects multi-year pathological spans).
  - [x] **Verify the dashboard's actual `fetch-trend` span does not exceed `ANALYTICS_MAX_RANGE_DAYS`** before finalizing the value (drive the twelve-month-trend request; if the real span is larger, bump the constant). Record the confirmed span in the Dev Agent Record.
  - [x] Rebuild `@supertool/shared` so the API can import the constants.

- [x] **Task 2 — In-house `AnalyticsCacheService` + module (AC: 1, 2, 3, 4, 9)**
  - [x] Create `apps/api/src/modules/analytics/analytics-cache.service.ts` — an `@Injectable()` holding a two-level store `Map<userId, Map<cacheKey, { value; expiresAt }>>`.
    - [x] `getOrCompute<T>(userId, key, compute: () => Promise<T>): Promise<T>` — on a live hit, return a `structuredClone` of the cached value (never the shared reference); on miss or expiry, `await compute()`, store a `structuredClone`, return a clone. Lazy-expire entries whose `expiresAt <= Date.now()` on read.
    - [x] `invalidateUser(userId): void` — `store.delete(userId)` (O(1) drop of the user's whole analytics submap).
    - [x] `getAnalyticsCacheKey({ endpoint, dateFrom, dateTo, limit, currency })` — a pure, exported function returning `analytics:{endpoint}:{dateFrom}:{dateTo}:{limit ?? ''}:{currency}`. `endpoint` is a typed literal union of the six endpoint names. `currency` is REQUIRED in the key (RP-D1 — a currency change must yield a cache miss, never stale-currency figures).
  - [x] Create `apps/api/src/modules/analytics/analytics-cache.module.ts` — `AnalyticsCacheModule` that `providers: [AnalyticsCacheService]` and `exports: [AnalyticsCacheService]`, so `AnalyticsModule`, `TransactionsModule`, and `TransactionCategoriesModule` share ONE singleton instance.
  - [x] Follow the DI rule: explicit `@Inject(AnalyticsCacheService)`, never `import type` for the injectable (memory `nest-di-explicit-inject` / CLAUDE.md).

- [x] **Task 3 — Wire cache-through into `AnalyticsService` (AC: 1, 2, 5)**
  - [x] Import `AnalyticsCacheModule` into `AnalyticsModule`; inject `AnalyticsCacheService` into `AnalyticsService`.
  - [x] In each of the six methods, AFTER the `NO_CURRENCY` early-return (do NOT cache the null-currency empty path — it is already cheap and currency-dependent), wrap the repository call in `getOrCompute(userId, getAnalyticsCacheKey({...}), () => this.analyticsRepository.<method>({...}))`.
  - [x] `limit` participates in the key ONLY for `top-categories` (pass the resolved `query.limit ?? TOP_CATEGORIES_DEFAULT_LIMIT` so two requests that resolve to the same effective limit share an entry); other endpoints omit it (`limit: undefined`).

- [x] **Task 4 — Invalidate on every mutation (AC: 3, 4)**
  - [x] `TransactionsModule`: import `AnalyticsCacheModule`; inject `AnalyticsCacheService` into `TransactionsService`. Call `invalidateUser(userId)` at the end of `create`, `update`, `delete`, and `bulkDelete` (after the repository call resolves successfully).
  - [x] `TransactionsImportService`: inject `AnalyticsCacheService`; call `invalidateUser(userId)` at the end of `importTransactions` (import is a bulk write path).
  - [x] `TransactionCategoriesModule`: import `AnalyticsCacheModule`; inject `AnalyticsCacheService` into `TransactionCategoriesService`. Call `invalidateUser(userId)` at the end of `createDefaults`, `create`, `update`, and `delete` — category rename / reparent / delete-with-reassign all change analytics grouping (breakdown / top-categories / by-category roll up by the category hierarchy), so they MUST invalidate. For methods wrapped in `runInTransaction`, invalidate after the transaction promise resolves.
  - [x] Confirm no circular-import is introduced (analytics → users is the only existing analytics dependency; cache module depends on nothing).

- [x] **Task 5 — Tie-break secondary sort (AC: 6)**
  - [x] `apps/api/src/modules/analytics/analytics.repository.ts` `getTopCategories`: change `ORDER BY SUM(t.amount) DESC` (≈ line 212) to `ORDER BY SUM(t.amount) DESC, cr.root_name ASC, cr.root_id ASC`.
  - [x] `getCategoryBreakdown`: apply the same deterministic tie-break to its `ORDER BY SUM(t.amount) DESC` (≈ line 131), matching whatever grouped name/id columns that query exposes.

- [x] **Task 6 — Bounded date-range validator (AC: 7)**
  - [x] Create `apps/api/src/shared/validators/is-bounded-date-range.decorator.ts`, a class-level validator mirroring the existing `is-ordered-date-range.decorator.ts` pattern: `@IsBoundedDateRange('dateFrom', 'dateTo', ANALYTICS_MAX_RANGE_DAYS)` fails when the inclusive day span exceeds the cap.
  - [x] Apply it (alongside the existing `@IsOrderedDateRange`) to all six analytics query DTOs: `find-summary-query`, `find-breakdown-query`, `find-trend-query`, `find-top-categories-query`, `find-daily-spending-query`, `find-by-category-query`.
  - [x] Confirm it is a class-level custom validator that emits NO OpenAPI schema property (so no drift — AC 5). Do NOT use a field-level `@Max` on a computed span.

- [x] **Task 7 — Tests (AC: 8) — ships in this story (NFR1)**
  - [x] Unit `analytics-cache.service.spec.ts`: key builder determinism + currency/param sensitivity; miss→compute→set; hit returns clone WITHOUT re-invoking compute (spy called once); TTL expiry via fake timers → recompute; `invalidateUser(A)` leaves B intact; mutating a returned object does not corrupt the cache.
  - [x] Unit `is-bounded-date-range.decorator.spec.ts`: within-bound passes, over-bound fails (mirror `is-ordered-date-range` spec).
  - [x] Update `analytics.service.spec.ts`: two identical calls invoke the repository once (hit); a call after `invalidateUser` recomputes.
  - [x] Integration in `apps/api/test/integration/` (extend the analytics integration suite): (a) warm-then-hit returns a deep-equal payload incl. exact string amounts (D1/FR18); (b) each mutation type — create, update, delete, bulkDelete, import, createDefaults, category create/update/delete — invalidates and the next read reflects the change; (c) cross-user isolation (AC 4 — two seeded users, A cached, B sees own data, B mutation doesn't affect A); (d) tie-break determinism (two equal-total root categories → stable order across repeated calls); (e) max-range clamp (span > cap → 400, span == cap → 200).
  - [x] Run via pnpm scripts with `TURBO_FORCE=true` when verifying gates (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`). Testcontainers: set a scratch `DOCKER_CONFIG` if the credential-helper hang recurs (Epic 5 retro §4).

- [x] **Task 8 — Contract + gates verification (AC: 5, 9, 10)**
  - [x] Run `pnpm --filter @supertool/api build` then confirm `apps/api/openapi.json` and `packages/shared/src/generated/` are unchanged (git diff clean for both). Run the drift gate — it must be a no-op.
  - [x] Confirm no new runtime dependency was added to `apps/api/package.json`.
  - [x] Record in the Dev Agent Record: visual QA N/A (backend-only); i18n N/A (no strings); the confirmed trend span vs the cap; and the `D-1…D-11` decisions below as a short operator checklist for the PR (Epic 5 retro Action #5).

## Dev Notes

### Current state of files this story touches (READ before editing)

- **`apps/api/src/modules/analytics/analytics.service.ts`** — each of the 6 methods resolves the user's `defaultCurrency` via `usersRepository.findByIdScoped`, returns an empty `NO_CURRENCY` payload when currency is null, otherwise delegates to `analyticsRepository`. Cache wrapping goes AFTER the null-currency guard. Must preserve: exact return shapes, the `TOP_CATEGORIES_DEFAULT_LIMIT` fallback, `ZERO_AMOUNT`/`NO_CURRENCY` empty paths.
- **`apps/api/src/modules/analytics/analytics.repository.ts`** — raw `sql` aggregations; money via `moneyCast()`, expense filter via `EXPENSE_TYPE`. Tie-break edits are ORDER-BY-only; do not alter SELECT/GROUP BY or the `totalExpense` window (`SUM(SUM()) OVER ()` pre-LIMIT) that reconciles exactly with the summary (FR18 correctness property).
- **`apps/api/src/modules/analytics/analytics.module.ts`** — imports `UsersModule`; add `AnalyticsCacheModule`.
- **`apps/api/src/modules/transactions/transactions.service.ts`** — mutation entry points `create` / `update` / `delete` / `bulkDelete`. `bulkDelete` was left "a clean single entry point for the future 6-5 cache-invalidation hook" (6-2 D-9) — this story is that hook. (The 6-2-deferred empty-`idList` guard is NOT in scope here.)
- **`apps/api/src/modules/transactions/transactions-import.service.ts`** — `importTransactions` is the bulk-write path.
- **`apps/api/src/modules/transaction-categories/transaction-categories.service.ts`** — `createDefaults`, `create`, `update`, `delete` (the last three run inside `repository.runInTransaction`; invalidate after the tx resolves).
- **`apps/api/src/shared/validators/is-ordered-date-range.decorator.ts`** — the class-level validator pattern the new bounded-range validator mirrors; the analytics DTOs already carry `@IsOrderedDateRange('dateFrom','dateTo')` + `@IsCalendarDate()` (date-validation debt already closed in 6-4 — do NOT re-lift it).

### Decisions (record each in the Dev Agent Record; operator may overrule on PR — Epic 5 retro D-2/Action #5)

- **D-1 — In-house `AnalyticsCacheService`, no new dependency (reference divergence, per RP-D7).** The reference uses Redis `CacheModule` + `@nestjs/event-emitter`. We diverge to an in-process two-level `Map` because: (a) CLAUDE.md hard rule 6 / NFR2 — no gratuitous deps; (b) per-user *bulk* invalidation is O(1) with a `userId`-keyed outer map, which a flat KV store (cache-manager) cannot do without us tracking key-sets ourselves anyway; (c) single-instance local Docker (RP-D7) needs no cross-process cache; (d) full control over key shape, TTL, and lazy eviction. Rationale mirrors the reference design doc's own "cache at the service layer / user-scoped keys / coarse prefix invalidation" choices — only the storage backend differs.
- **D-2 — Cache lives in its own `AnalyticsCacheModule`, imported by analytics + transactions + transaction-categories.** Exporting only the service (not the analytics controller/repository) keeps a single shared singleton and avoids pulling the whole analytics module into the mutation modules. Mirrors the reference's standalone `modules/cache/` placement.
- **D-3 — Cache key = `analytics:{endpoint}:{dateFrom}:{dateTo}:{limit ?? ''}:{currency}`, nested under a `userId`-keyed outer map.** Currency is mandatory in the key (RP-D1) so a default-currency change produces a natural miss (never stale-currency figures) and stale old-currency entries age out via TTL — no separate users-module invalidation hook needed.
- **D-4 — Cache only the computed path; skip the `NO_CURRENCY` early-return.** It is already O(1) and currency-scoped; caching it adds no value.
- **D-5 — TTL backstop (`ANALYTICS_CACHE_TTL_MS`, propose 5 min) AND explicit invalidation (primary).** Defense-in-depth: TTL bounds staleness if any invalidation path is ever missed. Lazy expiry on read (no timer). Shorter than the reference's 1 h because invalidation is the real freshness mechanism.
- **D-6 — Coarse per-user invalidation (drop the user's whole submap), not per-key.** Granular per-query invalidation is error-prone (which stored spans does a new transaction touch?); dropping the user's entire analytics cache is simple, always-correct, and O(1). Runs unconditionally on successful mutation (over-invalidation acceptable). Mirrors the reference's prefix-invalidation rationale. Uses direct injection rather than the reference's event-listener to avoid adding `@nestjs/event-emitter`.
- **D-7 — `structuredClone` on cache set/return** to prevent shared-mutable-state bugs and guarantee cached == cold byte-for-byte; `structuredClone` preserves string amounts exactly (no number coercion — D1-safe).
- **D-8 — Tie-break applied to both `getTopCategories` (retro-required) and `getCategoryBreakdown` (companion consistency).** Deterministic ordering makes the top-categories `LIMIT` stable and cached payloads reproducible; the breakdown gets the same treatment so its cached array order is stable for tests. Root cause is shared with the breakdown/trend endpoints (Epic 5 retro §3b).
- **D-9 — `ANALYTICS_MAX_RANGE_DAYS` is ONE shared constant applied to all six DTOs via a class-level validator (emits no OpenAPI property → no drift).** Value sized to never reject the legitimate 12-month trend (verify against the live `fetch-trend` span in Task 1); it bounds cache-key cardinality and kills the "thousands of bars" daily-spending span (Epic 5 retro §3b, 5-5).
- **D-10 — Transparent contract: no DTO/endpoint/client change; drift gate no-op** (AC 5). The bounded-range validator is class-level custom validation, so it does not alter `openapi.json`.
- **D-11 — Visual QA N/A and i18n N/A (backend-only).** Recorded explicitly so the reviewer does not flag a missing gate (precedent 5-1/5-4). Frontend display of the new over-range 400 rides existing generic validation-error handling; a bespoke message is out of scope.

### Reference patterns (adapt, never copy — ED1)

- `example/tracker-backend-api/openspec/changes/archive/2026-03-15-cache-requests/design.md` — the binding design rationale we adapt: service-layer caching (not controller/repository), user-scoped keys, coarse prefix-based invalidation, single global TTL. We keep the design; swap Redis → in-memory Map.
- `example/tracker-backend-api/src/modules/cache/cache.service.ts` — service shape (`get`/`set`/`del`/`wrap`); our `getOrCompute` is the `wrap` analogue.
- `example/tracker-backend-api/src/modules/cache/cache-key.utils.ts` — key-builder pattern; our `getAnalyticsCacheKey` is the analogue (adapted to our endpoint set + mandatory currency).
- `example/tracker-backend-api/src/modules/transactions-analytics/transactions-analytics-cache.listener.ts` — the reference invalidates analytics on mutation via an event listener; we adapt to direct `invalidateUser` calls (no event-emitter dep — D-6).
- Local: `apps/api/src/shared/validators/is-ordered-date-range.decorator.ts` (+ its `.spec.ts`) — the exact pattern for the new `is-bounded-date-range` validator. No frontend/i18n/styling counterparts — backend-only, new ground for the cache service.

### Project Structure Notes

- New files: `apps/api/src/modules/analytics/analytics-cache.service.ts` (+ `.spec.ts`), `apps/api/src/modules/analytics/analytics-cache.module.ts`, `apps/api/src/shared/validators/is-bounded-date-range.decorator.ts` (+ `.spec.ts`). Constants added to existing `packages/shared/src/constants/analytics.ts`. No new dirs, no schema/migration, no new dependency.
- Naming: kebab-case files; `UPPER_SNAKE_CASE` constants; arrow functions; single export per file; no barrels; no comments (self-documenting names) — `.claude/rules/javascript.md` / `nestjs-apis.md`.
- Layering: cache is a service-layer concern (D7) — controllers and repositories untouched except the two ORDER-BY tie-breaks.

### Testing standards summary

- API unit specs co-located `*.spec.ts` (Vitest + SWC decorators). Integration in `apps/api/test/integration/` (Testcontainers, real Postgres). Given-When-Then / Arrange-Act-Assert; name doubles `mockX`/`expectedX`/`actualX`. Run via pnpm scripts, `TURBO_FORCE=true` to defeat stale turbo cache when verifying gates. The cross-user isolation test (AC 4) is a required security test.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5: Analytics Response Caching] — AC source (in-memory per-user per-query cache, TTL, invalidation on each mutation, transparent contract, per-user isolation, tests).
- [Source: _bmad-output/planning-artifacts/epics.md#Reference-parity backlog RP-B3 / RP-D7] — in-memory over Redis decision for the local PoC.
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-05.md#Action Items #2] — fold the tie-break secondary sort (5-4) and shared max-range/span clamp (5-4/5-5) into 6-5.
- [Source: _bmad-output/implementation-artifacts/6-2-bulk-delete-transactions.md#D-9] — `bulkDelete` kept as a clean single entry point for this story's invalidation hook.
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — D1 (money strings), D7 (repository layering), NFR6 (generated client only), NFR2 (exact deps, no eslint/prettier), FR18/FR21.
- [Source: apps/api/src/modules/analytics/analytics.service.ts / analytics.repository.ts] — current uncached implementation + tie-break sites.
- [Source: example/tracker-backend-api/.../2026-03-15-cache-requests/design.md] — reference caching design (adapt, not copy — ED1).

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- Gates run with `TURBO_FORCE=true` (memory `turbo-cache-masks-gate-results`): `type-check` PASS, `lint` PASS, `stylelint` PASS (no SCSS touched), `fmt:check` PASS, `i18n:parity` PASS (no keys added), `test` PASS (48 files / 406 tests, incl. Testcontainers), `build` PASS.
- OpenAPI drift gate: `pnpm --filter @supertool/api build` then `pnpm turbo run generate:client` → `git status --porcelain -- packages/shared/src/generated` is EMPTY → **no-op, contract unchanged** (AC 5 / D-10). `apps/api/openapi.json` is git-ignored (not tracked); the generated client being byte-identical proves the contract did not drift.
- No new runtime dependency added (`git diff apps/api/package.json` empty) — AC 9 / D-1.
- Lint fixes during development: `no-await-expression-member` (assign await results before member access in the HTTP integration spec), `max-statements` (split the cache integration `describe` into two; the rule counts each `it` as a statement), `max-params` (dropped the unused `validationOptions` param from `IsBoundedDateRange`), `no-magic-numbers` (named `EXPECTED_TWO_CALLS`), `init-declarations` (initialised the cache spec's `service` at declaration).

### Completion Notes List

- **Trend span vs cap (Task 1 verification).** The dashboard trend request is built by `getTrailingMonthsRange(anchor, TRAILING_MONTHS=12)` (`apps/money-tracker/src/utils/period.ts` + `DashboardTrend.tsx`): `dateFrom` = first day of the month 11 months before the anchor, `dateTo` = last day of the anchor month — i.e. exactly 12 consecutive whole months. The inclusive day span is therefore **365 days (366 if the window contains a Feb 29 leap day)**, well under `ANALYTICS_MAX_RANGE_DAYS = 400`. Confirmed by unit assertions in `is-bounded-date-range.decorator.spec.ts` (a 2024-03-01→2025-02-28 window and a leap 2023-03-01→2024-02-29 window both pass under the 400-day cap). `400` is kept.
- **Cache-through wiring (Tasks 2–3).** `AnalyticsCacheService` holds a two-level `Map<userId, Map<cacheKey, { value; expiresAt }>>`; `getOrCompute` returns a `structuredClone` on both read and write so cached payloads are byte-identical and mutation-safe (D1 string-exact — no JSON round-trip). Wrapped in all six `AnalyticsService` methods AFTER the `NO_CURRENCY` early-return (D-4). `limit` participates in the key only for `top-categories` (resolved `query.limit ?? TOP_CATEGORIES_DEFAULT_LIMIT`); other endpoints pass `limit: undefined`. One shared singleton via `AnalyticsCacheModule` imported by analytics, transactions, and transaction-categories modules.
- **Invalidation (Task 4).** `invalidateUser(userId)` called after successful completion of transactions `create`/`update`/`delete`/`bulkDelete`, `TransactionsImportService.importTransactions`, and transaction-categories `createDefaults`/`create`/`update`/`delete` (the last three AFTER their `runInTransaction` promise resolves). No circular import (cache module depends on nothing).
- **Tie-break (Task 5).** `getTopCategories` and `getCategoryBreakdown` ORDER BY changed to `SUM(t.amount) DESC, cr.root_name ASC, cr.root_id ASC`. SELECT/GROUP BY and the pre-LIMIT `SUM(SUM()) OVER ()` total window are untouched (FR18 reconciliation preserved). Existing ordering/reconciliation suites still pass.
- **Bounded range (Task 6).** New class-level `@IsBoundedDateRange('dateFrom','dateTo', ANALYTICS_MAX_RANGE_DAYS)` mirrors `is-ordered-date-range.decorator.ts`, delegates to a pure `checkIsBoundedDateRange` helper in `@supertool/shared` (inclusive day-span math single-sourced there). Applied to all six analytics query DTOs alongside the existing `@IsOrderedDateRange`. Being class-level custom validation, it emits NO OpenAPI property → drift-gate no-op (verified).
- **Security (AC 4).** Cross-user isolation covered at unit level (`analytics.service.spec.ts`, `analytics-cache.service.spec.ts`) AND end-to-end via HTTP in `analytics-cache.integration.spec.ts` (two real signed-in users with identical query params get their own data; user B's mutation leaves user A's warm cache correct).
- **Decision checklist for PR reviewer (Epic 5 retro Action #5).** D-1 in-house cache, zero deps (verified). D-2 standalone `AnalyticsCacheModule`, exports service only. D-3 key `analytics:{endpoint}:{dateFrom}:{dateTo}:{limit ?? ''}:{currency}` under a `userId`-keyed outer map; currency mandatory (RP-D1). D-4 skip `NO_CURRENCY` path. D-5 TTL 5 min backstop + explicit invalidation, lazy expiry on read. D-6 coarse per-user drop, unconditional on success, direct injection (no event-emitter). D-7 `structuredClone` on set+return. D-8 tie-break on top-categories + breakdown. D-9 one shared `ANALYTICS_MAX_RANGE_DAYS` via class-level validator (no drift). D-10 transparent contract, drift no-op. D-11 visual QA N/A, i18n N/A (backend-only).
- **D-12 (new, recorded for reviewer) — single localized type assertion in the generic cache.** `getOrCompute<T>` reads from an intentionally heterogeneous `Map` whose stored value is typed `unknown`; returning it as `T` requires exactly one `structuredClone(entry.value as T)` at the read boundary. A generic memoization cache cannot be expressed in TypeScript without this assertion (a runtime type guard over an arbitrary generic `T` is impossible), so this is the minimal, idiomatic escape hatch — localized to one line, not a project-wide pattern. All other production code stays assertion-free.
- **Visual QA: N/A** — backend-only story, no user-facing surface (D-11, precedent 5-1/5-4).
- **i18n: N/A** — no user-facing strings added; `en`/`uk` message files unchanged (D-11).

### File List

**Added**
- `apps/api/src/modules/analytics/analytics-cache.service.ts`
- `apps/api/src/modules/analytics/analytics-cache.service.spec.ts`
- `apps/api/src/modules/analytics/analytics-cache.module.ts`
- `apps/api/src/shared/validators/is-bounded-date-range.decorator.ts`
- `apps/api/src/shared/validators/is-bounded-date-range.decorator.spec.ts`
- `apps/api/test/integration/analytics-cache.integration.spec.ts`

**Modified**
- `packages/shared/src/constants/analytics.ts` (added `ANALYTICS_CACHE_TTL_MS`, `ANALYTICS_MAX_RANGE_DAYS`)
- `packages/shared/src/constants/transaction-validation.ts` (added `getInclusiveDaySpan`, `checkIsBoundedDateRange`)
- `apps/api/src/modules/analytics/analytics.module.ts` (import `AnalyticsCacheModule`)
- `apps/api/src/modules/analytics/analytics.service.ts` (inject cache, wrap six methods)
- `apps/api/src/modules/analytics/analytics.service.spec.ts` (cache-through + isolation tests)
- `apps/api/src/modules/analytics/analytics.repository.ts` (tie-break ORDER BY on top-categories + breakdown)
- `apps/api/src/modules/analytics/dtos/find-summary-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/analytics/dtos/find-breakdown-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/analytics/dtos/find-trend-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/analytics/dtos/find-top-categories-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/analytics/dtos/find-daily-spending-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/analytics/dtos/find-by-category-query.dto.ts` (+ `.spec.ts`)
- `apps/api/src/modules/transactions/transactions.module.ts` (import `AnalyticsCacheModule`)
- `apps/api/src/modules/transactions/transactions.service.ts` (inject cache, invalidate on create/update/delete/bulkDelete)
- `apps/api/src/modules/transactions/transactions.service.spec.ts`
- `apps/api/src/modules/transactions/transactions-import.service.ts` (inject cache, invalidate on import)
- `apps/api/src/modules/transactions/transactions-import.service.spec.ts`
- `apps/api/src/modules/transaction-categories/transaction-categories.module.ts` (import `AnalyticsCacheModule`)
- `apps/api/src/modules/transaction-categories/transaction-categories.service.ts` (inject cache, invalidate on createDefaults/create/update/delete)
- `apps/api/src/modules/transaction-categories/transaction-categories.service.spec.ts`
- `apps/api/test/integration/analytics.integration.spec.ts` (constructor + cache)
- `apps/api/test/integration/analytics-by-category.integration.spec.ts` (constructor + cache)
- `apps/api/test/integration/transactions.integration.spec.ts` (constructor + cache)
- `apps/api/test/integration/transaction-export.integration.spec.ts` (constructor + cache)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (6-4 → done, 6-5 → review)

### Change Log

- 2026-07-05 — Implemented Story 6.5 (analytics response caching): in-house per-user in-memory `AnalyticsCacheService` (zero new deps) wrapping all six analytics reads with `structuredClone` byte-identical payloads and ~5 min TTL backstop; coarse per-user invalidation on every transaction and grouping-category mutation; deterministic tie-break secondary sort on top-categories + breakdown; shared `ANALYTICS_MAX_RANGE_DAYS` (400) enforced via a new class-level `@IsBoundedDateRange` validator (no OpenAPI drift). Unit + Testcontainers integration tests added (cross-user isolation, per-mutation invalidation, cache-hit deep-equal, tie-break determinism, 400/200 range clamp). All gates green; drift gate no-op. Status → review.
