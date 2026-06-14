---
baseline_commit: 0094684
---

# Story 2.2: Browse Transactions by Month

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to see my transactions for a month and step to adjacent months,
so that I can review what happened and when.

This is the **first story of Track A** (the transactions module — see `epic-2-parallelization.md`). It **creates the `transactions` API module** (module/controller/service/repository/DTOs) that 2.3 (entry), 2.4 (edit/delete), and 2.5 (filter/sort) all build on, and it **establishes the first paginated read endpoint** in the API — so it also creates the **shared offset-pagination DTO infrastructure** (`{ data, meta: { page, limit, total } }`, D7) that every future list endpoint reuses. It is read-only: `GET /api/v1/transactions` only — **no inserts, updates, or deletes** (those are 2.3/2.4). On the frontend it creates the `/transactions` route, its server-component page, the month stepper, the transaction list, and the `transactionsPage` i18n namespace.

## Acceptance Criteria

**AC1 — Paginated, date-windowed, user-scoped list endpoint (D7, D1, FR21, NFR6)**
**Given** the new `transactions` module,
**When** `GET /api/v1/transactions?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=1&limit=50` is called by an authenticated user,
**Then** it returns `{ data, meta: { page, limit, total } }` offset pagination (D7) where every amount is a **string** (D1, e.g. `"1234.56"`), the rows are **scoped to the authenticated user by the repository** (FR21 — a second user's rows are never returned), the date window is applied inclusively against the `date` column with **no timezone math** (string comparison on `"YYYY-MM-DD"`, never `new Date(...)`), and the endpoint is reachable through the **regenerated generated client** with the drift gate green (NFR6, D8).

**AC2 — Each row carries everything the view needs (FR6 fields)**
**Given** the response DTO,
**When** a transaction row is serialized,
**Then** it includes `id`, `date` (`"YYYY-MM-DD"`), `type` (`income`/`expense`, the `TransactionType` enum single-sourced from the Drizzle schema), `amount` (string), `currency`, `note`, `categoryId`, `categoryName`, and `categoryParentName` (nullable — present when the transaction's category is a child, so the UI can render "Parent / Child"). `createdAt`/`updatedAt` are ISO-8601 UTC strings.

**AC3 — View defaults to the current month, formatted via Intl/next-intl (FR8)**
**Given** a signed-in user opening `/transactions`,
**When** the page loads with no period in the URL,
**Then** it defaults to the **current month** (FR8), renders date, category, type, amount, currency, and note for each row — **amounts and dates formatted via `Intl`/next-intl, never ad-hoc** (no `toLocaleDateString`, no manual string building) — with **Suspense skeletons** while the list loads.

**AC4 — Month stepper travels via URL search params (D9)**
**Given** the month stepper,
**When** I navigate previous/next month,
**Then** the selected period travels via a **camelCase URL search param** (`?period=YYYY-MM`) — shareable and back-button-safe (D9) — the page re-fetches the new window, and the displayed month label updates (localized via `Intl.DateTimeFormat`/next-intl). Page-1 reset on month change.

**AC5 — Localized empty state (FR19/FR20)**
**Given** a month with no transactions,
**When** it is viewed,
**Then** a localized empty state renders, with its strings present in **both** `en` and `uk` in the same commit (FR19/FR20 key-parity gate).

**AC6 — Responsive (NFR8)**
**Given** a mobile-browser viewport,
**When** the list renders,
**Then** it is fully usable — responsive layout via the shared `packages/ui` SCSS breakpoint mixins (NFR8), not ad-hoc media queries.

**AC7 — Tests merge with the story (NFR1, D10)**
**Given** the module and components,
**When** tests run,
**Then** they include: a **Testcontainers integration spec** for the repository proving range windowing, user scoping (second-user isolation), and pagination meta against real Postgres seeded data; unit specs for the service (mocked repository) and controller (mocked service + session); and frontend component tests for the list (rows + empty state) and the month stepper (prev/next updates the URL param) plus the formatter helpers. All new user-facing strings exist in both locales.

## Tasks / Subtasks

> Read every file marked **UPDATE** in "Source tree" before editing it. Mirror `apps/api/src/modules/users/*` for the API module and `apps/money-tracker/src/app/[locale]/settings/*` + `actions/*` for the frontend — these are the in-repo templates this story extends.

### API — `transactions` module + shared pagination infra

- [x] **Task 1 — Shared offset-pagination DTOs (AC1) — new shared infra, used by every future list endpoint**
  - [x] New `src/shared/dtos/pagination-query.dto.ts` exporting `PaginationQueryDto`: `page?: number` (`@ApiPropertyOptional({ default: 1 })`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@IsOptional()`) and `limit?: number` (`@ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE })`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@Max(MAX_PAGE_SIZE)`, `@IsOptional()`). The global `ValidationPipe` already has `transform: true` + `whitelist: true` (`src/app/configure-app-routing.ts`) so string query params coerce to numbers via `@Type`. Put `DEFAULT_PAGE_SIZE = 50` / `MAX_PAGE_SIZE = 100` in `src/shared/constants/` (UPPER_SNAKE, no magic numbers — oxlint `no-magic-numbers` flags call-arg literals).
  - [x] New `src/shared/dtos/pagination-meta.dto.ts` exporting `PaginationMetaDto` with `@ApiProperty()` `page!: number`, `limit!: number`, `total!: number` — the `meta` shape from architecture D7 (`{ page, limit, total }`).
  - [x] **Do NOT build a generic `PaginatedResponse<T>` DTO.** NestJS/Swagger does not serialize TS generics into clean OpenAPI schemas (it needs `@ApiExtraModels` + `getSchemaPath` gymnastics that produce ugly generated-client types). Instead each module declares a **concrete** list-response DTO (Task 2). This keeps `TransactionsApiService.transactionsFindAll` returning a named, well-typed shape.

