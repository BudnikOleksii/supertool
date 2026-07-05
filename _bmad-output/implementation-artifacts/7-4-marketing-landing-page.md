---
baseline_commit: 85badae3c4bba321d2c1f1c1e30db7ca47b6f632
---

# Story 7.4: Marketing Landing Page

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time visitor,
I want a real landing page that explains the product,
so that the platform has a credible public face instead of a bare placeholder (RP-F8 / RP-U6).

## Context & Why This Story

This is the FOURTH story of Epic 7 ("Account & Landing") and the epic's **only new public (unauthenticated) surface** — the first page in the whole product that lives *outside* the auth-gated app (Epic 6 retro: "7-4 marketing landing is a new public (unauthenticated) surface — the first page outside the auth-gated shell; it re-engages the committed-visual-QA + both-locale discipline on new ground, with no reference-parity backend dependency").

Today `/` (`apps/money-tracker/src/app/[locale]/page.tsx`) is a **bare placeholder**: an `<h1>`, a `<p>`, and three in-app links (Open dashboard / Manage categories / View transactions). The reference public log calls this out — supertool today is "bare H1 + 3 links (`42-…`)" vs the reference's real `landing--*` (`40-…`) with hero, advantages, reviews, FAQ, footer. This story **replaces that placeholder** with a real marketing landing page built from the design system.

**This is a UI/content story — NO backend or API change.** No new endpoint, no DTO, no schema, no generated-client regeneration. The OpenAPI drift gate is a **no-op** this story (contrast 7-3, which added `usersDeleteMe` and regenerated the client). No new runtime dependency of any kind.

**Two load-bearing wiring facts the placeholder hides:**

1. **`/` is currently NOT publicly reachable.** `apps/money-tracker/src/proxy.ts` sets `PUBLIC_PATH_LIST = [ROUTES.signIn, ROUTES.signUp]` and redirects every non-public path to sign-in when there is no session cookie. So an **unauthenticated visitor to `/` is bounced to `/sign-in` today** — the placeholder is only ever seen once signed in. The AC "a first-time visitor opens `/` → a real landing renders" therefore **requires making `/` public in the middleware** (D-2). This is the single most important non-obvious task in the story.

2. **supertool has no route groups; the shell is auth-gated inside `AppShell`.** The reference builds the landing in a `(home-layout)` route group with its own layout+footer, separate from `(app-layout)`. supertool deliberately does **not** use route groups (memory: shell-sidebar-layout-decision — "money-tracker shell = reference-style left sidebar … auth-gated in AppShell (no route groups)"). `AppShell` already renders a **plain public header** (ToolNav + ThemeSwitcher + LocaleSwitcher, no sidebar) when `userName === undefined`, and the sidebar app chrome when a name is present. That plain header **is** the landing's public chrome. The landing stays at `[locale]/page.tsx` (D-1).

**Evidence base:** epics.md Story 7.4 (5 BDD AC blocks — real landing at `/` with hero/advantages/(optional)reviews/FAQ/footer + sign-up/sign-in CTAs; working FAQ accordion; theme+locale correct in both; fully responsive mobile; tests + both locales + committed light/dark mobile/desktop screenshots vs reference) + the AC's evidence note ("reference `landing--*`; §5 defects to exceed — sparse, emoji icons, **broken FAQ accordion**; use the design-system primitives incl. the working `accordion` from Story 1.11; protect theme + locale strengths §6"); Epic 7 charter (D1/NFR6/D7/FR19-20/NFR1 binding; per-story mobile-QA); the reference `(home-layout)` landing (HeroSection/AdvantagesSection/ReviewsSection/FaqSection/Footer + `generateMetadata` — shape reference, ED1, never copied); Epic 4 retro D1 (committed-evidence visual QA is the standing pattern for every Epic 5–7 UI story); the working supertool `accordion` molecule (1.11, `ChevronDown` icon + focus/animation — already beats the reference's glyph-chevron, animation-less FAQ).

## Recommended Approach (binding direction)

### Where the landing lives — `/` at `[locale]/page.tsx`, no route group (D-1)

- Replace the placeholder `apps/money-tracker/src/app/[locale]/page.tsx` with the real landing. **No `(home-layout)`/`(marketing)` route group** — supertool's single `[locale]/layout.tsx` + `AppShell` plain header is the public chrome (memory: no route groups). Divergence from the reference's `(home-layout)` layout+footer is intentional and recorded (D-1).
- The landing is a **server component** (RSC by default; NFR / react.md "favor RSC, minimize `'use client'`"). It composes section server components; only the FAQ's `Accordion` (a `'use client'` molecule) crosses the boundary, rendered from a server parent — no new `'use client'` files needed for the page itself.

### Make `/` public + handle authenticated visitors (D-2, D-3)

- **D-2 (required):** in `apps/money-tracker/src/proxy.ts`, add `ROUTES.home` to `PUBLIC_PATH_LIST` so an unauthenticated visitor reaches `/` instead of being redirected to sign-in. `checkIsPublicPath` matches the locale-stripped path against the list, and `getPathnameWithoutLocale` already returns `'/'` for the bare root — so `ROUTES.home` (`'/'`) is the correct entry. Verify live: unauthenticated `GET /` (and `/uk`, `/en`) renders the landing, not a redirect to sign-in.
- **D-3 (authenticated behavior):** in the landing `page.tsx` RSC, call the existing `fetchProfile()` gate; **if a profile is returned (authenticated), `redirect({ href: ROUTES.dashboard, locale })`** (next-intl `redirect` from `@supertool/next-shared/src/i18n/navigation/navigation`). Unauthenticated (`profile === null`) → render the landing. This keeps the marketing page rendering only with the public plain header and sends signed-in users straight into the app. **Divergence flag (D-3):** the reference does NOT redirect (it renders the same landing for everyone, via route groups); supertool redirects because with no route groups an authenticated `/` would wrap the marketing page in the full app sidebar chrome — wrong for a full-bleed landing. Recorded for operator confirmation; the alternative (render for all + a context-aware "Go to app" CTA) was rejected for that chrome reason. Use `fetchProfile` (NFR6 — generated client via the RSC gate), never a hand-written fetch.

### Sections — server components, DS primitives, no prop-drilled translations (D-4, D-5, D-6)

Compose the page (mirror the reference section set; reviews kept — parity + the AC lists it "(optional)"): **Hero → Advantages/Features → Reviews → FAQ → Footer**, each an app-local section component under `apps/money-tracker/src/app/[locale]/components/landing/<section>/`.

