---
baseline_commit: bf15ed4b30ed2a98bd7ec892a0700700f2ffddf1
---

# Story 1.4: Money Tracker Shell, Design System & i18n Foundation

Status: done

<!-- context-engine: exhaustive analysis of epics.md, architecture.md (D5, D9, patterns, boundaries, tree, version table), story 1.3 record + review findings, deferred-work.md, live repo state (turbo graph, CI reserved slot, config packages, shared/next-shared end state, api env/prefix), .claude/rules conflict audit, example/track-my-life blueprint survey, and web verification of Next 16 proxy.ts / next-intl 4.13 / Storybook 10.4.x / Radix versions completed 2026-06-12 -->

## Story

As Oleksii,
I want to open Money Tracker in English or Ukrainian and see the platform shell,
so that the platform frame (navigation, locale, design system) exists for every feature that follows.

## Acceptance Criteria

1. **Given** the dev stack running, **when** I open the money-tracker app, **then** it renders inside `AppShell` from `packages/shell` — tool navigation driven by the `tools.ts` registry in `packages/shared` (one Money Tracker entry), user-menu placeholder, and locale switcher (FR3).
2. **Given** the tool registry, **when** a second tool entry is added to `tools.ts`, **then** shell navigation renders it with zero changes to `packages/shell` source (FR4 registry mechanism in place).
3. **Given** the locale switcher, **when** I switch between EN and UK, **then** every visible string changes (next-intl, `app/[locale]` routing, ICU interpolation — no concatenation) and the choice persists across reloads (cookie; per-user persistence arrives with profile, FR19).
4. **Given** `packages/ui`, **when** Storybook runs, **then** the initial framework-pure primitives (button, input, select, dialog, table) render with SCSS + stylelint and shared responsive breakpoint mixins (NFR7, NFR8 foundation).
5. **Given** a translation key present in `en.json` but missing from `uk.json` (or vice versa), **when** CI runs, **then** the i18n key-parity job fails the pipeline (FR20 — custom parity script, EN as reference locale).
6. **Given** the shell components, **when** `turbo run test` executes, **then** @testing-library/react component tests cover navigation rendering and locale switching (NFR1).

## Tasks / Subtasks

- [x] Task 1: Locale constants + tool registry in `packages/shared` (AC: 1, 2, 3)
  - [x] `packages/shared/src/constants/locales.ts`: `LOCALE_CODE` as-const object (`En: 'en'`, `Uk: 'uk'` — PascalCase keys mirroring `ErrorCode` style), `LOCALE_CODE_LIST` from `Object.values`, `LocaleCode` union via `ObjectValuesUnion`, `DEFAULT_LOCALE = LOCALE_CODE.En`
  - [x] `packages/shared/src/constants/tools.ts`: `ToolRegistryEntry` type (`id`, `nameKey`, `path` — no `icon` field yet, add it when a second tool needs one) + `TOOL_LIST` with the single entry `{ id: 'money-tracker', nameKey: 'shell.tools.moneyTracker', path: '/' }`. Type and constant co-located (no barrels, deep imports only)
  - [x] `pnpm build --filter @supertool/shared` green; shared deliberately still has NO test script (constants only)
