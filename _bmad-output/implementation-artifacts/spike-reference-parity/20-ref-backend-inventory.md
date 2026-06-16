# Reference Backend Inventory

Source: `example/tracker-backend-api/`
Live spec confirmed at: `http://localhost:8080/openapi.yaml`

---

## Module Count: 15 feature modules + 5 infrastructure/app-level modules

Feature modules (`src/modules/`):
1. auth
2. user
3. profile
4. onboarding
5. transaction-categories
6. default-transaction-categories
7. transactions
8. transactions-analytics
9. recurring-transactions
10. budgets
11. audit-log
12. cache
13. mailer
14. scheduled-tasks
15. (health — lives in `src/app/health/`)

App-level / infrastructure:
- logger (nestjs-pino)
- throttler (Redis-backed with in-memory fallback)
- filters (ProblemDetails + AllExceptions)
- interceptors (RequestContext, Timeout, PaginationLink, AuditLog)
- database (Drizzle/Postgres)

---

## Endpoint Count: 49 paths confirmed from live spec

---

## Full REST Endpoint Surface

All paths are under `/api` global prefix except `/health`.
Auth: JWT Bearer. Throttling applies globally and per-named throttler.

### Health — `GET /health`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | Full health check: DB, Redis, heap, RSS, disk |

### Auth — `/api/auth`
| Method | Path | Auth | Throttler | Purpose |
|--------|------|------|-----------|---------|
| POST | `/api/auth/register` | none | `auth` | Register new user; sets refresh-token cookie |
| POST | `/api/auth/login` | none | `auth` | Login; sets refresh-token + CSRF cookies |
| POST | `/api/auth/refresh-token` | cookie + CSRF guard | `auth` | Rotate access token using cookie |
| GET | `/api/auth/refresh-token/info` | JWT | default | Current session's refresh token info |
| GET | `/api/auth/refresh-tokens` | JWT | default | List all active sessions |
| POST | `/api/auth/logout` | JWT + CSRF | default | Revoke current session token; clears cookie |
| POST | `/api/auth/revoke-refresh-token` | JWT + CSRF | `auth` | Revoke specific session by sessionId |
| POST | `/api/auth/revoke-refresh-tokens` | JWT + CSRF | `auth` | Revoke ALL sessions; clears cookie |
| GET | `/api/auth/verify-email?token=<uuid>` | none | default | Email verification → 302 redirect to frontend |
| GET | `/api/auth/providers` | none | default | List enabled OAuth providers |
| GET | `/api/auth/google` | none | `auth` | Initiate Google OAuth → 302 to Google |
| GET | `/api/auth/github` | none | `auth` | Initiate GitHub OAuth → 302 to GitHub |
| POST | `/api/auth/social/exchange` | none | `auth` | Exchange one-time code for tokens after OAuth callback |

OAuth callbacks (`/auth/google/callback`, `/auth/github/callback`) are excluded from the `/api` prefix and from Swagger (`@ApiExcludeEndpoint`).

### Profile — `/api/profile`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/profile` | JWT | Get current user's profile |
| PATCH | `/api/profile` | JWT | Update profile (name, currency, country) |
| PATCH | `/api/profile/password` | JWT | Change password (validates current password) |
| DELETE | `/api/profile` | JWT | Delete own account (requires password confirmation) |

### Onboarding — `/api/onboarding`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/onboarding/status` | JWT | Get onboarding completion status |
| POST | `/api/onboarding/complete` | JWT | Complete onboarding (sets currency, password, marks done) |
| POST | `/api/onboarding/assign-default-categories` | JWT | Copy default category tree to user's categories |

### Transaction Categories — `/api/transaction-categories`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/transaction-categories` | JWT | List categories (paginated); filters: type, parentCategoryId, root |
| GET | `/api/transaction-categories/:id` | JWT | Get single category |
| POST | `/api/transaction-categories` | JWT | Create category (supports parent/subcategory nesting) |
| PATCH | `/api/transaction-categories/:id` | JWT | Update category name or parentCategoryId |
| DELETE | `/api/transaction-categories/batch` | JWT | Bulk-delete categories (body: `{ ids: string[] }`) |
| DELETE | `/api/transaction-categories/:id` | JWT | Delete single category |

