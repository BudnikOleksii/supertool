---
baseline_commit: 51b8b2f79afe540cad60f39ed6aac127f757ad6d
---

# Story 7.2: Change Password

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to change my password from settings,
so that I can rotate my credentials without admin intervention (RP-F10 — change-password).

## Context & Why This Story

This is the SECOND story of Epic 7 ("Account & Landing"). It builds entirely on the Epic 1 auth foundation (better-auth, the `SignInForm`/`SignUpForm` widgets, the `authClient`) and the Epic 7 settings surface that 7-1 just extended — it does **not** depend on any transactions surface.

supertool runs on **better-auth** (RP-D2), and better-auth ships a first-class change-password capability: `authClient.changePassword({ currentPassword, newPassword })` (client-side), backed by the mounted better-auth route `POST /api/v1/auth/change-password`. better-auth verifies the current password against the stored credential, updates it, and (by default) keeps the current and other sessions valid. This is the **exact same client mechanism** the existing `SignInForm` uses (`authClient.signIn.email`) and that `AppShellSection` already uses for sign-out (`authClient.signOut()`).

The reference (`example/track-my-life`) *does* have a change-password form (`…/settings/components/change-password-form/ChangePasswordForm.tsx`), but its app runs a **custom passwordHash auth stack**, so its form calls a bespoke **API endpoint** (`profileApiService.changePassword`) via a `'use server'` action. That path is **not** applicable to supertool: adding a hand-rolled `PATCH /users/password` endpoint would duplicate what better-auth already does (credential verification + hashing + session handling) and bypass the auth host (RP-D2). Therefore supertool uses the **better-auth-native `authClient.changePassword` client call** — consistent with sign-in/sign-up — and adds **no NestJS controller/service/repository and no DTO**, so there is **zero OpenAPI/generated-client drift** for this story. The reference is a source for the *form shape* (current + new password fields, localized errors), adapted to the authClient path, moved into a widget, and **exceeded** with a confirm-password field.

**Evidence base:** epics.md Story 7.2 (4 BDD AC blocks: submit current+new → better-auth verifies/updates with localized wrong-password error; success confirmation + session default preserved + new password works next sign-in; differentiated auth rate limiting applies; tests + i18n) + Epic 7 charter (RP-D2 better-auth stays the auth host; protect §6 clean-auth-form strength — no duplicate helper text); `reference-parity-gap-backlog.md` RP-F10 (change-password), §6 (clean auth forms to protect); the reference `ChangePasswordForm` (form shape only — endpoint path not applicable); better-auth `changePassword` docs (`POST /change-password`, error `INVALID_PASSWORD`, optional `revokeOtherSessions`).

## Recommended Approach (binding direction)

### Auth mechanism — better-auth `authClient.changePassword`, no endpoint (D-1)

- The form calls `authClient.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })` client-side inside a `useTransition`, exactly like `SignInForm` calls `authClient.signIn.email`. The client (`packages/widgets/src/auth/auth-client.ts`) already exposes `changePassword` — it is a core `emailAndPassword` client action, **no new client plugin needed** (the existing `inferAdditionalFields` client stays untouched).
- On `{ error }`, resolve a localized message key via the existing `getAuthErrorMessageKey(error)` (extended, below) and render it in a `FieldError` — never raw API text (AC 1).
- On success (`{ data }` no error), show a localized confirmation `Alert` and `reset()` the form. **Do NOT navigate or sign the user out** (session default preserved — D-3).
- **No `PATCH /users/*` password endpoint, no `authClient` server call, no `'use server'` action, no DTO, no repository/service change.** better-auth owns credential storage and verification (RP-D2). Because nothing in the NestJS OpenAPI surface changes, `packages/shared/src/generated` is byte-identical and the drift gate is a no-op (verify with `git status --porcelain packages/shared/src/generated`).

### Form location — a `ChangePasswordForm` widget (D-2)

- New widget `packages/widgets/src/components/change-password-form/ChangePasswordForm.tsx` (+ `.module.scss` + `.test.tsx`), co-located with `sign-in-form`/`sign-up-form`. It uses `authClient` (which lives in `packages/widgets` and is intentionally encapsulated there — the app only imports it for `signOut`), so the change-password authClient call stays inside `packages/widgets` like every other authClient form. CLAUDE.md: `packages/widgets` = "cross-app composed widgets (auth forms first)"; change-password is an auth form.
- Mirror `SignInForm` exactly: `'use client'`, `FC`, RHF + `zodResolver`, `useTransition` + `useState<string | null>(formErrorKey)`, `useTranslations(I18N_NAMESPACE.authShared)` for labels + `useTranslations(\`${authShared}.errors\`)` for errors, `Field`/`FieldContent`/`FieldError`/`FieldGroup`/`FieldLabel`/`FieldSet`/`FieldTitle` molecules, `Input type="password"`, `Button`. Add success via `Alert`/`AlertDescription` (atoms) + a local `isSuccess` boolean, resetting on a fresh submit — mirror the inline-Alert success/error pattern from `ProfileForm` (supertool uses inline `Alert`, **not** a toaster — do not introduce one).
- The widget is **self-contained and prop-less** for content (reads its own submit label + success text from `authShared`), so the settings page renders `<ChangePasswordForm />` directly — no `*Section` wrapper needed (unlike `SignInFormSection`, which exists only to hold app-specific post-sign-in navigation; change-password has no app-specific success logic). Precedent: the settings RSC already renders the client `<ProfileForm />` directly.
- Render it in the settings page (`apps/money-tracker/src/app/[locale]/settings/page.tsx`) inside a **second `Card`** below the existing Profile-settings Card, with a `settingsPage`-namespaced Card header (`changePasswordTitle`/`changePasswordDescription`). No route group, no new route — same page.

