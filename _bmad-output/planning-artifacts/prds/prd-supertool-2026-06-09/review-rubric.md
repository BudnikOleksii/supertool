# PRD Quality Review — supertool — Money Tracker v1

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-supertool-2026-06-09/prd.md` (+ `addendum.md`)
- **Rubric:** `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Calibration:** internal tool + methodology pitch, Fast-path PRD, sole operator. The development process as a first-class requirement is deliberate per the brief's dual-purpose framing — it is treated as in-scope substance, not scope creep.

## Overall verdict

This PRD is decision-ready and unusually honest for its size: decisions are stated as decisions (per-currency-only dashboard, trimmed core over example parity, real seed in a private repo), the one genuinely blocking unknown (better-auth × NestJS) is surfaced as blocking and assigned to the right phase, and the dual product/process thesis carries through from goals to counter-metrics to the ED section. What's at risk is verification, not intent: the platform-extensibility claim (FR4) has no concrete acceptance beyond an admitted "design-level check," and the eight inline assumptions are never indexed — both matter because this PRD is chain-top, feeding architecture and epics directly. Nothing here blocks proceeding to architecture.

## Decision-readiness — strong

Trade-offs are named with what was given up, not just what was chosen. The addendum's "Rationale captured during discovery" section does real work: trimmed core *over example parity* with the reason (commit narrative), real seed *over synthetic data* with the mitigation (NFR4, private repo), UX inheritance with the consequence (bmad-ux likely skippable). The Risks section's lead item — "better-auth × NestJS boundary (open — architecture phase) … blocks auth stories" — is an actually-open question with a named owner phase, not a rhetorical one. Counter-metrics ("Velocity must not hollow out review," "Test count is not the metric") preempt the two obvious ways the pitch thesis could be gamed. A reviewer pushing back on "why commit real financial data?" finds the objection acknowledged in the addendum rather than dodged.

One soft spot: FR6 ends "[ASSUMPTION] Note field added even though the seed lacks it — Money Manager habit; confirm." — a literal pending confirmation embedded in an FR. With a sole operator one message away, this should have been resolved or moved to Open Questions. (Filed as low under Scope honesty.)

### Findings
(none beyond the cross-filed FR6 item)

## Substance over theater — strong

No furniture. Two users, no persona theater — the primary user description ("expects the example app's UX patterns (which already satisfy him) with no redesign") directly drives NFR7 and the decision to skip a UX phase. NFRs carry product-specific thresholds rather than boilerplate: NFR5 anchors performance to the daily-entry flow with concrete proxies ("form reachable in one interaction," "submit-to-visible-in-list without full page reload"); NFR6 makes hand-written fetch calls "a defect"; NFR4 is a specific privacy posture (private repo, real seed, no telemetry), not "system must be secure." Success metrics are concrete (≥5 transactions/week; 100% of `main` commits story-mapped; CI checks enumerated). The Overview could not swap into another PRD — it names the seed record count, the pitch audience, and the monorepo shape.

### Findings
(none)

## Strategic coherence — strong

The PRD has a stated, load-bearing thesis: two products at once — tracker and process — declared in the Overview ("Requirements that exist purely to make the pitch credible … are first-class here, not process trivia"). Scope follows the thesis rather than convenience: the Out-of-scope section explicitly reframes deferrals as "candidate future epic[s], intentionally extending the feature-by-feature commit narrative" — deferral *as pitch strategy*, which is coherent, not rationalized. Success metrics map one-to-one onto the three goals (product/process/platform), and counter-metrics exist. The potential tension between the two theses (speed vs. clean trail) is resolved in the addendum: "No hard deadline — epic sizing should favor a clean trail over speed."

### Findings
(none)

## Done-ness clarity — adequate

Most FRs carry a testable consequence. FR17 is exemplary: record count, field shape, exactness guarantees, idempotency, and re-run behavior all named. FR18 names the assertion mechanism (tests on stats math and import totals). FR12 specifies the failure mode it forbids ("no orphaned or silently uncategorized data"). FR20 is a binary CI condition.

The gaps cluster around the platform half. FR4 ("a second tool app can be added by registering it — no rework") has no v1-verifiable acceptance; the Success metrics section admits this ("[ASSUMPTION] Verified by a design-level check at architecture time"), but the check itself has no criteria — "design-level check" is currently an adjective, not a bound. Smaller: the dashboard's "selected period" (FR13) never states its granularity — the usage flow implies a month stepper ("steps back a month"), while FR8 gives the *list* an explicit date-range contract; the dashboard deserves the same one-line precision. FR16's trend is presentation-underspecified, but NFR7's "follow the example app's UX patterns" plausibly carries that — low only.

### Findings
- **medium** Platform extensibility has no concrete acceptance (§ Success metrics / FR4) — "adding a second app requires no changes … beyond registering" is the load-bearing platform claim, and its only verification is an unspecified "design-level check at architecture time." An engineer cannot know what "done" means for FR4, and the architecture phase inherits an unscoped obligation. *Fix:* name the check's deliverable — e.g., the architecture doc must include a "register tool #2" walkthrough showing zero diffs to auth, shell internals, and shared packages, and that walkthrough is FR4's acceptance.
- **low** Dashboard period granularity implied, not stated (§ FR13) — FR8 gives the transaction list an explicit "date range, defaulting to current month, with previous/next month navigation" contract; FR13 says only "selected period (default: current month)." *Fix:* one clause stating whether the dashboard period is month-stepped only (as the usage flow implies) or an arbitrary range.
- **low** FR16 trend shape underspecified (§ FR16) — "month-over-month trend (income/expense) across a trailing window" doesn't say what is rendered or computed beyond the [ASSUMPTION] 12-month window; NFR7's example-app inheritance probably covers it, but the dependency is implicit. *Fix:* add "per the example app's trend chart" or equivalent pointer.

