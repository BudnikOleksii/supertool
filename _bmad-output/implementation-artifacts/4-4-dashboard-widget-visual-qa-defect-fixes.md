---
baseline_commit: 6157860
---

# Story 4.4: Dashboard Widget Visual QA & Defect Fixes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want the already-shipped dashboard widgets to render correctly in both themes and on mobile,
so that the summary, breakdown, and trend I rely on are trustworthy and beat the reference's broken rendering (RP-F3 defect side).

## Context & Why This Story

Epic 3 shipped three dashboard widgets — **summary** (3.1), **expense breakdown** (3.2), **12-month trend** (3.3) — and every Epic-3 story captured visual-QA screenshots to `/tmp` that were **never committed and could not be re-verified** (epic-3 retro §34/§35). The single highest-risk visual surface in that epic — the `recharts` dark-theme trend chart — has **no durable evidence and no automated render test** (jsdom cannot measure `ResponsiveContainer`). This is the exact failure class that shipped green-but-broken in Stories 1.4 and 1.8.

This story closes RP-F3's **defect side**: it is a **visual-QA + defect-fix pass on the already-shipped widgets** — no new product capability, no new endpoints (those are Epic 5's F3 net-new widgets + filter bar). The deliverable is **durable, committed screenshot evidence** (light + dark × mobile + desktop, per widget, vs the reference) plus a fix for any defect that evidence surfaces.

