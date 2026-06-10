# supertool

Personal tool platform: independent Next.js tool apps (first: Money Tracker) on a shared shell, backed by one NestJS API. pnpm + Turborepo monorepo. Local-only runtime (Docker), private repo, no external telemetry.

**Pattern authority:** `_bmad-output/planning-artifacts/architecture.md` — consult it before introducing any new dependency or pattern. Planning artifacts in `_bmad-output/` are committed; every commit on `main` traces to a planned story.

## Workspace layout

```
apps/
  money-tracker/   # Next.js 16 tool app (Story 1.4+)
  api/             # NestJS API, better-auth host, owns PostgreSQL (Story 1.2+)
  storybook/       # component playground (Story 1.4+)
packages/
  shell/           # platform shell: tool nav, user menu, locale switcher
  widgets/         # cross-app composed widgets (auth forms first)
  ui/              # framework-pure design-system primitives (SCSS)
  shared/          # constants, types, tools registry, generated API client
  next-shared/     # Next-specific shared code (i18n routing, client factory)
  lint-config/  stylelint-config/  typescript-config/   # config packages
```

Dependency direction: `shared` → `ui` → `widgets`/`shell` → apps. `next-shared` may depend on Next.js; nothing below it may. Shell never imports from tool apps.

## Commands

```bash
pnpm install            # Node 22 LTS, pnpm self-switches to the pinned version
pnpm dev                # turbo dev (apps arrive in later stories)
pnpm build              # turbo build
pnpm test               # vitest via turbo
pnpm lint / lint:fix    # oxlint (whole repo) + per-package lint tasks
pnpm fmt / fmt:check    # oxfmt
pnpm stylelint          # stylelint (whole repo SCSS/CSS) + per-package tasks
pnpm type-check         # tsc (root config) + per-package type-check tasks
```

## Hard rules (merge-blocking — from architecture.md Enforcement Guidelines)

1. **Money is strings end-to-end.** Postgres `numeric(14,2)`, string amounts in every DTO and in JS. An amount typed as `number` or float arithmetic on money is a defect (D1).
2. **API access only via the generated client** (`packages/shared/src/generated/`). A hand-written `fetch` to `/api/*` is a defect (NFR6).
3. **Repositories are the only DB-touching layer.** Controllers → services → repositories; no layer skipping (D7).
4. **Every user-facing string lands in both `en.json` and `uk.json` in the same commit** — CI key-parity gate fails otherwise (FR19/FR20).
5. **Tests ship in the same story as the feature** (NFR1).
6. **Exact dependency versions only** (no `^`/`~`); **never introduce eslint or prettier** — this repo uses oxlint + oxfmt (NFR2).
7. **Never import from or copy code out of `example/`** — reference-only, git-ignored (ED1). Configuration patterns may be carried; code may not.

## Conventions

- Files/dirs: kebab-case always; components export PascalCase from kebab-case dirs.
- DB: snake_case tables/columns, Drizzle camelCase mapping; UUIDv7 app-side PKs; one schema file per table in `apps/api/src/database/schemas/`.
- API: `/api/v1/...`, camelCase JSON, errors `{ statusCode, code, message, details? }`, offset pagination `{ data, meta }`, DELETE → 204.
- Dates: transaction dates are `date` columns / `"YYYY-MM-DD"` strings — no timezone math; timestamps are `timestamptz` / ISO 8601 UTC.
- Frontend: RSC reads via `fetch-*` actions, mutations via `'use server'` actions returning discriminated `ActionState`, `revalidatePath` after mutations; URL search params carry filter/period state; react-hook-form + zod; next-intl with ICU interpolation (no string concatenation).
- Tests co-located (`*.spec.ts` API, `*.test.ts(x)` frontend); Testcontainers integration tests in `apps/api/test/integration/`.
- Commits: conventional commits, enforced by commitlint.