## Scope honesty — strong

The Out-of-scope section is itemized and complete (cross-checked against the brief's deferral table — every brief deferral appears, plus sharing/multi-tenant and tool #2). Eight inline `[ASSUMPTION]` tags sit on genuine inferences (no password recovery acceptable for a known operator; sign-up simply unrestricted; trailing-12-month window), and the risks section names failure modes with guardrails ("Scope gravity … ED1 is the guardrail"). Open-items density is right for the stakes: one blocking open question, three named risks, assumptions tagged — appropriate for a fast-path internal-tool PRD heading into architecture.

Two hygiene gaps, neither dishonest: the assumptions are tagged inline but never indexed, and FR6 carries an unresolved "confirm."

### Findings
- **medium** No Assumptions Index (§ document tail) — eight inline `[ASSUMPTION]` tags (Success metrics–platform, Users–secondary, FR1, FR5, FR6, FR12, FR15, FR16) have no roundtrip index. This PRD is chain-top; architecture and epics will source-extract from it, and untracked assumptions are the ones that silently harden into decisions. *Fix:* add an Assumptions Index section listing each tag with location and status (confirmed / pending / deferred-to-architecture).
- **low** Dangling confirmation inside an FR (§ FR6) — "Money Manager habit; confirm." is a pending micro-decision living inside a requirement rather than in Risks & open questions. *Fix:* confirm with the operator (one message) or move to Open Questions; the addendum already settles the import side ("imported transactions get empty notes").

## Downstream usability — adequate

This is a chain-top PRD (feeds architecture → epics → stories), so the dimension applies in full. IDs are clean: FR1–FR20 contiguous and unique, NFR1–NFR7, ED1–ED3; every cross-reference checked resolves (FR6→NFR5, FR14→FR5 default currency, FR15→FR10 hierarchy, addendum headings cite FR13–FR16/FR17 correctly, risk §1 cites FR2). Sections extract cleanly — the addendum is explicitly written as "architecture input" and says so per section.

Two extraction frictions. First, no Glossary, and the domain vocabulary mostly survives without one — but "tool app" / "app" / "platform apps" drift across Overview, FR3–FR4, and the addendum, and "shell" (a package, per the addendum) vs. shell-as-experience (FR3) is the kind of ambiguity a glossary line would close. Second, the PRD deliberately delegates canonical detail to the *brief's* addendum ("remains the canonical reference for example-repo inventories, deferred-feature detail, .coderabbit/AI-setup merge notes, and better-auth design input — not duplicated here") and the locked stack (Drizzle, next-intl, @hey-api/openapi-ts, Next.js 16/React 19) appears only in the brief. The pointer is explicit and the path is given, so this is a documented dependency rather than a hole — but downstream extracts must reach two documents back, and the stack is load-bearing for architecture.

### Findings
- **low** Locked stack lives only in the brief (§ Overview / brief §Stack) — the PRD names Next.js + NestJS + pnpm/Turborepo but not Drizzle, next-intl, better-auth-as-stack-item, or @hey-api/openapi-ts (NFR6 says "generated client" without naming the tool). Architecture will find them via the Source inputs pointer, but a one-line "Stack (locked, per brief)" list in the PRD would make it self-sufficient. *Fix:* add the locked-stack line or fold it into NFR6/Overview.
- **low** No Glossary; minor term drift (§ throughout) — "tool app" vs. "app" vs. "platform apps"; "shell" as package vs. experience. *Fix:* a five-line Glossary (tool app, shell, platform, session, seed) would close it.

## Shape fit — strong

Right shape, deliberately chosen. Capability-spec form for a single-operator internal tool: no UJ apparatus, replaced by two "Primary usage flows" that earn their place (the daily-entry flow sets the performance budget; the monthly-review flow defines the dashboard's done-state). Success metrics are operational, as the rubric expects for this shape. The unusual move — an "Engineering & delivery requirements" section as product requirements — is the correct rendering of the agreed dual-purpose stakes, and the PRD says so in one line ("the development process is half the product"). Not over-formalized anywhere; the addendum split (PRD = requirements, addendum = mechanics and rationale) keeps the main document fast-path-sized.

### Findings
(none)

## Mechanical notes

- **No Assumptions Index** — 8 inline `[ASSUMPTION]` tags, zero indexed (filed as medium under Scope honesty).
- **ID continuity clean** — FR1–FR20, NFR1–NFR7, ED1–ED3; no gaps, no duplicates; all checked cross-references resolve.
- **No Glossary section**; minor drift: "tool app"/"app"/"platform apps", "shell" package vs. experience.
- **No `[NOTE FOR PM]` callouts anywhere** — acceptable at these stakes; the Risks section carries the deferred decisions instead.
- **Cross-document dependency is explicit**: PRD addendum names the brief addendum as canonical for four detail areas with a path; not broken, but downstream extracts span two artifact directories.
- **Frontmatter**: status `draft` while the brief is `final` — expected at this stage; flip on finalize.

---

**Dimension verdicts:** Decision-readiness — strong · Substance over theater — strong · Strategic coherence — strong · Done-ness clarity — adequate · Scope honesty — strong · Downstream usability — adequate · Shape fit — strong

**Finding counts:** critical 0 · high 0 · medium 2 · low 5
