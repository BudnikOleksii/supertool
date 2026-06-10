---
description: Audit the codebase with specialist agents to discover new improvements, then prioritize and add them to IMPROVEMENTS.md
---

focus_areas = $ARGUMENTS

## Phase 1: Understand current state

1. Read `IMPROVEMENTS.md` at the project root.
2. Read `CLAUDE.md` for project architecture rules.
3. Collect all existing findings: **Progress Tracker** items (pending work), **Backlog** items, and **Previous Improvements (Done)** items.
4. Determine the next available finding number (highest existing number + 1).
5. If `focus_areas` is provided, note it — agents will focus their investigation on those areas. Otherwise, agents perform a general audit.

## Phase 2: Spawn investigation agents

Spawn the following specialist agents **in parallel** using the **Agent** tool. Each agent gets a read-only investigation prompt — they must NOT edit any files, only report findings.

Split into three parallel batches to avoid overwhelming context:

### Batch 1 — Architecture, Security, Performance, Types

Spawn these 4 agents in a single message:

1. **architect-reviewer** (`subagent_type: "architect-reviewer"`)
   Focus: monorepo structure, package boundaries, dependency flow between apps/ and packages/, route group organization, shared code placement, unnecessary coupling, feature organization.

2. **security-auditor** (`subagent_type: "security-auditor"`)
   Focus: authentication/authorization patterns, input validation, CSP headers, cookie security, server action security, middleware patterns, dependency vulnerabilities.

3. **performance-engineer** (`subagent_type: "performance-engineer"`)
   Focus: Core Web Vitals opportunities, bundle size, unnecessary client components, missing React.memo/useMemo, N+1 fetch patterns, cache strategy gaps, image/font optimization, build performance.

4. **typescript-pro** (`subagent_type: "typescript-pro"`)
   Focus: `any` usage, missing strict checks, unsafe casts, untyped API boundaries, generic opportunities, discriminated union gaps, type coverage holes.

### Batch 2 — React, Next.js, QA, Accessibility

Spawn these 4 agents in a single message:

5. **react-specialist** (`subagent_type: "react-specialist"`)
   Focus: component patterns, state management, hook quality, prop drilling, context usage, Radix UI integration, re-render issues, React 19 adoption gaps.

6. **nextjs-developer** (`subagent_type: "nextjs-developer"`)
   Focus: App Router patterns, RSC boundaries, server action patterns, metadata/SEO, middleware usage, route handler patterns, loading/error states, i18n patterns.

7. **qa-expert** (`subagent_type: "qa-expert"`)
   Focus: test coverage gaps, missing test utilities, untested critical paths, Storybook coverage, E2E gaps, test infrastructure improvements.

8. **accessibility-tester** (`subagent_type: "accessibility-tester"`)
   Focus: ARIA usage, keyboard navigation, focus management, color contrast, screen reader compatibility, form accessibility, semantic HTML.

### Batch 3 — Build, Dependencies, DX, SEO, Refactoring

Spawn these 5 agents in a single message:

9. **build-engineer** (`subagent_type: "build-engineer"`)
   Focus: Turborepo configuration, build times, cache effectiveness, CI pipeline optimization, bundle analysis, dev server performance.

10. **dependency-manager** (`subagent_type: "dependency-manager"`)
    Focus: outdated packages, duplicate dependencies, unused dependencies, pnpm workspace optimization, version mismatches across packages, bundle size impact.

11. **dx-optimizer** (`subagent_type: "dx-optimizer"`)
    Focus: developer workflow friction, script ergonomics, IDE integration, dev feedback loops, onboarding experience, monorepo DX.

12. **seo-specialist** (`subagent_type: "seo-specialist"`)
    Focus: metadata completeness, structured data, sitemap/robots, Open Graph, canonical URLs, semantic HTML for crawlability.

13. **refactoring-specialist** (`subagent_type: "refactoring-specialist"`)
    Focus: code duplication, long functions, complex conditionals, feature envy, dead code, naming issues, module cohesion.

### Agent prompt template

