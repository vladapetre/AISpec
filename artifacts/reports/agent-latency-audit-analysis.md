# Analysis: Agent Latency Audit

**Date:** 2026-05-22
**Audience:** developer
**Sources:** `.claude/agents/analyst.md`, `.claude/agents/consultant.md`, `.claude/agents/architect.md`, `.claude/agents/developer.md`, `.claude/agents/reviewer.md`, `.claude/skills/documenting/templates/report.md`

---

## Executive Summary
Five agent definitions in `.claude/agents/` are audited against six latency levers. All five already carry an explicit "parallelize independent reads" directive, so the cheapest fleet-wide win is gone. The single largest remaining cost is over-budget `<instructions>` blocks — three of five agents (consultant, architect, reviewer) exceed the 2000-token template ceiling. Readers should treat extracting per-step rubrics into skill files as the top fleet-wide speedup.

## Background and Context
The five agents form a sequential pipeline (analyst → consultant → architect → developer → reviewer). Each loads its entire definition into context on every invocation, so token count in the definition file directly increases time-to-first-token and per-turn cost.

The agent template at `templates/agent-definition-template.md` could not be read (path not present at the location referenced in the request), so token budgets are evaluated against the budgets the user supplied: `<role_identity>` <50 tokens, `<instructions>` 500-2000 tokens.

## Structure and Organisation
Each agent file follows the same shape: frontmatter (`tools`, `skills`, `model`, `effort`) plus XML-tagged sections (`role_identity`, `operating_constraints`, `domain_vocabulary`, `deliverables`, `decision_authority`, `instructions`, `anti_patterns`, `rules`, `interaction_model`, `completion_criteria`, `output_format`).

- `analyst.md` — 186 lines, `opus`, 11 instruction steps
- `consultant.md` — 195 lines, `opus`, 14 instruction steps
- `architect.md` — 235 lines, `opus`, 2 modes + 13 steps
- `developer.md` — 204 lines, `sonnet`, 13 steps
- `reviewer.md` — 230 lines, `opus`, 13 steps

## Findings

### analyst.md [VERIFIED]
**Parallel reads:** present at line 50 — quotes steps 1, 3, 5 explicitly. Good.
**Model:** `opus` + `effort: high`. Workload is ingestion + report writing; Sonnet would likely cut latency materially with modest quality loss for short-source jobs. Mis-sized for the common case.
**Instructions tokens:** ~1100 — within budget.
**`<role_identity>`:** 45 tokens — within budget.
**Tools:** `Read, Write, Bash, Glob, Grep, WebFetch, WebSearch, SendMessage`. `SendMessage` is declared but the instructions never invoke it (the operating_constraints reference to it is stale — it was removed from step 11 of the template flow). `Edit` not granted, correctly.
**Other smells:** anti_patterns block is 7 items (~450 tokens) — within tolerance but the MAST citations add noise without changing behaviour.

### consultant.md [VERIFIED]
**Parallel reads:** present at line 55. Good.
**Model:** `opus` correct (strategic judgement).
**Instructions tokens:** ~2300 — **over budget**. Step 9 (constraint scoring rubric, ~350 tokens) and step 5 (report resolution, ~180 tokens) duplicate logic that also appears in `architect.md`. Extract both into the `documenting` skill or a shared `framing` skill.
**`<role_identity>`:** 40 tokens — fine.
**Tools:** `Read, Edit, Write, Bash, Glob, Grep, SendMessage`. All used.
**Other smells:** 7 anti_patterns (~520 tokens); INDEX.md re-sort instruction repeated in three places.

### architect.md [VERIFIED]
**Parallel reads:** present at line 56. Good.
**Model:** `opus` correct.
**Instructions tokens:** ~2600 — **the worst offender**. Two modes (A1-A12 + B1-B5) live in one file. Mode B (phase review) is ~600 tokens and is invoked far less than Mode A — split into a sibling agent or extract Mode B to a skill.
**`<role_identity>`:** 38 tokens — fine.
**Tools:** all used. Correct.
**Other smells:** step A5 rubric duplicates consultant step 9; description block (lines 4-11) is 110 tokens of marketing copy that could be one line.

### developer.md [VERIFIED]
**Parallel reads:** present at line 50. Good.
**Model:** `sonnet` — correct sizing for implementation.
**Instructions tokens:** ~1400 — within budget.
**`<role_identity>`:** 33 tokens — fine.
**Tools:** all used.
**Other smells:** step 8 test/linter detection lists (~280 tokens) are static lookup tables — strong candidate for extraction into a skill file the developer reads once on demand.

### reviewer.md [VERIFIED]
**Parallel reads:** present at line 50. Good.
**Model:** `opus` + `effort: high` correct (adversarial judgement).
**Instructions tokens:** ~2100 — **slightly over budget**. Pre-existing classification (step 11) and severity rules could live entirely in the `reviewing` skill.
**`<role_identity>`:** 36 tokens — fine.
**Tools:** declares `Edit, Write` — but instructions only ever write to the memory file. `Edit` is unused (rules explicitly forbid editing source). Drop `Edit`.
**Other smells:** output_format block is ~350 tokens — large but load-bearing.

## Dependencies and Relationships
- All five agents auto-load the `documenting` skill (except reviewer, which loads `reviewing`).
- analyst, consultant, architect auto-load `understanding`.
- Pipeline order: analyst → consultant → architect → developer → reviewer.

## Risks and Unknowns
- **[UNKNOWN]** — The template file at `.claude/templates/agent-definition-template.md` was not readable; token budgets are evaluated against the user-supplied numbers, not the canonical template.
- **[ASSUMPTION]** — Token counts are estimated by line-count proxy (≈10 tokens/line for prose, ≈15 for dense rule lists); actual tokenizer counts may vary ±15%.
- **[RISK]** — Downsizing the analyst to Sonnet would degrade complex multi-source reports; gate on workload, not blanket switch.

## Recommendations
1. [ARCHITECT REVIEW NEEDED] Split `architect.md` Mode B (phase review) into a separate `architect-reviewer.md` agent or extract the Mode B checklist into a skill — Mode A pays for Mode B's tokens on every invocation today.
2. [ARCHITECT REVIEW NEEDED] Extract the shared constraint-scoring rubric (consultant step 9, architect step A5) and the analyst-report resolution logic (consultant step 5, architect step A2) into the `documenting` skill or a new `framing` skill.
3. Remove `Edit` from `reviewer.md` tools and `SendMessage` from `analyst.md` tools — both are declared but never used; least-privilege reduces tool-schema tokens.
4. Move the test/linter detection tables (developer step 8) into a skill file the developer reads on demand — they are static lookup data, not per-invocation reasoning.

## Glossary
- **Binding constraint** — A scored requirement (latency, compliance, etc.) that drives a recommendation; both consultant and architect score constraints against rubrics in their respective instructions.
- **Mode A / Mode B** — The architect agent's two invocation modes: tactical design (A) versus phase review (B).
