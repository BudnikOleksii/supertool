---
baseline_commit: edf5f76be4db61f91b6271b4a6e9fa002803917e
---

# Story 1.2: API Foundation — Health Check & Database Baseline

Status: done

<!-- context-engine: exhaustive analysis of epics.md, architecture.md (D1–D10, patterns, tree), story 1.1 record, deferred-work.md, live repo state, and npm version re-verification completed 2026-06-10 -->

## Story

As the operator-developer,
I want a bootable NestJS API with validated config, contract conventions, and a working migration pipeline,
so that every feature module lands on identical rails (D7) and the database is owned by exactly one app.

## Acceptance Criteria

1. **Given** PostgreSQL 16 running via `docker compose up postgres`, **when** the API starts, **then** zod-validated env loading either succeeds or fails fast with a clear message (no partial boot), and Pino logs to console only (NFR4).
2. **Given** the running API, **when** `GET /api/v1/health` is called, **then** it returns 200 with a body that includes database connectivity status — URI versioning `/api/v1` from day one (D7).
3. **Given** any thrown `HttpException`, **when** the response is shaped, **then** the global exception filter emits `{ statusCode, code, message, details? }` using the shared error-code enum, exposed through OpenAPI (D7).
4. **Given** the API build, **when** it completes, **then** `openapi.json` is emitted as an artifact via @nestjs/swagger CLI plugin + class-validator DTO decoration (D3), and Swagger UI is served in dev.
5. **Given** drizzle-kit configured (schema dir `src/database/schemas/`, one file per table), **when** `generate` and `migrate` run, **then** migrations apply cleanly against Postgres.
6. **Given** Vitest configured with SWC decorators (D10), **when** `turbo run test --filter api` executes, **then** the health module spec passes in CI; oxlint passes on the decorator-heavy code or remediation is applied within this story (budgeted risk).

## Tasks / Subtasks

- [x] Task 1: Docker — PostgreSQL 16 service (AC: 1, 5)
  - [x] Create `docker/docker-compose.yml` with ONLY the `postgres` service: `postgres:16` image, named volume for data, env via `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, port 5432 exposed for the native dev loop. `api` and `money-tracker` services arrive in Story 1.7 — leave a `# slot:` comment
  - [x] Verify `docker compose -f docker/docker-compose.yml up postgres` boots and accepts connections
- [x] Task 2: NestJS app scaffold — `apps/api` (AC: 1, 2)
  - [x] `apps/api/package.json`: name `@supertool/api`, exact pins per the version table below (no `^`/`~`), scripts: `build`, `dev` (nest start --watch), `lint`, `lint:fix`, `type-check`, `test`, `db:generate`, `db:migrate` — wired so the existing turbo tasks pick them up
  - [x] `nest-cli.json` with the @nestjs/swagger CLI plugin enabled (`plugins: ["@nestjs/swagger"]`) — this is what makes DTO decoration flow into OpenAPI without manual `@ApiProperty` on every field (D3)
  - [x] `tsconfig.json` extending `@supertool/typescript-config/base.json` with Nest-required compiler options (`experimentalDecorators`, `emitDecoratorMetadata`, CommonJS module for Nest 11)
  - [x] `src/main.ts`: global prefix + URI versioning so routes resolve as `/api/v1/...` (D7), Swagger setup (Task 6), listen on env-validated `PORT`
  - [x] `src/app/app.module.ts` composing config, logging, database, and health modules
  - [x] `src/app/env.schema.ts`: zod schema (zod 4.4.3) validating `NODE_ENV`, `PORT`, `DATABASE_URL` (or discrete PG vars — pick one shape and keep it); validation runs at bootstrap and **throws with a readable message listing the offending keys** — no partial boot (AC 1)
  - [x] Pino logging via `nestjs-pino`: console-only transport, no file/network sinks (NFR4); `console.*` remains lint-forbidden in app code — Pino logger is the only output path
  - [x] `.env.example` committed with every key the schema requires; real `.env` git-ignored (already covered by root `.gitignore` — verify)
  - [x] Add the API's env keys (`DATABASE_URL` or the discrete PG vars chosen) to `globalEnv` in root `turbo.json` so task caching stays correct
