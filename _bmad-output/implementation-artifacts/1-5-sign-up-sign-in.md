---
baseline_commit: 7aa6645cb2192870a0e043dca5feaae261a9dfc5
---

# Story 1.5: Sign Up & Sign In

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to create an account and sign in with email + password,
so that my financial data belongs to my identity and nobody else's.

## Acceptance Criteria

> Format: Given/When/Then carried from `epics.md` (Story 1.5), refined with the binding architecture interpretations discovered during context engineering. Each AC is independently verifiable.

**AC1 — better-auth mounted in NestJS (D5).**
**Given** the API, **when** auth is wired, **then** better-auth `1.6.15` runs inside NestJS via `@thallesp/nestjs-better-auth` `2.6.1`; Nest's global body parser is disabled (`NestFactory.create(AppModule, { bodyParser: false })`) and re-enabled for non-auth routes through `AuthModule.forRoot`; email+password is enabled with `requireEmailVerification: false`; **no** OAuth/social providers and **no** verification/recovery flows are configured (FR1).

**AC2 — auth tables in the one migration pipeline.**
**Given** better-auth's required tables (`users`, `sessions`, `accounts`, `verifications`), **when** the schema is generated, **then** they are produced by `@better-auth/cli generate` as Drizzle schema TS into `apps/api/src/database/schemas/` (one file per table, plural names), reconciled to house conventions, and migrated by drizzle-kit like every other table — no parallel schema system (architecture "better-auth schema ownership").

**AC3 — role enum on users (D6, FR21).**
**Given** the users table, **then** it carries a `role` field constrained to `user` | `admin`, defaulting to `user`, declared via better-auth `user.additionalFields` with `input: false` (clients cannot self-assign role), surfaced in the typed session, and backed by a Drizzle `pgEnum` in `schemas/enums.ts` as the single source of truth.

**AC4 — sign-up creates an account and lands signed in (FR1).**
**Given** an unregistered visitor on `/sign-up`, **when** they submit through the `SignUpForm` widget (`packages/widgets`, composing `packages/ui`), **then** the account is created through the same-origin `/api/auth/*` proxy, a session cookie is set, and they land signed in on the dashboard — no email verification, OAuth, or recovery.

**AC5 — sign-in establishes a per-app session (FR2).**
**Given** a registered user on `/sign-in`, **when** they authenticate via the `SignInForm` widget, **then** the better-auth session cookie (`better-auth.session_token`) is scoped to the app origin (per-app session), the shell user menu shows their name, and sign-out from the user menu ends the session and returns them to `/sign-in`.

**AC6 — concurrent sessions (FR2).**
**Given** the same account signed in from two browsers, **when** both sessions are active, **then** both remain valid concurrently (better-auth's session table supports this natively — assert, don't implement).

**AC7 — protected routes: web redirect + API 401 (FR21).**
**Given** an unauthenticated request, **when** it hits a protected page, **then** middleware redirects to `/sign-in`; **when** it hits a protected API endpoint, **then** the guard returns `401` with the standard error envelope (`{ statusCode, code: "UNAUTHORIZED", message }`). The auth guard and a `@Roles()` decorator exist in the API shared layer; repositories scope every query by the authenticated `userId`.

**AC8 — `GET /api/v1/users/me` proves the auth boundary end-to-end.**
**Given** the auth guard and a minimal `users` module, **then** `GET /api/v1/users/me` returns the authenticated user's own `{ id, email, name, role }` via the generated client (NFR6) and `401` when no/invalid session is presented. This is the seam the user menu's name reads from and the resource the cross-user scoping test asserts against. (Profile update + settings page are Story 1.6 — do not build them here.)

**AC9 — differentiated rate limiting (carried hardening item).**
**Given** the auth endpoints, **when** request rates spike, **then** better-auth's built-in `rateLimit` applies stricter limits on auth paths (e.g. `/sign-in/email`, `/sign-up/email`) than the global default.

**AC10 — tests ship with the feature (NFR1, D10).**
**Given** Testcontainers integration tests against real Postgres, **when** the suite runs, **then** it asserts: sign-up, sign-in, session validation (`get-session`), `401` on the protected route without a session, `200` with a session returning the correct user, two concurrent sessions both valid, and cross-user scoping (user A's session never returns user B's data via `/users/me`). Guard + `@Roles()` decorator carry unit specs.

**AC11 — i18n both locales + parity green (FR19/FR20).**
**Given** every user-facing string in the auth surface, **then** it exists in **both** `en` and `uk` namespace files in the same commit and `pnpm i18n:parity` passes.

**AC12 — visual QA (mandatory, lesson from 1.4/1.8).**
**Given** the new auth widgets and pages, **then** Storybook screenshots of `SignInForm` and `SignUpForm` are captured in **both** themes including the error/pending states, compared against the `example/track-my-life` auth-form reference, with the evidence (images or precise per-state observations) recorded in the Dev Agent Record. Green gates without an actual look at rendered output is not acceptance.

## Tasks / Subtasks

> Suggested order: backend auth foundation (T1–T6) → contract regen (T7) → frontend widgets + pages (T8–T11) → wiring/session (T12) → tests (T13) → i18n + visual QA + gates (T14–T16). Backend and the `packages/widgets` scaffold can proceed in parallel.

- [x] **T1 — Install auth dependencies, exact versions (AC1).** (NFR2: exact versions, no `^`/`~`.)
  - [x] `apps/api`: add `better-auth@1.6.15`, `@thallesp/nestjs-better-auth@2.6.1`. Verify the `2.6.1` tarball's `peerDependencies` accept NestJS 11 at install; if not, halt and surface it.
  - [x] `apps/api` dev: add `@better-auth/cli` (pin the version that ships with `better-auth@1.6.15`).
  - [x] `packages/widgets` (new package): `better-auth@1.6.15`, `react-hook-form@7.78.0`, `zod@4.4.3`, `@hookform/resolvers` (pin newest stable — verify on npm at install, per the "new deps: newest stable" rule), `next-intl@4.13.0` (peer), `clsx`/`react` peers consistent with `packages/ui`.
  - [x] Confirm `pnpm i` resolves and `Turborepo 2.9` build graph still green.

