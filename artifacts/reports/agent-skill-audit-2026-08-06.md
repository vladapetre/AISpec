# Analysis: Agent and Skill System Audit (2026-08-06)

**Date:** 2026-08-06
**Audience:** developer (system maintainer — the user is iterating on this harness)
**Prior audit:** `artifacts/reports/agent-skill-audit-2026-05-26.md` (scored 76.4%)
**Sources:**
- `.claude/agents/` — `analyst.md`, `architect.md`, `consultant.md`, `developer.md`, `reviewer.md`
- `.claude/agents/assets/instructions/` — `architect/{design,amendment}.md`, `consultant/{discussion,artifact}.md`, `developer/{implement,rejection}.md`, `reviewer/{perphase,crosscheck}.md`, `lead/orchestration.md`
- `.claude/agents/assets/` — `tokens.yaml`, `tokens.routing.yaml`, `tokens.verdicts.yaml`, `tokens.markers.yaml`, `preflight.yaml`, `selfcheck.yaml`, `scoring.yaml`, `detectors.yaml`, `mast.yaml`
- `.claude/skills/` — `documenting/`, `reviewing/`, `understanding/`, `ticketing/`, `branching/`, `summarizing/` (SKILL.md + all templates and examples)
- `.claude/hooks/` — `guard.{write,bash,verdict}.mjs`, `lint.write.mjs`, `inject.{orchestration,project-memory}.mjs`, `observe.bash.mjs`, `lib/{ownership,turn-block,drive-evidence,project-root}.mjs`, `README.md`
- `.claude/settings.json`, `.claude/settings.local.json`, `.claude/telemetry/{ledger.jsonl,report.mjs}`, `.claude/state/drive-log.jsonl`
- `CLAUDE.md`, `scripts/lint-agents.mjs`, `package.json`, `.gitignore`, `~/.claude/skills/`

---

## Executive Summary

The harness has changed shape substantially since May. It is no longer "five agent files and three skills" — it is a **four-layer system**: an always-on contract file (`CLAUDE.md`), five agent shells that dispatch into nine mode files, nine on-demand YAML assets, six skills, and — new since the last audit — **a seven-hook enforcement layer** that converts prompt discipline into machine checks.

Every P0 and P1 from the 2026-05-26 audit has been actioned, and the two structural token complaints (mode multiplexing, duplicated `<operating_constraints>` boilerplate) are genuinely fixed. Determinism is now the system's strongest property by a wide margin: mode dispatch is regex-anchored, phase state comes from `plan-status.mjs` rather than eyeballed stamps, filenames come from `filename.mjs`, the ownership registry has exactly one copy (`lib/ownership.mjs`) shared by the write-time guard and the bulk sweep, and verdict tokens are enforced byte-for-byte at `SubagentStop`.

The remaining weakness has **moved**, and it is worth naming precisely. It is no longer bulk. It is **drift between the contract's copies** — and the copies now include executable ones. Four of this audit's findings are cases where prose in one file, prose in a second file, and code in a third disagree about the same rule; two are cases where a machine gate is weaker than the prose it was built to enforce. The single most consequential is R-014: `guard.verdict`'s drive check — the system's newest and most-advertised gate — classifies `npm test` as a drive, so the exact claim step 7a exists to reject ("a green suite is verification") is the one the machine waves through.

### Overall scores (weighted)

| Axis | Score | Weight | Weighted | vs. 2026-05-26 |
|---|---|---|---|---|
| Efficiency | 85% | 25% | 21.3 | +7 |
| Token cost | 78% | 30% | 23.4 | +14 |
| Determinism | 89% | 25% | 22.3 | +3 |
| Consistency | 74% | 20% | 14.8 | −7 |
| **Overall** | | | **81.8%** | **+5.4** |

Consistency *fell* while everything else rose. That is the honest reading of a system that grew a third layer: more places to state a rule means more places for two statements of it to diverge.

### Top 3 fixes (full P0/P1 list in §8)

1. **P0 — R-014.** `lib/drive-evidence.mjs` treats any non-inspection command as a drive, and the developer runs the test suite every phase by mandate. So `drivesForCurrentPhase()` is never empty, and `guard.verdict`'s drive-claim check cannot fire in practice. Empirically confirmed: `.claude/state/drive-log.jsonl:1` records `cd … && mkdir -p … && git init` as `"drive":true`. Add a *negative* class (the resolved test/lint command, per-`detectors.yaml`) so "ran the suite" stops counting as "drove the flow".
2. **P0 — R-016.** `reviewing/SKILL.md:78` still defers to `CLAUDE.md **Security paths:**` — the exact dangling pointer the last audit raised as its own P0. It was fixed in `architect.md`, `reviewer.md`, and CLAUDE.md (which now carries a `## Security paths` **section**), and missed here. The security carve-out in the diff-size gate is therefore still reading a pointer that resolves to nothing.
3. **P0 — R-017.** `analyst.md:33` sets an "8 lines" inline memory cap. CLAUDE.md `## Agent memory layout` sets ≤2 lines / ≤50 words, and `lint.write.mjs:28` enforces 2/50 with `exit 2`. An analyst obeying its own agent file writes an entry the hook bounces — the agent file instructs the agent into a blocked call.

---

## Background and Context

AISpec is a multi-agent orchestration harness for Claude Code, developed in this repository and deployed into consuming projects by copying `.claude/`. Five named teammates (analyst, consultant, architect, developer, reviewer) route star-topology through a team lead that has no agent file of its own — its contract is injected at `SessionStart` by `inject.orchestration.mjs`.

Three structural changes dominate the delta since May:

- **Mode files.** Multi-mode agents were split: the shell (`agents/<name>.md`) carries identity, constraints, and a deterministic step-2 dispatch; the mode file (`assets/instructions/<agent>/<mode>.md`) carries steps, output format, and per-mode token contract. Exactly one mode file loads per invocation. This was the prior audit's #1 token finding and it is resolved.
- **The hook layer.** Seven hooks plus four libraries now enforce what were prompt rules: artifact-directory ownership, memory file kinds and caps, plan anchor integrity, verdict-token exactness, and drive evidence. Critically, `guard.verdict` and `emit.metrics` are wired to **`SubagentStop`** as well as `Stop` — `hooks/README.md:46` records that a `Stop`-only wiring saw *1 gate event in 633 ledger lines*, because teammate blocks live in a `SendMessage` payload inside the subagent's transcript.
- **Extracted assets.** `preflight.yaml`, `selfcheck.yaml`, `scoring.yaml`, `detectors.yaml`, and the three-way `tokens.*` split moved per-agent restatements into on-demand registries. CLAUDE.md gained an explicit **admission test** governing what may live in the always-on file.

Two operational facts frame the evidence available for this audit. `artifacts/` contains only `reports/` — no ADR, plan, or strategy artifact has been produced here. And `.claude/telemetry/report.mjs` over 45 ledger lines / 4 sessions / 1.5M output tokens reports **0 cross-checks, 0 reviews, 0 amendments, 0 teammate turns**. The harness is authored here and exercised elsewhere; nothing in this repo is a live run of its own pipeline.

