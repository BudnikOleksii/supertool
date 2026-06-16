# Reference Frontend Inventory — `example/track-my-life` money-tracker

Static code-analysis inventory of the **reference** Next.js frontend (`example/track-my-life/apps/money-tracker/` + shared `packages/`). No browser used. Per ED1: behavior observed and described only — no reference code is copied here.

Base path for all routes: `src/app/[locale]/`. Route groups: `(home-layout)`, `(auth-layout)`, `(onboarding-layout)`, `(app-layout)`.

Stack: Next.js 16.2 (App Router, RSC), React 19.2, next-intl 4.8, next-themes 0.4, react-hook-form 7.71 + zod 4.3, recharts 3.8 (charts), papaparse 5.5 (CSV import), lucide-react (icons), sonner (toasts), Radix primitives + SCSS-module design system (Material Design 3 tokens).

Architectural pattern (every list/detail route): server `page.tsx` parses `searchParams` → `<Suspense key={JSON.stringify(filters)}>` over an async `*ListServer` RSC (data via cached `fetch*`) → renders a `'use client'` `page.content.tsx` owning dialog/selection state. Mutations are `'use server'` actions returning a result (`{ ok }` / `{ success, error }`) that call `updateTag(<cacheTag>)` then `redirect`/toast. Filter state lives in URL search params via the shared `useUrlFilters` hook. **Money is string-typed end-to-end.**

---

## A. LANDING / HOME — `(home-layout)`

Verdict: **fully built and polished** (responsive, real en+uk, design tokens, clear funnel). Layout has no top nav; Footer rendered by the layout.

- [ ] `/` — Marketing landing; section order Hero → Advantages → Reviews → FAQ.
  - [ ] **HeroSection** — Headline "Take Control of Your Finances" + subhead; CTAs: primary "Get Started" → `/sign-up`, secondary "Learn More" → `#advantages` anchor. No imagery.
  - [ ] **AdvantagesSection** — "Why Track My Money?"; 4 cards w/ emoji icons (Smart Tracking, Budget Planning, Financial Insights, Recurring Transactions). Responsive 1/2/4 cols.
  - [ ] **ReviewsSection** — 3 static testimonial cards (quote + name + role); no carousel, no avatars, no star ratings.
  - [ ] **FaqSection** — Radix Accordion `type="single"` collapsible, 5 Q&A (free, data security, multi-currency, recurring, export).
  - [ ] **Footer** — 3 links (Privacy `/privacy-policy`, Terms `/terms-of-service`, Contact `/contact`), dynamic-year copyright. No locale switcher, no social.

---

## B. AUTH — `(auth-layout)`

Note: reference uses a **custom token/cookie `AuthApiService`** (HttpOnly cookie session + in-memory access token), NOT a better-auth client SDK → divergence (supertool standardizes on better-auth). Auth `ActionState` here is `{ errors } | null` (success = `null`), simpler than supertool's discriminated union.

- [ ] `/sign-up` — Fields: email, password (min 8). → `register()` → redirect `/verify-email`.
- [ ] `/sign-in` — Fields: email, password (min 8). → `login()` → redirect `/dashboard`.
- [ ] **AuthForm** (shared) — RHF + zodResolver, validate onBlur, per-field `FieldError` + global form error; `useActionState`+`useTransition`, submit disabled while pending.
- [ ] **OAuthProviderButtons** — exactly 2 providers: **Google + GitHub**; click → `window.location.href = ${API}/api/auth/{provider}` (server-driven redirect, no client SDK).
- [ ] `/verify-email` — Reads URL `status` (waiting/success/error) + `error` reason → status-dependent card; **SuccessRedirect** waits 1000ms then → `/onboarding`. Always shows Sign In link.
- [ ] `/auth/callback` — OAuth return; reads `code`/`error`/`reason`; spinner while exchanging code → `exchangeSocialCode` → redirect `/dashboard`; error card on failure.
- [ ] `error.tsx` — group error boundary → `AppErrorBoundary` (retry + home).

Redirect map: sign-up → verify-email → (1s) → onboarding; sign-in → dashboard; OAuth callback → dashboard.

---

## C. ONBOARDING — `(onboarding-layout)`

