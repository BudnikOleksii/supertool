# Reference Capture Log — Authenticated App (with imported data)

Spike: Reference-Parity Gap Analysis. Agent session: `refauth`.
Reference frontend: http://localhost:3000/ — Reference API: http://localhost:8080/api.
Capture target dir: `_bmad-output/implementation-artifacts/visual-qa/spike-reference-parity/reference/`.

## Account & auth flow

- **Account used:** `spike+auth1@example.com` / password `SpikePass123!` (disposable, test env).
- **Sign-up:** From landing `/`, "Get Started" → `/sign-up`. The sign-up form takes **email + password directly** (password is NOT deferred to onboarding, contrary to the brief's "later step" assumption). OAuth buttons present (Google, GitHub).
- **Email verification HARD-BLOCKED** the flow: after sign-up the app redirected to `/verify-email` ("Check your email"). There is no local SMTP.
- **Fallback used (per brief):** Reference Postgres runs in Docker container `tracker-postgres` on `127.0.0.1:5433` (creds recovered from the container env, not the git-ignored `.env`: db `tracker` / user `tracker` / pw `tracker123`). Schema is a **custom NestJS/Drizzle schema with PascalCase tables** (NOT better-auth): `User`, `Verification`, `Transaction`, `TransactionCategory`, `RecurringTransaction`, `Budget`, `RefreshToken`, `UserAuthIdentity`, `LoginLog`, `KnownDevice`, `AuditLog`, `DefaultTransactionCategory`.
  - `User.emailVerificationToken` held the token exactly as the brief described.
  - Verify endpoint is `GET /api/auth/verify-email?token=<token>` (from Swagger). Navigating the browser to it returned `?status=success`, the app auto-signed-in, and redirected straight to `/onboarding`.

## Onboarding (2 steps, not 3)

The live onboarding stepper shows only **Currency → Categories** (the brief's "password" step does not exist as a separate step here, because the password was set at sign-up).

1. **Currency step** (`/onboarding`): searchable currency combobox (full ISO currency list). Selected **UAH** (matches dataset). `onboarding--currency`, `onboarding--currency-dropdown`.
2. **Categories step** (`/onboarding?step=categories&currency=UAH`): offers two paths — **"Use Default Categories"** OR **"Import transactions from file"** (Choose File). The import IS available inside onboarding (in addition to the standalone `/transactions/import` page). `onboarding--categories`.

## Import (THE key step — succeeded)

Uploaded `apps/api/src/database/data/transactions-02.03.25.json` via the onboarding Categories step "Choose File" + `playwright-cli upload`.

- **Preview** rendered: **"Total: 1880 rows", "Valid: 1880"**, plus a scrollable per-row preview (`02/03/2025 15:41:17 · Донати · 10 UAH` …) and an **"Import 1880 transactions"** button. `import--preview`.
- **Result after import:** **1880 transactions created, 21 categories created, 34 subcategories created.** `import--result`.
- The dataset spans **2021 → Feb 2025** (category-detail views show transactions back to 2021), not only Feb 2025.
- `import--upload` = the categories step before file selection (the import control's idle state).

### Standalone Import page (`/transactions/import`)
Separate nav item under Transactions. Minimal: a raw native `<input type=file>` ("Choose file / No file chosen"), help text "Accepted formats: .json, .csv". NO drag-drop zone, no styling, no preview shown on this page (unlike the rich onboarding import). Top-bar title was stale ("By Date"). `import--page`.

## Dashboard (`/dashboard`)

Nav (left sidebar): **Dashboard, Transactions (expandable → By Date, By Category, Recurring, Import), Categories, Budgets, Settings.** Collapsible sidebar. Top bar: page title + user avatar.

- **CRITICAL default-period bug:** On first load the dashboard's aggregation widgets (Summary, Spending by Category, Income vs Expenses, Top Categories) all showed **"No data available for the selected period"** even though 1880 rows were imported and Recent Transactions listed them. The date-range filter defaults to **empty/current-period (June 2026)** while the data is 2021–2025. The widgets do not auto-fit to the user's actual data range. Had to manually set From=2024-01-01 / To=2025-12-31 to populate.
- With range set: **Total Income UAH 1,272,646.65 · Total Expenses UAH 551,878.99 · Net Balance UAH 720,767.66 · 885 transactions** (in range). Filter bar = two native date inputs + All/Income/Expense toggle + UAH currency selector.
- Widgets: **Summary** (4 stat cards), **Spending by Category** (donut — but renders only the legend, the donut graphic itself was not visible — likely a render/clipping bug), **Income vs Expenses** (monthly grouped bar chart Jan24–Feb25, renders well), **Top Categories** (ranked list with progress bars + amounts), **Daily Spending** (line/area chart — showed an EMPTY axis 1–31 / 0–4; appears hard-coded to current month June 2026, ignoring the selected range), **Recent Transactions** (list + "View all transactions" link).
- `dashboard--overview` + `-scroll1/2/3` (desktop & mobile).
- **No dark-mode toggle exists anywhere in the app** → `dashboard--overview-dark` is N/A (reference is light-mode only).

## Transactions

### By Date (`/transactions`)
- Controls: **Export All**, **Export** (dropdown: Download CSV / Download JSON), **Create Transaction**, type filter (All/Income/Expense), **month/year navigation** (prev/next month, prev/next year — the list is scoped to ONE MONTH at a time), sort combobox (Date), Ascending/Descending toggle, hierarchical **"All categories"** filter dropdown (categories expand to subcategories via chevron).
- **Month-scoping pitfall:** defaults to current month (June 2026) = "No transactions found" empty state (receipt icon). Had to navigate to Feb 2025 (via `?dateFrom/dateTo` URL params) to see data. Empty state: `transactions--list-empty-month`.
- List grouped by day (Feb 3 / Feb 2 / Feb 1 headers). Each row: select checkbox, amount, Income/Expense badge, Category / Subcategory. **Edit/Delete/Duplicate icons appear only on hover** (discoverability concern). Rows do not display the transaction time.
- `transactions--list`, `transactions--filters` (open category dropdown).
- **Bulk-delete is NOT on the By Date view** — selecting checkboxes there surfaced no action bar. Bulk-delete lives on the **By Category detail** view.

### Create / Edit (`/transactions/create`, `/transactions/{id}/edit`)
- Form: Transaction Type (Income/Expense radio), **Category picker** (button → hierarchical category/subcategory list), Amount (number with UAH prefix + spinner), Date (native date), **Time (separate Hours / Minutes textboxes)**, Description (optional). Cancel / Create Transaction (or Save on edit). Edit pre-fills values. `transactions--create`, `transactions--create-category-picker`, `transactions--edit`.

### By Category (`/transactions/by-category`)
- List of category cards with Income/Expense badge + chevron → each links to `/transactions/by-category/{categoryId}`. **No aggregate total/count shown per category on the list** (UX gap — you'd expect per-category sums). No visible date-filter bar on this view (ignores passed date params). `transactions--by-category`.

### Category detail / Bulk-delete (`/transactions/by-category/{id}`)
- Accordion per group ("Direct transactions UAH 25,596.73" with total), Export button. Expanding reveals selectable transaction rows (date + amount + type badge). Shows the FULL date history for the category (ignores date range — showed 2021–2024 rows).
- **Bulk-delete action bar** (fixed bottom): "N transactions selected" + "Select all visible" + "Clear selection" + red "Delete selected". `transactions--category-detail`, `transactions--bulk-delete`, `transactions--bulk-delete-bar`.

### Recurring (`/transactions/recurring`)
- Status filter (All/Active/Paused/Cancelled), "Create Recurring Transaction". Empty state polished (loop icon + "No recurring transactions found / Create your first..."). `transactions--recurring`.
- Create form (`/transactions/recurring/create`): type, category, amount, currency (UAH), **Frequency (Daily/Weekly/Monthly…)**, **Repeat Every** (interval N), **Start Date**, **End Date (optional)**, Description. `transactions--recurring-create`.

### Export
- Both "Export All" and "Export" (filtered scope) open a menu: **Download CSV / Download JSON**. `transactions--export`.

## Categories (`/categories`)
- Type filter (All/Income/Expense), "Create Category". Each category row: name + type badge + expand chevron; Edit/Delete on hover. Expanding a parent shows its **two-level subcategory tree** (e.g. Базові потреби → Банкінг, Продукти, Різне, ТБ+Інтернет, Телефон). Subcategory rows have no visible edit/delete affordance. `categories--list`, `categories--list-expanded`.
- Create form: Category Name, Type (Income/Expense), **Parent Category (optional)** = the two-level mechanism. `categories--create`, `categories--edit`.

## Budgets (`/budgets`)
- **Confirmed stub.** Only a "Budgets" heading — no content, no empty-state, no create button (despite a `Budget` table existing in the backend). `budgets--overview`.

## Settings (`/settings`)
- Single page, three sections: **Profile** (First Name, Last Name, Country dropdown, Base Currency [UAH], Save Changes) — names are empty (not collected at signup); **Security** (Current Password, New Password, Change Password); **Danger Zone** (warning text + red "Delete Account").
- Delete-account opens an **alertdialog** requiring password confirmation + red "Delete My Account". `settings--profile`, `settings--change-password`, `settings--delete-account`, `settings--delete-account-confirm`.

## App chrome
- **Mobile drawer nav** (`chrome--mobile-nav`): hamburger ("Open menu") slides a left drawer over a dimmed backdrop; same nav items + expandable Transactions.
- **User menu** (`chrome--user-menu`, desktop + mobile): minimal — **only "Sign out"**. No profile shortcut, no email display, no theme toggle.
- `chrome--nav-transactions-expanded` (desktop sidebar with Transactions subtree open).

## Notes / anomalies
- The persistent dark circular "N" button at bottom-left is the **Next.js Dev Tools** toggle (dev build), NOT app chrome — ignore in parity analysis.
- Refs from `playwright-cli snapshot` are regenerated on every navigation/re-render; month-step clicks with stale refs silently no-op. Used `?dateFrom/dateTo` URL params to jump to data months reliably.
- Reference is **light-mode only** (no theme switching).
