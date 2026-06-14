---
baseline_commit: 46c08167300ee2f41acc3f2a1fe09a83333ee952
---

# Story 2.1: Seed the Real Data

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want my 1,880 real transactions imported automatically, exactly, and idempotently,
so that the tracker is meaningful from the first boot — no manual data-entry marathon.

This is the **gate story for Epic 2** (see `epic-2-parallelization.md`): it creates the `transactions` + `transaction_categories` schema and derives the shared transaction-type enum from the Drizzle schema (single source of truth). Every other Epic 2 story imports that schema and that enum — there is no useful parallel work before it lands. It introduces **no HTTP endpoints**; the transactions / transaction-categories API modules arrive in 2.2+.

## Acceptance Criteria

> Two ACs (8 and 9) were added per the Epic 1 retrospective (Actions 5 & 6, folded into 2.1). Two operator decisions (2026-06-14) shape the data model — see Dev Notes "Operator decisions."

**AC1 — Domain schema (FR17, D1, D4, D6 conventions)**
**Given** the domain schema created by this story — `transaction_categories` and `transactions`, one file per table in `apps/api/src/database/schemas/`, snake_case tables/columns with Drizzle camelCase mapping, **`text` PK populated app-side via `generateId()` (UUIDv7, D4)**, `user_id` on every row referencing `users.id`, `numeric(14,2)` amounts, a `date` column (calendar date, no timezone) for the transaction date, and a unique-indexed `import_key` —
**When** `pnpm --filter @supertool/api db:generate` then `db:migrate` run,
**Then** the migration applies cleanly against Postgres 16 and `transaction_type` is a `pgEnum` in `schemas/enums.ts` whose TS union (`TransactionType`) is derived from `enumValues` (single source of truth — no re-listed members, per typescript.md).

**AC2 — Two-level category derivation (FR11, FR10, operator decision)**
**Given** the seed source `transactions-02.03.25.json` committed under `apps/api/src/database/data/`,
**When** the seed runs,
**Then** each distinct `Category` becomes a **top-level** category (`parent_id` NULL) and each distinct `Subcategory` becomes a **child** category under its parent `Category` (`parent_id` set), each category carrying the `type` (income/expense) of the transactions that reference it — derived from the data, never hardcoded.

**AC3 — Exact transaction import (FR17, D1)**
**Given** the running seed,
**When** all 1,880 records import,
**Then** every record is attached to the operator's `user_id` with its **amount, currency, and date preserved exactly** (amount stored as `numeric(14,2)`, date stored as `"YYYY-MM-DD"` parsed from the source `MM/DD/YYYY HH:MM:SS`, currency as the source code), a transaction whose source record carries a `Subcategory` attaches to the **child** category (else the top-level category), and the `note` is empty (`''`) on every imported row (FR6 "imported seed records get an empty note").

**AC4 — Import report, no silent merging (D2)**
**Given** the seed completes,
**When** it finishes,
**Then** it emits a structured import report (Pino) summarizing: records inserted vs skipped-as-duplicate, top-level categories created, child categories created, and **any near-duplicate category/subcategory strings surfaced for review — never silently merged** (D2). For the committed dataset the near-duplicate list is expected to be empty; the detection mechanism must still exist and be unit-tested.

**AC5 — Idempotent re-run (FR17, D2)**
**Given** a completed seed,
**When** the seed runs a second time,
**Then** **zero** duplicate transactions and zero duplicate categories result — transaction idempotency keyed on `import_key` = SHA-256 of the normalized source record **+ its source row index**, inserted via `ON CONFLICT (import_key) DO NOTHING`; category idempotency via the `(user_id, name, type, parent_id)` unique index (`NULLS NOT DISTINCT`).

**AC6 — Operator account bootstrapping (FR17, D6, operator decision)**
**Given** the seed and the better-auth instance,
**When** the seed runs and the operator account (matched by `SEED_OPERATOR_EMAIL`) does not yet exist,
**Then** the seed creates it through better-auth's **server API** (so it is sign-innable with `SEED_OPERATOR_PASSWORD`), sets its name to `SEED_OPERATOR_NAME`, and **promotes it to `admin`** (role promotion is a seed concern, D6); if it already exists the seed reuses it and ensures `role = 'admin'` — both paths idempotent. All transactions and categories attach to this account.

**AC7 — Boot threading: migrate → seed → listen (NFR3, retro Action 5)**
**Given** the docker-compose runtime hook from Story 1.7,
**When** the API container starts,
**Then** `prepareDatabase` runs migrations and then **`runSeed` with real DB access threaded through the boot sequence** (the parameterless 1.7 stub is replaced — `runSeed` now receives the DB connection / `databaseUrl` it needs) **before** the app listens, making the dashboard meaningful on first boot; a Testcontainers integration test asserts that booting against an empty database results in a fully-seeded database.