- [x] **Task 2 — Transaction DTOs (AC1, AC2)**
  - [x] New `src/modules/transactions/dtos/transaction-response.dto.ts` exporting `TransactionResponseDto`. Fields + decorators:
    - `id!: string` — `@ApiProperty()`
    - `date!: string` — `@ApiProperty({ example: '2025-02-03' })` (calendar date, `"YYYY-MM-DD"`)
    - `type!: TransactionType` — `@ApiProperty({ enum: transactionTypeEnum.enumValues, enumName: OPENAPI_ENUM_NAME.transactionType })` (import `transactionTypeEnum`, `TransactionType` from `database/schemas/enums`; `OPENAPI_ENUM_NAME.transactionType` is **already registered** = `'TransactionType'`)
    - `amount!: string` — `@ApiProperty({ type: 'string', example: '1234.56' })` (**D1 — string, never number**)
    - `currency!: string` — `@ApiProperty({ example: 'UAH' })`
    - `note!: string` — `@ApiProperty()`
    - `categoryId!: string` — `@ApiProperty()`
    - `categoryName!: string` — `@ApiProperty()`
    - `categoryParentName!: string | null` — `@ApiProperty({ type: 'string', nullable: true })`
    - `createdAt!: string` / `updatedAt!: string` — `@ApiProperty()` (ISO-8601 UTC; Drizzle `timestamptz` serializes to ISO)
  - [x] New `src/modules/transactions/dtos/transaction-list-response.dto.ts` exporting `TransactionListResponseDto`: `@ApiProperty({ type: [TransactionResponseDto] }) data!: TransactionResponseDto[]` and `@ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto`.
  - [x] New `src/modules/transactions/dtos/find-transactions-query.dto.ts` exporting `FindTransactionsQueryDto extends PaginationQueryDto`, adding `dateFrom?: string` and `dateTo?: string`, each `@ApiPropertyOptional({ example: '2025-02-01' })` + `@IsOptional()` + `@Matches(/^\d{4}-\d{2}-\d{2}$/u)` (note the `u` flag — oxlint requires it). **Do not** use `@IsDateString()` — it accepts full ISO datetimes; this endpoint wants calendar-date-only strings to keep the no-TZ contract.

- [x] **Task 3 — Repository (AC1, AC2, FR21) — the only DB-touching layer (D7)**
  - [x] New `src/modules/transactions/transactions.repository.ts` mirroring `users.repository.ts`: `@Injectable()`, `constructor(@Inject(DRIZZLE) private readonly db: Database)`. Import `DRIZZLE` from `database/database.constants`, `transactions` from `database/schemas/transactions`, `transactionCategories` from `database/schemas/transaction-categories`.
  - [x] Method `findAllByUserId(userId: string, query: { dateFrom?: string; dateTo?: string; page: number; limit: number }): Promise<{ data: TransactionResponseDto[]; total: number }>`:
    - Build a `conditions` array starting with `eq(transactions.userId, userId)` (**FR21 — always first, always present**). If `dateFrom` → `gte(transactions.date, dateFrom)`; if `dateTo` → `lte(transactions.date, dateTo)`. The `date` column is `mode: 'string'`, so compare against the `"YYYY-MM-DD"` strings directly — **never `new Date(dateFrom)`** (architecture no-TZ rule; this is the key divergence from the reference, which converts to UTC with a timezone offset — do not adopt that).
    - `const whereClause = and(...conditions)`.
    - Resolve the category name + parent name with a **self-join** on `transaction_categories`: `const parentCategory = aliasedTable(transactionCategories, 'parent_category')`. `LEFT JOIN transactionCategories ON (transactions.userId = transactionCategories.userId AND transactions.categoryId = transactionCategories.id)` then `LEFT JOIN parentCategory ON transactionCategories.parentId = parentCategory.id`. Select `categoryName: transactionCategories.name`, `categoryParentName: parentCategory.name`.
    - Order by `desc(transactions.date)` then `desc(transactions.id)` (id is UUIDv7 = time-ordered → **stable, deterministic pagination tiebreaker**; without it, same-date rows can shuffle across pages).
    - `.limit(limit).offset((page - 1) * limit)`.
    - Run the data query and a `count()` query **in parallel** with `Promise.all`, both using the **same `whereClause`**: `this.db.select({ total: count() }).from(transactions).where(whereClause)`. Return `{ data, total: totalResult[0]?.total ?? 0 }` (narrow the array access — strict `noUncheckedIndexedAccess` is on; no `!`).
    - Map each row → `TransactionResponseDto` (the `numeric` amount comes back from `pg` as a string already — pass it straight through; **never `parseFloat`/`Number(...)`**, D1).
  - [x] Use `and`, `eq`, `gte`, `lte`, `desc`, `count`, `aliasedTable` from `drizzle-orm` (and `drizzle-orm/pg-core` for `aliasedTable` if needed — check the import; the seed already uses similar helpers).

- [x] **Task 4 — Service + Controller + Module (AC1) — controller → service → repository, no layer skipping (D7)**
  - [x] New `src/modules/transactions/transactions.service.ts`: `@Injectable()`, `constructor(@Inject(TransactionsRepository) private readonly transactionsRepository: TransactionsRepository)`. Method `findAll(userId, query: FindTransactionsQueryDto): Promise<TransactionListResponseDto>`: apply defaults (`page = query.page ?? 1`, `limit = query.limit ?? DEFAULT_PAGE_SIZE`), call the repository, assemble `{ data, meta: { page, limit, total } }`.
  - [x] New `src/modules/transactions/transactions.controller.ts` mirroring `users.controller.ts`: `@ApiTags('transactions')`, `@Controller('transactions')`, `constructor(@Inject(TransactionsService) ...)`. One handler `@Get()` named `findAll` → operationId `transactionsFindAll` (the factory in `src/app/openapi.ts` derives `<resource><Method>`; method name **must** be `findAll`). Decorate: `@UseGuards(AuthGuard)`, `@ApiOkResponse({ type: TransactionListResponseDto })`, `@ApiUnauthorizedResponse({ type: ErrorResponseDto })`, `@ApiBadRequestResponse({ type: ErrorResponseDto })`. Signature: `async findAll(@Session() session: UserSession<typeof auth>, @Query() query: FindTransactionsQueryDto)` → `this.transactionsService.findAll(session.user.id, query)`. Import `@Session`, `UserSession` from `@thallesp/nestjs-better-auth`, `auth` from `auth/auth`, `AuthGuard` from `shared/guards/auth.guard`.
  - [x] New `src/modules/transactions/transactions.module.ts`: `@Module({ controllers: [TransactionsController], providers: [TransactionsService, TransactionsRepository] })`. Register `TransactionsModule` in `src/app/app.module.ts` imports (beside `UsersModule`). `DatabaseModule` is `@Global` and exports `DRIZZLE`, so no import needed for DB access.

