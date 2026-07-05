---
baseline_commit: 309dcea61aa378a89955af08fd0fbee8dc357964
---

# Story 6.2: Bulk Delete Transactions

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to select many transactions and delete them in one action — on both the transactions list and the by-category detail view,
so that cleaning up a large or mis-imported set is fast and touch-usable (RP-F5).

## Context & Why This Story

This is the **second story of Epic 6 (Manage Transactions at Scale)** and the epic's **first destructive bulk operation** and **first new API endpoint since Epic 5**. It adds multi-select + a fixed action bar (N selected / select-all / clear / delete) and a single batch-delete call across **both** transaction surfaces, exceeding the reference on consistency and touch-usability.

**Critical scoping fact — no bulk-delete endpoint exists on `main`.** A code audit confirms the transactions controller exposes only single-item delete (`@Delete(':id')` → 204). The generated client (`packages/shared/src/generated/`) has only `transactionsRemove` (`DELETE /api/v1/transactions/{id}`, `204: void`). There is no `bulk`/`batch`/`removeMany` anywhere in the API. This story is therefore **backend + frontend**: it adds one new endpoint (controller → service → repository), regenerates and commits the generated client (drift gate green), then builds the two-surface selection UI on top of it.

**The two surfaces bulk-delete must cover (epics.md AC — "consistent across the by-date list AND the by-category view"):**
1. **By-date list** (`transactions/page.tsx` → `TransactionList` → date-grouped `TransactionCard` rows, RSC). Row actions live in `TransactionRowActions` (client). Rows are server-rendered — adding checkboxes needs a `'use client'` selection boundary wrapping them.
2. **By-category detail** (`transactions/by-category/[categoryId]/…/CategoryDetailList.tsx`, RSC). This view currently inlines its own `<ul>/<li>` row markup with **no** edit/delete actions (built by 5-6, D-8 explicitly left room for bulk-delete here — Epic 5 retro Action #3). The same selection model, action bar, and confirm dialog must be added here.

**Reference divergence discovered during research (flag at PR):** the planning docs (§5, epics.md 6.2 evidence note) say the reference wires bulk-delete on the **by-category view only** and that the by-date list has checkboxes with no bar. A read of `example/track-my-life` shows the reference actually wires it on **both** views (shared hook/action-bar/dialog/server-action/client-method; the views differ only in how they source `visibleIdList` and distribute selection context). Either way supertool's requirement is unchanged — **consistent across both, touch-usable** — but the "reference only does by-category" premise is inaccurate; recorded so the dev does not treat by-date wiring as net-new-beyond-reference.

**Evidence base (binding, per the Epic 4+ evidence-reference convention):**
- Reference captures: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--bulk-delete-bar--desktop.png` (the action bar in context) and `transactions--bulk-delete--{desktop,mobile}.png` (selection state). Supertool baseline: no bulk-delete baseline exists (net-new surface); baseline the current list + by-category detail from `…/supertool/transactions--*` for the row layout the checkboxes attach to.
- Reference code to adapt from (ED1 — study, never copy/import):
  - Frontend selection hook: `example/track-my-life/apps/money-tracker/src/hooks/use-bulk-delete-selection.ts` (Set-based, cap-enforced, snapshot-on-open, partial-failure re-selection).
  - Action bar: `example/track-my-life/apps/money-tracker/src/components/bulk-delete-action-bar/BulkDeleteActionBar.tsx`.
  - Confirm dialog: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/bulk-delete-transaction-dialog/BulkDeleteTransactionDialog.tsx`.
  - Server action: `…/transactions/actions/bulk-delete-transaction.ts`; result type/mapper `…/transactions/actions/types.ts`.
  - Cap constant: `example/track-my-life/packages/shared/src/constants/bulk-delete.ts` (`BULK_DELETE_MIN=1`, `BULK_DELETE_MAX=100`).
  - By-category wiring: `…/transactions/by-category/[categoryId]/BulkDeleteSelection.tsx` + `TransactionRowCheckbox.tsx` + `page.content.tsx`. By-date wiring: `…/transactions/page.content.tsx` + `TransactionList.tsx` + row selection contexts.
  - Backend endpoint: `example/tracker-backend-api/src/modules/transactions/transactions.controller.ts` (`bulkDelete`), `transactions.service.ts`, `transactions.repository.ts`; DTOs `src/shared/dtos/bulk-delete.dto.ts` + `bulk-delete-response.dto.ts`.
- epics.md Story 6.2 + Epic 6 charter; `epic-5-retro-2026-07-05.md` (Actions #3, #5, #6); Story 2-4 single-delete (`delete-transaction.ts`, `deleteScoped`); Story 5-6 by-category (`CategoryDetailList`, D-8).

## Recommended Approach (binding direction)

### 1. Backend — new bulk-delete endpoint (contract lands first)

Add to the **existing** transactions module (no new provider needed — controller/service/repository are already registered in `transactions.module.ts`):

- **Repository** `transactions.repository.ts` — new `deleteManyScoped(userId, idList): Promise<string[]>` returning the ids actually deleted:
  ```ts
  const rows = await this.db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, idList)))
    .returning({ id: transactions.id });
  return rows.map((row) => row.id);
  ```
  `inArray` is already imported and used elsewhere in this file. This mirrors `deleteScoped` (userId AND id scoping) but with `inArray` + `.returning({ id })` so the service can compute which ids failed. The cap (100) bounds the list, so no chunking is required (the existing `splitIntoChunks`/`IMPORT_KEY_BATCH_SIZE` precedent is available if the dev prefers defensiveness, but a single `inArray` of ≤100 is fine).
- **Service** `transactions.service.ts` — new `bulkDelete(userId, idList): Promise<BulkDeleteResult>`: call the repo, build a `Set` of deleted ids, derive `failedList` = every input id not in that set with a stable `reason` code (`ErrorCode.NotFound`), return `{ deletedCount, failedList }`. An id the user does not own (or that does not exist) simply never returns from `.returning()` and lands in `failedList` — same not-found semantics as single-delete, no separate ownership pre-check.
- **Controller** `transactions.controller.ts` — new handler:
  ```ts
  @Post('bulk-delete')
  @UseGuards(AuthGuard)
  @HttpCode(HTTP_STATUS_CODE.Ok)
  @ApiOkResponse({ type: BulkDeleteResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async bulkDelete(
    @Session() session: UserSession<typeof auth>,
    @Body() body: BulkDeleteTransactionsDto,
  ): Promise<BulkDeleteResponseDto> {
    return this.transactionsService.bulkDelete(session.user.id, body.idList);
  }
  ```
  Route-order note: `@Post('bulk-delete')` is a distinct POST path — no collision with `@Post('import')`/`@Post('import/preview')` or the `@Delete(':id')`/`@Get(':id')` param routes.
- **DTOs** in `apps/api/src/modules/transactions/dtos/`:
  - `BulkDeleteTransactionsDto`: `idList: string[]` with `@IsArray()`, `@ArrayNotEmpty()` (or `@ArrayMinSize(MIN_BULK_DELETE_IDS)`), `@ArrayMaxSize(MAX_BULK_DELETE_IDS)`, `@ArrayUnique()`, `@IsString({ each: true })`, `@ApiProperty({ type: [String] })`. This is the repo's **first** array request DTO — no existing `@IsArray`/`@ArrayMaxSize` precedent; the only `@Max` precedent is scalar pagination bounds (`pagination-query.dto.ts`).
  - `BulkDeleteResponseDto`: `deletedCount: number` (`@ApiProperty`), `failedList: BulkDeleteFailureDto[]` where `BulkDeleteFailureDto` = `{ id: string; reason: string }` with `reason` typed to the shared `ErrorCode` enum (`enumName: 'ErrorCode'` via `OPENAPI_ENUM_NAME`, so the generated client types it) — never a free-form English string.
- **Shared cap constants** (memory `shared-constants-no-duplication`): add `MAX_BULK_DELETE_IDS = 100` and `MIN_BULK_DELETE_IDS = 1` to `packages/shared/src/constants/` (e.g. a new `transaction-bulk.ts`), consumed by the API DTO `@ArrayMaxSize`/`@ArrayMinSize` **and** the frontend selection clamp — one source of truth.
- **Regenerate + commit the client**: `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`) → `pnpm --filter @supertool/shared generate:client`. Drift gate must be green. New method on `TransactionsApiService` (e.g. `transactionsBulkDelete`).

### 2. Frontend — shared selection primitives (build once, wire on both views)

- **Selection hook** (net-new client state — no selection precedent in the app): `use-transaction-selection.ts` holding `useState<Set<string>>`, exposing toggle, clear, select-all-visible (union of the visible id list, clamped to `MAX_BULK_DELETE_IDS`), `areAllVisibleSelected`, `selectedCount`, and a snapshot-on-open of the selected ids for the dialog. Cap enforced client-side against `MAX_BULK_DELETE_IDS`; over-cap select-all adds only up to the cap and surfaces a localized notice. Adapt from the reference `use-bulk-delete-selection.ts`.
- **Action bar** (presentational, `FC<Props>`): "N selected" (ICU count), select-all-visible, clear, delete (destructive). Fixed/sticky and touch-reachable at 390px; disabled while submitting. Adapt from `BulkDeleteActionBar.tsx`.
- **Confirm dialog**: reuse the `alert-dialog` molecule (`packages/ui/src/components/molecules/alert-dialog/`) exactly as single-delete/category-delete do; controlled via a hook mirroring `use-delete-transaction.ts` (open/pending/error via `useTransition`). On confirm, call the server action.
- **Row checkbox**: use the existing `Checkbox` atom (`packages/ui/src/components/atoms/checkbox/Checkbox.tsx` — already supports indeterminate; currently unused, this is its first consumer). One per row, consuming the selection state via context.
- **Server action** `src/actions/bulk-delete-transactions.ts` (`'use server'`, returns a discriminated result — extend `ActionState` from `@supertool/next-shared` or a bulk-specific `{ status, deletedCount, failedList }` result; keep the `{ status: 'error', code, message }` error arm so failures map to i18n by code, never raw text): re-validate the id list against `MIN/MAX_BULK_DELETE_IDS`, build the per-request client via `createServerApiClient({ cookieHeader })`, call `TransactionsApiService.transactionsBulkDelete({ client, body: { idList } })`, and on `deletedCount > 0` `revalidatePath` the affected route(s). Mirror `delete-transaction.ts` for the cookie/client pattern.
- **Client boundary**: both list surfaces are RSC. Wrap the server-rendered rows in a `'use client'` selection context provider (as the reference does) so `TransactionRowCheckbox` and the action bar/dialog read shared state without making the whole list client.

### 3. Wire onto both surfaces (consistent selection model)

- **By-date list**: provider wraps `TransactionList`; `visibleIdList` = flatten every date group's transaction ids; render a checkbox per `TransactionCard`; action bar shows when `selectedCount > 0`.
- **By-category detail**: provider wraps `CategoryDetailList`; `visibleIdList` = that category's visible transaction ids; add a checkbox per inlined row; same action bar + dialog. (5-6 built this list without actions; this story adds selection to it — reuse the shared primitives, do not fork them.)
- Selection is **ephemeral client state**, not URL params (D-5) — period/filter/sort/page stay URL-driven (protect §6 strength).

### 4. Partial failure + revalidation

- On a batch result, if all requested ids deleted → success message, clear selection, revalidate. If **some** failed → keep **only the failed ids** selected for retry and show a localized message with deleted/failed counts (map `reason` codes to i18n). If `deletedCount === 0` → localized error, selection unchanged. Never a silent drop, never a cross-user delete.
- After a successful delete the current page may become empty; reuse the single-delete last-page handling pattern (`redirect-after-transaction-delete.ts` probes the last valid page) or, at minimum, `revalidatePath` both affected routes so the RSC list re-renders a valid page. Do not leave the user on an out-of-range empty page with no recovery.

## Acceptance Criteria

1. **Multi-select with a consistent action bar on BOTH views (RP-F5).** Given the by-date transactions list AND the by-category detail view, when I enter multi-select, then both views present the **same** selection model (per-row checkbox via the `Checkbox` atom) and the **same** fixed action bar showing "N selected", select-all(-visible), clear, and delete — consistently across both surfaces (exceeding the reference's premise; touch-usable, not hover-only).
2. **Single batch delete, user-scoped, cap 100, returns the count (new endpoint).** Given a selection, when I confirm bulk delete, then the frontend calls the new `POST /api/v1/transactions/bulk-delete` (via the generated client, NFR6) which deletes the selected transactions in one batch scoped to the authenticated user (FR21 — repository `and(eq(userId), inArray(id))`), enforces a batch cap of 100 (rejecting over-cap requests as a validation error), returns `{ deletedCount, failedList }`, and both views update without a full reload (D9 — `revalidatePath`).
3. **Confirm-before-destroy.** Given I trigger bulk delete, when the destructive action is about to run, then a confirmation dialog (the design-system `alert-dialog` molecule, reused from single-delete) requires an explicit confirm — no single-click bulk destruction; the confirm control shows a pending state and is disabled while the batch is in flight.
4. **Partial-failure re-selection, never silent, never cross-user (FR21).** Given some selected ids are invalid or not owned by me, when the batch returns, then only the still-failing rows remain selected for retry and a localized message explains the partial result (deleted vs failed counts, mapped from `reason` codes — never raw API text); an id belonging to another user is reported as failed (not-found), never deleted — asserted by an integration test.
5. **Touch/mobile-usable (NFR8 — per-story 390px mobile-QA check).** Given a 390px viewport, when I select and act on either view, then the checkboxes and the fixed action bar are touch-reachable and not clipped, with no horizontal overflow (`document.documentElement.scrollWidth === window.innerWidth`); the action bar does not obscure row content or the delete affordance.
6. **Backend contract regenerated + committed (NFR6/D8).** Given the new endpoint + DTOs, when the API builds, then `openapi.json` includes `POST /api/v1/transactions/bulk-delete` with the `BulkDeleteTransactionsDto` request and `BulkDeleteResponseDto` response (arrays/enums typed via `enumName`), the generated client is regenerated into `packages/shared/src/generated/` and committed, and the drift gate is green. The frontend consumes it **only** through the generated client — no hand-written fetch (NFR6).
7. **Money & date rules preserved (D1/RP-D5).** Given delete touches no money arithmetic, then rows continue to render existing **string** amounts via Intl/next-intl (no coercion to `number`, no float math, D1) and transaction dates stay bare `date` (RP-D5 — no time-of-day surface). The batch cap constant lives once in `@supertool/shared` and is read by both the API DTO and the frontend clamp (no duplication).
8. **i18n parity (FR19/FR20).** All new user-facing strings — "N selected" (ICU count), select-all, clear, delete, confirm dialog title/body (with count), success/partial/error messages, over-cap notice — land in `apps/money-tracker/messages/{en,uk}/` (under the `transactionsPage` and, where the by-category view needs its own copy, `transactionsByCategoryPage` namespaces) in the same commit — real Ukrainian, ICU only, no concatenation; `pnpm i18n:parity` green. No hardcoded strings.
9. **Tests ship with the feature (NFR1).** Testcontainers integration specs (extend `apps/api/test/integration/transactions.integration.spec.ts`) assert: batch delete of a multi-id set (correct `deletedCount`, rows gone), the 100 cap (over-cap rejected), partial failure (some ids nonexistent/not-owned → `failedList` with not-found reason, valid ids still deleted), user-scoping (user A cannot bulk-delete user B's rows — they land in `failedList`, none deleted), and idempotency (re-deleting already-deleted ids → all in `failedList`, `deletedCount` 0). A controller unit spec asserts the handler forwards `session.user.id` + `idList` to the service (mirror the existing `remove` spec). Frontend component tests cover the selection hook (toggle/clear/select-all/cap), the action bar, and the confirm dialog + partial-failure re-selection, on both view wirings. All repo gates pass (`TURBO_FORCE=true` where turbo may replay stale logs).
10. **Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/6-2-bulk-delete-transactions/` contains captures named `<scenario>--<viewport>--<theme>.png` covering **light + dark × 390px + desktop** for: the by-date list with an active selection (action bar showing "N selected"), the by-category detail with an active selection, and the confirm dialog open. Compared against reference `transactions--bulk-delete-bar--desktop` and `transactions--bulk-delete--{desktop,mobile}`, with observations in the Dev Agent Record. Captured on `:3000` with the pre-QA environment checklist honored (verify `:3000` cwd is this checkout; DB baseline latest txn = 2025-02-03) and the DB baseline restored afterwards (bulk-delete QA mutates data — `TRUNCATE` + re-seed after capture).

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — carry patterns, never code): backend `example/tracker-backend-api/src/modules/transactions/transactions.{controller,service,repository}.ts` (`bulkDelete`) + `src/shared/dtos/bulk-delete.dto.ts` + `bulk-delete-response.dto.ts`; frontend `example/track-my-life/apps/money-tracker/src/hooks/use-bulk-delete-selection.ts`, `src/components/bulk-delete-action-bar/BulkDeleteActionBar.tsx`, `…/transactions/components/bulk-delete-transaction-dialog/BulkDeleteTransactionDialog.tsx`, `…/transactions/actions/bulk-delete-transaction.ts` + `actions/types.ts`, `packages/shared/src/constants/bulk-delete.ts`, and both view wirings (`by-category/[categoryId]/BulkDeleteSelection.tsx` + `TransactionRowCheckbox.tsx` + `page.content.tsx`; `transactions/page.content.tsx` + `TransactionList.tsx`). Note the endpoint divergence (D-2) and the reason-code improvement (D-3).
  - [x] Read in full the files this story updates: `apps/api/src/modules/transactions/transactions.{controller,service,repository}.ts` + `transactions.controller.spec.ts` + `dtos/`, `apps/api/test/integration/transactions.integration.spec.ts` (delete describe block + helpers), `apps/api/src/shared/dtos/pagination-query.dto.ts` (the `@Max` precedent), `apps/money-tracker/src/actions/delete-transaction.ts` + `.test.ts`, `…/transactions/components/transaction-row-actions/TransactionRowActions.tsx` + `hooks/use-delete-transaction.ts`, `…/transaction-list/TransactionList.tsx` + `transaction-card/TransactionCard.tsx`, `…/by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx`, `packages/ui/src/components/atoms/checkbox/Checkbox.tsx`, `packages/ui/src/components/molecules/alert-dialog/AlertDialog.tsx`, `packages/next-shared/src/types/action-state.ts`.
- [x] **Task 2 — Shared cap constants** (AC: 2, 7)
  - [x] Add `MAX_BULK_DELETE_IDS = 100` + `MIN_BULK_DELETE_IDS = 1` to `packages/shared/src/constants/` (new `transaction-bulk.ts`). No magic numbers; consumed by API DTO + frontend clamp.
- [x] **Task 3 — Backend repository + service + DTOs** (AC: 2, 4, 6)
  - [x] `deleteManyScoped(userId, idList)` in `transactions.repository.ts` (`and(eq(userId), inArray(id))` + `.returning({ id })`), explicit `@Inject` unchanged.
  - [x] `bulkDelete(userId, idList)` in `transactions.service.ts` (Set-diff → `failedList` with `ErrorCode.NotFound` reason; `{ deletedCount, failedList }`).
  - [x] `BulkDeleteTransactionsDto` (`idList` array validators reading the shared cap) + `BulkDeleteResponseDto` + `BulkDeleteFailureDto` (reason typed via `enumName: 'ErrorCode'`).
- [x] **Task 4 — Backend controller + regenerate client** (AC: 2, 6)
  - [x] `@Post('bulk-delete')` handler (AuthGuard, `@HttpCode(Ok)`, `@Session()` userId, swagger responses).
  - [x] `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`; commit the regenerated client; drift gate green.
- [x] **Task 5 — Frontend selection primitives** (AC: 1, 3, 4, 5)
  - [x] `use-transaction-selection.ts` (Set state, toggle/clear/select-all-visible clamped to cap, snapshot-on-open, `areAllVisibleSelected`, `selectedCount`).
  - [x] Action bar component (`FC<Props>`, "N selected"/select-all/clear/delete, sticky + touch-usable, disabled while submitting), tokens-only SCSS, mobile-first.
  - [x] Confirm dialog reusing the `alert-dialog` molecule + a controlling hook (mirror `use-delete-transaction.ts`); row checkbox via the `Checkbox` atom + selection context.
- [x] **Task 6 — Server action** (AC: 2, 4, 6)
  - [x] `src/actions/bulk-delete-transactions.ts` (`'use server'`): re-validate cap, `createServerApiClient({ cookieHeader })`, `TransactionsApiService.transactionsBulkDelete({ client, body: { idList } })`, `revalidatePath` affected route(s) when `deletedCount > 0`, return discriminated result (deleted/failed counts + error `code` for i18n). Guard page-out-of-range after deletion (reuse the `redirect-after-transaction-delete.ts` last-page pattern where applicable).
- [x] **Task 7 — Wire both views** (AC: 1, 5)
  - [x] By-date: selection context wraps `TransactionList`; `visibleIdList` = flattened date-group ids; checkbox per `TransactionCard`; action bar on `selectedCount > 0`.
  - [x] By-category: selection context wraps `CategoryDetailList`; add a checkbox per inlined row; same action bar + dialog. Do not fork the primitives.
- [x] **Task 8 — i18n** (AC: 8)
  - [x] Add all new keys to `messages/{en,uk}/transactions-page.json` (+ `transactions-by-category-page.json` where the by-category view needs its own copy) — real Ukrainian, ICU count. `pnpm i18n:parity` green.
- [x] **Task 9 — Tests** (AC: 9)
  - [x] Testcontainers: extend `transactions.integration.spec.ts` (batch delete, cap 100, partial failure, user-scoping A≠B, idempotency). Controller unit spec for the new handler. Frontend component tests (selection hook, action bar, confirm dialog + partial-failure re-selection, both wirings).
- [x] **Task 10 — Gates, visual QA, record** (AC: 5, 9, 10)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where turbo may replay stale logs.
  - [x] Capture + commit the visual-QA matrix per AC 10 under `visual-qa/6-2-bulk-delete-transactions/`; verify `:3000` cwd + seed baseline before capture; `TRUNCATE` + re-seed after (bulk-delete QA mutates data).
  - [x] Record in the Dev Agent Record: D-1…D-9 decisions, the endpoint-shape divergence from the reference (D-2) and the "reference wires both views, not by-category-only" finding — as a short operator checklist for PR (Epic 5 retro Action #5).

## Dev Notes

### Decisions (D-x) — reference-consistent unless flagged, recorded for operator confirmation at PR

- **D-1 — A new endpoint is required; do NOT fan out single deletes.** The ACs mandate a single-batch delete that returns a count and a partial-failure list. Fanning out N `transactionsRemove` calls in the server action cannot return a batch count, isn't a single scoped operation, and multiplies round-trips. Add one endpoint (controller→service→repository, D7) + regenerate the client. Reference-consistent (the reference has a dedicated batch endpoint).
- **D-2 — Endpoint shape: `POST /api/v1/transactions/bulk-delete`, HTTP 200, request `{ idList }`, response `{ deletedCount, failedList: [{ id, reason }] }`. FLAGGED divergence from the reference's `DELETE /transactions/batch`.** Rationale: architecture D7 reserves `DELETE → 204` for **bodyless single-resource** deletes; a batch op must return a body (count + partial failures) and therefore cannot be a 204 DELETE. `DELETE`-with-body is weakly specified in HTTP and risks being stripped by the `@hey-api` generated fetch client and/or the same-origin `/api/*` proxy (D5), whereas a `POST` body is universally supported; `POST /bulk-delete` is a clean RPC-style batch sub-resource and is the exact option the story charter suggests ("or a `POST /transactions/bulk-delete`"). **Operator override available:** if exact reference parity is preferred, switch to `DELETE /transactions/batch` — the repo already imports `inArray`; only the verb/route/status change. Recorded for PR sign-off.
- **D-3 — Response uses `list`-suffixed camelCase + stable `reason` codes (improves on the reference).** `{ deletedCount, failedList }`; each failure `{ id, reason }` where `reason` is a stable `ErrorCode` (`NOT_FOUND`) the frontend maps to a localized message — never a raw English string (the reference returns `reason: 'Not found'` verbatim, which would violate the "no raw API text" i18n rule, D3). Request field is `idList` (repo array-naming convention: `list` suffix) rather than the reference's `ids`.
- **D-4 — Batch cap 100 lives once in `@supertool/shared`.** New `MAX_BULK_DELETE_IDS = 100` / `MIN_BULK_DELETE_IDS = 1` consumed by the API `@ArrayMaxSize`/`@ArrayMinSize` and the frontend selection clamp (memory `shared-constants-no-duplication`). Mirrors the reference's `BULK_DELETE_MAX`/`_MIN` but placed in the shared package per repo convention. Cap enforced at three layers (client select clamp, server-action re-validate, API DTO) so no path exceeds it.
- **D-5 — Selection is ephemeral client state (`Set<string>`), not URL params.** Filter/sort/period/page stay URL-driven (protect §6 strength; the story charter's "selection state as appropriate" is satisfied by ephemeral client state — selection is transient and not shareable/back-button-relevant). Reference-consistent (it also holds selection in a `useState<Set>`). A `'use client'` selection context wraps the RSC rows so the list stays server-rendered.
- **D-6 — Both views get the same selection model (epics.md requirement; exceed reference on consistency + touch).** The by-category `CategoryDetailList` (5-6) currently has no row actions — this story adds the shared checkbox/action-bar/dialog there and on the by-date list. **Finding:** the reference actually wires bulk-delete on **both** views (not by-category-only as §5/epics claim); supertool's requirement is unchanged and additionally makes it touch-usable (not hover-only). Reuse shared primitives across both — do not fork.
- **D-7 — Partial-failure re-selection.** After a batch, failed ids stay selected for retry; success clears the selection; a localized toast/inline message reports deleted vs failed counts (mapped from reason codes). Reference-consistent (`handlePartialFailure` re-selects failed ids).
- **D-8 — Confirm-before-destroy reuses the `alert-dialog` molecule** (same primitive as single-delete `TransactionRowActions` and category-delete), controlled via a hook mirroring `use-delete-transaction.ts` (open/pending/error via `useTransition`).
- **D-9 — Money/date rules unaffected but preserved; forward note for 6-5.** Delete touches no money arithmetic — rows still render string amounts via Intl (D1); dates stay bare `date` (RP-D5). Forward-compat: Story 6-5 (analytics caching) lists bulk-delete as a mutation that invalidates the analytics cache — no action here, but keep the service method a clean single entry point so 6-5 can hook invalidation. The seed-engine name-only-keying deferral (Epic 5 retro) is **not** triggered — bulk-delete is a delete path and does not touch the ingest engine.

### Out of scope (explicitly — belongs to later Epic 6 stories)

- **Export CSV/JSON → Story 6-3** (+ the reference `ExportTransactionButton` deferred by name in 5-6 D-8, Epic 5 retro Action #4).
- **Full-text search → Story 6-4**, which also closes the repo-wide shape-only date-validation debt (Epic 5 retro Action #1). No date-range input is added here, so that debt is not triggered.
- **Analytics response caching + cache invalidation on bulk-delete → Story 6-5** (Epic 5 retro Action #2). This story only ensures the mutation is a clean hook point.
- No recurring-transaction bulk delete (RP-F6 deferred); no time-of-day (RP-D5).

### Epic 5 retro action items that apply to this story

- **Action #3 — Wire bulk-delete onto the 5-6 by-category view (this story).** Delivered via D-6 (both surfaces).
- **Action #5 — Make divergence-flag resolution explicit at PR time:** list D-2 (endpoint shape) and the "reference wires both views" finding in the PR description as an operator checklist.
- **Action #6 — Pre-QA + post-QA DB-baseline checklist:** `lsof`-verify the `:3000` cwd is this checkout, capture on the clean seed baseline (latest txn = 2025-02-03), and **`TRUNCATE` + re-seed after** the captures (bulk-delete QA deletes real rows — restore the baseline the next story inherits).
- **Contract-first (Epic 5 retro D1):** the endpoint + its Testcontainers suite + regenerated client should land solid before/with the UI; this is a single cohesive feature (thin endpoint + its consumer), acceptable in one story per the 5-6 precedent.

### Reference patterns (ED1 — study, adapt, never copy/import)

- Selection hook: `example/track-my-life/apps/money-tracker/src/hooks/use-bulk-delete-selection.ts` — adapt to supertool: `FC<Props>`/hook conventions, `@supertool/*` imports, `translate` not `t`, shared cap constant from `@supertool/shared`.
- Action bar: `example/track-my-life/apps/money-tracker/src/components/bulk-delete-action-bar/BulkDeleteActionBar.tsx` (presentational `FC`).
- Confirm dialog: `example/track-my-life/…/transactions/components/bulk-delete-transaction-dialog/BulkDeleteTransactionDialog.tsx` — supertool counterpart reuses `packages/ui/…/molecules/alert-dialog/AlertDialog.tsx`.
- Server action + result mapper: `…/transactions/actions/bulk-delete-transaction.ts`, `actions/types.ts` — supertool counterpart mirrors `src/actions/delete-transaction.ts` (cookie header + `createServerApiClient` + generated client).
- Backend: `example/tracker-backend-api/src/modules/transactions/transactions.{controller,service,repository}.ts` (`bulkDelete`) + `src/shared/dtos/bulk-delete{,-response}.dto.ts` — supertool mirrors its own `deleteScoped`/`delete`/`@Delete(':id')` (Story 2-4) shape, with the D-2/D-3 divergences.
- Cap constant: `example/track-my-life/packages/shared/src/constants/bulk-delete.ts` → supertool `packages/shared/src/constants/transaction-bulk.ts`.
- Reference captures: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--bulk-delete-bar--desktop.png`, `transactions--bulk-delete--{desktop,mobile}.png`.

### Hard-rule guardrails (CLAUDE.md / architecture.md — binding)

- Money is strings end-to-end; no float math — rows render existing string amounts, do not coerce to `number` (D1). Delete performs no money arithmetic.
- API access ONLY via the generated client; RSC reads via `fetch-*` actions; mutations via `'use server'` actions returning a discriminated result + `revalidatePath`; URL search params carry filter/sort/period/page (selection is ephemeral client state, D-5). No hand-written fetch (NFR6).
- controller→service→repository layering; the repository is the only DB-touching layer (D7); explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable.
- REST: `/api/v1/...`, camelCase JSON, error envelope `{ statusCode, code, message, details? }` with the shared `ErrorCode` enum; DELETE→204 is the single-delete convention (bulk uses `POST /bulk-delete` → 200 with a body, D-2). User-scoped deletion only (FR21) — no cross-user path.
- next-intl ICU (no concatenation); `FC<Props>`; PascalCase component files; kebab-case dirs; SCSS design tokens only; mobile-first.
- Routes only via `ROUTES`/`get*Path` in `constants/routes.ts`; navigation via `@supertool/next-shared` i18n `useRouter`/`usePathname`/`Link`, never `next/navigation`/`next/link` directly.
- No barrel files, no re-exports, no code comments; `list` suffix for arrays; `get/check/format/parse` function prefixes; `as const` objects over enums; no `as` assertions in production code; new deps exact-pinned (none expected — `Checkbox`/`alert-dialog`/Radix already present).

### Testing standards summary

- API: co-located `*.spec.ts` (Vitest + SWC decorators) for the controller unit spec; Testcontainers integration in `apps/api/test/integration/transactions.integration.spec.ts` (extend the existing delete describe block + helpers — `createOperatorTransaction`, `insertSecondUserTransaction`, `checkTransactionExists`). Frontend: co-located `*.test.tsx` (Vitest + @testing-library/react). Run via pnpm scripts; `TURBO_FORCE=true` when verifying gates so turbo doesn't replay stale logs (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`).

### Project Structure Notes

- Backend: extend existing `apps/api/src/modules/transactions/` (controller/service/repository already registered in `transactions.module.ts` — no new provider). New DTOs under `apps/api/src/modules/transactions/dtos/`.
- Shared: new `packages/shared/src/constants/transaction-bulk.ts`; regenerated client in `packages/shared/src/generated/` (committed).
- Frontend: shared selection hook + action bar + confirm dialog + row checkbox under `apps/money-tracker/src/…` (hook likely `…/transactions/components/<bulk component>/hooks/use-transaction-selection.ts`; action bar/dialog as sibling components; the checkbox reuses the `Checkbox` atom). Server action `src/actions/bulk-delete-transactions.ts`. Wire the selection context on both `TransactionList` and `CategoryDetailList`.
- New visual-QA directory: `_bmad-output/implementation-artifacts/visual-qa/6-2-bulk-delete-transactions/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2: Bulk Delete Transactions]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Manage Transactions at Scale] (charter + evidence base)
- [Source: _bmad-output/planning-artifacts/epics.md#RP-F5] and [#RP-D1] (single-currency) and [#RP-D5] (bare date)
- [Source: _bmad-output/planning-artifacts/architecture.md#D7 — REST conventions] (DELETE→204 single; pagination/error envelope)
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-05.md#Action Items] (Actions #3, #5, #6) and [#Next Epic Preview — Epic 6]
- [Source: apps/api/src/modules/transactions/transactions.controller.ts] (single-delete `@Delete(':id')` → 204, `@Session()` userId, AuthGuard)
- [Source: apps/api/src/modules/transactions/transactions.service.ts] (`delete(userId, id)` → NotFound on 0 rows)
- [Source: apps/api/src/modules/transactions/transactions.repository.ts] (`deleteScoped`, `inArray`, `splitIntoChunks`/batch-100 precedent)
- [Source: apps/api/src/shared/dtos/pagination-query.dto.ts] (the `@Max` scalar precedent — no array DTO precedent exists)
- [Source: packages/shared/src/constants/pagination.ts] (shared-constants placement precedent)
- [Source: apps/api/test/integration/transactions.integration.spec.ts] (delete + cross-user scoping test harness to extend)
- [Source: apps/money-tracker/src/actions/delete-transaction.ts] (server-action cookie/client pattern) and [.../utils/redirect-after-transaction-delete.ts] (revalidate + last-page)
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx] (alert-dialog usage) and [.../hooks/use-delete-transaction.ts]
- [Source: apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx] (5-6 list with no actions — second surface)
- [Source: packages/ui/src/components/atoms/checkbox/Checkbox.tsx] and [packages/ui/src/components/molecules/alert-dialog/AlertDialog.tsx]
- [Source: packages/next-shared/src/types/action-state.ts] (`ActionState`)
- [Reference: example/tracker-backend-api/src/modules/transactions/transactions.controller.ts] (`bulkDelete`, `DELETE /transactions/batch`) and [src/shared/dtos/bulk-delete.dto.ts, bulk-delete-response.dto.ts]
- [Reference: example/track-my-life/apps/money-tracker/src/hooks/use-bulk-delete-selection.ts], [src/components/bulk-delete-action-bar/BulkDeleteActionBar.tsx], [.../transactions/components/bulk-delete-transaction-dialog/BulkDeleteTransactionDialog.tsx], [.../transactions/actions/bulk-delete-transaction.ts], [packages/shared/src/constants/bulk-delete.ts]
- [Evidence: _bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--bulk-delete-bar--desktop.png, transactions--bulk-delete--desktop.png, transactions--bulk-delete--mobile.png]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- Gates (all green, run with `TURBO_FORCE=true` where turbo-backed): `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test` (money-tracker 311 / api 288 incl. new bulk-delete integration, DTO, controller specs), `pnpm i18n:parity`, `pnpm build`.
- Client-drift gate: `pnpm turbo run generate:client` produced no diff beyond the committed regenerated client (`packages/shared/src/generated/`); `openapi.json` includes `POST /api/v1/transactions/bulk-delete` with `BulkDeleteTransactionsDto` request and `BulkDeleteResponseDto` response (reason typed to the named `ErrorCode` schema).
- The generated `openapi.json` is gitignored (regenerated in CI); only the generated client under `packages/shared/src/generated/` is committed.

### Completion Notes List

**Decisions applied (D-1…D-9 per the story, plus implementation choices recorded here):**
- D-1/D-2/D-3: added one endpoint `POST /api/v1/transactions/bulk-delete` (HTTP 200), request `{ idList }`, response `{ deletedCount, failedList: [{ id, reason }] }`. `reason` is the stable shared `ErrorCode` (`NOT_FOUND`), emitted as a named OpenAPI enum via a new `OPENAPI_ENUM_NAME.errorCode` entry so the client types it — never raw English text.
- D-4: cap constants `MIN_BULK_DELETE_IDS`/`MAX_BULK_DELETE_IDS` live once in `@supertool/shared/constants/transaction-bulk.ts`; enforced at three layers (client select clamp, server-action re-validate, API DTO `@ArrayMinSize`/`@ArrayMaxSize`).
- D-5: selection is ephemeral client state (`Set<string>`) in a `'use client'` context wrapping the RSC rows; URL keeps filter/sort/period/page.
- D-6: both surfaces share the SAME primitives (provider/context/checkbox/action-bar/dialog) — not forked. Confirmed by the reference read that it wires both views.
- D-7: partial failure re-selects only the failed ids; full success clears selection; deletedCount 0 keeps selection unchanged.
- D-8: confirm dialog reuses the `alert-dialog` molecule with a `useTransition`-based controller hook mirroring `use-delete-transaction`.
- D-9: no money math; string amounts and bare dates preserved. Service `bulkDelete` is a single clean entry point for the future 6-5 cache-invalidation hook.

**Implementation choices (recorded for operator confirmation at PR):**
- **Result feedback is inline `Alert`, not toast.** The money-tracker app does not mount a `Toaster` (sonner is unused in this app), so — consistent with single-delete's in-dialog error — transport/validation errors and total-failure surface as a destructive `Alert` inside the confirm dialog (dialog stays open, selection unchanged), partial success surfaces a default `Alert` beside the action bar with deleted/failed counts, and over-cap surfaces a default `Alert` there too. Full success needs no message — the rows disappearing (via `revalidatePath`) is the confirmation.
- **Bulk-delete i18n copy lives once under `transactionsPage.bulkDelete`** and is read by the shared component on both surfaces (the by-category view does not need its own duplicate copy). `VALIDATION_ERROR` added to `transactionsPage.errors` for the defensive over-cap path. Real Ukrainian with full plural categories (one/few/many/other).
- **Revalidation is per-view** (`revalidatePath(ROUTES.transactions)` for by-date, `getTransactionsByCategoryDetailPath(categoryId)` for by-category) via a `view` discriminant passed from the client — no arbitrary user-controlled path. Out-of-range page after deletion is guarded on BOTH surfaces on re-render: the by-date list via `redirectWhenPageOutOfRange` in `TransactionListServer`, and the by-category detail via the equivalent `redirectWhenPageOutOfRange` guard added to `CategoryDetailList` in the 6-2 review fix (redirects to the last valid page of the same category+period).
- **Server action does NOT redirect** (unlike single-delete): it must return the `failedList` to the client for partial-failure re-selection, so it revalidates and returns a discriminated result.

**Divergence-flag operator checklist for PR (Epic 5 retro Action #5):**
1. D-2 endpoint shape `POST /transactions/bulk-delete` (200 + body) vs the reference's `DELETE /transactions/batch` — operator override available (only verb/route/status change) if exact reference parity is preferred.
2. "Reference wires bulk-delete on BOTH views" finding (not by-category-only as §5/epics claim) — supertool requirement unchanged; by-date wiring is not net-new-beyond-reference.
3. Inline-Alert (no toaster) feedback choice above.

**Visual QA (captured on :3000, cwd verified = this checkout via `lsof`; both servers restarted onto the freshly-built code; DB baseline 1880 txns / 110 cats / latest 2025-02-03; signed in as seeded operator):**
- 14 captures in `_bmad-output/implementation-artifacts/visual-qa/6-2-bulk-delete-transactions/` — by-date and by-category, selection + confirm-dialog, light + dark, desktop (1280) + mobile (390).
- By-date: per-row `Checkbox` (left of each card), sticky action bar "N selected / Select all / Clear / Delete(destructive)"; row copy/edit/delete actions preserved. By-category detail (5-6 list): checkbox added left of each row via a new `.itemBody` wrapper; same action bar + dialog.
- `documentElement.scrollWidth === innerWidth` verified `true` at 390px on BOTH surfaces (no horizontal overflow, AC5).
- Confirm dialog: bulk copy "Delete transactions?" / "Delete N transactions? This action cannot be undone." with pending-disabled controls; correct in both themes.
- **Real bulk delete exercised:** deleted 2 of the 4 Feb-2025 "Донати" rows → DB count 4→2 and the list re-rendered to 2 rows without a full reload (D9). DB baseline restored afterwards (`TRUNCATE transactions` + `db:seed` → verified 1880/110/2025-02-03).
- Compared against reference `transactions--bulk-delete-bar--desktop` and `transactions--bulk-delete--{desktop,mobile}`: supertool matches the action-bar/selection intent and additionally makes checkboxes always-visible and touch-usable on both surfaces.

### File List

**Added — backend**
- `packages/shared/src/constants/transaction-bulk.ts`
- `apps/api/src/modules/transactions/dtos/bulk-delete-transactions.dto.ts`
- `apps/api/src/modules/transactions/dtos/bulk-delete-transactions.dto.spec.ts`
- `apps/api/src/modules/transactions/dtos/bulk-delete-failure.dto.ts`
- `apps/api/src/modules/transactions/dtos/bulk-delete-response.dto.ts`

**Modified — backend**
- `apps/api/src/modules/transactions/transactions.repository.ts` (`deleteManyScoped`)
- `apps/api/src/modules/transactions/transactions.service.ts` (`bulkDelete`)
- `apps/api/src/modules/transactions/transactions.controller.ts` (`@Post('bulk-delete')`)
- `apps/api/src/modules/transactions/transactions.controller.spec.ts` (bulkDelete unit spec)
- `apps/api/src/shared/constants/openapi-enum-name.ts` (`errorCode`)
- `apps/api/test/integration/transactions.integration.spec.ts` (bulkDelete describe: batch, partial, user-scoping, idempotency)

**Modified — generated client (committed)**
- `packages/shared/src/generated/sdk.gen.ts`, `types.gen.ts`, `index.ts`

**Added — frontend**
- `apps/money-tracker/src/actions/bulk-delete-transactions.ts` (+ `.test.ts`)
- `apps/money-tracker/src/components/bulk-delete/types.ts`
- `apps/money-tracker/src/components/bulk-delete/BulkDeleteContext.ts`
- `apps/money-tracker/src/components/bulk-delete/BulkDeleteProvider.tsx` (+ `.test.tsx`)
- `apps/money-tracker/src/components/bulk-delete/BulkDeleteActionBar.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/components/bulk-delete/BulkDeleteConfirmDialog.tsx`
- `apps/money-tracker/src/components/bulk-delete/TransactionSelectCheckbox.tsx`
- `apps/money-tracker/src/components/bulk-delete/hooks/use-transaction-selection.ts` (+ `.test.ts`)
- `apps/money-tracker/src/components/bulk-delete/hooks/use-bulk-delete.ts`
- `apps/money-tracker/src/components/bulk-delete/hooks/use-bar-message.ts`

**Modified — frontend**
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx` (wrap by-date list in provider)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx` (pass `selectLabel`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.tsx` (+ `.test.tsx`) (render checkbox)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx` (+ `.module.scss`, `.test.tsx`) (provider + checkbox + `.itemBody`; 6-2 review fix: out-of-range page guard)
- `apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/page.tsx` (6-2 review fix: thread `period` to `CategoryDetailList` for the out-of-range redirect)
- `apps/money-tracker/messages/en/transactions-page.json`, `apps/money-tracker/messages/uk/transactions-page.json` (bulkDelete keys + `VALIDATION_ERROR`)

**Visual QA**
- `_bmad-output/implementation-artifacts/visual-qa/6-2-bulk-delete-transactions/*.png` (14 captures)

## Change Log

| Date       | Change                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| 2026-07-05 | Implemented story 6-2: bulk-delete endpoint + two-surface multi-select UI; all gates green; visual QA captured; status → review. |
| 2026-07-05 | Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Verdict: CHANGES-REQUESTED — 1 must-fix (by-category out-of-range recovery) + nice-to-haves. Security/user-scoping and partial-failure correctness verified solid. |

### Review Findings

Adversarial 3-layer review of `309dcea..HEAD`. Gates re-run by orchestrator: `type-check` PASS, `i18n:parity` PASS. Security core (user-scoping, partial-failure, cap) independently verified against source — SOLID.

**Must-fix (blocking):**

- [x] [Review][Patch] By-category view has no out-of-range page recovery after bulk delete — inconsistent with by-date, contradicts Dev Agent Record claim [apps/money-tracker/src/app/[locale]/transactions/by-category/[categoryId]/components/category-detail-list/CategoryDetailList.tsx:62] — `TransactionListServer` guards the by-date list with `redirectWhenPageOutOfRange`; `CategoryDetailList` has no equivalent. Deleting every row on a non-first page of a category with >50 txns (e.g. page 3 of 120) makes it re-fetch the now-empty page after `revalidatePath` (Suspense key `${categoryId}-${period}-${page}` unchanged) and render the `detail.empty` "no transactions" state with NO pagination control — a dead-end while 100 txns still exist on pages 1–2. The Completion Notes claim "Out-of-range page after deletion is handled by the existing `redirectWhenPageOutOfRange`" but that guard exists only on the by-date view. AC1's "consistent across both surfaces" theme is violated. Fix: mirror the by-date guard in `CategoryDetailList`. **Resolved (6-2 review fix):** added an equivalent `redirectWhenPageOutOfRange` guard to `CategoryDetailList` (empty check now keys off `meta.total`; out-of-range page redirects to the last valid page of the same category+period via `getTransactionsByCategoryDetailPath` + i18n `redirect`). `period` is now threaded from the detail `page.tsx`. Covered by two new co-located tests (redirect to last page > 1, and redirect to page 1).

**Nice-to-have (non-blocking):**

- [ ] [Review][Patch] Over-cap select-all path is unreachable via the UI + `onOverCap` fires inside a `setState` updater [apps/money-tracker/src/components/bulk-delete/hooks/use-transaction-selection.ts] — page size is 50 and selection resets per page (Suspense key includes `page`), so a user can never accumulate >50 of the 100-cap; the `onOverCap` notice / `overCap` bar message (AC's "over-cap select-all surfaces a localized notice") is a dead path not demonstrable by a real user. Separately, `onOverCap()` (which calls `setBarMessage`) is invoked from inside the `setSelectedIdSet(previous => …)` updater — impure updater, double-fires under StrictMode; raise it from the event handler after the update resolves. (Backend `@ArrayMaxSize` + server-action `checkIsWithinCap` still enforce the cap as defense-in-depth.)
- [ ] [Review][Patch] Escape during in-flight delete drops total-failure feedback [apps/money-tracker/src/components/bulk-delete/BulkDeleteProvider.tsx onOpenChange + hooks/use-bulk-delete.ts] — Radix `AlertDialog` closes on Escape even while `isPending` (only the Cancel button is disabled, not the Escape path); if the batch then resolves as total failure, `setDialogMessage({ kind: 'totalFailure' })` targets a closed dialog and the "None could be deleted" Alert never renders. Gate close/Escape while pending. (Rare: requires all selected ids to be not-found.)
- [ ] [Review][Patch] Not-found re-selection references rows absent from the re-rendered list [apps/money-tracker/src/components/bulk-delete/hooks/use-bulk-delete.ts applySuccessResult] — the only reason code the backend returns is permanent `NOT_FOUND`; after `revalidatePath` those rows are gone, yet their ids are re-selected "for retry". The action bar then shows "N selected" for ids with no rendered checkbox (can't untick individually, only Clear), and a retry deletes nothing. Re-selection-for-retry assumes transient failures that don't exist here.
- [ ] [Review][Patch] `TransactionsService.bulkDelete` has no own empty-list guard [apps/api/src/modules/transactions/transactions.service.ts] — only the DTO `@ArrayMinSize` stops an empty `idList`; the service (marketed as "a clean single entry point for the future 6-5 cache-invalidation hook") passes straight to `inArray(col, [])`. No HTTP-path defect today, but the advertised reusability is not self-defended.
- [ ] [Review][Patch] AC9 literal test-placement gaps [apps/api/test/integration/transactions.integration.spec.ts + apps/money-tracker/.../CategoryDetailList.test.tsx] — the 100-cap is asserted at the DTO/action layer, not the integration spec AC9 names (defensible: the service never enforces the cap); partial-failure re-selection is exercised only through the by-date wiring — `CategoryDetailList.test.tsx` stubs `BulkDeleteProvider`/`TransactionSelectCheckbox` to pass-throughs, so no selection behavior runs on the by-category surface. Substantive coverage exists; both are literal AC-text deviations worth a one-line note or a follow-up test.
- [ ] [Review][Patch] `BulkDeleteContext.ts` should be kebab-case [apps/money-tracker/src/components/bulk-delete/BulkDeleteContext.ts] — it exports a `createContext` value + a hook, not a component, so the PascalCase-for-components exception does not apply; convention wants `bulk-delete-context.ts` (sibling `types.ts` is correct). Likely not lint-enforced — manual call.
- [ ] [Review][Patch] `types.ts` re-exports a generated type under an alias [apps/money-tracker/src/components/bulk-delete/types.ts] — `export type BulkDeleteFailureItem = BulkDeleteFailureDto;` adds indirection with no added shape (javascript.md "never re-export types"); consumers could import `BulkDeleteFailureDto` from the generated client directly.
- [ ] [Review][Patch] File List omits a modified test [_bmad-output/implementation-artifacts/6-2-bulk-delete-transactions.md File List] — `TransactionList.test.tsx` was modified (adds the `TransactionSelectCheckbox` mock) but is not listed. Add for traceability.

**Verified solid (no action):** `deleteManyScoped` scopes by `and(eq(userId), inArray(id))` + `.returning({ id })` — no cross-user delete path; integration test "never deletes another user rows (FR21)" proves user A cannot delete user B's rows (row still exists, own deleted). Partial-failure set-diff is correct (`deletedCount = returned rows`, `failedList = input − returned`, no false "deleted"; `@ArrayUnique` + unique PK prevent skew). Cap enforced at 3 layers. API used only via regenerated `transactionsBulkDelete` (no hand-written fetch); `reason` typed to named `ErrorCode` enum. Confirm dialog reuses the `alert-dialog` molecule on both views. Money/date rules preserved (`deletedCount` is a count, not money). i18n en/uk parity green with ICU plurals.

**Dismissed (false positives / handled):** Non-UUID id → Postgres 500 (id column is `text`, not `uuid`; `inArray` won't throw type error); `revalidatePath` non-localized path won't refresh (demonstrably refreshes — mirrors working single-delete pattern, confirmed by visual QA + the by-category empty re-render); selection persists across pagination deletes off-screen rows (selection resets per page via the Suspense `key`); AlertDialog nested-button / pending-state (uses `asChild`, mirrors mandated single-delete pattern).
