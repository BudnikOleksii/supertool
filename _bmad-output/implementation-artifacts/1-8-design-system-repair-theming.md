---
baseline_commit: 7cbf632886be649731f644c4d99a3089ac6f657c
---

# Story 1.8: Design System Repair & Theming

Status: done

<!-- context-engine: exhaustive analysis of epics.md (sprint-change story added 2026-06-12), architecture.md (boundaries, patterns, version table, new-dependency rule), story 1.4 record + review findings + change log, live repo survey (packages/ui, shell, storybook, money-tracker layout/i18n, turbo/CI), full example/track-my-life reference survey (tokens, atoms, next-themes mounting, storybook theme toolbar), npm verification of next-themes 0.4.6 + @storybook/addon-themes 10.4.4 completed 2026-06-12 -->

## Story

As Oleksii,
I want the design-system primitives to render correctly on the generated token system with light/dark theming,
so that every feature that follows builds on polished, themeable UI instead of compounding visual debt.

> Sprint-change context (2026-06-12): Story 1.4 shipped `packages/ui` with visually broken/incomplete primitives. This story repairs them against the `example/track-my-life` reference and brings in runtime theming. It runs BEFORE 1.5 — the auth widgets build on these primitives.

## Acceptance Criteria

1. **Given** the `packages/ui` primitives (button, input, select, dialog, table), **when** each renders in Storybook and in the money-tracker shell, **then** it displays correctly and consistently on the M3 token system (`tokens/{palette,theme,metrics,shadows,fonts}.scss`), with the visual defects introduced in 1.4 identified and fixed — `example/track-my-life/packages/ui` is the reference for markup, styling, and component APIs (used as reference, never copied).
2. **Given** the app shell, **when** the user switches theme (light/dark/system), **then** `next-themes` drives the `[data-theme]` attribute (new sanctioned dependency, exact pin), the choice persists across reloads, and the hardcoded `data-theme="light"` in the locale layout is gone — theme switcher control in the shell header, localized in both locales.
3. **Given** Storybook, **when** stories render, **then** a theme toolbar switches every story between light and dark, and the a11y addon passes for both themes.
4. **Given** the primitives the upcoming auth forms need (typography, label), **when** they are added to `packages/ui` following the reference atoms, **then** they ship with stories and smoke tests like the existing primitives (NFR1).

## Tasks / Subtasks

- [x] Task 1: Per-primitive audit & repair against the reference (AC: 1)
  - [x] For EACH of the five primitives, read the supertool component AND its reference counterpart side by side BEFORE editing; produce a divergence list (markup, token usage, states, API), fix every visual divergence, and record the list in Dev Agent Record. Counterparts: `Button` ↔ `example/track-my-life/packages/ui/src/components/atoms/button/`; `Input` ↔ `.../atoms/input/`; `Select` ↔ `.../atoms/select/`; `Dialog` ↔ `.../molecules/alert-dialog/` (closest counterpart — the reference has no plain dialog; carry its overlay/content/header/footer styling patterns); `Table` — **no reference counterpart, new ground**: keep current composition, verify token purity and consistency with the repaired system
  - [x] Known defect to fix first (found in repo survey): `packages/ui/src/components/input/Input.module.scss:34` hardcodes the focus ring `box-shadow: 0 0 0 3px rgb(101 85 143 / 20%)` — a literal light-theme purple that breaks dark mode. Replace with the reference input's focus treatment (token-based). Then sweep ALL five `.module.scss` files for any remaining literal colors/sizes/shadows — every value must come from `tokens/{theme,metrics,shadows,fonts}.scss` vars (`.claude/rules/styles.md` rule)
  - [x] `Button`: align API and markup to the reference — variant set `primary | secondary | outline | ghost | link | destructive`, size set `sm | md | lg | icon`, polymorphic `component` prop (reference `ButtonProps<Comp extends ElementType>` pattern, adapted to supertool `FC` typing where non-generic), `data-slot="button"`, reference hover (`@include mixins.hover`), `:focus-visible`, `:active`, `:disabled` treatments [ref: `example/track-my-life/packages/ui/src/components/atoms/button/button.tsx` + `button.module.scss`]
  - [x] `Input`: add `error?: boolean` and `startAdornment?: ReactNode` per the reference (wrapper div when adornment present), `data-slot="input"`, token-based error/focus states [ref: `example/track-my-life/packages/ui/src/components/atoms/input/input.tsx`]
  - [x] `Select`: align trigger/content/item styling and markup (including `data-slot` attributes and error-state trigger) to the reference; KEEP the existing simple `optionList` API — the reference's composed multi-part export (`SelectTrigger`/`SelectContent`/…) is a documented supertool divergence; `LocaleSwitcher` must keep working unchanged [ref: `example/track-my-life/packages/ui/src/components/atoms/select/select.tsx` + `select.module.scss`]
  - [x] `Dialog`: align overlay scrim, content surface/radius/shadow, and title/description typography to the reference alert-dialog styling; keep the current `trigger/title/description/closeLabel` API (documented divergence — Radix dialog vs alert-dialog) [ref: `example/track-my-life/packages/ui/src/components/molecules/alert-dialog/`]
  - [x] Verify each repaired primitive in Storybook in BOTH themes and on the money-tracker home page; existing smoke tests (`Button.test.tsx`, `Dialog.test.tsx`) stay green — extend them only where API changes (new variants) warrant new assertions