Verdict: **fully built**, 3 steps. **No back button**; forward via `router.replace()` with URL params (`?step=&currency=`). StepIndicator = dots + labels, not clickable.

- [ ] `/onboarding` — Guard (`layout.tsx`, fetched each request): email-unverified → `/verify-email`; already onboarded → `/dashboard`. Page forces currency-first (any step without `currency` param → currency step).
  - [ ] **Step 1 Currency** — Combobox over full `CURRENCY_CODE_LIST` (ISO 4217); pre-selectable via `?currency=`; zod-validated → `?step=categories&currency=`.
  - [ ] **Step 2 Categories** — Two paths: (1) one-click **assign default/seeded categories** (`assignDefaultCategories`), OR (2) **CSV/JSON file import** with parse → validation preview (total/valid/invalid + per-row status badges) → `importTransactionList` → result summary (transactions/categories/subcategories created). No per-category toggle/custom-create here.
  - [ ] **Step 3 Password** — Only when OAuth user has no password (`hasPassword=false`). Fields: password + confirm (min 8, must match). **Skippable** ("Set Password" vs "Skip"). → `completeOnboarding({ password?, baseCurrencyCode })`.
  - [ ] Completion → sets `onboardingCompleted`, invalidates ONBOARDING cache, redirect `/dashboard`.

---

## D. DASHBOARD — `(app-layout)/dashboard`

Charting: **recharts**, chart bodies split to `'use client'` `*Content.tsx`, lazy via `next/dynamic`. Each of six widgets in its own `<Suspense>` w/ 3-bar skeleton; grid 1 col mobile → 2 @768px → 3 @1440px (Summary spans full width).

- [ ] `/dashboard` — Filterable money dashboard, six independently-streamed widgets; gated by onboarding redirect.
  - [ ] **SummaryWidget** — 4 stat cards: Total Income, Total Expenses, Net Balance, Transaction Count. `formatAmount` string money. Empty when count 0.
  - [ ] **CategoryBreakdownChart** — recharts **donut PieChart** (inner 60/outer 100, h300), slices by category total, 8-color positional palette, Tooltip ("CCC value") + Legend.
  - [ ] **TrendsChart** — recharts grouped **BarChart** (NOT line/area): two bars/period income (green `#22c55e`) vs expenses (red `#ef4444`); X "MMM YY"; granularity hardcoded monthly.
  - [ ] **TopCategoryList** — ranked top-5 spending; rank badge + name + amount + hand-built horizontal progress bar (width = percentage, positional color via CSS vars).
  - [ ] **DailySpendingChart** — recharts **BarChart**, one bar/day, single color `#6366f1`; **month-scoped** off `dateTo` (year/month), diverges from the others' free range.
  - [ ] **RecentTransactionList** — last 5 (amount + type Badge + date + optional description); footer link → all transactions. Reuses transactions `fetchTransactionList`.
  - [ ] **WidgetCard** — shared Card shell; renders `noDataLabel` when empty (single empty-state mechanism).
  - [ ] **DashboardFilterBar** — free **date range** (two native `<input type=date>` dateFrom/dateTo, NO month presets), **type** filter (ALL/INCOME/EXPENSE), **currency** Select over `CURRENCY_CODE_LIST` (default UAH). URL params `dateFrom/dateTo/type/currency`; dates TZ-offset-converted.

---

## E. TRANSACTIONS — `(app-layout)/transactions`

### List + filters
- [ ] `/transactions` — Date-grouped transaction list; header actions: Create link, "Export" (current range), "Export all".
  - Per-row: bulk-select checkbox; `formatAmount`; type Badge (INCOME=success/EXPENSE=warning); category display name ("Parent / Child"); optional description; row actions **Copy** (→ create?copyFrom=id), **Edit**, **Delete**.
  - [ ] **TypeFilter** (ALL/INCOME/EXPENSE segmented; changing type clears categoryId).
  - [ ] **MonthNavigator** (prev/next month chevrons + prev/next year; emits dateFrom/dateTo range).
  - [ ] **TransactionSortFilter** — sortBy Select (date / amount / createdAt, default date) + asc/desc toggle (default desc).
  - [ ] **CategoryPicker** filter (scoped to active type, "All" option).
  - [ ] **Pagination** — offset, page size **20**; URL params `page/pageSize/type/dateFrom/dateTo/categoryId/sortBy/sortOrder`.
  - [ ] Empty state (Receipt icon + "noTransactions"); loading `PageSkeleton count=8 h=56`.
