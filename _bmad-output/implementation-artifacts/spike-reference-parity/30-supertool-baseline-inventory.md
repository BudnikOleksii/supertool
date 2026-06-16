# Supertool Money-Tracker — Current Baseline Inventory (Epics 1–3 delivered)

Spike: Reference-Parity Gap Analysis. This is the **factual baseline of what supertool money-tracker is TODAY**, derived from source (`apps/money-tracker`, `apps/api`) and planning artifacts (`epics.md`, `sprint-status.yaml`). It is the thing the reference is diffed against — not a wishlist. Captured 2026-06-16. The supertool frontend was NOT run live (its dev binds :3000, occupied by the reference), so frontend facts come from code.

All Epics 1, 2, 3 are `done` (each with a retrospective). No Epic 4 work exists yet.

---

## FRONTEND (`apps/money-tracker`)

Next.js 16 App Router, `src/app/[locale]/…`, locale-prefixed. next-intl middleware (`proxy.ts`) + better-auth session-cookie gate. SCSS modules + design tokens from `packages/ui`. RSC reads via `fetch-*`, mutations via `'use server'` actions returning `ActionState`, `revalidatePath`/`router.refresh` after.

### Routes / pages that EXIST (the complete set)

| Route | File | Type | Notes |
|---|---|---|---|
| `/` (home) | `[locale]/page.tsx` | minimal | **Not a marketing landing page.** A bare `<h1>` + description + three plain links (dashboard / categories / transactions). No hero/advantages/FAQ/reviews/footer sections. |
| `/sign-in` | `[locale]/sign-in/` | complete | Renders `SignInForm` widget. Email+password only. |
| `/sign-up` | `[locale]/sign-up/` | complete | Renders `SignUpForm` widget. Email+password only. On success → `/`. No verify-email step, no OAuth buttons. |
| `/dashboard` | `[locale]/dashboard/` | complete | Period (`MonthStepper`) + 3 streamed widgets, each in its own Suspense boundary with a skeleton. |
| `/transactions` | `[locale]/transactions/` | complete | Month-windowed list + filters + pagination + empty/error states. |
| `/transactions/new` | `[locale]/transactions/new/` | complete | Create form. |
| `/transactions/[id]/edit` | `[locale]/transactions/[id]/edit/` | complete | Edit form. |
| `/categories` | `[locale]/categories/` | complete | Hierarchical tree (`CategoryTree`). |
| `/categories/new` | `[locale]/categories/new/` | complete | Create form. |
| `/categories/[id]/edit` | `[locale]/categories/[id]/edit/` | complete | Edit form. |
| `/settings` | `[locale]/settings/` | complete | Profile form: name, locale, default currency. |

`ROUTES` map in `src/constants/routes.ts` defines exactly these. There is **no** `/budgets`, **no** `/onboarding`, **no** `/transactions/by-category`, **no** import route, **no** verify-email / auth-callback route.

### Implemented features

- **Auth:** sign-up + sign-in (email/password, better-auth, `autoSignIn: true`, `requireEmailVerification: false`). Sign-out via shell user menu. Route protection in `proxy.ts` (session cookie → redirect to `/sign-in`). Public paths: only `/sign-in`, `/sign-up`.
- **Profile / settings:** `ProfileForm` edits name, locale (en/uk), default currency (combobox over `CURRENCY_CODE_LIST`). PATCH `/users/me`.
- **Transactions browse-by-month:** `MonthStepper` (prev/next month), URL `period` search param drives server re-render; list, skeleton, empty state, error state components all present.
- **Transaction create/edit/delete:** full CRUD. Form via react-hook-form + zod (`transaction-form-schema`). Delete via row-actions + confirm. Amount normalized as string; positive-amount pattern.
- **Filter / sort:** `TransactionFilters` (date range, type income/expense, category) + sort (sortBy/sortOrder) carried in URL search params. `check-has-active-filters` util.
- **Categories:** hierarchical two-level tree, create/edit/delete. Delete dialog supports reassign-on-delete (`DeleteCategoryDialog` + `DeleteCategoryDto.reassignToCategoryId`). Income/expense typed.
- **Dashboard widgets (exactly 3):**
  1. `DashboardSummary` — period totals (income / expense / net).
  2. `DashboardBreakdown` — expense breakdown by top-level category.
  3. `DashboardTrend` — trailing 12-month income/expense trend (chart; introduced a charting dependency in story 3-3).
  Each has a co-located skeleton.
