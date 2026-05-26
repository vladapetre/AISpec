# Analysis: Agent and Skill System Audit

**Date:** 2026-05-26
**Audience:** developer (system maintainer — the user is iterating on this harness)
**Sources:**
- `.claude/agents/analyst.md`, `architect.md`, `consultant.md`, `developer.md`, `reviewer.md`
- `.claude/agents/assets/tokens.yaml`, `mast.yaml`
- `.claude/skills/documenting/SKILL.md` + templates (`report.md`, `adr.md`, `plan.md`, `progress.md`, `charter.md`, `context-map.md`, `strategic-adr.md`, `glossary.md`) + examples
- `.claude/skills/reviewing/SKILL.md` + templates (`alignment.md`, `cross-check.md`, `patterns.md`, `dotnet.md`, `typescript.md`, `clean-architecture.md`, `vertical-slice.md`)
- `.claude/skills/understanding/SKILL.md`
- `CLAUDE.md` (Agent Workflow section)

---

## Executive Summary

This system is a five-agent star-topology harness (analyst → architect/consultant → developer → reviewer) backed by three skills and a token vocabulary. It is **well-engineered for determinism but heavy on prompt tokens**, with the architect (227 lines), reviewer (242 lines), and consultant (230 lines) carrying the highest per-invocation cost. The recent optimisation arc (commits `57c2e4b`, `7bbee3b`, `ab6cec7`, `3ad7059`) has visibly lightened the system — skills are lazy-loaded, MAST is a designer-only asset, pre-flight is compact when clean — but several token-cost wins remain unrealised, and a handful of inconsistencies still leak across agent boundaries. The single biggest improvement available is **collapsing duplicated operating-constraint boilerplate** (Bash rules, Write-path rules, `Agent`-tool rules) into CLAUDE.md so it loads once per session instead of once per agent.

### Overall scores (weighted)

| Axis | Score | Weight | Weighted |
|---|---|---|---|
| Efficiency | 78% | 25% | 19.5 |
| Token cost | 64% | 30% | 19.2 |
| Determinism | 86% | 25% | 21.5 |
| Consistency | 81% | 20% | 16.2 |
| **Overall** | | | **76.4%** |

### Top 3 fixes (full P0/P1 list in §5)

1. **P0** — Define or remove the dangling `**Security paths:**` pointer. `architect.md:118`, `architect.md:161`, `reviewer.md:111`, and `reviewing/SKILL.md:76` all defer to a `**Security paths:**` block "in CLAUDE.md" that does not exist in `CLAUDE.md`. Today reviewers and architects silently fall back to the hard-coded paths only.
2. **P0** — Move repeated `<operating_constraints>` boilerplate (No `Agent` tool / All hand-offs through team lead / `Bash` read-only list / `Write` path restrictions) into a single CLAUDE.md `## Agent base constraints` block. Currently restated in all five agent files (~7–10 lines each → ~40 lines duplicated across every invocation).
3. **P1** — `developer.md` writes `templates/progress.md` (line 54) but does **not** declare the `documenting` skill in its frontmatter (lines 1–13). Either declare it or stop calling the template by skill-relative path. Same agent has no closing self-check block, breaking parity with the other four agents.

---

## Background and Context

The project is a multi-agent orchestration spec ("AISpec") for Claude Code. Agents are markdown files with YAML frontmatter loaded by the harness; skills are similar but routed through a `skills:` frontmatter entry on each agent. The team lead (the user-facing orchestrator) spawns named teammates via a `TeamCreate` / `SendMessage` pipeline, and all routing is star-topology — no peer-to-peer agent messaging.

The system follows the MAST taxonomy from Cemri et al. ("Why Do Multi-Agent LLM Systems Fail?") — `mast.yaml` is the designer's reference for the 14 failure modes and 14 design rules, used when authoring agent files rather than loaded at runtime. The token vocabulary in `tokens.yaml` is the single source of truth for cross-agent routing tokens, verdict tokens, in-artifact markers, and typed identifiers (`R-`, `D-`, `T-`, etc.). Recent commits show an active optimisation effort to lighten skills, consolidate agents, and reduce per-turn cost.

## Structure and Organisation

The system is three layers stacked on a star-topology router:

- **Agents** (`.claude/agents/`) — five named teammates: analyst, consultant, architect, developer, reviewer. Each is a markdown file with `<role_identity>`, `<operating_constraints>`, `<deliverables>`, `<decision_authority>`, `<instructions>`, `<interaction_model>`, `<completion_criteria>`, `<output_format>` sections.
- **Skills** (`.claude/skills/`) — three reusable bodies: `documenting` (output format / templates / filename derivation), `reviewing` (checklist registry / framework detection / severity), `understanding` (interview discipline + `.claude/MEMORY.md` glossary). Each is a SKILL.md plus templates and (for documenting) examples and scripts.
- **Assets** (`.claude/agents/assets/`) — `tokens.yaml` (runtime, semantically referenced by every agent) and `mast.yaml` (designer-only, never loaded at runtime).
- **Orchestration contract** (`CLAUDE.md`) — pre-flight protocol, artifact ownership, cross-check rules, review rules, team-setup discipline.