- **D-4 (translations, divergence from reference):** the reference fetches `translations` once and **prop-drills a `TranslateFn`** into every section. supertool does **not** — each section is a server component calling `useTranslations(I18N_NAMESPACE.homePage)` directly (i18n.md: "Component usage: `const translate = useTranslations(...)`"; matches every existing supertool page). No `TranslateFn` prop, no `next-shared` translate-fn type. `translate`/`useTranslations` alias — never `t` (id-length lint).
- **D-5 (primitives):** `Typography` (title-xl `tag="h1"` for the single hero heading; `title-l` `tag="h2"` per-section headings; `body-l`/`body-m` copy), `Button` (`component={Link}` for CTAs), `Card`/`CardHeader`/`CardTitle`/`CardContent` (advantage + review cards), `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (FAQ), `Link` from `@supertool/next-shared/src/i18n/navigation/navigation` for CTAs. All from `packages/ui` / `next-shared` — no new components in `packages/ui`, `packages/shell`, `packages/widgets`, or `packages/next-shared`.
- **D-6 (icons — exceed §5):** the reference stores **emoji** in JSON as advantage icons and uses a text-glyph chevron — a §5 defect. supertool uses **`lucide-react` icons** (already a dependency, used in `AppShellSection`) for advantage/feature icons, mapped in a module-level `const` in the section file (NOT stored in i18n JSON — icons are not translatable copy). No emoji in JSON, no new dependency. Decorative icons get `aria-hidden`.

### FAQ — the working accordion, exceeding the reference (D-7)

- Use the supertool `accordion` molecule (`packages/ui/src/components/molecules/accordion/Accordion.tsx`) with `<Accordion type="single" collapsible>` and an `AccordionItem`/`AccordionTrigger`/`AccordionContent` per FAQ entry, mapping a module-level `FAQ_KEY_LIST` (`['q1','q2','q3','q4','q5']`) against `homePage.content.faq.items.<key>.{question,answer}`. supertool's accordion already ships a `ChevronDown` (lucide) rotating chevron, `focus-visible` outline, hover, and `data-state` styling (1.11 parity) — it **works and is keyboard-operable**, exceeding the reference's animation-less, glyph-chevron FAQ (AC 2, §5). Do NOT reintroduce the reference's broken pattern.

### CTAs — sign up / sign in via ROUTES + i18n Link (D-10)

- **Hero:** primary CTA "Get started" → `ROUTES.signUp`; secondary CTA "Sign in" → `ROUTES.signIn` — both `Button component={Link} href={...}` (i18n navigation). Optionally a "Learn more" anchor to `#features` (in-page). **Never hardcode path literals** — use `ROUTES` (react.md). All CTAs are real, keyboard-focusable links (a11y AC 6).
- A closing **CTA band** near the footer repeats the sign-up / sign-in calls-to-action (epics.md AC "clear calls-to-action to sign up / sign in").

### Footer — copyright + real CTAs, no dead links (D-9)

- Footer renders inside the page (supertool has no `(home-layout)` layout to host it): a brand line, a copyright with an ICU `{year}` var (`homePage.content.footer.copyright`), and **real in-app links via `ROUTES`** (Sign in / Sign up). **Do NOT reproduce the reference's hardcoded `privacy-policy`/`terms-of-service`/`contact` hrefs** — those pages do not exist in supertool and dead/hardcoded links violate the "no hardcoded route literals" rule (react.md). Legal pages are out of scope; add them only if/when those routes exist.

### SEO metadata — `generateMetadata` on the landing (D-8)

- Add `export const generateMetadata` to the landing `page.tsx`, returning per-locale `{ title, description }` from `homePage.metadata.{title,description}` via `getTranslations({ locale, namespace: I18N_NAMESPACE.homePage })` (the reference pattern; next-intl server API). This is the **one place metadata matters** — the public front door — and the app currently defines `generateMetadata` **nowhere** (verified: no `generateMetadata`/`export const metadata` in `apps/money-tracker/src`). Introducing it here (not app-wide) is the recorded decision (D-8); it is appropriate for a public marketing page and consistent with the reference, without retrofitting metadata onto the auth-gated app pages (out of scope).

### i18n — expand the existing `homePage` namespace (D-11, AC 3)

- Reuse the **existing** `homePage` namespace (`apps/money-tracker/messages/{en,uk}/home-page.json`, already registered in `I18N_NAMESPACE.homePage` and mapped to `home-page.json`) — **no new namespace file**, no new `I18N_NAMESPACE` entry, no new mapping.
- **Restructure it:** the current placeholder keys (`title`, `description`, `dashboardLink`, `categoriesLink`, `transactionsLink`) are consumed only by the placeholder `page.tsx` being replaced — **remove `dashboardLink`/`categoriesLink`/`transactionsLink`** (obsolete) and add the nested landing structure below. Both locales change in the **same commit**; real Ukrainian (not transliteration); ICU only (`{year}` in the copyright — no concatenation); `pnpm i18n:parity` green (EN reference, keys must match 1:1 across en/uk).
- Target key shape (adapt copy; icons are NOT keys — see D-6):

```
metadata:   { title, description }
content:
  hero:       { title, subtitle, getStarted, signIn, learnMore }
  advantages: { title, items: { tracking|import|insights|categories: { title, description } } }
  reviews:    { title, items: { review1|review2|review3: { name, role, quote } } }
  faq:        { title, items: { q1|q2|q3|q4|q5: { question, answer } } }
  cta:        { title, subtitle, getStarted, signIn }
  footer:     { tagline, copyright, signIn, signUp }
```

- Advantage keys should reflect **supertool's real capabilities** (transaction tracking, CSV/JSON import, dashboard insights, category organization) — not the reference's "budgets"/"recurring" (which supertool has not shipped; recurring is a disabled nav item, budgets are deferred). Do not advertise unshipped features.

### Styling — tokens only, mobile-first, theme-aware (AC 3, 4)

- One `.module.scss` co-located per section (PascalCase after the component) + a `page.module.scss` for the landing shell. **Design tokens only** (`--primary`, `--on-surface`, `--surface-container`, `--outline-variant`, `--spacing-*`, `--radius-*`, `--font-*`, `--shadows-*`); no hardcoded hex/px colors; theme-aware via the token system (works in light AND dark — the tokens are themed by `[data-theme]`, which `next-themes` drives). Class names camelCase. Import breakpoints/mixins namespaced (`@use "@supertool/ui/src/styles/breakpoints";` → `@include breakpoints.media-m`). Mobile-first: base styles for 390px, desktop overrides in media queries. Hero/advantages/reviews use responsive grids that collapse to one column on mobile with no horizontal overflow.

### Accessibility — the public front door (D-12, AC 6)

- Semantic landmarks and heading order: exactly one `<h1>` (hero, `Typography variant="title-xl" tag="h1"`); each `<section>` labelled (`aria-labelledby` referencing its `title-l` `<h2>`), a `<footer>` landmark. FAQ accordion is keyboard-operable (Radix — arrow/enter/space, focus-visible ring already in the molecule). All CTAs are real focusable links/buttons with discernible text. Decorative icons `aria-hidden`. Color contrast holds in both themes (tokens). Call this out explicitly — it is a per-story AC because this is the app's first public page.

## Acceptance Criteria

