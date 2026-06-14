# Story 1.7: One-Command Local Runtime

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to start the entire platform with one documented command,
so that the whole stack runs locally without ceremony (NFR3).

## Acceptance Criteria

1. **Given** a machine with Docker, **When** the single documented command from the README runs, **Then** docker compose brings up PostgreSQL 16 + api + money-tracker, the API runs migrations before listening, and the app is reachable in the browser with sign-in working through the proxied stack (D5).
2. **Given** the compose setup, **Then** `.env.example` files are committed per app, real `.env` files are git-ignored, and a seed hook slot exists in the API entrypoint (migrate → [seed] → listen) ready for Epic 2.
3. **Given** the running stack, **When** network traffic is inspected, **Then** no external calls leave the environment — telemetry disabled everywhere (NFR4).

### Acceptance criteria interpretation (binding)

- AC1 "single documented command" = a top-level command in the README that performs build + up in one invocation (e.g. `docker compose -f docker/docker-compose.yml up --build`, optionally fronted by a `pnpm` script). One command, no manual pre-steps beyond `cp .env.example .env`.
- AC1 "API runs migrations before listening" = the api container, on every boot, applies all pending Drizzle migrations against Postgres **and only then** binds its HTTP port. A boot against an empty volume produces a fully-migrated schema with zero manual steps.
- AC1 "sign-in working through the proxied stack" = the browser hits the money-tracker origin, the `/api/*` rewrite forwards to the api service, and a sign-up→sign-in round-trip succeeds end-to-end inside compose. **This depends on Stories 1.5/1.6 being merged** (see Prerequisites). If 1.5 is not yet merged when this story is implemented, see the Prerequisites gate — do not fake or stub auth to satisfy this AC.
- AC2 "seed hook slot" = a real, called function in the boot sequence (a no-op today) positioned between migrate and listen, so Epic 2's seed (FR17) drops in by filling the function body — no boot-sequence surgery later.
- AC3 "no external calls" = verified by observation (container logs / `docker compose` network inspection / a packet check), recorded in the Dev Agent Record. Next.js, Turborepo, and any tooling telemetry are disabled by env flags baked into the images.

## Tasks / Subtasks

- [ ] **Task 1 — Next.js standalone build output (AC: 1)**
  - [ ] In `apps/money-tracker/next.config.ts` set `output: 'standalone'` so the build emits a self-contained `.next/standalone/server.js` (required for a minimal web image — `next start` is not used in the container).
  - [ ] Set `outputFileTracingRoot` to the monorepo root (`path.join(import.meta.dirname, '../../')` or equivalent) so file-tracing includes workspace dependencies (`@supertool/ui`, `@supertool/shell`, `@supertool/next-shared`, `@supertool/shared`) in the standalone bundle. Without this, the pruned/standalone server is missing transpiled workspace packages.
  - [ ] Confirm the existing `/api/:path*` → `${env.API_URL}/api/:path*` rewrite (already present) still resolves at container runtime — `API_URL` must point at the `api` service (see Task 4). Verify `apps/money-tracker/src/env.ts` reads `API_URL` and is evaluated where the standalone server can see it.
  - [ ] `pnpm --filter @supertool/money-tracker build` locally and confirm `.next/standalone/apps/money-tracker/server.js` exists.

- [ ] **Task 2 — API migrate → [seed] → listen entrypoint (AC: 1, 2)**
  - [ ] Add a programmatic migration runner using `migrate` from `drizzle-orm/node-postgres/migrator` (drizzle-orm is a production dependency; drizzle-kit is dev-only and must NOT be relied on inside the production image). It opens a short-lived `pg` Pool, runs `migrate(db, { migrationsFolder })`, and closes the pool.
  - [ ] Add a `runSeed()` (or `seedHook()`) no-op slot called after migrate and before `app.listen`. Document in the story record that Epic 2 fills this (FR17, idempotent seed by D2). Keep it a real awaited call, not a comment.
  - [ ] Wire the sequence into `apps/api/src/main.ts` `bootstrap()` so the order is **migrate → seed-hook → `app.listen`**. The app must not bind its port until migrations succeed; a migration failure must exit non-zero with a clear message (reuse the existing `EXIT_FAILURE` pattern).
  - [ ] Ensure the migration SQL files + `meta/` ship into the runtime image and the `migrationsFolder` path resolves at runtime. `nest build` emits JS only — the `src/database/migrations/*.sql` and `meta/_journal.json` are not compiled; copy them into the image (e.g. into `dist/database/migrations`) or point `migrationsFolder` at a path the Dockerfile populates. Verify the resolved path works from the container's working directory, not just locally.
  - [ ] Keep the existing `db:migrate` package script (drizzle-kit) for the native dev loop — the programmatic runner is for the container boot. Do not delete it.

