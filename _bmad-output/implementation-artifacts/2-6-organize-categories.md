---
baseline_commit: 0094684ffda78590216a06d780961516721405c6
---

# Story 2.6: Organize Categories

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to create, rename, restructure, and safely delete categories in a hierarchy,
so that my seeded flat category set becomes the structure I actually think in (FR10, FR11, FR12).

This story builds **Track B** of Epic 2 (`epic-2-parallelization.md`): the entire `transaction-categories` module + its own `/categories` page. It depends **only on 2.1's schema** — not on any transactions endpoint or UI — so it runs fully in parallel with the transactions track (2.2–2.5) with near-zero file overlap. It is the **first feature HTTP module after `users`**: the shared scaffolding it needs (`AuthGuard`, `@Session()`, `ErrorResponseDto`, `ErrorCode`, global exception filter, global `ValidationPipe`) already exists — this story does **not** create it. Adding controllers/DTOs means the OpenAPI spec changes, so the generated client **must** be regenerated and committed in this story (the drift gate is live).

## Acceptance Criteria

> Field naming, the delete contract, and the hard-delete-with-reassignment model below are supertool-specific decisions that **diverge from the `example/tracker-backend-api` reference** (which uses `parentCategoryId`, soft delete, and cascade/block-on-delete). The divergences are deliberate and listed in Dev Notes "Reference patterns." Every divergence traces to a supertool hard rule: `parentId` matches the 2.1 schema column, hard-delete matches the no-`deletedAt` schema (2.1 decision), and reassignment-on-delete is FR12.

**AC1 — `transaction-categories` module + user-scoped tree read (FR10, FR21, D7, NFR6)**
**Given** the `transaction-categories` module (`controller → service → repository`, mirroring `apps/api/src/modules/users/`),
**When** `GET /api/v1/transaction-categories` is called by a signed-in user,
**Then** it returns that user's **complete** category list (no pagination — the set is bounded) as `CategoryResponseDto[]` — each row `{ id, name, type, parentId, createdAt, updatedAt }` with `type` a named `TransactionType` enum and `parentId` nullable — scoped to the authenticated user **in the repository** (FR21, never in the controller/service), through the **regenerated client** (drift gate green). The categories page assembles the parent → child tree client-side from this flat list.

**AC2 — Create a category (FR10)**
**Given** the module,
**When** `POST /api/v1/transaction-categories` is called with `{ name, type, parentId? }`,
**Then** a category is created (201 + `CategoryResponseDto`) attached to the authenticated user; `name` is trimmed and length-validated (1–100); `type` is a required `TransactionType`; when `parentId` is supplied the parent must **exist, belong to the same user, and share the same `type`** (else 422 `UNPROCESSABLE_ENTITY`); a duplicate `(userId, name, type, parentId)` is rejected **409 `CONFLICT`** (pre-checked in the service; the `NULLS NOT DISTINCT` unique index from 2.1 is the DB backstop).

**AC3 — Rename / move a category, with cycle prevention (FR10, FR11)**
**Given** an existing category owned by the user,
**When** `PATCH /api/v1/transaction-categories/:id` is called with `{ name?, parentId? }` (at least one field; `type` is **not** mutable),
**Then** the change persists: rename updates the name; `parentId: "<id>"` moves it under another parent (must exist, belong to the user, share the same `type`); `parentId: null` moves it to top level — **enabling restructuring of the seeded flat/two-level set (FR11)**. Moving a category **under itself or any of its descendants is rejected 409 `CONFLICT`** (cycle prevention via a recursive ancestry walk). A resulting duplicate `(userId, name, type, parentId)` is rejected 409 `CONFLICT`. Unknown/other-user `:id` → 404 `NOT_FOUND`.

**AC4 — Simple delete (no dependents) (FR12)**
**Given** a category with **no transactions and no child categories**,
**When** `DELETE /api/v1/transaction-categories/:id` is called with no reassignment body,
**Then** the category is hard-deleted and the API returns **204** (D7). Unknown/other-user `:id` → 404 `NOT_FOUND`.

