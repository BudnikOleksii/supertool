<!-- Story/feature PRs only. main receives PR merges after local code review + CI + CodeRabbit (NFR2). -->

## What & why

<!-- One or two sentences. Link the story: e.g. "Story 4.1 — mobile navigation drawer". -->

## Story

<!-- Path to the story file, e.g. _bmad-output/implementation-artifacts/4-1-mobile-navigation-drawer.md -->

## Definition of Done

- [ ] Story acceptance criteria all met
- [ ] Tests ship in this PR and assert behaviour, not coverage optics (NFR1)
- [ ] Every user-facing string is in **both** `en.json` and `uk.json` (FR19/FR20 — i18n key-parity gate)
- [ ] API consumed only via the generated client; no hand-written `fetch` to `/api/*` (NFR6)
- [ ] Money is strings end-to-end — no `number` amounts, no float math (D1)
- [ ] All gates green locally (lint, fmt, type-check, stylelint, build, test, i18n parity, client-drift)

### Visual QA — **required for any PR touching `packages/ui`, `packages/shell` UI, app screens, or styles**

> Green tests + type-check + build + axe is **not** visual verification (the 1.4 / 1.8 / broken-mobile lesson). If this PR renders or restyles UI, this section is mandatory and reviewers must see the evidence.

- [ ] Not a UI/style change — visual QA N/A
- [ ] Screenshots of every changed/added component or screen in **both light and dark themes**
- [ ] Screenshots at **both mobile and desktop viewports**
- [ ] **Open/interactive states** captured (select expanded, dialog/dropdown open, drawer open, toast visible) — not just closed state
- [ ] Side-by-side comparison against the `example/track-my-life` reference capture, with each divergence either fixed or recorded as a documented divergence
- [ ] Evidence (screenshots + reference paths) recorded in the story's Dev Agent Record (Story 1.9 protocol)
