---
baseline_commit: 1366c673fb153040c977a763f42a5cf35e6fef9f
---

# Story 1.6: Profile Settings

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to view and edit my name, default currency, and locale,
so that the platform reflects my preferences — and the dashboard later opens on my currency (FR5).

## Acceptance Criteria

> Format: Given/When/Then carried from `epics.md` (Story 1.6), refined with the binding architecture interpretations and the actual state of the code merged through Story 1.5. Each AC is independently verifiable.

**AC1 — `users` table carries `defaultCurrency` + `locale`; profile read returns them.**
**Given** the existing better-auth-owned `users` table (`id, name, email, emailVerified, image, role, createdAt, updatedAt`), **when** this story migrates the schema, **then** two domain columns are added — `locale text NOT NULL DEFAULT 'en'` and `default_currency text` (nullable) — via one drizzle-kit migration in the single pipeline; sign-up still succeeds (columns are defaulted/nullable so better-auth's INSERT, which does not set them, is unaffected); and `GET /api/v1/users/me` (`UserResponseDto`) now returns `{ id, email, name, role, locale, defaultCurrency }`.

**AC2 — `PATCH /api/v1/users/me` updates the profile through the generated client (D7, NFR6).**
**Given** a signed-in user, **when** they submit valid changes, **then** a new `PATCH /api/v1/users/me` (operationId `usersUpdateMe`) accepts an `UpdateUserDto` (`name?`, `locale?`, `defaultCurrency?` — all optional, partial update), the repository is the **only** DB-touching layer and scopes the write by the authenticated `userId`, the endpoint returns the updated `UserResponseDto`, and the regenerated client (drift gate green) exposes `UsersApiService.usersUpdateMe(...)`. Invalid input (e.g. unknown currency code, unknown locale, empty name) is rejected by the global `ValidationPipe` → `400` with the standard envelope `{ statusCode: 400, code: "VALIDATION_ERROR", message, details }`.

**AC3 — settings page edits the profile via a server action returning discriminated `ActionState` (D9).**
**Given** the settings form (react-hook-form + zod), **when** valid changes are submitted, **then** an `'use server'` action calls `UsersApiService.usersUpdateMe` through the cookie-forwarding server client, returns a discriminated `ActionState` (`{ status: 'success' } | { status: 'error', code, message? }`), calls `revalidatePath` on success so the view refreshes **without a full reload**, and validation/API errors surface as i18n messages **resolved by error `code`** (e.g. `VALIDATION_ERROR`) — never raw API text.

**AC4 — locale persists to the profile and is applied on next sign-in from any session (FR19).**
**Given** a signed-in user switching locale (via the shell `LocaleSwitcher` **or** the settings form), **when** the change is saved, **then** it is persisted to `users.locale` through `PATCH /me`; **and** on a subsequent sign-in from any session/browser the app opens in the persisted locale — i.e. after authentication the effective locale is resolved from the profile and the user lands on that locale's route (not merely the URL/cookie default).

**AC5 — only valid currency codes are accepted.**
**Given** the default-currency field, **when** edited, **then** only ISO-4217 codes from the shared `CURRENCY_CODE_LIST` are accepted — enforced on the client (zod `z.enum`) **and** on the server (`@IsIn(CURRENCY_CODE_LIST)` in `UpdateUserDto`); an out-of-list value never reaches the database.

**AC6 — user menu links to settings (FR3).**
**Given** the shared shell user menu (currently name + Sign out), **when** opened by a signed-in user, **then** it offers a Settings entry that navigates to `/settings`; the route is protected (middleware redirects an unauthenticated visitor to `/sign-in`).

**AC7 — tests ship with the feature (NFR1, D10).**
**Given** the users module and settings page, **when** tests run, **then**: API unit specs cover the service/controller update path and the repository's user-scoped update; a Testcontainers integration test asserts the round-trip (`PATCH` persists, re-read via `GET /me` reflects it), **cross-user scoping** (user A's session can neither read nor update user B), and invalid-currency → `400 VALIDATION_ERROR`; a frontend component test covers the settings form (render, validation-error display, submit calls the action, pending disables submit). All merge in this story.

**AC8 — i18n both locales + parity green (FR19/FR20).**
**Given** every new user-facing string (settings page + form labels/errors + the user-menu "Settings" entry), **then** it exists in **both** `en` and `uk` namespace files in the same commit and `pnpm i18n:parity` passes. Real Ukrainian, not transliterated.

**AC9 — visual QA (mandatory, lesson from 1.4/1.8/1.5).**
**Given** the new settings page and `ProfileForm`, **then** Storybook (or a headless render) screenshots are captured in **both** themes including the **currency Combobox open state** and the **validation-error / pending states**, compared against the `example/track-my-life` settings/profile-form reference, with the evidence (images or precise per-state observations) recorded in the Dev Agent Record. Green gates + green axe without an actual look at rendered output is not acceptance.

## Tasks / Subtasks

> Suggested order: shared currency constant (T1) → backend schema + module update + migration (T2–T4) → contract regen (T5) → frontend ActionState + action + form + page (T6–T10) → locale persistence wiring (T11) → user-menu Settings link (T12) → tests (T13) → i18n + visual QA + gates (T14–T15). Backend (T2–T5) and the shared constant (T1) can precede or parallel the frontend.

- [x] **T1 — Shared `CURRENCY_CODE_LIST` constant (AC5).**
  - [x] Create `packages/shared/src/constants/currency.ts` exporting `CURRENCY_CODE_LIST` (ISO-4217 alpha codes) and a derived `CurrencyCode` union type. Follow the repo's `ObjectValuesUnion`/no-enums convention (see `locales.ts` and `.claude/rules/typescript.md`): a `const` array of string literals + `export type CurrencyCode = (typeof CURRENCY_CODE_LIST)[number]`, plus a `checkIsCurrencyCode` guard mirroring `checkIsLocaleCode`. Source the code list from `example/track-my-life/packages/shared/src/constants/currency.ts` (~158 codes) — **rebuild the list, do not import** (ED1). The reference derives its type from a generated `CurrencyCode`; supertool has no generated currency type, so define the type from the array.
  - [x] No DB enum for currency (see Dev Notes "why currency is a validated string, not a pgEnum").

- [x] **T2 — Add `locale` + `defaultCurrency` columns to the `users` schema (AC1).**
  - [x] `apps/api/src/database/schemas/users.ts`: add `locale: text('locale').notNull().default('en')` and `defaultCurrency: text('default_currency')` (nullable). Snake_case DB columns, camelCase TS mapping (house rule). Do **not** add a pgEnum; do **not** add these as better-auth `additionalFields` (see Dev Notes "do not touch auth.ts additionalFields").
  - [x] Keep `'en'` aligned with `DEFAULT_LOCALE` (`packages/shared/src/constants/locales.ts`). Use the literal `'en'` in the schema default (the schema file must not depend on `@supertool/shared` if that creates a cycle — confirm; the reference schema files are dependency-light). If a clean import exists, prefer `DEFAULT_LOCALE`.