- [ ] **Task 3 — API production image `docker/api.Dockerfile` (AC: 1, 3)**
  - [ ] Multi-stage build over the pnpm + Turborepo monorepo using `turbo prune @supertool/api --docker` (see Reference patterns — confirm the exact workspace name from `apps/api/package.json` = `@supertool/api`). Stages: `base` → `pruner` (turbo prune) → `installer` (`pnpm install --frozen-lockfile` against `out/json/`) → `builder` (copy `out/full/`, `turbo run build --filter=@supertool/api`) → `runner`.
  - [ ] Pin the toolchain: `node:22-alpine` (matches `engines.node` 22.15.0 — verify the alpine tag exposes 22.15.x or use the `node:22.15.0-alpine` tag), enable the pinned pnpm via corepack (`packageManager` = `pnpm@11.5.2`). `libc6-compat` for alpine.
  - [ ] Runner stage: production-only dependencies, run as a non-root user, copy `dist/`, production `node_modules`, and the migration files (Task 2). `CMD` runs the migrate→seed→listen entrypoint (`node dist/main.js` once Task 2 wires the sequence into bootstrap).
  - [ ] Bake telemetry-off env into the image: `DO_NOT_TRACK=1`, `TURBO_TELEMETRY_DISABLED=1` (NFR4).
  - [ ] `EXPOSE 3001`. Confirm the image boots standalone against a reachable Postgres.