- [ ] **ExportTransactionButton** — dropdown CSV / JSON; calls generated client `exportTransactionList({format,categoryId?,dateFrom?,dateTo?})` → Blob download (filename from Content-Disposition). **Server generates file**, client downloads.

### Create / Edit
- [ ] `/transactions/create` — Create form; supports `?copyFrom=id` prefill (no edit mode).
- [ ] `/transactions/[id]/edit` — Edit form; `notFound()` if missing.
- [ ] **TransactionFormPage** (RHF + zod) fields: **Type** (RadioGroup INCOME/EXPENSE, resets category on change); **Category** (CategoryPicker, type-scoped); **Amount** (numeric step .01, currency code as adornment); **Date** (`<input type=date>`); **Time** (custom TimePicker; date+time combined to local ISO timestamp); **Description** (optional). Currency NOT a field (from profile baseCurrencyCode, default USD). Validation: amount regex `^\d+([.,]\d{1,2})?$`, categoryId/date required, time HH:MM. Submit → push `/transactions`; cancel → back. Revalidates TRANSACTIONS + ANALYTICS.
- [ ] **CategoryPicker** — bespoke two-column hierarchical listbox popover (parents left / subcategories right). **No text search.** Keyboard arrow nav, click-outside/Escape close. Shows "All categories" / "All <parent>" options. Hierarchy from `parentCategoryId`, filtered by type.

### Delete (single + bulk)
- [ ] **DeleteTransactionDialog** — Radix AlertDialog confirm → `deleteTransaction(id)` → revalidate.
- [ ] **Bulk delete** (shared `use-bulk-delete-selection`): `Set<id>` capped at 100 (over-cap info toast), select-all-visible toggle, clear, snapshot on open. **BulkDeleteActionBar** (count + select/deselect/clear/delete). **BulkDeleteTransactionDialog** → `bulkDeleteTransaction(ids)`; **partial-failure re-selects only failed ids** + warning toast.

### By-category
- [ ] `/transactions/by-category` — Lists top-level categories only as links (+ type badge), empty state FolderOpen. No filters/pagination.
- [ ] `/transactions/by-category/[categoryId]` — Drill-down; back link + category-scoped Export button. Radix Accordion (multiple), one item per subcategory group (or "directTransactions") showing **per-currency totals**; content = transactions (checkbox/amount/badge/date/desc). **Bulk delete here too** (own context). No single edit/delete/copy on this page.

### Import — `/transactions/import`  **(IMPORTANT)**
- [ ] `/transactions/import` — File `<input accept=".json,.csv">` → **client-side parse** (`parseImportFile`) → **client-side row validation** → summary + preview → user clicks Import → original File sent via `'use server'` action to generated client (**server re-parses + creates rows**).
  - [ ] **No column-mapping step.** Fixed columns: `Date, Category, Type, Amount, Currency, Subcategory(optional)`. CSV header maps by name.
  - [ ] Formats: `.json` (array of objects) or `.csv` (papaparse, dynamically imported; header:true, dynamicTyping Amount). Client cap **3000 rows**; server cap **5 MB**, MIME `text/csv|application/json`.
  - [ ] Row validation (zod): Date/Category/Currency non-empty; Type expense|income (case-insensitive); Amount positive; Subcategory optional. Per-row `valid` + `errorList`.
  - [ ] **ImportPreviewTable** — Row#, Date, Category, Type, Amount, Currency, Subcategory, **Status** (Valid/Invalid badge + per-issue messages). **ImportSummary** — total / valid / invalid counts.
  - [ ] Import button disabled when validCount 0; on success toast w/ created count + push `/transactions`. **Duplicate handling is server-side only** (not visible in frontend).

### Recurring — `/transactions/recurring`
A recurring transaction = template w/ `frequency` (DAILY/WEEKLY/MONTHLY/YEARLY), `interval` (≥1), `startDate`, optional `endDate`, `status` (ACTIVE/PAUSED/CANCELLED), `nextOccurrenceDate`, plus category/type/amount/currency/description.

