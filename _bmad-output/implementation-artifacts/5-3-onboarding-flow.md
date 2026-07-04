---
baseline_commit: 30d1da9b0e0661c3ba4375c926a73588d9ba2c53
---

# Story 5.3: Onboarding Flow

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a brand-new user who just signed up,
I want a short guided setup — pick my currency, then seed default categories or import my file — that lands me on the dashboard,
so that I start with a usable, populated tracker instead of an empty app (RP-F1).

## Context & Why This Story

Sign-up today drops a new user straight into an empty app: `SignUpFormSection.handleSuccess` replaces to `ROUTES.home`, the profile's `defaultCurrency` stays `NULL` (only the seeded operator gets `'UAH'` via `seedOperator`), and there are zero categories/transactions until the user finds `/transactions/import` on their own. The reference has a two-step post-signup onboarding — **Currency → Categories (use defaults OR import a file)** — that lands on the dashboard (spike log `41-…`: live stepper shows exactly 2 steps; the code's third `password` step is OAuth-only and NOT parity). This story builds that flow (RP-F1, P0) on top of everything Epic 5 has already shipped: the 5-1 import contract, the 5-2 import UI, and Epic 4's 4.3 auto-fit, which makes "finish onboarding with imported data → dashboard shows real figures" work with zero extra effort.

This is also **exactly where the single-default-currency model (RP-D1, FR5/FR14) gets captured**: onboarding step one persists the profile default currency that scopes every list and dashboard figure from then on — there is no currency picker anywhere else, and this story must not add one.

Two predecessor carry-ins are settled and must NOT be re-planned: (1) the cross-user import-key collision 5-1 flagged for "the 5.3 onboarding path" was **fixed in 5-1** via the composite `(user_id, import_key)` unique index (migration `0004`, two-user Testcontainers coverage) — a second user importing the operator's file gets a full independent copy; (2) the 5-2 import components were built props-in/callbacks-out precisely so this story can lift and reuse them ("a lift to `src/components/` stays mechanical if 5.3 needs it" — 5-2 Project Structure Notes). Onboarding **reuses** the 5-2 upload→preview→execute flow; re-implementing any of it is a defect against this story.