- [x] Task 2: tsconfig flavors + `next-shared` conversion + i18n routing/navigation (AC: 3)
  - [x] Reshape `packages/typescript-config/react-library.json` (this story is its FIRST consumer): `module: "ESNext"`, `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, `noEmit: true` on top of base.json. If tsc rejects inherited `declaration`/`declarationMap` alongside `noEmit`, set both `false` here (and check `nextjs.json` for the same conflict — it also gains its first consumer in Task 5)
  - [x] Convert `packages/next-shared` to a source-consumed package (see Dev Notes "Source-consumption model" — BINDING): delete the `build` script, delete the `exports` map entirely (subpaths then resolve as plain files: `@supertool/next-shared/src/...`), keep `type-check`/`lint`/`test`/`test:watch`; tsconfig now extends `react-library.json` (keep `"types": ["node"]`, keep `include: ["src"]`, drop `outDir`/`rootDir` — nothing emits). Existing client-factory tests must stay green unchanged
  - [x] next-shared deps: peerDependencies `next` 16.2.7, `next-intl` 4.13.0, `react` 19.2.7, `react-dom` 19.2.7 (exact); same exact versions in devDependencies for local type-check/test, plus `@types/react` (npm-latest 19.x exact, record pin). Watch for the pnpm CLI bug from 1.3 — edit package.json manually + `pnpm install` if `pnpm add --filter` crashes
  - [x] `packages/next-shared/src/i18n/routing.ts`: `defineRouting` from `next-intl/routing` — `locales: LOCALE_CODE_LIST`, `defaultLocale: DEFAULT_LOCALE` (from `@supertool/shared/constants/locales`), `localePrefix: 'as-needed'`. Do NOT set `localeDetection: false` — see Dev Notes "Locale persistence"
  - [x] `packages/next-shared/src/i18n/navigation/navigation.ts`: `createNavigation(routing)` exporting `Link`, `redirect`, `usePathname`, `useRouter` — this exact path is referenced by `.claude/rules/react.md`
  - [x] `packages/next-shared/src/i18n/navigation/navigation-link.tsx`: `'use client'` `NavigationLink` wrapping `Link` with active-state tracking (`usePathname` comparison → `aria-current="page"` + an `active` class hook) — the component `.claude/rules/react.md` mandates for nav links
  - [x] `src/i18n/routing.test.ts` (node env, no new test deps): locales/defaultLocale derive from the shared constants; NavigationLink behavior is covered transitively by shell tests in Task 4
- [x] Task 3: `packages/ui` — framework-pure design system (AC: 4)
  - [x] Scaffold `@supertool/ui`: source-consumed (no `build` script, no `exports` map); scripts `type-check` (tsc --noEmit, extends react-library.json), `lint`, `lint:fix`, `test` (vitest run), `test:watch`; `.oxlintrc.json` extends `../../packages/lint-config/configs/library.json` (the React-flavored config reserved for this package since 1.3)
  - [x] Deps: peerDependencies `react`/`react-dom` 19.2.7; dependencies `clsx`, `@radix-ui/react-select` (2.3.0 at research time), `@radix-ui/react-dialog` (1.1.15) — pin npm-latest exact at implementation, record in Dev Agent Record (architecture sanctions "Radix-based ui"; use individual packages, not the unified `radix-ui` bundle — only two primitives need it); devDependencies: `sass` 1.100.0, `typescript` 6.0.3, `oxlint` 1.69.0, `vitest` 4.1.8, `@testing-library/react` 16.3.2, `jsdom` (npm-latest exact), `@types/react`/`@types/react-dom` (19.x exact)
  - [x] `src/styles/`: `_breakpoints.scss` (`$breakpoint-s: 390px`, `m: 768px`, `l: 1024px`, `xl: 1440px` + `media-s/m/l/xl` min-width mixins — mobile-first per .claude/rules/styles.md), `_mixins.scss` (`hover` mixin gated on `@media (hover: hover)`), `_normalize.scss` (minimal reset), `tokens/_palette.scss` + `tokens/_metrics.scss` (CSS custom properties only — colors, spacing scale, radius, font stack; no SCSS runtime vars), `index.scss` (@use normalize + tokens; the single file apps import once)
  - [x] `src/lib/utils.ts`: `cn` class-composition util wrapping `clsx` (`.claude/rules/react.md` mandates this path; also the sanctioned escape from the `no-ternary` lint rule for class logic)
  - [x] `src/global.d.ts`: declare `*.module.scss` as `Record<string, string>`
  - [x] Components — kebab-case files ALWAYS (see Dev Notes "Filename-casing conflict"): `src/components/button/button.tsx` + `button.module.scss`, `input/input.tsx`, `select/select.tsx` (wraps @radix-ui/react-select), `dialog/dialog.tsx` (wraps @radix-ui/react-dialog), `table/table.tsx` (semantic table elements). Pattern: PascalCase named export, `variant`/`size` props where meaningful, camelCase SCSS class names (stylelint-enforced), mobile-first styles, breakpoint mixins used bare (`@include media-m`) — they arrive via injection, do NOT `@use` breakpoints/mixins inside component SCSS (see Dev Notes "SCSS strategy")
  - [x] Vitest config (jsdom env, `*.test.tsx`); smoke tests: `button.test.tsx` (renders children, disabled state, role), `dialog.test.tsx` (opens on trigger interaction). Don't assert CSS-module class names (vitest stubs CSS imports)
  - [x] `pnpm stylelint` green at root (first real SCSS in the repo — property-order groups + camelCase class rules now actually bite)
- [x] Task 4: `packages/shell` — AppShell, tool nav, user-menu placeholder, locale switcher (AC: 1, 2, 6)
  - [x] Scaffold `@supertool/shell`: source-consumed, same script/config shape as `ui`; dependencies `@supertool/shared`, `@supertool/ui`, `@supertool/next-shared` (workspace:*); peerDependencies `react`/`react-dom` 19.2.7 + `next-intl` 4.13.0 (shell sits ABOVE next-shared in the dependency direction — it may use next-intl and next-shared navigation; it must never import from tool apps); devDeps: testing stack as in `ui` + `next-intl` for test rendering
  - [x] `src/components/app-shell/app-shell.tsx`: layout chrome — header (tool nav + locale switcher + user menu), `<main>{children}</main>`. Takes `tools: ToolRegistryEntry[]` as a PROP (see Dev Notes "Registry is prop-driven") — shell knows nothing about specific tools
  - [x] `src/components/tool-nav/tool-nav.tsx`: maps entries → `NavigationLink` (from next-shared), labels via `useTranslations` resolving each entry's `nameKey` — ICU interpolation, zero hardcoded strings
  - [x] `src/components/user-menu/user-menu.tsx`: localized placeholder only (e.g. disabled trigger with `shell.userMenu.*` label) — real menu, name, sign-out arrive with auth in Story 1.5
  - [x] `src/components/locale-switcher/locale-switcher.tsx`: `'use client'`; reads `useLocale()`, offers EN/UK (from `LOCALE_CODE_LIST`), switches via `useRouter().replace(pathname, { locale })` from next-shared navigation; build it on the `ui` select primitive
  - [x] Tests (AC 6 contract): `app-shell.test.tsx` — render with a TWO-entry tools fixture inside `NextIntlClientProvider` (inline test messages), assert both nav items render (this IS the AC-2 proof: second entry renders with zero shell changes, by construction; do NOT commit a second entry to `tools.ts`); `locale-switcher.test.tsx` — `vi.mock` the next-shared navigation module, interact with the switcher, assert `replace` called with `{ locale: 'uk' }`
- [x] Task 5: `apps/money-tracker` — Next.js 16 app wired to everything (AC: 1, 3)
  - [x] Scaffold `@supertool/money-tracker`: dependencies `next` 16.2.7, `react`/`react-dom` 19.2.7, `next-intl` 4.13.0, `zod` 4.4.3, `@supertool/{shared,next-shared,ui,shell}` workspace:*; devDeps `sass` 1.100.0, `typescript` 6.0.3, `oxlint` 1.69.0, `@types/react`/`@types/react-dom` (19.x exact), `@types/node` 22.19.20 (22.x-line precedent, NOT npm-latest). Scripts: `dev` (`next dev --port 3000`), `build`, `start`, `lint`, `lint:fix`, `type-check`. NO test script this story — the app has no logic yet; AC-6 tests live in shell/ui (an empty vitest run would fail CI; the script lands in 1.5 with the first app logic)
  - [x] tsconfig extends `@supertool/typescript-config/nextjs.json` (first consumer — apply the declaration/noEmit fix from Task 2 if needed); include `next-env.d.ts`, `src`, `.next/types`; `next-env.d.ts` is gitignored (Next.js default) and auto-regenerated on `next dev`/`next build`, so it is NOT committed — the `include` entry is a no-op when the file is absent and tsc resolves Next types from the `next` package; no path aliases (deep relative imports, TS 6 has no `baseUrl`)
  - [x] `.oxlintrc.json` extends `../../packages/lint-config/configs/next.json`
  - [x] `src/env.ts`: zod-validated `API_URL` with `.default('http://localhost:3001')` (api listens on 3001, global prefix `api` + URI version v1 — verified live); `.env.example` committed with `API_URL=http://localhost:3001`
  - [x] `next.config.ts`: wrap with `createNextIntlPlugin` (request config default path `src/i18n/request.ts`); `transpilePackages: ['@supertool/ui', '@supertool/shell', '@supertool/next-shared']`; `rewrites()` → `{ source: '/api/:path*', destination: \`${env.API_URL}/api/:path*\` }` (D5 browser-proxy half, deferred here from 1.3 — nothing calls it yet; auth in 1.5 is its first consumer); `sassOptions` with `additionalData` injecting `@use` of ui's breakpoints + mixins (see Dev Notes "SCSS strategy" incl. the Turbopack contingency)
  - [x] `src/proxy.ts` — Next 16 renamed middleware.ts → proxy.ts (architecture tree's `middleware.ts` label predates Next 16; proxy.ts is the documented variance): `export default createMiddleware(routing)` from `next-intl/middleware` + `config.matcher` excluding `/api`, `_next`, and dotted static paths (`'/((?!api|_next|.*\\..*).*)'`) — the matcher MUST NOT intercept `/api/*` or the rewrite proxy breaks
  - [x] `messages/en.json` + `messages/uk.json` (app root, per architecture tree): nested camelCase keys — `shell.tools.moneyTracker`, `shell.userMenu.*`, `shell.localeSwitcher.*`, `home.*`; every key in BOTH files in the same commit (FR19/FR20 — this story is where the both-locales rule first binds); real Ukrainian translations, not transliterated English
  - [x] `src/i18n/request.ts`: `getRequestConfig` — `await requestLocale`, validate with `hasLocale(routing.locales, ...)`, fall back to `routing.defaultLocale`, dynamic-import `../../messages/${locale}.json`
  - [x] `src/app/[locale]/layout.tsx` (root layout): `setRequestLocale`, `<html lang={locale}>`, `NextIntlClientProvider`, import `@supertool/ui/src/styles/index.scss`, render `AppShell` passing `TOOL_LIST` from `@supertool/shared/constants/tools`; `src/app/[locale]/page.tsx`: localized home placeholder (`home.title` heading via `useTranslations` + `setRequestLocale`) — params are async (`await props.params`)
  - [x] turbo.json: add `"dependsOn": ["^build"]` to the `dev` task (money-tracker imports `@supertool/shared` dist — without the edge, cold `pnpm dev` fails on missing dist)
  - [x] Manual verification (the AC-1/AC-3 walkthrough): `pnpm dev` → http://localhost:3000 renders AppShell (nav entry, user-menu placeholder, switcher) → switch to UK → every string changes, URL gains `/uk` → full reload on the bare root → UK still active (NEXT_LOCALE cookie)
- [x] Task 6: `apps/storybook` — component playground (AC: 4)
  - [x] Scaffold `@supertool/storybook`: devDeps `storybook`, `@storybook/react-vite`, `@storybook/addon-docs`, `@storybook/addon-a11y` (ALL the same exact version — ~10.4.x at research time; pin npm-latest exact at implementation, record), `vite` (7.x exact), `sass` 1.100.0, `react`/`react-dom` 19.2.7, `@supertool/ui` workspace:*, `typescript`, `oxlint` (.oxlintrc extends library.json), `@types/react`/`@types/react-dom`; tsconfig extends react-library.json
  - [x] `.storybook/main.ts`: `stories: ['../src/stories/**/*.stories.tsx']`, framework `@storybook/react-vite`, `viteFinal` adding `css.preprocessorOptions.scss.additionalData` MIRRORING the next.config injection exactly (both consumers compile ui SCSS — they must agree); `.storybook/preview.ts`: import `@supertool/ui/src/styles/index.scss`
  - [x] `src/stories/`: one story file per primitive (button, input, select, dialog, table) — CSF3, `Meta`/`StoryObj`, `tags: ['autodocs']`, `parameters: { layout: 'centered' }`, `useState` wrapper components for interactive stories (select/dialog) per `.claude/rules/storybook.md`
  - [x] Scripts: `dev` (`storybook dev -p 6006 --no-open`), `build` (`storybook build` — `storybook-static/**` is already in turbo build outputs since 1.1), `lint`, `type-check`; `turbo run build --filter @supertool/storybook` green and all five primitives render in `pnpm dev`
- [x] Task 7: i18n key-parity gate (AC: 5)
  - [x] `scripts/check-i18n-parity.mjs` (root `scripts/` dir; plain Node, zero deps; `**/*.mjs` is already oxlint-ignored): discover every `messages/` dir under `apps/*` and `packages/*`; per dir, flatten nested keys to dot-paths with `en.json` as reference; report missing AND extra keys per non-EN locale file (uk.json), fail if uk.json is absent entirely; exit non-zero on any gap with a readable per-file report
  - [x] Root package.json script `"i18n:parity": "node scripts/check-i18n-parity.mjs"`
  - [x] New `i18n-parity` job in `.github/workflows/ci.yml`: `needs: [init-env]` → checkout → `./.github/actions/setup-pnpm-node-deps` (same shape as sibling jobs) → `pnpm i18n:parity`; delete the now-fully-consumed reserved-slots comment block (`i18n-parity` was its last entry)
  - [x] Prove the gate locally both directions: temporarily delete one `uk.json` key → exits 1 naming the key; add an extra `uk.json`-only key → exits 1; restore → exits 0 (also proved: uk.json absent entirely → exits 1)
- [x] Task 8: Final verification + hygiene (AC: all)
  - [x] Root gates all green: `pnpm lint`, `pnpm fmt:check`, `pnpm type-check`, `pnpm stylelint`, `pnpm test`, `pnpm build`, `pnpm i18n:parity`
  - [x] Drift gate untouched by construction (no API change → openapi.json identical → `pnpm turbo run generate:client` leaves git status clean) — verify once
  - [x] Hygiene greps: no `^`/`~` in any new package.json; no eslint/prettier; nothing imported from `example/`; no hand-written `fetch` to `/api/*` (NFR6); no PascalCase filenames (`find apps packages -name '[A-Z]*.tsx' -o -name '[A-Z]*.scss'` ignoring node_modules/dist returns nothing); every user-facing string present in both locale files
  - [x] Align the stale PascalCase filename examples in `.claude/rules/react.md` ("Component Structure" block) and `.claude/rules/styles.md` (`ComponentName.module.scss`) with the kebab-case reality (`my-component/my-component.tsx`, `component-name.module.scss`) so future agents stop tripping on the conflict
  - [x] Update sprint-status.yaml on status transitions; branch `TOOLS-1-4/money-tracker-shell-design-system-i18n`, conventional commits, PR via `create-pr` skill — never commit to main (PR opens after local code review passes, per workflow)

## Dev Notes

### Critical scope boundary

This story creates **the frontend frame only**: `packages/ui`, `packages/shell`, `apps/money-tracker` (one localized home page), `apps/storybook`, the tools registry + locale constants in `shared`, i18n routing in `next-shared`, and the parity gate. Do NOT create: `packages/widgets`, anything better-auth/sign-in/sign-up, a real user menu (placeholder only), auth redirect logic in proxy.ts (1.5); settings/transactions/dashboard routes (1.6 / Epic 2+); docker web/api compose services (1.7); per-user locale persistence (rides on the profile, 1.6); dark-mode/theming, toasts, icon libraries, charting (not ACs — each would be an unsanctioned new dependency). The `/api/*` rewrite IS in scope (1.3 explicitly deferred it here) but no code calls through it yet — do not add data fetching to prove it. No API/DTO changes of any kind: `openapi.json` and the generated client must come out byte-identical.

### Repo state you are starting from (Story 1.3 end state)

- Workspace: root + 3 config packages + `apps/api` + `packages/shared` (CJS dist-built, wildcard `./*` → dist exports, committed generated client) + `packages/next-shared` (CJS dist-built, only the two client factories + tests). **No frontend app or React package exists; this story writes the repo's first JSX and first SCSS.**
- `packages/typescript-config`: `base.json` (NodeNext, strict, declaration on) consumed everywhere; **`nextjs.json` and `react-library.json` exist but have ZERO consumers** — Task 2/5 reshape them freely without regression risk.
- `packages/lint-config` configs: `base.json` (note: `oxc/no-barrel-file` error, `no-ternary` on, `unicorn/filename-case` kebab-case error), `library.json` (React + react-hooks — reserved for ui/shell since 1.3), `next.json` (adds nextjs plugin rules), `nest.json` (api). Packages extend by RELATIVE path (`../../packages/lint-config/configs/...`).
- Root stylelint already globs `**/*.{css,scss}` with `--allow-empty-input` — the first `.scss` files automatically come under stylelint-config (camelCase classes, semantic property-order groups). No per-package stylelint scripts needed.
- turbo.json tasks: `build` (outputs already include `.next/**` and `storybook-static/**` — 1.1 anticipated this story), `test`→`^build`, `generate:client`, `dev` (cache:false, persistent, **no dependsOn yet** — Task 5 adds `^build`). CI jobs: init-env → lint / fmt-check / type-check (`pnpm build:packages` first) / stylelint / build / test / client-drift. Reserved-slot comment block at the top of ci.yml now lists ONLY `i18n-parity (Story 1.4 — locale key parity, FR20)`.
- api: PORT defaults 3001, `setGlobalPrefix('api')` + URI version v1 — rewrite destination is `${API_URL}/api/:path*`.
- `.lintstagedrc.mjs` filters `packages/shared/src/generated/` out of staged-file commands — leave intact.
- Node 22.15.0 / pnpm 11.5.2. `pnpm-workspace.yaml` carries `minimumReleaseAgeExclude` entries — pnpm 11's release-age guard may BLOCK very fresh releases (Storybook 10.4.x patches are days old). If install refuses a pin, either pin the newest version old enough to pass or add an exclude entry — record whichever you do in Dev Agent Record.

### Source-consumption model (BINDING for ui, shell, next-shared)

`packages/ui`, `packages/shell`, and (converted by Task 2) `packages/next-shared` ship **no build step and no exports map**: consumers import full source paths — `@supertool/ui/src/components/button/button`, `@supertool/next-shared/src/i18n/navigation/navigation`. The Next app compiles them via `transpilePackages`; Storybook's Vite resolves workspace sources natively; package-local vitest runs on source. This is the blueprint pattern and exactly the import shape `.claude/rules/react.md` documents.

Why not extend 1.3's CJS-dist pattern: SCSS modules and `'use client'` JSX must be compiled by the consuming bundler, not tsc; and tsc-compiled CJS importing `next-intl`/`next` (ESM-leaning) under NodeNext is a type-resolution minefield. The 1.3 dev notes explicitly anticipated this package gaining Next-specific code in 1.4. **`packages/shared` keeps its dist build** — `apps/api` requires CJS output at runtime; nothing changes there beyond two new constants files.

Consequence: these three packages type-check under the bundler-flavored `react-library.json` (Task 2), and turbo simply skips `build` for them (script-presence-driven). The CI `test` job keeps working because `test`→`^build` still builds `shared` first.

### Filename-casing conflict (resolved — kebab-case wins)

`.claude/rules/react.md` ("Component Structure": `MyComponent.tsx`), `.claude/rules/styles.md` (`ComponentName.module.scss`) carry PascalCase examples from the example repo. They are OVERRIDDEN by architecture.md Naming Patterns ("kebab-case always — no PascalCase filenames anywhere"), CLAUDE.md, and mechanically by `unicorn/filename-case` (error). Correct shape: `components/locale-switcher/locale-switcher.tsx` + `locale-switcher.module.scss` exporting `LocaleSwitcher`. Follow the rules files for everything else (dir-per-component, optional `types.ts`/`constants.ts`/`hooks/`/`components/` subfolders, `on*` props / `handle*` handlers, `cn` for class logic). Task 8 fixes the two stale examples.

### Registry is prop-driven

`AppShell` accepts `tools: ToolRegistryEntry[]`; the app layout passes `TOOL_LIST` from `@supertool/shared/constants/tools`. This satisfies FR4's walkthrough (adding tool #2 = one `tools.ts` entry; the app already passes the whole list; zero shell diffs) while keeping shell testable with fixtures and free of data coupling. The AC-2 proof is the two-entry fixture test — do not commit a second registry entry.

### i18n message architecture

- Messages live **per app only** in this story: `apps/money-tracker/messages/{en,uk}.json` (app root, single file per locale, per the architecture tree). Shell/ui ship NO message files — shell components read namespaced keys (`shell.*`) from the app-provided next-intl context. When tool app #2 arrives, its scaffold supplies its own `shell.*` keys; if that duplication ever hurts, lifting shell messages into the package is a future, additive change.
- Keys: nested camelCase by feature (`shell.localeSwitcher.label`), ICU interpolation only — string concatenation for sentences is a defect. EN is the parity reference.
- The parity script scans ALL `messages/` dirs under `apps/*` and `packages/*` so future per-package message files are automatically gated.

### Locale persistence (deliberate divergence from the blueprint)

The example app sets `localeDetection: false`; **do not copy that** — with detection off, next-intl ignores its locale cookie and AC 3's "persists across reloads" fails for unprefixed URLs. Use `localePrefix: 'as-needed'` + default detection + default `localeCookie` (NEXT_LOCALE): the switcher calls `router.replace(pathname, { locale })`, the proxy persists the cookie, and a later visit to the bare root resolves to the stored locale. Side effect to accept: first-ever visit may negotiate from `Accept-Language`. Per-user (DB) persistence explicitly arrives with the profile in 1.6.

### SCSS strategy

- Breakpoint/hover mixins are injected via `additionalData` (`@use '@supertool/ui/src/styles/breakpoints' as *;` + mixins) in BOTH `next.config.ts` `sassOptions` and Storybook's `viteFinal` — keep the two injection strings identical. Component/app SCSS then uses `@include media-m` bare and must NOT also `@use` those modules (Sass errors on duplicate/`@use`-after-rules).
- Design tokens are CSS custom properties defined in `ui/src/styles/tokens/`, pulled in once via `index.scss` per consuming app — no SCSS variables at runtime, components reference `var(--...)`.
- **Turbopack contingency**: `next dev` on Next 16 defaults to Turbopack. If it rejects `sassOptions.additionalData`/`loadPaths`, fall back in the SAME commit to explicit relative `@use` statements at the top of each SCSS file (ui-internal: relative paths; app: package path) and remove BOTH injections — never leave Next and Storybook disagreeing. Record which path shipped.
- vitest stubs CSS imports — never assert class names in component tests; assert roles/text/attributes.

### Architecture compliance (binding for this story)

- **D5 (browser half):** `/api/:path*` rewrite to `API_URL` origin lives in the tool app's next.config — wired here, consumed first by 1.5 [architecture.md#Authentication-&-Security; 1.3 scope note]
- **D9:** no global state library; URL/searchParams own routable state (the locale lives in the URL/cookie via next-intl); react-hook-form/zod forms arrive with real forms in 1.5+ [architecture.md#Frontend-Architecture]
- **Boundaries:** `ui` is framework-pure — React only, NO next-intl/next/API imports (labels arrive via props/children); `shell` consumes ui + registry + next-shared navigation + next-intl, never tool apps; dependency direction `shared` → `ui` → `shell` → apps holds [architecture.md#Architectural-Boundaries]
- **i18n format rules:** message files per locale, nested camelCase keys, ICU interpolation, EN reference for parity [architecture.md#Format-Patterns]
- **FR19/FR20 now BIND for the first time:** every user-facing string added by this story lands in `en.json` AND `uk.json` in the same commit — the new CI gate enforces it from this PR onward
- **Naming:** kebab-case files; PascalCase component exports; camelCase SCSS classes; constants UPPER_SNAKE_CASE (`LOCALE_CODE`, `TOOL_LIST`); no TS enums — as-const + `ObjectValuesUnion` (.claude/rules/typescript.md); verb-first functions, `check*` predicates
- **Tests ship with the story (NFR1):** shell nav + locale-switcher tests (the AC-6 contract) + ui smoke tests + routing config test; `*.test.ts(x)` suffix in packages (api keeps `*.spec.ts`)
- **New-dependency rule:** Radix primitives + Storybook + clsx/jsdom/vite are sanctioned by architecture (ui "Radix-based", NFR7 Storybook, D10 toolchain); their exact pins are NOT in the version table — record every pin in Dev Agent Record (1.2/1.3 precedent). Architecture-pinned versions are binding: next 16.2.7, react/react-dom 19.2.7, next-intl 4.13.0 (re-verified npm-latest 2026-06-12), sass 1.100.0, zod 4.4.3, vitest 4.1.8, @testing-library/react 16.3.2, typescript 6.0.3, oxlint 1.69.0

### Previous story intelligence (1.3, with 1.1/1.2 carried lessons)

- `pnpm add --filter` intermittently crashes (`undefined is not an object (evaluating 'H.replace')`) — edit package.json manually + `pnpm install`.
- oxlint config `extends` does NOT propagate `env` or `ignorePatterns` — each new package's `.oxlintrc.json` sets its own; root `.oxlintrc.json` owns repo-wide ignores. Package-level lint runs need their own ignores if any (1.3 reconfirmed).
- TS 6: no `baseUrl`; `noUnusedParameters`/`exactOptionalPropertyTypes` are on — React callback props and optional-prop spreading must be written accordingly (`exactOptionalPropertyTypes` bites on `prop={maybeUndefined}` — prefer conditional spreads or explicit `| undefined` prop types).
- `oxc/no-barrel-file` + `unicorn/require-module-specifiers`: no index barrels, no empty placeholder files — every file ships real exports, all imports are deep.
- `no-ternary` is on repo-wide: conditional JSX via `&&`/early returns; class composition via `cn` — this is why the `cn` util lands with `ui`.
- Version-pin precedent: pin exact; if a pin doesn't exist at install time, pin nearest existing and record the deviation.
- Generated-client byte-exactness machinery (`.lintstagedrc.mjs`, ignore patterns) must survive untouched; this story must not regenerate or reformat `packages/shared/src/generated/`.
- The CI `test` job runs bare `pnpm test` — turbo runs only packages WITH a `test` script; forgetting the script silently skips a package's tests in CI (1.3 lesson — applies to ui and shell here).

### Latest tech notes (verified 2026-06-12)

- **Next 16: `middleware.ts` is renamed `proxy.ts`** (runs on Node runtime). next-intl's `createMiddleware` default-export works unchanged inside proxy.ts — only the filename/export convention changed. The architecture tree's `middleware.ts` entry predates Next 16; proxy.ts is the binding form (document as variance, do not "fix" architecture.md mid-story).
- next-intl 4.13.0 (= architecture pin = npm latest): `defineRouting` from `next-intl/routing`, `createNavigation` from `next-intl/navigation`, `getRequestConfig` + `await requestLocale` + `hasLocale`, `setRequestLocale` in every layout/page for static rendering, `NextIntlClientProvider` in the locale layout.
- Storybook 10.4.x current (fast-moving patch line — `@storybook/react-vite` 10.4.2 / core 10.4.4 on 2026-06-12): framework `@storybook/react-vite`, CSF3, addons `addon-docs`/`addon-a11y` versioned in lockstep with core; Vite 7.
- Radix: `@radix-ui/react-select` 2.3.0, `@radix-ui/react-dialog` 1.1.15. A unified `radix-ui` package now exists — deliberately NOT used (two primitives don't justify the surface).
- @testing-library/react 16.3.2 supports React 19; jsdom environment per package vitest config; esbuild picks `jsx: react-jsx` up from tsconfig so no extra vitest React plugin is needed (add `@vitejs/plugin-react` only if JSX transform actually fails, and record it).

### Project Structure Notes

End-state tree delta for THIS story:

```
supertool/
├── turbo.json                          # dev → dependsOn ^build
├── package.json                        # + i18n:parity script
├── scripts/check-i18n-parity.mjs       # NEW — FR20 gate
├── .github/workflows/ci.yml            # + i18n-parity job (reserved-slot block consumed)
├── .claude/rules/{react,styles}.md     # filename examples aligned to kebab-case
├── apps/
│   ├── money-tracker/                  # NEW — @supertool/money-tracker
│   │   ├── package.json  tsconfig.json  .oxlintrc.json  next.config.ts  .env.example  next-env.d.ts
│   │   ├── messages/en.json  messages/uk.json
│   │   └── src/
│   │       ├── env.ts  proxy.ts        # proxy.ts = Next 16 middleware rename
│   │       ├── i18n/request.ts
│   │       └── app/[locale]/layout.tsx  app/[locale]/page.tsx
│   └── storybook/                      # NEW — @supertool/storybook
│       ├── package.json  tsconfig.json  .oxlintrc.json
│       ├── .storybook/main.ts  .storybook/preview.ts
│       └── src/stories/{button,input,select,dialog,table}.stories.tsx
└── packages/
    ├── shared/src/constants/locales.ts  tools.ts        # NEW constants (dist-built as before)
    ├── next-shared/                     # CONVERTED to source-consumed; + i18n/
    │   └── src/i18n/routing.ts (+test)  i18n/navigation/navigation.ts  navigation-link.tsx
    ├── ui/                              # NEW — @supertool/ui (source-consumed)
    │   └── src/  styles/{_breakpoints,_mixins,_normalize,index}.scss + tokens/
    │            lib/utils.ts  global.d.ts
    │            components/{button,input,select,dialog,table}/* (+ module.scss, smoke tests)
    ├── shell/                           # NEW — @supertool/shell (source-consumed)
    │   └── src/components/{app-shell,tool-nav,user-menu,locale-switcher}/* (+ tests)
    └── typescript-config/react-library.json  nextjs.json  # reshaped for first consumers
```

Documented variances vs architecture tree: `proxy.ts` replaces `middleware.ts` (Next 16 rename); `apps/money-tracker` ships only the home route this story (transactions/categories/settings/sign-in arrive with their stories); shell's user menu is a placeholder pending 1.5.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] — story statement + the 6 ACs; FR3/FR4/FR19/FR20 coverage map
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-&-Boundaries] — package boundaries, dependency directions, FR4 zero-diff walkthrough, complete tree
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — naming/format/i18n/process patterns, agent MUSTs
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation] — version table (next 16.2.7, react 19.2.7, next-intl 4.13.0, sass 1.100.0, stylelint 17.13.0)
- [Source: _bmad-output/implementation-artifacts/1-3-openapi-generated-client-pipeline.md] — repo end state, source-consumption rationale inputs, pnpm/oxlint/TS6 lessons, byte-exactness machinery
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — nothing from it lands here; health-status and @ApiResponse items stay deferred (1.7 / 1.5+)
- [Source: .claude/rules/react.md, styles.md, storybook.md, typescript.md, javascript.md] — component/RSC/SCSS/story conventions (filename-casing examples overridden, see Dev Notes)
- [Source: https://nextjs.org/docs/messages/middleware-to-proxy] — Next 16 middleware→proxy rename (verified 2026-06-12)
- [Source: https://next-intl.dev/docs/routing] — 4.13 routing/navigation/request-config API (verified 2026-06-12)
- [Source: https://storybook.js.org/docs/get-started/frameworks/react-vite] — Storybook 10.4.x react-vite setup (verified 2026-06-12)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Debug Log References

- pnpm CLI transient crash `undefined is not an object (evaluating 'H.replace')` hit repeatedly on `pnpm install`/`pnpm --filter` runs — every occurrence resolved by re-running the same pnpm command (1.3 lesson confirmed; affects plain `install` too, not only `pnpm add --filter`)
- `pnpm install` initially exited 1 with `ERR_PNPM_IGNORED_BUILDS` for `@parcel/watcher`/`sharp` (transitive deps of next 16) — resolved via `allowBuilds` decisions in pnpm-workspace.yaml (see notes)
- First `next build` failed under Turbopack: sass `Can't find stylesheet to import` — `sassOptions.includePaths` is not honored; switching to `sassOptions.loadPaths` fixed it (no fallback to per-file `@use` needed)
- `oxlint` rejected `react/prop-types` in lint-config `library.json` (rule does not exist in oxlint 1.69; config had zero consumers before this story) — removed the entry (it was "off", behavior-neutral)
- @testing-library/react auto-cleanup requires `globals: true` in vitest config (first run produced duplicate-element failures across `it` blocks)
- Radix Select interaction in jsdom needs `scrollIntoView`/`hasPointerCapture`/`releasePointerCapture` stubs; opening via `fireEvent.keyDown(trigger, { key: 'Enter' })` + `fireEvent.click(option)` works without extra deps

### Completion Notes List

- All 6 ACs implemented and verified. Full gate suite green: `pnpm lint`, `fmt:check`, `type-check`, `stylelint`, `test` (15 tests across next-shared/ui/shell), `build`, `i18n:parity`; generated-client drift gate verified byte-clean after `pnpm turbo run generate:client`.
- AC-1/AC-3 manual walkthrough performed against `pnpm dev` over HTTP: `/` renders AppShell in EN (nav entry, Account placeholder, Language switcher, `<html lang="en">`); `/uk` renders every string in Ukrainian with `NEXT_LOCALE=uk` cookie set; bare `/` with the uk cookie 307-redirects to `/uk` (persistence across reloads); `/api/v1/health` bypasses the i18n proxy and hits the rewrite (500 against the not-running api, not a locale redirect).
- Version pins recorded (npm-latest exact at implementation): `@radix-ui/react-select` 2.3.0, `@radix-ui/react-dialog` 1.1.16 (story researched 1.1.15; 1.1.16 was npm-latest at implementation), `clsx` 2.1.1, `jsdom` 29.1.1, `@types/react` 19.2.17, `@types/react-dom` 19.2.3, `@testing-library/dom` 10.4.1 (required peer of @testing-library/react 16), `storybook`/`@storybook/react-vite`/`@storybook/addon-docs`/`@storybook/addon-a11y` all 10.4.4 (lockstep), `vite` 7.3.5. Architecture-pinned versions used as-is: next 16.2.7, react/react-dom 19.2.7, next-intl 4.13.0, zod 4.4.3, sass 1.100.0, typescript 6.0.3, oxlint 1.69.0, vitest 4.1.8, @testing-library/react 16.3.2.
- pnpm-workspace.yaml: storybook@10.4.4 packages added to `minimumReleaseAgeExclude` (released 1 day before implementation); `allowBuilds` placeholders resolved to `'@parcel/watcher': false` and `sharp: false` — both ship prebuilt platform binaries as optional deps, their install scripts are native-build fallbacks never needed locally or in CI.
- SCSS injection shipped via `sassOptions.additionalData` + `loadPaths` (`includePaths` is ignored by Turbopack); the identical injection string and loadPaths shape are mirrored in Storybook's `viteFinal` — both consumers compile ui SCSS identically. No per-file `@use` fallback needed.
- TS 6.0.3 accepts inherited `declaration`/`declarationMap` alongside `noEmit: true` — the Task 2/Task 5 contingency fix was not needed in either tsconfig flavor.
- Root `.oxlintrc.json` gained `**/*.mjs` in ignorePatterns: the story's premise that mjs was already root-ignored held only for package-level configs; the parity script otherwise failed root lint (`no-undef: console`).
- Storybook telemetry disabled (`core.disableTelemetry: true`) per the repo's no-external-telemetry constraint (NFR4).
- `t` → `translate` for next-intl hook results: the repo-wide `id-length` lint rule (min 2 chars) rejects the conventional `t`.
- Dialog requires `description` and `closeLabel` props (a11y: Radix description warning avoided; close button label localizable by consumers — ui stays framework-pure with zero hardcoded user-facing strings).
- locale-switcher narrows the Select string value to `LocaleCode` via a local `checkIsLocaleCode` type-guard predicate (no type assertions, satisfies the typed `router.replace` locale param).
- i18n parity gate proven in three failure directions: missing uk key → exit 1 naming the key; extra uk-only key → exit 1; uk.json absent → exit 1; restored → exit 0.

### File List

New:

- apps/money-tracker/.env.example
- apps/money-tracker/.oxlintrc.json
- apps/money-tracker/messages/en.json
- apps/money-tracker/messages/uk.json
- apps/money-tracker/next.config.ts
- apps/money-tracker/package.json
- apps/money-tracker/src/app/[locale]/layout.tsx
- apps/money-tracker/src/app/[locale]/page.tsx
- apps/money-tracker/src/env.ts
- apps/money-tracker/src/i18n/request.ts
- apps/money-tracker/src/proxy.ts
- apps/money-tracker/tsconfig.json
- apps/storybook/.oxlintrc.json
- apps/storybook/.storybook/main.ts
- apps/storybook/.storybook/preview.ts
- apps/storybook/package.json
- apps/storybook/src/global.d.ts
- apps/storybook/src/stories/Button.stories.tsx
- apps/storybook/src/stories/Dialog.stories.tsx
- apps/storybook/src/stories/Input.stories.tsx
- apps/storybook/src/stories/Select.stories.tsx
- apps/storybook/src/stories/Table.stories.tsx
- apps/storybook/tsconfig.json
- packages/next-shared/src/i18n/navigation/NavigationLink.tsx
- packages/next-shared/src/i18n/navigation/navigation.ts
- packages/next-shared/src/i18n/routing.test.ts
- packages/next-shared/src/i18n/routing.ts
- packages/shared/src/constants/locales.ts
- packages/shared/src/constants/tools.ts
- packages/shell/.oxlintrc.json
- packages/shell/package.json
- packages/shell/src/components/app-shell/AppShell.module.scss
- packages/shell/src/components/app-shell/AppShell.test.tsx
- packages/shell/src/components/app-shell/AppShell.tsx
- packages/shell/src/components/locale-switcher/LocaleSwitcher.test.tsx
- packages/shell/src/components/locale-switcher/LocaleSwitcher.tsx
- packages/shell/src/components/tool-nav/ToolNav.module.scss
- packages/shell/src/components/tool-nav/ToolNav.tsx
- packages/shell/src/components/user-menu/UserMenu.tsx
- packages/shell/src/global.d.ts
- packages/shell/tsconfig.json
- packages/shell/vitest.config.ts
- packages/ui/.oxlintrc.json
- packages/ui/package.json
- packages/ui/src/components/button/Button.module.scss
- packages/ui/src/components/button/Button.test.tsx
- packages/ui/src/components/button/Button.tsx
- packages/ui/src/components/dialog/Dialog.module.scss
- packages/ui/src/components/dialog/Dialog.test.tsx
- packages/ui/src/components/dialog/Dialog.tsx
- packages/ui/src/components/input/Input.module.scss
- packages/ui/src/components/input/Input.tsx
- packages/ui/src/components/select/Select.module.scss
- packages/ui/src/components/select/Select.tsx
- packages/ui/src/components/table/Table.module.scss
- packages/ui/src/components/table/Table.tsx
- packages/ui/src/global.d.ts
- packages/ui/src/lib/utils.ts
- packages/ui/src/styles/_breakpoints.scss
- packages/ui/src/styles/_mixins.scss
- packages/ui/src/styles/_normalize.scss
- packages/ui/src/styles/index.scss
- packages/ui/src/styles/tokens/_metrics.scss
- packages/ui/src/styles/tokens/_palette.scss
- packages/ui/tsconfig.json
- packages/ui/vitest.config.ts
- scripts/check-i18n-parity.mjs

Modified:

- .claude/rules/react.md
- CLAUDE.md
- _bmad-output/planning-artifacts/architecture.md
- packages/lint-config/configs/base.json
- .claude/rules/styles.md
- .github/workflows/ci.yml
- .oxlintrc.json
- _bmad-output/implementation-artifacts/1-4-money-tracker-shell-design-system-i18n-foundation.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- package.json
- packages/lint-config/configs/library.json
- packages/next-shared/package.json
- packages/next-shared/tsconfig.json
- packages/typescript-config/react-library.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- turbo.json

Deleted:

- packages/next-shared/tsconfig.test.json

### Review Findings

Code review 2026-06-12 (bmad-code-review: Blind Hunter + Edge Case Hunter + Acceptance Auditor; all root gates green at review time — type-check, oxlint, stylelint, oxfmt, i18n-parity, vitest).

- [x] [Review][Decision→Resolved] `next-env.d.ts` claimed committed but is gitignored and absent from the tree — RESOLVED 2026-06-12 (option b): Task 5 and the File List corrected to note `next-env.d.ts` is gitignored (Next.js default) and auto-regenerated on build, so it is not committed; the `tsconfig.json` `include` entry is a harmless no-op when absent and Next types resolve from the `next` package. No code change.
- [x] [Review][Defer] NavigationLink active-state is exact-match and locale-naive [packages/next-shared/src/i18n/navigation/NavigationLink.tsx:11] — deferred, latent. Correct for the single root tool (`/`) today; `pathname === href` will not set `aria-current` for nested routes or non-default-locale paths once a second tool / sub-routes land (AC-2).
- [x] [Review][Defer] `Select` primitive has no empty-options or unmatched-value affordance [packages/ui/src/components/select/Select.tsx:42] — deferred, latent. No consumer hits it (LocaleSwitcher always has two valid options); a future `optionList={[]}` or controlled `value` absent from options renders a blank trigger with no placeholder/empty state.
- [x] [Review][Defer] `request.ts` dynamic message import has no fallback for a missing locale file [apps/money-tracker/src/i18n/request.ts:17] — deferred, latent. Only en/uk exist today (both present, parity-gated); adding a locale to `LOCALE_CODE_LIST` without a `messages/<x>.json` would throw a runtime module-not-found before the parity gate runs.
- [x] [Review][Defer] i18n-parity script is brittle on empty-object values and malformed JSON [scripts/check-i18n-parity.mjs:34] — deferred, latent. Works correctly for the real (string-leaf) message shape and CI still fails on bad JSON; hardening: record prefix for empty `{}` namespaces and wrap `JSON.parse` to emit the readable per-file report instead of a raw `SyntaxError`.

Dismissed (11): missing `messages` prop on `NextIntlClientProvider` (false positive — next-intl v4 inherits messages from `getRequestConfig` when rendered server-side, verified vs docs); `env.ts` throws on invalid `API_URL` (intentional fail-fast config validation); NavigationLink object-form `href` (registry paths are strings — unreachable); LocaleSwitcher dead defensive guard (type-narrowing only — unreachable); parity array-flatten (messages are not arrays — unreachable); Dialog empty-string title (type contract requires a string; caller misuse); proxy matcher excludes dotted paths (documented standard Next/next-intl middleware matcher); `shell.nav.label` not enumerated in Task 5 (benign correct addition, present in both locales); `page.tsx` `use()` vs `await` for params (compiles & works, cosmetic); two Blind Hunter items self-dismissed.

## Change Log

- 2026-06-12 (post-implementation, user-requested convention change): component files and their co-located `.module.scss`/`.test.tsx`/`.stories.tsx` renamed kebab-case → PascalCase (`Button.tsx`, `AppShell.module.scss`, `Button.stories.tsx`, …; 26 files via `git mv`, dirs stay kebab-case); `unicorn/filename-case` now allows pascalCase alongside kebabCase; naming patterns updated in CLAUDE.md and architecture.md; `.claude/rules/react.md`/`styles.md` examples restored to PascalCase and the NavigationLink path reference updated. All root gates re-verified green.

- 2026-06-12: Story 1.4 implemented — shared locale constants + tool registry; next-shared converted to source-consumed with next-intl routing/navigation (+NavigationLink); new @supertool/ui design system (button, input, select, dialog, table + SCSS tokens/breakpoints/mixins); new @supertool/shell (AppShell, ToolNav, UserMenu placeholder, LocaleSwitcher) with AC-6 tests; new apps/money-tracker (Next 16, app/[locale] routing, proxy.ts, /api rewrite, en/uk messages) and apps/storybook (10.4.4, five primitive stories); i18n key-parity script + CI job; rules-file kebab-case examples aligned. All root gates green; generated client byte-identical.
