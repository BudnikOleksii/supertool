# Deferred Work

## Deferred from: code review of 1-1-monorepo-scaffold-quality-gates (2026-06-10)

- Type-aware oxlint rules (`typescript/no-floating-promises`, `typescript/no-misused-promises`) are configured as `error` in `packages/lint-config/configs/base.json` but plain `oxlint` invocations don't run type-aware analysis, so they are silently inert. Donor config had the same latent issue. Revisit when wiring oxlint on the decorator-heavy NestJS code (Story 1.2's budgeted friction work) — either enable `--type-aware` or drop the two rules.
- Vendored `ui-ux-pro-max` skill (`.claude/skills/` and `.agents/skills/` mirrors) instructs agents to run `sudo apt update && sudo apt install python3` if Python is missing. Vendored third-party content; neuter or fence as human-only guidance next time the skill is touched/updated.