Routing is by token: agents emit specific bracketed flags into artifacts (`[ARCHITECT REVIEW NEEDED]`, `[TACTICAL DESIGN NEEDED]`, etc.) and unbracketed summary lines (`ARCHITECT AMENDMENT NEEDED:`, `CROSS_CHECK_REQUESTED:`, `SELF_CHECK: ALIGNED`), which the team lead scans to dispatch the next turn.

## Key Concepts

### Star topology
All agent-to-agent communication physically passes through the team lead. No peer-to-peer `SendMessage` between teammates. This is enforced by `tokens.yaml:3` and CLAUDE.md `## Agent Communication`. Effect: every routing token must be machine-grepable on a summary line.

### Lazy skill loading
Skill *frontmatter* auto-loads when the agent does, but skill *bodies* and *templates* are read only when the agent reaches a step that needs them (CLAUDE.md `## Team Setup`, line 7). Most templates are 50–150 lines and never load if not needed.

### Verdict / routing token vocabulary
`tokens.yaml` is the canonical registry. Each token has a producer, consumer, written-into location, and meaning. Exact-string matching — near-matches are rejections (`tokens.yaml:10`).

### Pre-flight protocol
Five fixed checks (Inputs / Prior phase / Scope / Terms / Target). Compact one-liner when all pass, expanded form on any `⚠` or `✗`. **Skipped on continuation turns within the same task** — only fires on entry turns (CLAUDE.md `## Pre-flight protocol`, line 64).

### MAST self-check
Every agent ends `<instructions>` with a "Closing self-check" bullet list — a plain-language summary of the active failure modes for that role. Not inline `**Avoid (FM-x.x):**` cues anymore (replaced; see `mast.yaml:7`).

---

## Findings

### Per-Agent Scorecards

#### R-001 [major] — Analyst — Efficiency 80% / Tokens 70% / Determinism 88% / Consistency 86% [VERIFIED]

130 lines (`analyst.md:1-130`). One-mode agent (no Mode A vs Amendment branching).

- **Efficiency (80%).** Tight instruction sequence (11 steps). Step 5 coverage rules are concrete and bounded (`≤30 readable files`, `cap 60 reads`, BFS lex tiebreak — `analyst.md:63`). Step 10 hand-off-flag criteria are mechanically applicable. Drag: step 6's "required questions" branch into code-only vs document-only buckets but every analyst run pays the cost of reading both branches; this could be a runtime `if source-type` selector.
- **Tokens (70%).** 130 lines is reasonable for the pipeline-entry agent, but ~25 lines (`<operating_constraints>` + `Tokens` interaction_model block) restate content already in CLAUDE.md and `tokens.yaml`. The `<output_format>` block at lines 118–130 is rendered verbatim every turn in the `SendMessage` — a six-line block would suffice.
- **Determinism (88%).** Output format is fully specified; confidence-marker assignment is deterministic; filename derivation is delegated to the `documenting` skill's `scripts/filename.mjs` (genuinely deterministic). The "encounter order" rule for `R-###` IDs (`analyst.md:31`) is robust but assumes single-pass authoring — concurrent edits would race.
- **Consistency (86%).** Token names match `tokens.yaml` exactly. The summary-line vs in-artifact disambiguation (`tokens.yaml:14-16`) is faithfully reflected in `analyst.md:104-106`. Inconsistency: line 80 says "Determine audience per `documenting` skill `Audience detection`" but the templates table in `documenting/SKILL.md:54-65` already pins analysis reports to audience-detected and everything else to a fixed audience — the step is redundant for non-report artifacts, but the analyst only writes reports, so this is a minor leftover not a bug.

**Top shortcomings:**
1. Step 6's required-question fork is template-able — move into `report.md`.
2. `<operating_constraints>` restates CLAUDE.md boilerplate.
3. `<output_format>` block is over-specified relative to what `SendMessage` actually needs.

#### R-002 [critical] — Architect — Efficiency 70% / Tokens 55% / Determinism 84% / Consistency 78% [VERIFIED]

227 lines (`architect.md:1-227`). Two-mode agent (Mode A tactical design + Amendment mode), the most procedurally complex file in the system.

