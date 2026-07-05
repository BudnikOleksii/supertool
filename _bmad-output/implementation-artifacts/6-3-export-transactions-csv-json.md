---
baseline_commit: 4cfe68aab6db98755686dffb2ae1d7bd1518b072
---

# Story 6.3: Export Transactions (CSV / JSON)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to export my transactions as a CSV or JSON file — honoring the filters/period I'm currently viewing, on both the transactions list and the by-category detail,
so that I can take my own money data out of the tool (and re-import it), exceeding the reference's export (RP-F7).

## Context & Why This Story

This is the **third story of Epic 6 (Manage Transactions at Scale)** and the **inverse of the 5.1/5.2 import feature**: import brings a file in; export writes the current view out. It closes RP-F7 (frontend export) + RP-B6 (backend export endpoint) and picks up the reference's `ExportTransactionButton`, deferred **by name** to this story in Story 5-6 D-8 and Epic 5 retro **Action #4** ("Add the reference's export button to the by-category detail in Story 6-3").

**Critical scoping fact — no export endpoint exists on `main`.** A code audit of `apps/api/src/modules/transactions/transactions.controller.ts` confirms the transactions controller exposes `findAll`, `create`, `import`, `import/preview`, `bulk-delete`, `findOne`, `update`, `remove` — **no export/download route**. The generated client (`packages/shared/src/generated/sdk.gen.ts`) has no `transactionsExport`. This story is therefore **backend + frontend**: it adds one new endpoint (controller → service → repository, D7), regenerates and commits the generated client (drift gate green), then builds the two-surface export UI on top of it — mirroring the contract-first shape of 5-1→5-2 and 6-2.