## Structure and Organisation

Four layers, in load order:

- **Always-on** — `CLAUDE.md` (208 lines) in every session and every teammate spawn; `instructions/lead/orchestration.md` (61 lines) injected into the main session only; `.claude/MEMORY.md` injected by `inject.project-memory.mjs` (absent in this repo).
- **Per-spawn** — the agent shell (81–126 lines) plus every skill in its `skills:` frontmatter, **body included** (162–168 lines each).
- **Per-invocation** — exactly one mode file (37–154 lines), loaded at step 2.
- **On demand** — nine assets, ~30 templates and examples, read at the step that needs them.

Enforcement runs alongside as a fifth, non-prompt layer: `PreToolUse` guards on `Write|Edit` and `Bash`, a `PostToolUse` lint and observer, and two `Stop`/`SubagentStop` hooks.

Routing is unchanged in kind: agents emit bracketed in-artifact flags and colon-suffixed summary lines; the team lead greps and dispatches; `guard.verdict` now verifies the closing line is exact.

## Key Concepts

### Mode dispatch as a deterministic regex
Each multi-mode shell's step 2 is a first-match-wins match on the request's *own* lines. The reviewer's is the strictest (`reviewer.md:56`): unquoted top-level lines only, skipping fenced blocks and `> ` prefixes, marker at start-of-line. The consultant's is the most linguistic (`consultant.md:60-63`): a write **verb** and an artifact **noun** must co-occur on one line, or the request stays in Discussion.

### Supersession with a revision budget
Amendments never edit in place. `-r1`/`-r2` are delta ADRs; the third amendment **consolidates** into a fresh top-level ADR folding the chain (`amendment.md` M2b/M3b), preserving `D-###` numbers. The rule is empirically motivated — CLAUDE.md records a chain that reached **r10**.

### Hold-and-batch for spec volatility
Two distinct volatility sources with different handling: externally renegotiated spec → `**Spec: ON HOLD**` stamp, phases blocked; user structural rulings → a lead-held queue flushed as **one** amendment. Motivated by measurement: ~50% of 35 supersessions across six chains were user structural rulings arriving in same-day clusters.

### Machine-enforced exclusions and the evidence bar
`reviewing/SKILL.md` §Machine-enforced exclusions tells the reviewer not to report what the project's own gates already fail on, with three reversals (a guard's own code is in scope; warning-severity is not enforced; exclusion is per finding-class, never per diff). §Evidence bar adds E1–E5: cite from source read this pass, never infer from a name, actively try to disprove, Critical/Major need a concrete failure scenario, Minor capped at 5.

### Observed verification
`observe.bash.mjs` writes every Bash command to `.claude/state/drive-log.jsonl` with a drive/inspect classification; `guard.verdict` reads it to check the developer's `**Verification:**` claim. The agent cannot write that log. This is the harness's only claim-versus-reality check — and see R-014 for why it currently has no teeth.

---

## Findings

### Per-Agent Scorecards

#### R-001 [minor] — Analyst — Efficiency 88% / Tokens 84% / Determinism 90% / Consistency 72% [VERIFIED]

126 lines (`analyst.md`). Single mode, no mode file. Auto-loads `documenting` (168); `ticketing` and `understanding` are deferred. Per-spawn total ≈ 502 lines including CLAUDE.md.

- **Efficiency (88%).** Coverage rules at step 5 are concrete and bounded (≤30 files read-all, >30 → entry-point BFS capped at 60, lex tiebreak, mandatory `[ASSUMPTION]` record). Step 10's hand-off criteria are six mechanically-applicable tests, correctly split architectural (a–c) / strategic (d–f). The ticketing branch is a single paragraph pointing at a deferred skill rather than an inlined provider table — right call.
- **Tokens (84%).** The best-proportioned agent in the harness. Step 6's code-only / document-only question fork (flagged as removable in the prior audit) survives, but it is now four lines, not a section — not worth another edit.
- **Determinism (90%).** `R-###` in encounter order, confidence marker per finding, filename via `filename.mjs`. The one soft edge is unchanged: "encounter order at first write" assumes single-pass authoring.
- **Consistency (72%).** Two real defects. `analyst.md:33` sets an **8-line** inline memory cap that contradicts both CLAUDE.md's ≤2 lines/≤50 words and `lint.write.mjs`'s enforcement of the same (R-017). And the agent's own index at `.claude/agent-memory/analyst/MEMORY.md:3` links `report-agent-skill-audit-2026-05-26.md`, which does not exist in that directory (R-018) — the pointer discipline the layout section exists to create, broken in its only live instance.

**Top shortcomings:** (1) the 8-line cap contradicts the hook that will block it; (2) dangling per-entity pointer in its own memory index; (3) line 4 of that index uses a `../../../artifacts/…` relative path where line 3 uses a bare filename — two link conventions in a two-line file.

#### R-002 [minor] — Architect — Efficiency 90% / Tokens 86% / Determinism 91% / Consistency 88% [VERIFIED]

81-line shell + 87 (design) or 122 (amendment). Per-invocation ≈ 544–579 lines with CLAUDE.md and `documenting`. Down from 227 lines of always-loaded dual-mode text — the prior audit's largest single complaint, cleanly resolved.

- **Efficiency (90%).** The shell is four steps and carries no mode-specific content whatsoever, including in `<deliverables>`, `<completion_criteria>`, and `<output_format>` — all three delegate. Amendment mode's M1 surgical-context rule (named ADR sections only, cited hunks ±10 lines, plan only if a phase is named) is the sharpest context bound in the system, with exactly one documented exception (M3b consolidation, which must read its chain).
- **Tokens (86%).** A9b (the load-bearing-assumption gate) is 11 lines carrying two worked war stories — the `at:"last"` telematics contract that cost ten revisions, and the false "no user lookup is reachable" premise. That is expensive prose in a per-invocation file. It also reads as the most likely thing in the harness to actually change behaviour, so the cost is defensible; flagging it as the one place worth measuring before trimming.
- **Determinism (91%).** A13's self-certify carve-out is four boolean conditions, all mechanically checkable. M2/M2a/M2b are exhaustive classifications with a stated ambiguity default (`Ambiguous (both present) → REVIEWER_DRIFT`). M5a's waiver is four conditions with a named failure. The revision budget counts files on disk rather than trusting the request.
- **Consistency (88%).** Token contracts are per-mode and match `tokens.routing.yaml` exactly. The amendment file opens with the `ARCHITECT REVIEW NEEDED` vs `ARCHITECT AMENDMENT NEEDED` disambiguation the prior audit asked for. Minor drag: A5 and A6 both point at `scoring.yaml`, whose `medium_signals` say "any signal in `compliance_signals` **below**" while that block sits *above* them (R-024).

**Top shortcomings:** (1) A9b's narrative weight in a per-invocation file; (2) the "below"/above misdirection in the shared scoring asset; (3) nothing else material — this is the best-structured agent in the harness.

#### R-003 [minor] — Consultant — Efficiency 87% / Tokens 88% / Determinism 84% / Consistency 76% [VERIFIED]