1. **A real landing page renders at `/` and is publicly reachable (RP-F8/RP-U6).** Given the route `/`, when an **unauthenticated** visitor opens it (`/`, `/en`, `/uk`), then a real marketing landing page renders — **hero, advantages/features, reviews, an FAQ, and a footer** — with clear **sign up / sign in** calls-to-action, replacing the placeholder; and `apps/money-tracker/src/proxy.ts` treats `/` as public (`ROUTES.home` in `PUBLIC_PATH_LIST`) so the visitor is **not redirected to sign-in**. The page is a server component composed of section server components (RSC by default; the only `'use client'` boundary is the reused `Accordion` molecule). No route group is introduced (landing lives at `[locale]/page.tsx`); the public chrome is the `AppShell` plain header.
2. **The FAQ works — expandable, keyboard-operable, exceeding the reference (§5).** Given the FAQ section, when a visitor expands a question (click or keyboard), then the answer is revealed using the working `accordion` molecule (`<Accordion type="single" collapsible>`), with a rotating chevron and focus-visible affordance — exceeding the reference's broken/animation-less FAQ. No emoji-as-icon and no dead-glyph chevron are used anywhere on the page (advantage icons use `lucide-react`; D-6).
3. **Theme + locale both correct; every string in both locales (protect §6; FR19/FR20).** Given theme and locale, when the visitor toggles theme (light/dark/system, via the plain-header `ThemeSwitcher`) or switches locale (en/uk, via the plain-header `LocaleSwitcher`) on the landing page, then dark mode and both locales render correctly (tokens only — no hardcoded colors), and **every landing string exists in both `en/home-page.json` and `uk/home-page.json` in the same commit** (real Ukrainian, ICU only, `{year}` interpolated not concatenated); `pnpm i18n:parity` is green. The obsolete placeholder keys (`dashboardLink`/`categoriesLink`/`transactionsLink`) are removed from both locales.
4. **Fully responsive & mobile-usable (NFR8 — per-story 390px mobile-QA).** Given a 390px mobile viewport, when the landing renders, then it is fully responsive and usable — hero legible, section grids collapse to a single readable column, CTAs touch-operable, FAQ operable — with **no horizontal overflow** (`document.documentElement.scrollWidth === window.innerWidth` at 390px in both themes).
5. **Authenticated visitors go to the app; SEO metadata present.** Given an **authenticated** visitor opens `/`, when the page RSC resolves, then `fetchProfile()` (generated client via the RSC gate — no hand-written fetch, NFR6) returns a profile and the visitor is **redirected to `ROUTES.dashboard`** (they do not see the marketing page wrapped in app chrome). Given any locale, when the page is requested, then `generateMetadata` returns a per-locale `title` and `description` (from `homePage.metadata.*`) — the app's first and only `generateMetadata`, appropriate for the public front door.
6. **Accessibility — semantic, keyboard-navigable public page (a11y).** Given the landing page, then it uses semantic landmarks and a correct heading hierarchy (exactly one `<h1>`; section `<h2>`s with `aria-labelledby`; a `<footer>` landmark), all CTAs are real focusable links/buttons with discernible text, the FAQ accordion is fully keyboard-operable with a visible focus ring, decorative icons are `aria-hidden`, and color contrast holds in both themes. (Public front door — a11y is an explicit AC.)
7. **Tests shipped (NFR1).** Component tests cover: each section renders its expected content/CTAs (hero CTAs link to `ROUTES.signUp`/`ROUTES.signIn`; advantages/reviews render their item lists; footer renders copyright + CTAs); the **FAQ accordion expands to reveal an answer** (interaction test); and the page's **auth-aware behavior** (authenticated → redirect to dashboard, unauthenticated → landing renders) is tested by mocking `fetchProfile` + `redirect`. All new strings land in both locales (AC 3); `pnpm i18n:parity` green. No backend test (no backend change); the **OpenAPI drift gate is a no-op** (no client regeneration this story — verify `git status --porcelain packages/shared/src/generated` stays clean).
8. **Visual QA evidence — committed (Epic 4 retro D1 standing pattern; Story 1.9 protocol).** `_bmad-output/implementation-artifacts/visual-qa/7-4-marketing-landing-page/` contains **light + dark × 390px-mobile + desktop** captures of: the **full landing page** (top-to-bottom), and key sections — **hero** (with CTAs), **advantages/features**, **reviews**, **FAQ closed**, **FAQ expanded** (an answer visible), and the **footer/closing CTA** — named `<scenario>--<viewport>--<theme>.png`, compared against the reference `landing--*` captures with the divergences noted in the Dev Agent Record (no route group / plain-header chrome vs `(home-layout)`; lucide icons vs emoji; working animated FAQ vs broken; sign-in/sign-up CTAs + no dead legal links vs reference footer; authenticated→dashboard redirect vs reference render-for-all). At 390px `scrollWidth === innerWidth` in both themes (no horizontal overflow). Capture on `:3000` after verifying (via `lsof`) the `:3000` next-server cwd is THIS checkout (memory: worktree-dev-server-stale-qa).

## Tasks / Subtasks

- [x] **Task 1 — Study the reference and current state before writing code** (AC: all)
  - [x] Reference (ED1 — study/adapt, never copy/import): `example/track-my-life/apps/money-tracker/src/app/[locale]/(home-layout)/{page.tsx,page.content.tsx,layout.tsx,page.module.scss,layout.module.scss}` and `.../(home-layout)/components/{HeroSection,AdvantagesSection,ReviewsSection,FaqSection,Footer}/*.{tsx,module.scss}`; `example/track-my-life/apps/money-tracker/messages/{en,uk}/home-page.json` (key shape + uk phrasing to adapt). **Adapt, do not copy:** no route group (D-1); no prop-drilled `TranslateFn` — sections use `useTranslations` (D-4); lucide icons not emoji (D-6); working accordion (D-7); sign-in/sign-up footer CTAs not dead legal links (D-9); authenticated→dashboard redirect (D-3).
  - [x] Read in full the files this story touches/depends on: `apps/money-tracker/src/app/[locale]/page.tsx` (placeholder to replace) + `.../[locale]/layout.tsx` (providers/`fetchProfile`/`AppShell` mount) + `apps/money-tracker/src/app/[locale]/AppShellSection.tsx` + `packages/shell/src/components/app-shell/AppShell.tsx` (**plain header when `userName===undefined`** — the public chrome); `apps/money-tracker/src/proxy.ts` (`PUBLIC_PATH_LIST` — D-2); `apps/money-tracker/src/actions/fetch-profile.ts` (auth gate) + `apps/money-tracker/src/utils/resolve-onboarded-profile.ts` (redirect pattern); `apps/money-tracker/src/constants/routes.ts` (`ROUTES.home/signUp/signIn/dashboard`); `packages/next-shared/src/i18n/navigation/navigation.ts` (`Link`, `redirect`); `apps/money-tracker/src/app/[locale]/sign-in/page.tsx` (server page + `getTranslations` + `Card`/`Typography`/CTA-link pattern); the primitives `packages/ui/src/components/atoms/{typography/Typography,button/Button}.tsx`, `packages/ui/src/components/molecules/{card/Card,accordion/Accordion}.tsx`; `apps/money-tracker/messages/{en,uk}/home-page.json`; `apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts` + `packages/shared/src/constants/i18n-namespace.ts` (confirm `homePage`/`home-page` already registered — no change needed).