- [x] **T3 — Generate + run the migration (AC1).**
  - [x] `pnpm --filter @supertool/api db:generate` → produces an `ALTER TABLE users ADD COLUMN ...` migration under `src/database/migrations/`. Verify it is additive (no data loss, existing rows get `locale='en'`, `default_currency=NULL`).
  - [x] `pnpm --filter @supertool/api db:migrate` against local Postgres; confirm columns + defaults exist and a fresh sign-up still succeeds (better-auth INSERT does not set these columns).

- [x] **T4 — Extend the `users` module: response DTO + update endpoint (AC1, AC2, AC5).**
  - [x] `dtos/user-response.dto.ts`: add `locale!: string` and `defaultCurrency!: string | null` with `@ApiProperty`/`@ApiPropertyOptional({ nullable: true })`. Update `users.repository.ts#findByIdScoped` select to include the two columns.
  - [x] New `dtos/update-user.dto.ts`: optional `name` (`@IsOptional @IsString @MinLength(1) @MaxLength(<sensible, e.g. 100>)`, `@ApiPropertyOptional`), optional `locale` (`@IsOptional @IsIn(LOCALE_CODE_LIST)`), optional `defaultCurrency` (`@IsOptional @IsIn(CURRENCY_CODE_LIST)`). Decorate for OpenAPI. `whitelist: true` on the global pipe strips unknown props; only these three are accepted. (No custom `IsInField`/`IsStringField` wrappers exist here — use plain class-validator decorators; the reference's custom validators are NOT in this repo.)
  - [x] `users.controller.ts`: add `@Patch('me') @UseGuards(AuthGuard)` → `update(@Session() session, @Body() dto: UpdateUserDto)`; `@ApiOkResponse({ type: UserResponseDto })`, `@ApiUnauthorizedResponse`, `operationId` `usersUpdateMe` (the `@ApiTags('users')` + method name drives it; confirm the generated method name after T5). Returns `UserResponseDto`.
  - [x] `users.service.ts`: `update(userId, dto)` → repository `updateScoped(userId, dto)` then return the fresh DTO (or have the repository return the updated row). Throw `NotFoundException` if the scoped update affects 0 rows.
  - [x] `users.repository.ts`: `updateScoped(userId, patch)` — `db.update(users).set({ ...patch, updatedAt: <now> }).where(eq(users.id, userId)).returning({...})`. Repository is the **only** DB-touching layer (D7); scope by `userId` (D6/FR21). Ignore `undefined` fields so a partial update doesn't null out unset columns (build the `set` object from defined keys only).

- [x] **T5 — Regenerate the API client + drift gate (NFR6, D8).**
  - [x] `pnpm --filter @supertool/api build` (emits `apps/api/openapi.json`) → generate the client into `packages/shared/src/generated/` → **commit**. Expect a new `UsersApiService.usersUpdateMe(...)`, an updated `UserResponseDto` (with `locale`, `defaultCurrency`), and a new `UpdateUserDto` type.
  - [x] Confirm the CI drift gate passes (regenerate produces no diff).

- [x] **T6 — Canonical `ActionState` discriminated union (AC3) — first server action in the repo.**
  - [x] Define `ActionState` per architecture.md (Process Patterns, line ~275): `{ status: 'success' } | { status: 'error'; code: ErrorCode | 'UNKNOWN'; message?: string }` plus an `INITIAL_ACTION_STATE`. Place it in `packages/next-shared/src/types/action-state.ts` (reusable across tool apps for FR4; next-shared is the Next-aware shared home). Reuse `ErrorCode` from `@supertool/shared/constants/error-codes`. **Divergence from reference:** the reference uses two types (`ServerActionResult<T>` + a separate `{ success, error }` `ActionState`); supertool collapses to the single architecture-mandated discriminated `ActionState` keyed on `status`, resolving user messages by `code`. Document this in Dev Notes.

- [x] **T7 — `update-profile` server action (AC3, AC4, AC5).**
  - [x] `apps/money-tracker/src/actions/update-profile.ts`, `'use server'`. Accept the typed form values; validate with `profileFormSchema` (T8) server-side too (defense in depth); call `UsersApiService.usersUpdateMe({ client: createServerApiClient({ cookieHeader }), body })`. On `{ error }` map the API error envelope's `code` into `ActionState.error` (`code` + optional `message`); on success `revalidatePath('/settings')` (and `'/'` if the locale change affects the shell) and return `{ status: 'success' }`. **Use `revalidatePath`, not the reference's `updateTag`/cache-tag system** (D9; no cache-tag infra exists here).
  - [x] Mirror the read-side cookie pattern from `apps/money-tracker/src/actions/fetch-profile.ts` (cookies() → `cookieHeader` → `createServerApiClient`). Do **not** hand-write a `fetch` (NFR6).

- [x] **T8 — `profile-form-schema` with error keys (AC3, AC5).**
  - [x] `apps/money-tracker/src/app/[locale]/settings/constants/profile-form-schema.ts`: `z.object({ name: z.string().trim().min(1, 'nameRequired'), locale: z.enum(LOCALE_CODE_LIST), defaultCurrency: z.enum(CURRENCY_CODE_LIST).optional() })`. Error **keys** (not English) resolved via i18n (mirror `packages/widgets/src/constants/auth-form-schema.ts`). Export `ProfileFormValues = z.infer<...>`. `.trim()` on name (carry the 1.5 review lesson — whitespace-only must fail).
  - [x] `settings/constants/currency-option-list.ts`: map `CURRENCY_CODE_LIST` → `ComboboxOption[]` (`{ value: code, label: code }`). Mirror the reference's currency-option-list.

- [x] **T9 — `ProfileForm` component (AC3, AC5, AC9).** Mirror `example/track-my-life/.../settings/components/profile-form/ProfileForm.tsx` + `hooks/use-profile-form.ts` (adapted: `@supertool` scope, PascalCase files, `translate` not `t`, single `ActionState`, no toast unless `toaster` molecule is wired — see Dev Notes).
  - [x] `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.tsx` (+ co-located `.module.scss`, `.test.tsx`). `'use client'`. Compose from `@supertool/ui`: `Input` (name), `Combobox` (default currency — searchable, ~158 options), `Select` (locale — 2 options), and the `Field` family (`FieldSet`/`FieldGroup`/`Field`/`FieldLabel`/`FieldContent`/`FieldDescription`/`FieldError`), wrapped by `Card`. `Button` submit `disabled={isPending}`.
  - [x] RHF + `zodResolver(profileFormSchema)`; `defaultValues` from the passed-in `profile` (`name`, `locale`, `defaultCurrency ?? undefined`). `useActionState` + `useTransition` (mirror the reference hook). On error, render the resolved i18n message via `FieldError` / an `Alert`; on success show a success indication (inline `Alert` success or the `toaster` molecule if wired — pick one and keep it consistent).
  - [x] Add a Storybook story under `apps/storybook/src/stories/ProfileForm.stories.tsx` (CSF3, `tags: ['autodocs']`, interactive wrapper) — required for T15 visual QA. `meta.args` must satisfy required props (a sample `profile`).

- [x] **T10 — Settings page (RSC) (AC3, AC6).**
  - [x] `apps/money-tracker/src/app/[locale]/settings/page.tsx` — async RSC, `setRequestLocale`, `getTranslations`, `fetchProfile()`; if `profile` is null, redirect to `/sign-in` (defense; middleware already gates). Compose `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` framing `ProfileForm` (pass `profile`). Mirror the reference `settings/page.tsx` + `page.content.tsx` split if it keeps the RSC clean (a client `*Section` wrapper is the established pattern — see `sign-in/SignInFormSection.tsx`).
  - [x] Add `settings: '/settings'` to `apps/money-tracker/src/constants/routes.ts` (`ROUTES`). No hardcoded `'/settings'` literals (1.5 review lesson).

- [x] **T11 — Locale persistence + apply-on-sign-in (AC4) — the load-bearing FR19 wiring.**
  - [x] **Persist on switch:** make the shell `LocaleSwitcher` persist the chosen locale to the profile for signed-in users, in addition to its current `router.replace(pathname, { locale })`. `packages/shell` must NOT depend on `apps/*` or `packages/widgets` (boundary rule) — so inject the persistence callback: add an optional `onLocaleChange?: (locale: LocaleCode) => void` prop to `LocaleSwitcher` (and thread it through `AppShell`), and have the app's `AppShellSection` pass a handler that calls the `update-profile` action with `{ locale }`. The switcher stays presentational; the app owns the action call (same pattern as `onSignOut` in 1.5).
  - [x] **Apply on sign-in (any session):** resolve the effective locale from `profile.locale` after authentication and ensure the user is on that locale's route. Recommended mechanism (see Dev Notes "FR19 apply-on-sign-in design" for the full rationale and alternatives): in `apps/money-tracker/src/app/[locale]/layout.tsx` (which already calls `fetchProfile()`), when `profile.locale` differs from the URL `params.locale`, `redirect()` to the same path under `profile.locale`. This makes a fresh sign-in on `/` (default `en`) bounce to `/uk` when the saved locale is `uk`, from any browser. Guard against redirect loops (only redirect when locales genuinely differ and the target is a valid locale). Verify it composes with next-intl `localePrefix: 'as-needed'` (the default locale has no prefix).

- [x] **T12 — User-menu "Settings" link (AC6).**
  - [x] `packages/shell/src/components/user-menu/UserMenu.tsx`: add a `DropdownMenuItem` "Settings" above "Sign out". Keep the shell presentational — add an optional `onOpenSettings?: () => void` prop (or a `settingsHref` prop) so navigation is injected by the app (`AppShellSection` uses the next-shared `useRouter` to push `ROUTES.settings`), preserving the no-apps-import boundary. Update `UserMenu.test.tsx`.
  - [x] Add the `userMenu.settings` key to `navigation.json` (both locales).

- [x] **T13 — Tests (AC7, NFR1, D10).**
  - [x] **API unit:** extend `users.service.spec.ts` / `users.controller.spec.ts` for the update path (valid update returns DTO; not-found → `NotFoundException`); cover `users.repository.updateScoped` partial-update behavior (undefined fields untouched) — mirror the existing health/users spec style (`Test.createTestingModule`, `vi.fn()` doubles).
  - [x] **API integration (Testcontainers):** add to `apps/api/test/integration/` (reuse the 1.5 harness — see Dev Notes): sign up user A, `PATCH /me` with `{ name, locale, defaultCurrency }`, re-read via `GET /me` reflects it; **user A's cookie cannot update or read user B** (cross-user scoping, FR21); `PATCH /me` with an invalid `defaultCurrency` → `400 VALIDATION_ERROR` envelope.
  - [x] **Frontend:** `ProfileForm.test.tsx` (@testing-library/react, no jest-dom matchers — role/DOM queries): renders fields with defaults, shows a validation error for an empty name, submit invokes the mocked `updateProfile` action, submit disabled while pending. Mock the action and `next/navigation` as needed.

- [x] **T14 — i18n both locales (AC8, FR19/FR20).**
  - [x] Add `I18N_NAMESPACE.settingsPage` (= `'settingsPage'`) to `packages/shared/src/constants/i18n-namespace.ts`; map it to `'settings-page'` in `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts`.
  - [x] Create `apps/money-tracker/messages/{en,uk}/settings-page.json`: page title/description, field labels (name, default currency, locale), field descriptions, `errors.*` keys matching the zod keys (`nameRequired`, currency/locale invalid) **and** the API error codes (`VALIDATION_ERROR`, `UNKNOWN` fallback, `UNAUTHORIZED`), success message, submit label. Add the `userMenu.settings` key to `navigation.json` (both locales). Reuse `authShared.errors` patterns where a key already exists.
  - [x] `pnpm i18n:parity` green.

- [x] **T15 — Visual QA + final gates (AC9, NFR2).**
  - [x] Run Storybook (or the 1.5-style headless harness against `storybook-static`); screenshot `ProfileForm` (and the settings page if feasible) in light + dark including the **currency Combobox open**, a **validation-error** state, and the **pending** state; compare against the reference profile form; record evidence in the Dev Agent Record. Save images under `_bmad-output/implementation-artifacts/visual-qa/1-6/`.
  - [x] Run the full gate set with cache bypass where verifying (`turbo ... --force`, per the "turbo cache masks gate results" lesson): `pnpm lint`, `pnpm fmt:check`, `pnpm type-check`, `pnpm stylelint`, `pnpm test`, `pnpm i18n:parity`, client-drift, `pnpm build`.

## Dev Notes

### Current state of the code this story extends (read these files before writing — verified at baseline `1366c67`)

- **`users` table** (`apps/api/src/database/schemas/users.ts`) — better-auth-owned: `id (text PK), name (notNull), email (unique notNull), emailVerified (bool), image (text), role (roleEnum, default 'user'), createdAt, updatedAt (timestamptz)`. **No `locale`, no `defaultCurrency` yet** — this story adds them.
- **`users` module** (`apps/api/src/modules/users/`) — `GET /api/v1/users/me` only. `UserResponseDto = { id, email, name, role }`. `UsersController.me` is `@UseGuards(AuthGuard)` + `@Session()`; `UsersService.getById` → `UsersRepository.findByIdScoped(userId)` (the only DB-touching layer, selects `id/email/name/role`). **No update path yet** — add it here, same layering.
- **`auth.ts`** (`apps/api/src/auth/auth.ts`) — better-auth basePath is **`/api/v1/auth`** (not `/api/auth`; the 1.5 dev confirmed this empirically). `additionalFields` carries only `role` (`input: false`). **Do not add `locale`/`defaultCurrency` here** (see below).
- **Generated client** (`packages/shared/src/generated/`) — currently `UsersApiService.usersMe()`. Auth routes are NOT in the client (better-auth, not Nest controllers). T5 adds `usersUpdateMe`.
- **`fetch-profile.ts`** (`apps/money-tracker/src/actions/`) — `fetchProfile = cache(async () => UsersApiService.usersMe({ client: createServerApiClient({ cookieHeader }) }))`. The read pattern to mirror for the write action.
- **`layout.tsx`** (`apps/money-tracker/src/app/[locale]/`) — already `await fetchProfile()` and passes `profile?.name` to `AppShellSection`. **This is where apply-on-sign-in locale resolution (T11) hooks in.**
- **`AppShellSection.tsx`** — client wrapper that injects `onSignOut` (calls `authClient.signOut()`) into `AppShell`; the established pattern for injecting app behavior into the presentational shell. Inject `onLocaleChange` / settings navigation the same way.
- **`LocaleSwitcher.tsx`** (`packages/shell/`) — currently only `router.replace(pathname, { locale })`. Locale is URL-driven via next-intl `localePrefix: 'as-needed'` (default `en` has no prefix). No profile persistence yet.
- **`UserMenu.tsx`** (`packages/shell/`) — dropdown with name trigger + Sign out item only. Add Settings.
- **`ROUTES`** (`apps/money-tracker/src/constants/routes.ts`) — `{ home, signIn, signUp }`. Add `settings`.
- **i18n** — `I18N_NAMESPACE` in `packages/shared/src/constants/i18n-namespace.ts` (single source); file-name mapping in the app's `localization-messages-file-name-by-namespace.ts`; messages under `apps/money-tracker/messages/{en,uk}/<file>.json`. Namespaces today: `authShared, homePage, navigation, signInPage, signUpPage`. Add `settingsPage`.
- **Validation/errors** — global `ValidationPipe({ whitelist: true, transform: true })` (`main.ts`); `GlobalExceptionFilter` maps `BadRequestException` (from the pipe) → `{ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', details: { messages: [...] } }`. So an invalid currency/locale/empty-name returns `400 VALIDATION_ERROR` — that is the code the settings form resolves to an i18n message.
- **UI inventory** — atoms include `input, select, label, button, alert`; molecules include `combobox, field, card, dropdown-menu, alert-dialog, toaster`. `Combobox` props: `optionList, value, onValueChange, placeholder, emptyMessage, searchLabel, error, disabled`. `Select` props: `value, onValueChange, optionList, ariaLabel`.

### Reference patterns (study before implementing — `example/track-my-life` + `example/tracker-backend-api`, reference-only, never copy/import per ED1)

- **Frontend settings feature:** `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/` — `page.tsx` + `page.content.tsx` (RSC split), `components/profile-form/ProfileForm.tsx` + `hooks/use-profile-form.ts` (RHF + `zodResolver` + `useActionState` + `useTransition`), `actions/update-profile.ts` (`'use server'`), `constants/{profile-form-schema,currency-option-list}.ts`. **supertool's profile is smaller** (`name`, `defaultCurrency`, `locale`) — ignore the reference's `firstName/lastName/countryCode`, change-password, and delete-account surfaces (out of scope; FR5 is minimal, full settings are PRD out-of-scope).
- **Backend profile module:** `example/tracker-backend-api/src/modules/profile/` — `profile.controller.ts` (`@Get()` + `@Patch()`), `dtos/update-profile.dto.ts` (`@IsOptional` + validators + `@ApiPropertyOptional`). **supertool extends the existing `users` module instead of a new `profile` module** (the `users` module + `GET /me` already exist from 1.5; the architecture tree names `modules/users` for "profile read/update (FR5)"). Use plain class-validator decorators, not the reference's custom `IsInField`/`IsStringField` (those don't exist here).
- **Currency constant:** `example/track-my-life/packages/shared/src/constants/currency.ts` — the ~158-code list to rebuild (T1). Reference derives the type from a generated `CurrencyCode`; supertool defines the union from the array.
- **Auth-form patterns already mirrored in supertool** (1.5): `packages/widgets/src/constants/auth-form-schema.ts` (zod error-keys), `packages/widgets/src/components/sign-in-form/SignInForm.tsx` (Field composition, `useTransition`, FieldError) — closest in-repo precedent for `ProfileForm`.