**AC8 — Decimal-safe money harness (FR18, D1, retro Action 6)**
**Given** Testcontainers integration tests and `decimal.js` (new sanctioned dependency, exact-pinned),
**When** the suite runs,
**Then** a reusable D1 decimal-safety harness asserts that the **per-currency SQL `SUM(amount)`** returned from Postgres as a string **exactly equals** the independently computed sum of the source amounts (each source amount converted to a 2-dp `Decimal`, summed with `decimal.js`, never JS float arithmetic) — proving money-as-strings end-to-end with no floating-point drift. This harness is written to be reused by Epic 3 analytics stories.

**AC9 — Integration coverage (NFR1 priority target, D10)**
**Given** Testcontainers integration tests against real Postgres,
**When** the suite runs,
**Then** it asserts: (a) **re-run safety** (running the seed twice yields identical row counts — AC5), (b) **per-currency total sums** match the source exactly (AC8), (c) **record count** = 1,880, (d) **category derivation** — correct top-level count, correct child count, every child's `parent_id` points at the right parent, and the three names that exist at both levels (`Здоров'я`, `Навчання`, `Одяг`) produce distinct rows, and (e) **operator scoping** — every imported row carries the operator `user_id`. Unit tests cover the date parser, the `import_key` hasher, the amount→string converter, and the near-duplicate detector.

## Tasks / Subtasks

- [x] **Task 1 — Schema: transaction-type enum + two domain tables (AC1, AC2)**
  - [x] In `apps/api/src/database/schemas/enums.ts`, add `export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense'])`, `export type TransactionType = (typeof transactionTypeEnum.enumValues)[number]`, and (optional but recommended) `export const TRANSACTION_TYPE_LIST = [...transactionTypeEnum.enumValues]`. Do NOT re-list the values anywhere (typescript.md single-source rule). [Reference: `example/tracker-backend-api/src/database/schemas/enums.ts` — values diverge: supertool uses lowercase `income`/`expense`, not the reference's `INCOME`/`EXPENSE`.]
  - [x] New file `schemas/transaction-categories.ts` exporting `transactionCategories` (`pgTable('transaction_categories', …)`): `id` text PK, `userId` text NOT NULL → `users.id` `onDelete: 'cascade'`, `name` text NOT NULL, `type` `transactionTypeEnum` NOT NULL, `parentId` text self-ref → `transactionCategories.id` `onDelete: 'restrict'` (use `AnyPgColumn` for the self-reference type), `createdAt`/`updatedAt` `timestamptz` NOT NULL defaultNow. Indexes: `uniqueIndex('transaction_categories_user_id_name_type_parent_id_unique').on(userId, name, type, parentId).nullsNotDistinct()` (so top-level names with NULL parent are unique per user/type), `index` on `userId`, `index` on `parentId`, and `unique('transaction_categories_user_id_id_unique').on(userId, id)` (needed for the composite FK in Task 1c). [Reference: `example/tracker-backend-api/src/database/schemas/transaction-categories.ts` — adapt: snake_case names, `text` PK (not `uuid().defaultRandom()`), NO `deletedAt` soft-delete column (documented divergence — supertool does hard delete with reassignment in 2.6).]
  - [x] New file `schemas/transactions.ts` exporting `transactions` (`pgTable('transactions', …)`): `id` text PK, `userId` text NOT NULL → `users.id` `onDelete: 'cascade'`, `categoryId` text NOT NULL, `type` `transactionTypeEnum` NOT NULL, `amount` `numeric('amount', { precision: 14, scale: 2 })` NOT NULL, `currency` text NOT NULL, `date` `date('date', { mode: 'string' })` NOT NULL, `note` text NOT NULL `.default('')`, `importKey` text (nullable), `createdAt`/`updatedAt` `timestamptz` NOT NULL defaultNow. Constraints/indexes: `uniqueIndex('transactions_import_key_unique').on(importKey)`, composite `foreignKey({ columns: [userId, categoryId], foreignColumns: [transactionCategories.userId, transactionCategories.id] }).onDelete('restrict')` (a transaction's category must belong to the same user — FR21 integrity), `check('transactions_amount_positive', sql\`amount > 0\`)`, `index` on `userId`, composite `index` on `(userId, date desc)`, `index` on `categoryId`, `index` on `type`, `index` on `currency`. [Reference: `example/tracker-backend-api/src/database/schemas/transactions.ts` — adapt: snake_case, `text` PK, `numeric(14,2)` (not 19,2), **`date` column not `timestamptz`** for the transaction date (architecture dates rule — no TZ math), `note` (empty) not `description`.]
  - [x] Add `transactionType: 'TransactionType'` to `OPENAPI_ENUM_NAME` (`src/shared/constants/openapi-enum-name.ts`) so 2.2+ DTOs single-source the generated enum name. [No DTO uses it yet — harmless to register now.]
  - [x] Run `pnpm --filter @supertool/api db:generate`, inspect the generated SQL migration + snapshot, commit them. Verify `db:migrate` applies cleanly. [Note: schemas are discovered by `drizzle.config.ts` scanning the `schemas/` dir — there is NO `index.ts` barrel and none should be added (no-barrel rule). Existing schema files are imported directly where needed.]

- [x] **Task 2 — Commit the real seed data file + ship it to `dist` (AC3, build)**
  - [x] Copy the source data into the repo as `apps/api/src/database/data/transactions-02.03.25.json` (this is the product's **real data**, explicitly committed per FR17 / NFR4 — copying the JSON data file is allowed; it is data, not example source code, so ED1's "never copy code" does not apply). Source: `example/tracker-backend-api/src/database/data/transactions(02:2025).json`.
  - [x] Add `{ "include": "database/data/**/*.json", "watchAssets": true }` to `nest-cli.json` `compilerOptions.assets` so the JSON lands in `dist/` (mirrors how migrations are copied). **Without this the file is absent at runtime in the Docker image** — a build-only failure unit gates cannot catch.
  - [x] The seed resolves the data file from `__dirname` (same approach as `main.ts` resolving the migrations folder), so it works both from `dist` and under tests.

- [x] **Task 3 — Seed import pipeline (AC2, AC3, AC4, AC5)**
  - [x] Create the seed under `apps/api/src/database/seeds/` (new dir). Pure functions, no Nest DI (the seed runs in the boot sequence before the Nest app exists). Suggested split: `seed-transactions.ts` (orchestrator), `parse-seed-date.ts`, `build-import-key.ts`, `derive-categories.ts`, `find-near-duplicate-categories.ts`, `seed.types.ts`. Follow `.claude/rules/javascript.md` function-prefix conventions (`parse*`, `build*`/`prepare*`, `derive*`/`get*`, `check*`).
  - [x] **Date parser** (`parse-seed-date.ts`): `"MM/DD/YYYY HH:MM:SS"` → `"YYYY-MM-DD"` by splitting on space then `/` and reordering. **Never `new Date(sourceString)`** (TZ shift + ambiguous-format parsing — architecture anti-pattern). Unit-test boundary cases (`02/03/2025 15:41:17` → `2025-02-03`; single-digit month/day padding).
  - [x] **Amount converter**: each source `Amount` (a JS number, all positive, ≤2 dp in this dataset) → a 2-dp string via `new Decimal(amount).toFixed(2)`. Store the string in `numeric(14,2)`. Never `parseFloat`/float math (D1).
  - [x] **import_key hasher** (`build-import-key.ts`): SHA-256 (node `crypto`) over a stable serialization of the normalized record fields (`date` normalized, `category`, `subcategory ?? ''`, `type`, `amount` 2-dp string, `currency`) **concatenated with the source row index**. The row index is mandatory — it disambiguates legitimately-repeated records so each imports exactly once and re-runs never duplicate. Unit-test determinism + that index changes the hash.
  - [x] **Category derivation** (`derive-categories.ts`): build the `Category → {type, Set<Subcategory>}` map from the records (type taken from the records — verified single-type per category in this data); insert top-level categories first (capturing their ids), then child categories with `parentId` set; return `Map<categoryName, id>` and `Map<subcategoryName, id>`. Use `ON CONFLICT … DO NOTHING` + re-select, or find-or-create, so re-runs are idempotent. [Reference: `example/tracker-backend-api/src/database/seeds/category.seed.ts` — adapt to supertool conventions and `ON CONFLICT`.]
  - [x] **Transaction insert**: batch-insert (e.g. 100/batch) mapping each record → row; `categoryId` = child id when `Subcategory` present, else top-level id; `note = ''`; `importKey` from the hasher; `ON CONFLICT (import_key) DO NOTHING`. [Reference: `example/tracker-backend-api/src/database/seeds/transaction.seed.ts` — adapt: attach to child-when-present is the same; supertool sets empty `note` (reference wrote a `description`).]
  - [x] **Near-duplicate detector** (`find-near-duplicate-categories.ts`): surface category/subcategory strings that normalize (trim + casefold, and flag mixed Latin/Cyrillic scripts) to the same key but differ raw — return the clusters for the report; do NOT merge them. Unit-test with a synthetic mixed-script pair (e.g. the Latin-`T` `Tаксі` vs a Cyrillic-`Т` variant).
  - [x] **Import report**: log a single structured Pino summary object (inserted, skippedDuplicates, topLevelCreated, childrenCreated, nearDuplicateClusters). No `console.*` (lint-forbidden — Pino only).

- [x] **Task 4 — Operator account via better-auth + role promotion (AC6)**
  - [x] Add `SEED_OPERATOR_EMAIL`, `SEED_OPERATOR_PASSWORD` (min 8 — better-auth `minPasswordLength`), `SEED_OPERATOR_NAME` to `envSchema` (`src/app/env.schema.ts`). Decide defaults deliberately: give `EMAIL`/`NAME` safe local `.default()`s; treat `PASSWORD` as required-with-no-default per the env rule (supply it in `.env.example` + compose). Whatever you choose, **first `docker compose up` must succeed with no manual config** (NFR3).
  - [x] List all three in `apps/api/.env.example` with local-dev values, add them to the `api` service `environment` in `docker/docker-compose.yml`, and add placeholder values anywhere CI boots the API or runs the integration suite (turbo/CI env propagation — see the "new env vars" memory; verify with `turbo … --force`, not a cached green).
  - [x] In the seed: find the user by `SEED_OPERATOR_EMAIL`; if absent, create it through the better-auth **server API** (`auth.api.signUpEmail({ body: { email, password, name } })` — reuses the existing `auth` singleton in `src/auth/auth.ts`, which already wires the Drizzle adapter, `generateId`, and the `users` model). Then set `role = 'admin'` via a direct Drizzle update (the `role` additional field is `input: false`, so it cannot be set through signup). Return the operator `userId`. Idempotent on both paths. [No reference counterpart — the reference used bcrypt + a local-identity table; supertool goes through better-auth. New ground.]
  - [x] Confirm seeding works in `NODE_ENV=test` (integration tests call the seed directly) and during boot (dev/local). Ensure the better-auth instance's own pool does not leak the process open in tests (it is module-level; the integration test owns container lifecycle).

- [x] **Task 5 — Thread `runSeed` through the boot sequence (AC7)**
  - [x] Replace the parameterless stub in `src/database/run-seed.ts` with `runSeed({ databaseUrl })` (mirror `run-migrations.ts`: create a `pg` Pool, run the full import inside it — ideally one transaction for atomicity — then `pool.end()` in `finally`). Decide whether the operator creation (which uses better-auth's own pool) runs before opening the seed pool — keep the ordering explicit and documented in code structure.
  - [x] Update `prepareDatabase` (`src/database/prepare-database.ts`) to pass `databaseUrl` into `runSeed` (it already receives it). Update `prepare-database.spec.ts` accordingly.
  - [x] Keep `main.ts`'s `prepareDatabase` call (migrate → seed → listen) intact — verify boot order is preserved.

- [x] **Task 6 — Tests (AC7, AC8, AC9, NFR1, D10)**
  - [x] Add `decimal.js` at exact `10.6.0` to `apps/api` dependencies (architecture D1 / new-dependency rule — record it in the Dev Agent Record).
  - [x] **D1 decimal-safety harness** (reusable helper under `test/integration/` or `test/helpers/`): given a DB connection, returns per-currency `SUM(amount)` as strings; given the source records, returns the decimal.js-summed expected per-currency totals; asserts exact string equality. Written for Epic 3 reuse.
  - [x] **`test/integration/seed.integration.spec.ts`** (Testcontainers Postgres — follow `migrate-on-boot.integration.spec.ts` exactly for container setup, `RYUK_DISABLED`, `BOOT_TIMEOUT_MS`, wait strategy): run migrations, run the seed, then assert AC9 (a)–(e) and AC8. Re-run the seed and assert identical counts (AC5). Assert booting an empty DB through `prepareDatabase` yields a seeded DB (AC7).
  - [x] **Unit specs** co-located beside the source (`*.spec.ts`): date parser, import_key hasher (determinism + index sensitivity), amount converter, near-duplicate detector, category derivation (pure mapping logic). Use the SWC-decorator Vitest config already in place.
  - [x] Gate locally with `--force` (turbo cache masks results — memory): `pnpm --filter @supertool/api type-check lint test`. Integration tests need Docker running.

- [x] **Task 7 — No client regen / drift gate sanity (NFR6, D8)**
  - [x] Confirm 2.1 adds **no controllers/DTOs/endpoints** → `openapi.json` is unchanged → the committed generated client is untouched and the CI drift gate stays trivially green. If `pnpm --filter @supertool/api build` (which runs `emit-openapi.js`) changes `openapi.json`, investigate before proceeding (it should not).

### Review Findings

Code review 2026-06-14 (adversarial layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Gates all green (type-check, lint, test incl. live idempotency). AC1–AC9 and all merge-blocking hard rules verified satisfied by the Acceptance Auditor.

- [x] [Review][Patch] FIELD_SEPARATOR is a raw NUL byte, not a space — idempotency-hash landmine [apps/api/src/database/seeds/build-import-key.ts:9] — FIXED: replaced with explicit ASCII `''` (unit separator); file is now reviewable ASCII, not git-binary
- [x] [Review][Patch] parseSeedDate does no numeric/range validation — a 2-digit year (`"2/3/25"`) yields `"25-02-03"` (year 25 AD), silently stored [apps/api/src/database/seeds/parse-seed-date.ts:3-12] — FIXED: enforces 4-digit year + numeric, in-range month/day; throws otherwise. Added 3 regression tests
- [x] [Review][Patch] `db:seed` standalone entrypoint hangs on success — better-auth module pool never closed, no `process.exit(0)` [apps/api/src/seed.ts:6-15] — FIXED: `process.exit(0)` on success
- [x] [Review][Defer] Nullable `import_key` + plain `uniqueIndex` lets future NULL-key rows bypass ON CONFLICT dedup [apps/api/src/database/schemas/transactions.ts:730] — deferred; seed always sets the key, this is a 2.2+ insert-path concern (drizzle 0.45.2 blocks `nullsNotDistinct` on `uniqueIndex`)
- [x] [Review][Defer] Category type taken from first-seen record; child inherits parent type — silent mis-type if a category ever appears under both income & expense [apps/api/src/database/seeds/derive-category-hierarchy.ts:956-974] — deferred; current dataset verified single-type per category
- [x] [Review][Defer] normalizeTransactionType coerces any non-"Income" string to `expense` — unexpected source types silently misclassified [apps/api/src/database/seeds/normalize-transaction-type.ts] — deferred; dataset is Income/Expense only
- [x] [Review][Defer] convertAmountToString has no NaN/negative/zero guard — a zero/negative amount aborts the whole seed via DB CHECK rather than surfacing per-row [apps/api/src/database/seeds/convert-amount.ts] — deferred; dataset is clean positive amounts
- [x] [Review][Defer] Operator creation not atomic across signUpEmail/promote; concurrent multi-container boot could throw on duplicate signup [apps/api/src/database/seeds/seed-operator.ts] — deferred; local runtime is single-container, existing-path re-promote self-heals
- [x] [Review][Defer] Category id maps keyed by name only — latent collision if two parents ever own a same-named child [apps/api/src/database/seeds/seed-transactions.ts:59] — deferred; all 34 subcategories verified single-parent
- [x] [Review][Defer] Report counters (topLevelCreated/childrenCreated/skippedDuplicates) diverge from reality on an interrupted partial re-run [apps/api/src/database/seeds/seed-transactions.ts:197] — deferred; cosmetic, data integrity unaffected

## Dev Notes

### Operator decisions (2026-06-14) — these override the literal AC wording in `epics.md`

The PRD addendum, `epics.md`, and `architecture.md` describe the seed source as **flat** `{Date, Category, Type, Amount, Currency}` with "empty notes." **This is factually wrong** — it was written against an incomplete read of the data. Verified reality of the committed dataset (1,880 records):

| Aspect | Reality |
|---|---|
| Keys | `{Date, Category, Type, Amount, Currency, Subcategory?}` — **`Subcategory` present on 1,075 records (57%)** |
| Top-level categories | 21 distinct `Category` strings |
| Child categories | 34 distinct `Subcategory` strings |
| Date format | **`MM/DD/YYYY HH:MM:SS`** (e.g. `02/03/2025 15:41:17` = 3 Feb 2025; month field ≤12, day field ≤31) |
| Amount | JS **number** (int/float), all **positive**, none with >2 decimal places |
| Currency | **UAH only** |
| Type | `Income` / `Expense` only; **no category appears under both types** |
| Hierarchy | Each subcategory has **exactly one** parent; 3 names (`Здоров'я`, `Навчання`, `Одяг`) exist as BOTH a top-level category and a subcategory → distinct rows (differ by `parent_id`) |

**Decision 1 — Two-level hierarchy.** `Category` → top-level, `Subcategory` → child (`parent_id` set); a transaction attaches to its **child** category when a `Subcategory` is present, else the top-level. This preserves 100% of the source and exercises the FR10 hierarchy + Epic 3 roll-up from day one. 2.6 therefore starts from a populated parent/child tree, not a flat set.

**Decision 2 — Seed creates the operator via better-auth.** The seed reads `SEED_OPERATOR_*` env, creates a sign-innable operator through better-auth's server API if absent, promotes it to `admin` (D6), and attaches all data — so the dashboard is meaningful on the very first boot and the operator can log straight in.

(These are recorded in project memory `seed-data-has-subcategory.md`. A `correct-course` / PRD-addendum sync to reconcile the "flat" wording is a reasonable follow-up but is not in this story's scope.)

### Architecture patterns & hard rules binding this story

- **D1 — money is strings end-to-end.** `numeric(14,2)`; amounts converted via `decimal.js` (`.toFixed(2)`), never `parseFloat`/float math. Stats/sums via SQL aggregation returning strings. This story is the **first time D1 meets real data** — AC8 is the harness that proves it (retro Action 6).
- **D2 — seed idempotency.** `import_key` = SHA-256(normalized record + row index), unique-indexed, `ON CONFLICT DO NOTHING`. Near-duplicate category strings surfaced in the report, never silently merged.
- **D4 — UUIDv7 PKs generated app-side** via `generateId()` (`src/database/generate-id.ts`). Domain tables use `text('id')` populated by `generateId()` (matching the existing `users`/`accounts` pattern), **not** `uuid().defaultRandom()`.
- **D6 — roles.** Role promotion is a seed concern; operator → `admin`. The `roleEnum` / `DEFAULT_ROLE` already exist in `schemas/enums.ts`.
- **D7 — layering.** This story has no controllers/services (no HTTP surface). The seed is boot-sequence code, not a request-path repository — but it is still the only DB-touching code here and must keep DB access localized (no scattered pools beyond the seed's own + better-auth's existing singleton).
- **Dates** — transaction dates are calendar dates: `date` column, `"YYYY-MM-DD"` strings, **no timezone math**. `createdAt`/`updatedAt` are `timestamptz`.
- **Drizzle conventions** — snake_case tables/columns, camelCase TS mapping, one file per table, enums in `schemas/enums.ts` as the single source for shared TS unions. No barrel `index.ts` (drizzle.config scans the dir; no-barrel rule).
- **NestJS DI** — N/A for the seed (no injectables), but if any `@Injectable` is introduced, explicit `@Inject(...)`, never `import type` an injectable (SWC erases it under Vitest — see memory).
- **Env** — every var through `envSchema` + `parseEnv`; list in `.env.example`; no scattered fallback literals.

### Source tree — what this story touches

NEW:
- `apps/api/src/database/schemas/transactions.ts`
- `apps/api/src/database/schemas/transaction-categories.ts`
- `apps/api/src/database/data/transactions-02.03.25.json` (committed real data)
- `apps/api/src/database/seeds/*` (seed pipeline + co-located unit specs)
- `apps/api/src/database/migrations/0003_*.sql` + snapshot (generated)
- `apps/api/test/integration/seed.integration.spec.ts` + the reusable D1 harness helper

UPDATE (read these fully before editing — current behavior to preserve):
- `src/database/run-seed.ts` — currently `export const runSeed = async (): Promise<void> => { await Promise.resolve(); }` (1.7 stub). Replace with the real `runSeed({ databaseUrl })`. **Preserve** that it is awaited inside `prepareDatabase` before listen.
- `src/database/prepare-database.ts` — currently `runMigrations(...)` then `runSeed()`. Thread `databaseUrl` into `runSeed`. **Preserve** migrate-before-seed ordering.
- `src/database/prepare-database.spec.ts` — update expectations for the new `runSeed` signature.
- `src/database/schemas/enums.ts` — currently only `roleEnum`/`Role`/`DEFAULT_ROLE`. **Preserve** those; append `transactionTypeEnum`.
- `src/app/env.schema.ts` + `src/app/env.schema.spec.ts` — append `SEED_OPERATOR_*`; **preserve** the existing strict no-partial-boot behavior and update the spec.
- `src/shared/constants/openapi-enum-name.ts` — append `transactionType`.
- `nest-cli.json` — append the `database/data/**/*.json` asset; **preserve** the existing migration assets + swagger plugin config.
- `apps/api/.env.example`, `docker/docker-compose.yml`, CI env — add the new vars.
- `apps/api/package.json` — add `decimal.js@10.6.0`.

### Testing standards

- Vitest + SWC decorators (config already in place: `apps/api/vitest.config.ts`, `oxc: false`, includes `src/**/*.spec.ts` + `test/**/*.spec.ts`).
- Co-located unit specs (`*.spec.ts`); integration tests in `apps/api/test/integration/*.integration.spec.ts` via Testcontainers `postgres:16-alpine`.
- Follow `migrate-on-boot.integration.spec.ts` verbatim for container lifecycle (`TESTCONTAINERS_RYUK_DISABLED='true'`, `BOOT_TIMEOUT_MS = 180_000`, `Wait.forLogMessage(/ready to accept connections/u, 2)`).
- Arrange-Act-Assert; name vars `inputX`/`expectedX`/`actualX`.
- Run gates with `--force` (turbo cache masks results — memory). Run `pnpm` package scripts, not `node_modules/.bin` directly; retry on the transient pnpm `H.replace` crash (memory).

### Reference patterns (study before implementing — `example/` is reference-only, ED1: adapt, never copy)

- **Category derivation (two-level):** `example/tracker-backend-api/src/database/seeds/category.seed.ts` — the `Category → {type, Set<subcategory>}` map then parent-first / child-second insert is the exact shape to adapt. Diverge: supertool uses `ON CONFLICT`/`text` PK/snake_case and no soft-delete.
- **Transaction insert + child-when-present:** `example/tracker-backend-api/src/database/seeds/transaction.seed.ts` — `categoryId: subcategoryId ?? categoryId` is the rule. Diverge: empty `note` (reference wrote a `description`), `date` column not `timestamptz`, `decimal.js` amount conversion, `import_key` + `ON CONFLICT`.
- **Schemas:** `example/tracker-backend-api/src/database/schemas/{transactions,transaction-categories}.ts` — composite FK `(userId, categoryId) → (userId, id)`, self-ref `parentCategoryId` via `AnyPgColumn`, the `amount > 0` check, the unique index on `(userId, name, type, parentId)`. Diverge: `numeric(14,2)`, `text` PKs, snake_case, `NULLS NOT DISTINCT`, no `deletedAt`.
- **Operator creation:** no reference counterpart (reference used bcrypt + `userAuthIdentities`). Supertool goes through the existing better-auth singleton (`apps/api/src/auth/auth.ts`) — new ground.
- **import_key / decimal-safe harness:** no reference counterpart — new ground (D2/D1 are supertool additions).

### Project Structure Notes

- Aligns with `architecture.md` §Project Structure (`database/{schemas,migrations,seeds,data}`). The seed lives in `database/seeds/`, the data in `database/data/` — exactly the planned tree.
- Variance from reference, all intentional & noted above: snake_case + `text` PK + `numeric(14,2)` + `date` column + empty `note` + no soft-delete + `ON CONFLICT` idempotency + better-auth operator creation.
- No `schemas/index.ts` barrel (drizzle.config scans the directory; no-barrel rule holds).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Seed the Real Data]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] (D1, D2, D4, migrations)
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] (D6 roles, operator account)
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] (money strings, dates, no-TZ rule)
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-14.md#Action Items] (Action 5 runSeed threading, Action 6 decimal-safety harness)
- [Source: _bmad-output/implementation-artifacts/epic-2-parallelization.md] (2.1 is the solo gate; schema + enum single source)
- [Source: .claude/rules/typescript.md] (no enums; derive union from `pgEnum.enumValues`; single source of truth)
- [Source: .claude/rules/nestjs-apis.md] (repository-only DB access; DI rules; env schema discipline; OPENAPI_ENUM_NAME)
- [Source: .claude/rules/javascript.md] (function-prefix naming; no barrels; no comments)
- [Source: apps/api/src/database/{run-migrations,run-seed,prepare-database}.ts] (boot sequence)
- [Source: apps/api/test/integration/migrate-on-boot.integration.spec.ts] (Testcontainers harness pattern)
- [Source: apps/api/src/auth/auth.ts] (better-auth singleton for operator creation)
- Project memory: `seed-data-has-subcategory.md`, `epic-2-story-2-1-ac-expansion.md`, `turbo-globalenv-new-vars.md`, `turbo-cache-masks-gate-results.md`, `run-tests-via-pnpm-scripts.md`, `nest-di-explicit-inject.md`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- **`uniqueIndex(...).nullsNotDistinct()` is not available in drizzle-orm 0.45.2.** The story AC1 wording specifies it, but in this version `nullsNotDistinct()` exists only on the `unique()` table-constraint builder (`unique(name).on(cols).nullsNotDistinct()`), not on `uniqueIndex`. Adapted to a `UNIQUE NULLS NOT DISTINCT` constraint, which still backs a unique index so `ON CONFLICT (user_id, name, type, parent_id) DO NOTHING` works identically. Migration verified: `CONSTRAINT … UNIQUE NULLS NOT DISTINCT("user_id","name","type","parent_id")`.
- **Strict-mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).** `SeedSourceRecord` is now single-sourced from a zod schema (`seedSourceRecordSchema`) so the validated loader return type matches without a forbidden `as` assertion. Destructured array/`rows[0]` accesses are narrowed with explicit guards (no `!`).
- **`auth.ts` binds its better-auth pool to `DATABASE_URL` at module-load.** The integration spec therefore sets `process.env.DATABASE_URL` to the container URL *before* `await import()`-ing `prepare-database`/`run-seed`/`auth`, and closes `authDatabasePool` in `afterAll` so the module-level pool does not leak the test process open.
- **Lint adaptations:** homoglyph map built from two parallel strings (avoids single-char `id-length` object keys); batch inserts run via `Promise.all` (avoids `no-await-in-loop`); call-arg numeric literals in specs extracted to named constants (`no-magic-numbers`).