- [x] Task 3: Contract conventions — shared layer (AC: 3)
  - [x] `src/shared/enums/error-codes.ts`: shared error-code enum — seed with the codes this story actually uses (e.g. `INTERNAL_ERROR`, `NOT_FOUND`, `VALIDATION_ERROR`); grows per-story
  - [x] `src/shared/filters/global-exception.filter.ts`: catches everything; `HttpException` → `{ statusCode, code, message, details? }`; unknown errors → 500 + `INTERNAL_ERROR` with message sanitized (no stack/internals in the body — they go to Pino); register globally in `main.ts`
  - [x] `src/shared/dtos/error-response.dto.ts`: class-validator/swagger-decorated DTO describing the error envelope so it appears in OpenAPI (AC 3 "exposed through OpenAPI")
  - [x] Filter unit spec: `HttpException` mapping, unknown-error mapping, envelope shape (`*.spec.ts` co-located)
- [x] Task 4: Database baseline — Drizzle + migration pipeline (AC: 5)
  - [x] `src/database/database.module.ts`: pg `Pool` from validated env + drizzle instance exposed via a Nest provider token; single connection owner — **no other package or app may ever hold a DB connection** (data boundary)
  - [x] `src/database/schemas/index.ts` barrel + `src/database/schemas/enums.ts` placeholder (single source of truth for shared enums, populated from Story 2.1 on). One file per table from day one; first real tables arrive with better-auth/users in Story 1.5
  - [x] `drizzle.config.ts`: schema glob `src/database/schemas/*`, out dir `src/database/migrations`, dialect postgresql, connection from env
  - [x] Wire `db:generate` (drizzle-kit generate) and `db:migrate` (drizzle-kit migrate) scripts
  - [x] Prove the pipeline against compose postgres: `db:migrate` runs cleanly and bootstraps drizzle's migration journal; `db:generate` exits cleanly reporting no schema changes. Record the proof in Dev Agent Record. (See Dev Notes "Migration-proof scope decision")
