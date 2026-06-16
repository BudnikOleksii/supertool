---
baseline_commit: cb4e420
---

# Tech Debt: Transaction date → timestamptz (deferred)

Status: deferred (decision 2026-06-16, Epic 4+ parity planning)

Origin: reference-parity spike (`reference-parity-gap-backlog.md` §7, decision RP-D5). The
reference (`example/tracker-backend-api`) stores transaction dates as `timestamptz` (full
datetime); supertool stores bare SQL `date` strings (`"YYYY-MM-DD"`, no timezone math — per
CLAUDE.md "Dates" convention). The operator decided **not** to migrate during Epic 4+ — keep
`date`. This file records the debt so the trade-off is explicit and revisitable.

## Why keep `date` (the decision)

- The single-default-currency simplification and the "import your data and see your money"
  spine work fine at day granularity.
- A `date`→`timestamptz` migration is cross-cutting: schema change, re-derivation of the seed
  import, every analytics SQL aggregation, the generated client, and every DTO that carries a
  transaction date. High blast radius for a local PoC.
- Day-granularity keeps the dashboard math and the decimal-safe test harness unchanged.

## What it costs (the debt)

Three Epic 4+ items are shaped by this and must be scoped at day-granularity, not time-of-day:

- **RP-F2 user-facing import** — the committed dataset carries times (e.g. `15:41:17`); importing
  at `date` granularity drops the time-of-day component. Acceptable for parity (the seed already
  imports date-only); note it in the import story so it is a known truncation, not a silent bug.
- **RP-F6 recurring transactions** — scheduling runs at day granularity (a recurring item posts on
  a date, not a clock time). Works without `timestamptz`; the `@nestjs/schedule` processor keys off
  dates. No time-of-day "due at 09:00" semantics.
- **RP-F9 list UX** — the **time-of-day picker** sub-item is **dropped** from RP-F9 (it requires
  `timestamptz`). The rest of RP-F9 (duplicate/copy, month/year navigator, richer category picker)
  is unaffected and stays in scope.

## When to reconsider (positive-impact triggers)

Promote this from deferred to active if any of these land:
- Daily-spending or intra-day analytics need sub-day ordering.
- Recurring transactions grow "due-at-time" semantics.
- Import fidelity (preserving the source `HH:MM:SS`) becomes a stated requirement.

If promoted, treat it as a foundation story BEFORE the dependent feature, flagged for the
architect (it touches the schema, the seed, analytics SQL, the generated client, and DTOs).

## Scope (if/when actioned)

In scope — `transactions.date` column (`date` → `timestamptz`), the drizzle schema + a migration,
seed re-derivation to preserve source times, analytics aggregations that bucket by day, DTO/string
contract, generated-client regen + drift gate.

Out of scope — currency model (stays single default, RP-D1), error envelope (RP-D3) and pagination
shape (RP-D4) which were both decided to stay as supertool's.
