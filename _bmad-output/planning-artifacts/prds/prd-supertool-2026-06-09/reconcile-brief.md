# Reconciliation: brief artifacts → PRD (supertool, 2026-06-09)

Inputs compared:

- Brief: `_bmad-output/planning-artifacts/briefs/brief-supertool-2026-06-09/brief.md`
- Brief addendum: `.../brief-supertool-2026-06-09/addendum.md`
- Decision log: `.../brief-supertool-2026-06-09/.decision-log.md`
- PRD: `_bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md`
- PRD addendum: `.../prd-supertool-2026-06-09/addendum.md`

Verdict: the PRD is a faithful carry of most of the brief — dual-purpose framing, trimmed-core scope, test-per-feature bar, rebuild-don't-copy, all four named risks, seed mechanics, i18n-from-day-one, deferral list. The findings below are the deltas.

---

## A. Contradictions (PRD says X, brief/decision log decided Y)

### A1. Settings: deferred in discovery, shipped in the PRD (FR5) — HIGH

Decision log, discovery round 2: *"Recurring, budgets, onboarding flow, **settings**, accounts/wallets become later epics."* The brief's v1 table then silently omitted settings from both columns, and the PRD resolved that silence in the opposite direction: **FR5** adds a profile-settings feature ("view and edit minimal profile settings: name, default currency, locale") and **FR14** builds the dashboard's default currency on top of it. FR5 is tagged [ASSUMPTION], but it directly reverses a logged user decision rather than filling a gap. Settings is also absent from the PRD's out-of-scope list, so nothing downstream will catch this.

