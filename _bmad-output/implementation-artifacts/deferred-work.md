# Deferred Work

## Deferred from: code review of 1-1-monorepo-scaffold-quality-gates (2026-06-10)

- ~~Type-aware oxlint rules~~ — RESOLVED in Story 1.2 (2026-06-10): the two inert rules (`typescript/no-floating-promises`, `typescript/no-misused-promises`) were dropped from `packages/lint-config/configs/base.json`; enabling `--type-aware` would require the experimental `oxlint-tsgolint` toolchain (unapproved dependency). Revisit if/when oxlint stabilizes type-aware mode.
- Vendored `ui-ux-pro-max` skill (`.claude/skills/` and `.agents/skills/` mirrors) instructs agents to run `sudo apt update && sudo apt install python3` if Python is missing. Vendored third-party content; neuter or fence as human-only guidance next time the skill is touched/updated.
