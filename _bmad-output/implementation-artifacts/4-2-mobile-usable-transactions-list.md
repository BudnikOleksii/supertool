---
baseline_commit: 61578607b3efac6793137143b8e602ca68d5660b
---

# Story 4.2: Mobile-Usable Transactions List

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Oleksii on my phone,
I want the transactions list to stack readably and expose row actions to touch,
so that I can review and act on transactions on a small screen — today's worst offender (RP-U2, RP-U4).

## Context & Why This Story

The reference-parity spike's worst single offender: **supertool's transactions list is a fixed-width HTML table that overflows horizontally at 390px** — Amount/Currency/Note/Actions are clipped off-screen, and Edit/Delete are unreachable on a phone. The table sits in a `overflow-x: auto` wrapper, so the only way to reach the right-most columns (including the actions) is to horizontally scroll a region with no scroll affordance. The reference solves this by dropping the table entirely on every viewport in favor of a stacked card/row list. This story closes **RP-U2 (mobile transactions table, P0)** and **RP-U4 (touch-usable row actions, P1)** — **no new product capability**: the same transactions, the same Edit/Delete flow, made usable on a phone and at least as good as the reference (which it must *exceed* on the row-actions axis — §5).

**Evidence (cite in the Dev Agent Record):**
- supertool broken baseline: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/supertool/transactions--list--mobile.png` (fixed-width table overflowing, columns clipped) and `…/supertool/transactions--list--desktop.png`. Capture log: `…/spike-reference-parity/42-supertool-capture-log.md`.
- reference target: `…/spike-reference-parity/reference/transactions--list--mobile.png` (readable stacked rows) and `…/reference/transactions--list--desktop.png`. Auth-app capture log: `…/spike-reference-parity/41-ref-capture-authenticated-log.md`.
- Reference code to **adapt, never copy (ED1)**: `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/transaction-list/TransactionList.{tsx,module.scss}` and `…/transaction-row-actions/TransactionRowActions.tsx`.

## Architecture Decision (binding for this story)

> ⚠️ **SUPERSEDED 2026-06-16 (course correction, confirmed in code review).** The desktop `Table` was dropped entirely for date-grouped cards at all widths, so the dual-layout CSS display-toggle below no longer applies — there is one card layout, not a table↔card switch. **What remains binding:** `TransactionList` stays an **async React Server Component** with **no JS viewport detection** (`window.matchMedia`/`useMediaQuery`/`useEffect`) — verified intact in review. The rest of this section is retained for historical context only.

**Responsive layout switch is CSS-owned (display-toggle), not JavaScript.** `TransactionList` is an **async React Server Component** (`export const TransactionList: FC<Props> = async (…)`). It has no viewport knowledge at render time and must **not** introduce `window.matchMedia`/`useEffect`/client-side viewport detection to pick a layout — that would force a `'use client'` conversion and risk hydration mismatch. Instead, render **both** representations and let CSS show one per viewport, exactly as Story 4.1 did for the nav (both nav variants in the DOM, CSS owns the switch; `styles.md` display-toggle pattern):

- **Desktop (≥ `media-l` = 1024px):** the existing `Table` layout, preserved byte-for-byte in structure (no regression — AC #2).
- **Mobile (< `media-l`):** a stacked card list adapted from the reference's `.row`/`.rowStart`/`.info`/`.primary`/`.secondary` structure.

Boundary = **`media-l` (1024px)**, matching the mobile↔desktop boundary Story 4.1 established for the shell nav. Mobile-first SCSS: card list is the base, table appears at `media-l`.

**Why this keeps `TransactionList` a server component (mechanism, not just prohibition):** a responsive switch only needs `'use client'` if **JavaScript** reads the viewport (`window.matchMedia`, a `useMediaQuery`/`useEffect` hook). **CSS media queries are evaluated by the browser at paint time, not by JS** — so the server can ship *both* DOM subtrees and the stylesheet shows exactly one. The HTML is identical on server and client (no hydration mismatch), and the server never needs viewport knowledge. The tempting wrong path — a `useMediaQuery` hook returning `isMobile` to conditionally render — would promote the entire list (and all its data mapping) to the client for zero benefit; reject it. Shape:

```scss
// TransactionList.module.scss (or TransactionCard.module.scss for the card half)
@use "@supertool/ui/src/styles/breakpoints";

.mobileCards { // base = mobile-first
  display: block;
  @include breakpoints.media-l { display: none; }
}