- [ ] `/transactions/recurring` — List; Create link. Rows: checkbox, amount, **status Badge** (ACTIVE=success/PAUSED=warning/CANCELLED=destructive), category, "every {interval} {frequency}", next-occurrence date, optional desc; row body links to detail.
  - Row actions: **Pause** (when ACTIVE), **Resume** (when PAUSED), **Delete**, **Edit**. Bulk delete (shared mechanism). Empty state Repeat icon.
  - [ ] **StatusFilter** — ALL/ACTIVE/PAUSED/CANCELLED segmented. URL params `page/pageSize/status` (page size 20). No date/type/category/sort filters.
  - Pause/Resume: list tracks pendingId; detail uses `useOptimistic`. Revalidate RECURRING_TRANSACTIONS.
- [ ] `/transactions/recurring/[id]` — Read-only detail card (amount/status; type, frequency, start/end/next dates, description, created/updated). Inline Pause/Resume/Edit/Delete.
- [ ] `/transactions/recurring/create` and `/transactions/recurring/[id]/edit` — **RecurringTransactionFormPage** (differs from normal form): Type = **Select** (not radio); Category = **Combobox** (searchable, flat, not CategoryPicker); Amount (no currency adornment); Currency = **read-only** Input; **Frequency** Select (default MONTHLY); **Interval** numeric (≥1); **Start date** (required); **End date** (optional); Description. No time component. Dates → UTC ISO.

---

## F. CATEGORIES — `(app-layout)/categories`

Category model: `id, name, type (INCOME/EXPENSE), parentCategoryId|null, createdAt, updatedAt`. **No icon and no color fields exist** — dashboard slice colors are positional decoration only. **Two levels only** (parent → child).

- [ ] `/categories` — Type-filterable two-level category tree + Create button.
  - [ ] **CategoryTypeFilter** — ALL/INCOME/EXPENSE segmented (URL `type` param).
  - [ ] **CategoryTree** — Radix Accordion (multiple). Parent row: trigger w/ name + type Badge + Edit/Delete icon buttons; expanding shows children (name + Edit/Delete). "No subcategories" when childless; empty state FolderOpen when no parents.
- [ ] `/categories/create` — Create form; parent options = top-level categories only.
- [ ] `/categories/[id]/edit` — Edit form; `notFound()` if missing.
- [ ] **CategoryFormPage** (RHF + zod): **Name** (required, trimmed, min length); **Type** Select EXPENSE/INCOME (**disabled when editing** — immutable; update never sends type); **Parent category** Combobox (only when parent options exist; excludes self to prevent self-parenting; `''` → null). Cancel/Submit. Subcategory = category w/ parentCategoryId set, created via the same form.
- [ ] **DeleteCategoryDialog** — branches:
  - Leaf → simple confirm → `deleteCategory(id)`.
  - Parent w/ children → **cascade delete** warning listing all subcategory names + counts; runs `bulkDeleteCategory(children)` then delete parent; detailed partial-failure handling.
  - **Transactions-in-category: deletion is BLOCKED, not reassigned/cascaded.** Backend refuses if category has active transactions; UI surfaces a specific error (detected via fragile "active transactions" string marker). No reassign flow exists.

---

## G. BUDGETS — `(app-layout)/budgets`

- [ ] `/budgets` — **STUB / placeholder.** `page.content.tsx` renders only a single `Typography title`. **No budget entity, no CRUD, no limit/period/progress, no over-budget indicators.** `loading.tsx` shows a title + 3 row skeletons hinting at an intended future list. Treat as future work, not parity.

---

## H. SETTINGS — `(app-layout)/settings`

- [ ] `/settings` — `fetchProfile()` then renders three sections.
  - [ ] **ProfileForm** — editable: First Name, Last Name (optional), **Country Code** (combobox ~249 ISO 3166-1), **Base Currency Code** (combobox ~160 ISO 4217). **Email NOT editable. No locale/theme fields.**
  - [ ] **ChangePasswordForm** — Current Password + New Password (both min 8, **no confirm field**); success toast + reset.
  - [ ] **DeleteAccountSection** — destructive button → AlertDialog w/ **password confirmation** (no type-to-confirm) → `deleteAccount` → clear token → redirect `/sign-in`.

