---
baseline_commit: 586cfd7a5b975860e36a441c14b8d5fe88ffe009
---

# Story 5.1: Transaction Import Endpoint

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the operator-developer,
I want a `POST /transactions/import` endpoint that ingests CSV/JSON and auto-creates categories,
so that the user-facing import (5.2) and onboarding (5.3) have a contract to call, reusing the proven seed ingest (RP-B1).

## Context & Why This Story

Import is currently **seed-only**: the boot script ingests `apps/api/src/database/data/transactions-02.03.25.json` for the operator and nothing else. The reference (`example/tracker-backend-api`) exposes `POST /transactions/import` (multipart JSON/CSV, auto-creates categories/subcategories) and the reference frontend wires it into onboarding and a standalone import page — the whole "import your data and see your money" spine of Epic 5 hangs off this endpoint (RP-F2/RP-B1, P0). Stories 5.2 (import page) and 5.3 (onboarding) consume this contract via the generated client, so it lands first.

This is the first new backend surface since Epic 3 — D1/D7/NFR6 discipline returns after a frontend-only epic. The epic charter is explicit: **reuse supertool's own Story 2.1 seed ingest** (category derivation, decimal-safe amounts, `import_key` dedup) rather than re-implementing the reference's parse-and-insert. The reference import has **no preview mode and no idempotency** — supertool must exceed it on both (D2, epics 5.1 AC), never replicate its fail-fast single-error reporting.