91-line shell + 58 (discussion) or 63 (artifact). Per-invocation ≈ 525–530 lines. Note it auto-loads only `documenting` now — `understanding` was demoted to deferred, which is correct given Discussion mode rarely needs it in full.

- **Efficiency (87%).** Discussion mode is genuinely cheap: eight steps, no mandatory writes, an explicit ratification offer at D8. Artifact mode's A1 write-set rule ("do not auto-bundle") remains the best-designed step in the file.
- **Tokens (88%).** Largest proportional improvement in the harness — 230 always-loaded lines became ~154 per invocation.
- **Determinism (84%).** The explicit-write regex at `consultant.md:60-63` is the most literal dispatch in the system (an enumerated verb set AND an enumerated noun set, same line) with a stated fallback ("a bare verb without an artifact noun stays in Discussion"). The soft spot is the *third* branch — "purely tactical (component design, API shape, data model inside one context, library choice, perf tuning)" is a five-example list, not a test, so a request that is neither clearly strategic nor on that list resolves by judgement.
- **Consistency (76%).** The tactical-redirect step number is stated three ways: `discussion.md:53` says "the step-3 redirect", `preflight.yaml:50` says "step-3 redirect", and `consultant.md:90` says "the step-2 redirect line". Dispatch is step 2 (`consultant.md:58`). Two of three are wrong (R-019). Harmless to a careful reader, and exactly the class of rot that compounds.

**Top shortcomings:** (1) three-way step-number disagreement on the redirect; (2) the tactical branch is examples rather than a test; (3) `<modes>` framing in `<role_identity>` partially restates step-2 dispatch.

#### R-004 [major] — Developer — Efficiency 84% / Tokens 66% / Determinism 88% / Consistency 86% [VERIFIED]

103-line shell + 101 (implement) or 37 (rejection), **plus two auto-loaded skill bodies**: `documenting` (168) and `branching` (162). Per-invocation ≈ 611–675 lines — **the heaviest spawn in the harness**, and the only agent whose skills outweigh its own definition.

- **Efficiency (84%).** Step 7's log-redirect-then-digest pattern is a genuine context saving with a well-argued rule ("redirect the command yourself — never wrap it", so `guard.bash` and `observe.bash` still see the real command). Step 11's three-way branch after approval (final phase / mid-plan checkpoint / advance) is complete and ordered.
- **Tokens (66%).** The worst axis score in this audit, and it has one cause. `branching`'s own gate (`implement.md:11`) resolves as: manifest present → hold; else probe for ≥2 nested git repos under `src/`; **neither → skip silently**. This repository has no `src/` and no `.claude/branching/`. So in every single-repo project — the common case — 162 lines of worktree-manager prose are injected into every developer spawn to be skipped by a one-line gate. Marking `branching` *(deferred)* and reading it when the gate holds costs one Read on umbrella projects and saves 162 lines everywhere else (R-020).
- **Determinism (88%).** Phase resolution runs `plan-status.mjs check` rather than eyeballing stamps; stamping runs `plan-status.mjs stamp` with a single documented manual fallback. The craft-vs-structural boundary is defined by contrast plus an explicit grey-zone escape ("ask the user once; do not guess; do not default to escalation") — unusually well-specified for a judgement call.
- **Consistency (86%).** Output format matches `guard.verdict`'s expectations exactly (`Requesting approval from: USER`, populated `**Verification:**`). Rejection mode correctly reuses `implement.md`'s block rather than restating it. The `[PRE-EXISTING]` and stash-dance semantics agree with `detectors.yaml`.

**Top shortcomings:** (1) `branching` auto-loaded into every spawn for a gate that skips in single-repo projects; (2) both skills together exceed the agent's own definition by 3×; (3) the worktree-readiness section sits *before* the numbered steps while instructing "before step 5" — readable, but the only mode file whose content is not in step order.

#### R-005 [minor] — Reviewer — Efficiency 86% / Tokens 82% / Determinism 92% / Consistency 84% [VERIFIED]

83-line shell + 154 (perphase) or 60 (crosscheck), plus `reviewing` (166). Per-invocation ≈ 517–611 lines. The 242-line triple-mode file is gone.

- **Efficiency (86%).** Per-phase and cumulative share one mode file with three branch points (steps 6, 10/11, 11a) rather than two near-duplicate files — the right call, since the shared 80% would otherwise drift. Step 13a's re-review detection scopes a repeat pass to the current diff while keeping alignment, ADR-alignment, and Se1–Se3 at full scope.
- **Tokens (82%).** `perphase.md` at 154 lines is the largest mode file, and it earns it: 11a (cross-flow), 11b (removed-guard), 13b (machine-enforced set) are each load-bearing and each cite the concrete defect they were written for.
- **Determinism (92%).** Highest in the harness. Mode dispatch is the strictest regex in the system with an explicit `PAUSED` fallback rather than a guess. Phase state comes from a script. The commit-range fallback names its own cost ("a multi-commit phase under the fallback under-counts the diff-size gate"). Verdict blocking has a single stated authority (`SKILL.md` §Severity), and UNCLEAR fails *closed* with a named transport to the architect. Memory file naming is a single legal pattern with "no hand-rolled name variants" — motivated by 113 mis-named files found live.
- **Consistency (84%).** Two frictions. Both mode files re-declare pre-flight as their own first step (`perphase.md:9` "step 3", `crosscheck.md:9` "CC-1") while the shell already ran it at its step 3 — and `perphase.md` then numbers its remaining steps 4–16 as if continuing the shell's sequence, which works, while `crosscheck.md` restarts at CC-1, which also works but differently (R-021). And the skill the reviewer auto-loads still carries the dead `**Security paths:**` pointer (R-016).

**Top shortcomings:** (1) duplicated pre-flight step across shell and both mode files, with two different numbering conventions; (2) inherits the stale security pointer from its own skill; (3) `perphase.md` step 12's gate computation and `SKILL.md`'s gate table are two statements of one rule — currently in agreement.

### Per-Skill Scorecards

#### R-006 [minor] — documenting — Efficiency 86% / Tokens 74% / Determinism 94% / Consistency 90% [VERIFIED]

168-line SKILL.md, auto-loaded by **four** agents (analyst, architect, consultant, developer) — the most-loaded body in the harness. Nine templates, five examples, four scripts.

- **Determinism (94%)** is the harness high-water mark: filename derivation is delegated to `filename.mjs` with a nine-row worked table, and `.docx` export is locked to `export.mjs` with an argued prohibition on bare `pandoc` (named-style definitions that Word renders and Google Docs discards).
- **Tokens (74%).** The 30-line Export-to-Word section loads for all four agents on every spawn, and only the analyst ever exports. `templates/api.md` at **243 lines** is the largest file in the skill tree — read on demand, so the cost is bounded, but it is 2.4× the ADR template for a narrower artifact.
- **Consistency (90%).** Template registry, audience table, and per-type audience rules agree; every advertised example exists on disk.

#### R-007 [minor] — reviewing — Efficiency 88% / Tokens 84% / Determinism 90% / Consistency 68% [VERIFIED]