### Fields, schema & single-source password rule (D-4, AC 1)

- Fields (in order): **current password**, **new password**, **confirm new password** — all `type="password"`, `autoComplete` `current-password` / `new-password` / `new-password`. **Placeholder only, no `FieldDescription`** — protect the §6 clean-auth-form strength (no duplicated helper text), same as `SignInForm`.
- **Single source for the password rule (no duplication).** In `packages/widgets/src/constants/auth-form-schema.ts`, extract the currently-duplicated inline rule into one exported const and reuse it everywhere:
  ```ts
  export const passwordFieldSchema = z
    .string('passwordRequired')
    .min(MIN_PASSWORD_LENGTH, 'passwordMinLength');
  ```
  Replace the inline `password:` rule in `signInFormSchema` and `signUpFormSchema` with `password: passwordFieldSchema` (behaviour-identical — same error keys), and define:
  ```ts
  export const changePasswordFormSchema = z
    .object({
      currentPassword: passwordFieldSchema,
      newPassword: passwordFieldSchema,
      confirmPassword: z.string('passwordRequired'),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: 'passwordsMismatch',
    });
  export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
  ```
  This satisfies "reuse the sign-up password zod rules / shared schema — do not duplicate the rules": `MIN_PASSWORD_LENGTH` (8) and the min-length rule now have a single home, shared by all three auth forms and by the API (`auth.ts` `minPasswordLength: 8`). The confirm field is **new ground** (the reference has current + new only) and exceeds it (requirements: "current, new, confirm; confirm matches new").
- Weak-new-password is caught client-side by `passwordFieldSchema` (min 8) with the `passwordMinLength` error; better-auth's server-side `PASSWORD_TOO_SHORT` is a defensive backstop (mapped below) that the UI never normally reaches.

### Error mapping — extend `getAuthErrorMessageKey` (AC 1)