- **Efficiency (70%).** Mode dispatch (line 59) is clean. Mode A's 13 steps (A1–A13) and Amendment's 5 steps (M1–M5) carry real work, but step A5's binding-constraint scoring (`architect.md:87-91`) is verbose for a routine activity; the rubric could be a one-page reference loaded only when scoring is contested. Step A7 mandates "exactly 2 alternatives" with the `_None identified_` fallback (`architect.md:97`) — disciplined but forces ceremony even when 0 alternatives genuinely exist.
- **Tokens (55%).** Heaviest agent file in the harness (227 lines). Mode A and Amendment instructions both load every invocation even though only one mode runs — this is structural waste of ~50–70 lines per turn. The `<output_format>` block (lines 191–227) renders Mode A and Amendment formats both, even though the agent only emits one. The pre-flight per-check semantics at lines 60–65 are restated for both modes despite minor overlap.
- **Determinism (84%).** Strong: binding-constraint scoring is rule-based (`architect.md:87-91`); alternative count is fixed (`exactly 2`); the irreversibility marker is mechanical. Weak: step A5's "Maintainability auto-High if … readability/maintainability is named as a project value" depends on subjective parsing of CLAUDE.md. Self-check vs cross-check escalation (line 109) hinges on "genuine uncertainty" — undefined threshold.
- **Consistency (78%).** `RECONCILE WITH ADR:` token matches `tokens.yaml:62-66` ✓. `SELF_CHECK: ALIGNED` matches `tokens.yaml:50-54` ✓. **Drift:** `architect.md:118` references "security-sensitive paths from CLAUDE.md `**Security paths:**`" — that block does not exist in CLAUDE.md (confirmed by grep — only the references exist). Same dangling pointer at `architect.md:161`. **Drift:** `architect.md:89` references `COMPLIANCE_*` env vars as a scoring signal — also undefined anywhere. **Drift:** `architect.md:36` introduces the `T-<phase>.<seq>` format but the canonical definition lives in `tokens.yaml:119` — both agree, but the duplication risks divergence on edit.

**Top shortcomings:**
1. Mode A and Amendment instructions both load on every turn — structural waste of ≥50 lines per invocation.
2. Dangling `**Security paths:**` and `COMPLIANCE_*` references.
3. Step A5 scoring rubric is verbose enough to merit promotion to a side-asset.

#### R-003 [major] — Consultant — Efficiency 76% / Tokens 60% / Determinism 80% / Consistency 84% [VERIFIED]

230 lines (`consultant.md:1-230`). Two-mode agent (Discussion vs Artifact). Discussion is the default and produces conversation only.

- **Efficiency (76%).** Mode dispatch at step 2 (`consultant.md:79-82`) is explicit. Discussion mode is genuinely lightweight (no mandatory writes). Artifact mode's step A8 "write set" rule (`consultant.md:147-152`) is well-designed: "do not auto-bundle". Drag: like the architect, both modes' full instructions load every turn even though only one runs (~80 lines wasted on the unused branch). The `<modes>` block at lines 43–53 partly duplicates step-2 mode-dispatch logic.
- **Tokens (60%).** 230 lines — second-heaviest. The `<operating_constraints>` block (lines 29–41) restates standard agent rules. The `<output_format>` block (lines 197–229) renders both modes' formats. The constraint list at A6 (8 named constraints) and the discussion-mode informal scoring (D5) both reference the same vocabulary — could collapse.
- **Determinism (80%).** Artifact-mode SDR rules are tight: exactly 2 binding constraints, exactly 2 alternatives, fixed scoring rubric. Discussion mode is intentionally less deterministic ("you may present a menu — that is the point in Discussion mode", line 104). Mode dispatch is rule-based on verb detection (line 80). Weak spot: "the user explicitly asks" is matched by a free-text verb list — paraphrases ("can you ratify this") that don't match the exact verbs leak into Discussion mode.
- **Consistency (84%).** Tokens align (`tokens.yaml:32-42` and `consultant.md:172-174`). The conflict-precedence rule at line 174 ("ratified SDR outranks a tactical ADR on strategic axes") matches the architect's mirror statement at `architect.md:35` ✓. Glossary discipline (line 39, "one glossary entry per (term, context) pair") matches `documenting/templates/glossary.md` ✓. Drift: same `COMPLIANCE_*` reference at `consultant.md:141` with no definition.

**Top shortcomings:**
1. Both modes' instructions load every turn — ~80 lines waste.
2. Mode dispatch is verb-list matching — paraphrase robustness is weak.
3. `<operating_constraints>` and `<modes>` blocks overlap in scope.

#### R-004 [major] — Developer — Efficiency 82% / Tokens 72% / Determinism 78% / Consistency 70% [VERIFIED]

178 lines (`developer.md:1-178`). Single-mode (phase-by-phase implementation). Model is **sonnet** — the only non-opus agent except the reviewer.