Each agent receives this prompt (with its specific focus area inserted):

```text
You are investigating the supertool monorepo for improvement opportunities.

**Your role:** {agent_name}
**Focus areas:** {focus_description}
{if focus_areas: "**User-specified focus:** " + focus_areas}

**Project context:**
- pnpm monorepo with Turborepo (apps/money-tracker, apps/api, apps/storybook, packages/shell, packages/widgets, packages/ui, packages/shared, packages/next-shared)
- Next.js 16, React 19, NestJS 11, TypeScript 6, SCSS modules, next-intl, react-hook-form + zod, Drizzle ORM + PostgreSQL, better-auth
- Linting: oxlint, stylelint. Formatting: oxfmt. Testing: Vitest. No eslint/prettier — never suggest them.
- API client generated via @hey-api/openapi-ts in packages/shared
- Pattern authority: _bmad-output/planning-artifacts/architecture.md

**Rules:**
- Do NOT edit any files. Read-only investigation.
- Do NOT report issues that are already tracked (see list below).
- Each finding must reference specific files and line numbers.
- Rate each finding: Impact (1-5, where 5 = critical), Effort (S/M/L).
- Be concrete — "improve performance" is not a finding. "Memoize fetchTransactions result in dashboard/page.tsx:34 to avoid re-fetch on filter change" is.

**Already tracked or completed — do NOT re-report these:**
{list of all existing finding titles from Progress Tracker, Backlog, and Previous Improvements}

**Output format (strictly follow this):**

For each finding, output:

### Finding: {short title}
**Impact:** {1-5} | **Effort:** {S/M/L} | **Agent:** {your agent name}
**Files:** {file paths with line numbers}
**Problem:** {1-2 sentence description}
**Action:** {concrete fix instruction}

If you find nothing new, respond with "No new findings."
```

## Phase 3: Collect and deduplicate

1. Wait for all agents to complete.
2. Collect all findings from all agent reports.
3. Deduplicate: if two agents report the same underlying issue, merge them — keep the more specific description and note both agents.
4. Remove any findings that match already-tracked items (double-check against Phase 1 list).

## Phase 4: Prioritize and organize

1. Sort findings by Impact (descending), then by Effort (S before M before L).
2. Assign sequential finding numbers starting from the next available number.
3. Group findings into suggested sprint batches:
   - Group by theme (security, performance, DX, etc.)
   - Within each group, order by impact \* effort efficiency
4. Present the findings to the user in a summary table:

```md
## New Findings: {count} improvements discovered

| #   | Task | Impact | Effort | Agent(s) |
| --- | ---- | ------ | ------ | -------- |
| ... | ...  | ...    | ...    | ...      |

Suggested sprint grouping:

- **Batch A — {theme}:** #n1, #n2, ...
- **Batch B — {theme}:** #n3, #n4, ...
```

5. Use **AskUserQuestion** to confirm:
   > "Found {count} new improvements. Add all to IMPROVEMENTS.md?"
   - Options: "Add all", "Let me pick", "Cancel"
   - If "Let me pick", ask which finding numbers to include.
   - If "Cancel", stop.

## Phase 5: Update IMPROVEMENTS.md

1. For each accepted finding, add a row to the **## Progress Tracker** table with Status = "Todo".
2. For each accepted finding, add a detailed entry under **## Detailed Findings** following the existing format:

   ```md
   ### {number}. {title}

   **Impact:** {1-5} | **Effort:** {S/M/L} | **Agent:** {agent_name}

   {problem description}

   **Files:**

   - `{file_path}:{line_number}` ({brief context})

   **Action:** {concrete fix instruction}

   ---
   ```

3. Update the **Recommended Execution Order** section with new sprint groupings appended.
4. Update the `> Updated:` date at the top to today's date, and append any new agent names to the `Analyzed by:` list.
5. Run `pnpm fmt` to format the file.

## Phase 6: Wrap up

Present a summary:

```md
## Audit Complete

**Agents deployed:** {count}
**New findings added:** {count}
**Next step:** Run `/fix-improvements {numbers}` to implement.
```