**Critical scoping finding (verified against the code, 2026-06-16):** the reference's §5 defect — *"spending-by-category donut renders only its legend (graphic missing)"* — **does not exist in supertool**. supertool's breakdown (Story 3.2) is a **CSS proportional bar-list**, not a `recharts` donut (`DashboardBreakdown.tsx:64-92` + `DashboardBreakdown.module.scss .barTrack/.barFill`). There is no donut to repair. The AC reframes from "fix the donut" to **"verify the breakdown and trend do not share the reference's defect, and record the bar-list as an intentional divergence that already exceeds the reference."** Do **not** introduce a donut to "match" the reference (RP — exceed, don't replicate; the bar-list is more robust and was the deliberate 3.2 choice).

**Evidence (binding — name the captures, Epic 4+ evidence-reference convention):**
- Reference dashboard: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/dashboard--overview*.png` (incl. `--overview-scroll1/2/3` at desktop + mobile). The reference donut-legend-only defect is visible in these.
- supertool baseline: `…/visual-qa/spike-reference-parity/supertool/dashboard--overview*.png` (`--overview--{desktop,mobile}`, `--overview-dark--{desktop,mobile}`, `--uk--{desktop,mobile}`, `--empty-default--desktop`). **These baselines are stale — captured against the pre-4.1 header shell** (Dark/English switchers in the header). Story 4.1 replaced that with the persistent sidebar + user-menu switchers. **4.4 must re-capture against the current shell**, not reuse these.
- Reference code (frontend) to compare behaviour against — adapt understanding, never copy (ED1): `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/dashboard/` chart components.

## Acceptance Criteria

1. **Charts render fully in both themes, both viewports (AC core).** Given the shipped **breakdown** (CSS bar-list) and **12-month trend** (`recharts` BarChart) widgets, when they render in **light and dark** themes at **desktop (≥1024px)** and **mobile (390px)** viewports with a period that has data, then: the trend's bar graphics render fully (bars, axes, gridlines, legend — **not legend-only / not blank**), the breakdown's bars and labels render fully, both are **legible** (axis ticks not overlapping into illegibility at 390px), and **dark-mode token theming is preserved** (the §6 strength — income green / expense red / axis / grid / tooltip surface all resolve from CSS tokens, no hard-coded hex, no washed-out or invisible series). Any defect found is fixed; any intentional divergence from the reference is recorded in the Dev Agent Record.

2. **Breakdown ≠ reference donut defect — recorded divergence.** Given supertool renders the category breakdown as a CSS proportional bar-list (not a `recharts` donut), when reviewed against the reference's legend-only-donut defect, then the Dev Agent Record explicitly states that supertool **does not share** the reference defect and that the bar-list is an **intentional divergence that exceeds the reference** (more robust, no clip/render-bug surface) — and **no donut is introduced**.

3. **Empty / zero / no-currency states render cleanly (both locales).** Given a period with **no expenses**, a **zero-net month**, or a user with **no default currency** (`NO_CURRENCY`), when each widget renders, then a **localized empty state** (the existing `empty.title`/`empty.description` keys in `dashboard-page.json`, EN **and** UK) displays cleanly — **never a broken, blank, or half-rendered chart**. Specifically confirm the trend renders its **empty card** (not an empty axis frame) when `checkIsEmptyTrend` is true, and the breakdown renders its empty card when `breakdown.length === 0`. No new keys are required unless a fix introduces one (then both locales, same commit, FR19/FR20).

4. **Mobile no-overflow (NFR8).** Given any dashboard widget on a 390px viewport, when it renders, then it is **fully usable and does not overflow** — `document.documentElement.scrollWidth === window.innerWidth` on `/dashboard` at 390px in both themes; the trend chart's `ResponsiveContainer` fits within its card with no horizontal scroll; long category names in the breakdown truncate (existing `.name` ellipsis) rather than push width.

5. **Dark-mode token robustness — no blank chart (defect fix if reproduced).** Given the trend chart reads its colours from CSS custom properties via `getComputedStyle` in a `useEffect` keyed on `resolvedTheme` (`DashboardTrendContent.tsx:61-90`), when a token transiently resolves to an empty string (the epic-3-deferred risk: blank `aria-hidden` placeholder with **no fallback**, returns forever if a token is ever empty), then the developer **verifies the chart never gets stuck blank** in either theme on real loads; **if** a stuck-blank or wrong-colour state is reproduced, it is fixed (e.g. a token fallback / re-read), and the fix is covered by a test where jsdom permits (color-resolution logic is unit-testable even though `ResponsiveContainer` geometry is not). If not reproducible, the verification is recorded as evidence and no code change is made.

6. **Analytics tests stay green; new behaviour is tested (NFR1).** Given any chart-library behaviour or widget logic touched by a fix, when tests run, then the existing widget tests (`DashboardSummary.test.tsx`, `DashboardBreakdown.test.tsx`, `DashboardTrend.test.tsx`) and the API analytics integration tests are **re-run and green**, and any defect fix ships with a test (or a documented jsdom limitation if geometry-dependent). No regression to the D1 decimal-safe money paths or the empty/error-state coverage already present.

7. **Durable visual-QA evidence (Story 1.9 protocol — committed, not `/tmp`).** Given the rendered dashboard, when the story completes, then the Dev Agent Record carries **side-by-side light+dark, mobile+desktop screenshots per widget** (summary, breakdown, trend) compared against the reference captures, **committed under `_bmad-output/implementation-artifacts/visual-qa/4-4-dashboard-widgets/`** (NOT `/tmp` — epic-3 evidence regressed precisely because it was ephemeral). Captures are against the **current 4.1 sidebar shell** on a **data-rich period** (e.g. Feb 2025), plus at least one **empty/zero-state** capture. The record confirms: trend renders fully (not legend-only/blank) in dark mode, no 390px overflow, and a reference comparison note for each widget.

## Tasks / Subtasks

- [x] **Task 1 — Establish the capture baseline against the current shell** (AC: 1, 4, 7)
  - [x] Run the dev stack (`pnpm dev` or the compose stack); sign in as the seeded operator (creds in `apps/api/.env.example`; **trusted-origins pinned to `:3000`** — sign in on port 3000 or sign-in 403s, per `live-ui-capture-gotchas`). Capture with global `playwright-cli` (named sessions parallelize — see `visual-qa-via-playwright-cli`).
  - [x] Navigate to `/dashboard` on a **data-rich period** (the seed has data in 2025 — e.g. `?period=2025-02`, matching the spike baseline month so the comparison is apples-to-apples). Confirm all three widgets populate (summary figures, breakdown bars, 12-month trend bars).
  - [x] Note: Story 4.3 (first-run period auto-fit) is still `backlog`. Do **not** depend on auto-fit; drive the period explicitly via the URL search param (`PERIOD_SEARCH_PARAM`, D9 URL-driven state) so the capture is deterministic regardless of 4.3 status.
- [x] **Task 2 — Screenshot matrix + overflow check (Story 1.9 protocol)** (AC: 1, 4, 7)
  - [x] Capture the matrix **{light, dark} × {390px, ≥1024px}** for the full dashboard and per-widget, into `_bmad-output/implementation-artifacts/visual-qa/4-4-dashboard-widgets/` (commit these — do not use `/tmp`). Suggested names: `summary-{light,dark}-{mobile,desktop}.png`, `breakdown-…`, `trend-…`.
  - [x] Capture at least one **empty/zero-state** view (e.g. the current empty month `?period=2026-06`, or a no-expense period) showing the localized empty cards — both `en` and `uk`.
  - [x] At 390px in **both** themes, assert no horizontal overflow: `document.documentElement.scrollWidth === window.innerWidth` on `/dashboard`. Record the values.
  - [x] Specifically inspect the **trend chart at 390px**: confirm 12 month-labels on the `XAxis` remain legible (not overlapping into an unreadable smear) and the chart fits the card. If illegible/overflowing, that is a defect to fix in Task 3.
- [x] **Task 3 — Triage findings and fix defects** (AC: 1, 2, 5)
  - [x] For each defect the matrix surfaces, fix it in the owning widget (files in "Files to TOUCH"). Likely candidates, in risk order:
    - **Trend dark-mode token resolution** — verify `readChartColors` resolves non-empty tokens in dark mode; if the chart gets stuck on the blank `aria-hidden` placeholder (the `colors.income === ''` guard with no fallback — epic-3-deferred) or a series is invisible, add a sane fallback / re-read (AC #5).
    - **Trend 390px tick legibility** — if month ticks overlap, apply a recharts-idiomatic fix (e.g. `interval`/angled tick/`tickFormatter`) using tokens, mobile-first; do not hard-code colours.
    - **Breakdown** — confirm bar-list, labels, share %, and ellipsis truncation render in both themes; fix any token/contrast issue.
  - [x] **Do NOT introduce a donut.** Record in the Dev Agent Record that the bar-list intentionally diverges from and exceeds the reference donut (AC #2).
  - [x] If a fix touches user-facing strings, add the key to **both** `apps/money-tracker/messages/en/dashboard-page.json` and `…/uk/dashboard-page.json` in the same commit (real Ukrainian, ICU only); run `pnpm i18n:parity` green. (None expected — empty/error states already keyed.)
- [x] **Task 4 — Tests** (AC: 5, 6)
  - [x] Re-run the existing widget tests (`DashboardSummary.test.tsx`, `DashboardBreakdown.test.tsx`, `DashboardTrend.test.tsx`) and the API analytics integration tests — all green.
  - [x] If a defect fix changes logic (e.g. a token fallback in `DashboardTrendContent`), add a co-located unit test for the **non-geometry** part (color resolution / fallback selection is unit-testable; `ResponsiveContainer` pixel geometry is not — document that jsdom limitation explicitly, per epic-3 retro §35, rather than faking it).
  - [x] Run via `pnpm` scripts (`pnpm --filter money-tracker test`), never `node_modules/.bin`; retry on the transient pnpm `H.replace` crash. Verify gates with `--force` where turbo cache may replay stale logs.
- [x] **Task 5 — Record evidence + divergences in the Dev Agent Record** (AC: 1, 2, 7)
  - [x] Embed the committed screenshot paths, the reference-comparison note per widget, the 390px no-overflow measurement, the dark-mode-token confirmation, and the **bar-list-vs-donut intentional divergence** statement. Confirm the §6 dark-mode strength is preserved (charts legible in dark — the exact 3.3 risk).

## Dev Notes

### What this story is (and is not)

- **Is:** a verification-first quality pass with durable, committed evidence + fixes for whatever the evidence surfaces. It is entirely possible the only code delta is a small trend-chart robustness fix (or none) — **the evidence is the deliverable** even if no defect is found.
- **Is not:** net-new widgets (top-categories / daily-spending / recent-transactions) or a filter bar — those are **Epic 5 (F3 net-new + B2 endpoints)**. No new analytics endpoints. No donut. No currency picker (RP-D1 — single default stays). No first-run period work (Story 4.3). No transactions-list work (Story 4.2).

### Current state of the system this story inspects (preserve, don't break)

- **Dashboard composition** (`apps/money-tracker/src/app/[locale]/dashboard/page.tsx`): RSC page reads `period` from the URL search param (`PERIOD_SEARCH_PARAM`, D9), defaults via `parsePeriod`, and renders three independently-`<Suspense>`-wrapped server widgets each with a skeleton fallback and a `key` derived from `period` (resets the boundary on period change). Auth-gated via `fetchProfile` → `redirect(signIn)`. **Preserve this streaming/Suspense/key structure.**
- **`DashboardSummary`** (`…/dashboard-summary/DashboardSummary.tsx`): RSC; income/expense/net as **strings** (D1) via `formatAmount`; signed/colour-coded; `error` / `empty` / `no-currency` states already implemented. Text-only widget — lowest visual risk, but include it in the screenshot matrix.
- **`DashboardBreakdown`** (`…/dashboard-breakdown/DashboardBreakdown.tsx`): RSC; **CSS proportional bar-list** (`.barTrack`/`.barFill`, `--bar-width` custom prop) — **NOT a chart library**. `share` is a presentation-only `number` fenced at the render boundary (D1 — money stays string via `formatAmount`). `error` / `empty` / `no-currency` states implemented. **This is why the reference donut defect cannot occur here.**
- **`DashboardTrend`** (`…/dashboard-trend/DashboardTrend.tsx`): RSC wrapper — fetches trailing-12-month trend, formats month labels via `Intl.DateTimeFormat`, builds `chartData` (money kept as string in `incomeAmount`/`expenseAmount`; `number` only for bar heights — D1 fence), `empty`/`error`/`no-currency` states; lazily loads the client chart via `next/dynamic` (keeps `recharts` off the server bundle — the by-the-book 3.3 boundary).
- **`DashboardTrendContent`** (`…/dashboard-trend/DashboardTrendContent.tsx`, `'use client'`): the **only** client component and the **highest-risk surface**. `recharts` `BarChart` in a `ResponsiveContainer`; reads **all** colours from CSS custom properties via `getComputedStyle(document.documentElement)` in a `useEffect` keyed on `resolvedTheme` (`next-themes`). **Known epic-3-deferred risk:** if any token resolves to `''`, it returns a blank `aria-hidden` placeholder of fixed `CHART_HEIGHT` (300px) and — because the guard is `colors.income === ''` — would stay blank with **no fallback**. This is the prime defect candidate for AC #5.
- **Skeletons** (`dashboard-{summary,breakdown,trend}-skeleton/`): render during Suspense. Verify they don't themselves overflow at 390px.

### Files to TOUCH (read each before editing)

| File | Action | Why |
|---|---|---|
| `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrendContent.tsx` | UPDATE (only if AC#5/tick defect reproduced) | Token-resolution fallback; mobile tick legibility. Tokens only — never hard-code hex. |
| `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrend.module.scss` | UPDATE (if needed) | Chart container sizing at 390px. |
| `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx` / `.module.scss` | UPDATE (only if defect found) | Bar-list / label / token fixes. |
| `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary/DashboardSummary.tsx` / `.module.scss` | UPDATE (only if defect found) | Layout/token fixes. |
| `apps/money-tracker/src/app/[locale]/dashboard/page.module.scss` | UPDATE (if needed) | Dashboard-level mobile overflow. |
| `…/dashboard-trend/DashboardTrend.test.tsx` (+ breakdown/summary tests) | UPDATE (if a fix changes logic) | Cover the non-geometry part of any fix. |
| `apps/money-tracker/messages/{en,uk}/dashboard-page.json` | UPDATE (only if a fix adds a string) | Both locales, same commit. Likely untouched. |
| `_bmad-output/implementation-artifacts/visual-qa/4-4-dashboard-widgets/` | NEW | Committed screenshot matrix (the deliverable). |

### Reference patterns (study before implementing — adapt, never copy, ED1)

- **Reference dashboard charts:** `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/dashboard/` — study the reference's chart components to **understand its legend-only-donut defect** (so you can confirm supertool's bar-list doesn't share it) and its daily-spending/range bugs (out of scope here, noted in §5). **Do not copy** — supertool's widgets are already built; this story verifies and fixes them.
- **Reference dark-mode:** the reference has **no dark mode** (§6) — there is **no reference counterpart** for dark-theme chart legibility. This is supertool's strength to protect: token-driven `recharts` colours via `getComputedStyle`. New ground — verify by capture, no reference to diff against for the dark variant.
- **`recharts` (3.8.1, exact pin — `architecture.md` + epic-3 retro §18):** the chart is app-level only, `'use client'` + `next/dynamic` so it never enters the server bundle — **preserve that boundary**. Any tick/axis change must use recharts v3 idioms (`XAxis interval`/`angle`/`tickFormatter`, `ResponsiveContainer`).

### Conventions to honor

- Component files PascalCase + co-located `.module.scss`/`.test.tsx`; dirs kebab-case. `FC<Props>` typing always (react.md — not lint-enforced, check manually).
- **D1 money-as-strings:** money values stay strings end-to-end; the only `number`s here (`share`, bar heights) are presentation-only and already fenced at the render boundary — **do not** widen that fence or do float math on money.
- SCSS: camelCase classes, **design tokens only** (no hard-coded colours — especially in chart props), namespaced `@use`, double-class override pattern, mobile-first (base = mobile, override up at `media-l` = 1024px). Breakpoints: `media-s 390 / media-m 768 / media-l 1024 / media-xl 1440`.
- i18n: `useTranslations`/`getTranslations(I18N_NAMESPACE.dashboardPage…)`, never the literal namespace; `id-length` lint rejects `t` (use `translate`); new keys in **both** locales same commit, real Ukrainian, ICU only.
- No comments; self-documenting names; array vars end in `List`; arrow functions; `handle*` handlers / `on*` callback props; no barrel files.
- Exact dependency pins; never add eslint/prettier. **No new dependency expected** in this story.

### Testing standards

- money-tracker uses Vitest + `@testing-library/react` + jsdom. Co-locate `*.test.tsx`. Run via `pnpm --filter money-tracker test` (and `pnpm test` for the full sweep incl. API analytics integration). Retry the transient pnpm `H.replace` crash.
- **jsdom cannot measure `ResponsiveContainer`** (no layout engine) — the trend chart's pixel geometry is **not** unit-testable; the existing `DashboardTrend.test.tsx` mocks `next/dynamic` to a stub asserting data-flow (12 labels, localized first label, empty/error states). Keep that pattern. Color-resolution/fallback logic **is** unit-testable (pure function over token strings) — test that if you add a fallback. **Do not fake geometry assertions** (epic-3 retro §35).
- A **green gate is not done** — 1.4/1.8/3.3 all shipped green-but-visually-broken. The committed screenshot matrix (Task 2) is the real acceptance evidence (`ui-stories-need-visual-qa`, `visual-qa-via-playwright-cli`).

### Verify-live requirements (do not skip)

- The trend chart's theme-reactive colour read (`getComputedStyle` keyed on `resolvedTheme`) only exercises in a **running app** — unit tests can't catch a stuck-blank chart or a washed-out dark series. Toggle theme live (via the 4.1 user-menu theme radio) on `/dashboard` and confirm the chart re-colours correctly in both directions.
- Capture against the **current 4.1 sidebar shell**, both locales; the spike baselines are stale (pre-4.1 header) and are for the *widget body* comparison only, not the chrome.

### Project Structure Notes

- All work is confined to `apps/money-tracker/src/app/[locale]/dashboard/` (+ its `messages/` if a string is added) and the new committed `visual-qa/4-4-dashboard-widgets/` evidence dir. No package-boundary changes, no `packages/ui`/`packages/shell` changes, no API changes. Consistent with the existing dashboard structure; no conflicts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4] — story statement + 4 BDD AC blocks + evidence pointers (donut-legend §5 defect, charts-preserved-in-dark §6 strength)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — epic intent, binding rules, evidence base, Story 1.9 protocol per story
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md#RP-F3 / §5 / §6] — F3 dashboard widgets (defect side → Epic 4); §5 reference defects (donut legend-only, daily-spending range, empty default period); §6 strengths to protect (dark mode + charts preserved, UK locale, URL state)
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-06-16.md §18/§34/§35/§103] — recharts pinned/by-the-book; visual-QA evidence was ephemeral and regressed; trend chart = riskiest UI with no render test + deferred blank-placeholder fallback
- [Source: apps/money-tracker/src/app/[locale]/dashboard/page.tsx] — Suspense/key streaming composition (preserve)
- [Source: apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrendContent.tsx] — recharts client chart; token-via-getComputedStyle; blank-placeholder fallback gap (AC#5)
- [Source: apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-breakdown/DashboardBreakdown.tsx + .module.scss] — CSS bar-list (NOT a donut — AC#2)
- [Source: apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-summary/DashboardSummary.tsx] — text summary, empty/error states
- [Source: apps/money-tracker/messages/{en,uk}/dashboard-page.json] — existing empty/error keys (both locales)
- [Source: _bmad-output/implementation-artifacts/4-1-mobile-navigation-drawer-in-app-navigation.md] — current shell (sidebar + user-menu switchers) that captures must use; visual-QA protocol precedent
- [Source: .claude/rules/styles.md, react.md, i18n.md, javascript.md, typescript.md] — conventions

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- Captured against the **live running stack** (API on :3001, money-tracker on :3000) signed in as the seeded operator (`operator@supertool.local`) on the trusted `:3000` origin. Tasks 1–2 (baseline matrix) captured from the main-repo dev server (dashboard widget code byte-identical to this worktree). The fix's live verification (Task 3) was run against **this worktree's** money-tracker dev on :3000 (`API_URL=http://localhost:3001`), with the user's explicit approval to briefly take over :3000.
- Period driven explicitly via `?period=YYYY-MM` (D9 URL state) so captures are deterministic and independent of Story 4.3 (period auto-fit, still backlog): `2025-02` data-rich, `2030-01` true-empty (trailing 12 months all zero), `2026-06` sparse single-transaction edge.
- 390px no-overflow asserted programmatically in **both** themes: `document.documentElement.scrollWidth === window.innerWidth` → **390 === 390** (light and dark).
- Dark-mode token resolution probed live: with `data-theme="dark"`, `getComputedStyle` resolves `--on-success-container` → `#7ee896`, `--error` → `#f2b8b5` (non-empty). The blank-placeholder guard never reproduced a stuck-blank chart on real loads.

### Completion Notes List

**AC #1 — Charts render fully in both themes/viewports.** Verified by the committed screenshot matrix (light/dark × mobile/desktop). Trend `recharts` BarChart renders bars + axes + gridlines + legend (never legend-only / never blank); breakdown bar-list renders bars + labels + share %; both legible at 390px. Dark-mode token theming preserved (income green / expense red / axis / grid / tooltip all resolve from CSS tokens; no hard-coded hex). **One defect found and fixed** — see AC #5.

**AC #2 — Breakdown ≠ reference donut defect (intentional divergence recorded).** supertool's category breakdown is a **CSS proportional bar-list** (`DashboardBreakdown.tsx` + `.barTrack`/`.barFill`), **not** a `recharts` donut, so it **cannot** share the reference's legend-only-donut render bug. This is a deliberate, more-robust divergence that **exceeds** the reference (no chart-clip/render-bug surface). **No donut was introduced.** Confirmed rendering correctly in both themes and both locales (`dashboard-light-desktop.png`, `dashboard-dark-desktop.png`, `dashboard-uk-desktop-data.png`).

**AC #3 — Empty / zero / no-currency states render cleanly (both locales).** At `2030-01` (trailing 12 months all zero) all three widgets render their localized empty cards — never a blank/half-rendered chart. Confirmed EN (`dashboard-empty-en-desktop.png`: "No activity this month" / "No expenses this month" / "No activity in this period") and UK (`dashboard-empty-uk-desktop.png`: "Немає руху коштів за цей місяць" / "Немає витрат за цей місяць" / "Немає активності за цей період" — real Ukrainian). `checkIsEmptyTrend` → empty card (not an empty axis frame); breakdown empty card on `breakdown.length === 0`. No new i18n keys required (`pnpm i18n:parity` green).

**AC #4 — Mobile no-overflow (NFR8).** `scrollWidth === innerWidth` → **390 === 390** on `/dashboard` in both themes (`dashboard-light-mobile.png`, `dashboard-dark-mobile.png`). The trend `ResponsiveContainer` fits its card with no horizontal scroll; recharts auto-thins the 12 month ticks at 390px (shows ~4: May/Aug/Nov/Feb) so they stay legible rather than smearing — no code change needed for tick legibility. Long category names truncate via the existing `.name` ellipsis.

**AC #5 — Dark-mode token robustness — DEFECT FOUND & FIXED.** On a **live theme toggle** (user-menu radio, no reload) the trend chart did **not** re-colour: with `data-theme="dark"` the bars and legend stayed on the **light** tokens (`#1b6e2d`/`#b3261e`) instead of the dark tokens (`#7ee896`/`#f2b8b5`) — evidence `defect-live-toggle-dark-stale-colors-BEFORE.png`. **Root cause:** the `useEffect` keyed on `resolvedTheme` read `getComputedStyle` *before* `next-themes` had written `data-theme` to `<html>`, capturing stale tokens, and never re-read (the `colors.income === ''` guard had no recovery path). A fresh load in either theme was always correct — only the live toggle was broken, which is exactly the §6 dark-mode-chart strength this story must protect. **Fix** (`DashboardTrendContent.tsx`): replaced the `resolvedTheme`-keyed read with a `MutationObserver` on `document.documentElement`'s `data-theme` attribute — the re-read now triggers on the DOM attribute write itself, so `getComputedStyle` always reflects the applied theme. Extracted pure, testable helpers `resolveChartColors(readToken)` and `checkHasChartColors(colors)`. **Verified live in this worktree:** light→dark toggle now flips bars to `#7ee896`/`#f2b8b5` and back on dark→light, with no reload (`fix-live-toggle-dark-correct-colors-AFTER.png`). Tokens-only throughout — no hard-coded hex.

**AC #6 — Tests green; new behaviour tested (NFR1).** money-tracker: **142 tests / 32 files pass** (was 138; +4 new in `DashboardTrendContent.test.tsx` covering `resolveChartColors` token mapping, theme-palette re-read, and the `checkHasChartColors` placeholder guard — the unit-testable non-geometry part of the fix). The existing `DashboardSummary`/`DashboardBreakdown`/`DashboardTrend` tests remain green. API analytics re-run green: **14 unit** (controller/service/dto) + **18 integration** (Testcontainers, seeded 1880 txns). **jsdom limitation documented (epic-3 retro §35):** `ResponsiveContainer` pixel geometry and the `MutationObserver`→`getComputedStyle` cascade are not unit-testable in jsdom (no layout engine, no custom-property cascade) — verified live instead, not faked. No regression to D1 decimal-safe money paths (money stays string; only `share`/bar-heights are presentation-only `number`s, fence unchanged).

**AC #7 — Durable, committed visual-QA evidence (Story 1.9 protocol).** Committed under `_bmad-output/implementation-artifacts/visual-qa/4-4-dashboard-widgets/` (NOT `/tmp`):
| File | Theme/Viewport | Note |
|---|---|---|
| `dashboard-light-desktop.png` | light / 1280 | all 3 widgets render; bar-list + full trend chart |
| `dashboard-dark-desktop.png` | dark / 1280 | §6 strength: trend bright green/salmon, legible axes — not blank/legend-only |
| `dashboard-light-mobile.png` | light / 390 | no overflow; ticks auto-thinned |
| `dashboard-dark-mobile.png` | dark / 390 | no overflow; dark chart legible |
| `dashboard-empty-en-desktop.png` | light / 1280 | true-empty `2030-01` — three localized empty cards (EN) |
| `dashboard-empty-uk-desktop.png` | light / 1280 | true-empty `2030-01` — three localized empty cards (UK, real Ukrainian) |
| `dashboard-uk-desktop-data.png` | light / 1280 | UK data-rich — ₴ symbol, comma decimals, Ukrainian month ticks |
| `dashboard-sparse-en-desktop.png` | light / 1280 | sparse `2026-06` single-transaction edge (graceful axes/single bar) |
| `defect-live-toggle-dark-stale-colors-BEFORE.png` | dark / 1280 | AC#5 defect: live-toggle stale light colours |
| `fix-live-toggle-dark-correct-colors-AFTER.png` | dark / 1280 | AC#5 fixed: live-toggle correct dark colours |

**Reference comparison note (per widget):** summary — text-only, correct in both themes/locales; supertool exceeds reference (signed/colour-coded, no-currency state). breakdown — CSS bar-list, no donut defect (AC#2 divergence). trend — full BarChart in both themes; the reference has **no dark mode**, so the dark variant is supertool-only ground (verified by capture, no reference to diff). Baselines under `visual-qa/spike-reference-parity/supertool/` are stale (pre-4.1 header) — these 4.4 captures are against the current 4.1 sidebar shell, as required.

### File List

- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrendContent.tsx` — MODIFIED (live-theme-toggle re-colour fix: `MutationObserver` on `data-theme`, pure `resolveChartColors`/`checkHasChartColors` helpers, dropped `next-themes` dependency)
- `apps/money-tracker/src/app/[locale]/dashboard/components/dashboard-trend/DashboardTrendContent.test.tsx` — NEW (unit tests for the color-resolution logic)
- `_bmad-output/implementation-artifacts/visual-qa/4-4-dashboard-widgets/` — NEW (10 committed screenshots: matrix + empty/sparse/UK + before/after defect evidence)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (4-4 → in-progress → review)

### Change Log

| Date | Change |
|---|---|
| 2026-06-16 | Visual-QA pass on shipped dashboard widgets: captured committed light/dark × mobile/desktop matrix + empty/UK/sparse states against the current 4.1 sidebar shell. Found and fixed a dark-mode live-theme-toggle defect in the trend chart (chart kept previous theme's colours until reload) via a `data-theme` MutationObserver re-read; added unit tests. Recorded the breakdown bar-list as an intentional divergence that exceeds the reference donut (no donut introduced). All gates green (142 FE tests, 14+18 API analytics, lint, type-check, i18n parity). |

### Review Findings

Code review 2026-06-16 (Blind Hunter + Edge Case Hunter + Acceptance Auditor; orchestrator gates: 142 FE tests pass, type-check 9/9, lint clean). Outcome: **Approve** — all 7 ACs satisfied with committed evidence; no blocking findings.

- [x] [Review][Patch] Commit the untracked story file, the new `DashboardTrendContent.test.tsx`, and the 10 visual-QA PNGs together with the fix — AC#7 requires durable committed evidence (epic-3 regressed precisely because evidence stayed ephemeral). Resolved by the commit/`create-pr` step.
- [x] [Review][Defer] Empty/partial CSS-token resolution leaves the chart on the blank `aria-hidden` placeholder with no fallback/retry; `checkHasChartColors` gates only on `colors.income` and there is no render/observer test — **already tracked from the story-3.3 review**; pre-existing, behaviour unchanged by this refactor; live-verified that fresh loads always resolve. [DashboardTrendContent.tsx:81,113]
- [x] [Review][Defer] `grid` and `outline` both map to `--outline-variant` in `CHART_COLOR_TOKENS` — redundant fields, presentation-only, pre-existing. [DashboardTrendContent.tsx:54,58]
- [x] [Review][Defer] Tooltip `formatter` matches the series by translated `name` and falls back to `String(value)` (a presentation-only bar height) for the money string when `payload` is missing — fragile if `incomeName === expenseName`; D1-spirit on the fallback path. Formatter unchanged by this diff; pre-existing. [DashboardTrendContent.tsx:124-133]
- [x] [Review][Defer] Parent `DashboardTrend.formatMonthLabel` can yield `"Invalid Date"` axis labels for a malformed `month` string — out of scope of this diff. [DashboardTrend.tsx]

Dismissed as noise (3): the `data-theme`-vs-`class` MutationObserver-coupling regression flagged by both adversarial layers is a **verified false positive** — `layout.tsx:40` configures `next-themes` with `attribute="data-theme"`, matching the observer filter; no-op `data-theme` re-render cost (negligible, `isAnimationActive={false}`); `getComputedStyle` style-recalc in the observer callback (negligible).
