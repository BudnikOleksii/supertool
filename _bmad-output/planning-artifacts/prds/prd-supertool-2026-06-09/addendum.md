# Addendum — supertool PRD

Technical depth and rationale for downstream phases (architecture, epics). The brief's addendum at `_bmad-output/planning-artifacts/briefs/brief-supertool-2026-06-09/addendum.md` remains the canonical reference for example-repo inventories, deferred-feature detail, .coderabbit/AI-setup merge notes, and better-auth design input — not duplicated here.

## Platform semantics (user-stated, architecture input)

- Tools are **separate apps** in the monorepo (e.g. `apps/money-tracker`, later `apps/planner`), not routes in one app.
- Shared shell is a package consumed by every tool app (navigation, user menu, locale switcher).
- Single login = one user account + one session valid across all tool apps — *as originally stated*. **Superseded at architecture (2026-06-10, operator override, decision D5)**: one shared account store, but sessions are per-app (each app proxies the API same-origin, so cookies — and therefore sessions — are per-app by construction). The shared-session sketch in this bullet is retained for the record only; `architecture.md` is canonical.

## Currency handling (FR13–FR16) — superseded 2026-06-15

- **Superseded (Epic 2 retro, 2026-06-15):** currency is simplified to a single per-user default (FR5). There is **no currency picker** on the transaction list or the dashboard, and **no most-frequent fallback**. All figures are scoped to the profile-default currency.
- Per-currency computation is **retained server-side** in the analytics SQL aggregations (so multi-currency data never cross-aggregates if it ever appears), but the currency is not user-selectable. The example app's data-derived currency filter is **not** carried into v1.
- _Original (superseded) mechanic, kept for the record:_ a dashboard currency filter whose option list derived from the user's distinct transaction currencies, defaulting to the profile default and falling back to the most-frequent currency.

## Seed import notes (FR17)

- Source: `example/tracker-backend-api/src/database/data/transactions-02.03.25.json` — 1,880 records, `{Date, Category, Type, Amount, Currency, Subcategory?}` (a `Subcategory` is present on ~57% of records; the source is two-level, not flat — corrected 2026-06-15).
- Idempotency: natural-key dedup (date + amount + category + currency + index) or content hash — decide in architecture; re-run safety is a test target.
- Category derivation: each distinct `Category` → top-level category, each distinct `Subcategory` → child under its parent (two-level hierarchy from day one; user-restructured afterwards, FR11); surface near-duplicate strings at import for explicit normalization (risk noted in PRD).
- No note/description field in seed — imported transactions get empty notes (FR6's note field is for new entries).

## Rationale captured during discovery

- **Trimmed v1 core** chosen over example parity to maximize the feature-by-feature commit narrative (pitch evidence) — each deferred feature is a future epic.
- **Real seed committed to a private repo** chosen over synthetic/anonymized data: simplicity wins; privacy is handled by repo access, enforced by NFR4 (no telemetry/external exposure).
- **UX inherited from example app** — operator explicitly satisfied with existing flows; this is why `bmad-ux` is marked likely-skippable in the PRD.
- **No hard deadline** — epic sizing should favor a clean trail over speed.