- **Shell** (`packages/shell`): `AppShell`, `ToolNav` (single tool: Money Tracker), `UserMenu` (settings + sign-out), `LocaleSwitcher` (en/uk), `ThemeSwitcher` (light/dark/system).

### i18n

- Split per-namespace (NOT single en.json/uk.json). **10 namespaces** in both `messages/en/` and `messages/uk/`: `sign-in-page`, `sign-up-page`, `auth-shared`, `navigation`, `home-page`, `dashboard-page`, `transactions-page`, `transaction-form`, `categories-page`, `settings-page`.
- Locales: **en, uk** (real Ukrainian). Key-parity gated in CI.

### Theming & mobile

- `next-themes` `ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem`. Tokens in `packages/ui/src/styles/tokens/` (palette, fonts, shadows, metrics, theme). `ThemeSwitcher` in shell.
- Font: Poppins (next/font/google).
- **Mobile:** responsive SCSS only. No PWA, no native (NFR8). Mobile-first quality is UNVERIFIED in this baseline (no live capture) — flagged as the parity risk per the spike's mobile-first bar.

### Stubbed / thin (be honest)

- **Home `/`** is a placeholder, not a product landing page.
- No onboarding flow at all (currency/categories/password steps do not exist; currency is just a settings field).
- Mobile UX quality not validated against the reference here.

---

## BACKEND (`apps/api`)

NestJS, global prefix `/api`, URI versioning default `v1` → all routes under `/api/v1/…`. Controllers → services → repositories (repositories are the only DB layer). Drizzle + Postgres, UUIDv7 text PKs.

### Modules & endpoint surface

| Module | Base | Endpoints |
|---|---|---|
| **auth** (better-auth, `@thallesp/nestjs-better-auth`) | `/api/v1/auth` | better-auth handlers: `/sign-up/email`, `/sign-in/email`, sign-out, session, etc. Email+password only. |
| **health** | `/api/v1/health` | `GET /` |
| **users** | `/api/v1/users` | `GET /me`, `PATCH /me` |
| **transaction-categories** | `/api/v1/transaction-categories` | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` (body = `DeleteCategoryDto` for reassign) |
| **transactions** | `/api/v1/transactions` | `GET /` (paginated+filtered), `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (204) |
| **analytics** | `/api/v1/analytics` | `GET /summary`, `GET /breakdown`, `GET /trend` |

All business endpoints guarded by `AuthGuard` (per-route `@UseGuards`). `roles.guard` + `@Roles()` decorator exist but no admin endpoints use them.

### Infrastructure present

- **Swagger:** YES, dev only — `SwaggerModule.setup('api/docs', …)` when `NODE_ENV !== 'production'`. `emit-openapi.ts` emits `openapi.json` for the generated client.
- **Generated client pipeline:** YES (`packages/shared/src/generated`, hey-api).
- **Error format:** custom envelope `{ statusCode, code, message, details? }` via `GlobalExceptionFilter` (NOT RFC-7807 problem-details). `code` from a shared `ErrorCode` set; validation arrays flattened into `details.messages`; 5xx sanitized to "Internal server error".
- **Pagination:** offset, `PaginationQueryDto` (`page`, `limit`, bounded by shared `MAX_PAGE`/`MAX_PAGE_SIZE`); list responses `{ data, meta }`.
- **Rate limiting:** YES but **in-memory** (better-auth `rateLimit`, `storage: 'memory'`): global 100/10s, sign-in/sign-up 5/60s. **Not Redis.** Toggle via `AUTH_RATE_LIMIT_DISABLED`.
- **Logging:** `nestjs-pino`.
- **Validation:** global `ValidationPipe` (`whitelist`, `transform`).
- **Body parser:** custom 2mb limit (better-auth module).
- **DB lifecycle:** migrate → seed at boot (`prepareDatabase`, `runMigrations`, `runSeed`); `enableShutdownHooks`.

### Infrastructure ABSENT (cross-referenced against the reference's "invisible" feature list)

- **No Redis** — no cache module, no Redis-backed throttler, no Redis health indicator. Rate limiting is in-process memory.
- **No `@nestjs/terminus` / multi-indicator health** — health is a single custom `GET /health` (DB check only), not a Redis/disk/memory composite.
- **No helmet, no compression, no cookie-parser** wired in `main.ts` / `configure-app-routing.ts`.
- **No bulk operations** — no bulk-delete endpoint (categories delete is single `:id` with reassign).
- **No OAuth** (no Google/GitHub providers configured in `auth.ts`).
- **No email / mailer** — `requireEmailVerification: false`, no verification tokens issued, no SMTP/mailer module.
- **Error format is the supertool envelope, not RFC-7807.**

