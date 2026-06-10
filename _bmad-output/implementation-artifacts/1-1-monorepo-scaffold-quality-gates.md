---
baseline_commit: 6881a7107ea7ce9287caaf89a571c2b730873f70
---

# Story 1.1: Monorepo Scaffold & Quality Gates

Status: done

## Story

As the operator-developer,
I want the monorepo workspace scaffolded with every quality gate wired,
so that every subsequent story lands as a gated, traceable commit — the pitch-grade trail.

## Acceptance Criteria

1. **Given** a fresh clone of the existing repo root (no `git init`, no generator CLI), **when** `pnpm install` runs on Node 22 LTS, **then** the workspace resolves with `pnpm-workspace.yaml` (`apps/*`, `packages/*`), pinned `packageManager` and `engines`, and exact dependency versions throughout (no `^`/`~`), matching the version table in architecture.md.
2. **Given** the scaffolded workspace, **when** `turbo run build lint type-check fmt stylelint test` executes, **then** the task graph runs (empty targets pass trivially) and the config packages (`lint-config`, `stylelint-config`, `typescript-config`) are consumed by root configs — with no eslint or prettier anywhere (NFR2).
3. **Given** a commit with a malformed message or staged lint/format violations, **when** the commit is attempted, **then** husky + commitlint + lint-staged block it (conventional commits enforced).
4. **Given** a pull request, **when** CI runs, **then** the merged workflow (ED3) executes lint, fmt-check, type-check, stylelint, and build jobs, and a single merged `.coderabbit.yaml` covers frontend and backend paths.
5. **Given** the repo root, **then** the merged AI setup (CLAUDE.md, skills, agents, commands, rules, hooks, MCP) is in place (ED3), `example/` is git-ignored and never committed (ED1), and the README documents the workspace layout.

## Tasks / Subtasks

- [x] Task 1: Workspace foundation files at repo root (AC: 1)
  - [x] Create `pnpm-workspace.yaml` with `packages: ['apps/*', 'packages/*']`
  - [x] Create root `package.json`: `name: supertool`, `private: true`, pinned `packageManager` (pnpm) and `engines` (node 22.x LTS current patch + pnpm), turbo-driven scripts (`dev`, `build`, `build:packages`, `test`, `type-check`, `lint`, `lint:fix`, `stylelint`, `stylelint:fix`, `fmt`, `fmt:check`, `commitlint`, `prepare: husky`) — model on `example/track-my-life/package.json`, rename scope/deps per Dev Notes
  - [x] Create `turbo.json` task graph: `dev` (no cache, persistent), `build` (dependsOn `^build`, outputs `.next/**`, `dist/**`, `storybook-static/**`), `build:packages`, `type-check` (dependsOn `^build`), `lint`, `lint:fix`, `stylelint`, `stylelint:fix`, `test`, `fmt` — model on the example, reserve task names used later (`test:e2e` slot)
  - [x] Pin every dependency at the exact version from the architecture version table (Dev Notes) — zero `^`/`~` anywhere in any package.json
  - [x] Verify `pnpm install` succeeds on Node 22 LTS; verify pnpm major version ↔ turbo compatibility before pinning (architecture flags pnpm 11.5.2 + turbo 2.9.17 as "verify at scaffold time" — if incompatible, fall back to latest pnpm 10.x and record the deviation in Dev Agent Record)
