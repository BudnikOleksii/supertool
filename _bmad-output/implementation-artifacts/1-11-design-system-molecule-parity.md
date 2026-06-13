---
baseline_commit: 321d7f424166c4bc7d45f9c70e0686faadb03438
---

# Story 1.11: Design System Molecule Parity

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii,
I want the ten reference molecules available in `packages/ui/src/components/molecules` (built from atoms, never copied),
so that forms, confirmations, navigation, and feedback UI in feature stories (1.5 auth, 2.x transactions) are composed from the design system instead of one-off UI.

## Coordination with Story 1.10 (runs in parallel)

1.10 (Design System Atom Parity) is being implemented in parallel — this story does NOT wait for it to finish before starting. Exactly ONE task here depends on 1.10:

- **`field` (Task 8)** composes the **`Separator`** atom (`FieldSeparator` renders `Separator`). `Separator` is delivered by **Story 1.10** (it is not in the current `packages/ui` — current atoms are only `button`, `input`, `label`, `select`, `typography`), which also lands `@radix-ui/react-separator`. `field` needs `Separator` transitively.

**The other nine molecules compose only atoms that already exist** (`Button`, `Typography`, `Label`) — start them immediately. `field` is deliberately ordered LAST (Task 8) so the dependency resolves as late as possible. When you reach Task 8:

- If `packages/ui/src/components/atoms/separator/Separator.tsx` exists (1.10 merged), build `field`, then run final visual QA + gates (Tasks 9–10) over all ten molecules.
- If `Separator` is not yet merged, complete the other nine molecules' visual QA + gates first, then land `field` + its visual QA once `Separator` is available. The story is not `done` until all ten ship.
- Verify the real `Separator` export name/path before coding `field` — if 1.10's API differs from the reference (`example/.../atoms/separator/separator.tsx`), adapt `field`'s import to the actual 1.10 surface.

## Acceptance Criteria

1. **Ten molecules added under `components/molecules/`, built from atoms (ED1 — adapted, never copied).** Each of `accordion`, `alert-dialog`, `breadcrumb`, `card`, `combobox`, `dropdown-menu`, `error-state`, `field`, `pagination`, `toaster` is added under `packages/ui/src/components/molecules/<name>/` following its `example/track-my-life/packages/ui/src/components/molecules/<name>/` counterpart. Each ships token-only `.module.scss` (no literal hex/px beyond pre-existing token-defined patterns — `.claude/rules/styles.md`), a co-located smoke test (`*.test.tsx`, NFR1), and a CSF3 story in `apps/storybook/src/stories/<Name>.stories.tsx` (the established story location — stories are NOT co-located in `ui`). PascalCase component/test filenames, kebab-case dirs. No barrels / no re-exports (`oxc/no-barrel-file`).

2. **Existing `Dialog` is untouched and coexists with the new `alert-dialog`.** The 1.8 `Dialog` (`molecules/dialog/Dialog.tsx`, the `trigger/title/description/closeLabel` API mapped onto alert-dialog styling) keeps its current public API and markup unchanged. The new `alert-dialog` is the reference-style compound component (`@radix-ui/react-alert-dialog` parts) and is a SEPARATE molecule. Both ship; the documented 1.8 divergence stands.

3. **New dependencies added to `packages/ui` are exact-pinned, sanctioned by this story, and recorded.** The molecules require `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover` (combobox), `sonner` (toaster), and `lucide-react` (icons for error-state/pagination/toaster + accordion/dropdown chevrons — sanctioned for this story; mirror the reference 1:1). Each is added to `packages/ui` `dependencies` at the **latest stable version verified against the npm registry at implementation time** (consistent with how the existing `@radix-ui/react-dialog@1.1.16` / `@radix-ui/react-select@2.3.0` pins are newer than the reference's — supertool uses latest-stable, not the reference's frozen pins), exact (no `^`/`~`), and the resolved pin for each is recorded in the Dev Agent Record.