---

## I. APP CHROME / NAVIGATION — `(app-layout)/components`

- [ ] **AppSidebar** — nav order: Dashboard; Transactions (**collapsible submenu**: By Date, By Category, Recurring, Import); Categories; Budgets; Settings. lucide icons; active via longest-path match; parent shows active when child active.
- [ ] **AppHeader** — left: mobile menu (hamburger) toggle + dynamic page title; right: UserMenu only. **No theme toggle, no locale switcher, no search.**
- [ ] **UserMenu** — Avatar (fallback "U") + dropdown w/ **single item: Sign Out**. **No Settings/profile link** (Settings via sidebar).
- [ ] **SidebarProvider** — desktop collapse to icon-rail (tooltips); mobile off-canvas drawer + backdrop + Esc + link-click close. **State not persisted** (plain useState).
- [ ] **PageSkeleton** — `count`+`height` N skeleton bars; the loading convention.
- Responsive: persistent left sidebar (collapsible) on desktop, hamburger drawer on mobile. **No bottom nav.**

---

## J. MISC / SYSTEM PAGES

- [ ] **TimezoneOffsetSetter** — on mount writes `getTimezoneOffset()` to `TIMEZONE_OFFSET` cookie (365d) so server reads browser TZ for date-range conversion. Renders null.
- [ ] `[locale]/[...rest]` — catch-all → `notFound()`.
- [ ] `[locale]/not-found.tsx` — `ErrorState` (i18n) + "Go Home" → **`/dashboard`** (not `/`).
- [ ] `error.tsx` per route group + `[locale]/error.tsx` + `app/global-error.tsx` — all delegate to `AppErrorBoundary` / `ErrorState` (retry + home); global-error has hardcoded EN (outside locale provider).

---

## K. CROSS-CUTTING UX