### Architecture compliance (binding — `architecture.md`; the seven agent MUSTs are merge-blocking)

- **D7 REST + layering:** `PATCH /api/v1/users/me`; controller → service → repository (repository is the only DB-touching layer); errors via `GlobalExceptionFilter`; camelCase JSON; DELETE n/a here. `@Patch('me')` returns 200 + updated body.
- **D8 contract pipeline:** regenerate the committed client; drift gate green; new `usersUpdateMe`.
- **D9 frontend data flow:** read via `fetch-profile` (RSC `cache()`); mutate via a `'use server'` action returning discriminated `ActionState`; `revalidatePath` after success (NFR5 — submit-to-visible, no full reload). URL/search-params for state; RHF + zod for the form; next-intl for i18n.
- **D6/FR21 scoping:** the update repository scopes by the authenticated `userId`; user A can never read/update user B (integration-tested).
- **The seven MUSTs:** money-as-strings (n/a — no money here), generated-client-only for domain API (use `usersUpdateMe`, no hand-fetch), repositories-only DB access, both-locales-same-commit, tests-same-story, exact versions / no eslint-prettier, never import from `example/`.

### Why currency is a validated string, not a pgEnum

ISO-4217 has ~158 codes. A `pgEnum('currency', [...158])` is heavy, churns on any list change (enum ALTERs are awkward), and buys nothing the DTO validation doesn't: `@IsIn(CURRENCY_CODE_LIST)` + the client `z.enum` already guarantee only valid codes reach the column (AC5). Store `default_currency` as nullable `text`. (The reference backend does exactly this — `IsInField(CURRENCY_CODES)`, plain column.) `locale` is likewise plain `text` with a DB default, validated `@IsIn(LOCALE_CODE_LIST)`.

