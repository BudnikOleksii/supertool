---
baseline_commit: a2051e0ba30be38a3a45db28bb53b14eb9788c30
---

# Story 1.3: OpenAPI → Generated Client Pipeline

Status: done

<!-- context-engine: exhaustive analysis of epics.md, architecture.md (D5, D7, D8, D9, patterns, tree), story 1.2 record + review findings, deferred-work.md, live repo state (api shared layer, emitted openapi.json, turbo graph, CI workflow), and @hey-api/openapi-ts 0.98.x docs verification completed 2026-06-11 -->

## Story

As the operator-developer,
I want the typed API client generated from the OpenAPI spec, committed, and drift-gated,
so that the frontend can only ever speak to the API through the contract (NFR6, D8).

## Acceptance Criteria

1. **Given** the API build emitting `openapi.json`, **when** the turbo client-generation task runs, **then** @hey-api/openapi-ts writes the client into `packages/shared/src/generated/`, it type-checks, and turbo task ordering guarantees API build precedes generation (D8).
2. **Given** the generated client is committed, **when** CI runs, **then** a drift gate regenerates the client and fails the pipeline on any diff.
3. **Given** `packages/next-shared`, **when** the client factory is consumed, **then** it exposes the D5+D9 duality: browser bundles target `/api/*` (proxied), server contexts target `API_URL` directly with incoming session-cookie forwarding.
4. **Given** the health endpoint, **when** called through the generated client in a test, **then** a typed response is returned — proving spec → client → call end-to-end.
5. **Given** `packages/shared` is scaffolded by this story, **when** shared primitives are placed, **then** the cross-app primitives that temporarily live in `apps/api/src/shared/` move into the package — `ErrorCode` constants → `packages/shared/src/constants/error-codes.ts`, the `ObjectValuesUnion` type utility → `packages/shared/src/types/object-values-union.ts` — plus new `HTTP_STATUS_CODE` constants (`packages/shared/src/constants/http-status-code.ts`), with the API consuming them from `@supertool/shared` (carried-over task from Story 1.2 review).

## Tasks / Subtasks