- [x] **T2 — Define the `role` enum + reconcile better-auth schema (AC2, AC3).**
  - [x] Create `apps/api/src/database/schemas/enums.ts` with `export const roleEnum = pgEnum('role', ['user', 'admin'])` (single source of truth; derive the shared TS union from it).
  - [x] Author `apps/api/src/auth/auth.ts` exporting the `betterAuth({...})` instance (see Dev Notes "better-auth instance"): `emailAndPassword.enabled = true`, `requireEmailVerification: false`, `autoSignIn: true`, `minPasswordLength: 8`; `user.additionalFields.role = { type: ['user','admin'], required: false, defaultValue: 'user', input: false }`; plural model names (`users`/`sessions`/`accounts`/`verifications`); `advanced.database.generateId` returning UUIDv7 (honor D4 while keeping better-auth's `text` id column); Drizzle adapter `provider: 'pg'`.
  - [x] Run `npx @better-auth/cli generate --config src/auth/auth.ts --output src/database/schemas/<generated>` then **split** the output into one file per table (`users.ts`, `sessions.ts`, `accounts.ts`, `verifications.ts`) per house convention, and wire the `role` column to `roleEnum`. Update `schemas/index.ts` barrel (note: barrel files are forbidden generally, but the Drizzle schema `index.ts` is the established pattern — match how existing schema dirs are referenced by `drizzle.config.ts`).

- [x] **T3 — Generate + run migration (AC2).**
  - [x] `pnpm --filter @supertool/api db:generate` → produces SQL migration under `src/database/migrations/`. Do **not** use better-auth's own `migrate` (Kysely-only) — drizzle-kit owns migrations.
  - [x] Apply with `db:migrate` against a local Postgres; verify the four tables + `role` column + indexes exist.

- [x] **T4 — Mount better-auth in Nest (AC1).**
  - [x] `apps/api/src/main.ts`: change to `NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false })` (keep existing logger/pipes/shutdown). Verify the global `/api/v1` prefix is unaffected for domain routes.
  - [x] `apps/api/src/app/app.module.ts`: import `AuthModule.forRoot({ auth, bodyParser: { json: { limit: '2mb' }, urlencoded: { extended: true, limit: '2mb' } } })`. Decide guard posture: **disable** the module's global auth guard (`disableGlobalAuthGuard: true`) and protect explicitly per-controller (cleaner with the existing health endpoint staying public) — see Dev Notes.
  - [x] Verify auth routes mount at `/api/auth/*` (sibling to `/api/v1/*` — the module auto-excludes its basePath from the global prefix). **Empirically confirm** by hitting `/api/auth/get-session`; if double-prefixed, fall back to `basePath: '/api/v1/auth'` aligned on both client and server (Dev Notes "basePath conflict").

- [x] **T5 — Auth guard + `@Roles()` decorator in the shared layer (AC7).**
  - [x] Add `apps/api/src/shared/guards/` (auth guard wrapping/using the module's `AuthGuard` or `@thallesp` `AuthGuard`) and `apps/api/src/shared/decorators/roles.decorator.ts` (`@Roles('admin')` reading roles metadata; a roles guard enforces). v1 ships no admin feature — the decorator + guard exist and are unit-tested only.
  - [x] Ensure `401` flows through the existing `GlobalExceptionFilter` to `{ statusCode: 401, code: 'UNAUTHORIZED', message }` (the filter already maps 401→`ErrorCode.Unauthorized`).

- [x] **T6 — Minimal `users` module with `GET /me` (AC8).**
  - [x] Create `apps/api/src/modules/users/` following the `health` module layering exactly: `users.module.ts`, `users.controller.ts`, `users.service.ts`, `users.repository.ts`, `dtos/user-response.dto.ts`. Explicit `@Inject(ClassName)` on every constructor param (never `import type` an injectable).
  - [x] `GET /api/v1/users/me`: protected by the auth guard; reads the authenticated user id from the better-auth session (`@Session()` / `req.session`); repository `findByIdScoped(userId)` is the **only** DB-touching layer and scopes by the session user id. DTO returns `{ id, email, name, role }`, Swagger-decorated (`@ApiTags('users')`, `@ApiOkResponse`, `operationId` → `usersMe`). Do **not** add update/settings (Story 1.6).

- [x] **T7 — Regenerate the API client + drift gate (NFR6, D8).**
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`) → generate client into `packages/shared/src/generated/` → **commit** the regenerated client. Expect a new `UsersApiService.usersMe()`. better-auth routes are NOT Nest controllers, so they do NOT appear in the generated client — auth calls use the better-auth client (Dev Notes "divergence from reference").
  - [x] Confirm CI drift gate passes (regenerate produces no diff).

- [x] **T8 — Scaffold `packages/widgets` (AC4, AC5).**
  - [x] Create `packages/widgets` (`@supertool/widgets`) mirroring `packages/ui` package.json shape (private, exact versions, `type-check`/`lint`/`test` scripts, react peer deps). Respect dependency direction: widgets may depend on `@supertool/ui`, `better-auth`, `react-hook-form`, `zod`, `next-intl`. Widgets must **not** import from any `apps/*`, from `next-shared`, or from `shell`.
  - [x] Add `packages/widgets` to `transpilePackages` in `apps/money-tracker/next.config.ts`.

- [x] **T9 — better-auth browser client in widgets (AC4, AC5).**
  - [x] `packages/widgets/src/auth/auth-client.ts`: `createAuthClient({ basePath: '/api/auth' })` from `better-auth/react`; export the typed `authClient` and `useSession`/`signOut` as needed. Same-origin relative basePath → the Next `/api/*` rewrite proxies it to the API.

- [x] **T10 — `SignInForm` + `SignUpForm` widgets (AC4, AC5).** Mirror `example/track-my-life` `AuthForm` (adapted: `@supertool` scope, PascalCase files, `translate` not `t`, better-auth client instead of generated `authApiService`).
  - [x] `packages/widgets/src/components/sign-in-form/SignInForm.tsx` and `.../sign-up-form/SignUpForm.tsx` (+ co-located `.module.scss`, `.test.tsx`). `'use client'`. Compose `Button`, `Input`, and the `Field` family (`FieldSet`/`FieldGroup`/`Field`/`FieldLabel`/`FieldTitle`/`FieldContent`/`FieldDescription`/`FieldError`) from `@supertool/ui`.
  - [x] react-hook-form + `zodResolver`; zod schema with error **keys** (not English): `email: z.email('emailInvalid')`, `password: z.string('passwordRequired').min(8, 'passwordMinLength')`. SignUp adds a `name` field (`z.string().min(1,'nameRequired')`) — required by better-auth `signUp.email` and feeds the user-menu name (see Dev Notes "divergence: name field").
  - [x] On submit: call `authClient.signUp.email({ name, email, password })` / `authClient.signIn.email({ email, password })`; pending state via `useTransition`/button `disabled`; map better-auth error codes to i18n message keys via `FieldError`; on success invoke an `onSuccess` prop (the page passes the dashboard redirect).
  - [x] i18n via `useTranslations` against a documented namespace (`authShared` for labels/errors; `signInPage`/`signUpPage` for page copy) — strings resolved by the consuming app's message files (T14).
  - [x] Add Storybook stories for both widgets in `apps/storybook/src/stories/` (CSF3, `tags: ['autodocs']`, `layout: 'centered'`, interactive `useState` wrapper) — required for T16 visual QA.

- [x] **T11 — Sign-in / sign-up pages (AC4, AC5).**
  - [x] `apps/money-tracker/src/app/[locale]/sign-in/page.tsx` and `.../sign-up/page.tsx` — async RSC, `setRequestLocale`, `getTranslations`. Compose `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` from `@supertool/ui` framing the widget, with a `NavigationLink` cross-link (sign-in ↔ sign-up). Pass `onSuccess`/redirect to dashboard. Do **not** add OAuth provider buttons (no OAuth in v1 — diverges from the reference's `OAuthProviderButtons`).
  - [x] Register both routes' i18n namespaces.

- [x] **T12 — Middleware redirect + session into the shell user menu (AC5, AC7).**
  - [x] Add `apps/money-tracker/src/middleware.ts` composing the existing next-intl middleware (currently `proxy.ts`) with an auth gate: redirect unauthenticated requests for protected routes to `/sign-in`, and keep `/sign-in`, `/sign-up` public. Use better-auth's cheap edge-safe cookie-presence check (`getSessionCookie(request)`) — NOT a DB call; the API guard is the real security boundary. Reconcile with the existing `proxy.ts`/`config.matcher` (consolidate to one middleware file).
  - [x] App-side `fetchSession`/`fetchProfile` (RSC, `cache()`): read the current user via the generated `UsersApiService.usersMe()` through the cookie-forwarding server client (`createServerApiClient`). Pass the name into `AppShell`; enable the previously-disabled `UserMenu`; wire sign-out (`authClient.signOut()` then redirect to `/sign-in`).

- [x] **T13 — Tests (AC10, NFR1, D10).**
  - [x] Establish Testcontainers Postgres harness under `apps/api/test/integration/` (first use in the repo — see Dev Notes "Testcontainers"). Add `testcontainers@12.0.1` dev dep.
  - [x] `auth.integration.spec.ts`: boot the app against a Testcontainers Postgres (run migrations first); assert sign-up creates a user, sign-in sets the session cookie, `get-session` validates, `GET /api/v1/users/me` returns `401` without cookie and the correct user with cookie, two concurrent sessions are both valid, and **user A's cookie never returns user B's `/me` data**.
  - [x] Unit specs for the auth guard and `@Roles()`/roles guard. Co-located `users.service.spec.ts`/`users.controller.spec.ts` mirroring the health module specs (`Test.createTestingModule`, `vi.fn()` doubles).
  - [x] Widget tests (`SignInForm.test.tsx`/`SignUpForm.test.tsx`, @testing-library/react): render, validation-error display, submit calls the auth client (mock `authClient`), pending disables submit. (No jest-dom matchers in this repo — assert via DOM/role queries.)

- [x] **T14 — i18n both locales (AC11, FR19/FR20).**
  - [x] Add namespace files in `apps/money-tracker/messages/{en,uk}/`: `auth-shared.json` (labels + `errors.*` keys matching the zod keys + better-auth error codes), `sign-in-page.json`, `sign-up-page.json`. Register in `i18n-namespace.ts` + `localization-messages-file-name-by-namespace.ts`. Real Ukrainian, not transliterated.
  - [x] `pnpm i18n:parity` green.

- [x] **T15 — Rate limiting (AC9).**
  - [x] In `auth.ts`, set `rateLimit: { enabled: true, window, max, customRules: { '/sign-in/email': {...stricter}, '/sign-up/email': {...stricter} } }`. Paths are relative to the auth basePath. `storage: 'memory'` is fine for the single-instance local runtime.

- [x] **T16 — Visual QA + final gates (AC12, NFR2).**
  - [x] Run Storybook; screenshot `SignInForm`/`SignUpForm` in light + dark including error and pending states; compare against the reference `AuthForm`; record evidence in the Dev Agent Record. Save images under `_bmad-output/implementation-artifacts/visual-qa/1-5/`.
  - [x] Run the full gate set with cache bypass where verifying (`turbo ... --force`): `pnpm lint`, `pnpm fmt:check`, `pnpm type-check`, `pnpm stylelint`, `pnpm test`, `pnpm i18n:parity`, client-drift, `pnpm build`.

## Dev Notes

### Reference patterns (study before implementing — `example/track-my-life`, reference-only, never copy/import per ED1)

- **Auth form pattern:** `example/track-my-life/apps/money-tracker/src/app/[locale]/(auth-layout)/components/auth-form/AuthForm.tsx` — react-hook-form + `zodResolver`, `useActionState` + `useTransition`, `Field`/`FieldGroup`/`FieldLabel`/`FieldContent`/`FieldDescription`/`FieldError` composition, `translate` (`useTranslations('authShared')` + `'authShared.errors'`), button `disabled={isPending}`.
- **Zod schema with error-key messages:** `.../constants/auth-form-schema.ts` — `z.email('emailInvalid')`, `z.string('passwordRequired').min(MIN, 'passwordMinLength')`; keys resolve via `tAuthErrors(error.message)`.
- **Sign-in page (RSC composition):** `.../sign-in/page.content.tsx` — async RSC, `getTranslations`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `UnderlineLink` + `NavigationLink` cross-link.
- **i18n messages:** `.../messages/{en,uk}/auth-shared.json` and `sign-in-page.json` — nested camelCase, `errors.*` block, real Ukrainian.
- **Supertool molecules already in place (1-11 merged, commit `7aa6645`):** `packages/ui/src/components/molecules/field/Field.tsx` (exports `FieldSet, FieldLegend, FieldGroup, Field, FieldContent, FieldLabel, FieldTitle, FieldDescription, FieldSeparator, FieldError, FormField`) and `.../molecules/card/Card.tsx` (exports `Card, CardAction, CardHeader, CardTitle, CardDescription, CardContent, CardFooter`). Atoms available: `button, input, label, checkbox, alert, separator, typography, underline-link` (`packages/ui/src/components/atoms/`). **Compose these — do not rebuild them.**
- **Backend module layering:** mirror `apps/api/src/modules/health/` exactly — `*.module.ts`/`*.controller.ts`/`*.service.ts`/`*.repository.ts`, explicit `@Inject(ClassName)`, DTOs decorated with `@ApiProperty`, controller `@ApiTags`/`@ApiOkResponse`.
- **DB module:** `apps/api/src/database/database.module.ts` provides `DRIZZLE`/`PG_POOL` symbols (`database.constants.ts`); repositories inject `@Inject(DRIZZLE) db: Database`.

### ⚠️ Deliberate divergences from the reference (the reference backend uses JWT/Passport, NOT better-auth — these are the seams to get right)

1. **Frontend auth calls the better-auth client, NOT the generated SDK.** The reference's `sign-in/action.ts` calls a generated `authApiService.login()` because its backend exposed Nest auth controllers in OpenAPI. Supertool's better-auth routes are mounted by `@thallesp/nestjs-better-auth` and are **not** Swagger-described Nest controllers — they will not appear in `packages/shared/src/generated/`. Auth (sign-up/in/out/session) therefore goes through `createAuthClient` (`better-auth/react`). This is **not** an NFR6 violation — NFR6 forbids hand-written `fetch` to domain `/api/v1/*` routes; the better-auth client is the sanctioned auth mechanism (D5). Domain reads (`/users/me`) still go through the generated client.
2. **No OAuth.** Skip the reference's `OAuthProviderButtons` and the "Or continue with" separator — FR1 is email+password only in v1.
3. **No server-action for auth submit.** The reference used a `'use server'` action; here the widget calls the browser better-auth client directly (it sets the cookie via the proxy). Server actions are still the pattern for **domain** mutations (Epic 2+).
4. **SignUp collects `name`.** better-auth `signUp.email` requires `name`; the epic AC says "email + password". Add a `name` field to `SignUpForm` (minimal, sensible) so the user menu shows a real name (AC5). Flagged as an open question below.
5. **`users` table is better-auth's `user` table.** Identity lives in better-auth's table (renamed plural `users`), not a hand-rolled one. `role` is an `additionalField`. Domain tables (Epic 2) reference `users.id`.

### Architecture compliance (binding — `architecture.md`; the seven agent MUSTs are merge-blocking)

- **D5 same-origin proxy sessions:** Next rewrites `/api/*` → API (already in `next.config.ts`); better-auth mounted via `@thallesp/nestjs-better-auth`; per-app-origin cookie ⇒ per-app session; multiple concurrent sessions native.
- **D6 roles:** `role` enum, role guard + `@Roles()` in shared layer, repositories scope by authenticated user. No admin features in v1.
- **D4 PKs:** UUIDv7 app-side for all entities — honor it for the better-auth tables via `advanced.database.generateId` returning a UUIDv7 string (keep better-auth's `text` id column type; the value is UUIDv7).
- **D7 REST + layering:** `/api/v1/users/me`; controller → service → repository (repository is the only DB-touching layer); errors via the existing `GlobalExceptionFilter` envelope; camelCase JSON; `operationId` `usersMe`.
- **D9 frontend data flow:** RSC reads via `fetch*` (plain async, `cache()`) using `rsc`/server client; the auth widgets are the client-component exception (better-auth client); `setRequestLocale` in every RSC; `useTranslations` named `translate`.
- **The seven MUSTs:** money-as-strings (n/a here), generated-client-only for domain API, repositories-only DB access, both-locales-same-commit, tests-same-story, exact versions / no eslint-prettier, never import from `example/`.

### better-auth instance (the load-bearing config — `apps/api/src/auth/auth.ts`)

```ts
betterAuth({
  basePath: '/api/auth',                 // auto-excluded from the /api/v1 global prefix by @thallesp
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true, requireEmailVerification: false, autoSignIn: true, minPasswordLength: 8 },
  user: {
    modelName: 'users',
    additionalFields: { role: { type: ['user', 'admin'], required: false, defaultValue: 'user', input: false } },
  },
  session: { modelName: 'sessions' }, account: { modelName: 'accounts' }, verification: { modelName: 'verifications' },
  advanced: { database: { generateId: () => /* UUIDv7 */ } },
  rateLimit: { enabled: true, window: 10, max: 100, customRules: {
    '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 5 } } },
  // NO socialProviders, NO emailVerification handler
})
```

- **Schema generation:** `npx @better-auth/cli generate --config src/auth/auth.ts --output <file>` emits **Drizzle TS** (not SQL) for the Drizzle adapter. Then split into one-file-per-table and run drizzle-kit `generate`+`migrate`. Do NOT use better-auth's `migrate` (Kysely-only).
- **The email/password hash lives on `accounts.password`**, not on `users` — keep that in mind for the data model and tests.
- **Session:** opaque DB-backed token in cookie `better-auth.session_token`; server validates via `auth.api.getSession({ headers })` (the guard does this and populates `req.session`/`@Session()`).

### basePath conflict (verify empirically — docs are ambiguous on the exact prefix)

@thallesp/nestjs-better-auth documents that better-auth's basePath is auto-excluded from the Nest global prefix, so with `setGlobalPrefix('api/v1')` and basePath `/api/auth`, auth serves at `/api/auth/*` (sibling to `/api/v1/*`). **Confirm by hitting `/api/auth/get-session` after wiring.** If it ends up double-prefixed, set server `basePath: '/api/v1/auth'` AND client `createAuthClient({ basePath: '/api/v1/auth' })` — server and client basePath must match. The Next `/api/*` rewrite forwards either path. Recommended: keep default `/api/auth` and confirm.

### Guard posture decision

Set `AuthModule.forRoot({ ..., disableGlobalAuthGuard: true })` and protect explicitly (`@UseGuards(AuthGuard)` on `UsersController`). Rationale: the existing `GET /api/v1/health` must stay public; a global-guard-on posture would force `@AllowAnonymous()` sprinkling and risks accidentally gating the OpenAPI/health surface. Explicit per-controller protection is clearer for a codebase with one protected route so far. (`@thallesp` exposes `AuthGuard`, `@Session()`, `@AllowAnonymous()`, `@OptionalAuth()`, `Roles()`; there is **no** `@Public()` — the public decorator is `@AllowAnonymous()`.)

### Library / framework versions (exact — NFR2)

| Package | Version | Where |
|---|---|---|
| better-auth | 1.6.15 | apps/api, packages/widgets |
| @thallesp/nestjs-better-auth | 2.6.1 | apps/api (verify NestJS 11 peer at install) |
| @better-auth/cli | matches better-auth 1.6.15 | apps/api dev |
| react-hook-form | 7.78.0 | packages/widgets |
| zod | 4.4.3 | packages/widgets (matches repo) |
| @hookform/resolvers | newest stable (verify on npm) | packages/widgets |
| next-intl | 4.13.0 | packages/widgets peer |
| testcontainers | 12.0.1 | apps/api dev |
| drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 | already installed |

### File structure (kebab-case dirs; PascalCase component files + co-located scss/test/stories)

```
apps/api/src/
  auth/auth.ts                                  # betterAuth instance (exported for CLI + module)
  app/{main.ts(bodyParser:false), app.module.ts(AuthModule.forRoot)}
  database/schemas/{enums.ts, users.ts, sessions.ts, accounts.ts, verifications.ts, index.ts}
  database/migrations/<generated>
  modules/users/{users.module.ts, users.controller.ts, users.service.ts, users.repository.ts, dtos/user-response.dto.ts, *.spec.ts}
  shared/guards/<auth/roles guards>, shared/decorators/roles.decorator.ts
  test/integration/auth.integration.spec.ts
packages/widgets/                                # NEW @supertool/widgets
  package.json
  src/auth/auth-client.ts
  src/components/sign-in-form/{SignInForm.tsx,.module.scss,.test.tsx}
  src/components/sign-up-form/{SignUpForm.tsx,.module.scss,.test.tsx}
  src/constants/auth-form-schema.ts
apps/money-tracker/src/
  middleware.ts                                  # consolidate proxy.ts + auth gate
  app/[locale]/sign-in/page.tsx, sign-up/page.tsx
  actions/fetch-session.ts (or fetch-profile.ts)
  i18n/constants/{i18n-namespace.ts, localization-messages-file-name-by-namespace.ts}  # +auth namespaces
  messages/{en,uk}/{auth-shared.json, sign-in-page.json, sign-up-page.json}
apps/storybook/src/stories/{SignInForm.stories.tsx, SignUpForm.stories.tsx}
```

### Testing standards (D10, NFR1)

- **API:** Vitest with SWC decorators (`apps/api/vitest.config.ts` already configured). Unit specs co-located `*.spec.ts` (mirror `health.*.spec.ts` — `Test.createTestingModule`, `vi.fn()`; service specs via direct instantiation). `as unknown as X` allowed only for test doubles.
- **Testcontainers (first use in repo):** add `testcontainers@12.0.1`; spin a Postgres 16 container in `apps/api/test/integration/auth.integration.spec.ts`, run drizzle migrations against it before tests, point the app/better-auth at the container URL. This harness is reused by Epic 2 seed/money tests — make it reusable.
- **Frontend/packages:** `*.test.tsx` co-located, @testing-library/react `16.3.2`. NO jest-dom matchers in this repo — use role/DOM queries. Mock `authClient`. `packages/ui` lint gotchas also apply to widgets: oxlint `no-magic-numbers` on call args, hook-use-state naming, ARIA `combobox`/label requirements, CSF `meta` needs `args` for required props.

### Project Structure Notes — variances & rationale

- **better-auth tables diverge from D4/naming on purpose.** better-auth owns its table shape: `text` id column (we feed UUIDv7 values via `generateId` to honor D4's *value* contract), better-auth's column set (`emailVerified`, hash on `accounts.password`). We map model names to **plural** (`users`/`sessions`/`accounts`/`verifications`) to match the architecture structure tree and the house "plural tables" rule, and bind `role` to a `pgEnum` in `enums.ts`. Snake_case DB columns + camelCase TS mapping fall out of the Drizzle generator naturally. **Do not "fix" the auth tables to a fully hand-rolled UUIDv7 schema — that breaks better-auth.**
- **`GET /users/me` seam vs Story 1.6.** 1.5 builds the minimal `users` module (read-only `me`) to make the guard + scoping testable end-to-end and to source the user-menu name via the generated client. 1.6 extends this module with profile read/update + `locale`/`defaultCurrency` columns + the settings page. Keep 1.5's `me` minimal to avoid overlap.
- **`packages/widgets` is created here** (architecture pre-decision; first occupant = auth widgets). It composes `@supertool/ui` and the better-auth client; it must not import from apps, `next-shared`, or `shell`.
- **Middleware consolidation.** `proxy.ts` currently holds the next-intl middleware. Next.js uses a single `middleware.ts` entry — fold the locale routing and the auth gate into one `middleware.ts` (or have `proxy.ts` export a composed handler that `middleware.ts` re-exports) and align `config.matcher`. Verify locale routing still works after the change.
- **Cross-user data scoping in full** materializes in Epic 2 when domain (transaction) tables exist; 1.5 asserts scoping against `/users/me` (user A's session never returns user B). The guard/decorator/repository-scoping *infrastructure* is fully built and tested here.

### References

- [Source: epics.md#Story 1.5: Sign Up & Sign In] — ACs, FR1/FR2/FR21 mapping
- [Source: architecture.md#Authentication & Security (D5, D6)] · [#Data Architecture (D1, D4)] · [#API & Communication Patterns (D7, D8)] · [#Frontend Architecture (D9)] · [#Testing Strategy (D10)] · [#Enforcement Guidelines (seven MUSTs)] · [#Validation Issues Addressed (proxy-vs-server-side, better-auth schema ownership)]
- [Source: architecture.md#Complete Project Directory Structure] — `apps/api/src/auth`, `packages/widgets`, schema/module placement
- [Source: .claude/rules/{react,typescript,i18n,storybook,javascript}.md] — FC<Props>, no-enums/`ObjectValuesUnion`, no-`as`, namespace i18n + parity, CSF3 stories, no-comments/no-barrels, function prefixes
- [Source: better-auth 1.6.x docs (context7 `/better-auth/better-auth/v1.6.11`)] — drizzleAdapter, additionalFields, rateLimit, emailAndPassword, getSession, cookie name
- [Source: @thallesp/nestjs-better-auth (context7 `/thallesp/nestjs-better-auth`)] — `AuthModule.forRoot`, `bodyParser:false`, global-prefix exclusion, `AuthGuard`/`@Session()`/`@AllowAnonymous()`/`Roles()`
- Prior stories: 1-2 (API/DB baseline — `health` module, `DRIZZLE` token, exception filter, `@supertool/shared` error/status codes), 1-3 (generated client pipeline, drift gate, `byTags` `*ApiService`), 1-4/1-8/1-9/1-10/1-11 (design system; molecules `field`/`card` now available)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — BMad Dev Story workflow.

### Debug Log References

- **better-auth ↔ cli version conflict (load-bearing).** `@better-auth/cli@1.4.21` (newest published) is incompatible with `better-auth@1.6.15`: the CLI bundles `better-call@1.1.8`, which lacks the `kAPIErrorHeaderSymbol` export that `@better-auth/core@1.6.15` imports — so `@better-auth/cli generate` crashes AND requiring `better-auth` at runtime failed while the CLI was installed (the old `better-call` poisoned peer resolution). Resolution: removed `@better-auth/cli` entirely; generated the Drizzle schema from better-auth's own `getAuthTables(options)` introspection (the authoritative source), hand-authored the four table files to match exactly, and validated empirically via the Testcontainers integration suite + a manual sign-up/sign-in/users-me run.
- **Empirical auth boundary check (T4/T6).** Booted the API and confirmed: `/api/auth/get-session` mounts at `/api/auth/*` (NOT double-prefixed — `/api/v1/auth` → 404); sign-up returns a UUIDv7 id (`019ec1e6-146d-746d-…`, version-7 nibble) proving D4 `generateId`; `/api/v1/users/me` → 200 with cookie, 401 (standard envelope) without.
- **Rate limiting (AC9).** Verified the 6th `/sign-in/email` within 60s returns `429` + `x-retry-after: 60` (keyed on client IP via `X-Forwarded-For`, which the Next proxy forwards).
- **Testcontainers Ryuk** was disabled (`TESTCONTAINERS_RYUK_DISABLED=true`) due to a local Docker reaper port-bind timeout; containers are explicitly stopped in `afterAll`.
- **Visual QA evidence:** `_bmad-output/implementation-artifacts/visual-qa/1-5/` — 10 screenshots (SignInForm + SignUpForm × light/dark × default/error, plus pending) captured via a throwaway headless-chromium harness against `storybook-static` and reviewed directly. Error states render red borders + per-field `FieldError` messages; pending disables the submit button; dark-mode theme tokens (incl. error colors) adapt correctly.

### Completion Notes List

All 12 ACs satisfied. Key deliberate divergences from the story spec (each justified, all gates green):

1. **`@better-auth/cli` omitted** (see Debug Log) — schema produced via `getAuthTables` introspection instead. Outcome identical and validated against real better-auth at runtime.
2. **`uuidv7@1.2.1` added** to `apps/api` — first app-side PK in the repo; D4/T2 mandate UUIDv7 via `advanced.database.generateId`. `apps/api/src/database/generate-id.ts`.
3. **No `schemas/index.ts` barrel** — oxlint `no-barrel-file` forbids `export *`; `drizzle.config.ts` reads the schema *directory*, and `auth.ts` composes the adapter schema object from explicit table imports.
4. **Middleware lives in `proxy.ts`** (Next 16's renamed middleware entry, already the repo convention) rather than a new `middleware.ts`; the next-intl handler and the `getSessionCookie` auth gate are consolidated there.
5. **`better-auth@1.6.15` added to `apps/money-tracker`** — `proxy.ts` needs `getSessionCookie` from `better-auth/cookies`.
6. **`packages/widgets/tsconfig.json` sets `declaration:false`** — the better-auth client's inferred type is non-portable (TS2883); widgets is source-only (no emit).
7. **Sign-out wired via app-side `AppShellSection` client wrapper** — `packages/shell` must not depend on `packages/widgets`, so the shell `UserMenu` is presentational (`userName` + `onSignOut`) and the app injects `authClient.signOut()`.
8. **`SignUpForm` collects `name`** (story-flagged divergence #4) — required by better-auth `signUp.email`; feeds the user-menu name.
9. **Rate limit gated behind `AUTH_RATE_LIMIT_DISABLED`** for the integration suite only (>5 sign-ins/60s would otherwise 429); production stays rate-limited (verified).
10. **`authDatabasePool` exported from `auth.ts`** for clean integration-test teardown. Closed on app shutdown by the `AuthDatabaseLifecycle` provider (`apps/api/src/auth/auth-database.lifecycle.ts`, `OnApplicationShutdown`) registered in `app.module.ts` — mirrors `DatabaseModule`'s pool teardown (added in code-review patch P1; the better-auth pool is constructed at module load, before Nest DI, so it cannot live inside `DatabaseModule`).
11. **Infra config:** `pnpm-workspace.yaml allowBuilds` set to `false` for new unused optional native deps (`@prisma/client`, `better-sqlite3`, `cpu-features`, `protobufjs`, `ssh2`); `.oxfmtrc.json` ignores drizzle-generated `migrations/**`.

Frontend auth (sign-up/in/out/session) goes through the better-auth client (sanctioned, D5); domain read `/users/me` goes through the generated SDK (`UsersApiService.usersMe`, NFR6). Both locales shipped, `i18n:parity` green. Tests: API 35 (incl. 7 Testcontainers integration + guard/roles/users unit specs), widgets 9, shell 12, ui 77, next-shared 10 — all passing.

### File List

**apps/api**
- `package.json` (M) — better-auth 1.6.15, @thallesp/nestjs-better-auth 2.6.1, uuidv7 1.2.1, testcontainers 12.0.1 (dev)
- `src/main.ts` (M) — `bodyParser: false`
- `src/app/app.module.ts` (M) — `AuthModule.forRoot` + `UsersModule`
- `src/auth/auth.ts` (A) — betterAuth instance, exported `authDatabasePool`
- `src/database/generate-id.ts` (A) — UUIDv7 generator
- `src/database/schemas/{enums,users,sessions,accounts,verifications}.ts` (A)
- `src/database/migrations/0000_thin_sebastian_shaw.sql` + `meta/*` (A) — auth tables migration
- `src/modules/users/{users.module,users.controller,users.service,users.repository}.ts` + `dtos/user-response.dto.ts` (A)
- `src/modules/users/{users.service.spec,users.controller.spec}.ts` (A)
- `src/shared/guards/{auth.guard,roles.guard}.ts` + `{auth.guard.spec,roles.guard.spec}.ts` (A)
- `src/shared/decorators/roles.decorator.ts` (A)
- `test/integration/auth.integration.spec.ts` (A)
- `vitest.config.ts` (M) — include `test/**/*.spec.ts`; `tsconfig.json` (M) — include `test/**/*.ts`

**packages/widgets** (A — new `@supertool/widgets`)
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.oxlintrc.json`, `src/global.d.ts`
- `src/auth/auth-client.ts`, `src/auth/get-auth-error-message-key.ts`
- `src/constants/auth-form-schema.ts`
- `src/components/sign-in-form/{SignInForm.tsx,.module.scss,.test.tsx}`
- `src/components/sign-up-form/{SignUpForm.tsx,.module.scss,.test.tsx}`