### Default Transaction Categories — `/api/default-transaction-categories` (ADMIN only)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/default-transaction-categories` | JWT + ADMIN | List platform-level default categories |
| GET | `/api/default-transaction-categories/:id` | JWT + ADMIN | Get single default category |
| POST | `/api/default-transaction-categories` | JWT + ADMIN | Create default category |
| PATCH | `/api/default-transaction-categories/:id` | JWT + ADMIN | Update default category |
| DELETE | `/api/default-transaction-categories/:id` | JWT + ADMIN | Delete default category |

### Transactions — `/api/transactions`
| Method | Path | Auth | Throttler | Purpose |
|--------|------|------|-----------|---------|
| GET | `/api/transactions` | JWT | default | List transactions; filters: search, type, categoryId, currencyCode, dateFrom, dateTo, sortBy, sortOrder |
| GET | `/api/transactions/:id` | JWT | default | Get single transaction |
| GET | `/api/transactions/by-category/:categoryId` | JWT | default | Transactions grouped by subcategory under a parent category |
| GET | `/api/transactions/export` | JWT | 10/min | Stream file download (JSON or CSV); filters: format, dateFrom, dateTo, categoryId |
| POST | `/api/transactions` | JWT | default | Create transaction |
| POST | `/api/transactions/import` | JWT | 10/min | Import transactions from uploaded JSON or CSV file (multipart) |
| PATCH | `/api/transactions/:id` | JWT | default | Update transaction |
| DELETE | `/api/transactions/batch` | JWT | default | Bulk delete (body: `{ ids: string[] }`); returns `{ deletedCount }` |
| DELETE | `/api/transactions/:id` | JWT | default | Delete single transaction |

### Transactions Analytics — `/api/transactions-analytics`
All analytics endpoints are throttled at 10 req/min and require JWT.

| Method | Path | Purpose | Key Query Params |
|--------|------|---------|-----------------|
| GET | `/api/transactions-analytics/summary` | Income/expense totals | currencyCode, dateFrom, dateTo, type, categoryId |
| GET | `/api/transactions-analytics/category-breakdown` | Spending/income by category | same as above |
| GET | `/api/transactions-analytics/trends` | Time-series income/expense | + granularity (day/week/month) |
| GET | `/api/transactions-analytics/top-categories` | Top N categories by spend | + limit |
| GET | `/api/transactions-analytics/daily-spending` | Daily totals for one month | currencyCode, year, month, type |

### Recurring Transactions — `/api/recurring-transactions`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/recurring-transactions` | JWT | List; filters: status, type, categoryId, currencyCode, frequency |
| GET | `/api/recurring-transactions/:id` | JWT | Get single |
| POST | `/api/recurring-transactions` | JWT | Create (frequency: DAILY/WEEKLY/MONTHLY/YEARLY, interval, startDate, endDate?) |
| PATCH | `/api/recurring-transactions/:id` | JWT | Update |
| PATCH | `/api/recurring-transactions/:id/pause` | JWT | Pause (only if ACTIVE) |
| PATCH | `/api/recurring-transactions/:id/resume` | JWT | Resume (only if PAUSED) |
| DELETE | `/api/recurring-transactions/batch` | JWT | Bulk cancel |
| DELETE | `/api/recurring-transactions/:id` | JWT | Cancel single |
| POST | `/api/recurring-transactions/process` | JWT + ADMIN | Manually trigger processing of due recurring transactions |

### Budgets — `/api/budgets`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/budgets` | JWT | List; filters: status, period, categoryId, currencyCode |
| GET | `/api/budgets/:id` | JWT | Get single |
| GET | `/api/budgets/:id/progress` | JWT | Budget vs. actual spending progress |
| POST | `/api/budgets` | JWT | Create budget (period: WEEKLY/MONTHLY/QUARTERLY/YEARLY/CUSTOM) |
| PATCH | `/api/budgets/:id` | JWT | Update amount, categoryId, endDate, description |
| DELETE | `/api/budgets/batch` | JWT | Bulk delete |
| DELETE | `/api/budgets/:id` | JWT | Delete single |

