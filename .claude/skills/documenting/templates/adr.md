# Template: Architectural Decision Record (ADR)

**Artifact path:** `artifacts/adr/NNNNN-<derived-short-title>.md`

NNNNN is a zero-padded 5-digit integer, incremented from the highest existing ADR number. If no ADRs exist yet, start at `00001`.

Re-scan `artifacts/adr/` for the highest number **immediately before writing the file**, not at the start of the invocation — this minimises (but does not eliminate) the race window when two architect invocations run in parallel. If the target filename already exists when you go to write it, increment and retry up to 3 times. After 3 collisions, stop and surface the conflict to the user.

---

## File template

```
# ADR-NNNNN: Title

**Status:** Proposed
**Date:** YYYY-MM-DD

## Context
What forced this decision. State the binding constraints explicitly. 2–4 sentences.

## Decision
One paragraph. The chosen approach and why it satisfies the constraints.

## Consequences
**Gains:** 2–4 bullet points — what improves.
**Costs:** 2–4 bullet points — what gets harder or more expensive.
**Risks:** 2–4 bullet points — what could go wrong, one mitigation per risk.

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
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
ADR-NNNNN chose <approach> for <system/component>.
**Why:** <the binding constraint that made this the right call>.
**How to apply:** <what future decisions this constrains or informs>.
**Artifacts:** artifacts/adr/NNNNN-<derived-short-title>.md, artifacts/plans/<derived-short-title>.md
```

**Index entry** — append one line to `MEMORY.md`:

```
- [ADR-NNNNN: Title](adr-NNNNN-<derived-short-title>.md) — <one-line hook>
```

---

## Worked example

See `../examples/adr.md` — read only if uncertain about tone, depth, or section shape.
