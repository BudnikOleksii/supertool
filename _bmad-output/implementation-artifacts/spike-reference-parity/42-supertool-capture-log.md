# Supertool Money-Tracker — Capture Log (Reference-Parity Spike)

Captured: 2026-06-16. Agent: supertool browser-capture (session `supertool`).
Target dir: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/supertool/`
Environment: frontend `http://localhost:3010`, API `http://localhost:3001/api/v1`, seeded operator account (1,881 transactions).

## Auth note (blocking issue worked around)

The seeded operator credentials are valid (direct API `POST /auth/sign-in/email` returns 200), but **in-browser sign-in fails with HTTP 403**. Root cause: `AUTH_TRUSTED_ORIGINS=http://localhost:3000` in `apps/api/.env.example` (and presumably the running `.env`), while this dev instance serves the frontend on **port 3010**. better-auth rejects the browser's `Origin: http://localhost:3010` as untrusted. To proceed with the authenticated capture, a valid `better-auth.session_token` was minted via the direct API (port 3001) and injected into the Playwright browser context as an HttpOnly cookie for `localhost`. All authenticated screens were then reachable. This origin/port mismatch is a real finding — the login UI is unusable on `:3010` as configured.

## Data note

- Default period everywhere is the **current month (June 2026)**, which has almost no data (one seeded QA expense of UAH 42.50). This is the default state captured as `*--empty-default`.
- The data-rich month is **February 2025** (`?period=2025-02`, UAH 4,542.29 expenses across 4 categories) — the import dataset is dated 2025-02-03. Populated captures use this period.
- Period is carried in the URL as `?period=YYYY-MM` (good — shareable/bookmarkable). Switching **locale resets the period** back to the current-month default (minor finding).

## Screens captured (33 PNGs)

| Screen | Desktop | Mobile | Notes |
|---|---|---|---|
| Landing (`/`) | yes | yes | `/` redirects to `/sign-in` when unauthenticated; authenticated `/` is a bare placeholder with 3 text links |
| Sign in | yes | yes | centered card; email+password only |
| Sign up | yes | yes | name+email+password; **no OAuth buttons** |
| Dashboard empty-default (Jun 2026) | yes | — | sparse single-expense state |
| Dashboard overview (Feb 2025) | yes | yes | summary cards + expenses-by-category + 12-month trend |
| Dashboard dark | yes | yes | full dark theme |
| Dashboard UK locale | yes | yes | uk-UA currency/number formatting |
| Transactions empty-default (Jun 2026) | yes | — | one row |
| Transactions list (Feb 2025) | yes | yes | table, filters/sort inline |
| Transactions filters (dropdown open) | yes | — | two-level category list |
| Transactions empty-month (Mar 2025) | yes | — | empty-state copy |
| Transactions create | yes | yes | type toggle, amount, currency, category, date, note |
| Transactions edit | yes | yes | pre-populated |
| Categories list | yes | yes | accordion cards, type badges |
| Categories create | yes | yes | name, type, parent |
| Categories edit | yes | yes | type field **disabled** on edit |
| Settings / profile | yes | yes | name, default language, default currency |
| Chrome user menu | yes | yes | Settings + Sign out only |
| Chrome mobile-nav | — | yes | **no drawer exists** — same header overflows |

(No pagination control was visible: the Feb 2025 set fit one page. Pagination not exercised.)

## Per-screen UI/UX observations

### App chrome / navigation
- Single top header: "Money Tracker" link (left) + Theme switcher + Language switcher + "Operator" user-menu button (right). There is **no sidebar and no in-app nav links** — navigation between dashboard/transactions/categories/settings relies on the landing-page links, the user menu (Settings only), or direct URLs. There is no persistent way to move between the three main tools from within a tool page.
- **Mobile: the header does not adapt.** The same desktop row is rendered; "Operator" is pushed to/over the right edge and the user-menu dropdown is partially clipped by the viewport. There is **no hamburger / no mobile nav drawer** at all. (`chrome--mobile-nav--mobile.png`)
- User menu contains only "Settings" and "Sign out" — no account name/email display.