**packages/shared**
- `src/generated/{index,sdk.gen,types.gen}.ts` (M) — regenerated client (`UsersApiService.usersMe`, `Role`, `UserResponseDto`)

**packages/shell**
- `src/components/app-shell/AppShell.tsx` (M) — `userName`/`onSignOut` props
- `src/components/user-menu/UserMenu.tsx` (M) — dropdown w/ name + sign-out
- `src/components/user-menu/UserMenu.test.tsx` (A)

**apps/money-tracker**
- `package.json` (M), `next.config.ts` (M) — widgets transpile, better-auth dep
- `src/proxy.ts` (M) — auth gate + locale routing
- `src/actions/fetch-profile.ts` (A)
- `src/app/[locale]/layout.tsx` (M), `AppShellSection.tsx` (A)
- `src/app/[locale]/sign-in/{page.tsx,page.module.scss,SignInFormSection.tsx}` (A)
- `src/app/[locale]/sign-up/{page.tsx,page.module.scss,SignUpFormSection.tsx}` (A)
- `src/i18n/constants/{i18n-namespace,localization-messages-file-name-by-namespace}.ts` (M)
- `messages/{en,uk}/{auth-shared,sign-in-page,sign-up-page}.json` (A), `messages/{en,uk}/navigation.json` (M — signOut key)