4. **`packages/ui` stays framework-pure — the toaster gets its theme by prop, not from `next-themes`.** The reference toaster imports `next-themes`' `useTheme()` inside the ui package; supertool's `Toaster` accepts a `theme?: 'light' | 'dark' | 'system'` prop (default `'system'`) and the shell forwards the resolved theme. No `next-themes`, no `next-intl`, no Next.js import enters `packages/ui` (documented divergence; architecture boundary holds — [architecture.md#Architectural-Boundaries]). `sonner` itself (framework-agnostic React) is allowed.

5. **The 1.9 visual QA protocol is executed for every new molecule, with evidence in the Dev Agent Record.** Light AND dark Storybook screenshots, INCLUDING open/interactive states (combobox expanded, dropdown-menu open, alert-dialog open, accordion expanded, toast visible), each compared side-by-side against the reference rendering, every divergence fixed or documented. The Storybook a11y addon passes in both themes for every new story. A claim of "renders correctly" without screenshots in the record fails this story (this gate is exactly why 1.4 and 1.8 shipped broken UI behind green gates — see [[ui-stories-need-visual-qa]]).

## Tasks / Subtasks

> Recommended implementation order groups molecules by dependency and shared deps so each gate run is meaningful. Do `field` LAST (it needs the 1.10 `Separator`).

- [x] **Task 1 — Add and pin the new dependencies (AC: #3, #4)**
  - [x] Resolve the latest stable version of each new dep against the npm registry (e.g. `pnpm view @radix-ui/react-accordion version`): `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `sonner`, `lucide-react`. Reference known-good floors (do NOT just copy — verify latest): accordion `1.2.12`, alert-dialog `1.1.15`, dropdown-menu `2.1.16`, popover `1.1.14`, sonner `2.0.7`, lucide-react `0.564.0`.
  - [x] Add each to `packages/ui/package.json` `dependencies`, exact pin, alphabetically ordered alongside the existing `@radix-ui/react-dialog` / `@radix-ui/react-select` / `clsx`. Do NOT add `next-themes` or `class-variance-authority` (see AC-4 — toaster theme is a prop, not next-themes).
  - [x] `pnpm install`; if the transient `H.replace` crash hits, retry the same command (or edit `package.json` + `pnpm install`) — [[run-tests-via-pnpm-scripts]]. Record each resolved exact pin in the Dev Agent Record.

- [x] **Task 2 — Self-contained Radix molecules: `accordion`, `dropdown-menu` (AC: #1, #5)**
  - [x] `molecules/accordion/Accordion.{tsx,module.scss,test.tsx}` — wraps `@radix-ui/react-accordion`. Exports `Accordion` (= `Root`), `AccordionItem`, `AccordionTrigger`, `AccordionContent`. `'use client'`. Chevron indicator: lucide `ChevronDown`, rotates on `[data-state="open"]`.
  - [x] `molecules/dropdown-menu/DropdownMenu.{tsx,module.scss,test.tsx}` — wraps `@radix-ui/react-dropdown-menu`. Exports `DropdownMenu` (= `Root`), `DropdownMenuTrigger` (= `Trigger`), `DropdownMenuContent`, `DropdownMenuItem` (reference set — extend only if a consumer needs more). `'use client'`; portal + `data-side` styling token-only.
  - [x] CSF3 stories with `play`-driven OPEN states for both (mirror `Dialog.stories.tsx` `Open` pattern).

- [x] **Task 3 — Typography-composing molecules: `alert-dialog`, `card` (AC: #1, #2, #5)**
  - [x] `molecules/alert-dialog/AlertDialog.{tsx,module.scss,test.tsx}` — wraps `@radix-ui/react-alert-dialog`. Exports `AlertDialog` (= `Root`), `AlertDialogTrigger` (= `Trigger`), `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`. Title/Description render through `Typography` via `asChild` (same technique as the existing `Dialog`). `'use client'`. **Do NOT modify the existing `molecules/dialog/Dialog.tsx`** (AC-2).
  - [x] `molecules/card/Card.{tsx,module.scss,test.tsx}` — DOM + `Typography` only (no Radix). Exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`. `CardTitle`/`CardDescription` render via `Typography`. Reference uses `React.Children`/`isValidElement` for conditional slots — adapt, keep framework-pure.
  - [x] CSF3 stories; alert-dialog story with `play`-driven OPEN state (confirm-action shape: title, description, Cancel + Action). Card story showing header/content/footer composition.

- [x] **Task 4 — Atom-composing molecules: `error-state`, `pagination` (AC: #1, #5)**
  - [x] `molecules/error-state/ErrorState.{tsx,module.scss,test.tsx}` — composes `Button` (`../../atoms/button/Button`) + `Typography` (`../../atoms/typography/Typography`); status icon = lucide `AlertTriangle`. Named `export const ErrorState`. Props mirror the reference (title/description/retry action).
  - [x] `molecules/pagination/Pagination.{tsx,module.scss,test.tsx}` — composes `Button` + `Typography`; prev/next chevrons = lucide `ChevronLeft`/`ChevronRight`. Named `export const Pagination` + `PaginationProps`. Offset-pagination shaped to match the API `{ data, meta: { page, limit, total } }` consumers (D7) — derive page count from `total`/`limit`.
  - [x] CSF3 stories (multiple variants: default/with-retry for error-state; first/middle/last page for pagination).

- [x] **Task 5 — `breadcrumb` (AC: #1, #5)**
  - [x] `molecules/breadcrumb/Breadcrumb.{tsx,module.scss,test.tsx}` — DOM-only, framework-pure (no Radix, no `'use client'` in the reference). Exports `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`. Separator/ellipsis glyphs = lucide (`ChevronRight`/`MoreHorizontal`, per reference). `BreadcrumbLink` stays an `<a>`/`asChild` slot — do NOT couple it to `next/link` (framework-pure; the consuming app passes its own link via `asChild`).
  - [x] CSF3 story showing a multi-level trail with a collapsed ellipsis.

- [x] **Task 6 — `combobox` (the heavy one) (AC: #1, #5)**
  - [x] `molecules/combobox/Combobox.{tsx,module.scss}` + `hooks/use-combobox-highlight.ts`, `hooks/use-combobox-ids.ts`, `hooks/use-combobox-keyboard.ts`, `hooks/use-combobox-search.ts` + `Combobox.test.tsx`. Wraps `@radix-ui/react-popover`. `'use client'`. Exports `Combobox` component + `ComboboxOption` / `ComboboxProps` interfaces. Self-contained (the reference combobox does NOT compose Button/Input — it's its own input+listbox via popover + the four hooks). Hooks use only React built-ins (`useState`/`useCallback`/`useRef`/`useEffect`/`useId`).
  - [x] Note: hooks live in `hooks/` (kebab-case files exporting camelCase hooks — these are NOT components, so kebab-case is correct per the naming rule). Keep `FIRST_INDEX` and the hook export names from the reference.
  - [x] CSF3 story with `play`-driven OPEN/expanded state and a type-to-filter interaction; verify keyboard nav (↑/↓/Enter/Esc) in the smoke test where jsdom allows.

- [x] **Task 7 — `toaster` (framework-pure divergence) (AC: #1, #4, #5)**
  - [x] `molecules/toaster/Toaster.tsx` + `toast.ts` + `Toaster.test.tsx`. `Toaster` wraps `sonner`'s `<Toaster as Sonner>`. **Remove the `next-themes` `useTheme()` coupling** — accept `theme?: 'light' | 'dark' | 'system'` prop (default `'system'`), pass it straight to sonner's `theme`. Status icons = lucide `CircleCheckIcon`/`InfoIcon`/`Loader2Icon`/`OctagonXIcon`/`TriangleAlertIcon` (the reference's 5 icons), wired into sonner's `icons` prop. `'use client'`.
  - [x] `toast.ts` re-exports `toast` from `sonner` (the imperative API) — single re-export, no logic. (Per `oxc/no-barrel-file`, this is a functional re-export of a third-party value the consumers call, not a component barrel; if oxlint flags it, expose `toast` from `Toaster.tsx` instead — verify which the linter accepts and record the choice.)
  - [x] Document in the story file: the shell (not this story) wires next-themes→`theme` prop at mount; ui exposes the prop only. Do NOT add the shell mount here (out of scope).
  - [x] CSF3 story rendering the `Toaster` and triggering a toast of each status via a button so the toast is screenshot-able (visible state).

- [x] **Task 8 — `field` (LAST — needs the 1.10 `Separator`) (AC: #1, #5)** — COMPLETE. Story 1.10 merged (PR #7); `main` merged into this branch. The real `Separator` (`export const Separator` at `atoms/separator/Separator.tsx`, accepts `className`) matched the drafted import exactly — no Field change needed. Gates + visual QA re-run with the real atom.
  - [x] PRECONDITION: confirm `packages/ui/src/components/atoms/separator/Separator.tsx` exists (delivered by 1.10, running in parallel). If it has not landed yet, do Tasks 9–10 for the other nine molecules first and return to `field` once `Separator` is merged (see "Coordination with Story 1.10"). → Initially CHECKED absent (1.10 was `backlog`); the nine molecules shipped first. 1.10 has since merged — `Separator` now exists and is composed by `FieldSeparator`.
  - [x] `molecules/field/Field.{tsx,module.scss,test.tsx}` — composes `Label` + `Separator` (1.10). Real `Separator` export name/path matches `import { Separator } from '../../atoms/separator/Separator'` and accepts `className` for `FieldSeparator`'s line — no adjustment needed. 4 tests pass; `pnpm --filter @supertool/ui type-check` green.
  - [x] CSF3 story showing a labeled field with description + error state and a `FieldSet`/`FieldGroup` grouping. `apps/storybook/src/stories/Field.stories.tsx` (Default, WithError, GroupedSignUp). Visual QA done (both themes, FieldSeparator "or" line renders via the real `Separator`); axe 0 violations.
  - [ ] `molecules/field/Field.{tsx,module.scss,test.tsx}` — composes `Label` (`../../atoms/label/Label`) + `Separator` (`../../atoms/separator/Separator`, from 1.10). `'use client'`. Exports the full reference set: `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle`, `FormField`. `FieldLabel` renders `Label`; `FieldSeparator` renders `Separator`.
  - [ ] CSF3 story showing a labeled field with description + error state and a `FieldSet`/`FieldGroup` grouping (this is the shape 1.5 auth forms consume — make the story representative).

- [x] **Task 9 — Execute the 1.9 visual QA protocol + record evidence (AC: #5)** — executed for the nine shipped molecules; `field` QA deferred with Task 8.
  - [x] Build/serve Storybook; for EACH of the ten molecules capture light + dark screenshots including the OPEN/interactive states (combobox expanded, dropdown open, alert-dialog open, accordion expanded, toast visible). Use the same throwaway `playwright-core` + cached chromium + transitions-disabled harness 1.9 used against `storybook-static` (do NOT add Playwright/sirv to the repo — Playwright is a deferred epic). → Done for nine molecules (38 PNGs). `field` excluded (Task 8 blocked).
  - [x] Place each side-by-side against its reference counterpart; judge spacing/type/token/focus-ring/open-geometry fidelity; fix or document each divergence.
  - [x] Save PNGs to `_bmad-output/implementation-artifacts/visual-qa/1-11/` and embed the per-molecule evidence table in the Dev Agent Record (cite light AND dark filenames — the 1.9 review docked under-citing existing dark shots).
  - [x] Run axe over every new story × both themes (scoped to `#storybook-root` as the addon does) → 0 violations. Document any rule scoped-off (with the inherent-Radix-behavior justification, as 1.9 did for Select's `aria-hidden-focus`) — alert-dialog/dropdown/popover use the same portal+`aria-hidden` mechanism, so expect possible `aria-hidden-focus` findings on open states.

- [x] **Task 10 — Verify all gates forced (AC: #1)**
  - [x] `pnpm lint`, `pnpm fmt:check`, `pnpm stylelint`, `turbo run type-check --force`, `turbo run test --force`, `pnpm build` (Turbopack sass + Storybook Vite sass — the only gate that surfaced the 1.9 `@use` depth break), `pnpm i18n:parity` (must stay green — this story adds NO user-facing strings to message files; story labels/copy live in the stories as static demo text, not `next-intl` keys), `turbo run generate:client --force` (byte-identical — touches NO API/DTO).
  - [x] Hygiene greps: no `^`/`~` in new deps; no `example/` imports; no barrels/re-exports; no literal hex colors in new molecule SCSS; no `next-themes`/`next-intl`/`next/*` import anywhere under `packages/ui`.

## Dev Notes

### Critical scope boundary

This story touches ONLY: `packages/ui` (add 10 molecule dirs + 5 new deps in `package.json` + lockfile) and `apps/storybook` (add 10 stories). **Do NOT**: modify the existing `Dialog`, any atom, or any other existing component's API/markup; touch `packages/shell` source (the toaster shell-mount is a LATER concern, not this story), `packages/widgets` (doesn't exist), `apps/money-tracker`, the API, DTOs, the generated client, or i18n message files. The generated client must come out byte-identical. No new keys in `en.json`/`uk.json` — molecule stories use static demo copy, not translated strings (these are design-system primitives; i18n happens at the consuming-app layer, [architecture.md#Component-boundaries]).

### Repo state you are starting from (post-1.9, post-1.10)

`packages/ui/src/components` is organized into `atoms/` and `molecules/` (1.9). After 1.10, atoms = `button`, `input`, `label`, `select`, `typography` **plus the 1.10 set** (`alert`, `aspect-ratio`, `avatar`, `badge`, `checkbox`, `radio-group`, `separator`, `skeleton`, `time-picker`, `underline-link`). Molecules currently = `dialog`, `table` only. This story adds the ten reference molecules alongside them.

`packages/ui` is **source-consumed**: no build step, no `exports` map, no barrel. Consumers import by deep path (`@supertool/ui/src/components/molecules/<name>/<Name>`). Theming (1.8) is live via `next-themes` driving `[data-theme]` AT THE APP/SHELL level — `packages/ui` itself stays framework-pure (React + Radix + clsx + sonner only). Do not regress this.

`cn` helper: `packages/ui/src/lib/utils.ts` — `clsx`-only (no `tailwind-merge`). Import from molecules as `import { cn } from '../../../lib/utils'` (depth: `components/molecules/<name>/` → `src/lib/utils`). Component-local styles `import styles from './<Name>.module.scss'`. SCSS shared `@use` from a molecule dir uses `../../../styles/...` (three levels up — same depth lesson that broke 1.9's build; verify the built output, not just unit gates).

### Local conventions to mirror (study these exact files before coding)

The existing `Dialog` is the canonical molecule template — open it first:
- `packages/ui/src/components/molecules/dialog/Dialog.tsx` — `'use client'`; `import type { FC, ReactNode } from 'react'`; **destructured named Radix imports** (`import { Root, Trigger, Portal, ... } from '@radix-ui/react-dialog'`) — supertool destructures rather than the reference's `import * as XPrimitive`; `cn` + `styles` + `Typography` via `asChild`; `data-slot="..."` attributes on parts; inline `✕` glyph (NOT an icon library). Match this style for the new molecules — destructured named imports, `data-slot` attrs, `Typography asChild` for any text part.
- `packages/ui/src/components/atoms/button/Button.tsx` — variant set + polymorphic `component` prop; `Record<Variant, string>` class maps with `?? ''` fallbacks (no ternary class logic — `cn`/lookup maps only, per `.claude/rules/react.md`).
- `packages/ui/src/components/atoms/typography/Typography.tsx` — generic FC `<T extends IntrinsicElementsKeys>`; props `tag`/`variant`/`fontWeight`; no `as` assertions; `| undefined` on optional props (`exactOptionalPropertyTypes` is ON).
- `apps/storybook/src/stories/Dialog.stories.tsx` — CSF3 shape to copy: `import type { Meta, StoryObj } from '@storybook/react-vite'`; `import { screen, userEvent, within } from 'storybook/test'`; deep-path component import; `meta = { title: 'Primitives/<Name>', component, tags: ['autodocs'], parameters: { layout: 'centered' } } satisfies Meta<...>`; `Default` + `Open` (with `play` opening + `findByRole`) stories.

### Icons — `lucide-react` (sanctioned by this story)

`lucide-react` is **NOT** in the epic's enumerated new-dep list (the epic lists only the 4 Radix packages + sonner — [Source: epics.md#Story-1.11]), but Oleksii has sanctioned adding it for 1.11 so the molecules mirror the reference 1:1. Add it exact-pinned to `packages/ui` `dependencies` (Task 1) and record the resolved pin in AC-3's dep table. Use the same icons the reference uses, sized/colored by token via `currentColor` (lucide respects `color`/`width`/`height`), `aria-hidden` on decorative icons:
- `error-state`: `AlertTriangle`
- `pagination`: `ChevronLeft`, `ChevronRight`
- `breadcrumb`: `ChevronRight` (separator), `MoreHorizontal` (ellipsis)
- `accordion`: `ChevronDown` (rotates on `[data-state="open"]`)
- `dropdown-menu`: any indicator icons the reference uses (e.g. `Check` for checkbox items) — match the reference
- `toaster`: `CircleCheckIcon`, `InfoIcon`, `Loader2Icon`, `OctagonXIcon`, `TriangleAlertIcon` (sonner `icons` prop)

This is a sanctioned addition to the epic's dep list (record it as such), NOT a forbidden dependency. `packages/ui` stays framework-pure — `lucide-react` is framework-agnostic React.

### Toaster framework-purity (AC-4 binding)

Reference `toaster.tsx` does `const { theme } = useTheme()` from `next-themes` and feeds it to sonner. That import would pull a Next-coupled provider into the framework-pure `ui` package — forbidden ([architecture.md#Component-boundaries]: "`ui` is framework-pure (no next-intl, no API awareness)"). Supertool's `Toaster` instead takes `theme?: 'light' | 'dark' | 'system'` (default `'system'`) and passes it to sonner. The shell (which already depends on `next-themes`, per `packages/shell/package.json`) will read the resolved theme and pass it down WHEN it mounts the toaster — that wiring is a later story, not this one. `sonner` itself is framework-agnostic React and IS allowed in `ui`.

### Field depends on 1.10's Separator (re-stated — do not miss)

`field`'s `FieldSeparator` renders the `Separator` atom from Story 1.10 (running in parallel). It is the ONLY task here coupled to 1.10, which is why it is ordered last (Task 8). Build the other nine molecules immediately; defer `field` until `atoms/separator/Separator.tsx` is merged — do the nine molecules' QA + gates first if needed, then land `field`. If the 1.10 `Separator` export differs from the reference (`example/.../atoms/separator/separator.tsx`), adapt `field`'s import to the real 1.10 API. This is the single cross-story coupling in this story.

### Dependency versions — latest-stable policy

Architecture decision: dependency versions are "bumped to latest stable (verified against the npm registry)" — not the reference's frozen pins. Evidence: local `@radix-ui/react-dialog@1.1.16` and `@radix-ui/react-select@2.3.0` are both NEWER than the reference's. So resolve each new dep's latest stable at implementation time (`pnpm view <pkg> version`) and exact-pin it. Reference known-good floors (use only as a fallback / sanity floor, prefer the verified latest): accordion `1.2.12`, alert-dialog `1.1.15`, dropdown-menu `2.1.16`, popover `1.1.14`, sonner `2.0.7`. Record the resolved pins. [Source: architecture.md#Solutioning, NFR2 exact-versions rule]

### Testing standards (NFR1)

- Co-located `*.test.tsx` per molecule (`@testing-library/react` 16.3.2 + jsdom, Vitest 4.1.8). Smoke-level: renders, exposes its parts, basic interaction where jsdom allows.
- **Radix-in-jsdom stubs**: open via `fireEvent.keyDown(trigger, { key: 'Enter' })` then click the item; stub `scrollIntoView`/`hasPointerCapture`/`releasePointerCapture` (existing pattern in `Select.test.tsx`/`LocaleSwitcher.test.tsx`). The same applies to alert-dialog/dropdown-menu/combobox(popover).
- jsdom can't measure layout — open-panel/positioning fidelity is verified by SCREENSHOT (Task 9), not unit test. Don't write assertions that depend on computed geometry.
- `id-length` min 2 chars (`translate` not `t`); no TS enums (`as const` + union); no `as` assertions; no barrels.
- Tests ship in THIS story (NFR1) — no deferring test files to a later story.

### Visual QA protocol (the core deliverable — AC-5)

Identical mechanism to 1.9 (which established it): no automated visual-regression tool in the repo (Playwright deferred). Manual screenshot capture into the Dev Agent Record via a throwaway `playwright-core` + cached chromium harness against `apps/storybook/storybook-static`, `deviceScaleFactor: 2`, transitions/animations disabled (`*{transition:none!important;animation:none!important}`) for true resting state. Theme toggled via the `globals=theme:light|dark` Storybook global. For each molecule: default state (light+dark) + open/interactive state (light+dark) side-by-side vs the reference. Embed images/observations per molecule. **Green gates + green axe WITHOUT a recorded look is precisely how 1.4 and 1.8 shipped broken Select.** [[ui-stories-need-visual-qa]] [[turbo-cache-masks-gate-results]]

### Previous story intelligence (1.9 + 1.8 records — directly applicable)

- **Build is the only gate that catches SCSS `@use` depth breaks** — 1.9's `@use "../../styles/..."` silently passed type-check/test (Vitest mocks CSS-module resolution) and only `pnpm build` (Turbopack + Storybook Vite sass) failed. New molecule SCSS using shared mixins/breakpoints must use the correct depth (`../../../styles/...`) and you must run `pnpm build`, not just unit gates. [[turbo-cache-masks-gate-results]]
- **Turbo cache replays stale green logs** — always `--force` type-check/test after adding files. A cached green after a big add is meaningless.
- **pnpm transient crash** `undefined is not an object (evaluating 'H.replace')` — retry the same command; if `pnpm add --filter` crashes, edit `package.json` + `pnpm install`. [[run-tests-via-pnpm-scripts]]
- **Radix open-state axe `aria-hidden-focus`** — with a Radix overlay open, the trigger gets `aria-hidden` + `tabindex=0` while focus moves into the portal; axe flags it. Inherent Radix behavior (matches reference); scope OFF only that rule on the specific open-state story (`parameters.a11y.config.rules`), as 1.9 did for Select. Expect this on alert-dialog/dropdown/combobox open states.
- **Storybook telemetry stays disabled** (`core.disableTelemetry: true`, NFR4) — don't lose it editing config.
- **Storybook a11y is record-asserted, not machine-enforced** (deferred-work, 1.9 review): `turbo run test` is Vitest-only. Your axe run is the manual harness — record it; do not claim a gate enforces it.
- **`@fontsource/poppins@5.2.7`** is already loaded in Storybook (1.9) — your new stories render in real Poppins automatically; no font work needed.
- **`exactOptionalPropertyTypes` ON** — optional props need `| undefined` and must not be spread when absent.

### Reference patterns (consult before implementing — used as reference, NEVER copied; ED1)

All under `example/track-my-life/packages/ui/src/components/molecules/`:

| Molecule | Reference path | External deps | Atoms composed | Exports (named parts) |
| --- | --- | --- | --- | --- |
| accordion | `accordion/accordion.tsx`,`.module.scss` | `@radix-ui/react-accordion` | — | `Accordion`,`AccordionItem`,`AccordionTrigger`,`AccordionContent` |
| alert-dialog | `alert-dialog/alert-dialog.tsx`,`.module.scss` | `@radix-ui/react-alert-dialog` | `Typography` | `AlertDialog`,`AlertDialogTrigger`,`AlertDialogContent`,`AlertDialogHeader`,`AlertDialogFooter`,`AlertDialogTitle`,`AlertDialogDescription`,`AlertDialogAction`,`AlertDialogCancel` |
| breadcrumb | `breadcrumb/breadcrumb.tsx`,`.module.scss` | — (DOM only) | — | `Breadcrumb`,`BreadcrumbList`,`BreadcrumbItem`,`BreadcrumbLink`,`BreadcrumbPage`,`BreadcrumbSeparator`,`BreadcrumbEllipsis` |
| card | `card/card.tsx`,`.module.scss` | — (DOM only) | `Typography` | `Card`,`CardHeader`,`CardTitle`,`CardDescription`,`CardAction`,`CardContent`,`CardFooter` |
| combobox | `combobox/combobox.tsx`,`.module.scss`,`hooks/use-combobox-{highlight,ids,keyboard,search}.ts` | `@radix-ui/react-popover` | — (self-contained) | `Combobox` + `ComboboxOption`/`ComboboxProps` types |
| dropdown-menu | `dropdown-menu/dropdown-menu.tsx`,`.module.scss` | `@radix-ui/react-dropdown-menu` | — | `DropdownMenu`,`DropdownMenuTrigger`,`DropdownMenuContent`,`DropdownMenuItem` |
| error-state | `error-state/ErrorState.tsx`,`.module.scss` | `lucide-react` | `Button`,`Typography` | `ErrorState` |
| field | `field/field.tsx`,`.module.scss` | — | `Label`,`Separator` (1.10) | `Field`,`FieldLabel`,`FieldDescription`,`FieldError`,`FieldGroup`,`FieldLegend`,`FieldSeparator`,`FieldSet`,`FieldContent`,`FieldTitle`,`FormField` |
| pagination | `pagination/pagination.tsx`,`.module.scss` | `lucide-react` | `Button`,`Typography` | `Pagination` + `PaginationProps` |
| toaster | `toaster/toaster.tsx`,`toast.ts` | `sonner` (+ next-themes → **prop**), `lucide-react` | — | `Toaster` + `toast` (re-export) |

Reference `lib/utils` = `src/lib/utils.ts` `cn()` (clsx). Adaptation rules: `@supertool` scope; PascalCase component filenames (reference uses kebab `accordion.tsx` / mixed `ErrorState.tsx` — supertool is uniformly PascalCase: `Accordion.tsx`, `AlertDialog.tsx`, etc., hooks stay kebab `use-combobox-search.ts`); destructured named Radix imports (not `* as`); `lucide-react` icons (mirror reference, sanctioned this story); theme by prop not next-themes; carry patterns not versions. [[follow-example-repo-patterns]]

### Project Structure Notes

End-state delta for THIS story:

```
packages/ui/
  package.json                                   # + 6 exact-pinned deps (accordion, alert-dialog, dropdown-menu, popover, sonner, lucide-react)
  src/components/molecules/
    accordion/Accordion.{tsx,module.scss,test.tsx}
    alert-dialog/AlertDialog.{tsx,module.scss,test.tsx}
    breadcrumb/Breadcrumb.{tsx,module.scss,test.tsx}
    card/Card.{tsx,module.scss,test.tsx}
    combobox/Combobox.{tsx,module.scss},hooks/use-combobox-{highlight,ids,keyboard,search}.ts,Combobox.test.tsx
    dropdown-menu/DropdownMenu.{tsx,module.scss,test.tsx}
    error-state/ErrorState.{tsx,module.scss,test.tsx}
    field/Field.{tsx,module.scss,test.tsx}        # composes 1.10 Separator
    pagination/Pagination.{tsx,module.scss,test.tsx}
    toaster/Toaster.tsx, toast.ts, Toaster.test.tsx
  # existing molecules/dialog, molecules/table UNCHANGED
apps/storybook/src/stories/
  Accordion.stories.tsx  AlertDialog.stories.tsx  Breadcrumb.stories.tsx  Card.stories.tsx
  Combobox.stories.tsx   DropdownMenu.stories.tsx ErrorState.stories.tsx  Field.stories.tsx
  Pagination.stories.tsx Toaster.stories.tsx
_bmad-output/implementation-artifacts/visual-qa/1-11/*.png
```

Documented variances vs reference: toaster theme-by-prop instead of `next-themes` (framework purity, AC-4); existing `Dialog` retained beside new `alert-dialog` (1.8 divergence stands, AC-2); PascalCase component filenames; destructured named Radix imports. (`lucide-react` matches the reference but is a sanctioned ADDITION to the epic's enumerated dep list — record it as sanctioned in the Dev Agent Record.)

### Architecture compliance (binding)

- **Boundaries:** `ui` stays framework-pure (React + Radix + clsx + sonner only — NO next-themes/next-intl/next/*). `shared → ui → shell → apps` holds. [architecture.md#Frontend-Architecture, #Architectural-Boundaries, #Component-boundaries]
- **No barrels / no re-exports / no comments:** deep imports only (`oxc/no-barrel-file`); self-documenting names; follow-up work → story/deferred files, never TODO comments. [.claude/rules/javascript.md]
- **Naming:** PascalCase component + co-located `.module.scss`/`.test.tsx`; kebab-case dirs and hook files. [CLAUDE.md Conventions; architecture.md#Naming-Patterns]
- **Styling:** tokens only, camelCase classes, mobile-first, namespaced/relative `@use`; stylelint green. [.claude/rules/styles.md]
- **New dependencies:** exactly the 6 sanctioned by AC-3 (5 from the epic + `lucide-react` sanctioned here), exact-pinned, recorded. No eslint/prettier ever (NFR2). [architecture.md Enforcement Guidelines]
- **No TS enums (as-const + union); no `as` assertions; no ternary class logic (use `cn`/lookup maps).** [.claude/rules/typescript.md, react.md]
- **Tests with the story (NFR1).** **i18n parity untouched** (no message-file changes — AC scope).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.11] — story statement, 4 ACs, sanctioned dep list (note: lucide-react NOT listed), toaster framework-pure-via-prop requirement, visual-QA open-state requirement, Dialog/alert-dialog coexistence
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.10] — the `Separator` atom `field` depends on; runs before this story
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.9] — the visual QA protocol this story must execute; atoms/molecules structure
- [Source: _bmad-output/implementation-artifacts/1-9-design-system-structure-visual-qa-baseline.md] — Dev Agent Record (SCSS `@use` depth break, transition-disabled screenshots, Radix `aria-hidden-focus` handling, jsdom Radix stubs, @fontsource/poppins), visual-QA harness method, Review Findings
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Storybook a11y is record-asserted not machine-enforced; Select long-label clipping (not in scope here)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture, #Architectural-Boundaries, #Component-boundaries] — ui framework purity, dependency direction
- [Source: _bmad-output/planning-artifacts/architecture.md#Solutioning / NFR2] — latest-stable exact-pinned dependency policy
- [Source: packages/ui/src/components/molecules/dialog/Dialog.tsx] — canonical molecule template (imports, data-slot, Typography asChild, inline glyph)
- [Source: apps/storybook/src/stories/Dialog.stories.tsx] — CSF3 story + `play`-driven Open pattern
- [Source: packages/ui/src/lib/utils.ts] — `cn` helper (clsx-only)
- [Source: example/track-my-life — reference-only, ED1] — all paths in the Reference patterns table

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — dev-story workflow.

### Debug Log References

- **lucide-react is on `1.x`**, not `0.x` — `pnpm view lucide-react version` → `1.18.0` (dist-tags `latest: 1.18.0`). The reference floor `0.564.0` is stale; per the latest-stable policy the pin is `1.18.0`. All required icon names (`AlertTriangle`, `ChevronDown/Left/Right`, `MoreHorizontal`, and the `*Icon` aliases `CircleCheckIcon`/`InfoIcon`/`Loader2Icon`/`OctagonXIcon`/`TriangleAlertIcon`) exist in the installed `1.18.0` type surface.
- `pnpm-workspace.yaml` gained `minimumReleaseAgeExclude: lucide-react@1.18.0` — auto-added by the repo's pnpm supply-chain (minimum-release-age) policy so the recent pin can install, exactly as the pre-existing Storybook `10.4.4` entries do. Required, tied to Task 1.
- Card `withAction` detection: the reference reads `child.props['data-slot'] === 'card-action'`, which never matches when `<CardAction>` is passed as a component child (the `data-slot` lives in CardAction's render output, not on the element's props). Adapted to component-identity detection (`child.type === CardAction`) — framework-pure and correct; verified by test.
- `no-magic-numbers` (oxlint) flags bare numeric **call arguments** in tests (e.g. `toHaveBeenCalledWith(3)`) but not JSX numeric props — extracted to a named const. `react(hook-use-state)` requires the `useState` pair to be `[thing, setThing]`; the reference's `[search, setSearchState]` wrapper was renamed to `[searchText, setSearchText]` (public hook API unchanged).
- jest-dom matchers are NOT configured (repo uses core Vitest matchers) — used `container.firstChild`/`.className.toContain`/`.getAttribute` instead of `toBeEmptyDOMElement`/`toHaveClass`.
- Combobox a11y (found by the axe pass, fixed): ARIA `combobox` role does not take name-from-content, so the trigger `<button role="combobox">` had no accessible name (`button-name`) — added `aria-label={selectedLabel ?? placeholder}`. The placeholder's `opacity: 0.6` dropped `--on-surface-variant` below 4.5:1 on the light surface (`color-contrast`) — removed the opacity (full token color passes). Both re-verified green.

### Resolved dependency pins (AC-3)

| Dependency | Resolved exact pin | Sanctioned by |
| --- | --- | --- |
| `@radix-ui/react-accordion` | `1.2.13` | epic 1.11 |
| `@radix-ui/react-alert-dialog` | `1.1.16` | epic 1.11 |
| `@radix-ui/react-dropdown-menu` | `2.1.17` | epic 1.11 |
| `@radix-ui/react-popover` | `1.1.16` | epic 1.11 |
| `sonner` | `2.0.7` | epic 1.11 |
| `lucide-react` | `1.18.0` | sanctioned addition (Dev Notes — mirror reference icons 1:1) |

All exact-pinned (no `^`/`~`), alphabetically ordered in `packages/ui/package.json`. No `next-themes` / `class-variance-authority` added.

### Documented divergences from the reference (sanctioned)

- **Toaster framework purity (AC-4):** dropped `next-themes` `useTheme()`; `Toaster` takes `theme` by prop (default `'system'`, forwarded to sonner). The shell will wire next-themes→`theme` at mount in a LATER story (out of scope here). Tailwind utility classes from the reference (`size-4`, `animate-spin`, `toaster group`) replaced with the `size` prop + a token-only `Toaster.module.scss` spinner; sonner CSS vars remapped to supertool tokens (`--normal-bg: var(--surface-container)`, `--normal-text: var(--on-surface)`, `--normal-border: var(--outline-variant)`, `--border-radius: var(--radius-lg)`). No `next-themes`/`next-intl`/`next/*` anywhere under `packages/ui`.
- **Existing `Dialog` untouched (AC-2):** the 1.8 `molecules/dialog/Dialog.tsx` keeps its API/markup; the new `alert-dialog` is a separate compound molecule.
- **PascalCase component filenames** (reference uses kebab / mixed); **destructured named Radix imports** (not `import * as X`), matching the local `Dialog`/`Select` convention.
- **lucide icons** replace the reference's inline glyphs for accordion/breadcrumb/error-state/pagination/toaster (sanctioned). Combobox keeps its inline `▼`/check glyph (combobox not in the lucide list).
- **Pagination props** use the API meta shape `{ page, limit, total }` (D7) instead of the reference's `pageSize`.
- **Combobox focus rings** use `color-mix(in srgb, var(--primary) 20%, transparent)` (the local `Select` pattern) instead of the reference's literal `rgb(...)` — keeps SCSS token-only.
- No `as` assertions in production code: Card uses `isValidElement`/component-identity; combobox highlight uses `instanceof HTMLElement`; toaster custom CSS-var style typed via `CSSProperties & Record<\`--${string}\`, string>`.

### Completion Notes List

- Shipped all 10 molecules complete (component + token-only `.module.scss` + co-located `*.test.tsx` + CSF3 story under `apps/storybook/src/stories/`): `accordion`, `alert-dialog`, `breadcrumb`, `card`, `combobox` (+ 4 hooks), `dropdown-menu`, `error-state`, `pagination`, `toaster`, `field`.
- The nine non-`field` molecules shipped first while Story 1.10 was still `backlog` (its `Separator` atom blocks `field`). 1.10 then merged (PR #7); I merged `main` into this branch, and **`field` completed** against the real `Separator` — the drafted import (`{ Separator } from '../../atoms/separator/Separator'`) matched 1.10's surface exactly, no change needed. `FieldSeparator` "or" line renders correctly in both themes.
- Tests: 73 passing in `@supertool/ui` (post-merge: 1.10's atom tests + these molecules + `field`'s 4), including Radix-in-jsdom open-state coverage (accordion expand, dropdown/alert-dialog/combobox open via `fireEvent`, combobox keyboard nav + type-to-filter). No repo regressions (shell 10, api 19, next-shared 10 green). `type-check --force` 8/8.
- Gates (Task 10): `pnpm lint`, `pnpm fmt:check`, `pnpm stylelint`, `turbo run type-check --force` (8/8), `turbo run test --force`, `pnpm build` (Turbopack + Storybook Vite sass), `pnpm i18n:parity` (green — no message-file changes), `turbo run generate:client --force` (byte-identical — generated client untouched). Hygiene greps clean.
- Visual QA harness was a throwaway `/tmp` `playwright-core@1.56` + cached chromium-1208 project against `storybook-static` (transitions/animations disabled, `deviceScaleFactor: 2`); NOT added to the repo (no playwright/sirv in any `package.json`).

### File List

**Added — `packages/ui/src/components/molecules/`:**
- `accordion/Accordion.tsx`, `accordion/Accordion.module.scss`, `accordion/Accordion.test.tsx`
- `alert-dialog/AlertDialog.tsx`, `alert-dialog/AlertDialog.module.scss`, `alert-dialog/AlertDialog.test.tsx`
- `breadcrumb/Breadcrumb.tsx`, `breadcrumb/Breadcrumb.module.scss`, `breadcrumb/Breadcrumb.test.tsx`
- `card/Card.tsx`, `card/Card.module.scss`, `card/Card.test.tsx`
- `combobox/Combobox.tsx`, `combobox/Combobox.module.scss`, `combobox/Combobox.test.tsx`, `combobox/hooks/use-combobox-highlight.ts`, `combobox/hooks/use-combobox-ids.ts`, `combobox/hooks/use-combobox-keyboard.ts`, `combobox/hooks/use-combobox-search.ts`
- `dropdown-menu/DropdownMenu.tsx`, `dropdown-menu/DropdownMenu.module.scss`, `dropdown-menu/DropdownMenu.test.tsx`
- `error-state/ErrorState.tsx`, `error-state/ErrorState.module.scss`, `error-state/ErrorState.test.tsx`
- `pagination/Pagination.tsx`, `pagination/Pagination.module.scss`, `pagination/Pagination.test.tsx`
- `toaster/Toaster.tsx`, `toaster/Toaster.module.scss`, `toaster/toast.ts`, `toaster/Toaster.test.tsx`

**Added — `apps/storybook/src/stories/`:**
- `Accordion.stories.tsx`, `AlertDialog.stories.tsx`, `Breadcrumb.stories.tsx`, `Card.stories.tsx`, `Combobox.stories.tsx`, `DropdownMenu.stories.tsx`, `ErrorState.stories.tsx`, `Pagination.stories.tsx`, `Toaster.stories.tsx`

**Modified:**
- `packages/ui/package.json` (+6 exact-pinned deps)
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` (`minimumReleaseAgeExclude: lucide-react@1.18.0`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-11 → in-progress)

**Added — visual QA evidence:** `_bmad-output/implementation-artifacts/visual-qa/1-11/*.png` (38 PNGs)

**Added — `field` (Task 8, completed after merging Story 1.10):** `molecules/field/Field.tsx`, `molecules/field/Field.module.scss`, `molecules/field/Field.test.tsx`, `apps/storybook/src/stories/Field.stories.tsx`. Composes `Label` + the 1.10 `Separator`; full reference export set (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle`, `FormField`). 4 tests pass; visual QA captured (6 PNGs); axe 0 violations.

**Merge:** `origin/main` (Story 1.10, PR #7) merged into the branch — brought in the 1.10 atoms (alert, aspect-ratio, avatar, badge, checkbox, radio-group, separator, skeleton, time-picker, underline-link) + their stories. `packages/ui/package.json` deps unioned (my 6 + 1.10's 5 new radix atoms); `pnpm-lock.yaml` reconciled additively (main's pins preserved); `sprint-status.yaml` reconciled (1-10 `done`, 1-11 `review`).

### Visual QA Evidence (AC-5 — MANDATORY)

Method: throwaway `playwright-core` + cached chromium against `apps/storybook/storybook-static`, transitions/animations disabled, `deviceScaleFactor: 2`, theme via `globals=theme:light|dark` (confirmed `data-theme` applied). Each state captured and **visually inspected** in BOTH themes; compared against the reference rendering. All render correctly in real Poppins with correct tokens/theming — no visual divergences requiring a fix were found (the only fixes were the two combobox a11y issues below, surfaced by axe).

| Molecule | State | Light PNG | Dark PNG | Notes |
| --- | --- | --- | --- | --- |
| accordion | default | `accordion-default-light.png` | `accordion-default-dark.png` | collapsed, chevrons down |
| accordion | open | `accordion-open-light.png` | `accordion-open-dark.png` | item expanded, up-chevron, purple active trigger, separators |
| dropdown-menu | closed | `dropdownmenu-default-light.png` | `dropdownmenu-default-dark.png` | outline trigger |
| dropdown-menu | open | `dropdownmenu-open-light.png` | `dropdownmenu-open-dark.png` | surface-container panel + shadow |
| alert-dialog | closed | `alertdialog-default-light.png` | `alertdialog-default-dark.png` | destructive trigger |
| alert-dialog | open | `alertdialog-open-light.png` | `alertdialog-open-dark.png` | scrim + centered card, Cancel (outline) + Delete (destructive) |
| card | default | `card-default-light.png` | `card-default-dark.png` | header/content/footer |
| card | with action | `card-with-action-light.png` | `card-with-action-dark.png` | grid `withAction` (Edit top-right) |
| error-state | default | `errorstate-default-light.png` | `errorstate-default-dark.png` | AlertTriangle, no actions |
| error-state | with actions | `errorstate-with-actions-light.png` | `errorstate-with-actions-dark.png` | primary + outline buttons |
| pagination | first page | `pagination-first-light.png` | `pagination-first-dark.png` | prev disabled/dimmed |
| pagination | middle page | `pagination-middle-light.png` | `pagination-middle-dark.png` | `3 / 5`, both enabled |
| pagination | last page | `pagination-last-light.png` | `pagination-last-dark.png` | next disabled |
| breadcrumb | default | `breadcrumb-default-light.png` | `breadcrumb-default-dark.png` | lucide chevron separators, bold current |
| breadcrumb | collapsed | `breadcrumb-collapsed-light.png` | `breadcrumb-collapsed-dark.png` | MoreHorizontal ellipsis |
| combobox | closed | `combobox-default-light.png` | `combobox-default-dark.png` | trigger placeholder (contrast-fixed) |
| combobox | open | `combobox-open-light.png` | `combobox-open-dark.png` | trigger-width popover, search row + options |
| toaster | buttons | `toaster-default-light.png` | `toaster-default-dark.png` | trigger buttons |
| toaster | toast visible | `toaster-with-toast-light.png` | `toaster-with-toast-dark.png` | success toast, lucide circle-check, token bg/border |
| field | default | `field-default-light.png` | `field-default-dark.png` | label + input + description |
| field | with error | `field-with-error-light.png` | `field-with-error-dark.png` | error input border + message (M3 error token) |
| field | grouped sign-up | `field-grouped-light.png` | `field-grouped-dark.png` | FieldSet/legend + FieldSeparator "or" line via the real 1.10 `Separator`, error field |

**axe (axe-core 4.10.2, scoped to `#storybook-root`, every state × both themes):** all PASS after fixes, except the open `dropdown-menu` state which raises `aria-hidden-focus(1)` on the trigger — inherent Radix portal behavior (trigger gets `aria-hidden` + focus moves to the portal), matching the reference. Scoped OFF on the `DropdownMenu` `Open` story via `parameters.a11y.config.rules` (mirroring 1.9's Select `aria-hidden-focus` handling). The open `alert-dialog`/`combobox` states did NOT raise it (focus moves fully into a portal outside `#storybook-root`). Two combobox findings were REAL and fixed (see Debug Log): `button-name` (added `aria-label`) and light-theme `color-contrast` (removed placeholder `opacity`). The three `field` stories (default, with-error, grouped sign-up) pass axe with 0 violations in both themes. Note: Storybook a11y is record-asserted, not machine-enforced (`turbo run test` is Vitest-only) — this axe run is the manual harness.

## Change Log

| Date | Change |
| --- | --- |
| 2026-06-13 | Story drafted (create-story). Scope: 10 reference molecules into `packages/ui/molecules`, built from atoms; 6 sanctioned deps (4 Radix + sonner + lucide-react); toaster framework-pure-by-prop; `lucide-react` icons sanctioned to mirror the reference 1:1 (addition to the epic dep list); existing Dialog retained beside new alert-dialog; full 1.9 visual QA in both themes incl. open states. Flagged blocking dependency on Story 1.10 (`Separator` atom for `field`). |
| 2026-06-13 | dev-story: implemented 9 of 10 molecules (accordion, alert-dialog, breadcrumb, card, combobox+hooks, dropdown-menu, error-state, pagination, toaster) with tests + CSF3 stories. Pinned 6 exact deps (accordion `1.2.13`, alert-dialog `1.1.16`, dropdown-menu `2.1.17`, popover `1.1.16`, sonner `2.0.7`, lucide-react `1.18.0`). Toaster theme-by-prop (no next-themes). Visual QA (38 PNGs, both themes incl. open states) + axe pass; fixed two combobox a11y issues (button-name, light contrast). All gates green. **Task 8 (`field`) deferred — blocked on Story 1.10's `Separator` atom (not yet merged); story stays `in-progress`.** |
| 2026-06-13 | dev-story: DRAFTED `field` (Field.{tsx,module.scss,test.tsx} + Field.stories.tsx) ahead of 1.10. Validated against a temporary reference-accurate `Separator` stub (ui type-check, 4 field tests, storybook type-check all green), then removed the stub. `field` stays UNCHECKED/UNVERIFIED — it imports the not-yet-existent `atoms/separator/Separator`, so `packages/ui` will not type-check/build until 1.10 merges; final validation + visual QA pending the real `Separator`. |
| 2026-06-13 | dev-story: Story 1.10 merged (PR #7). Merged `main` into the branch (resolved deps union in `packages/ui/package.json`, additive `pnpm-lock.yaml`, sprint-status). Real `Separator` matched the drafted import — `field` completed with no code change: 4 tests pass, visual QA captured in both themes (FieldSeparator "or" line renders via the real atom), axe 0 violations. All 10 molecules now shipped. Full gates green (lint, fmt:check, stylelint, type-check --force 8/8, test --force, build, i18n:parity, generate:client byte-identical). **Task 8 complete → Status `review`.** |