- [x] **Task 2 — Make `/` public + auth-aware landing route** (AC: 1, 5)
  - [x] `apps/money-tracker/src/proxy.ts`: add `ROUTES.home` to `PUBLIC_PATH_LIST` so unauthenticated `/` is not redirected to sign-in (D-2). Do not otherwise change the middleware.
  - [x] `apps/money-tracker/src/app/[locale]/page.tsx`: convert to an `async` server component; `setRequestLocale(locale)`; `const profile = await fetchProfile();` → `if (profile) { redirect({ href: ROUTES.dashboard, locale }); }` (D-3); otherwise render the landing composition. Add `export const generateMetadata` returning per-locale `{ title, description }` from `homePage.metadata.*` via `getTranslations({ locale, namespace: I18N_NAMESPACE.homePage })` (D-8). Remove the placeholder markup and its obsolete key usage.
- [x] **Task 3 — Landing section components** (AC: 1, 2, 3, 6)
  - [x] Create under `apps/money-tracker/src/app/[locale]/components/landing/` (kebab-case dirs, PascalCase component files + co-located `.module.scss`): `hero-section/HeroSection.tsx`, `advantages-section/AdvantagesSection.tsx`, `reviews-section/ReviewsSection.tsx`, `faq-section/FaqSection.tsx`, `footer-section/FooterSection.tsx`, and a `landing-page/LandingPage.tsx` (or compose directly in `page.tsx`) assembling them in order Hero → Advantages → Reviews → FAQ → Footer inside a semantic `<main>`/sections. All server components; each calls `useTranslations(I18N_NAMESPACE.homePage)` directly (D-4). No `'use client'` added (FAQ renders the client `Accordion` from a server parent).
  - [x] **HeroSection:** single `<h1>` (`Typography variant="title-xl" tag="h1"`), subtitle (`body-l`), CTAs `Button component={Link} href={ROUTES.signUp}` (primary "Get started") + `Button component={Link} href={ROUTES.signIn}` variant `outline` ("Sign in"); optional `#features` anchor. `aria-labelledby` on the section.
  - [x] **AdvantagesSection** (`id="features"`): `title-l` `<h2>`; a responsive grid of `Card`s over a module-level key list (`['tracking','import','insights','categories']`) with a **lucide-react** icon per item mapped in a module const (`aria-hidden`) — real supertool capabilities only (D-6).
  - [x] **ReviewsSection:** `title-l` `<h2>`; `Card` grid over `['review1','review2','review3']` (quote + name/role).
  - [x] **FaqSection:** `title-l` `<h2>`; `<Accordion type="single" collapsible>` mapping `FAQ_KEY_LIST=['q1'..'q5']` to `AccordionItem`/`AccordionTrigger`(question)/`AccordionContent`(`Typography body-m` answer) (D-7).
  - [x] **FooterSection** (`<footer>` landmark): tagline, `{year}` copyright (ICU), Sign in / Sign up `Link`s via `ROUTES`; plus a closing CTA band (`homePage.content.cta.*`) repeating sign-up/sign-in (D-9, D-10). Compute the year server-side (`new Date().getFullYear()`), pass as the ICU `{year}` value.
- [x] **Task 4 — Styling (tokens, mobile-first, theme-aware)** (AC: 3, 4, 6)
  - [x] Co-located `.module.scss` per section + `page.module.scss` shell. Tokens only (no hex/px colors); camelCase classes; namespaced breakpoints/mixins; mobile-first base at 390px with desktop media-query overrides; grids collapse to one column on mobile; no fixed widths that overflow 390px. Verify both themes via tokens.
- [x] **Task 5 — i18n copy (both locales, same commit)** (AC: 3)
  - [x] `apps/money-tracker/messages/en/home-page.json` and `uk/home-page.json`: replace the placeholder keys with the D-11 structure (`metadata`, `content.{hero,advantages,reviews,faq,cta,footer}`); remove `dashboardLink`/`categoriesLink`/`transactionsLink`. Real Ukrainian; ICU `{year}`; keys identical across locales. Run `pnpm i18n:parity` (green). No new namespace / no `I18N_NAMESPACE` change.
- [x] **Task 6 — Tests** (AC: 7)
  - [x] Co-located `*.test.tsx` for each section: hero CTAs link to `ROUTES.signUp`/`ROUTES.signIn`; advantages/reviews render their item lists; footer renders copyright + CTAs; **FAQ expands to show an answer** (fire click/keyboard on a trigger, assert content visible). Page/auth test: mock `fetch-profile` + `redirect` — authenticated → `redirect(dashboard)` called; unauthenticated → landing content renders. Use the existing test setup (NextIntl provider harness as other page tests do). No backend test.
- [x] **Task 7 — Gates, visual QA, record** (AC: 3, 4, 7, 8)
  - [x] `pnpm type-check`, `pnpm lint`, `pnpm stylelint`, `pnpm fmt:check`, `pnpm test`, `pnpm i18n:parity`, `pnpm build` — pnpm scripts only; `TURBO_FORCE=true` where turbo may replay stale logs (memory: turbo-cache-masks-gate-results). Confirm the **OpenAPI drift gate is a no-op**: `git status --porcelain packages/shared/src/generated` clean (no regeneration).
  - [x] Pre-QA: verify `:3000` next-server cwd is THIS checkout (`lsof`); run the dev stack; sign OUT (or use a fresh browser context) so the public landing renders with the plain header.
  - [x] Capture the AC-8 matrix (full page; hero; advantages; reviews; FAQ closed; FAQ expanded; footer/CTA) light+dark × 390+desktop → `_bmad-output/implementation-artifacts/visual-qa/7-4-marketing-landing-page/<scenario>--<viewport>--<theme>.png`; assert `scrollWidth === innerWidth` at 390px both themes; compare to the reference `landing--*`, note divergences. Also verify the authenticated case redirects to `/dashboard`.
  - [x] Update Dev Agent Record + File List + Change Log; set status → review.

### Review Findings

Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) of diff `85badae..HEAD`, 2026-07-05. Verdict: **CHANGES-REQUESTED** — 1 must-fix, all else nice-to-have. Gates re-run by orchestrator: type-check / lint / stylelint / fmt / i18n:parity / test / build all PASS; OpenAPI generated tree clean; no package.json change. Gating/redirect logic verified correct (no loop, no over-broad public match — see dismissed items).

Decision-needed (operator judgment):

- [ ] [Review][Decision] `<footer>` nested inside AppShell `<main>` does not expose a `contentinfo` landmark — AC6 requires "a `<footer>` landmark". Per ARIA-in-HTML, a `<footer>` descendant of `<main>` maps to a generic element, not `contentinfo`. This is an inherent consequence of pre-approved D-1 (no route group; shell owns the single `<main>`) + the deliberate double-`<main>` avoidance. Options: accept as PoC limitation; add explicit `role="contentinfo"` (has its own nesting caveat); or revisit chrome later. [FooterSection.tsx:46, AppShell.tsx:46] (edge+auditor)
- [ ] [Review][Decision] AC8 visual-QA evidence is a subset of the enumerated matrix — committed set is `full-page` (all 4 light/dark × mobile/desktop), `faq-expanded` (all 4), `hero--desktop--light`, `full-page-uk--desktop--light` (10 files). Missing standalone `advantages`/`reviews`/`faq-closed`/`footer` captures; hero & uk only desktop-light. The full-page 4-way matrix does show every section in both themes/viewports and faq-expanded covers the interactive open state, so core evidence exists. Operator's call whether the full-page matrix suffices. [visual-qa/7-4-marketing-landing-page/] (auditor)

