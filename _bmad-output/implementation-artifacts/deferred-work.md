# Deferred Work

## Deferred from: code review of 1-8-design-system-repair-theming (2026-06-12)

- Visual evidence gate (both-theme screenshots incl. open/interactive states vs `example/track-my-life`) not satisfied for 1.8's repaired primitives — deferred to Story 1.9, which establishes the screenshot-based visual QA baseline; 1.8 accepted on mechanism + token purity only.
- Select open-panel width defect (`packages/ui/src/components/select/Select.module.scss:68,87` — `.popperViewport` pinned to trigger width vs `.content` min-width 8rem clips items/check/highlight) — deferred to Story 1.9 AC-2, which diagnoses and schedules this exact fix.
- No gate links switcher constants to message keys: `THEME_OPTION_LIST` (`packages/shell/src/components/theme-switcher/constants.ts`) and `LOCALE_CODE_LIST` resolve labels via `translate(option)` with no compile-time or CI link to `navigation.json` keys — adding an option without its message key only fails at runtime. The i18n parity gate checks en↔uk symmetry only. Add a constants↔messages check next time the parity script is touched.
- Select empty-options affordance remains deferred (originally from the 1.4 review, entry below) — Story 1.8 touched Select styling/markup but the empty-state behavior was out of its AC scope.

## Deferred from: code review of 1-4-money-tracker-shell-design-system-i18n-foundation (2026-06-12)

- NavigationLink active-state is exact-match and locale-naive (`packages/next-shared/src/i18n/navigation/NavigationLink.tsx:11`). `pathname === href` is correct for the single root tool (`/`) today but won't set `aria-current="page"` for nested routes (`/tool/sub`) or non-default-locale paths. Revisit when a second tool or sub-routes land (AC-2) — likely needs prefix-matching plus an exact-match special case for the home entry.
- `Select` primitive (`packages/ui/src/components/select/Select.tsx:42`) has no empty-options or unmatched-value handling: `optionList={[]}` yields an empty popup, and a controlled `value` not present in the options renders a blank trigger (no `placeholder` wired on the Radix `Value`). No consumer hits this yet (LocaleSwitcher always has two valid options); add an empty-state / placeholder when a real consumer needs it.
- `apps/money-tracker/src/i18n/request.ts:17` dynamic-imports `messages/${locale}.json` with no fallback. Only en/uk exist today (both present and parity-gated); adding a locale to `LOCALE_CODE_LIST` without its message file would throw a runtime module-not-found before the parity gate runs. Add a fallback-to-defaultLocale-messages guard when a third locale is introduced.
- i18n-parity script (`scripts/check-i18n-parity.mjs:34`) is brittle on non-string message shapes: an empty `{}` namespace flattens to no key (divergence can slip through) and a malformed JSON file throws a raw `SyntaxError` instead of the readable per-file report. Works correctly for the current string-leaf messages and CI still fails on bad JSON; harden the flattener + wrap `JSON.parse` next time the gate is touched.

## Deferred from: code review of 1-2-api-foundation-health-check-database-baseline (2026-06-10)

- Health endpoint returns HTTP 200 with `database: 'down'` (deliberate AC-literal reading, no @nestjs/terminus). There is no machine-readable unhealthy signal at the HTTP layer — container healthchecks and probes key on status codes. Revisit when Story 1.7 wires docker compose healthchecks for the api service.
- `db:migrate` runs drizzle-kit via its internal `./node_modules/drizzle-kit/bin.cjs` path (needed for Node `--env-file-if-exists` loading). Stable under the exact 0.31.10 pin and pnpm's direct-dependency layout, but re-evaluate whenever drizzle-kit is upgraded or env handling changes.
- Error envelope (`ErrorResponseDto`) is exposed in OpenAPI via `extraModels` only; no endpoint declares per-operation `@ApiResponse` error types, so the generated client (Story 1.3) won't type error responses per endpoint. Add decorations when real failure modes land (Story 1.5+).

## Deferred from: code review of 1-1-monorepo-scaffold-quality-gates (2026-06-10)

- ~~Type-aware oxlint rules~~ — RESOLVED in Story 1.2 (2026-06-10): the two inert rules (`typescript/no-floating-promises`, `typescript/no-misused-promises`) were dropped from `packages/lint-config/configs/base.json`; enabling `--type-aware` would require the experimental `oxlint-tsgolint` toolchain (unapproved dependency). Revisit if/when oxlint stabilizes type-aware mode.
- Vendored `ui-ux-pro-max` skill (`.claude/skills/` and `.agents/skills/` mirrors) instructs agents to run `sudo apt update && sudo apt install python3` if Python is missing. Vendored third-party content; neuter or fence as human-only guidance next time the skill is touched/updated.

## Deferred from: code review of 1-9-design-system-structure-visual-qa-baseline (2026-06-13)

- Select open-panel long-label clipping (`packages/ui/src/components/atoms/select/Select.module.scss`). The AC-2 width fix is correct, but pre-existing `.content { overflow: hidden }` has no `max-width` clamp / no `--radix-select-content-available-width` and `.item` has no `white-space`/truncation — an option longer than the popper's available width clips with no ellipsis/wrap. Not introduced by this change; no current consumer hits it (short labels only). Add truncation or available-width handling when a long-label Select consumer lands.
- Storybook a11y addon (`a11y: { test: 'error' }` in `.storybook/preview.ts`) is not machine-enforced by the gate pipeline — `turbo run test` is Vitest-only, so axe coverage rests on a manual playwright+axe harness. The Select `Open` story scopes off `aria-hidden-focus` (documented, reference-matching Radix behavior); the Dialog `Open` story uses the same portal+`aria-hidden` mechanism with no suppression. Confirm Dialog `Open` is genuinely addon-clean and/or wire a real Storybook a11y gate (test-runner / `@storybook/addon-vitest`) so the visual-QA a11y claim is enforced, not asserted in the record.
