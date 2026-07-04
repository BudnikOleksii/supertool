---
name: story-cycle
description: 'Autonomously advance the BMad story delivery pipeline: create the next story, implement it, code-review it, open a PR, wait out CI + CodeRabbit, fix review comments, merge, and roll to the next story. Use when the user says "run the story cycle", "continue the pipeline", "do the next story", or wants unattended story delivery — especially as the body of a /loop. Each invocation detects the current state from sprint-status.yaml + git + open PRs, advances as far as it safely can, and ends with a NEXT directive telling the loop driver whether to continue, wait, or stop.'
---

# Story Cycle

Unattended story delivery. Each invocation: detect where the pipeline is → advance through as many states as safely possible → report → emit a `NEXT` directive so a `/loop` driver knows whether to continue, sleep, or end the loop.

ARGUMENTS (all optional):

- `--auto-merge` — merge PRs that pass every gate without stopping. Default: stop and notify when a PR is ready to merge, so a human clicks the button.
- `--stop-after <story>` (e.g. `--stop-after 5-6`) — end the loop after that story merges. Default: run until the sprint backlog is empty.
- `--story <epic-story>` (e.g. `--story 5-2`) — operate on a specific story instead of the next one in sprint order.

## Ground rules

- **Zero interaction.** Never ask the user anything — an unanswered question hangs an unattended run. When a BMad workflow would normally elicit input, pick the option most consistent with existing repo patterns (`example/track-my-life` reference, analogous features, architecture.md) and record the decision plus rationale in the story file's Dev Notes.
- **Fresh context per phase.** Run each heavy phase (create-story, dev-story, code-review, retrospective) in a synchronous subagent (`Agent` tool, `subagent_type: general-purpose`, `run_in_background: false`). This mirrors BMad's fresh-context-window recommendation and keeps the orchestrating session lean across many stories. Prefix every phase prompt with the Autonomy Preamble below.
- **Permission denial = stop, not workaround.** If a tool call is denied, do not reach for a riskier alternative. Record what was denied in the story file, report it, emit `NEXT: stop`.
- **Never** merge with failing checks, force-push, commit to `main`, or edit `.claude/settings*.json`.
- **State disagrees with reality → stop.** If sprint-status.yaml says a story is done but its PR is open (or similar contradictions), report the discrepancy instead of "fixing" it.

## Autonomy Preamble (prepend to every phase subagent prompt)

> Run fully autonomously. Never pause to ask the user anything and never wait for approval — choose the option most consistent with existing repo patterns and record every such decision with rationale in the story file's Dev Notes. Follow CLAUDE.md hard rules exactly. If you hit a blocker you cannot resolve (permission denial, missing artifact, contradictory spec), stop and return a clear FAILURE report — do not guess through blockers. Your final message must summarize: what you did, gate results, decisions made, and PASS/FAIL.

## State detection

Gather, in order:

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — story/epic statuses.
2. `git branch --show-current` and `git status --short`.
3. `gh pr list --state open --json number,headRefName,title,createdAt` — an in-flight story has a branch `TOOLS-<story>/*`.
4. If a PR exists: `gh pr checks <n>` and `gh pr view <n> --json reviews,latestReviews,updatedAt`, plus unresolved CodeRabbit review threads:
   `gh api repos/{owner}/{repo}/pulls/{n}/comments` cross-checked against replies already posted.

Then enter the **first matching state**. After a state's action completes, re-detect and keep going — stop only at WAIT, a merge gate, a FAILURE, or DONE. A full create → dev → review → PR chain in one invocation is normal.

| # | Condition | State |
|---|-----------|-------|
| 1 | Open story PR; CI pending, or CodeRabbit has not yet posted its review of the latest push | WAIT |
| 2 | Open story PR; CodeRabbit posted actionable comments not yet addressed | FIX-COMMENTS |
| 3 | Open story PR; all checks green; zero unaddressed actionable comments | MERGE |
| 4 | Story status `review`, no open PR | REVIEW-AND-PR |
| 5 | Story status `ready-for-dev` or `in-progress` | DEV |
| 6 | All in-flight stories done; next story still `backlog` | CREATE-STORY |
| 7 | Every story in the current epic done, epic not marked `done` | CLOSE-EPIC |
| 8 | Backlog empty, or `--stop-after` story merged | DONE |

## States

### CREATE-STORY

