---
baseline_commit: c3b479f6e6c995f4d16918137d38142d63078023
---

# Story 4.1: Mobile Navigation Drawer & In-App Navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii on my phone,
I want a navigation drawer and real in-app navigation,
so that I can move between the tracker's screens without overflowing headers or hunting for direct URLs (RP-U1, RP-U3).

## Context & Why This Story

The reference-parity spike's central P0 finding: **supertool has no mobile nav and no in-app navigation.** At 390px the current header overflows ("Operator"/user-name runs off the edge, user menu clips), and the only way between screens is the landing link or typing URLs. The reference solves this with a drawer + dimmed backdrop on mobile and a persistent nav on desktop. This story closes RP-U1 (mobile nav, P0) and RP-U3 (in-app navigation, P1) — **no new product capability**, just making the already-shipped screens reachable and the header non-broken on a phone.

**Evidence:** reference mobile drawer + dimmed backdrop in `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/` (mobile viewport, logged in `…/spike-reference-parity/41-ref-capture-authenticated-log.md`); supertool's broken 390px header in `…/visual-qa/spike-reference-parity/supertool/` (logged in `…/spike-reference-parity/42-supertool-capture-log.md`). Adapt from `example/track-my-life` `(app-layout)` shell nav — **never copy/import (ED1)**.

## Architecture Decision (binding for this story)

**In-app destinations are passed to the shell by the app as a new generic `navItems` prop — they are NOT added to `tools.ts`.**

