---
description: 'End-to-end: fetch GitHub issue, propose fix, implement, and create PR — with user approval at each step'
---

issue_url_or_number = $ARGUMENTS

If issue_url_or_number is not provided, ask for it.

This command runs the full issue-to-PR pipeline with user confirmation gates between each phase.

**Steps**

## Phase 1: Fetch and analyze the GitHub issue

1. Fetch the issue using `gh issue view <issue_url_or_number>`.
2. Extract the issue number, title, body, and labels.
3. Analyze the issue to understand what needs to be done.
4. Present a brief summary to the user:

```
## Issue #<number>: <title>

<1-3 sentence summary of what needs to be done>
```

5. Use **AskUserQuestion** to ask:
   > "Ready to proceed to the proposal phase? You can also provide additional context or constraints."
   - Options: "Proceed to proposal", "Cancel"
   - If cancelled, stop and explain how to resume manually.

## Phase 2: Propose the fix

1. Investigate the relevant code and consult `_bmad-output/planning-artifacts/architecture.md` for binding patterns and constraints.
2. Present a concrete fix proposal: affected files, approach, risks, and test plan. Follow the project's hard rules in CLAUDE.md (string money, generated-client-only API access, repository-only DB access, both locales, exact versions, no eslint/prettier).

3. After the proposal is presented, use **AskUserQuestion** to ask:
   > "Proposal ready. Review it and confirm to proceed to implementation."
   - Options: "Proceed to implementation", "Let me review first (pause)", "Cancel"
   - If "Let me review first", stop and tell the user to run `/fix-issue continue` when ready.
   - If cancelled, stop.

## Phase 3: Implement

1. Implement the proposed fix, including tests in the same change (NFR1). Run the quality gates locally (`pnpm lint`, `pnpm fmt:check`, `pnpm type-check`, `pnpm test`).

2. After implementation is complete, use **AskUserQuestion** to ask:
   > "Implementation complete. Ready to create a PR?"
   - Options: "Proceed to PR", "Let me test first (pause)", "Cancel"
   - If "Let me test first", stop and tell the user to run `/fix-issue finalize <issue_number>` or manually run `/create-pr`.
   - If cancelled, stop.

## Phase 4: Create PR that closes the issue

1. Analyze all current changes (staged, unstaged, and untracked).
2. Generate a short kebab-case branch slug from the change.
3. Create and checkout a new branch named `<type>/<issue_number>-<branch-slug>` where `<type>` is the conventional-commit type (e.g. `fix/42-currency-rounding`).
4. Stage ALL changes (modified, deleted, and untracked files).
5. Generate a conventional commit message referencing the issue: include `(#<issue_number>)` in the commit message.
6. Commit with the generated message.
7. Push the branch to origin with `-u` flag.
8. Create a PR using `gh pr create` with:
   - Title: the commit message
   - Body format:

```
Closes #<issue_number>

## Summary
<bullet points summarizing the changes>

## Test plan
<checklist of testing steps>
```

9. Return the PR URL.

**Output on completion**

```
## Pipeline Complete

**Issue:** #<number> — <title>
**PR:** <pr-url>

The PR references and will auto-close issue #<number> on merge.
```

**Guardrails**

- Always gate each phase with user confirmation before proceeding
- If any phase fails, stop and report the error — do not skip phases
- The user can interrupt at any confirmation gate to review, test, or adjust
- Pass context between phases naturally (issue details, branch name, etc.)
- Do not proceed past a "Cancel" or "pause" response