Spawn a phase subagent: invoke the `bmad-create-story` Skill (create action) for the target story, then its validate action on the produced file. Confirm sprint-status.yaml shows the story `ready-for-dev` (update it if the workflow didn't). Continue to DEV.

### DEV

Spawn a phase subagent: invoke the `bmad-dev-story` Skill on the story file. Beyond the preamble, the prompt must require:

- Branch `TOOLS-<story>/<brief-kebab-description>` before the first commit; never commit to `main`.
- Verify gates with `--force` where turbo is involved — the turbo cache replays stale logs and masks real results.
- Every user-facing string lands in `en.json` **and** `uk.json` in the same commit (CI parity gate).
- **UI stories require visual QA before claiming completion**: dev stack running, sign in at `http://localhost:3000` (auth trusted origins are pinned to :3000) with the seeded operator credentials from `.env.example`, then `playwright-cli` screenshots of the affected screens in **both themes, including open/interactive states** (menus, dialogs, pickers), compared against `example/track-my-life` where a reference screen exists. First confirm the process serving :3000 has its cwd in **this** checkout — a stale `next-server` from another worktree serves old code and invalidates the QA.
- End with story status `review` in both the story file and sprint-status.yaml.

If the subagent reports FAILURE, retry once with the failure report included in the new prompt. Two failures → emit `NEXT: stop` with the report.

### REVIEW-AND-PR

Spawn a phase subagent: invoke the `bmad-code-review` Skill for the story. If it produces must-fix findings, spawn a fix subagent (dev-story context, findings attached), then re-review. Cap at 3 review⇄fix rounds; still failing → `NEXT: stop` with the open findings.

Once the review passes: invoke the `create-pr` Skill (in the orchestrating session — it is short) and record the PR URL in the story file's Dev Agent Record. Continue to WAIT.

### WAIT

CodeRabbit and CI both react to the latest push; there is nothing productive to do locally.

- Report what is pending (checks, CodeRabbit review) and emit `NEXT: wait 270`.
- If the head commit is **older than 30 minutes** and CodeRabbit has still not reviewed it (or a check is stuck `pending`), something is wrong — emit `NEXT: stop` and name the stuck gate.

### FIX-COMMENTS

Follow the `review-comments` Skill's steps **but skip its approval pause** (step 4) — running under story-cycle is the pre-approval; apply its fix-vs-reply decision criteria as written. Additional guard from project history: verify framework-convention suggestions against the framework docs before applying — CodeRabbit has been confidently wrong about Next.js/Nest conventions here before. Re-run gates, commit `fix: address PR review — <summary>`, push. Return to WAIT (CodeRabbit re-reviews the new push).

### MERGE

Gate: every check green **and** zero unaddressed actionable comments.

- Without `--auto-merge`: report the PR URL and a one-paragraph summary of what shipped, emit `NEXT: stop — ready to merge`. The human merges and restarts the loop.
- With `--auto-merge`: `gh pr merge <n> --squash --delete-branch` (repo history is squash merges), then `git checkout main && git pull`, mark the story `done` in sprint-status.yaml, and continue to the next state.

### CLOSE-EPIC

Mark the epic `done` in sprint-status.yaml. Spawn a phase subagent: invoke the `bmad-retrospective` Skill for the epic with the preamble — it should derive lessons from the story files, PRs, and git history, write the retro document, and mark the retrospective `done` without eliciting discussion. Continue to CREATE-STORY for the next epic's first story.

### DONE

Summarize everything shipped this loop (stories, PRs, retro docs). Emit `NEXT: stop — backlog complete` (or `— stop-after reached`).

## Report format

End **every** invocation with exactly this block so the loop driver can parse it:

```
STORY: <id or none> | STATE: <last state entered> | DID: <one-line summary>
NEXT: continue | wait <seconds> | stop — <reason>
```

Loop driver contract: on `wait N`, schedule a wake-up of ~N seconds and re-invoke `/story-cycle` with the same arguments; on `stop`, end the loop and surface the reason to the user (this is the only time the user should need to look).

## Safety rails (recap)

- Max 2 dev attempts and 3 review⇄fix rounds per story, then stop with a report — burning tokens on a stuck story helps nobody.
- Merge only via `gh pr merge --squash`; `main` moves only by PR merge.
- Never touch `.claude/settings*.json`, `.env*`, or anything under `example/`.
- A `NEXT: stop` must always name its reason and leave the working tree committed (or cleanly stashed) so a human can pick up mid-story.