### Data model

- **users:** id, name, email (unique), emailVerified (default false), image, role (`user`/`admin`, default user), `locale` (default 'en'), `defaultCurrency` (nullable), timestamps. (Plus better-auth `sessions`, `accounts`, `verifications` tables.)
- **transaction_categories:** id, userId, name, type (`income`/`expense`), `parentId` (self-ref, two-level hierarchy, ON DELETE restrict), timestamps. Unique `(userId,name,type,parentId)` nullsNotDistinct; unique `(userId,id)`.
- **transactions:** id, userId, categoryId, type, **amount `numeric(14,2)`** (string end-to-end — DTO `amount: string`, `POSITIVE_AMOUNT_PATTERN`, CHECK `amount > 0`), `currency` (text), **`date` as `date`/"YYYY-MM-DD" string** (no tz math), note (default ''), `importKey` (nullable, unique — idempotent seed), timestamps. Composite FK `(userId,categoryId)` ON DELETE restrict; indexes on user/date/category/type/currency.
- **Money-as-string:** enforced (D1). **Dates** as date strings (transaction) / timestamptz (audit) per convention.
- **Enums** via `pgEnum`: `role`, `transaction_type`. Currency/locale are value-lists in `@supertool/shared`, not DB enums.
- **Seed:** `transactions-02.03.25.json` (~1,880 records, Ukrainian two-level categories, UAH) imported idempotently at boot. **No user-facing import UI** — import is seed-only.

---

## KNOWN-ABSENT (relative to the reference checklist in the spike brief)

Confirmed missing by route/module tree + planning artifacts. These are the obvious holes the gap backlog must address:

### Frontend
- **Marketing/landing page** — reference `(home-layout)` has Hero/Advantages/FAQ/Reviews/Footer; supertool `/` is a 3-link placeholder.
- **Onboarding flow** — reference has `(onboarding-layout)/onboarding` 3 steps (currency → categories → password). Supertool has none; currency is a plain settings field, no guided onboarding.
- **Auth extras** — reference: verify-email page, `auth/callback`, OAuth provider buttons (Google/GitHub). Supertool: none.
- **Budgets** — reference `(app-layout)/budgets`. Supertool: **no budgets feature anywhere** (no route, no module, no FR — never planned).
- **Transactions by-category views** — reference `transactions/by-category` and `by-category/[categoryId]` (with bulk-delete). Supertool: single flat `/transactions` list only.
- **Transaction import UI** — reference has import as a distinct in-app feature. Supertool: import is server-side seed only, no UI.
- **Mobile-first validation** — not yet captured/verified for supertool (parity bar is mobile-first).

### Backend
- **Redis cache module**, **Redis throttler / rate limiting** (supertool uses in-memory), **Redis health check**.
- **helmet + compression + cookie-parser** middleware.
- **RFC-7807 problem-details** (supertool uses its own `{statusCode,code,message,details}` envelope).
- **Bulk-delete** endpoints.
- **OAuth (Google/GitHub)**.
- **Email verification + mailer**.

### Explicitly descoped by supertool requirements (NOT bugs — design decisions to reconcile against parity bar)
- Email verification, OAuth, password recovery — out of v1 (FR1).
- Currency as a filter / currency picker; cross-currency aggregation — dropped 2026-06-15 (FR9/FR14); single default currency only.
- Admin UI — role plumbing exists, no admin features (FR21).
- Deployment, external telemetry/analytics, native/PWA — out of v1 (NFR3/NFR4/NFR8).
- Playwright/E2E automation — deferred (D10); visual QA is manual screenshots.

---

## One-line summary

Supertool today is a working email/password money tracker with: transaction CRUD + month-window browse + filter/sort, two-level categories with reassign-on-delete, a 3-widget dashboard (summary / expense breakdown / 12-month trend), settings (name/locale/currency), en+uk i18n, light/dark/system theming, and a clean Nest API (users/categories/transactions/analytics/health) with offset pagination, money-as-string, custom error envelope, and in-memory auth rate limiting. The obvious holes vs the reference: **no landing page, no onboarding, no budgets, no import UI, no by-category/bulk-delete views, no OAuth/email-verify, and none of the Redis/helmet/RFC-7807 backend infra** — plus mobile-first quality is unverified.