- [x] **Task 5 — Regenerate the client + drift gate (NFR6, D8)**
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`), then `pnpm --filter @supertool/shared generate:client` (or `pnpm turbo run generate:client`). Commit the regenerated `packages/shared/src/generated/*`. Confirm a new `TransactionsApiService` with `transactionsFindAll` appears in `sdk.gen.ts`. The CI drift gate must be green (regenerate-and-diff).

- [x] **Task 6 — API tests (AC7, NFR1, D10)**
  - [x] `src/modules/transactions/transactions.service.spec.ts` — mocked repository; assert defaulting (page/limit) and `{ data, meta }` assembly.
  - [x] `src/modules/transactions/transactions.controller.spec.ts` — mocked service; assert it forwards `session.user.id` + query.
  - [x] `test/integration/transactions.integration.spec.ts` (Testcontainers — copy container lifecycle **verbatim** from `test/integration/seed.integration.spec.ts` / `migrate-on-boot.integration.spec.ts`: `TESTCONTAINERS_RYUK_DISABLED='true'`, `BOOT_TIMEOUT_MS = 180_000`, `Wait.forLogMessage(/ready to accept connections/u, 2)`). Migrate + seed, then query the repository directly: assert (a) a known month window returns only that month's rows and excludes adjacent months, (b) `total` matches the count for the window and `data.length` respects `limit`, (c) page 2 returns the next slice with no overlap (stable order), (d) **user scoping** — create a second user with a row and assert it is never returned for the operator, (e) amounts come back as strings, (f) `categoryName`/`categoryParentName` resolve correctly for a child-category transaction. Reuse the operator/seed helpers already used in `seed.integration.spec.ts`.

### Frontend — `/transactions` route, list, month stepper, i18n

- [x] **Task 7 — Route + reachability (AC3)**
  - [x] Add `transactions: '/transactions'` to `apps/money-tracker/src/constants/routes.ts`.
  - [x] New `src/app/[locale]/transactions/page.tsx` (server component). Mirror `settings/page.tsx` for the **auth gate**: `const profile = await fetchProfile(); if (!profile) { return redirect({ href: ROUTES.signIn, locale }); }`. Props type: `{ params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }` (Next 16 — both are Promises; `await Promise.all([...])`). Call `setRequestLocale(locale)`. Parse `period` (`YYYY-MM`) and `page` from `searchParams`, defaulting `period` to the current month. Render the month stepper + a `<Suspense key={\`${period}-${page}\`} fallback={<TransactionListSkeleton />}>` wrapping the list server component (the `key` forces a fresh fetch on period/page change — this is how the URL state drives re-fetch).
  - [x] Surface a localized link to `ROUTES.transactions` from the home page (`src/app/[locale]/page.tsx`) so the view is reachable (there is no intra-app nav yet; keep it simple — a link/button). Add the link label to the `homePage` or `navigation` namespace (both locales).

- [x] **Task 8 — `fetch-transactions` read action (AC1, AC3)**
  - [x] New `src/actions/fetch-transactions.ts` mirroring `src/actions/fetch-profile.ts`: wrap in React `cache()`, **no `'use server'`** (plain async, RSC-importable), forward the session cookie via `createServerApiClient({ cookieHeader })` (from `@supertool/next-shared`), call `TransactionsApiService.transactionsFindAll({ client, query: { dateFrom, dateTo, page, limit } })`. Return `data ?? null`. Pass `dateFrom`/`dateTo` as the month's first/last day `"YYYY-MM-DD"` strings (Task 10 helper) — **do not** apply any timezone offset to them.

- [x] **Task 9 — List + month stepper + empty state components (AC3, AC4, AC5, AC6)**
  - [x] New `src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx` (async server component): compute `dateFrom`/`dateTo` from `period`, call `fetchTransactions`, render `TransactionList` with the rows (or the empty state when `data` is empty). Keep data-fetching in the server component; keep interactivity in client components.
  - [x] New `src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx` — render rows using the `@supertool/ui` `Table` molecule (`Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell` from `packages/ui/src/components/molecules/table`). Columns: date, category (render `categoryParentName ? \`${categoryParentName} / ${categoryName}\` : categoryName`), type, amount, currency, note. Format **amount** and **date** via the Task 11 helpers. Localize column headers (both locales).
  - [x] New `src/app/[locale]/transactions/components/month-stepper/MonthStepper.tsx` — **client component** (`'use client'`). Prev/next buttons (`@supertool/ui` `Button`) compute the adjacent `YYYY-MM` (Task 10 helper) and update the URL via `useRouter` + `usePathname` + `useSearchParams` (`router.replace(\`${pathname}?${params}\`, { scroll: false })`), setting `period` and resetting `page` to `1`. Display the localized month label (`Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' })`). Use the next-intl navigation `useRouter`/`Link` if the app already wraps navigation for locale-prefixing — check `packages/next-shared` i18n routing helpers and `apps/money-tracker/src/middleware.ts`; prefer the locale-aware navigation API over raw `next/navigation` so the locale prefix is preserved.
  - [x] New `src/app/[locale]/transactions/components/transaction-list-skeleton/TransactionListSkeleton.tsx` — Suspense fallback built from the `@supertool/ui` `Skeleton` atom (a handful of full-width skeleton rows). No spinner flags in client state (architecture: reads use Suspense + skeletons).
  - [x] Empty state: a small localized block (use `@supertool/ui` `Typography`, or the `error-state`/empty pattern) shown when the month has no rows. Distinct, friendly copy — "No transactions for this month."
  - [x] All `.module.scss` co-located, PascalCase after the component. Responsive via `@use '@supertool/ui/src/styles/breakpoints'` + `breakpoints.media-m` etc. (NFR8) — never hand-rolled `@media`. Use design tokens (`var(--spacing-*)`, `var(--outline-variant)`, etc.), not literals.

- [x] **Task 10 — Month/period helpers (pure, no TZ traps) (AC3, AC4)**
  - [x] New `src/utils/` (or `src/app/[locale]/transactions/utils/`) helpers, all pure + unit-tested: `getCurrentPeriod(): string` → `"YYYY-MM"`; `parsePeriod(value: string | undefined): { year: number; month: number }` (validate `^\d{4}-\d{2}$/u`, fall back to current month); `getMonthDateRange(year, month): { dateFrom: string; dateTo: string }` → first day `"YYYY-MM-01"` and last day `"YYYY-MM-DD"` (last day via `new Date(year, month, 0).getDate()` — this is a **local Date math constructor on integers**, which is safe; the forbidden anti-pattern is `new Date("2025-03-02")` **parsing a transaction-date string**, not integer-arg Date math); `getPreviousPeriod`/`getNextPeriod(year, month)` (handle Dec↔Jan rollover). Pad month/day to two digits via a small helper, not ad-hoc.
  - [x] **Do not** import or replicate the reference's `convertFilterDateList`/timezone-offset logic — supertool transaction dates are calendar dates with no TZ math (this is a deliberate divergence; see Dev Notes).

- [x] **Task 11 — Formatting helpers (D1, dates rule)**
  - [x] New `format-transaction-amount.ts` — `Intl.NumberFormat(locale, { style: 'currency', currency })` formatting the **string** amount; convert to a number **only at the formatting boundary** (`Number(amount)` strictly for `Intl`, never for arithmetic/storage — keep the string everywhere else). Cache the formatter per (locale, currency) like the reference does.
  - [x] New `format-transaction-date.ts` — format the `"YYYY-MM-DD"` string via `Intl.DateTimeFormat(locale, { year:'numeric', month:'short', day:'numeric' })`. Parse the date with explicit Y/M/D integer args (`new Date(Number(y), Number(m)-1, Number(d))`), **never `new Date(dateString)`** (TZ-shift bug). Alternatively use next-intl's `useFormatter().dateTime` — either is acceptable as long as it is locale-driven, not ad-hoc.

- [x] **Task 12 — i18n: `transactionsPage` namespace, both locales (FR19/FR20)**
  - [x] Add `transactionsPage: 'transactionsPage'` to `packages/shared/src/constants/i18n-namespace.ts` (`I18N_NAMESPACE`).
  - [x] Add `[I18N_NAMESPACE.transactionsPage]: 'transactions-page'` to `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` (the `Record<I18Namespace, string>` is exhaustive — TS will fail to compile until you add the key).
  - [x] Create `apps/money-tracker/messages/en/transactions-page.json` **and** `apps/money-tracker/messages/uk/transactions-page.json` with identical key sets (title, column headers, type labels income/expense, month-nav prev/next aria-labels, empty-state copy). **Both files in the same commit** — `pnpm i18n:parity` (`scripts/check-i18n-parity.mjs`) is a merge-blocking CI gate. Use ICU interpolation, no string concatenation. Add the home-page link label to its namespace in both locales too.

- [x] **Task 13 — Frontend tests (AC7, NFR1)**
  - [x] `TransactionList.test.tsx` — renders rows from a fixture (asserts amount/date are formatted, category shows parent/child); renders the empty state when the list is empty.
  - [x] `MonthStepper.test.tsx` — prev/next updates the `period` URL param and resets `page` (mock the locale-aware router/`useSearchParams`). Note `packages/ui` test gotchas from prior stories: no jest-dom matchers there, ARIA combobox needs `aria-label`, CSF meta needs args — but these are **app** tests; use the money-tracker vitest config (`@testing-library/react`).
  - [x] Unit specs for the Task 10 month helpers (rollover, padding, current-month default) and the Task 11 formatters.

### Verification

- [x] **Gate locally with `--force`** (turbo cache replays stale logs — memory): `pnpm --filter @supertool/api type-check lint test` and `pnpm --filter @supertool/money-tracker type-check lint test`, plus `pnpm i18n:parity`, `pnpm stylelint`, `pnpm fmt:check`. Integration tests need Docker running. Run `pnpm` package scripts, not `node_modules/.bin`; retry on the transient pnpm `H.replace` crash (memory).
- [x] **Visual QA (per persistent project rule — 1.4/1.8 shipped broken UI behind green gates):** run the app, screenshot the transactions view in **both themes** including the populated list, the **empty state**, and the month stepper, on a mobile-width and desktop-width viewport. Record the evidence in the Dev Agent Record. Green gates alone are not sufficient sign-off for a UI-rendering story. (See `verify`/`run` skills.)

## Dev Notes

### Contract decisions baked into this story (read first)

- **Pagination shape = architecture D7, not the reference.** `{ data, meta: { page, limit, total } }` — page-based offset pagination. The reference backend uses a different envelope (`{ object, data, total, page, pageSize, totalPages, hasMore }`); **do not copy it.** Query params are `page`/`limit` (matching the `meta` shape), `dateFrom`/`dateTo` for the window.
- **No timezone math on transaction dates — the single biggest divergence from the reference.** The `date` column is a Postgres `date` (`mode: 'string'`); `dateFrom`/`dateTo` are `"YYYY-MM-DD"` strings compared directly with `gte`/`lte`. The reference frontend (`convertFilterDateList`) shifts the window to UTC using a timezone offset and the reference repo does `gte(transactions.date, new Date(dateFrom))` — **both are wrong for supertool.** Anti-patterns to avoid: `new Date("2025-03-02")` on any transaction-date string (TZ-shift), `parseFloat(amount)` (D1). `new Date(year, month, 0)` with **integer** args for last-day-of-month math is fine (no string parsing).
- **`category` in the list = name, with optional parent.** Seed data is two-level (57% of rows carry a child `Subcategory`). The DTO exposes `categoryName` + nullable `categoryParentName`; the UI renders "Parent / Child" when a parent exists. Resolved via a `transaction_categories` self-join in the repository (LEFT JOIN on the composite `(userId, categoryId)`, then a second LEFT JOIN to an aliased parent). See `seed-data-has-subcategory.md`.
- **This story is read-only.** No POST/PATCH/DELETE, no `ActionState` mutation flow, no `revalidatePath` (those arrive in 2.3/2.4). The deferred 2-1 review item about nullable `import_key` on the insert path is **not** in scope here (2.2 inserts nothing).
- **Generic-DTO trap:** declare a **concrete** `TransactionListResponseDto`; do not attempt a generic `PaginatedResponse<T>` (Swagger generics → poor generated-client types). Reuse `PaginationMetaDto` by composition.

### Architecture hard rules binding this story

- **D1 — money is strings end-to-end.** `numeric(14,2)` → `pg` returns a string → DTO `amount: string` → UI formats with `Intl` (number conversion only at the `Intl` boundary). A `number`-typed amount or `parseFloat` on money is a defect.
- **D7 — layering + REST conventions.** Controller → service → repository; the **repository is the only DB-touching layer**. `/api/v1/...` URI versioning (already global). `{ data, meta }` for lists. camelCase JSON.
- **NFR6 / D8 — generated client only.** No hand-written `fetch` to `/api/*`. Build API → regenerate → commit → drift gate.
- **FR21 — user scoping in the repository.** Every query filters by the authenticated `userId`; second-user isolation is an integration-test assertion.
- **NestJS DI** — explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable (SWC erases decorator metadata under Vitest — `consistent-type-imports` is on). See `nest-di-explicit-inject.md`.
- **FR19/FR20 — both locales same commit;** ICU interpolation, no concatenation; EN is the parity reference.
- **NFR8 — responsive via shared breakpoint mixins** (`packages/ui/src/styles/_breakpoints.scss` / `_mixins.scss`: `media-s/m/l/xl`), design tokens not literals.
- **Naming:** kebab-case files/dirs; component files + co-located `.module.scss`/`.test.tsx` PascalCase after the component (e.g. `month-stepper/MonthStepper.tsx`). Server reads = `fetch-*` plain async (React `cache`); query params camelCase. No code comments (self-documenting names). Function prefixes per `.claude/rules/javascript.md` (`parse*`, `get*`/`derive*`, `build*`/`prepare*`, `format*`, `check*`).
- **Exact dependency versions only; never introduce eslint/prettier.** This story should need **no new dependencies** (drizzle, class-validator, @nestjs/swagger, next-intl, @supertool/ui are all present).

### Source tree — what this story touches

NEW (API):
- `apps/api/src/shared/dtos/pagination-query.dto.ts`, `pagination-meta.dto.ts`
- `apps/api/src/shared/constants/` page-size constants (e.g. `pagination.ts`)
- `apps/api/src/modules/transactions/transactions.module.ts` / `.controller.ts` (+ `.spec.ts`) / `.service.ts` (+ `.spec.ts`) / `.repository.ts`
- `apps/api/src/modules/transactions/dtos/transaction-response.dto.ts`, `transaction-list-response.dto.ts`, `find-transactions-query.dto.ts`
- `apps/api/test/integration/transactions.integration.spec.ts`

NEW (frontend):
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx`
- `.../components/transaction-list/TransactionList.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../components/month-stepper/MonthStepper.tsx` (+ `.module.scss`, `.test.tsx`)
- `.../components/transaction-list-skeleton/TransactionListSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/actions/fetch-transactions.ts`
- month/period + formatter helpers (+ `*.test.ts`)
- `apps/money-tracker/messages/en/transactions-page.json`, `messages/uk/transactions-page.json`

UPDATE (read fully before editing — current behavior to preserve):
- `apps/api/src/app/app.module.ts` — register `TransactionsModule` beside `UsersModule`; **preserve** existing module list + global wiring.
- `apps/money-tracker/src/constants/routes.ts` — add `transactions`; **preserve** existing routes.
- `apps/money-tracker/src/app/[locale]/page.tsx` — add the link to `/transactions`; **preserve** existing home content.
- `packages/shared/src/constants/i18n-namespace.ts` — append `transactionsPage`; **preserve** existing namespaces.
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` — append the mapping (exhaustive record — won't compile without it).
- `packages/shared/src/generated/*` — regenerated by Task 5 (do not hand-edit).

### Reference patterns (study before implementing — `example/` is reference-only, ED1: adapt, never copy/import)

In-repo templates (these are the primary patterns — prefer them over `example/`):
- **API module shape + DI + Swagger + auth guard/session:** `apps/api/src/modules/users/{users.module,users.controller,users.service,users.repository}.ts` and `dtos/*`. The controller's `@ApiTags` + `@UseGuards(AuthGuard)` + `@Session() session: UserSession<typeof auth>` + `session.user.id` is the exact pattern.
- **Repository → Drizzle + DRIZZLE injection + user scoping:** `apps/api/src/modules/users/users.repository.ts` (the `@Inject(DRIZZLE)` + `eq(users.id, userId)` scoping shape; a column-map constant for the select).
- **operationId factory + OpenAPI doc:** `apps/api/src/app/openapi.ts` (`<resource><Method>` → `transactionsFindAll`); enum DTO naming via `apps/api/src/shared/constants/openapi-enum-name.ts` (`transactionType` already registered); `apps/api/src/modules/users/dtos/user-response.dto.ts` for the `@ApiProperty({ enum, enumName })` pattern and string-typed fields.
- **Generated client + config:** `packages/shared/openapi-ts.config.ts` (`byTags` → `{{name}}ApiService`); `packages/shared/src/generated/sdk.gen.ts` (existing `UsersApiService`/`HealthApiService` show the method shape `transactionsFindAll` will take).
- **Integration test harness:** `apps/api/test/integration/seed.integration.spec.ts` + `migrate-on-boot.integration.spec.ts` (Testcontainers lifecycle to copy verbatim); seed gives 1,880 rows / 21 top-level + 34 child categories under the operator to query.
- **Schemas (already built in 2.1):** `apps/api/src/database/schemas/{transactions,transaction-categories,enums}.ts` — columns/indexes (incl. the `(userId, date desc)` index this query rides), `transactionTypeEnum`/`TransactionType`, composite `(userId, categoryId)` FK.
- **Frontend read action + cookie forwarding:** `apps/money-tracker/src/actions/fetch-profile.ts` + `packages/next-shared/src/client/create-server-api-client.ts` (React `cache`, `cookies()`, `createServerApiClient({ cookieHeader })`).
- **Auth-gated server page + redirect + shell layout + locale:** `apps/money-tracker/src/app/[locale]/settings/page.tsx`, `layout.tsx`, `AppShellSection.tsx`.
- **i18n usage:** server `getTranslations(I18N_NAMESPACE.transactionsPage)` / client `useTranslations(...)` (call it `translate`, not `t`); loader `apps/money-tracker/src/i18n/utils/get-messages-by-locale.ts`.
- **UI primitives:** `packages/ui/src/components/molecules/{table,pagination}`, atoms `{skeleton,button,typography,badge}`; SCSS `packages/ui/src/styles/_breakpoints.scss`/`_mixins.scss`, tokens under `styles/tokens/`.

Reference repos (adapt patterns only — never import/copy, ED1):
- `example/tracker-backend-api/src/modules/transactions/transactions.repository.ts` — the `Promise.all([dataQuery, countQuery])` + conditions-array + category self-join shape. **Diverge:** `{ data, meta:{page,limit,total} }` (not their envelope), `date` string comparison (not `new Date(dateFrom)`), `text` PK, snake_case, no soft-delete.
- `example/track-my-life/.../transactions/` — the searchParams→Suspense-key page pattern, month navigator, `getMonthDateRange`/`getPreviousMonth`/`getNextMonth`, `formatAmount`/`formatDate`, list/empty-state components. **Diverge:** single `period=YYYY-MM` param (not their multi-param filter set — filters are 2.5), no timezone offset conversion, supertool naming/tokens, two-locale i18n.

### Testing standards

- Vitest + SWC decorators for API (`apps/api/vitest.config.ts`); `@testing-library/react` for money-tracker (`apps/money-tracker/vitest.config.ts` — Next-app oxc `jsx:'react-jsx'` override is already configured, see `next-app-vitest-jsx-preserve.md`).
- Co-located `*.spec.ts` (API) / `*.test.ts(x)` (frontend); Testcontainers integration in `apps/api/test/integration/*.integration.spec.ts` (`postgres:16-alpine`).
- Arrange-Act-Assert; name vars `inputX`/`expectedX`/`actualX`.
- Run gates with `--force`; use `pnpm` scripts not `.bin`; retry on the pnpm `H.replace` crash (memories: `turbo-cache-masks-gate-results`, `run-tests-via-pnpm-scripts`).

### Project Structure Notes

- API module lands at `src/modules/transactions/` exactly as the architecture tree specifies; shared pagination DTOs at `src/shared/dtos/` (the first list endpoint legitimately creates them — no prior pagination infra exists). No `schemas/index.ts` barrel (drizzle scans the dir; no-barrel rule).
- Frontend feature lives under `app/[locale]/transactions/` with `components/<feature>/` grouping inside it (architecture: feature grouping happens inside `components/`). The app has no route group `(app-layout)` like the reference — top-level `[locale]/transactions` is correct here.
- No new dependencies expected; if one is unavoidable, pin exact + record in Dev Agent Record (and consult `architecture.md` first).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Browse Transactions by Month]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] (D7 pagination/layering/REST)
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] (D1 money strings)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] (D9 RSC + searchParams; no global state)
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] (money strings, dates/no-TZ, i18n)
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns / Structure Patterns]
- [Source: _bmad-output/implementation-artifacts/2-1-seed-the-real-data.md] (schema, enums, seed data, integration harness)
- [Source: _bmad-output/implementation-artifacts/epic-2-parallelization.md] (2.2 = first Track A story; module scaffold others build on)
- [Source: apps/api/src/modules/users/*] (module/controller/service/repository/DTO template)
- [Source: apps/api/src/app/openapi.ts, src/shared/constants/openapi-enum-name.ts, src/shared/dtos/error-response.dto.ts]
- [Source: apps/api/src/database/schemas/{transactions,transaction-categories,enums}.ts]
- [Source: apps/api/test/integration/seed.integration.spec.ts, migrate-on-boot.integration.spec.ts]
- [Source: packages/shared/openapi-ts.config.ts, packages/shared/src/generated/sdk.gen.ts, packages/shared/src/constants/error-codes.ts]
- [Source: apps/money-tracker/src/actions/fetch-profile.ts, src/app/[locale]/settings/page.tsx, src/app/[locale]/layout.tsx]
- [Source: packages/next-shared/src/client/create-server-api-client.ts]
- [Source: apps/money-tracker/src/i18n/utils/get-messages-by-locale.ts, src/i18n/constants/localization-messages-file-name-by-namespace.ts, packages/shared/src/constants/i18n-namespace.ts]
- [Source: packages/ui/src/components/molecules/{table,pagination}, packages/ui/src/styles/_breakpoints.scss]
- Project memory: `seed-data-has-subcategory.md`, `turbo-cache-masks-gate-results.md`, `run-tests-via-pnpm-scripts.md`, `nest-di-explicit-inject.md`, `next-app-vitest-jsx-preserve.md`, `ui-stories-need-visual-qa.md`, `follow-example-repo-patterns.md`, `verify-middleware-redirect-changes-live.md`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `exactOptionalPropertyTypes` rejected passing `string | undefined` into the repository's optional `dateFrom`/`dateTo`; widened the internal query interface to `?: string | undefined`.
- `@Query() FindTransactionsQueryDto` is the repo's first query DTO: oxlint `consistent-type-imports` wanted to convert it to `import type`, which SWC erases → `ValidationPipe` would lose the param metadata. Kept it a value import with a single scoped `oxlint-disable-next-line` (the `@Inject`/`@ApiBody` value-reference trick that saves other DTOs doesn't apply to GET query params).
- `@supertool/shared` is consumed from `dist/` (exports map `./*` → `./dist/*`), so the regenerated client + new `transactionsPage` namespace required `pnpm --filter @supertool/shared build` before money-tracker type-check saw them.
- App-level lint (unlike the nest config) enforces `no-magic-numbers` and `id-length` in source AND tests → extracted named constants (period steps, page size, header-row count) and aliased async server components to lowercase locals in tests to satisfy `new-cap`.
- `formatTransactionDate` guards with a calendar-date regex (`.test`) before `new Date(y, m-1, d)` so non-date input returns the raw string instead of throwing on `NaN` (no string parsing, no TZ shift — D1/dates rule).
- Widened money-tracker `vitest.config.ts` `include` to `*.test.{ts,tsx}` so the pure helper `.test.ts` specs run (matches the project testing standard).

### Completion Notes List

- **API:** new `transactions` module (controller → service → repository, D7) exposing `GET /api/v1/transactions` with `?dateFrom&dateTo&page&limit`, returning `{ data, meta: { page, limit, total } }`. Repository is the only DB-touching layer: user-scoped (`eq(userId)` first, FR21), inclusive date-string window with **no `new Date(...)`** on transaction dates, category self-join (LEFT JOIN on composite `(userId, categoryId)` + aliased parent) yielding `categoryName`/`categoryParentName`, `desc(date), desc(id)` stable pagination, parallel data+count via `Promise.all`. Amounts pass through as strings (D1).
- **Shared pagination infra:** `PaginationQueryDto` (`@Type`-coerced `page`/`limit` with `DEFAULT_PAGE_SIZE=50`/`MAX_PAGE_SIZE=100`) + `PaginationMetaDto`; concrete `TransactionListResponseDto` (no generic, per the Swagger-generics trap).
- **Generated client:** rebuilt `openapi.json` + regenerated `packages/shared/src/generated/*` → new `TransactionsApiService.transactionsFindAll`, `amount: string`, `categoryParentName: string | null`; no leaked query-DTO schema. Drift-stable.
- **Frontend:** `/transactions` route (auth-gated via `fetchProfile` → redirect), `searchParams`→Suspense-`key` page, `MonthStepper` (client, locale-aware `useRouter` URL `?period=YYYY-MM`, page reset on change), `TransactionListServer` (RSC fetch) → `TransactionList`/`TransactionEmptyState`, `TransactionListSkeleton`. `@supertool/ui` `Table`/`Badge`/`Skeleton`/`Typography`; responsive via `breakpoints` mixins + tokens. Pure period helpers + `Intl`-based amount/date formatters (number conversion only at the `Intl` boundary). `transactionsPage` i18n in en + uk (key-parity green); home-page link added in both locales.
- **Tests:** API service spec (defaulting/assembly) + controller spec (forwards `session.user.id` + query) + Testcontainers integration spec proving range windowing, second-user isolation, pagination disjoint/stable order, string amounts, and child-category name resolution against real seeded Postgres. Frontend: `TransactionList`/`TransactionEmptyState`/`MonthStepper` component tests + period/formatter/search-param unit specs. Full suite green: **API 86 tests (incl. integration), money-tracker 29 tests.**
- **Gates (forced, no turbo cache):** type-check, lint, test (api + money-tracker + shared), `i18n:parity`, `stylelint`, `fmt:check` all green.
- **Visual QA (mandatory):** ran the app (dev servers against the seeded Postgres, headless cached Chromium against a self-created QA user with inserted June-2026 data) and reviewed screenshots in BOTH themes + BOTH locales + desktop/mobile + populated/empty:
  - `desktop-light-populated` / `desktop-dark-populated`: month stepper + localized "June 2026" label, columns Date/Category/Type/Amount/Currency/Note, `Food / Groceries` parent-child label, Income(green)/Expense(grey) badges, currency-formatted right-aligned amounts (`UAH 1,234.56`, `$89.90`), date-desc order. Dark theme contrast correct.
  - `mobile-light-populated` / `mobile-dark-populated`: header + stepper stack; the `@supertool/ui` Table wrapper scrolls horizontally (NFR8 — usable).
  - `desktop/mobile empty` (`?period=2099-01`): centered localized empty state ("No transactions for this month").
  - `uk-desktop-populated`: Ukrainian headers (Дата/Категорія/Тип/Сума/Валюта/Нотатка), `Витрата`/`Дохід` badges, `Червень 2026 р.` label, uk number/currency formatting (`1 234,56 ₴`). Screenshots: `/tmp/tx-visual-qa/shots/`.
- **Out-of-scope finding (not 2.2 code):** the Docker `api` image build fails at `dist/emit-openapi.js` because the better-auth singleton's `parseEnv()` runs at **build time** and requires `SEED_OPERATOR_PASSWORD` (no build-time value in `docker/api.Dockerfile`). This is a story-2.1 regression (emit-openapi shouldn't need a runtime secret); it blocked the compose path, so visual QA used dev servers. Recommend a follow-up to stub/skip auth-env at openapi emission.
- **Local-DB note:** visual QA was done via dev servers; the dev API re-seeded the shared local Postgres (added a second operator + a duplicate 1880-row cluster under the existing operator). Cleanup of that pre-existing operator's data was blocked by the safety classifier — see final message; `pnpm compose:down -v` resets it. No effect on the codebase/deliverable.

### File List

**API (new):**
- `apps/api/src/shared/constants/pagination.ts`
- `apps/api/src/shared/dtos/pagination-query.dto.ts`
- `apps/api/src/shared/dtos/pagination-meta.dto.ts`
- `apps/api/src/modules/transactions/transactions.module.ts`
- `apps/api/src/modules/transactions/transactions.controller.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/dtos/transaction-response.dto.ts`
- `apps/api/src/modules/transactions/dtos/transaction-list-response.dto.ts`
- `apps/api/src/modules/transactions/dtos/find-transactions-query.dto.ts`
- `apps/api/src/modules/transactions/transactions.service.spec.ts`
- `apps/api/src/modules/transactions/transactions.controller.spec.ts`
- `apps/api/test/integration/transactions.integration.spec.ts`

**API (modified):**
- `apps/api/src/app/app.module.ts` (registered `TransactionsModule`)
- `apps/api/openapi.json` (regenerated)

**Shared (modified):**
- `packages/shared/src/constants/i18n-namespace.ts` (added `transactionsPage`)
- `packages/shared/src/generated/*` (regenerated client: `sdk.gen.ts`, `types.gen.ts`, `index.ts`)

**Frontend (new):**
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx` (+ `page.module.scss`)
- `apps/money-tracker/src/app/[locale]/transactions/constants.ts`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx`
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-empty-state/TransactionEmptyState.tsx` (+ `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-error/TransactionError.tsx` (+ `.module.scss`, `.test.tsx`) — added in code review (localized API-error state)
- `apps/money-tracker/src/app/[locale]/transactions/components/month-stepper/MonthStepper.tsx` (+ `ChevronIcon.tsx`, `.module.scss`, `.test.tsx`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-skeleton/TransactionListSkeleton.tsx` (+ `.module.scss`)
- `apps/money-tracker/src/app/[locale]/transactions/utils/period.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/utils/format-transaction-amount.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/utils/format-transaction-date.ts` (+ `.test.ts`)
- `apps/money-tracker/src/app/[locale]/transactions/utils/format-period-label.ts`
- `apps/money-tracker/src/app/[locale]/transactions/utils/parse-transactions-search-params.ts` (+ `.test.ts`)
- `apps/money-tracker/src/actions/fetch-transactions.ts`
- `apps/money-tracker/messages/en/transactions-page.json`, `apps/money-tracker/messages/uk/transactions-page.json`

**Frontend (modified):**
- `apps/money-tracker/src/constants/routes.ts` (added `transactions`)
- `apps/money-tracker/src/app/[locale]/page.tsx` (link to `/transactions`, namespace constant)
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` (added mapping)
- `apps/money-tracker/messages/en/home-page.json`, `apps/money-tracker/messages/uk/home-page.json` (added `transactionsLink`)
- `apps/money-tracker/vitest.config.ts` (include `*.test.{ts,tsx}`)

### Review Findings

_Code review 2026-06-14 (adversarial 3-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor). All quality gates green (type-check, lint, test, stylelint, fmt). AC1–AC7 all satisfied; no hard-rule violation found._

**Decisions resolved (2026-06-14, by Oleksii):**

- API error vs empty month → **add an error state now** (→ patch P4 below).
- Visual QA artifacts → **spot-checked** during review: 8 shots in `/tmp/tx-visual-qa/shots/` verified — both themes + uk locale (native `1 234,56 ₴` formatting) + mobile horizontal-scroll + localized empty state all render correctly. Visual-evidence gate satisfied.
- Within-month pagination UI → **deferred to Story 2.5** (see deferred list + `deferred-work.md`).

**Patch** (all applied 2026-06-14 — gates re-run green: type-check, lint, test [api 86, money-tracker 36], i18n-parity, stylelint, fmt)

- [x] [Review][Patch] Distinguish API error from an empty month — `fetchTransactions` now returns a discriminated `FetchTransactionsResult` (`{ status: 'success', transactions } | { status: 'error' }`); `TransactionListServer` renders a new localized `TransactionError` component on error (strings in en+uk, `TransactionError.test.tsx` added) instead of the empty state. `fetch-transactions.ts`, `TransactionListServer.tsx`, `transaction-error/*`, `transactions-page.json` (en/uk).
- [x] [Review][Patch] `formatTransactionAmount` money→number coercion — added a `Number.isFinite` guard returning the raw amount on non-numeric input (mirrors `formatTransactionDate`), removing the `"$NaN"` path. Kept `Number()` for the `Intl.format` call: the TS lib types `format` as number-only (passing a string needs a banned `as`), and `numeric(14,2)` max (~10¹²) is well within `2^53` so no precision loss manifests. `format-transaction-amount.ts:17`.
- [x] [Review][Patch] Parent-category self-join now user-scoped — added `eq(transactionCategories.userId, parentCategory.userId)` to the parent `leftJoin`, tying the parent to the child's owner so `categoryParentName` cannot resolve across users. `transactions.repository.ts:101`.
- [x] [Review][Patch] Formatter unit tests off `'en-US'` — switched to runtime locales `'en'`/`'uk'`, added a `uk` UAH/`₴` assertion and a uk date assertion plus a non-finite fallback test. `format-transaction-amount.test.ts`, `format-transaction-date.test.ts`.

**Deferred** (see `deferred-work.md`)

- [x] [Review][Defer] No within-month pagination UI ships — `page` is parsed, sent to the API, and keys the Suspense boundary, but no control renders and `meta.total` is never read; rows beyond `TRANSACTIONS_PAGE_SIZE=50` are unreachable in a month [`page.tsx`, `TransactionListServer.tsx`] — deferred to Story 2.5 (within-month pagination belongs with filter/sort)
- [x] [Review][Defer] No `@Max` on `page`; unbounded offset and no page-beyond-total clamp [`pagination-query.dto.ts`] — deferred, revisit with the 2.5 pagination UI
- [x] [Review][Defer] API accepts `dateFrom > dateTo` and shape-valid-but-impossible dates (`2025-02-30`, `2025-13-01`) with no cross-field/calendar check [`find-transactions-query.dto.ts`] — deferred, UI cannot trigger; direct-API hardening
- [x] [Review][Defer] Second-user isolation integration assertion can false-pass if the operator's month window exceeds `HIGH_LIMIT=1000` rows (absence via truncation, not scoping) [`transactions.integration.spec.ts`] — deferred, test robustness
- [x] [Review][Defer] `MonthStepper` derives the next/prev period from the (possibly stale) prop, not the freshest URL — rapid double-click can land one month off [`MonthStepper.tsx`] — deferred, minor concurrency edge

**Dismissed (noise / handled):** `note` nullability (column is `NOT NULL DEFAULT ''`); `parsePeriod` unbounded year (resets gracefully to current month); `cache()` arg-identity (single call site, cookies read inside — no staleness); controller spec not exercising `AuthGuard` (`@UseGuards` declared; integration spec proves scoping); `categoryName ?? ''` (FK-protected, defensive).

## Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 2.2 drafted — transactions module (GET list, offset pagination, date window, user scoping), shared pagination DTOs, generated-client regen, /transactions route with month stepper + list + empty state + transactionsPage i18n. Status → ready-for-dev. |
| 2026-06-14 | Story 2.2 implemented — transactions API module + shared pagination DTOs + regenerated client; /transactions route (month stepper, list, empty state, skeleton) + period/format helpers + en/uk i18n. API 86 tests (incl. Testcontainers integration) + money-tracker 29 tests green; all gates (type-check/lint/test/i18n-parity/stylelint/fmt) green; visual QA passed in both themes + both locales + desktop/mobile. Status → review. |
