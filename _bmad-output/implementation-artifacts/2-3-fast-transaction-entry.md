---
baseline_commit: de6491e
---

# Story 2.3: Fast Transaction Entry

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to add a transaction in seconds,
so that daily tracking happens at the moment of spending — anywhere, including my phone.

This story adds the **write side** to the `transactions` module that Story 2.2 created read-only: a `POST /api/v1/transactions` create endpoint (controller `create` → operationId `transactionsCreate`, service `create`, repository `create`), a `CreateTransactionDto`, and the frontend entry flow — a dedicated `/transactions/new` route, the `TransactionForm` (react-hook-form + zod), a `create-transaction` `'use server'` action returning `ActionState`, and an "Add transaction" affordance on the transactions view.

**The category picker consumes existing code — it builds nothing new.** Story 2.6 (Organize Categories) is **done**: `GET /api/v1/transaction-categories` (`TransactionCategoriesApiService.transactionCategoriesFindAll`), the `fetchCategoryList()` action (`apps/money-tracker/src/actions/fetch-category-list.ts` → `CategoryResponseDto[]`), and the `buildCategoryHierarchy` util (`apps/money-tracker/src/app/[locale]/categories/utils/category-hierarchy.ts`) all already exist. This story **reuses them** for the form's category picker — see Dev Notes "Reusing the 2.6 categories read".

## Acceptance Criteria

**AC1 — Create endpoint: typed, user-scoped, decimal-safe (D1, D7, FR6, FR21, NFR6)**
**Given** the `transactions` module,
**When** `POST /api/v1/transactions` is called by an authenticated user with a valid body `{ type, amount, currency, categoryId, date, note? }`,
**Then** it inserts one row **scoped to the authenticated user** (`userId` from the session, never from the body — FR21), generates a UUIDv7 id app-side via `generateId()`, leaves `import_key` **NULL** (manual entries are never deduplicated — Dev Notes), persists `amount` as a **string** into the `numeric(14,2)` column (D1 — never `parseFloat`/`Number`), and returns **201** with the created row serialized as the existing `TransactionResponseDto` (id, date, type, amount string, currency, note, categoryId, categoryName, categoryParentName, createdAt, updatedAt) — reachable through the **regenerated generated client** with the drift gate green (NFR6, D8). The controller method is named `create` so the operationId factory yields `transactionsCreate`.

**AC2 — Server-side validation rejects bad input with a typed error envelope (D1, D7, FR21)**
**Given** the `CreateTransactionDto`,
**When** the body is invalid,
**Then** the global exception filter returns `{ statusCode, code, message, details? }` with the right `ErrorCode`:
- `type` must be one of `transactionTypeEnum.enumValues` (`income`/`expense`); `currency` must be in `CURRENCY_CODE_LIST`; `date` must match `^\d{4}-\d{2}-\d{2}$` (calendar date, no `@IsDateString`); `note` optional string (defaults to `''`). Shape failures → `400 VALIDATION_ERROR`.
- `amount` is a **string** that is a positive decimal with at most 2 fraction digits and at most 12 integer digits (fits `numeric(14,2)`); zero, negative, or non-numeric → `400 VALIDATION_ERROR`. **Amount is validated as a string** — no float coercion (D1).
- `categoryId` must reference a category that **exists and belongs to the authenticated user** (pre-checked in the service via a user-scoped lookup); otherwise `404 NOT_FOUND` — never a raw Postgres FK-violation 500. The category's `type` must equal the transaction `type`; a mismatch → `422 UNPROCESSABLE_ENTITY` (mirrors the 2.6 parent-type-match contract and the type-filtered picker — no silently mis-typed data).

