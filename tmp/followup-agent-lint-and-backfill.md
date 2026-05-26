# Follow-up — Agent Lint Script + Existing-Agent Backfill

**Predecessor:** Suggestion 6 of the synthesis review (Pattern 1 — *Fixed agent/skill
section skeleton*) from `tmp/findings-_synthesis.md`. The skeleton is already defined in
[templates/agent-definition-template.md](../templates/agent-definition-template.md);
this follow-up locks it with a lint script and migrates the existing agents.

**Status:** Done — 2026-05-24. Lint shipped at [scripts/lint-agents.mjs](../scripts/lint-agents.mjs),
wired up as `npm run lint:agents`. The corpus was already template-conformant from prior
commits (`update agents, skills, templates`, `update document templates`) so the
backfill side reduced to running lint and confirming zero errors across all 5 agents,
3 skills, and both templates.

---

## Why deferred

The current `.claude/agents/*.md` files (`analyst`, `architect`, `consultant`,
`developer`, `reviewer`) predate the template changes applied in this review
(Suggestions 2 + 3 + 4). They all still:

- Carry `<anti_patterns>` blocks (Suggestion 2 dropped that section).
- Lack the structured pre-flight step at `<instructions>` step 2 (Suggestion 4 added it).
- May reference `templates/assets/mast.yaml` / `tokens.yaml` rather than the new
  `.claude/agents/assets/` paths.
- May use adjective-only caps where Suggestion 3 now requires numeric ones.

Building a lint against the new template before the corpus conforms produces a tool
that reports only known-pending failures. Bundling lint + backfill in one phase means
each migrated agent PR turns lint green for that file — the lint catches drift, not
known TODO.

---

## Scope

Two coupled deliverables:

1. **Lint script** that mechanically validates every `.claude/agents/*.md` (and the
   templates themselves) against the canonical skeleton and the rules added by
   Suggestions 1-4.
2. **Backfill** of the 5 existing agent files to the new template.

These ship together, one PR per agent (5 PRs total) plus one PR that introduces the
lint and the first migrated agent.

---

## Lint — what it checks

Single Node.js script under `scripts/lint-agents.mjs`, zero deps, runs via
`npm run lint:agents`. Scans `.claude/agents/*.md` and reports per-file findings.

### Skeleton (Suggestion 6 / Pattern 1)

- Frontmatter present and parseable; required keys: `name`, `description`, `tools`,
  `model`. Optional: `skills`, `effort`, `memory`, `color`.
- `name` matches the filename without `.md`.
- Body contains the 9 tags in this exact order, each opened and closed:
  `<role_identity>` → `<operating_constraints>` → `<domain_vocabulary>` →
  `<deliverables>` → `<decision_authority>` → `<instructions>` → `<rules>` →
  `<interaction_model>` → `<completion_criteria>` → `<output_format>`.
- No stray outer wrapper tag. Last non-blank line is `</output_format>`.
- **`<anti_patterns>` tag must not appear** (Suggestion 2 — coverage moved to inline
  `**Avoid (FM-x.x):**` cues).

### Pre-flight (Suggestion 4)

- `<instructions>` step 2 (or 3 if a memory-load step is at 1) is the structured
  pre-flight: contains the 5 fixed bullets `Inputs exist`, `Prior phase reviewed`,
  `Scope`, `Terms current`, `Target identified`, and the `Result: PROCEED|ASK|STOP`
  output block.

### Inline anti-patterns (Suggestion 2)

- Every inline `**Avoid (FM-x.x):**` line cites an FM that exists in
  `.claude/agents/assets/mast.yaml` under `failure_modes_detail.FM-x.x`. Citing an FM
  with no entry in that file is an error.
- Lint also reports `failure_modes_detail` entries that are not cited by any agent
  (dead detail — warning, not error).

### Numeric caps (Suggestion 3)

- No adjective-only caps in agent prose. Regex check on
  `concise|brief|appropriate length|manageable|reasonable|as needed|few|several` in
  contexts that look like caps (within an `IF`, `OUTPUT:`, or `<completion_criteria>`
  line). Flag as warning; the author can suppress with an inline `<!-- lint:adj-ok -->`
  comment if the usage isn't a cap.
