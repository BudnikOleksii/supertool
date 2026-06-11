---
name: create-pr
description: 'Push the current story/feature branch and open a PR against main (creates the branch first if still on main). Use when the user says "create a PR", "open a pull request", or after a code review passes.'
---

# Create PR

Push the current work as a pull request against `main`, following the supertool branching convention.

ARGUMENTS: optional story/ticket number (e.g. `1-2` or `TOOLS-1-2`). If omitted, derive it from the story file in `_bmad-output/implementation-artifacts/` that is in `review` status, or from the current branch name; ask only if it cannot be derived.

## Steps

1. Run `git branch --show-current` and `git status --short` to understand the starting state.
2. **If already on a `TOOLS-*` branch** (the normal case — dev-story creates it): skip to step 4.
3. **If on `main`**: analyze all current changes (staged, unstaged, untracked), generate a brief kebab-case slug describing what was done, then create and checkout `TOOLS-<story number>/<slug>` (e.g. `TOOLS-1-2/api-foundation-health-check`). Never commit to `main`.
4. If uncommitted changes exist, stage ALL of them and commit with a generated conventional-commit message (commitlint-enforced). If everything is already committed, do not create an empty commit.
5. Push the branch to origin with `-u`.
6. Create the pull request against `main` using `gh` CLI:
   - Title: the head commit's subject line
   - Body: use the format below
   - Labels: only from the repository's existing label set (`gh label list`) — do not invent new labels
   - Assignee: the current user

```
## Summary
<bullet points summarizing the changes>

## Test plan
<checklist of testing steps — quality gates run, specs added, manual proofs>
```

7. Return the PR URL.

## Constraints

- Branch names always follow `TOOLS-<story number>/<brief description>`.
- Every commit must trace to a planned story (ED2) and be conventional-commit formatted.
- Do not merge the PR — merging happens after CodeRabbit review and CI pass (NFR2).
