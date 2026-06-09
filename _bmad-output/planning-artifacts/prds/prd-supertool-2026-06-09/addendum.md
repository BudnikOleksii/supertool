# Addendum — supertool PRD

Technical depth and rationale for downstream phases (architecture, epics). The brief's addendum at `_bmad-output/planning-artifacts/briefs/brief-supertool-2026-06-09/addendum.md` remains the canonical reference for example-repo inventories, deferred-feature detail, .coderabbit/AI-setup merge notes, and better-auth design input — not duplicated here.

## Platform semantics (user-stated, architecture input)

- Tools are **separate apps** in the monorepo (e.g. `apps/money-tracker`, later `apps/planner`), not routes in one app.
- Shared shell is a package consumed by every tool app (navigation, user menu, locale switcher).
- Single login = one user account + one session valid across all tool apps. With separate Next.js apps, this implies a shared session mechanism (e.g. shared cookie scope and a shared better-auth instance/package) — design in architecture together with the better-auth × NestJS question.

## Currency-filter mechanics (FR13–FR16)

- Example app precedent: dashboard currency filter; per-currency computation server-side via analytics endpoints.
- Filter option list derives from distinct currencies in the user's transactions; default selection is the profile default currency (FR5). If the profile default currency has no transactions, fall back to the most frequent currency in the user's transactions.

## Seed import notes (FR17)

- Source: `example/tracker-backend-api/src/database/data/transactions-02.03.25.json` — 1,880 records, flat `{Date, Category, Type, Amount, Currency}`.
- Idempotency: natural-key dedup (date + amount + category + currency + index) or content hash — decide in architecture; re-run safety is a test target.
- Category derivation: distinct `Category` strings → top-level category entities (hierarchy is user-restructured afterwards, FR11); surface near-duplicate strings at import for explicit normalization (risk noted in PRD).
- No note/description field in seed — imported transactions get empty notes (FR6's note field is for new entries).

## Rationale captured during discovery

- **Trimmed v1 core** chosen over example parity to maximize the feature-by-feature commit narrative (pitch evidence) — each deferred feature is a future epic.
- **Real seed committed to a private repo** chosen over synthetic/anonymized data: simplicity wins; privacy is handled by repo access, enforced by NFR4 (no telemetry/external exposure).
- **UX inherited from example app** — operator explicitly satisfied with existing flows; this is why `bmad-ux` is marked likely-skippable in the PRD.
- **No hard deadline** — epic sizing should favor a clean trail over speed.
