---
baseline_commit: 3ca1cbbf6f086ab44c5c7da70ce823e9e2c15434
---

# Story 7.3: Delete Account

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to delete my account and all my data after an explicit confirmation,
so that I can remove myself from the platform cleanly (RP-F10 — delete-account).

## Context & Why This Story

This is the THIRD story of Epic 7 ("Account & Landing"). Like 7-1 (first/last name) and 7-2 (change password) it builds on the Epic 1 auth/profile foundation (better-auth, the `users` module, the settings page) and does **not** depend on any transactions surface for its trigger — but it is the app's **most destructive operation**: it removes the user AND all of the user's data (transactions, transaction_categories, sessions, accounts, and the user row).

**This is the epic's second destructive operation** (after 6-2 bulk delete) and its first **account-deletion cascade** — the Epic 6 retro explicitly flagged 7-3 as "the point at which cascading deletes across transactions/categories/analytics-cache should be considered" (the 6-5 cache's `invalidateUser` and a full user-data purge intersect here). Per the Epic 6 retro D4, every security-sensitive/destructive surface ships a dedicated integration test proving the safety property; this story's safety properties are **cascade completeness (no orphans)**, **no cross-user impact**, and **session termination**.

**The cascade correctness is the crux.** The data model uses a mix of `ON DELETE CASCADE` and `ON DELETE RESTRICT` foreign keys (evidence table below). A naive `DELETE FROM users WHERE id = X` is **unreliable / will error** because two `RESTRICT` FKs (transactions → categories composite; categories self-referential parent) are checked immediately and Postgres does not guarantee it deletes the referencing rows before the referenced rows in a sibling cascade. Deletion therefore MUST perform an **explicit, ordered purge inside one DB transaction** (children before parents) before the user row is removed.

**Mechanism decision (D-1): a custom user-scoped `DELETE /api/v1/users/me` endpoint (controller → service → repository), NOT better-auth's `deleteUser` plugin.** supertool runs on better-auth (RP-D2) and better-auth *does* ship a `user.deleteUser` capability (`authClient.deleteUser({ password })` backed by a `beforeDelete`/`afterDelete` hook). We deliberately do **not** use it here — see D-1 rationale below. In short: the dangerous multi-table transactional cascade must live in a properly-injected, unit- and integration-tested **repository** (hard rule D7), and better-auth's `beforeDelete` hook runs at module-load time in `auth.ts` outside Nest DI, so it cannot cleanly own or test that purge. The `users` module already owns the `users` table (reads/writes via `UsersRepository`, established in 1.6 / 7-1), so a scoped delete on `/users/me` is the natural, testable extension. This **diverges from 7-2's "authClient-native, no endpoint, zero drift" precedent** and is flagged for operator confirmation (D-1). Consequence, opposite to 7-2: this story **regenerates the generated client** (new `usersDeleteMe` op) and the **drift gate is a real green-after-regenerate check, not a no-op**.

