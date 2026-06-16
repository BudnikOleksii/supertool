# Reference-Parity Gap Backlog

> **Status:** COMPLETE — produced by the Reference-Parity Gap Analysis spike (`spike-reference-parity`), 2026-06-16.
> **Parity bar:** same features as the reference (`example/track-my-life` + `example/tracker-backend-api`), and UI/UX **at least as good**, **mobile-first**.
> **Method:** static inventory of reference FE + BE, static inventory of current supertool FE + BE, and live browser capture of the running reference (80 screenshots, both viewports, with the real 1,880-row dataset imported).
> **Feeds:** `bmad-create-epics-and-stories` for Epic 4+.
> **Evidence:** `_bmad-output/implementation-artifacts/spike-reference-parity/` (inventories 10/20/30, capture logs 40/41) + `…/visual-qa/spike-reference-parity/reference/` (80 PNGs).

## How to read this

Each gap is one planner-ready row. Priority: **P0** = required for parity / blocks the core import→see-your-money flow; **P1** = expected for a credible product; **P2** = polish or an explicit decision. The reference is **template-grade with real bugs** (§5) — "at least as good" means we *exceed* it on the screens we touch, and never replicate its defects. Where supertool already beats the reference (§6), protect that.

---

## 1. Feature gaps — Frontend