### Users — `/api/users` (ADMIN only)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/users` | JWT + ADMIN | List users; filters: search, role |
| GET | `/api/users/summary` | JWT + ADMIN | User count statistics |
| GET | `/api/users/:id` | JWT + ADMIN | Get user details |
| POST | `/api/users` | JWT + ADMIN | Create user |
| PATCH | `/api/users/:id` | JWT + ADMIN | Update user role |
| PATCH | `/api/users/:id/role` | JWT + ADMIN | Assign role |
| DELETE | `/api/users/:id` | JWT + ADMIN | Delete user (cannot delete own account) |

### Audit Logs — `/api/audit-logs` (ADMIN only)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/audit-logs` | JWT + ADMIN | List audit log entries; filters: actorId, action |

---

## Data Model

### Tables

**User** (`users.ts`)
- UUID PK (db-generated `defaultRandom()`), `email` (unique), `passwordHash` (nullable — OAuth users), `firstName`, `lastName`
- `emailVerified` bool (default false), `emailVerificationToken`, `emailVerificationTokenExpiresAt`
- `countryCode` varchar(3), `baseCurrencyCode` varchar(3)
- `onboardingCompleted` bool (default false)
- `role` enum (USER / ADMIN / SUPER_ADMIN), default USER
- `ipAddress`, `userAgent` (captured at registration)
- `deletedAt` — soft-delete supported
- Timestamps: `createdAt`, `updatedAt` (timestamptz, precision 3)

**TransactionCategory** (`transaction-categories.ts`)
- UUID PK, `userId` FK → User (cascade delete)
- `name`, `type` enum (EXPENSE / INCOME)
- `parentCategoryId` self-referencing FK — two-level hierarchy (parent / subcategory)
- `deletedAt` — soft-delete
- Unique index on `(userId, name, type, parentCategoryId)` WHERE deletedAt IS NULL (partial unique constraint)

**Transaction** (`transactions.ts`)
- UUID PK, `userId` FK → User (cascade delete)
- `categoryId` — composite FK `(userId, categoryId)` → `(TransactionCategory.userId, TransactionCategory.id)` (restrict on delete)
- `type` enum (EXPENSE / INCOME)
- `amount` numeric(19, 2) with check `amount > 0` — **money is string in API, numeric in DB**
- `currencyCode` varchar(3)
- `date` timestamptz (precision 3) — stores datetime with timezone (NOT a bare `date` column)
- `description` text (nullable)
- `recurringTransactionId` FK → RecurringTransaction (set null on delete)
- GIN trigram index on `description` for full-text search
- Composite indexes for common query patterns

**RecurringTransaction** (`recurring-transactions.ts`)
- UUID PK, `userId` FK, composite `(userId, categoryId)` FK
- `type`, `amount` numeric(19,2), `currencyCode`
- `frequency` enum (DAILY / WEEKLY / MONTHLY / YEARLY)
- `interval` integer (default 1) — e.g. every 2 weeks
- `startDate`, `endDate` (nullable), `nextOccurrenceDate` timestamptz
- `status` enum (ACTIVE / PAUSED / CANCELLED)
- Check: interval > 0, amount > 0, endDate > startDate if set

**Budget** (`budgets.ts`)
- UUID PK, `userId` FK, `categoryId` FK (nullable — set null on category delete)
- `amount` numeric(19,2), `currencyCode`
- `period` enum (WEEKLY / MONTHLY / QUARTERLY / YEARLY / CUSTOM)
- `startDate`, `endDate` timestamptz
- `status` enum (ACTIVE / EXCEEDED)
- `description` text (nullable)
- Check: endDate > startDate, amount > 0

**DefaultTransactionCategory** (`default-transaction-categories.ts`)
- UUID PK, `name`, `type` enum, `parentDefaultTransactionCategoryId` self-ref FK (cascade)
- `deletedAt` — soft-delete
- Platform-wide template categories (no userId) — two-level hierarchy mirroring TransactionCategory