Patch (unambiguous fix):

- [x] [Review][Patch] Heading-level skip h2 → h4 in AdvantagesSection (MUST-FIX, AC6 "correct heading hierarchy") — `<CardTitle variant="title-s">` renders `<h4>` (Typography `VARIANT_TAG_MAP: title-s → h4`) directly under the section `<h2>`, skipping `<h3>`. Fix: pass `tag="h3"` to the advantage `CardTitle`s (CardTitle forwards `...props` to Typography). [AdvantagesSection.tsx:57] (edge) — RESOLVED: added `tag="h3"` to the advantage `CardTitle` (visual `variant="title-s"` unchanged); test now asserts four level-3 headings. FAQ (Radix `<h3>` accordion headers) and reviews (no in-card headings) verified free of the same skip.
- [ ] [Review][Patch] Authenticated page test is weak — `redirect` is mocked as a non-throwing `vi.fn()`, so the test cannot catch a missing early-exit (real next-intl `redirect` throws; production is correct). Make the mock throw and assert `LandingPage` is NOT rendered for an authenticated visitor. [page.test.tsx:43-49] (blind+edge)
- [ ] [Review][Patch] Ukrainian reviews render with Latin curly quotes “ ” — `&ldquo;{quote}&rdquo;` is hardcoded for all locales; Ukrainian convention is «guillemets». Make locale-aware or fold quote marks into the translated string. [ReviewsSection.tsx:35] (blind)

Deferred (real, pre-existing or out-of-scope now):

- [x] [Review][Defer] Public landing 500s if the API is network-down (`ECONNREFUSED` / `API_URL` unset) — `fetchProfile()` rejects → the RSC throws → the public front door errors. On a 401 it correctly returns `null` and renders (verified). Pre-existing coupling via `layout.tsx` (also calls `fetchProfile`); this story makes `/` the primary public surface so it now matters more. [page.tsx:33, fetch-profile.ts] — deferred, pre-existing (edge)
- [x] [Review][Defer] LandingPage full-bleed band trick hard-couples to `packages/shell` `<main>` padding tokens — negative margins (`-spacing-6/-spacing-4`, `-spacing-8/-spacing-6`) exactly cancel the shell padding today (overflow math verified sound, `scrollWidth===innerWidth` at 390px), but a future shell-padding change would silently reintroduce overflow with no compile-time signal. [LandingPage.module.scss] — deferred, cross-package coupling note (blind+edge)

Dismissed as noise / verified false positives (6): (1) prefix-match auth bypass — `checkIsPublicPath` uses strict `===`, not prefix; adding `/` cannot expose other routes. (2) locale-root not public — `getPathnameWithoutLocale` returns `'/'` for `/en`,`/uk` via `|| '/'`. (3) authenticated-not-onboarded redirect loop — terminates `/`→`/dashboard`→`/onboarding` (resolveOnboardedProfile). (4) ICU `{year}` digit grouping — intl-messageformat 11.2.8 renders "© 2026" (no separator) in both locales, confirmed empirically. (5) `.quoteWrapper { flex:1 }` no-op — Card IS `display:flex; flex-direction:column`, so it works. (6) `rem` container max-widths — established repo-wide convention, not a token violation.

## Dev Notes

### Decisions made at story creation (autonomous run — operator review points)

| # | Decision | Rationale |
|---|---|---|
| D-1 | **Landing at `/` (`[locale]/page.tsx`), NO route group** | supertool deliberately avoids route groups; the shell is auth-gated inside `AppShell`, which already renders a **plain public header** (ToolNav + Theme/Locale switchers) when `userName===undefined` — that is the landing's public chrome (memory: shell-sidebar-layout-decision). **Divergence flag:** the reference builds the landing in a `(home-layout)` route group with its own layout+footer; supertool keeps the single `[locale]/layout.tsx` and renders the footer inside the page. |
| D-2 | **Make `/` public in `proxy.ts`** (add `ROUTES.home` to `PUBLIC_PATH_LIST`) | Load-bearing and non-obvious: today `PUBLIC_PATH_LIST=[signIn,signUp]` and every other path redirects to sign-in without a session — so an unauthenticated `/` is bounced to sign-in and the "first-time visitor opens `/`" AC cannot pass. `getPathnameWithoutLocale` returns `'/'` for the bare root, so `ROUTES.home` is the correct entry. Home gating was explicitly deferred to Epic 7 (5-3 D-notes) — this story owns it. |
| D-3 | **Authenticated visitors → redirect to `ROUTES.dashboard`** (page RSC via `fetchProfile`) | With no route groups, an authenticated `/` would render the marketing page wrapped in the full app sidebar chrome (AppShell renders the sidebar when `userName` is set) — wrong for a full-bleed landing. Redirecting via the existing `fetchProfile` gate keeps the landing rendering only with the public plain header and sends signed-in users into the app. **Divergence flag:** the reference renders the same landing for everyone (no redirect); rejected alternative: render-for-all + a context-aware "Go to app" CTA (chrome problem). Uses the generated client via the RSC gate (NFR6), not a hand-written fetch. |
| D-4 | **Sections use `useTranslations` directly — NO prop-drilled `TranslateFn`** | i18n.md convention ("Component usage: `const translate = useTranslations(...)`"); matches every existing supertool page. **Divergence flag:** the reference fetches translations once and threads a `TranslateFn` prop into every section (and imports a `next-shared` translate-fn type supertool has no counterpart for). `translate` alias, never `t` (id-length lint). |
| D-5 | **Compose from existing DS primitives only** (`Typography`, `Button`, `Card*`, `Accordion*`, `Link`) | react.md "use all simple UI components from `packages/ui`". No new components in `packages/ui`/`shell`/`widgets`/`next-shared`; no new dependency. |
| D-6 | **lucide-react icons for advantages — no emoji, icons NOT in i18n JSON** | The reference stores **emoji** as advantage icons and uses a text-glyph chevron — a §5 defect to exceed. lucide-react is already a dependency (used in `AppShellSection`); icons are presentation, not translatable copy, so they map in a module-level const, not in `home-page.json`. Decorative icons `aria-hidden`. |
| D-7 | **FAQ uses the working `accordion` molecule** (`type="single" collapsible`) | supertool's 1.11 accordion has a rotating `ChevronDown` (lucide), focus-visible ring, hover and `data-state` styling — it works and is keyboard-operable, exceeding the reference's broken/animation-less, glyph-chevron FAQ (AC 2, §5). |
| D-8 | **Add `generateMetadata` to the landing page** (per-locale title/description from `homePage.metadata.*`) | The public front door is the one place SEO metadata matters; the app defines `generateMetadata` nowhere today (verified). Introduce it here only (reference pattern via `getTranslations({locale,namespace})`), not retrofit across the auth-gated app (out of scope). |
| D-9 | **Footer = copyright (`{year}`) + real ROUTES CTAs; NO dead legal links** | supertool has no privacy/terms/contact pages; the reference's hardcoded legal hrefs would be dead links and violate the no-hardcoded-route-literals rule (react.md). Footer links use `ROUTES.signIn`/`signUp`. Legal pages are out of scope. |
| D-10 | **CTAs: hero (sign up + sign in) + a closing CTA band** | epics.md AC "clear calls-to-action to sign up / sign in". `Button component={Link} href={ROUTES.signUp/ signIn}`; optional `#features` in-page anchor. Real focusable links (a11y). |
| D-11 | **Reuse the existing `homePage` namespace (`home-page.json`); restructure, remove obsolete keys** | The namespace is already registered + mapped; no new file/entry needed. The placeholder keys (`dashboardLink`/`categoriesLink`/`transactionsLink`) are consumed only by the page being replaced — remove them; add `metadata` + `content.{hero,advantages,reviews,faq,cta,footer}`. Both locales same commit, real Ukrainian, ICU, parity green. Advantage copy reflects **shipped** capabilities (tracking, import, insights, categories) — not the reference's unshipped budgets/recurring. |
| D-12 | **Accessibility is an explicit AC** | First public page; semantic landmarks, one `<h1>`, `aria-labelledby` sections, `<footer>`, keyboard-operable FAQ + focus ring, `aria-hidden` decorative icons, both-theme contrast. |
| D-13 | **No backend/API change — OpenAPI drift gate is a no-op** | UI/content-only story; no endpoint/DTO/schema/client regeneration (contrast 7-3). No new runtime dependency. Verify `packages/shared/src/generated` stays clean. |