**Evidence base:** epics.md Story 7.3 (4 BDD AC blocks: explicit confirm dialog — no single-click; delete via better-auth + user-data cascade with no orphans + session ends + signed-out/landing state; only the authenticated user's data affected — integration-tested; tests + component test for the confirm dialog + both locales) + Epic 7 charter (RP-D2 better-auth stays the auth host; per-story mobile-QA; D1/NFR6/D7/FR19-20/NFR1 binding); `reference-parity-gap-backlog.md` RP-F10 (delete-account with confirm dialog); the reference `DeleteAccountSection` + `delete-account.ts` action + `delete-account-form-schema.ts` (form/AlertDialog **shape** — its custom-auth endpoint + soft-delete + password-reentry are adapted, not copied); Epic 6 retro (D4 destructive surface = dedicated integration test; the 7-3 cascade + analytics-cache intersection; reuse `stopIntegrationApp`).

## Recommended Approach (binding direction)

### Deletion mechanism — custom `DELETE /api/v1/users/me`, repository-owned transactional cascade (D-1)

- **Endpoint:** `DELETE /api/v1/users/me` on the existing `UsersController` — `@UseGuards(AuthGuard)`, `@HttpCode(HTTP_STATUS_CODE.NoContent)` (204), `@ApiNoContentResponse()`, `@ApiUnauthorizedResponse({ type: ErrorResponseDto })`. **No `:id` param, no request body, no DTO** — the acting user is taken from `@Session() session` (`session.user.id`); a client can only ever delete **its own** account (D-4). Mirror the `transactions.controller.ts` `remove()` 204 shape exactly.
- **Service:** `UsersService.deleteAccount(userId)` → calls `usersRepository.deleteAccountScoped(userId)` (the ordered transactional purge), then `analyticsCache.invalidateUser(userId)` **after** the transaction commits (D-3). Inject `AnalyticsCacheService` (add it to `UsersModule` imports/providers wiring — see Project Structure Notes; it is already an `@Injectable` used by transactions/analytics).
- **Repository:** `UsersRepository.deleteAccountScoped(userId)` runs everything inside one `this.db.transaction(async (tx) => { ... })` (pattern: `transaction-categories.repository.ts` `createDefaults`) in the ordered-cascade sequence (D-2). It touches only the acting user's rows (`eq(users.id, userId)` / `eq(<table>.userId, userId)`).
- **No better-auth `deleteUser` plugin, no `authClient.deleteUser`, no `beforeDelete`/`afterDelete` hook, no change to `auth.ts`.** Deleting the `users` row via the repository is consistent with the `users` module already owning that table (7-1/1.6); better-auth is only an adapter over these tables and holds no state beyond them, so removing the row (and cascading its sessions/accounts) leaves better-auth consistent. RP-D2 ("better-auth stays the **auth host**") is about auth **operations** (sign-in/up/password), which are untouched.

### Ordered cascade — the correctness crux (D-2)

FK / `onDelete` reality (verified in `apps/api/src/database/schemas/`):

| Referencing table.column | References | onDelete | Implication for user deletion |
|---|---|---|---|
| `transactions.user_id` | `users.id` | **cascade** | removed when user row deleted |
| `transaction_categories.user_id` | `users.id` | **cascade** | removed when user row deleted |
| `sessions.user_id` | `users.id` | **cascade** | removed when user row deleted (ends session) |
| `accounts.user_id` | `users.id` | **cascade** | removed when user row deleted (better-auth credential) |
| `transactions (user_id, category_id)` | `transaction_categories (user_id, id)` | **restrict** | blocks deleting a category still referenced by a transaction |
| `transaction_categories.parent_id` | `transaction_categories.id` | **restrict** | blocks deleting a parent category still referenced by a child |
| `verifications` | (no user FK — `identifier`-based transient tokens) | n/a | not user-scoped; not touched by this story |

Because the two `restrict` FKs are checked immediately (not deferrable), a bare `DELETE FROM users` is unreliable. The repository transaction MUST purge in dependency order:

1. `DELETE FROM transactions WHERE user_id = X` — removes the transactions → categories restrict dependency first.
2. `UPDATE transaction_categories SET parent_id = NULL WHERE user_id = X`, **then** `DELETE FROM transaction_categories WHERE user_id = X` — nulling parents first neutralizes the self-referential parent restrict so a single bulk category delete succeeds (deterministic; avoids leaf-first recursion). (Both statements user-scoped.)
3. `DELETE FROM users WHERE id = X` — now the only remaining FKs are the `cascade` ones (sessions, accounts), which delete cleanly.

All three steps in ONE `db.transaction` for atomicity (all-or-nothing). `verifications` is intentionally not touched (no user linkage; transient). The integration test MUST seed the deleting user with a **two-level category hierarchy AND transactions referencing those categories**, so the RESTRICT-FK path is actually exercised — a naive `DELETE FROM users` would fail on that data, proving the ordering is required (AC 4).

### Analytics cache purge (D-3)

- After the transaction commits, the service calls `analyticsCache.invalidateUser(userId)` — same call sites as every transactions/import mutation (`transactions.service.ts`, `transactions-import.service.ts`). This closes the 6-5-cache ↔ user-purge intersection the Epic 6 retro flagged. Assert it in the service unit spec (spy on `invalidateUser`).

### User-scoping — session only, never a client id (D-4)

- The endpoint is `/users/me`; `userId` is **always** `session.user.id` from `@Session()`. There is **no** id path/query/body param a client could supply. Repository deletes are all `WHERE user_id = <sessionUserId>` (or `users.id = <sessionUserId>`). Unauthenticated requests are rejected by `AuthGuard` (401). The integration test proves user B's rows are completely untouched and that an unauthenticated `DELETE /users/me` returns 401 (AC 3, AC 4).

### Confirmation gate — AlertDialog + type-to-confirm (D-5)

- Use the design-system `alert-dialog` molecule (`packages/ui/src/components/molecules/alert-dialog/AlertDialog.tsx`) — the same confirm pattern the reference uses. The trigger is a **destructive-variant** `Button` in a "Danger Zone" card. Opening the dialog is step one; a **type-to-confirm** field is step two: the user must type their **exact email address**; the confirm button (destructive variant) stays **disabled until the typed value equals the user's email** (react-hook-form + zod `.refine`). `Cancel` (or overlay/Escape) closes the dialog and `reset()`s the field — no deletion. This is a strong, irreversible-appropriate gate: no single-click destructive action (AC 1).
- **Divergence flag for operator (D-5):** the reference re-enters the **password**; supertool uses **type-to-confirm (email match)** instead, because supertool has no clean server-side password-verification path outside better-auth's own auth flows (we deliberately did not adopt better-auth `deleteUser`, D-1), and type-to-confirm is an equally strong, task-sanctioned confirmation for an irreversible action. Recorded for confirmation; a password-re-entry variant could be added later only if a credential-verify path is wired.

### Post-delete — sign out + redirect (D-6)

- `DeleteAccountSection` (client component) → on matched confirm, calls a `'use server'` action `deleteAccount()` (react-hook-form submit inside a `useTransition`/`isSubmitting`), which calls the generated client `UsersApiService.usersDeleteMe({ client: createServerApiClient({ cookieHeader }) })` (NFR6 — no hand-written fetch; cookie forwarded server-direct per D5). Mirror the shape of `update-profile.ts` / `bulk-delete-transactions.ts` (cookie via `await cookies()`).
- On success: clear the better-auth session cookie(s) server-side for hygiene (`(await cookies()).delete(...)` for the better-auth session token) and `redirect({ href: ROUTES.signIn, locale })` (next-intl `redirect` from `@supertool/next-shared/src/i18n/navigation/navigation`). The session row is already gone (deleted in the cascade), so the session is invalid regardless; the redirect lands the user on the signed-out sign-in page (AC 2 "signed-out/landing state"). The client submit handler must **re-throw redirect errors** (`isRedirectError`) so the Next redirect propagates (reference precedent).
- On error (no redirect thrown): surface an inline **`Alert variant="destructive"`** message (supertool's inline-Alert feedback pattern from `ProfileForm`) — **not a toaster** (D-7). Do not close the dialog on error.

### Component location — app-local settings component, "Danger Zone" card (D-7)

- `DeleteAccountSection` is an **app-local settings component** at `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/DeleteAccountSection.tsx` (+ `.module.scss` + `.test.tsx`) — beside `profile-form/`, mirroring the reference's `settings/components/delete-account-section/` location. It is **NOT** a `packages/widgets` widget (unlike `ChangePasswordForm`): it consumes the **generated client via a `'use server'` action** (an app concern) rather than `authClient`, and it depends on app routing (`ROUTES`, `redirect`). This matches `ProfileForm` (app-local, uses server action + generated client).
- Render it in the settings page (`apps/money-tracker/src/app/[locale]/settings/page.tsx`) inside a **third `Card`** below the existing Profile and Change-password cards, styled as a "Danger Zone" (destructive accent) with a `settingsPage`-namespaced header. No route group, no new route — same page. The container already stacks (7-2 changed it to a vertical column).

### Feedback — inline Alert, no toaster (D-7 continued)

- supertool surfaces mutation feedback with inline `Alert`/`AlertDescription` (ProfileForm, ChangePasswordForm). The reference uses `toast.error`; supertool has no toaster. Keep the inline pattern; introduce no toaster dependency.

### i18n (D-8, AC 5)

- `settingsPage` namespace (`apps/money-tracker/messages/{en,uk}/settings-page.json`) — the section lives on the settings page. Add: `dangerZoneTitle`, `dangerZoneDescription`, `deleteAccountButton`, `deleteAccountTitle`, `deleteAccountDescription`, `deleteAccountConfirmLabel` (type-to-confirm field label, e.g. "Type your email to confirm"), `deleteAccountConfirmPlaceholder`, `deleteAccountConfirmButton`, `cancelButton`, and `errors.deleteAccountFailed` (+ reuse the existing `errors.UNAUTHORIZED` / `errors.UNKNOWN` where they apply). The zod refine message key `emailMismatch` goes under `settingsPage.errors`.
- Real Ukrainian (e.g. title `Видалити акаунт`; description makes the irreversibility explicit; confirm label `Введіть свою електронну пошту для підтвердження`; button `Видалити мій акаунт`; cancel `Скасувати`; error `Не вдалося видалити акаунт. Спробуйте ще раз.`; mismatch `Електронна пошта не збігається.`). ICU only; both locales in the **same commit**; `pnpm i18n:parity` green. No new namespace file (`settings-page.json` already exists).

## Acceptance Criteria

1. **Explicit confirmation gate — no single-click destructive action (RP-F10; design-system `alert-dialog`).** Given a signed-in user on the settings page, when they choose "Delete account", then the design-system `alert-dialog` molecule opens requiring an explicit second step: a **type-to-confirm** field where the user must type their **exact email address**; the destructive confirm button is **disabled/blocked until the typed value matches** (react-hook-form + zod), and a mismatch shows a localized `emailMismatch` error. Cancel / overlay / Escape closes the dialog and resets the field with **no deletion**. There is no path that deletes the account in a single click.
2. **Delete executes → account + all user data removed (no orphans), session ends, signed-out/landing state (FR21).** Given confirmation, when delete executes, then the app calls `DELETE /api/v1/users/me` **through the generated client** (via a `'use server'` action — no hand-written fetch, NFR6; a hand-written fetch is a defect); the endpoint deletes, **user-scoped and in one DB transaction**, the acting user's `transactions`, then `transaction_categories` (parents nulled then removed — respecting the RESTRICT FKs), then the `users` row (cascading `sessions` + `accounts`), leaving **no orphaned per-user data**; the analytics cache is invalidated for that user; the endpoint returns **204**; the session is terminated (the session row is gone) and the user is redirected to a **signed-out sign-in/landing state** (the better-auth session cookie is cleared server-side for hygiene). On error the dialog stays open and shows a localized inline `Alert` (no toaster).
3. **Only the authenticated user's data is affected — no cross-user deletion path (FR21).** Given another user's data, when a delete is processed, then **only** the acting user's rows are removed (`userId` is always taken from `@Session()`, never a client-supplied id; the endpoint is `/users/me` with no id param and no body). An **unauthenticated** `DELETE /api/v1/users/me` is rejected (401) by `AuthGuard`. Asserted by an integration test (user B's transactions/categories/sessions/accounts/user row all intact; unauth → 401).
4. **Backend tests — cascade completeness + scoping + session termination (NFR1; Epic 6 retro D4).** Testcontainers integration coverage (using the shared `stopIntegrationApp` teardown helper) seeds **two** users; the deleting user (A) is seeded with a **two-level category hierarchy AND transactions referencing those categories** (so the RESTRICT-FK ordering is genuinely exercised — a naive `DELETE FROM users` would fail on this data). It asserts: (a) `DELETE /api/v1/users/me` as A returns 204 and A's `transactions`, `transaction_categories`, `sessions`, `accounts`, and `users` rows are **all gone** (row counts = 0 — no orphans); (b) user B's `transactions`, `transaction_categories`, `sessions`, `accounts`, and `users` row are **completely intact** (counts unchanged); (c) A's session cookie no longer validates afterward (`GET /api/v1/users/me` with the old cookie → 401 — session terminated); (d) an **unauthenticated** `DELETE /api/v1/users/me` → 401. Service unit spec asserts `analyticsCache.invalidateUser(userId)` is called after a successful delete; controller spec asserts the 204 route passes `session.user.id` to the service. No `57P01`/`ProcessInterrupts` teardown error (deterministic — reuse `stopIntegrationApp`).
5. **Frontend tests + i18n parity (NFR1, FR19/FR20).** Component tests cover `DeleteAccountSection`: the trigger opens the dialog; the confirm button is disabled until the typed value equals the user's email; a wrong value keeps it disabled / shows `emailMismatch`; **cancel aborts** (closes + resets, no action call); a matched confirm calls the mocked `deleteAccount` action; an error result renders the localized inline `Alert` and keeps the dialog open. The `deleteAccount` server action test mocks the generated client + `redirect` and asserts it calls `UsersApiService.usersDeleteMe` and redirects to sign-in on success (and returns/handles the error branch). `settings-page.json` gains all new keys in **both** `en` and `uk` in the same commit (real Ukrainian, ICU only); `pnpm i18n:parity` green. All repo gates green (`TURBO_FORCE=true` where turbo may replay stale logs); **OpenAPI drift gate green after regenerating the client** (the new `usersDeleteMe` op is present and committed — verify with `git status --porcelain packages/shared/src/generated` clean after regen, i.e. no *further* diff).
6. **Mobile-usable (NFR8 — per-story mobile-QA check).** Given a 390px viewport, when the settings page renders the Danger Zone and its open confirm dialog, then the section, the trigger, the dialog, the type-to-confirm field, and the Cancel/Confirm buttons are reachable, legible, and touch-operable with no horizontal overflow (`document.documentElement.scrollWidth === window.innerWidth`).
7. **Visual QA evidence — committed (epic-4 retro D1 standing pattern).** `_bmad-output/implementation-artifacts/visual-qa/7-3-delete-account/` contains **light + dark × 390px + desktop** captures of: the **Danger Zone card** (idle), the **confirm dialog open** (empty), the dialog with a **mismatched** typed value (confirm disabled / `emailMismatch`), the dialog with a **matching** typed value (confirm enabled), and the **post-delete signed-out landing** (sign-in page), named `<scenario>--<viewport>--<theme>.png`, compared against the reference delete-account section (note the divergences: custom endpoint via generated client vs custom-auth apiService; type-to-confirm vs password re-entry; inline Alert vs toast), with observations in the Dev Agent Record. **DESTRUCTIVE-QA SAFETY: exercise the real delete only against a THROWAWAY user — never the seeded operator.** Captured on `:3000` (verify the `:3000` next-server cwd is THIS checkout via `lsof`); after any live delete, re-verify the seed DB baseline is intact (1880 transactions, latest 2025-02-03, ~110 categories, operator `onboarding_completed=true`, operator sign-in with the `.env.example` password returns 200) and re-seed if needed.

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — study/adapt, never copy/import): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/components/delete-account-section/{DeleteAccountSection.tsx,DeleteAccountSection.module.scss}`, `…/settings/constants/delete-account-form-schema.ts`, `…/settings/actions/delete-account.ts`, `…/messages/{en,uk}/settings-page.json` (delete/dangerZone key naming incl. uk phrasing). **Adapt, do not copy:** AlertDialog + destructive-button + confirm-field **shape** is the reference; but supertool uses a **custom `DELETE /users/me` via the generated client** (not the reference's custom-auth `profileApiService.deleteAccount`), **type-to-confirm (email)** not password (D-5), **inline Alert** not toast (D-7), and a **hard cascade** not the reference's soft-delete. Reference backend (context only, custom-auth stack — NOT applicable): `example/tracker-backend-api/src/modules/profile/{profile.controller.ts,profile.service.ts}` (`deleteAccount` → `userService.softDelete` + session-invalidation event).
  - [x] Read in full the files this story touches: `apps/api/src/modules/users/{users.controller.ts,users.service.ts,users.repository.ts,users.module.ts}`; `apps/api/src/modules/transactions/transactions.controller.ts` (the `@Delete` 204 shape to mirror) + `transactions.service.ts` (`analyticsCache.invalidateUser` call site); `apps/api/src/modules/transaction-categories/transaction-categories.repository.ts` (`db.transaction` pattern); `apps/api/src/modules/analytics/analytics-cache.service.ts` + `analytics-cache.module.ts`/`analytics.module.ts` (how `AnalyticsCacheService` is provided/exported for DI); `apps/api/src/database/schemas/{users,transactions,transaction-categories,sessions,accounts,verifications}.ts` (FK/onDelete — the cascade crux); `apps/api/src/shared/guards/auth.guard.ts` (401 for unauth); `apps/api/src/shared/constants/http-status-code.ts` (`HTTP_STATUS_CODE.NoContent`); an integration spec + helpers `apps/api/test/integration/{transactions,users-profile}.integration.spec.ts` + `apps/api/test/helpers/{integration-app.ts (stopIntegrationApp),postgres-container.ts,http-client.ts,auth-client.ts}`. Frontend: `apps/money-tracker/src/app/[locale]/settings/page.tsx`, `.../settings/components/profile-form/ProfileForm.tsx` (inline-Alert + app-local component pattern), `apps/money-tracker/src/actions/{update-profile.ts,bulk-delete-transactions.ts}` (server action + generated client + cookie forwarding), `apps/money-tracker/src/constants/routes.ts`, `packages/next-shared/src/i18n/navigation/navigation.ts` (`redirect`), `packages/ui/src/components/molecules/alert-dialog/AlertDialog.tsx` (exported parts), the `settings-page.json` files (both locales).
- [x] **Task 2 — Backend: repository ordered-cascade purge** (AC: 2, 3, 4)
  - [x] `apps/api/src/modules/users/users.repository.ts`: add `deleteAccountScoped(userId: string): Promise<void>` running one `this.db.transaction(async (tx) => { ... })` performing, in order: (1) delete `transactions` where `userId`; (2) `update transaction_categories set parentId = null` where `userId`, then delete `transaction_categories` where `userId`; (3) delete `users` where `id = userId` (cascade removes sessions + accounts). All statements user-scoped. Do not touch `verifications`.
- [x] **Task 3 — Backend: service + cache invalidation** (AC: 2, 4)
  - [x] `apps/api/src/modules/users/users.service.ts`: add `deleteAccount(userId)` → `await this.usersRepository.deleteAccountScoped(userId)` then `this.analyticsCache.invalidateUser(userId)`. Inject `AnalyticsCacheService` with explicit `@Inject(AnalyticsCacheService)` (Nest DI hard rule — never `import type` an injectable).
  - [x] `apps/api/src/modules/users/users.module.ts`: import the module that provides `AnalyticsCacheService` (e.g. `AnalyticsCacheModule`) so it resolves in `UsersService` DI (confirm the export path from `analytics-cache.module.ts`).
- [x] **Task 4 — Backend: controller endpoint** (AC: 2, 3)
  - [x] `apps/api/src/modules/users/users.controller.ts`: add `@Delete('me') @UseGuards(AuthGuard) @HttpCode(HTTP_STATUS_CODE.NoContent) @ApiNoContentResponse() @ApiUnauthorizedResponse({ type: ErrorResponseDto })` → `deleteMe(@Session() session: UserSession<typeof auth>): Promise<void> { await this.usersService.deleteAccount(session.user.id); }`. No body, no DTO, no id param.
- [x] **Task 5 — Regenerate the generated client + verify drift** (AC: 2, 5)
  - [x] Rebuild the API OpenAPI spec and regenerate the client so `UsersApiService.usersDeleteMe` exists in `packages/shared/src/generated`; commit the regenerated client. Verify the drift gate is green (regenerate again → `git status --porcelain packages/shared/src/generated` and `apps/api/openapi.json` clean, i.e. no further diff). (Real regeneration this story — contrast 7-2's no-op.)
- [x] **Task 6 — Frontend: server action** (AC: 2, 5)
  - [x] `apps/money-tracker/src/actions/delete-account.ts` (`'use server'`): read cookies (`await cookies()`), call `UsersApiService.usersDeleteMe({ client: createServerApiClient({ cookieHeader }) })`; on `error` return a discriminated error result (do not redirect); on success clear the better-auth session cookie(s) via `cookies()` then `redirect({ href: ROUTES.signIn, locale })` (locale via `getLocale()`), letting the `NEXT_REDIRECT` propagate. Add `delete-account.test.ts` mocking the generated client + `redirect` (success redirects; error returns the error branch).
- [x] **Task 7 — Frontend: DeleteAccountSection component** (AC: 1, 2, 5, 6)
  - [x] `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/DeleteAccountSection.tsx` (+ `.module.scss`): `'use client'`, `FC`. Props: the user's email (passed from the settings RSC — see Task 8). AlertDialog with a destructive-variant trigger `Button`; header (title + irreversible description); a react-hook-form + zod type-to-confirm field (`Input`, `Field*`) whose `.refine` requires the typed value to equal the email (`emailMismatch` on failure); destructive confirm `Button` disabled until valid + while pending; `Cancel` closes + `reset()`s; on matched submit call the `deleteAccount` action inside a transition (re-throw redirect errors via `isRedirectError`); on error render inline `Alert variant="destructive"` and keep the dialog open. Never single-click delete.
  - [x] `DeleteAccountSection.test.tsx`: trigger opens dialog; confirm disabled until email matches; wrong value → disabled / `emailMismatch`; cancel aborts (no action call, field reset); matched confirm calls mocked `deleteAccount`; error result → inline Alert shown + dialog stays open.
- [x] **Task 8 — Frontend: settings page integration** (AC: 1, 6, 7)
  - [x] `apps/money-tracker/src/app/[locale]/settings/page.tsx`: add a third "Danger Zone" `Card` below Profile + Change-password, header from `settingsPage.dangerZoneTitle`/`dangerZoneDescription`, rendering `<DeleteAccountSection email={profile.email} />` (`profile` already resolved via `resolveOnboardedProfile`; `email` is on `UserResponseDto`). Style the card's destructive accent in `page.module.scss` if needed (container already stacks).
- [x] **Task 9 — Backend integration + unit tests** (AC: 3, 4)
  - [x] `apps/api/test/integration/delete-account.integration.spec.ts` (reuse the harness + `stopIntegrationApp`): sign up/in user A and user B; seed A with a two-level category hierarchy + transactions referencing those categories (via the API or direct inserts through the app), and give B its own categories + transactions. `DELETE /api/v1/users/me` as A → 204; assert A's rows all gone (transactions/categories/sessions/accounts/users = 0) and B's all intact; A's old session cookie → `GET /users/me` 401; unauthenticated `DELETE /users/me` → 401.
  - [x] `apps/api/src/modules/users/users.service.spec.ts`: `deleteAccount` calls `deleteAccountScoped` then `invalidateUser(userId)` (spy). `apps/api/src/modules/users/users.controller.spec.ts`: `deleteMe` passes `session.user.id` to the service and returns void/204.
- [x] **Task 10 — i18n** (AC: 5)
  - [x] `messages/{en,uk}/settings-page.json`: add `dangerZoneTitle`, `dangerZoneDescription`, `deleteAccountButton`, `deleteAccountTitle`, `deleteAccountDescription`, `deleteAccountConfirmLabel`, `deleteAccountConfirmPlaceholder`, `deleteAccountConfirmButton`, `cancelButton`, `errors.deleteAccountFailed`, `errors.emailMismatch`. Real Ukrainian; reuse existing `errors.UNAUTHORIZED`/`errors.UNKNOWN` where applicable; `pnpm i18n:parity` green.
- [x] **Task 11 — Gates, visual QA, record** (AC: 4, 5, 6, 7)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where turbo may replay stale logs. Verify the OpenAPI drift gate is green **after** regenerating the client (`usersDeleteMe` committed).
  - [x] Pre-QA environment checklist: `:3000` next-server cwd is THIS checkout (`lsof`); seed baseline clean (memory `seed-idempotent-truncate-before-reseed`).
  - [x] Capture the AC-7 matrix (Danger Zone idle; dialog open empty; mismatch; matching-enabled; post-delete sign-in landing) light+dark × 390+desktop, `<scenario>--<viewport>--<theme>.png`; verify `scrollWidth === innerWidth` at 390px; compare against the reference (note divergences). **DESTRUCTIVE SAFETY: create + onboard a THROWAWAY non-operator user for the live delete; never delete the seeded operator.** After any live delete, re-verify + restore the seed DB baseline (operator sign-in returns 200; counts restored).
  - [x] Update Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Decisions made at story creation (autonomous run — operator review points)

| # | Decision | Rationale |
|---|---|---|
| D-1 | **Custom `DELETE /api/v1/users/me` (controller→service→repository), NOT better-auth `deleteUser`** | The dangerous multi-table transactional cascade MUST live in a properly-injected, unit- and integration-tested **repository** (hard rule D7). better-auth's `deleteUser` plugin runs its `beforeDelete` hook at module-load time in `auth.ts`, outside Nest DI — it cannot cleanly own or test the ordered purge, and would push domain-table (transactions/categories) deletion into infra config. The `users` module already owns the `users` table (1.6/7-1), so a scoped `/users/me` delete is the natural extension; DELETE→204 + controller→service→repository is the exact D7 REST convention (mirrors `transactions.remove`). **Divergence flag vs 7-2** (which used authClient-native / no endpoint / zero drift): this story adds a real endpoint and **regenerates the generated client** (drift gate green after regen, not a no-op). RP-D2 ("better-auth stays the auth host") is preserved — auth **operations** (sign-in/up/password) are untouched; deleting the user row is consistent with the users module already writing that table. |
| D-2 | **Ordered transactional cascade** (delete transactions → null category parents → delete categories → delete user), one `db.transaction` | Two `ON DELETE RESTRICT` FKs (transactions→categories composite; categories self parent) are checked immediately and make a bare `DELETE FROM users` unreliable. Deleting transactions first, nulling category parents then deleting categories, then the user row (cascading sessions/accounts) is deterministic and atomic. Pattern: `transaction-categories.repository.ts` `db.transaction`. `verifications` has no user FK (transient) — not touched. |
| D-3 | **Invalidate the analytics cache after commit** (`analyticsCache.invalidateUser(userId)`) | Closes the 6-5-cache ↔ user-purge intersection the Epic 6 retro flagged; same call sites as every transactions mutation. Asserted in the service unit spec. |
| D-4 | **User-scoped by session only — `/users/me`, no id param, no body** | FR21 / architecture D6: a client can only ever delete its own account; `userId` = `session.user.id` from `@Session()`. No request shape lets a client target another user. Unauth → 401 via `AuthGuard`. Integration-tested (user B intact; unauth 401). |
| D-5 | **Confirmation gate = AlertDialog + type-to-confirm (email match)**, not password re-entry | AC 1 requires an explicit confirm step (no single-click) via the design-system `alert-dialog`; type-to-confirm (typed value must equal the user's email, RHF+zod refine, confirm disabled until match) is a strong, irreversible-appropriate gate and needs no credential-verify infra. **Divergence flag:** the reference re-enters the password; supertool avoids that because there's no clean server-side password-verify path outside better-auth's own flows (D-1 declined better-auth `deleteUser`). Recorded for operator; password-re-entry could be added later if a verify path is wired. |
| D-6 | **Post-delete: server action → generated client → clear cookie + `redirect(signIn)`** | Mirrors the reference's server-action+redirect shape but via the generated client (NFR6). The session row is deleted in the cascade (session terminated); clearing the better-auth cookie is hygiene; redirect lands the signed-out sign-in state (AC 2). Client re-throws `NEXT_REDIRECT`. |
| D-7 | **App-local settings component (`DeleteAccountSection`) + inline `Alert`, no widget, no toaster** | It consumes the generated client via a `'use server'` action and app routing (an app concern), so it's app-local beside `ProfileForm` (and mirrors the reference's `settings/components/delete-account-section/` location) — **not** a `packages/widgets` widget (widgets are `authClient` forms). Feedback via inline `Alert` (ProfileForm pattern); supertool has no toaster (the reference's `toast` is not adopted). |
| D-8 | **All strings in the existing `settingsPage` namespace; no new namespace file** | The section lives on the settings page; `settings-page.json` already exists in both locales. Reuse existing `errors.UNAUTHORIZED`/`errors.UNKNOWN` where applicable. |
| D-9 | **Hard delete, not soft delete** | The reference soft-deletes (`softDelete`); supertool has no soft-delete column and the AC requires "removed/cascaded so no orphaned per-user data remains" — a hard, ordered cascade satisfies FR21 cleanly. No new column/migration. |

### Deletion mechanism — the crux (read before Tasks 2–5 & 9)

- **Endpoint:** `DELETE /api/v1/users/me`, `AuthGuard`, 204, no body/DTO/id. `userId = session.user.id`.
- **Repository transaction (ordered):** delete `transactions` (userId) → `update transaction_categories set parentId=null` (userId) + delete `transaction_categories` (userId) → delete `users` (id) [cascade: sessions, accounts]. Atomic; user-scoped; skips `verifications`.
- **Why not better-auth `deleteUser`:** it exists (`authClient.deleteUser`, `beforeDelete`/`afterDelete` hooks) but its hook runs outside Nest DI in `auth.ts`, so the tested repository-owned cascade (D7) is the better fit here; and the drift-free benefit of 7-2's approach is not worth trading away testability for the app's most destructive path. Recorded as the road-not-taken (D-1).
- **Client regeneration:** this story adds a real OpenAPI operation; regenerate + commit `packages/shared/src/generated` and confirm the drift gate passes (no *further* diff after a clean regen). This is the one place the workflow differs from 7-2 (which was a drift no-op).

### Current state of the system this story builds on (preserve, don't break)

- **`users` module:** `UsersController` (`GET /users/me`, `PATCH /users/me`, both `AuthGuard` + `@Session()`), `UsersService` (getById/update via `UsersRepository`), `UsersRepository` (`@Inject(DRIZZLE) db`, `findByIdScoped`/`updateScoped`, `USER_RESPONSE_COLUMNS` includes `email`), `UsersModule` (controllers/providers `[UsersService, UsersRepository]`, exports `UsersRepository`). Add delete alongside these without changing existing behavior.
- **Schemas / FKs:** as tabulated above — the cascade/restrict mix is load-bearing; do not change FK definitions in this story (a naive delete "fix" via loosening FKs would break FR12 reassign-on-delete). Solve at the query layer (ordered transaction).
- **Analytics cache:** `AnalyticsCacheService` (`@Injectable`, `invalidateUser(userId)` deletes the per-user store). Wire it into `UsersModule` DI.
- **AuthGuard:** validates the better-auth session from request headers; throws `UnauthorizedException` (401) when absent — this gives the unauth-401 behavior for free.
- **settings page:** RSC resolves `resolveOnboardedProfile(locale)` and renders Profile + Change-password `Card`s in a stacked container (7-2 made it a vertical column, `align-items: center`, each card `max-width: 32rem`). Add a third card. `UserResponseDto.email` is available on `profile`.
- **Server-action + generated client:** `update-profile.ts`/`bulk-delete-transactions.ts` show the pattern — `await cookies()`, `createServerApiClient({ cookieHeader })`, `UsersApiService.*` / `TransactionsApiService.*`, discriminated result. `redirect` from `@supertool/next-shared/src/i18n/navigation/navigation`; `ROUTES.signIn` from `apps/money-tracker/src/constants/routes.ts`.
- **AlertDialog molecule:** exports `AlertDialog`(Root)/`AlertDialogTrigger`/`AlertDialogContent`/`AlertDialogHeader`/`AlertDialogFooter`/`AlertDialogTitle`/`AlertDialogDescription`/`AlertDialogAction`/`AlertDialogCancel` — controlled via `open`/`onOpenChange` (reference uses this exact set).
- **integration harness:** Testcontainers Postgres; `createHttpClient`/`createAuthClient` helpers (signUp/signIn/signInForCookie, getJson, extractSessionCookie); teardown via `stopIntegrationApp({ app, container })` — reuse it (Epic 6 retro action #1 / 7-1 D-F), do not reintroduce ad-hoc teardown.

### Reference patterns (ED1 — study, adapt, never copy/import)

- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/components/delete-account-section/{DeleteAccountSection.tsx,DeleteAccountSection.module.scss}` — AlertDialog + destructive trigger + confirm-field + Cancel/Confirm footer **shape**. Adapt: type-to-confirm email not password (D-5); generated-client server action not `profileApiService.deleteAccount` (D-1); inline `Alert` not `toast` (D-7).
- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/constants/delete-account-form-schema.ts` — schema shape (a single confirm field). Adapt: refine typed value === email (`emailMismatch`).
- `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/settings/actions/delete-account.ts` — server-action **shape** (validate → call API → clear token → `redirect(signIn)`, re-throw redirect errors). Adapt: generated client `usersDeleteMe`; clear better-auth cookie.
- `example/track-my-life/apps/money-tracker/messages/{en,uk}/settings-page.json` — dangerZone/delete key naming + uk phrasing to adapt.
- `example/tracker-backend-api/src/modules/profile/{profile.controller.ts,profile.service.ts}` — **context only, NOT applicable** (custom-auth stack: `@Delete()` on `/profile`, bcrypt password check, `userService.softDelete`, session-invalidation event). supertool uses a hard, ordered, repository-owned cascade on `/users/me` (D-1/D-2/D-9).
- **No reference counterpart — new ground:** the ordered transactional cascade purge, the `/users/me` DELETE, type-to-confirm email gate, analytics-cache invalidation on delete.

### Conventions to honor (hard rules + memories)

- **NFR6/D8:** delete op via the **generated client** (`UsersApiService.usersDeleteMe`) — no hand-written fetch; regenerate + commit the client; drift gate green after regen.
- **D7 layering:** controller → service → repository; the DB-touching cascade lives ONLY in the repository (one `db.transaction`); explicit `@Inject(ClassName)` on every constructor param; never `import type` an injectable (`AnalyticsCacheService`, `UsersRepository`, `UsersService`).
- **FR21 scoping:** `userId` from `@Session()` only; every delete `WHERE user_id = sessionUserId`; no cross-user path; integration-tested.
- **REST (D7):** DELETE → 204; `@ApiNoContentResponse()`; errors `{ statusCode, code, message, details? }` via the global filter.
- **React/files:** `FC<Props>`; PascalCase component files + co-located `.module.scss`/`.test.tsx`; kebab-case dirs; `on*`/`handle*`; named exports, no barrels; server actions in `apps/money-tracker/src/actions/` (`'use server'`).
- **FR19/FR20:** both locales same commit; ICU; `translate`/`useTranslations` alias (never `t`); namespace via `I18N_NAMESPACE.settingsPage`.
- **SCSS:** design tokens only; camelCase classes; mobile-first; no fixed widths overflowing 390px; destructive accent via tokens.
- **TS:** no enums; no `as` except `as const`; single source of truth.
- **Tests:** co-located (`*.test.tsx` frontend, `*.spec.ts` unit API, `*.integration.spec.ts` integration); pnpm scripts only; `TURBO_FORCE=true` for gate verification (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`); reuse `stopIntegrationApp` (Epic 6 retro action #1 / 7-1 D-F).
- **Destructive-QA safety:** never run the real delete against the seeded operator; use a throwaway user; restore/verify the seed baseline afterward (memory `seed-idempotent-truncate-before-reseed`).
- **Money (D1):** no money handling in this story (deletion removes rows; no amounts computed).
- **Branch:** `TOOLS-7-3/delete-account` off `main`; conventional commits; PR via `create-pr` (memory `story-work-via-pr`).

### Out of scope (explicit guardrails)

- **No landing page (7-4), no helmet/compression (7-5), no first/last-name changes (7-1 shipped), no change-password changes (7-2 shipped).**
- **No better-auth `deleteUser` plugin / `beforeDelete`/`afterDelete` hook / change to `auth.ts`** (D-1).
- **No FK/schema/migration change** — solve the cascade at the query layer (D-2/D-9); loosening the RESTRICT FKs would break FR12 reassign-on-delete.
- **No soft-delete column** (D-9 — hard delete).
- **No password re-verification path** (D-5 — type-to-confirm); no re-auth flow, no credential-verify endpoint.
- **No toaster dependency** (D-7 — inline `Alert`); no new runtime dependency of any kind.
- **No `packages/shell` / `packages/next-shared` / `packages/ui` source changes** (reuse existing `AlertDialog`/`Alert`/`Input`/`Button`/`Field`/`Card` primitives).
- **No admin/other-user deletion** — this story is self-service delete of the authenticated account only (`/users/me`); no `DELETE /users/:id`.
- **No account-recovery / undo** — deletion is irreversible by design.

### Project Structure Notes

- Backend: extend `apps/api/src/modules/users/{users.controller.ts,users.service.ts,users.repository.ts,users.module.ts}` (+ `users.service.spec.ts`, `users.controller.spec.ts`); new integration `apps/api/test/integration/delete-account.integration.spec.ts`.
- Generated client: `packages/shared/src/generated/*` regenerated (new `usersDeleteMe`); `apps/api/openapi.json` updated — both committed.
- Frontend: new `apps/money-tracker/src/actions/delete-account.ts` (+ `.test.ts`); new `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/{DeleteAccountSection.tsx,.module.scss,.test.tsx}`; edit `settings/page.tsx` (+ maybe `page.module.scss`); message files `messages/{en,uk}/settings-page.json`.
- Visual QA: `_bmad-output/implementation-artifacts/visual-qa/7-3-delete-account/*.png`.
- No new routes, no new namespaces, no new packages.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] — story statement + 4 BDD AC blocks (explicit confirm dialog; delete + user-data cascade no-orphans + session ends + signed-out state; only authenticated user's data affected — integration-tested; tests + confirm-dialog component test + both locales)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — charter: RP-D2 better-auth auth host, D1/NFR6/D7/FR19-20/NFR1 binding, per-story mobile-QA
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-F10 (delete-account with confirm dialog)
- [Source: _bmad-output/planning-artifacts/architecture.md] — D6 (per-user scoping / role guard), D7 (controller→service→repository, DELETE→204, error envelope), D8 (drift gate), NFR6 (generated client), RP-D2 (better-auth)
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md] — D4 (destructive/security surface = dedicated integration test), 7-3 cascade + analytics-cache intersection note, `stopIntegrationApp` reuse (action #1)
- [Source: _bmad-output/implementation-artifacts/7-2-change-password.md] — prior Epic 7 story: settings-page card stacking, inline-Alert feedback, visual-QA naming + throwaway-user/DB-baseline discipline, drift-verification ritual (here a real regen, not a no-op)
- [Source: _bmad-output/implementation-artifacts/7-1-first-last-name-capture.md] — users-module schema/DTO/client-regeneration precedent, `stopIntegrationApp` (D-F)
- [Source: apps/api/src/database/schemas/{users,transactions,transaction-categories,sessions,accounts,verifications}.ts] — FK/onDelete cascade-vs-restrict reality (the cascade crux)
- [Source: apps/api/src/modules/users/{users.controller.ts,users.service.ts,users.repository.ts,users.module.ts}] — module to extend
- [Source: apps/api/src/modules/transactions/transactions.controller.ts + transactions.service.ts] — `@Delete` 204 shape + `analyticsCache.invalidateUser` call site
- [Source: apps/api/src/modules/transaction-categories/transaction-categories.repository.ts] — `db.transaction` pattern
- [Source: apps/api/src/modules/analytics/analytics-cache.service.ts + analytics-cache.module.ts] — `AnalyticsCacheService.invalidateUser` + DI wiring
- [Source: apps/api/src/shared/guards/auth.guard.ts] — unauth → 401
- [Source: apps/api/test/helpers/integration-app.ts (stopIntegrationApp) + postgres-container.ts + http-client.ts + auth-client.ts] — integration harness to reuse
- [Source: apps/money-tracker/src/actions/{update-profile.ts,bulk-delete-transactions.ts}] — server-action + generated-client + cookie-forwarding pattern
- [Source: apps/money-tracker/src/app/[locale]/settings/page.tsx + components/profile-form/ProfileForm.tsx] — settings composition (third Card) + inline-Alert + app-local component pattern
- [Source: apps/money-tracker/src/constants/routes.ts + packages/next-shared/src/i18n/navigation/navigation.ts] — `ROUTES.signIn`, `redirect`
- [Source: packages/ui/src/components/molecules/alert-dialog/AlertDialog.tsx] — confirm-dialog molecule (exported parts)
- [Source: example/track-my-life/.../settings/components/delete-account-section/** + constants/delete-account-form-schema.ts + actions/delete-account.ts + messages/*/settings-page.json] — reference confirm-dialog shape (ED1; endpoint/password/soft-delete adapted, not copied)
- [Source: example/tracker-backend-api/src/modules/profile/{profile.controller.ts,profile.service.ts}] — reference backend delete (custom-auth soft-delete — context only, not applicable)
- [Source: .claude/rules/{react.md,i18n.md,styles.md,javascript.md,typescript.md}] — conventions

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- Backend unit + integration + all-package tests: `pnpm --filter @supertool/api test` → 50 files / 422 tests pass (includes the new `delete-account.integration.spec.ts` cascade proof and the users service/controller `deleteAccount`/`deleteMe` specs).
- Frontend tests: `pnpm --filter @supertool/money-tracker test` → 72 files / 347 tests pass (includes `delete-account.test.ts` action + `DeleteAccountSection.test.tsx`).
- Gates (all green): `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm i18n:parity`, `TURBO_FORCE=true pnpm test`, `TURBO_FORCE=true pnpm build`, and the OpenAPI drift gate (regenerate `packages/shared/src/generated` → clean after commit; new `usersDeleteMe` op present).

### Completion Notes List

- **Backend cascade (D-1/D-2):** custom `DELETE /api/v1/users/me` (controller→service→repository, 204, session-scoped, no id/body). `UsersRepository.deleteAccountScoped` runs ONE `db.transaction`: delete transactions → null category `parentId` then delete categories → delete user (sessions/accounts cascade via `ON DELETE CASCADE`). Ordering is required because `transactions→transaction_categories` (composite FK) and `transaction_categories.parentId` (self FK) are `ON DELETE RESTRICT` — the integration test seeds a two-level hierarchy + transactions referencing both parent and child so the RESTRICT path is genuinely exercised (a naive `DELETE FROM users` would fail).
- **Analytics cache (D-3):** `UsersService.deleteAccount` calls `analyticsCache.invalidateUser(userId)` AFTER the repository transaction commits; asserted in the service spec (and that it is NOT called when the purge rejects). `AnalyticsCacheModule` added to `UsersModule` imports for DI.
- **User-scoping (D-4):** `userId` is always `session.user.id`; no client-supplied id path. Integration test proves user B's transactions/categories/sessions/accounts/user row are all intact, A's are all 0, A's stale cookie → 401 on `GET /users/me`, and an unauthenticated `DELETE /users/me` → 401.
- **Client regeneration:** real contract change this story — regenerated + committed `packages/shared/src/generated` with the additive `usersDeleteMe` operation; drift gate green (deterministic re-gen produces no further diff). `apps/api/openapi.json` is a gitignored build artifact (not committed), so only the generated client is tracked.
- **Frontend (D-5/D-6/D-7):** app-local `DeleteAccountSection` in `settings/components/` (mirrors `ProfileForm`, not a widget). AlertDialog + type-to-confirm: the destructive confirm button stays disabled until the typed value exactly equals the user's email (RHF + zod `.refine`, `mode: 'onChange'`); a non-empty mismatch shows a localized `emailMismatch` error; Cancel/overlay/Escape reset and abort with no call. On matched confirm the `'use server'` `deleteAccount` action calls the generated client `UsersApiService.usersDeleteMe`, clears the `better-auth*` cookies, and `redirect(ROUTES.signIn)`; the client re-throws Next redirect control-flow via `unstable_rethrow` (public `next/navigation` API — chosen over the reference's deep `next/dist/.../redirect-error` import). Errors surface inline via `Alert variant="destructive"` (no toaster) and keep the dialog open.
- **Decision divergences recorded:** type-to-confirm (email match) instead of the reference's password re-entry (D-5); inline Alert instead of toast (D-7); hard ordered cascade instead of the reference's soft-delete (D-9); `unstable_rethrow` from `next/navigation` instead of the deep `redirect-error` import (autonomous refinement of D-6 — same behavior, public API).
- **Lint refinement:** extracted the type-to-confirm logic into `hooks/use-delete-account.ts` to satisfy `max-statements`, mirroring the `use-profile-form`/`use-delete-category` hook pattern.
- **i18n (D-8):** all new keys added to `messages/{en,uk}/settings-page.json` in the same commit (real Ukrainian, ICU `{email}` interpolation); `pnpm i18n:parity` green.