### Completion Notes List

- **New sanctioned dependency:** `decimal.js@10.6.0` (exact-pinned) added to `apps/api` for D1 money math (recorded per the new-dependency rule). Present in `pnpm-lock.yaml` with the API as importer.
- **Schema (AC1):** `transaction_type` pgEnum in `schemas/enums.ts`; `TransactionType` derived from `enumValues` (no re-listed members); `transactions` + `transaction_categories` one-file-per-table, `text` PK via `generateId()`, `numeric(14,2)` amount, `date` column (no TZ), composite FK `(user_id, category_id) → (user_id, id)`, `amount > 0` check, `import_key` unique index. Migration `0003_gifted_shockwave.sql` generated and verified to apply cleanly against Postgres 16.
- **Seed pipeline (AC2–AC5):** pure functions (`parse-seed-date`, `convert-amount`, `normalize-transaction-type`, `build-import-key`, `derive-category-hierarchy`, `find-near-duplicate-categories`, `load-seed-data`) + DB orchestrator (`seed-transactions`). `import_key` = SHA-256(normalized fields + source row index); category idempotency via `(user_id, name, type, parent_id)` NULLS-NOT-DISTINCT constraint; both via `ON CONFLICT DO NOTHING`. Structured Pino import report (no `console.*`).
- **Atomicity note:** operator creation uses better-auth's own pool (separate connection) so it cannot share a transaction with the data seed; the data seed relies on `ON CONFLICT DO NOTHING` idempotency for partial-failure recovery on re-boot rather than a single wrapping transaction. This is why the integration test's re-run assertion is the meaningful safety net.
- **Operator (AC6):** `seedOperator` finds the operator by `SEED_OPERATOR_EMAIL`; if absent, creates it via `auth.api.signUpEmail` (sign-innable) and promotes to `admin` via a direct Drizzle update (since `role` is `input: false`); idempotent on both paths. New `ADMIN_ROLE` constant added beside `DEFAULT_ROLE` (single-source).
- **Boot threading (AC7):** `runSeed({ databaseUrl })` replaces the 1.7 stub; `prepareDatabase` threads `databaseUrl` through; migrate → seed → listen ordering in `main.ts` preserved. Integration test proves an empty DB booted through `prepareDatabase` ends fully seeded (1,880 rows, 21 top-level + 34 child categories, operator = admin).
- **Decimal-safety harness (AC8):** reusable `test/helpers/decimal-safe-sums.ts` asserts per-currency SQL `SUM(amount)` (string) equals the independent `decimal.js` sum of source amounts — written for Epic 3 reuse.
- **Verification:** `type-check`, `lint`, `fmt:check` all green; **75 API tests pass** (20 files, incl. the 5-case Testcontainers integration suite). Seed report on a fresh DB: `{inserted:1880, skippedDuplicates:0, topLevelCreated:21, childrenCreated:34, nearDuplicateClusterList:[]}`; re-run: `{inserted:0, skippedDuplicates:1880, topLevelCreated:0, childrenCreated:0}`. `openapi.json` byte-identical after `build` (no DTO/endpoint added) → generated client untouched, drift gate trivially green; data asset confirmed landing in `dist/database/data/`.
- **ACTION REQUIRED (local only):** the gitignored `apps/api/.env` is outside tooling write-permission; add `SEED_OPERATOR_EMAIL`, `SEED_OPERATOR_PASSWORD`, `SEED_OPERATOR_NAME` to it (values in `.env.example`) for local `pnpm dev`/`build`. CI (`ci.yml`), docker-compose defaults, `turbo` `globalEnv`, and `vitest.setup.ts` are already updated, so CI/tests/compose need no manual step.
- **Data file** reformatted by `oxfmt` (whitespace only — 1,880 records and all values preserved) so the repo-wide `fmt:check` gate stays green.