**The two surfaces the export button must cover (RP-F7 "from the transactions list" + Epic 5 retro Action #4 "by-category detail"):**
1. **By-date list** (`transactions/page.tsx` header `styles.controls`, beside `MonthNavigator` + "Add transaction"). Export honors the **current** list filters/period from the URL search params: `type`, `categoryId` (subtree-aware), `sortBy`, `sortOrder`, and the period (→ `dateFrom`/`dateTo`).
2. **By-category detail** (`transactions/by-category/[categoryId]/page.tsx` header, beside `MonthNavigator`). Export honors that page's `categoryId` (subtree-aware, reusing the list query) + period (`dateFrom`/`dateTo`) — the reference detail page carries exactly this button (5-6 D-8).

**The parity bar is exceed, don't replicate.** The reference (`example/tracker-backend-api` + `example/track-my-life`) exports Date as a `MM/DD/YYYY HH:mm:ss` UTC **timestamp**, Amount as a **`parseFloat` number**, and only honors `dateFrom`/`dateTo`/`categoryId` (drops `type`/`sortBy`). supertool must instead obey its own hard rules — **string amounts (D1)**, **bare `YYYY-MM-DD` dates (RP-D5)** — honor the **full** list filter set (adds `type` + `sortBy`/`sortOrder`), and (unlike the reference, whose backend had no idempotent import) produce a file that **round-trips back through the 5.1 import** (RP-F2). Where supertool's hard rules force a divergence from the reference, it is flagged with a `D-x` and rationale (Epic 5 retro D2).

**Evidence base (binding, per the Epic 4+ evidence-reference convention):**
- Reference captures: the reference's transactions list + by-category detail carry the export button — baseline against `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--list--{desktop,mobile}.png` and `transactions--category-detail*` for the header/toolbar the button attaches to (no dedicated export-button capture exists — the button is a small toolbar addition, net-new surface). supertool baseline: `…/supertool/transactions--list--{desktop,mobile}.png`.
- Reference code to adapt from (ED1 — study, never copy/import):
  - Backend endpoint: `example/tracker-backend-api/src/modules/transactions/transactions.controller.ts` `exportTransactions` (`@Get('export')`, `@Res({ passthrough: true })`, `StreamableFile`, Content-Type/Content-Disposition header set); `transactions.service.ts` `exportTransactions` + `toExportRow`; `transactions.repository.ts` `findAllForExport` + `MAX_EXPORT_ROWS = 10_000`; DTO `dtos/export-transaction-query.dto.ts` (`format` `@IsIn(['json','csv'])` + `enumName`, `dateFrom`/`dateTo`/`categoryId`).
  - Frontend: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/export-transaction-button/ExportTransactionButton.tsx` (DropdownMenu CSV/JSON, `isLoading` state) + `download-blob.ts` (object-URL anchor download, filename parsed from `Content-Disposition`); placement in `…/transactions/page.tsx` and `…/transactions/by-category/[categoryId]/page.tsx`.
  - Reference client-consumption: `example/track-my-life/packages/shared/src/api/services/transaction-api.service.ts` `exportTransactionList` → the shared client's **bespoke `requestBlob`** (bypasses the hey-api SDK; uses generated types only). supertool does NOT copy this — see D-2 (supertool's hey-api client supports `parseAs` natively).
- epics.md Story 6.3 + Epic 6 charter; `epic-5-retro-2026-07-05.md` (Actions #4, #5, #6, and the date-validation note); Story 5-1 import contract (`5-1-transaction-import-endpoint.md`) — the round-trip target; Story 6-2 (`6-2-bulk-delete-transactions.md`) — the contract-first backend+frontend precedent.

## Recommended Approach (binding direction)

### 1. Backend — new export endpoint (contract lands first)

Add to the **existing** transactions module (controller/service/repository already registered in `transactions.module.ts` — no new provider):

- **Repository** `transactions.repository.ts` — new `findAllForExport(userId, filters): Promise<{ rowList: TransactionResponseDto[]; isTruncated: boolean }>`. **Reuse the existing list machinery** — do NOT write a second query: build the WHERE with the existing `buildScopedConditions(userId, query, categoryIdList)` (subtree expansion via the existing `getCategorySubtreeIds` when `categoryId` is set) and ORDER with the existing `buildOrderBy(sortBy, sortOrder)`, off `selectJoinedTransactions()`, but **no pagination** — apply `.limit(MAX_EXPORT_ROWS + 1)` and set `isTruncated = rows.length > MAX_EXPORT_ROWS` (slice back to the cap). This is the export analogue of `findAllByUserId`; it must share `buildScopedConditions`/`buildOrderBy`/`selectJoinedTransactions`/`mapRowToResponse` so scoping and joins can never drift from the list.
- **Serializers (pure, unit-tested, no new dependency)** in a new module (e.g. `apps/api/src/modules/transactions/export/`):
  - `convert-transaction-to-export-row.ts` → `convertTransactionToExportRow(row: TransactionResponseDto): TransactionExportRow` producing the **stable, import-shaped** field set (see the format decision below). Category/Subcategory derived from `categoryName`/`categoryParentName` (parent null → top-level: `Category = categoryName`, `Subcategory = ''`; parent set → `Category = categoryParentName`, `Subcategory = categoryName`) — mirrors import's two-level derivation. `Type` mapped lowercase→canonical (`expense`→`Expense`, `income`→`Income`). `Amount` = `row.amount` **verbatim** (the stored `numeric(14,2)::text` string — never `parseFloat`/`Number`/`Intl`; D1). `Date` = `row.date` **verbatim** (bare `YYYY-MM-DD`; RP-D5). `Note` = `row.note`.
  - `format-transactions-as-csv.ts` → `formatTransactionsAsCsv(rowList): string` — **hand-rolled RFC-4180 serializer** (D-3, no csv library): a fixed header row + one record per transaction; a shared `escapeCsvField` helper (see AC 3 for the exact escaping + injection rules); `\r\n` line terminators; a leading UTF-8 BOM (`﻿`) prepended once.
  - `format-transactions-as-json.ts` → `formatTransactionsAsJson(rowList): string` — `JSON.stringify(rowList)` over the same `TransactionExportRow[]` (compact array; string amounts stay quoted strings; no BOM).
  - `build-export-filename.ts` → `buildExportFilename(format, filters): string` — `transactions-<YYYY-MM-DD>.<ext>` using the server's current date; when a period/date range is active use `transactions-<dateFrom>_<dateTo>.<ext>` (record the convention; the frontend does NOT recompute it — it reads `Content-Disposition`, D-2).
- **Service** `transactions.service.ts` — new `exportTransactions({ userId, format, filters }): Promise<TransactionExportResult>` where `TransactionExportResult = { content: string; contentType: string; filename: string; isTruncated: boolean }`. Calls the repository, maps rows via `convertTransactionToExportRow`, dispatches on `format` to the CSV/JSON serializer, computes `contentType` (`text/csv; charset=utf-8` | `application/json; charset=utf-8`) and `filename`. No DB access here (D7).
- **Controller** `transactions.controller.ts` — new handler (declare it as a distinct GET path; no collision with `@Get()`/`@Get(':id')` — literal static segments win over `:id` in Nest routing, but place it **above** `@Get(':id')` to be explicit, exactly as `import`/`bulk-delete` are placed above the param routes):
  ```ts
  @Get('export')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiProduces('text/csv', 'application/json')
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async export(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ExportTransactionsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const result = await this.transactionsService.exportTransactions({
      userId: session.user.id,
      format: query.format,
      filters: query,
    });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    if (result.isTruncated) {
      res.setHeader(EXPORT_TRUNCATED_HEADER, 'true');
    }
    return result.content;
  }
  ```
  `@Res({ passthrough: true })` sets headers manually while letting Nest send the returned body and the global exception filter still shape errors (reference pattern). `Response` is `express`'s type — import `import type { Response } from 'express'`. Buffered, not streamed (D-4). Carry the reference's truncation signal as a response header `X-Result-Truncated` (`EXPORT_TRUNCATED_HEADER` constant) when the cap is hit.
- **DTO** `apps/api/src/modules/transactions/dtos/export-transactions-query.dto.ts` — `ExportTransactionsQueryDto` carrying the **same filter fields as the list** (`dateFrom`, `dateTo`, `type`, `categoryId`, `sortBy`, `sortOrder` — same validators/`enum`/`enumName` as `FindTransactionsQueryDto`) **plus** a required `format`:
  - `format`: `@IsIn(TRANSACTION_EXPORT_FORMAT_LIST)`, `@ApiProperty({ enum: TRANSACTION_EXPORT_FORMAT_LIST, enumName: OPENAPI_ENUM_NAME.transactionExportFormat })`, defaulting to `csv` (`@IsOptional` + a service-side default, OR required — decide required with an explicit `csv` fallback; record).
  - **Avoid duplicating the six filter validators** (repo no-duplication rule): extract a base `TransactionFilterQueryDto` (the six filter fields) and compose — `FindTransactionsQueryDto extends IntersectionType(TransactionFilterQueryDto, PaginationQueryDto)` (from `@nestjs/swagger`) and `ExportTransactionsQueryDto extends TransactionFilterQueryDto` (adds `format`). **After the refactor, regenerate the client and verify the `transactionsFindAll` operation's generated types are byte-identical** (the drift must only ADD the export op). If `IntersectionType` churns the find op's generated types, fall back to a standalone `ExportTransactionsQueryDto` with the validators duplicated (documented) — do NOT ship a change that alters the shipped list contract.
- **Shared constants** (memory `shared-constants-no-duplication`): new `packages/shared/src/constants/transaction-export.ts` — `TRANSACTION_EXPORT_FORMAT = { csv: 'csv', json: 'json' } as const`, `TRANSACTION_EXPORT_FORMAT_LIST = Object.values(...)`, `TransactionExportFormat = ObjectValuesUnion<typeof TRANSACTION_EXPORT_FORMAT>`, and `MAX_EXPORT_ROWS = 10_000` (reference parity; the 1,880-row seed fits far under). Add `transactionExportFormat: 'TransactionExportFormat'` to `OPENAPI_ENUM_NAME` (`apps/api/src/shared/constants/openapi-enum-name.ts`) so the generated client emits one named `TransactionExportFormat` type shared by the DTO and the frontend menu. `EXPORT_TRUNCATED_HEADER = 'X-Result-Truncated'` may live in the same shared file (frontend surfaces the truncation notice).
- **Regenerate + commit the client**: `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`) → `pnpm --filter @supertool/shared generate:client`. Drift gate green. New method `TransactionsApiService.transactionsExport` appears; confirm its response type accommodates a text/binary body (see D-2) and the `TransactionExportFormat` named enum is emitted.

### 2. Frontend — export button/menu (build once, wire on both views)

- **Client-consumption (D-2 — the load-bearing decision, NFR6):** the download goes through the **generated client** via a `'use server'` export action using the established `createServerApiClient` (cookie-forwarded) call site — the app's ONLY proven generated-client call site (`createBrowserApiClient` exists but is **currently unused** in the app). The action calls `TransactionsApiService.transactionsExport({ client, query, parseAs: 'text' })` (the hey-api client natively supports `parseAs`/`responseStyle` — verified in `packages/shared/src/generated/client/client.gen.ts` lines 114-169: `parseAs: 'text' | 'blob'` returns the raw body, no `JSON.parse` of CSV), reads the `Content-Disposition` filename + content-type off `response.headers`, and returns `{ status: 'success', fileName, mimeType, content }` or `{ status: 'error', code }`. A small `'use client'` `ExportMenu` (the `dropdown-menu` molecule) invokes the action inside a `useTransition`, then a pure `download-blob.ts` util (`new Blob([content], { type: mimeType })` → `URL.createObjectURL` → `<a download>` click → `revokeObjectURL`) triggers the browser download. **A hand-written `fetch('/api/…')` or a raw `<a href="/api/v1/transactions/export">` is a defect** — the anchor-href approach bypasses the generated client (NFR6) and cannot cleanly carry the query/session through the proxy; the server-action-through-generated-client path is the sanctioned one. (Sanctioned alternative, flagged for operator confirmation: a client-side `createBrowserApiClient` + `parseAs: 'blob'` call matching the reference's client-side download — also NFR6-compliant, closer to the reference, but introduces the app's first browser-side generated-client usage with no in-app test/baseURL/cookie precedent; primary path chosen for provenance + testability. See D-2.)
- **`ExportMenu`** (`FC<Props>`, presentational + a co-located hook): a `DropdownMenu` (molecule) triggered by a `Button` (variant `outline`) labeled "Export", with a `Download` icon, offering two items — "Export as CSV" / "Export as JSON" (iterate `TRANSACTION_EXPORT_FORMAT_LIST`). Disabled/`isLoading` (spinner or disabled) while the transition is pending. On error → an inline localized `Alert` (the app does not mount a `Toaster`/sonner — 6-2 established inline `Alert` for feedback; do NOT add a toaster). Props: the current filter set (`type?`, `categoryId?`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`) so it exports **the current view**; on the by-category detail only `categoryId` + `dateFrom`/`dateTo` are passed. Keep it route-agnostic (props in, callbacks out) so both surfaces reuse the same component.
- **Export action** `src/actions/export-transactions.ts` (`'use server'`): accepts the typed filter+format params, `createServerApiClient({ cookieHeader: (await cookies()).toString() })`, calls `transactionsExport`, maps a non-2xx to a route-local error union (`{ status:'error', code }` keyed by `ErrorCode` for i18n mapping, `UNKNOWN` fallback — `create-transaction.ts` / `preview-transaction-import.ts` precedent), wraps the invocation in a rejection guard (`.catch` → `UNKNOWN`) like 5-2's MUST-FIX. No `revalidatePath` (export is a read, mutates nothing). Route-local discriminated union in a co-located `types.ts` (D-C precedent from 5-2 — do not widen the shared `ActionState`).