166-line SKILL.md + 7 templates. Carries §Machine-enforced exclusions and §Evidence bar, both new and both strong: each states the *cost of the failure it prevents* rather than only the rule ("a false Critical is far more expensive than a missed Minor: it sends the developer to fix nothing, and it teaches the reader to discount the next report").

- **Consistency (68%)** is dragged by one defect that matters: `SKILL.md:78`'s security carve-out defers to `CLAUDE.md **Security paths:**`, a form that no longer exists — CLAUDE.md now has a `## Security paths` section (R-016). Every other consumer was repointed; this one was not. The hard-coded fallback list in the same line is currently identical to the section's contents, which is exactly why the breakage is invisible: it will surface the first time a project extends `## Security paths` and the reviewer's carve-out silently ignores the addition.
- Elsewhere the skill is tight: the diff-size gate has an explicit conjunctive boundary rule, a security floor exempting Se1–Se3 from all gating, and two carve-outs. §Steps deliberately delegates procedure to the reviewer's mode files "so the standalone and agent paths cannot drift apart" — the right instinct, applied.

#### R-008 [minor] — understanding — Efficiency 90% / Tokens 92% / Determinism 86% / Consistency 94% [VERIFIED]

133 lines, deferred everywhere (consultant, analyst, architect). Correctly demoted from auto-load since the last audit. Termination is genuinely bounded — four ordered conditions including a 12-question diminishing-returns cap and a 20-question hard cap, with an explicit counting rule ("count questions you actually asked the user — not your own internal queries answered by Grep/Read"). The ≤3-sentence decision rule matches `lint.write.mjs`'s 120-word enforcement in spirit; the two express the same cap in different units, which is tolerable but not exact.

#### R-009 [minor] — ticketing — Efficiency 88% / Tokens 86% / Determinism 88% / Consistency 82% [VERIFIED]

175 lines, deferred (analyst reads it at step 1 of a ticketing task). Table-driven provider registry with three `future` rows and a stated extension procedure. The strongest line in the skill is the tool-granting note: "A skill cannot grant MCP tools — a named teammate can only call tools in its own `tools:` frontmatter, and a loaded skill can narrow that set but never widen it." That is a real harness property most skill authors get wrong, and the analyst's frontmatter does carry the eleven Atlassian tools the wiring contract names — verified.

Drag: the three `future` provider rows cost lines on every read for capability that does not exist, and the skill's ~50-line "Your task (draft/create)" persona block is prose where the templates are the actual contract.

#### R-010 [minor] — branching — Efficiency 84% / Tokens 58% / Determinism 90% / Consistency 88% [VERIFIED]

162 lines, **auto-loaded on the developer**. The skill itself is well-built — the manifest is explicitly *not* a record of branches or worktrees ("that truth is read live from git, so there is only ever one source of truth and nothing to go stale"), resume-before-create is an invariant, and the blanket-`prune` prohibition names the concurrency failure it prevents. Its Tokens score reflects placement, not quality: see R-020.

#### R-011 [major] — summarizing — Efficiency 84% / Tokens 90% / Determinism 88% / Consistency 40% [VERIFIED]

86 lines. Mechanically sound — the 4000-char limit is enforced by `wc -m` with a stated trim priority and a never-trim list, and template discovery is a six-row first-match cascade covering Azure DevOps and GitHub.

It is also an **orphan**. It appears in no agent's `skills:`, in no CLAUDE.md section (`## Asset references` lists the assets tree but no skill inventory exists anywhere), and it is the one skill the project's own linter errors on: `scripts/lint-agents.mjs` reports `description must contain literal "Use this skill when" trigger`. It carries `disable-model-invocation: true`, which is a deliberate and well-argued choice ("the PR description should be written when you decide the branch is done, not when a turn happens to look final") — but the combination of no registry entry, no agent reference, and a failing lint means nothing in the contract surface knows it exists (R-022).

### Hook Layer

#### R-012 [minor] — Hook layer, overall — Efficiency 90% / Determinism 92% / Consistency 86% [VERIFIED]

Seven hooks, four libraries, one maintainer README. The design discipline is high and unusually well-evidenced — nearly every non-obvious choice cites the live failure that produced it:

- **Root-anchoring** (`lib/project-root.mjs`): cwd-anchoring made `guard.write` compute `../../artifacts/…`, read the leading `..` as "outside the project", and **fail open for exactly the writes it exists to stop**.
- **`SubagentStop` wiring** (`lib/turn-block.mjs`): Stop-only saw 1 gate event in 633 ledger lines against 131 ADRs.
- **One ownership registry** (`lib/ownership.mjs`): shared by the write-time block and the `--all` sweep "so the two cannot disagree about what is registered".
- **Grouped `--all` output** (`lint.write.mjs:141-165`): a real sweep surfaced 113 instances of one reason; the fix reuses the reviewing skill's own E5 reasoning.
- **`guard.bash` vendoring** (`hooks/vendor/`): a bare `shell-quote` import would fail in host projects with no `node_modules` "and silently disable the guard on every command".

Every hook fails open on malformed input and none can brick a session. `guard.bash` is the deliberate cwd-relative exception, correctly justified.

#### R-013 [minor] — `guard.write` / `ownership.mjs` registry disagrees with CLAUDE.md [VERIFIED]

`lib/ownership.mjs:19` admits `context-map-*` as a registered agent-memory kind. CLAUDE.md `## Agent memory layout` lists the kinds as `plan-*`, `adr-*`, `report-*`, `review-*`, `sdr-*`, `charter-*` — no `context-map-`. The code is a superset of the prose. The file header states the intended order explicitly ("A new artifact kind gets a row in CLAUDE.md … first, then an entry here"), so the code is the one that drifted. Consequence today is nil (nothing writes that kind); the cost is that the prose registry is no longer authoritative, which is the property the header claims for it.

#### R-014 [critical] — The drive-evidence gate cannot fire [VERIFIED]

`lib/drive-evidence.mjs:42-50`: `isDriveCommand()` splits on `&&`/`||`/`;`/`|` and returns true if **any** segment fails to match the `INSPECT` list. `INSPECT` covers git queries, grep/cat/ls/sed/echo, `node --check`, filesystem shuffling, and read-only PowerShell cmdlets. It does **not** cover test or build commands — by design, per the header's stated bias ("anything that is not a recognised inspection command counts as a drive… a false 'that was not a drive' would block real work").

The consequence was not carried through. `developer.md:49` makes tests mandatory every phase; `implement.md:24` resolves the command via `detectors.yaml`. `npm test`, `dotnet test`, `pytest` — none match `INSPECT`, so all are logged `drive:true`. `drivesForCurrentPhase()` is therefore non-empty for every phase that ran its mandatory suite, and `guard.verdict.mjs:86` never appends its violation.

This inverts the gate's stated purpose. `implement.md:32` opens with "**A green suite is not verification**"; the machine built to enforce that sentence accepts a green suite as the evidence for it. Empirically: `.claude/state/drive-log.jsonl:1` records `cd … && mkdir -p v1/.claude/state && cd v1 && git init -q` as `"drive":true` — repository setup logged as runtime evidence.