| # | Area | Reference has | supertool today | Gap → action | Pri | Evidence |
|---|------|---------------|-----------------|--------------|-----|----------|
| F1 | Onboarding | Post-signup flow: **currency → categories (assign defaults OR import file)**; lands on dashboard. (Live: 2 steps; code has a 3rd `password` step that's not exercised.) | None — signup drops straight into app | Build an onboarding flow (currency default + category seeding/import). | **P0** | `onboarding--currency`, `onboarding--categories` |
| F2 | Transaction import | Rich client import: file upload → **validate → preview row counts → summary → server execute**; auto-creates categories/subcategories. CSV (papaparse) + JSON. Wired into onboarding AND a standalone page. | Import is **seed-only** (boot script); no user-facing import | Build user-facing import (upload, preview, execute) reusing the seed ingest logic. Make the standalone page first-class (reference's is a bare `<input>`). | **P0** | `import--upload/preview/result/page` |
| F3 | Dashboard widgets | **6 widgets**: summary, donut breakdown, income/expense trend bars, **top-categories ranked**, **daily-spending bar**, **recent-transactions list** + a date-range/type filter bar | **3 widgets**: summary, expense breakdown, 12-month trend | Add top-categories, daily-spending, recent-transactions widgets + dashboard filter bar. **Fix the reference's bugs while doing it** (see §5: empty default period, daily-spending range, donut render). | **P0** | `dashboard--overview*` |
| F4 | Transactions by-category | Drill-down accordion: categories → category-detail with per-category transaction list + bulk delete | None | Build by-category view + category-detail. Add the per-category totals/counts the reference omits (§5). | **P1** | `transactions--by-category`, `--category-detail` |
| F5 | Bulk delete | Multi-select + fixed action bar ("N selected / select-all / clear / delete"), cap 100, partial-failure re-selection | None | Build bulk delete — **consistent across list AND by-category** (reference only wires it on by-category) and **touch-usable** (not hover-only). | **P1** | `transactions--bulk-delete-bar` |
| F6 | Recurring transactions | Whole subtree: list, create (frequency/interval), pause/resume (optimistic), status filter, bulk delete | None | Net-new feature: recurring-transaction CRUD + lifecycle. Largest single FE+BE item. | **P1** | `transactions--recurring`, `--recurring-create` |
| F7 | Export | Server-generated CSV + JSON, scoped + all | None | Add export (CSV/JSON) to the transactions list. | **P1** | `transactions--export` |
| F8 | Marketing landing | Single-page marketing site (hero, advantages, reviews, FAQ, footer) | Bare 3-link placeholder at `/` | Build a real landing page. Low bar to beat (reference is sparse, emoji icons, **broken FAQ**). | **P1** | `landing--*` |
| F9 | Transactions list UX | Copy/duplicate transaction; month/year navigator; sort; hierarchical category picker; time picker | Month browse + filter/sort + pagination; create/edit | Add duplicate, richer category picker, time-of-day (needs date→timestamptz, see T3). | **P2** | `transactions--create-category-picker` |
| F10 | Settings | Profile (name/country/currency), change-password, **delete-account** (with confirm dialog) | Name, locale, default currency | Add change-password + delete-account. First/last name actually collected. | **P2** | `settings--*` |
| F11 | Budgets | **Stub only** — heading, no CRUD (backend `Budget` table exists) | None | LOW value to mirror a stub. **Decision:** build *real* budgets (would exceed reference) or defer. See §7. | **P2** | `budgets--overview` |

## 2. Feature gaps — Backend (incl. non-visible)

Reference BE: 15 modules, ~49 endpoints. supertool BE: auth/health/users/transaction-categories/transactions/analytics.

| # | Capability | Reference | supertool | Action | Pri |
|---|-----------|-----------|-----------|--------|-----|
| B1 | `POST /transactions/import` | Multipart JSON/CSV ingest, auto-creates categories | seed-only | Build import endpoint behind F2. | **P0** |
| B2 | Analytics endpoints | + `top-categories`, `daily-spending` | summary/breakdown/trend | Add the two missing analytics endpoints behind F3. | **P0** |
| B3 | Redis caching (`CacheModule`) | Analytics + list responses cached, TTLs, cache-tag invalidation | none (cold Postgres every call) | Add caching layer (decide Redis vs in-memory for a local PoC). | **P1** |
| B4 | Rate limiting | Redis-backed throttler on auth + expensive routes | in-memory throttle on auth only | Decide whether Redis-backed throttling is worth it locally. | **P2** |
| B5 | Recurring engine | Table + CRUD + `@nestjs/schedule` processor | none | Behind F6: schema, CRUD, cron processor. | **P1** |
| B6 | Export endpoint | `GET /transactions/export` | none | Behind F7. | **P1** |
| B7 | Scheduled tasks | `@nestjs/schedule`: recurring processor, budget overspend, expired-token sweep | none | Only if F6/F11 built. | **P1** |
| B8 | Audit log | `AuditLog` table + global mutation interceptor | none | Decision; likely overkill for a PoC. | **P2** |
| B9 | Full-text search | GIN `pg_trgm` on `transaction.description` + `?search=` | none | Add search if list UX warrants. | **P2** |
| B10 | Security middleware | helmet + compression + cookie-parser | none of these | Cheap hardening; add helmet/compression. | **P2** |

## 3. UI/UX quality deltas (mobile-first)

supertool's own UI is now captured live (FE on `:3010`, 33 screenshots in `…/supertool/`). The central finding: **the reference's mobile is "genuinely solid"; supertool's mobile is currently broken.** Closing these is the highest-value UI work.

| # | Delta | Reference | supertool today | Action | Pri |
|---|-------|-----------|-----------------|--------|-----|
| U1 | **Mobile nav** | Drawer nav + dimmed backdrop | **No mobile nav drawer at all**; desktop header rendered as-is at 390px, "Operator" overflows the edge, user menu clipped | Build a responsive mobile nav. | **P0** |
| U2 | **Mobile transactions table** | Readable stacked rows | **Fixed wide HTML table overflows horizontally** — Amount/Currency/Note/Actions clipped off-screen, no scroll affordance | Card/stacked layout on mobile. Worst offender. | **P0** |
| U3 | **In-app navigation** | Real app nav | Single top header only; you move between screens via landing links / direct URLs | Add primary app navigation. | **P1** |
| U4 | **Touch-usable row actions** | Hover-only (bad — copy nothing here) | Long category names clip Edit/Delete on mobile | Make row actions touch-reachable — exceed the reference. | **P1** |
| U5 | **Empty/first-run states** | Defaults to current period → "No data" after importing years of history | Same problem — defaults to current month (June 2026), near-empty; data lives in 2025 | Auto-fit the period to the data's date range on first load. | **P1** |
| U6 | **Landing** | Full marketing page | Bare placeholder (H1 + 3 links) | See F8. | **P1** |

**supertool already meets/exceeds the reference on:** dark mode (token-based, charts preserved — reference has none), UK locale formatting (`4 542,29 ₴` vs `UAH 4,542.29`), mobile-friendly create/edit forms (single-column, native pickers), URL-driven period state (shareable). Protect these (§6).

Per-screen notes: reference in logs `40-…`/`41-…`; supertool in `42-…`.

**Capture caveat (not a product defect):** browser sign-in on `:3010` returns 403 because `AUTH_TRUSTED_ORIGINS=http://localhost:3000`; the agent injected a valid session cookie to proceed. This is an artifact of the alt-port capture, not a gap — but note that the trusted-origins config is port-pinned.

## 4. Prioritized rollup — Epic 4+ candidate themes

1. **Epic 4 — Core money loop to parity (P0):** onboarding (F1) + user-facing import (F2/B1) + full dashboard with bug-fixes (F3/B2) + by-category drill-down (F4). This is the "import your data and see your money" spine the reference is built around.
2. **Epic 5 — Manage at scale (P1):** bulk delete done right (F5), export (F7/B6), transactions list UX (F9), search (B9), caching for the now-heavier analytics (B3).
3. **Epic 6 — Recurring & automation (P1):** recurring transactions FE+BE (F6/B5/B7).
4. **Mobile-first quality pass (P1, cross-cutting, do early):** supertool mobile baseline capture + close §3 deltas; fold a mobile-QA check into each P0/P1 story.
5. **Settings & landing (P1/P2):** change-password + delete-account (F10), real landing page (F8).
6. **Decisions before scoping (P2):** budgets real-vs-defer (F11), security middleware (B10), audit log (B8), rate-limit backend (B4).

---

## 5. Reference DEFECTS — exceed, do not replicate

The parity bar is "at least as good," so these are opportunities, not specs to copy:
- Dashboard shows **"No data"** on first load — date range defaults to current period (June 2026) vs data 2021–2025. → auto-fit range.
- **Daily-spending chart ignores the selected range** (pinned to current month).
- **Spending-by-category donut renders only its legend** (graphic missing — likely clip/render bug).
- **Bulk-delete inconsistent:** checkboxes on the by-date list show no action bar; only by-category works.
- **Transaction list is month-scoped** and defaults to the empty current month → new users see "No transactions found."
- **Row actions hover-only** → unusable on touch.
- **By-category list shows no totals/counts.**
- **Standalone import page is a bare native file input** (no drag-drop/preview).
- **Landing FAQ accordion is non-functional** (answers unreachable).
- **Auth forms duplicate helper text** (placeholder == description).
- **User menu is empty** (only Sign out); **no dark mode anywhere**; profile names not collected at signup.

## 6. Where supertool ALREADY exceeds the reference — protect these

- **Theme toggle + dark mode** (reference has none).
- **Locale switcher UI** + genuine en/uk i18n with ICU (reference has no switcher).
- **Cleaner auth forms** (no duplicate helper text).
- Single per-user **default currency** model (intentional simplification, §7).

## 7. Decisions to settle before/while planning Epic 4 (not mechanical gaps)

- **Currency:** do **NOT** re-introduce the reference's currency filter/picker or cross-currency aggregation. supertool deliberately simplified to one per-user default (decided 2026-06-15, memory `currency-simplified-single-default`). Reference's per-transaction currency + filter is superseded.
- **Auth architecture:** reference uses custom JWT + Passport + DB refresh tokens + CSRF + OAuth (Google/GitHub) + email verification + mailer; supertool uses **better-auth**. Keep better-auth. OAuth and email-verification are separate product decisions (FR1 descoped them), not parity gaps to close mechanically.
- **Error envelope:** reference uses **RFC-7807 problem-details**; supertool uses `{ statusCode, code, message, details }`. Switching is a breaking cross-cutting change touching the generated client + every error path — likely **not worth it for a PoC**. Decide explicitly.
- **Pagination shape:** reference `{ object, data, page, pageSize, total, totalPages, hasMore }` + RFC-5988 Link headers vs supertool `{ data, meta }`. Cosmetic divergence; recommend keep supertool's.
- **Transaction date type (technical):** reference stores **`timestamptz`** (full datetime); supertool stores bare SQL **`date`** strings. Import fidelity (the dataset has times like `15:41:17`), recurring scheduling, and daily-spending all imply time-of-day. **A date→timestamptz migration is likely a prerequisite** for F2/F6/F9 — flag for the architect.
- **Budgets:** reference is a stub; building real budgets *exceeds* parity. Decide scope (F11/B7/B8).

---

## Appendix — Evidence index

- Reference frontend inventory: `…/spike-reference-parity/10-ref-frontend-inventory.md`
- Reference backend inventory: `…/spike-reference-parity/20-ref-backend-inventory.md`
- Current-supertool baseline inventory: `…/spike-reference-parity/30-supertool-baseline-inventory.md`
- Public-surface capture log: `…/spike-reference-parity/40-ref-capture-public-log.md`
- Authenticated-app capture log: `…/spike-reference-parity/41-ref-capture-authenticated-log.md`
- Reference screenshots (80, both viewports): `…/visual-qa/spike-reference-parity/reference/`
- supertool baseline capture log: `…/spike-reference-parity/42-supertool-capture-log.md`
- supertool screenshots (33, both viewports, captured on `:3010`): `…/visual-qa/spike-reference-parity/supertool/`
