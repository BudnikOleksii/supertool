---
baseline_commit: 31786b3714a613d0d07eb5f09f2f1df83cb1e51b
---

# Tech Debt: Dedupe integration-test boilerplate + HTTP status codes

Status: review

Origin: follow-up from the code review of story 2.6 (Organize Categories). The source-side
constant dedup (NAME_MIN/MAX_LENGTH, ErrorCode.ValidationError, UNKNOWN_ERROR_CODE) already
shipped in commit `11999c3` on branch `TOOLS-2-6/organize-categories` (PR #15). This file
captures the remaining **test-side** dedup, which is larger and touches all 5 integration specs.

## Why

Every Testcontainers integration spec re-declares the same constants and helpers. Drift between
copies is a real risk (e.g. one spec's `bootApp` could diverge from another's). Consolidating into
`apps/api/test/helpers/` (which already exists — see `decimal-safe-sums.ts`) makes the harness a
single source of truth, mirroring how `@supertool/shared/constants/http-status-code.ts` already
single-sources status codes for production code.

## Scope

In scope — `apps/api/test/integration/*.integration.spec.ts` (all 5) and new files under
`apps/api/test/helpers/`, plus extending `packages/shared/src/constants/http-status-code.ts`.

Out of scope — production `src/` behaviour, the `EXISTS_LIMIT`/`.limit(1)` repository constant
(NOT duplicated across files — `1` is lint-allowed; `users.repository.ts` uses raw `.limit(1)`;
leave as-is), and any change to what the specs actually assert.

## Duplicated values/helpers to extract (verified locations)

Constants repeated in 5 specs (`auth`, `users-profile`, `transaction-categories`, `transactions`,
`seed`, `migrate-on-boot`):
- `POSTGRES_PORT = 5432`, `CONTAINER_READY_OCCURRENCES = 2`, `BOOT_TIMEOUT_MS = 180_000`
- `const migrationsFolder = resolve(process.cwd(), 'src/database/migrations')`
- `process.env.TESTCONTAINERS_RYUK_DISABLED = 'true'`
- Local HTTP code consts: `HTTP_OK = 200`, `HTTP_CREATED = 201`, `HTTP_NO_CONTENT = 204`,
  `HTTP_NOT_FOUND = 404`, `HTTP_CONFLICT = 409`, `HTTP_UNPROCESSABLE = 422`, `HTTP_UNAUTHORIZED = 401`,
  `HTTP_BAD_REQUEST = 400` (scattered across auth / users-profile / transaction-categories)

Helpers duplicated verbatim (or near-verbatim):
- `startPostgresContainer()` — identical in all specs that boot Postgres
- inline `postgres://test:test@host:port/test` DB-URL construction
- `runMigrations(databaseUrl)` (auth, users-profile, transaction-categories)
- `configureTestEnvironment(databaseUrl)` (auth, users-profile, transaction-categories) — sets
  `DATABASE_URL`, `BETTER_AUTH_SECRET='integration-test-secret'`, `AUTH_RATE_LIMIT_DISABLED='true'`
- `bootApp()` — `Test.createTestingModule({imports:[AppModule]})` → `createNestApplication({bodyParser:false})`
  → `configureAppRouting(app)` → `app.listen(0)` (auth, users-profile, transaction-categories)
- HTTP helpers `readJson`, `getJson`, `postJson`, `patchJson`, `deleteJson`, `buildHeaders`
- Auth helpers `extractSessionCookie`, `signUp`, `signIn`, `signInForCookie`, `registerAndSignIn`,
  and `buildTestUser(suffix)` (users-profile + transaction-categories use `buildTestUser`; auth uses
  hardcoded `USER_A`/`USER_B` with names Ann/Bob — keep those literals local, pass into shared helpers)

## Tasks

- [x] **Extend the shared status-code constant.** Add `Ok: 200, Created: 201, NoContent: 204` to
  `HTTP_STATUS_CODE` in `packages/shared/src/constants/http-status-code.ts` (the existing object only
  has 4xx/5xx). The global exception filter keys off specific 4xx/5xx entries, so adding success codes
  is inert there. Rebuild shared (`pnpm --filter @supertool/shared build`) — apps consume it via
  `dist` (no src path alias; `dist` is gitignored, CI rebuilds via turbo order). Replace the local
  `HTTP_*` consts in the specs with `HTTP_STATUS_CODE.Ok` / `.Created` / `.NoContent` / `.NotFound` /
  `.Conflict` / `.UnprocessableEntity` / `.Unauthorized` / `.BadRequest`.

- [x] **Create `apps/api/test/helpers/postgres-container.ts`**: export `POSTGRES_PORT`,
  `BOOT_TIMEOUT_MS`, `MIGRATIONS_FOLDER`, `startPostgresContainer()`, `buildDatabaseUrl(container)`,
  `runMigrations(databaseUrl)`. Keep `CONTAINER_READY_OCCURRENCES` and `POSTGRES_IMAGE` module-private.

- [x] **Create `apps/api/test/helpers/integration-app.ts`**: export `configureTestEnvironment(databaseUrl)`
  and `bootIntegrationApp(): Promise<{ app: INestApplication; baseUrl: string }>` (does the
  Test module → createNestApplication → configureAppRouting → listen(0) → getUrl dance). Move the
  code verbatim — do NOT change env keys or bootstrap order (auth/users/categories specs pass today
  WITHOUT setting BETTER_AUTH_URL/AUTH_TRUSTED_ORIGINS/SEED_OPERATOR_PASSWORD; preserve that).

- [x] **Create `apps/api/test/helpers/http-client.ts`**: export `createHttpClient(getBaseUrl: () => string)`
  returning `{ readJson, getJson, postJson, patchJson, deleteJson }`. Take a `getBaseUrl` THUNK (not a
  string) so a spec can do `const { getJson, postJson } = createHttpClient(() => baseUrl)` at module
  scope while `baseUrl` is still assigned later in `beforeAll` — this keeps the test BODIES unchanged
  (lowest-churn approach). Only destructure the methods each spec actually uses (oxlint `no-unused-vars`).

- [x] **Create `apps/api/test/helpers/auth-client.ts`**: export `TestUser` interface, `buildTestUser(suffix)`,
  `extractSessionCookie(response)`, and a `createAuthClient(client)` returning
  `{ signUp, signIn, signInForCookie, registerAndSignIn }` bound to the http client. (auth spec needs
  `signIn` returning the raw `Response`; the others need `signInForCookie`/`registerAndSignIn`.)

- [x] **Refactor all 5 specs** to import the helpers and delete the local copies. Prefer targeted edits
  over full rewrites: swap the import block, replace local const/helper declarations with
  destructure lines + `beforeAll` calls to the shared boot helpers, and replace `HTTP_*` tokens. Watch
  oxlint: remove now-unused imports (`Test`, `GenericContainer`, `Wait`, `Pool`, `migrate`, `drizzle`,
  `resolve`, testcontainers types) from each spec.

- [x] **While here**, replace the remaining `'VALIDATION_ERROR'` literal in
  `apps/api/test/integration/users-profile.integration.spec.ts` (`expect(body.code).toBe('VALIDATION_ERROR')`)
  with `ErrorCode.ValidationError` imported from `@supertool/shared/constants/error-codes`.

## Acceptance criteria

- No `*.integration.spec.ts` defines `POSTGRES_PORT`, `BOOT_TIMEOUT_MS`, `CONTAINER_READY_OCCURRENCES`,
  `migrationsFolder`, `startPostgresContainer`, `runMigrations`, `configureTestEnvironment`, `bootApp`,
  or a local HTTP-status-code constant; each imports them from `apps/api/test/helpers/` or
  `@supertool/shared/constants/http-status-code`.
- The HTTP/auth helper bodies exist once under `apps/api/test/helpers/` and are reused by every spec.
- No behavioural change to assertions; the same tests pass.

## Verification

- `pnpm type-check`, `pnpm lint`, `pnpm fmt:check` (all `--force` where turbo caches).
- `pnpm test --force` — **requires Docker running** (Testcontainers). Expected: API **110** tests,
  all 7 turbo test tasks green. Use `pnpm` scripts only; retry the transient pnpm `H.replace` crash.

## Notes / gotchas

- `@supertool/shared` is consumed via `dist` (no src alias) — rebuild shared after editing the
  status-code constant. `@supertool/next-shared` and `@supertool/ui` are consumed via `/src/`.
- oxlint nursery rules to watch: `max-statements` (≤10 per fn — keep helpers small), `no-magic-numbers`
  (`1` is allowed; use named consts otherwise), `no-unused-vars` (don't destructure unused client methods).
- Branch: continue on `TOOLS-2-6/organize-categories` (PR #15) as a `refactor:` commit, or split into a
  fresh `TOOLS-*` branch if the reviewer prefers it isolated from the story.
- Reference for the helper-dir pattern: `apps/api/test/helpers/decimal-safe-sums.ts`.

## Dev Agent Record

### Completion Notes

- Extended `HTTP_STATUS_CODE` with `Ok`/`Created`/`NoContent` and rebuilt `@supertool/shared` so the
  `dist` consumed by the API carries the new keys. The global exception filter is unaffected (it only
  reads specific 4xx/5xx entries).
- Extracted four helpers under `apps/api/test/helpers/`: `postgres-container.ts` (container lifecycle +
  `runMigrations` + `buildDatabaseUrl`, with `CONTAINER_READY_OCCURRENCES`/`POSTGRES_IMAGE` kept
  module-private), `integration-app.ts` (`configureTestEnvironment` + `bootIntegrationApp`, env keys and
  bootstrap order moved verbatim), `http-client.ts` (`createHttpClient` taking a `getBaseUrl` thunk so
  the late-assigned `baseUrl` keeps test bodies unchanged), and `auth-client.ts` (`createAuthClient`
  bound to the http client, plus `TestUser`/`buildTestUser`/`extractSessionCookie`).
- Refactored all 6 integration specs (the spec text says "5"; there are 6 — `auth`, `users-profile`,
  `transaction-categories`, `transactions`, `seed`, `migrate-on-boot`). Each now imports the helpers and
  destructures only the methods it uses. `transactions`/`seed`/`migrate-on-boot` use only the container
  helpers (they boot via `prepareDatabase`/`runSeed` or the production `runMigrations`, not the Nest app);
  `migrate-on-boot` deliberately keeps importing the production `runMigrations` from `src/` and does NOT
  pull the helper's same-named export.
- Replaced the local `HTTP_*` constants with `HTTP_STATUS_CODE.*` tokens and the `'VALIDATION_ERROR'`
  literal in `users-profile` with `ErrorCode.ValidationError`. The auth spec's `'UNAUTHORIZED'` and
  `'user'` literals were left as-is — out of the stated scope (only `VALIDATION_ERROR` was called out).

### Verification results

- `pnpm type-check --force` — 9/9 turbo tasks green.
- `pnpm lint --force` — 8/8 tasks, 0 warnings / 0 errors.
- `pnpm fmt:check` — all 384 files correctly formatted.
- `pnpm test --force` (Docker running) — 7/7 turbo test tasks green; API **112** tests across 26 files
  passed. (Spec estimated 110; the refactor changes no `it()` blocks, so 112 is the true existing count.)

### File List

- `packages/shared/src/constants/http-status-code.ts` (modified)
- `apps/api/test/helpers/postgres-container.ts` (new)
- `apps/api/test/helpers/integration-app.ts` (new)
- `apps/api/test/helpers/http-client.ts` (new)
- `apps/api/test/helpers/auth-client.ts` (new)
- `apps/api/test/integration/auth.integration.spec.ts` (modified)
- `apps/api/test/integration/users-profile.integration.spec.ts` (modified)
- `apps/api/test/integration/transaction-categories.integration.spec.ts` (modified)
- `apps/api/test/integration/transactions.integration.spec.ts` (modified)
- `apps/api/test/integration/seed.integration.spec.ts` (modified)
- `apps/api/test/integration/migrate-on-boot.integration.spec.ts` (modified)

## Change Log

- Deduplicated integration-test boilerplate into `apps/api/test/helpers/` and single-sourced HTTP success
  codes via `HTTP_STATUS_CODE`; no assertion changes (Date: 2026-06-15).