**apps/storybook**
- `package.json` (M), `src/stories/{SignInForm,SignUpForm}.stories.tsx` (A)

**root**
- `pnpm-workspace.yaml` (M), `.oxfmtrc.json` (M), `pnpm-lock.yaml` (M)
- `_bmad-output/implementation-artifacts/visual-qa/1-5/*.png` (A) — 10 visual-QA screenshots

### Change Log

- 2026-06-14 — Story 1.5 implemented: better-auth mounted in NestJS (D5), auth tables + `role` pgEnum via one drizzle migration, auth guard + `@Roles()`/roles guard, `GET /api/v1/users/me`, regenerated client, new `@supertool/widgets` with `SignInForm`/`SignUpForm`, sign-in/sign-up pages, middleware redirect + shell user-menu session/sign-out, Testcontainers integration tests, both-locale i18n, differentiated rate limiting, and visual QA. Status → review.
- 2026-06-14 — Pre-review refactor (reviewer feedback round 1): (1) extracted route paths to `apps/money-tracker/src/constants/routes.ts` (`ROUTES`) — no hardcoded `'/sign-in'`/`'/'` literals; (2) namespaces referenced via constants, nested keys composed via template literals; (3) auth env vars moved into the validated `env.schema.ts`; (4) `role` field list/default derived from `roleEnum.enumValues` + new `DEFAULT_ROLE`. Updated `.claude/rules/{i18n,react,typescript,nestjs-apis}.md`.
- 2026-06-14 — Code review (bmad-code-review, 3 adversarial layers + gates all green): 1 decision-needed, 3 patch, 2 deferred, 10 dismissed. See Review Findings below.
- 2026-06-14 — Pre-review refactor (reviewer feedback round 2): (1) **Removed ALL env fallback constants** (`DEV_AUTH_SECRET`, `LOCAL_AUTH_BASE_URL`, `LOCAL_AUTH_TRUSTED_ORIGINS`, `LOCAL_COMPOSE_DATABASE_URL`) — `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` are now **required** in `env.schema.ts` (zod throws on any missing var; removed the production-only guard). Env is provided via `apps/api/.env` (gitignored; `dev`/`start`/`build`-emit load it via `--env-file-if-exists`) and a new `apps/api/vitest.setup.ts` for specs; documented in `.env.example`. (2) **Eliminated the duplicated namespace constants** — `I18N_NAMESPACE` now lives once in `packages/shared/src/constants/i18n-namespace.ts` (single source per the shared-constants rule) and is imported by app pages, the localization mapping, the shell components, and the widget forms; deleted `apps/money-tracker/src/i18n/constants/i18n-namespace.ts`, `packages/widgets/src/constants/i18n-namespace.ts`, `packages/shell/src/constants/i18n-namespace.ts`. (3) Added `viteFinal` to `apps/storybook/.storybook/main.ts` so rollup's commonjs plugin transforms the linked `@supertool/shared` CJS dist (first shared value-import in Storybook's graph). New files: `apps/api/vitest.setup.ts`, `apps/api/.env` (gitignored), `packages/shared/src/constants/i18n-namespace.ts`. All gates re-run green (type-check 9/9, lint, fmt, stylelint, tests: api 35 / shell 12 / widgets 9 / ui 77 / next-shared 10, i18n parity, build 4/4 incl. Storybook, client-drift). Visual QA unchanged (namespace value identical).