The fix is small and preserves the intended bias: resolve the project's test/lint command per `detectors.yaml` and add it to a negative class, so the suite is neither a drive nor a block, while `dotnet run` / `npm start` / `docker compose up` / `curl` still count.

#### R-015 [major] — `scripts/lint-agents.mjs` is stale and unowned [VERIFIED]

Running `npm run lint:agents` produces **4 errors and 6 warnings** against a clean checkout:

- Three CLAUDE.md errors (`missing the expanded-form Result: <ASK | STOP> line`, `missing the compact-form → PROCEED token`, `missing the 5-clarifying-questions cap`) are **false positives**. Those formats were deliberately moved to `preflight.yaml`, which documents the move in its own header: "The FORMATS below live here rather than there: every agent loads this file at step 2 anyway, so a copy in the always-on file would be paid by every session and read by none." The linter enforces the pre-refactor contract.
- Six mast.yaml warnings reference `failure_modes_detail.FM-*`. `mast.yaml` has no `failure_modes_detail` key — its structure is `taxonomy:` grouped into three categories. The linter checks a schema that no longer exists.
- One error is real: the `summarizing` description trigger (R-011).

A gate that always reports failures gets ignored, and this one is not referenced from CLAUDE.md, `hooks/README.md`, or any agent — so nothing tells a maintainer whether it is authoritative or abandoned. By contrast `node .claude/hooks/lint.write.mjs --all` exits 0 clean, and *is* documented.

### Cross-Cutting Issues

#### R-016 [critical] — Stale `**Security paths:**` pointer survives in `reviewing/SKILL.md` [VERIFIED]

`reviewing/SKILL.md:78`. The prior audit's P0; fixed in `architect.md`, `reviewer.md`, and CLAUDE.md (which gained `## Security paths` with an explicit "Projects extend this list by appending paths below — the architect (Amendment mode), the reviewer (Per-phase mode), and `reviewing/SKILL.md` all read this block"). CLAUDE.md names this file as a reader; this file still points at the old anchor. Masked today because the inline fallback list matches; breaks silently the first time a project appends a path.

#### R-017 [critical] — `analyst.md`'s memory cap contradicts the hook that enforces it [VERIFIED]

`analyst.md:33` — "a MEMORY.md entry that would exceed **8 lines** is not an inline entry". CLAUDE.md `## Agent memory layout` — "a `MEMORY.md` entry is ≤2 lines and ≤50 words". `lint.write.mjs:28` — `if (entry.length > 2 || words > 50)` → `exit 2`. An analyst that follows its own agent file writes a 3–8 line entry and gets bounced by a `PostToolUse` hook. CLAUDE.md `## Agent base constraints` says each agent's constraints list "only its agent-specific deltas — do not restate the rules below"; this is a restatement *and* a contradiction.

#### R-018 [major] — Dangling per-entity pointer in the analyst's memory index [VERIFIED]

`.claude/agent-memory/analyst/MEMORY.md:3` links `report-agent-skill-audit-2026-05-26.md`; that directory contains only `MEMORY.md`. The index's whole contract is "the per-entity file holds the detail; `MEMORY.md` carries the pointer" — and its single per-entity pointer resolves to nothing. Line 4 of the same file uses a `../../../artifacts/…` path form, so the two-line index also demonstrates two link conventions.

#### R-019 [minor] — Consultant redirect step number stated three ways [VERIFIED]

`discussion.md:53` "step-3 redirect"; `preflight.yaml:50` "step-3 redirect"; `consultant.md:90` "step-2 redirect line". Dispatch is step 2.

#### R-020 [major] — `branching` auto-loads into every developer spawn [VERIFIED]

162 lines injected per spawn for a gate that resolves to "skip silently" whenever the project has no `.claude/branching/manifest.yaml` and fewer than 2 nested repos under `src/`. This repository satisfies neither condition. CLAUDE.md `## Agent base constraints` already defines the *(deferred)* mechanism and says declarations should be kept "to skills an agent needs on nearly every run"; `orchestration.md` §Team Setup restates the cost warning. The developer's own `branching` declaration is the clearest counter-example to both rules in the harness.

#### R-021 [minor] — Pre-flight is a step in three places for the reviewer [VERIFIED]

`reviewer.md:62` (shell step 3), `perphase.md:9` (its step 3), `crosscheck.md:9` (CC-1). All three cite CLAUDE.md `## Pre-flight protocol` and the same `preflight.yaml` key. The mode files also acknowledge the shell already ran steps 1–2, so the duplication is self-aware — it just wasn't removed. No other agent's mode files restate pre-flight.

#### R-022 [major] — `summarizing` is registered nowhere [VERIFIED]

No agent references it, CLAUDE.md has no skill inventory, and it fails the project linter's description check. More broadly: **the harness has no registry of its own skills.** CLAUDE.md `## Asset references` enumerates the `assets/` tree file by file, and `hooks/README.md` enumerates every hook — but the six skills are discoverable only by listing the directory. Five of them are reachable via an agent's frontmatter; the sixth is reachable only if you already know it exists.

#### R-023 [major] — Two load-bearing protocol tokens are unregistered [VERIFIED]

`tokens.yaml:10` states the rule: "Adding a token requires adding an entry in the matching file first." Two violations:

- **`PAUSED — <reason>`.** Defined in CLAUDE.md `## Turn discipline` as the universal mid-turn exit for every agent, emitted explicitly by `reviewer.md:60`, and special-cased in `guard.verdict.mjs:49` (`if (/^PAUSED\b/m.test(text)) process.exit(0)`) — a token that can bypass every verdict check. It appears in no `tokens.*.yaml`.
- **`**Governing ADR:**`.** A plan-file marker written by the architect, repointed by `amendment.md` M4, resolved first by `perphase.md:21` and read by `crosscheck.md:20`. Present in `templates/plan.md`; absent from `tokens.markers.yaml`, which registers `**Supersedes:**`, `**Superseded by:**`, and `**Consolidates:**` but not the pointer they all repoint.

#### R-024 [minor] — `scoring.yaml` points the wrong direction [VERIFIED]

`scoring.yaml:31` and `:43` both read "any signal in `compliance_signals` **below**". `compliance_signals` is defined at line 17, above both.

#### R-025 [major] — `settings.json` carries dead cross-platform configuration [VERIFIED]

Three defects in a 138-line file:

- `permissions.allow` contains `Bash(mkdir -p /home/vlad/Workspace/ai/AISpec/.claude/skills/reviewing/templates)` — a Linux absolute path in a project at `d:\workspace\github\AISpec`.
- `permissions.additionalDirectories` grants `/home/vlad/Workspace/ai/AISpec/.claude/skills/reviewing` — the same dead path, as a directory grant.
- `Edit(/.claude/skills/documenting/**)` has a leading slash, making it filesystem-root-absolute rather than project-relative.

None of these grant anything today, which is precisely the problem: a permission entry that silently matches nothing is indistinguishable from one that works until the day it matters.

#### R-026 [minor] — No allowlist for the drive commands the harness asks for [VERIFIED]

