---
baseline_commit: ffb4fa5619c19f5aafc2ff28eeceda26cc426071
---

# Story 7.5: Security Hardening — Helmet & Compression

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the operator-developer,
I want helmet and compression middleware on the NestJS API,
so that the platform gets the cheap, standard security-header and response-compression hardening the reference (`example/tracker-backend-api`) has and supertool lacks (RP-B10) — without breaking the same-origin `/api/*` proxy, better-auth cookie flows, Swagger UI, or the OpenAPI contract pipeline.

## Story Context

This is the **FINAL story of Epic 7 and the last planned parity story of the backlog.** It is a **backend-only, cross-cutting middleware story** — two Express middlewares registered on the Nest app at bootstrap. There is **no endpoint, DTO, schema, or generated-client change**: the middleware is transparent to the API contract (D-7).

Today the API bootstrap configures routing in one shared place — `apps/api/src/app/configure-app-routing.ts` — which sets the global prefix, URI versioning, and the global `ValidationPipe`. It is called by all three app-creation paths:
- `apps/api/src/main.ts` (runtime — `bootstrap()`),
- `apps/api/src/emit-openapi.ts` (build-time OpenAPI emit),
- `apps/api/test/helpers/integration-app.ts` (`bootIntegrationApp`, used by every Testcontainers integration spec).

**No security middleware exists.** The reference API (`example/tracker-backend-api/src/main.ts`) does `app.use(helmet()); app.use(compression()); app.use(cookieParser());` in `main.ts`. RP-B10 (epic-6 retro, reference-parity backlog) flags this gap as cheap hardening to fold into Epic 7 opportunistically. Story 7.5 delivers the helmet + compression halves; cookie-parser is intentionally out of scope (D-4).

**Reference (ED1 — study, never copy/import):**
- `example/tracker-backend-api/src/main.ts` — `app.use(helmet())`, `app.use(compression())`, `app.use(cookieParser())` (all defaults, in that order, before `setGlobalPrefix`/pipes).
- `example/tracker-backend-api/package.json` — pins `helmet` `8.1.0`, `compression` `1.8.1`, `@types/compression` `1.8.1`.
- `example/tracker-backend-api/openspec/specs/http-compression/spec.md` — documents the compression default threshold of 1KB (bodies below the threshold are not compressed).

**Binding constraints (CLAUDE.md hard rules / architecture.md):**
- **D5 same-origin proxy** — each Next app rewrites `/api/*` → NestJS; better-auth mounted via `@thallesp/nestjs-better-auth` requires **`bodyParser: false`** on the Nest app (already set in `main.ts` and `bootIntegrationApp`). The middleware MUST NOT break the proxy, cookie forwarding, or auth (AC-2).
- **NFR2 / hard rule 6** — exact dependency versions only (no `^`/`~`); never add eslint/prettier. `helmet` + `compression` (+ `@types/compression`) are the **only new deps this epic** — pin exact and justify (D-6).
- **NFR3/NFR4** — local-only runtime, zero external telemetry. helmet/compression are self-contained; no external calls, no new env vars (D-5).
- **NFR6 / D8 drift gate** — API access only via the generated client; the OpenAPI drift gate must be a no-op (AC-3).
- **NFR1** — tests ship in this story (AC-4).

## Acceptance Criteria

