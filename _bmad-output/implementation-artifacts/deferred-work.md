# Deferred Work

## Deferred from: code review of 1-2-api-foundation-health-check-database-baseline (2026-06-10)

- Health endpoint returns HTTP 200 with `database: 'down'` (deliberate AC-literal reading, no @nestjs/terminus). There is no machine-readable unhealthy signal at the HTTP layer — container healthchecks and probes key on status codes. Revisit when Story 1.7 wires docker compose healthchecks for the api service.
- `db:migrate` runs drizzle-kit via its internal `./node_modules/drizzle-kit/bin.cjs` path (needed for Node `--env-file-if-exists` loading). Stable under the exact 0.31.10 pin and pnpm's direct-dependency layout, but re-evaluate whenever drizzle-kit is upgraded or env handling changes.
- Error envelope (`ErrorResponseDto`) is exposed in OpenAPI via `extraModels` only; no endpoint declares per-operation `@ApiResponse` error types, so the generated client (Story 1.3) won't type error responses per endpoint. Add decorations when real failure modes land (Story 1.5+).

## Deferred from: code review of 1-1-monorepo-scaffold-quality-gates (2026-06-10)

- ~~Type-aware oxlint rules~~ — RESOLVED in Story 1.2 (2026-06-10): the two inert rules (`typescript/no-floating-promises`, `typescript/no-misused-promises`) were dropped from `packages/lint-config/configs/base.json`; enabling `--type-aware` would require the experimental `oxlint-tsgolint` toolchain (unapproved dependency). Revisit if/when oxlint stabilizes type-aware mode.
- Vendored `ui-ux-pro-max` skill (`.claude/skills/` and `.agents/skills/` mirrors) instructs agents to run `sudo apt update && sudo apt install python3` if Python is missing. Vendored third-party content; neuter or fence as human-only guidance next time the skill is touched/updated.