### 3. Wire onto both surfaces

- **By-date list** (`transactions/page.tsx`): render `<ExportMenu>` in the header `styles.controls` beside `MonthNavigator`/"Add transaction", passing the parsed `params` (type, categoryId, sortBy, sortOrder) + the period's `dateFrom`/`dateTo` (derive from `params.period` via the existing `getMonthDateRange(parsePeriod(period))` used by the detail page). The menu is a client island; the page stays RSC.
- **By-category detail** (`transactions/by-category/[categoryId]/page.tsx`): render `<ExportMenu>` in the header beside `MonthNavigator`, passing `categoryId` + the already-computed `dateFrom`/`dateTo`. This is the reference's `ExportTransactionButton` on the detail (5-6 D-8, Epic 5 retro Action #4).

### 4. Round-trip with import (RP-F2, "where sensible")

The exported file is **import-shaped** so it re-imports through the 5.1 contract. The only mismatch is the date wire-format: export emits bare `YYYY-MM-DD` (RP-D5 hard rule) while `parseSeedDate` (`apps/api/src/database/seeds/parse-seed-date.ts`) accepts the seed dataset's `MM/DD/YYYY[ HH:mm:ss]`. **Verify `parseSeedDate` first**: if it does not already accept ISO `YYYY-MM-DD`, widen it **minimally and additively** to also accept ISO dates (keep the existing MM/DD/YYYY path and the time-truncation behaviour; decimal-safe; the seed's repo-committed JSON is unaffected) so the export round-trips. This is the smallest change that closes the loop and reuses the ingest engine per repo convention (D-5). If the operator prefers export-only, this widening is the single deferrable piece — record it, and the round-trip AC then narrows to "the file is import-shaped" (see D-5). `Note` does not round-trip (import's row schema has no note field — imported rows get empty notes, 5-1); that is expected and documented, not a defect.

## Acceptance Criteria

1. **Export endpoint honors the current view, user-scoped, string amounts, bare dates (RP-F7/RP-B6, FR21, D1, RP-D5).** Given the transactions module, when `GET /api/v1/transactions/export?format=csv|json` is called by an authenticated user with any subset of the list filters (`dateFrom`, `dateTo`, `type`, `categoryId` [subtree-aware], `sortBy`, `sortOrder`), then it returns **all** matching transactions **scoped to that user** (repository `eq(userId)` — no cross-user rows), in the requested sort order, **without pagination** (up to `MAX_EXPORT_ROWS`), with amounts emitted as the **exact stored strings** (no `parseFloat`/`Number`/`Intl`/float math — D1) and dates as **bare `YYYY-MM-DD`** (RP-D5). The endpoint reuses the list query's `buildScopedConditions`/`buildOrderBy`/`getCategorySubtreeIds`/`selectJoinedTransactions` (no forked query) and touches the DB only through the repository (D7).
2. **File response: correct content-type, attachment, filename (download contract).** Given a successful export, then the response sets `Content-Type: text/csv; charset=utf-8` (CSV) or `application/json; charset=utf-8` (JSON) and `Content-Disposition: attachment; filename="transactions-…​.<ext>"` (filename convention: `transactions-<YYYY-MM-DD>.<ext>`, or `transactions-<dateFrom>_<dateTo>.<ext>` when a period is active); when the row count exceeds `MAX_EXPORT_ROWS` the response is capped and sets `X-Result-Truncated: true`. `format` is validated (`csv`/`json` only) via the shared `TRANSACTION_EXPORT_FORMAT_LIST`; an invalid `format` returns 400 `VALIDATION_ERROR` (shared envelope). Asserted by an integration test (status, both content-types, disposition filename, cap/truncation header).
3. **CSV correctness — RFC 4180 + injection-safe, hand-rolled (no CSV dependency).** Given the CSV serializer, then it emits a header row followed by one record per transaction with a **stable column order** `Date,Category,Subcategory,Type,Amount,Currency,Note`, UTF-8 with a leading BOM (`﻿`), `\r\n` line terminators, and per-field escaping that: (a) wraps a field in double quotes when it contains `"`, `,`, `\r`, or `\n`; (b) doubles embedded `"` as `""`; (c) **neutralizes CSV/formula injection** — a field whose first character is `=`, `+`, `-`, `@`, TAB (`\t`), or CR (`\r`) is prefixed with a single quote (`'`) before quoting (OWASP). Column values: `Type` canonical `Expense`/`Income`; `Category`/`Subcategory` derived from the two-level hierarchy (top-level → empty `Subcategory`); `Amount` the exact stored string (dot decimal, no grouping); `Date` bare `YYYY-MM-DD`. Unit tests cover every escaping/injection edge case (embedded quote/comma/newline/CR, leading `= + - @` and tab/CR, Cyrillic/Unicode names, empty note, amount like `1000000.00` staying `1000000.00`).
4. **JSON correctness.** Given the JSON serializer, then it emits a top-level array of objects with the **same field set and order** as the CSV columns (`Date`, `Category`, `Subcategory`, `Type`, `Amount`, `Currency`, `Note`), amounts as JSON **strings** (D1 — quoted, never numbers), no BOM, content-type `application/json; charset=utf-8`. Unit tests assert the shape and string amounts.
5. **Round-trips back through the 5.1 import (RP-F2).** Given an exported file (CSV and JSON), when it is fed to `POST /api/v1/transactions/import/preview` (integration test), then it validates with **zero row errors** and — because the rows already exist for the user — previews as all-duplicates (`duplicateRows === totalRows`, `newRows === 0`), proving the export is import-shaped and dedup-consistent. (`parseSeedDate` accepts the exported bare `YYYY-MM-DD`; if it did not, it was widened minimally/additively — D-5. `Note` is not asserted to round-trip — import has no note field.)
6. **Export control on BOTH surfaces (RP-F7 + Epic 5 retro Action #4).** Given the by-date transactions list AND the by-category detail view, then each shows an "Export" control (the `dropdown-menu` molecule) offering CSV and JSON; on the list it exports the **currently-applied** filters/sort/period, on the by-category detail it exports **that category** (subtree) + period; both go through the generated client (NFR6 — no hand-written fetch, no raw anchor-href to the API), and a file download is triggered client-side (Blob + object-URL anchor, filename from `Content-Disposition`).
7. **Errors localized by code — never raw API text.** Given an export failure (validation, transport, auth), then the headline resolves from i18n by `ErrorCode` with the `UNKNOWN` fallback (`ActionState`/`translateError` pattern); an unhandled action rejection is caught and mapped to `UNKNOWN` (5-2 MUST-FIX precedent); the control re-enables for retry. No raw API `message` is shown as the headline.
8. **Backend contract regenerated + committed (NFR6/D8).** Given the new endpoint + DTO + shared enum, when the API builds, then `openapi.json` includes `GET /api/v1/transactions/export` with `ExportTransactionsQueryDto` (the `format` typed via the named `TransactionExportFormat` enum, `enumName`), the generated client is regenerated into `packages/shared/src/generated/` and **committed**, the drift gate is green, and the **`transactionsFindAll` operation's generated types are unchanged** by the DTO refactor (only the export op is added). The frontend consumes the endpoint **only** through the generated client.
9. **Money & date rules preserved end-to-end (D1/RP-D5); single-default-currency (RP-D1).** Given export touches money, then every amount is the exact stored `numeric(14,2)` string with no coercion to `number` and no float arithmetic anywhere (serializers included), and dates stay bare `date` (`YYYY-MM-DD`, no timezone math — the reference's UTC-timestamp formatting is NOT carried). No currency picker/param is added (RP-D1 — each row carries its own stored `Currency`; there is no cross-currency aggregation, this is a plain row dump). The format/cap constants live once in `@supertool/shared` (read by the API DTO and the frontend).
10. **i18n parity (FR19/FR20).** All new user-facing strings — the "Export" trigger label, "Export as CSV"/"Export as JSON" menu items, the pending/loading label, the error messages (keyed by `ErrorCode` + `UNKNOWN`), and any truncation notice — land in `apps/money-tracker/messages/{en,uk}/` (in `transactions-page.json` and `transactions-by-category-page.json` as needed, or a small shared `export` sub-namespace) in the same commit — real Ukrainian, ICU interpolation only, no concatenation; `pnpm i18n:parity` green.
11. **Tests ship with the feature (NFR1).** Backend: pure unit specs for `formatTransactionsAsCsv` (every AC-3 escaping/injection case), `formatTransactionsAsJson` (AC-4 shape + string amounts), `convertTransactionToExportRow` (hierarchy/type/amount mapping), and `buildExportFilename`; a controller unit spec asserting `session.user.id` + query forward to the service and the header-setting via a mocked `Response`; Testcontainers integration (`apps/api/test/integration/`) asserting user-scoping (user A export excludes user B rows), filter honoring (type/category-subtree/date-range/sort), string-amount + bare-date fidelity, content-type/disposition/truncation, and the **round-trip through import/preview** (AC 5). Frontend: component tests for `ExportMenu` (CSV/JSON items, pending/disabled, error `Alert`), the `export-transactions` action (mocked `createServerApiClient` + SDK service + `next/headers` cookies; success returns content/filename, error/rejection → `UNKNOWN`, filename read from `Content-Disposition`), and the `download-blob` util (mock `URL.createObjectURL`/anchor). All repo gates green (`TURBO_FORCE=true` where turbo may replay stale logs).
12. **Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/6-3-export-transactions-csv-json/` contains captures named `<scenario>--<viewport>--<theme>.png` covering **light + dark × 390px + desktop** for: the transactions list header with the Export control, the export dropdown **menu open** (CSV/JSON items visible), and the by-category detail header with the Export control. Compared against reference `transactions--list--{desktop,mobile}` / `transactions--category-detail*` (the button is a net-new toolbar addition), with observations in the Dev Agent Record. Verify no horizontal overflow at 390px (`document.documentElement.scrollWidth === window.innerWidth`) with the menu open on both surfaces. Captured on `:3000` with the pre-QA environment checklist honored (verify `:3000` cwd is this checkout; DB baseline latest txn = 2025-02-03); export is read-only so it does not mutate the baseline, but if any round-trip re-import is exercised live, `TRUNCATE` + re-seed afterwards.

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — carry patterns, never code): backend `example/tracker-backend-api/src/modules/transactions/transactions.controller.ts` (`exportTransactions` — `@Res({ passthrough:true })`, header set, `StreamableFile`), `transactions.service.ts` (`exportTransactions`/`toExportRow`), `transactions.repository.ts` (`findAllForExport`, `MAX_EXPORT_ROWS`), `dtos/export-transaction-query.dto.ts`; frontend `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/export-transaction-button/{ExportTransactionButton.tsx,download-blob.ts}` and its placement in `…/transactions/page.tsx` + `…/by-category/[categoryId]/page.tsx`; client-consumption `example/track-my-life/packages/shared/src/api/services/transaction-api.service.ts` (`exportTransactionList` → `requestBlob`). Note the supertool divergences: string amounts (D-1), bare dates (D-1), full filter set incl. `type`/`sort` (D-6), hand-rolled CSV vs `csv-stringify` (D-3), buffered vs streamed (D-4), server-action-through-generated-client vs bespoke `requestBlob` (D-2), round-trip via 5.1 import (D-5).
  - [x] Read in full the files this story updates: `apps/api/src/modules/transactions/transactions.{controller,service,repository}.ts` + `transactions.controller.spec.ts` + `dtos/find-transactions-query.dto.ts` + `dtos/transaction-response.dto.ts`, `apps/api/src/shared/dtos/pagination-query.dto.ts`, `apps/api/src/shared/constants/openapi-enum-name.ts`, `apps/api/src/database/seeds/parse-seed-date.ts` (round-trip date-format check), `apps/api/test/integration/transactions.integration.spec.ts` (harness to extend); frontend `apps/money-tracker/src/app/[locale]/transactions/page.tsx` + `utils/parse-transactions-search-params.ts` + `utils/period.ts` (`getMonthDateRange`/`parsePeriod`), `…/by-category/[categoryId]/page.tsx`, `src/actions/{create-transaction.ts,preview-transaction-import.ts}` (server-action + generated-client + error-union patterns), `packages/ui/src/components/molecules/dropdown-menu/DropdownMenu.tsx`, `packages/shared/src/generated/{sdk.gen.ts,client/client.gen.ts}` (the `parseAs`/`responseStyle` support).
- [x] **Task 2 — Shared export constants + enum name** (AC: 1, 2, 8, 9)
  - [x] New `packages/shared/src/constants/transaction-export.ts`: `TRANSACTION_EXPORT_FORMAT` (as-const `{ csv, json }`), `TRANSACTION_EXPORT_FORMAT_LIST`, `TransactionExportFormat` (via `ObjectValuesUnion`), `MAX_EXPORT_ROWS = 10_000`, `EXPORT_TRUNCATED_HEADER = 'X-Result-Truncated'`. No magic numbers.
  - [x] Add `transactionExportFormat: 'TransactionExportFormat'` to `OPENAPI_ENUM_NAME`.
- [x] **Task 3 — Backend DTO (filter base + export query)** (AC: 1, 8)
  - [x] Extract `TransactionFilterQueryDto` (the six filter fields with their existing validators/`enum`/`enumName`) and refactor `FindTransactionsQueryDto` to `extends IntersectionType(TransactionFilterQueryDto, PaginationQueryDto)` (`@nestjs/swagger`). New `ExportTransactionsQueryDto extends TransactionFilterQueryDto` adds `format` (`@IsIn(TRANSACTION_EXPORT_FORMAT_LIST)` + `enumName`). **Regenerate + verify `transactionsFindAll` generated types unchanged**; if churned, fall back to a standalone `ExportTransactionsQueryDto` (documented duplication) and leave `FindTransactionsQueryDto` untouched.
- [x] **Task 4 — Backend serializers (pure, no new dep)** (AC: 1, 3, 4, 9)
  - [x] `apps/api/src/modules/transactions/export/convert-transaction-to-export-row.ts` (+ spec): hierarchy/type/amount/date mapping to `TransactionExportRow`.
  - [x] `…/export/format-transactions-as-csv.ts` (+ spec): hand-rolled RFC-4180 serializer with `escapeCsvField` (quote/double-quote/injection-neutralize per AC 3), `\r\n`, leading BOM.
  - [x] `…/export/format-transactions-as-json.ts` (+ spec): `JSON.stringify` array, string amounts.
  - [x] `…/export/build-export-filename.ts` (+ spec): filename convention (AC 2).
- [x] **Task 5 — Backend repository + service** (AC: 1, 2, 9)
  - [x] `findAllForExport(userId, filters)` in `transactions.repository.ts` reusing `buildScopedConditions`/`getCategorySubtreeIds`/`buildOrderBy`/`selectJoinedTransactions`/`mapRowToResponse`, no pagination, `.limit(MAX_EXPORT_ROWS + 1)` → `isTruncated`.
  - [x] `exportTransactions({ userId, format, filters })` in `transactions.service.ts` (map rows → serialize → contentType/filename/isTruncated). Explicit `@Inject` unchanged.
- [x] **Task 6 — Backend controller + regenerate client** (AC: 1, 2, 8)
  - [x] `@Get('export')` handler (AuthGuard, `@Res({ passthrough:true })`, `@ApiProduces`, `schema: { type:'string', format:'binary' }`, header set, truncation header) above `@Get(':id')`.
  - [x] `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`; commit the regenerated client; drift gate green; confirm `transactionsExport` + `TransactionExportFormat` in the SDK and the find op unchanged.
- [x] **Task 7 — Round-trip: verify/extend the import date parser** (AC: 5)
  - [x] Confirm `parseSeedDate` accepts the exported `YYYY-MM-DD`; if not, widen it minimally/additively (keep MM/DD/YYYY + time-truncation; decimal-safe) with unit tests. If the operator defers this (D-5), narrow AC 5 to "import-shaped" and log the deferral.
- [x] **Task 8 — Frontend export action + download util** (AC: 6, 7, 11)
  - [x] `src/actions/export-transactions.ts` (`'use server'`): `createServerApiClient({ cookieHeader })`, `TransactionsApiService.transactionsExport({ client, query, parseAs:'text' })`, read `Content-Disposition` filename + content-type from `response.headers`, return route-local union (`{ status:'success', fileName, mimeType, content }` | `{ status:'error', code }`); rejection guard `.catch` → `UNKNOWN`. Route-local types in a co-located `types.ts`.
  - [x] `…/export-transaction-button/download-blob.ts` (+ test): pure Blob + object-URL anchor download; filename param.
- [x] **Task 9 — Frontend ExportMenu + wire both surfaces** (AC: 6, 7, 10, 12)
  - [x] `ExportMenu` component (`FC<Props>`, `dropdown-menu` molecule, CSV/JSON items, `useTransition` pending, inline `Alert` on error) + co-located hook; props = current filters/format-agnostic; route-agnostic (props in / callbacks out).
  - [x] Wire into `transactions/page.tsx` header (pass `params` filters + period `dateFrom`/`dateTo` via `getMonthDateRange(parsePeriod(period))`) and `by-category/[categoryId]/page.tsx` header (pass `categoryId` + `dateFrom`/`dateTo`).
- [x] **Task 10 — i18n** (AC: 10)
  - [x] Add export keys to `messages/{en,uk}/transactions-page.json` (+ `transactions-by-category-page.json` where the detail needs its own copy) — real Ukrainian, ICU. `pnpm i18n:parity` green.
- [x] **Task 11 — Tests** (AC: 11)
  - [x] Backend unit (serializers, converter, filename, controller mock-`Response`) + Testcontainers integration (scoping, filters, fidelity, headers/truncation, round-trip via import/preview). Frontend component/action/util tests per AC 11.
- [x] **Task 12 — Gates, visual QA, record** (AC: 11, 12)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where turbo may replay stale logs; plus the client-drift gate.
  - [x] Capture + commit the visual-QA matrix per AC 12 under `visual-qa/6-3-export-transactions-csv-json/`; verify `:3000` cwd + seed baseline before capture; restore baseline if any live re-import ran.
  - [x] Record in the Dev Agent Record: D-1…D-8 decisions and the flagged divergences (D-1 string-amount/bare-date vs reference, D-2 client-consumption + the browser-client alternative, D-3 hand-rolled CSV vs csv-stringify, D-5 round-trip/date-parser widening) as a short operator checklist for PR (Epic 5 retro Action #5).

## Dev Notes

### Decisions (D-x) — reference-consistent unless flagged; recorded for operator confirmation at PR

- **D-1 — String amounts + bare `YYYY-MM-DD` dates in the export (FLAGGED divergence from the reference).** The reference emits Amount via `parseFloat` (number) and Date as `MM/DD/YYYY HH:mm:ss` UTC. supertool's hard rules force the opposite: `Amount` is the exact stored `numeric(14,2)::text` string (D1 — a number here would be a defect), `Date` is the bare `YYYY-MM-DD` (RP-D5 — no timezone math). Not a stylistic choice — the hard rules win. Recorded as a divergence for transparency.
- **D-2 — Client-consumption: generated client via a `'use server'` action + `parseAs`, then client-side Blob download. (FLAGGED — the app's first typed non-JSON generated-client consumption.)** NFR6 forbids a hand-written `fetch`; a raw `<a href="/api/v1/transactions/export">` bypasses the generated client entirely (defect) and can't cleanly carry the session/query through the same-origin proxy. supertool's hey-api client natively supports `parseAs: 'text'|'blob'`/`responseStyle` (`client.gen.ts` L114-169), so — unlike the reference, which had to bypass its own SDK with a bespoke `requestBlob` — supertool consumes the **generated SDK method** directly. Chosen call site: the `'use server'` action using `createServerApiClient` (the ONLY proven generated-client call site in the app, with cookie-forwarding + a test harness; `createBrowserApiClient` exists but is unused). The action returns `{ content, fileName, mimeType }` (filename read from `Content-Disposition`) and a small client `download-blob` util does the object-URL anchor download. **Alternative (operator may prefer, reference-aligned): a client-side `createBrowserApiClient` + `parseAs:'blob'` call** — also NFR6-compliant and closer to the reference's client-side download, but it introduces the app's first browser-side generated-client usage (baseURL/cookie/parseAs untested in-app). Primary path chosen for provenance + testability; file is capped (≤ `MAX_EXPORT_ROWS`) so returning it through the action boundary is acceptable at PoC scale.
- **D-3 — Hand-rolled CSV serializer, no new dependency (divergence from the reference's `csv-stringify@6.7.0`).** The task and architecture's new-dependency rule prefer no new dep + thorough escaping tests. A fixed 7-column, known-shape row is trivial to serialize correctly, and hand-rolling gives **explicit control over CSV/formula-injection neutralization** (`=`/`+`/`-`/`@`/tab/CR → `'` prefix), which `csv-stringify` does not do by default. `csv-parse@7` (import) has no stringify; `csv-stringify` is a separate package — not added. Escaping is exhaustively unit-tested (AC 3).
- **D-4 — Buffered response, not streamed (divergence from the reference's `StreamableFile`).** With `MAX_EXPORT_ROWS = 10_000` (the 1,880-row seed fits far under), buffering the serialized string is trivial memory, simpler, matches the hand-rolled serializer, and is straightforward to unit/integration-test. Streaming is the future scale path (recorded, not needed at PoC scale). Truncation is still signalled via the reference's `X-Result-Truncated` header when the cap is hit.
- **D-5 — Round-trip is a first-class goal; widen `parseSeedDate` to accept ISO dates if needed (minimal, additive).** The export is import-shaped (`Date,Category,Subcategory,Type,Amount,Currency,Note`, canonical `Expense`/`Income`, string amounts) so it re-imports via the 5.1 contract (AC 5). The one gap is the date wire-format (bare `YYYY-MM-DD` vs the seed's `MM/DD/YYYY`); the fix is a small additive widening of `parseSeedDate` that reuses the ingest engine per repo convention. `Note` does not round-trip (import row schema has no note field — 5-1). If the operator prefers export-only, the date-parser widening is the single deferrable piece and AC 5 narrows to "import-shaped." Flagged.
- **D-6 — Honor the FULL list filter set (`type` + `sortBy`/`sortOrder`), exceeding the reference (which drops them).** RP-F7 and the epic charter say export "from the transactions list" honoring the current view; supertool honors everything the list honors so the exported file matches what the user sees. Reference-consistent in spirit, superset in fact. `categoryId` is subtree-aware (reusing `getCategorySubtreeIds`), matching the list.
- **D-7 — No throttling on export (consistent with import, D-H of 5-1).** The reference throttles export (`@Throttle` 10/min). Backend rate-limiting beyond auth is RP-B4 (P2, explicitly deferred). Not carried.
- **D-8 — Export control on BOTH surfaces via one reusable `ExportMenu`.** RP-F7 (list) + Epic 5 retro Action #4 / 5-6 D-8 (by-category detail). One route-agnostic component (props in/callbacks out) wired on both, not forked. Uses the `dropdown-menu` molecule (present since 1.11) and inline `Alert` for feedback (6-2 established no-toaster).

### Out of scope (explicitly — belongs to later Epic 6 stories / deferred)

- **Full-text search → Story 6-4** (which also closes the repo-wide shape-only date-validation debt, Epic 5 retro Action #1). No `search` param is added to the export DTO; export honors only the existing list filters. (Note: the reference export DTO uses `@IsNotBeforeField('dateFrom')` on `dateTo` — supertool does NOT add cross-field date-order validation here; that repo-wide `dateFrom <= dateTo` hardening is explicitly Story 6-4's job, Epic 5 retro Action #1. Export inherits the list's current shape-only date validators unchanged.)
- **Analytics response caching → Story 6-5** (Epic 5 retro Action #2). Export is not cached.
- No streaming export, no async/background export job, no per-currency aggregation or currency picker (RP-D1 — plain row dump), no time-of-day (RP-D5), no recurring-transaction export (RP-F6 deferred), no `X-Result-Truncated` UI beyond a localized notice.
- No change to the shipped list contract: the DTO refactor (Task 3) must leave `transactionsFindAll`'s generated types byte-identical.

### Epic 5 retro action items that apply to this story

- **Action #4 — Add the reference's export button to the by-category detail (this story).** Delivered via D-8 (both surfaces). This is the explicit reason 6-3 owns the by-category export.
- **Action #5 — Make divergence-flag resolution explicit at PR time:** list D-1 (string amounts / bare dates), D-2 (client-consumption + browser-client alternative), D-3 (hand-rolled CSV vs csv-stringify), D-4 (buffered vs streamed), D-5 (round-trip / parseSeedDate widening) in the PR description as an operator checklist.
- **Action #6 — Pre-QA + post-QA DB-baseline checklist:** `lsof`-verify the `:3000` cwd is this checkout, capture on the clean seed baseline (latest txn = 2025-02-03); export is read-only, but if a live round-trip re-import is exercised, `TRUNCATE` + re-seed after.
- **Contract-first (Epic 5 retro D1):** endpoint + Testcontainers suite + regenerated client land solid with the UI in one cohesive story (thin endpoint + its consumer, acceptable per the 5-6/6-2 precedent).
- **Seed-engine name-only-keying deferral (5-1):** export reads via the list query and does not touch the ingest engine's category keying; the round-trip only exercises `import/preview` (read path) — the keying deferral is not triggered.

### Reference patterns (ED1 — study, adapt, never copy/import)

- Backend: `example/tracker-backend-api/src/modules/transactions/transactions.controller.ts` (`exportTransactions`), `transactions.service.ts` (`exportTransactions`/`toExportRow`), `transactions.repository.ts` (`findAllForExport`, `MAX_EXPORT_ROWS`), `dtos/export-transaction-query.dto.ts`. Adapt: string amounts (D-1), bare dates (D-1), full filter set (D-6), hand-rolled CSV (D-3), buffered (D-4), supertool error envelope + `@supertool/shared` constants + `enumName` map.
- Frontend: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/export-transaction-button/{ExportTransactionButton.tsx,download-blob.ts}` — DropdownMenu CSV/JSON, `isLoading`, filename-from-`Content-Disposition` object-URL anchor download. Adapt: `dropdown-menu` molecule from `packages/ui`, `translate` not `t`, `FC<Props>`, generated-SDK-through-server-action (D-2) instead of the bespoke `requestBlob`, inline `Alert` not toast.
- Client-consumption: `example/track-my-life/packages/shared/src/api/services/transaction-api.service.ts` `exportTransactionList` + `packages/shared/src/api/client/api-client.ts` `requestBlob` — studied; supertool does NOT replicate the bespoke blob path (D-2 — hey-api `parseAs` covers it).
- Placement: reference `…/transactions/page.tsx` (two buttons: all + current-filter) — supertool ships ONE menu honoring the current filters (simpler; "export all" = clear filters then export). `…/by-category/[categoryId]/page.tsx` (categoryId button).
- **No reference counterpart — new ground:** hand-rolled injection-safe CSV, generated-SDK `parseAs` consumption, round-trip through an idempotent import.

### Hard-rule guardrails (CLAUDE.md / architecture.md — binding)

- Money is strings end-to-end; no float math — amounts emitted as exact stored strings, never `parseFloat`/`Number`/`Intl` in the serializers (D1). Dates stay bare `date` `YYYY-MM-DD` (RP-D5) — no timezone/UTC formatting.
- API access ONLY via the generated client (NFR6) — the file download flows through the generated SDK (`transactionsExport`, `parseAs`) via a `'use server'` action; a hand-written `fetch` or raw `<a href>` to `/api/*` is a defect. controller→service→repository layering; the repository is the only DB-touching layer (D7); explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable.
- REST: `/api/v1/...`, camelCase JSON for JSON APIs; the export response is a binary/text file body with `Content-Type`/`Content-Disposition` (documented via `@ApiProduces` + `schema: {type:'string', format:'binary'}`); error envelope `{ statusCode, code, message, details? }` with the shared `ErrorCode` enum. User-scoped only (FR21) — no cross-user rows.
- next-intl ICU (no concatenation); `FC<Props>`; PascalCase component files; kebab-case dirs; SCSS design tokens only; mobile-first.
- Routes only via `ROUTES`/`get*Path`; navigation via `@supertool/next-shared` i18n, never `next/navigation`/`next/link` directly.
- No barrel files, no re-exports, no code comments; `list` suffix for arrays; `get/check/format/parse/convert/build` function prefixes; `as const` objects over TS enums (derive unions via `ObjectValuesUnion`); no `as` assertions in production code (narrow with `checkIs*` guards); new deps exact-pinned — **none expected** (hand-rolled CSV, `dropdown-menu`/`alert` already present).

### Testing standards summary

- API: co-located `*.spec.ts` (Vitest + SWC decorators) for the pure serializers/converter/filename and the controller unit spec (mock `Response`); Testcontainers integration in `apps/api/test/integration/` (extend `transactions.integration.spec.ts` or a new `transaction-export.integration.spec.ts`; reuse `test/helpers/postgres-container.ts`) — user-scoping, filter honoring, string-amount/bare-date fidelity, content-type/disposition/truncation, and the round-trip feeding export output into `transactionsImportPreview`. Frontend: co-located `*.test.ts(x)` (Vitest + @testing-library/react) — `ExportMenu`, the action (mock `createServerApiClient`/SDK/`next/headers`), the `download-blob` util. Run via pnpm scripts; `TURBO_FORCE=true` when verifying gates (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`).

### Project Structure Notes

- Backend: extend existing `apps/api/src/modules/transactions/` (controller/service/repository already registered — no new provider). New serializer module `apps/api/src/modules/transactions/export/`; new DTOs under `…/dtos/`. Shared: new `packages/shared/src/constants/transaction-export.ts`; regenerated client in `packages/shared/src/generated/` (committed).
- Frontend: `ExportMenu` + hook + `download-blob.ts` under a page-scoped `…/transactions/components/export-menu/` (route-agnostic so the by-category detail imports it); server action `src/actions/export-transactions.ts` + co-located `types.ts` beside `create-transaction.ts`/`preview-transaction-import.ts`. Wire both `page.tsx` headers.
- New visual-QA directory: `_bmad-output/implementation-artifacts/visual-qa/6-3-export-transactions-csv-json/`.
- Branch: `TOOLS-6-3/export-transactions-csv-json` off `main`; conventional commits; PR via `create-pr` (memory `story-work-via-pr`). This story's branch also carries the pending `sprint-status.yaml` edits (6-2 → done, 6-3 → ready-for-dev) already in the working tree — do NOT commit story creation to `main`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3] and [#Epic 6: Manage Transactions at Scale] (charter + RP-F7/RP-B6 + evidence-reference convention)
- [Source: _bmad-output/planning-artifacts/epics.md#RP-F7] (export scoped + all) and [#RP-B6] (`GET /transactions/export`) and [#RP-D1] (single currency) and [#RP-D5] (bare date)
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — D1 (money strings), D7 (layering + error envelope), D8/NFR6 (generated client + drift gate), D9 (server actions), D3 (class-validator + swagger CLI)
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-05.md#Action Items] (Action #4 export button on by-category, #5 divergence checklist, #6 pre/post-QA baseline) and [#Next Epic Preview — Epic 6]
- [Source: _bmad-output/implementation-artifacts/5-1-transaction-import-endpoint.md] (import contract the export round-trips into; `parseSeedDate`, `seedSourceRecordSchema`, dedup semantics; D-H no throttling)
- [Source: _bmad-output/implementation-artifacts/6-2-bulk-delete-transactions.md] (contract-first backend+frontend precedent; no-toaster inline-Alert feedback; `enumName` on `ErrorCode`; shared-constants placement)
- [Source: _bmad-output/implementation-artifacts/5-6-transactions-by-category-drill-down.md] (D-8 — export button deferred to 6.3 by name; by-category detail reuses `transactionsFindAll`)
- [Source: apps/api/src/modules/transactions/transactions.controller.ts] (route ordering: `import`/`bulk-delete` above `:id`; `@Session()` userId; AuthGuard; swagger decorators)
- [Source: apps/api/src/modules/transactions/transactions.repository.ts] (`buildScopedConditions`, `getCategorySubtreeIds`, `buildOrderBy`, `selectJoinedTransactions`, `mapRowToResponse` — reuse for export)
- [Source: apps/api/src/modules/transactions/dtos/{find-transactions-query.dto.ts,transaction-response.dto.ts}] and [apps/api/src/shared/dtos/pagination-query.dto.ts] (DTO refactor base; row fields)
- [Source: apps/api/src/shared/constants/openapi-enum-name.ts] (add `transactionExportFormat`) and [apps/api/src/database/seeds/parse-seed-date.ts] (round-trip date-format)
- [Source: packages/shared/src/generated/client/client.gen.ts] (`parseAs`/`responseStyle` support — the key to NFR6-compliant file consumption) and [packages/shared/src/generated/sdk.gen.ts] (SDK method shape)
- [Source: apps/money-tracker/src/app/[locale]/transactions/page.tsx + utils/parse-transactions-search-params.ts + utils/period.ts] (list header, filter params, `getMonthDateRange`/`parsePeriod`) and [.../by-category/[categoryId]/page.tsx] (detail header, `categoryId` + `dateFrom`/`dateTo`)
- [Source: apps/money-tracker/src/actions/{create-transaction.ts,preview-transaction-import.ts} + packages/next-shared/src/client/create-server-api-client.ts] (server-action + cookie-forwarded generated-client + error-union patterns)
- [Source: packages/ui/src/components/molecules/dropdown-menu/DropdownMenu.tsx] (format menu) and [packages/ui/src/components/atoms/alert/*] (inline error feedback)
- [Reference: example/tracker-backend-api/src/modules/transactions/{transactions.controller.ts,transactions.service.ts,transactions.repository.ts} + dtos/export-transaction-query.dto.ts] (ED1)
- [Reference: example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/export-transaction-button/{ExportTransactionButton.tsx,download-blob.ts} + packages/shared/src/api/services/transaction-api.service.ts + client/api-client.ts] (ED1)
- [Source: .claude/rules/{nestjs-apis.md,javascript.md,typescript.md,react.md,i18n.md,styles.md}] (conventions)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — bmad-dev-story workflow.

### Debug Log References

- Gates run via pnpm scripts with `TURBO_FORCE=true`: `type-check`, `lint`, `stylelint`, `fmt:check`, `test`, `i18n:parity`, `build` — all green. Client-drift gate: `pnpm turbo run generate:client` → `git status --porcelain packages/shared/src/generated` shows only the additive export op (regeneration is deterministic).
- Visual QA: the pre-existing `:3000`/`:3001` servers were production `next start` / Nest `start` processes serving a stale build (chunk 500s / `/transactions/export` 404). Restarted both against the fresh build (cwd verified in this checkout) before capturing. DB baseline confirmed intact (1880 txns, latest 2025-02-03, 110 categories, operator onboarding_completed=true) — export is read-only, no mutation, no restore needed.

### Completion Notes List

Implemented the export feature end-to-end (backend endpoint + serializers + regenerated client + two-surface UI).

Decisions recorded (D-1…D-8 from the story are settled; the following are implementation-level decisions/refinements made during dev):

- **D-2 refinement — export response typed as `type: 'string'` (not `format: 'binary'`).** `@ApiOkResponse({ schema: { type: 'string' } })` makes the generated `TransactionsExportResponses[200]` a `string`, so the `'use server'` action reads `data` directly with `parseAs: 'text'` and no `as` assertion (no-`as` hard rule). `@ApiProduces('text/csv','application/json')` documents the media types. The reference's `format: binary` would have generated `Blob | File`, forcing an assertion. Chosen path is NFR6-compliant (generated SDK), testable, and assertion-free.
- **DTO no-duplication via IntersectionType (Task 3, order-preserving).** Extracted `TransactionFilterQueryDto` (the six filter fields); `FindTransactionsQueryDto extends IntersectionType(PaginationQueryDto, TransactionFilterQueryDto)` — this argument order preserves the exact shipped query-param order, so the `transactionsFindAll` generated types are byte-identical (verified: the client diff is additive-only — only `TransactionsExport*` + `TransactionExportFormat` added). `ExportTransactionsQueryDto extends TransactionFilterQueryDto` adds a required `format`.
- **`format` is required** (`@IsIn(TRANSACTION_EXPORT_FORMAT_LIST)`, `@ApiProperty` with `enumName`), not optional-with-default — the UI always sends CSV or JSON explicitly. `DEFAULT_TRANSACTION_EXPORT_FORMAT` still lives in `@supertool/shared` for completeness.
- **Passthrough `Response` typed structurally.** `express` is not a direct dependency of `apps/api` (only transitively via `@nestjs/platform-express`), so `@Res({ passthrough: true })` is typed with a minimal local `ExportHttpResponse { setHeader }` interface rather than adding an `express`/`@types/express` dependency (no-new-dep rule). Only `setHeader` is used.
- **D-5 delivered — `parseSeedDate` widened (minimal, additive) to accept ISO `YYYY-MM-DD`.** Keeps the existing `MM/DD/YYYY[ HH:mm:ss]` path and range validation; adds an ISO branch so the bare-date export round-trips through 5.1 import. Unit tests added.
- **ExportMenu is a client component using `useTranslations` directly** (namespace passed as a prop). A resolver/label *function* cannot cross the RSC boundary from the server `page.tsx`, so the component owns its own i18n via next-intl's client provider (same pattern as `TransactionFilters`), composing `${namespace}.export` and `${namespace}.exportErrors`. Error headline resolves by `ErrorCode` with `.has()` → `UNKNOWN` fallback (AC 7).
- **Truncation UI deferred (per Out-of-scope).** The backend sets `X-Result-Truncated` at `MAX_EXPORT_ROWS` (controller unit-tested) but no in-app truncation notice is surfaced — the 1,880-row seed is far under the 10,000 cap. No unused i18n strings were added for it.

Visual QA (captured on `:3000`, both surfaces × {390px, desktop} × {light, dark} = 8 screenshots under `visual-qa/6-3-export-transactions-csv-json/`):
- Export control renders on BOTH the by-date list (in `styles.controls` beside MonthNavigator/Add) and the by-category detail (beside MonthNavigator); dropdown opens showing "Export as CSV" / "Export as JSON" in every theme/viewport.
- Horizontal-overflow guard at 390px passed on both surfaces (`document.documentElement.scrollWidth === window.innerWidth` → true) with the menu open.
- **Exported file content inspected end-to-end** against the running API + a real browser download:
  - CSV: HTTP 200, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="transactions-2025-02-01_2025-02-28.csv"`, leading UTF-8 BOM (`EF BB BF`), `\r\n` terminators, stable header `Date,Category,Subcategory,Type,Amount,Currency,Note`, string amounts verbatim (`339.00`, `1588.29` — no float loss), bare dates (`2025-02-03`), Cyrillic preserved (`Транспорт`/`Донати`), two-level hierarchy correct (`Транспорт`/`Tаксі` child; `Донати` top-level → empty Subcategory).
  - JSON: HTTP 200, `application/json; charset=utf-8`, no BOM, top-level array, all `Amount` values are quoted strings, key order matches the CSV columns.
  - Filter honoring verified live (`type=income` window → 0 income rows; correct); invalid `format=xml` → HTTP 400.
  - Browser client flow confirmed: clicking "Export as CSV" triggered a real download (`transactions-2025-02-01_2025-02-28.csv`) via the server action → `download-blob`; no error alert.
- User-scoping proven by the Testcontainers integration test (operator export excludes the round-trip user's uniquely-named category).

### File List

Added:
- `packages/shared/src/constants/transaction-export.ts`
- `apps/api/src/modules/transactions/dtos/transaction-filter-query.dto.ts`
- `apps/api/src/modules/transactions/dtos/export-transactions-query.dto.ts`
- `apps/api/src/modules/transactions/export/transaction-export-row.ts`
- `apps/api/src/modules/transactions/export/transaction-export-result.ts`
- `apps/api/src/modules/transactions/export/convert-transaction-to-export-row.ts` (+ `.spec.ts`)
- `apps/api/src/modules/transactions/export/format-transactions-as-csv.ts` (+ `.spec.ts`)
- `apps/api/src/modules/transactions/export/format-transactions-as-json.ts` (+ `.spec.ts`)
- `apps/api/src/modules/transactions/export/build-export-filename.ts` (+ `.spec.ts`)
- `apps/api/test/integration/transaction-export.integration.spec.ts`
- `apps/money-tracker/src/types/transaction-export.ts`
- `apps/money-tracker/src/actions/export-transactions.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/components/export-menu/ExportMenu.tsx` (+ `.test.tsx`, `.module.scss`)
- `apps/money-tracker/src/app/[locale]/transactions/components/export-menu/types.ts`
- `apps/money-tracker/src/app/[locale]/transactions/components/export-menu/download-blob.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/components/export-menu/hooks/use-export-menu.ts`
- `_bmad-output/implementation-artifacts/visual-qa/6-3-export-transactions-csv-json/*.png` (8 captures)

Modified:
- `apps/api/src/modules/transactions/transactions.controller.ts` (+ `.spec.ts`)
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts`
- `apps/api/src/shared/constants/openapi-enum-name.ts`
- `apps/api/src/database/seeds/parse-seed-date.ts` (+ `.spec.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/messages/{en,uk}/transactions-page.json`
- `apps/money-tracker/messages/{en,uk}/transactions-by-category-page.json`
- `packages/shared/src/generated/{index.ts,sdk.gen.ts,types.gen.ts}` (regenerated client)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Review Findings

Adversarial code review (bmad-code-review, 2026-07-05) — Blind Hunter + Edge Case Hunter + Acceptance Auditor over `4cfe68a..HEAD`. Gates re-run and green: type-check, lint, stylelint, fmt:check, test, i18n:parity. Generated-client drift confirmed additive-only (`transactionsFindAll` byte-identical). **No MUST-FIX findings. Verdict: APPROVE.**

Verified correct (no defect): CSV RFC-4180 quoting + formula-injection neutralization with no exploitable bypass (guard on original first char, then quoting — `'` prefix survives); money string fidelity end-to-end (no `parseFloat`/`Number`/`Intl`/float math); bare `YYYY-MM-DD` dates; user-scoping via shared `buildScopedConditions`/`getCategorySubtreeIds` (integration test proves cross-user exclusion); truncation off-by-one correct (`.limit(MAX+1)`, `length > MAX`); Content-Disposition filename safe (`@Matches(CALENDAR_DATE_PATTERN)`); error-code mapping works under `parseAs:'text'` (client JSON-parses error bodies independently); i18n en/uk parity; no new dependency; no `example/` imports; AC 1-12 all met.

Non-blocking (nice-to-have / deferred):

- [ ] [Review][Patch] `downloadBlob` revokes the object URL synchronously right after `anchor.click()` — defer revoke (e.g. `setTimeout`) to avoid rare Firefox download cancellation for large exports [apps/money-tracker/src/app/[locale]/transactions/components/export-menu/download-blob.ts:16]
- [x] [Review][Defer] `X-Result-Truncated` header is not consumed by the frontend (no truncation notice) — explicitly out-of-scope per story; backend sets + unit-tests it; seed (1,880 rows) is far under the 10,000 cap [apps/money-tracker/src/actions/export-transactions.ts]
- [x] [Review][Defer] CSV injection guard is applied to all columns including `Amount`; a leading-`-` amount would be mutated to `'-…` — latent only (DB `amount > 0` check + positive-amount validators make it non-triggerable); scope the guard to free-text columns if signed amounts ever land [apps/api/src/modules/transactions/export/format-transactions-as-csv.ts]
- [x] [Review][Defer] Leading-whitespace formula bypass (` =CMD`) not neutralized (only `charAt(0)` checked) — AC3 requires first-char only; Excel/LibreOffice do not evaluate leading-space, Google-Sheets edge case; low real-world impact [apps/api/src/modules/transactions/export/format-transactions-as-csv.ts:16]
- [x] [Review][Defer] `parseSeedDate` accepts impossible calendar days (e.g. `2025-02-30`, day bounded only to 1-31) — pre-existing weakness shared with the MM/DD/YYYY branch, not introduced by the ISO widening; Postgres rejects at insert [apps/api/src/database/seeds/parse-seed-date.ts]

Dismissed as noise: "single export per file" nit on cohesive helper+const modules (matches repo practice, not a barrel); AC12 8-vs-12 capture count (documented deviation, menu-open shots include the header); `buildExportFilename` one-sided-date fallback (frontend always supplies both dates).

## Change Log

| Date       | Change                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| 2026-07-05 | Story 6-3 created (export transactions CSV/JSON) — ready-for-dev. |
| 2026-07-05 | Implemented export endpoint (controller→service→repository), hand-rolled injection-safe CSV + JSON serializers, shared constants + named `TransactionExportFormat` enum, regenerated client (additive-only drift), `parseSeedDate` ISO widening for round-trip, and the reusable `ExportMenu` on both the by-date list and by-category detail. Tests + visual QA added. Status → review. |
| 2026-07-05 | Code review APPROVE (3 adversarial layers, 0 must-fix; CSV injection guard traced exploit-by-exploit, no bypass; 1 nice-to-have: defer downloadBlob URL revoke). PR opened: https://github.com/BudnikOleksii/supertool/pull/43 |
</content>
</invoke>