### Current state of the system this story builds on (preserve, don't break)

- **`[locale]/page.tsx`:** the placeholder to replace — sync server component rendering `homePage.{title,description,dashboardLink,categoriesLink,transactionsLink}` via `useTranslations`. It does NOT currently gate/redirect. This story replaces it with the auth-aware landing.
- **`[locale]/layout.tsx`:** already `async`, calls `fetchProfile()`, sets `userName` only when `profile.onboardingCompleted`, wraps children in `NextIntlClientProvider` + `next-themes` `ThemeProvider` (`attribute="data-theme"`, system default) + `AppShellSection`. Loads Poppins. Do NOT change — the landing renders as its child; when unauthenticated, `userName===undefined` → AppShell plain header (the desired public chrome).
- **`AppShell` (`packages/shell`):** `userName===undefined` → `plainHeader` (ToolNav + `ThemeSwitcher` + `LocaleSwitcher`) + `<main>`; otherwise sidebar app chrome. The plain header is where the landing's theme/locale toggles live (AC 3). Do NOT modify the shell.
- **`proxy.ts`:** `PUBLIC_PATH_LIST=[signIn,signUp]`; `checkIsPublicPath(getPathnameWithoutLocale(pathname))`; unauthenticated non-public → redirect to `${localePrefix}${ROUTES.signIn}`. Adding `ROUTES.home` is the only change (D-2). Keep the i18n routing + matcher intact.
- **`fetch-profile.ts`:** `cache(async)` → `UsersApiService.usersMe({ client: createServerApiClient({ cookieHeader }) })` → `data ?? null`. Reuse as the auth gate (returns `null` when unauthenticated).
- **`resolve-onboarded-profile.ts`:** shows the RSC redirect idiom (`redirect({ href, locale })`). The landing needs only the "authenticated → dashboard" branch (D-3); onboarding routing is handled downstream by the app pages, not here.
- **Primitives:** `Typography` (polymorphic `tag`, variants title-xl…body-s), `Button` (polymorphic `component={Link}`, variants incl. `outline`), `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (client molecule, `ChevronDown`), `Link`/`redirect` from next-shared navigation, `UnderlineLink` (available if a text link is wanted). All exist — compose, don't rebuild.

### Reference patterns (ED1 — study, adapt, never copy/import)

- `example/track-my-life/apps/money-tracker/src/app/[locale]/(home-layout)/{page.tsx,page.content.tsx,layout.tsx}` — route/metadata + section composition + footer-in-layout **shape**. Adapt: no route group (D-1); footer in-page (D-1); sections use `useTranslations` not a `TranslateFn` prop (D-4); authenticated→dashboard redirect (D-3).
- `.../(home-layout)/components/HeroSection/HeroSection.tsx` — hero shape (title-xl h1, subtitle, primary+secondary CTA). Adapt: secondary CTA → `ROUTES.signIn` (not only a `#advantages` anchor); `ROUTES` not a `PATHS` map.
- `.../(home-layout)/components/AdvantagesSection/AdvantagesSection.tsx` — advantages `Card` grid shape. Adapt: **lucide icons in a module const**, not emoji from JSON (D-6); supertool-real capabilities.
- `.../(home-layout)/components/ReviewsSection/ReviewsSection.tsx` — testimonial `Card` grid shape.
- `.../(home-layout)/components/FaqSection/FaqSection.tsx` — FAQ map over a key list into `Accordion` (`type="single" collapsible`). Adapt: import supertool's `accordion/Accordion` (working molecule); this is the exceed-the-reference point (D-7).
- `.../(home-layout)/components/Footer/Footer.tsx` — footer shape (`{year}` copyright + links). Adapt: `ROUTES` sign-in/sign-up CTAs, **no dead legal links** (D-9).
- `example/track-my-life/apps/money-tracker/messages/{en,uk}/home-page.json` — `metadata` + `content.{hero,advantages,reviews,faq,footer}` key shape + uk phrasing to adapt (drop budgets/recurring; add import/categories/cta).
- **No reference counterpart — new ground:** making `/` public in the middleware (D-2), the authenticated→dashboard redirect on `/` (D-3), lucide-icon advantages (D-6), and the closing CTA band.

### Conventions to honor (hard rules + memories)

- **RSC-first (react.md):** landing + sections are server components; the only `'use client'` is the reused `Accordion` molecule; no new client files. Read data (auth) via the `fetch-profile` RSC gate — never a hand-written fetch (NFR6/D8).
- **No API/DB work (D7 n/a this story):** no controller/service/repository, no DTO, no schema, no client regeneration; drift gate no-op (D-13).
- **React/files:** `FC<Props>`; PascalCase component files + co-located `.module.scss`/`.test.tsx`; kebab-case dirs; `on*`/`handle*`; named exports, no barrels; `Link`/`redirect` from `@supertool/next-shared/src/i18n/navigation/navigation`; **never hardcode route literals** — use `ROUTES` (D-9/D-10).
- **i18n (FR19/FR20):** both locales same commit; ICU only (`{year}`, no concatenation); `useTranslations(I18N_NAMESPACE.homePage)` / `translate` alias (never `t`); existing `homePage` namespace (no new file); real Ukrainian; `pnpm i18n:parity` green.
- **SCSS (styles.md):** design tokens only (theme-aware light/dark); camelCase classes; mobile-first; namespaced breakpoints/mixins; no hardcoded colors/sizes; no width overflow at 390px.
- **TS:** prefer interfaces; no enums (module-level `as const` key lists); no `as` except `as const`; single source of truth.
- **Tests (NFR1):** co-located `*.test.tsx`; component + interaction (FAQ) + auth-aware page test; pnpm scripts only; `TURBO_FORCE=true` for gate verification (memories: run-tests-via-pnpm-scripts, turbo-cache-masks-gate-results).
- **Visual QA (Epic 4 retro D1 / Story 1.9 protocol):** committed light+dark × 390+desktop matrix vs the reference `landing--*`, `<scenario>--<viewport>--<theme>.png`; verify `:3000` cwd via `lsof` (memory: worktree-dev-server-stale-qa); sign out for the public capture.
- **Money (D1):** no money handling in this story.
- **Design aids (optional):** the `frontend-design` / `ui-ux-pro-max` skills may guide layout/polish, but the **binding direction is reference parity + the design system** — those skills are advisory, not authoritative.
- **Branch/PR:** `TOOLS-7-4/marketing-landing-page` off `main`; conventional commits; PR via `create-pr` (memory: story-work-via-pr).