**AuditLog** (`audit-logs.ts`)
- UUID PK, `action`, `actorId`, `actorEmail`, `resourceType`, `resourceId`
- `detail` JSONB, `ipAddress`, `userAgent`, `requestId`
- Immutable (insert-only); no updatedAt

**RefreshToken** (`refresh-tokens.ts`)
- Stores hashed refresh tokens, sessionId, userId, expiresAt, device context

**UserAuthIdentity** (`user-auth-identities.ts`)
- OAuth provider identities (providerUserId, provider, userId, email, accessToken)

**LoginLog** (`login-logs.ts`)
- Login attempt history: userId, ipAddress, userAgent, status (SUCCESS / FAILED)

**KnownDevice** (`known-devices.ts`)
- Tracks trusted device fingerprints per user

**Verification** (`verifications.ts`)
- Email verification token store

### Key Relationships
- User → TransactionCategory (one-to-many, cascade delete)
- TransactionCategory → TransactionCategory (self-ref parent/subcategory, cascade delete)
- User → Transaction (one-to-many, cascade delete)
- Transaction → TransactionCategory: composite FK `(userId, categoryId)` enforces cross-user isolation at DB level
- RecurringTransaction → Transaction (one-to-many, set null on recurring delete)
- Budget → TransactionCategory (nullable FK, set null on category delete)
- User → RefreshToken (one-to-many)
- User → UserAuthIdentity (one-to-many)

### Money Representation
- DB: `numeric(19, 2)` — higher precision than supertool's `numeric(14, 2)`
- API: amounts serialized as strings in all DTOs
- Arithmetic: uses `decimal.js` library in analytics service for safe decimal math

### Date / Time Handling
The reference uses `timestamptz` for the `date` field on Transaction (not a bare SQL `date` column). Dates arrive as ISO 8601 strings (e.g. `2026-03-01T00:00:00.000+02:00`) and are stored with timezone. This differs from supertool which uses a bare `date` column and `"YYYY-MM-DD"` strings.

### Soft Delete
TransactionCategory, DefaultTransactionCategory, and User all have `deletedAt` timestamptz. Queries filter `WHERE deletedAt IS NULL`. Unique indexes are partial (WHERE deletedAt IS NULL) to allow re-creation after soft-delete.

---

## Transaction Import — Detailed

**Endpoint:** `POST /api/transactions/import` (multipart/form-data, field name `file`)
**Throttle:** 10 requests per 60 seconds
**File size limit:** 5 MB (set at Multer interceptor level)
**Max rows:** 3,000 per file

**Supported formats:**
- `.json` — array of objects with keys: `Date`, `Category`, `Subcategory` (optional), `Type`, `Amount`, `Currency`
- `.csv` — with header row: `Date`, `Category`, `Type`, `Amount`, `Currency`, `Subcategory` (optional)

**Date format expected:** `MM/DD/YYYY HH:mm:ss` (e.g. `02/03/2025 14:35:00`) — parsed to UTC

**Type values:** `"Expense"` or `"Income"` (case-insensitive)

**Category resolution logic (all in one DB transaction):**
1. Load all existing categories for the user
2. Identify which parent categories and subcategories need to be created
3. Bulk-insert missing parent categories
4. Bulk-insert missing subcategories (with parentCategoryId from step 3)
5. Bulk-insert all parsed transaction rows mapped to resolved categoryIds

**Response:** `{ transactionsCreated, categoriesCreated, subcategoriesCreated, failedCount, errors[] }`

**Cache invalidation:** After import, deletes all `transactions:*` and `categories:*` Redis prefixes for the user. Emits `transaction.imported` event.

**Transaction Export:** `GET /api/transactions/export?format=json|csv` — streams a downloadable file. Sets `X-Result-Truncated: true` header if results were truncated. Throttled at 10/min.

---

## Cross-Cutting / Invisible Infrastructure Features

### 1. Redis Cache Module (`src/modules/cache/`)

**What is cached:**
- `transactions-analytics:*` — all five analytics queries (summary, category-breakdown, trends, top-categories, daily-spending)
  - TTL: 300s (5 min) for most; 600s (10 min) for trends