`detectors.yaml:44` — "Projects SHOULD allowlist their standard run/drive commands so verification needs no prompt", echoed by `implement.md:38`. `settings.json` allows ten `git` read-only patterns, two `node` scripts, `Read`/`Write`/`Edit`/`Glob`/`Grep` — and nothing runnable. Every step-7a drive prompts. Combined with R-014, the verification loop is simultaneously the most-friction path for an honest developer and the least-enforced claim for a dishonest one.

#### R-027 [minor] — `settings.local.json` is a debugging scratch file [VERIFIED]

~25 allow entries, essentially all one-off: `Bash(mv jira-items/SKILL.md ticketing/SKILL.md)` (a migration that already happened), `Bash(cd /tmp)`, two multi-line escaped `python -c` invocations inspecting `styles.xml`, `Bash(cp rawpandoc.docx pyversion.docx)`, `Bash(cat)`, and three `Read(//d/…)` grants including `//d/workspace/development/**`. `Bash(cat)` alone is a standing grant for an unbounded read command.

#### R-028 [minor] — User-scope skills shadow project skills, with no precedence rule [VERIFIED]

`~/.claude/skills/` contains `analyse-gap`, `api-conventions`, `code-architecture-review`, and `jira-items`. Three overlap project skills by function — `jira-items` ↔ `ticketing` (and `settings.local.json` records the file-level migration of `jira-items` *into* `ticketing`, so the user-level copy is a superseded ancestor), `code-architecture-review` ↔ `reviewing`, `api-conventions` ↔ `documenting`'s `templates/api.md`. All four are model-invocable and appear in every session's skill list alongside the project's. Nothing in CLAUDE.md or `orchestration.md` states which wins.

#### R-029 [minor] — Repository hygiene: unregistered designer assets and dead files [VERIFIED]

- `templates/` at the repo root holds `agent-definition-template.md` (31 KB) and `skill-definition-template.md` (21 KB) — the canonical skeletons `lint-agents.mjs` validates against. CLAUDE.md `## Asset references` documents `mast.yaml` as "the designer's reference… consulted when authoring or amending agent/skill files" but never mentions these two, which are the actual skeletons for that job.
- `tmp/` holds 21 committed research and follow-up documents (~280 KB) dated May 2026, including nine competitor `findings-*.md` files and seven `followup-*.md` items whose status is unrecorded.
- `hello.sh` at the root is an unrelated bash exercise.
- `.gitignore` ignores `artifacts/sessions/*` and `artifacts/sessions/.map/` — a directory absent from CLAUDE.md `## Artifact Ownership` and therefore one `guard.write.mjs` would actively block writes to.

#### R-030 [major] — The harness is not exercised in its own repository [VERIFIED]

`node .claude/telemetry/report.mjs` over 45 ledger lines / 4 sessions / 1,498,147 output tokens: **0 cross-checks, 0 reviews, 0 amendments, 0 teammate turns**. `artifacts/` contains only `reports/`. `.claude/agent-memory/architect/` and `reviewer/` are empty directories. CLAUDE.md `## Project facts` reads "(none recorded yet)".

This is not a defect in the design — the toolkit is deployed into consuming projects, and the two prior reports show it has been analysed against a real umbrella (`/d/workspace/development`, referenced in `settings.local.json` and in the `guard-bash.log`). It is a defect in the *feedback loop*: `report.mjs` closes by advising "DRIFT rate < ~15% → widen the SELF_CHECKED carve-outs; CHANGES REQUIRED rate < ~5% → relax checkpoint cadence", and `hooks/README.md` gates promoting drive-staleness to blocking on "once the ledger says the false-positive rate is acceptable". Every carve-out in the system is tuned by numbers the home repository structurally cannot produce.

---

## Dependencies and Relationships

```
                     SessionStart hooks
              inject.project-memory ──> .claude/MEMORY.md (absent here)
              inject.orchestration  ──> lead/orchestration.md (main session only)
                              │
                        team lead (router)
                              │
   ┌──────────┬───────────┬───┴──────┬───────────┬──────────┐
analyst   consultant   architect   developer   reviewer
   │           │           │           │           │
   │      discussion/  design/     implement/  perphase/
   │      artifact     amendment   rejection   crosscheck        ← mode files (1 loads)
   │           │           │           │           │
   v           v           v           v           v
reports/   strategy/    adr/       src,tests    (no artifact writes)
api/                    plans/     plan stamp    agent-memory/reviewer/
inbound/

always-on:   CLAUDE.md (208) — every session AND every teammate spawn
auto-loaded: documenting(168) -> analyst, architect, consultant, developer
             reviewing(166)   -> reviewer
             branching(162)   -> developer          ← R-020: skips in single-repo projects
deferred:    understanding, ticketing              (read on demand)
orphan:      summarizing                           ← R-022: referenced by nothing

on-demand assets: preflight, selfcheck, scoring, detectors, tokens.{routing,verdicts,markers}
designer-only:    mast.yaml, hooks/README.md, templates/*-definition-template.md (R-029)

enforcement (non-prompt):
  PreToolUse  Write|Edit -> guard.write  ──┐
  PostToolUse Write|Edit -> lint.write   ──┴─> lib/ownership.mjs  (one registry, two callers)
  PreToolUse  Bash       -> guard.bash      (vendored shell-quote)
  PostToolUse Bash       -> observe.bash ──┐
  Stop+SubagentStop      -> guard.verdict ─┴─> lib/drive-evidence.mjs   ← R-014: gate cannot fire
  Stop+SubagentStop      -> emit.metrics  ──> telemetry/ledger.jsonl    ← R-030: 0 gate events
  (both Stop hooks share lib/turn-block.mjs)
```

**What this depends on:** Claude Code's harness (`TeamCreate`, `SendMessage`, `TaskOutput`, the hook I/O contract — `guard.bash.mjs:32-35` flags that contract as version-sensitive and asks the reader to re-verify against current docs); Node for all hooks and scripts; `shell-quote` (vendored); pandoc for `.docx` export; the Atlassian MCP server for ticketing.

**What depends on this:** any project adopting `.claude/` as its harness; the `artifacts/` tree at that project's root.

---

## Risks and Unknowns

- **[RISK]** R-014 — the drive gate reads as enforced and is not. The risk is worse than an absent gate: `hooks/README.md:35` states "Verification is observed, not trusted", and a maintainer reading that will not re-audit it.
- **[RISK]** R-016 — `## Security paths` extensions will be honoured by the architect and reviewer agents and silently ignored by the reviewing skill's carve-out. Divergence appears only in projects that extend the list, i.e. the ones that need it.
- **[RISK]** R-017 — an analyst following its own file is blocked by a hook. The blocked call is recoverable (CLAUDE.md tells agents to fix the violation, not retry), but it burns a turn and teaches the agent to distrust its own constraints block.
- **[RISK]** R-025/R-027 — permission entries that match nothing are indistinguishable from ones that work. Cleaning them is cheap; leaving them means the next real grant is buried in noise.
- **[ASSUMPTION]** Line counts (`wc -l`) are the proxy for prompt-token cost throughout, as in the prior audit. Order-of-magnitude accurate, not exact.
- **[ASSUMPTION]** "Auto-loaded skill bodies are injected in full at spawn" is taken from CLAUDE.md `## Agent base constraints` and `orchestration.md` §Team Setup, both of which state it explicitly. Not independently measured against a live spawn.
- **[UNKNOWN]** Whether `scripts/lint-agents.mjs` is intended to remain authoritative. If yes it needs updating for the `preflight.yaml` and `mast.yaml` refactors; if no it should be removed along with its `npm` script. Nothing in the contract surface says which.
- **[UNKNOWN]** Whether the four `~/.claude/skills/` entries are intentionally retained or are pre-migration leftovers. `jira-items` is provably superseded; the other three are judgement calls the user has to make.

