---
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-epic-coverage-validation, step-04-ux-alignment, step-05-epic-quality-review, step-06-final-assessment]
readinessStatus: READY
findingsTally: { critical: 0, major: 1, minor: 7 }
documentsIncluded:
  - prds/prd-supertool-2026-06-09/prd.md
  - prds/prd-supertool-2026-06-09/addendum.md
  - architecture.md
  - epics.md
  - briefs/brief-supertool-2026-06-09/brief.md
  - reference-parity-gap-backlog.md
  - sprint-change-proposal-2026-06-15.md
uxDocument: none-embedded-only
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-16
**Project:** supertool

## 1. Document Inventory

| Type | Primary Document | Format | Status |
| --- | --- | --- | --- |
| PRD | `prds/prd-supertool-2026-06-09/prd.md` (+ `addendum.md`) | Sharded | ✅ Found |
| Architecture | `architecture.md` | Whole | ✅ Found |
| Epics & Stories | `epics.md` | Whole | ✅ Found |
| UX Design | — | — | ⚠️ Not found (embedded only) |
| Project Brief (context) | `briefs/brief-supertool-2026-06-09/brief.md` | Sharded | ℹ️ Context |

**Issues flagged at discovery:**
- ⚠️ No standalone UX/UI design document — UX intent embedded in PRD/epics + driven by `example/track-my-life` reference parity (`reference-parity-gap-backlog.md`).
- ℹ️ Mid-flight assessment — Epics 1–3 already implemented (commits through story 3-3). Readiness focus weighted toward remaining work + traceability of shipped work.
- ✅ No duplicate whole/sharded conflicts.

## 2. PRD Analysis

Source: `prd.md` (status: final, updated 2026-06-10) + `addendum.md` (currency simplified 2026-06-15). Requirements grouped F1–F6 in the PRD.

### Functional Requirements (21)

**F1 — Platform shell & identity**
- **FR1**: Sign up / sign in with email + password (better-auth). No email verification, OAuth, or password recovery in v1.
- **FR2**: Single shared account store; sessions are per-app (signs in per tool app; concurrent sessions supported). Supersedes original cross-app shared session (architecture D5).
- **FR3**: Shared shell wraps every tool app — tool navigation, user menu (profile, sign out), locale switcher. v1 renders one tool entry (Money Tracker).
- **FR4**: Shell/auth/shared packages structured so a 2nd tool app is added by registration only — zero diffs to shell/shared UI/widgets/auth/existing apps; new API modules additive only. Verified at architecture via "register tool #2" walkthrough.
- **FR5**: View/edit minimal profile settings: name, default currency, locale. Default currency scopes dashboard+lists (not a selectable filter).
- **FR21**: Every user has role `user`/`admin` from day one. No admin features in v1; promotion is seed/DB-only. All data scoped to authenticated user — no cross-user paths. (Architecture D6.)

**F2 — Transactions**
- **FR6**: Create transaction: type (income/expense), amount, currency, category, date (defaults today), optional note. Optimized for speed (NFR5). Imported records get empty note.
- **FR7**: Edit and delete any of own transactions.
- **FR8**: View transactions for a date range, defaulting to current month, with prev/next month navigation.
- **FR9**: List filterable by type and category; sortable by date or amount. Currency is NOT a filter dimension (superseded 2026-06-15).

**F3 — Categories**
- **FR10**: Create, rename, delete categories in a parent/child hierarchy.
- **FR11**: Category set initially populated from seed as two-level hierarchy (Category → top-level, Subcategory → child; ~57% of records carry Subcategory); user restructures afterward.
- **FR12**: Deleting a category with transactions or children requires reassignment — no orphaned/uncategorized data.

**F4 — Dashboard & stats**
- **FR13**: Dashboard shows, for selected period (default current month): total income, expense, net — all in profile-default currency. No currency picker.
- **FR14**: All dashboard figures scoped to profile-default currency; no currency picker, no cross-currency aggregation. Per-currency computed in SQL for correctness but not user-selectable. (Simplified 2026-06-15.)
- **FR15**: Dashboard shows expense breakdown by category for the period (profile-default currency), grouped by top-level category where hierarchy exists.
- **FR16**: Dashboard shows month-over-month trend (income/expense) across trailing 12-month window.