- [ ] **Task 4 — Web production image `docker/web.Dockerfile` (AC: 1, 3)**
  - [ ] Multi-stage build using `turbo prune @supertool/money-tracker --docker`. Same base/pruner/installer/builder pattern as the API image; builder runs `turbo run build --filter=@supertool/money-tracker` (requires Task 1's standalone output).
  - [ ] Runner stage (Next.js standalone layout — see Reference patterns): copy `apps/money-tracker/.next/standalone ./`, `apps/money-tracker/.next/static → ./apps/money-tracker/.next/static`, and `apps/money-tracker/public → ./apps/money-tracker/public` (public only if it exists). Run as non-root. `CMD ["node", "apps/money-tracker/server.js"]`.
  - [ ] Bake telemetry-off env: `NEXT_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1`, `TURBO_TELEMETRY_DISABLED=1` (NFR4).
  - [ ] `EXPOSE 3000`. Set `PORT=3000` / `HOSTNAME=0.0.0.0` so the standalone server binds inside the container.
  - [ ] `API_URL` is provided at runtime by compose (Task 5); the standalone `server.js` reads it for the rewrite proxy at request time.

- [ ] **Task 5 — Extend `docker/docker-compose.yml` with api + web (AC: 1, 2, 3)**
  - [ ] Keep the existing `postgres` service (PostgreSQL 16, healthcheck, named volume) as-is.
  - [ ] Add `api`: `build` from `docker/api.Dockerfile` (context = repo root, since the build needs the whole monorepo for `turbo prune`); env `NODE_ENV=production`, `PORT=3001`, `DATABASE_URL=postgres://${POSTGRES_USER:-supertool}:${POSTGRES_PASSWORD:-supertool}@postgres:5432/${POSTGRES_DB:-supertool}` (host = `postgres`, the compose service name, NOT `localhost`); `depends_on: postgres: condition: service_healthy`; expose/publish `3001`.
  - [ ] Add `web`: `build` from `docker/web.Dockerfile` (context = repo root); env `API_URL=http://api:3001` (service name, not localhost), `PORT=3000`; `depends_on: api: condition: service_healthy`; publish `3000:3000`.
  - [ ] Add an `api` healthcheck and decide its probe (see Dev Notes "API healthcheck — read this": the existing `/api/v1/health` returns HTTP 200 even when the DB is down, so a bare status-code probe is a false positive). Since migrate runs before listen, the api only binds its port after the DB is reachable and migrated — but the healthcheck should still assert real readiness (probe the body for `"database":"up"`, or use `pg_isready`-style reasoning). Record the chosen approach and rationale.
  - [ ] Verify env precedence: a root `.env` (compose `env_file` / interpolation) supplies `POSTGRES_*` and any secrets; document the exact single command in the README (Task 7).

- [ ] **Task 6 — `.env.example` completeness + git-ignore verification (AC: 2, 3)**
  - [ ] Audit and complete `.env.example` for every app/service the compose stack needs. Today: `apps/api/.env.example` (`NODE_ENV`, `PORT`, `DATABASE_URL`), `apps/money-tracker/.env.example` (`API_URL`). Add any auth secrets introduced by 1.5 (e.g. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) and the compose-level `POSTGRES_USER/PASSWORD/DB/PORT` — add a root `.env.example` if compose interpolation needs root-level vars.
  - [ ] Confirm `.gitignore` ignores real env files (already: `.env`, `.env*.local`) and that no real `.env` is tracked. `.env.example` files ARE committed.
  - [ ] Every example value must be a safe local-only placeholder — no real secrets (NFR4, private-repo posture).

- [ ] **Task 7 — README single-command runtime docs (AC: 1, 3)**
  - [ ] Replace the README "Getting started" placeholder ("lands with Story 1.7") with the real documented command and prerequisites (Docker, copy `.env.example` → `.env`). Document: the one command, what comes up (postgres + api + web + URLs/ports), migrate-on-boot behavior, and how to tear down (`docker compose down [-v]`).
  - [ ] Note the native inner-loop alternative stays (`pnpm dev` + `docker compose up postgres`) per architecture — the full compose runtime is the NFR3 deliverable, not a replacement for the dev loop.
  - [ ] State the no-telemetry posture (NFR4) and the AC3 verification result.

- [ ] **Task 8 — Tests (AC: 1, 2) — ship in this story (NFR1)**
  - [ ] Testcontainers integration test (`apps/api/test/integration/`, D10) for the migrate-on-boot routine: boot a fresh Postgres, run the programmatic migration runner, assert the expected tables exist, then run it a **second** time and assert it is idempotent (no error, no duplicate-migration failure). This guards AC1's "runs migrations before listening".
  - [ ] Unit/spec coverage that the boot sequence calls migrate before the seed hook before listen (ordering), and that a migration failure aborts boot (no port bind). Mock the migrator/listen boundary if a full container is too heavy for a unit spec; the Testcontainers test covers the real path.
  - [ ] Do not add a Playwright/e2e dependency — it is a deferred epic (architecture D10, config slot only). AC1's browser sign-in round-trip is verified manually and recorded in the Dev Agent Record.

- [ ] **Task 9 — Quality gates + verification record (AC: 1, 2, 3)**
  - [ ] Run the full gate set with `--force` (turbo cache replays stale logs — see project memory): `pnpm lint`, `pnpm type-check`, `pnpm stylelint`, `pnpm build`, `pnpm test`, `pnpm fmt:check`. Hadolint-style Dockerfile lint is optional (no Dockerfile linter is wired in this repo).
  - [ ] Execute the one command end-to-end against a clean Docker state (`docker compose down -v` first). Record in the Dev Agent Record: stack came up, migrations applied on boot, app reachable, sign-in round-trip result (or the Prerequisites note if 1.5 not merged), and the AC3 no-external-calls observation.

## Dev Notes

This is an **infrastructure/runtime story**, not a UI story — the design-system visual-QA protocol (1.9/1.10) does not apply. The deliverable is reproducible local orchestration.

### Prerequisites & sequencing (read first — this is the highest-risk gap)

- **Story 1.7 is the LAST story in Epic 1** by sprint order (`development_status` runs …1-10, 1-11, **1-5, 1-6, 1-7**). It is being authored ahead of 1.5/1.6/1.11. By the time it is *implemented*, those should be merged.
- AC1's "sign-in working through the proxied stack" **requires Story 1.5 (Sign Up / Sign In)** — better-auth mounting (`@thallesp/nestjs-better-auth`, D5), the auth migrations, and the money-tracker sign-in route. As of this story's authoring, `apps/api` has **no auth module**, **no schemas**, and **no migration SQL** (only an empty `migrations/meta/_journal.json`).
- **Gate before implementing:** confirm 1.5 (and ideally 1.6) are `done`. If they are not, either (a) hold this story, or (b) implement Tasks 1–7 + 9's infra and explicitly scope the sign-in round-trip as blocked-on-1.5 in the record — never stub auth to make AC1 appear green. The migrate-on-boot routine is meaningful only once real migrations exist; without them it runs against an empty migrations folder (still must not error).
- The `web` image (standalone) depends on the money-tracker app having real routes; the shell exists today but the sign-in page lands in 1.5.

### Reference patterns

- **Docker / compose / Dockerfiles / entrypoint: NO reference counterpart — new ground.** `example/track-my-life` has no `docker-compose`, no Dockerfile, no entrypoint script (confirmed). Its only env artifact is `apps/money-tracker/.env.example` (uses `NEXT_PUBLIC_API_BASE_URL` + JWT vars — a *different* auth model; do not copy, supertool uses better-auth opaque DB-backed sessions via same-origin proxy, D5). The canonical patterns below come from the official Turborepo and Next.js docs, not the reference repo.
- **Turborepo Docker (authoritative):** `turbo prune <workspace> --docker` → `out/json/` (manifests + pruned lockfile) and `out/full/` (source). Multi-stage: base → prune → install (`out/json`) → build (`out/full`) → runner. Source: https://turborepo.com/docs/guides/tools/docker
- **Next.js standalone (authoritative):** `output: 'standalone'` emits `.next/standalone/server.js`; copy `.next/standalone`, `.next/static`, `public` separately; run `node server.js` (not `next start`). For monorepos set `outputFileTracingRoot`. Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/output and https://github.com/vercel/next.js/tree/canary/examples/with-docker
- **Existing supertool patterns to mirror:** `docker/docker-compose.yml` (postgres service — extend, don't rewrite); `apps/api/src/main.ts` `bootstrap()` (env-fails-fast, `EXIT_FAILURE`, `enableShutdownHooks`); `apps/api/src/database/database.module.ts` (`pg` Pool from `DATABASE_URL`, drizzle over `node-postgres`) — the migrate runner reuses the same connection string and driver.

### Current state of files this story touches

- `docker/docker-compose.yml` — **UPDATE.** Today: only `postgres:16` with healthcheck + `postgres-data` volume + `${POSTGRES_*}` interpolation. Preserve it; add `api` and `web` services and their `depends_on` health conditions.
- `apps/money-tracker/next.config.ts` — **UPDATE.** Today: next-intl plugin, `transpilePackages`, `/api/:path*` rewrite to `env.API_URL`. Add `output: 'standalone'` + `outputFileTracingRoot`. Must not break the existing rewrite or transpile config.
- `apps/api/src/main.ts` — **UPDATE.** Today: `bootstrap()` parses env, creates app, configures routing/pipes/shutdown, Swagger in non-prod, `app.listen(env.PORT)`. Insert migrate→seed-hook before `listen`. Preserve every existing step (it must still boot, log via Pino, fail-fast on bad env, expose Swagger in dev).
- `apps/api/.env.example`, `apps/money-tracker/.env.example` — **UPDATE.** Complete for the compose stack; add root `.env.example` if needed (**NEW**).
- `docker/api.Dockerfile`, `docker/web.Dockerfile` — **NEW.**
- `README.md` — **UPDATE.** Replace the Story-1.7 placeholder with the real command.
- `apps/api/test/integration/*.spec.ts` — **NEW** (Testcontainers migrate-on-boot test). Migrate-runner module — **NEW** (`apps/api/src/database/` or `apps/api/src/app/`).

### API healthcheck — read this (deferred item lands here)

The 1.2 review explicitly deferred to **this story**: *"Health endpoint returns HTTP 200 with `database: 'down'` … no machine-readable unhealthy signal at the HTTP layer — container healthchecks key on status codes. Revisit when Story 1.7 wires docker compose healthchecks for the api service."* (`_bmad-output/implementation-artifacts/deferred-work.md`). `GET /api/v1/health` returns 200 regardless of DB state, so a bare HTTP-status compose healthcheck is a false positive. Mitigations, pick one and record it: (a) compose healthcheck greps the response body for `"database":"up"`; (b) a lightweight TCP/`pg_isready` reasoning given migrate-before-listen already proves DB reachability at boot; (c) (larger, optional) make the health endpoint return a non-200 when DB is down — but that changes 1.2's deliberate AC-literal contract, so only with a note. The `web` service's `depends_on: api: service_healthy` is only meaningful if the api healthcheck reflects real readiness.

### Decimal / money, layering, generated-client rules

Not directly exercised by this story, but the hard rules still bind any code you touch: API access only via the generated client (NFR6); repositories are the only DB-touching layer (D7) — the migrate runner is a boot-time DB-admin operation (drizzle migrator), not an app data path, so it legitimately opens its own pool outside the repository layer (it is infra bootstrap, like `database.module.ts`'s pool). Money-as-strings (D1) is untouched.

### i18n

No new user-facing strings are expected (Docker/README/env are not localized UI). If any UI string is added, it must land in both `apps/money-tracker/messages/en.json` and `uk.json` in the same commit (FR19/FR20, CI key-parity gate). Confirm none is added.

### Telemetry / privacy (NFR4)

Disable at the image level so no opt-in network call ever fires: `NEXT_TELEMETRY_DISABLED=1` (Next.js), `TURBO_TELEMETRY_DISABLED=1` (Turborepo, also during build), `DO_NOT_TRACK=1` (broad opt-out honored by several tools). Pino logs to console only (already configured). better-auth/Postgres run locally only. AC3 verification (network observation) must be recorded.

### Testing standards

- Vitest 4.1.8 everywhere; API uses SWC decorators (D10). API specs are `*.spec.ts`; Testcontainers integration tests live in `apps/api/test/integration/` against real Postgres (Testcontainers 12.0.1).
- Run gates via pnpm scripts, with `--force` when verifying (turbo cache replays stale logs — project memory). Retry pnpm on the transient `H.replace` crash.
- No Playwright/e2e dependency (deferred epic; config slot reserved).

### Project Structure Notes

- Dockerfiles named per architecture.md tree: `docker/api.Dockerfile`, `docker/web.Dockerfile` (note: the Next app is "money-tracker" but its image file is `web.Dockerfile` per the planned tree — keep that name for forward-consistency with multi-app compose).
- Build context for both image builds is the **repo root** (monorepo `turbo prune` needs the whole workspace + root lockfile); the Dockerfile lives under `docker/` and is referenced via `dockerfile: docker/api.Dockerfile` with `context: ..` (or `.` if compose runs from root). Verify the `context`/`dockerfile` pairing resolves the lockfile and `turbo.json`.
- Compose service hostnames are `postgres` / `api` / `web` — intra-compose URLs use service names, never `localhost` (a common Docker mistake: `DATABASE_URL` and `API_URL` must use service DNS).
- No conflict with the dependency-direction rule (`shared → ui → widgets/shell → apps`); this story adds orchestration only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7: One-Command Local Runtime] — story + 3 ACs
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — epic objective ("run the platform locally with one command")
- [Source: _bmad-output/planning-artifacts/architecture.md#Local-only runtime (NFR3)] (line 206) — compose = postgres + api + web, migrate + seed on api startup, native `pnpm dev` stays the inner loop
- [Source: _bmad-output/planning-artifacts/architecture.md#Deployment & Runtime] (lines 399–400) — "API entrypoint runs migrate then idempotent seed before listening — dashboard meaningful on first boot"
- [Source: _bmad-output/planning-artifacts/architecture.md#Source Tree] (lines 314–317) — `docker/docker-compose.yml`, `api.Dockerfile`, `web.Dockerfile`, README single-command startup
- [Source: _bmad-output/planning-artifacts/architecture.md#D5 — Same-origin proxy sessions] (line 189) + [#Proxy vs. server-side calls] (line 426) — browser `/api/*` rewrite vs server `API_URL` cookie-forwarding duality
- [Source: _bmad-output/planning-artifacts/architecture.md#Env config / Logging / Security] (lines 207–208, 192) — zod-validated env, `.env` git-ignored / `.env.example` committed, console-only Pino, no telemetry
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from 1-2] — api healthcheck signal explicitly routed to this story; `db:migrate` drizzle-kit bin path note
- [Source: apps/api/src/main.ts] — current bootstrap to extend (migrate→seed→listen)
- [Source: apps/api/src/database/database.module.ts] — pg Pool / drizzle node-postgres pattern reused by the migrate runner
- [Source: apps/money-tracker/next.config.ts] — existing rewrite + transpilePackages to preserve; add `output: 'standalone'`
- [Source: docker/docker-compose.yml] — existing postgres service to extend
- Turborepo Docker guide: https://turborepo.com/docs/guides/tools/docker
- Next.js standalone output: https://nextjs.org/docs/app/api-reference/config/next-config-js/output ; Docker example: https://github.com/vercel/next.js/tree/canary/examples/with-docker

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
