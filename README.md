![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/BudnikOleksii/supertool?utm_source=oss&utm_medium=github&utm_campaign=BudnikOleksii%2Fsupertool&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# supertool

Personal tool platform: independent tool apps (first: **Money Tracker**) sharing one account store, one shell, and one API — built as a pnpm + Turborepo monorepo. Runs entirely locally; no deployment, no telemetry.

## Prerequisites

- **Node.js 22 LTS** (pinned: 22.15.0 — see `.nvmrc`)
- **pnpm** — any recent version; pnpm ≥10 self-switches to the pinned `packageManager` version (11.5.2)
- **Docker** — for PostgreSQL and the full local runtime (`pnpm compose:up`)

## Getting started

### Full local runtime (one command)

Bring up the entire stack — PostgreSQL 16 + API + Money Tracker — with a single command from the repo root:

```bash
pnpm compose:up
# equivalent to: docker compose -f docker/docker-compose.yml up --build
```

This brings up:

| Service       | URL                          | Notes                                              |
| ------------- | ---------------------------- | -------------------------------------------------- |
| Money Tracker | http://localhost:3000        | the app — sign in / sign up here                   |
| API           | http://localhost:3001/api/v1 | proxied from the app at `/api/*` (same-origin, D5) |
| PostgreSQL    | localhost:5432               | named volume `postgres-data`                       |

The API container applies all pending database migrations **before** it starts listening (migrate → seed → listen), so a boot against an empty volume produces a fully-migrated schema with zero manual steps. The Money Tracker waits for the API's healthcheck (which asserts the database is reachable) before starting.

The stack runs entirely on built-in local-only defaults, so no `.env` is required. To override secrets, ports, or the database name, copy the example and pass it explicitly:

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml --env-file .env up --build
```

Tear down:

```bash
pnpm compose:down                                   # stop and remove containers (keeps the database volume)
docker compose -f docker/docker-compose.yml down -v # also drop the database volume
```

### Native inner-loop (development)

The full compose runtime is the reproducible-deployment deliverable, not a replacement for the fast dev loop. For day-to-day development, run Postgres in Docker and the apps natively:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/money-tracker/.env.example apps/money-tracker/.env
docker compose -f docker/docker-compose.yml up postgres
pnpm dev
```

### No telemetry (NFR4)

The images bake telemetry off — `NEXT_TELEMETRY_DISABLED=1`, `TURBO_TELEMETRY_DISABLED=1`, and `DO_NOT_TRACK=1` — so no opt-in network call ever fires. Pino logs to the console only; better-auth and PostgreSQL run locally. The running stack makes no external network calls.

## Workspace layout

```
apps/                      # (arrive in Stories 1.2–1.4)
  money-tracker/           # Next.js 16 tool app
  api/                     # NestJS API — auth host, owns PostgreSQL
  storybook/               # component playground
packages/
  lint-config/             # shared oxlint configs (base / library / next-js)
  stylelint-config/        # shared stylelint config (SCSS, property ordering)
  typescript-config/       # shared tsconfigs (base / nextjs / react-library)
  shell/  widgets/  ui/  shared/  next-shared/   # (arrive in Stories 1.3–1.4)
```

Planning artifacts live in `_bmad-output/` (committed — every commit traces to a story). `example/` holds reference repos and is git-ignored; its code is never committed.

## Commands

| Command                                 | What it does               |
| --------------------------------------- | -------------------------- |
| `pnpm dev`                              | turbo dev across workspace |
| `pnpm build`                            | build all packages/apps    |
| `pnpm test`                             | run all tests (Vitest)     |
| `pnpm lint` / `pnpm lint:fix`           | oxlint                     |
| `pnpm fmt` / `pnpm fmt:check`           | oxfmt formatting           |
| `pnpm stylelint` / `pnpm stylelint:fix` | stylelint (SCSS)           |
| `pnpm type-check`                       | TypeScript                 |

## Quality gates

- **Local:** husky pre-commit (lint-staged → oxfmt + oxlint + stylelint) and commit-msg (commitlint, conventional commits).
- **CI (every PR):** lint, fmt-check, type-check, stylelint, build, test — see `.github/workflows/ci.yml`. i18n key-parity and generated-client drift gates arrive with Stories 1.4 / 1.3.
- **Review:** CodeRabbit via the merged `.coderabbit.yaml`.

No eslint. No prettier. Exact dependency versions only.
