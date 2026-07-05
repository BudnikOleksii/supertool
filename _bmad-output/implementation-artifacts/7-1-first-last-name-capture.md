---
baseline_commit: e9436e4892e0818930d80bc4a11020aa85f743a2
---

# Story 7.1: First & Last Name Capture

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want my first and last name collected at sign-up and editable in settings,
so that the app addresses me properly instead of leaving names uncollected (RP-F10 — names).

## Context & Why This Story

This is the FIRST story of Epic 7 ("Account & Landing") — the final planned parity epic. It builds entirely on the Epic 1 auth/profile foundation (better-auth, the users module, profile settings) and does not depend on any Epic 6 transactions surface.

Today supertool captures a **single `name`**: the `SignUpForm` widget collects one "name" field, `authClient.signUp.email` passes it to better-auth, better-auth persists it to `users.name` (its core, `notNull` identity column), and the shell user menu + settings form both read/write that one field. The reference (`example/track-my-life`) instead models **`firstName` + `lastName`** (both nullable text columns, no `name` column — it runs a custom passwordHash auth stack, not better-auth) and collects them **only in settings, not at sign-up** (`§5` defect: "reference does not collect profile names at signup"). This story moves supertool to first/last name **and exceeds the reference by collecting them at sign-up too** (epics.md 7.1 AC 2).

The binding constraint that shapes every decision here: **supertool is on better-auth (RP-D2), so `users.name` is a `notNull` core field owned by the auth host and cannot be dropped.** The reference's schema (nullable first/last, no name) is therefore a pattern to adapt, not mirror 1:1. supertool keeps `name` as a **derived display value composed from first + last**, adds `firstName`/`lastName` as new columns, captures them at sign-up via better-auth **additional fields** (the same mechanism `role` already uses), and edits them in settings — with `name` kept in sync so the user menu and every existing display keep working.

**Retro Action #1 folded in here (D-F):** the Epic 6 retro carried one targeted backend action — *fix the flaky Testcontainers `57P01`/`ProcessInterrupts` teardown race at the first Epic 7 backend touch*. It named 7-2/7-3 as candidates, but **7-1 is the actual first Epic 7 backend touch** (it adds a migration + users-module DTO/service/repo changes + integration coverage), so this story is the correct, earliest place to retire the CI re-run tax for the rest of Epic 7. The fix is a small, contained change to the shared integration teardown that drains all pg pools before stopping the container.

**Evidence base:** epics.md Story 7.1 (5 BDD AC blocks: schema+migration, sign-up capture, settings edit, tests/i18n/screenshots) + Epic 7 charter (RP-D2 better-auth stays the auth host; protect §6 clean-auth-form strength — no duplicate helper text); `reference-parity-gap-backlog.md` §5 (names-not-collected defect) / §6 (clean auth forms to protect); the reference user schema + settings profile form (first/last pattern); the Epic 6 retro Action #1 (teardown race).

## Recommended Approach (binding direction)

### Data model — `firstName`/`lastName` columns + composed `name` (D-A, D-B, D-D)