- In `packages/widgets/src/auth/get-auth-error-message-key.ts` add to `AUTH_ERROR_KEY_BY_CODE`:
  - `INVALID_PASSWORD: 'invalidCurrentPassword'` (better-auth's wrong-current-password code — confirmed via better-auth docs)
  - `PASSWORD_TOO_SHORT: 'passwordMinLength'` (defensive; reuses the existing key)
  The 429 → `rateLimited` and the `generic` fallback already exist and cover rate-limit + unknown cases. Add a co-located `get-auth-error-message-key.test.ts` case (or extend it) for `INVALID_PASSWORD → invalidCurrentPassword`.

### Session behaviour after change (D-3, AC 2)

- Call `changePassword` **without** `revokeOtherSessions` (default `false`). better-auth keeps the current session cookie valid and does not invalidate other sessions → FR2 per-app sessions preserved, exactly as AC 2 requires ("session behaviour follows better-auth's default"). The user stays signed in; the **new** password works on the next sign-in and the **old** one no longer does (asserted in the integration test, AC 4).
- **Divergence flag for operator (D-3):** a common security hardening is `revokeOtherSessions: true` (force re-auth elsewhere after a rotation). AC 2 explicitly binds us to better-auth's default (sessions preserved), so we do **not** revoke. Recorded here for confirmation; flip to `true` only if the operator prefers the stricter posture.

### Rate limiting — add `/change-password` custom rule (D-5, AC 3)

- AC 3 requires the "existing differentiated auth rate limiting" to apply. Today `auth.ts` `rateLimit.customRules` only covers `/sign-in/email` and `/sign-up/email`; `/change-password` would fall under the looser global limit (100 / 10s). Because change-password **verifies a current password** (a credential brute-force surface like sign-in), add it to `customRules` with the **same** window/max as sign-in/sign-up:
  ```ts
  customRules: {
    '/sign-in/email': { window: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX },
    '/sign-up/email': { window: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX },
    '/change-password': { window: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX },
  },
  ```
  This concretely realizes "differentiated auth rate limiting applies" (exceed-the-reference, security-consistent per Epic 6 retro D5) and is the **only** backend touch in this story. It is a config-only change to the module singleton — no schema, no migration, no DTO, no OpenAPI surface. Rate-limit runtime is **disabled in the integration env** (`AUTH_RATE_LIMIT_DISABLED`, Story 1.5 precedent), so the AC is met by the config addition (assertable by a light structural check), not by a flaky 429 timing test.

### i18n (D-6, AC 5)

- `authShared` namespace (`apps/money-tracker/messages/{en,uk}/auth-shared.json`) — the widget reads these. Add labels/placeholders: `currentPassword`, `currentPasswordPlaceholder`, `newPassword`, `newPasswordPlaceholder`, `confirmPassword`, `confirmPasswordPlaceholder`; the submit label `changePasswordSubmit`; the success message `passwordChangeSuccess`; and errors `errors.invalidCurrentPassword`, `errors.passwordsMismatch`. **Reuse** the existing `errors.passwordMinLength` / `errors.passwordRequired` / `errors.rateLimited` / `errors.generic` (do not duplicate).
- `settingsPage` namespace (`apps/money-tracker/messages/{en,uk}/settings-page.json`) — the settings-page Card header only. Add `changePasswordTitle`, `changePasswordDescription`.
- Real Ukrainian (e.g. `Поточний пароль` / `Новий пароль` / `Підтвердіть новий пароль`; success `Ваш пароль оновлено.`; error `Поточний пароль неправильний.` / `Паролі не збігаються.`). ICU only, both locales in the **same commit**, `pnpm i18n:parity` green. No new namespace file (both namespaces already exist).

## Acceptance Criteria

1. **Submit current + new password → better-auth verifies & updates, wrong current password fails with a localized, code-resolved error (RP-F10, NFR6, §6).** Given a signed-in user on the settings page, when they submit **current password + new password + confirm** (react-hook-form + zod, confirm must equal new), then the form calls `authClient.changePassword({ currentPassword, newPassword })` (better-auth-native client call — **no hand-written fetch, no new API endpoint, no `'use server'` action**; a hand-written fetch to auth/users is a defect, NFR6); better-auth verifies the current password and updates it; an **incorrect current password** surfaces a localized error resolved by error code (`INVALID_PASSWORD → invalidCurrentPassword` via `getAuthErrorMessageKey`), **never raw API text**; a **new password < 8 chars** is blocked client-side with the shared `passwordMinLength` message; a **confirm ≠ new** is blocked with `passwordsMismatch`. Fields are placeholder-only (no `FieldDescription` — §6 clean-auth-form strength protected).
2. **Success confirmation + session default preserved + new password works next sign-in (FR2).** Given a successful change, when it completes, then a **localized confirmation** is shown (inline `Alert`) and the form resets; `changePassword` is called **without** `revokeOtherSessions`, so better-auth's default applies — the current session stays valid (no forced sign-out) and other per-app sessions are preserved (FR2); the **new** password works on the next sign-in and the **old** one is rejected.
3. **Differentiated auth rate limiting applies (Story 1.5 carried hardening).** Given the change-password route, when requests spike, then the existing differentiated auth rate limiting covers it: `auth.ts` `rateLimit.customRules` includes `/change-password` with the same window/max as `/sign-in/email` and `/sign-up/email`. (Config-only; no schema/DTO/OpenAPI change. Runtime rate-limiting is env-disabled in tests per 1.5, so this AC is met by the config, not a timing test.)
4. **Backend tests (NFR1).** Testcontainers integration coverage (using the shared `stopIntegrationApp` teardown helper) asserts, against the mounted `POST /api/v1/auth/change-password`: (a) with a valid session + **correct** current password, the change succeeds, then **sign-in with the new password succeeds** and **sign-in with the old password fails**; (b) a **wrong current password** is rejected (better-auth error, not a success); (c) an **unauthenticated** change-password request is rejected (401/unauthorized); (d) after a successful change **without** `revokeOtherSessions`, the original session cookie still validates (`/api/v1/users/me` or `get-session` still 200 — session preserved). No `57P01`/`ProcessInterrupts` teardown error (deterministic).
5. **Frontend tests + i18n parity (NFR1, FR19/FR20).** Component tests cover the `ChangePasswordForm` widget: fields render; required + min-length validation; **confirm-mismatch** shows `passwordsMismatch`; submit calls `authClient.changePassword` with `{ currentPassword, newPassword }` (mocked authClient); a wrong-current-password error maps to the localized `invalidCurrentPassword` message; **success shows the confirmation Alert and resets the fields**; the submit button is disabled while pending; passwords are never echoed/logged. `getAuthErrorMessageKey` maps `INVALID_PASSWORD`. `auth-shared.json` + `settings-page.json` gain all new keys in **both** `en` and `uk` in the same commit (real Ukrainian, ICU only), `pnpm i18n:parity` green. All repo gates green (`TURBO_FORCE=true` where turbo may replay stale logs); OpenAPI drift gate green as a no-op (generated client byte-identical — verified with `git status --porcelain packages/shared/src/generated`).
6. **Mobile-usable (NFR8 — per-story mobile-QA check).** Given a 390px viewport, when the settings page renders the change-password form, then all three fields + the submit button are reachable and legible with no horizontal overflow (`document.documentElement.scrollWidth === window.innerWidth`) and inputs are touch-operable.
7. **Visual QA evidence — committed (epic-4 retro D1 standing pattern).** `_bmad-output/implementation-artifacts/visual-qa/7-2-change-password/` contains **light + dark × 390px + desktop** captures of: the change-password form **idle**, a **confirm-mismatch** validation-error state, a **wrong-current-password** error state (exercised live against a real session), and the **success** state, named `<scenario>--<viewport>--<theme>.png`, compared against the reference change-password form (note the divergences: authClient path not endpoint, added confirm field), with observations in the Dev Agent Record. Captured on `:3000` (pre-QA environment checklist honored — verify the `:3000` next-server cwd is THIS checkout via `lsof`), with the DB baseline restored afterward (revert any password changed during QA back to the seeded operator password).

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — study/adapt, never copy/import): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/components/change-password-form/{ChangePasswordForm.tsx,hooks/use-change-password-form.ts}`, `…/settings/constants/change-password-form-schema.ts`, `…/settings/actions/change-password.ts` (form **shape** = current + new password fields + localized errors; **endpoint path NOT applicable** — reference uses a custom-auth `profileApiService.changePassword`; supertool uses better-auth `authClient.changePassword`), `…/messages/{en,uk}/settings-page.json` (change-password label/placeholder/success key naming, incl. uk phrasing). **No reference counterpart for the authClient path or the confirm field** — new ground.
  - [x] Read in full the files this story touches: `packages/widgets/src/components/sign-in-form/SignInForm.tsx` (the pattern to mirror exactly), `packages/widgets/src/constants/auth-form-schema.ts`, `packages/widgets/src/auth/{auth-client.ts,get-auth-error-message-key.ts}` (+ its test), `apps/money-tracker/src/app/[locale]/settings/page.tsx` (+ `page.module.scss`), `apps/money-tracker/src/app/[locale]/settings/components/profile-form/ProfileForm.tsx` (inline Alert success/error pattern), `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` (existing app-side `authClient.signOut()` usage), `apps/api/src/auth/auth.ts` (rate-limit `customRules`), `apps/api/test/integration/auth.integration.spec.ts` + `apps/api/test/helpers/{auth-client.ts,http-client.ts,integration-app.ts}` (integration harness + `stopIntegrationApp`), the `authShared`/`settingsPage` message files (both locales).
- [x] **Task 2 — Shared password rule + change-password schema** (AC: 1, 5)
  - [x] `packages/widgets/src/constants/auth-form-schema.ts`: extract `passwordFieldSchema` (single source), reuse it in `signInFormSchema`/`signUpFormSchema` (behaviour-identical), add `changePasswordFormSchema` (`currentPassword`/`newPassword` = `passwordFieldSchema`, `confirmPassword` required, `.refine` → `passwordsMismatch` on `confirmPassword`) + `ChangePasswordFormValues` type.
- [x] **Task 3 — Error mapping** (AC: 1, 5)
  - [x] `packages/widgets/src/auth/get-auth-error-message-key.ts`: add `INVALID_PASSWORD → invalidCurrentPassword` and `PASSWORD_TOO_SHORT → passwordMinLength`. Extend `get-auth-error-message-key.test.ts` for the `INVALID_PASSWORD` mapping.
- [x] **Task 4 — ChangePasswordForm widget** (AC: 1, 2, 5, 6)
  - [x] New `packages/widgets/src/components/change-password-form/ChangePasswordForm.tsx` (+ `.module.scss`): mirror `SignInForm` (RHF + zod, `useTransition`, `useState` form-error key, `authShared` + `authShared.errors` translations, `Field*` molecules, `Input type="password"` with `autoComplete` current/new/new, placeholder-only). Submit → `authClient.changePassword({ currentPassword, newPassword })`; on `error` → `setFormErrorKey(getAuthErrorMessageKey(error))`; on success → show `Alert`/`AlertDescription` confirmation (`authShared.passwordChangeSuccess`) + `reset()`. Submit disabled while pending. Never log/echo passwords.
  - [x] `ChangePasswordForm.test.tsx`: fields render; required + min-length + confirm-mismatch validation; submit calls mocked `authClient.changePassword` with `{ currentPassword, newPassword }`; wrong-current-password → localized `invalidCurrentPassword`; success shows Alert + resets; pending disables submit.
- [x] **Task 5 — Settings page integration** (AC: 1, 6, 7)
  - [x] `apps/money-tracker/src/app/[locale]/settings/page.tsx`: add a second `Card` (header from `settingsPage.changePasswordTitle`/`changePasswordDescription`) rendering `<ChangePasswordForm />` below the Profile Card. Adjust `page.module.scss` only if stacking needs it (container already stacks). No route/route-group change.
- [x] **Task 6 — Rate-limit custom rule** (AC: 3)
  - [x] `apps/api/src/auth/auth.ts`: add `'/change-password': { window: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX }` to `rateLimit.customRules`. Config-only; no OpenAPI change.
- [x] **Task 7 — Backend integration tests** (AC: 4)
  - [x] `apps/api/test/integration/auth.integration.spec.ts` (or a focused `change-password.integration.spec.ts` reusing the same harness): add a change-password helper (or `postJson` to `/api/v1/auth/change-password` with the session cookie) and assert: correct-current-password change succeeds → new password signs in, old password fails; wrong current password rejected; unauthenticated request 401; original session cookie still valid after change (no `revokeOtherSessions`). Use `stopIntegrationApp` teardown (already standard). Restore/avoid clobbering `USER_A` state for other specs (use a dedicated user or re-set the password).
- [x] **Task 8 — i18n** (AC: 5)
  - [x] `messages/{en,uk}/auth-shared.json`: add current/new/confirm labels + placeholders, `changePasswordSubmit`, `passwordChangeSuccess`, `errors.invalidCurrentPassword`, `errors.passwordsMismatch`. `messages/{en,uk}/settings-page.json`: add `changePasswordTitle`, `changePasswordDescription`. Real Ukrainian; `pnpm i18n:parity` green.
- [x] **Task 9 — Gates, visual QA, record** (AC: 3, 4, 5, 6, 7)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where turbo may replay stale logs. Verify the OpenAPI drift gate is a no-op (`git status --porcelain packages/shared/src/generated` empty — no regen needed since no NestJS surface changed).
  - [x] Pre-QA environment checklist: `:3000` next-server cwd is THIS checkout (`lsof`); seed baseline clean (memory `seed-idempotent-truncate-before-reseed`); sign in as the seeded operator.
  - [x] Capture the AC-7 matrix (idle; confirm-mismatch error; wrong-current-password error exercised live; success) light+dark × 390+desktop, `<scenario>--<viewport>--<theme>.png`; verify `scrollWidth === innerWidth` at 390px; compare against the reference change-password form (note divergences). **Restore DB baseline** afterward (revert any changed password to the seeded operator password).
  - [x] Update Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Decisions made at story creation (autonomous run — operator review points)

| # | Decision | Rationale |
|---|---|---|
| D-1 | **better-auth `authClient.changePassword` (client-side), NOT a new API endpoint or `'use server'` action** | supertool is on better-auth (RP-D2), which owns credential storage/verification/hashing and ships `changePassword` natively (`POST /api/v1/auth/change-password`). Mirrors the existing `authClient.signIn.email` (SignInForm) and `authClient.signOut()` (AppShellSection) pattern. The reference's endpoint path (`profileApiService.changePassword`) exists only because its app runs a custom auth stack — adding an equivalent NestJS endpoint would duplicate better-auth and bypass the host. Consequence: **no controller/service/repository, no DTO, no OpenAPI/generated-client drift** (drift gate is a no-op). |
| D-2 | **`ChangePasswordForm` is a widget in `packages/widgets`, rendered directly in the settings page (no `*Section` wrapper)** | It uses `authClient`, which is encapsulated in `packages/widgets` (the app imports it only for `signOut`); every authClient form (sign-in, sign-up) is a widget — "auth forms first" (CLAUDE.md). No app-specific success logic (unlike sign-in's post-auth navigation), so it needs no `Section` wrapper — the settings RSC renders the client widget directly, exactly as it already renders `<ProfileForm />`. |
| D-3 | **`revokeOtherSessions` omitted (default false) — current + other sessions preserved** | AC 2 binds us to "better-auth's default (FR2 per-app sessions preserved)". User stays signed in; new password works next sign-in. **Divergence flag:** the stricter security posture is `revokeOtherSessions: true`; not chosen because the AC mandates the default — flip only on operator preference. |
| D-4 | **Single-source password rule** — extract `passwordFieldSchema` in `auth-form-schema.ts`, reuse in sign-in/sign-up/change-password; **add a confirm-password field** | Requirements: "reuse the sign-up password zod rules / shared schema — do not duplicate" and "current, new, confirm; confirm matches new". Extraction removes the current 2× inline duplication; confirm is new ground (reference has current+new only) and exceeds it. `MIN_PASSWORD_LENGTH` (8) already matches `auth.ts` `minPasswordLength`. |
| D-5 | **Add `/change-password` to `auth.ts` `rateLimit.customRules` (same 5/60s as sign-in/sign-up)** | AC 3 requires "differentiated auth rate limiting applies"; change-password is a credential brute-force surface like sign-in, but is currently only under the looser global limit. Concretely realizes the AC (exceed-the-reference, security-consistent per Epic 6 retro D5). Config-only, the sole backend touch; runtime is env-disabled in tests (1.5 precedent). |
| D-6 | **Reuse existing namespaces: widget strings in `authShared`, Card header in `settingsPage`; no new namespace file** | The widget already conventionally reads `authShared` (like SignInForm); password change is an auth operation (reusable/cross-app). The settings-page Card header is page chrome → `settingsPage`. Reuse existing `passwordMinLength`/`passwordRequired`/`rateLimited`/`generic` error keys — no duplication. |
| D-7 | **Success/error via inline `Alert` (not a toaster)** | supertool surfaces mutation feedback with inline `Alert` (ProfileForm); the reference used a `toast`, which supertool does not have. Keep the inline pattern; do not introduce a toaster dependency. |
| D-8 | **Integration tests hit the mounted better-auth route directly** (`POST /api/v1/auth/change-password`) via the existing http-client/auth-client helpers + `stopIntegrationApp` | The story adds no NestJS endpoint, so coverage targets the better-auth boundary (like the auth spec's `get-session` calls). Proves the real end-to-end behaviour (verify current → update → new password signs in, old fails; session preserved). |

### better-auth interaction — the crux (read before Task 4 & 7)

- `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions? })` is a **core `emailAndPassword` client action** — available on the existing `createAuthClient(...)` in `packages/widgets/src/auth/auth-client.ts` with **no new plugin**. It returns `{ data, error }`; `error` carries `{ code, status, message }` (consumed by `getAuthErrorMessageKey`). Requires an active session — the browser sends the same-origin `better-auth.session_token` cookie automatically (same mechanism as `authClient.signOut()`), and settings is behind the AppShell auth gate.
- **Wrong current password** → `error.code === 'INVALID_PASSWORD'` (better-auth). **Too-short new password** (server-side backstop) → `PASSWORD_TOO_SHORT`. **Rate limited** → HTTP 429 (already mapped to `rateLimited`). Never surface `error.message` raw — always map to a localized key (AC 1).
- Endpoint path is `POST /api/v1/auth/change-password` (better-auth `basePath` `/api/v1/auth` + `/change-password`). It is **not** in `openapi.json` (better-auth is mounted as a handler, not via `@nestjs/swagger` controllers), so the generated client is unaffected — confirming D-1's zero-drift claim.
- Server-side equivalent for tests: `auth.api.changePassword({ body, headers })` throws `APIError` on failure — but prefer HTTP-level assertions through the mounted route (matches the existing auth spec style and exercises the real proxy/session path).

### Current state of the system this story builds on (preserve, don't break)

- **authClient:** `packages/widgets/src/auth/auth-client.ts` = `createAuthClient({ basePath: '/api/v1/auth', plugins: [inferAdditionalFields({ user: { firstName, lastName } })] })`. Keep it as-is; `changePassword` is already exposed.
- **auth-form-schema:** `MIN_PASSWORD_LENGTH = 8`; `signInFormSchema`/`signUpFormSchema` each inline `z.string('passwordRequired').min(MIN_PASSWORD_LENGTH, 'passwordMinLength')` — this is the duplication D-4 removes. Error keys map into `authShared.errors`.
- **SignInForm (the template):** `'use client'` widget, RHF + `zodResolver`, `mode: 'onBlur'`, `useTransition`, `useState<string | null>(formErrorKey)`, `authClient.signIn.email` in the transition, `getAuthErrorMessageKey` on error, `Field*` molecules, `Button disabled={isPending}`, `noValidate`. Mirror this shape.
- **get-auth-error-message-key:** maps `INVALID_EMAIL_OR_PASSWORD`/`USER_ALREADY_EXISTS`, 429 → `rateLimited`, fallback `generic`. Extend with the two new codes.
- **settings page:** RSC (`page.tsx`) resolves `resolveOnboardedProfile(locale)`, renders one `Card` → `<ProfileForm profile={profile} />`. `ProfileForm` (client) shows inline `Alert` success/error. Add a second `Card` → `<ChangePasswordForm />`.
- **auth.ts rate limit:** global 100/10s; `customRules` for `/sign-in/email` + `/sign-up/email` at `AUTH_RATE_LIMIT_MAX=5` / `AUTH_RATE_LIMIT_WINDOW_SECONDS=60`; toggled by `AUTH_RATE_LIMIT_DISABLED`. Add `/change-password` at the same 5/60s.
- **integration harness:** `auth.integration.spec.ts` boots Testcontainers Postgres, uses `createHttpClient`/`createAuthClient` helpers (`signUp`/`signIn`/`signInForCookie`, `getJson`, `readJson`) and `extractSessionCookie`, tears down via `stopIntegrationApp({ app, container })` (the 7-1 D-F helper — already adopted by all specs; **reuse it**, do not reintroduce ad-hoc teardown).
- **i18n:** `authShared` + `settingsPage` namespaces exist in `{en,uk}`; use `translate`/`useTranslations` (never `t`), namespace via `I18N_NAMESPACE.*`.

### Reference patterns (ED1 — study, adapt, never copy/import)

- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/components/change-password-form/{ChangePasswordForm.tsx,hooks/use-change-password-form.ts}` — form **shape** (current + new password fields, localized errors, disabled-while-pending). Adapt: authClient not endpoint (D-1); widget not app-local (D-2); add confirm field (D-4); inline `Alert` not toast (D-7).
- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/constants/change-password-form-schema.ts` — schema shape (`currentPassword`/`newPassword` min-length). Adapt: single-source `passwordFieldSchema` + confirm refine.
- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/actions/change-password.ts` — **NOT applicable** (custom-auth endpoint + `'use server'` action). supertool uses the authClient path; no server action.
- `example/track-my-life/apps/money-tracker/messages/{en,uk}/settings-page.json` — change-password label/placeholder/success key naming (incl. uk phrasing) to adapt.
- **No reference counterpart — new ground:** the `authClient.changePassword` path, the confirm-password field, the `/change-password` rate-limit custom rule, the change-password widget location.