---

## Recommendations

1. **[ARCHITECT REVIEW NEEDED]** [P0 — structural] Give `isDriveCommand()` a negative class so the mandatory test/lint command stops satisfying the drive gate. Resolve the command per `detectors.yaml` (or match a conservative literal set: `npm test`, `npm run lint`, `dotnet test`, `pytest`, `go test`, `cargo test`, `mvn test`, `./gradlew test`) and classify it as neither drive nor inspect. Keep the broad-drive bias for everything else. *Resolves R-014.* Files: `.claude/hooks/lib/drive-evidence.mjs:29-50`, `.claude/agents/assets/detectors.yaml`, `.claude/hooks/README.md:37-40`.

2. [P0 — tighten wording] Repoint `reviewing/SKILL.md:78` at CLAUDE.md `## Security paths` and delete the inline duplicate list, so the section is the only copy. *Resolves R-016.*

3. [P0 — tighten wording] Delete `analyst.md:33`. The cap is in CLAUDE.md and enforced by `lint.write.mjs`; the agent-specific delta rule says not to restate it. *Resolves R-017.*

4. **[ARCHITECT REVIEW NEEDED]** [P1 — structural] Mark `branching` *(deferred)* on the developer and move the read into `implement.md`'s worktree-readiness gate, after the gate holds. Saves 162 lines on every developer spawn in single-repo projects at the cost of one Read in umbrella projects. *Resolves R-020, R-010.* Files: `developer.md:11-13`, `assets/instructions/developer/implement.md:7-16`.

5. [P1 — structural] Decide `scripts/lint-agents.mjs`'s status. If authoritative: update the CLAUDE.md pre-flight checks to expect the formats in `preflight.yaml`, update the mast.yaml schema check from `failure_modes_detail` to `taxonomy`, and add it to `hooks/README.md` §Standalone invocations. If not: delete it and the `lint:agents` npm script. *Resolves R-015.*

6. [P1 — structural] Add a skill registry to CLAUDE.md `## Asset references` — one row per skill with its loader (auto on agent X / deferred on agent Y / user-invoked only). Registers `summarizing`, and gives R-028 a place to state project-over-user precedence. *Resolves R-011, R-022, partially R-028.*

7. [P1 — tighten wording] Register `PAUSED` in `tokens.routing.yaml` and `**Governing ADR:**` in `tokens.markers.yaml`. `PAUSED` in particular bypasses every `guard.verdict` check and should be documented where the other verdict-adjacent tokens are. *Resolves R-023.*

---

## Cost Hotspots (heaviest files ranked)

| Rank | File | Lines | Loaded when | Notes |
|---|---|---|---|---|
| 1 | `.claude/skills/documenting/templates/api.md` | 243 | Analyst API-doc writes only | Correctly on-demand; 2.4× the ADR template |
| 2 | `CLAUDE.md` | 208 | **Every session AND every teammate spawn** | The single most expensive line-for-line file; its own admission test exists to police this |
| 3 | `.claude/skills/ticketing/SKILL.md` | 175 | Deferred — analyst ticketing tasks | Good; three `future` provider rows are dead weight |
| 4 | `.claude/skills/documenting/SKILL.md` | 168 | Auto on **four** agents | Highest-leverage trim target: the 30-line export section serves one of the four |
| 5 | `.claude/skills/reviewing/SKILL.md` | 166 | Auto on reviewer | Load-bearing throughout |
| 6 | `.claude/skills/branching/SKILL.md` | 162 | Auto on developer | **Misplaced** — see R-020 |
| 7 | `.claude/agents/assets/instructions/reviewer/perphase.md` | 154 | Reviewer per-phase/cumulative | Largest mode file; earns it |
| 8 | `.claude/skills/reviewing/templates/cross-check.md` | 145 | Cross-check mode only | Good — lazy |
| 9 | `.claude/skills/understanding/SKILL.md` | 133 | Deferred everywhere | Correctly demoted since May |
| 10 | `.claude/skills/documenting/templates/report.md` | 130 | Analyst report writes | Down from 135 |
| 11 | `.claude/agents/analyst.md` | 126 | Every analyst spawn | Heaviest shell; single-mode so no mode file |
| 12 | `.claude/agents/assets/instructions/architect/amendment.md` | 122 | Amendment mode only | Consolidation logic (M2b/M3b) is most of it |

**Files >300 lines:** none. The largest agent-side file is now 208 (CLAUDE.md); in May it was 242 (`reviewer.md`).

**Auto-loaded per invocation, by agent (body lines, including CLAUDE.md):**

| Agent | Composition | Total | vs. May |
|---|---|---|---|
| analyst | CLAUDE 208 + shell 126 + documenting 168 | **502** | 255 + no CLAUDE.md baseline |
| architect | CLAUDE 208 + shell 81 + documenting 168 + mode 87–122 | **544–579** | 352 |
| consultant | CLAUDE 208 + shell 91 + documenting 168 + mode 58–63 | **525–530** | 480 |
| developer | CLAUDE 208 + shell 103 + documenting 168 + **branching 162** + mode 37–101 | **678–742** | 178 |
| reviewer | CLAUDE 208 + shell 83 + reviewing 166 + mode 60–154 | **517–611** | 377 |

The May column did not count CLAUDE.md, which was smaller and not yet described as loading into every teammate spawn. Comparing agent-side only (excluding CLAUDE.md): analyst 294 vs 255, architect 336–371 vs 352, consultant 317–322 vs 480, reviewer 309–403 vs 377, developer 470–534 vs 178. Three agents improved, one is flat, and the developer nearly tripled — entirely from the two auto-loaded skills.

**Boilerplate that fires when it shouldn't:** two instances, both new. `branching` on every developer spawn (R-020) and `documenting`'s 30-line export section on four agents when one exports. Everything else is correctly gated: pre-flight is entry-turn-only, MAST is designer-only, hooks/README is designer-only, mode files load one of N, templates and examples load on demand, and the `scoring.yaml` extraction the prior audit recommended is done.

---

## Concrete Improvements (prioritized)

### P0 — must fix

1. **[ARCHITECT REVIEW NEEDED]** Add a negative class to `isDriveCommand()` so the mandatory test suite is neither drive nor inspect. Without it the harness's flagship enforcement is decorative and its README claims otherwise. Files: `hooks/lib/drive-evidence.mjs:29-50`, `agents/assets/detectors.yaml`, `hooks/README.md:35-40`. (R-014)
2. `reviewing/SKILL.md:78` → point at `## Security paths`, drop the inline list. (R-016)
3. Delete `analyst.md:33`'s 8-line memory cap. (R-017)

