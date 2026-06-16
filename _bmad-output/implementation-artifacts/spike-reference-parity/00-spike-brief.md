# Spike: Reference-Parity Gap Analysis — Shared Agent Brief

Every agent on this spike MUST read this file first. It is the single source of shared context.

## Mission

supertool money-tracker is a **PoC, not an MVP** (Epic 3 retro, 2026-06-16). Before planning Epic 4,
produce a prioritized **gap backlog** (`_bmad-output/planning-artifacts/reference-parity-gap-backlog.md`)
that diffs the reference money tracker against the current supertool money-tracker.

**Parity bar:** same features as the reference, and UI/UX **at least as good** as the reference. **Mobile-first** — mobile is a hard requirement, not an afterthought.

The backlog is the input to `bmad-create-epics-and-stories` for Epic 4+. Write it so a planner can scope epics/stories directly from it.

## Hard constraint — ED1 (merge-blocking)

`example/` is **reference-only and git-ignored**. **Observe and describe behavior; NEVER import, copy, or paste code out of `example/`.** Configuration *patterns* may be carried later; code may not. Your job is analysis, not lifting code.

## Running services (already up — do not restart)

| Service | URL | Notes |
|---|---|---|
| Reference frontend | http://localhost:3000/ | landing → "Get Started" → sign-up → onboarding → app |
| Reference backend API | http://localhost:8080/api | NestJS |
| Reference Swagger | http://localhost:8080/swagger | full endpoint surface + DTOs |
| supertool API (current) | http://localhost:3001/api/v1 | the thing we're comparing against |

supertool's own frontend is NOT running (its dev binds `:3000`, which the reference occupies). Current-supertool baseline therefore comes from CODE (`apps/money-tracker`, `apps/api`), not a live capture, for this spike.

## Code locations

- Reference frontend: `example/track-my-life/apps/money-tracker/`
- Reference backend: `example/tracker-backend-api/`
- Current supertool frontend: `apps/money-tracker/`
- Current supertool backend: `apps/api/`

## Known reference surface (verified — use as a checklist, confirm/extend live)

**Frontend route groups** (`apps/money-tracker/src/app/[locale]/`):
- `(home-layout)` landing — HeroSection, AdvantagesSection, FaqSection, ReviewsSection, Footer
- `(auth-layout)` — sign-up, sign-in, verify-email, auth/callback, oauth-provider-buttons (Google/GitHub)
- `(onboarding-layout)/onboarding` — 3 steps: **currency → categories → password**
- `(app-layout)` — **dashboard, transactions (+ by-category, by-category/[categoryId] with bulk-delete), budgets, categories, settings**

**Backend "invisible" features** (not obvious from UI — enumerate these explicitly):
Redis cache module (`src/modules/cache`), Redis throttler / rate-limiting, Swagger docs, health checks (incl. Redis health), helmet + compression + cookie-parser, RFC-7807 problem-details error format, bulk-delete, offset pagination DTOs, OAuth (Google/GitHub), email verification + mailer.

**Transaction import** is a SEPARATE feature in the app (NOT an onboarding step) — discover it live.
The import dataset under test: `apps/api/src/database/data/transactions-02.03.25.json` (Ukrainian categories, two-level Category/Subcategory, UAH, ~hundreds of rows).

## Screenshot conventions (capture agents)

- Tool: `playwright-cli` (global). Each agent uses its OWN session: `playwright-cli -s=<name> <cmd>`.
- Read the page first with `playwright-cli -s=<name> snapshot` to get element refs, then `click`/`fill`/`select`/`upload`.
- Capture BOTH viewports per screen: **desktop `resize 1440 900`** and **mobile `resize 390 844`** (iPhone-class).
- `screenshot` saves to a timestamped path and prints it as `[Screenshot of viewport](<path>)`. Grab THAT exact path from stdout and copy it to the target name (avoids collisions between agents).
- Target dir: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/`
- Naming: `<area>--<screen>--<viewport>.png` e.g. `dashboard--overview--mobile.png`, `landing--hero--desktop.png`.
- Verify each shot by `Read`-ing the PNG; if it's blank/wrong, re-snapshot and retry.
- Note any UI-quality observations (spacing, hierarchy, empty states, responsiveness, polish) in your returned report — these become the "UI/UX delta" half of the backlog.

## Email-verification fallback (capture agents)

Signup sends a verification email; there is no local SMTP. Try the normal UI happy-path first (verification may be optional/async and onboarding may proceed regardless). If the UI hard-blocks on an unverified email, this is a TEST environment — recover the token from the reference Postgres (`users.emailVerificationToken`) or the backend process logs and hit the verify endpoint directly. Accounts are disposable; create as many as you need (e.g. `spike+<random>@example.com`).
