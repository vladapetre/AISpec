# Template: Design Record

**Artifact path:** `artifacts/plans/NNNNN-<derived-short-title>.md`

One file per feature carrying decisions AND phases — it replaces the former ADR + plan
pair for feature work. Derive the stem with `node filename.mjs design "<subject>"`; the
`NNNNN` sequence is scanned across BOTH `artifacts/adr/` and `artifacts/plans/` so a new
record never collides with a legacy pair's number. Run the script — do not derive by hand.

**Legacy detector.** A file in `artifacts/plans/` carrying a `**Governing ADR:**` line is
a legacy plan and follows `plan.md` + `adr.md`; a Design Record never carries that line.
Legacy pairs are frozen history — never convert one.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| Total body | **≤400 lines** (excluding fenced code blocks) | Past 400 lines, the feature is two features: split into two records linked by `**Depends on:**` headers. |
| `## Decisions` | **≤8 decisions**, per-decision body **≤12 lines** | Past 8, the design is strategic or compound: escalate to the consultant, or split the record. |
| Phase count | **1 to 10 phases** (small work legitimately takes 1) | Past 10, split into two records linked by `**Depends on:**`. |
| Per-phase body | **≤80 lines** (`Changes` + `Done when` + notes, excluding anchor and `[IRREVERSIBLE]` block) | The phase is compound: split it into two sequential phases. |
| Acceptance criteria per phase | **3 to 8 criteria** | Below 3: under-specified, add the missing conditions. Above 8: compound, split the phase. |
| `## Open Questions` | **≤10 entries** | Past 10, the record is not writable yet: resolve blocking unknowns first. |
| `## Revision log` entry | **≤30 words** | Detail belongs in the revised decision body, not the log line. |

Numeric, not adjectival. The reviewer enforces the phase caps on alignment; `lint.write`
enforces the revision protocol.

---

## Identifiers

- **D-###**: one per decision under `## Decisions`. Zero-padded to 3 digits, encounter order.
- **RISK-###**: risk bullets inside a decision, always numbered so phases and reviewers can cite them.
- **T-<phase>.<seq>**: one per `Done when:` bullet, phase-namespaced (`T-1.1`, `T-2.3`).
- **OQ-###**: entries under `## Open Questions`.
- **Stability:** never re-number after publication. Withdraw with `[withdrawn]`, leave the ID in place. Re-numbering a referenced ID is a critical violation.
- Cross-artifact references: `<short-title>#D-002`, `<short-title>#T-2.3` — the short-title is the filename without prefix and `.md`.
- Severity in square brackets after the ID, values from the table below, never paraphrased.

## Severity

| Severity | Means |
|---|---|
| critical | Blocks adoption; must resolve before implementation starts. |
| major | Significant risk; mitigation required before final approval. |
| minor | Manageable risk; mitigation is best-effort. |
| pre-existing | Inherent to the baseline, not introduced by this design; record but do not block. |

---

## Revision protocol

Amendments edit this file **in place** — there are no supersession files and no
consolidation. Three moves, all three mandatory, mechanically checked by `lint.write`
against the git-tracked version:

1. Edit the decision body under its `### D-###` heading.
2. Bump the heading's revision marker: `### D-002: Name` → `### D-002 (r2): Name`
   (no marker means r1; markers only ever increase).
3. Append one line to `## Revision log`: `- rN YYYY-MM-DD — D-002: <what changed>; <why>`.

A `D-###` body that differs from the tracked version without a bumped marker is a
bounced write. Git history is the byte-exact archive; the Revision log is the
reader-facing summary that replaces the old `-rN` file chain. Phases follow their own
existing rules (stamps via `plan-status.mjs`; inserted phases take the next integer and
an `**Execution order:**` line — see `plan.md` Identifiers, which apply unchanged).

---

## File template

```
# Design Record: Title

**Status:** Proposed
**Date:** YYYY-MM-DD
**Ticket:** <id or link, or _none_>

## Problem
What forces this work, and the binding constraints. 2 to 5 sentences.

## Decisions
### D-001: Name
**Decision:** one paragraph — the chosen approach and why it satisfies the constraints.
**Instead of:** <strongest alternative> — ruled out because <one sentence>.
**Risks:** (omit when none)
- **RISK-001** [<severity>] what could go wrong, plus one mitigation.

## Scope
**In scope:** bullet list.
**Out of scope:** bullet list.

## Phases
Each phase is independently shippable. List in execution order. Small work legitimately
takes 1 phase; prefer 3 to 5 for anything with distinct setup/implementation/validation
stages; past 10, split the record.

### Phase N: Name
**Touch set:** every file this phase reads or edits, one repo-relative path per line,
each with a three-to-six-word note on why it is in the set. `_None (new files only)_`
when the phase creates everything it needs, and name those new paths under **Changes**.
- `<module>/<layer>/<Entity>.<ext>` — holds the state machine
**Changes:** what is modified or created.
**Done when:** acceptance criteria, stated as observable facts:
- **T-N.1** Observable fact one.
- **T-N.2** Observable fact two.
<!-- status:phase-N -->
**[IRREVERSIBLE]** (only if the phase contains irreversible steps; name them)

## Open Questions
- **OQ-001** Question. Owner: `@username` | `unassigned` | `<agent-name>`.

## Revision log
_(empty at first write)_
```

---

## Notes

- **The touch set is the architect's job, not the developer's** — same rule and same
  reasoning as `plan.md`: the writer just read the source; the reader should pay zero
  searches for a mapped phase.
- Every hard-to-reverse step inside a phase is marked `[IRREVERSIBLE]` inline.
- The `<!-- status:phase-N -->` anchor sits on its own line immediately after the last
  `**T-N.<seq>**` bullet; the developer stamps `**Status: Complete**` after it via
  `plan-status.mjs stamp`, never by hand.
- A decision that constrains future features beyond this one (a standing pattern, a
  technology commitment) is promoted: record it as a standing ADR in `artifacts/adr/`
  per `adr.md`, and cite it from `## Problem`. Promotion is rare by design.

---

## Memory format

**Memory directory:** `.claude/agent-memory/architect`
**Index file:** `.claude/agent-memory/architect/MEMORY.md`
**Memory file path:** `.claude/agent-memory/architect/adr-NNNNN-<derived-short-title>.md`
(the `adr-` prefix is kept for design records — it is a registered memory kind in
`hooks/lib/ownership.mjs`, and the architect's decision memory is one sequence either way)

```
---
name: adr-NNNNN-<derived-short-title>
description: <one sentence, used to judge relevance in future sessions>
metadata:
  type: project
---
Design Record NNNNN chose <approach> for <system/component>.
**Why:** <the binding constraint that made this the right call>.
**How to apply:** <what future decisions this constrains or informs>.
**Artifacts:** artifacts/plans/NNNNN-<derived-short-title>.md
```

**Index entry.** Append one line to `MEMORY.md`:

```
- [DR-NNNNN: Title](adr-NNNNN-<derived-short-title>.md): <one-line hook>
```

---

## Worked example

None yet. `../examples/plan.md` covers phase granularity and criteria shape;
`../examples/adr.md` covers decision tone and depth. Read either only if uncertain.
