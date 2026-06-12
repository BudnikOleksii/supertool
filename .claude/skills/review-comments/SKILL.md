---
name: review-comments
description: Review PR comments, fix valid ones, reply to non-actionable ones, commit and push. Use when user wants to address PR review feedback.
license: MIT
metadata:
  author: supertool
  version: '1.0'
---

Review PR comments — fix valid issues, reply to non-actionable ones, commit and push.

**Input**: A PR URL (e.g. `https://github.com/owner/repo/pull/123`) or PR number. If omitted, infer from the current branch or ask.

**Steps**

1. **Fetch PR comments**

   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | "ID: \(.id)\nFILE: \(.path):\(.line // .original_line)\nBODY: \(.body)\n---"'
   ```

   Parse each comment to extract: ID, file path, line number, and body text.

2. **Analyze each comment against codebase patterns**

   For each comment:
   - Read the referenced file and the surrounding code
   - Check if the same pattern exists elsewhere in the codebase (e.g., in analogous features like transactions vs recurring-transactions)
   - Determine if the comment is:
     - **Valid fix**: The suggestion improves code quality, fixes a real bug, or follows project guidelines
     - **Not applicable**: The comment suggests changing a pattern that is consistent with the rest of the codebase — changing it only here would create inconsistency

3. **Apply fixes for valid comments**

   For each valid comment:
   - Make the code change
   - Run `pnpm type-check`, `pnpm lint`, `pnpm stylelint` to verify
   - If checks fail, fix until they pass

4. **Present summary table and ask for approval**

   Display a markdown table of all planned actions and **stop**:

   ```
   | # | File | Comment | Planned action |
   |---|------|---------|----------------|
   | 1 | path/to/file.ts:42 | Brief description | **Fix.** What will be changed |
   | 2 | path/to/other.ts:15 | Brief description | **Reply.** Why it follows existing pattern |
   ```

   Ask: "Approve these changes? (yes / adjust before proceeding)"

   Do not apply any fixes, reply to any comments, or commit anything until the user approves.

5. **Apply fixes** (after approval)

   For each valid comment:
   - Make the code change
   - Run `pnpm type-check`, `pnpm lint`, `pnpm stylelint` to verify
   - If checks fail, fix until they pass

6. **Reply to all comments on GitHub**

   For each comment, reply via:

   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies -f body="<response>"
   ```

   - **Fixed comments**: Briefly describe what was changed
   - **Not applicable comments**: Explain which existing code uses the same pattern and why changing only this instance would create inconsistency

7. **Commit and push**

   If any fixes were made:
   - Stage all changed files
   - Commit with message: `fix: address PR review — <brief summary of changes>`
   - Push to the current branch

8. **Return final summary table**

   Display a markdown table:

   ```
   | # | File | Comment | Action |
   |---|------|---------|--------|
   | 1 | path/to/file.ts:42 | Brief description | **Fixed.** What was changed |
   | 2 | path/to/other.ts:15 | Brief description | **Replied.** Why it follows existing pattern |
   ```

**Decision criteria for fix vs reply**

- Fix if: the comment identifies a real bug, an HTML validity issue, a project guideline violation (check `.claude/rules/`), or a timezone/locale issue
- Reply if: the comment suggests a pattern change that would be inconsistent with analogous features already in the codebase — cite the specific file and line that uses the same pattern
- Fix if: the same issue exists in both this PR and existing code, but only fix the PR files (mention the existing code could be updated app-wide separately)

**Guardrails**

- Always read the referenced file before deciding fix vs reply
- Always check analogous features for pattern consistency before replying "not applicable"
- Never apply a fix that breaks type-check, lint, or stylelint
- Keep replies concise — one sentence for fixes, two sentences max for pattern explanations
- Commit message should use conventional commits format