- **Efficiency (82%).** Cleanest instruction flow of any agent — 12 numbered steps with no mode-branching. The `<craftsmanship_charter>` block (lines 19–38) is unique: it gives the developer explicit authority over craft choices ("silent. Apply your authority. The ADR is untouched.") and limits escalation to structural conflicts. This is well-designed and saves architect round-trips. Drag: step 7's test/linter detection cascade (lines 84–88) lists 11 detectors in priority order — fine, but very verbose for a step that always picks the first match.
- **Tokens (72%).** 178 lines — middleweight. The craftsmanship charter is ~20 lines that load every turn; it's load-bearing prose, but a tighter restatement could halve it.
- **Determinism (78%).** Phase advancement is deterministic (lowest unmarked anchor, `developer.md:78`). Approval gate is exact-string (`approved` case-insensitive, `tokens.yaml:84-88`). Re-rejection cap is mechanical ("After the 3rd rejection … stop", line 102). Weak: the craft-vs-structural classification (line 32) is intentionally judgement-based — the grey-zone rule (line 37) handles edge cases but at the cost of determinism.
- **Consistency (70%).** **Critical drift:** the developer **writes** `templates/progress.md` (line 54 — `Per `templates/progress.md`) but **does not declare** the `documenting` skill in its frontmatter (lines 1–13). It does not have a `skills:` field at all. The progress template is registered in `documenting/SKILL.md:32` as developer-produced — so the skill is implicitly required but not declared. Either declare it or qualify the path. **Drift:** the developer file has no closing-self-check bullet block — the four other agents (`analyst.md:92-98`, `architect.md:156-162`, `consultant.md:157-163`, `reviewer.md:133-138`) all end `<instructions>` with one; the developer ends with the closing self-check inside `<instructions>` (line 106–112) — different structure breaks template uniformity. **Token drift:** `developer.md:118-119` says it consumes `RECONCILE WITH ADR:` "treated as a rejection" — matches `tokens.yaml:62-66` ✓.

**Top shortcomings:**
1. Missing `skills: [documenting]` declaration despite using the progress template.
2. Closing self-check structure differs from other four agents.
3. Craftsmanship charter is load-bearing but could be ~30% shorter.

#### R-005 [major] — Reviewer — Efficiency 75% / Tokens 58% / Determinism 90% / Consistency 88% [VERIFIED]

242 lines (`reviewer.md:1-242`) — **heaviest file in the system**. Model is **haiku** (the only haiku agent) but the prompt is still substantial. Three modes (per-phase, cumulative, cross-check).

- **Efficiency (75%).** Mode dispatch at step 2 (`reviewer.md:54-58`) is explicit ("First match wins"). The per-phase sub-flow (16 steps) is long but each step does real verification work. Drag: step 13a re-review detection (lines 122–123) adds a memory-lookup pass on every review; valuable for re-reviews, dead weight on first-time reviews.
- **Tokens (58%).** 242 lines is the heaviest prompt. Per-phase and cumulative modes share most of the sub-flow (steps 3–16) but the cross-check sub-flow (CC-1 to CC-6) loads every turn even when cross-check mode does not fire — ~25 lines of waste. The `<output_format>` block (lines 158–242) renders all three modes' formats — ~85 lines. Re-rendering this verbatim in `SendMessage` is mandatory per CLAUDE.md `## Turn discipline` but a tighter format would shave 20–30 lines.
- **Determinism (90%).** Strongest of all agents. Verdict tokens are exact-string-matched, output-format gates are explicit ("never `APPROVED` past a FAIL alignment row or an open Critical", line 33). Diff-size gating is fully numeric (`reviewing/SKILL.md:64-80`). Severity table is rule-based (first-match). The `[PRE-EXISTING]` classification via `git blame` (line 125) is mechanically verifiable. The single weak spot is the "≤8 lines per finding" cap (line 33) — character-count enforcement is fuzzy.
- **Consistency (88%).** Token names are 100% aligned with `tokens.yaml`. Read-scope rules at line 111 (full-file vs hunks) match the architect's surgical-context rule at `architect.md:118` — same vocabulary, same thresholds (≤500 LOC, 15% coverage, security paths). **Drift:** `reviewer.md:111` again references CLAUDE.md `**Security paths:**` — undefined. **Drift:** `reviewer.md:165` (`### 1. Acceptance-Criteria Alignment`) — the table header refers to four columns but the alignment template `templates/alignment.md:35-40` shows four-column format with "Criterion / Result / Evidence / Note" while reviewer.md output_format has three columns "Criterion / Evidence / Result" — column order differs. Minor but visible.

**Top shortcomings:**
1. Heaviest file in the system at 242 lines; all three modes' output formats load every turn.
2. Alignment table column order disagrees between `reviewer.md:170` and `alignment.md:38`.
3. Dangling `**Security paths:**` reference.

---

### Per-Skill Scorecards

#### R-006 [major] — documenting skill — Efficiency 84% / Tokens 80% / Determinism 92% / Consistency 88% [VERIFIED]

124 lines `SKILL.md` + 8 templates (range 46–135 lines) + 4 examples (26–64 lines).

- **Efficiency (84%).** Clean two-table registry (template + audience). Filename derivation is delegated to `scripts/filename.mjs` (genuinely deterministic, off-LLM compute). Templates are read lazily. The "read examples only if uncertain" rule (line 36) keeps examples out of the default load.
- **Tokens (80%).** SKILL.md is 124 lines — fine. Templates are 46–135 lines each — `report.md` (135) is the largest and is read by every analyst invocation; could trim worked-example links and consolidate caps tables.
- **Determinism (92%).** Filename derivation is a Node script — fully deterministic. Audience-detection table is exact-string keyword matching. Confidence-marker assignment is rule-based ("first match wins", line 92). Template registry is a closed enumeration.
- **Consistency (88%).** Confidence-marker definitions in SKILL.md (`Direct quote, observable fact, or value readable from the source without reasoning → [VERIFIED]`, line 93) match `tokens.yaml:106` ("[VERIFIED] / [INFERRED] / [ASSUMED] — analyst per-finding confidence markers (definitions in documenting SKILL.md)") — the cross-reference is correct ✓. **Drift:** `documenting/SKILL.md:38` says "Tactical at `artifacts/adr/NNNNN-*`, strategic at `artifacts/strategy/decisions/NNNNN-*`" — matches CLAUDE.md's ownership table ✓. **Drift:** the report template (line 88) says "Cite the driving finding by ID" but allows "Resolves R-007 and R-012 by …" — the cross-artifact reference convention in `tokens.yaml:130` requires `<short-title>#R-###` form — minor convention drift inside the same artifact (a report citing its own findings can use bare IDs, but the rule isn't stated).