- [x] Task 5: Health module on the canonical rails (AC: 2)
  - [x] `src/modules/health/`: `health.module.ts` / `health.controller.ts` / `health.service.ts` / `health.repository.ts` — full controller → service → repository layering even for this trivial module; it is the reference implementation every later module copies (D7)
  - [x] Repository executes `SELECT 1` through the drizzle/pool provider — the ONLY DB-touching layer
  - [x] `GET /api/v1/health` → 200 `{ status: 'ok', database: 'up' | 'down' }`; DB failure is caught and reported in-body (still 200 per AC wording — health endpoint reports, it doesn't crash); response DTO decorated for OpenAPI
  - [x] Health controller + service specs with mocked repository (`*.spec.ts` co-located, AC 6)
- [x] Task 6: OpenAPI emission + Swagger UI (AC: 4)
  - [x] Swagger document built in `main.ts` via `DocumentBuilder` (title, version v1, server `/`); Swagger UI served at `/api/docs` only when `NODE_ENV !== 'production'`
  - [x] `src/emit-openapi.ts`: bootstraps the app context WITHOUT listening, generates the document, writes `apps/api/openapi.json`, exits — wired into the api `build` script (`nest build && node dist/emit-openapi.js`) so "the API build emits openapi.json" (D8 precondition for Story 1.3)
  - [x] Git-ignore `apps/api/openapi.json` (build artifact; the committed artifact in D8 is the *generated client*, Story 1.3) and declare it in turbo `build` outputs for caching
  - [x] Verify the emitted spec contains the health endpoint, the error envelope schema, and camelCase operationIds (`healthCheck` style — drives generated client method names)
- [x] Task 7: Vitest + SWC decorators (AC: 6)
  - [x] `apps/api/vitest.config.ts` using `unplugin-swc` so decorator metadata works under Vitest 4 (D10); include `src/**/*.spec.ts` (SWC output `es6`, not `commonjs` — Vitest 4 dropped CJS; `oxc: false` so SWC owns the transform)
  - [x] All specs from Tasks 3/5 green via `turbo run test --filter @supertool/api`; CI `test` job picks them up with zero workflow changes (job already runs `pnpm test`)
  - [x] Testcontainers does NOT land here — first integration tests arrive with Story 1.5 (auth) per D10 priority targets; `apps/api/test/integration/` stays uncreated
- [x] Task 8: oxlint on decorator-heavy code — budgeted friction (AC: 6)
  - [x] Run `pnpm lint` over `apps/api`; remediate rule friction in `packages/lint-config` (new `nest` config export if needed) rather than inline-disabling per file
  - [x] Resolve the deferred item from Story 1.1 review: `typescript/no-floating-promises` + `typescript/no-misused-promises` are configured but inert without `--type-aware` — either enable type-aware linting for the repo/api or drop the two rules; record the decision in Dev Agent Record and remove the entry from `deferred-work.md`
- [x] Task 9: Final verification (AC: all)
  - [x] `pnpm lint`, `pnpm fmt:check`, `pnpm type-check`, `pnpm stylelint`, `pnpm test`, `pnpm build` all green at root
  - [x] Boot sequence proof: postgres up → API boots → health returns `database: 'up'`; stop postgres → health returns `database: 'down'`; missing/invalid env → fast failure with readable message (record all three in Dev Agent Record)
  - [x] No `^`/`~` in `apps/api/package.json`; no eslint/prettier anywhere; nothing imported from `example/` (ED1)
  - [x] Update sprint-status.yaml on status transitions

### Review Findings

- [x] [Review][Decision] Unmapped 4xx statuses fall back to `INTERNAL_ERROR` code — `codeForStatus` only maps 404/400; a 401/403/409/429 `HttpException` (none throwable until Story 1.5 auth, but standard Nest exceptions) would emit `{ statusCode: 401, code: 'INTERNAL_ERROR' }`, and clients resolve i18n by `code` — a 4xx would render as an internal error. Options: defer to 1.5 (codes added with auth), per-status codes now, or a generic 4xx fallback code.
- [x] [Review][Patch] Production must not silently fall back to the default `DATABASE_URL` (hardcoded local creds) — require it explicitly when `NODE_ENV=production` [apps/api/src/app/env.schema.ts]
- [x] [Review][Patch] Exception filter: validation branch drops a caller-supplied `details` object, and an array slips through the `typeof details === 'object'` check into the envelope — preserve details and exclude arrays; add specs [apps/api/src/shared/filters/global-exception.filter.ts]
- [x] [Review][Patch] Exception filter: no `headersSent` guard — an error after the response starts streaming throws `ERR_HTTP_HEADERS_SENT` inside the filter [apps/api/src/shared/filters/global-exception.filter.ts]
- [x] [Review][Patch] Pool shutdown: `pool.end()` rejects if called twice — guard `onApplicationShutdown` with the pool `ended` flag [apps/api/src/database/database.module.ts]
- [x] [Review][Patch] Add server-side `statement_timeout` to the Pool config — `query_timeout` is client-side only; a hung statement keeps running on the server [apps/api/src/database/database.module.ts]
- [x] [Review][Patch] `operationIdFactory` discards the resource — as the reference implementation, a future `transactions.controller.ts#create()` would emit `create`, not the architecture-mandated `transactionsCreate` (wrong generated-client names in 1.3). Compose `<resource><Action>` from controllerKey+methodKey and rename `healthCheck()` → `check()` so the emitted id stays `healthCheck` [apps/api/src/app/openapi.ts, apps/api/src/modules/health/health.controller.ts]
- [x] [Review][Patch] Add `.lintstagedrc` (oxfmt whitespace reformat) to the File List [story file]
- [x] [Review][Defer] Health returns HTTP 200 with `database: 'down'` (documented AC-literal decision) — no machine-readable unhealthy signal for container healthchecks; revisit in Story 1.7 [apps/api/src/modules/health/health.service.ts] — deferred, lands with 1.7 docker healthchecks
- [x] [Review][Defer] `db:migrate` invokes drizzle-kit's internal `bin.cjs` path (env-file loading workaround) — stable under the exact 0.31.10 pin + pnpm direct-dep layout; re-evaluate on any drizzle-kit upgrade [apps/api/package.json] — deferred, upgrade-time concern
- [x] [Review][Defer] Error envelope exposed via `extraModels` only — no per-operation `@ApiResponse` error decoration, so the 1.3 generated client won't type error responses per endpoint; add when real failure modes land [apps/api/src/app/openapi.ts] — deferred to Story 1.5+

## Dev Notes

### Critical scope boundary

This story creates **`apps/api` foundation + the postgres compose service only**. Do NOT create: better-auth mounting or any auth code (Story 1.5), users/transactions/categories tables or modules (1.5/2.1), the generated client or `packages/shared` changes (1.3), `apps/money-tracker`/`storybook` or any `packages/{shell,widgets,ui,next-shared}` (1.4), api/web Docker services or entrypoint migrate-then-seed (1.7). The api Dockerfile is NOT needed yet — Story 1.7 adds it; this story runs the API natively against compose postgres. Resist scope gravity toward `example/tracker-backend-api` (~80%-complete, a named PRD risk) — it also uses eslint/prettier and Jest, none of which may be carried (NFR2, D10).

### Repo state you are starting from (Story 1.1 end state)

- Workspace root exists: `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (tasks: dev, build, build:packages, type-check, lint, lint:fix, stylelint, stylelint:fix, fmt, test, test:e2e), root configs, three `@supertool/*` config packages. **No `apps/` directory exists yet — this story creates the first app.** No `docker/` directory exists.
- Root scripts run oxlint/oxfmt/stylelint/tsc at root then fan out via turbo — `apps/api` only needs its own package scripts for turbo tasks to pick it up.
- Node pinned 22.15.0 (engines + `.nvmrc` + CI composite action single source of truth); pnpm 11.5.2. If a dependency needs a newer Node patch, that's a deviation to record — don't silently bump.
- CI (`.github/workflows/ci.yml`): lint, fmt-check, type-check, stylelint, build, test jobs already run repo-wide — this story's code is covered with zero workflow edits. Comment slots for i18n-parity (1.4) and client-drift (1.3) exist; leave them.
- oxlint 1.69.0 quirks already discovered in 1.1: extended-config `ignorePatterns` are NOT applied (root `.oxlintrc.json` owns ignores); two rules from the donor era were removed as unknown. Type-aware rules deferred item is **assigned to this story** (Task 8).
- pnpm 11 auto-appends `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` for some binaries (supply-chain guard) — if it happens during install, keep them.

### Version table — BINDING, exact pins, no `^`/`~` (architecture.md table, npm re-verified 2026-06-10)

| Package | Version | Note |
|---|---|---|
| @nestjs/core, @nestjs/common, @nestjs/platform-express | 11.1.26 | NestJS 12 is a future epic — stay on v11 (CommonJS) |
| @nestjs/swagger | 11.4.4 | CLI plugin in nest-cli.json (D3) |
| @nestjs/cli, @nestjs/schematics, @nestjs/testing | latest 11.x at install time — record exact pins in Dev Agent Record | dev deps |
| drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 | |
| pg | 8.21.0 | |
| zod | 4.4.3 | env validation (D3) |
| pino / nestjs-pino / pino-http | 10.3.1 / 4.6.1 / 11.0.0 | nestjs-pino + pino-http are the Nest integration for the architecture's Pino decision — record the two additions in Dev Agent Record per the new-dependency rule |
| class-validator / class-transformer | 0.15.1 / 0.5.1 | D3 — explicitly named in architecture |
| vitest | 4.1.8 | |
| @swc/core / unplugin-swc | 1.15.41 / 1.5.9 | decorator metadata under Vitest (D10) |
| reflect-metadata, rxjs | Nest 11 standard peers — pin exact at install, record in Dev Agent Record | |

NOT in this story: better-auth/@thallesp/nestjs-better-auth (1.5), @hey-api/openapi-ts (1.3), uuid/UUIDv7 helper (first row inserts are 1.5 — don't install until needed), decimal.js (2.1), testcontainers (1.5).

### Migration-proof scope decision (AC 5 interpretation)

No domain table legitimately belongs to this story: users + better-auth tables are explicitly Story 1.5 scope, transactions/categories are 2.1. Therefore AC 5 is satisfied by proving the **pipeline**, not by committing a domain migration: drizzle.config.ts + schemas dir + scripts exist; `db:migrate` runs against compose postgres and cleanly bootstraps drizzle's migration journal (zero migrations applied is the correct outcome); `db:generate` exits cleanly with no schema changes. Verify end-to-end behavior once with a scratch table — generate, inspect SQL, migrate, then revert the scratch (nothing committed) — and record the proof in Dev Agent Record. Do NOT invent a placeholder domain table to make a migration exist; that violates the pattern-authority rule.

### Architecture compliance (binding for this story)

- **D7 rails (this story is their reference implementation):** URI versioning `/api/v1/...`; controller → service → repository, repository is the ONLY DB-touching layer — even for `SELECT 1`; global exception filter is the ONLY place shaping error JSON; repositories throw domain errors, never HTTP errors [architecture.md#API-&-Communication-Patterns]
- **Error envelope:** `{ statusCode, code, message, details? }`, `code` from the shared enum, camelCase JSON everywhere [architecture.md#Format-Patterns]
- **D3:** class-validator + @nestjs/swagger CLI plugin for DTO → OpenAPI; zod ONLY for env validation here (frontend forms later) [architecture.md#Data-Architecture]
- **Module file naming:** `<module>.module.ts` / `.controller.ts` / `.service.ts` / `.repository.ts`, `dtos/` subfolder, kebab-case files/dirs always, no PascalCase filenames [architecture.md#Naming-Patterns]
- **API structure:** `src/app/` (bootstrap, env), `src/database/` (schemas, migrations), `src/modules/<module>/`, `src/shared/` (filters, dtos, enums) [architecture.md#Structure-Patterns]
- **OpenAPI operationIds:** `<resource><Action>` camelCase — they become generated-client method names in 1.3 [architecture.md#Naming-Patterns]
- **NFR4:** Pino console-only, no external sinks, no telemetry of any kind
- **No user-facing strings in this story** — API error `message` values are developer-facing; the both-locales rule (FR19/FR20) triggers first in Story 1.4. i18n of API errors happens client-side by `code`, never by `message`
- **Tests ship with this story (NFR1):** filter + health controller/service specs minimum; co-located `*.spec.ts`; no `__tests__/` dirs
- New deps beyond the architecture table (nestjs-pino, pino-http, unplugin-swc, @swc/core) are integration glue for decided patterns — record exact versions in Dev Agent Record; anything beyond that list needs an architecture.md amendment first

### Previous story intelligence (1.1)

- Quality gates are real and proven: pre-commit (lint-staged → oxfmt+oxlint, stylelint), commit-msg (commitlint), CI green required. Conventional commit for this story: `feat: bootstrap nestjs api with health check and database baseline` or similar — must trace to Story 1.2 (ED2).
- The 1.1 code review hardened configs this story relies on: root `tsconfig.json` type-checks root-level config files; `.lintstagedrc` covers all JS/TS extensions; turbo `fmt` task was removed as unreachable (root `oxfmt` handles formatting) — don't re-add it in api scripts.
- oxfmt ignorePatterns exclude `_bmad/**`, `.claude/**` etc. — `apps/**` IS formatted; run `pnpm fmt` before committing.
- Donor-leakage lesson: when consulting `example/tracker-backend-api` for layering patterns, remember it uses Prisma in some `.claude` rules' donor text, eslint/prettier, Jest, and external telemetry — every one of those is banned here. Patterns in, code never (ED1).
- Story 1.1 pinned `@commitlint/types` 21.0.1 (21.0.2 doesn't exist) — precedent: when a table version doesn't exist on npm, pin nearest existing and record the deviation.

### Latest tech notes (verified 2026-06-10)

- All architecture-pinned versions remain latest stable on npm today (@nestjs/core 11.1.26, @nestjs/swagger 11.4.4, drizzle-orm 0.45.2, drizzle-kit 0.31.10, pino 10.3.1, zod 4.4.3, pg 8.21.0, vitest 4.1.8) — no drift since the architecture was written.
- zod 4: import from `zod` (v4 API is the default export path at 4.4.x); `z.coerce.number()` for PORT-style env vars; `safeParse` + custom error formatting gives the "clear message" AC.
- Vitest 4 + NestJS 11: SWC via `unplugin-swc` with `module: { type: 'commonjs' }` and `jsc.transform.legacyDecorator: true` + `decoratorMetadata: true` is the working recipe; `@nestjs/testing`'s `Test.createTestingModule` works under Vitest with globals enabled.
- drizzle-kit 0.31: config key is `dialect: 'postgresql'`; `drizzle-kit migrate` reads the journal from the `out` dir — keep `src/database/migrations` committed (journal included) even while empty of real migrations.
- @nestjs/swagger CLI plugin only processes files matching `*.dto.ts` / `*.entity.ts` suffixes by default — name DTO files accordingly (`error-response.dto.ts`, `health-response.dto.ts`) or extend plugin options explicitly.

### Project Structure Notes

End-state tree for THIS story (delta over 1.1):

```
supertool/
├── docker/
│   └── docker-compose.yml          # postgres service only (+ slots comment for 1.7)
└── apps/
    └── api/                        # @supertool/api — NestJS, better-auth host LATER (1.5)
        ├── package.json  nest-cli.json  tsconfig.json  vitest.config.ts
        ├── drizzle.config.ts  .env.example  (openapi.json — git-ignored build artifact)
        └── src/
            ├── main.ts             # /api/v1 prefix+versioning, Swagger, filter registration
            ├── emit-openapi.ts     # build-time spec emission (D8 precondition)
            ├── app/                # app.module.ts, env.schema.ts (zod), pino wiring
            ├── database/
            │   ├── database.module.ts
            │   ├── schemas/        # index.ts barrel, enums.ts placeholder — one file per table from 1.5 on
            │   └── migrations/     # drizzle-kit out dir, journal committed
            ├── modules/
            │   └── health/         # module/controller/service/repository + dtos/ + specs
            └── shared/
                ├── enums/error-codes.ts
                ├── filters/global-exception.filter.ts (+ spec)
                └── dtos/error-response.dto.ts
```

Matches architecture.md#Complete-Project-Directory-Structure exactly except: `src/auth/` (1.5), `database/seeds|data` (2.1), domain modules (1.5+), `test/integration/` (1.5). No conflicts between epics, architecture, and repo state detected. One AC ambiguity resolved by decision (Migration-proof scope, above); one wording choice resolved by AC-literal reading (health returns 200 with `database: 'down'` rather than 503 — avoids a @nestjs/terminus dependency the architecture never approved).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] — story statement + ACs
- [Source: _bmad-output/planning-artifacts/architecture.md#Core-Architectural-Decisions] — D3 (validation/OpenAPI), D7 (REST rails), D8 (contract pipeline), D10 (test stack)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — naming, structure, error-handling, enforcement MUSTs
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-&-Boundaries] — directory tree, data boundary (postgres owned by apps/api exclusively)
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-&-Deployment] — compose topology, env/zod, Pino console-only
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-quality-gates.md#Dev-Agent-Record] — gate state, oxlint quirks, pin-deviation precedent
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — type-aware oxlint rules item assigned to this story
- [Source: example/tracker-backend-api/*] — reference-only layering blueprint (ED1: patterns in, code never; its eslint/prettier/Jest are banned here)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- **pg Pool crash found during boot proof:** with postgres stopped, the pool's idle client emitted an unhandled `'error'` event ("terminating connection due to administrator command", code 57P01) and killed the whole process. Fixed with `pool.on('error', …)` → Pino. Also added `connectionTimeoutMillis: 2000` + `query_timeout: 5000` — without them the health query hung forever instead of reporting `down`. Full cycle re-verified: `{ok,up}` → postgres stopped → `{degraded,down}` (HTTP 200 in ~9 ms) → postgres restarted → `{ok,up}` with no process restart.
- **Vitest 4 dropped CJS:** the classic Nest recipe (`swc.vite({ module: { type: 'commonjs' } })`) fails with "Vitest cannot be imported in a CommonJS module". Working recipe: `module.type: 'es6'` + `jsc.transform.{legacyDecorator,decoratorMetadata}: true` + top-level `oxc: false`.
- **TS 6.0.3 friction (two items):** `baseUrl` is deprecated (removed — all imports relative); `nest build` requires explicit `rootDir: "src"` in `tsconfig.build.json` (TS5011).
- **oxlint budgeted friction (the named risk):** base config produced ~25 errors on idiomatic Nest code. Resolved via new `packages/lint-config/configs/nest.json` (exported as `./nest`, consumed by `apps/api/.oxlintrc.json`) disabling: `new-cap` (decorators), `no-magic-numbers` (ports/timeouts), `import/no-nodejs-modules` (it's a Node server), `typescript/parameter-properties` (Nest constructor injection), and `typescript/consistent-type-imports` — that rule's auto-fix converts DI imports to `import type`, which silently breaks Nest's `design:paramtypes` metadata. `typescript/no-extraneous-class` kept with `allowWithDecorator`. `env: { node: true }` had to live in `apps/api/.oxlintrc.json` — nested-config `extends` does not propagate `env` (same family as 1.1's ignorePatterns lesson).
- **Deferred item resolved (per Task 8):** dropped inert `typescript/no-floating-promises` + `typescript/no-misused-promises` from `base.json`; enabling `--type-aware` would require the experimental `oxlint-tsgolint` dependency (unapproved). deferred-work.md updated.
- **drizzle-kit behaviors verified:** `migrate` fails without a journal → committed empty `src/database/migrations/meta/_journal.json` (fresh-clone safe, re-verified). Scratch-table end-to-end proof executed: generate produced correct `CREATE TABLE` SQL, migrate applied it, then schema file + migration deleted and DB volume reset; final clean state re-proven (`migrate` exit 0, `generate` "No schema changes").
- **Boot proofs:** `GET /api/v1/health` → `{"status":"ok","database":"up"}`; unknown route → `{"statusCode":404,"code":"NOT_FOUND","message":"Cannot GET /api/v1/nope"}` (filter envelope live); Swagger UI 200 at `/api/docs` in dev; `PORT=not-a-port` → "Invalid environment configuration: - PORT: …", exit 1, no partial boot; Pino JSON to stdout only.
- Nest 11 logs a benign `LegacyRouteConverter` warning for the `/api/*` global-prefix internal route (path-to-regexp v8 auto-convert) — cosmetic, no action.

### Completion Notes List

- All 6 ACs implemented and verified; 12 unit tests green (env schema 5, exception filter 4, health service 2, health controller 1 — controller spec exercises real Nest DI under SWC decorators).
- Docker: `docker/docker-compose.yml` ships ONLY postgres:16 (healthcheck, named volume, env-overridable creds); api/web service slots reserved for 1.7.
- D7 rails are live as the reference implementation: `/api/v1` URI versioning, health module with full controller → service → repository layering (repository is the only DB-toucher, `SELECT 1` via Drizzle), global exception filter as the only error-JSON shaper, envelope `{ statusCode, code, message, details? }`.
- **Deviation (documented):** `ErrorCode` is an `as const` object + union type, not a TS enum — `.claude/rules/typescript.md` bans enums; D7's "shared error-code enum" is satisfied semantically (OpenAPI still emits an `ErrorCode` enum schema via `@ApiProperty({ enum: Object.values(ErrorCode) })`).
- **Deviation (documented):** the planned `schemas/index.ts` barrel + `enums.ts` placeholder were replaced by `.gitkeep` — empty-export placeholder modules violate `unicorn/require-module-specifiers`, and the barrel arrives naturally with real tables in 1.5. `Database` type is un-parameterized `NodePgDatabase` until then; `drizzle(pool)` without schema option.
- OpenAPI: build = `nest build && node dist/emit-openapi.js` → `apps/api/openapi.json` (git-ignored artifact, declared in turbo build outputs); operationIds are bare method names (`healthCheck`) per the naming pattern; `ErrorResponseDto`/`ErrorCode` exposed via `extraModels`; swagger CLI plugin enabled in nest-cli.json; Swagger UI dev-only.
- Env: zod schema with local-compose defaults (so CI builds and the native dev loop need no .env); explicit invalid values fail fast listing offending keys; `ENV` symbol token provided by global `EnvModule`; `.env` loading via Node 22's `--env-file-if-exists` in `dev`/`start`/`db:migrate` scripts — no dotenv/@nestjs/config dependency.
- Version-table additions recorded (all exact pins): nestjs-pino 4.6.1, pino-http 11.0.0 (Pino↔Nest glue), @nestjs/cli 11.0.23, @nestjs/schematics 11.1.0, @nestjs/testing 11.1.26, reflect-metadata 0.2.2, rxjs 7.8.2, @types/node 22.19.20 (22.x line matching the Node engine, NOT npm-latest 25.x), @types/pg 8.20.0.
- NFR4: `@scarf/scarf` install-time telemetry (transitive via swagger-ui-dist) permanently blocked via `allowBuilds: { '@scarf/scarf': false }` in pnpm-workspace.yaml; @swc/core and esbuild builds approved.
- Root gates all green at completion: lint, fmt:check, type-check, stylelint, test, build. Hygiene greps clean (no `^`/`~`, no eslint/prettier, no example/ imports, no .env or openapi.json staged).

### File List

**Docker (new):** `docker/docker-compose.yml`
**API app (new):** `apps/api/package.json`, `apps/api/nest-cli.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/vitest.config.ts`, `apps/api/drizzle.config.ts`, `apps/api/.env.example`, `apps/api/.oxlintrc.json`
**API src (new):** `apps/api/src/main.ts`, `apps/api/src/emit-openapi.ts`, `apps/api/src/app/app.module.ts`, `apps/api/src/app/env.module.ts`, `apps/api/src/app/env.schema.ts`, `apps/api/src/app/env.schema.spec.ts`, `apps/api/src/app/openapi.ts`, `apps/api/src/database/database.module.ts`, `apps/api/src/database/database.constants.ts`, `apps/api/src/database/database.types.ts`, `apps/api/src/database/schemas/.gitkeep`, `apps/api/src/database/migrations/meta/_journal.json`, `apps/api/src/modules/health/health.module.ts`, `apps/api/src/modules/health/health.controller.ts`, `apps/api/src/modules/health/health.controller.spec.ts`, `apps/api/src/modules/health/health.service.ts`, `apps/api/src/modules/health/health.service.spec.ts`, `apps/api/src/modules/health/health.repository.ts`, `apps/api/src/modules/health/dtos/health-response.dto.ts`, `apps/api/src/shared/enums/error-codes.ts`, `apps/api/src/shared/filters/global-exception.filter.ts`, `apps/api/src/shared/filters/global-exception.filter.spec.ts`, `apps/api/src/shared/dtos/error-response.dto.ts`
**Lint config (new/modified):** `packages/lint-config/configs/nest.json` (new), `packages/lint-config/configs/base.json` (dropped 2 inert type-aware rules), `packages/lint-config/package.json` (`./nest` export)
**Root (modified):** `turbo.json` (globalEnv +DATABASE_URL, build outputs +openapi.json), `.gitignore` (+apps/api/openapi.json), `pnpm-workspace.yaml` (allowBuilds decisions), `pnpm-lock.yaml`, `.lintstagedrc` (oxfmt reformat only)
**Story tracking (modified):** `_bmad-output/implementation-artifacts/1-2-api-foundation-health-check-database-baseline.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-06-11: Code review complete (BMAD 3-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor) — 1 decision (resolved: per-status error codes now) + 7 patches applied (production DATABASE_URL guard, filter details preservation + array exclusion + headersSent guard, pool double-end guard + statement_timeout, `<resource><Action>` operationIdFactory with `check()` rename, File List fix), 3 deferred to deferred-work.md, 12 dismissed. 6 new specs (18 total). Magic-number constants introduced after `no-magic-numbers` was re-enabled for the api (operator edit), rule configured with `ignore: [0,1]` + array indexes. All gates green. Status → done.
- 2026-06-10: Story 1.2 implemented — NestJS API foundation (env fail-fast, Pino console-only, D7 rails: /api/v1 versioning + health module on full layering + global exception filter with shared error codes), drizzle-kit migration pipeline proven end-to-end with scratch-table test, OpenAPI build emission + dev Swagger UI, Vitest+SWC with 12 green specs, oxlint nest config resolving the budgeted decorator friction, postgres-only docker compose. Pool crash bug found and fixed during boot proofs. Status → review.