### P1 — should fix

4. **[ARCHITECT REVIEW NEEDED]** Demote `branching` to *(deferred)* on the developer; read it inside the worktree gate. Files: `developer.md:11-13`, `implement.md:7-16`. (R-020, R-010)
5. Resolve `scripts/lint-agents.mjs`: update for the `preflight.yaml` / `mast.yaml` refactors and document it, or delete it with its npm script. (R-015)
6. Add a skill registry table to CLAUDE.md `## Asset references`, including loader and precedence over user-scope skills. (R-011, R-022, R-028)
7. Register `PAUSED` (`tokens.routing.yaml`) and `**Governing ADR:**` (`tokens.markers.yaml`). (R-023)
8. Add `context-map-` to CLAUDE.md's registered memory kinds, or remove it from `ownership.mjs:19`. Prefer adding — the code's superset is the more useful set, and the header's stated order makes CLAUDE.md the file to change. (R-013)
9. Clean `settings.json`: drop the two `/home/vlad/…` entries and fix `Edit(/.claude/skills/documenting/**)` to be project-relative. (R-025)
10. Fix the analyst's memory index: create the missing per-entity file or drop the link, and pick one path convention for both lines. (R-018)

### P2 — tighten wording

11. Allowlist the project's run/drive commands in `settings.json` so step-7a verification stops prompting, as `detectors.yaml:44` asks. (R-026)
12. Prune `settings.local.json` to entries that are still reachable; `Bash(cat)` and the `python -c` one-liners in particular. (R-027)
13. Remove the duplicated pre-flight step from `perphase.md:9` and `crosscheck.md:9`; the shell already ran it and both files say so. (R-021)
14. Fix "below" → "above" at `scoring.yaml:31` and `:43`. (R-024)
15. Reconcile the consultant redirect step number to "step 2" in `discussion.md:53` and `preflight.yaml:50`. (R-019)
16. Register `templates/agent-definition-template.md` and `skill-definition-template.md` in CLAUDE.md `## Asset references` beside `mast.yaml`; triage `tmp/` (nine competitor `findings-*` and seven `followup-*` with unrecorded status); delete `hello.sh`; drop the `artifacts/sessions/` `.gitignore` rules or add the directory to the ownership table. (R-029)
17. Move `documenting`'s Export-to-Word section (~30 lines) to a bundled reference read on `--export`, so three of its four consumers stop paying for it. (R-006)

### P3 — worth deciding, not fixing

18. Exercise the pipeline end-to-end at least once in this repository — one small plan through design → cross-check → two phases → cumulative review. Every carve-out threshold in the system (`SELF_CHECKED`, `SELF_CHECKED (delta)`, checkpoint cadence, drive-staleness promotion) is explicitly gated on telemetry the home repo cannot produce, and `report.mjs` currently prints tuning advice against `n/a` rates. (R-030)

---

## Overall System Score

**Weighted: 81.8%** (up from 76.4%)

| Axis | Score | Driver |
|---|---|---|
| Efficiency | 85% | Mode-file split, entry-turn-only pre-flight, delta-scoped cross-check, re-review scoping, machine-enforced exclusions, log-digest — all strong. Drag: `branching` always-on, pre-flight duplicated across three reviewer files, a linter that always fails |
| Token cost | 78% | +14. The prior audit's two structural complaints are fixed; the win is partly given back by CLAUDE.md at 208 always-on lines and by the developer's two auto-loaded skill bodies (330 lines, one of them inapplicable) |
| Determinism | 89% | Strongest axis. Regex dispatch with explicit fallbacks, off-LLM phase state and filenames, one ownership registry with two callers, exact-string verdicts enforced at `SubagentStop`. Held back by R-014 — the newest gate is the weakest one |
| Consistency | 74% | **Down 7.** Two P0 contradictions (R-016, R-017), one code-vs-prose registry gap (R-013), two unregistered protocol tokens (R-023), a three-way step-number disagreement (R-019), a stale linter (R-015), dead cross-platform permissions (R-025), and an orphan skill (R-022) |

**What would move the needle most:** the three P0s plus R-020 are all small, local edits. Together they lift Consistency 74 → 84 and Token cost 78 → 82, putting the system at roughly **86%**. R-014 is the one worth doing first regardless of score, because the gap between what `hooks/README.md` claims and what the code does is the kind of defect that gets discovered by a missed regression rather than by an audit.

The trajectory is right. The system's failure mode has moved from *bulk* (May: 480-line spawns, dual-mode files, restated boilerplate) to *drift between copies* — a strictly better problem, and one the harness already has the machinery to solve. `lib/ownership.mjs` is the template: one registry, two callers, a header stating which file is authoritative and in what order changes propagate. Four of this audit's findings are places where that pattern was not applied.

---

## Glossary

- **Mode file** — `assets/instructions/<agent>/<mode>.md`. Carries a multi-mode agent's steps, output format, and per-mode token contract. Exactly one loads per invocation, selected by the shell's step-2 regex dispatch.
- **Shell** — the agent file proper (`.claude/agents/<name>.md`): identity, constraints, dispatch. Carries no mode-specific procedure.
- **Hook layer** — the seven `.claude/hooks/*.mjs` scripts wired in `settings.json`. `guard.*` blocks, `lint.*` feeds back, `inject.*` adds context, `observe.*` records.
- **Drive evidence** — the record in `.claude/state/drive-log.jsonl` of every Bash command with a drive/inspect classification, written by `observe.bash.mjs` and read by `guard.verdict.mjs` to check the developer's `**Verification:**` claim. The agent cannot write it.
- **Consolidation (M3b)** — at the third amendment against one ADR, the delta chain is folded into a re-issued full ADR at the next free top-level number rather than appending `-r3`. `D-###` numbers are preserved.
- **Hold-and-batch** — CLAUDE.md `## Spec volatility`. Source A (external spec renegotiation) stamps the plan `**Spec: ON HOLD**` and blocks phases; Source B (user structural rulings) queues at the team lead and flushes as one amendment without stopping the plan.
- **Machine-enforced exclusions** — `reviewing/SKILL.md`. Findings the project's own gates already fail on are not reported, with three reversals: a guard's own code stays in scope, warning-severity is not enforcement, and exclusion is per finding-class rather than per diff.
- **Evidence bar (E1–E5)** — `reviewing/SKILL.md`. Cite from source read this pass; never infer from a name; actively try to disprove; Critical/Major need a concrete failure scenario; Minor capped at 5.
- **Admission test** — CLAUDE.md's own gate on what may live in the always-on file: not derivable elsewhere, and load-bearing for more than one actor.
- **MAST** — Multi-Agent failure taxonomy, Cemri et al. (arXiv:2503.13657v2). 14 failure modes + 14 design rules. Designer-only asset; the runtime surface is `selfcheck.yaml`, whose boxes each name their FM code.