### Out of scope (explicit guardrails)

- **No security hardening (7-5 — helmet/compression), no first/last-name (7-1 shipped), no change-password (7-2 shipped), no delete-account (7-3 shipped).**
- **No backend/API change** — no endpoint, DTO, schema, migration, or generated-client regeneration; no new runtime dependency (D-13).
- **No `packages/ui`/`shell`/`widgets`/`next-shared` source changes** — reuse existing primitives; the `AppShell` plain header is used as-is.
- **No route group** (`(home-layout)`/`(marketing)`) and **no new route** (landing is `/`) — D-1.
- **No new i18n namespace** — reuse `homePage`/`home-page.json` (D-11).
- **No legal/privacy/terms/contact pages** and no dead links to them (D-9).
- **No app-wide metadata retrofit** — `generateMetadata` only on the landing (D-8).
- **No onboarding-routing logic on `/`** beyond authenticated→dashboard (downstream pages own onboarding redirects) — D-3.

### Project Structure Notes

- Middleware: `apps/money-tracker/src/proxy.ts` (M — `ROUTES.home` in `PUBLIC_PATH_LIST`).
- Route: `apps/money-tracker/src/app/[locale]/page.tsx` (M — auth-aware landing + `generateMetadata`) + `page.module.scss` (A, if a page shell wrapper is used).
- Sections (A): `apps/money-tracker/src/app/[locale]/components/landing/{hero-section/HeroSection,advantages-section/AdvantagesSection,reviews-section/ReviewsSection,faq-section/FaqSection,footer-section/FooterSection}.{tsx,module.scss,test.tsx}` (+ an optional `landing-page/LandingPage.tsx` composer). Dirs kebab-case; component files PascalCase.
- i18n (M): `apps/money-tracker/messages/{en,uk}/home-page.json`.
- Visual QA (A): `_bmad-output/implementation-artifacts/visual-qa/7-4-marketing-landing-page/*.png`.
- No new packages, no new routes, no new namespaces, no generated-client change.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4] — story statement + 5 BDD AC blocks (real landing at `/` with hero/advantages/(optional)reviews/FAQ/footer + sign-up/sign-in CTAs; working FAQ accordion; theme+locale correct both; fully responsive mobile; tests + both locales + committed light/dark mobile/desktop screenshots vs reference) + the §5/§6 evidence note
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — charter: RP-F8/RP-U6, D1/NFR6/D7/FR19-20/NFR1 binding, per-story mobile-QA
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-F8 (marketing landing), RP-U6 (credible public face)
- [Source: _bmad-output/planning-artifacts/architecture.md] — RSC data-fetch pattern, NFR6 (generated client), NFR8 (responsive), no-route-group shell convention
- [Source: _bmad-output/implementation-artifacts/epic-6-retro-2026-07-05.md] — 7-4 = first public/unauthenticated surface; re-engages committed-visual-QA + both-locale discipline; no reference-parity backend dependency
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-07-04.md] — D1 committed-evidence visual QA is the standing pattern for Epic 5–7 UI stories (light+dark × 390+desktop, `<scenario>--<viewport>--<theme>.png`, vs named reference captures)
- [Source: _bmad-output/implementation-artifacts/7-3-delete-account.md] — prior Epic 7 story: story-file shape, visual-QA naming + `:3000`-cwd discipline, drift-gate ritual (here a no-op)
- [Source: apps/money-tracker/src/proxy.ts] — `PUBLIC_PATH_LIST` / public-path gate (the D-2 change site)
- [Source: apps/money-tracker/src/app/[locale]/page.tsx] — placeholder to replace
- [Source: apps/money-tracker/src/app/[locale]/layout.tsx + AppShellSection.tsx] — providers, `fetchProfile`, AppShell mount
- [Source: packages/shell/src/components/app-shell/AppShell.tsx] — plain public header when `userName===undefined` (the landing chrome)
- [Source: apps/money-tracker/src/actions/fetch-profile.ts + utils/resolve-onboarded-profile.ts] — auth gate + RSC redirect idiom (D-3)
- [Source: apps/money-tracker/src/constants/routes.ts + packages/next-shared/src/i18n/navigation/navigation.ts] — `ROUTES`, `Link`, `redirect`
- [Source: apps/money-tracker/src/app/[locale]/sign-in/page.tsx] — server page + `getTranslations` + Card/Typography/CTA-link pattern
- [Source: packages/ui/src/components/atoms/{typography/Typography,button/Button}.tsx + molecules/{card/Card,accordion/Accordion}.tsx] — the primitives to compose (accordion is the working, keyboard-operable molecule)
- [Source: packages/shared/src/constants/i18n-namespace.ts + apps/money-tracker/src/i18n/constants/localization-messages-file-name-by-namespace.ts] — `homePage`/`home-page.json` already registered (no change)
- [Source: example/track-my-life/apps/money-tracker/src/app/[locale]/(home-layout)/** + messages/*/home-page.json] — reference landing shape (ED1; route group / TranslateFn / emoji / dead legal links / render-for-all all adapted, not copied)
- [Source: .claude/rules/{react.md,i18n.md,styles.md,javascript.md,typescript.md}] — conventions

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- All gates run via pnpm scripts with `TURBO_FORCE=true` on turbo-backed tasks (memory: turbo-cache-masks-gate-results).
- Lint initially flagged `new-cap` on direct `HomePage(PROPS)` calls in `page.test.tsx`; resolved by aliasing to a lowercase `renderHomePage` const (the same pattern existing dashboard server-component tests use).

### Completion Notes List

Implemented the real marketing landing page at `/` (`[locale]/page.tsx`), replacing the placeholder, per all settled decisions D-1…D-13. No re-planning.