### File List

**New:**
- `apps/api/src/database/schemas/transactions.ts`
- `apps/api/src/database/schemas/transaction-categories.ts`
- `apps/api/src/database/data/transactions-02.03.25.json`
- `apps/api/src/database/migrations/0003_gifted_shockwave.sql`
- `apps/api/src/database/migrations/meta/0003_snapshot.json`
- `apps/api/src/database/seeds/seed.types.ts`
- `apps/api/src/database/seeds/parse-seed-date.ts` (+ `parse-seed-date.spec.ts`)
- `apps/api/src/database/seeds/convert-amount.ts` (+ `convert-amount.spec.ts`)
- `apps/api/src/database/seeds/normalize-transaction-type.ts`
- `apps/api/src/database/seeds/build-import-key.ts` (+ `build-import-key.spec.ts`)
- `apps/api/src/database/seeds/derive-category-hierarchy.ts` (+ `derive-category-hierarchy.spec.ts`)
- `apps/api/src/database/seeds/find-near-duplicate-categories.ts` (+ `find-near-duplicate-categories.spec.ts`)
- `apps/api/src/database/seeds/load-seed-data.ts`
- `apps/api/src/database/seeds/seed-operator.ts`
- `apps/api/src/database/seeds/seed-transactions.ts`
- `apps/api/test/helpers/decimal-safe-sums.ts`
- `apps/api/test/integration/seed.integration.spec.ts`
- `apps/api/src/seed.ts` (standalone `db:seed` entrypoint — dev convenience)