- `transactions:*` — transaction list queries (individual `findAll` calls with hashed params)
- `categories:*` — category list queries
- `budgets:*` — budget list queries

**Cache key format:** `${module}:${userId}:${operation}:${sha256(sortedParams).slice(0,12)}`
**Cache prefix format:** `${module}:${userId}:` — used for bulk invalidation

**Invalidation strategy:** Event-driven via `@nestjs/event-emitter` wildcard listeners.
- `transaction.*` events (created, updated, deleted, bulk-deleted, imported) → invalidate `transactions-analytics:userId:*` AND `transactions:userId:*`
- `budgets.*` events → invalidate `budgets:userId:*`
- Category mutations → invalidate `categories:userId:*`

**CacheService features:**
- `wrap(key, fn, ttl)` — cache-aside with in-flight deduplication (concurrent requests for same key execute `fn` only once)
- `delByPrefix(prefix)` — SCAN + pipeline UNLINK for bulk invalidation (batch size 100)
- `getdel(key)` — atomic get-and-delete (used for social auth codes)
- Corrupt entry detection: on JSON parse failure, deletes key and returns undefined

**Social auth code storage:** One-time codes for OAuth flow stored in Redis with short TTL via `SocialAuthCodeService` / `CacheService.getdel`.

### 2. Rate Limiting / Throttler (`src/app/throttler/`)

Two named throttlers:
- `default`: 60 requests per 60,000 ms (configurable via `THROTTLE_TTL`, `THROTTLE_LIMIT`)
- `auth`: 5 requests per 60,000 ms (configurable via `THROTTLE_AUTH_TTL`, `THROTTLE_AUTH_LIMIT`) — applied to all auth endpoints

Some endpoints have explicit per-endpoint overrides (e.g. export/import: 10/min; analytics: 10/min; recurring process: 5/min).

**Storage:** Redis-backed (`RedisThrottlerStorage`) with automatic in-memory fallback if Redis is unavailable. Uses INCR + EXPIRE pattern; separate `{key}:blocked` key for block windows.

**Guard:** `AppThrottlerGuard` registered as global `APP_GUARD`.

### 3. Error Format — RFC 7807 Problem Details