- [x] Task 2: New atoms — Typography & Label (AC: 4)
  - [x] `packages/ui/src/components/typography/Typography.tsx` + `Typography.module.scss`: variant set `title-xl | title-l | title-m | title-s | title-xs | body-l | body-m | body-s`, optional `fontWeight` (`regular | medium | semibold | bold | extra-bold`), polymorphic `tag` prop with semantic defaults (titles → `h1`–`h5`, body → `p`); styles consume `--font-<variant>-{size,line-height,weight,tracking}` from `tokens/fonts.scss` [ref: `example/track-my-life/packages/ui/src/components/atoms/typography/`]
  - [x] `packages/ui/src/components/label/Label.tsx` + `Label.module.scss`: thin `<label data-slot="label">` wrapper over native props with token typography [ref: `example/track-my-life/packages/ui/src/components/atoms/label/`]
  - [x] Smoke tests co-located in `packages/ui` (`Typography.test.tsx`: renders correct tag per variant/tag prop; `Label.test.tsx`: renders label associated via htmlFor) — do NOT assert CSS-module class names (vitest stubs CSS)
  - [x] Stories `apps/storybook/src/stories/Typography.stories.tsx` and `Label.stories.tsx`: CSF3, `tags: ['autodocs']`, `parameters: { layout: 'centered' }`, all variants shown