**Modified:**
- `apps/api/src/database/schemas/enums.ts` (transactionTypeEnum, TransactionType, TRANSACTION_TYPE_LIST, ADMIN_ROLE)
- `apps/api/src/shared/constants/openapi-enum-name.ts` (transactionType)
- `apps/api/src/database/run-seed.ts`
- `apps/api/src/database/prepare-database.ts` (+ `prepare-database.spec.ts`)
- `apps/api/src/app/env.schema.ts` (+ `env.schema.spec.ts`)
- `apps/api/nest-cli.json` (data asset)
- `apps/api/package.json` (decimal.js@10.6.0; `db:seed` + `db:studio` scripts)
- `apps/api/vitest.setup.ts`
- `apps/api/.env.example`
- `apps/api/src/database/migrations/meta/_journal.json`
- `docker/docker-compose.yml`
- `.github/workflows/ci.yml`
- `turbo.json`
- `pnpm-lock.yaml`

## Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 2.1 implemented: transactions + transaction_categories schema, two-level category derivation, idempotent seed of 1,880 real records, better-auth operator bootstrapping with admin promotion, `runSeed` boot threading, reusable D1 decimal-safety harness, Testcontainers integration suite. All gates green; status → review. |
| 2026-06-14 | Added dev-convenience scripts (mirroring the reference repo): `db:studio` (Drizzle Studio to browse the seeded DB) and `db:seed` (`nest build` + run `src/seed.ts` standalone — re-seeds without booting the full app). Verified idempotent against the local DB. |