**F5 — Data seeding & integrity**
- **FR17**: Repeatable, idempotent seed imports `transactions-02.03.25.json` (1,880 records): derives two-level category set, preserves amount/currency/date exactly, attaches to operator account. Re-run does not duplicate.
- **FR18**: All money values stored and computed decimal-safe — no float drift, asserted by tests on stats math and import totals.

**F6 — Internationalization**
- **FR19**: All user-facing strings localized; v1 ships English + Ukrainian, switchable from shell, persisted per user.
- **FR20**: CI enforces locale key parity — missing translation key fails pipeline.

**Total FRs: 21** (FR1–FR21; note FR-numbering is contiguous, F-groups are thematic).

### Non-Functional Requirements (8)

- **NFR1 — Tests per feature**: every feature merges with its tests same story; CI required check. Priority: money math, seed/import integrity, auth/sessions, per-user scoping.
- **NFR2 — Quality gates**: oxlint, oxfmt, type-check, stylelint, commitlint, CodeRabbit on every PR. No eslint/prettier anywhere.
- **NFR3 — Local-first runtime**: entire platform runs locally via Docker (PostgreSQL + apps), documented single-command startup. No deployment in v1.
- **NFR4 — Privacy posture**: private repo; real seed committed; nothing exposes data beyond local (no analytics/telemetry).
- **NFR5 — Entry speed**: daily-entry flow (FR6) is the performance anchor — form reachable in one interaction, submit-to-visible without full page reload.
- **NFR6 — API contract**: frontend consumes API exclusively via generated OpenAPI client; hand-written fetch is a defect.
- **NFR7 — Design system**: UI built from carried-over design system (shared UI package + Storybook); tracker screens follow example app UX patterns (operator-approved).
- **NFR8 — Mobile-usable**: daily-entry flow + transaction list fully usable in mobile browser (responsive). No native/PWA in v1.

**Total NFRs: 8**

### Engineering & Delivery Requirements (treated as first-class — the process is half the product)

- **ED1**: `example/` repos are reference-only; code never committed. Features rebuilt, not pasted.
- **ED2**: Every commit on `main` traces to a planned story; planning artifacts committed.
- **ED3**: Base setup carried over from examples as deduplicated config, exact versions (oxlint/oxfmt/stylelint, commitlint/husky/lint-staged, merged CI, one `.coderabbit.yaml`, merged AI setup).
- **ED4 — Stack (locked)**: Next.js 16 / React 19 / TS / SCSS · next-intl · NestJS · Drizzle + PostgreSQL · better-auth · pnpm + Turborepo · Docker · @hey-api/openapi-ts client gen.

### Additional Requirements / Constraints