### Conventions to honor (hard rules + memories)

- **NFR6/D8:** auth op via `authClient` (better-auth) — **no hand-written fetch, no new endpoint**; generated client untouched → drift gate no-op (verify `git status --porcelain packages/shared/src/generated`).
- **Passwords:** never logged, never echoed; `type="password"`; the widget holds them only in RHF state and passes them to `authClient.changePassword`; no server action, no DTO persists them.
- **React/files:** `FC<Props>` (this widget is prop-less → `FC`); PascalCase component files + co-located `.module.scss`/`.test.tsx`; kebab-case dirs; `on*`/`handle*`; named exports, no barrels.
- **FR19/FR20:** both locales same commit; ICU; `translate` alias (never `t`); namespace via `I18N_NAMESPACE.*`.
- **SCSS:** design tokens only, camelCase classes, mobile-first, no fixed widths overflowing 390px.
- **TS:** no enums; no `as` except `as const`; single source of truth (the extracted `passwordFieldSchema`).
- **Tests:** co-located (`*.test.tsx` frontend, `*.integration.spec.ts` API); pnpm scripts only; `TURBO_FORCE=true` for gate verification (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`); reuse `stopIntegrationApp` (memory-adjacent: 7-1 D-F).
- **Branch:** `TOOLS-7-2/change-password` off `main`; conventional commits; PR via `create-pr` (memory `story-work-via-pr`).
- **Money (D1):** not relevant here — no money handling in this story.
- **NestJS DI:** the only backend touch is `auth.ts` config (module singleton, not a Nest provider) — no DI change.

### Out of scope (explicit guardrails)

- **No delete-account (7-3), no landing page (7-4), no helmet/compression (7-5), no first/last-name changes (7-1 shipped).**
- **No new NestJS endpoint / controller / service / repository / DTO / migration** — change-password is entirely better-auth (D-1).
- **No generated-client regeneration** (nothing in the OpenAPI surface changes); do not touch `packages/shared/src/generated`.
- **No `revokeOtherSessions: true`** (D-3 — AC binds to the default); no forced sign-out; no session-management UI.
- **No password-reset / forgot-password / email flows** (FR1; better-auth stays the host, RP-D2) — this story is authenticated change-password only.
- **No toaster dependency** (D-7 — inline `Alert`); no new runtime dependency of any kind.
- **No `packages/shell` / `packages/next-shared` / `packages/ui` source changes** (reuse existing `Field`/`Alert`/`Input`/`Button` primitives).
- **No change to the existing sign-in/sign-up behaviour** — the `passwordFieldSchema` extraction must be behaviour-identical (same error keys).

### Project Structure Notes

- New widget: `packages/widgets/src/components/change-password-form/{ChangePasswordForm.tsx,ChangePasswordForm.module.scss,ChangePasswordForm.test.tsx}`, beside `sign-in-form`/`sign-up-form`.
- Schema addition + `passwordFieldSchema` extraction: `packages/widgets/src/constants/auth-form-schema.ts`; error-map extension: `packages/widgets/src/auth/get-auth-error-message-key.ts` (+ test).
- Frontend page touch: `apps/money-tracker/src/app/[locale]/settings/page.tsx` (+ maybe `page.module.scss`); message files `messages/{en,uk}/{auth-shared,settings-page}.json`.
- Backend touch (config only): `apps/api/src/auth/auth.ts`; integration test in `apps/api/test/integration/`.
- No new routes, no new namespaces, no generated-client changes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2] — story statement + 4 BDD AC blocks (submit current+new → better-auth verify/update + localized code-resolved wrong-password error; success confirmation + session default preserved + new password next sign-in; differentiated auth rate limiting; tests + i18n)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — charter: RP-D2 better-auth stays the auth host, protect §6 clean-auth-form strength, D1/NFR6/D7/FR19-20/NFR1 binding, per-story mobile-QA
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-F10 (change-password), §6 strengths to protect (clean auth forms, no duplicate helper text)
- [Source: _bmad-output/planning-artifacts/architecture.md] — RP-D2 (better-auth), D5 (same-origin proxy sessions), D8 (drift gate), NFR6 (generated client / no hand fetch), new-dependency rule
- [Source: _bmad-output/implementation-artifacts/7-1-first-last-name-capture.md] — prior Epic 7 story: authClient/additional-fields wiring, `stopIntegrationApp` teardown helper (D-F), visual-QA naming + DB-baseline restore discipline, single-source-constant memory
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md] — D5 (charter hedges resolved in the exceed-the-reference direction), D4 (security-sensitive surfaces get integration tests), teardown-race fix (reuse `stopIntegrationApp`)
- [Source: packages/widgets/src/components/sign-in-form/SignInForm.tsx + src/constants/auth-form-schema.ts + src/auth/{auth-client.ts,get-auth-error-message-key.ts}] — the authClient-form pattern to mirror + single-source schema home + error mapping
- [Source: apps/money-tracker/src/app/[locale]/settings/page.tsx + components/profile-form/ProfileForm.tsx + AppShellSection.tsx] — settings-page composition (add second Card), inline-Alert feedback, existing app-side authClient usage
- [Source: apps/api/src/auth/auth.ts] — rate-limit `customRules` (add `/change-password`)
- [Source: apps/api/test/integration/auth.integration.spec.ts + test/helpers/{auth-client.ts,http-client.ts,integration-app.ts}] — integration harness, better-auth-route assertions, `stopIntegrationApp` reuse
- [Source: example/track-my-life/.../settings/components/change-password-form/** + constants/change-password-form-schema.ts + actions/change-password.ts + messages/*/settings-page.json] — reference form shape (ED1; endpoint path not applicable)
- [Source: better-auth docs — POST /change-password] — `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions? })`, error `INVALID_PASSWORD`, default sessions preserved
- [Source: .claude/rules/{react.md,i18n.md,styles.md,javascript.md,typescript.md}] — conventions

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — bmad-dev-story workflow, autonomous run.

### Debug Log References

- All repo gates run via pnpm scripts with `TURBO_FORCE=true` on turbo-backed tasks (per `turbo-cache-masks-gate-results` memory).
- OpenAPI drift gate verified as a no-op: rebuilt the API OpenAPI spec + regenerated the client, `git status --porcelain packages/shared/src/generated` and `apps/api/openapi.json` both empty (zero diff). Confirms D-1's zero-drift claim — no NestJS surface changed.
- Integration tests reuse `stopIntegrationApp` teardown (7-1 D-F helper); no `57P01`/`ProcessInterrupts` teardown error observed. Full API suite: 49 files / 417 tests pass (includes the 4 new change-password integration tests). Widgets suite: 3 files / 17 tests pass.

### Completion Notes List

Implemented change-password entirely via the better-auth-native `authClient.changePassword` client call (D-1) — no NestJS controller/service/repository/DTO, so zero OpenAPI/generated-client drift. Work matched the settled decisions D-1…D-8 without re-planning.

**Decisions recorded during this run (autonomous — operator review points):**

- **D-9 (new): new-password === current-password is NOT rejected.** The reference `change-password-form-schema.ts` enforces only min-length on both fields and has no new≠current refine; the story's binding `changePasswordFormSchema` (D-4) likewise does not include it. To stay behaviour-consistent with the reference and the story's stated schema (and avoid over-engineering an unrequested rule), `changePasswordFormSchema` enforces `confirmPassword === newPassword` only. better-auth accepts re-setting the same password. Flip to add a `newPassword !== currentPassword` refine only on operator preference.
- **Settings page container changed from centered flex-row to `flex-direction: column` + `gap` (`align-items: center`).** The original `.container` was a single-child centered flex row; adding the second Card would have placed the two Cards side-by-side. Switched to a centered vertical stack (each Card keeps `max-width: 32rem`) — the minimal change to render Profile + Change-password Cards stacked at all widths. (Story Task 5 explicitly permitted adjusting `page.module.scss` "if stacking needs it".)
- **`get-auth-error-message-key.test.ts` was created (did not previously exist).** The story allowed "add a co-located test (or extend it)". New spec covers all mapped codes incl. `INVALID_PASSWORD → invalidCurrentPassword` and `PASSWORD_TOO_SHORT → passwordMinLength`.

**Gate results (all green):** `pnpm type-check` PASS · `pnpm lint` PASS · `pnpm stylelint` PASS · `pnpm fmt:check` PASS · `pnpm test` PASS (417 API + 17 widgets + rest) · `pnpm i18n:parity` PASS · `pnpm build` PASS · OpenAPI drift gate NO-OP (byte-identical generated client + openapi.json).

**Security:** passwords are held only in RHF state and passed to `authClient.changePassword`; never logged, echoed, placed in URLs, or surfaced as raw better-auth text. Wrong-current-password → `INVALID_PASSWORD` → localized `invalidCurrentPassword` via `getAuthErrorMessageKey`; weak → client-side `passwordMinLength`; mismatch → `passwordsMismatch`; 429 → `rateLimited`.

**Visual QA (AC 6, 7) — captured on `:3000` (dev server for THIS checkout; verified the stale production `next-server` was replaced so fresh code is served; `lsof` confirmed cwd).** DB baseline confirmed before + after (1880 transactions, latest 2025-02-03, 110 categories, operator `onboarding_completed=true`). A throwaway non-operator user (`qa-throwaway-7-2@example.com`) was created + onboarded for the live captures; the seeded operator password was NEVER changed. Live end-to-end check via the mounted route: change succeeded (200), the new password signed in (200), the old password was rejected (401); the throwaway password was then reset for UI captures. Full 16-shot matrix saved to `_bmad-output/implementation-artifacts/visual-qa/7-2-change-password/` as `<scenario>--<viewport>--<theme>.png` — scenarios idle / confirm-mismatch / wrong-current-password / success × {desktop, 390} × {light, dark}, each visually inspected:

- idle: three placeholder-only fields (no FieldDescription — §6 clean-auth-form strength preserved) + "Change password" submit, in a second Card below Profile settings.
- confirm-mismatch: "Passwords do not match" under the confirm field (error state on the field).
- wrong-current-password (exercised live): form-level "Your current password is incorrect" — code-resolved, never raw API text.
- success: inline "Your password has been updated." Alert with the form reset (no toaster — D-7).
- 390px overflow check: `document.documentElement.scrollWidth === window.innerWidth` (390/390) in both themes — no horizontal overflow; fields touch-legible.

QA note: rapid back-to-back submissions during the first mobile pass tripped the running dist API's rate limit (that build predates the `/change-password` custom rule and had rate-limiting enabled), surfacing the localized "Too many attempts. Please try again later." (rateLimited) message — a correct code path, but not the intended state; the three affected mobile shots were recaptured cleanly after the window cleared and re-inspected.

**Cleanup:** throwaway user + its sessions/accounts deleted; DB baseline re-verified intact; operator sign-in with the `.env.example` password returns 200.

### File List

New:
- `packages/widgets/src/components/change-password-form/ChangePasswordForm.tsx`
- `packages/widgets/src/components/change-password-form/ChangePasswordForm.module.scss`
- `packages/widgets/src/components/change-password-form/ChangePasswordForm.test.tsx`
- `packages/widgets/src/auth/get-auth-error-message-key.test.ts`
- `apps/api/test/integration/change-password.integration.spec.ts`
- `_bmad-output/implementation-artifacts/visual-qa/7-2-change-password/*.png` (16 captures)

Modified:
- `packages/widgets/src/constants/auth-form-schema.ts` (extract `passwordFieldSchema`; add `changePasswordFormSchema` + `ChangePasswordFormValues`)
- `packages/widgets/src/auth/get-auth-error-message-key.ts` (map `INVALID_PASSWORD`, `PASSWORD_TOO_SHORT`)
- `apps/money-tracker/src/app/[locale]/settings/page.tsx` (second Card rendering `<ChangePasswordForm />`)
- `apps/money-tracker/src/app/[locale]/settings/page.module.scss` (vertical stacking of Cards)
- `apps/api/src/auth/auth.ts` (add `/change-password` rate-limit custom rule)
- `apps/money-tracker/messages/en/auth-shared.json`, `apps/money-tracker/messages/uk/auth-shared.json`
- `apps/money-tracker/messages/en/settings-page.json`, `apps/money-tracker/messages/uk/settings-page.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (7-2 → in-progress → review)
- `_bmad-output/implementation-artifacts/7-2-change-password.md` (this file)

### Change Log

- 2026-07-05: Implemented Story 7.2 (change password) — better-auth `authClient.changePassword` `ChangePasswordForm` widget on the settings page, single-source `passwordFieldSchema` reused across all three auth forms, confirm-password field, `INVALID_PASSWORD`/`PASSWORD_TOO_SHORT` error mapping, `/change-password` auth rate-limit rule, en+uk i18n, widget + integration tests, 16-shot visual-QA matrix. All gates green; OpenAPI drift gate no-op. Status → review.
