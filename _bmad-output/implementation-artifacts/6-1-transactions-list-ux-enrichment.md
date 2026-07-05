---
baseline_commit: c3294e61480206208a07de57b98946a475ceb47e
---

# Story 6.1: Transactions List UX Enrichment

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want to duplicate a transaction, jump months and years quickly, and pick categories from a real hierarchy,
so that repetitive entry and navigation over a large history are fast (RP-F9).

## Context & Why This Story

This is the **first story of Epic 6 (Manage Transactions at Scale)** and the epic's UI-and-current-features opener. It enriches the transactions surface that Epic 2 built and Epic 4 made mobile-solid — it adds **no new API endpoint and no schema change** (frontend-only; the list already carries period/filter/sort state through URL search params).

**Critical scoping fact — two of Story 6.1's three sub-items already shipped in Story 4-2 (PR #30 `6f02927`).** The epics.md Story 6.1 acceptance criteria were written 2026-06-16, before 4-2 landed; a code audit against `main` shows:

1. **Duplicate/copy — already shipped, one AC gap remains.** `TransactionRowActions` renders a `Copy` icon linking to `getTransactionCopyPath(id)` → `/transactions/new?copyFrom=<id>`; `new/page.tsx` reads `COPY_FROM_SEARCH_PARAM`, `fetchTransaction(copyFromId)`, and passes `copyFrom` to `TransactionForm`. The form's `useTransactionForm`/`getDefaultValues` pre-fills from it. **The one unmet AC: epics 6.1 requires the duplicate to open "pre-filled … (date defaulting to today)", but `getDefaultValues` currently uses `prefill.date` for BOTH edit and copy — a duplicated transaction inherits the original's date, not today.** There is also **zero test coverage** for the copy path. This story closes that gap and adds the tests; it does NOT rebuild the copy flow (reuse-first — Epic 5 retro D4).
2. **Hierarchical category picker — already shipped.** `CategoryPicker` (4-2) is the two-pane cascading parent→children picker used in BOTH `TransactionForm` and `TransactionFilters`; it satisfies the epics 6.1 AC ("hierarchical picker presents the two-level tree (parent → children) clearly — replacing any flat list"). Memory `transactions-list-grouped-cards-parity` records this as the standing convention. This story does NOT rebuild it; it regression-guards the AC (two-level presentation + mobile usability) and confirms its existing test coverage.
3. **Month/year navigator — the genuine gap and this story's primary new deliverable.** The transactions list today uses `MonthStepper` (`src/components/month-stepper/MonthStepper.tsx`), which only steps **previous/next month**. There is no way to jump across years quickly. The reference offers a `MonthNavigator` (month chevrons **plus** year up/down controls) so a user can move across a multi-year history without 12 month-clicks per year. This story builds that.

**Net scope of 6.1:** (a) build the month/year navigator, (b) fix the duplicate date-defaults-to-today gap + add copy tests, (c) regression-guard the already-shipped hierarchical picker. Time-of-day picker is **dropped** (RP-D5 — bare `date`, deferred `timestamptz`). No bulk-delete (6-2), export (6-3), search (6-4), or caching (6-5) — those are their own Epic 6 stories.