**AC3 — Form reachable in one interaction, offering every FR6 field (NFR5, FR6)**
**Given** the transactions view (the tracker's main view),
**When** I want to record a spend,
**Then** an **"Add transaction"** affordance is reachable in **one interaction** (NFR5) — a button in the `/transactions` page header navigating to `/transactions/new` — and the form offers: **type** (expense/income toggle, default `expense`), **amount**, **currency** (defaulting to the profile's `defaultCurrency` when set), **category** (a searchable `Combobox` showing only the categories whose `type` matches the selected transaction type, rendering "Parent / Child" for child categories), **date** (defaulting to **today**, computed from local date parts — never `new Date(string)`), and **optional note** (FR6). Switching type re-scopes the category options and clears a now-invalid category selection.

**AC4 — Submit creates and shows the entry without a full page reload (NFR5, D9)**
**Given** the form (react-hook-form + zod),
**When** I submit a valid entry,
**Then** the `'use server'` `create-transaction` action calls `TransactionsApiService.transactionsCreate` via the generated client (201 + body), `revalidatePath` refreshes the transactions list, and the user lands back on `/transactions` at the **month of the created transaction** so the new row is immediately visible — **no full page reload** (NFR5). The submit button is **disabled while pending** (`isPending`).

**AC5 — Invalid input blocks client-side with localized messages; API errors map by code (D1, FR19/FR20)**
**Given** invalid input (e.g. non-positive or malformed amount, missing category),
**When** submission is attempted,
**Then** **zod blocks client-side** with localized field messages (resolved by message-key, like the profile/auth/category forms — never raw text), amounts are **strings end-to-end, two decimals, dot separator** (D1), and any **API validation/`NOT_FOUND`/`UNPROCESSABLE_ENTITY` error maps to an i18n message by `ErrorCode`** surfaced in a destructive `Alert` (never raw API text). All new strings exist in **both** `en` and `uk` in the same commit (FR19/FR20 parity gate).

**AC6 — Mobile-usable; this flow is the performance-budget anchor (NFR8, NFR5)**
**Given** a mobile-browser viewport,
**When** I complete the entry flow,
**Then** it is fully usable — responsive layout via the shared `packages/ui` SCSS breakpoint mixins (NFR8), not ad-hoc media queries. This entry flow is the NFR5 performance anchor: form-in-one-interaction + submit-to-visible without reload.

**AC7 — Tests merge with the story (NFR1, D10)**
**Given** the feature,
**When** tests run,
**Then** they include: **API** — `transactions.service` create specs (mocked repo: assert `NOT_FOUND` when category lookup is null, `422` on type mismatch, `userId`-from-session + `note ?? ''` on the happy path) and `transactions.controller` create spec (forwards `session.user.id` + body); **Testcontainers integration** (extend `transactions.integration.spec.ts`, harness copied verbatim per 2.2) proving (a) create inserts a user-scoped row with `import_key` NULL and the exact string amount, (b) creating against **another user's `categoryId`** is rejected (no cross-user insert — FR21), (c) a type-mismatched category is rejected; **Frontend** — `TransactionForm` component test (zod validation surfaces, pending disables submit, type switch re-scopes categories and clears an invalid selection), the create-action error-mapping, and the form-schema/category-option/currency-option/`getTodayDate` unit specs. All new user-facing strings exist in both locales.

## Tasks / Subtasks

> Read every file marked **UPDATE** in "Source tree" before editing it. The binding in-repo templates: `apps/api/src/modules/transactions/*` (read side, this story extends it) and `apps/api/src/modules/users/*` (full module shape, mutating endpoint with `@IsIn(CURRENCY_CODE_LIST)`) for the API; `apps/money-tracker/src/app/[locale]/settings/components/profile-form/*` + `src/actions/update-profile.ts` (the react-hook-form + zod + `ActionState` + `revalidatePath` mutation flow), and the 2.6 `categories/components/category-form/*` (parent picker filtered by type, built from `fetchCategoryList`) for the frontend.

### API — transaction create (extends the existing transactions module)

- [x] **Task 1 — `CreateTransactionDto` (AC1, AC2) — string amount, calendar date, enum type/currency**
  - [x] New `src/modules/transactions/dtos/create-transaction.dto.ts` exporting `CreateTransactionDto`. Fields + decorators:
    - `type!: TransactionType` — `@ApiProperty({ enum: transactionTypeEnum.enumValues, enumName: OPENAPI_ENUM_NAME.transactionType })` + `@IsIn(TRANSACTION_TYPE_LIST)` (import `transactionTypeEnum`, `TransactionType`, `TRANSACTION_TYPE_LIST` from `database/schemas/enums`).
    - `amount!: string` — `@ApiProperty({ type: 'string', example: '1234.56' })` + `@IsString()` + `@Matches(POSITIVE_AMOUNT_PATTERN)`. Define `POSITIVE_AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)\d{1,12}(?:\.\d{1,2})?$/u` in `src/shared/constants/` (rejects all-zero, caps 12 integer + ≤2 fraction digits to fit `numeric(14,2)`; the `u` flag is required by oxlint). **Validate as a string — never `@IsNumber`/`parseFloat` (D1).**
    - `currency!: string` — `@ApiProperty({ enum: CURRENCY_CODE_LIST, enumName: OPENAPI_ENUM_NAME.currencyCode })` + `@IsIn(CURRENCY_CODE_LIST)` (import from `@supertool/shared`; mirror `update-user.dto.ts`).
    - `categoryId!: string` — `@ApiProperty()` + `@IsString()` + `@IsNotEmpty()`.
    - `date!: string` — `@ApiProperty({ example: '2025-02-03' })` + `@Matches(CALENDAR_DATE_PATTERN)` (reuse the `^\d{4}-\d{2}-\d{2}$/u` constant 2.2 introduced; **do not** use `@IsDateString` — calendar-date-only contract).
    - `note?: string` — `@ApiPropertyOptional({ default: '' })` + `@IsOptional()` + `@IsString()`.
  - [x] **No `userId`, `id`, or `importKey` in the DTO** — `userId` comes from the session, `id` is generated server-side, `importKey` stays NULL for manual entries.

- [x] **Task 2 — Transactions repository `create` + scoped category lookup (AC1, AC2, FR21) — only DB-touching layer (D7)**
  - [x] Refactor the 2.2 list select+self-join into a reusable private helper (e.g. `findOneByUserIdAndId(userId, id): Promise<TransactionResponseDto | null>`) without changing `findAllByUserId`'s output, so the create path returns a row carrying `categoryName`/`categoryParentName` from the **same** join (no duplicated join logic).
  - [x] Add `create(input: { userId: string; categoryId: string; type: TransactionType; amount: string; currency: string; date: string; note: string }): Promise<TransactionResponseDto>`: `const id = generateId();` (`database/generate-id.ts` → `uuidv7()`); `this.db.insert(transactions).values({ id, userId, categoryId, type, amount, currency, date, note }).returning(...)` — **omit `importKey`** (stays NULL; Postgres unique indexes treat NULLs as distinct, so manual rows never collide). Then return `findOneByUserIdAndId(userId, id)` (guard the null with a thrown error — `noUncheckedIndexedAccess`/`no-non-null-assertion` are on). Pass `amount` straight through as a string (D1 — never `parseFloat`/`Number`).
  - [x] Add `findCategoryForUser(userId: string, categoryId: string): Promise<{ id: string; type: TransactionType } | null>` scoped by `and(eq(transactionCategories.userId, userId), eq(transactionCategories.id, categoryId))` — the transactions repository already imports `transactionCategories` for the join, so this stays in-module (no cross-module DI; the repository is the only DB-touching layer).

- [x] **Task 3 — Transactions service `create` + controller `create` (AC1, AC2) — controller → service → repository, no layer skipping (D7)**
  - [x] `transactions.service.ts`: add `async create(userId: string, dto: CreateTransactionDto): Promise<TransactionResponseDto>`. Steps: (1) `const category = await this.transactionsRepository.findCategoryForUser(userId, dto.categoryId)`; if `null` → `throw new NotFoundException({ code: ErrorCode.NotFound, message: 'Category not found' })`. (2) if `category.type !== dto.type` → `throw new UnprocessableEntityException({ code: ErrorCode.UnprocessableEntity, message: 'Category type does not match transaction type' })`. (3) `return this.transactionsRepository.create({ userId, categoryId: dto.categoryId, type: dto.type, amount: dto.amount, currency: dto.currency, date: dto.date, note: dto.note ?? '' })`. **Mirror the 2.6 `transaction-categories.service.ts` exactly** for the `HttpException`-subclass-with-`{ code: ErrorCode.* }` shape — the global filter (`global-exception.filter.ts`) builds the JSON; services never shape it (D7).
  - [x] `transactions.controller.ts`: add handler `@Post()` named `create`. Decorate: `@UseGuards(AuthGuard)`, `@ApiCreatedResponse({ type: TransactionResponseDto })`, `@ApiBadRequestResponse({ type: ErrorResponseDto })`, `@ApiUnauthorizedResponse({ type: ErrorResponseDto })`, `@ApiNotFoundResponse({ type: ErrorResponseDto })`, `@ApiUnprocessableEntityResponse({ type: ErrorResponseDto })`. Signature: `async create(@Session() session: UserSession<typeof auth>, @Body() dto: CreateTransactionDto)` → `this.transactionsService.create(session.user.id, dto)`. **`userId` comes only from `session.user.id`** (FR21). `@Body()` is a value import — same `consistent-type-imports` caveat as the 2.2 `@Query()` DTO (Dev Notes); add a scoped `oxlint-disable` only if lint forces it, as 2.2 did.
  - [x] No module change — `TransactionsModule` already wires controller/service/repository.

- [x] **Task 4 — Regenerate the client + drift gate (NFR6, D8)**
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`), then `pnpm --filter @supertool/shared generate:client` (or `pnpm turbo run generate:client`), then `pnpm --filter @supertool/shared build` (the app consumes `@supertool/shared` from `dist/` — 2.2/2.6 Debug Logs). Commit the regenerated `packages/shared/src/generated/**`. Confirm `TransactionsApiService.transactionsCreate` (+ a `CreateTransactionDto` type) appears in `sdk.gen.ts`/`types.gen.ts`. CI drift gate must be green.

- [x] **Task 5 — API tests (AC7, NFR1, D10)**
  - [x] `transactions.service.spec.ts` — extend: mock repository; assert `create` (a) throws `NotFoundException` when `findCategoryForUser` returns null, (b) throws `UnprocessableEntityException` on type mismatch, (c) passes session `userId` + `note ?? ''` through on the happy path and returns the repo result.
  - [x] `transactions.controller.spec.ts` — extend: assert `create` forwards `session.user.id` + body to the service.
  - [x] `test/integration/transactions.integration.spec.ts` — extend (copy nothing new; the harness is already in this file from 2.2): after migrate+seed, exercise repository/service `create`: (a) inserts a user-scoped row, `import_key` NULL, amount round-trips as the exact string, response carries `categoryName`/`categoryParentName`; (b) a `categoryId` owned by a **second** user is rejected (FR21 — reuse the second-user helper already in this spec); (c) a category whose `type` differs from the transaction `type` is rejected. Arrange-Act-Assert; `inputX`/`expectedX`/`actualX`.

### Frontend — `/transactions/new` route, form, create action, entry point, i18n

- [x] **Task 6 — Route + entry-point affordance (AC3)**
  - [x] Add `transactionsNew: '/transactions/new'` to `apps/money-tracker/src/constants/routes.ts` (**preserve** existing routes — `categories`/`categoriesNew`/`transactions` etc.).
  - [x] New `src/app/[locale]/transactions/new/page.tsx` (server component). Mirror `settings/page.tsx` + the 2.6 `categories/new/page.tsx`: `setRequestLocale(locale)`, `const profile = await fetchProfile(); if (!profile) return redirect({ href: ROUTES.signIn, locale });`, then `const categoryList = await fetchCategoryList();`. Render `TransactionForm` inside a `Card` (like settings), passing `categoryList` and `defaultCurrency: profile.defaultCurrency ?? null`. Props type follows Next 16 (`params: Promise<{ locale: string }>`). If `categoryList` is empty, render a localized note linking to `ROUTES.categoriesNew` instead of an unusable picker (seed makes this non-empty for the operator, but new users have no categories until 2.6's flow runs).
  - [x] In `src/app/[locale]/transactions/page.tsx` header (next to `MonthStepper`), add an **"Add transaction"** `Button` linking (via the locale-aware navigation `Link` the app already uses — check `MonthStepper.tsx` for the import) to `ROUTES.transactionsNew`. Reachable in **one interaction** (NFR5). Add its label to the `transactionsPage` namespace (both locales). **Preserve** the existing header/list structure.

- [x] **Task 7 — `create-transaction` server action (AC4, AC5, D9)**
  - [x] New `src/actions/create-transaction.ts` mirroring `src/actions/update-profile.ts`: `'use server'`; re-validate with the zod schema (`safeParse` → `{ status: 'error', code: ErrorCode.ValidationError }` on failure — defense in depth like `update-profile.ts`); forward cookies via `createServerApiClient({ cookieHeader })`; call `TransactionsApiService.transactionsCreate({ client, body })`. On API error → `return { status: 'error', code: error?.code ?? 'UNKNOWN', message: error?.message }` (the discriminated `ActionState` from `@supertool/next-shared/src/types/action-state`). **On success**: `revalidatePath(ROUTES.transactions)` then `redirect({ href: \`${ROUTES.transactions}?period=<YYYY-MM>\`, locale })` where the period is the submitted `date` sliced to `YYYY-MM` (**no `new Date(...)` parse**) — so the new row is visible (NFR5, no reload). Because success redirects (Next `redirect()` throws), the action only ever *returns* an error `ActionState`; the form handles the error branch. The action needs `locale` — pass it as an argument from the form (read from the route) or accept it in the values object.

- [x] **Task 8 — `TransactionForm` + category/currency pickers (AC3, AC4, AC5, AC6) — mutation pattern = `ProfileForm`/`CategoryForm`**
  - [x] New `src/app/[locale]/transactions/components/transaction-form/TransactionForm.tsx` (`'use client'`) + co-located `.module.scss`, `.test.tsx`, and `hooks/use-transaction-form.ts` (mirror `use-profile-form.ts` / 2.6 `use-category-form.ts`): `useForm({ resolver: zodResolver(transactionFormSchema), defaultValues, mode: 'onBlur' })`, `useActionState` + `useTransition`, submit `disabled={isPending}`, error `Alert` resolving `state.code` via `translateError.has(...) ? translateError(state.code) : translateError('UNKNOWN')`. Fields via `Field`/`FieldLabel`/`FieldContent`/`FieldError`:
    - **type** — a two-option control (`RadioGroup` atom, or a segmented `Button` pair), values from `TRANSACTION_TYPE_LIST` (`apps/money-tracker/src/constants/transaction.ts`). Default `expense`. On change, reset `categoryId` if the currently-selected category's type no longer matches.
    - **amount** — `Input` (`inputMode="decimal"`); zod normalizes to a 2-decimal **string** (Dev Notes — keep it a string; never store a number).
    - **currency** — `Combobox` (searchable), options from `CURRENCY_CODE_LIST` (`@supertool/shared`) mapped to `{ value, label }` (mirror `settings/constants/currency-option-list.ts`); default to the `defaultCurrency` prop when present.
    - **category** — `Combobox` whose `optionList` is built with a `useMemo` keyed on the selected `type`: filter `categoryList` to the matching `type`, then label each `parentId ? \`${parentNameById.get(parentId)} / ${name}\` : name`. Build `parentNameById` and the parent/child split from `buildCategoryHierarchy(categoryList)` (`categories/utils/category-hierarchy.ts`) — **reuse it, do not re-derive** (`CategoryResponseDto` is flat with `parentId` and no `parentName`). A `Combobox` with "Parent / Child" labels is the agreed picker shape (matches the reference's type-filtered picker) — no bespoke tree widget.
    - **date** — `Input type="date"`, default **today** via a pure `getTodayDate()` helper using **local date parts** (`new Date()` then `getFullYear/getMonth/getDate` padded — **never `new Date(string)`**, never store the ISO instant).
    - **note** — optional `Input`/textarea.
  - [x] All `.module.scss` co-located, PascalCase after the component; responsive via the shared `@supertool/ui` breakpoint mixins (NFR8) — never hand-rolled `@media`; design tokens, not literals.

- [x] **Task 9 — Form schema + pure helpers (AC2, AC5)**
  - [x] New `src/app/[locale]/transactions/constants/transaction-form-schema.ts` exporting `transactionFormSchema` (zod) with **message-key** error strings (like `profile-form-schema.ts` / 2.6 `category-form-schema.ts`): `type: z.enum(TRANSACTION_TYPE_LIST, 'typeInvalid')`; `amount` — a string field that trims, matches a positive-2dp pattern and rejects `≤ 0` with `'amountInvalid'`, then `.transform`s to a normalized 2-decimal string (e.g. `"12.5"` → `"12.50"`); `currency: z.enum(CURRENCY_CODE_LIST, 'currencyInvalid')`; `categoryId: z.string().min(1, 'categoryRequired')`; `date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'dateInvalid')`; `note: z.string().optional()`. Export `TransactionFormValues = z.infer<...>`.
  - [x] Keep amount normalization **string-only** (string ops, or `decimal.js` — already a sanctioned dep). New `get-today-date.ts` + category-option / currency-option builders, co-located under the transactions feature. Co-locate unit tests (valid/invalid/zero amount, 2dp normalization, today format, type-filtered parent/child option labels).

- [x] **Task 10 — i18n: `transactionForm` namespace + transactions "add" label, both locales (FR19/FR20)**
  - [x] Add `transactionForm: 'transactionForm'` to `packages/shared/src/constants/i18n-namespace.ts` (**preserve** existing). Add `[I18N_NAMESPACE.transactionForm]: 'transaction-form'` to `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` (exhaustive `Record<I18Namespace, string>` — won't compile without it).
  - [x] Create `apps/money-tracker/messages/en/transaction-form.json` **and** `messages/uk/transaction-form.json` (identical key sets, real Ukrainian): title, field labels/placeholders (type income/expense, amount, currency + search/empty, category + search/empty, date, note), the empty-categories note + link label, submit, and an `errors` block keyed by both **zod message-keys** (`typeInvalid`, `amountInvalid`, `currencyInvalid`, `categoryRequired`, `dateInvalid`) **and** the mapped `ErrorCode`s (`VALIDATION_ERROR`, `NOT_FOUND`, `UNPROCESSABLE_ENTITY`, `UNAUTHORIZED`, `UNKNOWN`). Add the "Add transaction" button label to `transactions-page.json` (en + uk). **Both files same commit** — `pnpm i18n:parity` is merge-blocking. ICU interpolation, no concatenation.

- [x] **Task 11 — Frontend tests (AC7, NFR1)**
  - [x] `TransactionForm.test.tsx` — invalid amount surfaces the localized field error; submit is disabled while pending; switching type re-scopes the category options and clears a now-invalid selection. Money-tracker vitest config (`@testing-library/react`); the app-level lint enforces `no-magic-numbers`/`id-length` in tests too (2.2 Debug Log) — extract constants, alias locals.
  - [x] Unit specs: `transaction-form-schema` (amount normalization + zero/negative rejection), `get-today-date`, the category-option builder (type filter + parent/child label via `buildCategoryHierarchy`), the currency-option builder.
  - [x] (Recommended) the create-action maps an API `NOT_FOUND`/`UNPROCESSABLE_ENTITY` to the error `ActionState`.

### Verification

- [x] **Gate locally with `--force`** (turbo cache replays stale logs — memory `turbo-cache-masks-gate-results`): `pnpm --filter @supertool/api type-check lint test` and `pnpm --filter @supertool/money-tracker type-check lint test`, plus `pnpm i18n:parity`, `pnpm stylelint`, `pnpm fmt:check`. Integration tests need Docker. Use `pnpm` scripts (not `node_modules/.bin`); retry on the transient pnpm `H.replace` crash (memory `run-tests-via-pnpm-scripts`).
- [x] **Visual QA (mandatory per persistent project rule — 1.4/1.8 shipped broken UI behind green gates):** run the app, screenshot the **entry flow** in **both themes** + **both locales** + desktop and mobile widths: the empty form, the category picker **open** (showing type-filtered Parent/Child options), the currency picker **open**, a client-side validation error, and the post-submit landing on `/transactions` showing the new row. Record the evidence (paths) in the Dev Agent Record. Green gates alone are not sign-off for a UI story. (Per memory `docker-api-build-needs-seed-operator-password`, the Docker `api` image build needs `SEED_OPERATOR_PASSWORD`; visual QA likely runs against dev servers, as 2.2/2.6 did.)

## Dev Notes

### Contract decisions baked into this story (read first)

- **Reusing the 2.6 categories read — build nothing new for categories.** Story 2.6 is **done**. The form's category data comes from the existing `fetchCategoryList()` action (`apps/money-tracker/src/actions/fetch-category-list.ts`, a `cache()`'d call to `TransactionCategoriesApiService.transactionCategoriesFindAll`) returning `CategoryResponseDto[]` where each row is **flat**: `{ id, name, type, parentId, createdAt, updatedAt }` — **no `parentName`**. The picker resolves "Parent / Child" labels client-side via `buildCategoryHierarchy` (`categories/utils/category-hierarchy.ts`). Do **not** add a categories endpoint, fetch action, or DTO — they exist.
- **Money is a string end-to-end (D1) — the load-bearing rule.** Form keeps `amount` a string, zod normalizes to 2 decimals as a string, the DTO validates it as a string (`@IsString` + `@Matches`), the repository inserts the string into `numeric(14,2)`, the response returns the string. **No `parseFloat`/`Number`/float math anywhere.** Number conversion only ever happens at the `Intl` display boundary (in the 2.2 formatter, not here).
- **`import_key` stays NULL for manual entries — by design.** The 2.1 review deferred a concern that "nullable `import_key` + plain `uniqueIndex` lets NULL rows bypass `ON CONFLICT` dedup … matters for the 2.2+ manual-entry insert path." For manual entry that bypass is **correct**: manual transactions are not deduplicated, and Postgres unique indexes treat NULLs as distinct, so many NULL-key rows coexist. **Do not** compute an `import_key` and **do not** add a partial unique index in this story — leave the column out of the insert.
- **`userId` is never trusted from the client.** It comes from `session.user.id` in the controller. The body has no `userId`. The composite FK `(userId, categoryId) → transaction_categories(userId, id)` would FK-violate (500) on a non-owned category — so the **service pre-validates** ownership (clean `404 NOT_FOUND`) and type-match (`422`, mirroring 2.6) before insert. The integration test asserts a second user's `categoryId` cannot be used (FR21).
- **Entry point = a dedicated `/transactions/new` route reached by a header button** (confirmed). Matches 2.6's finding that the `Dialog` molecule is trigger-based/uncontrolled, so forms use dedicated routes; matches the reference's "+"-button→create-route. One click from the transactions main view = one interaction (NFR5). On success the action redirects back to the list at the created month so the row is visible without a reload.
- **Hierarchical picker = a searchable `Combobox` with "Parent / Child" labels** (confirmed — same as the reference's type-filtered picker), not a bespoke tree widget. Reuses the existing molecule (as the profile currency picker and the 2.6 category parent picker do) and satisfies FR6's "hierarchical picker".

### Architecture hard rules binding this story

- **D1 — money is strings end-to-end** (see above). A `number`-typed amount or `parseFloat` on money is a merge-blocking defect.
- **D7 — layering + REST conventions.** Controller → service → repository; repository is the only DB-touching layer. `POST` → **201 + body**; `/api/v1/...` (global). camelCase JSON. Error envelope `{ statusCode, code, message, details? }` via the global filter only — services throw `HttpException` subclasses carrying `{ code: ErrorCode.* }`, never shape JSON.
- **NFR6 / D8 — generated client only.** No hand-written `fetch` to `/api/*`. Build API → regenerate → `@supertool/shared` build → commit → drift gate.
- **FR21 — user scoping.** Insert is scoped to `session.user.id`; category ownership pre-check is user-scoped; second-user isolation is integration-asserted.
- **D9 — frontend data flow.** Mutations via `'use server'` actions returning discriminated `ActionState`; `revalidatePath` after success; react-hook-form + zod; URL search params carry period state (reused from 2.2). Reads are `fetch-*` (React `cache`, plain async).
- **NestJS DI** — explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable (SWC erases decorator metadata under Vitest — `consistent-type-imports` is on). The `@Body()`/`@Query()` DTO value-import caveat from 2.2 applies.
- **TypeScript** — no `enum` keyword (derive unions from the `pgEnum`); no `as` assertions in production code (narrow with `checkIs*` guards); `as const` is the only sanctioned form.
- **FR19/FR20 — both locales same commit**, ICU interpolation, EN is the parity reference. **NFR8 — responsive via shared breakpoint mixins**, tokens not literals.
- **Naming/style (`.claude/rules/javascript.md`, `typescript.md`, `react.md`):** kebab-case files/dirs; component files + co-located `.module.scss`/`.test.tsx` PascalCase. Server reads = `fetch-*` (`cache`); mutations = verb-first `create-transaction.ts` (`'use server'`). No barrels, no comments, named exports, one export per file, arrow functions, `list`-suffixed arrays, verb-prefixed functions (`get*`/`build*`/`parse*`/`format*`/`check*`). `FC<Props>` typing; `ROUTES` for all paths.
- **Exact dependency versions; never introduce eslint/prettier.** This story needs **no new dependencies** (drizzle, class-validator, @nestjs/swagger, next-intl, react-hook-form, zod, decimal.js, `@supertool/ui` all present). If one becomes unavoidable, pin exact + record in the Dev Agent Record and consult `architecture.md` first.

### Source tree — what this story touches

NEW (API):
- `apps/api/src/modules/transactions/dtos/create-transaction.dto.ts`
- `apps/api/src/shared/constants/` positive-amount pattern (append to the existing constants file the calendar-date pattern lives in, or a small `amount.ts`)

UPDATE (API — read fully before editing; preserve current behavior):
- `apps/api/src/modules/transactions/transactions.controller.ts` — add `create` `@Post()`; **preserve** `findAll`.
- `apps/api/src/modules/transactions/transactions.service.ts` — add `create`; **preserve** `findAll`.
- `apps/api/src/modules/transactions/transactions.repository.ts` — add `create` + the reusable single-row join helper + `findCategoryForUser`; **preserve** `findAllByUserId` (refactor the join into the shared helper without changing its output).
- `apps/api/src/modules/transactions/{transactions.service,transactions.controller}.spec.ts` and `apps/api/test/integration/transactions.integration.spec.ts` — extend.
- `packages/shared/src/generated/**` — regenerated by Task 4 (do not hand-edit).

(No `app.module.ts` change — `TransactionsModule` is already registered.)

NEW (frontend):
- `apps/money-tracker/src/app/[locale]/transactions/new/page.tsx` (+ `.module.scss` if needed)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.tsx` (+ `.module.scss`, `.test.tsx`, `hooks/use-transaction-form.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/constants/transaction-form-schema.ts` (+ `.test.ts`)
- category-option / currency-option builders + `get-today-date.ts` (+ `.test.ts`) — co-located under the transactions feature
- `apps/money-tracker/src/actions/create-transaction.ts`
- `apps/money-tracker/messages/en/transaction-form.json`, `messages/uk/transaction-form.json`

UPDATE (frontend — preserve current behavior):
- `apps/money-tracker/src/constants/routes.ts` — add `transactionsNew`; preserve.
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx` — add the "Add transaction" header button; preserve list/stepper structure.
- `packages/shared/src/constants/i18n-namespace.ts` — append `transactionForm`; preserve.
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — append mapping (exhaustive record).
- `apps/money-tracker/messages/{en,uk}/transactions-page.json` — add the "add" label.

### Reference patterns (study before implementing — `example/` is reference-only, ED1: adapt, never copy/import)

In-repo templates (primary — prefer these over `example/`):
- **Transactions module (read side, this story extends it):** `apps/api/src/modules/transactions/{transactions.controller,transactions.service,transactions.repository,transactions.module}.ts` + `dtos/*` — the `@ApiTags`/`@UseGuards(AuthGuard)`/`@Session() session: UserSession<typeof auth>`/`session.user.id` shape; the category self-join to refactor into the reusable single-row helper for the create return; `TransactionResponseDto` (reused unchanged for the 201 body).
- **2.6 transaction-categories module (the freshest mutating-endpoint + validation reference):** `apps/api/src/modules/transaction-categories/{transaction-categories.service,transaction-categories.controller}.ts` — the `NotFoundException`/`UnprocessableEntityException`/`ConflictException` with `{ code: ErrorCode.* }` pattern, parent-type-match (422), `@Session()` auth, and how a create endpoint is shaped. `dtos/create-category.dto.ts` for `@IsIn(...)` + `enumName` wiring.
- **Full module shape + a mutating endpoint with currency validation:** `apps/api/src/modules/users/*` and `dtos/update-user.dto.ts` (`@IsIn(CURRENCY_CODE_LIST)` + `enumName: OPENAPI_ENUM_NAME.currencyCode`).
- **UUIDv7 id:** `apps/api/src/database/generate-id.ts` (`generateId()` → `uuidv7()`).
- **Error codes + envelope:** `packages/shared/src/constants/error-codes.ts` (`NOT_FOUND`, `VALIDATION_ERROR`, `UNPROCESSABLE_ENTITY`, `UNAUTHORIZED`, …); `apps/api/src/shared/filters/global-exception.filter.ts`; `error-response.dto.ts` for the `@ApiResponse` types.
- **operationId factory:** `apps/api/src/app/openapi.ts` — `create` → `transactionsCreate`. Enum names in `openapi-enum-name.ts` (`transactionType`/`currencyCode` already registered).
- **Schemas (built in 2.1):** `apps/api/src/database/schemas/{transactions,transaction-categories,enums}.ts` — `transactions`: `numeric(14,2)` amount, `currency` text, `date` (`mode:'string'`), nullable `import_key` with `uniqueIndex`, composite FK `(userId, categoryId)` `onDelete: 'restrict'`, `CHECK (amount > 0)`. `transactionTypeEnum`/`TransactionType`/`TRANSACTION_TYPE_LIST`.
- **Integration harness:** `apps/api/test/integration/transactions.integration.spec.ts` (already has the Testcontainers lifecycle + the second-user helper from 2.2; just extend it).
- **Mutation flow (THE frontend template):** `apps/money-tracker/src/app/[locale]/settings/components/profile-form/{ProfileForm.tsx,hooks/use-profile-form.ts}` + `constants/{profile-form-schema.ts,currency-option-list.ts}`; `apps/money-tracker/src/actions/update-profile.ts` (`'use server'`, zod re-validate, `createServerApiClient`, generated client, `revalidatePath`, `ActionState`). `ActionState`: `packages/next-shared/src/types/action-state.ts`.
- **2.6 form + type-filtered parent picker (build from `fetchCategoryList`):** `apps/money-tracker/src/app/[locale]/categories/components/category-form/{CategoryForm.tsx,hooks/use-category-form.ts,constants/category-form-schema.ts}` and the `buildCategoryHierarchy`/`getDescendantIdSet` util at `categories/utils/category-hierarchy.ts`. `apps/money-tracker/src/actions/fetch-category-list.ts` (reuse as-is).
- **Read action + client factory:** `apps/money-tracker/src/actions/{fetch-profile,fetch-transactions}.ts`; `packages/next-shared/src/client/create-server-api-client.ts`.
- **Auth-gated server page + redirect + locale:** `apps/money-tracker/src/app/[locale]/{settings,categories/new}/page.tsx`; the 2.2 `transactions/page.tsx` (Suspense key + searchParams + locale-aware nav in `MonthStepper.tsx`).
- **UI primitives:** `Combobox` (`molecules/combobox`), `Field`/`FieldLabel`/`FieldContent`/`FieldError` (`molecules/field`), `Input`/`Button`/`RadioGroup`/`Typography` (atoms), `Card`/`Alert` (molecules); SCSS breakpoint mixins + tokens.
- **Constants:** `packages/shared/src/constants/currency.ts` (`CURRENCY_CODE_LIST`, `CurrencyCode`); `apps/money-tracker/src/constants/transaction.ts` (`TRANSACTION_TYPE_LIST`, `TRANSACTION_TYPE`).

Reference repos (adapt patterns only — never import/copy, ED1):
- `example/tracker-backend-api/src/modules/transactions/{transactions.controller,transactions.service,dtos/create-transaction.dto}.ts` — the `@Post()` create + create DTO shape. **Diverge:** string amount with `@Matches` (D1), `@IsIn(CURRENCY_CODE_LIST)`, calendar-`date` string (no TZ), session-derived `userId`, 201 + `TransactionResponseDto`, clean `404`/`422` on bad/mismatched category.
- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/{transaction-form-page/TransactionFormPage.tsx,category-picker/*}` and `transactions/create/page.tsx` — the entry-form layout, the "+"-button→create-route entry point, and the type-filtered category picker. **Diverge:** supertool uses a `Combobox` + `buildCategoryHierarchy` (no bespoke picker), the `@supertool/ui` `Field` components, `ActionState`+`revalidatePath`+redirect-on-success, two-locale i18n, supertool tokens/naming, no `(app-layout)` route group.

### Testing standards

- Vitest + SWC decorators for API (`apps/api/vitest.config.ts`); `@testing-library/react` for money-tracker (`apps/money-tracker/vitest.config.ts` — oxc `jsx:'react-jsx'` override already set; include is `*.test.{ts,tsx}` per 2.2).
- Co-located `*.spec.ts` (API) / `*.test.ts(x)` (frontend); Testcontainers integration in `apps/api/test/integration/*.integration.spec.ts` (`postgres:16-alpine`).
- Arrange-Act-Assert; name vars `inputX`/`expectedX`/`actualX`. App-level lint enforces `no-magic-numbers`/`id-length` in tests too (extract constants, alias locals — 2.2 Debug Log).
- Run gates with `--force`; `pnpm` scripts not `.bin`; retry on the pnpm `H.replace` crash.

### Project Structure Notes

- The transaction create endpoint lands in the **existing** `transactions` module (no new module). Categories are fully owned by the **existing** `transaction-categories` module (2.6) — this story only **reads** from it via the frontend `fetchCategoryList` action.
- Frontend feature stays under `app/[locale]/transactions/` with `components/transaction-form/` and a `new/` route segment; constants/utils co-located under the feature (matching 2.2/2.6). No barrels.
- No new dependencies expected; if one is unavoidable, pin exact + record in the Dev Agent Record (consult `architecture.md` first).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Fast Transaction Entry]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] (D1 money strings, D4 UUIDv7)
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] (D7 layering/REST/201)
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] (FR21 user scoping)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] (D9 server actions + revalidate; ActionState)
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns / Process Patterns] (money strings, dates no-TZ, error envelope, i18n, loading/mutation states)
- [Source: _bmad-output/implementation-artifacts/2-2-browse-transactions-by-month.md] (transactions module read side, repository join, integration harness, i18n wiring, gates/visual-QA protocol)
- [Source: _bmad-output/implementation-artifacts/2-6-organize-categories.md] (the transaction-categories module + tree read, `fetchCategoryList`, `buildCategoryHierarchy`, CategoryResponseDto flat shape, mutating-endpoint validation/error-code pattern, dedicated-route-form finding)
- [Source: _bmad-output/implementation-artifacts/2-1-seed-the-real-data.md] (schema, enums, seed data, second-user helpers)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (2.1 nullable import_key on the manual-entry path)
- [Source: apps/api/src/modules/transactions/*, src/modules/transaction-categories/*, src/modules/users/*, src/database/schemas/{transactions,transaction-categories,enums}.ts, src/database/generate-id.ts, src/app/openapi.ts, src/shared/{filters/global-exception.filter.ts,dtos/error-response.dto.ts,guards/auth.guard.ts}]
- [Source: packages/shared/src/constants/{currency.ts,error-codes.ts,i18n-namespace.ts}, packages/shared/openapi-ts.config.ts]
- [Source: apps/money-tracker/src/actions/{fetch-category-list,update-profile,fetch-profile,fetch-transactions}.ts, src/constants/{routes.ts,transaction.ts}, src/app/[locale]/{settings/components/profile-form/*,categories/components/category-form/*,categories/utils/category-hierarchy.ts,transactions/*}]
- [Source: packages/next-shared/src/{types/action-state.ts,client/create-server-api-client.ts}]
- [Source: packages/ui/src/components/{molecules/{combobox,field,card,alert},atoms/{input,button,radio-group,typography}}]
- [Source: .claude/rules/{nestjs-apis.md,react.md,i18n.md,typescript.md,javascript.md}]
- Project memory: `seed-data-has-subcategory.md`, `turbo-cache-masks-gate-results.md`, `run-tests-via-pnpm-scripts.md`, `nest-di-explicit-inject.md`, `next-app-vitest-jsx-preserve.md`, `ui-stories-need-visual-qa.md`, `follow-example-repo-patterns.md`, `docker-api-build-needs-seed-operator-password.md`, `sdk-service-classes-and-example-repo.md`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- API gates (`pnpm --filter @supertool/api type-check | lint | test`): green — 119 unit tests incl. the Testcontainers `transactions.integration.spec.ts` (8 tests: 5 existing read + 3 new create) pass against `postgres:16-alpine`.
- money-tracker gates (`type-check | lint | test`): green — 72 tests pass. `i18n:parity`, `stylelint`, `fmt:check`: green.
- `exactOptionalPropertyTypes` rejected an explicit `currency: undefined` default; fixed by conditionally spreading the currency key in `getDefaultValues`.
- oxlint findings fixed: `prefer-destructuring` (repo `findOneByUserIdAndId`), `no-duplicate-imports`/`no-continue`/`no-map-spread` (`build-category-option-list`), `no-magic-numbers`/`max-statements` across new files and tests.
- Generated client: `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client` → `pnpm --filter @supertool/shared build`; confirmed `TransactionsApiService.transactionsCreate` + `CreateTransactionDto` in `sdk.gen.ts`/`types.gen.ts` (operationId `transactionsCreate`).

### Completion Notes List

- **API write side** added to the existing transactions module: `CreateTransactionDto` (string amount via `@Matches(POSITIVE_AMOUNT_PATTERN)`, enum type/currency, calendar `date`, optional note — no `userId`/`id`/`importKey`); repository `create` (string amount into `numeric(14,2)`, `import_key` left NULL) + `findOneByUserIdAndId` (refactored shared join) + `findCategoryForUser` (user-scoped); service `create` (404 `NOT_FOUND` on non-owned category, 422 `UNPROCESSABLE_ENTITY` on type mismatch, `note ?? ''`); controller `@Post() create` deriving `userId` from `session.user.id`.
- **Frontend entry flow**: `/transactions/new` route + `TransactionForm` (react-hook-form + zod, segmented type toggle, amount, currency `Combobox`, type-filtered category `Combobox` with "Parent / Child" labels via reused `buildCategoryHierarchy`, date defaulted to local today, note); `create-transaction` `'use server'` action (`revalidatePath` + redirect to created month on success, `ActionState` error mapping); "Add transaction" header button on `/transactions`; empty-categories note linking to `/categories/new`.
- **Decimal safety (D1)**: amount is a string from form → zod normalize → DTO `@IsString`/`@Matches` → `numeric(14,2)` → response string; no `parseFloat`/`Number`/float math. Confirmed via integration round-trip and the post-submit list showing `UAH 42.50`.
- **i18n**: new `transactionForm` namespace (en + uk, real Ukrainian) + `addTransaction` label in both `transactions-page.json`; parity gate green.
- **Visual QA (mandatory)**: throwaway `playwright-core@1.56` harness in `/tmp/qa-2-3` against dev servers (Postgres via compose, API + money-tracker `dev`), operator session cookie. Captured 41 screenshots in **both themes × both locales × desktop+mobile** of: transactions list (with Add button), empty form, category picker **open** (type-filtered Parent/Child), currency picker **open**, client-side validation errors. Plus a full **end-to-end create** (fill → pick UAH → pick category → submit) that redirected to `/transactions?period=2026-06` and showed the new row (`Базові потреби / Банкінг`, Expense, `UAH 42.50`). All looked correct: dark tokens applied, Ukrainian translations real, responsive stacking on mobile, validation borders + localized messages. Screenshots in `/tmp/qa-2-3/shots/`.

### File List

**API (new)**
- `apps/api/src/modules/transactions/dtos/create-transaction.dto.ts`
- `apps/api/src/shared/constants/transaction-validation.ts`

**API (modified)**
- `apps/api/src/modules/transactions/transactions.controller.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts`
- `apps/api/src/modules/transactions/transactions.service.spec.ts`
- `apps/api/src/modules/transactions/transactions.controller.spec.ts`
- `apps/api/test/integration/transactions.integration.spec.ts`

**Generated client (regenerated)**
- `packages/shared/src/generated/{sdk.gen.ts,types.gen.ts,index.ts}`

**Shared (modified)**
- `packages/shared/src/constants/i18n-namespace.ts`

**Frontend (new)**
- `apps/money-tracker/src/app/[locale]/transactions/new/page.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/new/page.module.scss`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.module.scss`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.test.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/hooks/use-transaction-form.ts`
- `apps/money-tracker/src/app/[locale]/transactions/constants/transaction-form-schema.ts`
- `apps/money-tracker/src/app/[locale]/transactions/constants/transaction-form-schema.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/constants/currency-option-list.ts`
- `apps/money-tracker/src/app/[locale]/transactions/constants/currency-option-list.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-category-option-list.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-category-option-list.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/get-today-date.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/get-today-date.test.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/normalize-amount.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/normalize-amount.test.ts`
- `apps/money-tracker/src/actions/create-transaction.ts`
- `apps/money-tracker/src/actions/create-transaction.test.ts`
- `apps/money-tracker/messages/en/transaction-form.json`
- `apps/money-tracker/messages/uk/transaction-form.json`

**Frontend (modified)**
- `apps/money-tracker/src/constants/routes.ts`
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/page.module.scss`
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts`
- `apps/money-tracker/messages/en/transactions-page.json`
- `apps/money-tracker/messages/uk/transactions-page.json`

## Change Log

| Date | Change |
|---|---|
| 2026-06-15 | Story 2.3 drafted — transaction create (POST + CreateTransactionDto, service/controller/repository, server-side category-ownership 404 + type-match 422 validation), generated-client regen, /transactions/new route + TransactionForm (react-hook-form + zod + ActionState + revalidate/redirect), category Combobox picker reusing 2.6's fetchCategoryList + buildCategoryHierarchy, currency Combobox, transactionForm i18n (en/uk), tests. Scope corrected after 2.6 landed (no categories module bootstrap — consume the existing read). Status → ready-for-dev. |
| 2026-06-15 | Story 2.3 implemented — API write side (CreateTransactionDto, repository create + scoped lookups, service 404/422 validation, controller @Post), generated client regenerated (drift gate green), /transactions/new route + TransactionForm + create-transaction action + entry-point button, transactionForm i18n (en/uk). Tests: API service/controller specs + 3 new integration create cases (user-scoped insert, second-user rejection, type-mismatch), frontend TransactionForm/schema/helpers/action specs. All gates green (api + money-tracker type-check/lint/test, i18n:parity, stylelint, fmt:check). Visual QA passed (both themes × locales × widths + full E2E create). Status → review. |

## Review Findings

_Code review 2026-06-15 — diff `origin/main...HEAD` (base 732bd58). Gates green (type-check, lint, stylelint, tests 119 api + 72 money-tracker). Visual evidence gate satisfied (both themes × locales × widths, picker open states). 3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

### Decision-needed

_Both resolved 2026-06-15 → patch._

### Patch (all applied 2026-06-15 — gates re-run green: type-check, lint, test mt 84/api 126, i18n parity, fmt; generated client un-drifted)

- [x] [Review][Patch] Format-valid but non-existent calendar dates yielded a raw 500 — **fixed.** Added `checkIsCalendarDate` (format + real-calendar check, no `@IsDateString`, keeps `YYYY-MM-DD`) to `apps/api/src/shared/constants/transaction-validation.ts` and a new `apps/money-tracker/.../utils/check-is-calendar-date.ts`; API enforces it via a custom `@IsCalendarDate()` decorator on the DTO `date` (alongside the existing `@Matches`, so OpenAPI/generated client is unchanged), the frontend via `.refine(checkIsCalendarDate, 'dateInvalid')`. `2025-02-30`/`2025-13-01`/non-leap `2025-02-29` now → clean `400`/zod error. Unit specs added both sides.
- [x] [Review][Patch] Back-dated entry not visible after the redirect — **fixed.** The action now computes the created row's page: counts month transactions dated after it (one `transactionsFindAll` probe via `getNextCalendarDate` + `getMonthDateRange`) and redirects with `?period=…&page=N` (omitted when page 1). Added `utils/get-next-calendar-date.ts` + spec; action spec extended with a back-dated → page-3 case. [apps/money-tracker/src/actions/create-transaction.ts]
- [x] [Review][Patch] `note` not trimmed — **fixed.** `note: z.string().trim().optional()`; whitespace-only note now normalizes to `''`. Schema spec extended. [transaction-form-schema.ts]

### Deferred

- [x] [Review][Defer] Amount/date validation regexes duplicated across the API DTO and the frontend zod schema — `POSITIVE_AMOUNT_PATTERN` and `CALENDAR_DATE_PATTERN` are byte-identical in `apps/api/src/shared/constants/transaction-validation.ts` and `transaction-form-schema.ts`; a future server-side change silently diverges the client. Candidate for `@supertool/shared`. Deferred — pre-existing cross-package convention (2.2 precedent), not introduced by this story.
- [x] [Review][Defer] TOCTOU race on category create — `findCategoryForUser` (ownership pre-check) and `repository.create` (insert) are not atomic; a category deleted in the window FK-violates → 500 instead of a clean 404. Deferred — single-user local runtime, `onDelete: 'restrict'`, very narrow window. [apps/api/src/modules/transactions/transactions.service.ts]

### Dismissed (5, with reasoning)

- Blind Hunter "major": `useTransition` + `useActionState` dual pending leaves submit not disabled — **dismissed.** Contradicted by the passing test (`TransactionForm.test.tsx:83-96` asserts the button disables while pending) and the already-merged `use-category-form.ts` (story 2.6) which uses the identical sanctioned React 19 pattern; React links a `useActionState` dispatch made inside `startTransition` to that transition. Optional simplification only: read `isPending` from `useActionState`'s 3rd tuple element instead of a separate `useTransition`.
- `revalidatePath` unreachable if a 201 returns no body — defensive speculation; the endpoint always returns the created row and the generated client returns `data`.
- `buildCategoryOptionList` emits children by parent type only — currently unreachable; 2.6's `assertSameType` enforces child.type == parent.type at create time.
- Action `return redirect(...)` instead of a success `ActionState` — documented Next pattern (`redirect()` throws); not a defect.
- `cancel` i18n key absent from the spec's Task 10 key list — implementation correctly added it to both locales; parity intact.