Rationale: `packages/shell` must stay tool-agnostic (FR4 — a hypothetical `apps/planner` is addable by configuration only; "shell never imports from tool apps", architecture.md §366). `tools.ts` is the **cross-tool** registry (today: one entry, money-tracker→`/`) and its mechanism is untouched (zero changes — satisfies the epic's "nav still driven by tools.ts" = the tool-registry mechanism is preserved). The **in-app** destinations (dashboard, transactions, categories, settings) are money-tracker routes, so the app owns the list and passes it in — exactly as it already passes `tools`, `userName`, and the callbacks to `AppShell`. The shell owns the **generic responsive chrome** (hamburger trigger, drawer, dimmed backdrop, desktop horizontal nav) and renders whatever `navItems` it's handed.

This mirrors how the reference's app owns its nav data, while keeping supertool's shell-package boundary intact.

## Acceptance Criteria

1. **Mobile drawer (RP-U1).** Given a mobile-browser viewport (< the desktop breakpoint, `$breakpoint-l` = 1024px), when I open any authenticated tracker screen, then the shell header renders a hamburger trigger that opens a nav drawer with a **dimmed backdrop**; the drawer lists the primary destinations (dashboard, transactions, categories, settings); **nothing in the header overflows the viewport edge** at 390px; and the user menu is fully reachable.
2. **Desktop preserved (no regression).** Given the desktop viewport (≥ 1024px), when the shell renders, then the in-app destinations are visible as horizontal navigation in the header (no hamburger, no drawer), the existing header layout (tool nav, theme switcher, locale switcher, user menu) is preserved, and there is no visual regression vs the current desktop shell.
3. **Drawer close + active state.** Given the drawer is open, when I select a destination or tap the dimmed backdrop (or press Escape), then the drawer closes and — for a destination selection — navigation occurs via the i18n app router, with the **active destination indicated** (`aria-current="page"` + active styling).
4. **Auth & locale routing intact.** Given protected-route and locale behaviour, when I navigate between screens via the drawer/nav, then auth redirects and next-intl locale routing keep working with **no redirect loops** (verified in a running app, not just unit tests), and the in-app nav (drawer + hamburger) renders **only for a signed-in user** (gated on `userName`, like the existing user menu) — sign-in/sign-up pages show no in-app nav.
5. **i18n parity.** Given every drawer/nav/aria label string, then each exists in **both** `apps/money-tracker/messages/en/navigation.json` and `…/uk/navigation.json` in this same commit (FR19/FR20; `pnpm i18n:parity` green), with real Ukrainian (not transliteration), ICU only.
6. **Tests (NFR1).** Given the shell components, when tests run, then `@testing-library/react` tests cover: drawer open via hamburger, close via destination select, close via backdrop, close via Escape, both nav variants (desktop + mobile) present in the DOM, active-state rendering, and that no in-app nav renders when `userName` is undefined. Tests ship in this story.
7. **Visual QA evidence (Story 1.9 protocol).** Given the rendered shell, then the Dev Agent Record carries screenshots in **light + dark themes** at **mobile (390px) + desktop (≥1024px)** viewports, including the **drawer-open** state with backdrop, compared against the reference captures — and confirms the 390px header no longer overflows.

## Tasks / Subtasks

- [x] **Task 1 — Define the shell nav contract & icon dependency** (AC: 1, 2)
  - [x] Add `lucide-react` at the **exact pinned version `1.18.0`** (match `packages/ui`'s existing pin — do not bump) to `packages/shell/package.json` and `apps/money-tracker/package.json`. (Shell needs the `LucideIcon` type for the prop; the app needs the icon components at runtime.)
  - [x] Create `packages/shell/src/components/app-shell/types.ts` with a `NavItem` interface: `{ href: string; labelKey: string; Icon?: LucideIcon }` (`Icon` optional — text-only still satisfies the AC, but icons are in scope for parity). Import `LucideIcon` as a type from `lucide-react`.
  - [x] Reference: reference's nav-item shape is `example/track-my-life/.../(app-layout)/components/app-sidebar/AppSidebar.tsx:35-74` (`NavigationItem` with `href`/`Icon`/`labelKey`). Adapt to a flat list (no submenus — supertool has no nested destinations this story).
- [x] **Task 2 — Build the responsive in-app nav in `packages/shell`** (AC: 1, 2, 3)
  - [x] Create `packages/shell/src/components/app-nav/AppNav.tsx` (`'use client'`, `FC<{ navItems: NavItem[] }>`). Single client component holding the drawer open/close with local `useState` — **do not** replicate the reference's `SidebarProvider` context (one drawer, one consumer → local state is simpler and correct; this is a deliberate simplification over the reference's split AppHeader/AppSidebar/context).
    - [x] Desktop horizontal nav: render `navItems` as `NavigationLink`s in a row, hidden below `media-l` via the CSS display-toggle pattern (`.desktopNav.desktopNav { display: none; @include media-l { display: flex } }`).
    - [x] Mobile: a hamburger trigger (`Button variant="ghost" size="icon"` from `@supertool/ui` wrapping lucide `Menu`) shown only below `media-l`; on click opens the drawer.
    - [x] Drawer: an `<aside>` (off-canvas, slides in) + a dimmed backdrop `<div aria-hidden="true" onClick={handleClose}>`; drawer lists `navItems` as `NavigationLink`s, each with `onClick={handleClose}` so selecting closes it; Escape key closes (effect adapted from `AppSidebar.tsx:125-140`).
  - [x] Use `NavigationLink` from `@supertool/next-shared/src/i18n/navigation/NavigationLink` for every destination (it already applies `aria-current="page"` + `active` class on exact path match — satisfies active-state, AC #3). Labels via `useTranslations(\`${I18N_NAMESPACE.navigation}.labels\`)`.
  - [x] Use `cn` from `@supertool/ui/src/lib/utils` for conditional drawer/backdrop classes; never ternary string concat.
  - [x] Create `AppNav.module.scss` — mobile-first, design tokens only (`--surface`, `--on-surface-variant`, `--outline-variant`, `--spacing-*`, `--radius-*`, `--shadows-*`), drawer backdrop uses a token-based scrim, transitions on transform/opacity. Reuse the active-link token styling already in `tool-nav/ToolNav.module.scss:link` (`[aria-current="page"]` → `--primary-container`).
- [x] **Task 3 — Wire `AppNav` into `AppShell` + gate on auth** (AC: 1, 2, 4)
  - [x] Update `packages/shell/src/components/app-shell/AppShell.tsx`: add `navItems?: NavItem[]` to `AppShellProps`; render `<AppNav navItems={navItems} />` in the header **only when `userName !== undefined` and `navItems` is non-empty** (same gating intent as the existing user-menu conditional, `AppShell.tsx:34`). Keep `ToolNav`, `ThemeSwitcher`, `LocaleSwitcher`, `UserMenu` exactly as-is.
  - [x] Fix header overflow at 390px (AC #1): audit `AppShell.module.scss` `.header`/`.actions` — ensure the user-name button truncates/wraps and the actions row does not exceed the viewport (e.g. `min-width: 0`, `overflow` handling, gap tightening at mobile). The hamburger + drawer move primary nav off the header on mobile, which is the structural fix; verify no element clips at 390px.
- [x] **Task 4 — Provide `navItems` from money-tracker** (AC: 1, 2, 3)
  - [x] Update `apps/money-tracker/src/app/[locale]/AppShellSection.tsx`: build a `NAV_ITEM_LIST: NavItem[]` from `ROUTES` (`dashboard`, `transactions`, `categories`, `settings`) + `labels.*` keys + lucide icons (`LayoutDashboard`, `ArrowLeftRight`, `Tags`, `Settings` — same icon choices as the reference, `AppSidebar.tsx:42-74`). Pass `navItems={NAV_ITEM_LIST}` to `<AppShell>`. **Never hardcode path literals** — reference `ROUTES.*` (react.md).
  - [x] Note: `ROUTES.home` (`/`) is the landing; the four authenticated destinations are dashboard/transactions/categories/settings. Settings is also reachable via the user menu — that stays; the drawer entry is additive.
- [x] **Task 5 — i18n strings (both locales, same commit)** (AC: 5)
  - [x] Add a `labels` group to `apps/money-tracker/messages/en/navigation.json` and `…/uk/navigation.json`: `dashboard`, `transactions`, `categories`, `settings`. Add an `actions` group: `openMenu`, `closeMenu` (drawer aria-labels). Real Ukrainian translations.
  - [x] Run `pnpm i18n:parity` — must be green.
- [x] **Task 6 — Tests** (AC: 6)
  - [x] Update `packages/shell/src/components/app-shell/AppShell.test.tsx` and/or add `app-nav/AppNav.test.tsx`. Extend the existing mock of `@supertool/next-shared/.../navigation` (already mocked at `AppShell.test.tsx:12-17`). Cover: hamburger opens drawer (asserts drawer + backdrop present), selecting a destination closes it, backdrop click closes, Escape closes, both desktop and mobile nav variants render, active link gets `aria-current="page"`, and **no in-app nav renders when `userName` is undefined**. Provide `navItems` fixtures (with a stub `Icon`).
  - [x] jsdom has no real media queries — do not assert which variant is *visually* hidden; assert both are in the DOM (CSS owns the responsive switch) and cover the interactive behaviours. The responsive visual switch is verified in Task 7.
- [x] **Task 7 — Visual QA (Story 1.9 protocol, NFR8)** (AC: 7)
  - [x] Run the dev stack; sign in as the seeded operator (creds in `apps/api/.env.example`; trusted-origins pinned to `:3000` — sign in on port 3000 to avoid the 403 noted in the spike caveat). Capture with global `playwright-cli`.
  - [x] Screenshot matrix per the 1.9 protocol: **{light, dark} × {390px, ≥1024px}**, plus the **drawer-open + backdrop** state on mobile. Confirm: 390px header no longer overflows; desktop unchanged vs current; drawer matches reference quality. Record evidence + reference comparison in the Dev Agent Record.

### Review Findings (code review 2026-06-16)

- [x] [Review][Patch] Mobile drawer lacks a modal a11y contract — add `role="dialog"`/`aria-modal`, focus move-into-drawer on open + restore to trigger on close, focus trap, and body scroll lock; background content currently stays focusable/scrollable behind the open scrim [packages/shell/src/components/app-sidebar/AppSidebar.tsx:74-84, packages/shell/src/components/app-shell/use-drawer-escape-close.ts] (resolved from [Decision] → full patch, operator call 2026-06-16) (blind+edge)
- [x] [Review][Patch] Submenu auto-open state is computed once and never re-synced on client navigation — `useState(initialOpenHrefList)` consumes the memo only on first mount; since `AppSidebar` persists in the `[locale]` layout, navigating to an active child of a currently-collapsed parent leaves it collapsed and hides the user's location [packages/shell/src/components/app-sidebar/AppSidebar.tsx:57-62] (blind+edge)
- [x] [Review][Patch] Single Escape press closes both the open Radix user-menu and the drawer — `use-drawer-escape-close` adds a `document` keydown listener that fires regardless of `event.defaultPrevented`/topmost overlay [packages/shell/src/components/app-shell/use-drawer-escape-close.ts:9-13] (edge)
- [x] [Review][Patch] Drawer open-state not reset when crossing to desktop width — opening the drawer then widening past `media-l` leaves `isMobileOpen` true (stray global keydown listener stays attached on desktop; drawer reappears already-open when re-narrowing) [packages/shell/src/components/app-sidebar/AppSidebar.tsx:70 + sidebar-provider/SidebarProvider.tsx] (edge)
- [x] [Review][Patch] Dev Agent Record carries stale first-pass claims — the "Completion Notes List" describes the superseded `AppNav` (not the shipped `AppSidebar`/`SidebarProvider`) and a phantom `closeMenu` i18n key (shipped keys are `openMenu`/`expand`/`collapse`); the code is correct, the prose is misleading [Dev Agent Record §Completion Notes List] (auditor)
- [x] [Review][Defer] Dual active-route detection — `getActiveHref` uses prefix/longest-match but drives only submenu-open; the rendered link's `aria-current` uses exact match, so deep sub-paths (e.g. `/categories/<id>/edit`) surface no active item [packages/shell/src/components/app-sidebar/AppSidebar.tsx:36-44 vs next-shared NavigationLink] — deferred, pre-existing; documented as accepted scope (Dev Notes: prefix-match optional, not AC-required) (blind+edge+auditor)
- [x] [Review][Defer] Sidebar brand may clip to "Mor Trac" in the expanded rail via `.brand { overflow: hidden }`, per `v2-desktop-light-usermenu.png` [packages/shell/src/components/app-sidebar/AppSidebar.module.scss:68-79] — deferred, pre-existing; verify against live UI (other captures show it intact — likely a capture artifact) (auditor)

## Course Correction (2026-06-16) — Reference-parity sidebar

After the first pass (header horizontal nav + flat drawer) shipped to review, the product owner directed a pivot toward closer reference parity. The header-nav approach and the mobile switcher crowding are superseded by the following. Tasks 1–7 above remain done (the `navItems` contract, i18n keys, auth-gating intent, and the drawer mechanics carry over); the desktop presentation and switcher placement change.

**Revised ACs (supersede AC #2; extend #1/#3):**
- **CC-1 Desktop sidebar.** On desktop (≥ `media-l`), in-app destinations render as a **persistent collapsible left sidebar** (brand + icon nav), not header nav. A collapse toggle reduces it to an icon rail.
- **CC-2 Mobile drawer from sidebar.** Below `media-l`, the same sidebar becomes an off-canvas drawer + dimmed backdrop, opened by a hamburger in a slim top bar. Closes on select / backdrop / Escape.
- **CC-3 Submenu scaffolding.** `NavItem` supports `children`; Transactions renders an expandable group. Children link to real routes where they exist; not-yet-built destinations (transactions-by-category, recurring, import, Budgets — Epics 5–6) render **disabled** (no 404s).
- **CC-4 Switchers in user menu.** Theme + Locale move into the user menu dropdown (authed chrome) to fix the 390px overflow; unauthed pages keep a minimal header with the standalone switchers.
- **CC-5 Auth gating.** Sidebar/topbar render only for a signed-in user (shell still wraps sign-in/up — those stay chrome-light, centered).

**Course-correction tasks:**
- [x] **CC-T1** Extend `packages/ui` `DropdownMenu` with `Sub`/`SubTrigger`/`SubContent`/`RadioGroup`/`RadioItem`/`Label`/`Separator` (Radix passthrough).
- [x] **CC-T2** Rebuild shell `UserMenu`: name trigger → dropdown with Theme + Language radio submenus, Settings, Sign out. Pass `onLocaleChange`/locale/theme wiring.
- [x] **CC-T3** Add shell `SidebarProvider` (context: `isCollapsed`, `isMobileOpen`, toggles) — adapt from reference.
- [x] **CC-T4** Build shell `AppSidebar` (persistent rail + mobile drawer + backdrop, collapse toggle, brand, icon nav, submenu groups, active state, Escape-close).
- [x] **CC-T5** Restructure `AppShell`: authed = `SidebarProvider`[sidebar + content(topbar hamburger + UserMenu + main)]; unauthed = minimal header (Theme/Locale) + main. Remove the interim `AppNav`.
- [x] **CC-T6** `AppShellSection`: build `NAV_ITEM_LIST` with Transactions `children`; flag disabled placeholders for missing routes.
- [x] **CC-T7** i18n (en+uk): submenu child labels, collapse/expand aria, brand.
- [x] **CC-T8** Tests: SidebarProvider/AppSidebar behaviours, UserMenu theme/locale, AppShell authed/unauthed gating.
- [x] **CC-T9** Visual QA: light/dark × mobile/desktop × {collapsed, expanded, drawer-open, submenu-open}; confirm 390px fits.

## Dev Notes

### Architecture & boundary constraints
- `packages/shell` is layout chrome consuming `ui` + the tool registry; **it must never import from tool apps** (architecture.md §366). The in-app destination data therefore flows in via the new `navItems` prop — the app composes it. Do not import `ROUTES` or any money-tracker symbol into `packages/shell`.
- `tools.ts` and the tool-registry mechanism get **zero changes** (FR3/FR4). The `ToolNav` (cross-tool) stays as-is; `AppNav` (in-app) is the new, separate concern.
- Dependency direction holds: `shared → ui → shell → app`. `shell` may import `@supertool/ui`, `@supertool/next-shared`, `@supertool/shared`. `lucide-react` is a leaf dep already used by `ui`.

### Files to TOUCH (read each before editing)
| File | Action | Why |
|---|---|---|
| `packages/shell/src/components/app-shell/AppShell.tsx` | UPDATE | Add `navItems` prop; render `AppNav` gated on `userName`. Preserve ToolNav/Theme/Locale/UserMenu (currently `AppShell.tsx:28-41`). |
| `packages/shell/src/components/app-shell/AppShell.module.scss` | UPDATE | Fix 390px header overflow (`.header`/`.actions`). Existing uses `media-m` only. |
| `packages/shell/src/components/app-shell/types.ts` | NEW | `NavItem` interface. |
| `packages/shell/src/components/app-nav/AppNav.tsx` | NEW | Responsive nav: desktop row + mobile hamburger/drawer/backdrop. |
| `packages/shell/src/components/app-nav/AppNav.module.scss` | NEW | Mobile-first drawer/backdrop styles, tokens only. |
| `packages/shell/src/components/app-nav/AppNav.test.tsx` (or extend AppShell.test.tsx) | NEW/UPDATE | Behaviour tests. |
| `packages/shell/package.json` | UPDATE | Add `lucide-react: "1.18.0"` (match ui's pin). |
| `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` | UPDATE | Build `NAV_ITEM_LIST` from `ROUTES` + icons, pass `navItems`. Currently `AppShellSection.tsx:42-52`. |
| `apps/money-tracker/package.json` | UPDATE | Add `lucide-react: "1.18.0"`. |
| `apps/money-tracker/messages/en/navigation.json` | UPDATE | Add `labels` + `actions` groups. |
| `apps/money-tracker/messages/uk/navigation.json` | UPDATE | Same keys, real Ukrainian. |

### Current state of the system this story modifies (preserve, don't break)
- **`AppShell`** today (`packages/shell/src/components/app-shell/AppShell.tsx`) is a pure `FC` (no `'use client'`) rendering `<header>` (ToolNav + actions: Theme, Locale, conditional UserMenu) and `<main>`. It is applied to **every** `[locale]` route via the single `apps/money-tracker/src/app/[locale]/layout.tsx` (supertool does **not** use route groups, unlike the reference's `(app-layout)`). Therefore the shell wraps sign-in/sign-up too — hence the `userName`-gating requirement so the in-app nav only shows when authenticated (UserMenu already does this).
- **`AppShellSection`** (`'use client'`, `apps/money-tracker/.../AppShellSection.tsx`) is the app-side adapter that supplies `tools`, `userName`, and the locale/settings/sign-out callbacks. Add `navItems` here. Keep all existing handlers (`handleSignOut`, `handleOpenSettings`, `handleLocaleChange`) untouched.
- **`NavigationLink`** (`packages/next-shared/src/i18n/navigation/NavigationLink.tsx`) applies `active` class + `aria-current="page"` on **exact** `pathname === href`. Sub-routes (`/transactions/new`, `/categories/[id]/edit`) will NOT highlight their parent destination — acceptable for this story (top-level destinations). A longest-prefix active matcher (reference `getActiveHref`, `AppSidebar.tsx:79-88`) is an **optional** enhancement, not required by the AC; if added, keep it in the app or generalize cleanly — do not over-build.
- **Breakpoints** (`packages/ui/src/styles/_breakpoints.scss`): `media-s 390 / media-m 768 / media-l 1024 / media-xl 1440`. Use **`media-l` (1024px)** as the mobile↔desktop nav boundary (drawer below, horizontal nav at/above). Mobile-first per styles.md (base = mobile, override up).

### Reference patterns (study before implementing — adapt, never copy, ED1)
- **Drawer + dimmed backdrop + Escape-close + close-on-link-click:** `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/components/app-sidebar/AppSidebar.tsx` (backdrop `:150-152`, `<aside>` `:153-159`, Escape effect `:125-140`, `onClick={onCloseMobile}` on links `:227,256`). Adapt the open/backdrop/escape mechanics; **drop** the desktop collapse/submenu/brand machinery (out of scope).
- **Hamburger trigger:** `…/(app-layout)/components/app-header/AppHeader.tsx:44-54` (lucide `Menu`, `Button variant="ghost" size="icon"`, `aria-label`).
- **Open-state pattern:** `…/(app-layout)/components/sidebar-provider/SidebarProvider.tsx` — **simplify to local `useState`** in `AppNav` (no context; one drawer, one consumer).
- **Nav-item list + icons:** `AppSidebar.tsx:42-74` (icon choices: `LayoutDashboard`, `ArrowLeftRight`, `Tags`, `Settings`).
- **Layout composition:** `…/(app-layout)/layout.tsx` — illustrative only; supertool keeps its single shell, no route groups.
- **No reference counterpart** for "shell package owns generic chrome, app supplies `navItems`" — this is supertool's boundary (the reference has no shell package). New ground, justified by FR4.

### Conventions to honor
- Component files PascalCase + co-located `.module.scss`/`.test.tsx`; dirs kebab-case (`app-nav/`). `FC<Props>` typing always; `PropsWithChildren` where relevant.
- SCSS: camelCase classes, design tokens only, namespaced `@use` (`@use "@supertool/ui/src/styles/breakpoints";` → `@include breakpoints.media-l`), double-class selector when overriding ui styles, CSS-display-toggle for responsive visibility (styles.md).
- i18n: `useTranslations(I18N_NAMESPACE.navigation...)`, never the literal `"navigation"`; `id-length` lint rejects `t` (use `translate`/`translations`). New keys in **both** locales same commit.
- No comments; self-documenting names; array vars end in `List`; arrow functions; handlers prefixed `handle`, callback props prefixed `on`; no barrel/re-export files.
- New deps pinned exact (`1.18.0`, no `^`/`~`); never add eslint/prettier.

### Testing standards
- Shell uses Vitest + `@testing-library/react` + jsdom (`packages/shell` test script already present). Co-locate `*.test.tsx`. Run via `pnpm` scripts (`pnpm --filter @supertool/shell test`), never `node_modules/.bin` directly; retry on the transient pnpm `H.replace` crash.
- Reuse the existing navigation mock shape from `AppShell.test.tsx:12-17`. `packages/ui` jest-dom matchers are NOT available in this package — assert with plain `expect(...).toBeDefined()/.toBeNull()` / `textContent` as the existing test does.
- Verify gates with `--force` where turbo cache may replay stale logs; CI runs the real thing.

### Verify-live requirements (do not skip)
- Middleware/redirect/locale-routing changes need a **running-app** check — unit tests cannot catch redirect loops (memory `verify-middleware-redirect-changes-live`). Navigate dashboard↔transactions↔categories↔settings in both locales; confirm no loop, correct locale prefix, drawer closes on navigate.
- UI stories have shipped green-but-broken before (1.4, 1.8) — **a green gate is not done.** The screenshot matrix in Task 7 is the acceptance evidence; do not claim parity without the actual look (memory `ui-stories-need-visual-qa`).

### Out of scope (explicit guardrails)
- No new product capability; no changes to `tools.ts`/tool-registry mechanism; no route groups; no desktop sidebar collapse/submenu/brand block; no first-run period/empty-state work (that's Story 4.3); no transactions-list responsive work (Story 4.2); no currency picker (RP-D1 — single default stays). Keep the four destinations flat.

### Project Structure Notes
- New `app-nav/` dir sits beside the existing `app-shell/`, `tool-nav/`, `user-menu/`, `theme-switcher/`, `locale-switcher/` under `packages/shell/src/components/` — consistent with current structure. No conflicts with the unified structure; `NavItem` type lives in `app-shell/types.ts` and is imported directly (no barrel).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] — story statement + 5 BDD AC blocks + evidence pointers
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — epic intent, binding rules, evidence base
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md#§3 RP-U1/RP-U3] — P0 mobile nav / P1 in-app nav gaps; §6 strengths to protect (dark mode, locale, URL state)
- [Source: _bmad-output/planning-artifacts/architecture.md#Component boundaries §366] — shell tool-agnostic, never imports tool apps; FR4 add-a-tool walkthrough §385-389
- [Source: example/track-my-life/.../(app-layout)/components/app-sidebar/AppSidebar.tsx] — drawer/backdrop/escape/close pattern (adapt)
- [Source: example/track-my-life/.../(app-layout)/components/app-header/AppHeader.tsx] — hamburger trigger
- [Source: packages/shell/src/components/app-shell/AppShell.tsx / .module.scss / .test.tsx] — files updated
- [Source: apps/money-tracker/src/app/[locale]/AppShellSection.tsx] — app-side prop wiring
- [Source: packages/next-shared/src/i18n/navigation/NavigationLink.tsx] — active-state link
- [Source: packages/ui/src/styles/_breakpoints.scss] — `media-l` 1024 boundary
- [Source: .claude/rules/styles.md, react.md, i18n.md, javascript.md] — conventions

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `pnpm i18n:parity` → green (1 messages dir checked)
- `pnpm lint` → 0 warnings / 0 errors (shell 314 rules, money-tracker 335 rules)
- `pnpm stylelint` (AppNav + AppShell scss) → exit 0
- `pnpm --filter @supertool/shell test` → 5 files / 23 tests passed
- `pnpm type-check` (full) → 9/9 successful
- `pnpm test` (full) → all packages passed (api 182, shell 23, …)

### Completion Notes List

> ⚠️ **Superseded first-pass record** (header-nav `AppNav`). The accurate as-shipped account is **Completion Notes (course correction)** below. These bullets describe the removed `AppNav` design — including i18n keys that did not ship (the shipped `navigation.actions` group is `openMenu` / `expand` / `collapse`, not `closeMenu`) — and are retained only for history.

**Architecture / boundary**
- Shell stays tool-agnostic: added a generic `navItems?: NavItem[]` prop to `AppShell`; the app (`AppShellSection`) owns `NAV_ITEM_LIST`, built from `ROUTES` + lucide icons. `tools.ts`/tool-registry mechanism untouched (zero changes). `NavItem` type lives in `app-shell/types.ts`, imported directly (no barrel).
- `AppNav` is a single `'use client'` component with local `useState` for drawer open/close (deliberate simplification over the reference's `SidebarProvider` context — one drawer, one consumer). Escape-close effect adapted from the reference `AppSidebar`.

**Responsive switch (CSS-owned, mobile-first)**
- Desktop horizontal nav hidden below `media-l` (double-class display toggle); hamburger hidden at/above `media-l`. Drawer is an always-mounted off-canvas `<aside>` that slides via `transform` + `.drawerOpen`, with `aria-hidden`/`inert` when closed so its links leave the a11y tree and focus order; the dimmed backdrop is conditionally rendered with a token-based scrim (`color-mix(in srgb, var(--scrim) 40%, transparent)`).
- Active state via `NavigationLink` (`aria-current="page"` + active class); active-link token styling mirrors `ToolNav` (`--primary-container`).

**390px overflow fix**
- Grouped `ToolNav` + `AppNav` in a shrinkable `.start` (`min-width: 0`); tightened header gap at mobile; constrained the header `Select` triggers (`width:auto; max-width:7rem`) and the user-name button (`max-width:8rem` + ellipsis) within `.actions`. Live check at 390px: `documentElement.scrollWidth === innerWidth` (no overflow) in both themes; "Operator" fully visible (was clipping per the spike).

**i18n**
- Added `navigation.labels` (dashboard/transactions/categories/settings) and `navigation.actions` (openMenu/closeMenu/primaryNav — `primaryNav` is the nav-landmark aria-label) to both `en` and `uk`, real Ukrainian. `pnpm i18n:parity` green.

**Tests (NFR1)** — `AppNav.test.tsx`: open via hamburger (drawer + backdrop present), close via destination select, close via backdrop click, close via Escape, both nav variants in the DOM, active link `aria-current="page"`. `AppShell.test.tsx`: in-app nav renders only when signed-in (gated on `userName`) and only when `navItems` non-empty.

**Visual QA (Story 1.9 protocol) — screenshots in `visual-qa/4-1-mobile-navigation/`:**
- `mobile-light-closed.png` / `mobile-dark-closed.png` — 390px header fits, hamburger present, no overflow (verified `scrollWidth === innerWidth`).
- `mobile-light-open.png` / `mobile-dark-open.png` — drawer slid in, dimmed backdrop, 4 destinations with icons, **Dashboard active-highlighted**, close (X) button.
- `desktop-light.png` / `desktop-dark.png` — horizontal in-app nav (Dashboard active), no hamburger/drawer, existing chrome (Money Tracker tool nav, theme/locale switchers, user menu) preserved — no regression.
- Live verify: clicking desktop links moves the path + `aria-current` (Dashboard→Transactions→Categories→Settings); Ukrainian locale renders translated labels and routes with `/uk/...` prefix; mobile drawer closes on destination select. No redirect loops.

### File List

> The interim `app-nav/` from the first pass was removed in the course correction and replaced by `app-sidebar/` + `sidebar-provider/` + `AppTopbar`.

**New**
- `packages/shell/src/components/app-shell/types.ts`
- `packages/shell/src/components/app-shell/use-drawer-escape-close.ts`
- `packages/shell/src/components/app-shell/AppTopbar.tsx`
- `packages/shell/src/components/app-shell/AppTopbar.module.scss`
- `packages/shell/src/components/sidebar-provider/SidebarProvider.tsx`
- `packages/shell/src/components/app-sidebar/AppSidebar.tsx`
- `packages/shell/src/components/app-sidebar/AppSidebar.module.scss`
- `packages/shell/src/components/app-sidebar/AppSidebar.test.tsx`
- `packages/shell/src/components/app-sidebar/SidebarNavLink.tsx`
- `packages/shell/src/components/user-menu/use-theme-radio.ts`
- `packages/shell/src/components/user-menu/use-locale-radio.ts`
- `_bmad-output/implementation-artifacts/visual-qa/4-1-mobile-navigation/` (screenshots; `v2-*` = course-correction)

**Modified**
- `packages/shell/src/components/app-shell/AppShell.tsx`
- `packages/shell/src/components/app-shell/AppShell.module.scss`
- `packages/shell/src/components/app-shell/AppShell.test.tsx`
- `packages/shell/src/components/user-menu/UserMenu.tsx`
- `packages/shell/src/components/user-menu/UserMenu.test.tsx`
- `packages/ui/src/components/molecules/dropdown-menu/DropdownMenu.tsx`
- `packages/ui/src/components/molecules/dropdown-menu/DropdownMenu.module.scss`
- `packages/shell/package.json`
- `apps/money-tracker/package.json`
- `apps/money-tracker/src/app/[locale]/AppShellSection.tsx`
- `apps/money-tracker/src/constants/routes.ts`
- `apps/money-tracker/messages/en/navigation.json`
- `apps/money-tracker/messages/uk/navigation.json`
- `pnpm-lock.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Removed**
- `packages/shell/src/components/app-nav/` (interim AppNav — superseded by AppSidebar)

### Change Log

| Date | Change |
|---|---|
| 2026-06-16 | Implemented Story 4.1 — responsive in-app nav (`AppNav`): mobile drawer + dimmed backdrop + hamburger, desktop horizontal nav, auth-gated via `navItems` prop; fixed 390px header overflow; i18n (en+uk); tests; visual QA evidence. Status → review. |
| 2026-06-16 | Course correction (product-owner direction): pivoted to reference-style **persistent collapsible left sidebar** that becomes the mobile drawer (`AppSidebar` + `SidebarProvider` + `AppTopbar`), added **Transactions submenu scaffolding** (By date live; By category / Recurring / Import disabled placeholders for Epics 5–6), and relocated **Theme + Locale into the user menu** (inline radio groups via extended `DropdownMenu`) to fix the 390px header crowding. Removed interim `AppNav`. Re-ran tests + visual QA (`v2-*`). |

### Completion Notes (course correction)

- **Desktop sidebar**: persistent collapsible left rail (sticky, 256px → icon rail at `--spacing-16`), brand = `ToolNav` (tool-registry mechanism preserved); collapse is **CSS-only at `media-l`** (labels/chevron/submenu always in DOM, hidden via `.collapsed` media query) so a stale collapsed state never breaks the mobile drawer.
- **Mobile**: same component slides in as a drawer + dimmed backdrop, opened by the `AppTopbar` hamburger; closes on select / backdrop / Escape (shared `useDrawerEscapeClose`).
- **Submenu**: `NavItem.children` + `disabled`; Transactions auto-expands when a child route is active; disabled placeholders render as `aria-disabled` non-links (no 404s).
- **Switcher relocation** (fixes the reported 390px overflow): chose inline radio groups over flyout submenus because side-flyouts overflow at 390px. Verified live: `documentElement.scrollWidth === innerWidth` at 390px; header = hamburger + user menu only. Unauthed pages keep a chrome-light header with the standalone Theme/Locale switchers.
- **ui**: extended `DropdownMenu` with `Label` / `Separator` / `RadioGroup` / `RadioItem` (Radix passthrough, design-token styled).
- **Tests**: `AppSidebar.test` (leaf links vs parent toggles, submenu expand, disabled placeholder is non-link, active `aria-current`, default-open on active child, collapse keeps accessible names); `AppShell.test` (authed sidebar vs unauthed switcher-header gating, drawer open/backdrop/Escape/select-close); `UserMenu.test` (theme + locale radio groups, settings/sign-out). Suites: shell 24, ui 77, money-tracker 138 — all green; full type-check 9/9, lint 0, stylelint 0, i18n parity green, builds pass.
- **Visual QA (`v2-*` in `visual-qa/4-1-mobile-navigation/`)**: desktop light expanded/submenu/collapsed/user-menu, desktop dark submenu, mobile light closed (no overflow) + drawer (submenu, active By date, dimmed placeholders), mobile dark drawer. Live-verified against reference (:3010): sidebar + avatar-style menu, no header switchers.