- Clarifying-questions cap of 5 per turn present in the pre-flight step.

### Path references (Suggestion 2, file move)

- No reference to the old `templates/assets/mast.yaml` or `templates/assets/tokens.yaml`
  paths. Must use `.claude/agents/assets/...`.

### Skill descriptions (Suggestion 1 — extends lint to `.claude/skills/*/SKILL.md`)

- `description` field is ≤1024 characters.
- `description` contains the literal phrase `Use this skill when` (the trigger
  sentence).
- Block scalar (`>`) format used.

---

## Lint — what it does NOT check

- **Content quality.** Lint enforces structure, not domain correctness. A
  `<role_identity>` block that says "You are a banana" is structurally valid.
- **`<domain_vocabulary>` term count** (15-30 target). Counting commas/bullets across
  arbitrary formatting is noisy; left to PR review.
- **MAST FM coverage adequacy.** "Does this agent guard the right FMs?" is a judgment
  call.
- **Token budgets.** No tokenizer dep; left to PR review.

---

## Where it lives

```
scripts/
  lint-agents.mjs          # the lint
  README.md                # one-paragraph usage
```

`package.json` gains:

```json
"scripts": {
  "lint:agents": "node scripts/lint-agents.mjs"
}
```

Optional later integration (out of scope for the first PR):

- `.claude/hooks/pre-commit` hook that runs the lint on staged agent/skill files.
- GitHub Actions workflow.

---

## Migration plan for the 5 existing agents

One PR per agent. For each:

1. Read the current agent file.
2. Remove the `<anti_patterns>` block. For each pattern that block enumerated,
   determine where it belongs — most fold into inline `**Avoid (FM-x.x):**` lines on
   the relevant `<instructions>` step or `<rules>` invariant.
3. Add the structured pre-flight step at `<instructions>` step 2 (or step 3 if a
   memory-load step is at 1). Fill the 5 bullets with the agent-specific content per
   the table in Suggestion 4's design.
4. Backfill `failure_modes_detail` entries in
   [.claude/agents/assets/mast.yaml](../.claude/agents/assets/mast.yaml) for every FM
   the agent now cites inline that doesn't yet have a detail entry. (FM-1.1 and
   FM-3.4 are already there.)
5. Update any path references to use `.claude/agents/assets/` for `mast.yaml` /
   `tokens.yaml`.
6. Replace any adjective-only caps with numeric ones; inherit the 5-question cap from
   the pre-flight.
7. Run `npm run lint:agents` — must come back clean for the migrated file.

Suggested migration order (lowest blast radius first):

1. `consultant.md` — produces strategy artifacts only; downstream impact is limited.
2. `analyst.md` — read-heavy; produces reports.
3. `reviewer.md` — read-only; verdict tokens already structured.
4. `architect.md` — produces ADRs + plans; impacts developer.
5. `developer.md` — last; depends on the architect's migrated plan shape.

---

## Acceptance for this follow-up phase

- `scripts/lint-agents.mjs` exists, runs via `npm run lint:agents`, and reports the
  checks above.
- All 5 agent files in `.claude/agents/` pass lint with zero errors.
- Every FM cited by an inline `**Avoid:**` line has a `failure_modes_detail` entry in
  `mast.yaml`.
- `templates/agent-definition-template.md` and
  `templates/skill-definition-template.md` themselves pass lint (the templates' worked
  examples must be structurally valid).
- The follow-up files [tmp/followup-numeric-thresholds-artifact-caps.md](followup-numeric-thresholds-artifact-caps.md)
  and [tmp/followup-artifact-indexes.md](followup-artifact-indexes.md) remain
  unaddressed by this phase — they have their own triggers.

---

## Non-goals

- Linting per-file token budgets (no tokenizer in this script).
- Auto-fixing violations (lint reports; humans fix).
- Cross-validating agent files against `tokens.yaml` token usage (separate follow-up
  if needed).
- Pre-commit / CI integration (optional later phase).
