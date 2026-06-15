# Sprint Change Proposal — Currency Simplification + Seed Wording Reconciliation

- **Date:** 2026-06-15
- **Author:** Amelia (Developer) — correct-course
- **Project Lead:** Oleksii
- **Trigger source:** Epic 2 retrospective (`_bmad-output/implementation-artifacts/epic-2-retro-2026-06-15.md`); memories `currency-simplified-single-default`, `seed-data-has-subcategory`
- **Mode:** Batch · **Scope classification:** Moderate · **Status:** Applied

## 1. Issue Summary

Two planning-vs-reality drifts surfaced at the Epic 2 retro, both blocking a clean Epic 3 start:

1. **Currency filter superseded but not reconciled.** During Story 2.5 (2026-06-15) the product was simplified so currency is a single per-user default (chosen in profile/onboarding), not a selectable filter — and Story 2.5 shipped the transaction list with **no** currency filter. But the PRD, epics, and architecture still described a data-derived currency picker with a most-frequent fallback, and **Epic 3's stories 3.1/3.2/3.3 still required a currency picker** in their ACs. Drafting Epic 3 from that text would build the wrong thing.
2. **Seed described as flat, but it is two-level.** FR11/FR17 and the addendum described the seed as flat `{Date, Category, Type, Amount, Currency}`. The committed dataset carries a `Subcategory` on ~57% of records, and Story 2.1 shipped a two-level category hierarchy (Category→top-level, Subcategory→child).

## 2. Impact Analysis

- **Epic impact:** Epic 3 (Dashboard & Stats) — ACs only; story count and structure unchanged. Epic 2 — already shipped consistent with the new model; only stale descriptive text needed correcting.
- **Story impact:** 3.1, 3.2, 3.3 ACs reworded (no picker; profile-default currency; per-currency SQL retained). 2.1/2.5/2.6 descriptive text aligned to what shipped.
- **Artifact conflicts resolved:** `prd.md`, `prds/.../addendum.md`, `epics.md`, `architecture.md`, plus `.decision-log.md`.
- **Technical/code impact:** **None.** Epic 2 code already matches (no currency filter; two-level seed). Epic 3 is not yet implemented.

## 3. Recommended Approach

**Direct Adjustment** — modify the affected requirement text and Epic 3 ACs in place. No rollback, no MVP scope change. Two operator decisions taken at the retro shape it:
- **Drop the currency picker** everywhere (list + dashboard); scope all figures to the profile-default currency; keep per-currency SQL aggregation for correctness.
- **Drop the most-frequent fallback** — if the profile-default currency has no transactions in a period, figures are zero with a localized empty state.

## 4. Detailed Change Proposals (applied)

### PRD — `prd.md`
- **Journey "Monthly review"**: "confirms the month and currency filter" → "figures shown in profile-default currency, no currency picker."
- **FR5**: default currency is the single scoping currency, not a filter.
- **FR9**: filtered by **type and category** (currency removed).
- **FR13**: totals shown in the profile-default currency; no picker.
- **FR14**: rewritten — all figures scoped to the profile-default currency; no picker, no fallback; per-currency SQL retained; original mechanic noted as superseded.
- **FR15**: breakdown for the period in the profile-default currency.
- **FR11**: two-level category derivation (Category→top-level, Subcategory→child; ~57%).
- **FR17**: source shape `{…, Subcategory?}`; derives two-level set.

### PRD — `addendum.md`
- "Currency-filter mechanics" → "Currency handling (superseded 2026-06-15)": no picker/fallback; per-currency SQL retained; original mechanic kept for the record.
- Seed-import notes: source is two-level (`Subcategory` ~57%); derivation builds the two-level hierarchy.

### Epics — `epics.md`
- FR5/FR9/FR13/FR14/FR15 statements + FR9/FR11/FR14 inventory lines reconciled.
- "From PRD addendum" bullets: currency-single-default; two-level seed.
- Epic 3 overview reworded (profile-default currency, no picker).
- **Stories 3.1/3.2/3.3 ACs** reworded — endpoints called for a period in the profile-default currency; no currency filter AC; empty-state instead of fallback.
- Stories 2.1/2.5/2.6 stale "flat"/"currency filter" text aligned to what shipped (with an "as shipped" note on 2.5).

### Architecture — `architecture.md`
- F2–F4 summary: filters are type+category; dashboard scoped to profile-default currency; per-currency SQL retained.
- Component tree + F4 mapping: `currency-filter/` component removed.

### Decision log — `.decision-log.md`
- New `2026-06-15 — Update` entry recording the supersession and the seed correction.

## 5. Implementation Handoff

- **Scope:** Moderate — planning reconciliation, no code. No Developer implementation task beyond the already-shipped Epic 2 state.
- **Next:** Epic 3 is now safe to draft. `bmad-create-story` "create story 3.1" reads the corrected ACs. Recall the other Epic 3 critical-path prep item from the retro — **fix the Docker api build regression** (emit-openapi needs `SEED_OPERATOR_PASSWORD` at build time) before 3.1 — that one is a code task, tracked separately.
- **Success criteria:** no remaining "currency filter / picker / most-frequent fallback / flat seed" references in PRD/epics/architecture (verified); FR13–FR16 + 3.1/3.2/3.3 consistently describe profile-default-currency scoping with retained per-currency SQL.