**Top shortcomings:**
1. `report.md` template (135 lines) is the heaviest and loads every analyst run — trim the caps tables and worked-example pointers.
2. Bare-ID vs short-title-prefixed-ID convention isn't stated for intra-artifact references.
3. The four `examples/` files (26–64 lines each) add value only on first-time invocations.

#### R-007 [major] — reviewing skill — Efficiency 78% / Tokens 70% / Determinism 90% / Consistency 84% [VERIFIED]

135 lines `SKILL.md` + 7 templates (45–145 lines).

- **Efficiency (78%).** Diff-size gating (lines 64–80) is the strongest efficiency win — Small skips `patterns.md` and concerns entirely, Medium skips SOLID/DRY sections. Framework detection is two-rule (dotnet/typescript) and short. Drag: the skill body restates a lot of reviewer-agent logic — the agent could reference this skill more and the reviewer file could shrink.
- **Tokens (70%).** SKILL.md is 135 lines — middleweight. Templates are 45–145 — `cross-check.md` (145) is the heaviest but loads only in cross-check mode. `patterns.md` (55) is the always-loaded baseline — reasonable.
- **Determinism (90%).** Diff-size thresholds are numeric (`≤3 files AND ≤50 LOC`, `<300 LOC AND <10 files`, etc.). Security carve-out is path-based. Severity table is first-match. Framework detection is signal-based. Strong throughout.
- **Consistency (84%).** Template registry matches the reviewer agent's expectations ✓. **Drift:** the alignment template's table format (`alignment.md:35-40`: 4 cols `Criterion / Result / Evidence / Note`) differs from the reviewer agent's output_format (3 cols, line 170). One of them is wrong. **Drift:** `reviewing/SKILL.md:76` is the third dangling `**Security paths:**` reference.

**Top shortcomings:**
1. Alignment table column count disagrees with reviewer agent's output_format.
2. Dangling `**Security paths:**` pointer.
3. Some content (severity definitions, mode descriptions) is also restated in the reviewer agent file.

#### R-008 [minor] — understanding skill — Efficiency 88% / Tokens 90% / Determinism 78% / Consistency 92% [VERIFIED]

125 lines `SKILL.md`, no templates.

- **Efficiency (88%).** Compact, well-scoped. Interview-rule list (lines 64–91) is the load-bearing content. "Prefer code exploration over questions" (line 70) is a strong efficiency cue — the skill teaches the agent to grep before asking.
- **Tokens (90%).** Smallest skill body of the three; no templates; deferred-load on most agents. Best token efficiency in the system.
- **Determinism (78%).** Interview is inherently model-driven — the structure (one question at a time, prefer code exploration) imposes shape but the content of questions varies. Memory file convention is tight (lines 28–47) so persisted outputs are deterministic even when the conversation isn't.
- **Consistency (92%).** `.claude/MEMORY.md` ownership matches CLAUDE.md table (line 36) ✓. Skill is correctly declared in `consultant.md` skills frontmatter (line 14) and offered as deferred-load to analyst (`analyst.md:26`) and architect (`architect.md:30`).

**Top shortcomings:**
1. Inherently judgement-based; not a true shortcoming but limits determinism ceiling.
2. No worked example — an experienced agent invocation pattern would help.

---

### Cross-Cutting Issues

#### R-009 [critical] — Dangling `**Security paths:**` pointer [VERIFIED]

Three files reference a `**Security paths:**` block "in CLAUDE.md":
- `.claude/agents/architect.md:118` ("security-sensitive paths from CLAUDE.md `**Security paths:**`")
- `.claude/agents/reviewer.md:111` ("or `**Security paths:**` in CLAUDE.md")
- `.claude/skills/reviewing/SKILL.md:76` ("or a path in CLAUDE.md `**Security paths:**`")