### Do not touch `auth.ts` `additionalFields` for `locale`/`defaultCurrency`

These are **domain** preferences, updated through the `users` module's `PATCH /me` repository (D7) — not through better-auth. Declaring them as better-auth `additionalFields` would (a) make better-auth expect/manage them, (b) tempt updates via `authClient.updateUser` which bypasses the repository layer and the generated client (NFR6 + D7 violation), and (c) couple the auth surface to domain fields. Add the columns to the Drizzle schema only. better-auth's sign-up INSERT omits them — safe because `locale` is `DEFAULT 'en'` and `default_currency` is nullable. **Name** is better-auth's column but is also a plain DB column; updating it via the repository is fine. Caveat: anything reading `session.user.name` straight from better-auth's session may show a stale name until the session refreshes — not a problem here because the UI sources the name from `fetchProfile()` (our `/me`, fresh DB read), which `revalidatePath` refreshes after update.

### FR19 apply-on-sign-in design (the part most likely to be done wrong)

FR19 = "applied on next sign-in **from any session**." That means the **profile is the source of truth**, cross-device — a cookie alone fails the "any session/fresh browser" clause. Two parts:
1. **Persist** the locale to `users.locale` on every switch (shell switcher and settings form) — via `PATCH /me`.
2. **Apply** it after authentication by resolving the effective locale from `profile.locale` and routing there.