This story also carries a **mandatory epic-4-retro action item** (no longer opportunistic, third carry since epic 2): lift `POSITIVE_AMOUNT_PATTERN` / `CALENDAR_DATE_PATTERN` into `@supertool/shared` — this endpoint validates amounts/dates, so the DTO-touch trigger finally fires. [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-07-04.md#Action Items, item 2]

**Evidence base:** reference captures `…/visual-qa/spike-reference-parity/reference/import--upload/--preview/--result/--page` (auth-app log `41-…`); backend inventory `…/spike-reference-parity/20-ref-backend-inventory.md`; gap rows RP-F2/RP-B1 in `reference-parity-gap-backlog.md`.

## Recommended Approach (binding direction)

**Contract — two multipart operations on the existing transactions controller:**

- `POST /api/v1/transactions/import/preview` → validates everything, **writes nothing**, returns what *would* happen (row counts, duplicate count, categories that would be created, near-duplicate report).
- `POST /api/v1/transactions/import` → same validation, then persists all-or-nothing, returns the execute report (inserted, skipped duplicates, categories created, near-duplicate report).

Both take a single multipart field `file` (`.json` or `.csv`). Declare them **before** the `:id` routes in the controller (reference does the same). operationIds must follow `<resource><Action>`: `transactionsImportPreview`, `transactionsImport`. They are **derived from controller method names** by `buildResourceActionOperationId` (`apps/api/src/app/openapi.ts`) — so name the controller methods exactly `import` and `importPreview` (both are legal TS class-member names); verify in the emitted `openapi.json`.

**Accepted row shape (the seed/reference dataset contract — identical for JSON array entries and CSV rows):**

```
{ Date: "MM/DD/YYYY[ HH:mm:ss]", Category: string, Type: "Expense" | "Income", Amount: number|string, Currency: ISO code, Subcategory?: string }
```

Time-of-day is **truncated** (`parseSeedDate` keeps the date part) — bare `date` granularity is the accepted RP-D5 behaviour and must be **asserted as documented behaviour** in tests, not "fixed".

**Reuse map (do NOT re-implement — the seed ingest is the engine):**

| Need | Reuse | Note |
|---|---|---|
| Row schema | `seedSourceRecordSchema` (`seeds/seed.types.ts`) | Widen `Amount` to `z.union([z.number(), z.string()])` for CSV; JSON stays number-friendly |
| Date parse + truncation | `parseSeedDate` (`seeds/parse-seed-date.ts`) | Throws plain `Error` — the import service catches per-row and maps to row errors |
| Decimal-safe amount | `convertAmountToString` (`seeds/convert-amount.ts`) | Widen signature to `number \| string` (Decimal accepts both). **Never `Number()` a CSV amount** — that is float arithmetic on money (D1) |
| Type normalization | `normalizeTransactionType` (`seeds/normalize-transaction-type.ts`) | ⚠️ It is **case-sensitive** (`=== 'Income'`, everything else → `expense`). Import must pre-validate `Type` case-insensitively against `{expense, income}`, emit a row error for anything else, **and canonicalize the accepted value to exact `'Expense'`/`'Income'` on the record before any further use** — otherwise a `"income"` row passes validation and is silently persisted as an expense (both `buildTransactionRows` and `buildImportKey` call this helper). Pin with a case-variant unit test |
| Category hierarchy | `deriveCategoryHierarchy` (`seeds/derive-category-hierarchy.ts`) | Two-level: Category→top-level, Subcategory→child |
| Dedup key | `buildImportKey` (`seeds/build-import-key.ts`) | SHA-256 of normalized record + row index (D2) |
| Near-duplicate report | `findNearDuplicateCategories` (`seeds/find-near-duplicate-categories.ts`) | Surfaced in both preview and execute responses — never silently merged |
| Persist + auto-create + dedup | `seedTransactions` (`seeds/seed-transactions.ts`) | Returns `SeedReport { inserted, skippedDuplicates, topLevelCreated, childrenCreated, nearDuplicateClusterList }` — this IS the execute engine |

**Layering (D7 — keep the hard rule intact):** the controller calls `TransactionsImportService` (new `transactions-import.service.ts` in the transactions module, mirroring the reference's separate import service); the service parses/validates the file and calls **repository methods only**. Add to `TransactionsRepository`: `runImport({ userId, recordList })` — wraps `db.transaction(async (tx) => seedTransactions({ db: tx, userId, recordList, logger }))` so the seed engine stays the single DB-touching write path *inside* the repository layer, and the run is atomic; plus read helpers for preview: `findExistingImportKeys(userId, importKeyList)` (chunk `inArray` by the existing `TRANSACTION_BATCH_SIZE`-style batching) and `findCategoryNameSetsByUserId(userId)` (existing top-level/child names, to diff against the derived hierarchy). `seedTransactions` accepts `NodePgDatabase`; the drizzle tx type is `DatabaseTransaction` (`database.types.ts`) — if the signature fights, widen `SeedTransactionsOptions.db` to the existing `DatabaseExecutor` type rather than casting (no `as`).

**Validation is all-up-front, error reporting is collect-all (exceeds the reference's fail-fast):** parse the file, validate **every** row, collect row-level problems as `"Row N: …"` strings (cap the reported list with a named constant, e.g. `IMPORT_MAX_REPORTED_ROW_ERRORS = 50`). If any row is invalid → throw `BadRequestException` with the shared envelope `{ statusCode, code: ErrorCode.ValidationError, message, details: { rowErrorList } }` and **write nothing**. Only a fully valid file reaches the repository. Reuse `ErrorCode.ValidationError` — no new error code. Currency validates against `CURRENCY_CODE_LIST` / `checkIsCurrencyCode` (`@supertool/shared/constants/currency`); amounts (after decimal-safe normalization) must satisfy `POSITIVE_AMOUNT_PATTERN`; dates must parse via `parseSeedDate`.

**⚠️ Discovered schema conflict — one bounded migration (diverges from the epic's "no schema change" note; rationale recorded in Dev Notes):** `transactions_import_key_unique` is currently a **global** unique index on `import_key` alone. Because `buildImportKey` does not include the user, a second user importing the same file (the 5.3 onboarding path) would collide with the first user's rows and silently insert **zero** — a real FR21 user-scoping defect. Fix: migrate the unique index to composite `(user_id, import_key)` and update both `onConflictDoNothing` targets (seed insert + import path) to `[transactions.userId, transactions.importKey]`. Existing seeded rows keep their keys; operator re-seed still dedups identically; `import_key` stays nullable (Postgres NULLS DISTINCT keeps manual transactions unaffected). No table/column changes.

**File handling:** multer 2.1.1 already ships inside `@nestjs/platform-express` — `FileInterceptor('file', { limits: { fileSize: TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } })` works even with the app's `bodyParser: false` bootstrap (multer is interceptor-mounted, not body-parser-dependent). Add dev-dep `@types/multer@2.2.0` (exact). CSV parsing server-side via **`csv-parse@7.0.1`** (new runtime dep, exact pin — newest stable; the reference uses csv-parse too, pattern carried per ED1; papaparse is 5.2's *client-side* dep, not this story). Extension dispatch (`.json`/`.csv`) + empty-file + row-cap checks mirror the reference service.

**Shared limits (cross-app — 5.2's client-side checks must read the same values):** new `packages/shared/src/constants/transaction-import.ts` with `TRANSACTION_IMPORT_MAX_ROWS = 3000` (reference parity; seed's 1880 fits) and `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES` (5 MiB, reference parity) — memory `shared-constants-no-duplication`.

**Regex lift (mandatory retro carry-in):** move `CALENDAR_DATE_PATTERN`, `POSITIVE_AMOUNT_PATTERN`, and `checkIsCalendarDate` from `apps/api/src/shared/constants/transaction-validation.ts` into new `packages/shared/src/constants/transaction-validation.ts`. **Delete the API file** (re-exports are forbidden) and update every import site; dedupe the three frontend copies. The co-located specs move too: `packages/shared` currently has **no test infrastructure** — add it (vitest `4.1.8` exact, minimal config + `test` script mirroring the other packages; turbo's `test` task picks per-package scripts up automatically) and relocate `transaction-validation.spec.ts` beside the shared source so the leap-year/calendar-date coverage survives co-located (decision D-J). Full site list in Tasks.

**Response DTOs (counts are `number` — they are counts, not money; no amounts appear in any response):**

- `TransactionImportPreviewResponseDto`: `totalRows`, `newRows`, `duplicateRows`, `topLevelCategoriesToCreateList: string[]`, `childCategoriesToCreateList: string[]`, `nearDuplicateClusterList`
- `TransactionImportResponseDto`: `inserted`, `skippedDuplicates`, `topLevelCategoriesCreated`, `childCategoriesCreated`, `nearDuplicateClusterList`
- `NearDuplicateClusterDto`: `normalizedKey`, `rawNameList: string[]`, `hasMixedScript` (mirrors `NearDuplicateCluster` in `seed.types.ts`)

No new enums → no `OPENAPI_ENUM_NAME` entries needed. Document the multipart body with the manual `@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })` shape plus `@ApiConsumes('multipart/form-data')` (reference pattern).

## Acceptance Criteria

1. **Execute ingests CSV + JSON with user-scoped category auto-creation (FR21, D1, D7).** Given the transactions module, when `POST /api/v1/transactions/import` receives a multipart `.csv` or `.json` file of rows shaped `{Date, Category, Type, Amount, Currency, Subcategory?}` from an authenticated user, then it validates the payload, derives the two-level category set (Category→top-level, Subcategory→child) auto-creating only the missing categories **scoped to that user**, preserves amounts/currencies/dates exactly with decimal-safe arithmetic (string amounts end-to-end, `decimal.js` at the ingest boundary, never `Number()`/float math), truncates source time-of-day to the `date` column (RP-D5 — documented behaviour), and persists via the repository layer only. Response is 201 with the execute report.
2. **Preview mode writes nothing.** Given `POST /api/v1/transactions/import/preview` with the same file, when it runs, then it returns validated row counts (`totalRows`/`newRows`/`duplicateRows`), the top-level and child categories that would be created, and the near-duplicate summary — and the database is untouched (asserted by the integration test).
3. **Idempotency (D2).** Given the same file imported twice (or rows overlapping already-seeded data), when execute runs again, then `import_key` = SHA-256 of the normalized record + row index with `ON CONFLICT DO NOTHING` yields **zero duplicates** (`inserted: 0`, `skippedDuplicates: totalRows` on the re-run), and near-duplicate category strings are surfaced in the report, never silently merged. Import-key uniqueness is **per user** — a second user importing the same file gets their own full copy (composite `(user_id, import_key)` unique index; migration included; seed re-run stays idempotent for the operator).
4. **Malformed payload → shared envelope, all-or-nothing.** Given a file with a bad amount, unknown `Type`, unparseable date, unknown currency, missing required CSV headers, wrong JSON shape (not an array), an empty file, an unsupported extension, or more than `TRANSACTION_IMPORT_MAX_ROWS` rows, when it is submitted to either endpoint, then the response is 400 with `{ statusCode, code: 'VALIDATION_ERROR', message, details }` carrying row-aware error strings (collect-all, capped — exceeds the reference's fail-fast single error), and **nothing is written** (all-or-nothing per import run). (A file over `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES` is rejected earlier by multer as **413** — a separate, documented contract; see Task 7.)
5. **Validation regexes lifted into `@supertool/shared` (epic-4 retro action item — mandatory).** `CALENDAR_DATE_PATTERN`, `POSITIVE_AMOUNT_PATTERN`, and `checkIsCalendarDate` live once in `packages/shared/src/constants/transaction-validation.ts`; the API copy (`apps/api/src/shared/constants/transaction-validation.ts`) is deleted with all its import sites updated, and the three duplicated frontend definitions (`transaction-form-schema.ts`, `format-transaction-date.ts`, `check-is-calendar-date.ts`) now import the shared constants. The co-located `transaction-validation.spec.ts` relocates to `packages/shared` (which gains minimal vitest infrastructure — decision D-J) so the coverage survives; the now-redundant frontend `check-is-calendar-date.test.ts` is deleted with its util. No behaviour change; all remaining API + frontend tests stay green.
6. **Tests (NFR1 priority target) + contract regeneration (NFR6/D8).** Testcontainers integration tests (`apps/api/test/integration/transaction-import.integration.spec.ts`) assert against real Postgres: preview counts, execute correctness (rows, categories, exact string amounts), re-run idempotency, **decimal-safe per-currency sums** (DB `SUM(amount)` equals the Decimal-computed expected string), category auto-creation reuse (existing categories not duplicated), **user-scoping** (two users import the same file → each gets a full independent copy; categories not shared), time-of-day truncation, and preview-writes-nothing. Unit specs cover the import service's parse/validate branches (every malformed case in AC 4). The OpenAPI spec + generated client are regenerated and committed (`pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`), the drift gate is green, and all repo gates pass (type-check, lint, stylelint, test, i18n:parity — run with `--force` where turbo may replay stale logs).

## Tasks / Subtasks

- [x] **Task 1 — Study the engine and the reference before writing code** (AC: 1, 2, 3)
  - [x] Read in full: `apps/api/src/database/seeds/seed-transactions.ts` (category conflict target, batching, `SeedReport`), `seed.types.ts`, `build-import-key.ts`, `parse-seed-date.ts`, `convert-amount.ts`, `normalize-transaction-type.ts`, `derive-category-hierarchy.ts`, `find-near-duplicate-categories.ts`; `apps/api/src/modules/transactions/{transactions.controller.ts,transactions.service.ts,transactions.repository.ts}`; `apps/api/src/database/schemas/transactions.ts` (the global `transactions_import_key_unique` index this story migrates).
  - [x] Reference patterns (ED1 — carry patterns, never code): `example/tracker-backend-api/src/modules/transactions/transaction-import.service.ts` (extension dispatch, CSV header check, row validation messages, category resolution flow), `…/transactions.controller.ts` `@Post('import')` block (FileInterceptor + `@ApiConsumes` + manual `@ApiBody` binary schema), `…/dtos/import-transaction-response.dto.ts` (report field naming). Note where supertool exceeds: preview endpoint, `import_key` idempotency, near-duplicate report, collect-all row errors — **no reference counterpart for these — new ground**.
- [x] **Task 2 — Lift validation regexes into `@supertool/shared`** (AC: 5)
  - [x] Create `packages/shared/src/constants/transaction-validation.ts` with `CALENDAR_DATE_PATTERN`, `POSITIVE_AMOUNT_PATTERN`, `checkIsCalendarDate` (move the implementation verbatim from `apps/api/src/shared/constants/transaction-validation.ts`).
  - [x] Add minimal test infrastructure to `packages/shared` (vitest `4.1.8` exact, config + `test` script mirroring `packages/ui`) and move `apps/api/src/shared/constants/transaction-validation.spec.ts` to `packages/shared/src/constants/transaction-validation.spec.ts`, co-located with the moved source (decision D-J).
  - [x] Delete the API source file (its spec moved above); update its import sites to `@supertool/shared/constants/transaction-validation`: `modules/transactions/dtos/{create,update}-transaction.dto.ts`, `modules/transactions/dtos/find-transactions-query.dto.ts`, `modules/analytics/dtos/{find-summary,find-trend,find-breakdown}-query.dto.ts`, `shared/validators/is-calendar-date.decorator.ts`.
  - [x] Dedupe the frontend copies: `apps/money-tracker/src/app/[locale]/transactions/constants/transaction-form-schema.ts` (local `POSITIVE_AMOUNT_PATTERN`), `…/utils/format-transaction-date.ts` (local `CALENDAR_DATE_PATTERN`), `…/utils/check-is-calendar-date.ts` (whole util duplicates `checkIsCalendarDate` — replace its consumers with the shared import and delete the util **and its co-located `check-is-calendar-date.test.ts`** — that coverage now lives in the shared spec; update `transaction-form-schema.ts` and any other importers; check `git grep "check-is-calendar-date"`). The standalone pattern copy inside `get-today-date.test.ts` may stay (test-local fixture).
  - [x] Run the full frontend + API + shared test suites — zero behaviour change expected.
- [x] **Task 3 — Shared import limits** (AC: 4)
  - [x] New `packages/shared/src/constants/transaction-import.ts`: `TRANSACTION_IMPORT_MAX_ROWS = 3000`, `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES` (5 MiB as a computed named expression, no bare magic literal).
- [x] **Task 4 — Per-user import-key uniqueness migration** (AC: 3)
  - [x] `apps/api/src/database/schemas/transactions.ts`: change `uniqueIndex('transactions_import_key_unique').on(table.importKey)` to a composite on `(table.userId, table.importKey)`; run `pnpm --filter @supertool/api db:generate` for the migration.
  - [x] Update `insertTransactionRows` in `seeds/seed-transactions.ts` `onConflictDoNothing` target to `[transactions.userId, transactions.importKey]`.
  - [x] Confirm `seed.integration.spec.ts` (re-run idempotency) stays green; extend it only if the conflict-target change needs an assertion touch-up.
- [x] **Task 5 — Import parsing + validation (service layer)** (AC: 1, 4)
  - [x] Add deps: `csv-parse@7.0.1` (dependencies), `@types/multer@2.2.0` (devDependencies) — exact pins, `pnpm install`.
  - [x] New `apps/api/src/modules/transactions/transactions-import.service.ts` (`TransactionsImportService`, explicit `@Inject` for every constructor param — never `import type` an injectable): extension dispatch (`.json` → `JSON.parse` + array check; `.csv` → `csv-parse/sync` `parse()` on the buffer with `columns: true, skip_empty_lines: true, trim: true` — options verified against v7; the sync entrypoint is fine for a ≤5 MiB buffered file — plus required-header check `Date, Category, Type, Amount, Currency`), empty-file and `TRANSACTION_IMPORT_MAX_ROWS` checks, then per-row validation into `SeedSourceRecord[]`: `Date` via `parseSeedDate` (catch its `Error` → row error); `Type` case-insensitive `expense|income`, canonicalized to exact `'Expense'`/`'Income'` on the record (see reuse-map warning — `normalizeTransactionType` is case-sensitive); `Amount` via widened `convertAmountToString` **wrapped per-row** (`new Decimal('abc')` throws → row error; `Decimal('NaN')` does NOT throw — it yields `'NaN'`, which the follow-up `POSITIVE_AMOUNT_PATTERN` check on the result rejects along with zero/negative; never `Number()`); `Currency` via `checkIsCurrencyCode`; `Category` non-empty trimmed; `Subcategory` optional trimmed. Collect all row errors (**1-based** `"Row N: …"` like the reference, cap `IMPORT_MAX_REPORTED_ROW_ERRORS = 50`) → single `BadRequestException` `{ code: ErrorCode.ValidationError, message, details: { rowErrorList } }`.
  - [x] Widen `seeds/convert-amount.ts` to `(amount: number | string)` and `seedSourceRecordSchema.Amount` to `z.union([z.number(), z.string()])` — seed callers unaffected.
  - [x] Register the service in `transactions.module.ts` providers.
- [x] **Task 6 — Repository import methods (the only DB path)** (AC: 1, 2, 3)
  - [x] `transactions.repository.ts`: `runImport({ userId, recordList })` → `db.transaction((tx) => seedTransactions({ db: tx, userId, recordList, logger }))` returning `SeedReport` (widen `SeedTransactionsOptions.db` to `DatabaseExecutor` if the tx type fights — no `as` casts); `findExistingImportKeys(userId, importKeyList)` (chunked `inArray`); `findCategoryNameSetsByUserId(userId)` returning existing top-level and child name sets. Logger: inject the module's pino logger (nestjs-pino `PinoLogger` exposes the underlying instance) or pass a child logger — match how `runSeed` feeds `seedTransactions`.
  - [x] Preview assembly in the service: derived hierarchy diffed against existing name sets → `*CategoriesToCreateList`; `buildImportKey` per row diffed against `findExistingImportKeys` → `newRows`/`duplicateRows`; `findNearDuplicateCategories(recordList)` → `nearDuplicateClusterList`. No writes on this path.
- [x] **Task 7 — Controller endpoints + DTOs + client regeneration** (AC: 1, 2, 6)
  - [x] New DTOs in `modules/transactions/dtos/`: `transaction-import-response.dto.ts`, `transaction-import-preview-response.dto.ts`, `near-duplicate-cluster.dto.ts` (fields per Recommended Approach; `@ApiProperty` on every field, `type: [String]` / nested type arrays as needed).
  - [x] `transactions.controller.ts`: `@Post('import')` (201) and `@Post('import/preview')` (200, `@HttpCode`) — both `@UseGuards(AuthGuard)`, `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES } }))`, `@ApiConsumes('multipart/form-data')`, manual `@ApiBody` binary schema, `@UploadedFile() file: Express.Multer.File | undefined` with a missing-file 400 (shared envelope), session user id from `@Session()` as in existing routes. Declare above the `:id` routes. Name the methods exactly `import` / `importPreview` (operationId derivation — see Recommended Approach). An oversize upload (> `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES`) is rejected by multer's `LIMIT_FILE_SIZE` as **413** (`PayloadTooLargeException`, shaped by the global exception filter — not the 400 `VALIDATION_ERROR` path); this is the accepted contract for 5.2's error mapping — assert the 413 status in the controller spec.
  - [x] Verify operationIds `transactionsImport` / `transactionsImportPreview` in the emitted `openapi.json`; regenerate: `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`; commit the generated diff; confirm the generated package type-checks (multipart ops generate with form-data body — spot-check the generated SDK method signatures for 5.2's benefit).
- [x] **Task 8 — Tests** (AC: 6)
  - [x] Unit: `transactions-import.service.spec.ts` — every AC-4 branch (bad amount incl. `0`/negative/non-numeric string like `"abc"`/literal `"NaN"`, unknown type, **case-variant `"income"`/`"INCOME"` accepted and persisted as income — pins the canonicalization**, unparseable date, unknown currency, missing CSV headers, non-array JSON, empty file, unsupported extension, row-cap overflow, collect-all + cap behaviour + 1-based row numbering, missing file handled at controller); `convert-amount.spec.ts` extended for string inputs (decimal-safe: `"10.005"`-style inputs resolve via Decimal, never float).
  - [x] Controller: extend `transactions.controller.spec.ts` for the two new routes (delegation + missing-file 400 + oversize 413 contract).
  - [x] Integration: new `apps/api/test/integration/transaction-import.integration.spec.ts` (mirror the container bootstrap of `transactions.integration.spec.ts` / `seed.integration.spec.ts`; reuse `test/helpers/postgres-container.ts` — see `_bmad-output/implementation-artifacts/tech-debt-integration-test-helper-dedup.md`): CSV + JSON execute correctness; preview counts + **preview writes nothing** (row counts before/after); re-run idempotency (`inserted: 0`); per-currency `SUM(amount)` equals Decimal-computed expected strings (D1); category auto-creation + reuse (second import with same categories creates none); **two-user scoping** (same file, both users get full copies; categories per-user); time-of-day truncation (`15:41:17` source → `date` column holds the calendar date).
- [x] **Task 9 — Gates + record** (AC: 5, 6)
  - [x] Run via pnpm scripts only (never `node_modules/.bin`; retry the transient `H.replace` crash): `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm test`, `pnpm i18n:parity`, plus the drift gate (regenerated client committed, CI regenerates and diffs). Use `--force` where turbo may replay stale logs (memory `turbo-cache-masks-gate-results`).
  - [x] No UI surface in this story → no screenshots; the epic's per-story mobile-QA check is explicitly N/A here and rides on 5.2, which renders this contract. Record that in the Dev Agent Record.
  - [x] Update the Dev Agent Record + File List + Change Log; status → review.

### Review Findings (adversarial code review, 2026-07-04)

Layers: Blind Hunter (context-free), Edge Case Hunter, Acceptance Auditor — all completed. Gates re-verified by the review orchestrator (all `TURBO_FORCE`): fmt:check PASS, i18n:parity PASS, lint PASS 8/8, stylelint PASS, type-check PASS 9/9, test PASS 8/8 (API 220/220 incl. the new import suites), client drift gate PASS (API rebuilt, client regenerated, zero diff). Acceptance Auditor confirmed all 6 ACs and every hard rule (D1/D7/NFR6/pins/DI/no-comments/ED1/i18n) satisfied — no false completion claims. Triage: 2 must-fix patches, 8 advisories deferred, 2 review decisions resolved autonomously, 10 findings dismissed as spec-compliant/documented.

- [x] [Review][Patch] Impossible-but-in-range calendar dates (`02/30/2025`, `04/31/2025`, non-leap `02/29/2025`) pass row validation — `parseRowDate` trusts `parseSeedDate`, which only range-checks month 1–12 / day 1–31 with no calendar round-trip, so preview reports the file valid and execute then 500s inside the DB transaction (Postgres rejects `2025-02-30`) instead of returning the AC-4 400 row error. Validate the produced ISO string with the just-lifted `checkIsCalendarDate` from `@supertool/shared` inside `parseRowDate` [apps/api/src/modules/transactions/transactions-import.service.ts:100 + apps/api/src/database/seeds/parse-seed-date.ts:21] — **resolved 2026-07-04**: `parseRowDate` now round-trips `parseSeedDate`'s ISO output through the shared `checkIsCalendarDate`, so impossible dates surface as the standard 1-based `"Row N: "Date" …"` 400 row error; `parseSeedDate` itself untouched (seed input is repo-committed JSON, per the finding's prescribed fix). Spec cases added: `02/30/2025 15:41:17`, non-leap `02/29/2025`, `04/31/2025`.
- [x] [Review][Patch] UTF-8 BOM-prefixed files — Excel's default "CSV UTF-8" export and BOM'd JSON — are rejected with misleading errors: the first CSV header parses as BOM+`Date` → `Missing required CSV headers: Date`; `JSON.parse` throws on a leading BOM → `File is not valid JSON`. Add `bom: true` to the csv-parse options and strip a leading U+FEFF before `JSON.parse` [apps/api/src/modules/transactions/transactions-import.service.ts:47,75] — **resolved 2026-07-04**: `bom: true` added to the csv-parse options; JSON path strips a leading U+FEFF via `LEADING_BOM_PATTERN` (`/^\uFEFF/u`, escape not literal so the invisible char can't be dropped by tooling) before `JSON.parse`. Spec cases added: BOM-prefixed CSV and BOM-prefixed JSON fixtures import successfully with intact field values.
- [x] [Review][Defer] rowIndex-salted `import_key` makes dedup positional — an edited/reordered re-export re-imports the whole shifted tail as new rows (byte-identical re-runs stay idempotent, as tested) [apps/api/src/database/seeds/build-import-key.ts:24] — deferred, architecture-D2-mandated key design (SHA-256 of normalized record + row index); 5.2 UX note in deferred-work.md
- [x] [Review][Defer] Name-only child-category resolution is now user-reachable — same subcategory name under two parents mis-links to one winner parent [apps/api/src/database/seeds/seed-transactions.ts:59] — deferred, pre-existing 2.1 engine caveat already in deferred-work.md; story explicitly forbids redesigning the keying
- [x] [Review][Defer] Same category name with conflicting types in one file gets first-seen type; the other type's transactions link to a type-mismatched category [apps/api/src/database/seeds/derive-category-hierarchy.ts:21] — deferred, pre-existing 2.1 engine caveat (2-1 deferral), now escalated to user-reachable
- [x] [Review][Defer] Concurrent same-user imports can deadlock on category creation inside `runImport`'s transaction (lock-order inversion); the loser 500s [apps/api/src/modules/transactions/transactions.repository.ts] — deferred, single-user local runtime; throttling/serialization deliberately out of scope (D-H)
- [x] [Review][Defer] Row-error list capped at 50 with no total-error count or truncation marker in `details` — blind iterate-fix-reupload on very dirty large files [apps/api/src/modules/transactions/transactions-import.service.ts] — deferred, cap is spec-mandated; add `totalErrorCount` when 5.2 needs it
- [x] [Review][Defer] Amounts with >2 decimals are silently half-up rounded (`10.005` → `10.01`) while the row-error text promises "at most two decimal places" [apps/api/src/modules/transactions/transactions-import.service.ts + seeds/convert-amount.ts] — deferred, convert-then-validate is spec-mandated (real dataset carries float artifacts; storage is `numeric(14,2)`); align the message wording or document rounding in 5.2
- [x] [Review][Defer] `"types": ["multer"]` in apps/api tsconfig disables auto-inclusion of every other `@types` package's globals; compiles today only via transitive node typings [apps/api/tsconfig.json] — deferred, type-check green; consider `["multer", "node"]` next tsconfig touch
- [x] [Review][Defer] `Promise.all` batch inserts inside the single-connection import transaction: zero real parallelism and a mid-batch failure cascades `25P02` noise over the root error [apps/api/src/database/seeds/seed-transactions.ts] — deferred, carried 2.1 engine shape; sequentialize when the engine is next touched

Review decisions resolved autonomously (non-interactive run — operator may overrule):

1. **413 envelope `code` stays `INTERNAL_ERROR`** — flagged by Auditor + Blind Hunter; accepted as-is: Completion Note #3 pre-documents it, the global filter still shapes the envelope, and 5.2 must map oversize uploads by status 413, never by `code`. No change.
2. **Preview's name-only category diff vs execute's `[userId, name, type, parentId]` conflict target** — accepted as-is: the story's "Category resolution caveat" mandates this approximation and forbids fixing one side to match the other. No change.

Dismissed as spec-compliant/documented (10): sync `csv-parse/sync` + `JSON.parse` on ≤5 MiB buffers (spec-approved), production import flowing through `seeds/`-named modules (spec-mandated engine reuse), 201 on a zero-insert re-run (spec fixes execute at 201), MM/DD vs DD/MM ambiguity (D-B binds the contract to the dataset shape), English-only single-code error messages (D-F: developer-facing, frontend maps by `code`), Type case-insensitive vs strict Currency/Date leniency asymmetry (spec mandates exactly this Type handling; currency uses the shared validator), seed zod `Amount` union accepting arbitrary strings (seed input is repo-committed JSON; the HTTP path pre-validates), test-local `50` cap literal (test-fixture precedent), `parseRowAmount` returning the raw value (Auditor-verified not a D1 defect — Decimal-validated, converted at the engine boundary, no float math anywhere), preview fan-out of chunked key SELECTs + `splitIntoChunks` zero-guard (spec-mandated batching; constant-guarded).

## Dev Notes

### Decisions made at story creation (autonomous run — operator review points)

| # | Decision | Rationale |
|---|---|---|
| D-A | **Two endpoints** (`import/preview` + `import`) instead of a preview flag on one endpoint | Distinct `<resource><Action>` operationIds → two cleanly typed generated-client methods for 5.2 (NFR6/D8); a boolean form-field would blur the OpenAPI contract and response typing. The reference has no preview at all — **diverges from reference: preview endpoint added — pre-confirmed by epics.md 5.1 AC** ("preview mode… so the UI can show a preview before execute"). |
| D-B | **Row/date contract = the seed dataset shape** (`MM/DD/YYYY[ HH:mm:ss]`, `Expense`/`Income`, JSON-number or CSV-string amounts) | Matches the real 1,880-row dataset, the reference importer's accepted shape, and lets the story reuse `parseSeedDate` unchanged. Time-of-day truncation is the accepted RP-D5 behaviour (asserted, documented). |
| D-C | **Execute = `seedTransactions` wrapped in `db.transaction` inside a repository method** | The epic charter mandates reusing the 2.1 ingest; wrapping it in `TransactionsRepository.runImport` keeps D7 ("repositories are the only DB-touching layer") literally true for the request path and makes the run atomic. Re-implementing insert logic in the repository would fork the engine (defect risk). |
| D-D | **Composite `(user_id, import_key)` unique index migration** — diverges from the epic note "No schema change" | The current global unique index makes user B's import of a file user A already imported insert zero rows — an FR21 user-scoping defect that 5.3 onboarding would hit. Composite index preserves operator seed idempotency, changes no columns, and is the option consistent with architecture's authorization pattern ("every domain row carries user_id; repositories scope every query"). Flagged per retro D3 divergence sign-off. |
| D-E | **`csv-parse@7.0.1`** (runtime, exact) + **`@types/multer@2.2.0`** (dev, exact); multer runtime already ships with `@nestjs/platform-express` | New-dependency rule (architecture.md handoff: consult before introducing) satisfied here: reference uses csv-parse (pattern carried), pinned at newest stable per memory `new-deps-newest-stable`. papaparse is deliberately NOT added — that is 5.2's client-side dep per epics.md. |
| D-F | **Collect-all row errors, capped at 50, under `ErrorCode.ValidationError`** | Exceeds the reference's fail-fast single-error UX; 5.2's AC needs "validation problems surfaced row-aware before I commit" and its error mapping is by `code` (never raw text), so no new error code is needed — row strings ride in `details`. |
| D-G | **Limits as shared constants** (3000 rows / 5 MiB in `@supertool/shared`) | Reference-parity values; 5.2 must enforce the same bounds client-side — memory `shared-constants-no-duplication` (API and frontend read one source). |
| D-H | **No throttling, no caching on the import routes** | Rate limiting beyond auth is RP-B4 (P2, explicitly deferred decision); caching is RP-B3 (Epic 6, story 6.5). Reference's `@Throttle` on import is not carried. |
| D-I | **Regex lift includes `checkIsCalendarDate`** (not just the two patterns) | The helper is the patterns' only behavioural companion and is duplicated verbatim in the frontend (`check-is-calendar-date.ts`); moving patterns without it would leave the duplication the retro action targets. API file is deleted, not re-exported (repo rule: no re-exports). |
| D-J | **`packages/shared` gains minimal vitest infrastructure** so `transaction-validation.spec.ts` moves co-located with the lifted source | The repo convention is tests co-located with the code under test; the alternative (an orphan spec left in `apps/api` pointing at shared code, or deleting the spec) either violates co-location or loses leap-year/calendar-date coverage (NFR1). vitest `4.1.8` exact matches every other package; turbo's `test` task discovers per-package scripts automatically. |

### Files to TOUCH / CREATE (read each fully before editing)

| File | Action | Why |
|---|---|---|
| `packages/shared/src/constants/transaction-validation.ts` | NEW | Lifted `CALENDAR_DATE_PATTERN` / `POSITIVE_AMOUNT_PATTERN` / `checkIsCalendarDate` (AC 5) |
| `packages/shared/src/constants/transaction-validation.spec.ts` | NEW (moved) | Relocated from `apps/api/src/shared/constants/` — co-located with the lifted source (D-J) |
| `packages/shared/package.json` + vitest config | UPDATE/NEW | Minimal test infra (vitest `4.1.8` exact, `test` script mirroring `packages/ui`) (D-J) |
| `packages/shared/src/constants/transaction-import.ts` | NEW | `TRANSACTION_IMPORT_MAX_ROWS`, `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES` |
| `apps/api/src/shared/constants/transaction-validation.ts` (+ its `.spec.ts`) | DELETE | Source superseded by the shared copy (spec moved, not lost); update all 7 source import sites (Task 2) |
| `apps/api/src/database/schemas/transactions.ts` | UPDATE | Composite `(user_id, import_key)` unique index (+ generated migration) |
| `apps/api/src/database/seeds/seed-transactions.ts` | UPDATE | Conflict target `[userId, importKey]`; optionally widen `db` to `DatabaseExecutor` |
| `apps/api/src/database/seeds/convert-amount.ts` (+ spec) | UPDATE | Accept `number \| string` (Decimal-safe CSV amounts) |
| `apps/api/src/database/seeds/seed.types.ts` | UPDATE | `Amount: z.union([z.number(), z.string()])` |
| `apps/api/src/modules/transactions/transactions-import.service.ts` (+ spec) | NEW | Parse/validate/preview-assemble/execute-delegate |
| `apps/api/src/modules/transactions/transactions.repository.ts` | UPDATE | `runImport`, `findExistingImportKeys`, `findCategoryNameSetsByUserId` |
| `apps/api/src/modules/transactions/transactions.controller.ts` (+ spec) | UPDATE | `@Post('import')`, `@Post('import/preview')` above `:id` routes |
| `apps/api/src/modules/transactions/transactions.module.ts` | UPDATE | Provide `TransactionsImportService` |
| `apps/api/src/modules/transactions/dtos/transaction-import-response.dto.ts` | NEW | Execute report |
| `apps/api/src/modules/transactions/dtos/transaction-import-preview-response.dto.ts` | NEW | Preview report |
| `apps/api/src/modules/transactions/dtos/near-duplicate-cluster.dto.ts` | NEW | Shared nested report DTO |
| `apps/api/src/modules/transactions/dtos/{create,update}-transaction.dto.ts`, `find-transactions-query.dto.ts`, `apps/api/src/modules/analytics/dtos/find-{summary,trend,breakdown}-query.dto.ts`, `apps/api/src/shared/validators/is-calendar-date.decorator.ts` | UPDATE | Re-point imports to `@supertool/shared/constants/transaction-validation` |
| `apps/money-tracker/src/app/[locale]/transactions/constants/transaction-form-schema.ts`, `…/utils/format-transaction-date.ts`, `…/utils/check-is-calendar-date.ts` (+ its `.test.ts`) | UPDATE/DELETE | Frontend dedup of the lifted constants (delete `check-is-calendar-date.ts` and its test — coverage lives in the shared spec; re-point consumers) |
| `apps/api/package.json` | UPDATE | `csv-parse@7.0.1`, `@types/multer@2.2.0` (exact) |
| `apps/api/test/integration/transaction-import.integration.spec.ts` | NEW | AC 6 Testcontainers suite |
| `packages/shared/src/generated/**` | REGEN | New operations; drift gate must stay green |

### Current state of the system this story modifies (preserve, don't break)

- **Seed pipeline (2.1)** runs at boot (`runSeed`) for the operator only and is idempotent via `onConflictDoNothing` on the import-key unique index; category upsert conflict target is `[userId, name, type, parentId]` (requires the existing NULLS NOT DISTINCT unique on `transaction_categories` — memory `drizzle-nullsnotdistinct-on-unique-not-uniqueindex`; do not touch that constraint). `seedTransactions` returns `SeedReport`; keep its public contract — the import path consumes it as-is.
- **Category resolution caveat (inherited, keep):** `buildTransactionRows` resolves a row's category by **name only** within the user (child map keyed by child name across all parents). Rows whose `Subcategory` name repeats under different parents collapse to one child — the near-duplicate report is the surfacing mechanism; do not redesign the keying in this story (deferred-ledger candidate if it ever bites). The same applies to preview: its category diff is **name-only** (`findCategoryNameSetsByUserId`) while execute's conflict target is `[userId, name, type, parentId]`, so a same-name/different-type edge can make preview's "to create" count differ from execute's "created" count — this approximation deliberately mirrors the engine's name-only keying; do not "fix" one side to match the other.
- **`transactions` table**: `amount numeric(14,2)` positive-checked, `currency text` per-row (the single-default-currency model is a *display/scoping* decision — storage keeps each row's source currency exactly; import preserves it), `date` bare SQL date string, `note` defaults `''`, `import_key` nullable text (manual CRUD rows have NULL).
- **Controller/auth pattern**: `@UseGuards(AuthGuard)` + `@Session() session: UserSession<typeof auth>` → `session.user.id`; errors via Nest `HttpException` subclasses with `code` from `@supertool/shared/constants/error-codes`; the global exception filter is the only JSON-shaper. `ValidationPipe({ whitelist: true, transform: true })` is global; app boots with `bodyParser: false` (better-auth mounting) — FileInterceptor/multer is unaffected.
- **Generated client (NFR6/D8)**: `*ApiService` classes by tag (memory `sdk-service-classes-and-example-repo`); DTO decoration IS the client type — design responses for generation quality (`.claude/rules/nestjs-apis.md` DTO section).
- **4.3 auto-fit composes with import**: after an import, a bare `/dashboard`/`/transactions` lands on the imported data's latest month automatically — no extra work here, but it makes the 5.2/5.3 payoff immediate.

### Reference patterns (ED1 — study, adapt, never copy/import)

- `example/tracker-backend-api/src/modules/transactions/transaction-import.service.ts` — extension dispatch, CSV `columns: true` parsing, required-header list, row-error message style (`Row N: …`), category-resolution flow. Supertool diverges: preview mode, import-key dedup, near-duplicate report, collect-all errors (**no reference counterpart — new ground**), and validation delegates to the 2.1 seed helpers instead of bespoke `validateRow` logic.
- `example/tracker-backend-api/src/modules/transactions/transactions.controller.ts` — `@Post('import')` decorator stack (FileInterceptor size limit, `@ApiConsumes`, manual binary `@ApiBody`, missing-file 400).
- `example/tracker-backend-api/src/modules/transactions/dtos/import-transaction-response.dto.ts` — report DTO shape precedent (counts + string-array details); supertool renames fields to its `List`-suffix and seed-report vocabulary.
- Backend module layout counterpart: `apps/api/src/modules/transactions/` already mirrors the reference's module shape — the new service/DTOs slot beside existing files, no structural novelty.

### Conventions to honor (hard rules + memories)

- **D1**: amounts are strings end-to-end; `decimal.js` (already a dependency, 10.6.0) is the only arithmetic; a `number`-typed amount or `Number(csvValue)` is a defect.
- **D7**: controller → service → repository; `seedTransactions` is reached only through `TransactionsRepository.runImport`.
- **NFR6/D8**: regenerate + commit the client; hand-written `fetch` anywhere is a defect (relevant to 5.2, but the drift gate lands here).
- **NestJS DI**: explicit `@Inject(...)` on every constructor param; never `import type` an injectable (memory `nest-di-explicit-inject`). The `FindTransactionsQueryDto` runtime-import oxlint carve-out in the controller shows the pattern for pipe-consumed DTOs.
- **JS/TS rules**: named exports, no barrels/re-exports, no comments, arrow functions, `check`/`parse`/`convert`/`build` prefixes, `list`-suffixed arrays, UPPER_SNAKE_CASE constants, no magic numbers, no `as` (except `as const`; `as unknown as X` only in spec doubles), interfaces over types, no TS enums.
- **i18n (FR19/FR20)**: this story adds **no user-facing strings** (API error `message`s are developer-facing; the frontend maps by `code` — process patterns, architecture.md). `pnpm i18n:parity` still runs as a gate; expect no diff.
- **Tests**: co-located `*.spec.ts`; Testcontainers under `apps/api/test/integration/`; run via pnpm scripts only (memory `run-tests-via-pnpm-scripts`).
- **Branch**: `TOOLS-5-1/transaction-import-endpoint` off `main`; conventional commits; PR via `create-pr` skill (memory `story-work-via-pr`).

### Out of scope (explicit guardrails)

- **No frontend/UI work** — upload page, drag-drop, preview UI, error localization, and the sidebar Import placeholder flip are Story 5.2 (retro action #3 assigns the flip to 5.2). No onboarding routing (5.3). No new analytics endpoints (5.4).
- No `date` → `timestamptz` migration (RP-D5 truncation is the accepted decision; `tech-debt-transaction-date-to-timestamptz.md` tracks the future option). No recurring/export/search/bulk-delete surface (Epic 6). No Redis/caching (6.5), no throttling on import (RP-B4 deferred), no audit log.
- No redesign of the seed engine's category-name resolution or near-duplicate normalization; no changes to `runSeed` boot threading, `load-seed-data.ts`, or the seed JSON.
- No new error codes, no RFC-7807 switch (gap-backlog decision: keep the supertool envelope).

### Project Structure Notes

- New service/DTOs live inside the existing `modules/transactions/` (reference keeps import in the same module; a separate module would break the one-module-per-route convention). Shared constants go to `packages/shared/src/constants/` (per-file subpath imports — the package exports `./*` from `dist`). Integration spec joins the existing seven in `apps/api/test/integration/`. No structural conflicts detected.
- `packages/shared` gains no runtime deps (patterns + numeric constants only) — only dev-side vitest infra (D-J); `csv-parse` lands in `apps/api` only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — story statement + 5 BDD AC blocks (multipart CSV/JSON, preview, D2 idempotency, error envelope, Testcontainers + drift gate)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — epic charter: reuse seed ingest, D1/D7/NFR6/FR19-20/NFR1 binding, RP-D5 truncation accepted, single-default-currency (RP-D1), evidence-reference convention
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-07-04.md#Action Items] — item 2: regex lift folded into 5-1 (mandatory); D3 spec-time divergence sign-off; CategoryPicker 2-level note (import creates exactly 2 levels — compatible)
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-B1/RP-F2 (P0), §5 reference defects (bare import page, fail-fast), RP-D5 date-type decision
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — D1 (money strings + decimal.js), D2 (import_key = SHA-256 + index, ON CONFLICT DO NOTHING, near-duplicates surfaced), D3 (class-validator + swagger CLI plugin), D7 (envelope, layering), D8 (drift gate), D10 (Vitest + Testcontainers priority targets)
- [Source: apps/api/src/database/seeds/*] — the ingest engine this story reuses (`seedTransactions`, `buildImportKey`, `parseSeedDate`, `convertAmountToString`, `deriveCategoryHierarchy`, `findNearDuplicateCategories`, `seed.types.ts`)
- [Source: apps/api/src/database/schemas/transactions.ts] — global `transactions_import_key_unique` index (migrated to composite here)
- [Source: apps/api/src/modules/transactions/{transactions.controller.ts,transactions.service.ts,transactions.repository.ts}] — controller/auth/error/DI patterns to extend
- [Source: apps/api/src/shared/constants/transaction-validation.ts + apps/money-tracker/src/app/[locale]/transactions/{constants/transaction-form-schema.ts,utils/format-transaction-date.ts,utils/check-is-calendar-date.ts}] — the duplicated regex sites the lift consolidates
- [Source: apps/api/src/main.ts + src/app/configure-app-routing.ts] — `bodyParser: false` bootstrap, global prefix/versioning/ValidationPipe
- [Source: apps/api/test/integration/{transactions,seed}.integration.spec.ts + test/helpers/postgres-container.ts] — Testcontainers bootstrap to mirror
- [Source: packages/shared/src/constants/{currency.ts,error-codes.ts}] — `CURRENCY_CODE_LIST`/`checkIsCurrencyCode`, `ErrorCode.ValidationError`
- [Source: example/tracker-backend-api/src/modules/transactions/…] — reference patterns (see Reference patterns subsection; ED1)
- [Source: .claude/rules/{nestjs-apis.md,javascript.md,typescript.md}] — DI, DTO/OpenAPI, naming, no-comments conventions

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5), autonomous dev-story run 2026-07-04.

### Debug Log References

- TS 6.0 no longer auto-includes `node_modules/@types`, so `Express.Multer.File` was unresolvable (`Namespace 'global.Express' has no exported member 'Multer'`). Verified via `tsc --explainFiles` (no implicit type libraries in the program). Fixed with `"types": ["multer"]` in `apps/api/tsconfig.json`; the reference's `import type {} from 'multer'` trick is banned by oxlint (`import/no-empty-named-blocks`, `unicorn/require-module-specifiers`).
- Local-only Testcontainers hang (pre-existing, reproduced on untouched `users-profile.integration.spec.ts`): image-exists check misses under Docker Desktop's containerd image store, the resulting pull executes `docker-credential-desktop`, which blocks on keychain access in this non-interactive environment. Ran all test gates with `DOCKER_CONFIG` pointed at a scratch config without a credential helper (no repo change; CI unaffected).
- One transient full-parallel run had 7 undici socket-parse failures in a single API integration file; `apps/api` alone and the full `pnpm test --force` re-run are green (220/220 API tests, 8/8 turbo tasks) — flaky parallel-load artifact, not reproducible.
- Integration-spec SQL `ORDER BY amount` initially sorted the `::text` alias lexically; fixed by table-qualifying (`ORDER BY t.date, t.amount`). Cyrillic category-name ordering made collation-dependent assertions brittle; replaced with Set equality.

### Completion Notes List

- Both endpoints live on the existing transactions controller ahead of the `:id` routes; method names `import`/`importPreview` yield operationIds `transactionsImport`/`transactionsImportPreview` (verified in emitted `openapi.json`); generated SDK multipart body is `{ file: Blob | File }` — ready for 5.2.
- Execute path is `controller → TransactionsImportService (parse/validate) → TransactionsRepository.runImport → db.transaction(seedTransactions)` — the 2.1 seed engine is the only write path, run atomically (D7/D2/D1 intact). Repository injects nestjs-pino `PinoLogger` and passes its underlying pino instance to `seedTransactions` (mirrors `runSeed`).
- Validation is all-up-front, collect-all: 1-based `"Row N: …"` strings capped at `IMPORT_MAX_REPORTED_ROW_ERRORS = 50`, single 400 `VALIDATION_ERROR` envelope with `details.rowErrorList`; `Type` validated case-insensitively and canonicalized to exact `'Expense'`/`'Income'` (case-variant tests pin income persistence); amounts flow `convertAmountToString` (Decimal) → `POSITIVE_AMOUNT_PATTERN` (rejects zero/negative/`'NaN'`), never `Number()`.
- Composite `(user_id, import_key)` unique index migration `0004_polite_tana_nile.sql` (D-D); both `onConflictDoNothing` targets updated; seed re-run idempotency re-verified by `seed.integration.spec.ts`; two-user full-copy scoping asserted in the new integration suite.
- Regex lift (AC 5) done: shared source + relocated spec in `packages/shared/src/constants/`, API copy deleted, all 7 API import sites re-pointed, frontend duplicates deduped (`check-is-calendar-date.ts` + its test deleted; coverage lives in the shared spec). `packages/shared` gained minimal vitest 4.1.8 infra (D-J); its `build` now uses a `tsconfig.build.json` that excludes specs so they never ship in `dist` (type-check still covers them).
- Decisions beyond the story file: (1) `"types": ["multer"]` instead of the empty-import trick (see Debug Log — lint-banned); (2) added `PayloadTooLarge: 413` to shared `HTTP_STATUS_CODE` (spec assertion needs the named constant; 5.2's error mapping will need it — memory `shared-constants-no-duplication`); (3) the 413 envelope's `code` stays the filter's fallback (`INTERNAL_ERROR`) — only the 413 status is the documented contract per the story; no new error code added; (4) preview's `childCategoriesToCreateList` is deduped by name, matching the engine's name-only keying caveat; (5) 5.2's client-side max-file-size check should read `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES` + `HTTP_STATUS_CODE.PayloadTooLarge` from shared.
- Gates (all via pnpm scripts, turbo with `--force`): type-check PASS (9/9), lint PASS (oxlint + 8/8), stylelint PASS, fmt:check PASS, test PASS (8/8 tasks; API 220/220 incl. new unit + controller + 10-test Testcontainers import suite), build PASS (4/4), i18n:parity PASS (no user-facing strings added — API error messages are developer-facing, frontend maps by `code`), client drift gate green (client regenerated + committed; `openapi.json` is gitignored, CI re-emits it).
- No UI surface touched → visual QA N/A for this story (epic's per-story mobile-QA check rides on 5.2, which renders this contract).
- Review-fix pass (2026-07-04, autonomous): applied ONLY the two must-fix patches from Review Findings — (1) `parseRowDate` now validates `parseSeedDate`'s ISO output with the shared `checkIsCalendarDate` (impossible dates → 1-based `"Row N"` 400 instead of a 500 inside `db.transaction`); (2) BOM tolerance via `bom: true` on csv-parse and a `LEADING_BOM_PATTERN` (`/^\uFEFF/u`) strip before `JSON.parse`. Five service-spec tests added (3 impossible-date rows, BOM'd CSV + BOM'd JSON success fixtures) — API suite 225/225. Advisory/deferred items untouched. No API-surface change: `openapi.json`/generated client byte-identical (drift zero, nothing to regenerate). Decision: `parseSeedDate` left as-is per the finding's prescribed fix — the calendar round-trip lives at the HTTP boundary (`parseRowDate`); the seed path's input is repo-committed JSON already covered by the boot-seed integration suite. Gates re-run with `--force` (all PASS): fmt:check, lint (oxlint + 8/8), stylelint, type-check (9/9), test (8/8 tasks, API 225/225), build (4/4), i18n:parity. Testcontainers again needed the scratch `DOCKER_CONFIG` workaround (no repo change).

### File List

New:
- packages/shared/src/constants/transaction-validation.ts
- packages/shared/src/constants/transaction-validation.spec.ts (relocated from apps/api/src/shared/constants/)
- packages/shared/src/constants/transaction-import.ts
- packages/shared/vitest.config.ts
- packages/shared/tsconfig.build.json
- apps/api/src/modules/transactions/transactions-import.service.ts
- apps/api/src/modules/transactions/transactions-import.service.spec.ts
- apps/api/src/modules/transactions/dtos/near-duplicate-cluster.dto.ts
- apps/api/src/modules/transactions/dtos/transaction-import-response.dto.ts
- apps/api/src/modules/transactions/dtos/transaction-import-preview-response.dto.ts
- apps/api/src/database/migrations/0004_polite_tana_nile.sql (+ meta journal/snapshot)
- apps/api/test/integration/transaction-import.integration.spec.ts

Deleted:
- apps/api/src/shared/constants/transaction-validation.ts
- apps/api/src/shared/constants/transaction-validation.spec.ts (moved to packages/shared)
- apps/money-tracker/src/app/[locale]/transactions/utils/check-is-calendar-date.ts
- apps/money-tracker/src/app/[locale]/transactions/utils/check-is-calendar-date.test.ts

Modified:
- packages/shared/package.json
- packages/shared/src/constants/http-status-code.ts
- packages/shared/src/generated/index.ts
- packages/shared/src/generated/sdk.gen.ts
- packages/shared/src/generated/types.gen.ts
- apps/api/package.json
- apps/api/tsconfig.json
- apps/api/src/database/schemas/transactions.ts
- apps/api/src/database/seeds/seed-transactions.ts
- apps/api/src/database/seeds/convert-amount.ts
- apps/api/src/database/seeds/convert-amount.spec.ts
- apps/api/src/database/seeds/seed.types.ts
- apps/api/src/modules/transactions/transactions.controller.ts
- apps/api/src/modules/transactions/transactions.controller.spec.ts
- apps/api/src/modules/transactions/transactions.repository.ts
- apps/api/src/modules/transactions/transactions.module.ts
- apps/api/src/modules/transactions/dtos/create-transaction.dto.ts
- apps/api/src/modules/transactions/dtos/update-transaction.dto.ts
- apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts
- apps/api/src/modules/analytics/dtos/find-summary-query.dto.ts
- apps/api/src/modules/analytics/dtos/find-trend-query.dto.ts
- apps/api/src/modules/analytics/dtos/find-breakdown-query.dto.ts
- apps/api/src/shared/validators/is-calendar-date.decorator.ts
- apps/api/test/integration/transactions.integration.spec.ts
- apps/money-tracker/src/app/[locale]/transactions/constants/transaction-form-schema.ts
- apps/money-tracker/src/app/[locale]/transactions/utils/format-transaction-date.ts
- pnpm-lock.yaml
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

| Date | Change |
|---|---|
| 2026-07-04 | Story created (autonomous run — decisions D-A…D-J recorded in Dev Notes) — ready-for-dev. |
| 2026-07-04 | Fresh-context validation pass applied: fixed the `normalizeTransactionType` case-sensitivity trap (canonicalize `Type` before use, case-variant test pinned), added spec-file disposition for the regex lift (D-J: `packages/shared` gains vitest infra, specs relocated not lost), pinned operationId-from-method-name derivation (`import`/`importPreview`), per-row `Decimal` throw handling for amounts, 413 oversize-upload contract, 1-based row errors, `csv-parse/sync` entrypoint, and the preview/execute name-only category-count caveat. |
| 2026-07-04 | Review-fix pass: resolved both must-fix findings (calendar-date round-trip via shared `checkIsCalendarDate` in `parseRowDate`; BOM tolerance in CSV + JSON parsing) with 5 new service-spec tests; all gates re-run `--force` PASS; status → review. |
| 2026-07-04 | Implemented: regex lift into `@supertool/shared` (+ vitest infra, frontend dedupe), shared import limits, composite `(user_id, import_key)` migration, `TransactionsImportService` (JSON/CSV parse, collect-all row validation), repository `runImport`/preview readers, `POST /transactions/import` + `/import/preview` endpoints + DTOs, client regenerated, unit + controller + Testcontainers integration tests. All gates green (`--force`). Status → review. |
| 2026-07-04 | Adversarial code review (Blind Hunter / Edge Case Hunter / Acceptance Auditor; gates + drift re-verified green): all 6 ACs and hard rules confirmed, but 2 must-fix patches recorded (impossible calendar dates 500 instead of 400 row error; BOM-prefixed CSV/JSON rejected with misleading errors), 8 advisories deferred to deferred-work.md, 2 review decisions resolved autonomously, 10 dismissed. Status → in-progress pending the two patches. |