`grep -n "Security paths" CLAUDE.md` returns nothing — the block does not exist. Currently the system silently falls back to hard-coded paths (`src/auth/`, `src/crypto/`, `src/security/`). This is **load-bearing for the security carve-out** in diff-size gating and the architect's surgical-context exception. If a project added an extra security-sensitive directory, the harness has no way to recognise it.

#### R-010 [major] — Dangling `COMPLIANCE_*` env-var reference [VERIFIED]

`architect.md:89` and `consultant.md:141` both use `COMPLIANCE_*` env-var presence as a scoring signal for the compliance binding constraint. No definition exists in the codebase. Same pattern as R-009 but lower stakes — the rule will only fire if a project happens to set such an env var.

#### R-011 [major] — Duplicated `<operating_constraints>` boilerplate across agents [VERIFIED]

All five agent files restate the same three rules:
- "Named teammate. No `Agent` tool. All hand-offs through the team lead."
- `Bash`: read-only only (variants on the same git/rg/wc list)
- `Write` only under … restricted paths

Lines used per agent: `analyst.md:21-32` (12), `architect.md:25-38` (14), `consultant.md:29-41` (13), `developer.md:40-48` (9), `reviewer.md:22-34` (13). Total: ~61 lines of duplication loaded into every invocation. CLAUDE.md has no `## Agent base constraints` block — perfect place to consolidate the universals.

#### R-012 [major] — Alignment table column-order disagreement [VERIFIED]

`templates/alignment.md:38` defines the table as `| Criterion | Result | Evidence | Note |` (four columns). `reviewer.md:170` renders `| Criterion | Evidence (file:line or symbol) | Result |` (three columns). The reviewer's output_format wins at runtime (it's what's emitted), but the template is the cited authority. One must be canonical.

#### R-013 [major] — Developer agent missing `skills:` declaration [VERIFIED]

`developer.md` (frontmatter, lines 1–13) declares `tools: Read, Edit, Write, Bash, Glob, Grep, SendMessage` and `model: sonnet` but no `skills:` field. Yet the agent writes via `templates/progress.md` (`developer.md:54`) — a template registered to `documenting` (`documenting/SKILL.md:32`). Either the developer should declare `skills: [documenting]` and load lazily, or the progress template should be inlined into the developer agent file.

#### R-014 [minor] — `<output_format>` blocks restate per-mode formats every turn [VERIFIED]

Architect (lines 191–227), consultant (lines 197–229), reviewer (lines 158–242) all render both/all modes' output formats in the `<output_format>` section. Per CLAUDE.md `## Turn discipline`, the agent emits its `<output_format>` block verbatim in `SendMessage` — so the unused mode's format is dead weight on every turn. Splitting `<output_format>` into mode-specific sub-blocks and rendering only the active one would save ~30–50 lines per multi-mode agent invocation.

#### R-015 [minor] — Pre-flight semantics restated per agent [VERIFIED]

CLAUDE.md `## Pre-flight protocol` (lines 62–93) defines the 5-check structure, ✓/⚠/✗ branching, and universal rules. Each agent's step-2 restates the per-check semantics (Inputs/Prior/Scope/Terms/Target meaning for that role). This is necessary specialisation, not pure duplication — but the framing prose ("Pre-flight (per CLAUDE.md `## Pre-flight protocol`):" repeated five times) plus the bullet structure could collapse into a one-line semantic table per agent.

#### R-016 [minor] — Token disambiguation cue scattered [VERIFIED]