- **D-1 / D-2 / D-3 (routing + gating — highest risk):** Added `ROUTES.home` to `PUBLIC_PATH_LIST` in `proxy.ts` (only middleware change) so unauthenticated `/` renders instead of redirecting to sign-in. The page RSC is `async`, calls the existing `fetchProfile()` gate, and `redirect({ href: ROUTES.dashboard, locale })` (i18n `redirect` from `@supertool/next-shared`) when a profile is returned. No route group; the landing renders inside the `AppShell` plain public header (the shell was not modified).
- **Double-`<main>` avoidance:** `AppShell` already wraps children in a `<main>` (with `max-width:1200px` + padding). The landing therefore does NOT add its own `<main>` — it composes `<section>` landmarks + a `<footer>`, keeping exactly one `<main>` and one `<h1>` (a11y AC 6). `LandingPage.module.scss` uses negative margins to neutralize the shell's padding so the section background bands read as full-width bands within the centered content column.
- **D-4:** Each section is a server component calling `useTranslations(...)` directly with a template-literal sub-namespace (e.g. `${I18N_NAMESPACE.homePage}.content.hero`) — no prop-drilled `TranslateFn`. `translate` alias, never `t`.
- **D-5 / D-6 / D-7:** Composed from existing DS primitives only (`Typography`, `Button`, `Card*`, `Accordion*`, `Link`). Advantage icons use `lucide-react` (`ArrowLeftRight`, `Import`, `LineChart`, `Tags`) mapped in a module-level const with `aria-hidden` — no emoji, no icons in i18n JSON. FAQ uses the working `Accordion type="single" collapsible` molecule (rotating `ChevronDown`, focus-visible ring) — verified expandable via click and keyboard-operable (Radix), exceeding the reference's broken FAQ.
- **D-8:** `generateMetadata` added to the landing page only (per-locale title/description via `getTranslations({ locale, namespace })`) — verified live: page `<title>` renders the localized metadata. First and only `generateMetadata` in the app.
- **D-9 / D-10:** Footer renders a `<footer>` landmark (tagline, `{year}` ICU copyright computed server-side, real `ROUTES.signIn`/`signUp` links — NO dead legal links) plus a closing CTA band (`content.cta.*`). Hero has Get started (`signUp`) + Sign in (`signIn`) + Learn more (`#features` anchor).
- **D-11:** Reused the existing `homePage` namespace (`home-page.json`); removed the obsolete `dashboardLink`/`categoriesLink`/`transactionsLink`/`title`/`description` placeholder keys; added `metadata` + `content.{hero,advantages,reviews,faq,cta,footer}` in BOTH en and uk (real Ukrainian, ICU `{year}`) in the same commit. `pnpm i18n:parity` green. Advantage copy reflects shipped capabilities only (tracking, import, insights, categories).
- **D-13:** No backend/API change; `git status --porcelain packages/shared/src/generated` stayed clean (OpenAPI drift gate no-op confirmed). No new dependency.

**Gate results (all green):** `pnpm type-check` PASS · `pnpm lint` PASS · `pnpm stylelint` PASS · `pnpm fmt:check` PASS · `pnpm test` PASS (8/8 turbo tasks; 14 new landing tests) · `pnpm i18n:parity` PASS · `pnpm build` PASS · OpenAPI drift PASS (no-op, generated tree clean).

**Live redirect verification (requirement 3 — done on `:3000`, cwd verified via `lsof` = this checkout):**
- Signed OUT `/` → 200, renders landing (h1 "See where your money goes"); NOT redirected to sign-in. `/uk` → renders Ukrainian landing (title/h1 in Ukrainian), stays on `/uk`. Both locales confirmed.
- Signed IN (seeded operator from `.env.example`) → `/` and `/uk` both redirect to `/uk/dashboard` (locale preserved from session, single hop, NO loop).
- Sign-in/sign-up CTAs work (used the real sign-in form to authenticate). After sign-out (cookie-clear), `/` renders the landing again — baseline unaffected, read-only page, no DB mutation.

**Visual QA (committed evidence — `_bmad-output/implementation-artifacts/visual-qa/7-4-marketing-landing-page/`):** Captured and reviewed light+dark × 390px-mobile+desktop. `document.documentElement.scrollWidth === window.innerWidth` verified `=== 390` at 390px in BOTH themes (no horizontal overflow); desktop `=== 1440`. Full page, hero, FAQ-expanded (answer revealed, chevron rotated), and a uk locale capture. Theme-aware via tokens (dark mode fully correct). The "N" glyph in some captures is the Next.js dev-tools overlay, not part of the page.

**Divergences from the reference `landing--*` (all pre-decided, recorded):** no route group / plain-header chrome vs `(home-layout)` (D-1); lucide icons vs emoji (D-6); working animated FAQ vs broken (D-7); `useTranslations` per section vs prop-drilled `TranslateFn` (D-4); sign-in/sign-up footer CTAs + no dead legal links vs reference footer (D-9); authenticated→dashboard redirect vs render-for-all (D-3). Section bands render within the shell's 1200px centered content column rather than full-viewport-bleed, because the `AppShell` (shared, not modifiable) constrains `<main>` width.

### File List

**Modified:**
- `apps/money-tracker/src/proxy.ts` — added `ROUTES.home` to `PUBLIC_PATH_LIST` (D-2).
- `apps/money-tracker/src/app/[locale]/page.tsx` — auth-aware async RSC landing (fetchProfile gate → redirect authenticated to dashboard) + `generateMetadata` (D-3, D-8).
- `apps/money-tracker/messages/en/home-page.json` — restructured to `metadata` + `content.*`; removed obsolete placeholder keys (D-11).
- `apps/money-tracker/messages/uk/home-page.json` — same structure, real Ukrainian (D-11).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 7-4 in-progress → review.

**Added (sections — all under `apps/money-tracker/src/app/[locale]/components/landing/`):**
- `landing-page/LandingPage.tsx` + `LandingPage.module.scss`
- `hero-section/HeroSection.tsx` + `.module.scss` + `.test.tsx`
- `advantages-section/AdvantagesSection.tsx` + `.module.scss` + `.test.tsx`
- `reviews-section/ReviewsSection.tsx` + `.module.scss` + `.test.tsx`
- `faq-section/FaqSection.tsx` + `.module.scss` + `.test.tsx`
- `footer-section/FooterSection.tsx` + `.module.scss` + `.test.tsx`
- `apps/money-tracker/src/app/[locale]/page.test.tsx` — auth-aware page test.

**Added (visual QA evidence):**
- `_bmad-output/implementation-artifacts/visual-qa/7-4-marketing-landing-page/*.png` — full-page, hero, faq-expanded (light+dark × mobile+desktop) + uk locale capture.

## Change Log

| Date | Change |
|------|--------|
| 2026-07-05 | Story 7-4 implemented: real marketing landing page at `/` (hero, advantages, reviews, FAQ, footer + closing CTA), `/` made public in `proxy.ts`, authenticated→dashboard redirect, per-locale `generateMetadata`, `homePage` i18n namespace restructured (en+uk), component + auth-aware + FAQ-interaction tests, committed visual-QA matrix. All gates green; OpenAPI drift no-op. Status → review. |
| 2026-07-05 | Code review CHANGES-REQUESTED → 1 must-fix (heading-hierarchy skip h2→h4) fixed via `tag="h3"` on advantage titles (commit `3f8df3b`); round-2 re-review APPROVE; gating/redirect verified no-loop. PR opened: https://github.com/BudnikOleksii/supertool/pull/50 |