**Evidence base (binding, per the Epic 4+ evidence-reference convention):**
- Reference captures: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--list--{desktop,mobile}.png` and `transactions--list-bottom--desktop.png` (the month/year navigator in context), `transactions--create-category-picker--desktop.png` (hierarchical picker), `transactions--create--{desktop,mobile}.png` (the create/duplicate form). Supertool baseline: `…/supertool/transactions--create--{desktop,mobile}.png`, `transactions--edit--{desktop,mobile}.png` (no navigator baseline exists — supertool ships only the stepper).
- Reference code to adapt from (ED1 — study, never copy/import): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/month-navigator/MonthNavigator.tsx` + `MonthNavigator.module.scss`, and `example/track-my-life/packages/shared/src/utils/date/year-month.ts` (`getNextMonth`/`getPreviousMonth`, and the year-jump pattern).
- epics.md Story 6.1 + Epic 6 charter; `epic-5-retro-2026-07-05.md`; Story 4-2 (`6f02927`, PR #30) for the shipped copy + picker.

## Recommended Approach (binding direction)

### 1. Month/year navigator (primary new work) — AC 2, 4, 5

Adopt the reference `MonthNavigator` shape: **month previous/next chevrons + a compact year previous/next control (up/down chevrons)** flanking the current-period label — NOT a free-form calendar/dropdown date picker (D-3). This lets the user reach any month/year fast (year jumps + month steps) and matches the reference exactly.

- **Enhance the existing `MonthStepper` in place** rather than adding a parallel component. Rename its directory/component to `month-navigator/MonthNavigator.tsx` (PascalCase file; kebab dir) OR extend `MonthStepper` with year controls — **prefer renaming to `MonthNavigator`** to mirror the reference and because "stepper" no longer describes it. Update all three consumers (`transactions/page.tsx`, `transactions/by-category/page.tsx`, `transactions/by-category/[categoryId]/page.tsx`) and the `MonthStepper.test.tsx`. Keep the shared component in `apps/money-tracker/src/components/` (it is used by multiple routes — shared-constants/no-duplication convention).
- **Preserve the existing URL-param mechanism verbatim:** the component reads `period` (a `PeriodParts`-derived string) and, on navigate, `router.replace({ pathname, query })` with `PERIOD_SEARCH_PARAM` set and `PAGE_SEARCH_PARAM` deleted, `{ scroll: false }` — the same handler the stepper uses today. It already composes with 4.3 first-run auto-fit (the page resolves the default period via `resolveDefaultPeriod`; the navigator only writes the param). Do not touch `resolve-default-period.ts`.
- **Add year-jump utilities to `src/utils/period.ts`** next to `getNextPeriod`/`getPreviousPeriod`: `getPreviousYearPeriod`/`getNextYearPeriod` (or a single `shiftPeriodYears`) built on the existing `parsePeriod`/`formatPeriod` — no new date library, no float, reuse the existing `PeriodParts` shape and constants. Year jumps keep the same month (e.g. `2024-05` → `2023-05`).
- **i18n:** add `navigation.monthNav.previousYear` / `nextYear` (and keep `previous`/`next` for months) to `navigation.json` in BOTH `en` and `uk` — real Ukrainian, ICU, `pnpm i18n:parity` green. The navigator already reads `${I18N_NAMESPACE.navigation}.monthNav`.
- **Mobile-first SCSS (tokens only):** the year control stacks its two chevrons vertically (reference `.yearControl { flex-direction: column }`, `.yearButton { width/height: 1.25rem }`); the whole navigator must stay touch-usable and not overflow at 390px (it sits in the transactions page `header .controls` next to the "Add transaction" button — verify the row wraps/fits).

### 2. Duplicate date-defaults-to-today fix + tests — AC 1

- In `transaction-form/hooks/use-transaction-form.ts`, `getDefaultValues` must distinguish **edit** (keep `transaction.date`) from **duplicate** (use `getTodayDate()`). Today it receives `transaction ?? copyFrom` as one `prefill` arg and always uses `prefill.date`. Change the signature so the copy case overrides `date` with `getTodayDate()` while still inheriting `type`, `amount`, `categoryId`, `note`, and `currency` from the source. Keep edit behavior identical (edit still shows the original date).
- Everything else about the copy flow (the `Copy` action, `getTransactionCopyPath`, `?copyFrom=`, `fetchTransaction`, `new/page.tsx` wiring, the "Duplicate" label already in `transactions-page.json`) is correct and stays as-is.
- **Add the missing tests:** a `use-transaction-form` (or `TransactionForm`) test asserting the duplicate pre-fill copies fields but resets `date` to today; keep/extend `new/page.tsx` copy wiring coverage if a page-level test pattern exists. Reuse `getTodayDate` (already imported in the hook).

### 3. Hierarchical category picker — verify/regression-guard — AC 3

- No rebuild. Confirm `CategoryPicker` still presents the two-level tree (parent list → subcategory pane) clearly in the create/edit form, honors the user's restructured hierarchy (it renders whatever `categoryList` returns), and is touch-usable at 390px. Its existing `CategoryPicker.test.tsx` covers behavior — extend only if a coverage gap surfaces during the visual QA (e.g. a two-level rendering assertion).
- If, and only if, the reference `transactions--create-category-picker--desktop.png` reveals a concrete UX affordance supertool lacks (e.g. a searchable filter within the picker), record it as a **flagged reference divergence for operator confirmation** rather than silently adding scope — the picker is already at the recorded parity bar.

## Acceptance Criteria

1. **Duplicate opens the form pre-filled with the date defaulting to today (RP-F9).** Given a transaction in the list, when I choose Duplicate (the existing `Copy` action → `/transactions/new?copyFrom=<id>`), then the entry form opens pre-filled with that transaction's type, amount, category, currency, and note, **with the date set to today (not the source transaction's date)**, and saving creates a new transaction via the generated client, visible without a full reload (NFR5/D9). The already-shipped copy wiring is reused, not reimplemented; a component test asserts the today-date pre-fill and field carry-over.
2. **Month/year navigator jumps across months and years (RP-F9).** Given the transactions list, when I use the navigator, then I can step previous/next month AND jump previous/next year (reaching any month/year without 12 month-clicks per year); the selected period travels via the `period` URL search param (D9 — shareable, back-button-safe), `page` is reset on navigation, and it composes with the 4.3 first-run auto-fit (the default period still resolves as today). The navigator replaces the previous/next-only `MonthStepper` across the transactions list and the by-category views that use it, consistently.
3. **Category field uses the hierarchical two-level picker (already shipped; regression-guarded).** Given the create/edit (and duplicate) form, when I pick a category, then the two-pane cascading `CategoryPicker` presents the two-level tree (parent → children) clearly — not a flat list — and reflects the user's restructured hierarchy. No flat-list fallback is introduced; the picker's behavior and tests remain green.
4. **Everything is fully usable on mobile (NFR8 — per-story mobile-QA check).** Given a 390px viewport, when I use Duplicate, the month/year navigator, and the category picker, then all controls are reachable, legible, and touch-operable with no horizontal overflow (`document.documentElement.scrollWidth === window.innerWidth`); the navigator's year control and the picker's second pane do not clip.
5. **Frontend-only — no backend contract change (NFR6/D8).** Given this story touches no DTO, endpoint, or schema, then no OpenAPI/generated-client regeneration is required and the drift gate is a no-op (explicitly stated in the Dev Agent Record, per the Epic 5 retro frontend-only convention). The list continues to consume the API exclusively through the generated client — no hand-written fetch is added (NFR6).
6. **i18n parity (FR19/FR20).** New navigator strings (`monthNav.previousYear`, `monthNav.nextYear`) land in `apps/money-tracker/messages/{en,uk}/navigation.json` in the same commit — real Ukrainian, ICU only, no concatenation; `pnpm i18n:parity` green. No hardcoded user-facing strings.
7. **Tests ship with the feature (NFR1).** Component tests cover: the month/year navigator URL round-trip (month prev/next AND year prev/next each set `period` correctly and reset `page`); the year-jump `period` utilities (unit tests incl. same-month-preserved and boundary years); the duplicate pre-fill (fields copied, date = today); the picker regression check (two-level tree renders). All existing transactions/period tests updated for the rename stay green. All repo gates pass (`TURBO_FORCE=true` where turbo may replay stale logs).
8. **Visual QA evidence — committed (epic-4 retro D1 standing pattern, Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/6-1-transactions-list-ux-enrichment/` contains **light + dark × 390px + desktop** captures of: the transactions list with the new month/year navigator (idle + a year-jumped period), the duplicate form pre-filled (showing today's date + carried-over fields), and the category picker open (second pane visible). Compared against reference `transactions--list--{desktop,mobile}`, `transactions--create--{desktop,mobile}`, and `transactions--create-category-picker--desktop`, with observations in the Dev Agent Record. Captured on `:3000` with the pre-QA environment checklist honored (verify `:3000` cwd is this checkout; DB baseline latest txn = 2025-02-03) and the DB baseline restored afterwards if any mutation ran.

## Tasks / Subtasks

- [ ] **Task 1 — Study the reference and the current state before writing code** (AC: all)
  - [ ] Reference (ED1 — carry patterns, never code): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/month-navigator/MonthNavigator.tsx` + `MonthNavigator.module.scss` (month chevrons + vertical year control), `example/track-my-life/packages/shared/src/utils/date/year-month.ts` (`getNextMonth`/`getPreviousMonth`; year-jump = `year ± 1` keeping month). Reference captures listed in Evidence base. Note deliberate divergences D-1…D-5 below.
  - [ ] Read in full the files this story updates: `apps/money-tracker/src/components/month-stepper/MonthStepper.tsx` (+ `.module.scss`, `.test.tsx`, `ChevronIcon`), `apps/money-tracker/src/utils/period.ts` (+ `period.test.ts` if present), `apps/money-tracker/src/utils/format-period-label.ts`, `apps/money-tracker/src/constants/search-params.ts`, the three MonthStepper consumers (`transactions/page.tsx`, `transactions/by-category/page.tsx`, `transactions/by-category/[categoryId]/page.tsx`), `transaction-form/hooks/use-transaction-form.ts` (+ `TransactionForm.tsx`), `transaction-form/…` copy path via `new/page.tsx` + `constants/routes.ts` (`COPY_FROM_SEARCH_PARAM`, `getTransactionCopyPath`), `transaction-row-actions/TransactionRowActions.tsx`, `category-picker/CategoryPicker.tsx` (+ `.test.tsx`, `hooks/use-category-picker.ts`), `utils/get-today-date.ts`.
- [ ] **Task 2 — Year-jump period utilities** (AC: 2, 7)
  - [ ] Add `getPreviousYearPeriod`/`getNextYearPeriod` (or `shiftPeriodYears`) to `src/utils/period.ts`, built on `parsePeriod`/`formatPeriod`; keep month constant on a year jump; reuse existing constants (no magic numbers, no new dep, no float). Unit tests: same-month-preserved, forward/backward, boundary years.
- [ ] **Task 3 — Month/year navigator component** (AC: 2, 4, 6)
  - [ ] Rename `components/month-stepper/` → `components/month-navigator/` (`MonthNavigator.tsx` exporting `MonthNavigator`, co-located `.module.scss`, `.test.tsx`, `ChevronIcon` kept); `git mv` + update imports. Add year previous/next controls (up/down chevrons) beside the label, wired to the Task 2 utils via the existing `handleNavigate` (sets `PERIOD_SEARCH_PARAM`, deletes `PAGE_SEARCH_PARAM`, `router.replace(..., { scroll:false })`). Reference: `month-navigator/MonthNavigator.tsx`.
  - [ ] Mobile-first SCSS (tokens only): vertical year control (`flex-direction: column`, small year buttons), navigator fits the transactions header `controls` row at 390px without overflow. Reference: `MonthNavigator.module.scss`.
  - [ ] Update the three consumers to import/render `MonthNavigator` (props unchanged: `period`).
- [ ] **Task 4 — i18n for the navigator** (AC: 6)
  - [ ] Add `monthNav.previousYear` / `monthNav.nextYear` to `apps/money-tracker/messages/{en,uk}/navigation.json` (real Ukrainian). `pnpm i18n:parity` green.
- [ ] **Task 5 — Duplicate date-defaults-to-today fix** (AC: 1, 7)
  - [ ] In `use-transaction-form.ts` `getDefaultValues`, distinguish edit (keep source `date`) from duplicate (override `date` with `getTodayDate()`); carry over `type`/`amount`/`categoryId`/`note`/`currency` for both. No change to the copy wiring, routes, or `new/page.tsx`.
  - [ ] Add a component/hook test asserting the duplicate pre-fill (fields copied, date = today) and that edit still shows the original date.
- [ ] **Task 6 — Hierarchical picker regression guard** (AC: 3, 4)
  - [ ] Confirm `CategoryPicker` renders the two-level tree in create/edit/duplicate and stays touch-usable at 390px; extend `CategoryPicker.test.tsx` only if a two-level-rendering coverage gap is found. If the reference picker exposes an affordance supertool lacks, record it as a flagged divergence (do not silently expand scope).
- [ ] **Task 7 — Gates, visual QA, record** (AC: 4, 7, 8)
  - [ ] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only, `TURBO_FORCE=true` where turbo may replay stale logs (memories `run-tests-via-pnpm-scripts`, `turbo-cache-masks-gate-results`).
  - [ ] Capture and commit the visual-QA matrix per AC 8 under `visual-qa/6-1-transactions-list-ux-enrichment/`; verify `:3000` cwd + seed baseline before capture; restore the DB baseline after any capture that mutated data (memories `worktree-dev-server-stale-qa`, `seed-idempotent-truncate-before-reseed`).
  - [ ] Record in the Dev Agent Record: the drift-gate no-op statement (AC 5), D-1…D-5 divergence decisions, and any flagged reference divergence for operator confirmation at PR (Epic 5 retro Action #5).

## Dev Notes

### Decisions (D-x) — reference-consistent, recorded for operator confirmation at PR

- **D-1 — Duplicate/copy is already shipped (4-2); do not rebuild.** The `Copy` action, `?copyFrom=` route, `fetchTransaction`, and form pre-fill exist on `main` (PR #30). This story closes the single unmet AC (date must default to today on duplicate — currently inherits the source date) and adds the missing test coverage. Rationale: reuse-first (Epic 5 retro D4); rebuilding a shipped, working flow would be a defect. Reference-consistent (the reference's duplicate also opens the create form with today's date).
- **D-2 — Hierarchical category picker is already shipped (4-2); regression-guard, don't rebuild.** `CategoryPicker` is the two-pane cascading parent→children picker used in form + filters; it meets the epics 6.1 picker AC and the recorded parity convention (memory `transactions-list-grouped-cards-parity`). Rationale: the picker AC is already satisfied; re-implementing risks regressing the 4-2 keyboard/ARIA behavior.
- **D-3 — Month/year navigator adopts the reference `MonthNavigator` shape (month chevrons + year up/down controls), not a free-form calendar/dropdown picker.** Rationale: reference-consistent (ED1); the reference considers year-jump + month-step its "navigator", which satisfies the epics AC's intent (fast navigation over a large history). A true dropdown month/year picker would be a UX divergence from the reference — **flagged for operator confirmation** if desired later; not built here to keep parity and scope tight.
- **D-4 — Frontend-only story; drift gate is a no-op.** No DTO, endpoint, or schema change — the list already carries period via URL search params (Story 2-2/2-5). Per the Epic 5 retro convention, a frontend-only story states the drift-gate no-op explicitly in the Dev Agent Record rather than regenerating the client.
- **D-5 — Time-of-day picker dropped (RP-D5).** Transaction dates stay bare `date`; the `timestamptz` migration is deferred tech debt (`implementation-artifacts/tech-debt-transaction-date-to-timestamptz.md`). No time control anywhere in this story.

### Out of scope (explicitly — belongs to later Epic 6 stories)

- **Bulk delete → Story 6-2** (multi-select + action bar, consistent across list + by-category, cap 100). Epic 5 retro Action #3 wires it onto the 5-6 by-category view **in 6-2**, not here.
- **Export CSV/JSON → Story 6-3** (+ the reference `ExportTransactionButton` deferred by name in 5-6 D-8, Epic 5 retro Action #4).
- **Full-text search → Story 6-4**, which also closes the **repo-wide shape-only date-validation debt** (Epic 5 retro Action #1). This story adds no date-range input, so that debt is not triggered here.
- **Analytics response caching + analytics range-robustness → Story 6-5** (Epic 5 retro Action #2).

### Epic 5 retro action items that DO apply to this UI story

- **Action #5 — Make divergence-flag resolution explicit at PR time:** list D-1…D-5 (and any flagged reference divergence) in the PR description as a short operator checklist.
- **Action #6 — Pre-QA + post-QA DB-baseline checklist:** `lsof`-verify the `:3000` cwd is this checkout, capture on the clean seed baseline (latest txn = 2025-02-03), and `TRUNCATE` + re-seed after any capture that mutated data. This story's captures include the duplicate flow, which can create a transaction if saved during QA — restore afterwards.

### Reference patterns (ED1 — study, adapt, never copy/import)

- Month/year navigator: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/month-navigator/MonthNavigator.tsx` (+ `.module.scss`) — adapt to supertool: `FC<Props>`, PascalCase file, `@supertool/*` imports, `translate` not `t`, existing `PERIOD_SEARCH_PARAM` mechanism, `next-shared` i18n `useRouter`/`usePathname`.
- Year-month math: `example/track-my-life/packages/shared/src/utils/date/year-month.ts` — the year-jump is `year ± 1` keeping month; supertool already has the equivalents (`parsePeriod`/`formatPeriod`/`getNextPeriod`/`getPreviousPeriod`) in `src/utils/period.ts`, so extend there (no new util module).
- Duplicate form (create form reused): `example/track-my-life/…/transactions/components/transaction-form-page/` — supertool's counterpart is `transaction-form/` + `new/page.tsx` (already wired for copy).
- Category picker: `transactions--create-category-picker--desktop.png` reference capture; supertool counterpart `category-picker/CategoryPicker.tsx` (already at parity).

### Hard-rule guardrails (CLAUDE.md / architecture.md — binding)

- Money is strings end-to-end; no float math. This story renders existing string amounts only — do not coerce to `number` (D1).
- API access ONLY via the generated client; RSC reads via `fetch-*` actions; mutations via `'use server'` actions returning discriminated `ActionState` + `revalidatePath`; URL search params carry period/filter/sort state (D9). No hand-written fetch (NFR6).
- next-intl ICU (no concatenation); `FC<Props>`; PascalCase component files; kebab-case dirs; SCSS uses design tokens only; mobile-first.
- Routes only via `ROUTES`/`get*Path` in `constants/routes.ts`; navigation via `@supertool/next-shared` i18n `useRouter`/`usePathname`/`Link`, never `next/navigation`/`next/link` directly.
- No barrel files, no re-exports, no code comments; `list` suffix for arrays; `get/check/format/parse` function prefixes; `as const` objects over enums; no `as` assertions in production code.

### Testing standards summary

- Co-located `*.test.tsx`/`*.test.ts` (money-tracker uses Vitest + @testing-library/react). No new Testcontainers work (frontend-only). Run via pnpm scripts; `TURBO_FORCE=true` when verifying gates so turbo doesn't replay stale logs.

### Project Structure Notes

- Rename `apps/money-tracker/src/components/month-stepper/` → `month-navigator/` via `git mv`; component `MonthNavigator` in `MonthNavigator.tsx`; keep `ChevronIcon`, `.module.scss`, `.test.tsx` co-located and renamed. Three consumers import from the new path. This is a shared app-level component (multiple routes) — it stays under `src/components/`, not route-local.
- Year-jump utilities extend the existing `src/utils/period.ts` (single source of period math) — no new date module, no new dependency.
- Duplicate fix is a localized change in `transaction-form/hooks/use-transaction-form.ts`; no file moves.
- New visual-QA directory: `_bmad-output/implementation-artifacts/visual-qa/6-1-transactions-list-ux-enrichment/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1: Transactions List UX Enrichment]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Manage Transactions at Scale] (charter + evidence base)
- [Source: _bmad-output/planning-artifacts/epics.md#RP-F9] and [#RP-D5] (time-of-day dropped)
- [Source: _bmad-output/implementation-artifacts/epic-5-retro-2026-07-05.md#Next Epic Preview — Epic 6] and [#Action Items] (Actions #1–#6)
- [Source: apps/money-tracker/src/components/month-stepper/MonthStepper.tsx] (current stepper being enhanced)
- [Source: apps/money-tracker/src/utils/period.ts] (period math to extend)
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/hooks/use-transaction-form.ts] (duplicate date fix)
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx] and [apps/money-tracker/src/app/[locale]/transactions/new/page.tsx] (shipped copy flow — 4-2 / PR #30)
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/category-picker/CategoryPicker.tsx] (shipped hierarchical picker — 4-2)
- [Reference: example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/month-navigator/MonthNavigator.tsx]
- [Reference: example/track-my-life/packages/shared/src/utils/date/year-month.ts]
- [Evidence: _bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/transactions--list--{desktop,mobile}.png, transactions--create-category-picker--desktop.png, transactions--create--{desktop,mobile}.png]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous story-cycle dev phase). The initial dev subagent completed implementation and most of the visual-QA capture, then terminated on an infrastructure error (ECONNRESET) before committing; the orchestrator verified the full gate suite green, finalized the record, and committed. No code was changed during finalization.

### Debug Log References

- All quality gates re-run green at finalization (`TURBO_FORCE=true`): `type-check`, `test` (278 API + frontend suites), `lint`, `stylelint` (incl. the renamed `MonthNavigator.module.scss` + full-repo pass), `fmt:check`, `i18n:parity`, `build`.

### Completion Notes List

- **Month/year navigator (AC 2, primary deliverable):** renamed `month-stepper/` → `month-navigator/` (component + scss + test + ChevronIcon), added month prev/next + year up/down controls. `getPreviousYearPeriod`/`getNextYearPeriod` added to `period.ts` (reuse `formatPeriod`, `ADJACENT_STEP`); navigator round-trips the period via `PERIOD_SEARCH_PARAM` and drops `PAGE_SEARCH_PARAM` on navigate; composes with 4.3 auto-fit. All three consumers updated (`transactions/page.tsx`, `by-category/page.tsx`, `by-category/[categoryId]/page.tsx` — identical `period: string` prop); `MonthNavigator.test.tsx` moved with the subject.
- **Duplicate defaults date to today (AC 1):** `getDefaultValues` split into `transaction` (edit → keeps source date) vs `copyFrom` (duplicate → `getTodayDate()`), extracted `getPrefillValues` helper; other fields carried over. Copy test coverage added to `TransactionForm.test.tsx`. Copy flow + two-level `CategoryPicker` otherwise reused unchanged from 4-2 (D-1/D-2), regression-guarded.
- **AC 5 drift-gate no-op:** frontend + i18n only — no DTO/endpoint/schema change, generated client untouched, drift gate a no-op (D-4). API still consumed only via the generated client (NFR6).
- **i18n (AC 6):** `navigation.monthNav` keys (previous/next/previousYear/nextYear) added to both `en` and `uk` in the same commit; parity gate green.
- **Decisions:** D-1…D-5 followed as specified. D-3 reference `MonthNavigator` shape (month chevrons + year up/down) adopted over a free-form year dropdown — flagged as a possible future divergence for operator review at PR (Epic 5 retro Action #5).

### Visual QA Observations

Captured on `:3000` (cwd verified this checkout) as the seeded operator against the clean baseline. 12 committed captures (light + dark × 390 + desktop) covering the new/changed surfaces: `navigator-list` (idle), `navigator-year-jump` (post year-jump period), and `duplicate-form` (pre-filled, today's date). No 390px horizontal overflow observed.

**Known QA gap (interruption):** the dev subagent's process died (ECONNRESET) while capturing the category-picker-open matrix; the picker was observed working during QA (two-level cascade confirmed) but its light/dark × 390/desktop matrix was not completed, and the one malformed partial file was removed. The picker is unchanged code shipped and QA'd in Story 4-2 and is regression-guarded here by the updated `TransactionForm.test.tsx`; the picker matrix should be completed if the reviewer deems the AC-8 picker evidence required.

### File List

- `apps/money-tracker/src/components/month-navigator/{MonthNavigator.tsx,MonthNavigator.module.scss,MonthNavigator.test.tsx,ChevronIcon.tsx}` (renamed from `month-stepper/`)
- `apps/money-tracker/src/utils/period.ts` (+ `period.test.ts`) — year-jump helpers
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/hooks/use-transaction-form.ts` — copy defaults date to today
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.test.tsx` — copy coverage
- `apps/money-tracker/src/app/[locale]/transactions/page.tsx`, `.../transactions/by-category/page.tsx`, `.../transactions/by-category/[categoryId]/page.tsx` — MonthNavigator consumers
- `apps/money-tracker/messages/{en,uk}/navigation.json` — `monthNav` strings
- `_bmad-output/implementation-artifacts/visual-qa/6-1-transactions-list-ux-enrichment/` — 12 captures
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status tracking