`tokens.yaml:14-16` notes that `ARCHITECT REVIEW NEEDED` exists in two forms (in-artifact bracketed `[...]` from analyst, summary-line `...:` from architect's reviewer flag — actually no, the summary-line form is from analyst too). The reviewer agent does **not** emit an `ARCHITECT REVIEW NEEDED:` summary line — it emits `ARCHITECT AMENDMENT NEEDED:`. The naming is close enough that an LLM might confuse them on a fast read. `tokens.yaml:14-16` notes the disambiguation but the agents themselves don't restate it; cognitive load only.

---

## Dependencies and Relationships

```
                        team lead (router)
                              |
   +--------+---------+-------+--------+----------+
   |        |         |       |        |          |
analyst  consultant  architect  developer  reviewer
   |        |         |       |        |          |
   v        v         v       v        v          v
reports/  strategy/  adr/    src/    (no writes)  memory/
                     plans/  tests/
                     memory/ plans/
                             (status-line only)

skills (lazy-loaded per agent):
  documenting -> analyst, architect, consultant (and implicitly developer)
  reviewing   -> reviewer
  understanding -> consultant (auto), analyst/architect (deferred)

assets (referenced, not loaded into prompts):
  tokens.yaml   -> all agents, semantic reference
  mast.yaml     -> none at runtime (designer's lens only)
```

**What this depends on:** Claude Code's harness (TeamCreate, SendMessage, TaskOutput tools); the project's `artifacts/` directory structure; user discipline on relaying `approved` verbatim.

**What depends on this:** any project that adopts AISpec as its agent harness; the `artifacts/` directories at the project root.

---

## Risks and Unknowns

- **[RISK]** Dangling `**Security paths:**` references (R-009) — security carve-out logic silently degrades for any project whose security paths differ from the hard-coded defaults.
- **[RISK]** Alignment table column mismatch (R-012) — reviewer output and template disagree; a downstream consumer parsing either could break when the inconsistency is fixed.
- **[ASSUMPTION]** Read every target file in full; counted lines via `wc -l`. Did not run any LLM-level token-count tool — line count is the proxy for prompt-token cost, which is order-of-magnitude accurate but not exact.
- **[UNKNOWN]** Whether the user intends `developer` to load `documenting` lazily or to inline the progress template — R-013 is reported as a finding but the intent is unclear.

---

## Recommendations

1. **[ARCHITECT REVIEW NEEDED]** [P0 — structural] Define `**Security paths:**` in CLAUDE.md (or remove the references). Three load-bearing dependencies on a non-existent block. *Resolves R-009.* Files: `CLAUDE.md` (add block), `architect.md:118,161`, `reviewer.md:111`, `reviewing/SKILL.md:76`.

2. [P0 — structural] Consolidate `<operating_constraints>` boilerplate into a CLAUDE.md `## Agent base constraints` section; reduce each agent's `<operating_constraints>` to agent-specific deviations only. *Resolves R-011.* Saves ~40–50 lines per invocation across the team. Files: all five `.claude/agents/*.md`, `CLAUDE.md`.

3. [P1 — structural] Declare `skills: [documenting]` in `developer.md` frontmatter, OR inline the progress-template format directly into the developer agent file. Also add a closing-self-check bullet block to match the other four agents' structure. *Resolves R-013.* Files: `developer.md:1-13`, `developer.md:106-112`.

4. [P1 — tighten wording] Reconcile the alignment table column order. Pick the four-column form from `alignment.md:38` as canonical (it carries the `Note` column which is useful) and update `reviewer.md:170` to match. *Resolves R-012.* Files: `reviewer.md:170`, possibly `alignment.md:38`.

---

## Cost Hotspots (heaviest files ranked)

| Rank | File | Lines | Loaded when | Notes |
|---|---|---|---|---|
| 1 | `.claude/agents/reviewer.md` | 242 | Every reviewer invocation | Three modes' `<output_format>` all render; cross-check sub-flow loads even when not in cross-check mode |
| 2 | `.claude/agents/consultant.md` | 230 | Every consultant invocation | Both Discussion and Artifact mode instructions load every turn |
| 3 | `.claude/agents/architect.md` | 227 | Every architect invocation | Both Mode A and Amendment instructions load every turn |
| 4 | `.claude/agents/developer.md` | 178 | Every developer invocation | Includes the craftsmanship charter (~20 lines) |
| 5 | `.claude/skills/reviewing/templates/cross-check.md` | 145 | Cross-check mode only | Good — lazy-loaded |
| 6 | `.claude/skills/reviewing/SKILL.md` | 135 | Every reviewer invocation | Diff-size gating is here; load-bearing |
| 7 | `.claude/skills/documenting/templates/report.md` | 135 | Every analyst report write | The 135-line template is the analyst's bottleneck |
| 8 | `.claude/agents/assets/tokens.yaml` | 131 | Referenced semantically; only loaded when an agent reads it (rare) | Good — designer asset |
| 9 | `.claude/agents/analyst.md` | 130 | Every analyst invocation | Reasonable for pipeline-entry |
| 10 | `.claude/skills/documenting/SKILL.md` | 125 | Auto-loaded for analyst/architect/consultant | Frontmatter auto-load, body lazy |
| 11 | `.claude/skills/understanding/SKILL.md` | 125 | Auto on consultant; deferred on analyst/architect | Smallest skill body |

**Files >300 lines:** none. The recent optimisation effort (commits `57c2e4b`, `7bbee3b`) has clearly held the line on file size. The five agent files cluster in the 130–242 range and the heaviest skill template is 145.

**Auto-loaded per invocation per agent (approximate, body lines):**

| Agent | Auto-load | Approx lines | Notes |
|---|---|---|---|
| analyst | agent (130) + documenting SKILL.md (125) | ~255 | Templates load on demand |
| architect | agent (227) + documenting SKILL.md (125) | ~352 | Heaviest auto-load |
| consultant | agent (230) + documenting SKILL.md (125) + understanding SKILL.md (125) | ~480 | Two skills auto-load |
| developer | agent (178) | ~178 | No declared skill — see R-013 |
| reviewer | agent (242) + reviewing SKILL.md (135) | ~377 | |

**Boilerplate that fires when it shouldn't:** none flagged. CLAUDE.md correctly scopes pre-flight to entry turns only. MAST is correctly designer-only. Examples are correctly "read only if uncertain". The remaining waste is structural (mode multiplexing, restated boilerplate) rather than misfiring.

---

## Concrete Improvements (prioritized)

### P0 — must fix

1. **[ARCHITECT REVIEW NEEDED]** Define or remove `**Security paths:**`. Add to CLAUDE.md as a project-overridable block, e.g.:
   ```
   ## Security paths
   Paths whose changes always load `patterns.md` in full (Se1–Se3) and bypass small-gate skipping:
   - src/auth/
   - src/crypto/
   - src/security/
   ```
   Files: `CLAUDE.md` (add), `architect.md:118`, `architect.md:161`, `reviewer.md:111`, `reviewing/SKILL.md:76`.

2. Consolidate `<operating_constraints>` boilerplate into CLAUDE.md. Add a `## Agent base constraints` section, then reduce each agent's `<operating_constraints>` to agent-specific deltas only. Files: all five `.claude/agents/*.md`, `CLAUDE.md`.

### P1 — should fix

3. Fix `developer.md` skill declaration (R-013). Add `skills: [documenting]` to frontmatter; add closing-self-check bullet block matching the other four agents' structure. Files: `developer.md:1-13`, `developer.md:106-112`.

4. Reconcile alignment table column order (R-012). Pick `alignment.md:38` four-column form as canonical. Files: `reviewer.md:170`, possibly `alignment.md:38`.

5. Split multi-mode `<output_format>` into mode-specific sub-blocks; agent emits only the active one (R-014). Saves ~30–50 lines per architect/consultant/reviewer turn. Files: `architect.md:191-227`, `consultant.md:197-229`, `reviewer.md:158-242`.

6. Define or remove `COMPLIANCE_*` env-var convention (R-010). Either add to CLAUDE.md or replace with a generic "compliance directive in CLAUDE.md" reference. Files: `architect.md:89`, `consultant.md:141`.

### P2 — tighten wording

7. Trim `report.md` template to ≤100 lines — caps tables and worked-example pointer can move to a sibling note. Files: `documenting/templates/report.md`.

8. Tighten the craftsmanship charter in `developer.md` (lines 19–38) by 30%. The intent is load-bearing but prose can compress. Files: `developer.md:19-38`.

9. Reduce the architect's A5 binding-constraint scoring (lines 87–91) by promoting the medium-scoring signal list to a sibling reference asset loaded only when scoring is contested. Files: `architect.md:87-91`, possibly new `.claude/agents/assets/scoring.yaml`.

10. Add a one-line "token disambiguation cue" at the top of the architect's amendment section: explicitly distinguish `ARCHITECT REVIEW NEEDED` (analyst flag) from `ARCHITECT AMENDMENT NEEDED` (reviewer flag). R-016. Files: `architect.md`, near line 113.

11. Mode dispatch in `consultant.md:80` is a verb-list match — add a fallback ("if user request can be paraphrased as 'document this'") to widen robustness. Files: `consultant.md:79-82`.

---

## Overall System Score

**Weighted: 76.4%**

| Axis | Score | Driver |
|---|---|---|
| Efficiency | 78% | Pre-flight skip on continuation turns, lazy skill bodies, diff-size gating — strong; multi-mode files load both modes — weak |
| Token cost | 64% | Pre-flight compaction and lazy loads pull this up; restated boilerplate, multi-mode files, and triple-mode reviewer pull it down |
| Determinism | 86% | Strongest axis — exact-string verdict matching, numeric thresholds, typed IDs, off-LLM filename derivation. Reviewer at 90% is the high water mark |
| Consistency | 81% | Tokens align; dangling `**Security paths:**`, `COMPLIANCE_*`, and alignment-column drift drag the score |

**What would move the needle most:** the P0 consolidation (R-009, R-011) alone would lift Token cost from 64 → 72 and Consistency from 81 → 86, raising the overall to ~80%. The system's structural design is sound; the remaining gains are mostly cleanup.

---

## Glossary

- **Star topology** — routing pattern where all messages physically pass through a central node (the team lead) rather than directly between peers.
- **MAST** — Multi-Agent failure taxonomy from Cemri et al. (arXiv:2503.13657v2). 14 failure modes + 14 design rules.
- **Pre-flight protocol** — five-check entry-turn discipline (Inputs / Prior phase / Scope / Terms / Target) defined in CLAUDE.md.
- **Cross-check** — artifact↔artifact alignment pass between an ADR and its companion plan; fires once per pair before Phase 1, only if the architect escalates via `CROSS_CHECK_REQUESTED:`.
- **Mode A / Amendment mode** — the architect's two modes: greenfield tactical design vs surgical response to a reviewer's `ARCHITECT AMENDMENT NEEDED:`.
- **Discussion mode / Artifact mode** — the consultant's two modes: conversation only vs producing a strategic artifact in `artifacts/strategy/`.
- **SDR** — Strategic Decision Record. Consultant-owned, lives in `artifacts/strategy/decisions/`. Counterpart of an architect-owned tactical ADR.
- **Supersession** — ADR amendment pattern: write a new tiny ADR (`-r<N>` suffix) carrying only revised decisions; stamp the original with `**Superseded by:**` and freeze it.