### Visual QA (AC 6, AC 7)

- `:3000` next-server cwd verified as THIS checkout (`lsof` → `.../supertool/apps/money-tracker`); API on `:3001` serving the new endpoint (unauth `DELETE /users/me` → 401, not 404); Docker Postgres healthy.
- **DESTRUCTIVE SAFETY:** exercised the real delete against a THROWAWAY user (`throwaway-7-3@example.com`) only. DB baseline confirmed INTACT before and after: `transactions=1880`, `transaction_categories=110`, latest tx `2025-02-03`, `users=2` (`operator@supertool.local` + `oleksii@gmail.com`, both onboarded). The throwaway user's rows = 0 after the live UI delete (`throwaway_rows=0`).
- Captured the full matrix (light+dark × 390px+desktop) in `_bmad-output/implementation-artifacts/visual-qa/7-3-delete-account/` — `danger-idle`, `dialog-empty`, `dialog-mismatch` (confirm disabled + `emailMismatch`), `dialog-matched` (confirm enabled), `post-delete-signin`. `document.documentElement.scrollWidth === window.innerWidth` (390) at 390px in both themes (no horizontal overflow). Post-delete redirect landed on `http://localhost:3000/sign-in` (signed-out state). `data-theme` correctly light/dark per capture.
- Reference divergences confirmed visually: Danger-zone card uses the destructive-accent border + destructive button (reference parity of shape), type-to-confirm field instead of password, inline Alert instead of toast.