## Review Findings

> Code review 2026-06-14 (bmad-code-review). Quality gates all green at review time (type-check 9/9, oxlint 0/0, stylelint, oxfmt 264 files, tests: api 35 / widgets 9 / shell 12). Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 12 ACs and all 7 hard rules verified satisfied; visual-evidence gate (AC12) cleared. Findings below are the residue after de-duplication and triage (10 further raised items dismissed as false positives, by-design, or spec-sanctioned).

- [x] [Review][Patch] Stale/revoked-but-present session cookie can lock a user out of `/sign-in` — `proxy.ts` treats any present `better-auth.session_token` as authenticated and redirects public-page visitors to `/`. If the cookie is present but the server session is revoked/expired, the user is bounced `/sign-in` → `/`; the unauth→sign-in redirect then won't fire (cookie present), so they cannot reach the login page to re-authenticate. Resolution (chosen 2026-06-14): keep the login pages always reachable — drop/guard the redirect-authenticated-users-away-from-public-pages branch. [apps/money-tracker/src/proxy.ts]
- [x] [Review][Patch] better-auth `authDatabasePool` is never closed on production shutdown — created at module load, closed only in the integration test `afterAll`. `main.ts` `enableShutdownHooks()` covers DI providers only; this module-level pool leaks on graceful shutdown. Completion Note #10's "also closes better-auth's pool on shutdown" holds for the test path only. [apps/api/src/auth/auth.ts:24]
- [x] [Review][Patch] Sign-out swallows a failed `authClient.signOut()` — no catch; on rejection the `router.replace`/`router.refresh` never run and no error is surfaced. [apps/money-tracker/src/app/[locale]/AppShellSection.tsx]
- [x] [Review][Patch] Whitespace-only `name` passes sign-up validation — `z.string('nameRequired').min(1, 'nameRequired')` counts whitespace; `'   '` validates and is sent to better-auth, yielding a blank user-menu name. Add `.trim()`. [packages/widgets/src/constants/auth-form-schema.ts:13]
- [x] [Review][Defer] Double-submit window before `isPending` flips — rapid double-click can enter two transitions before the button disables, firing two auth requests (sign-up race could surface a spurious `userExists`). [packages/widgets/src/components/sign-up-form/SignUpForm.tsx] — deferred, low likelihood
- [x] [Review][Defer] `AUTH_RATE_LIMIT_DISABLED` env flag has no production guard — a stray `=true` silently disables auth brute-force protection. [apps/api/src/auth/auth.ts:60] — deferred, low risk for the local-only single-instance runtime

**Resolution (2026-06-14):** All 4 patches applied. New file `apps/api/src/auth/auth-database.lifecycle.ts` (`AuthDatabaseLifecycle`, registered in `app.module.ts`) closes `authDatabasePool` on shutdown; the integration test's now-redundant manual `closeAuthDatabase` teardown was removed (it double-`end()`-ed the pool against the new shutdown hook). All gates re-run green: type-check 9/9, oxlint 8/8, oxfmt 265 files, tests api 35 / widgets 9 / shell 12 / ui 77 / next-shared 10. The 2 deferred items are logged in `deferred-work.md`.