1. **Helmet sets standard security response headers on every API response.** Given the NestJS API, when it boots and serves any request, then helmet is registered as global middleware and standard security headers are present on responses — including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy` — and the `X-Powered-By` header is removed. helmet is configured with **`contentSecurityPolicy: false`** (see D-2 — CSP is disabled deliberately for a JSON-only API behind the Next proxy, so Swagger UI and local HTTP are not broken); all other helmet defaults are retained.

2. **Compression is applied to responses.** Given a client that sends `Accept-Encoding: gzip`, when it requests an endpoint whose response body exceeds the compression threshold (default 1KB), then the response carries `Content-Encoding: gzip` and `Vary: Accept-Encoding`. Given a response body below the threshold (or a request that omits `Accept-Encoding`, or sends the `x-no-compression` header), then the response is not compressed. Compression uses the middleware's defaults (threshold 1KB, standard content-type filter).

3. **No contract / generated-client / DTO change (D-7, NFR6, D8 drift gate).** Given the middleware is enabled, when the contract is checked, then `apps/api/openapi.json` and the generated client (`packages/shared/src/generated/`) are **byte-for-byte unchanged** — no regeneration needed and the CI drift gate is a no-op. The `emit-openapi` build step (`pnpm --filter @supertool/api build`) still succeeds with helmet/compression registered (they are inert during introspection because `emit-openapi` never listens).

4. **Tests ship with the feature (NFR1).** A Testcontainers integration spec asserts: (a) the expected helmet security headers are present and the `Content-Security-Policy` header is **absent** on a representative endpoint; (b) a large-payload response is gzip-compressed when `Accept-Encoding: gzip` is sent, and a below-threshold / no-`Accept-Encoding` / `x-no-compression` response is not; (c) representative flows still work end-to-end through the middleware — better-auth sign-up + sign-in (cookie set and accepted), a transactions CRUD read, and an analytics endpoint — returning correct bodies. The spec uses the `bootIntegrationApp` / `stopIntegrationApp` helpers (the 7-1 teardown helper) with no pool/container leak. **All existing integration specs continue to pass unchanged**, since they now boot through the same middleware chain via the shared `configureAppRouting`.

5. **No same-origin-proxy / auth / Swagger regression — verified in a running stack (AC per epics.md).** Given the running compose/dev stack, when the middleware is enabled, then: sign-up/sign-in via the money-tracker `/api/*` proxy work, session cookies are forwarded and accepted, a protected page (dashboard) loads its data, and Swagger UI at `/api/docs` renders and can execute a request in dev (no broken-CSP / blocked-asset / `upgrade-insecure-requests` regression). Evidence recorded in the Dev Agent Record (memory `verify-middleware-redirect-changes-live` — middleware changes need a running-app check that gates cannot catch).

6. **Exact-pinned new dependencies recorded (NFR2 / hard rule 6).** Given the new deps, when they are added, then `helmet`, `compression`, and `@types/compression` are pinned to exact versions (no `^`/`~`) in `apps/api/package.json` (helmet + compression as `dependencies`, `@types/compression` as a `devDependency`; helmet ships its own types so it needs no `@types`), and each version + placement is justified in the Dev Agent Record against architecture.md's exact-versions rule. No eslint/prettier introduced.

7. **No new env vars (D-5).** Given the middleware config is a fixed local-PoC policy (not env-driven), when the story lands, then no new environment variable is added — `turbo.json` `globalEnv` and `.github/workflows` placeholders are unchanged. (If, and only if, the dev finds a compelling reason to make any helmet/compression option env-driven, the var must be added to `turbo.json` `globalEnv` + CI placeholders per memory `turbo-globalenv-new-vars` and justified.)

8. **Visual QA & i18n: N/A (backend-only).** This story adds no user-facing surface and no user-facing strings; visual QA is explicitly not applicable and `en.json`/`uk.json` are unchanged (recorded like 5-4/6-5, so the reviewer does not flag a missing gate).

## Tasks / Subtasks

- [x] **Task 1 — Add and pin the new dependencies (AC: 6)**
  - [x] Add to `apps/api/package.json` `dependencies`: `"helmet": "8.2.0"` and `"compression": "1.8.1"`.
  - [x] Add to `apps/api/package.json` `devDependencies`: `"@types/compression": "1.8.1"` (compression ships no bundled types; helmet is TS-native — do **not** add `@types/helmet`, it is a deprecated stub).
  - [x] Run `pnpm install` and confirm the lockfile updates with exact versions (no `^`/`~`).
  - [x] Record in the Dev Agent Record: exact versions + why (see D-6 — newest stable per memory `new-deps-newest-stable`; reference pins helmet 8.1.0 / compression 1.8.1 / @types/compression 1.8.1 — we take the newest stable helmet 8.2.0, and 1.8.1 is already newest for compression/@types).

- [x] **Task 2 — Register helmet + compression in the shared routing configurator (AC: 1, 2)**
  - [x] In `apps/api/src/app/configure-app-routing.ts`, at the **start** of `configureAppRouting` (before `setGlobalPrefix` / `enableVersioning` / `useGlobalPipes`), register: `app.use(helmet({ contentSecurityPolicy: false }))` **first**, then `app.use(compression())`. Import both as default imports (`import helmet from 'helmet'; import compression from 'compression';`).
  - [x] Keep the function signature `(app: INestApplication): void` — `INestApplication` exposes `use()`, so no change to `NestExpressApplication` is required (D-1). Do not touch `main.ts` / `emit-openapi.ts` / `bootIntegrationApp` — they already call `configureAppRouting`, so registering here wires runtime + build + tests from one place (D-1).
  - [x] Confirm middleware order: helmet (headers) → compression (response wrapper) → prefix → versioning → validation pipe.
  - [x] Do **not** add cookie-parser (D-4 — out of scope; better-auth handles its own cookies).

- [x] **Task 3 — Contract no-op verification (AC: 3)**
  - [x] Run `pnpm --filter @supertool/api build` (runs `nest build` then `emit-openapi`) and confirm it succeeds with helmet/compression registered.
  - [x] Confirm `git status` shows `apps/api/openapi.json` and `packages/shared/src/generated/**` **unchanged** (no drift). If any incidental drift appears, investigate — the middleware must not alter the contract; do not blindly regenerate.

- [x] **Task 4 — Integration test (AC: 4)** — new spec `apps/api/test/integration/security-middleware.integration.spec.ts`
  - [x] Boot via `bootIntegrationApp` (which calls `configureAppRouting`, so the middleware is live); tear down via `stopIntegrationApp({ app, container, poolList })` (7-1 helper) — no pool/container leak. Follow the structure of existing specs in `apps/api/test/integration/` (e.g. `analytics.integration.spec.ts`, `auth.integration.spec.ts`) and reuse `createHttpClient` (`test/helpers/http-client.ts`) and `auth-client` where useful.
  - [x] **Helmet headers:** hit a representative endpoint (`GET /api/v1/health`) and assert presence of `x-content-type-options: nosniff`, `x-frame-options: DENY`, `strict-transport-security`, `referrer-policy`, and assert `content-security-policy` is **absent** and `x-powered-by` is **absent** (D-2).
  - [x] **Compression present:** request an endpoint returning a body > 1KB with `Accept-Encoding: gzip` and assert `content-encoding: gzip` + `vary: accept-encoding`. Use a large seeded payload (e.g. a transactions list or an analytics response) so the body clears the 1KB threshold. **Gotcha:** Node's global `fetch`/undici transparently decompresses and may strip `content-encoding` after decoding — assert compression with a client that exposes the raw encoded response: use `node:http`/`node:https` `get` (no auto-decompress) and read the `content-encoding` header, or `zlib.gunzipSync` the raw buffer. Record the approach chosen.
  - [x] **Compression suppressed:** assert a below-threshold response (e.g. tiny `GET /api/v1/health`) is **not** gzip-encoded, and that sending `x-no-compression` (or omitting `Accept-Encoding`) yields an uncompressed response.
  - [x] **Flows still work through the middleware:** better-auth sign-up + sign-in (cookie issued and accepted on a follow-up authenticated request), a transactions read (create + list or list of seeded data), and one analytics endpoint — all return correct bodies decoded correctly after compression.
  - [x] Run the FULL api test suite (`pnpm --filter @supertool/api test`) and confirm every existing integration spec still passes now that they boot through helmet+compression (this is the real regression proof for AC-4). Use pnpm scripts, retry on the transient H.replace crash (memory `run-tests-via-pnpm-scripts`).

- [x] **Task 5 — Running-stack verification (AC: 5)**
  - [x] Bring up the stack (compose or `pnpm dev`); verify (and record evidence in the Dev Agent Record): sign-in via money-tracker through the `/api/*` proxy works and the session cookie is accepted; the dashboard loads its data (proxy + auth + analytics through helmet/compression); Swagger UI at `http://localhost:3001/api/docs` renders and can execute a request in dev (confirms CSP-disable decision D-2 — no blocked inline scripts / `upgrade-insecure-requests` breakage); spot-check response headers in browser devtools show the helmet headers and (for a large response) `content-encoding: gzip`.
  - [x] If the running-stack check surfaces a broken header (e.g. `Cross-Origin-Resource-Policy`/`Cross-Origin-Opener-Policy` interfering with the proxy — not expected since the browser sees API responses same-origin through the Next rewrite), relax the specific helmet option and record the change as a new D-x with rationale. Do not weaken headers speculatively.

- [x] **Task 6 — Confirm scope guards (AC: 7, 8)**
  - [x] Confirm no new env var was introduced; `turbo.json` `globalEnv` and CI workflow placeholders unchanged.
  - [x] Confirm no `en.json`/`uk.json` change and no UI change; record Visual QA + i18n as N/A in the Dev Agent Record.

## Review Findings

Adversarial code review (bmad-code-review, 2026-07-05) — 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Gates re-run by orchestrator: type-check + lint green. Verdict: **APPROVE** — no must-fix findings; all ACs (1-8) satisfied and regression-encoded; drift gate genuine no-op (openapi.json + generated client absent from diff). All items below are nice-to-have.

- [ ] [Review][Patch] Negative compression tests only assert `content-encoding` absence — would stay green if `app.use(compression())` were removed [apps/api/test/integration/security-middleware.integration.spec.ts:181-194] — strengthen "omits accept-encoding"/below-threshold cases to also assert the raw body is uncompressed valid JSON, so a dropped middleware fails a test (blind+auditor).
- [ ] [Review][Patch] No HTTP-level test that the 6-3 CSV/JSON export (`Content-Disposition` + `EXPORT_TRUNCATED_HEADER`) survives gzip through the new chain [apps/api/src/modules/transactions/transactions.controller.ts:191-198] — export specs exercise the service layer only; one raw-http export assertion would close the only meaningful coverage gap the middleware introduces (edge).
- [ ] [Review][Patch] HSTS assertion `toContain('max-age=')` would pass for `max-age=0` (HSTS effectively off) [apps/api/test/integration/security-middleware.integration.spec.ts:150] — tighten to a nonzero max-age (blind).
- [ ] [Review][Patch] `rawGet` has no request timeout — a stalled socket hangs to the outer runner timeout with no diagnostic [apps/api/test/integration/security-middleware.integration.spec.ts:80-95] — add `req.setTimeout(...)` rejecting the promise (blind).
- [ ] [Review][Patch] Test uses implicit `any` for `container`/`pool`/`app` and an untyped `rawGet` promise; the declared `RawResponse` interface is never applied to the return type [apps/api/test/integration/security-middleware.integration.spec.ts:64-95] — annotate to make the declared interfaces load-bearing (blind).
- [x] [Review][Defer] `TESTCONTAINERS_RYUK_DISABLED='true'` risks leaked containers if teardown does not run [apps/api/test/integration/security-middleware.integration.spec.ts:30] — deferred, consistent with the existing Testcontainers spec convention in this repo, not introduced by this story.

## Dev Notes

### Architecture & source-tree context

- **Single-source middleware registration.** `apps/api/src/app/configure-app-routing.ts` is the one place all app-wide routing/middleware config lives, and it is invoked by `main.ts` (runtime), `emit-openapi.ts` (build), and `bootIntegrationApp` (tests). Registering helmet + compression here (not in `main.ts` like the reference) guarantees the integration tests exercise the exact production middleware chain and keeps the three entry points consistent. [Source: apps/api/src/app/configure-app-routing.ts; apps/api/src/main.ts; apps/api/src/emit-openapi.ts; apps/api/test/helpers/integration-app.ts]
- **`bodyParser: false` is already set** on the Nest app in both `main.ts` and `bootIntegrationApp` — required by `@thallesp/nestjs-better-auth` (architecture D5). This is a **request**-body-parsing setting; compression is a **response** middleware, so there is no interaction. Do not change `bodyParser`. [Source: architecture.md#Authentication & Security (D5); apps/api/src/main.ts]
- **Swagger** is set up in `main.ts` only when `NODE_ENV !== 'production'` at `api/docs` (i.e. `/api/docs` under the global prefix). helmet's default CSP would break its inline scripts/styles — the reason for D-2. [Source: apps/api/src/main.ts]
- **Representative endpoints for tests:** `GET /api/v1/health` (unauthenticated, tiny → below compression threshold — good for header assertions + "not compressed" case); a transactions list or analytics endpoint over seeded data for the "> 1KB → gzip" case. Existing integration specs to mirror: `apps/api/test/integration/{auth,transactions,analytics}.integration.spec.ts`. [Source: apps/api/src/modules/health/health.controller.ts; apps/api/test/integration/]
- **Rate-limiting already shipped** (better-auth `rateLimit` in `apps/api/src/auth/auth.ts`, differentiated auth vs global, extended in 7-2) — this story does not touch it; helmet/compression are orthogonal to rate limiting. [Source: apps/api/src/auth/auth.ts; architecture.md#Security posture]

### Decisions (record rationale — flag security-sensitive items for operator confirmation)

- **D-1 — Register in `configureAppRouting`, not `main.ts` (divergence from reference).** The reference puts helmet/compression in `main.ts` because it has no shared routing configurator. supertool centralizes all app-wide config in `configureAppRouting`; putting the middleware there wires runtime + OpenAPI-emit + integration tests from one source and lets the integration spec assert against the real production chain. Rationale > reference-literal fidelity.
- **D-2 — `helmet({ contentSecurityPolicy: false })`; all other helmet defaults retained. ⚠ SECURITY-SENSITIVE — flag for operator confirmation.** The API is JSON-only, consumed by the money-tracker via a same-origin Next `/api/*` proxy; the browser never renders API responses as HTML documents, so a Content-Security-Policy (which governs document resource loading) adds negligible protection to the API — the Next app owns the CSP of the HTML it serves. Meanwhile helmet's default CSP (`default-src 'self'` + `upgrade-insecure-requests`) **breaks Swagger UI in dev** (blocks its inline scripts/styles and would force `http://localhost` asset requests to `https`, breaking local HTTP). AC-2/AC-5 require Swagger to keep working. Therefore CSP is disabled and every other helmet default is kept. The reference uses bare `helmet()` (CSP on) — this is a deliberate, recorded divergence; operator should confirm the JSON-API-no-CSP posture. `Strict-Transport-Security` is moot over local HTTP (browsers ignore HSTS on `http://`) but harmless, so the default is left on. helmet's `Cross-Origin-Embedder-Policy` is off by default (since helmet v5), so it will not interfere with Swagger; `Cross-Origin-Resource-Policy`/`Cross-Origin-Opener-Policy` default to `same-origin` and are fine because the browser only ever receives API responses same-origin through the Next rewrite (D5) — confirmed by the AC-5 running-stack check.
- **D-3 — `compression()` with defaults (threshold 1KB, standard filter).** Matches the reference and the documented reference spec. Benefits the large JSON payloads (analytics, transaction lists) and the CSV/JSON export responses (6-3) — all compressible text; gzip sets `Content-Encoding`/`Vary` and does not conflict with `Content-Disposition`. The default filter honors `x-no-compression` and only compresses compressible content-types. No custom threshold/filter is warranted for a local PoC.
- **D-4 — cookie-parser OUT of scope.** epics.md Story 7.5's title and ACs are strictly "helmet & compression." The reference also adds cookie-parser, but better-auth manages its own cookie parsing from request headers, and supertool has run without cookie-parser through Epics 1–7 (sign-in/up, sessions, change-password, delete-account all work). Adding it would be an unscoped extra dependency. Recorded divergence.
- **D-5 — No new env vars.** The helmet/compression config is a fixed local-PoC policy, not env-driven, so nothing is added to `turbo.json` `globalEnv` or CI placeholders (memory `turbo-globalenv-new-vars` only applies if a var is introduced). Keeps the story change-surface minimal.
- **D-6 — Exact versions, newest stable (NFR2 + memory `new-deps-newest-stable`).** `helmet` `8.2.0` (newest stable; reference pins the slightly older `8.1.0` — no breaking changes in the minor), `compression` `1.8.1` (newest stable; matches reference), `@types/compression` `1.8.1` (newest stable; matches reference, devDependency). helmet is TypeScript-native → no `@types/helmet` (the DefinitelyTyped stub is deprecated). All pinned exact, no `^`/`~`.
- **D-7 — Middleware is contract-transparent.** No controller/DTO/route change → `openapi.json` and the generated client are unchanged; the drift gate is a no-op. `emit-openapi` introspects the Nest app and never listens, so the registered middleware is inert during emit. Verified by Task 3.

### Reference patterns (ED1 — study, never copy/import)

- `example/tracker-backend-api/src/main.ts` — middleware order & default usage (`helmet()` → `compression()` → `cookieParser()`, before `setGlobalPrefix`/pipes). We adapt order (helmet → compression) into `configureAppRouting`; we omit cookieParser (D-4) and disable CSP (D-2).
- `example/tracker-backend-api/package.json` — dependency pins for helmet/compression/@types/compression (we take newest stable per D-6).
- `example/tracker-backend-api/openspec/specs/http-compression/spec.md` — confirms the 1KB default threshold behavior asserted in AC-2/Task 4.
- No frontend counterpart — backend-only story (new ground for the frontend: none).

### Testing standards

- Testcontainers integration specs live in `apps/api/test/integration/` (`*.integration.spec.ts`), booted via `bootIntegrationApp` and torn down via `stopIntegrationApp` (7-1 helper — reuse it; do not hand-roll teardown). Use `createHttpClient` / `auth-client` helpers. Run via `pnpm --filter @supertool/api test` (never `node_modules/.bin` directly; retry on the transient H.replace crash — memory `run-tests-via-pnpm-scripts`).
- Compression assertion gotcha (Task 4): global `fetch`/undici auto-decompresses and can strip `content-encoding`; assert against the raw encoded response via `node:http`/`node:https` or `zlib`.

### Previous-story intelligence (7-4 marketing landing page → done)

- 7-4 was frontend-only; no backend/middleware overlap. The relevant precedent is the epic-6 backend cadence: contract-first, single-concern, every security-sensitive surface proven by a dedicated integration test (epic-6 retro D4), and the 7-1 pool-drain teardown fix (`stopIntegrationApp`) that retired the `57P01` CI flake — reuse that helper here so this final backend story does not reintroduce the flake.
- epic-6 retro flagged for 7-5 explicitly: "verify it doesn't interfere with the export endpoint's `Content-Disposition`/binary response (6-3) or the same-origin `/api/*` proxy" — covered by D-3 (compression + Content-Disposition are orthogonal) and AC-5 (running-stack proxy check).

### Project Structure Notes

- Files touched: `apps/api/src/app/configure-app-routing.ts` (UPDATE — add 2 `app.use` lines + imports), `apps/api/package.json` (UPDATE — 3 deps), lockfile (UPDATE), `apps/api/test/integration/security-middleware.integration.spec.ts` (NEW). No schema, DTO, controller, generated-client, i18n, or UI files change. Aligns with the controller/service/repository layering (middleware sits above all of it) and hard rules D1/D7/NFR6 (untouched — no money, no DB, no client change).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.5: Security Hardening — Helmet & Compression]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7 (RP-B10 opportunistic hardening)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security (D5, security posture, NFR2/NFR3/NFR4)]
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md#Epic 7 look-ahead (7-5 export/proxy caution); D4 security-surface integration-test discipline]
- [Source: apps/api/src/app/configure-app-routing.ts; apps/api/src/main.ts; apps/api/src/emit-openapi.ts; apps/api/test/helpers/integration-app.ts; apps/api/src/auth/auth.ts]
- [Source: example/tracker-backend-api/src/main.ts; example/tracker-backend-api/package.json; example/tracker-backend-api/openspec/specs/http-compression/spec.md]
- Memory: `new-deps-newest-stable`, `turbo-globalenv-new-vars`, `run-tests-via-pnpm-scripts`, `verify-middleware-redirect-changes-live`, `background-agents-cannot-prompt`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]` — via the `bmad-dev-story` workflow.

### Debug Log References

- `pnpm --filter @supertool/api build` → emit-openapi succeeds with middleware registered; `apps/api/openapi.json` and `packages/shared/src/generated/**` byte-for-byte unchanged (drift gate no-op, AC-3).
- `pnpm --filter @supertool/api test` → 51 files / 430 tests pass (includes the new `security-middleware.integration.spec.ts` and all pre-existing specs, which now boot through the helmet+compression chain via the shared `configureAppRouting`).
- Repo gates (all green, `TURBO_FORCE=true` on turbo-backed): `type-check`, `lint`, `stylelint`, `fmt:check`, `test` (8/8 tasks), `i18n:parity`, `build`.
- Two story-text expectations corrected against the actually-installed middleware defaults during red/green (see D-8, D-9).

### Completion Notes List

Implemented helmet + compression as global Express middleware in the single shared routing configurator `apps/api/src/app/configure-app-routing.ts`, wiring runtime (`main.ts`), OpenAPI emit (`emit-openapi.ts`), and integration tests (`bootIntegrationApp`) from one place (D-1). Order: `helmet({ contentSecurityPolicy: false })` → `compression()` → global prefix → URI versioning → ValidationPipe. Both imported as default imports (esModuleInterop on). No signature change: `INestApplication.use()` is used, so no switch to `NestExpressApplication` was needed.

Decisions recorded (D-1…D-7 pre-settled in the story and honored as written):
- D-2 CSP disabled, all other helmet defaults retained — confirmed live: Swagger UI at `/api/docs` renders and CSP header is absent.
- D-6 dependency pins: `helmet` `8.2.0` + `compression` `1.8.1` as `dependencies`, `@types/compression` `1.8.1` as `devDependency`; helmet is TS-native so no `@types/helmet`. All exact (no `^`/`~`), verified in `pnpm-lock.yaml` (`specifier: 8.2.0` / `1.8.1` / `1.8.1`). No eslint/prettier introduced.
- **D-8 (NEW) — helmet default `X-Frame-Options` is `SAMEORIGIN`, not `DENY`.** The story text (AC-1 / Task 4) guessed `DENY`, but helmet 8.2.0's default frameguard action is `SAMEORIGIN` (verified by introspecting the installed module). D-2 mandates keeping all non-CSP helmet defaults, so the middleware and the integration spec assert the real default value `SAMEORIGIN`. AC-1's intent (a restrictive `X-Frame-Options` present) is satisfied; only the literal example value in the story prose was off. No config override added.
- **D-9 (NEW) — `x-no-compression` is NOT honored by compression 1.8.1's bundled default filter.** The default `shouldCompress` in `compression` 1.8.1 checks only content-type compressibility; the `x-no-compression` opt-out exists only if a custom filter is supplied (per the package README example), which D-3 forbids (defaults only). AC-2 lists `x-no-compression` as one *optional* suppression path ("or sends the `x-no-compression` header"); suppression is instead proven via the two default-supported paths — below-threshold body and absent `Accept-Encoding`. No custom filter added, keeping D-3 (defaults) and avoiding unscoped config.

Integration test (`apps/api/test/integration/security-middleware.integration.spec.ts`, 8 tests): asserts helmet headers present + CSP/`x-powered-by` absent on `GET /api/v1/health`; large authenticated transactions list (60 seeded rows, `limit=100`) is gzip-compressed with `Vary: Accept-Encoding` and decodes correctly (raw `node:http` + `zlib.gunzipSync` to bypass undici auto-decompress — the Task 4 gotcha); below-threshold health and no-`Accept-Encoding` responses are uncompressed; better-auth sign-up + sign-in cookie accepted on follow-up reads; transactions read and analytics summary return correct bodies; unauthenticated read returns 401. Boots via `bootIntegrationApp` / tears down via 7-1 `stopIntegrationApp({ app, container, poolList })` with no pool/container leak.

Live running-stack verification (AC-5, memory `verify-middleware-redirect-changes-live`) — api `:3001` (`node dist/main`, cwd confirmed = this checkout, not a stale worktree) + web `:3000` + Dockerized Postgres:
- Direct `GET :3001/api/v1/health` → helmet headers present (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, `X-DNS-Prefetch-Control: off`, `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`); `Content-Security-Policy` absent; `X-Powered-By` absent.
- Same-origin proxy: `POST :3000/api/v1/auth/sign-in/email` (seeded operator) → 200 + `better-auth.session_token` cookie set; `GET :3000/api/v1/transactions?...` with the cookie → 200, `Content-Encoding: gzip`, `Vary: Accept-Encoding`, helmet headers present, body decodes to valid JSON (`meta.total: 9`). Proxy + cookie forwarding + auth + compression all intact.
- Protected page: `/en/dashboard` with session → 307 locale-normalize → `/dashboard` → 200 rendering real dashboard data (Income/Expense); without session → 307 → `/en/sign-in` (auth gate correct).
- Swagger UI `GET :3001/api/docs` → 200, renders (`<title>Swagger UI</title>`), confirming the CSP-disable decision (D-2). No CORS/auth errors observed.

Scope guards (AC-7, AC-8): no new env var — `turbo.json` and `.github/` unchanged; no i18n change — `en.json`/`uk.json` unchanged; no UI change. Visual QA + i18n recorded N/A (backend-only). cookie-parser deliberately omitted (D-4).

### File List

- `apps/api/package.json` (M) — add `helmet` `8.2.0`, `compression` `1.8.1` (dependencies), `@types/compression` `1.8.1` (devDependency).
- `pnpm-lock.yaml` (M) — lockfile resolution for the three new deps (exact versions).
- `apps/api/src/app/configure-app-routing.ts` (M) — register `helmet({ contentSecurityPolicy: false })` then `compression()` before prefix/versioning/pipe; default imports.
- `apps/api/test/integration/security-middleware.integration.spec.ts` (NEW) — Testcontainers integration spec (helmet headers, compression behavior, representative flows).
- `_bmad-output/implementation-artifacts/7-5-security-hardening-helmet-compression.md` (M) — story tracking (tasks, Dev Agent Record, File List, Change Log, Status).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (M) — `7-5` → `review`.

## Change Log

- 2026-07-05 — Story 7.5 implemented: helmet + compression middleware registered in shared `configureAppRouting`; deps pinned (helmet 8.2.0, compression 1.8.1, @types/compression 1.8.1); integration spec added; contract drift no-op verified; all gates green; live running-stack proxy/headers/Swagger verification passed. Two story-text corrections recorded (D-8 X-Frame-Options SAMEORIGIN default; D-9 x-no-compression not in compression 1.8.1 default filter). Status → review.
- 2026-07-05 — Code review APPROVE (3 adversarial layers, 0 must-fix; middleware order + drift no-op + proxy/auth/Swagger safety + exact deps + genuine gzip-observing test independently verified; 5 non-blocking nice-to-haves). PR opened: https://github.com/BudnikOleksii/supertool/pull/51