### File List

- `apps/api/src/modules/users/users.repository.ts` (M) — `deleteAccountScoped` ordered transactional purge
- `apps/api/src/modules/users/users.service.ts` (M) — `deleteAccount` + `AnalyticsCacheService` injection
- `apps/api/src/modules/users/users.module.ts` (M) — import `AnalyticsCacheModule`
- `apps/api/src/modules/users/users.controller.ts` (M) — `@Delete('me')` 204 endpoint
- `apps/api/src/modules/users/users.service.spec.ts` (M) — `deleteAccount` cache-invalidation specs
- `apps/api/src/modules/users/users.controller.spec.ts` (M) — `deleteMe` session-scoped spec
- `apps/api/test/integration/delete-account.integration.spec.ts` (A) — cascade completeness + cross-user isolation + session termination + unauth 401
- `packages/shared/src/generated/{index.ts,sdk.gen.ts,types.gen.ts}` (M) — regenerated client with `usersDeleteMe`
- `apps/money-tracker/src/actions/delete-account.ts` (A) — `'use server'` action: generated client + cookie clear + redirect
- `apps/money-tracker/src/actions/delete-account.test.ts` (A) — action success/error branches
- `apps/money-tracker/src/app/[locale]/settings/constants/delete-account-form-schema.ts` (A) — email-match zod schema factory
- `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/DeleteAccountSection.tsx` (A)
- `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/DeleteAccountSection.module.scss` (A)
- `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/DeleteAccountSection.test.tsx` (A)
- `apps/money-tracker/src/app/[locale]/settings/components/delete-account-section/hooks/use-delete-account.ts` (A)
- `apps/money-tracker/src/app/[locale]/settings/page.tsx` (M) — Danger Zone card
- `apps/money-tracker/src/app/[locale]/settings/page.module.scss` (M) — destructive-accent card
- `apps/money-tracker/messages/en/settings-page.json` (M) — danger-zone + delete keys
- `apps/money-tracker/messages/uk/settings-page.json` (M) — danger-zone + delete keys (Ukrainian)
- `_bmad-output/implementation-artifacts/visual-qa/7-3-delete-account/*.png` (A) — 20 captures
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (M) — 7-3 → review

### Change Log

| Date | Change |
|---|---|
| 2026-07-05 | Implemented story 7-3 (delete account): custom session-scoped `DELETE /api/v1/users/me` with ordered transactional cascade purge (transactions → null-parent+delete categories → delete user, sessions/accounts cascade), analytics-cache invalidation after commit, regenerated client (`usersDeleteMe`), app-local `DeleteAccountSection` (AlertDialog + type-to-confirm email match + inline Alert + redirect on success), i18n (en+uk), unit + Testcontainers integration + component tests, visual QA (light/dark × 390/desktop). All gates green. Status → review. |
| 2026-07-05 | Code review APPROVE (3 adversarial layers, 0 must-fix; cascade order + session-only user-scoping + confirm gate traced against the real schema; 6 non-blocking nice-to-haves). PR opened: https://github.com/BudnikOleksii/supertool/pull/49 |
