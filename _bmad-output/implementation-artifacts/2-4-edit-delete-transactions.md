---
baseline_commit: dff76ab5c8f4e131ab401b5ac67de62f2e876304
---

# Story 2.4: Edit & Delete Transactions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to correct or remove any of my transactions,
so that my records stay accurate.

## Acceptance Criteria

1. **Update endpoint.** `PATCH /api/v1/transactions/:id` updates a transaction owned by the authenticated user via the controller→service→repository chain, returns the updated `TransactionResponseDto` (200, amount as string — D1), and is reachable through the regenerated client (drift gate green). The update validates the same invariants as create: amount matches `POSITIVE_AMOUNT_PATTERN`, `date` is a calendar date, the target `categoryId` exists for the user and its `type` matches the transaction `type` (else `404 NOT_FOUND` / `422 UNPROCESSABLE_ENTITY`).
2. **Single-transaction read.** `GET /api/v1/transactions/:id` returns the user-scoped transaction (200) so the edit screen can pre-fill, or `404 NOT_FOUND` when it does not exist for the user. (Repository already exposes `findOneByUserIdAndId` — wire controller + service + client only.)
3. **Delete endpoint.** `DELETE /api/v1/transactions/:id` removes the user's transaction and returns **204 No Content** (D7), no response body, no request body.
4. **Edit UI (FR7, NFR5).** Opening a transaction for editing renders the existing `TransactionForm` pre-filled with current values; a valid submission calls the update action via the generated client and is visible in the list without a full reload (`revalidatePath`). The submit button is disabled while pending and shows the localized "Save changes" label.
5. **Delete UI.** Deleting a transaction requires a confirmation (AlertDialog, `size="sm"`); on confirm the delete action runs, the API returns 204, and the list updates without a full reload. Cancel/backdrop dismiss aborts with no mutation.
6. **Cross-user denial (FR21).** Edit, single-read, or delete attempted against a transaction belonging to another user is denied via repository scoping as **not-found** (`404`, never `403`, no cross-user data path) — asserted by a Testcontainers integration test.
7. **Validation & i18n.** zod blocks invalid edits client-side with localized messages; API error codes map to i18n messages by `code` (reuse the create flow's `transactionForm.errors` map). Every new user-facing string lands in **both** `en` and `uk` message files in the same commit (FR19/FR20).
8. **Tests ship with the feature (NFR1).** Update/delete/find-one controller + service unit specs, repository scoping integration specs, the edit-form component test (pre-fill + validation + pending), the delete-dialog component test, and update/delete server-action tests all merge with this story.

## Tasks / Subtasks

- [x] **Task 1 — API: update + find-one + delete (AC: 1, 2, 3, 6)**
  - [x] Add `UpdateTransactionDto` in `apps/api/src/modules/transactions/dtos/update-transaction.dto.ts`. Mirror `CreateTransactionDto` fields and validators (`type`, `amount` string + `Matches(POSITIVE_AMOUNT_PATTERN)`, `currency`, `categoryId`, `date`, optional `note`). Full-replace PATCH semantics (all fields required except `note`) keeps it identical to create — do **not** type `amount` as `number` (D1).
  - [x] `transactions.repository.ts`: add `updateScoped(userId, id, input)` — `db.update(transactions).set({...input, updatedAt: <now>}).where(and(eq(userId), eq(id)))`, then reload via existing `findOneByUserIdAndId`; return `null` when no row matched the scoped where. Add `deleteScoped(userId, id): Promise<boolean>` returning whether a row was deleted (use the delete result rowCount). Reuse existing `findOneByUserIdAndId` for find-one. Every query scoped by `userId` (FR21).
  - [x] `transactions.service.ts`: add `findOne(userId, id)` → `NotFoundException({ code: ErrorCode.NotFound })` when repo returns null. Add `update(userId, id, dto)` → first reuse `findCategoryForUser` + type-match guard (same `NotFoundException`/`UnprocessableEntityException` as `create`), then call `updateScoped`; throw `NotFoundException` if it returns null. Add `delete(userId, id)` → call `deleteScoped`; throw `NotFoundException` when nothing was deleted.
  - [x] `transactions.controller.ts`: add `@Get(':id')`, `@Patch(':id')`, `@Delete(':id')`. Match the **transaction-categories controller** decorator style exactly: keep this module's existing per-method `@UseGuards(AuthGuard)`, `@Session() session: UserSession<typeof auth>`, `@Param('id') id: string`, swagger `@ApiOkResponse`/`@ApiNoContentResponse`/`@ApiNotFoundResponse`/`@ApiUnprocessableEntityResponse`/`@ApiUnauthorizedResponse` with `ErrorResponseDto`. DELETE uses `@HttpCode(HTTP_STATUS_CODE.NoContent)` and returns `Promise<void>`. **Transactions delete takes NO request body** (unlike category delete, which carries a reassignment DTO).
- [x] **Task 2 — Regenerate client + verify drift gate (AC: 1, 2, 3)**
  - [x] Build the API to emit `openapi.json`, then regenerate `packages/shared/src/generated/` (the openapi-ts turbo task). Confirm `TransactionsApiService.transactionsUpdate`, `transactionsFindOne`, and `transactionsRemove` now exist and the committed client matches (drift gate green). Do **not** hand-edit generated files; do **not** write any direct `fetch` (NFR6).
- [x] **Task 3 — Edit UI: route + form reuse (AC: 4, 7)**
  - [x] Add `getTransactionEditPath(id)` to `apps/money-tracker/src/constants/routes.ts` (`${ROUTES.transactions}/${id}/edit`), mirroring `getCategoryEditPath`.
  - [x] New RSC read action `apps/money-tracker/src/actions/fetch-transaction.ts` — `cache()`-wrapped, forwards cookie header, calls `TransactionsApiService.transactionsFindOne({ path: { id } })`, returns `TransactionResponseDto | null`.
  - [x] New route `apps/money-tracker/src/app/[locale]/transactions/[id]/edit/page.tsx` — mirror `transactions/new/page.tsx`: `setRequestLocale`, auth-guard via `fetchProfile` (redirect to `signIn`), parallel `getTranslations` + `fetchCategoryList` + `fetchTransaction(id)`; `redirect` to `ROUTES.transactions` when the transaction is null; render `TransactionForm` with a `transaction` prop.
  - [x] Extend `TransactionForm` + `use-transaction-form.ts` to accept an optional `transaction?: TransactionResponseDto`. Derive `isEditing`; pre-fill `getDefaultValues` from the transaction when present; switch the action between `createTransaction` and `updateTransaction(transaction.id, …)`; switch the submit label (`submit` vs new `save` key). Do not regress the create path.
  - [x] New mutation `apps/money-tracker/src/actions/update-transaction.ts` (`'use server'`) — mirror `create-transaction.ts`: `safeParse`, cookie header, `TransactionsApiService.transactionsUpdate({ path: { id }, body })`, map `error.code` to `ActionState`, `revalidatePath(ROUTES.transactions)`, redirect into the correct period/page (reuse the create flow's period+page helper).
- [x] **Task 4 — Delete UI: row actions + confirm dialog (AC: 5, 7)**
  - [x] New mutation `apps/money-tracker/src/actions/delete-transaction.ts` (`'use server'`) — like `delete-category.ts` but **no body**: `TransactionsApiService.transactionsRemove({ path: { id } })`, map error → `ActionState`, `revalidatePath(ROUTES.transactions)`.
  - [x] `TransactionList` is a **Server Component** — add a per-row client island `TransactionRowActions` (`'use client'`) holding the Edit `Link` (to `getTransactionEditPath(id)`) and a Delete button that opens an `AlertDialog` (`@supertool/ui/.../molecules/alert-dialog/AlertDialog`, `size="sm"`). Manage `open`, `isPending` (`useTransition`), and error state in a `use-delete-transaction.ts` hook; render `Alert variant="destructive"` on error code; disable the destructive action while pending. Add an "Actions" column header to the table.
- [x] **Task 5 — i18n strings, both locales (AC: 7)**
  - [x] `messages/{en,uk}/transaction-form.json`: add `editTitle` and `save`.
  - [x] `messages/{en,uk}/transactions-page.json`: add `columns.actions`, `actions.edit`, `actions.delete`, and a `delete` block (`title`, `description` with ICU `{date}`/`{amount}` interpolation — no concatenation, `confirm`, `cancel`) plus any delete error codes not already covered. Keep EN as the reference locale; keys identical across both files (parity gate).
- [x] **Task 6 — Tests (AC: 1–8, NFR1)**
  - [x] API unit specs (`*.spec.ts` co-located): controller forwards `session.user.id`/`id`/`dto` for find-one, update, delete; service throws `NotFoundException` on missing/cross-user and `UnprocessableEntityException` on type mismatch.
  - [x] Integration spec (`apps/api/test/integration/transactions.integration.spec.ts`): extend the existing Testcontainers suite — update + delete happy paths against real Postgres, **and** cross-user denial (second-user transaction returns not-found / is not deleted for the operator — FR21).
  - [x] Frontend tests (`*.test.tsx` / `*.test.ts` co-located): edit form pre-fills and routes to `updateTransaction`; delete dialog confirms/cancels and calls `deleteTransaction`; `update-transaction` and `delete-transaction` action tests assert error-code mapping and `revalidatePath`. Reuse the create flow's `vi.mock` patterns for actions, `next-intl`, navigation, and the generated SDK.

## Dev Notes

### What this story changes (and must not break)

2.2 (browse) + 2.3 (fast entry) are merged; per `epic-2-parallelization.md`, 2.4 depends on both and reuses their artifacts. The transactions module scaffold, the `TransactionForm`, the hierarchical category picker, the list table, and the create/fetch actions **already exist** — this story extends them. **Do not regress the create path**: `TransactionForm`/`use-transaction-form` must keep working when `transaction` is undefined (create mode).

**Confirmed current state (verified):**
- `TransactionsController` has only `@Get()` + `@Post()`; `TransactionsService`/`TransactionsRepository` have no update/delete. `findOneByUserIdAndId(userId, id)` **already exists** in the repository — find-one is mostly wiring.
- Generated SDK currently exposes only `transactionsFindAll` + `transactionsCreate`. `transactionsFindOne`/`transactionsUpdate`/`transactionsRemove` appear **only after** you add the endpoints and regenerate (Task 2).
- `TransactionList` is an `async` Server Component (`getTranslations` from `next-intl/server`) rendering a `Table` with no actions column — hence the client island for delete (interactivity) in Task 4.

### API patterns — copy the established style exactly

- **Reference for verbs/decorators:** `apps/api/src/modules/transaction-categories/transaction-categories.controller.ts` — it already does `@Patch(':id')` (→ `@ApiOkResponse`) and `@Delete(':id')` (`@HttpCode(204)`, `@ApiNoContentResponse`, `Promise<void>`). **Divergence:** category DELETE takes a `DeleteCategoryDto` body for reassignment; **transaction DELETE takes none.**
- **Layering (D7):** controller → service → repository only; repository is the sole DB-touching layer; repositories throw domain errors, the global filter shapes JSON.
- **Errors:** throw Nest `HttpException` subclasses with `ErrorCode` from `@supertool/shared` (`NotFound`, `UnprocessableEntity`). Envelope `{ statusCode, code, message, details? }` is produced globally.
- **Scoping (FR21):** every repository query filters by `userId`; cross-user access surfaces as **404, never 403** — there is no cross-user path. Update/delete that match zero scoped rows ⇒ `NotFoundException`.
- **Money (D1):** `amount` stays a **string** in the update DTO and response (`numeric(14,2)` in `transactions` schema, `amount > 0` check constraint already enforced). No `number`-typed amount, no float arithmetic.
- **IDs/DI:** `@Inject(ClassName)` on every constructor param; repository injects `@Inject(DRIZZLE)`. Status codes via `HTTP_STATUS_CODE` from `@supertool/shared/.../http-status-code.ts` (`NoContent = 204`).

### Frontend patterns — reuse, don't reinvent

- **Edit page:** mirror `apps/money-tracker/src/app/[locale]/transactions/new/page.tsx`. **Edit route reference:** category edit lives at `categories/[id]/edit` — same `[id]/edit` convention.
- **Form reuse:** `TransactionForm` + `use-transaction-form.ts` already hold zod (`transaction-form-schema.ts`), the type-aware `buildCategoryOptionList` picker, `Combobox`, `useActionState`+`useTransition` pending, and the `transactionForm.errors` code→message map. Add the `transaction?` prop and an `isEditing` branch for default values, action, and submit label — that is the whole edit delta.
- **Mutations (D9):** `'use server'` files (`update-transaction.ts`, `delete-transaction.ts`), verb-first kebab-case; return discriminated `ActionState` (`@supertool/next-shared/.../action-state`) — never throw across the boundary; resolve user messages from i18n by `code`, never raw API text; `revalidatePath(ROUTES.transactions)` after success. **Reference:** `actions/create-transaction.ts` (full pattern incl. period+page redirect) and `actions/delete-category.ts` (delete mutation shape).
- **Reads:** `cache()`-wrapped `fetch-*` plain async functions forwarding the cookie header — `actions/fetch-transactions.ts` / `fetch-category-list.ts` are the templates for `fetch-transaction.ts`.
- **Client only via generated client (NFR6):** import `TransactionsApiService` from `@supertool/shared/generated/sdk.gen`, types from `…/generated/types.gen`. No hand-written `fetch`.
- **Delete confirmation:** `AlertDialog` (`@supertool/ui/src/components/molecules/alert-dialog/AlertDialog`) — controlled `open`/`onOpenChange`, `AlertDialogContent size="sm"`, `AlertDialogCancel` (outline `Button`) + `AlertDialogAction` (`Button variant="destructive"`, disabled while pending). The category delete dialog in `app/[locale]/categories/...` is the working precedent.
- **Routing/i18n:** `Link`/`redirect` from `@supertool/next-shared/src/i18n/navigation/navigation`; `ROUTES` constants only; `getTranslations`/`useTranslations` with `I18N_NAMESPACE.*`; ICU interpolation for the delete description (no string concat).

### i18n

Split namespace files: `apps/money-tracker/messages/en/*.json` + `…/uk/*.json` (e.g. `transaction-form.json`, `transactions-page.json`). Namespace constants in `@supertool/shared/.../i18n-namespace.ts`. EN is the reference locale; CI key-parity gate fails on any key present in one locale but not the other (FR19/FR20) — add every new key to both files in this commit.

### Testing standards

Vitest everywhere; co-located (`*.spec.ts` API, `*.test.ts(x)` frontend); Testcontainers integration in `apps/api/test/integration/*.integration.spec.ts` against real Postgres (extend the existing `transactions.integration.spec.ts` setup — it already boots a container, migrates, seeds, and loads the operator id; an `insertSecondUserTransaction` helper exists for FR21 scoping assertions). Frontend mocks: `vi.mock` the action, `next-intl`/`next-intl/server`, the navigation module, `next/cache` (`revalidatePath`), `next/headers` (`cookies`), and `@supertool/shared/generated/sdk.gen` — copy `create-transaction.test.ts` / `TransactionForm.test.tsx`. NFR1: tests merge in this story.

### Known deferred concerns (do not fix here unless trivial)

From `deferred-work.md`: `POSITIVE_AMOUNT_PATTERN`/`CALENDAR_DATE_PATTERN` are duplicated API-side and frontend-side (pre-existing, candidate for `@supertool/shared`); and create has a non-atomic TOCTOU between `findCategoryForUser` and the write (clean-404-vs-500 under a deleted-category race). Update inherits the same TOCTOU shape — acceptable under the single-operator local runtime (`onDelete: 'restrict'`, narrow window); do not introduce a wrapping transaction unless asked.

### Project Structure Notes

- New API files: `dtos/update-transaction.dto.ts` (+ methods on existing controller/service/repository/specs) in `apps/api/src/modules/transactions/`. No new module — wire into the existing `TransactionsModule` (already provides controller/service/repository).
- New frontend files: `actions/{fetch-transaction,update-transaction,delete-transaction}.ts`; `app/[locale]/transactions/[id]/edit/page.tsx`; a `TransactionRowActions` client component + `use-delete-transaction.ts` hook under `transactions/components/`. Component files PascalCase, co-located `.module.scss`/`.test.tsx` PascalCase, dirs kebab-case.
- No new dependencies; no new patterns. If anything seems to require either, stop and consult `architecture.md` first.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Edit & Delete Transactions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision Priority Analysis (D1, D7, D8, D9)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns / Process Patterns / Enforcement Guidelines]
- [Source: _bmad-output/implementation-artifacts/epic-2-parallelization.md] — 2.4 depends on 2.2 + 2.3
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — validation-regex duplication, create TOCTOU
- [Reference pattern: apps/api/src/modules/transaction-categories/transaction-categories.controller.ts] — PATCH/DELETE verb + swagger style
- [Reference pattern: apps/api/src/modules/transactions/transactions.{controller,service,repository}.ts] — existing create/list + `findOneByUserIdAndId`
- [Reference pattern: apps/money-tracker/src/actions/{create-transaction,delete-category,fetch-transactions}.ts]
- [Reference pattern: apps/money-tracker/src/app/[locale]/transactions/new/page.tsx + components/transaction-form/*]
- [Reference pattern: packages/ui/src/components/molecules/alert-dialog/AlertDialog.tsx]
- [Reference repo: example/track-my-life — frontend typing/i18n/SCSS conventions only; never copy code (ED1)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code dev-story workflow)

### Debug Log References

- `pnpm --filter @supertool/api test` — 142 passed (incl. extended Testcontainers integration spec: update/find-one/delete happy paths + FR21 cross-user denial for update and delete).
- `pnpm --filter @supertool/money-tracker test` — 96 passed.
- `pnpm lint` / `pnpm type-check` / `pnpm stylelint` / `pnpm i18n:parity` — all green.
- `pnpm --filter @supertool/money-tracker build` — succeeds; new route `/[locale]/transactions/[id]/edit` registered, RSC/client boundaries valid.
- Drift gate: regenerated `packages/shared/src/generated/` from rebuilt `openapi.json`; re-running `generate:client` is idempotent (no further drift).

### Completion Notes List

- **API (Task 1):** `UpdateTransactionDto` mirrors create (full-replace PATCH, amount as string — D1). Repository gains `updateScoped` (returns `null` when no scoped row matched, then reloads via `findOneByUserIdAndId`) and `deleteScoped` (returns boolean from pg `rowCount`). Service `findOne`/`update`/`delete` throw `NotFoundException` for missing/cross-user rows; the category-type guard shared by create and update was extracted into a private `assertCategoryMatchesType` to avoid duplication. Controller adds `@Get/@Patch/@Delete(':id')` mirroring the transaction-categories decorator style; DELETE uses `HTTP_STATUS_CODE.NoContent` from `@supertool/shared` and takes no body.
- **Client (Task 2):** Rebuilt the API `openapi.json`, regenerated the SDK, and **rebuilt `@supertool/shared` (dist)** — the money-tracker app consumes `@supertool/shared/generated/*` from `dist`, so a regenerate-without-rebuild leaves the consuming app type-blind to the new methods. `transactionsUpdate`/`transactionsFindOne`/`transactionsRemove` now exist.
- **Edit UI (Task 3):** `TransactionForm` + `use-transaction-form` accept an optional `transaction`; `isEditing` switches default values, the action (`createTransaction` ↔ `updateTransaction`), and the submit label (`submit` ↔ `save`). Create path is unchanged (existing tests still green). The period+page redirect and request-body builder were extracted from `create-transaction.ts` into shared utils (`redirect-to-transaction-month.ts`, `build-transaction-request-body.ts`) — a `'use server'` file cannot export non-action helpers, so reuse required extraction.
- **Delete UI (Task 4):** `TransactionRowActions` client island (Edit `Link` + `AlertDialog size="sm"` confirm) embedded per row in the server-component `TransactionList`; `use-delete-transaction` manages `open`/`isPending`/error. Added an "Actions" column. The delete description uses ICU `{amount}`/`{date}` with values pre-formatted server-side and passed as props.
- **Visual QA:** Captured live via `playwright-cli` against the running app (operator session, `/transactions?period=2025-02`, 9 rows). Four screenshots in `_bmad-output/implementation-artifacts/visual-qa/2-4/`:
  - `transactions-list--actions-column__light.png` / `__dark.png` — the new right-aligned "Actions" column with Edit + Delete ghost buttons per row; alignment and rhythm consistent across both themes.
  - `delete-dialog--open__light.png` / `__dark.png` — `AlertDialog size="sm"` over the table; ICU interpolation renders correctly ("Delete the UAH 339.00 transaction from Feb 3, 2025? This action cannot be undone."), with destructive Delete + outline Cancel.
  - **Findings:** no defects. The dark-theme destructive Delete button uses the pale-pink M3 tonal fill — verified identical to the QA'd `1-9/primitives-button--destructive__dark` baseline (intended treatment, matches the dark primary's tonal lavender), so not a regression. New app SCSS (actions column, row-actions flex, edit-page card) composes already-QA'd `packages/ui` primitives with token-only styling; no `packages/ui`/`packages/shell` changes.

### File List

**API (`apps/api/`)**
- `src/modules/transactions/dtos/update-transaction.dto.ts` (new)
- `src/modules/transactions/transactions.repository.ts` (modified — `updateScoped`, `deleteScoped`)
- `src/modules/transactions/transactions.service.ts` (modified — `findOne`/`update`/`delete`, `assertCategoryMatchesType`)
- `src/modules/transactions/transactions.controller.ts` (modified — `@Get/@Patch/@Delete(':id')`)
- `src/modules/transactions/transactions.service.spec.ts` (modified — findOne/update/delete unit specs)
- `src/modules/transactions/transactions.controller.spec.ts` (modified — findOne/update/remove forwarding specs)
- `test/integration/transactions.integration.spec.ts` (modified — update/find-one/delete + FR21 cross-user denial)

**Generated client (`packages/shared/`)**
- `src/generated/sdk.gen.ts`, `src/generated/types.gen.ts`, `src/generated/index.ts` (regenerated)

**Frontend (`apps/money-tracker/`)**
- `src/constants/routes.ts` (modified — `getTransactionEditPath`)
- `src/actions/fetch-transaction.ts` (new)
- `src/actions/update-transaction.ts` (new) + `update-transaction.test.ts` (new)
- `src/actions/delete-transaction.ts` (new) + `delete-transaction.test.ts` (new)
- `src/actions/create-transaction.ts` (modified — uses extracted helpers)
- `src/app/[locale]/transactions/[id]/edit/page.tsx` + `page.module.scss` (new)
- `src/app/[locale]/transactions/utils/redirect-to-transaction-month.ts` (new)
- `src/app/[locale]/transactions/utils/build-transaction-request-body.ts` (new)
- `src/app/[locale]/transactions/components/transaction-form/TransactionForm.tsx` (modified) + `TransactionForm.test.tsx` (modified)
- `src/app/[locale]/transactions/components/transaction-form/hooks/use-transaction-form.ts` (modified)
- `src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx` + `TransactionList.module.scss` (modified) + `TransactionList.test.tsx` (modified)
- `src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx` + `TransactionRowActions.module.scss` (new) + `TransactionRowActions.test.tsx` (new)
- `src/app/[locale]/transactions/components/transaction-row-actions/hooks/use-delete-transaction.ts` (new)
- `messages/{en,uk}/transaction-form.json` (modified — `editTitle`, `save`)
- `messages/{en,uk}/transactions-page.json` (modified — actions column, action labels, delete block, error codes)

### Change Log

| Date       | Change                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| 2026-06-15 | Implemented story 2.4 — PATCH/GET/DELETE `:id` transaction endpoints, regenerated client, edit page + form reuse, delete row-action dialog, i18n (en/uk), unit + integration + frontend tests. Status → review. |

## Review Findings

_Code review 2026-06-15 (bmad-code-review: Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 8 ACs satisfied; all merge-blocking hard rules (D1/D7/FR21/NFR1/NFR6) hold; gates green._

- [x] [Review][Decision→Visual-QA] Visual Evidence Gate — RESOLVED. Captured live via `playwright-cli` (cached chromium) against the running stack: light+dark of the transactions list (new Actions column) and the open delete `AlertDialog`. Four shots in `visual-qa/2-4/`, evidence + findings recorded in the Dev Agent Record Visual QA note. Verdict: PASS, no defects (dark destructive button matches the QA'd 1-9 baseline).
- [x] [Review][Decision→Patch] Delete does not recompute pagination — RESOLVED (patched). `delete-transaction.ts` now redirects via the new `redirectAfterTransactionDelete` util, clamping to the last non-empty page for the current period; `period`/`page` threaded `TransactionListServer → TransactionList → TransactionRowActions → useDeleteTransaction`, `locale` via `useLocale()`. Covered by new tests (clamp + in-range). [apps/money-tracker/src/actions/delete-transaction.ts, .../utils/redirect-after-transaction-delete.ts]
- [x] [Review][Patch] NOT_FOUND error copy genericized — RESOLVED. Now "The transaction or category could not be found." / "Транзакцію або категорію не знайдено." (both locales), accurate for both create and edit modes. [apps/money-tracker/messages/en/transaction-form.json:32, apps/money-tracker/messages/uk/transaction-form.json:32]
- [x] [Review][Patch] Delete confirm dialog Cancel disabled while pending — RESOLVED. `AlertDialogCancel`'s button now carries `disabled={isPending}`, mirroring the confirm button; no more silent error-swallow on cancel-then-fail. [apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx]
- [x] [Review][Defer] fetch-transaction collapses 401/500 into a "not found" redirect to `/transactions` — deferred, matches the established `fetch-*` template convention (codebase-wide); auth-guard runs first so the window is narrow. [apps/money-tracker/src/actions/fetch-transaction.ts]
- [x] [Review][Defer] updateScoped non-atomic UPDATE-then-SELECT (TOCTOU) — deferred, already documented as acceptable in deferred-work.md + this story's Dev Notes (single-operator runtime, `onDelete: restrict`). [apps/api/src/modules/transactions/transactions.repository.ts]
- [x] [Review][Defer] Page-jump redirect off-by-one after editing a transaction's date (same-date `id` tie ordering not accounted for) — deferred, inherited approximation reused verbatim from the create flow. [apps/money-tracker/src/app/[locale]/transactions/utils/redirect-to-transaction-month.ts]
