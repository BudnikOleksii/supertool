---
description: Implement findings from IMPROVEMENTS.md — plan, delegate to specialist agents, review, and update the tracker
---

finding_numbers = $ARGUMENTS

If finding_numbers is not provided, read IMPROVEMENTS.md and show the ## Progress Tracker table, then ask the user which finding numbers to implement (comma-separated).

## Phase 1: Parse and validate findings

1. Read `IMPROVEMENTS.md` at the project root.
2. Parse the finding numbers from either command arguments or the user's interactive response (comma-separated, e.g. `27,28,34`).
3. For each number, extract from the **Progress Tracker** table:
   - Impact, Finding description, Effort, Agent(s), Status
4. For each number, extract the detailed description from **Detailed Findings**.
5. If any number is not found or already completed, warn the user and skip it.
6. Present a summary table of the findings to implement.

## Phase 2: Create implementation plan

1. Use **EnterPlanMode** to create a structured plan.
2. For each finding, outline:
   - What needs to change (files, patterns)
   - The recommended approach (from the detailed description)
   - Which specialist agent(s) to delegate to (from the Agent(s) column)
3. Group findings that can be implemented independently vs those with dependencies.
4. Present the plan and use **AskUserQuestion** to confirm:
   > "Implementation plan ready. Proceed?"
   - Options: "Proceed", "Adjust plan", "Cancel"
   - If "Adjust plan", ask what to change and regenerate.
   - If "Cancel", stop.

## Phase 3: Implement findings

For each finding (or group of independent findings in parallel):

1. Read all relevant source files mentioned in the finding details.
2. Delegate implementation to the appropriate specialist agent(s) listed in the finding's Agent(s) column using the **Agent** tool with the matching `subagent_type`. Common mappings:
   - `performance-engineer` -> subagent_type: "performance-engineer"
   - `architect-reviewer` -> subagent_type: "architect-reviewer"
   - `security-auditor` -> subagent_type: "security-auditor"
   - `typescript-pro` -> subagent_type: "typescript-pro"
   - `react-specialist` -> subagent_type: "react-specialist"
   - `nextjs-developer` -> subagent_type: "nextjs-developer"
   - `qa-expert` -> subagent_type: "qa-expert"
   - `code-reviewer` -> subagent_type: "code-reviewer"
   - `documentation-engineer` -> subagent_type: "documentation-engineer"
   - `accessibility-tester` -> subagent_type: "accessibility-tester"
   - `build-engineer` -> subagent_type: "build-engineer"
   - `debugger` -> subagent_type: "debugger"
   - `dependency-manager` -> subagent_type: "dependency-manager"
   - `dx-optimizer` -> subagent_type: "dx-optimizer"
   - `error-detective` -> subagent_type: "error-detective"
   - `legacy-modernizer` -> subagent_type: "legacy-modernizer"
   - `refactoring-specialist` -> subagent_type: "refactoring-specialist"
   - `seo-specialist` -> subagent_type: "seo-specialist"
     When a finding lists multiple agents, use the first one as primary. For simple or cross-cutting changes, implement directly without delegation.
3. When delegating to an agent, provide a detailed prompt that includes:
   - The full finding description and fix instructions from IMPROVEMENTS.md
   - The exact file paths and line numbers
   - The project's architecture rules from CLAUDE.md (feature-based organization, shared code placement, server actions vs client API, etc.)
   - Instruction to make the minimal change needed
4. After each agent completes, verify the changes compile: run `pnpm type-check`.
5. Track progress using **TaskCreate** and **TaskUpdate**.

## Phase 4: Quality checks

1. Run the full check suite:
   ```bash
   pnpm type-check
   pnpm lint:fix
   pnpm fmt
   ```
2. Fix any issues that arise.

## Phase 5: Code review

1. Spawn a **code-reviewer** subagent using the **Agent** tool with `subagent_type: "code-reviewer"`.
2. Provide it with:
   - The list of findings implemented and their numbers
   - All changed files (from `git diff --stat`)
   - Instructions to review for correctness, regressions, type safety, and adherence to project conventions (RSC boundaries, cache invalidation patterns, i18n, shared code placement)
3. Present the review results to the user.
4. If the reviewer finds issues, fix them and re-run the review.

## Phase 6: Update IMPROVEMENTS.md

1. Use **AskUserQuestion** to ask:
   > "All findings implemented and reviewed. Update IMPROVEMENTS.md to mark these as completed?"
   - Options: "Yes, update", "No, skip"
2. If "Yes, update":
   - Remove each implemented finding's row from the **## Progress Tracker** table
   - Remove each implemented finding's detailed entry from **## Detailed Findings**
   - Add each finding to the latest **Items completed** table under **## Previous Improvements (Done)** with status "Done"
3. Run `pnpm fmt` to ensure the file is clean.

## Phase 7: Wrap up

Present a summary:

```md
## Implementation Complete

**Findings implemented:** #<n1>, #<n2>, ...
**Files changed:** <count>

Run `/create-pr <ticket_number>` to create a pull request.
```