**Evidence base:** reference captures `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/onboarding--{currency,currency-dropdown,categories}--*.png` (auth-app log `41-ref-capture-authenticated-log.md`: `/onboarding` = centered card + dot stepper, searchable full-ISO currency combobox, "Use Default Categories" OR "Import transactions from file"; steps carried via `?step=…&currency=…`); gap row F1 (P0) in `reference-parity-gap-backlog.md` (= RP-F1 in epics.md's naming); epics.md Story 5.3 + Epic 5 charter; 5-1/5-2 story records.

## Recommended Approach (binding direction)

**Onboarding signal — `onboarding_completed` boolean on `users` (reference parity):**

- Add `onboardingCompleted: boolean('onboarding_completed').notNull().default(false)` to `apps/api/src/database/schemas/users.ts`; generate the migration and **append a one-time backfill** `UPDATE users SET onboarding_completed = true;` to the generated SQL so every user existing at migration time (they all predate onboarding) is never forced into the flow. `seedOperator` additionally sets `onboardingCompleted: true` (fresh databases create the operator *after* migration, so the backfill alone doesn't cover them).
- Expose it on `UserResponseDto` (`@ApiProperty()`, boolean) and accept it on `UpdateUserDto` (`@IsBoolean() @IsOptional()`); regenerate the client. Do NOT derive "needs onboarding" from `defaultCurrency IS NULL` or from data presence — a user who skips the category step must stay completed (AC 5), and the flag survives later feature changes.

**No dedicated `onboarding` API module (D-B — diverges from the reference's `modules/onboarding`, operator-confirm at review):** the reference's onboarding module exists to serve a status endpoint, a complete endpoint (password hashing + category requirement), and default-category assignment from a DB table. Supertool needs none of that machinery: the profile response already reaches every page via `fetchProfile()` (status for free), completion is a one-field profile update (`usersUpdateMe { onboardingCompleted: true }`), and the default set is a constant catalog. The two mutations live in their owning domains:

1. **Completion** = `PATCH /api/v1/users/me` with the new `onboardingCompleted` field — no new endpoint.
2. **Default categories** = new `POST /api/v1/transaction-categories/defaults` on the existing transaction-categories controller — controller method named exactly `createDefaults` so `buildResourceActionOperationId` emits `transactionCategoriesCreateDefaults` (verify in the emitted `openapi.json`). 201 + `DefaultCategoriesResponseDto { topLevelCreated, childrenCreated }` (counts are `number` — counts, not money). Service builds the set from a constant catalog (below); repository inserts parents-then-children with `onConflictDoNothing` on the existing `[userId, name, type, parentId]` unique target (same conflict semantics as the seed/import engine — **idempotent**: re-click creates nothing and returns zero counts; a user who already made same-named categories keeps them, no duplicates). D7: the repository is the only DB toucher; run parents+children inside one `db.transaction`.

**Default category catalog (D-C — constant, not a DB table; operator-confirm at review):** the reference stores defaults in a `DefaultTransactionCategory` table with its own seed + admin surface — overkill for supertool (D6: v1 ships no admin features). Define `DEFAULT_CATEGORY_CATALOG` in `apps/api/src/modules/transaction-categories/transaction-categories.constants.ts`, mirroring the reference catalog content (data carried as configuration, ED1-compatible):

- **income** (top-level, no children): Allowance, Salary, Petty cash, Bonus, Other
- **expense** (top-level → children): Food (Groceries, Eating out, Beverages) · Social Life (Friends, Fellowship, Alumni, Dues) · Pets · Transport (Bus, Subway, Taxi, Car) · Culture (Books, Movie, Music, Apps) · General (Rent, Utilities) · Household (Appliances, Furniture, Kitchen, Toiletries, Chandlery) · Apparel (Clothing, Fashion, Shoes, Laundry) · Beauty (Cosmetics, Makeup, Accessories, Other) · Health (Medicine, Hospital, Other) · Education (Courses, Academy, Conferences, School supplies) · Gifts (Birthdays, Holidays) · Other

This is the exact reference list (`default-transaction-category.seed.ts` `DEFAULT_CATEGORIES`), names and casing verbatim (`Petty cash`, `Eating out`, `School supplies`) — do not trim or re-case; note the duplicate `Other` names (expense top-level `Other` AND children `Other` under Beauty/Health) which the parent re-select below must disambiguate.

Category names are user data, not UI strings — the catalog is English-only regardless of locale, exactly like the reference (D-I; FR19 does not apply to user-owned rows).

**Routing — plain-shell chrome + per-page gate (D-F — no route group; operator-confirm at review):**

- `AppShell` already renders a **plain header** (logo/tools + theme/locale switchers, no sidebar, no user menu) when `userName === undefined` — the exact chrome-less look of the reference's onboarding layout. `LocaleLayout` passes `userName` only for onboarded profiles: `profile !== null && profile.onboardingCompleted ? profile.name : undefined`. Non-onboarded sessions therefore see the minimal shell everywhere until completion — no route group needed (standing decision: money-tracker uses no route groups; memory `shell-sidebar-layout-decision`), no `packages/shell` change.
- **Gate helper** `apps/money-tracker/src/utils/resolve-onboarded-profile.ts`: `resolveOnboardedProfile(locale)` → `fetchProfile()`; `null` → `redirect({ href: ROUTES.signIn, locale })`; `!profile.onboardingCompleted` → `redirect({ href: ROUTES.onboarding, locale })`; else return the profile. Replace the repeated inline `fetchProfile()` + sign-in redirect in every protected page (dashboard, transactions, transactions/new, transaction edit, transactions/import, categories, categories/new, category edit, settings — `git grep -l "fetchProfile" apps/money-tracker/src/app` for the definitive list) with one call. `redirect` from `@supertool/next-shared` i18n navigation, never `next/navigation`. `proxy.ts` stays untouched (it is cookie-presence-only and cannot know the flag; per-page RSC gating is the repo pattern — memory `verify-middleware-redirect-changes-live` still applies to the live check, not to code changes here).
- **Onboarding page guards (inverse):** unauthenticated → sign-in; `onboardingCompleted` → `redirect(ROUTES.dashboard)` — existing users can never be forced in, and the flow is unreachable once done.
- **Post-signup:** `SignUpFormSection.handleSuccess` → `router.replace(ROUTES.onboarding)` (was `ROUTES.home`). Sign-in stays pointed at home; a non-onboarded signer-in is captured by the page gates on first navigation (the `/` placeholder itself does not redirect — home gating is out of scope; its dashboard/transactions/categories links all lead into gated pages, so there is no dead end).

**The flow — one route, URL-param stepper (reference pattern):**

- `ROUTES.onboarding = '/onboarding'`; new page `apps/money-tracker/src/app/[locale]/onboarding/page.tsx` (async RSC: `await props.params` + `searchParams`, `setRequestLocale`, guards above, `getTranslations(I18N_NAMESPACE.onboardingPage)`). Step from `?step=` (`ONBOARDING_STEP_SEARCH_PARAM`; values `currency` | `categories`, default/invalid → `currency`). Entering `categories` with `profile.defaultCurrency === null` redirects back to the currency step (deep-link guard). Unlike the reference, the chosen currency is NOT carried in the URL — it is already persisted (D-D), and step 2 reads the profile.
- **Step indicator**: small route-local `step-indicator/StepIndicator.tsx` (dots + labels, current-step emphasis, `aria-current="step"`) — 2 steps only; no password step ever (D-G).
- **Currency step** (`currency-step/CurrencyStep.tsx`, client): react-hook-form + zod (required `defaultCurrency` enum), `Combobox` with `CURRENCY_OPTION_LIST` — **lift that constant** from `settings/constants/currency-option-list.ts` to `src/constants/currency-option-list.ts` (now used by two routes; placement table) and re-point `ProfileForm`. Pre-select `profile.defaultCurrency` when re-entering. Submit → new narrow action `update-default-currency.ts` (`usersUpdateMe { defaultCurrency }`; do NOT reuse `updateProfile` — its schema requires `name`+`locale` and dragging those through the step couples the flows) → on success `router.replace` to `?step=categories`.
- **Categories step** (`categories-step/CategoriesStep.tsx` + `hooks/use-categories-step.ts`, client): three affordances —
  1. **"Use default categories"** button → `assign-default-categories.ts` action (`transactionCategoriesCreateDefaults`, then `revalidatePath(ROUTES.categories)`) → success state showing created counts; idempotent re-click is harmless.
  2. **"Import transactions from file"** → the lifted 5-2 flow: `ImportDropzone` → server preview (`ImportPreviewPanel`, incl. the D-F caveat copy: positional dedup + name-only category approximation + rounding hint — reused for free) → execute → a compact onboarding-owned result line (inserted/skipped/categories-created counts; NOT the 5-2 `ImportResultPanel`, whose transactions/dashboard links would exit the flow mid-onboarding — D-H). Errors render through the reused `ImportErrorPanel` (localized by code, 413 by status, `rowErrorList` verbatim — all 5-2 behavior, unchanged).
  3. **"Skip for now"** — completes onboarding with zero categories (epics AC: the category step is explicitly optional; diverges from the reference's ≥1-category requirement, pre-confirmed by epics.md 5.3 AC — D-E).
  After defaults-assigned or import-success, a **Continue** button (and Skip always) → `complete-onboarding.ts` action (`usersUpdateMe { onboardingCompleted: true }`, then `revalidatePath(ROUTES.home, 'layout')` so the full shell appears) → on success client `router.replace(ROUTES.dashboard)`. With imported data, 4.3 auto-fit lands the dashboard on the data's latest month — the epic's payoff, no extra work.

**The 5-2 lift (mechanical, no behavior change):** move the route-agnostic import pieces out of `app/[locale]/transactions/import/` into app-wide homes so onboarding can compose them without cross-route imports (placement table: used by two routes → app-wide): components `import-dropzone/` (incl. its `hooks/use-import-dropzone.ts`), `import-preview-panel/`, `import-error-panel/` (each with scss + test), `near-duplicate-alert/` (scss only — it has no test file) → `src/components/transaction-import/…`; the flow hook `components/import-page-content/hooks/use-import-flow.ts` (note: it currently lives inside `import-page-content/`, which itself stays route-local) → `src/hooks/use-import-flow.ts`; utils `check-import-file.ts` (+ test), `format-file-size.ts` (+ test), `get-import-file.ts`, `get-checked-import-file.ts`, `prepare-import-error-state.ts`, `revalidate-import-targets.ts` (the last four have no test files) and the action-state `types.ts` → `src/utils/transaction-import/…` + `src/types/transaction-import.ts` (or equivalent single obvious home — keep names). `ImportPageContent` (+ its test) + `ImportResultPanel` + `page.tsx` stay route-local (page-specific orchestration/CTAs) and import from the new locations. `git mv` + import-path updates only; every existing test moves with its subject and stays green — the standalone page's behavior is a regression guard (AC 4).

## Acceptance Criteria

1. **New users are routed in; existing users are never forced in (RP-F1).** Given a user who has just completed sign-up, when they land in the app, then they arrive at `/onboarding` (sign-up success navigates there directly, and every protected page redirects non-onboarded profiles there via the shared gate). Given any user with `onboardingCompleted: true` (all pre-migration users via backfill, the seeded operator, and anyone who finishes or skips), then no gate ever redirects them to onboarding and opening `/onboarding` directly redirects to the dashboard. Unauthenticated visitors to `/onboarding` are redirected to sign-in. While not onboarded, the shell renders its plain header (no sidebar/user menu) — the full shell appears after completion (D-F).
2. **Currency step persists the single scoping default (FR5, RP-D1).** Given step one, when I pick a currency from the full ISO combobox (`CURRENCY_OPTION_LIST`, single lifted constant) and continue, then `usersUpdateMe` saves it as `defaultCurrency` (generated client only — a hand-written fetch is a defect, NFR6), the flow advances to the categories step, and that currency is the profile default that scopes lists and dashboard (FR14) — no currency picker is added anywhere else. Re-entering the step pre-selects the saved value; the step cannot be bypassed (deep-linking `?step=categories` without a saved currency returns to step one).
3. **Default-categories path creates the starter hierarchy (FR21-scoped, idempotent).** Given step two, when I choose "Use default categories", then `POST /api/v1/transaction-categories/defaults` creates the two-level catalog set scoped to my user (parents then children, repository-only DB access, one transaction — D7), the UI shows the created counts, and repeating the call (double-click, re-entry) creates nothing further (`onConflictDoNothing` on `[userId, name, type, parentId]`) and reports zero counts; pre-existing same-named user categories are never duplicated.
4. **Import path reuses the 5-2 flow (no duplication).** Given step two, when I choose to import a file, then the flow is the lifted 5-2 machinery — dropzone (pre-checks from `@supertool/shared` constants), server preview via `transactionsImportPreview` with the counts/categories/near-duplicate/caveat copy, confirmed execute via `transactionsImport`, errors localized by code and 413 by status — with an onboarding-owned compact result + Continue instead of the standalone page's exit links (D-H). No import logic, component, action, or validation rule is re-implemented; the composite `(user_id, import_key)` index from 5-1 already makes a second user's import of an already-imported file a full independent copy — **no dedup/scoping work in this story**. The standalone `/transactions/import` page keeps working identically after the lift (its tests, moved, stay green).
5. **Completion (and skip) land on the dashboard.** Given I finish either category path or explicitly skip the optional step (D-E), when the flow completes, then `onboardingCompleted` is persisted true (`usersUpdateMe`), the layout revalidates so the full shell renders, and I land on `/dashboard` — with imported data showing real figures on the data's latest month (4.3 auto-fit), with defaults/skip showing the current-month empty state (never a crash). The flow is unreachable afterwards (AC 1).
6. **Backend contract + migration + regeneration (NFR6/D8).** Given the API changes — `onboarding_completed` column (default `false`, migration backfills existing rows to `true`, `seedOperator` sets `true`), `UserResponseDto`/`UpdateUserDto` field, `transactionCategoriesCreateDefaults` operation + `DefaultCategoriesResponseDto` — then the OpenAPI spec and generated client are regenerated and committed, the drift gate is green, and errors use the shared envelope. Testcontainers integration tests assert: defaults created two-level and user-scoped (second user gets an independent set), idempotent re-run (zero counts, no duplicates), coexistence with pre-existing same-named categories, `onboardingCompleted` false on a fresh user / persisted true via update, and seed re-run keeps the operator completed. Unit/controller specs cover the new service method, the DTO field pass-through, and the 201 contract.
7. **Frontend tests (NFR1).** Component tests cover: StepIndicator states; CurrencyStep (required validation, pre-selection, submit → action + advance, pending disable); CategoriesStep (defaults path success + counts render, import path wiring through the lifted flow, skip, Continue visibility, error states incl. UNKNOWN fallback); the three new actions (`update-default-currency`, `assign-default-categories`, `complete-onboarding`) with mocked generated client following `create-transaction.test.ts` (success, error pass-through, revalidate targets); `resolve-onboarded-profile` (three branches). Moved import tests all pass unchanged. All repo gates green (`TURBO_FORCE=true` where turbo may replay stale logs).
8. **i18n parity (FR19/FR20).** `onboardingPage` is registered in `I18N_NAMESPACE` and mapped to `onboarding-page`; `apps/money-tracker/messages/{en,uk}/onboarding-page.json` land in the same commit with every flow string (step labels, titles/subtitles, currency field, defaults/import/skip/continue copy, result counts via ICU plurals, `errors.*` block keyed by `ErrorCode` + `UNKNOWN`) — real Ukrainian, ICU only, `pnpm i18n:parity` green. Reused import components keep rendering their existing `transactionsImportPage` strings (loader deep-merges all namespaces — no duplication of those keys).
9. **Mobile-usable end-to-end (NFR8 — per-story mobile-QA check).** Given a 390px viewport, when I run the whole sign-up → currency → categories (each path) → dashboard flow, then every control is reachable and legible with no horizontal overflow (`documentElement.scrollWidth === innerWidth`), the combobox and dropzone are touch-operable, and the centered card never exceeds the viewport.
10. **Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/5-3-onboarding-flow/` contains **light + dark × 390px + desktop** captures of the interactive states — currency step idle, currency combobox open, categories choice state, defaults-assigned result, import preview (counts + caveats), import result + Continue, and the post-completion dashboard landing — compared against reference `onboarding--currency` and `onboarding--categories` (both viewports) plus `onboarding--currency-dropdown` (desktop only — no mobile dropdown capture exists in the spike set), with observations in the Dev Agent Record. Captured as a **fresh signed-up user** on `:3000` (pre-QA environment checklist honored), with the DB baseline restored afterwards.

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and the current state before writing code** (AC: all)
  - [x] Reference (ED1 — carry patterns, never code): `example/track-my-life/apps/money-tracker/src/app/[locale]/(onboarding-layout)/onboarding/page.tsx` + `page.content.tsx` (single route + `?step=` stepper), `…/components/currency-step/CurrencyStep.tsx` (RHF+zod Combobox form), `…/components/categories-step/CategoriesStep.tsx` + `hooks/use-categories-step.ts` (defaults action + inline import + continue gating), `…/components/step-indicator/StepIndicator.tsx`, `…/constants/onboarding-step.ts`, `…/(app-layout)/layout.tsx` + `src/actions/redirect-if-not-onboarded.ts` + `fetch-onboarding-status.ts` (gating mechanism), `…/messages/en/onboarding-page.json` (namespace/key naming); backend `example/tracker-backend-api/src/modules/onboarding/{onboarding.controller.ts,onboarding.service.ts}` + `src/database/schemas/users.ts` (`onboardingCompleted`) + `src/database/seeds/default-transaction-category.seed.ts` (catalog content). Note deliberate supertool divergences D-B…D-H below.
  - [x] Read in full the files this story updates: `apps/api/src/database/schemas/users.ts`, `apps/api/src/database/seeds/seed-operator.ts`, `apps/api/src/modules/users/{users.controller.ts,users.service.ts,users.repository.ts,dtos/*.ts}`, `apps/api/src/modules/transaction-categories/{transaction-categories.controller.ts,transaction-categories.service.ts,transaction-categories.repository.ts}` (+ existing unique constraint on `transaction_categories` — NULLS NOT DISTINCT, memory `drizzle-nullsnotdistinct-on-unique-not-uniqueindex`; do not touch it), `apps/money-tracker/src/app/[locale]/layout.tsx`, `AppShellSection.tsx`, `packages/shell/src/components/app-shell/AppShell.tsx` (plain-header branch), `src/app/[locale]/sign-up/SignUpFormSection.tsx`, `src/constants/routes.ts`, `src/actions/{fetch-profile.ts,update-profile.ts,create-transaction.ts}`, the whole `transactions/import/` route dir (lift subjects), `settings/components/profile-form/ProfileForm.tsx` + `settings/constants/{profile-form-schema.ts,currency-option-list.ts}`, `src/utils/resolve-default-period.ts` (4.3 — composes with completion landing).
- [x] **Task 2 — API: onboarding flag** (AC: 1, 5, 6)
  - [x] `users.ts` schema: add `onboardingCompleted` (`boolean('onboarding_completed').notNull().default(false)`); `pnpm --filter @supertool/api db:generate`; append the one-time `UPDATE users SET onboarding_completed = true;` backfill to the generated migration SQL.
  - [x] `seed-operator.ts`: ensure the operator ends up `onboardingCompleted: true` — mirror the existing `ensureDefaultCurrency` pattern with an unconditional `ensureOnboardingCompleted`-style step (self-evidently idempotent; covers fresh DBs where the operator is created after the backfill migration ran). Confirm `seed.integration.spec.ts` stays green.
  - [x] `UserResponseDto`: `@ApiProperty()` boolean `onboardingCompleted`. `UpdateUserDto`: `@ApiPropertyOptional()` + `@IsBoolean() @IsOptional()`. ⚠️ The repository is NOT a blind pass-through — `users.repository.ts` reads through the `USER_RESPONSE_COLUMNS` whitelist and `updateScoped` maps fields explicitly: add `onboardingCompleted: users.onboardingCompleted` to `USER_RESPONSE_COLUMNS` AND an `if (patch.onboardingCompleted !== undefined)` branch to `updateScoped` (skipping either fails silently: 200-without-persisting → completion never sticks, or a missing response field → `profile.onboardingCompleted` undefined → every user forced into onboarding). `users.service.ts` already forwards the DTO — no change. Extend `users` unit/controller specs + `users-profile.integration.spec.ts` (fresh user false; update persists true AND round-trips in `usersMe`).
- [x] **Task 3 — API: default-categories endpoint** (AC: 3, 6)
  - [x] `transaction-categories.constants.ts`: `DEFAULT_CATEGORY_CATALOG` per the Recommended Approach (as-const; income top-levels, expense parents with `childList`).
  - [x] Controller: `@Post('defaults')` (201, `@UseGuards(AuthGuard)`, session user id) — method named exactly `createDefaults`; new `dtos/default-categories-response.dto.ts` (`topLevelCreated`, `childrenCreated` — `@ApiProperty()` numbers). No new enums → no `OPENAPI_ENUM_NAME` entries.
  - [x] Service `createDefaults(userId)` → repository method that inserts parents then children inside one `db.transaction`, `onConflictDoNothing` targeting `[userId, name, type, parentId]`, resolving child `parentId`s from the just-ensured parents — re-select **top-level** rows by `[userId, name, type]` **AND `parentId IS NULL`** after the upsert (so pre-existing parents also get their children linked, and the duplicate `Other` names in the catalog / a user's own same-named child categories can never win the lookup). Returns created counts.
  - [x] Specs: service (catalog → rows, counts), controller (delegation, 201); Testcontainers `apps/api/test/integration/` coverage per AC 6 (two-user independence, idempotent re-run, coexistence with pre-existing same-named categories).
  - [x] Regenerate: `pnpm --filter @supertool/api build` → `pnpm --filter @supertool/shared generate:client`; verify operationId `transactionCategoriesCreateDefaults`; commit the generated diff; drift gate green.
- [x] **Task 4 — Lift the 5-2 import flow to app-wide homes** (AC: 4)
  - [x] `git mv` per the Recommended Approach lift list (components → `src/components/transaction-import/…`, hook → `src/hooks/`, utils → `src/utils/transaction-import/…`, action-state types → app-wide types file); update all import paths (`ImportPageContent`, the two server actions, tests). No logic edits; keep component/file names.
  - [x] Run the money-tracker suite — every moved test green; standalone import page renders unchanged (spot-check live during QA).
- [x] **Task 5 — Routing: flag-aware shell + gates + signup redirect** (AC: 1, 5)
  - [x] `routes.ts`: add `onboarding: '/onboarding'`.
  - [x] `layout.tsx`: pass `userName` only when `profile !== null && profile.onboardingCompleted` (plain header otherwise — verify the plain branch renders theme/locale switchers as today).
  - [x] New `src/utils/resolve-onboarded-profile.ts` (+ test): three branches per Recommended Approach; replace the inline `fetchProfile()`+redirect gate in every protected page (`git grep -l "fetchProfile" apps/money-tracker/src/app` — dashboard, transactions, transactions/new, transaction edit, transactions/import, categories, categories/new, category edit, settings); pages keep their existing render output otherwise.
  - [x] `SignUpFormSection.tsx`: success → `router.replace(ROUTES.onboarding)` (+ keep `router.refresh()`); update its test if one exists.
- [x] **Task 6 — i18n namespace plumbing** (AC: 8)
  - [x] Add `onboardingPage` to `I18N_NAMESPACE` (`packages/shared/src/constants/i18n-namespace.ts`) and map to `onboarding-page` in `localization-messages-file-name-by-namespace.ts`.
  - [x] Create `apps/money-tracker/messages/{en,uk}/onboarding-page.json` in the same commit: step labels (Currency, Categories), currency title/subtitle/field label/placeholder/continue, categories title/subtitle, use-defaults button + assigned result (ICU plural counts), import section label, compact import result (ICU: inserted/skipped/categories created), skip + continue, `errors.*` keyed by raw `ErrorCode` values + `UNKNOWN` (mirror `transaction-form.json`). Real Ukrainian, no transliteration.
- [x] **Task 7 — Onboarding page + steps** (AC: 1, 2, 3, 4, 5, 9)
  - [x] Lift `CURRENCY_OPTION_LIST` to `src/constants/currency-option-list.ts`; re-point `ProfileForm`.
  - [x] New `app/[locale]/onboarding/page.tsx` (RSC): params/searchParams, `setRequestLocale`, guards (unauth → signIn; completed → dashboard; `?step=categories` without saved currency → currency step), render centered `Card` + `StepIndicator` + the active step. `ONBOARDING_STEP_SEARCH_PARAM` + step values in a route-local `constants.ts` (as-const map, no TS enum). No `generateMetadata`/`loading.tsx` (repo pattern, 5-2 D-G precedent).
  - [x] `components/step-indicator/StepIndicator.tsx` (+ scss/test): two dots + labels, `aria-current="step"`, tokens only. Reference counterpart: `…/onboarding/components/step-indicator/StepIndicator.tsx`.
  - [x] `components/currency-step/CurrencyStep.tsx` (+ scss/test): RHF+zod (`defaultCurrency` required enum), `Combobox` + lifted `CURRENCY_OPTION_LIST`, pre-select from profile, pending disable, error mapping per `ActionState`. Reference counterpart: `…/currency-step/CurrencyStep.tsx`; supertool persists immediately (D-D).
  - [x] `components/categories-step/CategoriesStep.tsx` (+ scss/test, `hooks/use-categories-step.ts`): defaults button → action → counts result; import section composing lifted `ImportDropzone`/`ImportPreviewPanel`/`ImportErrorPanel` via `useImportFlow`; compact result + Continue after either success; Skip always available; completion → `complete-onboarding` action → `router.replace(ROUTES.dashboard)`. Reference counterpart: `…/categories-step/CategoriesStep.tsx` + `use-categories-step.ts`, adapted to the server-preview flow (**no client parsing — 5-2 D-A stands**) and the optional-skip contract (D-E).
  - [x] Mobile-first SCSS: centered card, `max-width` with fluid gutters, stack at 390px, no fixed widths; long category names wrap.
- [x] **Task 8 — Server actions** (AC: 2, 3, 5)
  - [x] New `src/actions/update-default-currency.ts` (+ test): `'use server'`, zod-validate the code against `CURRENCY_CODE_LIST`, `usersUpdateMe { defaultCurrency }`, `revalidatePath(ROUTES.home, 'layout')`, `ActionState` return. Pattern: `update-profile.ts`.
  - [x] New `src/actions/assign-default-categories.ts` (+ test): `TransactionCategoriesApiService.transactionCategoriesCreateDefaults`, `revalidatePath(ROUTES.categories)`, route-local success union carrying the counts DTO (5-2 D-C precedent — do not widen the shared `ActionState`).
  - [x] New `src/actions/complete-onboarding.ts` (+ test): `usersUpdateMe { onboardingCompleted: true }`, `revalidatePath(ROUTES.home, 'layout')`, `ActionState` return; navigation stays client-side in the step (SignUpFormSection precedent).
  - [x] All three: `await cookies()` → `createServerApiClient({ cookieHeader })`; generated client only (NFR6); rejection-hardening `.catch` → UNKNOWN state in the calling hook (5-2 must-fix 1 lesson).
- [x] **Task 9 — Gates, visual QA, record** (AC: 7, 9, 10)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where needed (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`); drift gate green after regen.
  - [x] Pre-QA environment checklist (epic-4 retro action #4): `:3000` next-server cwd is THIS checkout (`lsof`); seed baseline clean (1880 rows, latest `2025-02-03`; `TRUNCATE` + re-seed if strays — memory `seed-idempotent-truncate-before-reseed`). Run migrations so the backfill applies.
  - [x] Capture the AC-10 matrix as a **fresh signed-up user** (sign-up on `:3000` works — trusted origins pinned there): (a) sign-up → lands on onboarding, plain header visible; (b) currency step idle + combobox open; (c) categories choice; (d) defaults path → counts → Continue → dashboard (current-month empty state, no crash); (e) reset with a second fresh user: import path with the seed JSON (`apps/api/src/database/data/transactions-02.03.25.json` — proves the 5-1 cross-user copy: full insert, not all-duplicates) → preview → result → Continue → dashboard auto-fit on `2025-02` with real figures; (f) skip path; (g) operator signs in → never sees onboarding; `/onboarding` as operator → dashboard redirect. Verify `scrollWidth === innerWidth` at 390px on each step. Both themes via the real switcher (available in the plain header).
  - [x] **Restore DB state**: delete the QA users' transactions/categories/user+session rows, `TRUNCATE transactions` + re-seed, verify baseline (1880 rows, latest `2025-02-03`, 110 categories, operator `onboarding_completed = true`).
  - [x] Update Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Decisions made at story creation (autonomous run — operator review points)

| # | Decision | Rationale |
|---|---|---|
| D-A | **`onboarding_completed` boolean on `users`** (migration + backfill-existing-to-true + seedOperator true) instead of deriving from `defaultCurrency`/data presence | Reference parity (its `users.onboardingCompleted`); an explicit flag is the only signal that keeps a skip-path user (currency set, zero categories/transactions) out of the flow forever (AC 5) and keeps "existing users are never forced in" true by construction. Bounded additive migration — same class as 5-1's D-D precedent. |
| D-B | **No `onboarding` API module** — completion rides on `usersUpdateMe` (new DTO field); defaults on `POST /transaction-categories/defaults`. **Diverges from the reference's dedicated onboarding module — operator-confirm at review.** | The reference module exists for a status endpoint (supertool's profile already carries the flag to every page via `fetchProfile`), password hashing (no password step here, D-G), and a ≥1-category completion guard (dropped by epics' explicit skip, D-E). What remains is one profile field and one category mutation — they belong to their owning domains (one module per main domain/route, nestjs rules); a one-endpoint module would be structural noise. |
| D-C | **Default catalog as an API constant** (`DEFAULT_CATEGORY_CATALOG`), not a `DefaultTransactionCategory` table + seed. **Diverges from reference — operator-confirm at review.** | D6: v1 ships no admin features, so a DB table has no writer besides a seed — a constant is the same data with less machinery. Content mirrors the reference catalog (data carried as configuration — ED1-compatible; code is not copied). Moving to a table later is additive. |
| D-D | **Currency persists at step one** via `usersUpdateMe { defaultCurrency }` (narrow action), not deferred to completion; the URL carries only `?step=`, never `?currency=` | epics.md 5.3 AC 2 wording pre-confirms ("When I choose my default currency, Then it is saved to my profile"). Persisting immediately makes step 2's deep-link guard trivial (profile is the truth), survives abandonment (revisit resumes at categories), and drops the reference's URL-state duplication. |
| D-E | **Explicit "Skip for now"** on the categories step; completion requires no categories | Mandated by epics.md 5.3 AC 4 ("or explicitly skip the optional category step") — overrides the reference's ≥1-category requirement. Skip is a real completion (flag true, dashboard landing, never re-prompted). |
| D-F | **Non-onboarded sessions render the existing plain AppShell header app-wide** (layout passes `userName: undefined` until completed) instead of a dedicated onboarding route-group layout. **Diverges from the reference's `(onboarding-layout)` route group — operator-confirm at review.** | Money-tracker deliberately uses no route groups (memory `shell-sidebar-layout-decision`); `AppShell` already ships the exact chrome-less look the reference gives onboarding (logo + theme/locale switchers, no sidebar). Zero shell-package changes; sidebar escape routes are moot (page gates redirect back anyway). Trade-offs recorded: (1) no user menu → no sign-out during onboarding (reference has an avatar-only menu there; parity is near-exact); (2) `AppShellSection.handleLocaleChange` early-returns when `userName === undefined`, so a locale switch during onboarding changes the UI locale but does NOT persist `profile.locale` — accepted for the short flow; do not "fix" ad hoc, and QA must not file it as a defect. |
| D-G | **No password step** | The reference's third step is reachable only for password-less OAuth signups; supertool has no OAuth (FR1) — pre-confirmed by epics.md 5.3 evidence note ("reference has 2 live steps — its unused `password` step is NOT parity"). |
| D-H | **Onboarding import result is a compact onboarding-owned summary + Continue**, not the 5-2 `ImportResultPanel` | The panel's CTAs (transactions/dashboard links) would exit mid-flow without setting the flag. The reference's own onboarding renders a bespoke inline result distinct from its standalone page — same split, carried. Counts come from the same `TransactionImportResponseDto`. |
| D-I | **Default catalog names are English-only** regardless of user locale | Category names are user-owned data rows, not UI strings — FR19 governs UI copy only; the reference behaves identically. A localized starter set would fork user data by locale and is out of scope. |
| D-J | **Gate lives in a shared per-page helper** (`resolveOnboardedProfile`), not in `proxy.ts` middleware and not in the locale layout | Middleware is cookie-presence-only (no API call budget there; memory `verify-middleware-redirect-changes-live` counsels caution); the locale layout also wraps sign-in/up (no route groups) so a layout redirect would loop. The per-page `fetchProfile` gate is the established pattern — the helper de-duplicates nine copies of it while adding the onboarding branch; `cache()` on `fetchProfile` keeps it one request per render. |

### Files to TOUCH / CREATE (read each fully before editing)

| File | Action | Why |
|---|---|---|
| `apps/api/src/database/schemas/users.ts` (+ generated migration with backfill) | UPDATE/NEW | `onboarding_completed` flag (D-A) |
| `apps/api/src/database/seeds/seed-operator.ts` | UPDATE | Operator completed on fresh DBs |
| `apps/api/src/modules/users/dtos/{user-response.dto.ts,update-user.dto.ts}` (+ specs) | UPDATE | Expose/accept the flag |
| `apps/api/src/modules/users/users.repository.ts` | UPDATE (required) | `USER_RESPONSE_COLUMNS` entry + explicit `updateScoped` field branch (Task 2 warning) |
| `apps/api/src/modules/transaction-categories/transaction-categories.constants.ts` | NEW/UPDATE | `DEFAULT_CATEGORY_CATALOG` (D-C) |
| `apps/api/src/modules/transaction-categories/{transaction-categories.controller.ts,transaction-categories.service.ts,transaction-categories.repository.ts}` (+ specs) | UPDATE | `createDefaults` endpoint/service/repo (D7) |
| `apps/api/src/modules/transaction-categories/dtos/default-categories-response.dto.ts` | NEW | Counts DTO |
| `apps/api/test/integration/*` | UPDATE/NEW | AC-6 Testcontainers coverage |
| `packages/shared/src/generated/**` | REGEN | New field + operation; drift gate |
| `packages/shared/src/constants/i18n-namespace.ts` | UPDATE | `onboardingPage` |
| `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` | UPDATE | Namespace → `onboarding-page` |
| `apps/money-tracker/messages/{en,uk}/onboarding-page.json` | NEW | All flow strings, both locales, same commit |
| `apps/money-tracker/src/constants/routes.ts` | UPDATE | `ROUTES.onboarding` |
| `apps/money-tracker/src/app/[locale]/layout.tsx` | UPDATE | Flag-aware `userName` (D-F) |
| `apps/money-tracker/src/app/[locale]/sign-up/SignUpFormSection.tsx` | UPDATE | Success → onboarding |
| `apps/money-tracker/src/utils/resolve-onboarded-profile.ts` (+ test) | NEW | Shared gate (D-J) |
| All `fetchProfile`-gated pages (dashboard, transactions ×4, categories ×3, settings) | UPDATE | Swap inline gate for the helper |
| `apps/money-tracker/src/app/[locale]/onboarding/**` | NEW | Page, constants, StepIndicator, CurrencyStep, CategoriesStep (+ scss/tests/hooks) |
| `apps/money-tracker/src/constants/currency-option-list.ts` (from `settings/constants/`) | MOVE | Used by two routes now |
| `apps/money-tracker/src/actions/{update-default-currency.ts,assign-default-categories.ts,complete-onboarding.ts}` (+ tests) | NEW | The three mutations (NFR6) |
| 5-2 lift: `transactions/import/{components,utils,types,hooks}` route-agnostic pieces → `src/components/transaction-import/…`, `src/hooks/use-import-flow.ts`, `src/utils/transaction-import/…` (+ their tests) | MOVE | Reuse without cross-route imports (AC 4) |
| `apps/money-tracker/src/app/[locale]/transactions/import/{page.tsx,components/import-page-content/**,components/import-result-panel/**}` | UPDATE | Re-point imports post-lift; behavior unchanged |
| `_bmad-output/implementation-artifacts/visual-qa/5-3-onboarding-flow/` | NEW | Committed AC-10 evidence |

No new dependencies. No `packages/ui` / `packages/shell` / `packages/widgets` source changes (the plain-header branch already exists; `SignUpForm` widget keeps its `onSuccess` contract — only the app wrapper's handler changes).

### Current state of the system this story builds on (preserve, don't break)

- **Profile plumbing (FR5):** `users.defaultCurrency` is nullable text (no default); `UsersApiService.usersMe`/`usersUpdateMe`; `UpdateUserDto` fields all optional with `@IsIn(CURRENCY_CODE_LIST)`/`LOCALE_CODE_LIST` + `OPENAPI_ENUM_NAME` enum names — mirror that decoration style for the new boolean. `fetchProfile()` is `cache()`-wrapped and called by the layout AND pages — the helper adds no extra requests.
- **Import stack (5-1/5-2):** `TransactionsApiService.transactionsImportPreview`/`transactionsImport` (multipart `{ file }`); preview DTO counts + categories-to-create + near-duplicates; 400 `VALIDATION_ERROR` with `details.rowErrorList`; 413 mapped **by status** (`HTTP_STATUS_CODE.PayloadTooLarge`), body code stays `INTERNAL_ERROR`; client pre-checks read `TRANSACTION_IMPORT_MAX_FILE_SIZE_BYTES`/`_MEBIBYTES` from `@supertool/shared`; `experimental.serverActions.bodySizeLimit: '6mb'` already set in `next.config.ts` (nothing to raise). `useImportFlow` owns file/preview/report/pending state and already `.catch`-hardens rejected actions to the UNKNOWN state. Execute revalidates transactions/dashboard/categories via `revalidateImportTargets`.
- **Idempotency/scoping (5-1, already fixed — do not re-plan):** `import_key` unique per `(user_id, import_key)` (migration `0004`); two-user full-copy asserted in `transaction-import.integration.spec.ts`. Positional-dedup and name-only-category-preview caveats are surfaced by the reused preview copy.
- **Category storage (2-1):** `transaction_categories` unique on `[userId, name, type, parentId]` with NULLS NOT DISTINCT (constraint, not index — do not convert); category upserts everywhere use `onConflictDoNothing` on that target. `transactionCategoriesCreate` (single) exists; there is no bulk endpoint until this story.
- **Shell/gating:** `AppShell` plain-header branch renders when `userName === undefined` (ToolNav + ThemeSwitcher + LocaleSwitcher only); `LocaleLayout` fetches the profile and feeds `AppShellSection`; `proxy.ts` redirects cookie-less requests to sign-in (`PUBLIC_PATH_LIST = [signIn, signUp]`) — onboarding is NOT public (requires auth). Every protected page currently inlines `fetchProfile()` + `redirect({ href: ROUTES.signIn, locale })`.
- **4.3 auto-fit:** bare `/dashboard`/`/transactions` resolve to the user's latest-transaction month (`resolveDefaultPeriod`); a fresh user with no data resolves to the current month and the localized empty states render — the skip/defaults completion path needs nothing extra.
- **UI primitives available:** `Combobox` (searchable — the currency picker), `Card`, `Field`/`FieldLabel`/`FieldDescription`, `Button`, `Alert`, `Separator`, `Typography`, `RadioGroup`. No stepper/wizard exists anywhere — `StepIndicator` is net-new route-local (do NOT add it to `packages/ui`; single-consumer).
- **Test harness:** component tests mock `next-intl` (identity `translate` with `.has`) and actions via `vi.hoisted` (`ImportPageContent.test.tsx`, `ProfileForm.test.tsx` are the templates); action tests mock `next/headers`, `createServerApiClient`, the SDK service, `next/cache` (`create-transaction.test.ts`). Visual-QA naming: `<scenario>--<viewport>--<theme>.png` (5-2 convention).

### Reference patterns (ED1 — study, adapt, never copy/import)

- `example/track-my-life/apps/money-tracker/src/app/[locale]/(onboarding-layout)/onboarding/page.tsx` + `page.content.tsx` — single `/onboarding` route, `?step=` param stepper, centered card. Supertool adapts: no route group (D-F), no `?currency=` param (D-D), guards per Recommended Approach.
- `…/onboarding/components/currency-step/CurrencyStep.tsx` — RHF+zod + Combobox form shape; supertool persists on submit (D-D) instead of URL-forwarding.
- `…/onboarding/components/categories-step/CategoriesStep.tsx` + `hooks/use-categories-step.ts` — defaults-button action wiring, import-inside-onboarding composition, continue-gating state shape. Supertool replaces the client parse/validate with the 5-2 server-preview flow and adds Skip (D-E).
- `…/onboarding/components/step-indicator/StepIndicator.tsx` — dot/label stepper presentation (2 steps here).
- `…/(app-layout)/layout.tsx` + `src/actions/redirect-if-not-onboarded.ts` + `src/actions/fetch-onboarding-status.ts` — the gating idea (status-driven redirects); supertool folds it into the per-page profile gate (D-J) since the flag rides on the profile DTO.
- `…/messages/en/onboarding-page.json` — namespace name + key granularity; supertool keeps its flat-ish style consistent with `transaction-form.json` (incl. `errors.*`).
- `example/tracker-backend-api/src/modules/onboarding/{onboarding.controller.ts,onboarding.service.ts}` — completion semantics (flag write) and default-assignment transaction shape; supertool relocates both per D-B.
- `example/tracker-backend-api/src/database/seeds/default-transaction-category.seed.ts` — the default catalog content (carried as data, D-C).
- **No reference counterpart — new ground:** the explicit Skip completion path (D-E); the server-preview import inside onboarding (reference onboarding parses client-side); the flag-aware plain-shell chrome (D-F); backfill-existing-users migration semantics.

### Conventions to honor (hard rules + memories)

- **D1:** no money math anywhere in this story — import counts and category counts are `number` by contract (counts, not money); never parse/sum amounts client-side.
- **NFR6/D8:** the three new actions + the reused import actions are the only API paths; regenerate + commit the client; hand-written `fetch` is a defect.
- **D7:** controller → service → repository for both API touches; the defaults insert lives in the transaction-categories repository, in one `db.transaction`.
- **NestJS DI:** explicit `@Inject(...)` per constructor param; never `import type` an injectable (memory `nest-di-explicit-inject`).
- **FR19/FR20:** both locales same commit; ICU only; `translate` alias (never `t`); namespace via `I18N_NAMESPACE.onboardingPage`, no string literals.
- **React/files:** `FC<Props>`; PascalCase component files + co-located scss/test; dirs kebab-case; `on*`/`handle*`; `List`-suffixed arrays; no comments; no `as` (except `as const`); named exports, no barrels; routes only via `ROUTES`; `redirect`/`useRouter` from `@supertool/next-shared` i18n navigation; minimize `'use client'` (page/StepIndicator stay server where possible; the two step forms are the client islands).
- **SCSS:** design tokens only, camelCase classes, mobile-first, no fixed widths that overflow 390px.
- **TS:** no TS enums — as-const maps + `ObjectValuesUnion`; one source of truth for value sets (catalog listed once).
- **Tests:** co-located, pnpm scripts only, retry the transient `H.replace` crash, `TURBO_FORCE=true` for gate verification (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`).
- **Branch:** `TOOLS-5-3/onboarding-flow` off `main`; conventional commits; PR via `create-pr` skill (memory `story-work-via-pr`). This branch carries the pending `sprint-status.yaml` edits (5-2 → done, 5-3 → ready-for-dev) already in the working tree.

### Out of scope (explicit guardrails)

- **No analytics endpoints/widgets** (5-4/5-5), no by-category drill-down (5-6), no recurring/export/bulk/search (Epic 6), no change-password/delete-account/landing (Epic 7).
- **No password step, no OAuth, no email verification** (FR1 descoped them; D-G).
- **No currency picker/filter anywhere outside the onboarding step and settings** (RP-D1); no cross-currency aggregation; no change to how analytics scope currency.
- **No changes to the 5-1 import contract or validation rules**, no preview-token/`totalErrorCount` contract work (deferred-work items — pull only if the operator asks), no seed-engine redesign.
- **No `DefaultTransactionCategory` table/admin surface** (D-C), no localized category catalogs (D-I).
- **No `packages/ui` stepper component**, no `packages/shell`/`widgets` source changes, no `proxy.ts` changes, no route groups.
- **No home/landing gating changes** beyond the shared helper's consumers (the `/` placeholder page stays as-is; F8 is Epic 7).

### Project Structure Notes

- The onboarding route dir mirrors the established page-scoped layout (`components/<kebab>/PascalCase.tsx`, `hooks/`, `constants.ts`) used by `transactions/` and `settings/`. The three new actions join `src/actions/` (verb-first kebab). The lift moves shared import pieces to the app-wide `src/{components,hooks,utils}` homes the placement table prescribes for two-route consumers — `ImportPageContent`/`ImportResultPanel` stay route-local by the same rule (single consumer).
- API surface stays inside the two existing modules (D-B) — no structural novelty; the new DTO/constants files follow the module's `dtos/`/`.constants.ts` conventions.
- Follow-on note for 5-6/6-x: `resolveOnboardedProfile` becomes the single page gate — new pages should use it, not `fetchProfile` inline.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3] — story statement + 5 BDD AC blocks (routing in/out, currency persistence, both category paths, completion→dashboard, tests/i18n/mobile/screenshots)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — epic charter: D1/D7/NFR6/FR19-20/NFR1 binding, RP-D1 single-default-currency, per-story mobile-QA, evidence-reference convention, 4.3 auto-fit composition
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — row F1 (P0; = RP-F1 in epics.md), §5 defects (bare import input — already exceeded by 5-2), §6 strengths to protect (dark mode, locale), §7 currency decision (epics.md's RP-D1)
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions / Implementation Patterns] — D5-D9 (proxy sessions, REST/envelope, drift gate, RSC/server actions), placement table, agent MUSTs, FR5 profile scope
- [Source: _bmad-output/implementation-artifacts/5-1-transaction-import-endpoint.md] — composite `(user_id, import_key)` fix (D-D there; review finding "the 5.3 onboarding path would hit" — FIXED, do not re-plan), preview caveats, 413 contract
- [Source: _bmad-output/implementation-artifacts/5-2-standalone-import-page.md] — lift-readiness note (Project Structure Notes), D-A no-client-parsing (stands here), D-C route-local unions, D-F caveat copy, rejection-hardening lesson, visual-QA naming
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-07-04.md] — D1 committed-evidence standing pattern, D3 spec-time divergence sign-off (D-B/D-C/D-F flags), action #4 pre-QA checklist
- [Source: _bmad-output/implementation-artifacts/spike-reference-parity/41-ref-capture-authenticated-log.md + visual-qa/spike-reference-parity/reference/onboarding--*.png] — reference onboarding UX evidence (2 steps, combobox, defaults-or-import)
- [Source: apps/api/src/database/schemas/users.ts + seeds/seed-operator.ts] — schema/seed touch points
- [Source: apps/api/src/modules/users/** + apps/api/src/modules/transaction-categories/**] — modules extended (DTO decoration style, conflict target, layering)
- [Source: apps/money-tracker/src/app/[locale]/{layout.tsx,sign-up/SignUpFormSection.tsx} + packages/shell/src/components/app-shell/AppShell.tsx] — flag-aware shell + signup redirect touch points
- [Source: apps/money-tracker/src/app/[locale]/transactions/import/** + src/actions/{preview,execute}-transaction-import.ts] — the lift subjects + reused actions
- [Source: apps/money-tracker/src/app/[locale]/settings/** (ProfileForm, profile-form-schema, currency-option-list)] — currency form pattern + lifted constant
- [Source: apps/money-tracker/src/actions/{fetch-profile.ts,update-profile.ts,create-transaction.ts} + src/utils/resolve-default-period.ts] — action/gate/auto-fit patterns
- [Source: packages/shared/src/constants/{currency.ts,i18n-namespace.ts,error-codes.ts,transaction-import.ts}] — value sources
- [Source: example/track-my-life/…/(onboarding-layout)/onboarding/** + example/tracker-backend-api/src/modules/onboarding/** + …/seeds/default-transaction-category.seed.ts] — reference patterns (see Reference patterns; ED1)
- [Source: .claude/rules/{react.md,i18n.md,styles.md,javascript.md,typescript.md,nestjs-apis.md}] — conventions

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]` (autonomous dev-story run).

### Debug Log References

- All decisions D-A…D-J implemented as specified; no re-planning.
- Autonomous decisions taken during implementation (consistent with existing repo patterns):
  - `resolveOnboardedProfile` uses `return redirect(...)` on both guard branches — next-intl's `redirect` is typed `=> never` but TS control-flow narrowing across a bare call proved insufficient under this tsconfig; `return redirect(...)` is the established page pattern and narrows `profile` correctly. Same fix applied to the onboarding `page.tsx` guards.
  - `resolveStep` (onboarding page) accepts `string | null | undefined` for `defaultCurrency` because the generated `UserResponseDto.defaultCurrency` is `CurrencyCode | null | undefined` (optional via `@ApiPropertyOptional`).
  - Onboarding action error-state builders (`buildUnknownState`, `buildUnknownError`) are explicitly typed to avoid object-literal widening of `UNKNOWN_ERROR_CODE` to `string` (would break `setState<ActionState>` / `setErrorCode`).
  - `CurrencyStep` `defaultValues` uses conditional spread `{ ...(cond && { defaultCurrency }) }` (mirrors reference) because the schema field is required and `exactOptionalPropertyTypes` rejects an explicit `undefined`.
  - Extracted `buildUserUpdateValues` (users.repository) and `resolveStep` + inline step render (onboarding page) + a `partitionByLevel` test helper to satisfy `max-statements` (≤10).

### Completion Notes List

- **API (Tasks 2–3):** `onboarding_completed` column (migration `0005` + one-time backfill `UPDATE users SET onboarding_completed = true;`); `seedOperator` ensure-completed step; `UserResponseDto`/`UpdateUserDto` field + `USER_RESPONSE_COLUMNS` + explicit `updateScoped` branch. New `POST /transaction-categories/defaults` → `createDefaults` (operationId `transactionCategoriesCreateDefaults` verified in `openapi.json`) returning `DefaultCategoriesResponseDto { topLevelCreated, childrenCreated }`; repository builds the constant `DEFAULT_CATEGORY_CATALOG` parents-then-children in one `db.transaction`, `onConflictDoNothing` on `[userId, name, type, parentId]`, re-selecting top-level rows by `parentId IS NULL` to link children (idempotent, user-scoped, coexists with same-named user categories). Client regenerated + drift-clean.
- **Lift (Task 4):** `git mv` of the 5-2 route-agnostic pieces → `src/components/transaction-import/…`, `src/hooks/use-import-flow.ts`, `src/utils/transaction-import/…`, `src/types/transaction-import.ts`; import paths updated in `ImportPageContent`, `ImportResultPanel`, the two import actions. `ImportPageContent`/`ImportResultPanel`/`page.tsx` stay route-local. All moved tests pass unchanged; standalone import page verified working live.
- **Routing (Task 5):** `ROUTES.onboarding`; `layout.tsx` passes `userName` only when `onboardingCompleted`; `resolveOnboardedProfile` gate replaces the inline `fetchProfile()`+redirect on all nine protected pages; sign-up success → `/onboarding`.
- **i18n (Task 6):** `onboardingPage` namespace registered + mapped to `onboarding-page`; `en`/`uk` message files with ICU plurals (Ukrainian one/few/many/other) — `pnpm i18n:parity` green.
- **Onboarding UI (Task 7) + actions (Task 8):** `/onboarding` RSC (URL-param stepper, guards, deep-link guard folded into `resolveStep`), `StepIndicator`, `CurrencyStep` (persists immediately via `update-default-currency`), `CategoriesStep` (defaults / reused server-preview import / skip → `complete-onboarding` → `router.replace(dashboard)`). `CURRENCY_OPTION_LIST` lifted to `src/constants/`, `ProfileForm` re-pointed.
- **Tests (Task 7 AC):** StepIndicator, CurrencyStep, CategoriesStep, the three actions, and `resolveOnboardedProfile` all covered; API service/controller/DTO + Testcontainers coverage (defaults two-level/independent/idempotent/coexist, `onboardingCompleted` round-trip, operator stays completed after re-seed).

**Gate results (all green):** `type-check` ✓, `lint` ✓, `stylelint` ✓, `fmt:check` ✓, `test` ✓ (api 236, money-tracker 238, ui 77, shell 27, next-shared 10, widgets 9, shared 7), `i18n:parity` ✓, `build` ✓, OpenAPI drift ✓ (regenerated client reproduces identically).

**Visual QA (AC 10) — evidence in `_bmad-output/implementation-artifacts/visual-qa/5-3-onboarding-flow/`:** captured live as fresh signed-up users on `:3000` (server cwd verified as this checkout; DB migrated + baseline verified). 15 screenshots across light/dark × mobile(390)/desktop covering: currency idle, currency combobox open, categories choice, defaults-assigned (18 categories / 39 subcategories), dashboard-after-defaults (full shell, current-month empty state), import preview (New rows: 1880 — cross-user independent copy + caveat copy), import result (compact onboarding-owned: 1,880 imported / 21 categories / 34 subcategories + Continue), transactions-after-import (real UAH data), dashboard auto-fit to February 2025, operator dashboard with real figures (summary + category breakdown + 12-month trend). Verified: sign-up → `/onboarding` (plain header); currency persist → categories; `?step=categories` deep-link guard; onboarded user → `/onboarding` redirects to `/dashboard`; operator sign-in never sees onboarding; skip path → dashboard; `documentElement.scrollWidth === window.innerWidth` true at 390px on currency/categories/import-preview steps (AC 9). Note: the import-path dashboard figures read empty for the QA user because that user's default currency (USD) does not match the seed data currency (UAH) — this is correct RP-D1 single-default-currency dashboard scoping (pre-existing Epic 3 behaviour, flagged in the `currency-simplified-single-default` memory), not a 5-3 defect; the operator (UAH default + UAH data) capture shows the fully populated dashboard on the same auto-fit month. DB baseline restored afterwards (QA users + their rows deleted; verified 1880 tx, latest 2025-02-03, 110 categories, operator `onboarding_completed = true`).

### File List

**API (created):**
- `apps/api/src/database/migrations/0005_melted_princess_powerful.sql` (+ meta snapshot/journal)
- `apps/api/src/modules/transaction-categories/transaction-categories.constants.ts`
- `apps/api/src/modules/transaction-categories/dtos/default-categories-response.dto.ts`

**API (modified):**
- `apps/api/src/database/schemas/users.ts`
- `apps/api/src/database/seeds/seed-operator.ts`
- `apps/api/src/modules/users/dtos/{user-response.dto.ts,update-user.dto.ts}`
- `apps/api/src/modules/users/users.repository.ts` (+ `users.repository.spec.ts`)
- `apps/api/src/modules/transaction-categories/{transaction-categories.controller.ts,transaction-categories.service.ts,transaction-categories.repository.ts}` (+ controller/service specs)
- `apps/api/test/integration/{transaction-categories,users-profile,seed,auth}.integration.spec.ts`

**Shared / generated (modified):**
- `packages/shared/src/constants/i18n-namespace.ts`
- `packages/shared/src/generated/{sdk.gen.ts,types.gen.ts,index.ts}` (regenerated)

**Frontend (created):**
- `apps/money-tracker/messages/{en,uk}/onboarding-page.json`
- `apps/money-tracker/src/actions/{update-default-currency,assign-default-categories,complete-onboarding}.ts` (+ tests)
- `apps/money-tracker/src/utils/resolve-onboarded-profile.ts` (+ test)
- `apps/money-tracker/src/app/[locale]/onboarding/{page.tsx,page.module.scss,constants.ts}`
- `apps/money-tracker/src/app/[locale]/onboarding/components/step-indicator/{StepIndicator.tsx,.module.scss,.test.tsx}`
- `apps/money-tracker/src/app/[locale]/onboarding/components/currency-step/{CurrencyStep.tsx,.module.scss,.test.tsx,currency-step-schema.ts}`
- `apps/money-tracker/src/app/[locale]/onboarding/components/categories-step/{CategoriesStep.tsx,.module.scss,.test.tsx,hooks/use-categories-step.ts}`

**Frontend (moved — 5-2 lift):**
- `src/components/transaction-import/{import-dropzone,import-preview-panel,import-error-panel,near-duplicate-alert}/…`
- `src/hooks/use-import-flow.ts`
- `src/utils/transaction-import/{check-import-file,format-file-size,get-import-file,get-checked-import-file,prepare-import-error-state,revalidate-import-targets}.ts` (+ tests)
- `src/types/transaction-import.ts`
- `src/constants/currency-option-list.ts` (from `settings/constants/`)

**Frontend (modified):**
- `apps/money-tracker/src/constants/routes.ts`
- `apps/money-tracker/src/app/[locale]/layout.tsx`
- `apps/money-tracker/src/app/[locale]/sign-up/SignUpFormSection.tsx`
- protected pages: `dashboard/page.tsx`, `transactions/{page.tsx,new/page.tsx,[id]/edit/page.tsx,import/page.tsx}`, `categories/{page.tsx,new/page.tsx,[id]/edit/page.tsx}`, `settings/page.tsx`
- `transactions/import/components/import-page-content/ImportPageContent.tsx`, `import-result-panel/ImportResultPanel.tsx`
- `src/actions/{preview-transaction-import,execute-transaction-import}.ts`
- `settings/components/profile-form/ProfileForm.tsx` (+ `ProfileForm.test.tsx`)

**Artifacts (created):**
- `_bmad-output/implementation-artifacts/visual-qa/5-3-onboarding-flow/*.png` (15 captures)

## Change Log

| Date | Change |
|---|---|
| 2026-07-04 | Story created (autonomous run — decisions D-A…D-J recorded in Dev Notes; D-B, D-C, D-F flagged as reference divergences for operator confirmation per epic-4 retro D3) — ready-for-dev. |
| 2026-07-04 | Fresh-context validation pass applied: default-category catalog corrected to the exact reference list (names/casing verbatim, incl. Chandlery/Conferences/Alumni/Dues and the duplicate `Other` children), users-repository change made explicit (`USER_RESPONSE_COLUMNS` + `updateScoped` field branch — silent-failure trap), parent re-select constrained to `parentId IS NULL`, D-F locale-persistence trade-off recorded, seedOperator ensure-pattern wording, lift inventory exact source paths + test-file reality, reference-capture and gap-backlog citation corrections, home-placeholder non-redirect note. |
| 2026-07-05 | Implemented all tasks (API flag + defaults endpoint + migration/backfill, 5-2 lift, flag-aware routing/gate, i18n, onboarding page + steps + actions, full test coverage). All gates green; OpenAPI client regenerated (drift-clean). Visual QA (AC 10) captured live on `:3000` across light/dark × mobile/desktop (15 screenshots) with DB baseline restored. Status → review. |
