# Template: Architectural Decision Record (ADR)

**Artifact path:** `artifacts/adr/NNNNN-<derived-short-title>.md`

NNNNN is a zero-padded 5-digit integer, incremented from the highest existing ADR number. If no ADRs exist yet, start at `00001`.

Re-scan `artifacts/adr/` for the highest number **immediately before writing the file**, not at the start of the invocation: this minimises (but does not eliminate) the race window when two architect invocations run in parallel. If the target filename already exists when you go to write it, increment and retry up to 3 times. After 3 collisions, stop and surface the conflict to the user.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| Total body | **≤400 lines** (excluding fenced code blocks) | Past 400 lines, split the decision into two ADRs linked by `**Supersedes / supersedes:**` headers, or extract reasoning into a sibling design note `artifacts/adr/notes/NNNNN-<title>.md` and link it from `## Context`. |
| `## Consequences` per side (`Gains` / `Costs` / `Risks`) | **≤7 bullets per side** | At 7+, the decision isn't actually decided, so fold related bullets, or move the long tail to `artifacts/adr/notes/NNNNN-<title>.md` with `(more in <note>.md)` on the last bullet. |
| `## Alternatives Considered` | **≤5 alternatives** | Past 5, the exploration belongs in an analyst report, not an ADR: link the report under `## Context` and keep the top 5 here. |

These caps are checkable across runs. Adjective-only ceilings ("be concise", "keep it short") are not permitted.

---

## Identifiers

The ADR slug (`ADR-NNNNN`) is itself the primary identifier, so single-decision ADRs need no further ID. For an ADR that records multiple distinct sub-decisions in one document, each carries a `D-###` ID; for risks listed under `## Consequences > Risks`, each carries a `RISK-###` ID.

- **D-###**: sub-decisions inside an ADR. Use only when the ADR genuinely captures more than one decision; prefer one decision per ADR.
- **RISK-###**: entries under `## Consequences > Risks`. Always numbered, even when the ADR has a single decision, so plans and reviewers can cite them.
- Numbering: zero-padded to 3 digits, encounter order, dense at first write, sparse after edits.
- **Stability:** never re-number after publication. To withdraw an entry, append `[withdrawn]` and leave the ID in place. Re-numbering a referenced ID is a critical violation.
- Cross-artifact references use the form `<adr-short-title>#<ID>` (e.g. `event-store#D-002`, `event-store#RISK-003`). The short-title is the ADR filename without the numeric prefix and `.md` extension (`00007-event-store.md` → `event-store`).
- Severity (where used) sits in square brackets after the ID: `**RISK-002** [major] vendor outage propagates ...`. Severity values come from the severity table below; never paraphrase.

## Severity

| Severity | Means |
|---|---|
| critical | Blocks the decision's adoption; must resolve before status moves past Proposed. |
| major | Significant risk; mitigation required before final approval. |
| minor | Manageable risk; mitigation is best-effort. |
| pre-existing | Risk inherent to the baseline, not introduced by this decision; record but do not block. |

---

## File template

```
# ADR-NNNNN: Title

**Status:** Proposed
**Date:** YYYY-MM-DD

## Context
What forced this decision. State the binding constraints explicitly. 2 to 4 sentences.

## Decision
One paragraph. The chosen approach and why it satisfies the constraints.

## Consequences
**Gains:** 2 to 4 bullet points stating what improves.
**Costs:** 2 to 4 bullet points stating what gets harder or more expensive.
**Risks:** 2 to 4 bullet points, each led by `**RISK-###** [<severity>]`, each stating what could go wrong plus one mitigation.

## Alternatives Considered
### Alternative: name
Ruled out because: one sentence.
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/architect`
**Index file:** `.claude/agent-memory/architect/MEMORY.md`
**Memory file path:** `.claude/agent-memory/architect/adr-NNNNN-<derived-short-title>.md`

If the memory directory does not exist, create it. If `MEMORY.md` does not exist, create it with the heading `# Architect Memory` on the first line.

```
---
name: adr-NNNNN-<derived-short-title>
description: <one sentence, used to judge relevance in future sessions>
metadata:
  type: project
---
ADR-NNNNN chose <approach> for <system/component>.
**Why:** <the binding constraint that made this the right call>.
**How to apply:** <what future decisions this constrains or informs>.
**Artifacts:** artifacts/adr/NNNNN-<derived-short-title>.md, artifacts/plans/NNNNN-<derived-short-title>.md
```

**Index entry.** Append one line to `MEMORY.md`:

```
- [ADR-NNNNN: Title](adr-NNNNN-<derived-short-title>.md): <one-line hook>
```

---

## Worked example

See `../examples/adr.md`, read only if uncertain about tone, depth, or section shape.
