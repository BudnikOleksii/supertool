# supertool

Personal tool platform: independent tool apps (first: **Money Tracker**) sharing one account store, one shell, and one API — built as a pnpm + Turborepo monorepo. Runs entirely locally; no deployment, no telemetry.

## Prerequisites

- **Node.js 22 LTS** (pinned: 22.15.0 — see `.nvmrc`)
- **pnpm** — any recent version; pnpm ≥10 self-switches to the pinned `packageManager` version (11.5.2)
- **Docker** — for PostgreSQL and the full local runtime (arrives with Stories 1.2 / 1.7)

## Getting started

```bash
pnpm install
```

> The single-command full-stack runtime (`docker compose up`) lands with Story 1.7 — it will bring up PostgreSQL + API + Money Tracker with migrations and seed applied on boot.

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
