---
description: Review a pull request
---

target_pr = $ARGUMENTS

If target_pr is not provided, use the PR of the current branch.

## Step 1: Get PR context

Use `gh pr view {target_pr} --json number,title,body,baseRefName,headRefName` to understand the PR.
Use `gh pr diff {target_pr}` to get the full diff.

## Step 2: Review against project conventions

Check every changed file against these rules:

**Exports:** Named exports only, never default

**React** (if touching .tsx/.jsx):

- RSC by default, "use client" only for hooks/browser APIs
- FC generic for props typing
- Callback props: `on` prefix, handlers: `handle` prefix
- Typography component from packages/ui for text

**Naming:**

- Array variables with `list` suffix
- Constants in UPPER_SNAKE_CASE
- Function prefixes: get/fetch/check/format/convert/prepare

**Styles** (if touching .scss/.css):

- SCSS modules with camelCase class names
- Mobile-first, double class for packages/ui overrides

**Privacy** (NFR4):

- No analytics or external telemetry of any kind — flag any tracking code or external calls as a defect

**General:**

- No comments (self-documenting code)
- Exact package versions (no ^ or ~)
- i18n: next-intl for user-facing text

## Step 3: Leave review on GitHub

Batch all findings into a single review using:

```
gh api repos/{owner}/{repo}/pulls/{pull_number}/reviews \
  --method POST --input payload.json
```

where `payload.json` contains `commit_id`, `event`, and the `comments` array (a JSON array cannot be passed with `-f`, which sends it as a string).

Use `position` (not `line`) for inline comments — it refers to the line's position in the unified diff.
Set `event` to `"COMMENT"` for observations, `"REQUEST_CHANGES"` for blockers, or `"APPROVE"` to approve.

Each comment body should include:

- What's wrong
- Why it matters
- Suggested fix

## Step 4: Summarize

Provide a summary in the conversation:

- Total findings by severity (blocker / warning / suggestion)
- Overall verdict: approve or request changes