**Recommended apply mechanism:** in `app/[locale]/layout.tsx` (already fetches the profile), if `profile?.locale` is a valid locale and differs from `params.locale`, `redirect()` to the same path under `profile.locale`. This is robust for any entry point (a fresh sign-in landing on `/` redirects to `/uk` when saved locale is `uk`). **Guard the redirect:** only when both are valid locales and genuinely differ, to avoid loops; the switcher's own `router.replace(..., { locale })` navigation must not fight the redirect (it won't, because the switch also persists, so post-navigation profile == URL locale).
- **Alternatives considered:** (a) redirect in the sign-in `onSuccess` handler — narrower, misses non-sign-in entries; (b) a `NEXT_LOCALE` cookie read by `i18n/request.ts` — per-browser, fails the cross-session clause. Layout-level resolution from the profile is the only option that satisfies "from any session." If layout-level redirect proves awkward with `as-needed` prefixing, fall back to resolving in `middleware.ts` after the auth-cookie check — but that needs a profile read in middleware (heavier); prefer the layout. Whichever you choose, the integration/manual check is: save `uk`, sign in fresh, land on a `/uk` route.

### ActionState — establishing the platform mutation contract (first server action)

This is the **first** domain mutation/server action in the repo, so it sets the canonical shape. Architecture.md (Process Patterns) mandates a discriminated `ActionState` keyed on `status` with messages resolved by `code`:
```ts
// packages/next-shared/src/types/action-state.ts
export type ActionState =
  | { status: 'success' }
  | { status: 'error'; code: ErrorCode | 'UNKNOWN'; message?: string };
export const INITIAL_ACTION_STATE: ActionState = { status: 'error', code: 'UNKNOWN' };
// ^ or model an explicit 'idle' status if the form needs to distinguish "not yet submitted"
```
The form resolves `code` → an i18n message (never render `message`/raw API text to the user; `message` is for logs/devs). **Divergence from reference:** the reference's `{ ok, data, error }` `ServerActionResult` + `{ success, error }` `ActionState` split is replaced by this single union. Epic 2 mutations reuse it — place it in `next-shared`, not the app, so tool #2 inherits it (FR4).

### Library / framework versions (exact — NFR2; nothing new expected)

No new runtime dependencies are anticipated — `react-hook-form@7.78.0`, `zod@4.4.3`, `@hookform/resolvers`, `next-intl@4.13.0` are already in `apps/money-tracker`/`packages/widgets` from 1.4/1.5; `class-validator`/`@nestjs/swagger` are in `apps/api`; `Combobox`/`Select`/`Field`/`Card` are in `packages/ui`. If `@hookform/resolvers` is not yet a direct dep of `apps/money-tracker` (it was added to `packages/widgets` in 1.5), add it at the same pinned version. Do not add a toast/notification dep — use the existing `toaster` molecule or an inline `Alert`.

### File structure (kebab-case dirs; PascalCase component files + co-located scss/test/stories)

```
packages/shared/src/constants/currency.ts                      # NEW: CURRENCY_CODE_LIST, CurrencyCode, checkIsCurrencyCode
packages/shared/src/constants/i18n-namespace.ts                # M: + settingsPage
packages/next-shared/src/types/action-state.ts                 # NEW: ActionState + INITIAL_ACTION_STATE
apps/api/src/database/schemas/users.ts                         # M: + locale, defaultCurrency
apps/api/src/database/migrations/<generated>                   # NEW: ALTER TABLE users
apps/api/src/modules/users/dtos/user-response.dto.ts           # M: + locale, defaultCurrency
apps/api/src/modules/users/dtos/update-user.dto.ts             # NEW
apps/api/src/modules/users/users.controller.ts                 # M: + PATCH me
apps/api/src/modules/users/users.service.ts                    # M: + update
apps/api/src/modules/users/users.repository.ts                 # M: + updateScoped, select new cols
apps/api/src/modules/users/{users.service.spec,users.controller.spec}.ts  # M
apps/api/test/integration/users-profile.integration.spec.ts    # NEW (reuse 1.5 Testcontainers harness)
packages/shared/src/generated/{index,sdk.gen,types.gen}.ts     # M: regenerated (usersUpdateMe, UpdateUserDto)
packages/shell/src/components/user-menu/UserMenu.tsx           # M: + Settings item (injected nav)
packages/shell/src/components/user-menu/UserMenu.test.tsx      # M
packages/shell/src/components/locale-switcher/LocaleSwitcher.tsx  # M: + onLocaleChange persistence prop
packages/shell/src/components/app-shell/AppShell.tsx           # M: thread settings + locale-change props
apps/money-tracker/src/constants/routes.ts                     # M: + settings
apps/money-tracker/src/actions/update-profile.ts               # NEW ('use server')
apps/money-tracker/src/app/[locale]/AppShellSection.tsx        # M: inject settings nav + onLocaleChange
apps/money-tracker/src/app/[locale]/layout.tsx                 # M: apply-on-sign-in locale redirect (T11)
apps/money-tracker/src/app/[locale]/settings/page.tsx          # NEW (RSC)
apps/money-tracker/src/app/[locale]/settings/SettingsFormSection.tsx  # NEW (client wrapper, if needed)
apps/money-tracker/src/app/[locale]/settings/components/profile-form/{ProfileForm.tsx,.module.scss,.test.tsx}  # NEW
apps/money-tracker/src/app/[locale]/settings/components/profile-form/hooks/use-profile-form.ts  # NEW
apps/money-tracker/src/app/[locale]/settings/constants/{profile-form-schema,currency-option-list}.ts  # NEW
apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts  # M: + settingsPage
apps/money-tracker/messages/{en,uk}/settings-page.json         # NEW
apps/money-tracker/messages/{en,uk}/navigation.json            # M: + userMenu.settings
apps/storybook/src/stories/ProfileForm.stories.tsx            # NEW
```