### Landing
- Authenticated `/` is a literal placeholder: H1 "Money Tracker", one sentence, and three plain links (Open dashboard / Manage categories / View transactions). No hero, no marketing sections. The reference has a full marketing home (Hero/Advantages/FAQ/Reviews/Footer). This is a large content/polish gap, though for a personal PoC the placeholder may be acceptable.

### Auth
- Sign-in/Sign-up are clean centered cards, consistent styling, good on both viewports.
- **No OAuth** (Google/GitHub) buttons — the reference offers social login. No "verify email" / forgot-password flows surfaced.

### Dashboard
- Three widgets render well: summary (Income/Expense/Net), Expenses-by-category (horizontal % bars), Income-vs-expense 12-month trend (bar chart). Hierarchy and spacing are clean.
- The trend chart spans the trailing 12 months regardless of the selected summary month — nice context, but the relationship between the month selector and the always-12-month chart isn't labeled.
- Empty default month (June 2026) is handled gracefully (per-widget empty copy on truly empty months like Mar 2025).
- **Dark mode is a clear win over the reference** — proper token-based dark surfaces, category bars get a lavender glow, chart colors preserved. (`dashboard--overview-dark--*`)
- **Mobile: summary card stacks vertically and reads fine; the trend chart is present but the header overflow issue persists.** Charts appear to scale to width.

### Transactions
- Desktop table is clean: Date / Category (Parent / Child) / Type badge / Amount / Currency / Note / Actions. Month nav + "Add transaction" CTA + 4 inline filter/sort comboboxes (type, category, sort field, sort order).
- Category filter dropdown correctly shows the two-level hierarchy ("Базові потреби / Банкінг"). Minor: "All categories" appears twice (selected header + first option).
- **Mobile: the transactions table is the worst responsive offender.** It renders as a fixed wide HTML table that overflows horizontally — Amount/Currency/Note/Actions are clipped off-screen with no visible horizontal-scroll affordance. Needs a card/stacked layout for mobile. (`transactions--list--mobile.png`)
- Create/Edit forms are **mobile-friendly** — single column, full-width fields, native date picker, type toggle. Good.
- Empty-month state has clear copy.

### Categories
- List is an accordion of cards with color-coded Expense/Income badges and expand chevrons for subcategories; "New category" CTA top-right. Clean.
- Create form: Name / Type / Parent category.
- **Edit form disables the Type field** (cannot change a category's type after creation) — intentional constraint, worth confirming against the reference.
- **Mobile: cards stack, but rows with long names ("Дохід (програмування)", "Зарплата(туризм)") squeeze the Edit/Delete actions to the edge and clip "Delete."** Row layout doesn't wrap.

### Settings / profile
- Single card: Name, Language (sign-in default locale), Default currency, with helpful descriptions. Clean on both viewports. Currency is a single profile default (consistent with the simplified currency model), not a per-transaction selector beyond create/edit.

### Internationalization
- UK locale fully translates UI ("Огляд", "Дохід/Витрати/Баланс", "Витрати за категоріями") AND localizes number/currency formatting: `4 542,29 ₴` (space thousands, comma decimal, ₴ symbol) vs en `UAH 4,542.29`. Strong i18n — likely at parity or better than the reference.

## Compare-to-reference quick deltas
- **Worse / missing:** no marketing landing; no OAuth; no in-app nav (no sidebar/drawer); mobile chrome + mobile transactions table not responsive (mobile is a hard requirement for parity); no budgets, no transaction-import UI, no by-category drill-down/bulk-delete observed in supertool routes.
- **At parity:** core CRUD for transactions + categories, dashboard analytics widgets, monthly period model, two-level category hierarchy, string-money formatting.
- **Better:** dark mode, locale-aware currency/number formatting, URL-param period state.
</content>