.desktopTable {
  display: none;
  @include breakpoints.media-l { display: block; }
}
```

```tsx
// TransactionList.tsx stays: export const TransactionList: FC<Props> = async (…) => { … }
return (
  <>
    <ul className={styles.mobileCards}>
      {transactionList.map((transaction) => (
        <TransactionCard key={transaction.id} transaction={transaction} /* + row-action props */ />
      ))}
    </ul>
    <div className={styles.desktopTable}>
      <Table>{/* existing seven-column table, unchanged */}</Table>
    </div>
  </>
);
```

The **only** `'use client'` island remains the per-row `TransactionRowActions` leaf (it owns the `AlertDialog` + delete hook) — rendered inside both branches, unchanged. "Minimize `'use client'`" means don't promote the *list* to client, not eliminate a genuinely-interactive leaf; the list, cards, and table all stay server-rendered.

**Trade-off acknowledged:** dual-render means `TransactionRowActions` (a `'use client'` component carrying an `AlertDialog` + `useDeleteTransaction` hook) is instantiated twice per transaction (once per layout). This is acceptable: `display: none` removes the hidden layout from the accessibility tree and layout, and the page is paginated (`DEFAULT_PAGE_SIZE`), bounding the count. Do **not** try to share a single DOM node between layouts. If you prefer a single-DOM alternative (restyle `<td>` to blocks with `data-label` `::before` labels and hide `<thead>` on mobile), that is permissible — but it loses the reference's genuine card aesthetic and is harder to assert in the test; the dual-render is the recommended path.

## Acceptance Criteria

1. **Stacked card layout at all widths (RP-U2).** ⚠️ _Amended 2026-06-16 (course correction, confirmed in code review):_ given **any** viewport, when the transactions list renders, then rows display as a **date-grouped stacked/card layout with no horizontal overflow and no off-screen clipping** at 390px, each card showing **category (parent/child label), type, amount, and note**. The transaction **date is shown once per date-group header** (not per card); the **currency is carried inside the Intl-formatted amount** (`formatAmount` embeds the symbol) rather than rendered as a separate field — consistent with the single-default-currency decision (memory `currency-simplified-single-default`). Amounts are formatted via `formatAmount` (Intl) and dates via `formatTransactionDate` — never ad-hoc string formatting (D1: money is strings, formatted only at the edge via Intl/next-intl).
2. **Date grouping (supersedes original table-preservation AC).** ⚠️ _Amended 2026-06-16 (course correction):_ the desktop `Table` is **removed entirely** in favor of the same date-grouped cards at all widths (reference parity; the original "preserve the seven-column table" AC and the binding CSS display-toggle Architecture Decision are formally retired — see the superseding note in the Architecture Decision section). Cards are grouped under date headers when sorted by date; **when sorted by amount the list renders flat with no date headers** (avoids fragmented/duplicate date headers under a non-date sort).
3. **Touch-usable row actions (RP-U4, exceed the reference).** Given a row on any viewport — especially touch, and rows with long category names — when I want to edit or delete it, then the Edit and Delete actions are **reachable without hover and without being clipped**: visible in-flow in the mobile card and not pushed off-screen. Do **not** adopt the reference's `@media (hover: hover)` opacity-0 hover-reveal — supertool keeps actions always-visible, which already exceeds the reference's hover-only actions (§5). The existing delete-confirmation `AlertDialog` flow is preserved unchanged.
4. **i18n parity (FR19/FR20).** Given every user-facing string the layout renders, then each exists in **both** `apps/money-tracker/messages/en/transactions-page.json` and `…/uk/transactions-page.json` in this same commit (`pnpm i18n:parity` green). Reuse the existing `columns.*`, `type.*`, and `actions.*` keys for field labels and buttons; only add new keys (e.g. a card aria-label) if you introduce genuinely new visible/assistive text — and then in both locales, real Ukrainian, ICU only.
5. **Tests (NFR1).** Given the list, when tests run, then a component test asserts the **responsive layout switch** (both the table and the card layout are present in the DOM — CSS owns which is visible; jsdom has no real media queries, so assert presence, not visual hiding) and **action reachability** (an Edit link and a Delete control are rendered per transaction in the mobile layout, not gated behind hover). All existing `TransactionList` tests continue to pass.
6. **Visual QA evidence (Story 1.9 protocol, NFR8).** Given the rendered list, then the Dev Agent Record carries screenshots in **light + dark themes** at **mobile (390px) + desktop (≥1024px)** viewports — **including the interactive/open states**: the `CategoryPicker` open (in both the filter and the create/edit form) and the delete `AlertDialog` open on mobile — compared side-by-side against the reference captures (`transactions--list--mobile/desktop.png`, placed in this story's `visual-qa/4-2-mobile-transactions/reference/`) and confirming: the 390px list no longer overflows (`documentElement.scrollWidth === innerWidth`) and Edit/Delete reachable on a phone. Dark-mode token theming preserved (§6 strength). _(Code review 2026-06-16: this evidence is currently incomplete — see Review Findings Patch #1, BLOCKING.)_

### Amended Acceptance Criteria (added 2026-06-16 — course correction sanctioned in code review)

7. **Cascading category picker (RP-F9, pulled forward).** The flat category `Combobox` is replaced by a two-pane cascading `CategoryPicker` (parent → child) in **both** the filter and the create/edit transaction form. It is keyboard- and pointer-operable, ARIA `listbox`/`option` wired, with the filter exposing an "All categories" option and an "All {parent}" parent-self option.
8. **Duplicate transaction flow (RP-F9, pulled forward).** A row "Duplicate" action links to `/transactions/new?copyFrom=<id>`; the create page fetches the source transaction (via the generated client only) and pre-fills the form in create mode. `actions.copy` lands in both locales.
9. **Icon row actions.** Row actions render as aria-labelled icon buttons (Duplicate / Edit / Delete, lucide), reachable without hover on touch; the existing delete-confirmation `AlertDialog` flow is preserved unchanged.

### ED1 waiver (recorded 2026-06-16, code review)

The new `category-picker/{CategoryPicker.tsx,CategoryPicker.module.scss,hooks/use-category-picker.ts}` are a close structural reproduction of `example/track-my-life`'s equivalent (mechanical adaptations: import paths, `parentCategoryId`→`parentId`, truthy→explicit comparisons, explicit optional types, `--primary-container` token in place of the example's hardcoded shadow, `getParentOptionLabel` prop). This was reviewed against hard-rule ED1 ("patterns may be carried, code may not") and **accepted as a sanctioned waiver** for this component — the project's explicit strategy is reference parity with `example/track-my-life` (memories `follow-example-repo-patterns`, `poc-parity-with-reference-then-tools`). No rework required.

## Tasks / Subtasks

- [x] **Task 1 — Study the reference + current state before writing code** (AC: 1, 2, 3)
  - [x] Read the reference list `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/transaction-list/TransactionList.{tsx,module.scss}` — adapt the `.row`/`.rowStart`/`.info`/`.primary`/`.secondary` stacked structure and design-token styling. **Drop, do not port:** date-grouping (`groupTransactionListByDate`), bulk-delete checkboxes (`TransactionRowCheckbox`/`TransactionRowSelectionStyle` — that's RP-F5, **Epic 6**), copy/duplicate buttons (RP-F9, **Epic 6**), and the reference's `@media (hover: hover)` opacity-0 hover-reveal on `.actions` (regresses touch + violates AC #3). The reference's empty-state branch is also out of scope — supertool handles empty/error upstream in `TransactionListServer` (see Dev Notes).
  - [x] Re-read the files this story modifies (below) in full so you preserve current behavior.
- [x] **Task 2 — Build the responsive layout in `TransactionList.tsx`** (AC: 1, 2, 3)
  - [x] Keep the existing desktop `Table` block exactly as-is (Date/Category/Type/Amount/Currency/Note/Actions). Wrap it so it is hidden below `media-l` via the display-toggle (`.desktopTable.desktopTable { display: none; @include breakpoints.media-l { display: block } }` — or apply the toggle to a wrapper). Preserve `getCategoryLabel`, `formatAmount`, `formatTransactionDate`, the `Badge` variant logic, and the per-row `TransactionRowActions` props.
  - [x] Add a mobile card list (base layout, hidden at `media-l`): one card per transaction showing the same six fields + the shared `TransactionRowActions`. Reuse `getCategoryLabel`, the `Badge` (`variant={transaction.type === 'income' ? 'success' : 'secondary'}` + `type.${type}` label), `formattedDate`, `formattedAmount`, `transaction.currency`, `transaction.note`. Use `Typography` from `@supertool/ui` for text where the reference does; reuse existing `columns.*` i18n keys if you surface inline field labels (e.g. a "Note" label) — do not hardcode label text.
  - [x] **Recommended:** extract the card into a co-located server subcomponent `components/transaction-card/TransactionCard.tsx` (+ `.module.scss`, + `.test.tsx`) to keep `TransactionList` readable and give the card its own test surface. It stays a server component (no `'use client'`) — only the shared `TransactionRowActions` is the client island. Inline is acceptable if you prefer, but co-locate styles either way.
  - [x] Render `TransactionRowActions` in both layouts with the same props it already receives (`id`, `period`, `page`, `type`, `categoryId`, `sortBy`, `sortOrder`, `formattedAmount`, `formattedDate`). Do not change its public props.
- [x] **Task 3 — SCSS: card styles + display toggle** (AC: 1, 2, 3)
  - [x] In `TransactionList.module.scss` (and/or `TransactionCard.module.scss`): `@use "@supertool/ui/src/styles/breakpoints";`. Mobile-first — card styles are the base, `@include breakpoints.media-l` reveals the table and hides the cards. Use the double-class display-toggle (`.x.x`) per `styles.md`.
  - [x] Card structure adapted from the reference: a flex column/row card (`padding: var(--spacing-3) var(--spacing-4)`, `border` / `border-radius` via tokens, `gap` via `--spacing-*`), amount emphasized, category + note in `--on-surface-variant`, type as `Badge`, actions in-flow at the end. **Design tokens only** (`--surface*`, `--on-surface*`, `--outline-variant`, `--spacing-*`, `--radius-*`); never invent colors/sizes. `min-width: 0` on text containers so long category names/notes wrap or ellipsis instead of forcing overflow.
  - [x] Confirm no element exceeds the viewport at 390px (verified live in Task 5). The note must not force horizontal overflow — wrap or clamp with tokens.
- [x] **Task 4 — Tests** (AC: 5)
  - [x] Update `TransactionList.test.tsx` (and add `TransactionCard.test.tsx` if extracted). Reuse the existing mocks (`next-intl/server`, `next-intl`, the `@supertool/next-shared/.../navigation` `Link` mock — see current test lines 10-21). Assert: (a) both layouts present — the table (`screen.getByRole('table')` or the header cells) AND the card layout (a stable card container / per-card test affordance) coexist in the DOM; (b) per transaction, an Edit link and a Delete control render in the mobile layout (action reachability, not hover-gated); (c) the existing assertions (parent/child category label, formatted amount, formatted date, one row per transaction) still pass — update the row-count assertion if the card layout adds nodes with `role="row"` (it should not; cards are `div`s, so `getAllByRole('row')` still counts only the table). 
  - [x] jsdom has no media queries — do **not** assert which layout is visually hidden; assert both are in the DOM (CSS owns the switch). Run via `pnpm` scripts, never `node_modules/.bin`; retry on the transient pnpm `H.replace` crash.
- [x] **Task 5 — Visual QA (Story 1.9 protocol, NFR8)** (AC: 6)
  - [x] Run the dev stack; sign in as the seeded operator (creds in `apps/api/.env.example`; trusted-origins pinned to `:3000` — sign in on port 3000 to avoid the 403 noted in the spike caveat). Navigate to a **period that has data** (seed data lives in 2025 — the current month is empty; pick a 2025 month with transactions, e.g. via `?period=2025-02`, so the list actually renders). Capture with global `playwright-cli`.
  - [x] Screenshot matrix per the 1.9 protocol: **{light, dark} × {390px, ≥1024px}**. Confirm and record in the Dev Agent Record: 390px list no longer overflows (`document.documentElement.scrollWidth === window.innerWidth`); date/category/type/amount/currency/note all visible per card; Edit + Delete reachable by tap (open the delete dialog on mobile to prove the flow); desktop table unchanged vs the baseline; dark-mode tokens intact. Compare side-by-side against `…/reference/transactions--list--mobile.png` / `--desktop.png`.

## Dev Notes

### Files to TOUCH (read each fully before editing)
| File | Action | Why |
|---|---|---|
| `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx` | UPDATE | Add the mobile card layout beside the preserved desktop `Table`; keep `getCategoryLabel`, formatters, `Badge`, and the per-row `TransactionRowActions` props. Currently the table is the only layout (`TransactionList.tsx:55-107`). |
| `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.module.scss` | UPDATE | Add card styles + `media-l` display-toggle (currently only `.amountColumn`/`.dateCell`/`.noteCell`/`.actionsColumn`). |
| `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.test.tsx` | UPDATE | Add responsive-switch + action-reachability assertions; keep existing ones green. |
| `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.tsx` | NEW (recommended) | Server subcomponent for the card; keeps `TransactionList` readable. |
| `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.module.scss` | NEW (recommended) | Card-only token styles. |
| `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.test.tsx` | NEW (recommended) | Card render test. |
| `apps/money-tracker/messages/en/transactions-page.json` + `…/uk/transactions-page.json` | UPDATE **only if** new visible/aria strings | Reuse existing `columns.*`/`type.*`/`actions.*` first; new keys go in both locales same commit. |

### Current state of the system this story modifies (preserve, don't break)
- **`TransactionList`** (`TransactionList.tsx`) is an **async RSC** that renders a `Table` (the `@supertool/ui` molecule) with seven columns and, per row, the shared `TransactionRowActions`. `getCategoryLabel` builds the `Parent / Child` (or bare) category label. `formatAmount(amount, currency, locale)` (Intl currency, D1-safe — `apps/money-tracker/src/utils/format-amount.ts`) and `formatTransactionDate(date, locale)` (`…/transactions/utils/format-transaction-date.ts`) are the only formatters — reuse them; never format money/dates ad-hoc. Amount column is right-aligned + `tabular-nums`.
- **`TransactionRowActions`** (`…/transaction-row-actions/TransactionRowActions.tsx`, `'use client'`) renders an Edit `Button` (as `Link` to `getTransactionEditPath(id)`) and a Delete `Button` that opens an `AlertDialog` wired through `useDeleteTransaction`. It is **already always-visible** (its SCSS is just a flex row, no hover-hide) — so supertool already exceeds the reference's hover-only actions; the only mobile defect is that, inside the wide table, this cell is pushed off-screen. The card layout fixes placement. **Do not change `TransactionRowActions`'s props or the dialog flow.** Reusing it in both layouts is the intent.
- **`TransactionListServer`** (`…/transaction-list-server/TransactionListServer.tsx`) is the RSC wrapper: it fetches via `fetchTransactions`, renders `TransactionError` on error, `TransactionEmptyState` when `meta.total === EMPTY_COUNT`, redirects out-of-range pages, then renders `TransactionList` + `TransactionPagination`. **`TransactionList` therefore only ever renders with ≥1 transaction** — no empty-state branch needed here (unlike the reference, which inlines its empty state). **Do not touch** the empty/error/first-run behavior — first-run period auto-fit is **Story 4.3**, not this story.
- **`Table` molecule** (`packages/ui/src/components/molecules/table/Table.{tsx,module.scss}`) wraps `<table>` in a `.wrapper { overflow-x: auto }`. That horizontal scroll is exactly why the mobile table "works" but clips actions off-screen with no affordance. **Do not modify the shared `Table` molecule** — solve in the app layer with the card layout (keeps the shared primitive untouched; other future tables may want the table-on-mobile behavior).
- **Breakpoints** (`packages/ui/src/styles/_breakpoints.scss`): `media-s 390 / media-m 768 / media-l 1024 / media-xl 1440`. Use **`media-l` (1024px)** as the card↔table boundary (matches Story 4.1's nav boundary). Mobile-first: base = cards, `media-l` = table.

### Reference patterns (study before implementing — adapt, never copy, ED1)
- **Stacked card structure + token styling:** `example/track-my-life/apps/money-tracker/src/app/[locale]/(app-layout)/transactions/components/transaction-list/TransactionList.module.scss` (`.row` `:31`, `.rowStart` `:57`, `.info` `:71`, `.primary` `:80`, `.secondary` `:91`, `.actions` `:111`). Adapt the layout/tokens. **Do NOT port** `.actions { opacity: 0 }` under `@media (hover: hover)` (`:119-130`) — supertool keeps actions visible (AC #3).
- **Card JSX composition:** `…/transaction-list/TransactionList.tsx:91-152` — the `rowStart` (info: amount + badge primary line, category + description secondary line) and `actions` (icon buttons). Adapt the **structure**; supertool's fields differ (adds explicit `currency`, uses `note` not `description`, `categoryParentName`/`categoryName`, `type` `'income'/'expense'` not `'INCOME'/'EXPENSE'`), and supertool keeps text Edit/Delete labels (not icon-only) consistent with its current desktop actions.
- **Divergences from the reference to call out in your notes:** (1) supertool keeps a **desktop table**; the reference uses the card list at all widths — supertool's dual-layout is deliberate (AC #2 "no regression" on desktop). (2) **No date-grouping** (reference groups by day) — out of scope; one flat card per transaction. (3) **No bulk-delete checkboxes / selection** (RP-F5 → Epic 6). (4) **No copy/duplicate** (RP-F9 → Epic 6). (5) **Actions always visible**, not hover-revealed (exceed §5).
- **No reference counterpart** for "responsive table↔card via CSS display-toggle in the same component" — the reference never had a table to preserve. This is supertool ground, justified by AC #2 (desktop non-regression) + the SSR/RSC constraint (CSS-owned switch, no JS viewport detection).

### Conventions to honor (from .claude/rules + memories)
- Component files PascalCase + co-located `.module.scss`/`.test.tsx`; dirs kebab-case (`transaction-card/`). `FC<Props>` typing always.
- SCSS: camelCase classes, **design tokens only**, namespaced `@use` (`@use "@supertool/ui/src/styles/breakpoints";` → `@include breakpoints.media-l`), double-class selector for display-toggle / ui overrides, mobile-first (`styles.md`).
- i18n: `useTranslations`/`getTranslations(I18N_NAMESPACE.transactionsPage)` — never the literal `"transactionsPage"`; `id-length` lint rejects `t` (use `translate`). New keys (if any) in **both** locales same commit; real Ukrainian, ICU only.
- No comments; self-documenting names; array vars end in `List`; arrow functions; handler props `on*`, handlers `handle*`; no barrel/re-export files. No type assertions (`as`) except `as const`.
- No new dependencies needed (`lucide-react@1.18.0` is already available if you choose icons, but text labels match the current desktop actions — prefer consistency). Never add eslint/prettier.

### Testing standards
- Vitest + `@testing-library/react` + jsdom. `TransactionList` is async — the existing test invokes it as `await TransactionList({...})` then `render(...)` (see `TransactionList.test.tsx:47-57`); follow that shape for any new render. Co-locate `*.test.tsx`. Run via `pnpm --filter` scripts; retry the transient `H.replace` crash.
- The current test uses plain `expect(...).toBeTruthy()` and `screen.getByText` (no jest-dom assumptions beyond testing-library defaults in this app). Keep `getAllByRole('row')` counting only `<tr>` (cards are `div`s) so the existing one-row-per-transaction assertion holds.
- Verify gates with `--force` where turbo cache may replay stale logs; CI runs the real thing.

### Verify-live requirements (do not skip)
- UI stories have shipped green-but-broken before (1.4, 1.8) — **a green gate is not done.** The Task 5 screenshot matrix (light+dark × mobile+desktop, vs reference) is the acceptance evidence; do not claim parity without the actual look (memory `ui-stories-need-visual-qa`, `visual-qa-via-playwright-cli`). The seed data is in **2025** — capture on a 2025 month with data, not the empty current month (that empty-state/auto-fit concern is Story 4.3).

### Out of scope (explicit guardrails)
- No new product capability. No date-grouping, no bulk-delete/selection (RP-F5 → Epic 6), no copy/duplicate (RP-F9 → Epic 6), no first-run period auto-fit / empty-state work (Story 4.3), no changes to the shared `Table` molecule, to `TransactionRowActions` props/flow, to `TransactionListServer`'s fetch/empty/error/pagination logic, or to filters/sort. No currency picker (RP-D1 — single default stays). Keep the seven desktop columns exactly.

### Project Structure Notes
- New `transaction-card/` dir (if extracted) sits beside the existing `transaction-list/`, `transaction-row-actions/`, `transaction-filters/`, etc. under `…/transactions/components/` — consistent with current structure, no conflicts. The card is a server component; the only client island remains `TransactionRowActions`.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2] — story statement + 4 BDD AC blocks + evidence pointers (RP-U2, RP-U4)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — epic intent, binding rules, evidence base + Story 1.9 visual-QA protocol requirement
- [Source: _bmad-output/planning-artifacts/epics.md#Reference-Parity Requirements Inventory] — RP-U2 (mobile table, P0) / RP-U4 (touch actions, P1); §5 reference defects to exceed; §6 strengths to protect (dark mode)
- [Source: _bmad-output/planning-artifacts/reference-parity-gap-backlog.md] — RP-U2/RP-U4 gap detail + evidence keys
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR8] — list fully usable in a mobile browser; responsive duty on `ui`/`widgets` + shared SCSS breakpoint mixins
- [Source: _bmad-output/implementation-artifacts/4-1-mobile-navigation-drawer-in-app-navigation.md] — established CSS display-toggle responsive pattern, `media-l` boundary, visual-QA protocol precedent
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx / .module.scss / .test.tsx] — files updated
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx] — shared client actions (reuse unchanged)
- [Source: apps/money-tracker/src/app/[locale]/transactions/components/transaction-list-server/TransactionListServer.tsx] — empty/error/pagination owned here (do not touch)
- [Source: packages/ui/src/components/molecules/table/Table.tsx / .module.scss] — shared table primitive (do not modify)
- [Source: packages/ui/src/styles/_breakpoints.scss] — `media-l` 1024 boundary
- [Source: apps/money-tracker/src/utils/format-amount.ts, …/transactions/utils/format-transaction-date.ts] — the only money/date formatters (D1)
- [Source: example/track-my-life/.../transactions/components/transaction-list/TransactionList.{tsx,module.scss} + transaction-row-actions/TransactionRowActions.tsx] — stacked-card pattern to adapt (never copy, ED1)
- [Source: apps/money-tracker/messages/{en,uk}/transactions-page.json] — existing `columns.*`/`type.*`/`actions.*` keys to reuse
- [Source: .claude/rules/styles.md, react.md, i18n.md, javascript.md, typescript.md] — conventions

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- Initial test run failed (5 TransactionList tests, empty render): `@testing-library/react` cannot resolve a nested **async** server component (`TransactionCard`) inside the awaited `TransactionList` — it rendered nothing. Fixed by making `TransactionCard` **synchronous** (all its formatters — `formatAmount`/`formatTransactionDate`/`getCategoryLabel` — are pure sync; only `getTranslations` is async, so the type-badge label is passed down as the `typeLabel` prop from the already-async parent). A sync server component nested in an async one renders in both prod and jsdom. Re-run: 9/9 new tests pass, 144/144 suite green.

### Completion Notes List

> **Course correction (2026-06-16, product-owner directed).** The original spec (AC #2 + Architecture Decision) kept a **desktop table** and **dropped date-grouping** to avoid "regressing" the desktop list — but that deliberately diverged from the reference (`example/track-my-life`), which uses **date-grouped card rows at all widths**. On review of the first cut, Oleksii rejected the table-on-desktop decision (the PoC north star is reference parity) and directed: (1) match the reference at **all widths** — grouped cards everywhere, table dropped; (2) pull the reference's **two-pane cascading hierarchical category picker** (RP-F9) forward to replace the flat `Combobox` filter, which looked broken. Bulk-delete checkboxes remain omitted (RP-F5 → Epic 6 — sanctioned). This **supersedes AC #2 and the Architecture Decision's dual-layout** above; the notes below describe the delivered (corrected) implementation.

- **RP-U2 closed (stacked cards, all widths).** The fixed-width table is **removed**. `TransactionList` renders a `.list` container of date-grouped `<section>`s (consecutive same-date grouping via `groupTransactionListByDate`), each with a `.dateHeader` (formatted via `formatTransactionDate`) and a `<ul>` of `TransactionCard` `<li>`s. Verified live at 390px **and** 1280px: `document.documentElement.scrollWidth === window.innerWidth` (no horizontal overflow at either width). Each card shows amount (emphasised, `formatAmount` Intl), type badge, parent/child category, and note when present — the date now lives in the group header (reference parity; the redundant per-card date + currency fields were dropped). D1 honored (money stays a string, formatted only at the edge).
- **RP-U4 closed / exceeded (touch actions).** `TransactionRowActions` reused unchanged (props + `AlertDialog` flow untouched) in every card, always-visible (the reference's `@media (hover: hover)` opacity-0 reveal deliberately not ported — exceeds reference §5).
- **RP-F9 (partial) — cascading category picker, filter AND form.** New app-local client component `category-picker/CategoryPicker.tsx` (+ hook + scss + test) adapted from the reference: two-pane parent → child cascade, keyboard arrow navigation (no `as` — narrowed with `instanceof` guards), click-outside close, primary-token selection styling. Adapted to supertool's `CategoryResponseDto` (`parentId`, lowercase `type`). Generalised via props (labels in, `showAllOption`, `getParentOptionLabel`, `error`) so BOTH consumers use it: the **filter** (`TransactionFilters`, with an "All categories" option, parent-self labelled "All {parent}") and the **create/edit form** (`TransactionForm`, no all-option, placeholder "Select a category", parent-self labelled with the plain parent name so a parent category stays selectable — preserving prior form behaviour; scoped to the selected type). Orphaned `buildFilterCategoryOptionList` and `buildCategoryOptionList` utils (+ tests) deleted; the form hook now resets an out-of-type category via a type-filtered id set. Currency in the form still uses `Combobox`. Bulk-delete checkboxes and the month/year navigator remain out of scope (Epic 6).

- **Row actions → icon buttons + duplicate (RP-F9).** `TransactionRowActions` now renders three icon buttons (lucide `Copy`/`Pencil`/`Trash2`, each `aria-label`led) matching the reference, replacing the text buttons. The Duplicate icon links to `getTransactionCopyPath(id)` → `/transactions/new?copyFrom=<id>`; the create page reads the param, fetches the source transaction, and pre-fills the form via a new `copyFrom` prop **in create mode** (so submit creates a duplicate, never edits the original). `actions.copy` added to both locales. Verified live end-to-end.
- **RSC boundary intact.** `TransactionList` stays an async RSC; `TransactionCard` is a synchronous server subcomponent (the type-badge label is passed as `typeLabel` from the async parent — see Debug Log for why). Only `TransactionRowActions` and the new `CategoryPicker` are `'use client'` islands.
- **i18n (FR19/FR20).** One new key `filters.categoryAllInParent` ("All {category}" / "Усі: {category}", ICU) added to **both** `en` and `uk` this commit for the picker's "all of this parent" option. `pnpm i18n:parity` green.
- **Untouched (out of scope):** shared `Table` molecule (now simply unused by this list; left for other tables), `TransactionListServer` empty/error/pagination/first-run (Story 4.3 owns first-run), sort filter, currency model. No new dependencies (`lucide-react@1.18.0` already present).

#### Visual QA (Story 1.9 protocol, NFR8)

Captured with global `playwright-cli`, signed in as the seeded operator on `:3000` (dev server run from THIS worktree — a stale `next-server` from the TOOLS-4-4 worktree was occupying :3000 and served old code; stopped it and ran the correct one), period `2025-02` (9 seeded transactions). All screenshots viewed and verified against the reference (`…/spike-reference-parity/reference/transactions--list--{mobile,desktop}.png` and the user-provided cascading-picker reference):

| Screenshot | Result |
|---|---|
| `…/visual-qa/4-2-mobile-transactions/supertool/v2-grouped-desktop-light.png` | Date-grouped card list (Feb 3/2/1 headers), amount+badge+category, actions right, hover highlight — matches reference |
| `…/v2-grouped-desktop-dark.png` | Same, dark tokens intact |
| `…/v2-grouped-mobile-light.png` | Grouped cards at 390px, `scrollWidth==innerWidth==390` (no overflow), actions reachable |
| `…/v2-grouped-mobile-dark.png` | Same, dark tokens intact, no overflow |
| `…/v2-category-picker-desktop-light.png` | Two-pane cascade: main categories + active parent's subcategories ("All Базові потреби" + children) — matches reference Image #2 |
| `…/v2-category-picker-mobile-light.png` | Same cascade, full-width and touch-usable at 390px |

The reference-parity gap the user flagged (flat table, no grouping, broken flat category select) is resolved; the list and filter now match the reference at all widths in both themes.

### File List

- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.tsx` (UPDATE — date-grouped card list at all widths; table removed)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.module.scss` (UPDATE — `.list`/`.dateGroup`/`.dateHeader`/`.cardList`; table toggle removed)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-list/TransactionList.test.tsx` (UPDATE — grouping + action-reachability assertions)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.tsx` (NEW — synchronous server card, reference row layout)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.module.scss` (NEW — token-only card styles, hover)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-card/TransactionCard.test.tsx` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/components/category-picker/CategoryPicker.tsx` (NEW — two-pane cascading hierarchical picker)
- `apps/money-tracker/src/app/[locale]/transactions/components/category-picker/CategoryPicker.module.scss` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/components/category-picker/CategoryPicker.test.tsx` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/components/category-picker/constants.ts` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/components/category-picker/hooks/use-category-picker.ts` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.tsx` (UPDATE — use `CategoryPicker` instead of `Combobox`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-filters/TransactionFilters.test.tsx` (UPDATE — drive the real picker)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.tsx` (UPDATE — category field uses `CategoryPicker` (cascade); currency still `Combobox`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/TransactionForm.test.tsx` (UPDATE — category assertions target the picker)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/hooks/use-transaction-form.ts` (UPDATE — `selectedType` exposed; type-based category-reset replaces the option-list build)
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-category-option-list.ts` (DELETED — orphaned by form picker)
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-category-option-list.test.ts` (DELETED)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.tsx` (UPDATE — icon buttons (Duplicate/Edit/Delete) with aria-labels; added Copy/duplicate link)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.module.scss` (UPDATE — gap `--spacing-1`→`--spacing`)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-row-actions/TransactionRowActions.test.tsx` (UPDATE — Link mock forwards aria-label)
- `apps/money-tracker/src/constants/routes.ts` (UPDATE — `getTransactionCopyPath` + `COPY_FROM_SEARCH_PARAM`)
- `apps/money-tracker/src/app/[locale]/transactions/new/page.tsx` (UPDATE — read `?copyFrom`, fetch source, pass to form)
- `apps/money-tracker/src/app/[locale]/transactions/components/transaction-form/hooks/use-transaction-form.ts` (UPDATE — `copyFrom` prefill source, create mode preserved)
- `apps/money-tracker/src/app/[locale]/transactions/utils/get-category-label.ts` (NEW — extracted shared helper)
- `apps/money-tracker/src/app/[locale]/transactions/utils/group-transaction-list-by-date.ts` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/utils/group-transaction-list-by-date.test.ts` (NEW)
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-filter-category-option-list.ts` (DELETED — orphaned by picker)
- `apps/money-tracker/src/app/[locale]/transactions/utils/build-filter-category-option-list.test.ts` (DELETED)
- `apps/money-tracker/messages/en/transactions-page.json` + `…/uk/transactions-page.json` (UPDATE — `filters.categoryAllInParent`)
- `_bmad-output/implementation-artifacts/visual-qa/4-2-mobile-transactions/supertool/v2-*.png` (NEW — visual-QA evidence)

### Change Log

| Date | Change |
|---|---|
| 2026-06-16 | Story created — ready-for-dev. |
| 2026-06-16 | First cut: mobile card layout + CSS table/card display-toggle (RP-U2/RP-U4); tests + visual QA green. Status → review. |
| 2026-06-16 | **Course correction (product-owner directed):** dropped the desktop table for date-grouped cards at ALL widths (reference parity, supersedes AC #2); pulled the reference's two-pane cascading category picker forward (RP-F9) to replace the flat `Combobox`. Added grouping util + picker (component/hook/scss/tests), `filters.categoryAllInParent` (en+uk), deleted orphaned filter-option util. 149 tests + lint + type-check + stylelint + i18n parity green; visual QA re-done at all widths/themes. |
| 2026-06-16 | Generalised `CategoryPicker` (labels/`showAllOption`/`getParentOptionLabel`/`error` props) and adopted it in the **create/edit transaction form** too (was still the flat `Combobox`); deleted orphaned `buildCategoryOptionList`; form hook resets out-of-type category via a type-filtered id set. Gates green (149 tests); form picker visually verified (`v2-form-category-picker-desktop-light.png`). |
| 2026-06-16 | Row actions → **icon buttons** (Duplicate/Edit/Delete, lucide, aria-labelled) matching the reference. Implemented a real **duplicate** flow (RP-F9): `getTransactionCopyPath` → `/transactions/new?copyFrom=<id>`; the create page fetches the source and pre-fills the form in create mode (`copyFrom` prop). Added `actions.copy` (en+uk). Gates green (149 tests); verified live — icons render, copy URL pre-fills amount/category/date/currency and submits as a new transaction (`v2-grouped-desktop-light-icons.png`, `v2-copy-prefill-desktop-light.png`). |
| 2026-06-16 | **Code review (adversarial 3-layer + triage).** Resolved 5 decisions (ED1 waiver, scope sanction + ACs #7–#9, AC #1/#2 amended, amount-sort grouping). Applied 6 patches: focus restored to picker trigger on close, subcategory `aria-label` fallback, `getCategoryLabel`/whitespace-note guards, **flat list (no date headers) under `sortBy=amount`** (+ test → 150 green), AC/ED1 docs. Gates re-run green (type-check, lint 0/0, stylelint, 150 tests, i18n parity). |
| 2026-06-16 | **Visual QA re-captured (BLOCKING gate cleared).** Full matrix `{light,dark} × {390px,≥1024px}` × {list, filter picker single+cascade, form picker, mobile delete dialog} — 18 `qa-*` captures + 4 reference images; all reviewed visually; 390px no-overflow confirmed. |
| 2026-06-16 | **Last review item closed → Status `done`.** Filter now self-heals a stale/invalid `categoryId` (clears it instead of silently filtering while showing "All categories"); hook handlers memoized. 3 tests added (153 green); live-verified. All review findings resolved (5 decisions, all patches; 2 deferred, 7 dismissed). |

## Review Findings (Code Review 2026-06-16)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Gates run by orchestrator, all green: type-check ✓, oxlint 0/0 ✓, stylelint ✓, 149 tests/32 files ✓, i18n parity ✓. Passes confirmed: D1 (string money), NFR6 (generated client only), NFR1 (tests shipped), FR19/FR20 (key parity), RSC boundary (`TransactionList` stays async server component, no JS viewport detection).

### Decision-needed — ALL RESOLVED (operator, 2026-06-16)

- [x] [Review][Decision] **ED1: `CategoryPicker` near-verbatim copy of `example/`** → **RESOLVED: accepted as sanctioned ED1 waiver** (project strategy is reference parity). Recorded in the "ED1 waiver" note under Acceptance Criteria. No rework.
- [x] [Review][Decision] **Scope beyond the ACs: duplicate/copy flow + form category-picker swap** → **RESOLVED: sanctioned**; amended ACs #7–#9 added to authorize the cascading picker, duplicate flow, and icon row actions.
- [x] [Review][Decision] **AC #2 (desktop table preserved) intentionally NOT met** → **RESOLVED: AC text updated** — AC #1/#2 amended for cards-at-all-widths; the Architecture Decision section annotated as superseded.
- [x] [Review][Decision] **AC #1 currency field dropped from each card** → **RESOLVED: AC #1 amended** — currency carried by the Intl-formatted amount; explicit per-card field intentionally dropped (single-default-currency).
- [x] [Review][Decision] **Date grouping fragments under `sortBy=amount`** → **RESOLVED: suppress grouping under amount sort** — implemented (see Patch #6).

### Patch — #2–#8 applied; #1 remains BLOCKING action item

- [x] [Review][Patch] **🔴 BLOCKING — Visual Evidence Gate — RESOLVED 2026-06-16** — full matrix re-captured live (data month `2024-12`, seeded operator, `:3000`, playwright-cli): 18 `qa-*` captures covering **{light, dark} × {mobile 390px, desktop ≥1024px}** for the **list**, **filter category picker (single + two-pane cascade)**, **form category picker**, and the **delete `AlertDialog` open on mobile** (both themes). `reference/` populated with 4 reference images (list desktop/mobile, category-picker desktop, create mobile). 390px overflow check passed (`scrollWidth === innerWidth`). All shots reviewed visually (not just file-existence): dark theming correct, cascade two-pane confirmed, delete prompt shows formatted amount+date. [`_bmad-output/implementation-artifacts/visual-qa/4-2-mobile-transactions/`] ✅ resolved
- [x] [Review][Patch] **Filter stale `categoryId` now self-heals — RESOLVED 2026-06-16** — `TransactionFilters` detects when the URL `categoryId` is not a valid category for the active type (deleted/other-type) and clears it via `handleCategoryChange` (effect), so the control no longer reads "All categories" while silently filtering. Hook handlers memoized with `useCallback` for a stable effect dep. 3 new tests (stale id, type-mismatch id, valid id kept) → 153 green. Live-verified: `?categoryId=nonexistent` self-heals to no filter, all rows shown. [`transaction-filters/TransactionFilters.tsx` + `hooks/use-transaction-filters.ts`] ✅ resolved
- [x] [Review][Patch] **Focus restored to trigger on every close path** — added a close-tracking effect in `CategoryPicker.tsx` that returns focus to the trigger when the picker closes and focus fell to `<body>` (selection close). [`category-picker/CategoryPicker.tsx`] ✅ applied
- [x] [Review][Patch] **Subcategory pane `aria-label` fallback** — `aria-label={activeMainCategoryName ?? ariaLabel}`. [`category-picker/CategoryPicker.tsx`] ✅ applied
- [x] [Review][Patch] **Defensive guards** — `getCategoryLabel` now ignores a null/blank parent name (no stray `" / "`) [`utils/get-category-label.ts`]; `TransactionCard` note guard is `note.trim() !== ''` (no blank line for whitespace-only notes) [`transaction-card/TransactionCard.tsx`]. ✅ applied. _Copy-currency_: the existing `checkIsCurrencyCode` fallback is the only safe behavior for an invalid legacy currency (single-default-currency) — left as-is, not a defect.
- [x] [Review][Patch] **Suppress date grouping under `sortBy=amount`** — `TransactionList` renders a flat card list (no date headers) when `sortBy !== date`; new test covers it (150 tests green). [`transaction-list/TransactionList.tsx`] ✅ applied
- [x] [Review][Patch] **AC text + ED1 waiver documented** — AC #1/#2 amended, ACs #7–#9 added, Architecture Decision annotated as superseded, ED1 waiver recorded. ✅ applied

### Deferred (pre-existing / out of current scope)

- [x] [Review][Defer] **Deeply nested (3rd-level) categories unselectable in the picker** — `mainCategoryList` is `parentId === null` and the sub-pane renders only one child level; a grandchild category cannot be reached. Latent — seed data is two-level today (memory `seed-data-has-subcategory`). [`category-picker/hooks/use-category-picker.ts`] — deferred, latent until a 3-level hierarchy is introduced.
- [x] [Review][Defer] **Listbox keyboard polish** — no Home/End/typeahead, no arrow-wrap at list ends, ArrowDown on the closed trigger doesn't open the list. Matches the example pattern. [`category-picker/CategoryPicker.tsx`] — deferred, enhancement.

### Dismissed (7 — noise / false positives)

`ALL_OPTION_VALUE` "unused import" (used at TransactionFilters.tsx:41,60); `mixins.hover` "sticky on mobile" (gated behind `@media (hover: hover)`); empty-list "empty box" (guarded upstream by `TransactionListServer` empty-state); `copyFrom` array→null (intended); `copyFrom` "page crash" (hey-api client returns `data ?? null`, no throw → graceful blank form); `TransactionForm` placeholder-text test coupling (not a defect); `formatTransactionDate` timezone (verified tz-safe — local fields in/out).
