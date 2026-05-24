# Template: Implementation Plan

**Artifact path:** `artifacts/plans/<derived-short-title>.md`

The `<derived-short-title>` must match the one used in the companion ADR for this decision.

---

## File template

```
# Plan: Title

## Problem
One sentence: what are we solving and why now.

## Scope
**In scope:** bullet list.
**Out of scope:** bullet list.

## Phases
Each phase is independently shippable. List in execution order. Produce between 3 and 5 phases — no fewer, no more. If the work is too small for 3 phases, split the smallest unit of change into setup, implementation, and validation. If the work exceeds 5 phases, merge the most closely related phases.

### Phase N — Name
**Changes:** what is modified or created.
**Done when:** acceptance criteria, stated as observable facts.
<!-- status:phase-N -->
**[IRREVERSIBLE]** (include this block only if the phase contains irreversible steps, and name them)

## Open Questions
- Question. Owner: `@username` | `unassigned` | `<agent-name>`.
```

---

## Notes

- Every hard-to-reverse step inside a phase must be marked `[IRREVERSIBLE]` inline.
- Plans are always paired with an ADR. Write both in the same invocation.
- Architect memory for plans is recorded in the ADR memory entry (see `adr.md` template). Developer plan-progress memory uses `progress.md` — separate concern.
- Every phase must include the `<!-- status:phase-N -->` anchor on its own line directly after the `**Done when:**` line. The developer agent inserts `**Status: Complete**` immediately after this anchor when the phase is approved.

---

## Worked example

See `../examples/plan.md` — read only if uncertain about phase granularity, acceptance criteria shape, or scope wording.