- [x] Task 1: Scaffold `packages/shared` (@supertool/shared) with the moved primitives (AC: 5)
  - [x] `packages/shared/package.json`: name `@supertool/shared`, private, **no `"type": "module"`** (CJS output — see Dev Notes "Module format decision"), scripts `build` (tsc), `type-check`, `lint`, `lint:fix` — deliberately NO `test` script (the package is constants/types/generated-output only; this story's NFR1 tests live in next-shared and api); exports map via wildcard subpaths pointing at `dist` (`"./*": { "types": "./dist/*.d.ts", "default": "./dist/*.js" }`) — no root `"."` barrel export (no-barrel rule)
  - [x] `tsconfig.json` extending `@supertool/typescript-config/base.json` with `rootDir: "src"`, `outDir: "dist"`, **`include: ["src"]`** — without the explicit include, `openapi-ts.config.ts` sits outside `rootDir` and tsc fails with TS6059 (declarations already on in base; remember TS 6: no `baseUrl`, explicit `rootDir` — Story 1.2 lesson)
  - [x] `.oxlintrc.json` extending `../../packages/lint-config/configs/base.json` (`library.json` is React-flavored — reserved for `ui`/`widgets` in 1.4; plain-TS packages extend base)
  - [x] MOVE (not copy) `apps/api/src/shared/types/object-values-union.ts` → `packages/shared/src/types/object-values-union.ts`; delete the api original
  - [x] MOVE (not copy) `apps/api/src/shared/enums/error-codes.ts` → `packages/shared/src/constants/error-codes.ts` (note dir rename `enums/` → `constants/` per AC 5); delete the api original and the now-empty `enums/` dir
  - [x] NEW `packages/shared/src/constants/http-status-code.ts`: `HTTP_STATUS_CODE` as-const object (PascalCase keys mirroring `ErrorCode` style: `BadRequest: 400`, `Unauthorized: 401`, `Forbidden: 403`, `NotFound: 404`, `Conflict: 409`, `UnprocessableEntity: 422`, `TooManyRequests: 429`, `InternalServerError: 500`) + `HttpStatusCode` union via `ObjectValuesUnion` — no TS enum (.claude/rules/typescript.md)
  - [x] Update api consumers to deep-import from `@supertool/shared` (add `"@supertool/shared": "workspace:*"` to api dependencies): `global-exception.filter.ts` + its spec, `error-response.dto.ts`. In the filter, replace all three `HttpStatus` usages with `HTTP_STATUS_CODE` from shared: the `STATUS_CODE_MAP` keys, the `>= INTERNAL_SERVER_ERROR` check in `catch()`, and the 500 fallback envelope in `toEnvelope()`. The filter SPEC only swaps its `ErrorCode` import to shared — it may keep Nest's `HttpStatus` for arranging test exceptions (test-only usage, not envelope-shaping)
  - [x] Update `.claude/rules/typescript.md`: `ObjectValuesUnion` location reference now reads `packages/shared/src/types/object-values-union.ts` (drop the "moves in Story 1.3" clause)
  - [x] Verify `turbo run build --filter @supertool/shared` and api `type-check`/`test` still green (turbo `^build` ordering builds shared before api consumes its dist)
- [x] Task 2: Client generation pipeline — @hey-api/openapi-ts into `src/generated/` (AC: 1)
  - [x] Add devDep `@hey-api/openapi-ts` **0.98.2** (exact pin; npm-latest re-verified 2026-06-11) to `packages/shared` — no separate runtime package needed, the fetch client is bundled into the generated output since 0.64+
  - [x] `packages/shared/openapi-ts.config.ts`: `input: '../../apps/api/openapi.json'`, `output: { path: 'src/generated', clean: true }` (MANDATORY `clean: true` — without it, files for removed endpoints survive forever and never trip the drift gate), `plugins: ['@hey-api/client-fetch']`
  - [x] Script `generate:client` in `packages/shared` running `openapi-ts`; turbo task `generate:client` with `"dependsOn": ["@supertool/api#build"]`, `"cache": false` (output is committed source, not a cacheable artifact) — this dependency edge IS the AC-1 ordering guarantee
  - [x] Change the existing empty `"test": {}` task in root `turbo.json` to `"test": { "dependsOn": ["^build"] }` (api specs will import `@supertool/shared` dist — CI `test` job runs bare `pnpm test` with no prior build step; without this edge the suite breaks in CI)
  - [x] Run generation once; COMMIT everything under `packages/shared/src/generated/` (root `.gitignore` `dist/` patterns don't match it — verify nothing ignores it)
  - [x] Generated-code hygiene: add `packages/shared/src/generated/**` to root `.oxlintrc.json` `ignorePatterns` AND `.oxfmtrc.json` `ignorePatterns` — see Dev Notes "Drift-gate byte-exactness" for why fmt exclusion is load-bearing, then prove it: stage a regenerated file, run the pre-commit hook path (`lint-staged`), confirm zero mutation
  - [x] `pnpm type-check` green with the generated code included — if the strict flags (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedParameters`) reject generated output, scope a relaxation to the generated dir only (e.g. dedicated tsconfig include/exclude split); NEVER hand-edit generated files, never weaken root strictness
- [x] Task 3: CI drift gate (AC: 2)
  - [x] New `client-drift` job in `.github/workflows/ci.yml` (the reserved slot comment at the top names it): checkout → `./.github/actions/setup-pnpm-node-deps` (same shape as sibling jobs, `needs: [init-env]`) → `pnpm turbo run generate:client` (api build runs via the dependency edge; emit-openapi needs no database — proven by the existing CI build job) → an UNTRACKED-AWARE diff check: `test -z "$(git status --porcelain -- packages/shared/src/generated)"` — plain `git diff --exit-code` misses newly created files and would pass on real drift (with `clean: true`, regeneration can both add and delete files)
  - [x] Remove the `client-drift` line from the reserved-slots comment block (leave the i18n-parity slot for 1.4)
  - [x] Prove the gate locally: hand-edit one generated file → regenerate → diff clean; then temporarily tweak a DTO → rebuild + regenerate → diff dirty (revert after)
- [x] Task 4: `packages/next-shared` client factory — D5+D9 duality (AC: 3)
  - [x] Scaffold `@supertool/next-shared`: same package shape as shared (CJS, tsc build with `include: ["src"]` — `vitest.config.ts` stays outside `rootDir`, wildcard dist exports, base.json lint config + `env: { node: true }` in its `.oxlintrc.json` for `process`) + `"@supertool/shared": "workspace:*"` dependency; devDeps all exact: typescript 6.0.3, vitest 4.1.8, @types/node 22.19.20 (the 22.x line matching the Node engine, NOT npm-latest — 1.2 precedent; required for `process.env` to type-check), oxlint 1.69.0. Do NOT add `next` as a dependency this story — see Dev Notes "next-shared design decision"
  - [x] **`"test": "vitest run"` script in next-shared package.json** — without it, turbo silently skips the package and the AC-3 specs never run in CI (root `pnpm test` = `turbo run test`, script-presence-driven)
  - [x] `src/client/create-browser-api-client.ts`: returns a client instance built from the generated `createClient`/`createConfig` (imported from `@supertool/shared/generated/client/index` — the bundled runtime dir; `client.gen` exports only the default instance) with same-origin base (generated paths already carry `/api/v1/...` — the app-origin request hits the Next rewrite proxy, D5)
  - [x] `src/client/create-server-api-client.ts`: accepts `{ cookieHeader }` (RO-RO), targets `process.env.API_URL` origin directly, sets the `Cookie` header on the instance — incoming session-cookie forwarding without importing `next/headers`. **Fail fast when `API_URL` is unset** (throw with a clear message) — a silent relative-base server client would dispatch requests against nothing; under strict typing the env value is `string | undefined` anyway
  - [x] Add `API_URL` to `globalEnv` in root `turbo.json`
  - [x] Vitest (4.1.8, node env) specs (`*.test.ts` — package-side suffix) for both factories: browser instance has same-origin base; server instance carries `API_URL` base + forwarded cookie header (assert via the instance's config/interceptor surface, or a mocked `fetch` observing the dispatched Request); missing `API_URL` throws
- [x] Task 5: Typed end-to-end health call through the generated client (AC: 4)
  - [x] Spec in `apps/api` (e.g. `src/modules/health/health.client.spec.ts` — co-located convention): boot the real `AppModule` via `@nestjs/testing`, apply `configureAppRouting`, `app.listen(0)`, call the generated `healthCheck` SDK function pointed at the ephemeral port, assert the TYPED response (`status`, `database` fields exist with their literal types — compile-time proof) and runtime values
  - [x] No postgres required: health reports `database: 'down'` over HTTP 200 when the pool can't connect (Story 1.2 verified behavior) — assert on shape, not on `'up'`
  - [x] Suite green via `turbo run test --filter @supertool/api` (shared dist present via the new `test` → `^build` edge)
- [x] Task 6: Final verification (AC: all)
  - [x] Idempotency proof: run `generate:client` twice back-to-back → `git status` clean after the second run
  - [x] `pnpm lint`, `pnpm fmt:check`, `pnpm type-check`, `pnpm stylelint`, `pnpm test`, `pnpm build` all green at root
  - [x] Hygiene greps: no `^`/`~` in any new package.json; no eslint/prettier; nothing imported from `example/`; no leftover imports of the deleted api-local `error-codes`/`object-values-union` paths; no hand-written `fetch` to `/api/*` outside the generated client (NFR6)
  - [x] Update sprint-status.yaml on status transitions

## Dev Notes

### Critical scope boundary

This story creates **`packages/shared` + `packages/next-shared` + the generation pipeline + drift gate only**. Do NOT create: `tools.ts` registry, i18n routing helpers, providers, or anything Next-rendering related in next-shared (Story 1.4); `packages/{shell,widgets,ui}`, `apps/money-tracker`, `apps/storybook` (1.4); the actual `/api/*` rewrite config — that lives in the tool app's `next.config.ts` (1.4); auth, better-auth, guards (1.5); docker api/web services (1.7). The browser factory targets the proxy path that 1.4 will wire — building it now is correct; wiring rewrites now is scope creep. Per-operation `@ApiResponse` error decoration on endpoints is explicitly deferred to 1.5+ (deferred-work.md) — the generated client typing error envelopes per endpoint is NOT an AC here.

### Repo state you are starting from (Story 1.2 end state)

- Workspace: root + 3 config packages (`lint-config` with `base/library/nest/next` configs, `stylelint-config`, `typescript-config` with `base/nextjs/react-library` tsconfigs) + `apps/api`. **No `packages/shared` or `packages/next-shared` exist yet — this story creates the first runtime packages.**
- `apps/api` build = `nest build && node dist/emit-openapi.js` → writes `apps/api/openapi.json` (git-ignored artifact, declared in turbo build outputs). The emitted spec today: single path `/api/v1/health` (full prefix INCLUDED in paths, servers list empty), operationId `healthCheck` via the `<resource><Action>` `operationIdFactory` in `apps/api/src/app/openapi.ts`, plus `ErrorResponseDto`/`ErrorCode` schemas via `extraModels`.
- Primitives to move live at `apps/api/src/shared/enums/error-codes.ts` (as-const object + `ObjectValuesUnion` union, 8 codes) and `apps/api/src/shared/types/object-values-union.ts`. Consumers today: `global-exception.filter.ts`, `global-exception.filter.spec.ts`, `error-response.dto.ts` — the complete import-update surface.
- The filter imports `ErrorCode` as a VALUE (`Object.values`, map values) — keep it a plain import; `ObjectValuesUnion` stays `import type`. DI note: the filter injects `Logger` with explicit `@Inject(Logger)` — don't disturb (SWC/DI rule).
- turbo.json tasks: `build` (dependsOn `^build`, outputs include `openapi.json`), `type-check` (dependsOn `^build`), `lint`, `test` (NO dependsOn today — Task 2 adds it), `test:e2e` (dependsOn `build`). globalEnv: `NODE_ENV, PORT, HOST, DATABASE_URL`.
- CI jobs: init-env → lint / fmt-check / type-check (runs `pnpm build:packages` first) / stylelint / build / test (bare `pnpm test`). Reserved comment slots at the top of ci.yml for `client-drift` (this story) and `i18n-parity` (1.4).
- Node 22.15.0 / pnpm 11.5.2 pinned; pnpm 11 may auto-append `minimumReleaseAgeExclude` entries on install — keep them.

### Module format decision (BINDING for both new packages)

`@supertool/shared` and `@supertool/next-shared` ship **CJS output**: no `"type": "module"` in package.json, tsc under the inherited `module: NodeNext` then emits CommonJS. Three reasons, all load-bearing:

1. `apps/api` is Nest 11 CommonJS — it must `require` shared at runtime (the filter/DTO imports are runtime imports, not type-only).
2. hey-api generated code uses extensionless relative imports (`./types.gen`); NodeNext **ESM** would demand `.js` extensions and fail compilation — CJS resolution accepts extensionless.
3. Next.js (1.4) consumes CJS workspace packages without ceremony.

Wildcard exports (`"./*"` → dist) keep deep imports working for nested generated paths — but note exports-map wildcards substitute literally with NO directory-index fallback: `@supertool/shared/generated/client` would resolve to the nonexistent `dist/generated/client.js`. The bundled runtime dir is imported as `@supertool/shared/generated/client/index` (exports `createClient`/`createConfig`); the default instance as `.../generated/client.gen`; SDK functions as `.../generated/sdk.gen`. No root `"."` export, no hand-written barrels (.claude/rules/javascript.md) — the generated `index.ts` inside `src/generated/` is tool output and exempt, but prefer the deep `*.gen` imports over the generated barrel.

### Drift-gate byte-exactness (the one trap in this story)

The CI gate compares freshly generated output against the commit. **Anything that mutates committed generated files post-generation breaks the gate** — the prime suspect is the pre-commit pipeline: `.lintstagedrc` runs `oxfmt --write` + `oxlint --fix` on staged `.ts` files. If a regenerated file gets staged and reformatted locally, CI's raw regeneration won't match and the gate fails on an "unchanged" PR. Both root ignore lists (`.oxlintrc.json`, `.oxfmtrc.json`) MUST cover `packages/shared/src/generated/**` BEFORE the first commit of generated code, and Task 2 includes a hook-path proof. **If the proof fails** (lint-staged passes paths explicitly and the tools format them despite config ignores), fall back to excluding the generated dir in `.lintstagedrc` itself via negated micromatch globs (e.g. `!packages/shared/src/generated/**` patterns) — do not commit reformatted generated code. Same logic applies to any editor format-on-save — the committed bytes must be exactly what `openapi-ts` emits.

### next-shared design decision (BINDING)

The client factory is **pure-function, framework-free in this story**: `createServerApiClient({ cookieHeader })` takes the cookie header explicitly instead of reading `next/headers` itself. Rationale: no Next app exists until 1.4 (`next` would be an unused 100MB+ dependency violating the new-dependency rule's spirit), `next/headers` throws outside a request context (untestable in plain vitest), and the explicit-parameter shape is exactly what 1.4's `fetch-*` actions need to call anyway. Story 1.4 may layer a `next/headers`-reading convenience on top when it adds Next-specific code to this package. This satisfies AC 3's duality: the two factories ARE the browser-proxy vs server-direct split; cookie forwarding is the `cookieHeader` parameter wired onto the server instance.

The better-auth session token (1.5) is an opaque DB-backed cookie — it forwards through either path unchanged, so nothing here needs auth awareness (architecture "Validation Issues Addressed").

### Architecture compliance (binding for this story)

- **D8 — contract flow:** API build emits `openapi.json` → turbo task generates client into `packages/shared/src/generated/` → COMMITTED → CI regenerates and fails on diff. Hand-written `fetch` to `/api/*` is a defect (NFR6) [architecture.md#API-&-Communication-Patterns]
- **D5+D9 binding interpretation:** Next rewrites apply to BROWSER requests only; server actions/RSC must call `API_URL` directly with incoming session-cookie forwarding; the `next-shared` client factory owns this duality [architecture.md#Validation-Issues-Addressed]
- **Package boundaries:** `shared` is dependency-free except the generated client; `next-shared` may depend on Next.js, nothing below it may; dependency direction `shared` → … → apps. `apps/api` depending on `@supertool/shared` is correct; `packages/shared` must NEVER import from `apps/api` (the spec file handoff via `openapi.json` artifact is the only coupling) [architecture.md#Architectural-Boundaries]
- **Naming:** kebab-case files/dirs; constants UPPER_SNAKE_CASE (`HTTP_STATUS_CODE`); no TS enums — as-const + `ObjectValuesUnion` (.claude/rules/typescript.md); arrow functions, verb-first function names (`create*` per nestjs-apis.md "start each function with a verb"; `check*` for predicates per the javascript.md prefix table); array vars `*List`
- **operationIds** `<resource><Action>` camelCase drive generated SDK method names — `healthCheck` today; do not touch the factory in `apps/api/src/app/openapi.ts` [architecture.md#Naming-Patterns]
- **Tests ship with this story (NFR1):** next-shared factory specs + api typed-client spec minimum; co-located `*.spec.ts` (api) / `*.test.ts` (packages) — note the per-side suffix convention [architecture.md#Structure-Patterns]
- **No user-facing strings** in this story — the both-locales rule (FR19/FR20) still triggers first in 1.4
- **New-dependency rule:** `@hey-api/openapi-ts` 0.98.2 is architecture-approved (version table). New RUNTIME/feature dependencies beyond it need an architecture.md amendment first — toolchain glue (typescript, vitest, oxlint, @types/node in the new packages) follows the 1.2 precedent of recording exact pins in Dev Agent Record. Notably do NOT add `@hey-api/client-fetch` as an npm dependency (it's a plugin name, the runtime is bundled into generated output) and do NOT add `next` (deferred to 1.4)

### Previous story intelligence (1.2)

- **TS 6.0.3 friction, will recur in the new packages:** `baseUrl` is removed (use relative imports / exports maps); builds need explicit `rootDir: "src"` or TS5011 surfaces. Vitest 4 dropped CJS — but plain (non-decorator) packages like next-shared need NO SWC plugin; a minimal `vitest.config.ts` suffices. The api's SWC recipe stays untouched.
- **oxlint config propagation quirk:** nested-config `extends` does NOT propagate `env` or `ignorePatterns` — package-level `.oxlintrc.json` must set its own `env` if needed; root `.oxlintrc.json` owns all ignorePatterns (that's why the generated-dir ignore goes in the ROOT file).
- **Version-pin precedent:** if a pinned version doesn't exist on npm at install time, pin nearest existing and record the deviation in Dev Agent Record.
- **`unicorn/require-module-specifiers`** bans empty-export placeholder modules — don't scaffold empty `index.ts` files in the new packages; every file ships real exports.
- **Review-finding pattern from 1.2:** the `operationIdFactory` was specifically patched so THIS story's generated client gets `<resource><Action>` method names — the generated SDK surface (`healthCheck`) is the proof that patch worked; assert it in the AC-4 spec.
- Conventional commit example: `feat: generate typed api client with drift gate and shared package` — branch `TOOLS-1-3/openapi-generated-client-pipeline`, PR via `create-pr` skill, never commit to main.

### Latest tech notes (@hey-api/openapi-ts 0.98.x, verified 2026-06-11)

- 0.98.2 is npm latest — architecture pin holds, no drift.
- Config: `openapi-ts.config.ts` default-exports the config (or `defineConfig` from `@hey-api/openapi-ts`); `input` accepts a local JSON path; `output` accepts a string or `{ path, clean }`.
- `plugins: ['@hey-api/client-fetch']` — the TypeScript types + SDK plugins are defaults; output lands as `client.gen.ts`, `sdk.gen.ts`, `types.gen.ts`, `index.ts` + bundled `client/`+`core/` runtime dirs. No runtime npm dependency.
- Client instances: generated `client.gen.ts` exports the default `client`; separate instances via the bundled `createClient(createConfig({ baseUrl, headers }))`; every SDK function accepts `options.client` to override the default — that's the mechanism the next-shared factories return.
- `runtimeConfigPath` option exists for build-time client config injection — NOT needed here; the factory pattern keeps config at call sites.
- Node 22 native `fetch` serves the client in api specs and server contexts — no polyfill.

### Project Structure Notes

End-state tree delta for THIS story:

```
supertool/
├── turbo.json                          # + generate:client task, test→^build edge, globalEnv +API_URL
├── .oxlintrc.json  .oxfmtrc.json       # + packages/shared/src/generated/** ignores
├── .github/workflows/ci.yml            # + client-drift job (slot comment consumed)
├── apps/api/
│   ├── package.json                    # + @supertool/shared workspace:*
│   └── src/
│       ├── shared/
│       │   ├── enums/                  # DELETED (error-codes.ts moved out)
│       │   ├── types/                  # DELETED (object-values-union.ts moved out)
│       │   ├── filters/global-exception.filter.ts (+spec)  # imports from @supertool/shared
│       │   └── dtos/error-response.dto.ts                  # imports from @supertool/shared
│       └── modules/health/health.client.spec.ts            # NEW — AC 4 typed e2e proof
└── packages/
    ├── shared/                         # NEW — @supertool/shared
    │   ├── package.json  tsconfig.json  .oxlintrc.json  openapi-ts.config.ts
    │   └── src/
    │       ├── constants/error-codes.ts        # moved from api
    │       ├── constants/http-status-code.ts   # new
    │       ├── types/object-values-union.ts    # moved from api
    │       └── generated/                      # committed openapi-ts output
    └── next-shared/                    # NEW — @supertool/next-shared
        ├── package.json  tsconfig.json  .oxlintrc.json  vitest.config.ts
        └── src/client/
            ├── create-browser-api-client.ts (+test)
            └── create-server-api-client.ts  (+test)
```

Matches architecture.md#Complete-Project-Directory-Structure for both packages; `tools.ts` registry and i18n/providers content arrives in 1.4. One deliberate naming variance: architecture's tree shows `shared/` holding "constants (incl. tools.ts registry, error codes)" — error codes land under `constants/` per AC 5 wording (`enums/` was an api-local choice that dies with the move). The `*.test.ts` suffix (frontend/packages) vs `*.spec.ts` (api) split follows architecture.md#Structure-Patterns: next-shared uses `*.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] — story statement + the 5 ACs (incl. the carried-over Story 1.2 review task as AC 5)
- [Source: _bmad-output/planning-artifacts/architecture.md#Core-Architectural-Decisions] — D5 (proxy sessions), D8 (contract pipeline), D9 (frontend data flow)
- [Source: _bmad-output/planning-artifacts/architecture.md#Validation-Issues-Addressed] — the binding D5+D9 duality interpretation (browser-proxy vs API_URL + cookie forwarding)
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries] — package dependency directions, shared's dependency-free rule
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation] — version table (@hey-api/openapi-ts 0.98.2)
- [Source: _bmad-output/implementation-artifacts/1-2-api-foundation-health-check-database-baseline.md#Dev-Agent-Record] — emit-openapi mechanics, operationIdFactory patch, TS 6/oxlint/Vitest 4 lessons
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — per-operation @ApiResponse decoration deferred to 1.5+ (NOT this story's scope)
- [Source: .claude/rules/typescript.md, .claude/rules/javascript.md] — no enums / ObjectValuesUnion pattern, no barrels, naming prefixes
- [Source: https://heyapi.dev/openapi-ts/] — 0.98.x config/plugins/client-instance API (verified via docs query 2026-06-11)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Debug Log References

- `pnpm add --filter` and several other CLI invocations failed intermittently with `undefined is not an object (evaluating 'H.replace')` (local tooling wrapper issue, not project code) — worked around by editing package.json manually + `pnpm install`
- Strict-flag failure on generated output was `exactOptionalPropertyTypes` only (TS2379 across `client/`/`core/` runtime); `noUncheckedIndexedAccess`/`noUnusedParameters` did not trip
- lint-staged hook-path proof FAILED as the Dev Notes predicted: explicit staged paths bypass oxlint/oxfmt config `ignorePatterns`; story fallback applied
- `@supertool/shared:lint` (package-cwd oxlint run) also needed its own `ignorePatterns` — root ignores don't apply to package-level lint tasks (extends doesn't propagate ignorePatterns, Story 1.2 lesson reconfirmed)
- TS 6 does not auto-include `@types/node` in next-shared (api gets it transitively via Nest's `/// <reference types="node" />`); explicit `"types": ["node"]` required

### Completion Notes List

- **USER-DIRECTED CHANGE (AC 1/4 shape):** SDK generated as service classes, not flat functions — `operations: { strategy: 'byTags', containerName: '{{name}}ApiService' }` (non-deprecated 0.98 form of `asClass`). Oleksii chose service-style ergonomics (`HealthApiService.healthCheck()`) over tree-shakeable flat functions after discussing trade-offs. Each Nest controller tag yields its own `*ApiService` class automatically.
- `packages/shared` (@supertool/shared) created: CJS, wildcard dist exports, moved `ErrorCode` (constants/) + `ObjectValuesUnion` (types/) from api, new `HTTP_STATUS_CODE`; api filter/DTO/spec consume `@supertool/shared` deep imports; `HttpStatus` fully replaced by `HTTP_STATUS_CODE` in the filter
- Generation pipeline: `generate:client` (openapi-ts 0.98.2, `clean: true`) with turbo `dependsOn: ["@supertool/api#build"]` ordering edge; `test` task now depends on `^build`; output committed (16 files incl. bundled `client/`+`core/` runtime)
- Strict-typing split: `tsconfig.generated.json` compiles `src/generated` with `exactOptionalPropertyTypes: false` scoped relaxation; handwritten src stays fully strict; no generated file hand-edited
- Byte-exactness: generated dir ignored in root `.oxlintrc.json` + `.oxfmtrc.json` + package `.oxlintrc.json`; `.lintstagedrc` (JSON) replaced by `.lintstagedrc.mjs` filtering `packages/shared/src/generated/` out of staged-file commands (story-prescribed fallback after hook-path proof failed); zero-mutation proven via real lint-staged run (md5 fingerprint identical, exit 0)
- CI `client-drift` job added (untracked-aware `git status --porcelain` check); gate proven locally both directions: hand-edit → dirty → regenerate → clean; DTO contract change → regenerate → dirty (`types.gen.ts`) → revert → clean; double-run idempotency proven
- `packages/next-shared` (@supertool/next-shared) created: `createBrowserApiClient` (same-origin, no absolute base → proxy path D5) + `createServerApiClient({ cookieHeader })` (API_URL origin + Cookie header on instance, throws on unset/empty API_URL) — D5+D9 duality; `API_URL` added to turbo `globalEnv`; 6 vitest specs incl. dispatched-Request cookie assertion via injected fetch
- AC 4 e2e: `health.client.spec.ts` boots real AppModule on ephemeral port, calls `HealthApiService.healthCheck` through the generated client, asserts literal response types compile-time (`expectTypeOf`) + runtime values; passes with db up or down (asserts membership, not 'up')
- All root gates green: lint, fmt:check, type-check, stylelint, test (25 tests: 19 api + 6 next-shared), build; hygiene greps clean (no `^`/`~`, no eslint/prettier, no example/ imports, no leftover moved-file paths, no hand-written `/api/*` fetch)

### File List

New:

- packages/shared/package.json
- packages/shared/tsconfig.json
- packages/shared/tsconfig.generated.json
- packages/shared/.oxlintrc.json
- packages/shared/openapi-ts.config.ts
- packages/shared/src/constants/error-codes.ts (moved from apps/api/src/shared/enums/error-codes.ts)
- packages/shared/src/constants/http-status-code.ts
- packages/shared/src/types/object-values-union.ts (moved from apps/api/src/shared/types/object-values-union.ts)
- packages/shared/src/generated/client.gen.ts
- packages/shared/src/generated/index.ts
- packages/shared/src/generated/sdk.gen.ts
- packages/shared/src/generated/types.gen.ts
- packages/shared/src/generated/client/client.gen.ts
- packages/shared/src/generated/client/index.ts
- packages/shared/src/generated/client/types.gen.ts
- packages/shared/src/generated/client/utils.gen.ts
- packages/shared/src/generated/core/auth.gen.ts
- packages/shared/src/generated/core/bodySerializer.gen.ts
- packages/shared/src/generated/core/params.gen.ts
- packages/shared/src/generated/core/pathSerializer.gen.ts
- packages/shared/src/generated/core/queryKeySerializer.gen.ts
- packages/shared/src/generated/core/serverSentEvents.gen.ts
- packages/shared/src/generated/core/types.gen.ts
- packages/shared/src/generated/core/utils.gen.ts
- packages/next-shared/package.json
- packages/next-shared/tsconfig.json
- packages/next-shared/tsconfig.test.json
- packages/next-shared/.oxlintrc.json
- packages/next-shared/vitest.config.ts
- packages/next-shared/src/client/create-browser-api-client.ts
- packages/next-shared/src/client/create-browser-api-client.test.ts
- packages/next-shared/src/client/create-server-api-client.ts
- packages/next-shared/src/client/create-server-api-client.test.ts
- apps/api/src/modules/health/health.client.spec.ts
- .lintstagedrc.mjs

Modified:

- apps/api/package.json (+ @supertool/shared workspace:\*)
- apps/api/src/shared/filters/global-exception.filter.ts
- apps/api/src/shared/filters/global-exception.filter.spec.ts
- apps/api/src/shared/dtos/error-response.dto.ts
- turbo.json (generate:client task, test→^build, globalEnv +API_URL)
- .oxlintrc.json (generated-dir ignore)
- .oxfmtrc.json (generated-dir ignore)
- .github/workflows/ci.yml (client-drift job, reserved slot consumed)
- .claude/rules/typescript.md (ObjectValuesUnion location)
- pnpm-lock.yaml

Deleted:

- apps/api/src/shared/enums/error-codes.ts (moved)
- apps/api/src/shared/types/object-values-union.ts (moved)
- .lintstagedrc (replaced by .lintstagedrc.mjs)

## Change Log

- 2026-06-11: Story 1.3 implemented — shared + next-shared packages, openapi-ts generation pipeline with turbo ordering, CI client-drift gate, D5+D9 client factories, typed e2e health proof. SDK shape changed to service classes (byTags/`{{name}}ApiService`) per user decision during implementation; lint-staged moved to .lintstagedrc.mjs for generated-dir byte-exactness. Status → review.

## Review Findings

Code review 2026-06-11 (gates all green: lint, fmt:check, type-check, stylelint, test 25/25, type-check; AC1–AC5 all met). Three review layers run inline (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

- [x] [Review][Patch] `createServerApiClient` fail-fast guard misses whitespace-only `API_URL` [packages/next-shared/src/client/create-server-api-client.ts:10] — guard is `apiUrl === undefined || apiUrl === ''`; `API_URL="   "` passes it, becomes the `baseUrl`, and requests fail at dispatch with an opaque fetch error instead of the intended clear "API_URL is not set" message. FIXED 2026-06-11: read `process.env.API_URL?.trim()` so whitespace-only collapses to `''` and hits the clear throw; added regression test `throws when API_URL is whitespace only`.