`ProblemDetailsFilter` (`@Catch(HttpException)`) emits `Content-Type: application/problem+json`:

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Unprocessable Entity",
  "status": 422,
  "instance": "/api/transactions",
  "request_id": "req_xyz789",
  "timestamp": "2024-11-03T10:30:00Z",
  "code": "VALIDATION_FAILED",
  "detail": "Request validation failed",
  "errors": [
    { "field": "amount", "pointer": "/amount", "code": "VALIDATION_ERROR", "message": "..." }
  ]
}
```

`AllExceptionsFilter` catches non-HTTP exceptions (unexpected errors) and wraps them in the same shape with 500.
The `type` URI is derived from `API_BASE_URL` env var + `/errors/<slug>`.

**This is different from supertool's current error format:** supertool uses `{ statusCode, code, message, details? }` without RFC 7807 fields (`type`, `title`, `instance`, `request_id`, `timestamp`).

### 4. Validation Pipe

`createValidationPipe()` configured with:
- `whitelist: true` (strips unknown properties)
- `forbidNonWhitelisted: true` (throws on unknown properties)
- `transform: true` (class-transformer coercion)
- `exceptionFactory` emits structured `ValidationError[]` that the ProblemDetailsFilter turns into `errors[]` field errors

Custom validator decorators in `src/shared/decorators/validators.ts` attach `context: { code: '...' }` to each constraint so field-level error codes appear in the problem-details response.

### 5. Swagger / API Docs

- Swagger UI: `/swagger` (non-production only)
- Scalar API Reference (nicer UI): `/docs`
- Raw OpenAPI YAML: `/openapi.yaml`
- All endpoints decorated with `@ApiTags`, `@ApiOperation`, `@ApiResponse`
- Default error response (`application/problem+json`) added to every operation programmatically
- `operationIdFactory`: `${ControllerKey}_${methodKey}` naming convention

### 6. Health Checks (`src/app/health/`)

`GET /health` (no auth, `@SkipThrottle`) checks:
- Drizzle DB (`DrizzleHealthIndicator`) — SELECT 1
- Redis (`RedisHealthIndicator`) — PING
- Heap memory ≤ 150 MB
- RSS memory ≤ 300 MB
- Disk usage ≤ 90%

Returns `{ environment, database, redis, memory_heap, memory_rss, storage }` with per-component `{ status: 'up'|'down', message }`.

### 7. Security Middleware (`src/main.ts`)

- `helmet()` — security headers
- `compression()` — gzip response compression
- `cookieParser()` — required for refresh-token HttpOnly cookie + CSRF token cookie
- CORS configured from `ALLOWED_ORIGINS` env var (comma-separated list)

### 8. JWT + Custom Auth (not better-auth)

The reference uses a **custom JWT / Passport** implementation, NOT better-auth:
- Access tokens: short-lived JWT (default 15 min), verified via `JwtStrategy` / `JwtAuthGuard`
- Refresh tokens: long-lived (default 7 days), stored hashed in DB (`refresh_tokens` table), delivered via HttpOnly cookie
- Token rotation on every refresh
- CSRF protection: when `COOKIE_SAME_SITE=none`, a CSRF token cookie (non-HttpOnly) is issued alongside the refresh cookie and validated by `CsrfGuard` on state-mutating cookie-based endpoints
- Token blacklist: revoked access tokens tracked in Redis until expiry
- Role-based access: `RolesGuard` + `@Roles()` decorator; roles: USER / ADMIN / SUPER_ADMIN

**Supertool uses better-auth** — a fundamentally different auth system.

### 9. Logging — nestjs-pino

- `nestjs-pino` with `pino` structured JSON logging
- Redaction config strips sensitive fields from logs
- `RequestContextInterceptor` seeds the CLS store (request ID via `nestjs-cls`)
- Request ID propagated to error responses as `request_id`
- `bufferLogs: true` at bootstrap (logs buffered until logger is ready)

### 10. Scheduled Tasks (`src/modules/scheduled-tasks/`)

- `@Cron(EVERY_HOUR)` — delete expired refresh tokens from DB
- `@Cron(EVERY_DAY_AT_MIDNIGHT)` — process all due recurring transactions (creates actual Transaction rows)
- `@Cron(EVERY_DAY_AT_1AM)` — check all active budgets for overspend → update status to EXCEEDED
- `@Interval(30_000)` — heartbeat log
- `@Timeout(5000)` — startup task logged 5s after boot

### 11. Audit Logging

`AuditLogInterceptor` is a global `APP_INTERCEPTOR`. It records every mutating request (POST/PATCH/PUT/DELETE) to the `AuditLog` table with actor, resource, action, IP, user agent, and a correlation request ID from the CLS store. Read endpoints are not audited. ADMIN-only `GET /api/audit-logs` endpoint exposes the log.

### 12. Pagination — Response Shape

The reference pagination response does NOT use supertool's `{ data, meta }` shape. It uses a flat `object: 'list'` shape:

```json
{
  "object": "list",
  "data": [...],
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5,
  "hasMore": true
}
```

The `PaginationLinkInterceptor` adds RFC 5988 `Link` headers (`first`, `prev`, `next`, `last`) to all paginated responses.

**Supertool's current pagination response:** `{ data: [...], meta: { page, pageSize, total, totalPages } }` — different shape, no `Link` headers.

### 13. Bulk Operations

Pattern used across transactions, categories, budgets, and recurring-transactions:
- `DELETE /{resource}/batch` with body `{ ids: string[] }` (up to 100 IDs validated)
- Returns `{ deletedCount: number }`
- HTTP status 200 (not 204)

### 14. Event-Driven Cache Invalidation

`@nestjs/event-emitter` with wildcard `transaction.*` pattern:
- `transaction.created`, `transaction.updated`, `transaction.deleted`, `transaction.bulk-deleted`, `transaction.imported` → listeners clear affected Redis key prefixes
- `budgets.*` events (created, updated, deleted) → clear budget cache
- Each module has a `*-cache.listener.ts` file implementing `@OnEvent(...)` handlers

### 15. CLS (Continuation-Local Storage)

`nestjs-cls` library provides request-scoped storage:
- `RequestContextInterceptor` generates a UUID request ID on each request
- Request ID stored in CLS, available throughout the request lifecycle
- Included in error responses as `request_id` field
- Used by `AuditLogInterceptor` for correlation

### 16. Timeout Interceptor

`TimeoutInterceptor` registered globally. Configurable via `REQUEST_TIMEOUT_MS` env var (default 30,000 ms). Throws `RequestTimeoutException` (408) if any handler exceeds the timeout. Not present in supertool.

---

## Supertool Current State vs Reference: Top Infrastructure Gaps

These are the highest-priority infrastructure capabilities supertool most likely lacks or has diverged from:

1. **Redis / CacheModule** — supertool has no Redis at all. No caching layer. All analytics queries hit Postgres on every request.

2. **Rate Limiting** — supertool has no throttler. No protection on auth endpoints (register/login) or expensive analytics endpoints.

3. **RFC 7807 Problem Details error format** — supertool uses `{ statusCode, code, message, details? }`. The reference uses the full Problem Details standard with `type`, `title`, `instance`, `request_id`, `timestamp`. This is a contract-breaking difference for any client expecting the reference shape.

4. **Recurring Transactions module** — entirely absent from supertool. Requires new DB table, controller, service, repository, scheduled task.

5. **Budgets module** — entirely absent from supertool. Requires new DB table, controller, service, repository, scheduled task (overspend check).

6. **Transaction Import/Export** — absent from supertool. The import endpoint is the mechanism to ingest the `transactions-02.03.25.json` seed dataset via the UI.

7. **Audit Log module** — entirely absent from supertool. No `AuditLog` table, no global interceptor recording mutations.

8. **Default Transaction Categories module** — absent from supertool. The reference has a platform-level category template that is copied per-user during onboarding.

9. **Onboarding module** — absent from supertool (better-auth handles some of this, but the reference has explicit `status`, `complete`, and `assign-default-categories` endpoints).

10. **Scheduled Tasks** — supertool has no `@nestjs/schedule` integration. No recurring-transaction processing, no expired-token cleanup beyond better-auth's own mechanisms, no budget overspend checks.

11. **Pagination shape divergence** — supertool's `{ data, meta }` differs from the reference `{ object: 'list', data, page, pageSize, total, totalPages, hasMore }`. Frontend components designed for the reference shape would need the API or client to adapt.

12. **`Link` header on paginated responses** — reference emits RFC 5988 Link headers; supertool does not.

13. **Transaction date storage** — reference stores `date` as `timestamptz` with full datetime; supertool stores as bare SQL `date` column with `"YYYY-MM-DD"` strings. Import/export and filtering behavior differs.

14. **Full-text search on transactions** — reference uses a PostgreSQL GIN trigram index (`pg_trgm`) on `description` for `?search=` filtering. Supertool has no full-text search.

15. **Transaction `by-category` endpoint** — `GET /api/transactions/by-category/:categoryId` returns transactions grouped by subcategory. Absent from supertool.

16. **Budget progress endpoint** — `GET /api/budgets/:id/progress` computes actual spend vs budget amount. Absent from supertool.

17. **Analytics gaps** — supertool implements summary, category-breakdown, and 12-month trend. Missing from supertool: `top-categories`, `daily-spending`.

18. **Auth architecture difference** — reference is custom JWT + Passport + DB refresh tokens + CSRF guard. Supertool uses better-auth (sessions, not JWTs). This affects token management UI (list/revoke sessions), the social auth exchange flow, email verification redirect, and the `/api/auth/providers` endpoint.

19. **User management (Admin)** — supertool has a minimal users endpoint; reference has full CRUD with role management, summary statistics, and creation.

20. **CLS + request ID tracing** — supertool has no `nestjs-cls` integration. No request ID in error responses or audit log correlation.