### I18n
- [ ] Locales: **en (default) + uk** only. LTR only (no RTL). `localeDetection: false`, `localePrefix: as-needed` (en unprefixed, `/uk/...` prefixed).
- [ ] **20 namespace files** per locale (per-page split: `dashboard-page`, `transactions-page`, `transactions-import-page`, `recurring-transactions-page/-form-page`, `categories-page/-form-page`, `budgets-page`, `settings-page`, `home-page`, `onboarding-page`, `sign-in/up-page`, `verify-email-page`, `auth-callback-page`, `auth-shared`, `navigation`, `transactions-by-category-page`, `transactions-form-page`, `all`). Each split into `metadata` + `content`.
- [ ] Fallback: per-file EN fallback on import failure + whole-bundle `deepmerge` over full EN (missing uk key → shows EN, no crash). CI key-parity gate still required.
- [ ] ICU used: **plurals** (`{count, plural, one{# transaction} other{# transactions}}`), **interpolation** (`Page {page} of {total}`, counts, `{amount} {description}`). No ICU number/currency/date skeletons — formatting done in JS via `Intl`.
- [ ] Number/currency/date via shared `Intl` utils (`formatAmount(amountString, currencyCode, locale?)`, `formatDate/formatDateTime`). **Latent bug:** list call sites call `formatAmount` without the active locale → falls back to runtime default locale (fix, don't replicate).
- [ ] **No locale-switcher UI exists** — locale is URL-only. (Parity gap.)

### Theming
- [ ] **next-themes** `attribute="data-theme"` on `<html>`; default = **system** (OS detection on).
- [ ] **No theme-toggle UI exists** — only consumer of `useTheme` is the Toaster. (Parity gap.)
- [ ] **Material Design 3** token system in `packages/ui/src/styles/tokens/` (palette tonal steps, semantic roles under `[data-theme="light|dark"]`, metrics/radii/spacing, M3 elevation shadows, type scale, fonts Poppins + Outfit via next/font). Dark mode = CSS-var swap by `[data-theme]` attribute, not media query. Theme generated via `scripts/generate-theme.ts`.

### Design system (`packages/ui`, Radix + SCSS modules, atoms/molecules)
- [ ] Atoms: Button (variants primary/secondary/outline/ghost/link/destructive; sizes sm/md/lg/icon; polymorphic), Input (error, startAdornment), Checkbox, RadioGroup, Select, **TimePicker** (custom HH:MM stepper), Label, Badge (default/secondary/destructive/outline/ghost/success/warning), Alert, Avatar, Typography (title-xl…xs, body-l/m/s), Separator, AspectRatio, UnderlineLink, **Skeleton**.
- [ ] Molecules: **Toaster** (Sonner) + `toast`, **AlertDialog**, **DropdownMenu**, **Combobox** (searchable), **Field/FormField** (RHF wrapper, FieldError de-dupes), **Card**, **Accordion**, **Breadcrumb**, **Pagination** (Prev/Next + "Page X of Y"), **ErrorState** (icon + title/desc + retry/home).
- [ ] No dedicated chart-wrapper component — recharts used directly in dashboard features. Icons: lucide-react.

### Responsive / mobile
- [ ] Breakpoints (`_breakpoints.scss`): s 390, m 768, l 1024, xl 1440; **min-width mixins** (mobile-first); `hover` mixin gated on `@media (hover:hover)` (touch-safe).
- [ ] Mobile nav = collapsible **sidebar drawer** (no bottom-nav). recharts `ResponsiveContainer width="100%"`. Per-feature responsive SCSS.

### Forms / feedback
- [ ] RHF + zodResolver, co-located schema; React 19 `useActionState` + `useTransition` (isPending disables submit). `ActionState` = `{ success: boolean; error: string|null }` (NOT a tagged status union → don't copy verbatim, supertool mandates discriminated).
- [ ] Errors: field-level via i18n key → `tErrors` translator → `FormField error`; form-level via toasts.
- [ ] Feedback: **Sonner toasts** (single `<Toaster>` in root layout; after mutations + bulk-delete). **Loading**: `loading.tsx` per route + `PageSkeleton`. **Error boundaries**: `error.tsx` per group + `global-error.tsx`. **Empty states**: per-page i18n strings (no shared EmptyState component).

### Notable libs
- [ ] recharts (Pie donut, grouped Bar trends, daily Bar; hardcoded hex colors, no locale-aware tooltips), papaparse (CSV import, dynamically imported), lucide-react (icons), next-themes, sonner (toasts), deepmerge (i18n fallback merge), react-hook-form + @hookform/resolvers + zod.

---

## L. Top divergences / things supertool most likely LACKS

(Ranked by parity impact. Supertool baseline = code only; Epics 1–3 shipped shell, auth, seed/categories, transactions list+CRUD likely partial, and a dashboard with summary/breakdown/trend.)

1. **Transaction Import** (`/transactions/import`) — full client-parse-(CSV via papaparse + JSON)/preview-table/validation/summary + server execute flow, PLUS the onboarding categories-step import path. Large, distinct feature; the seed dataset (`transactions-02.03.25.json`) is the test fixture. Almost certainly absent in supertool.
2. **Recurring transactions** — entire subtree (list + status filter, create/edit form w/ frequency/interval/start/end, detail, pause/resume w/ optimistic UI, bulk delete). A whole feature area likely missing.
3. **Export** (CSV + JSON, server-generated, scoped/all) on the transactions list and by-category. Likely missing.
4. **Bulk delete** (shared cap-100 selection + action bar + partial-failure re-selection) across main list, by-category, and recurring; plus **by-category drill-down** (accordion per-subcategory per-currency totals). Likely missing/partial.
5. **Polish + UX surface area**: theme-toggle UI and locale-switcher UI (reference itself lacks both — supertool can EXCEED here), full dashboard widget set (top-category ranked bars, daily-spending bar, recent list), category **cascade-delete with active-transactions guard**, copy-transaction, month/year navigator + sort filter, and the landing page's full marketing sections.

Also note (not "missing" but reconcile): **Budgets is a stub** in the reference (title only) — not parity work, but the sidebar nav slot exists. **Currency** still appears as a dashboard filter + onboarding/profile field in the reference, whereas supertool simplified currency to a single per-user default — drop the currency filter, keep single default.