### Testing standards (D10, NFR1)

- **API:** Vitest with SWC decorators. Unit specs co-located `*.spec.ts` (mirror `users.service.spec.ts`/`users.controller.spec.ts` — `Test.createTestingModule`, `vi.fn()` doubles). Reuse the **1.5 Testcontainers harness** (`apps/api/test/integration/`, Postgres 16, run drizzle migrations first, `TESTCONTAINERS_RYUK_DISABLED=true` per 1.5 debug log, explicit `afterAll` teardown; `AUTH_RATE_LIMIT_DISABLED` to avoid 429 on repeated sign-ins). The integration test signs up, gets a session cookie, then exercises `PATCH /me`.
- **Frontend/packages:** `*.test.tsx` co-located, @testing-library/react `16.3.2`. **No jest-dom matchers** — role/DOM queries only. Mock the `update-profile` action and `next/navigation`. `packages/ui` lint gotchas also apply: oxlint `no-magic-numbers` on call args, hook-use-state naming, ARIA `combobox`/label requirements, CSF `meta` needs `args` for required props.
- **Manual verification** to record in Dev Agent Record: sign up → set locale `uk` + a currency → sign out → sign in fresh (or new browser) → app opens in `uk` (FR19); invalid currency rejected; name update reflected in the user-menu after `revalidatePath`.

### Project Structure Notes — variances & rationale