- [x] Task 3: Runtime theming with next-themes (AC: 2)
  - [x] Add `next-themes` 0.4.6 (npm-latest, verified 2026-06-12; exact pin — new sanctioned dependency per this story's AC): `apps/money-tracker` dependencies; `packages/shell` peerDependencies + devDependencies (same exact); `apps/storybook` devDependencies. Watch the pnpm `H.replace` transient crash — retry the same command
  - [x] `apps/money-tracker/src/app/[locale]/layout.tsx`: REMOVE `data-theme="light"` from `<html>`; add `suppressHydrationWarning` to `<html>`; wrap the app content (inside `NextIntlClientProvider`) in `<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>` from `next-themes` [ref: `example/track-my-life/apps/money-tracker/src/app/[locale]/layout.tsx` — mounts `ThemeProvider attribute="data-theme"` inside the intl provider; its CSP `nonce` plumbing is NOT carried — supertool has no CSP middleware]
  - [x] `packages/shell/src/components/theme-switcher/ThemeSwitcher.tsx` (+ test): `'use client'`; `useTheme()` from `next-themes`; built on the ui `Select` with options light/dark/system labeled via `useTranslations('navigation.themeSwitcher')`; guard hydration with a `mounted` state (render the select only after mount — server cannot know the stored theme; this is the next-themes documented pattern). **No reference counterpart — new ground**; mirror the structure of `packages/shell/src/components/locale-switcher/LocaleSwitcher.tsx` (the established switcher pattern: typed value guard, optionList from constants, translate labels)
  - [x] Add `ThemeSwitcher` to the header actions in `packages/shell/src/components/app-shell/AppShell.tsx` beside `LocaleSwitcher`
  - [x] Messages: add `themeSwitcher: { label, light, dark, system }` to `apps/money-tracker/messages/en/navigation.json` AND `messages/uk/navigation.json` in the same commit (real Ukrainian, not transliteration) — `pnpm i18n:parity` must stay green
  - [x] Tests: `ThemeSwitcher.test.tsx` — `vi.mock('next-themes')` returning `{ theme, setTheme }`, interact with the select, assert `setTheme('dark')`; update `AppShell.test.tsx` if the new child breaks it (mock next-themes or wrap in `ThemeProvider`)
- [x] Task 4: Storybook theme toolbar + a11y both themes (AC: 3)
  - [x] Add `@storybook/addon-themes` 10.4.4 to `apps/storybook` devDependencies — MUST be lockstep-exact with the installed `storybook`/`@storybook/react-vite`/`addon-docs`/`addon-a11y` 10.4.4; register it in `.storybook/main.ts` addons. If pnpm's `minimumReleaseAge` guard refuses the pin, add it to the existing storybook entries in `pnpm-workspace.yaml` `minimumReleaseAgeExclude` (the 10.4.4 line is already excluded there — 1.4 precedent)
  - [x] `.storybook/preview.ts`: DELETE the hardcoded `document.documentElement.dataset['theme'] = 'light'`; compose two decorators per the reference: `withThemeByDataAttribute({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'light', attributeName: 'data-theme' })` plus a `next-themes` `ThemeProvider` wrapper decorator with `forcedTheme` plucked from the story context (`attribute="data-theme"`, `enableSystem: false`) so components using `useTheme` behave in stories [ref: `example/track-my-life/apps/storybook/.storybook/preview.ts` — quotes both decorators; adapt imports, never copy]
  - [x] Set `parameters.a11y` so violations are surfaced as failures in the a11y panel (`a11y: { test: 'error' }` per the reference preview); run every story in BOTH themes and fix all a11y violations — color-contrast in dark theme is the expected hot spot (this is where 1.4's hardcoded light-only values fail)
  - [x] Verify: theme toolbar appears, every story (5 repaired + typography + label) flips light/dark correctly, a11y panel clean in both themes
- [x] Task 5: Final verification + hygiene (AC: all)
  - [x] Root gates green WITH `--force` where turbo caches replay (1.4 lesson: cache masked a real type-check failure): `pnpm lint`, `pnpm fmt:check`, `turbo run type-check --force`, `pnpm stylelint`, `turbo run test --force`, `pnpm build`, `pnpm i18n:parity`
  - [x] Manual AC-2 walkthrough on `pnpm dev`: switch to dark → `<html data-theme="dark">`, every primitive and the shell render correctly; full reload → dark persists (localStorage); switch to system → follows OS preference; repeat in `/uk` locale — switcher labels in Ukrainian
  - [x] Drift gate untouched by construction (frontend-only story — no API/DTO change): `pnpm turbo run generate:client` leaves git status clean; `openapi.json` byte-identical
  - [x] Hygiene greps: no `^`/`~` in changed package.json files; nothing imported from `example/`; no hand-written `fetch`; no literal hex/rgb colors left in `packages/ui/src/components/**/*.module.scss` (grep for `#` and `rgb(` — token files are the only sanctioned home for literals)
  - [x] Update sprint-status.yaml on status transitions; branch `TOOLS-1-8/design-system-repair-theming`; conventional commits; PR via `create-pr` skill after local code review — never commit to main

### Review Findings

- [x] [Review][Decision→Defer] Visual evidence gate FAILS (blocking per project rule) — Dev Agent Record contains only mechanical verification: playwright attribute checks for AC-2 and an axe scan of closed/default story states for AC-3. No both-theme Storybook screenshots, no open/interactive states, no side-by-side against `example/track-my-life`. DEFERRED 2026-06-12 per review decision: Story 1.9 (screenshot-based visual QA baseline) absorbs the evidence work; 1.8's AC-1/AC-3 acceptance re-scoped to mechanism + token purity.
- [x] [Review][Decision→Defer] Select open-state width defect makes AC-1 false for Select — `.content { min-width: 8rem }` plus `.popperViewport { width: var(--radix-select-trigger-width) }` clips items, check indicator, and highlight in the open panel (`packages/ui/src/components/select/Select.module.scss:68,87`; defect faithfully carried from the reference, which has the same latent bug). DEFERRED 2026-06-12 per review decision: Story 1.9 AC-2 already diagnoses and schedules this exact fix.
- [x] [Review][Patch] ThemeSwitcher displayed value unguarded — `value={theme ?? THEME_OPTION.System}` renders a blank select when localStorage holds a value outside the option list; guard reads with `checkIsThemeOption` like writes [packages/shell/src/components/theme-switcher/ThemeSwitcher.tsx:41] — FIXED 2026-06-12 (guarded `selectedTheme` + regression test)
- [x] [Review][Patch] ThemeSwitcher pre-mount `return null` pops the control in after hydration, shifting the header layout — render a layout-preserving hidden placeholder during the mounted guard [packages/shell/src/components/theme-switcher/ThemeSwitcher.tsx:22-24] — FIXED 2026-06-12 (visibility-hidden placeholder Select with fixed `system` value, hydration-safe)
- [x] [Review][Patch] File List incomplete — `_bmad-output/planning-artifacts/epics.md` and `_bmad/custom/{bmad-code-review,bmad-create-story,bmad-dev-story}.toml` changed in the branch but absent from File List [this story file] — FIXED 2026-06-12
- [x] [Review][Defer] Select empty `optionList` renders an empty panel with no affordance [packages/ui/src/components/select/Select.tsx] — deferred, pre-existing (tracked in deferred-work.md since the 1.4 review)
- [x] [Review][Defer] No gate links switcher constants to message keys — `THEME_OPTION_LIST` ↔ `navigation.json` drift is undetected (i18n parity only checks en↔uk symmetry) [packages/shell/src/components/theme-switcher/constants.ts] — deferred, pre-existing tooling gap shared with LocaleSwitcher

## Dev Notes

### Critical scope boundary

This story touches ONLY: `packages/ui` (repair + 2 new atoms), `packages/shell` (ThemeSwitcher + AppShell header), `apps/money-tracker` (layout ThemeProvider + navigation messages), `apps/storybook` (addon-themes + preview + 2 new stories), and the 3 package.json files gaining `next-themes`/`addon-themes`. Do NOT create: `packages/widgets`, auth anything (1.5); per-user theme persistence in the DB (theme is localStorage-only — profile persistence is not an AC anywhere); the reference's token **generator** (`scripts/generate-theme.ts` + `material-theme.json` — our token files are already hand-ported and complete; regenerating them is out of scope); new molecules beyond the AC (no card/field/dropdown — they arrive with the stories that need them); transition/z-index token systems (the reference itself uses inline `0.2s ease` and literal z-indexes — do not "improve" past the reference). No API/DTO/backend change of any kind: `openapi.json` and the generated client must come out byte-identical.

### Repo state you are starting from (Story 1.4 end state, post-alignment refactor)

Commit `187fd3a` already re-aligned 1.4's output with the reference: M3 tonal `palette.scss`, `[data-theme="light"/"dark"]` semantic `theme.scss`, `fonts.scss` (Poppins type scale, loaded via `next/font` in the layout), `metrics.scss`, `shadows.scss` all EXIST and are structurally correct — `tokens/index.scss` aggregates them, `index.scss` is the single app-imported entry. The dark-theme variable block exists but has NEVER been exercised (everything hardcodes light). What remains broken/incomplete:

- `apps/money-tracker/src/app/[locale]/layout.tsx` hardcodes `data-theme="light"` on `<html>` — the dark block in `theme.scss` is dead code today
- `apps/storybook/.storybook/preview.ts` hardcodes `document.documentElement.dataset['theme'] = 'light'`
- `packages/ui/src/components/input/Input.module.scss:34` — literal `rgb(101 85 143 / 20%)` focus shadow (light-theme purple)
- Component APIs are thinner than the reference: Button has only `primary|secondary|ghost` × `sm|md|lg`, Input has no `error`/`startAdornment`, no `data-slot` attributes anywhere — and Typography/Label don't exist (1.5's auth forms need both)
- No theme switcher, no next-themes, no addon-themes
- Only Button and Dialog have tests; stories live in `apps/storybook/src/stories/` (NOT co-located in ui — keep that layout)

SCSS plumbing that already works and must not regress: explicit `@use` imports (package-specifier form `@use "@supertool/ui/src/styles/mixins"` in shell/apps, relative form `@use "../../styles/mixins"` inside ui — verified under both Turbopack and Storybook Vite in 1.4's change log; the old `additionalData` injection is GONE). `packages/ui` is source-consumed (no build, no exports map) and framework-pure: React only — `next-themes` must NOT enter `packages/ui` (the switcher lives in shell; ui components only consume `var(--…)` tokens, which respond to `[data-theme]` for free).

### Theming design (binding)

- `next-themes` 0.4.6 (npm-latest, unchanged since 2025-03; exact pin). It owns: `[data-theme]` attribute writes, localStorage persistence (AC "persists across reloads"), system-preference tracking + `prefers-color-scheme` listener, and the pre-hydration inline script that prevents a flash of wrong theme — which is WHY `<html>` needs `suppressHydrationWarning` (next-themes mutates the attribute before React hydrates; without the flag React logs a mismatch warning).
- Provider placement: inside `NextIntlClientProvider`, wrapping `AppShell` — mirrors the reference layout. `attribute="data-theme"` matches `theme.scss` selectors exactly. `defaultTheme="system"` + `enableSystem` gives the AC's three options.
- ThemeSwitcher hydration: `useTheme()` returns `theme: undefined` server-side and on first client render (the stored value is only knowable in the browser). Render the Select only after a `useEffect`-set `mounted` flag — otherwise the select's value mismatches between server and client HTML. This is the next-themes README pattern.
- next-themes also sets `style="color-scheme: dark"` — free correct scrollbars/form-controls; don't fight it.
- Shell dependency direction stays legal: `next-themes` is a pure React library (no Next.js import), so shell taking it as a peer keeps `ui → shell → apps` intact; it's framework-coupled enough that it must NOT sink into `packages/ui`.

### Reference patterns (consult before implementing — used as reference, NEVER copied; ED1)

| Concern | Reference path (under `example/track-my-life/`) |
| --- | --- |
| Token system (already ported — for divergence checks) | `packages/ui/src/styles/tokens/{palette,theme,fonts,metrics,shadows}.scss`, `index.scss` |
| Button API/markup/styling | `packages/ui/src/components/atoms/button/button.tsx` + `button.module.scss` |
| Input (error, startAdornment, wrapper) | `packages/ui/src/components/atoms/input/input.tsx` + `input.module.scss` |
| Select styling/markup | `packages/ui/src/components/atoms/select/select.tsx` + `select.module.scss` |
| Dialog styling (closest: alert-dialog) | `packages/ui/src/components/molecules/alert-dialog/` |
| Table | **no reference counterpart — new ground** (token purity is the bar) |
| Typography atom | `packages/ui/src/components/atoms/typography/` |
| Label atom | `packages/ui/src/components/atoms/label/` |
| Hover/breakpoint mixins | `packages/ui/src/styles/_mixins.scss`, `_breakpoints.scss` |
| ThemeProvider mounting | `apps/money-tracker/src/app/[locale]/layout.tsx` (`ThemeProvider attribute="data-theme"`, `suppressHydrationWarning`; skip its CSP nonce) |
| Theme switcher UI | **no reference counterpart — new ground**; structural pattern: supertool's own `packages/shell/src/components/locale-switcher/LocaleSwitcher.tsx` |
| Storybook theme toolbar + a11y | `apps/storybook/.storybook/preview.ts` (`withThemeByDataAttribute` + next-themes decorator with `forcedTheme`, `a11y: { test: 'error' }`), `.storybook/main.ts` (addon registration) |
| Theme switcher i18n keys | **no reference counterpart — new ground**; follow `apps/money-tracker/messages/{en,uk}/navigation.json` `localeSwitcher` shape |

Adaptation rules when carrying patterns: `@supertool` scope not `@track-my-life`; PascalCase component filenames (`Button.tsx`, `Button.module.scss`) not the reference's kebab-case; `translate` not `t` (repo `id-length` rule); `FC<Props>` typing per the 1.4 alignment; no `data-slot`-less elements where the reference has them; reference versions differ (it runs storybook 10.0.6/sass 1.93.3 — supertool pins 10.4.4/1.100.0; carry patterns, not versions).

### Architecture compliance (binding for this story)

- **Boundaries:** `ui` stays framework-pure (React + Radix + clsx only — NO next-themes, no next-intl; labels via props); `shell` consumes ui + next-intl + next-themes, never tool apps; dependency direction `shared` → `ui` → `shell` → apps holds [architecture.md#Architectural-Boundaries]
- **New-dependency rule:** `next-themes` is sanctioned by this story's AC (epics.md Story 1.8); `@storybook/addon-themes` is toolchain in the already-sanctioned storybook lockstep family. Record both exact pins in Dev Agent Record. Nothing else new [architecture.md#Implementation-Handoff]
- **i18n:** namespace-file layout per `.claude/rules/i18n.md` (`messages/{en,uk}/navigation.json`); both locales in the same commit (FR19/FR20 gate); nested camelCase keys; ICU only
- **Styling:** `.claude/rules/styles.md` — tokens only, camelCase classes, mobile-first, namespaced `@use` imports; stylelint must stay green (first dark-theme styling lands under the same rules)
- **Naming:** PascalCase component files + co-located `.module.scss`/`.test.tsx`/`.stories.tsx`; dirs kebab-case (`theme-switcher/ThemeSwitcher.tsx`) [CLAUDE.md Conventions]
- **Tests with the story (NFR1):** new atoms get smoke tests; ThemeSwitcher gets a behavior test; repaired primitives keep existing tests green
- **No comments in code; no TS enums (as-const + ObjectValuesUnion); no-ternary rule → `cn` for class logic**

### Previous story intelligence (1.4 record — directly applicable)

- pnpm transient crash `undefined is not an object (evaluating 'H.replace')` hits plain `pnpm install` too — retry the same command; if `pnpm add --filter` crashes, edit package.json manually + `pnpm install`
- Turbo cache replays stale logs and can mask real failures — the 1.4 CI type-check failure was invisible locally until `--force`. ALWAYS verify final gates with `--force` on type-check/lint/test
- `@testing-library/react` auto-cleanup needs `globals: true` in vitest config (already set in ui/shell — don't regress)
- Radix Select interaction in jsdom needs `scrollIntoView`/`hasPointerCapture`/`releasePointerCapture` stubs; open via `fireEvent.keyDown(trigger, { key: 'Enter' })` then `fireEvent.click(option)` — pattern exists in `LocaleSwitcher.test.tsx`
- `exactOptionalPropertyTypes` is on: optional props need conditional spreads or explicit `| undefined` (will bite on `error`/`startAdornment`/`fontWeight`)
- `id-length` min 2 chars: `translate` not `t`; `oxc/no-barrel-file`: no index barrels, deep imports only
- Storybook telemetry stays disabled (`core.disableTelemetry: true` in main.ts — NFR4); don't lose it when editing main.ts
- Dialog's `description`/`closeLabel` required props exist for Radix a11y — keep them through the repair

### Latest tech notes (verified 2026-06-12)

- `next-themes` 0.4.6 = npm latest (stable since 2025-03). API: `ThemeProvider` props `attribute`, `defaultTheme`, `enableSystem`, `forcedTheme`, `storageKey`; `useTheme()` → `{ theme, setTheme, resolvedTheme, systemTheme }`. For the switcher show `theme` (the user's choice incl. `'system'`), not `resolvedTheme`
- `@storybook/addon-themes` 10.4.4 published and = dist-tag latest — exact lockstep with installed storybook 10.4.4 confirmed; exports `withThemeByDataAttribute` and `DecoratorHelpers.pluckThemeFromContext`
- Both may be younger than pnpm 11's `minimumReleaseAge` window — `pnpm-workspace.yaml` already carries storybook 10.4.4 excludes; extend `minimumReleaseAgeExclude` if install refuses, record in Dev Agent Record

### Project Structure Notes

End-state tree delta for THIS story:

```
supertool/
├── apps/
│   ├── money-tracker/
│   │   ├── package.json                          # + next-themes 0.4.6
│   │   ├── messages/{en,uk}/navigation.json      # + themeSwitcher.{label,light,dark,system}
│   │   └── src/app/[locale]/layout.tsx           # − data-theme="light"; + suppressHydrationWarning + ThemeProvider
│   └── storybook/
│       ├── package.json                          # + @storybook/addon-themes 10.4.4, next-themes 0.4.6
│       ├── .storybook/main.ts                    # + addon-themes registration
│       ├── .storybook/preview.ts                 # − hardcoded light; + theme decorators + a11y param
│       └── src/stories/{Typography,Label}.stories.tsx   # NEW
└── packages/
    ├── ui/src/components/
    │   ├── button/  input/  select/  dialog/  table/    # REPAIRED (module.scss + APIs)
    │   ├── typography/Typography.{tsx,module.scss,test.tsx}   # NEW
    │   └── label/Label.{tsx,module.scss,test.tsx}             # NEW
    └── shell/
        ├── package.json                          # + next-themes peer/dev
        └── src/components/
            ├── app-shell/AppShell.tsx            # + ThemeSwitcher in header actions
            └── theme-switcher/ThemeSwitcher.{tsx,test.tsx}    # NEW
```

Documented variances vs reference: Select keeps the simple `optionList` API (reference exports composed Radix parts); Dialog keeps its `trigger/title/description/closeLabel` API mapped onto reference alert-dialog styling; Table has no reference counterpart; the reference's CSP nonce plumbing and token-generator script are not carried.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.8] — story statement, the 4 ACs, sprint-change note (1.8 before 1.5)
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries] — ui framework-purity, dependency direction, new-dependency rule
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — naming/i18n/process patterns, agent MUSTs
- [Source: _bmad-output/implementation-artifacts/1-4-money-tracker-shell-design-system-i18n-foundation.md] — Dev Agent Record (pins, pnpm/vitest/Radix lessons), Change Log (alignment refactor `187fd3a`, SCSS `@use` form, PascalCase rename), Review Findings (deferred Select empty-options affordance — still deferred)
- [Source: .claude/rules/styles.md] — token-only styling, namespaced `@use`, double-class overrides
- [Source: .claude/rules/i18n.md] — namespace message files, parity gate, `translate` naming
- [Source: example/track-my-life — reference-only, ED1] — all paths in "Reference patterns" table above
- [Source: https://github.com/pacocoursey/next-themes] — ThemeProvider API, suppressHydrationWarning requirement, mounted-guard pattern (verified 2026-06-12)
- [Source: https://storybook.js.org/docs/essentials/themes] — withThemeByDataAttribute decorator (verified 2026-06-12)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Fable 5)

### Debug Log References

- RED→GREEN per primitive: new Button/Input/Select assertions failed before implementation (4 failures), then 25/25 ui tests green; ThemeSwitcher test failed on missing module, then 9/9 shell tests green
- `pnpm install` reported "Already up to date" yet resolved both new packages — verified `next-themes@0.4.6` and `@storybook/addon-themes@10.4.4` present in `node_modules/.pnpm` and `pnpm-lock.yaml` before proceeding; the `H.replace` crash did not occur
- `@storybook/addon-themes@10.4.4` was appended to `pnpm-workspace.yaml` `minimumReleaseAgeExclude` during install (anticipated by this story); `next-themes` 0.4.6 (2025-03) needed no exclusion
- AC-2 verified in a real browser (throwaway playwright-core script in /tmp against `pnpm dev`, repo untouched): 12/12 checks — switch to dark sets `[data-theme="dark"]` + `color-scheme`, persists in localStorage across full reload, system option tracks live `prefers-color-scheme` changes, /uk switcher fully Ukrainian, dark body background renders token `#141218`
- AC-3 verified headlessly against the production Storybook build: all 32 stories loaded with `globals=theme:light|dark`, `data-theme` applied correctly on every story, axe-core scan (color-contrast included) → 0 violations in both themes; note: axe scanned default story states (dialog/select closed), matching how addon-a11y evaluates initial render

### Completion Notes List

- **Button divergences fixed**: variants `outline | link | destructive` and size `icon` added; polymorphic `component` prop via the reference `ButtonProps<Comp extends ElementType>` conditional type (generic component — `FC` typing not applicable per story note). Documented divergences from reference: supertool keeps the `type="button"` default on the native-button path (existing behavior/test; applied only when `component` is absent); no `displayName` (no supertool component sets one); reference's unused `.iconSm`/`.iconLg` classes not carried (unreachable from the reference API too)
- **Input divergences fixed**: `error`/`startAdornment`/`ref` props, adornment wrapper markup, `aria-invalid`, `[type="file"]` styling carried from reference. Focus/error rings: the reference itself hardcodes `rgb(101 85 143 / 20%)` / `rgb(179 38 30 / 20%)` — replaced with `color-mix(in srgb, var(--primary|--error) 20%, transparent)` so the rings follow the theme (the story-mandated token-based improvement over the reference)
- **Select divergences fixed** (simple `optionList` API kept — documented divergence): `error` prop + `aria-invalid` + `.error` trigger state; `data-slot="select-content"/"select-item"` added; trigger icon now `Icon asChild` span `▼`; scroll up/down buttons added; item indicator now the reference SVG check inheriting `currentColor` (was text `✓` forced to `--primary`); item highlight via `:focus` (was `[data-highlighted]`); color-mix focus rings as Input. Reference `.label`/`.separator` styles not carried (no Group/Label/Separator parts in the supertool API). `LocaleSwitcher` unchanged and green
- **Dialog divergences fixed** (API kept — documented divergence Radix dialog vs alert-dialog): title/description now render through `Typography` via Radix `asChild` (`h2`/`title-m`/`semibold` and `body-m`) exactly like the reference alert-dialog; `.title`/`.description` reduced to color (+margin) overrides; `.description` uses the styles.md double-class selector so its margin deterministically beats Typography's `margin: 0` regardless of CSS-module emission order. Overlay/content/close styling was already reference-aligned from the 1.4 alignment refactor
- **Table**: audited — token-pure already, no reference counterpart, no changes
- **Cross-cutting fix**: `body` in `_normalize.scss` gained `background-color: var(--background, #ffffff)` — the app relied on the shell wrapper for page background and the Storybook canvas was unthemed white, which broke dark mode rendering outside the shell (token-file-style fallback literal, same pattern as the existing `color` fallback there)
- **Typography**: adapted from reference without the `as ElementType` assertion (repo forbids `as`): `const Component: ElementType = tag ?? VARIANT_TAG_MAP[variant]`; explicit `| undefined` on optional base props for `exactOptionalPropertyTypes`; reference's `media-s` 0.875× title-xl/title-l scaling carried verbatim for fidelity. **Label**: thin `<label data-slot="label">` wrapper; reference's unused `.disabled`/`.peerDisabled` classes not carried
- **ThemeSwitcher**: mirrors LocaleSwitcher structure — co-located `constants.ts` with `THEME_OPTION` as-const + `ObjectValuesUnion` + `checkIsThemeOption` guard; `mounted` hydration guard per next-themes README; shows `theme` (user choice incl. `system`), falls back to `system` while undefined. `next-themes` stays out of `packages/ui` (framework-purity held: switcher lives in shell, ui only consumes `var(--…)`)
- **New dependency pins recorded**: `next-themes@0.4.6` (money-tracker dependencies; shell peerDependencies + devDependencies; storybook devDependencies), `@storybook/addon-themes@10.4.4` (storybook devDependencies, lockstep with storybook 10.4.4)
- **Gates**: `pnpm lint`, `pnpm fmt:check`, `turbo run type-check --force` (8/8), `pnpm stylelint`, `turbo run test --force` (5/5 packages, ui 25 + shell 9 tests), `pnpm build`, `pnpm i18n:parity`, `turbo run generate:client` drift-clean — all green; hygiene greps clean (no `^`/`~`, no `example/` imports, no hand-written fetch, no literal colors in ui component modules)

### File List

- `_bmad-output/implementation-artifacts/1-8-design-system-repair-theming.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md` (review deferrals)
- `_bmad-output/planning-artifacts/epics.md` (sprint change: stories 1.9–1.11 added)
- `_bmad/custom/bmad-code-review.toml`
- `_bmad/custom/bmad-create-story.toml`
- `_bmad/custom/bmad-dev-story.toml`
- `apps/money-tracker/package.json`
- `apps/money-tracker/messages/en/navigation.json`
- `apps/money-tracker/messages/uk/navigation.json`
- `apps/money-tracker/src/app/[locale]/layout.tsx`
- `apps/storybook/package.json`
- `apps/storybook/.storybook/main.ts`
- `apps/storybook/.storybook/preview.ts`
- `apps/storybook/src/stories/Button.stories.tsx`
- `apps/storybook/src/stories/Input.stories.tsx`
- `apps/storybook/src/stories/Select.stories.tsx`
- `apps/storybook/src/stories/Typography.stories.tsx` (new)
- `apps/storybook/src/stories/Label.stories.tsx` (new)
- `packages/shell/package.json`
- `packages/shell/src/components/app-shell/AppShell.tsx`
- `packages/shell/src/components/app-shell/AppShell.test.tsx`
- `packages/shell/src/components/theme-switcher/ThemeSwitcher.tsx` (new)
- `packages/shell/src/components/theme-switcher/ThemeSwitcher.module.scss` (new, review fix)
- `packages/shell/src/components/theme-switcher/ThemeSwitcher.test.tsx` (new)
- `packages/shell/src/components/theme-switcher/constants.ts` (new)
- `packages/ui/src/components/button/Button.tsx`
- `packages/ui/src/components/button/Button.module.scss`
- `packages/ui/src/components/button/Button.test.tsx`
- `packages/ui/src/components/dialog/Dialog.tsx`
- `packages/ui/src/components/dialog/Dialog.module.scss`
- `packages/ui/src/components/input/Input.tsx`
- `packages/ui/src/components/input/Input.module.scss`
- `packages/ui/src/components/input/Input.test.tsx`
- `packages/ui/src/components/select/Select.tsx`
- `packages/ui/src/components/select/Select.module.scss`
- `packages/ui/src/components/select/Select.test.tsx`
- `packages/ui/src/components/typography/Typography.tsx` (new)
- `packages/ui/src/components/typography/Typography.module.scss` (new)
- `packages/ui/src/components/typography/Typography.test.tsx` (new)
- `packages/ui/src/components/label/Label.tsx` (new)
- `packages/ui/src/components/label/Label.module.scss` (new)
- `packages/ui/src/components/label/Label.test.tsx` (new)
- `packages/ui/src/styles/_normalize.scss`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Change Log

- 2026-06-12: Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, opus) — 2 decisions deferred to Story 1.9 per Oleksii (visual evidence gate + Select open-panel width defect; 1.8 accepted on mechanism + token purity), 3 patches applied (ThemeSwitcher guarded `selectedTheme` with regression test, layout-preserving pre-mount placeholder + `ThemeSwitcher.module.scss`, File List completed), 2 pre-existing items logged in deferred-work.md. Gates re-verified green (forced). Status → done.
- 2026-06-12: Story 1.8 implemented on `TOOLS-1-8/design-system-repair-theming` — five primitives repaired against `example/track-my-life` (Button full variant/size set + polymorphic `component`, Input error/adornment, Select error + reference markup, Dialog typography via Typography atom, Table audited clean); token-based `color-mix` focus rings replace the hardcoded light-purple literals; Typography + Label atoms added with tests and stories; `next-themes@0.4.6` runtime theming (ThemeProvider in locale layout, ThemeSwitcher in shell header, en/uk messages); `@storybook/addon-themes@10.4.4` theme toolbar + next-themes decorator + `a11y: { test: 'error' }`; themed body background added to normalize. All gates green (forced), AC-2 browser-verified 12/12, AC-3 axe-verified 0 violations across 32 stories × 2 themes. Status → review.
