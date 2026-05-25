# Template: Implementation Plan

**Artifact path:** `artifacts/plans/NNNNN-<derived-short-title>.md` (inherits the paired ADR's prefix), or `artifacts/plans/<derived-short-title>.md` when no ADR exists yet.

The `<derived-short-title>` must match the one used in the companion ADR for this decision. The `NNNNN-` prefix is the paired ADR's number — the filename script derives it automatically by scanning `artifacts/adr/` for a matching stem. Write the ADR first so the plan picks up the correct prefix.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| Phase count | **3–10 phases** (the template's existing 3–5 stays the default; the hard ceiling is 10) | Past 10, split into two plans linked by `**Depends on:**` headers (e.g. `migration-part-1.md` and `migration-part-2.md`). |
| Per-phase body | **≤80 lines** (`Changes` + `Done when` + notes combined, excluding the anchor and `[IRREVERSIBLE]` block) | Past 80 lines, the phase is compound — split into two sequential phases. |
| Acceptance criteria per phase (`Done when` bullets) | **3–8 criteria** | Below 3: phase is under-specified — add the missing conditions. Above 8: phase is compound — split. |
| `## Open Questions` | **≤10 entries** | Past 10, the plan is not yet writable — return to the architect step that surfaces blocking unknowns; resolve before publishing. |

Numeric, not adjectival. The reviewer enforces these on alignment.

---

## Identifiers

Acceptance criteria carry stable IDs so the reviewer can cite them in alignment tables, and the developer can quote them in phase summaries, without paraphrasing.

- **T-<phase>.<seq>** — one ID per `Done when:` bullet. Phase-namespaced so adding or removing a phase in the middle of the plan does not renumber criteria in unrelated phases. Examples: `T-1.1`, `T-1.2`, `T-2.1`.
- **OQ-###** — entries under `## Open Questions`. Zero-padded to 3 digits, encounter order.
- Numbering: dense at first write within each phase; sparse after edits.
- **Stability:** never re-number after the plan is published. To withdraw a criterion, append `[withdrawn]` and leave the ID in place. Re-numbering a `T-<phase>.<seq>` that another artifact (alignment table, phase summary, developer memory) references is a critical violation.
- Cross-artifact references use the form `<plan-short-title>#T-<phase>.<seq>` (e.g. `event-store#T-2.3`) or `<plan-short-title>#OQ-001`.
- A plan's short-title matches the ADR's short-title and the plan filename without `.md`.
- Adding a phase between existing phases is allowed — number the new phase with the next integer (e.g., inserting after Phase 2 makes the new phase Phase 6 if Phases 3-5 exist, or Phase 3 only if no later phases exist) rather than re-numbering. The lexical order of phase numbers no longer matches execution order in that case — add a `**Execution order:**` line at the top of `## Phases` listing the phases in execution order.

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
Each phase is independently shippable. List in execution order. Produce between 3 and 10 phases (default 3–5). If the work is too small for 3 phases, split the smallest unit of change into setup, implementation, and validation. If the work fits in 3–5, prefer that range; expand to 6–10 only when phases would otherwise be compound. If the work exceeds 10 phases, split into two plans per the overflow path in the Caps table.

### Phase N — Name
**Changes:** what is modified or created.
**Done when:** acceptance criteria, stated as observable facts. Each criterion is a bullet led by `**T-N.<seq>**`:
- **T-N.1** Observable fact one.
- **T-N.2** Observable fact two.
<!-- status:phase-N -->
**[IRREVERSIBLE]** (include this block only if the phase contains irreversible steps, and name them)

## Open Questions
- **OQ-001** Question. Owner: `@username` | `unassigned` | `<agent-name>`.
```

---

## Notes

- Every hard-to-reverse step inside a phase must be marked `[IRREVERSIBLE]` inline.
- Plans are always paired with an ADR. Write both in the same invocation.
- Architect memory for plans is recorded in the ADR memory entry (see `adr.md` template). Developer plan-progress memory uses `progress.md` — separate concern.
- Every phase must include the `<!-- status:phase-N -->` anchor on its own line immediately after the **last `**T-N.<seq>**` bullet** of that phase's `**Done when:**` block (see the File template above for placement). The developer agent inserts `**Status: Complete**` on the line immediately following this anchor when the phase is approved.

---

## Worked example

See `../examples/plan.md` — read only if uncertain about phase granularity, acceptance criteria shape, or scope wording.