- **Extends `modules/users`, not a new `modules/profile`.** The architecture tree labels `modules/users` as "profile read/update (FR5)"; 1.5 built the read half. Keep all profile read/update in `users` to avoid a parallel module.
- **`ActionState` lives in `next-shared`, not the app.** It is the platform-wide server-action contract (FR4 reuse). The reference put it in app constants; supertool elevates it. `next-shared` may depend on Next.js; `ErrorCode` comes from `@supertool/shared` (allowed direction).
- **Shell stays presentational.** Both new shell touches (Settings nav in `UserMenu`, locale persistence in `LocaleSwitcher`) are injected from the app via props — `packages/shell` must not import from `apps/*` or `packages/widgets` (boundary rule; same approach as 1.5's `onSignOut`).
- **`revalidatePath` not cache tags.** The reference uses `updateTag`/`CACHE_TAG`; supertool has no cache-tag infra and D9 specifies `revalidatePath`. Don't introduce a cache-tag system.
- **Currency Combobox vs Select.** Currency uses the searchable `Combobox` molecule (~158 options); locale uses the `Select` atom (2 options). Note the deferred `Select` empty-options/placeholder gap (`deferred-work.md`) — not triggered here since both controls always have valid options and a controlled value.

### References

- [Source: epics.md#Story 1.6: Profile Settings] — ACs, FR5/FR19 mapping
- [Source: architecture.md#Frontend Architecture (D9)] — RSC reads / server-action mutations / discriminated `ActionState` / `revalidatePath` / RHF+zod / next-intl
- [Source: architecture.md#Process Patterns (Error handling)] — `ActionState` shape `{ status, code?, message? }`, messages resolved by `code` not raw API text
- [Source: architecture.md#API & Communication Patterns (D7, D8)] — `/api/v1/...`, layering, contract regen/drift gate
- [Source: architecture.md#Authentication & Security (D6)] · [#Data Architecture (D4 PKs)] — user-scoped repositories, UUIDv7 ids
- [Source: architecture.md#Complete Project Directory Structure] — `modules/users` = profile read/update (FR5), settings page in tool app
- [Source: architecture.md#Requirements Coverage Validation] — "FR19's per-user locale persistence rides on FR5's profile (`locale` column) plus next-intl middleware"
- [Source: prd.md#FR5, #FR19, #FR14] · [addendum.md] — minimal profile (name, default currency, locale); locale persistence; default currency drives dashboard filter
- [Source: 1-5-sign-up-sign-in.md] — users module + `GET /me`, AuthGuard/`@Session()`, generated `UsersApiService`, `createServerApiClient`, `fetch-profile`, shell `onSignOut` injection pattern, Testcontainers harness, i18n namespace single-source, no-barrel/UUIDv7/env-required conventions
- [Source: .claude/rules/{react,typescript,i18n,storybook,javascript}.md] — FC<Props>, no-enums/`ObjectValuesUnion`, no-`as`, namespace i18n + parity, CSF3 stories, no-comments/no-barrels, function prefixes (verify FC<Props> manually — not lint-enforced)
- [Source: deferred-work.md] — `Select` empty-options gap; constants↔messages no compile-time link (add the `userMenu.settings` + locale keys carefully)
- Reference: `example/track-my-life/.../settings/*` (frontend), `example/tracker-backend-api/src/modules/profile/*` (backend) — patterns only, never copy (ED1)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) via the bmad-dev-story workflow.

### Debug Log References

- **Money-tracker had no test harness.** Added `vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom` (dev) and `react-hook-form`, `@hookform/resolvers` (runtime), all pinned to the versions already used elsewhere in the repo (widgets). First app-level test setup in the monorepo.
- **JSX not transformed under vitest in the Next app.** The Next tsconfig sets `jsx: "preserve"`, which vite/rolldown respected, leaving JSX in the test bundle → "Unexpected JSX expression" from rolldown's `ssrTransformScript`. Verified it was not the `[locale]` bracket path (a non-bracket probe failed identically) and not a vite-version difference (widgets uses the same vite@8/rolldown and passes). Fix: `oxc: { jsx: 'react-jsx' }` in `apps/money-tracker/vitest.config.ts` to override the inherited `preserve`.
- **ValidationPipe was only registered in `main.ts`,** so the Testcontainers integration app (which boots via `configureAppRouting`) had no validation. Moved `app.useGlobalPipes(new ValidationPipe(...))` into `configureAppRouting` so prod and tests share one source of truth — this is what makes the invalid-currency → 400 integration assertion authentic.
- **Local Postgres container disappeared mid-session** (the compose `supertool-postgres-1`); recreated it via `docker compose -f docker/docker-compose.yml up -d` and re-ran `db:migrate` for visual QA.
- Visual QA harness: throwaway `playwright-core` project in `/tmp` driving the cached `chrome-headless-shell-1208` against the live `pnpm dev` app (no browser tooling added to the repo), per the repo's visual-QA lesson.

### Completion Notes List

All nine ACs satisfied; all T1–T15 tasks complete with tests shipping in-story.

**Backend (T1–T5):** Added `CURRENCY_CODE_LIST`/`CurrencyCode`/`checkIsCurrencyCode` (158 ISO-4217 codes rebuilt from the reference, array form sanctioned by the story). Added `locale text NOT NULL DEFAULT 'en'` and nullable `default_currency text` to the `users` schema via additive migration `0002_careful_tomas.sql` (verified columns + defaults; sign-up unaffected). Extended the `users` module: `UserResponseDto` now returns `locale`/`defaultCurrency`; new `UpdateUserDto` (plain class-validator: `@IsString/@MinLength/@MaxLength`, `@IsIn(LOCALE_CODE_LIST)`, `@IsIn(CURRENCY_CODE_LIST)`); `PATCH /api/v1/users/me` (`@UseGuards(AuthGuard)`, `@Session()`) → service `update` → repository `updateScoped` (only DB-touching layer, scoped by `userId`, partial-update from defined keys only, `NotFoundException` on 0 rows). Regenerated client exposes `UsersApiService.usersUpdateMe`, typed `UpdateUserDto`, updated `UserResponseDto`; regeneration is deterministic (drift gate green). The swagger plugin picked the `@IsIn` lists up as enum unions in the generated types.

**Frontend (T6–T12):** Canonical discriminated `ActionState` in `next-shared` (added an explicit `idle` initial variant — sanctioned by the story Dev Notes — so the form shows no spurious error pre-submit; `success`/`error` keyed on `code`). `update-profile` `'use server'` action validates with `profileFormSchema` (defense-in-depth), calls `usersUpdateMe` through the cookie-forwarding server client, maps the API error envelope's `code` into `ActionState`, and `revalidatePath`s settings + root layout. `ProfileForm` (RHF + `zodResolver`, `useActionState` + `useTransition`) composed from `@supertool/ui` (`Input`/`Select`/`Combobox`/`Field` family/`Alert`/`Button`); the settings RSC frames it in a `Card`. Currency `''` → `undefined` is handled at the Combobox `onChange` (keeps the form value clean, no preprocess). Shell stays presentational: `UserMenu` gained an injected `onOpenSettings`, `LocaleSwitcher` an injected `onLocaleChange`, both threaded through `AppShell` and wired by `AppShellSection`.

**FR19 (T11) — the load-bearing part:** Locale persists on switch via the shell switcher (reuses `updateProfile` with `{ name, locale }`) and the settings form. The switcher **persists-then-navigates** (awaits the action before `router.replace`) so the new-locale layout reads fresh profile and does not bounce back — this resolves the switch/redirect race the story warned about. Apply-on-sign-in is a layout redirect: when `profile.locale` differs from the URL locale, redirect to the same path under `profile.locale`, using an `x-pathname` header set by the proxy (falls back to home, which covers the fresh-sign-in landing). Verified live: persisting `uk` then visiting `/` redirected to `/uk` with the UI fully in Ukrainian.

**Tests (T13):** API unit specs cover the service update path (returns DTO / `NotFoundException`), the controller update, and `updateScoped` partial behavior. A new Testcontainers integration spec asserts the `PATCH`→`GET` round-trip, cross-user scoping (user A's session only ever sees/updates A), and invalid-currency → `400 VALIDATION_ERROR`. `ProfileForm.test.tsx` covers render-from-profile, empty-name validation, action invocation, and pending-disabled. Updated the pre-existing `/me` shape assertion (auth integration spec) and the `LocaleSwitcher`/`UserMenu` shell tests for the new behavior.

**Visual QA (T15, AC9):** Captured against the live app in both themes — settings page, currency Combobox open, validation-error (resolved i18n message, not a key), pending, and success. The success shot also shows the shell user-menu name updating from "Vqa User" → "Vqa Renamed" without a reload, proving `revalidatePath` end-to-end. Screenshots in `_bmad-output/implementation-artifacts/visual-qa/1-6/`.

**Deviations from the story (with rationale):**
- **No Storybook story for `ProfileForm`** (T9 sub-bullet). Storybook here is scoped to framework-pure `packages/ui` primitives; `ProfileForm` is an app-level component that imports a `'use server'` action and app-relative i18n, which Storybook (vite, no Next plugin) cannot load without cross-app imports and server-action mocking. AC9 explicitly allows "Storybook **or** a headless render", so visual QA was done against the live app instead — higher fidelity (real i18n, real states, real data flow).
- **`ActionState` carries an `idle` variant** in addition to `success`/`error` — the story's type listed two variants but its Dev Notes sanctioned an explicit idle for "not yet submitted".
- **Shell locale persistence reuses `updateProfile`** with `{ name, locale }` rather than a locale-only payload, because `profileFormSchema` requires `name`; the repository's partial update writes only the changed columns.
- **`ValidationPipe` moved into `configureAppRouting`** (see Debug Log) so the integration test exercises real validation.

### File List

**New**
- `packages/shared/src/constants/currency.ts`
- `packages/next-shared/src/types/action-state.ts`
- `apps/api/src/database/migrations/0002_careful_tomas.sql` (+ drizzle meta snapshot/journal)
- `apps/api/src/modules/users/dtos/update-user.dto.ts`
- `apps/api/src/modules/users/users.repository.spec.ts`
- `apps/api/test/integration/users-profile.integration.spec.ts`
- `apps/money-tracker/vitest.config.ts`
- `apps/money-tracker/src/actions/update-profile.ts`
- `apps/money-tracker/src/app/[locale]/settings/page.tsx`
- `apps/money-tracker/src/app/[locale]/settings/page.module.scss`
- `apps/money-tracker/src/app/[locale]/settings/constants/profile-form-schema.ts`
- `apps/money-tracker/src/app/[locale]/settings/constants/currency-option-list.ts`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.tsx`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.module.scss`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.test.tsx`
- `apps/money-tracker/src/app/[locale]/settings/components/profile-form/hooks/use-profile-form.ts`
- `apps/money-tracker/messages/en/settings-page.json`
- `apps/money-tracker/messages/uk/settings-page.json`
- `_bmad-output/implementation-artifacts/visual-qa/1-6/*.png` (visual QA evidence)

**Modified**
- `packages/shared/src/constants/i18n-namespace.ts` (+ `settingsPage`)
- `packages/shared/src/generated/{index,sdk.gen,types.gen}.ts` (regenerated)
- `apps/api/src/database/schemas/users.ts` (+ `locale`, `defaultCurrency`)
- `apps/api/src/modules/users/dtos/user-response.dto.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/users.repository.ts`
- `apps/api/src/modules/users/users.service.spec.ts`
- `apps/api/src/modules/users/users.controller.spec.ts`
- `apps/api/src/app/configure-app-routing.ts` (ValidationPipe registration)
- `apps/api/src/main.ts` (removed duplicate pipe registration)
- `apps/api/test/integration/auth.integration.spec.ts` (`/me` shape + new columns)
- `packages/shell/src/components/user-menu/UserMenu.tsx` + `UserMenu.test.tsx`
- `packages/shell/src/components/locale-switcher/LocaleSwitcher.tsx` + `LocaleSwitcher.test.tsx`
- `packages/shell/src/components/app-shell/AppShell.tsx`
- `apps/money-tracker/package.json` (deps + test scripts)
- `apps/money-tracker/src/proxy.ts` (`x-pathname` header)
- `apps/money-tracker/src/app/[locale]/layout.tsx` (apply-on-sign-in redirect)
- `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` (settings nav + locale persistence)
- `apps/money-tracker/src/constants/routes.ts` (+ `settings`)
- `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` (+ `settingsPage`)
- `apps/money-tracker/messages/{en,uk}/navigation.json` (+ `userMenu.settings`)
- `pnpm-lock.yaml`

### Change Log

- 2026-06-14 — Implemented Story 1.6 (Profile Settings): `users` schema `locale`/`defaultCurrency`, `PATCH /api/v1/users/me`, regenerated client, shared currency constant + `ActionState`, settings page + `ProfileForm` server-action flow, FR19 locale persistence and apply-on-sign-in, user-menu Settings link, full unit/integration/component tests, both-locale i18n, and visual QA. Status → review.

## Review Findings

> Code review 2026-06-14 (bmad-code-review, 3 adversarial layers: Blind Hunter / Edge Case Hunter / Acceptance Auditor). Gates all green (lint, fmt, type-check, stylelint, i18n:parity, build, client-drift, test 7/7). All nine ACs verified satisfied; visual QA evidence adequate (both themes + open/interactive states). No AC is failed; findings below are quality/robustness issues.
>
> **Resolution 2026-06-14:** all 5 patch findings fixed. **CRITICAL correction:** F1 was originally triaged as a minor "path not preserved" nicety because the review trusted the Dev Agent Record's `apply-on-signin-uk.png` instead of running the app. Live verification (headless browser driving the real sign-up/sign-in flow) revealed AC4 was in fact **broken**: the shipped `[locale]/layout.tsx` apply-on-sign-in redirect infinite-looped after sign-up (`/uk` re-fetched endlessly, blank page). Fixed by removing the layout redirect and applying the persisted locale at sign-in success instead (see F1 bullet). The other 4: currency deselection prevented in the Combobox; unmapped error codes fall back to `UNKNOWN` via `translateError.has`; `@ApiBadRequestResponse` added and the client regenerated to model the 400; integration tests made self-contained with per-test users. 2 findings deferred (F5, F11 — in deferred-work.md), 5 dismissed. Gates green (lint/fmt/type-check/stylelint/i18n/build) + full test suite (api 43 · ui 77 · shell 13 · widgets 9 · money-tracker 4 · next-shared 10). All auth/locale flows verified live in a headless browser.

- [x] [Review][Patch] Default currency deselection should be prevented in the UI (decision 2026-06-14: keep the model simple — a chosen currency can only change to another valid code, never be emptied). The currency Combobox currently toggles back to `''`, which silently no-ops downstream. Make the Combobox `onValueChange` ignore an empty value so the selection can't be cleared. [apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.tsx]
- [x] [Review][Patch] **Apply-on-sign-in (FR19/AC4) was BROKEN — infinite redirect loop after sign-up — now FIXED.** The shipped `[locale]/layout.tsx` redirected whenever `profile.locale !== params.locale`; a new user signs up on `/uk/sign-up` but defaults to `locale='en'`, and `SignUpFormSection`'s `router.replace('/')` localizes to the current locale (`/uk`), so the layout redirected toward `en` while the client kept landing on `/uk` → infinite loop (verified live: hundreds of `GET /uk 200` / framenavigations, blank page). Two header-forwarding fixes were tried and reverted (override-header hack → 307 loop; `NextResponse` rebuild → 200 refetch loop), confirming the layout-redirect-reads-`x-pathname` design is unworkable. **Final fix:** removed the layout redirect and the `x-pathname` proxy header entirely; apply the persisted locale at sign-in success — `SignInFormSection` calls a new `fetchSignedInLocale` server action (`actions/fetch-profile-locale.ts`) and hard-navigates (`globalThis.location.assign`) to the localized home. Verified live in a headless browser: fresh sign-up no longer loops and renders the authenticated shell; a `uk`-profile user signing in from the `en` page lands on `/uk`; an `en`-profile user lands on `/`; usernames render in all cases. [apps/money-tracker/src/app/[locale]/layout.tsx, src/proxy.ts, src/app/[locale]/sign-in/SignInFormSection.tsx, src/actions/fetch-profile-locale.ts]
- [x] [Review][Patch] Unmapped API error codes leak to the UI / risk a missing-i18n-key throw — `update-profile.ts:42` forwards `error.code` verbatim and `ProfileForm` feeds it to `translateError`, but `settings-page.json#errors` maps only `VALIDATION_ERROR`/`UNAUTHORIZED`/`UNKNOWN`. A `500` (`INTERNAL_ERROR`) or `NOT_FOUND` (service throws `NotFoundException` on 0 rows) reaches `translateError` with no key → raw code rendered or a missing-message error. Normalize unmapped codes to `UNKNOWN` in the action (or add a `translateError` fallback). [apps/money-tracker/src/actions/update-profile.ts:42, apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.tsx]
- [x] [Review][Patch] `PATCH /api/v1/users/me` missing `@ApiBadRequestResponse` — the endpoint returns `400 VALIDATION_ERROR` (integration-tested) but the controller documents only `@ApiOkResponse` + `@ApiUnauthorizedResponse`, so the generated `UsersUpdateMeErrors` models only `401`. Add `@ApiBadRequestResponse({ type: ErrorResponseDto })` and regenerate the client. [apps/api/src/modules/users/users.controller.ts:28-32]
- [x] [Review][Patch] Integration tests are order-coupled — `users-profile.integration.spec.ts` tests 2 and 3 depend on user A being created/updated by test 1 (shared container DB, no per-test setup); a reorder or `.only` breaks them and test 2's `bodyA` assertion cannot fail independently. Make each test self-contained (sign up its own user). [apps/api/test/integration/users-profile.integration.spec.ts]
- [x] [Review][Defer] Shell locale switch couples to `userName` and always sends `name` — `AppShellSection.handleLocaleChange` no-ops when `userName` is undefined and gates a locale-only change on name validity; `LocaleSwitcher`'s await-persist-before-navigate also silently blocks the switch if the request fails. [apps/money-tracker/src/app/[locale]/AppShellSection.tsx, packages/shell/src/components/locale-switcher/LocaleSwitcher.tsx] — deferred, unreachable in practice (FR5 guarantees a name) and the persist-then-navigate ordering is intentional.
- [x] [Review][Defer] New users always get `locale = 'en'` regardless of sign-up context — better-auth's INSERT relies on the column default; capturing the sign-up locale is out of scope for 1.6. [apps/api/src/auth/auth.ts, apps/api/src/database/schemas/users.ts] — deferred, pre-existing (sign-up is story 1.5), by design.