**AC5 — Delete with reassignment, no orphans possible (FR12, D7)**
**Given** a category that **has transactions and/or child categories**,
**When** `DELETE /api/v1/transaction-categories/:id` is called,
**Then** the contract **requires reassignment targets** and no request shape can orphan data:
- if it has transactions, `reassignTransactionsToCategoryId` is **required** — absent → **422 `UNPROCESSABLE_ENTITY`**; the target must exist, belong to the user, share the deleted category's `type`, and differ from `:id`;
- if it has children, `reassignChildrenToParentId` is **required as an explicit field** — absent → **422 `UNPROCESSABLE_ENTITY`**; value `null` moves children to top level, a string moves them under that parent (must exist, belong to the user, **share the deleted category's `type`** — preserving the parent/child same-type invariant enforced by AC2/AC3, differ from `:id`, and **not be a descendant of `:id`** — cycle prevention);
- the service performs reassignment **then** delete inside **one transaction**; because 2.1's FKs are `onDelete: 'restrict'` (transactions→category, child→parent), an un-reassigned delete is impossible at the DB level — the restrict FKs are the integrity backstop behind the 422 contract.
Returns **204** on success.

**AC6 — Categories page renders the tree and drives all operations (FR10–FR12, NFR8)**
**Given** a signed-in user navigating to `/categories`,
**When** the page loads,
**Then** an RSC server wrapper fetches the list via a `fetch-*` action and renders a **tree** (top-level categories with their direct children) using the `Accordion` molecule, with create / rename / move / delete entry points. Mutations go through `'use server'` actions returning a discriminated `ActionState`, call the API **only via the generated client**, and `revalidatePath('/categories')` refreshes the view without a full reload. Create/rename/move use a category form (react-hook-form + zod, localized errors); delete uses an `AlertDialog` confirmation — and when the category has dependents, the dialog collects the **reassignment target(s)** before confirming. A localized empty state renders when the user has no categories. The page is reachable from the money-tracker home page and fully usable on a mobile-browser viewport (NFR8).

**AC7 — Both locales, in the same commit (FR19, FR20)**
**Given** every user-facing string added by this story,
**When** the story completes,
**Then** each key exists in **both** `messages/en/categories-page.json` **and** `messages/uk/categories-page.json` (real Ukrainian, not transliteration) under a new `categoriesPage` namespace registered in `I18N_NAMESPACE`, and `pnpm i18n:parity` is green.

**AC8 — Testcontainers integration coverage (NFR1, D10, FR21)**
**Given** Testcontainers integration tests against real Postgres (`apps/api/test/integration/transaction-categories.integration.spec.ts`, following `users-profile.integration.spec.ts` verbatim for container/auth setup),
**When** the suite runs,
**Then** it asserts: (a) **reassignment integrity** — counts of transactions and children before/after a delete-with-reassignment are conserved with **zero orphans** (every previously-attached transaction now points at the target; every child now points at the new parent or top level); (b) **422** when a dependent category is deleted without the required target(s); (c) **cycle prevention** — moving a category under its own descendant is rejected; (d) **user scoping** — one user cannot read, rename, move, or delete another user's category (404, asserted). Repository/service unit specs cover the tree read, duplicate pre-check, parent type-match, and the ancestry walk; controller spec mirrors `users.controller.spec.ts`. A client-spec (mirroring `health.client.spec.ts`) is optional but recommended for end-to-end typing.

**AC9 — Visual QA in both themes, recorded (UI-rendering gate — lesson from 1.4/1.8)**
**Given** the categories page and its dialogs are app-level UI (no Storybook story — these live in the app, not `packages/ui`),
**When** the story completes,
**Then** the running app is screenshotted in **both light and dark themes**, including **open/interactive states** — accordion expanded showing children, the create/edit form open, and the delete dialog open in its **reassignment** variant — and the evidence is recorded in the Dev Agent Record. Green gates + green axe without an actual look at the rendered output is how 1.4 and 1.8 shipped broken UI.

## Tasks / Subtasks

- [x] **Task 1 — API: `transaction-categories` module scaffold + tree read (AC1)**
  - [x] Create `apps/api/src/modules/transaction-categories/` with `transaction-categories.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, and a `dtos/` subfolder — structure mirrors `apps/api/src/modules/users/` exactly (one export per file, explicit `@Inject(...)` on every constructor param, **never `import type` an injectable** — SWC erases it under Vitest, DI breaks; see `nestjs-apis.md` + memory `nest-di-explicit-inject`).
  - [x] Register `TransactionCategoriesModule` in `apps/api/src/app/app.module.ts` `imports` (alongside `UsersModule`).
  - [x] Controller: `@Controller('transaction-categories')`, `@ApiTags('transactionCategories')`; every route `@UseGuards(AuthGuard)`; obtain the user id via `@Session() session: UserSession<typeof auth>` → `session.user.id` (the supertool auth pattern — there is **no** `@Request() req.user` and **no** custom `@CurrentUser` decorator; copy the import style from `users.controller.ts`). `@Get()` → `CategoryResponseDto[]` (`@ApiOkResponse({ type: CategoryResponseDto, isArray: true })`, `@ApiUnauthorizedResponse({ type: ErrorResponseDto })`).
  - [x] **Do NOT use `ParseUUIDPipe` on `:id`.** IDs are UUIDv7 generated app-side as `text` via `generateId()` (`src/database/generate-id.ts`); Nest's `ParseUUIDPipe` defaults to v3/4/5 and will 400 valid v7 ids. Take `@Param('id') id: string` plain; rely on the repository's user-scoped lookup returning nothing → service throws `NotFoundException` (the `users` module uses this same not-found-by-scoped-lookup pattern).
  - [x] Repository (`@Inject(DRIZZLE) private readonly db: Database`, mirror `users.repository.ts`): `findAllByUserId(userId)` selecting an explicit column set (`id, name, type, parentId, createdAt, updatedAt`), ordered by `name`, scoped to `userId`. Import the schema directly: `import { transactionCategories } from '../../database/schemas/transaction-categories'` (no barrel — drizzle.config scans the dir; the architecture's mention of a `schemas/index.ts` barrel is superseded by the 2.1 no-barrel decision).
  - [x] Service: `findAll(userId)` returns the repository rows mapped to `CategoryResponseDto`.

- [x] **Task 2 — API: DTOs designed for the generated client (AC1, AC2, AC3)**
  - [x] `dtos/category-response.dto.ts` — `CategoryResponseDto { id, name, type, parentId, createdAt, updatedAt }`. `type` → `@ApiProperty({ enum: transactionTypeEnum.enumValues, enumName: OPENAPI_ENUM_NAME.transactionType })` (reuse the existing `transactionType: 'TransactionType'` entry — already registered in `openapi-enum-name.ts`; values single-sourced from the `pgEnum`). `parentId` → `@ApiProperty({ type: String, nullable: true })`. Timestamps are `timestamptz` → ISO strings; type them `string` in the DTO (the wire shape), per Format Patterns. **Mirror `user-response.dto.ts`** for the `enumName` wiring.
  - [x] `dtos/create-category.dto.ts` — `CreateCategoryDto { name, type, parentId? }`: `name` `@IsString` + `@MinLength(1)` + `@MaxLength(100)` + trim (use class-transformer `@Transform` trim like the reference, or a zod-mirrored trim — keep it class-validator since the global `ValidationPipe({ whitelist: true, transform: true })` drives it); `type` `@IsIn(TRANSACTION_TYPE_LIST)` + `@ApiProperty({ enum: transactionTypeEnum.enumValues, enumName: OPENAPI_ENUM_NAME.transactionType })`; `parentId?` `@IsOptional() @IsString()`.
  - [x] `dtos/update-category.dto.ts` — `UpdateCategoryDto { name?, parentId? }`. `name?` optional, same string rules. `parentId?` `@ApiPropertyOptional({ type: String, nullable: true })` `@IsOptional()` — **must accept both `null` (move to top level) and a string**; do NOT add `type` (not mutable). Verify the global pipe preserves `null` vs absent (`whitelist:true` keeps declared `null`; absent stays `undefined`).
  - [x] `dtos/delete-category.dto.ts` — `DeleteCategoryDto { reassignTransactionsToCategoryId?: string; reassignChildrenToParentId?: string | null }`. Both optional at the DTO layer (the *conditional* requirement is enforced in the service based on actual dependents — that's where the "no orphan" guarantee lives). `reassignChildrenToParentId` must accept explicit `null`. Annotate for OpenAPI so the generated client exposes the body type.
  - [x] After DTOs land, **regenerate**: `pnpm --filter @supertool/api build` (emits `openapi.json`) then `pnpm --filter @supertool/shared generate:client`; commit the regenerated `packages/shared/src/generated/**`. Confirm a `TransactionCategoriesApiService` (byTags) appears with `transactionCategories*` methods (operationId = `<resource><Action>` camelCase). [Memory `sdk-service-classes-and-example-repo`: the SDK is `*ApiService` classes grouped byTags.]

- [x] **Task 3 — API: create / update(rename+move) / cycle prevention / duplicate guard (AC2, AC3)**
  - [x] Repository: `findByIdScoped(id, userId)`, `existsByNameTypeAndParent({ userId, name, type, parentId, excludeId? })` (use `nullsNotDistinct`-aware logic: `parentId === null` → `isNull(parentId)`), `create(...)` (set `id: generateId()` — app-side PK, D4), `update({ id, userId, data })`, and `isDescendantOf(categoryId, potentialAncestorId)` via a **recursive CTE** ancestry walk with a depth guard. [Reference: `example/tracker-backend-api/src/modules/transaction-categories/transaction-categories.repository.ts` — `isDescendantOf` recursive CTE is the exact shape; **adapt**: supertool table/columns are snake_case `transaction_categories` / `parent_id`, no `deletedAt` filter, `text` PK.]
  - [x] Service `create`: in a transaction — if `parentId`, load parent scoped; missing → 404; **parent.type !== dto.type → 422 `UnprocessableEntityException({ code: ErrorCode.UnprocessableEntity })`**; pre-check duplicate → 409 `ConflictException({ code: ErrorCode.Conflict })`; insert. [Reference service `create` — adapt error codes to `@supertool/shared/constants/error-codes` (`Conflict`/`UnprocessableEntity`), drop the cache layer entirely (supertool has no cache module).]
  - [x] Service `update`: require ≥1 field; if `parentId` provided and non-null → parent exists+scoped (404), parent shares type (422), and `isDescendantOf(parentId, id)` → 409 cycle, and `parentId !== id` → 409; pre-check duplicate against the resolved `(name, type, parentId)` excluding `id` → 409; update. `parentId: null` → set top level. [Reference service `update` — adapt: `parentId` not `parentCategoryId`, supertool error codes, no cache, add the parent-type-match rule.]
  - [x] Throw Nest `HttpException` subclasses carrying `{ code: ErrorCode.* }` — the global filter (`global-exception.filter.ts`) shapes the JSON envelope; repositories throw nothing HTTP-shaped (D7). Never map raw PG `23505` by hand — the service pre-check yields the clean 409; the unique index is the silent backstop.

- [x] **Task 4 — API: delete with reassignment (AC4, AC5)**
  - [x] Repository: `hasTransactions(categoryId, userId)`, `hasChildren(categoryId, userId)`, `reassignTransactions(fromCategoryId, toCategoryId, userId)`, `reassignChildren(fromParentId, toParentId | null, userId)`, `deleteScoped(id, userId)` — all accepting an optional `tx` for the single-transaction path (mirror the reference repo's `tx?` parameter style; **omit** soft-delete — supertool hard-deletes).
  - [x] Service `delete(id, userId, dto)` in **one** `db.transaction`: load scoped (404); compute `hasTransactions` / `hasChildren`; enforce the AC5 conditional-required contract (422 with `ErrorCode.UnprocessableEntity` when a needed target is absent); validate each provided target (exists + scoped + type-match for transactions + not `id` + `isDescendantOf` guard for the new child-parent); reassign transactions, reassign children, then delete. Controller `@Delete(':id') @HttpCode(204)` returns void with `@ApiNoContentResponse()` + `@ApiUnprocessableEntityResponse({ type: ErrorResponseDto })` + `@ApiNotFoundResponse({ type: ErrorResponseDto })`. [No direct reference counterpart — the reference *blocks/cascades*; supertool *reassigns*. New ground; the restrict FKs from 2.1 make this contract enforceable.]

- [x] **Task 5 — API tests (AC8, NFR1, D10)**
  - [x] Co-located unit specs (`*.spec.ts`, SWC-decorator Vitest config already in place): `transaction-categories.service.spec.ts` (duplicate pre-check, parent type-match, cycle rejection via a stubbed `isDescendantOf`, the delete conditional-required branches), `transaction-categories.repository.spec.ts` if pure logic warrants, `transaction-categories.controller.spec.ts` (mirror `users.controller.spec.ts`: provide a fake service, assert it's called with `session.user.id`).
  - [x] `apps/api/test/integration/transaction-categories.integration.spec.ts` — **copy the harness verbatim** from `users-profile.integration.spec.ts` (Testcontainers `postgres:16-alpine`, `TESTCONTAINERS_RYUK_DISABLED`, `BOOT_TIMEOUT_MS`, `Wait.forLogMessage(/ready to accept connections/u, 2)`, `signUp`/`signInForCookie`/cookie extraction). Seed a couple of categories + a transaction through the API/repo, then assert AC8 (a)–(d). Arrange-Act-Assert; `inputX`/`expectedX`/`actualX` naming.
  - [x] Gate locally with `--force` (turbo cache masks results — memory `turbo-cache-masks-gate-results`): `pnpm --filter @supertool/api type-check lint test`. Integration tests need Docker. Use `pnpm` package scripts, never `node_modules/.bin`; retry on the transient pnpm `H.replace` crash (memory `run-tests-via-pnpm-scripts`).

- [x] **Task 6 — Frontend: i18n namespace + messages (AC7)**
  - [x] Add `categoriesPage: 'categoriesPage'` to `I18N_NAMESPACE` (`packages/shared/src/constants/i18n-namespace.ts`) and map it to `'categories-page'` in `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts`. [Reference for namespace structure: `example/track-my-life/apps/money-tracker/messages/{en,uk}/` (the reference `categoriesPage` namespace) — adapt key names to this story's UI.]
  - [x] Create `apps/money-tracker/messages/en/categories-page.json` and `…/uk/categories-page.json` with every string (title, create/edit/rename/move/delete labels, type labels, empty state, reassignment prompts, validation + API-error messages keyed by `ErrorCode`). Real Ukrainian. Both files in this commit (FR20 parity gate).

- [x] **Task 7 — Frontend: server actions + fetch (AC6)**
  - [x] `apps/money-tracker/src/actions/fetch-category-list.ts` — plain async (`cache(...)`, NOT `'use server'`), mirrors `fetch-profile.ts`: `cookies()` → `createServerApiClient({ cookieHeader })` → `TransactionCategoriesApiService.transactionCategoriesFindAll(...)` → returns `CategoryResponseDto[]`. [Reference: `apps/money-tracker/src/actions/fetch-profile.ts` (supertool) for the exact shape; `example/track-my-life/.../actions/fetch-category-list.ts` for intent.]
  - [x] `create-category.ts`, `update-category.ts`, `delete-category.ts` — `'use server'`, mirror `update-profile.ts`: validate with a zod schema, call the generated `*ApiService` with `createServerApiClient`, map `{ error }` → `ActionState` (`{ status: 'error', code: error?.code ?? 'UNKNOWN' }`), `revalidatePath(ROUTES.categories)` on success. `delete-category.ts` takes `(id, reassignment?)` and passes the `DeleteCategoryDto` body. [Reference: supertool `update-profile.ts` is the binding pattern; `example/track-my-life/.../categories/actions/{create,update,delete}-category.ts` for intent — note the example uses `updateTag`/`ServerActionResult`; supertool uses `revalidatePath`/`ActionState`.]
  - [x] Add `categories: '/categories'` to `ROUTES` (`apps/money-tracker/src/constants/routes.ts`). Never hardcode the path literal anywhere.

- [x] **Task 8 — Frontend: page, tree, form, delete dialog (AC6, AC9, NFR8)**
  - [x] `app/[locale]/categories/page.tsx` — server page: `setRequestLocale`, `fetchProfile()` redirect-if-unauthenticated (mirror `settings/page.tsx`), then a `<Suspense>`-wrapped server wrapper (`CategoryListServer`) that calls `fetch-category-list` and renders the client tree. Extract the Suspense skeleton fallback to a module-level constant (`jsx-no-jsx-as-prop` lint rule). [Reference: supertool `settings/page.tsx` for the page+redirect+RSC shape; `example/track-my-life/.../categories/page.tsx` for the list-server/Suspense split.]
  - [x] `components/category-tree/CategoryTree.tsx` (`'use client'`, `FC<Props>`) — build the parent→child map client-side and render with the `Accordion` molecule (`@supertool/ui/src/components/molecules/accordion/Accordion`), each row with rename/move/delete actions and a `Badge` for type; localized empty state. [Reference: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/categories/components/category-tree/CategoryTree.tsx` — the `buildCategoryHierarchy` + `Accordion type="multiple"` pattern is the exact shape; **adapt**: `parentId` not `parentCategoryId`, supertool `@supertool/ui` import paths + PascalCase component files, `translate` (not `t`), `INCOME`/`EXPENSE`→ supertool lowercase `income`/`expense`.]
  - [x] Category form (create + edit/rename/move) — react-hook-form + zod (`zodResolver`), a `category-form-schema.ts` (`name` min 1, `type` enum, `parentId` optional/nullable), rendered in a `Dialog` (or dedicated route — Dialog preferred for mobile/single-page). Parent picker = `Select`/`Combobox` of the user's categories of the same `type` (exclude self + descendants when editing). Submit via the server action through `useActionState`/`useTransition`, disable while pending. [Reference: supertool `ProfileForm.tsx` + `use-profile-form.ts` for the RHF+zod+`useActionState` wiring and `Field`/`Combobox`/`Select` composition; `example/.../categories/constants/category-form-schema.ts` + `category-form-page` for intent.]
  - [x] `components/delete-category-dialog/DeleteCategoryDialog.tsx` — `AlertDialog` (`@supertool/ui/src/components/molecules/alert-dialog/AlertDialog`); when the target has dependents, render reassignment pickers (transactions → another same-type category; children → another parent or "top level") and require them before the destructive confirm. [Reference: `example/track-my-life/.../categories/components/delete-category-dialog/DeleteCategoryDialog.tsx` for the AlertDialog composition; **adapt**: the example *cascades*; supertool *reassigns* — the dialog must collect targets, not just confirm a cascade.]
  - [x] Make `/categories` reachable: add a link/button to it from the money-tracker home page (`app/[locale]/page.tsx`) using `Button` as `NavigationLink`/`Link` + `ROUTES.categories`. (A dedicated in-app nav across dashboard/transactions/categories is a broader Epic-2/3 concern and is **out of scope** here — this story only guarantees the page is reachable.)
  - [x] Frontend tests co-located (`*.test.tsx`): tree renders parents+children and fires `onDelete`/edit; form validation + pending state; delete dialog shows reassignment controls when dependents exist. (`packages/ui` test gotchas don't apply here — these are app tests; follow the money-tracker vitest config used by `ProfileForm.test.tsx`.)

- [x] **Task 9 — Visual QA + gates (AC9, all)**
  - [x] Run the app (`pnpm dev`, Postgres via `docker compose up postgres`; the seed makes the tree non-empty on first boot). Screenshot `/categories` in **light and dark**, including accordion expanded, the create/edit form open, and the delete dialog in its **reassignment** variant. Record paths/notes in the Dev Agent Record (the 1.4/1.8 lesson — green gates ≠ correct UI).
  - [x] Full gates with `--force`: `pnpm type-check lint test i18n:parity` (+ `stylelint` for any new `.module.scss`, `fmt:check`). Confirm the client-drift gate is green against the committed regenerated client.

### Review Findings

_Code review 2026-06-14 — 3 layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor). All quality gates green; all AC1–AC9 assessed MET, AC9 visual evidence independently verified._

- [x] [Review][Decision→Patch] Children reassignment target is not type-checked on delete — **FIXED**. Decision: tighten the contract. `resolveChildrenTarget` now loads the target and calls `assertSameType(target.type, params.type)` (mirroring `resolveTransactionTarget`); AC5 updated to require the children target share the deleted category's `type`. Added service unit test "rejects reassigning children to a different-type parent with 422" + extracted `requireChildrenTargetField`/`assertValidChildTarget` helpers to keep `max-statements` clean. (blind+edge, was High)
- [x] [Review][Patch] Delete dialog does not enforce explicit reassignment targets [apps/money-tracker/src/app/[locale]/categories/components/delete-category-dialog/hooks/use-delete-category.ts] — **FIXED**. `childrenTargetId` now defaults to `''` (no silent top-level default); `handleConfirm` blocks submit and surfaces `errors.reassignChildrenRequired` / `errors.reassignTransactionsRequired` (previously dead keys, now wired) when a required target is empty, instead of relying on a server-422 loop. Children combobox placeholder changed to the neutral "select" prompt. Added two dialog tests covering both guards. (blind+edge)
- [x] [Review][Defer] Concurrent delete-with-reassign of two sibling parents can form a cycle [apps/api/src/modules/transaction-categories/transaction-categories.service.ts] — deferred. `isDescendantOf` is read at READ COMMITTED with no row/advisory lock; two interleaved deletes reparenting children at each other could orphan a cycle. Practically unreachable in the single-operator local-only runtime.
- [x] [Review][Defer] `fetch-category-list` collapses API errors into an empty list [apps/money-tracker/src/actions/fetch-category-list.ts] — deferred. `data ?? []` discards `error`, so a transient API failure renders the empty state. The 401 case is already handled upstream by the page's `fetchProfile()` redirect; likely consistent with the existing `fetch-profile` pattern.

## Dev Notes

### Architecture patterns & hard rules binding this story

- **D7 — layering.** `controller → service → repository → Drizzle`, no skipping. Controllers never touch the DB. Repositories throw domain/no errors; only the global filter shapes HTTP error JSON.
- **FR21 — user scoping in the repository.** Every query filters by `userId`; there is no cross-user path. Other-user `:id` resolves to 404 (not 403) via scoped lookup — same as `users`.
- **NFR6 — generated client only.** No hand-written `fetch('/api/*')`. Server actions/fetchers use `createServerApiClient` + the generated `TransactionCategoriesApiService`. Regenerate + commit the client in this story.
- **Money is strings (D1).** Categories carry no money, but if you ever read transaction amounts here, they are strings — never `number`. (Out of scope: this story does not render amounts.)
- **Dates.** `createdAt`/`updatedAt` are `timestamptz` → ISO strings in DTOs. No transaction `date` handling in this story.
- **NestJS DI.** Explicit `@Inject(...)` on every constructor param; **never `import type` an injectable** (SWC erases it under Vitest → DI fails). Non-class providers use `Symbol` tokens (`DRIZZLE`). [memory `nest-di-explicit-inject`]
- **No barrels, no comments, named exports, one export per file, arrow functions, `list`-suffixed arrays, verb-prefixed function names** (`javascript.md`). No `enum` keyword — derive unions from the `pgEnum` (`typescript.md`).
- **i18n.** New top-level namespace `categoriesPage` → one entry in `I18N_NAMESPACE`; nested sub-namespaces via template literal at the call site; `useTranslations` bound as `translate` (the `id-length` rule rejects `t`); both locales same commit. [`i18n.md`]
- **React/RSC.** RSC server wrapper + `<Suspense>` + skeleton; mutations via `'use server'` returning `ActionState`; `revalidatePath` after success; client state = UI only (dialog open, editing entity), never list data; `FC<Props>` typing; `cn` for class composition; `ROUTES` for all paths; `NavigationLink` for active-aware links. [`react.md`]

### The delete-with-reassignment contract (the heart of FR12)

Two FKs from 2.1 are `onDelete: 'restrict'`: `transactions.(userId, categoryId) → transaction_categories.(userId, id)` and `transaction_categories.parentId → transaction_categories.id`. So Postgres **physically rejects** deleting a category that still has transactions or children. That is the integrity backstop. The API contract surfaces it as a clean 422 *before* hitting the DB, and the service reassigns inside one transaction so the eventual `DELETE` always succeeds. There is intentionally **no** request shape that deletes-and-orphans: the only delete path either has no dependents (AC4) or carries the required targets (AC5).

Distinguishing `reassignChildrenToParentId: null` (→ top level) from "field absent" (→ 422 if children exist) matters. The global `ValidationPipe({ whitelist: true, transform: true })` keeps a declared `null` and leaves an absent key `undefined` — the service branches on `=== undefined` vs `=== null`. Add a unit test for both.

### Source tree — what this story touches

NEW (API):
- `apps/api/src/modules/transaction-categories/transaction-categories.{module,controller,service,repository}.ts`
- `apps/api/src/modules/transaction-categories/dtos/{category-response,create-category,update-category,delete-category}.dto.ts`
- co-located `*.spec.ts` for service/controller (+ repository if warranted)
- `apps/api/test/integration/transaction-categories.integration.spec.ts`

NEW (frontend):
- `apps/money-tracker/src/actions/fetch-category-list.ts`, `create-category.ts`, `update-category.ts`, `delete-category.ts`
- `apps/money-tracker/src/app/[locale]/categories/page.tsx` (+ `page.module.scss`)
- `…/categories/components/category-list-server/CategoryListServer.tsx`
- `…/categories/components/category-tree/CategoryTree.tsx` (+ `.module.scss`, `.test.tsx`)
- `…/categories/components/category-form/CategoryForm.tsx` (+ hook, schema, `.module.scss`, `.test.tsx`)
- `…/categories/components/delete-category-dialog/DeleteCategoryDialog.tsx` (+ hook, `.test.tsx`)
- `apps/money-tracker/messages/{en,uk}/categories-page.json`

UPDATE (read fully before editing — current behavior to preserve):
- `apps/api/src/app/app.module.ts` — add `TransactionCategoriesModule` to `imports`; **preserve** the existing `EnvModule`/`LoggerModule`/`AuthModule`/`DatabaseModule`/`HealthModule`/`UsersModule` wiring and the `APP_FILTER`/`AuthDatabaseLifecycle` providers.
- `packages/shared/src/constants/i18n-namespace.ts` — append `categoriesPage`; **preserve** existing namespaces + the `I18Namespace` union derivation.
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — append the `categoriesPage → 'categories-page'` mapping (the `Record<I18Namespace, string>` must stay exhaustive or it won't compile).
- `apps/money-tracker/src/constants/routes.ts` — append `categories: '/categories'`; **preserve** existing routes.
- `apps/money-tracker/src/app/[locale]/page.tsx` — add the link to `/categories`; **preserve** whatever the home page currently renders.
- `packages/shared/src/generated/**` — regenerated, not hand-edited.
- `apps/api/openapi.json` — emitted by `build`, committed.

Do **not** add `transaction-categories` to `packages/shared/src/constants/tools.ts` — that registry lists *tools* (whole apps), not in-app pages. Categories is a route inside money-tracker.

### Testing standards

- Vitest everywhere (D10). API: SWC-decorator config already in place, co-located `*.spec.ts`, integration in `test/integration/*.integration.spec.ts` via Testcontainers `postgres:16-alpine`. Frontend: `*.test.tsx` beside the component (money-tracker vitest config; see `ProfileForm.test.tsx`).
- Integration harness: copy `users-profile.integration.spec.ts` verbatim for container lifecycle + auth/cookie helpers.
- Arrange-Act-Assert; `inputX`/`expectedX`/`actualX`. Gate with `--force`; `pnpm` scripts only; retry the transient `H.replace` pnpm crash.

### Reference patterns (study before implementing — `example/` is reference-only, ED1: adapt, never copy or import)

**Backend — `example/tracker-backend-api/src/modules/transaction-categories/`:**
- `transaction-categories.controller.ts` — route layout (find-all / find-by-id / create / patch / delete). **Diverge:** supertool uses `@Session()` not `@Request() req.user`; **no** `ParseUUIDPipe` (UUIDv7 text ids); delete returns **204** and takes a reassignment body (the reference returns a message + blocks); list returns a flat array, **not** a paginated `{ data, meta }` (categories are bounded).
- `transaction-categories.service.ts` — `create`/`update` flow, parent existence check, `checkDuplicateCategory`, and `isDescendantOf`-based cycle prevention. **Diverge:** error codes from `@supertool/shared/constants/error-codes` (`Conflict`/`UnprocessableEntity`); **no cache layer**; add the **parent-type-match** rule; replace block-on-delete with **reassign-then-delete**.
- `transaction-categories.repository.ts` — the **recursive-CTE `isDescendantOf`** is the exact pattern to adapt. **Diverge:** snake_case `transaction_categories`/`parent_id`, `text` PK via `generateId()`, **no `deletedAt`/soft-delete** (so drop every `isNull(deletedAt)` clause and use hard `delete`), `nullsNotDistinct` duplicate logic.
- `dtos/{create-category,update-category,category-response}.dto.ts` — DTO shape + `enumName` wiring. **Diverge:** field `parentId` not `parentCategoryId`; reuse `OPENAPI_ENUM_NAME.transactionType`; enum values from the supertool `pgEnum`.
- **Supertool in-repo binding references** (these, not the example, define the house style): `apps/api/src/modules/users/{users.controller,users.service,users.repository,users.module}.ts`, `dtos/{update-user,user-response}.dto.ts`, `apps/api/src/shared/{guards/auth.guard.ts,dtos/error-response.dto.ts,filters/global-exception.filter.ts,constants/openapi-enum-name.ts}`, `apps/api/src/database/schemas/{transaction-categories,enums}.ts`, `apps/api/test/integration/users-profile.integration.spec.ts`, `apps/api/src/modules/health/health.client.spec.ts`.

**Frontend — `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/categories/`:**
- `components/category-tree/CategoryTree.tsx` — `buildCategoryHierarchy` + `Accordion type="multiple"` tree. **Diverge:** `parentId`, supertool `@supertool/ui` PascalCase import paths, `translate`, lowercase type values.
- `components/delete-category-dialog/DeleteCategoryDialog.tsx` — `AlertDialog` composition. **Diverge:** collect reassignment targets (not cascade).
- `constants/category-form-schema.ts`, `components/category-form-page/*` — RHF+zod category form. **Diverge:** supertool composes `Field`/`Select`/`Combobox` from `@supertool/ui`; render in a `Dialog`.
- `page.tsx`, `components/category-list-server/CategoryListServer.tsx` — page + Suspense list-server split.
- `actions/{create,update,delete}-category.ts` — action intent. **Diverge:** supertool uses `createServerApiClient` + generated `*ApiService` + `ActionState` + `revalidatePath` (the example's `server-api` singleton / `ServerActionResult` / `updateTag` are a different stack).
- **Supertool in-repo binding references:** `apps/money-tracker/src/actions/{fetch-profile,update-profile}.ts`, `app/[locale]/settings/page.tsx` + `components/profile-form/{ProfileForm.tsx,hooks/use-profile-form.ts,constants/profile-form-schema.ts}`, `packages/shell/src/components/user-menu/UserMenu.tsx` (DropdownMenu/AlertDialog usage), and the `@supertool/ui` molecules `accordion/Accordion`, `alert-dialog/AlertDialog`, `field/Field`, `combobox/Combobox`, `card/Card`, atoms `button/Button`, `badge/Badge`, `select/Select`, `input/Input`.

### Project Structure Notes

- API module slots into `apps/api/src/modules/transaction-categories/` exactly per `architecture.md` §Project Structure and the F3 Requirements→Structure mapping (`modules/transaction-categories` + `category-tree` components).
- The page lives at `app/[locale]/categories/` (the architecture tree lists `categories/` under `app/[locale]/`). The reference's `(app-layout)` route group does not exist in supertool — place the page directly under `[locale]/` like `settings/`.
- Variances from reference, all intentional & noted above: `parentId`, hard-delete-with-reassignment, no cache, no soft-delete, `@Session()` auth, flat (non-paginated) list, supertool client/action stack.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6: Organize Categories]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Transactions & Categories]
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#F3 — Categories] (FR10, FR11, FR12)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] (naming, formats, layering, error envelope)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] (module + page placement, FR12 reassignment lives in the delete endpoint)
- [Source: _bmad-output/implementation-artifacts/epic-2-parallelization.md] (2.6 = Track B, depends on 2.1 only, parallel with 2.2–2.5)
- [Source: _bmad-output/implementation-artifacts/2-1-seed-the-real-data.md] (schema, `text` PK via `generateId`, `parentId`, restrict FKs, `nullsNotDistinct`, two-level seeded hierarchy, `transactionTypeEnum`)
- [Source: .claude/rules/nestjs-apis.md] (DI, DTO/enumName, repository-only DB, env discipline)
- [Source: .claude/rules/react.md, .claude/rules/i18n.md, .claude/rules/typescript.md, .claude/rules/javascript.md]
- [Source: apps/api/src/modules/users/*] (binding module pattern)
- [Source: apps/api/test/integration/users-profile.integration.spec.ts] (auth-scoped Testcontainers harness)
- Project memory: `nest-di-explicit-inject`, `sdk-service-classes-and-example-repo`, `follow-example-repo-patterns`, `ui-stories-need-visual-qa`, `turbo-cache-masks-gate-results`, `run-tests-via-pnpm-scripts`, `drizzle-nullsnotdistinct-on-unique-not-uniqueindex`, `seed-data-has-subcategory`, `pascalcase-component-filenames`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- DB-touching layer & transactions: `DatabaseExecutor` type added to `database.types.ts` so the service can run reassign-then-delete inside one `repository.runInTransaction` callback without the service ever calling Drizzle directly (D7 preserved — only the repository touches the DB, transactions included).
- Lint (oxlint nursery): `max-params` (max 3) forced RO-RO objects on repository (`isDescendantOf`/`reassign*`) and service helpers; `max-statements` (max 10) forced extracting helpers in `getDescendantIdSet`, `use-delete-category` (combined `useMemo`, module-level `buildReassignment`), and the integration spec; `no-magic-numbers` flagged `Parameters<...>[1]` → switched to importing `DeleteCategoryDto`; `no-non-null-assertion` on insert `.returning()` row → explicit guard.
- `exactOptionalPropertyTypes`: `DuplicateCheckParams.excludeId` typed `string | undefined`.
- Generated client: operationIds resolve to `transactionCategoriesFindAll/Create/Update/Remove` via `buildResourceActionOperationId`; `TransactionType` emitted as a single shared named type used by every DTO. `openapi.json` is gitignored — only the committed `packages/shared/src/generated/**` is the drift-gated artifact.
- Form approach: the `Dialog` molecule is trigger-based/uncontrolled, so the create/edit form uses **dedicated routes** (`/categories/new`, `/categories/[id]/edit`) mirroring the reference `CategoryFormPage` pattern; delete uses the controlled `AlertDialog` molecule. No `packages/ui` changes were needed.
- Delete dialog handles the unknown-transactions case with a two-step flow: a category with children switches straight to the reassignment variant; a childless category attempts a plain delete and reveals the reassignment pickers only if the API returns 422.
- No `lucide-react` in `apps/money-tracker` deps — used text action buttons (Edit/Delete/New category) instead of icons to avoid adding a dependency.

### Completion Notes List

- **API** — `transaction-categories` module (controller → service → repository → Drizzle, registered in `app.module.ts`): user-scoped flat tree read; create/rename/move with parent existence + type-match (422), duplicate pre-check (409), and recursive-CTE cycle prevention (409); hard delete with required reassignment targets (422 when absent) executed reassign-then-delete in one transaction. All errors flow through the global filter with explicit `ErrorCode`. No `ParseUUIDPipe` (UUIDv7 text ids). Tests: service + controller unit specs (18) and a Testcontainers integration spec (5) asserting AC8 (a) reassignment integrity / zero orphans, (b) 422 on missing targets, (c) cycle prevention, (d) cross-user 404. Full API suite: **101 passed**.
- **Client** — regenerated and committed `packages/shared/src/generated/**`; `TransactionCategoriesApiService` with the four methods + `CategoryResponseDto`/`CreateCategoryDto`/`UpdateCategoryDto`/`DeleteCategoryDto`/`TransactionType` types.
- **Frontend** — `categoriesPage` i18n namespace (en + uk, real Ukrainian, `i18n:parity` green); `fetch-category-list` (cache) + `create/update/delete-category` server actions (generated client + `ActionState` + `revalidatePath`); `/categories` page (redirect-if-unauthenticated + Suspense + `CategoryListServer`); `CategoryTree` (Accordion, type `Badge`, empty state); dedicated `new`/`[id]/edit` form routes with `CategoryForm` (RHF + zod, type locked on edit, parent picker excludes self + descendants); `DeleteCategoryDialog` (AlertDialog + reassignment pickers); home-page link to `/categories`. Co-located tests: **13 passed**.
- **Visual QA (AC9)** — ran the app (docker postgres + API dist + web dev), signed in as the seeded operator, drove headless Chromium (throwaway `playwright-core` in `/tmp`, cached `ms-playwright/chromium-1208`; nothing added to the repo). Screenshots reviewed in **both themes**: `/tmp/cat-qa/shots/{categories,categories-expanded,category-form,delete-reassign}-{light,dark}.png` + `categories-mobile-light.png`. Verified: tree with Income/Expense badges; accordion **expanded** showing children + "No subcategories"; create **form open**; delete dialog **reassignment variant** ("Move transactions to" + "Move subcategories to → Top level"); mobile (390px) usable (NFR8). All render correctly — no broken UI.
- **Gates** (forced): repo `type-check` (9/9), `lint` (clean), `test` (api 101, money-tracker 13, ui 77, shell 13, widgets 9, next-shared 10), `i18n:parity`, `stylelint`, `fmt:check` — all green.

### File List

**API (new)**
- `apps/api/src/modules/transaction-categories/transaction-categories.module.ts`
- `apps/api/src/modules/transaction-categories/transaction-categories.controller.ts`
- `apps/api/src/modules/transaction-categories/transaction-categories.service.ts`
- `apps/api/src/modules/transaction-categories/transaction-categories.repository.ts`
- `apps/api/src/modules/transaction-categories/dtos/{category-response,create-category,update-category,delete-category}.dto.ts`
- `apps/api/src/modules/transaction-categories/transaction-categories.controller.spec.ts`
- `apps/api/src/modules/transaction-categories/transaction-categories.service.spec.ts`
- `apps/api/test/integration/transaction-categories.integration.spec.ts`

**API (modified)**
- `apps/api/src/app/app.module.ts` — register `TransactionCategoriesModule`
- `apps/api/src/database/database.types.ts` — `DatabaseExecutor`/`DatabaseTransaction` types

**Shared (modified)**
- `packages/shared/src/constants/i18n-namespace.ts` — `categoriesPage`
- `packages/shared/src/generated/{index,sdk.gen,types.gen}.ts` — regenerated client

**Frontend (new)**
- `apps/money-tracker/src/actions/{fetch-category-list,create-category,update-category,delete-category}.ts`
- `apps/money-tracker/src/constants/transaction.ts`
- `apps/money-tracker/src/app/[locale]/categories/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/categories/new/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/categories/[id]/edit/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/categories/constants/category-form-schema.ts`
- `apps/money-tracker/src/app/[locale]/categories/utils/category-hierarchy.ts`
- `apps/money-tracker/src/app/[locale]/categories/components/category-list-server/CategoryListServer.tsx`
- `apps/money-tracker/src/app/[locale]/categories/components/category-tree/CategoryTree.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/categories/components/category-form/CategoryForm.tsx` (+ `.module.scss`, `.test.tsx`, `hooks/use-category-form.ts`)
- `apps/money-tracker/src/app/[locale]/categories/components/delete-category-dialog/DeleteCategoryDialog.tsx` (+ `.module.scss`, `.test.tsx`, `hooks/use-delete-category.ts`)
- `apps/money-tracker/messages/{en,uk}/categories-page.json`

**Frontend (modified)**
- `apps/money-tracker/src/constants/routes.ts` — `categories`, `categoriesNew`, `getCategoryEditPath`
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — `categoriesPage` → `categories-page`
- `apps/money-tracker/src/app/[locale]/page.tsx` — link to `/categories`
- `apps/money-tracker/messages/{en,uk}/home-page.json` — `categoriesLink`

## Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 2.6 drafted: transaction-categories module (tree read + CRUD + cycle prevention + reassign-on-delete), categories page (tree/form/delete dialog), i18n, Testcontainers integration coverage, dual-theme visual QA. Status → ready-for-dev. |
| 2026-06-14 | Implemented story 2.6: transaction-categories API module (controller/service/repository/DTOs + unit + Testcontainers specs), regenerated client, categoriesPage i18n (en/uk), fetch + create/update/delete server actions, /categories page with tree + dedicated form routes + reassignment delete dialog, home link. All gates green (type-check, lint, test 101 API/13 web, i18n:parity, stylelint, fmt); dual-theme visual QA recorded. Status → review. |