- Add to `apps/api/src/database/schemas/users.ts`: `firstName: text('first_name')` and `lastName: text('last_name')` — **both nullable** (mirror the reference schema; keeps the migration additive and imposes nothing on pre-existing rows). Column names snake_case per repo DB convention (reference uses camelCase DB names; supertool does not). Keep the existing `name: text('name').notNull()` — better-auth owns it (RP-D2) and it stays the display value.
- `pnpm --filter @supertool/api db:generate` produces migration `0007`; **hand-append a one-time backfill** to the generated SQL (same technique as `0005`'s `onboarding_completed` backfill) that splits the existing single `name` into the new columns:
  ```sql
  ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
  ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
  UPDATE "users" SET
    "first_name" = split_part("name", ' ', 1),
    "last_name"  = CASE
      WHEN position(' ' in "name") > 0
      THEN trim(substring("name" from position(' ' in "name") + 1))
      ELSE NULL
    END;
  ```
  (first token → `first_name`; everything after the first space → `last_name`, `NULL` when the name is single-token — e.g. the seeded `Operator`). Verify the exact drizzle-emitted `ALTER` header and keep the two statement-breakpoints; only the `UPDATE` is hand-added.
- **`name` is a derived value, not independently editable.** It is composed from first+last via a single shared helper (below) at every write path. Do NOT add a way to set `name` directly — one writer only.

### `name` composition/split — single shared helper (D-E)

- New `packages/shared/src/utils/full-name.ts` (framework-pure, sits below every consumer): `composeFullName(firstName, lastName)` → `[firstName, lastName].filter(Boolean).join(' ').trim()`; `splitFullName(name)` → `{ firstName, lastName }` (first token / remainder-or-`null`). Co-located `full-name.test.ts`. Named exports, no barrel.
- Consumers: the `SignUpForm` widget (compose `name` for the better-auth call), the API `UsersService` (recompose `name` on settings update), and `seedOperator` (split `SEED_OPERATOR_NAME`). The migration backfill uses the **equivalent SQL** because migrations cannot call JS — this one intentional duplication is documented (it is a one-time DDL, not runtime logic).
- Reuse existing validation constants — `NAME_MIN_LENGTH` (1) / `NAME_MAX_LENGTH` (100) from `@supertool/shared/constants/validation` bound each of first/last; do NOT add new per-field length constants (memory `shared-constants-no-duplication`).

### better-auth — first/last as additional fields (D-A, D-J)

- In `apps/api/src/auth/auth.ts` extend `user.additionalFields` (currently only `role`) with:
  - `firstName: { type: 'string', required: true, input: true }`
  - `lastName: { type: 'string', required: false, input: true }`
  This lets `authClient.signUp.email({ firstName, lastName, name, email, password })` persist first/last in the **same** sign-up call (mirrors how `role` is already an additional field, but `input: true` so the client supplies them). better-auth remains the sole writer of the identity row (RP-D2) — supertool never bypasses it for sign-up.
- Because `firstName` is a **required** additional field, EVERY `signUpEmail` call must include it. Update the two server-side sign-up callers:
  - `seedOperator` (`auth.api.signUpEmail`): derive `{ firstName, lastName }` from `SEED_OPERATOR_NAME` via `splitFullName`, pass them plus the composed `name` (`SEED_OPERATOR_NAME` unchanged as `name`). No new env var.
  - The integration test helper `apps/api/test/helpers/auth-client.ts` (`buildTestUser` + the sign-up `postJson` body) — add `firstName` (and `lastName`) to `TestUser` so every integration sign-up keeps succeeding. **Skipping this breaks every integration spec that registers a user.**

### API surface — extend the users module (D-B, D-G)

- `UserResponseDto`: add `@ApiPropertyOptional({ nullable: true })` `firstName!: string | null` and `lastName!: string | null` (additive — mirrors the existing nullable `defaultCurrency` decoration). Keep `name` (display). No `enumName` — plain strings.
- `UpdateUserDto`: add `@IsOptional() @IsString() @MinLength(NAME_MIN_LENGTH) @MaxLength(NAME_MAX_LENGTH) firstName?` and `@IsOptional() @IsString() @MaxLength(NAME_MAX_LENGTH) lastName?`; **remove the `name` field** — `name` is now derived, not directly settable (single-writer rule, D-B). This is an intentional request-DTO change (the response keeps `name`; only the write path drops it); flag it at review.
- `users.repository.ts`: add `firstName`/`lastName` to `USER_RESPONSE_COLUMNS` (so reads return them) and add `firstName`/`lastName`/`name` branches to `buildUserUpdateValues` (the repo maps fields explicitly — it is NOT a blind pass-through; the `name` branch already exists and stays). Skipping the `USER_RESPONSE_COLUMNS` entries → the settings form and user menu read `undefined`; skipping the update branches → edits never persist.
- `users.service.ts` — **name recomposition lives here** (business logic, D7): on `update`, when `firstName` or `lastName` is present in the DTO, read the current profile (`repository.findByIdScoped`), merge the patch over stored values (`effectiveFirst = dto.firstName ?? current.firstName`, same for last), compose `name = composeFullName(effectiveFirst, effectiveLast)`, and pass `{ ...dto, name }` to `repository.updateScoped`. This keeps `name` authoritative even on a partial PATCH and keeps the repository a pure setter. (The settings form always submits both fields, so the merge is normally a no-op read, but it makes the contract robust and correct.)
- Controller unchanged in shape (`GET`/`PATCH /users/me`); regenerate the client after the DTO changes.

### Frontend — sign-up widget (D-H) + settings form (D-B)

- **`SignUpForm` widget** (`packages/widgets/src/components/sign-up-form/SignUpForm.tsx` + `constants/auth-form-schema.ts`): replace the single `name` field with `firstName` (required) + `lastName` (optional) Inputs, placed before email. `autoComplete="given-name"` / `"family-name"`. **Placeholder only, no `FieldDescription`** — protect the §6 clean-auth-form strength (placeholder ≠ description; no duplicated helper text). `signUpFormSchema`: replace `name` with `firstName: z.string('firstNameRequired').trim().min(NAME_MIN_LENGTH, 'firstNameRequired')` and `lastName: z.string().trim().optional()`. On submit, call `authClient.signUp.email({ firstName: values.firstName, ...(values.lastName && { lastName: values.lastName }), name: composeFullName(values.firstName, values.lastName), email, password })`. Keep the `getAuthErrorMessageKey` error handling and `onSuccess` contract untouched (`SignUpFormSection` still routes to onboarding).
- **Settings `ProfileForm`** (`apps/money-tracker/.../settings/components/profile-form/ProfileForm.tsx` + `constants/profile-form-schema.ts` + `hooks/use-profile-form.ts`): replace the single `name` field with `firstName` (required) + `lastName` (optional) Inputs (order: firstName, lastName, locale, currency — reference order). `profileFormSchema`: `name` → `firstName` (required min 1) + `lastName` (optional trim). `getDefaultValues`: `firstName: profile.firstName ?? ''`, `lastName: profile.lastName ?? ''`. Reference counterpart to mirror: `example/track-my-life/.../settings/components/profile-form/{ProfileForm.tsx,hooks/use-profile-form.ts,constants/profile-form-schema.ts}` (note it makes firstName optional too and sends fields conditionally; supertool requires firstName — D-C).
- **`update-profile` action** (`apps/money-tracker/src/actions/update-profile.ts`): send `firstName` + `lastName` (conditionally include lastName) instead of `name`; keep `locale`/`defaultCurrency`, the `profileFormSchema.safeParse`, and `revalidateProfileViews` (`revalidatePath(ROUTES.settings)` + `revalidatePath(ROUTES.home, 'layout')` — the layout revalidate is what refreshes the shell user-menu name).
- **Shell / layout — no change (D-I).** `layout.tsx` already derives `userName = profile.onboardingCompleted ? profile.name : undefined` and `UserMenu` renders `userName`. Because `name` stays composed and in sync, the user menu shows the full name automatically. `packages/shell` and `packages/next-shared` need **no source changes**.

### i18n (D-C, AC 8)

- `authShared` namespace (`apps/money-tracker/messages/{en,uk}/auth-shared.json`): replace `name`/`namePlaceholder` with `firstName`/`firstNamePlaceholder`/`lastName`/`lastNamePlaceholder`; add `errors.firstNameRequired`. Real Ukrainian (`Ім'я` / `Прізвище` — see the reference `settings-page.json` uk values).
- `settingsPage` namespace (`.../messages/{en,uk}/settings-page.json`): replace `nameLabel`/`namePlaceholder` with `firstNameLabel`/`firstNamePlaceholder`/`lastNameLabel`/`lastNamePlaceholder`; add `errors.firstNameRequired` (keep `errors.nameRequired` only if still referenced — it is not, so remove). ICU only, both locales same commit, `pnpm i18n:parity` green. No new namespace file (both namespaces already exist).

### CI hardening — Testcontainers teardown race (D-F, retro Action #1)

- Root-cause and retire the flaky `57P01`/`ProcessInterrupts` teardown race: the container is `stop()`ped while a pg pool still holds live connections. There are **two** pools — the DI-managed `PG_POOL` (drained by `DatabaseModule.onApplicationShutdown`) and the module-singleton `authDatabasePool` in `auth.ts` (drained by `AuthDatabaseLifecycle.onApplicationShutdown`). `app.close()` fires both shutdown hooks, but the current ad-hoc `afterAll` (`await app?.close(); await container?.stop();`) is duplicated across ~11 integration specs and offers no single place to guarantee the pools are fully drained before the container dies.
- Add a shared `stopIntegrationApp({ app, container })` helper to `apps/api/test/helpers/integration-app.ts` that: (1) `await app.close()` (drains both pools via the shutdown hooks); (2) defensively `await` the `authDatabasePool` drain if the singleton can outlive the hook (idempotent — the lifecycle already guards a double-`end()`); (3) `await container.stop()`. Replace the ad-hoc teardown in **every** `apps/api/test/integration/*.spec.ts` `afterAll` with this helper. Acceptance: the full integration suite runs green locally without any `57P01`/`ProcessInterrupts` teardown error, deterministically (not "green on retry"). Keep the change confined to test helpers/specs — no production teardown behavior change.

## Acceptance Criteria

1. **Schema + migration + regenerated client (NFR6/D8).** Given the users schema, when migration `0007` runs, then nullable `first_name` and `last_name` columns exist and a one-time backfill splits every existing `name` into them safely (first token → `first_name`; remainder or `NULL` → `last_name`; the seeded `Operator` becomes `first_name = 'Operator'`, `last_name = NULL`), `users.name` (better-auth core, `notNull`) is unchanged, `UserResponseDto` exposes `firstName`/`lastName` (nullable) and `UpdateUserDto` accepts them (and no longer accepts `name`), the OpenAPI spec + generated client are regenerated and committed, and the drift gate is green.
2. **Sign-up collects first/last (RP-F10).** Given the sign-up form, when a new user registers, then first name (required) and last name (optional) are collected via react-hook-form + zod alongside email + password with **no duplicated helper text** (placeholder only, no description — §6), and on submit `authClient.signUp.email` persists them through better-auth additional fields **and** persists a composed `name` (`firstName [lastName]`) — one sign-up call, no separate profile write. better-auth stays the auth host (RP-D2); a hand-written fetch to auth or users is a defect (NFR6).
3. **Settings edits first/last and keeps display in sync.** Given the settings page, when I edit my first/last name and save, then the server action (`update-profile`) sends `firstName`/`lastName` via `usersUpdateMe` (generated client only), the API recomposes `name` from the new values, `revalidatePath` refreshes settings and the shell layout without a full reload, and the user menu shows my composed name — closing the "names uncollected / empty user menu" defect direction (§5). First name is required; last name is optional.
4. **Name stays authoritative and single-writer (D-B).** Given any profile update, then `name` is only ever derived from `firstName`+`lastName` (never set directly by any client), so display name and the stored first/last never diverge; a partial PATCH that includes only one of the two still yields a correct full `name` (service merges the patch over stored values before composing).
5. **CI teardown race retired (Epic 6 retro Action #1, D-F).** Given the API integration suite, when it runs, then teardown drains all pg pools before stopping the Testcontainers Postgres via a shared `stopIntegrationApp` helper used by every integration `afterAll`, and the suite completes with no `57P01`/`ProcessInterrupts` error deterministically (no reliance on a CI re-run).
6. **Backend tests (NFR1).** Testcontainers integration coverage asserts: sign-up with first/last persists all three (`firstName`, `lastName`, composed `name`) and they round-trip via `usersMe`; a settings `usersUpdateMe { firstName, lastName }` persists and recomposes `name`, round-tripping on read; the update is user-scoped (user A's edit never touches user B); the seeded operator has the expected first/last (split) and completed flag. Unit/controller specs cover the DTO field pass-through, the service name-recomposition (incl. the partial-PATCH merge), the repository whitelist/update branches, and the `composeFullName`/`splitFullName` helper (compose empty/one/two tokens; split single-token → `lastName: null`).
7. **Frontend tests (NFR1).** Component tests cover: `SignUpForm` (first/last fields render, first-name required validation, last-name optional, submit calls `authClient.signUp.email` with `firstName`/`lastName`/composed `name`); `ProfileForm` (first/last fields, defaults from `profile.firstName`/`lastName`, required first-name validation, submit → action); `update-profile` action (sends `firstName`/`lastName`, success + error pass-through + revalidate targets, mocked generated client per `create-transaction.test.ts`). All repo gates green (`TURBO_FORCE=true` where turbo may replay stale logs).
8. **i18n parity (FR19/FR20).** `auth-shared.json` and `settings-page.json` gain first/last labels + placeholders + `firstNameRequired` error in **both** `en` and `uk` in the same commit (real Ukrainian, ICU only), obsolete `name`/`nameRequired` keys removed, `pnpm i18n:parity` green.
9. **Mobile-usable (NFR8 — per-story mobile-QA check).** Given a 390px viewport, when I run sign-up (first/last/email/password) and the settings profile form, then every field is reachable and legible with no horizontal overflow (`documentElement.scrollWidth === innerWidth`) and inputs are touch-operable.
10. **Visual QA evidence — committed (epic-4 retro D1 standing pattern).** `_bmad-output/implementation-artifacts/visual-qa/7-1-first-last-name-capture/` contains **light + dark × 390px + desktop** captures of: the sign-up form with first/last fields (idle + first-name validation-error state) and the settings profile form with first/last fields (idle + populated), named `<scenario>--<viewport>--<theme>.png`, compared against the reference settings profile form (reference has first/last in settings; sign-up first/last is new ground — note it), with observations in the Dev Agent Record. Captured on `:3000` (pre-QA environment checklist honored) with the DB baseline restored afterward.

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — study/adapt, never copy/import): `example/tracker-backend-api/src/database/schemas/users.ts` (`firstName`/`lastName` nullable, NO `name` — custom auth stack; supertool keeps `name` because better-auth owns it), `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/components/profile-form/{ProfileForm.tsx,hooks/use-profile-form.ts,constants/profile-form-schema.ts}` (first/last settings form — both optional there; supertool requires first, D-C), `example/track-my-life/apps/money-tracker/messages/{en,uk}/settings-page.json` (first/last label + placeholder keys, incl. uk `Ім'я`/`Прізвище`). **No reference counterpart for sign-up name capture** — the reference collects names only in settings; sign-up first/last is new ground.
  - [x] Read in full the files this story touches: `apps/api/src/database/schemas/users.ts`, `apps/api/src/auth/auth.ts`, `apps/api/src/auth/auth-database.lifecycle.ts`, `apps/api/src/database/database.module.ts`, `apps/api/src/database/seeds/seed-operator.ts`, `apps/api/src/modules/users/{users.controller.ts,users.service.ts,users.repository.ts,dtos/*.ts}` (+ specs), `apps/api/src/database/migrations/0005_melted_princess_powerful.sql` (backfill precedent), `apps/api/test/helpers/{postgres-container.ts,integration-app.ts,auth-client.ts}`, `apps/api/test/integration/users-profile.integration.spec.ts` + every other `*.integration.spec.ts` `afterAll`, `packages/widgets/src/components/sign-up-form/SignUpForm.tsx`, `packages/widgets/src/constants/auth-form-schema.ts`, `packages/widgets/src/auth/auth-client.ts`, `apps/money-tracker/src/app/[locale]/{layout.tsx,AppShellSection.tsx,sign-up/SignUpFormSection.tsx}`, `packages/shell/src/components/user-menu/UserMenu.tsx`, `apps/money-tracker/src/app/[locale]/settings/**`, `apps/money-tracker/src/actions/update-profile.ts`, `packages/shared/src/constants/validation.ts`, the `authShared`/`settingsPage` message files.
- [x] **Task 2 — Shared full-name helper** (AC: 1, 2, 3, 4, 6)
  - [x] New `packages/shared/src/utils/full-name.ts`: `composeFullName(firstName?: string | null, lastName?: string | null): string` and `splitFullName(name: string): { firstName: string; lastName: string | null }`. Named exports, no barrel, no comments. Co-located `full-name.test.ts` (compose: two tokens, first-only, empty; split: two tokens, single token → `lastName: null`, leading/trailing spaces).
- [x] **Task 3 — API schema + migration + backfill** (AC: 1)
  - [x] `users.ts`: add `firstName: text('first_name')` + `lastName: text('last_name')` (nullable); keep `name` notNull. `pnpm --filter @supertool/api db:generate` → migration `0007`; hand-append the backfill `UPDATE` per Recommended Approach (split existing `name`). Keep statement-breakpoints.
  - [x] Verify `migrate-on-boot.integration.spec.ts` still applies cleanly on a fresh container.
- [x] **Task 4 — better-auth additional fields + seed + test helper** (AC: 1, 2, 5, 6)
  - [x] `auth.ts`: add `firstName` (required, input:true) + `lastName` (required:false, input:true) to `user.additionalFields`.
  - [x] `seed-operator.ts`: pass `firstName`/`lastName` (from `splitFullName(env.SEED_OPERATOR_NAME)`) + `name` to `auth.api.signUpEmail`. Confirm `seed.integration.spec.ts` stays green (extend it to assert operator first/last if it reads the user).
  - [x] `apps/api/test/helpers/auth-client.ts`: add `firstName` (+ `lastName`) to `TestUser` and the sign-up body so every integration sign-up satisfies the required additional field.
- [x] **Task 5 — API users module DTO/service/repo** (AC: 1, 3, 4, 6)
  - [x] `UserResponseDto`: `@ApiPropertyOptional({ nullable: true })` `firstName!: string | null` + `lastName!: string | null`. `UpdateUserDto`: add optional `firstName`/`lastName` (`@IsString` + `@MinLength(NAME_MIN_LENGTH)` on first, `@MaxLength(NAME_MAX_LENGTH)` on both); **remove `name`**.
  - [x] `users.repository.ts`: add `firstName`/`lastName` to `USER_RESPONSE_COLUMNS`; add `firstName`/`lastName`/`name` branches to `buildUserUpdateValues`.
  - [x] `users.service.ts`: on `update`, when first/last present, read current profile, merge, `composeFullName`, and pass `name` through to the repository (partial-PATCH-safe, D-G/D7). Keep single-purpose helpers under the ≤10-statement lint limit.
  - [x] Extend `users.service.spec.ts` / `users.controller.spec.ts` / `users.repository.spec.ts` for the new fields + name recomposition + partial-merge.
  - [x] Regenerate: `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`; verify `UserResponseDto`/`UpdateUserDto` changes in `openapi.json`; commit the generated diff; drift gate green.
- [x] **Task 6 — Testcontainers coverage** (AC: 5, 6)
  - [x] `users-profile.integration.spec.ts`: assert first/last persist + `name` recomposes via `usersUpdateMe` and round-trip on `usersMe`; user-scoping for the name edit; a fresh sign-up carries the passed first/last + composed name.
  - [x] **Retro Action #1 (D-F):** add `stopIntegrationApp({ app, container })` to `integration-app.ts`; replace the ad-hoc `afterAll` teardown in every `apps/api/test/integration/*.spec.ts` with it; verify the suite runs green with no `57P01`/`ProcessInterrupts` teardown error deterministically.
- [x] **Task 7 — Sign-up widget** (AC: 2, 7, 8, 9)
  - [x] `packages/widgets/src/constants/auth-form-schema.ts`: `signUpFormSchema` → `firstName` (required) + `lastName` (optional), drop `name`.
  - [x] `SignUpForm.tsx`: first/last Inputs (placeholder only, no `FieldDescription`; `autoComplete` given-name/family-name) before email; submit composes `name` via `composeFullName` and passes `firstName`/`lastName`/`name`. Update `SignUpForm.test.tsx`.
- [x] **Task 8 — Settings form + action** (AC: 3, 4, 7, 8, 9)
  - [x] `settings/constants/profile-form-schema.ts`: `name` → `firstName` (required) + `lastName` (optional). `hooks/use-profile-form.ts`: defaults from `profile.firstName`/`lastName`. `ProfileForm.tsx`: first/last Inputs (reference-ordered). Update `ProfileForm.test.tsx`.
  - [x] `actions/update-profile.ts`: send `firstName` + (conditional) `lastName` instead of `name`; keep locale/currency + revalidate targets. Update its test.
- [x] **Task 9 — i18n** (AC: 8)
  - [x] `messages/{en,uk}/auth-shared.json` + `settings-page.json`: replace name keys with first/last labels + placeholders + `firstNameRequired`; remove obsolete keys; real Ukrainian; `pnpm i18n:parity` green.
- [x] **Task 10 — Gates, visual QA, record** (AC: 5, 6, 7, 9, 10)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where needed; drift gate green after regen.
  - [x] Pre-QA environment checklist: `:3000` next-server cwd is THIS checkout (`lsof`); run migrations so the backfill applies; seed baseline clean (memory `seed-idempotent-truncate-before-reseed`).
  - [x] Capture the AC-10 matrix (sign-up first/last idle + first-name error; settings first/last idle + populated) light+dark × 390+desktop, `<scenario>--<viewport>--<theme>.png`; verify `scrollWidth === innerWidth` at 390px; compare settings against the reference profile form. **Restore DB baseline** afterward.
  - [x] Update Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Decisions made at story creation (autonomous run — operator review points)

| # | Decision | Rationale |
|---|---|---|
| D-A | **`firstName`/`lastName` as better-auth `additionalFields`** (firstName required+input, lastName optional+input); **keep `name`** (better-auth core `notNull`) as a composed display value | better-auth is the auth host (RP-D2) and owns the identity row — sign-up must persist names *through* it, not via a bypass write. `additionalFields` with `input:true` captures first/last in the same sign-up call (mirrors the existing `role` additional field). `name` cannot be dropped (better-auth `notNull`), so it becomes the derived display value the shell/user-menu already read. |
| D-B | **`name` is derived only** — removed from `UpdateUserDto` and the settings form; composed from first+last at every write (single writer) | Two independent writers to `name` (direct + composed) would let display drift from the stored first/last. The response DTO keeps `name` (display); only the *write* path drops it. update-profile is the sole caller and is updated in the same story, so the request-DTO change is contained. **Flag at review** (intentional non-additive request change). |
| D-C | **firstName required (min 1), lastName optional** — **diverges from the reference's both-optional** (operator-confirm at review) | epics.md 7.1 says "first and last name are collected"; the app's purpose ("address me properly") and better-auth's non-empty `name` both need a first name. Last name stays optional to handle single-name people and to make the backfill of single-token names (`Operator`) trivial — which matches the reference on lastName. The only divergence is requiring firstName (reference makes it optional). |
| D-D | **Columns nullable** (`first_name`/`last_name` `text`, no `notNull`), backfill splits existing `name` | Mirrors the reference schema and keeps the migration additive — pre-existing rows are populated by the split, never forced. Single-token names get `first_name` only (`last_name = NULL`). Same class of additive migration+backfill as 5-3's `onboarding_completed` (0005). |
| D-E | **One shared `composeFullName`/`splitFullName` helper** in `@supertool/shared`, reused by widget + API service + seed; migration backfill uses equivalent SQL | Single source of truth for the name↔parts rule (memory `shared-constants-no-duplication`). The SQL duplication in the migration is unavoidable (migrations can't call JS) and is one-time DDL, not runtime logic — documented. |
| D-F | **Fold the Epic 6 retro Action #1 CI teardown fix into 7-1** (drain all pg pools before `container.stop()` via a shared `stopIntegrationApp` helper) | 7-1 is the *actual* first Epic 7 backend touch (migration + users module + integration coverage) — earlier than the 7-2/7-3 the retro named, so per the retro's own "first backend touch" principle this is the correct, earliest place. The fix is small, test-only, and stabilizes CI for 7-2..7-5 (retires the re-run tax; Challenge #2 / Insight #5). Fits cleanly — added as a task, not deferred. |
| D-G | **Name recomposition in the service** (read-merge-compose), not the repository or the client | Business logic (D7): the service merges the PATCH over stored first/last and composes `name`, so a partial update never drops a part. Sign-up composition is unavoidably client-side (better-auth `signUpEmail` requires `name` at the client call) — both use the same shared helper so they agree. |
| D-H | **SignUpForm widget gains first/last fields; placeholder only, no `FieldDescription`** | AC names the widget; sign-up capture is the story's headline (exceeds the reference, which collects names only in settings). No description text protects the §6 clean-auth-form strength (no duplicated helper text). Widget source change is in scope. |
| D-I | **No `packages/shell` / layout logic change** — user menu keeps rendering `profile.name` (now composed) | Because `name` stays in sync, the existing `layout.tsx` → `AppShellSection` → `UserMenu` chain shows the full name with zero shell churn. Minimizes package changes. |
| D-J | **Update the integration test auth helper** (`buildTestUser` + sign-up body) to pass `firstName` | firstName is a *required* better-auth additional field, so every `signUpEmail` (incl. the ~11 integration specs via `registerAndSignIn`) must supply it or sign-up 400s. This is a required, not optional, ripple. |

### Better-auth interaction — the crux (read before Task 4)

- better-auth's core user model has `name` (`notNull`), `email`, `emailVerified`, `image`. supertool already extends it with `role` via `user.additionalFields` (`input:false`). First/last are added the same way but `input:true` so the sign-up body carries them. better-auth persists additional fields to the mapped `users` table (Drizzle adapter, `modelName:'users'`).
- The Drizzle adapter maps by the schema object passed in `auth.ts` (`{ users, sessions, accounts, verifications }`) — adding the columns to `users.ts` is what makes the adapter able to write `first_name`/`last_name`. The `additionalFields` config is what makes better-auth *accept and route* them from the sign-up body. Both are required.
- `name` remains better-auth's to write at sign-up (client passes the composed value). On the settings path, better-auth is not involved — the app's `PATCH /users/me` writes `first_name`/`last_name`/`name` directly through the users repository (already the established profile-update path, e.g. locale/currency/onboardingCompleted). This is consistent with how supertool already updates better-auth-owned rows for non-credential fields.
- **Client typing signal (likely TS blocker):** `packages/widgets/src/auth/auth-client.ts` is a bare `createAuthClient({ basePath })` with no additional-field inference, so `authClient.signUp.email({ ... })` will reject the extra `firstName`/`lastName` props at compile time (excess-property / unknown-field). Add better-auth's `inferAdditionalFields<typeof auth>()` client plugin (`import { inferAdditionalFields } from 'better-auth/client/plugins'`) so the client is typed for the new fields — but `auth-client.ts` (in `packages/widgets`) must NOT import the server `auth` instance (which pulls in NestJS/`pg`/env into the browser bundle). Type it against the field shape only (`inferAdditionalFields({ user: { firstName: { type: 'string' }, lastName: { type: 'string' } } })` form) or an exported auth *type*, never the runtime instance. Verify the browser bundle stays clean and the two fields type-check on `signUp.email`.

### Current state of the system this story builds on (preserve, don't break)

- **users schema:** `name notNull`, plus `role`/`locale`/`defaultCurrency`/`onboardingCompleted`. `defaultCurrency` is the nullable-column + `@ApiPropertyOptional({nullable:true})` decoration pattern to mirror for first/last.
- **users module:** `GET`/`PATCH /users/me` (`AuthGuard`, session user id); `UsersRepository` reads via `USER_RESPONSE_COLUMNS` and writes via an explicit `buildUserUpdateValues` field-by-field mapper (the `name` branch exists today); `UsersService` forwards the DTO. `usersMe`/`usersUpdateMe` are the generated ops.
- **auth:** `auth.ts` module singleton (its own `authDatabasePool`, drained by `AuthDatabaseLifecycle` on shutdown); rate limits stricter on `/sign-in|sign-up/email`; `additionalFields.role` (input:false). `seed-operator.ts` creates the operator via `auth.api.signUpEmail` then promotes/ensures currency+onboarding.
- **sign-up FE:** `SignUpForm` widget (RHF+zod, `authClient.signUp.email`, `getAuthErrorMessageKey`) → `SignUpFormSection.handleSuccess` → `router.replace(ROUTES.onboarding)`. Keep that success/redirect contract.
- **settings FE:** `ProfileForm` (RHF+zod, `useProfileForm` + `useActionState`), `update-profile` action (`usersUpdateMe`, revalidates settings + layout). `getDefaultValues` seeds from the profile.
- **shell:** `layout.tsx` → `userName = onboardingCompleted ? profile.name : undefined` → `AppShellSection` → `UserMenu` renders `userName`. No change needed.
- **DB pools / test harness:** `PG_POOL` (DI, `DatabaseModule.onApplicationShutdown`) + `authDatabasePool` (`AuthDatabaseLifecycle`). Integration specs boot a Testcontainers Postgres (`startPostgresContainer` → `runMigrations` → `bootIntegrationApp`) and tear down with an ad-hoc `await app?.close(); await container?.stop();` — this is what D-F centralizes and hardens.
- **validation constants:** `NAME_MIN_LENGTH=1`, `NAME_MAX_LENGTH=100` (`@supertool/shared/constants/validation`) — reuse for first/last, do not duplicate.

### Reference patterns (ED1 — study, adapt, never copy/import)

- `example/tracker-backend-api/src/database/schemas/users.ts` — `firstName`/`lastName` nullable columns (no `name`; custom auth). supertool adapts: snake_case DB names, keeps `name` (better-auth), adds better-auth additional fields.
- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/components/profile-form/{ProfileForm.tsx,hooks/use-profile-form.ts,constants/profile-form-schema.ts}` — first/last settings form shape (both optional there; supertool requires first — D-C; supertool has no route groups).
- `example/track-my-life/apps/money-tracker/messages/{en,uk}/settings-page.json` — first/last label + placeholder key naming, incl. uk `Ім'я`/`Прізвище`.
- **No reference counterpart — new ground:** sign-up first/last capture (reference collects names only in settings); the composed-`name` bridge to better-auth; the migration backfill split.

### Conventions to honor (hard rules + memories)

- **NFR6/D8:** sign-up via `authClient`, settings via `usersUpdateMe` (generated client) — no hand-written fetch; regenerate + commit the client; drift gate green.
- **D7:** controller → service → repository; name recomposition is service business logic; repository is the only DB toucher.
- **NestJS DI:** explicit `@Inject(...)`; never `import type` an injectable (memory `nest-di-explicit-inject`).
- **FR19/FR20:** both locales same commit; ICU; `translate` alias (never `t`); namespace via `I18N_NAMESPACE.*`.
- **React/files:** `FC<Props>`; PascalCase component files + co-located scss/test; kebab-case dirs; `on*`/`handle*`; named exports, no barrels; routes via `ROUTES`; `useRouter`/`redirect` from `@supertool/next-shared`.
- **SCSS:** design tokens only, camelCase classes, mobile-first, no fixed widths overflowing 390px.
- **TS:** no enums (as-const + `ObjectValuesUnion`); no `as` except `as const`; one source of truth (the full-name helper + shared length constants).
- **Tests:** co-located, pnpm scripts only, `TURBO_FORCE=true` for gate verification (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`).
- **Branch:** `TOOLS-7-1/first-last-name-capture` off `main`; conventional commits; PR via `create-pr` (memory `story-work-via-pr`).
- **Money (D1):** not relevant here — do not regress money-string handling; no money math in this story.

### Out of scope (explicit guardrails)

- **No change-password (7-2), no delete-account (7-3), no landing page (7-4), no helmet/compression (7-5).**
- **No new auth provider / OAuth / email verification** (FR1); better-auth stays the host (RP-D2).
- **No `name` column removal** (better-auth `notNull`); no direct `name` editing surface (D-B).
- **No currency/locale behavior change**; single-default-currency model untouched (RP-D1).
- **No `packages/shell` / `packages/next-shared` source changes** (D-I); no `packages/ui` new components; no `proxy.ts` / route-group changes.
- **No production teardown behavior change** — the D-F fix is confined to `apps/api/test/**` helpers/specs.
- **No new env vars** — seed derives first/last from the existing `SEED_OPERATOR_NAME`.

### Project Structure Notes

- Backend stays inside the existing `users` module + `auth`/`database` dirs; the migration follows the `0005` backfill precedent. The shared helper joins `packages/shared/src/utils/` with a co-located test.
- Frontend touches only the sign-up widget (`packages/widgets`) and the money-tracker settings route + `update-profile` action + two message files — no new routes, no new namespaces.
- Test-only: new `stopIntegrationApp` helper in `apps/api/test/helpers/integration-app.ts`, consumed by every integration spec.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1] — story statement + 4 BDD AC blocks (schema/migration+client, sign-up capture, settings edit + user menu, tests/i18n/screenshots) + §5/§6 evidence note
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — charter: RP-D2 better-auth stays the auth host, protect §6 clean-auth-form strength, D1/NFR6/D7/FR19-20/NFR1 binding, per-story mobile-QA
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-F10 (P2 settings completion / collect first-last name), §5 defects (names not collected), §6 strengths to protect
- [Source: _bmad-output/planning-artifacts/architecture.md] — D5-D9 (proxy sessions, REST/envelope, drift gate, RSC/server actions), users/auth module conventions, RP-D1/RP-D2
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md#Action Items] — Action #1 (Testcontainers `57P01`/`ProcessInterrupts` pool-drain teardown fix at the first Epic 7 backend touch); Insight #5 (flake-fixed-by-rerun is unpaid debt)
- [Source: _bmad-output/implementation-artifacts/5-3-onboarding-flow.md] — precedent for extending the user model additively (column + DTO + `USER_RESPONSE_COLUMNS` + explicit `updateScoped` branch + migration backfill), seed ensure-step pattern, visual-QA naming, action test template
- [Source: apps/api/src/database/schemas/users.ts + auth/auth.ts + database/seeds/seed-operator.ts] — schema/auth/seed touch points
- [Source: apps/api/src/modules/users/**] — DTO decoration style, response-column whitelist, explicit update mapper, layering
- [Source: apps/api/test/helpers/{postgres-container.ts,integration-app.ts,auth-client.ts} + test/integration/*.spec.ts] — teardown pattern (D-F) + required-additional-field ripple (D-J)
- [Source: packages/widgets/src/components/sign-up-form/** + src/constants/auth-form-schema.ts + src/auth/auth-client.ts] — sign-up capture touch points
- [Source: apps/money-tracker/src/app/[locale]/settings/** + src/actions/update-profile.ts + app/[locale]/layout.tsx + packages/shell/src/components/user-menu/UserMenu.tsx] — settings form + display chain
- [Source: packages/shared/src/constants/validation.ts + src/utils/] — reused length constants + new full-name helper home
- [Source: example/tracker-backend-api/src/database/schemas/users.ts + example/track-my-life/.../settings/components/profile-form/** + messages/*/settings-page.json] — reference first/last patterns (ED1)
- [Source: .claude/rules/{react.md,i18n.md,styles.md,javascript.md,typescript.md,nestjs-apis.md}] — conventions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]` (autonomous dev-story run).

### Debug Log References

- Gates (all green, `TURBO_FORCE=true` on turbo tasks): `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test` (48 API test files / 413 tests incl. all 11 Testcontainers integration specs, deterministic — no `57P01`/`ProcessInterrupts` teardown error), `pnpm i18n:parity`, `pnpm build`, OpenAPI drift (regenerate → only the expected additive `types.gen.ts` diff, deterministic on re-run).
- Migration 0007 verified end-to-end on the dev DB and on fresh Testcontainers boots (`migrate-on-boot`, `seed`, `users-profile`, `auth` specs). Backfill split both existing single-token names correctly (`Oleksii`→first=`Oleksii`/last=NULL, `Operator`→first=`Operator`/last=NULL).
- Live-app QA on `:3000` (next-server cwd verified in this checkout) against a freshly-restarted API (`:3001`) serving the new DTOs (`/api/docs-json` confirmed `firstName`/`lastName` on both DTOs) with migration 0007 applied.

### Completion Notes List

Implemented all 10 tasks; all 10 ACs satisfied.

- **Shared helper (D-E):** `packages/shared/src/utils/full-name.ts` — `composeFullName`/`splitFullName`, co-located spec. Named the test `full-name.spec.ts` (not `.test.ts` as the story text suggested) because `@supertool/shared` vitest `include` is `src/**/*.spec.ts` and `tsconfig.build.json` excludes `*.spec.ts` from the emitted `dist` — using `.test.ts` would have shipped the test into the package build. `splitFullName` implemented via `split(' ')` + rest-join (no magic-number lint violations).
- **Schema + migration (D-A/D-D):** nullable `first_name`/`last_name` added; `0007_breezy_songbird.sql` generated + hand-appended backfill (two statement-breakpoints preserved).
- **better-auth (D-A/D-J):** `firstName` (required, input:true) + `lastName` (optional, input:true) additional fields; `seedOperator` splits `SEED_OPERATOR_NAME`; `buildTestUser` + `TestUser` carry first/last so every integration sign-up satisfies the required field; the two inline `USER_A`/`USER_B` literals in `auth.integration.spec.ts` also updated.
- **API (D-B/D-G/D7):** `UserResponseDto` gains nullable first/last; `UpdateUserDto` drops `name`, adds first/last. Repository whitelists first/last in `USER_RESPONSE_COLUMNS` and maps `name`/first/last in `buildUserUpdateValues` (refactored to conditional-spread to stay under the 10-statement lint cap; new `UserUpdatePatch` type widens the repo input with the service-supplied `name`). Name recomposition lives in `UsersService.buildUpdatePatch` (read-merge-compose, partial-PATCH-safe, throws NotFound if the current row is missing).
- **Client typing (crux):** `packages/widgets/src/auth/auth-client.ts` uses `inferAdditionalFields({ user: { firstName: { type:'string', required:true }, lastName: { type:'string', required:false } } })` — the field-shape form, NOT a server `auth` import, so the browser bundle stays free of NestJS/pg/env. `required:false` on lastName is essential or the client types lastName as required and the optional-spread call fails to compile.
- **Sign-up widget (D-H):** first/last inputs (placeholder only, no `FieldDescription` — protects the §6 clean-auth-form strength), `given-name`/`family-name` autoComplete, submit composes `name` via `composeFullName`.
- **Settings + action (D-B):** `ProfileForm` first/last inputs (reference order first→last→locale→currency); `update-profile` sends first/(conditional)last; defaults read `profile.firstName ?? ''`.
- **Locale-switcher ripple (decision recorded below):** the user-menu locale switch previously called `updateProfile({ name, locale })` — impossible now that `name` is not writable and the form schema requires `firstName`. Added a focused `update-locale` server action (mirrors `update-default-currency`: `usersUpdateMe { locale }` only, partial-PATCH-safe, revalidates the layout) and pointed `AppShellSection.handleLocaleChange` at it. This avoids re-deriving/corrupting stored first/last from the composed display name and keeps the single-writer contract intact (AC4). New `update-locale.test.ts` added.
- **CI hardening (D-F):** `stopIntegrationApp({ app?, container?, poolList? })` added to `test/helpers/integration-app.ts`; adopted by all 11 integration `afterAll`s. Signature widened from the story's `{ app, container }` to also accept `poolList` because specs carry heterogeneous resources (test-owned `pool`, module `authDatabasePool`, or neither) — app specs drain both DI pools via `app.close()` shutdown hooks; non-app specs pass their pools in `poolList`; all pools are `end()`ed (via `Promise.all`) before `container.stop()`. Full integration suite now green deterministically (not green-on-retry).
- **i18n (D-C):** first/last labels + placeholders + `firstNameRequired` in `auth-shared` and `settings-page`, EN+UK same commit, obsolete `name`/`nameRequired` keys removed; parity green.

**Additional decisions (autonomous run):**
- **`update-locale` action added** (rationale above) — smallest change that preserves single-writer `name` and avoids display-name→parts round-tripping corruption; mirrors the established `update-default-currency` focused-action pattern.
- **`stopIntegrationApp` signature includes `poolList`** — necessary to cover every integration spec's teardown with one helper (story intent = "drain all pools before container.stop() via one shared helper"); documented as an intentional refinement of the story's literal `{ app, container }` signature.
- **`UserUpdatePatch` type** introduced in the repository so the service can pass the recomposed `name` to `updateScoped` without re-adding `name` to the write DTO.

### Visual QA

Captured on `:3000` (light+dark × 390px+desktop) into `_bmad-output/implementation-artifacts/visual-qa/7-1-first-last-name-capture/` (14 PNGs):
- `signup-idle--{mobile,desktop}--{light,dark}.png` — first/last fields, placeholder-only (no helper text).
- `signup-error--{mobile,desktop}--{light,dark}.png` — empty-first-name shows "First name is required".
- `settings-populated--{mobile,desktop}--{light,dark}.png` — first/last populated from profile; header shows composed name.
- `settings-edited--desktop--light.png` + `usermenu-updated--desktop--light.png` — after editing last name and saving, the user menu updates from "Quinn Tester" → "Quinn Anderson" and the success alert shows (revalidate-driven, no full reload).

Findings: `documentElement.scrollWidth === innerWidth` (390 === 390) on both sign-up and settings at 390px — no horizontal overflow. Both themes render correctly. End-to-end sign-up of a new user persisted `name="Quinn Tester"`, `first="Quinn"`, `last="Tester"` in a single better-auth call; a settings last-name edit recomposed `name="Quinn Anderson"` server-side. Reference parity: settings first/last matches `example/track-my-life`'s settings profile form; sign-up first/last is new ground (reference collects names only in settings). DB baseline restored afterward (test user deleted; 1880 tx / 110 categories / latest 2025-02-03 / operator+dev user onboarded with backfilled first names).

### File List

**Added**
- `packages/shared/src/utils/full-name.ts`
- `packages/shared/src/utils/full-name.spec.ts`
- `apps/api/src/database/migrations/0007_breezy_songbird.sql`
- `apps/api/src/database/migrations/meta/0007_snapshot.json`
- `apps/money-tracker/src/actions/update-locale.ts`
- `apps/money-tracker/src/actions/update-locale.test.ts`
- `apps/money-tracker/src/actions/update-profile.test.ts`
- `_bmad-output/implementation-artifacts/visual-qa/7-1-first-last-name-capture/*.png` (14 captures)

**Modified**
- `apps/api/src/database/schemas/users.ts`
- `apps/api/src/database/migrations/meta/_journal.json`
- `apps/api/src/auth/auth.ts`
- `apps/api/src/database/seeds/seed-operator.ts`
- `apps/api/src/modules/users/dtos/user-response.dto.ts`
- `apps/api/src/modules/users/dtos/update-user.dto.ts`
- `apps/api/src/modules/users/users.repository.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/users.repository.spec.ts`
- `apps/api/src/modules/users/users.service.spec.ts`
- `apps/api/src/modules/users/users.controller.spec.ts`
- `apps/api/test/helpers/auth-client.ts`
- `apps/api/test/helpers/integration-app.ts`
- `apps/api/test/integration/{auth,users-profile,seed,analytics,analytics-by-category,analytics-cache,transactions,transaction-categories,transaction-export,transaction-import,migrate-on-boot}.integration.spec.ts`
- `packages/shared/src/generated/types.gen.ts`
- `packages/widgets/src/auth/auth-client.ts`
- `packages/widgets/src/constants/auth-form-schema.ts`
- `packages/widgets/src/components/sign-up-form/SignUpForm.tsx`
- `packages/widgets/src/components/sign-up-form/SignUpForm.test.tsx`
- `apps/money-tracker/src/actions/update-profile.ts`
- `apps/money-tracker/src/app/[locale]/AppShellSection.tsx`
- `apps/money-tracker/src/app/[locale]/settings/constants/profile-form-schema.ts`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.tsx`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/hooks/use-profile-form.ts`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.test.tsx`
- `apps/money-tracker/messages/{en,uk}/auth-shared.json`
- `apps/money-tracker/messages/{en,uk}/settings-page.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Change |
|------|--------|
| 2026-07-05 | Implemented story 7.1: first/last name as better-auth additional fields (sign-up + settings), derived `name` via shared `composeFullName`/`splitFullName`, migration 0007 + backfill, single-writer name recomposition in `UsersService`, regenerated client, focused `update-locale` action for the user-menu locale switch, and the D-F Testcontainers teardown-race fix (`stopIntegrationApp` across all integration specs). i18n EN+UK, full gates green, visual QA captured. Status → review. |

### Review Findings (bmad-code-review, 2026-07-05)

Adversarial 3-layer review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Orchestrator gates: `type-check` PASS, `lint` PASS, `i18n:parity` PASS. CRITICAL cross-check PASS (client `auth-client.ts` does NOT import server `auth`; uses `inferAdditionalFields` field-shape form — no server leak into browser bundle). All 10 ACs PASS. **No MUST-FIX findings. Verdict: APPROVE.** All items below are nice-to-have hardening.

- [ ] [Review][Patch] Server-side DTO does not trim `firstName`/`lastName` — a direct authenticated `PATCH /users/me { firstName: "   " }` passes `@MinLength(1)` and recomposes `name` to `""`; `{ firstName: "Ann ", lastName: "Smith" }` yields double-spaced `"Ann  Smith"`. Not reachable via the UI (both zod schemas `.trim()`); self-only, no cross-user/crash. Suggest `@Transform` trim on the DTO or trim each part in `composeFullName`. [apps/api/src/modules/users/dtos/update-user.dto.ts / packages/shared/src/utils/full-name.ts]
- [ ] [Review][Patch] Clearing a populated last name in settings stores `''` (zod `.trim().optional()` yields `''`, not `undefined`, so the action sends `lastName: ''`), while sign-up/backfill store `NULL` — mixed empty representation. Display unaffected (`composeFullName` filters `''`); normalize empty→null for data hygiene. [apps/money-tracker/src/actions/update-profile.ts:35]
- [ ] [Review][Patch] Migration 0007 backfill SQL diverges from `splitFullName` on leading/trailing/multiple-whitespace names (SQL yields `''` where JS yields `null`/differs). One-time DDL on normally-clean names; no crash. [apps/api/src/database/migrations/0007_breezy_songbird.sql]
- [ ] [Review][Patch] `stopIntegrationApp` uses `Promise.all(pools.map(end))` before `container.stop()` — a rejecting `pool.end()` would skip `container.stop()` and leak the container. Test-only robustness; use `allSettled`/`try-finally`. [apps/api/test/helpers/integration-app.ts]
- [ ] [Review][Patch] A legacy row with `first_name` NULL/empty loads the settings form with an empty required `firstName`, blocking a locale/currency-only save until a first name is typed. Bounded — backfill populates existing rows and sign-up now requires firstName. [apps/money-tracker/src/app/[locale]/settings/constants/profile-form-schema.ts]
- [ ] [Review][Patch] Frontend zod schemas omit the `NAME_MAX_LENGTH` bound (server DTO enforces `@MaxLength`); over-long input is rejected server-side, not inline. Matches the pre-existing `name` schema (no regression). [packages/widgets/src/constants/auth-form-schema.ts / apps/money-tracker/src/app/[locale]/settings/constants/profile-form-schema.ts]

Dismissed (verified false positives / noise): other `usersUpdateMe` callers sending `name` (verified: onboarding sends only `onboardingCompleted`; currency/locale actions send neither) · `migrate-on-boot` leaking an undrained pool (verified: its pool is `end()`ed in a `finally`, not held to `afterAll`) · "teardown fix is a refactor not an ordering fix" (the consolidation is what D-F specified) · `seedOperator` whitespace-name edge (not reachable with the default `SEED_OPERATOR_NAME`) · tab/unicode-separated names not split (JS and SQL are consistent; informational).
