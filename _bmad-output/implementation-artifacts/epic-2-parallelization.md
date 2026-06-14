# Epic 2 — Parallelization Plan

> Reference for sequencing Epic 2 (Transactions & Categories) story work across parallel tracks.
> Authored before 2.1 implementation. Revisit after 2.1 lands.

## The gate: Story 2.1 blocks everything

**2.1 Seed the Real Data** must land **solo, first**. It creates the `transactions` +
`transaction_categories` schema **and** derives the shared enums from the Drizzle schema
(single source of truth). Every other Epic 2 story imports that schema and those enums —
there is no useful parallel work before it exists.

Epic-1-retro carry-overs to fold into the 2.1 story when writing it:
- Add ACs for `runSeed()` boot threading (the migrate → seed → listen hook from Story 1.7).
- Add a D1 decimal-safety test harness (per-currency sums verified with decimal.js).

## After 2.1: two independent tracks

Epic 2 splits cleanly into **two modules** that touch different files:

```
2.1 Seed ──┬─► Track A (transactions module)
           │      2.2 Browse ─┬─► 2.4 Edit/Delete
           │      2.3 Entry  ─┘   2.5 Filter/Sort
           │
           └─► Track B (transaction-categories module)
                  2.6 Organize Categories
```

### Strongest parallel pair: Track A vs Track B

- **2.6 Organize Categories** lives entirely in the `transaction-categories` module + its own
  page. It depends only on 2.1's schema — **not** on any transactions endpoint or UI. Its one
  cross-module touch (delete-with-reassignment pointing transactions at a new category) only
  needs the *table*, which 2.1 provides.
- So **2.6 can run fully in parallel with the entire transactions track (2.2–2.5)** with
  near-zero file overlap. This is the cleanest parallelization.

### Within Track A

- **2.2 Browse** (GET + list) and **2.3 Entry** (POST + form) are different endpoints/methods
  but share the transactions module scaffold (module/controller/service/repository) and both
  trigger a client regen. **Parallelizable with light coordination** — expect merge contact on
  shared module files, not logic conflicts. Recommend landing 2.2 first (it establishes the
  module + list the others build on), then 2.3.
- **2.4 Edit/Delete** depends on **both** 2.3 (reuses the entry form, pre-filled) and 2.2
  (the list it acts on).
- **2.5 Filter/Sort** depends on **2.2** (extends its GET endpoint + list).
- Once 2.2 + 2.3 are merged, **2.4 and 2.5 can run in parallel** — mutations vs query params,
  mostly orthogonal (minor contact on the list component + repository).

## Recommended waves

| Wave | Parallel work | Why safe |
|------|---------------|----------|
| 0 | **2.1** solo | schema + enum gate |
| 1 | **2.2** ‖ **2.6** | different modules |
| 2 | **2.3** ‖ **2.6** (if still running) | 2.3 = new endpoint; 2.6 = other module |
| 3 | **2.4** ‖ **2.5** | mutations vs query filters, both on top of 2.2/2.3 |

## Dependency summary

- **2.1** → prerequisite for all.
- **2.2** → depends on 2.1.
- **2.3** → depends on 2.1; light file overlap with 2.2.
- **2.4** → depends on 2.2 (list) + 2.3 (form reuse).
- **2.5** → depends on 2.2 (GET + list).
- **2.6** → depends on 2.1 only; independent of 2.2–2.5.

## Next steps (each best in a fresh context window)

- **bmad-sprint-planning** — turn this wave order into a tracked sprint plan.
- **bmad-create-story** "create story 2.1" — spin up the gate story first.