Resolution needed: either get explicit user re-approval for a *minimal* profile settings slice in v1 (plausibly intended — locale persistence FR19 and currency default FR14 need somewhere to live), or cut FR5 and source the dashboard default from data (the PRD addendum's "most frequent currency" fallback could become the only rule) and locale from a cookie.

### A2. "UX approved as-is" — claim has no provenance in the brief artifacts — MEDIUM

PRD (Users section, NFR7, Next steps) asserts the operator "expects the example app's UX patterns (which already satisfy him) with no redesign", elevates this to a binding NFR, and uses it to mark `bmad-ux` likely-skippable. The PRD addendum claims this was "captured during discovery" ("operator explicitly satisfied with existing flows"). The decision log records no such statement; the closest entry says the opposite in spirit: *"examples are inspiration, not contract."* The brief only says the design-system *approach* (UI package + Storybook) carries over.

This may well match the user's actual intent, but as written the PRD manufactures a user decision and then uses it to skip a workflow phase. Needs explicit confirmation or an [ASSUMPTION] tag on NFR7 and the bmad-ux-skippable note.

### A3. PRD addendum's "no hard deadline" rationale — unlogged — LOW

PRD addendum: *"No hard deadline — epic sizing should favor a clean trail over speed."* Not present in brief, brief addendum, or decision log. Consistent with the pitch framing, but it is presented as "rationale captured during discovery" when discovery did not capture it.

## B. Silent drops

### B1. The locked stack is not restated as a PRD constraint — MEDIUM

Brief has an explicit **"Stack (locked)"** section: Next.js 16 / React 19 / TypeScript / **SCSS** / next-intl / NestJS / **Drizzle ORM** + PostgreSQL / better-auth / pnpm + Turborepo / Docker / @hey-api/openapi-ts. The PRD mentions most pieces incidentally (overview, NFR3, NFR6) but never carries the lock itself, and several locked choices appear nowhere in the PRD: **Drizzle ORM**, **SCSS**, **next-intl** (FR19 says "localized" without naming the library), React 19 / Next 16 versions. Since the PRD frames architecture as the next decision point, an architect reading only the PRD could legitimately re-decide ORM or styling. Recommend a one-line "Constraints: stack is locked per brief — Drizzle, SCSS, next-intl, …" or equivalent pointer with the lock made explicit.

### B2. "rules" dropped from the AI-setup merge list (ED3) — LOW

Brief: merged AI setup = "CLAUDE.md, skills, agents, commands, **rules**, and MCP config." ED3 lists "CLAUDE.md, skills, agents, commands, MCP" — rules omitted. Material because the brief addendum specifically inventories `rules/nestjs-apis.md` and format-on-write hooks on the backend side (hooks are also unlisted). The PRD addendum does defer to the brief addendum as canonical for merge notes, which softens this, but ED3 reads as the authoritative checklist.

### B3. "build" job missing from the CI success metric — LOW

Brief success criteria and CI inventory include a **build** check ("lint, fmt-check, type-check, stylelint, **build**, i18n parity"). PRD success metric lists "lint, fmt, type-check, stylelint, tests, i18n parity" — build dropped. ED3's "merged CI workflows" arguably implies it, but the green-on-every-merge metric is the enforcement point.

### B4. Web-first replacement of a mobile-first app — no device/responsive requirement — LOW/MEDIUM (qualitative)

Brief's core "why": *"a self-owned, **web-first** money tracker … replacing dependence on a **mobile-first** commercial app."* The PRD's dominant flow is daily entry "under ~10 seconds" (NFR5) — exactly the flow that, in Money Manager, happens on a phone at the point of purchase. The PRD says nothing about responsive/mobile-browser usability, so the qualitative bar "this actually replaces the phone app for daily entry" can silently fail while every FR passes. Worth one line in NFR5 or NFR7 (e.g. daily-entry flow usable in a mobile browser), or an explicit decision that desktop-only entry is acceptable.

### B5. "Dashboard meaningful immediately" — day-one seed timing not bound — LOW

Brief success criterion: "the database seeds … so the dashboard is meaningful **day one**." FR17 makes the seed repeatable/idempotent and NFR3 requires single-command startup, but nothing says the seed runs as part of initial setup. A v1 where seeding is a separate manual step technically satisfies FR17 yet misses the brief's intent. One clause in FR17 or NFR3 ("seed runs as part of the documented startup") closes it.

## C. Unflagged additions (PRD invents specifics the brief left open)

- **C1. Locales = English + Ukrainian (FR19).** Brief says only "initial set" / "additional locales deferred"; the decision log never names locales. EN+UK is a reasonable guess but is stated as fact without an [ASSUMPTION] tag — the only invented specific in the FRs that isn't flagged. (Contrast: FR6 note field, FR12 reassignment, FR16 12-month window are all properly tagged.)
- **C2. ≥5 transactions/week, ~10-second entry** — new quantifications of "daily use"; fine as PM work, listed for completeness.
- **C3. Counter-metrics section** — new, additive, consistent with brief intent ("test count is not the metric" echoes the brief's anti-coverage-optics stance). No issue.

## D. Confirmed faithful carries (spot-checked, no action)

- Dual-purpose framing incl. "both first-class" intent → PRD overview + goals (the brief's memorable failure framing — "working tracker with messy history fails; beautiful history with broken tracker fails" — survives in substance if not in words).
- Rebuild-don't-copy / examples never committed → ED1; scope-gravity risk → Risks.
- Test-per-feature, same story, CI-enforced → NFR1, success metrics.
- All four brief risks (better-auth boundary, oxlint-on-NestJS, seed mapping, scope gravity) → PRD Risks; better-auth deferral to architecture preserved, extended sensibly with FR2 cross-app coupling.
- Trimmed-core scope table → F2–F5 + out-of-scope list (every brief-deferred item present; PRD adds password recovery, sharing/multi-tenant — good).
- Seed: 1,880 records, flat shape, derive categories, money math as priority test target, idempotency → FR17/FR18 + PRD addendum.
- i18n day one + CI key parity (user decision in draft review) → FR19/FR20.
- Single-user posture, Redis deferred, import-UI deferred (confirmed assumptions) → all preserved.
- Quality gates incl. CodeRabbit, commitlint/husky/lint-staged, exact versions, merged .coderabbit.yaml → NFR2 + ED3.
- Local Docker only, no deployment → NFR3.
- Platform anticipates tool #2 without building it → Goal 2, FR4, success metric with honest [ASSUMPTION] about design-level verification.
- Private repo + real data posture → NFR4 (PRD actually strengthens the brief here).

## Recommended actions (priority order)

1. Resolve A1 (settings): user decision — keep FR5 as a deliberately un-deferred minimal slice, or cut it and rework FR14/FR19 defaults.
2. Resolve A2 (UX as-is): confirm with user or tag NFR7 + "bmad-ux skippable" as [ASSUMPTION].
3. Fix B1: add explicit locked-stack constraint line to the PRD.
4. Tag C1 (EN+UK) as [ASSUMPTION] or confirm.
5. Patch the small drops: B2 (rules + hooks in ED3), B3 (build in CI metric), B4 (mobile-browser entry stance), B5 (seed-on-startup clause).
