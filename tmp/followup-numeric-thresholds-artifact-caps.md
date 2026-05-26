# Follow-up — Numeric Thresholds: Artifact & Agent Caps

**Predecessor:** Suggestion 3 of the synthesis review (Pattern 7 — *Hard numeric
thresholds instead of adjectives*) from `tmp/findings-_synthesis.md`. The template-level
half of that suggestion has been applied to
[templates/agent-definition-template.md](../templates/agent-definition-template.md) and
[templates/skill-definition-template.md](../templates/skill-definition-template.md):

- A `## Convention: numeric thresholds over adjectives` block was added near the top of
  both templates.
- A universal cap (clarifying questions ≤5 per turn, one-batch, never one-at-a-time
  across turns) was inserted into the agent template's `<instructions>` step 2 and the
  skill template's `## Steps` step 1 guidance.
- Matching checklist lines were added to both templates.

What remains — and is **out of scope for the template pass** — is applying numeric caps
to the **specific artifacts** and **specific agent files** the synthesis named. That work
is this follow-up.

---

## Scope

Apply hard numeric caps to:

1. **Artifact templates** under `.claude/skills/documenting/templates/` (and the
   `reviewing` / `auditing` skill templates if applicable).
2. **The five agent files** under `.claude/agents/` (`analyst.md`, `architect.md`,
   `consultant.md`, `developer.md`, `reviewer.md`).
3. **`.claude/MEMORY.md`** size discipline.

Every cap below must be **observable** and **numeric** — the same rule the templates now
enforce on new authoring.

---

## Caps to introduce

### A. ADR (`.claude/skills/documenting/templates/adr.md`)

- **Body length cap.** Synthesis recommends one. Candidate: **≤400 lines** total,
  excluding code fences. Rationale: a 400-line ADR is already long for a single
  decision; past that, it usually wants splitting into two ADRs or extracting a design
  note. Currently no cap → ADRs can sprawl.
- **`Consequences` section: ≤N bullets per side** (Positive / Negative / Neutral). A
  10-bullet "Negative" list is the smell that the decision isn't actually decided.
  Candidate: ≤7 per side, with an explicit `(more in <linked-note>.md)` overflow path.
- **`Alternatives Considered`: ≤N alternatives.** Candidate: ≤5. More than 5 means the
  exploration belongs in an analyst report, not an ADR.

### B. Implementation plan (`.claude/skills/documenting/templates/plan.md`)

- **Phase count.** Candidate: ≤10 phases. Larger → split into two plans with a
  dependency link.
- **Phase length.** Candidate: each phase ≤80 lines (acceptance criteria + tasks + notes
  combined). Forces the architect to break compound phases.
- **Acceptance-criteria per phase.** Candidate: 3-8 criteria per phase. Below 3 → likely
  under-specified; above 8 → likely a compound phase.

### C. Analyst report (`.claude/skills/documenting/templates/report.md`)

- **Findings cap.** Candidate: ≤50 findings; if more apply, list the top 50 by severity
  and add a `(N more omitted — see <subset>.md)` overflow line. Matches spec-kit.
- **Per-finding length.** Candidate: ≤6 lines per finding (heading + ≤5 body lines).
  Anything longer wants its own sub-report.

### D. Consultant charter / context map / SDR / glossary

- **Charter length.** Candidate: ≤300 lines. Larger → likely conflating multiple bounded
  contexts.
- **Context map row count.** Candidate: ≤25 relationships. Past this the map stops being
  scannable; suggests sub-mapping.
- **Glossary entries per file.** Candidate: ≤50 terms per glossary file; split by
  bounded context past that.

### E. Reviewer output (`.claude/skills/reviewing/`)

- **Findings cap.** Candidate: ≤50 findings per phase review; overflow line if more
  apply. Already partially in the synthesis text.
- **Alignment table rows.** Candidate: ≤15 alignment criteria per phase. More → the
  phase is too large and should have been split by the architect.
- **Per-finding length.** Candidate: ≤8 lines (severity / location / signal /
  recommendation), to keep the verdict scannable.

### F. `.claude/MEMORY.md`

- **Byte cap.** Synthesis recommends formalising the existing "200 lines after
  truncation" note as a hard byte cap. Candidate: **≤16 KB**. Past this, the file's
  always-loaded cost outweighs its value; split into topical files referenced by the
  index.
- **Entries per topic.** Candidate: ≤20 per topic; merge older entries into a decisions
  log when exceeded.

### G. Per-agent caps (within each `.claude/agents/<name>.md`)

- **Analyst** — already has the 60-read BFS cap (synthesis confirms). Add: ≤50 report
  findings (mirrors D); ≤5 clarifying questions/turn (inherits from template).
- **Architect** — ≤10 plan phases, ≤7 consequences per ADR side, ≤5 alternatives per
  ADR (mirrors A/B).
- **Consultant** — ≤300-line charter, ≤25 context-map rows (mirrors D).
- **Developer** — ≤N tool-use loops per phase (candidate: ≤30 Read/Edit calls before
  pausing for a sanity check; matches GSD's "5 consecutive reads → analysis paralysis"
  pattern, scaled).
- **Reviewer** — ≤50 findings per phase, ≤15 alignment rows (mirrors E).

---

## Method

For each artifact template and each agent file, in one focused PR per file:

1. Pick the cap value. If the candidate above is wrong, pick a defensible alternative —
   the *principle* (numeric, not adjectival) is non-negotiable; the specific number is.
2. Insert the cap at the firing point — in the template's section where the bounded
   content is produced, or in the agent's `<completion_criteria>` for output caps.
3. Add an explicit **overflow path** — what happens when the cap is hit (`top-N + omitted
   line`, `split into a sibling file`, `escalate to user`). A cap without an overflow
   path is a hard fail mode.
4. Add a matching line to the relevant validation checklist.

---

## Non-goals

- **Do not** add caps to MAST-FM-classified anti-patterns; those use the inline
  `**Avoid (FM-x.x):**` cue mechanism, not numeric ceilings.
- **Do not** retrofit caps onto historical artifacts under `artifacts/`. The caps apply
  to new artifacts produced under the updated templates.
- **Do not** invent caps for things that aren't actually growing unbounded today; the
  list above is targeted, not exhaustive.

---

## Acceptance for this follow-up phase

- Every artifact template under `.claude/skills/documenting/templates/` carries at least
  one numeric cap with an explicit overflow path, or a documented justification for
  having none.
- Every agent file under `.claude/agents/` either inherits the template's clarifying-
  questions cap by reference or restates it with a tighter local value.
- `.claude/MEMORY.md` (or its loader) enforces or warns at the byte cap.
- `grep -E '(concise|brief|appropriate length|manageable|reasonable|as needed)' \
  .claude/agents .claude/skills templates` returns no operational uses (banned
  adjectives in caps).