- [x] Task 2: Config packages (AC: 2)
  - [x] `packages/lint-config` (`@supertool/lint-config`): oxlint JSON configs exported as `./base`, `./next-js`, `./library` — rebuild from `example/track-my-life/packages/lint-config/configs/*`, bump to oxlint 1.69.0
  - [x] `packages/typescript-config` (`@supertool/typescript-config`): `base.json`, `nextjs.json`, `react-library.json` — rebuild from example; TypeScript 6.0.3 monorepo-wide (strict)
  - [x] `packages/stylelint-config` (`@supertool/stylelint-config`): rebuild `index.js` + `groups.js` from example; review against stylelint 17.13.0 (major bump from example's 16.x — fix any breaking config options)
- [x] Task 3: Root tool configs consuming the config packages (AC: 2)
  - [x] `.oxlintrc.json` extending `./packages/lint-config/configs/base.json`, with ignore patterns (`node_modules`, `dist`, `.next`, `storybook-static`, `_bmad*/**`, `example/**`, `**/skills/**`)
  - [x] `.oxfmtrc.json` carried from example
  - [x] `stylelint.config.js` consuming `@supertool/stylelint-config`
  - [x] `commitlint.config.ts` (conventional commits) + `.lintstagedrc` (`*.{js,ts,tsx}` → oxfmt + oxlint --fix; `*.{json,md}` → oxfmt; `*.{scss,css}` → stylelint --fix)
  - [x] `.editorconfig` carried from example; extend root `.gitignore` (keep existing `example/` and `.idea/` lines; add `node_modules/`, `dist/`, `.next/`, `.turbo/`, `.env`, `storybook-static/`, coverage)
- [x] Task 4: Git hooks (AC: 3)
  - [x] husky init via `prepare` script; `.husky/pre-commit` → `pnpm lint-staged`; `.husky/commit-msg` → `pnpm commitlint` (i.e. `commitlint --edit`)
  - [x] Negative-test both gates: attempt a commit with message `bad message` (must be blocked) and a staged file with a lint/format violation (must be blocked); record results in Dev Agent Record
- [x] Task 5: Merged CI workflow (AC: 4)
  - [x] `.github/actions/env-versions/action.yml` — composite action as single source of truth for node/pnpm versions (values must match root `engines`)
  - [x] `.github/actions/setup-pnpm-node-deps/action.yml` — checkout-time pnpm/node setup + install, carried from example
  - [x] `.github/workflows/ci.yml` — single merged workflow (FE `pull-request.yml` + BE `pull-request.yml` deduplicated): jobs `lint` (oxlint), `fmt-check` (oxfmt --check), `type-check` (build:packages then type-check), `stylelint`, `build`, `test` (`pnpm test`, passes trivially now — the ED3 "new test job"); `concurrency` group with cancel-in-progress; trigger on `pull_request` [opened, synchronize, reopened]
  - [x] Fix carried-over mislabels: example step names say "Run ESLint" while running oxlint — name jobs/steps truthfully (no "eslint" strings anywhere in the repo)
  - [x] Do NOT add i18n-parity or client-drift jobs yet — they land with stories 1.4 and 1.3 respectively (note slots in a comment)
- [x] Task 6: Merged `.coderabbit.yaml` (AC: 4)
  - [x] Merge FE + BE configs into one root file: FE path_instructions re-pointed at `apps/money-tracker/**`, `packages/shared/**`, `packages/ui/**`; BE instructions at `apps/api/**` (NestJS DI/module/testing rules), `**/Dockerfile`, `**/docker-compose*.{yml,yaml}`, `**/.env*`, `**/*.md`; drop BE's `manifests/**` kubernetes rule (no k8s in v1); path_filters exclude `node_modules`, `dist`, coverage, `_bmad-output/**`, `example/**`
  - [x] Add path rules encoding the agent MUSTs CodeRabbit should police: amounts never `number` (D1), no hand-written `fetch` to `/api/*` (NFR6), no DB access outside repositories, no eslint/prettier
- [x] Task 7: Merged AI setup (AC: 5)
  - [x] Write root `CLAUDE.md`: workspace layout, the seven agent MUSTs from architecture.md (Enforcement Guidelines), key commands, pointer to `_bmad-output/planning-artifacts/architecture.md` as pattern authority
  - [x] Merge AI tooling from both example repos (`.claude/` commands+agents+rules+hooks, `.mcp.json`, `.agents/`) with the EXISTING root `.claude/` — must NOT clobber or remove existing `.claude/skills/` (BMad skills) or `.claude/settings.local.json`, and must NOT touch `_bmad/`/`_bmad-output/`
  - [x] Confirm `example/` remains git-ignored and nothing under it is staged (ED1)
- [x] Task 8: README + final verification (AC: 1, 2, 5)
  - [x] `README.md`: workspace layout tree, prerequisites (Node 22 LTS, pnpm, Docker), install + quality-gate commands; note the single-command runtime arrives with Story 1.7
  - [x] Run `turbo run build lint type-check fmt stylelint test` — all pass (empty targets trivially)
  - [x] Run `pnpm fmt:check`, `pnpm lint`, `pnpm stylelint` clean at root
  - [x] `git status` shows no `example/` or `.env` files staged; every committed package.json greps clean of `^`/`~` version prefixes and of `eslint`/`prettier`

### Review Findings

- [x] [Review][Decision] Unpinned MCP servers in `.mcp.json` — serena runs from git HEAD, context7 from npm `latest`; conflicts with the repo's exact-pin posture (NFR2 spirit). Options: pin both, keep floating (donor parity, dev-only tooling), or drop.
- [x] [Review][Patch] `.claude/commands/find-improvements.md` targets "Track My Life monorepo" with stale stack (TS 5.9, Radix) — adapt to supertool [.claude/commands/find-improvements.md]
- [x] [Review][Patch] `.claude/commands/fix-issue.md` Phase 4 invokes nonexistent `opsx:archive` skill (openspec not carried) [.claude/commands/fix-issue.md]
- [x] [Review][Patch] Carried agents affirmatively instruct ESLint/Prettier setup — banned by NFR2/trap #1 [.claude/agents/typescript-pro.md, nextjs-developer.md, react-specialist.md]
- [x] [Review][Patch] `.claude/rules/nestjs-apis.md` contradicts architecture: PrismaService + Jest vs Drizzle + Vitest [.claude/rules/nestjs-apis.md]
- [x] [Review][Patch] `pnpm lint`/`pnpm stylelint` are green no-ops (zero packages define tasks); CI stylelint job validates nothing; docs present them as gates [package.json, .github/workflows/ci.yml]
- [x] [Review][Patch] `.claude/settings.json` deny rules ineffective: `Read(!.env.example)` invalid negation, dir patterns need `/**` [.claude/settings.json]
- [x] [Review][Patch] Foreign `TRACK-` ticket prefix + donor label set in PR commands [.claude/commands/create-pr.md, fix-issue.md]
- [x] [Review][Patch] `review-pr` enforces donor analytics conventions (trackIAEvent etc., repo is no-telemetry); `gh api -f comments='[...]'` sends array as string [.claude/commands/review-pr.md]
- [x] [Review][Patch] `review-comments` skill metadata `author: track-my-life`; skills-lock.json missing entries for project-context + review-comments [.claude/skills/review-comments/SKILL.md, skills-lock.json]
- [x] [Review][Patch] Machine-specific absolute path committed in sprint tracking [_bmad-output/implementation-artifacts/sprint-status.yaml]
- [x] [Review][Patch] Duplicate pnpm store caching (setup-node `cache: pnpm` + manual actions/cache) [.github/actions/setup-pnpm-node-deps/action.yaml]
- [x] [Review][Patch] `.claude/rules/react.md` points i18n navigation at `packages/shared` (should be `next-shared`) and uses PascalCase filenames [.claude/rules/react.md]
- [x] [Review][Patch] `@commitlint/types` 21.0.1 vs binding table 21.0.2 — 21.0.2 doesn't exist for that package; record deviation in Dev Agent Record [package.json]
- [x] [Review][Patch] Unanchored `.gitignore` entries `build`/`dist`/`coverage` swallow future source dirs [.gitignore]
- [x] [Review][Patch] CI runs only on `pull_request` — no validation on push to main [.github/workflows/ci.yml]
- [x] [Review][Patch] pnpm/action-setup `version:` input will hard-fail on `packageManager` bump ("Multiple versions of pnpm specified"); version pins live in two unsynchronized places [.github/actions/*]
- [x] [Review][Patch] Node pin unenforced locally — add `.nvmrc` [new file]
- [x] [Review][Patch] `prepare: husky` aborts `pnpm install --prod` (Story 1.7 Docker risk) [package.json]
- [x] [Review][Patch] lint-staged patterns miss `.jsx/.mjs/.cjs/.mts/.cts` [.lintstagedrc]
- [x] [Review][Patch] `.claude/hooks/format.sh` reformats files outside the repository [.claude/hooks/format.sh]
- [x] [Review][Patch] turbo `fmt` task unreachable; unanchored ignore segments (`docs`, `_bmad`, `**/skills/**`) over-exclude future dirs [turbo.json, .oxfmtrc.json, .oxlintrc.json]
- [x] [Review][Patch] `@supertool/typescript-config` consumed by no root config — AC2 gap; `pnpm type-check` verifies nothing; add root tsconfig.json covering commitlint.config.ts [tsconfig.json (new)]
- [x] [Review][Defer] Type-aware oxlint rules (`no-floating-promises`, `no-misused-promises`) inert without `--type-aware` [packages/lint-config/configs/base.json] — deferred, donor-identical; revisit with Story 1.2's budgeted oxlint work
- [x] [Review][Defer] Vendored `ui-ux-pro-max` skill instructs `sudo apt install` [(.claude|.agents)/skills/ui-ux-pro-max/SKILL.md] — deferred, vendored third-party content

## Dev Notes

### Critical scope boundary

This story creates the **workspace skeleton + gates only**. Do NOT create `apps/api` (Story 1.2), `apps/money-tracker`/`apps/storybook`/`packages/{shell,widgets,ui,shared,next-shared}` (Stories 1.3–1.4). The only packages that exist after this story are the three config packages. Empty turbo targets passing trivially is the expected, correct outcome (AC 2). Resist scope gravity toward the ~80%-complete examples — it's a named PRD risk.

### Repo state you are starting from

- Repo root already exists with committed `_bmad/`, `_bmad-output/`, `docs/`, `.claude/` (BMad skills + `settings.local.json`), `.agents/`, `.gitignore` (ignores `example/`, `.idea/`). There is NO root package.json yet — main branch is planning artifacts only.
- `example/track-my-life` (frontend monorepo blueprint) and `example/tracker-backend-api` (NestJS blueprint) sit git-ignored at the root. **ED1: configs may be carried/merged; application CODE is never copied, never imported.**
- Every commit must be conventional-commit formatted and trace to this story (ED2) — e.g. `feat: scaffold monorepo workspace with quality gates`.

### Version table — BINDING, exact pins, no `^`/`~` (architecture.md, npm-verified 2026-06-10)

| Package | Version |
|---|---|
| typescript | 6.0.3 (monorepo-wide) |
| turbo | 2.9.17 |
| oxlint / oxfmt | 1.69.0 / 0.54.0 |
| stylelint | 17.13.0 (major bump vs example 16.x — config review needed) |
| husky / lint-staged | 9.1.7 / 17.0.7 |
| @commitlint/cli (+config-conventional, types) | 21.0.2 |
| pnpm | 11.5.2 — verify turbo 2.9 compat at scaffold time; fallback latest 10.x, record deviation |
| node (engines) | 22.x LTS — pin the current patch at scaffold time |

Versions for next/react/nest/drizzle/etc. exist in the same architecture table but belong to later stories — do not install them now. Only install what this story's packages actually use.

### Carry-over map (example file → supertool file)

| Source (reference only) | Target | Changes |
|---|---|---|
| `example/track-my-life/package.json` | `/package.json` | scope → supertool, versions bumped per table, drop `test:e2e` script body availability (keep script) |
| `example/track-my-life/turbo.json` | `/turbo.json` | carry task graph; later stories add `openapi`/client tasks |
| `example/track-my-life/.oxlintrc.json` | `/.oxlintrc.json` | extend supertool lint-config path; add `_bmad*/**`, `example/**` ignores |
| `example/track-my-life/.oxfmtrc.json`, `.editorconfig`, `.lintstagedrc` | same names at root | carry, bump-driven tweaks only |
| `example/track-my-life/stylelint.config.js` + `packages/stylelint-config` | root + `packages/stylelint-config` | stylelint 17 breaking-change review |
| `example/track-my-life/commitlint.config.ts` | `/commitlint.config.ts` | carry |
| `example/track-my-life/.husky/{pre-commit,commit-msg}` | `.husky/` | carry (`pnpm lint-staged` / `pnpm commitlint`); skip the example's `pre-push` unless trivially carried |
| `example/track-my-life/packages/{lint-config,typescript-config,stylelint-config}` | `packages/...` | rebuild, `@supertool/*` names |
| both repos' `.github/workflows/pull-request.yml` + `.github/actions/*` | `.github/workflows/ci.yml` + `.github/actions/*` | MERGE + dedupe; truthful step names; add `test` job |
| both repos' `.coderabbit.yaml` | `/.coderabbit.yaml` | MERGE per Task 6 |
| both repos' CLAUDE.md / `.claude` / `.mcp.json` / `.agents` | root equivalents | MERGE with existing BMad `.claude/` — additive only |

### Traps (verified by inspecting the example repos)

1. **`example/tracker-backend-api` uses eslint + prettier** (`eslint.config.ts`, `.prettierrc`, eslint CI job). NFR2 bans both. Carry NOTHING eslint/prettier-related; the BE workflow's `eslint` job becomes the oxlint `lint` job in the merged CI.
2. **FE workflow step labeled "Run ESLint" actually runs `pnpm lint` (oxlint).** Don't propagate the lie — rename.
3. **FE workflow has an `i18n-check` job calling `scripts/check-i18n-parity.sh`** — do not carry it now (no messages files exist yet); it lands with Story 1.4. Leave a `# slot: i18n-parity (story 1.4), client-drift (story 1.3)` comment.
4. **`.github/actions/env-versions`** hardcodes node/pnpm versions as composite-action outputs — keep this single-source-of-truth pattern but set YOUR pinned versions; they must equal root `engines` (drift here breaks CI silently).
5. **stylelint 16 → 17 major**: example config may use removed/renamed options — run stylelint against a scratch `.scss` to prove config loads before declaring done.
6. **Existing root `.claude/` and `.gitignore` are live BMad infrastructure** — merge additively; deleting/overwriting BMad skills or the `example/`/`.idea/` ignore lines breaks the planning workflow.
7. **TS 6.0.3 monorepo-wide** is newer than the example's FE TS (5.9.3) — documented deliberate tension; if a config package option no longer exists under TS 6, fix forward (the architecture pins 6.0.3, validated at this story).

### Architecture compliance (binding for this story)

- Naming: package scope `@supertool/*`; files/dirs kebab-case always; no PascalCase filenames [architecture.md#Naming-Patterns]
- Root config locations are fixed: `.oxlintrc.json`, `.oxfmtrc.json`, `stylelint.config.js`, `commitlint.config.ts`, `turbo.json` at root [architecture.md#Structure-Patterns]
- The seven agent MUSTs go into CLAUDE.md verbatim-equivalent: string money (D1), generated-client-only API calls (NFR6), repository-only DB access, both-locales strings, tests-with-feature (NFR1), exact versions / never eslint+prettier, never import from `example/` [architecture.md#Enforcement-Guidelines]
- CI gate list for end state (lint, fmt-check, type-check, stylelint, build, test, i18n-parity, client-drift) — this story ships the first six [architecture.md#Infrastructure-&-Deployment]

### Testing requirements

No application code exists yet, so NFR1 is satisfied by the gates themselves being proven:

- `turbo run test` executes and passes (empty targets) — wired into CI `test` job
- Hook negative tests (Task 4) executed and recorded
- CI workflow must be syntactically valid: `gh workflow list`-able after push, or validate with `actionlint` if available locally (do not add new deps for this)

### Project Structure Notes

End-state tree for THIS story (everything else in the architecture tree arrives in later stories):

```
supertool/
├── package.json  pnpm-workspace.yaml  turbo.json  pnpm-lock.yaml
├── .oxlintrc.json  .oxfmtrc.json  stylelint.config.js  commitlint.config.ts
├── .lintstagedrc  .editorconfig  .gitignore(updated)  .coderabbit.yaml
├── .husky/{pre-commit,commit-msg}
├── .github/{workflows/ci.yml, actions/{env-versions,setup-pnpm-node-deps}}
├── CLAUDE.md  README.md
├── .claude/ (existing BMad + merged additions)  .agents/ (merged)  .mcp.json
├── _bmad/  _bmad-output/  docs/  example/(ignored)
└── packages/
    ├── lint-config/        # @supertool/lint-config
    ├── stylelint-config/   # @supertool/stylelint-config
    └── typescript-config/  # @supertool/typescript-config
```

No conflicts detected between epics, architecture, and repo state. One open verification is delegated to implementation time by design: exact Node 22 LTS patch + pnpm/turbo compat (architecture explicitly defers both to "scaffold time").

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] — story statement + ACs
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation] — blueprint decision, version table, target workspace shape
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — naming/structure/config patterns, agent MUSTs
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure-&-Boundaries] — full directory tree (end state, later stories)
- [Source: _bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md#Engineering-&-delivery-requirements] — ED1–ED4
- [Source: example/track-my-life/* and example/tracker-backend-api/*] — reference-only config blueprints (ED1)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- oxlint 1.69.0 rejected two rules carried from the 1.42-era example config: `no-multiple-empty-lines` and `import/order` ("Rule not found"). Both moved to oxfmt's responsibility (formatting / `experimentalSortImports`), which `.oxfmtrc.json` already covers → removed from `packages/lint-config/configs/base.json`. This was the budgeted oxlint-friction risk.
- oxlint 1.69 no longer applies `ignorePatterns` from extended configs → added `**/stylelint.config.js` to root `.oxlintrc.json` ignores (CJS `module` global false positive).
- Hook negative tests (both blocked, HEAD unchanged at baseline):
  - `git commit -m "totally bad message"` → commit-msg hook failed via commitlint (subject-empty, type-empty), exit 1.
  - Staged `scratch-gate-test.ts` with `console.log` + `debugger` → pre-commit hook failed via lint-staged → oxlint (no-console, no-debugger), exit 1.
- Stylelint 17.13.0 config-load proof: scratch `.scss` with violations correctly flagged (selector-class-pattern, @stylistic/color-hex-case, color-hex-length) — no breaking-change fixes needed in the carried config; all plugin versions bumped to their stylelint-17-compatible majors.

### Completion Notes List

- Workspace scaffolded in the existing repo root: `pnpm-workspace.yaml`, root `package.json` (exact pins, no `^`/`~`), `turbo.json`. `pnpm install` verified on Node 22.15.0.
- **pnpm 11.5.2 ↔ turbo 2.9.17 compat: VERIFIED empirically** — pnpm 10.23.0 self-switched to pinned 11.5.2, install + turbo runs clean. pnpm 11 auto-appended `minimumReleaseAgeExclude` entries for turbo binaries to `pnpm-workspace.yaml` (pnpm 11 supply-chain guard — kept).
- **Node engines pinned 22.15.0** (the locally installed LTS patch), not the newest 22.x LTS (22.22.3 per nodejs.org at implementation time) — pinning a runtime the machine doesn't have would break `pnpm install` locally. CI composite action uses the same 22.15.0 (single source of truth honored). Upgrade is a one-line change in two files when the local runtime is updated.
- Three config packages rebuilt under `@supertool/*` scope. Deliberate tightening: `unicorn/filename-case` now allows kebab-case ONLY (example also allowed PascalCase; architecture mandates "no PascalCase filenames anywhere").
- `turbo run build lint type-check fmt stylelint test` → exit 0 (0 tasks, empty targets pass trivially per AC2). `pnpm fmt:check` and `pnpm exec oxlint` clean. No application code in this story by design, so no unit tests exist yet — NFR1 satisfied by proving the gates themselves (hook negative tests + CI test job wired).
- Merged CI: one `ci.yml` with init-env → lint / fmt-check / type-check / stylelint / build / test; composite actions carried; truthful step names (the example's "Run ESLint" labels that actually ran oxlint were fixed); comment slots reserved for i18n-parity (1.4) and client-drift (1.3). All workflow YAML validated. The BE example's eslint/prettier tooling was NOT carried (NFR2).
- Merged `.coderabbit.yaml`: FE + BE path instructions adapted to monorepo paths, k8s rule dropped, plus a project-invariants instruction block encoding the seven agent MUSTs (string money, generated-client-only, repository-only DB, both locales, exact pins/no eslint+prettier, no example/ imports, kebab-case).
- Merged AI setup additively: 23 agents (FE+BE union, FE priority on 11 duplicates), 5 commands, 6 rules, 10 carried skills (+ `.agents/skills` mirror), merged `skills-lock.json`, merged `.claude/settings.json` (FE permissions @supertool-adapted + BE env-read denials + PostToolUse format hook re-implemented at `.claude/hooks/format.sh` using oxfmt/stylelint instead of the BE's absent `.rulesync` script), `.mcp.json` (serena + context7; BE's external Postman MCP skipped per NFR4 posture). openspec commands/skills deliberately NOT carried — this repo's process is BMad. Existing BMad `.claude/skills/*` and `settings.local.json` untouched.
- `.gitignore` extended (deps/build/env/turbo/IDE/`**/settings.local.json`), `example/` ignore retained and verified unstaged. `CLAUDE.md` + `README.md` authored.
- Note for Story 1.7: README documents that the single-command runtime arrives there.

### File List

**Workspace & configs (new):** `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `stylelint.config.js`, `commitlint.config.ts`, `.lintstagedrc`, `.editorconfig`, `.coderabbit.yaml`, `skills-lock.json`
**Modified:** `.gitignore`
**Config packages (new):** `packages/lint-config/{package.json, configs/{base,library,next}.json}`, `packages/typescript-config/{package.json, base.json, nextjs.json, react-library.json}`, `packages/stylelint-config/{package.json, index.js, groups.js}`
**Hooks (new):** `.husky/pre-commit`, `.husky/commit-msg`
**CI (new):** `.github/workflows/ci.yml`, `.github/actions/env-versions/action.yml`, `.github/actions/setup-pnpm-node-deps/action.yaml`
**Docs (new):** `CLAUDE.md`, `README.md`
**AI setup (new, merged from examples):** `.claude/settings.json`, `.claude/hooks/format.sh`, `.mcp.json`, `.claude/agents/*` (23 files), `.claude/commands/*` (5 files), `.claude/rules/*` (6 files), `.claude/skills/{brainstorming, frontend-design, next-best-practices, project-context, review-comments, skill-creator, subagent-driven-development, ui-ux-pro-max, vercel-composition-patterns, vercel-react-best-practices}/**`, `.agents/skills/{same set minus project-context/review-comments}/**`
**Story tracking:** `_bmad-output/implementation-artifacts/1-1-monorepo-scaffold-quality-gates.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Code Review Resolution (2026-06-10)

Adversarial review (Blind Hunter / Edge Case Hunter / Acceptance Auditor, parallel fresh-context subagents) produced 1 decision + 22 patches + 2 defers; 5 findings dismissed as verified false positives. All 23 actionable items applied and re-verified:

- Donor leakage scrubbed from carried AI content: find-improvements re-targeted to supertool stack; fix-issue rewritten without openspec (`opsx:*`) phases; `TRACK-` branch prefixes and donor label list replaced; review-pr analytics section replaced with NFR4 no-telemetry rule and `gh api` array payload fixed to `--input`; ESLint/Prettier instructions in typescript-pro/nextjs-developer/react-specialist re-pointed at oxlint/oxfmt; nestjs-apis rule fixed (Prisma→Drizzle repositories, Jest→Vitest+Testcontainers); react.md i18n nav paths corrected to `packages/next-shared` kebab-case; review-comments skill author → supertool; skills-lock completed (10 entries).
- Real gates: root scripts now actually lint (`oxlint && turbo run lint`), stylelint repo-wide (`--allow-empty-input` + new `.stylelintignore` keeping the glob out of `example/`), and type-check (`tsc -p tsconfig.json && turbo …` with new root `tsconfig.json` extending `@supertool/typescript-config` — AC2 now satisfied for all three config packages; error-detection proven by negative test).
- CI: `push: main` trigger added with ref-based concurrency fallback; pnpm version single-sourced from `packageManager` (removed `version:` input that would hard-fail on bump); duplicate pnpm store cache step removed.
- Robustness: `.claude/settings.json` deny list rewritten with valid patterns (bogus `Read(!.env.example)` negation removed); format hook constrained to repo-internal paths + full JS-extension coverage; lint-staged patterns extended (`jsx,cjs,mjs,cts,mts`); `.gitignore` build outputs anchored as directories; `.nvmrc` added; `prepare: husky || true` (prod-install safe); oxfmt/oxlint ignores directory-anchored.
- MCP (operator decisions): context7 pinned `@3.1.0`; serena removed entirely.
- Version-table deviation recorded: `@commitlint/types` pinned 21.0.1 — 21.0.2 does not exist for that package (npm-verified); cli + config-conventional are 21.0.2 per table.
- Post-fix verification: `pnpm lint`, `pnpm stylelint` (+negative proof), `pnpm type-check` (+negative proof), `pnpm fmt:check`, AC2 turbo command, hook negative tests, YAML/JSON/bash syntax — all green.

Additional files from review fixes: `tsconfig.json`, `.nvmrc`, `.stylelintignore` (new); `deferred-work.md` (review log).

## Change Log

- 2026-06-10: Code review complete — 23 findings patched (donor leakage, no-op gates, CI hardening, settings/hook robustness), 2 deferred, 5 dismissed. MCP: context7 pinned, serena dropped (operator). Status → done.
- 2026-06-10: Story 1.1 implemented — monorepo scaffold, quality gates (oxlint/oxfmt/stylelint/commitlint/husky/lint-staged), three `@supertool/*` config packages, merged CI workflow + CodeRabbit config, merged AI setup, README/CLAUDE.md. Two oxlint-1.69 config adaptations and Node-engines pin rationale recorded in Debug Log. Status → review.