- **Out of scope for v1** (each a candidate future epic): recurring transactions, budgets, accounts/wallets/transfers, onboarding flow, CSV import/export UI, OAuth/email-verification/password-recovery, full settings, cross-app SSO, admin panel, multi-currency FX/cross-currency aggregation, Redis caching, deployment, additional locales, sharing/multi-tenant, native/PWA, tool #2.
- **Risks**: oxlint-on-NestJS friction; seed category-string near-duplicates needing normalization (surface at import, don't silently merge); scope gravity (examples ~80% complete — ED1 is the guardrail).
- **Assumptions**: all resolved/confirmed (2026-06-09 + 2026-06-10). No open assumptions remain.

### PRD Completeness Assessment (initial)

- ✅ **Strong**: FRs and NFRs are individually numbered, atomic, and testable; supersession history (currency, sessions, seed two-level) is explicitly logged with dates and decision-log references — excellent traceability hygiene.
- ✅ **Acceptance criteria embedded** for the high-risk platform requirement (FR4 has a concrete "register tool #2" acceptance check).
- ⚠️ **UX coverage is by reference, not specification**: NFR7 defers UI to "example app patterns, operator-approved" and the PRD marks `bmad-ux` as "likely skippable". This is a deliberate, documented choice, but it means there is no independent UX acceptance baseline in the planning set — UX correctness is being validated post-hoc via the reference-parity backlog. Flag for the UX-completeness step.
- ⚠️ **NFR5/NFR8 are qualitative** ("under ~10 seconds", "fully usable in mobile browser") — no measurable threshold or test method specified. Acceptable for a solo PoC but worth noting as un-gated.
- ℹ️ Currency simplification (FR9/FR13/FR14) was a mid-flight scope change (Epic 2 retro) — the PRD and addendum were kept in sync, which is the correct hygiene.

## 3. Epic Coverage Validation

The epics document carries an explicit **FR Coverage Map** (lines 129–151) plus per-epic "FRs covered" tags, and a separate **Parity Requirements Coverage Map** (RP-F/RP-B/RP-U → Epics 4–7/Deferred). I validated each PRD FR against actual story-level acceptance criteria, not just the self-declared map.

### FR Coverage Matrix (PRD FR → Epic/Story)

| FR | Requirement (short) | Epic | Story-level coverage | Status |
| --- | --- | --- | --- | --- |
| FR1 | Email+password sign-up/sign-in | 1 | Story 1.5 | ✅ Covered |
| FR2 | Shared account, per-app sessions | 1 | Story 1.5 (concurrent-session AC) | ✅ Covered |
| FR3 | Shared shell (nav, user menu, locale) | 1 | Story 1.4 | ✅ Covered |
| FR4 | Register-tool-#2, zero-diff | 1 | Story 1.4 (registry AC) | ✅ Covered |
| FR5 | Minimal profile settings | 1 | Story 1.6 | ✅ Covered |
| FR6 | Create transaction, fast | 2 | Story 2.3 | ✅ Covered |
| FR7 | Edit/delete own transactions | 2 | Story 2.4 | ✅ Covered |
| FR8 | Month-windowed list + prev/next | 2 | Story 2.2 | ✅ Covered |
| FR9 | Filter (type/category), sort (date/amount) | 2 | Story 2.5 | ✅ Covered |
| FR10 | Hierarchical category CRUD | 2 | Story 2.6 | ✅ Covered |
| FR11 | Two-level category set from seed | 2 | Story 2.1 + 2.6 | ✅ Covered ⚠️ (see inconsistency below) |
| FR12 | Reassign-on-delete, no orphans | 2 | Story 2.6 | ✅ Covered |
| FR13 | Period totals (income/expense/net) | 3 | Story 3.1 | ✅ Covered |
| FR14 | Profile-default-currency scoping | 3 | Story 3.1/3.2/3.3 | ✅ Covered |
| FR15 | Expense breakdown by top-level category | 3 | Story 3.2 | ✅ Covered |
| FR16 | Trailing-12-month trend | 3 | Story 3.3 | ✅ Covered |
| FR17 | Idempotent seed of 1,880 records | 2 | Story 2.1 | ✅ Covered |
| FR18 | Decimal-safe money math, test-asserted | 2 | Story 2.1 (+ asserted in 3.1/3.2/3.3) | ✅ Covered |
| FR19 | EN+UK i18n, per-user persistence | 1 | Story 1.4 + 1.6 (rule binds every story) | ✅ Covered |
| FR20 | CI locale key-parity gate | 1 | Story 1.4 | ✅ Covered |
| FR21 | Roles + per-user data scoping | 1 | Story 1.5 (+ scoping asserted throughout) | ✅ Covered |

**NFRs/EDs** are cross-cutting and woven into story ACs and architecture decisions (D1–D10), not mapped 1:1 to a single story — verified present: NFR1 (tests-in-story ACs everywhere), NFR2 (Story 1.1 gates), NFR3 (Story 1.7), NFR4 (Stories 1.2/1.7), NFR5 (Story 2.3), NFR6 (Story 1.3 drift gate), NFR7 (Stories 1.4/1.8–1.11), NFR8 (mobile ACs in 2.2/2.3 + entire Epic 4). ED1–ED4 embedded in Story 1.1 + the evidence-reference convention.

### Coverage Statistics
- **Total PRD FRs: 21**
- **FRs covered in epics (with story-level ACs): 21**
- **Coverage: 100%** ✅
- FRs in epics but not in PRD: **none** (FR set is identical; RP-* parity items are explicitly labelled *derived product requirements, not new PRD FRs* — and are themselves fully mapped to Epics 4–7/Deferred with none dropped).

### Missing Requirements
**None.** Every PRD FR has a traceable implementation path, and Epics 1–3 (FR1–FR21) are already shipped (commits through story 3-3). Parity requirements (RP-F1–F11, RP-B1–B10, RP-U1–U6) each map to an epic or to an explicit, decision-backed Deferred bucket.

### Coverage Observations (non-blocking)
1. ⚠️ **Stale FR11 restatement in the epics Requirements Inventory.** `epics.md:51` still states FR11 as the *pre-2026-06-15 flat* version ("populated from distinct category strings ... as top-level categories"), contradicting the corrected PRD FR11 (two-level Category→Subcategory) — even though the FR Coverage Map (`epics.md:141`) and Story 2.1 ACs correctly implement two-level. The implemented behaviour is correct; only the inventory paragraph is stale. **Recommend a one-line correction** to keep the artifact trail (ED2) internally consistent — this is pitch material a reviewer will read.
2. ℹ️ **FR-coverage map is healthy and self-consistent** otherwise; the parity round (Epic 4+) extends rather than re-opens the FR set, which is the right modelling — no FR was silently re-scoped.
3. ℹ️ **Deferred items are tracked, not dropped** (RP-F6 recurring, RP-F11 budgets, RP-B4/B5/B7/B8, timestamptz tech debt) with explicit operator decisions RP-D1–D7 — good traceability discipline.

## 4. UX Alignment Assessment

### UX Document Status
**Not Found (deliberate).** No standalone `*ux*` artifact exists. `bmad-ux` was intentionally skipped per **NFR7** and the PRD decision log: tracker screens mirror the operator-approved `example/track-my-life` UX patterns; UI is built from the shared `ui` package + Storybook. UX is unmistakably **implied** — this is a user-facing, mobile-first web application — so the "no UX doc" choice does not mean "no UX requirements."

### De-facto UX baseline (what stands in for a UX spec)
1. **NFR7/NFR8** — qualitative UX constraints (follow example patterns; mobile-usable daily-entry + list).
2. **`reference-parity-gap-backlog.md`** + the reference-parity spike captures (`visual-qa/spike-reference-parity/reference/` vs `…/supertool/`) — the **screenshot-level UX acceptance baseline** for Epic 4+.
3. **Story 1.9 visual-QA protocol** — the repeatable UX gate (light+dark, both viewports, side-by-side reference comparison in the Dev Agent Record) now binding on every design-system and Epic 4+ story.
4. **The evidence-reference convention** (Epic 4+) — each story must cite the reference screenshot + supertool baseline + `example/` code path.

### UX ↔ PRD Alignment
- ✅ The PRD's two primary usage flows (daily entry < ~10s; one-screen monthly review) are reflected directly in Story 2.3 (NFR5 anchor) and Epic 3 dashboard stories.
- ✅ Currency-simplification (single default, no picker) is consistently honoured across every UX-bearing story and explicitly guarded against reintroduction (RP-D1).
- ✅ No UX requirement exists that is absent from the PRD/epics — the parity backlog *extends* PRD UX (mobile drawer, stacked list, onboarding) and is mapped to epics.

### UX ↔ Architecture Alignment
- ✅ Architecture **explicitly supports** the implied UX: `architecture.md:419` assigns responsive duty to `ui`/`widgets` with **shared SCSS breakpoint mixins** (`packages/ui/src/styles`); NFR7→`ui`+Storybook; NFR8→responsive components.
- ✅ Performance/responsiveness UX needs (NFR5 submit-to-visible-without-reload) are architecturally realised via D9 (server actions + `revalidatePath`, URL-search-param state).
- ✅ Theming (light/dark via `next-themes`, `[data-theme]`) and i18n (next-intl, EN/UK) are supported and protected as strengths (§6).
- ✅ No UI component need is identified that the architecture cannot support.

### Warnings / Alignment Gaps
1. 🔴 **The "UX is skippable" assumption was materially wrong — and this is the single most important readiness finding.** The PRD asserted `bmad-ux` is "likely skippable" because UI mirrors the approved reference. In practice the absence of a UX/visual acceptance spec let **multiple UI stories ship visually broken behind green gates** (Story 1.4 → required corrective Stories 1.8/1.9; the Epic 3 retro found **supertool mobile is broken while the reference's is solid**, forcing an entire corrective **Epic 4**). The mechanical gates (tests/axe/attribute checks) never *looked* at rendered output. **This is now mitigated** by the Story 1.9 visual-QA protocol + reference-parity evidence convention — but the mitigation is process discipline, not an artifact gate, so it depends on every story author actually executing it.
2. ⚠️ **NFR5/NFR8 remain qualitative** ("~10 seconds", "fully usable") — no measurable threshold or automated check. Visual QA is human-in-the-loop screenshots, not an enforced CI gate. Acceptable for a solo PoC, but it means UX correctness has **no merge-blocking gate** the way FR/i18n/lint do.
3. ℹ️ **No accessibility spec beyond the Storybook a11y addon.** WCAG is not a stated v1 requirement (reasonable for a single-operator PoC), but worth noting the a11y addon is the only a11y signal.

### Verdict
UX is **adequately covered for a reference-parity PoC**, given the strong mitigation now in place (visual-QA protocol + screenshot baselines + Epic 4 mobile-first corrective epic). The residual risk is that the UX gate is **process-enforced, not artifact-enforced** — its effectiveness rides entirely on disciplined execution of the Story 1.9 protocol in each Epic 4+ story.

## 5. Epic Quality Review

Reviewed all **7 epics / 30 stories** against create-epics-and-stories standards (user value, independence, no forward dependencies, sizing, AC quality, just-in-time schema, starter template). Epics 1–3 are shipped; Epics 4–7 are the forward-looking planning under scrutiny.

### A. User-Value Focus
| Epic | Title | Verdict |
| --- | --- | --- |
| 1 | Platform Foundation & Identity | 🟡 Borderline-but-acceptable — framed as user outcomes (run locally, sign up, navigate, edit settings) though it carries pure-technical enabler stories (1.1–1.3). Standard greenfield Epic 1 pattern. |
| 2 | Transactions & Categories | ✅ Strong user value |
| 3 | Dashboard & Stats | ✅ Strong user value ("answer where did money go in one screen") |
| 4 | Mobile-First & Existing-Screen Quality | ✅ User value (usable + polished on phone) — a quality/defect epic, correctly framed around what the user can now do |
| 5 | Import Your Data & See Your Money | ✅ Strong user value (the import→see spine) |
| 6 | Manage Transactions at Scale | ✅ User value (power-user management) |
| 7 | Account & Landing | ✅ User value (self-service + public face) |

No epic is a disguised technical milestone. ✅

### B. Epic Independence & Dependencies
- ✅ Dependencies are declared **strictly forward** (`epics.md:189`): 2→1, 3→2, 4 stabilises baseline, 5 builds on 4, 6 enriches, 7 completes. Each epic is stated to deliver standalone value.
- ✅ **No forward (Epic N → Epic N+1) dependencies found.** Cross-story references all point backward (e.g., Story 6.1/5.5 "compose with the 4.3 auto-fit"; Story 6.2 "builds on 5.6 + 4.2"). Verified by scanning every "builds on / composes with / reuses" reference.
- ✅ The **reference-parity spike** is correctly modelled as a hard gate ("BLOCKS next-epic planning") and is marked complete — Epic 4+ planning legitimately proceeds from its backlog.

### C. Within-Epic Story Ordering & Just-in-Time Schema
- ✅ **Schema is created when first needed, never all-upfront** — exemplary. `transactions`/`transaction_categories` land in Story 2.1 (Epic 2, not Epic 1); auth/users tables in Story 1.5; name fields in Story 7.1; import (5.1) and search (6.4) add indexes/tables only in their own stories. This directly satisfies the standard's "tables created only when first needed."
- ✅ Story ordering within epics is dependency-correct (endpoint stories precede their consuming UI stories: 5.1→5.2→5.3, 5.4→5.5).

### D. Starter Template
- ✅ Architecture specifies a custom scaffold blueprint; **Story 1.1 "Monorepo Scaffold & Quality Gates"** is the first story and covers workspace setup, pinned deps, gates, and AI setup. Requirement satisfied.

### E. Acceptance-Criteria Quality
- ✅ **Outstanding.** Every story uses Given/When/Then BDD structure, and ACs are testable, specific, and consistently cover **error, empty, mobile, and i18n (both-locales)** paths — not just the happy path. This is well above typical readiness.
- 🟡 A few ACs are **over-specified with implementation detail** (e.g., Story 1.9 encodes the exact Select CSS root cause — `popperViewport width 75px` — and the fix). This is deliberate post-bug remediation context rather than a defect, but it couples the AC to one implementation.

### Findings by Severity

#### 🔴 Critical Violations
- **None.** No technical-milestone epics, no forward dependencies, no epic-sized unstartable stories.

#### 🟠 Major Issues
1. **Horizontal-slice "operator-developer" stories.** Stories **5.1** (import endpoint), **5.4** (analytics endpoints), **6.5** (caching), and arguably **1.2/1.3/7.5** are framed "As the operator-developer, I want [backend capability]" — they deliver **no standalone end-user value**; the user only benefits when the paired frontend story (5.2, 5.5, …) lands. Strict BMad practice prefers vertical slices. **Mitigation present:** each is paired with its consumer **inside the same epic**, ordered before it, with a contract-first rationale (generated-client drift gate D8 makes a separate endpoint story defensible). **Recommendation:** keep the split (it fits the OpenAPI-contract architecture) but be aware these stories cannot be demoed alone — don't treat their individual completion as user-facing progress.

#### 🟡 Minor Concerns
1. **Stale FR11 restatement** in the epics Requirements Inventory (`epics.md:51`) — flat vs. corrected two-level (also flagged in §3). One-line fix.
2. **Dual-status Epic 4–7 prose.** Lines 839–849 present "candidate epic themes … a starting proposal — step 2 finalizes them," yet Epics 4–7 are then fully written out below with finalized stories. The proposal/finalized boundary is ambiguous on a skim. **Recommendation:** mark the candidate-themes section as superseded by the finalized epics to avoid a reviewer reading stale planning.
3. **Epic 1 is heavy (11 stories), four added mid-flight (1.8–1.11).** Indicates the design system was initially under-scoped — a planning lesson (already captured in retros), not a defect in the current stories, which are well-formed.
4. **Over-specified ACs** (Story 1.9 Select internals) as noted in §E.
5. **Story 5.5 is large** (3 widgets + filter bar in one story) — splittable, but acceptable given shared period/currency context.

### Best-Practices Compliance Checklist
- [x] Epics deliver user value (Epic 1 borderline but acceptable)
- [x] Epics function independently / forward-only dependencies
- [x] Stories appropriately sized (one large: 5.5)
- [x] No forward dependencies
- [x] Database tables created when needed (exemplary)
- [x] Clear, testable acceptance criteria (outstanding)
- [x] Traceability to FRs / RP-items maintained

### Verdict
Epic/story structure is **high quality and implementation-ready.** The only substantive critique is the deliberate horizontal endpoint/UI split (🟠), which is an accepted trade-off for the contract-first architecture, not a blocker. All other findings are cosmetic/hygiene.

## 6. Summary and Recommendations

### Overall Readiness Status

## ✅ READY (for Epic 4+ implementation)

This is a **mid-flight** assessment: Epics 1–3 (FR1–FR21) are already shipped and merged (commits through story 3-3). The planning set for the remaining work — Epics 4–7, derived from the completed reference-parity spike — is complete, traceable, and implementation-ready. **No critical (🔴) or readiness-blocking issues were found.** The artifact trail (brief → PRD → architecture → epics → stories → commits) is intact and is itself pitch-grade, as intended.

### Findings tally
- 🔴 Critical: **0**
- 🟠 Major: **1** (horizontal endpoint/UI story split — an accepted contract-first trade-off, not a blocker)
- 🟡 Minor: **7** (across PRD, coverage, UX-gate, epic-quality categories)
- Scope: 4 planning docs assessed, 21 FRs + 8 NFRs + 4 EDs traced, 7 epics / 30 stories reviewed.

### Critical Issues Requiring Immediate Action
**None.** Implementation of Epic 4 may proceed.

### Highest-value findings (not blocking, but worth acting on)
1. **The "UX is skippable" assumption was the project's most expensive planning miss.** Skipping `bmad-ux` let UI ship visibly broken behind green gates (1.4 → corrective 1.8/1.9; broken mobile → corrective Epic 4). It is now mitigated by the Story 1.9 visual-QA protocol + reference-parity evidence convention — but that gate is **process-enforced, not artifact/CI-enforced**. Its value depends entirely on each Epic 4+ author actually executing the screenshot comparison. This is the single biggest residual risk.
2. **Horizontal "operator-developer" backend stories** (5.1, 5.4, 6.5) deliver no standalone user value — don't mistake their completion for user-facing progress; track them as enablers paired with their consuming UI story.
3. **Stale FR11 restatement** (`epics.md:51`) contradicts the corrected two-level PRD FR11 — a documentation-trail inconsistency in pitch material.

### Recommended Next Steps
1. **Proceed to Epic 4 (Mobile-First & Existing-Screen Quality)** — it correctly sequences the spike's central finding (broken mobile) first; no planning blocker stands in the way. Use `bmad-create-story` to draft Story 4.1.
2. **Fix the stale FR11 paragraph** in `epics.md:51` to match the corrected two-level PRD FR11 (one-line edit) and **mark the candidate-epic-themes prose (`epics.md:839–849`) as superseded** by the finalized Epics 4–7, keeping the artifact trail clean.
3. **Harden the UX gate from process to artifact.** Consider making the Story 1.9 visual-QA evidence (light/dark + both viewports + reference comparison) a **required checklist item in the story Definition of Done / PR template**, so it is reviewable rather than relying on author discipline alone — this directly addresses the project's recurring failure mode.
4. **Optionally formalise NFR5/NFR8 thresholds** (e.g., a concrete entry-flow interaction count, a target mobile breakpoint set) so "mobile-usable" has an objective bar — low effort, closes the qualitative-NFR gap.
5. **Confirm the deferred RP-D7 backend decisions** (in-memory cache for RP-B3, helmet/compression for RP-B10, defer Redis rate-limit) at the start of Epics 6/7 design, as the epics doc itself notes ("confirm during epic design").

### Final Note
This assessment identified **8 issues across 4 categories** (1 major, 7 minor; zero critical). None block implementation. The planning artifacts are in strong shape — traceability is 100% on FRs, epic structure follows best practices, and the one historically costly gap (UX validation) has a working mitigation. Address the minor documentation fixes (FR11, candidate-themes prose) opportunistically and consider hardening the UX gate; otherwise the project is clear to proceed to Epic 4.

---

**Assessment date:** 2026-06-16
**Assessor:** Implementation-Readiness review (PM role), facilitated for Oleksii
**Documents assessed:** `prd.md` (+addendum), `architecture.md`, `epics.md`, reference-parity backlog (context); prior report `implementation-readiness-report-2026-06-10.md`
**Status:** ✅ READY — proceed to Epic 4

### Remediation applied (2026-06-16, same session)
- ✅ **UX gate hardened from process to artifact** — added `.github/pull_request_template.md` with a Definition-of-Done checklist that makes the Story 1.9 visual-QA evidence (both themes, both viewports, open states, reference comparison) a **required, reviewable checklist item** on every UI-touching PR (alongside i18n-parity, generated-client, money-as-strings, tests-in-story gates). Complements the existing story-level `bmad-*-story.toml` persistent facts.
- ✅ **FR11 corrected** in `epics.md` Requirements Inventory — now states the two-level (Category→Subcategory) hierarchy, matching the corrected PRD FR11.
- ✅ **Candidate-epic-themes section marked SUPERSEDED** (`epics.md:839`) — canonical Epic 4–7 sections called out explicitly; the "starting proposal" note neutralised to historical.
- ◻️ Not actioned (acknowledged): horizontal "operator-developer" enabler stories (5.1/5.4/6.5) tracked as enablers, not standalone user value; optional NFR5/NFR8 threshold formalisation; RP-D7 backend confirmations at Epic 6/7 design time.
