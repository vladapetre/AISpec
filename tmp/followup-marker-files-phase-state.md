# Follow-up — Marker Files for Phase State

**Predecessor:** Suggestion 7 of the synthesis review (Pattern 6 — *Filesystem-as-state-machine: marker files + status YAML*) from `tmp/findings-_synthesis.md`.

**Status:** **Scrapped on 2026-05-24.** AISpec's phase state has a single writer (the developer agent) and no concurrent racers. Marker files solve a problem AISpec does not have, and they would fragment status away from the plan file where the architect and reviewer already read it. Do not revive without first demonstrating a concrete race or branch-switching incident that the in-file marker cannot survive.

The design below is left in place as a record of what was rejected.

---

## Why the current scheme is already adequate

Today, phase completion is recorded by inserting `**Status: Complete**` on its own line immediately after the phase's `<!-- status:phase-N -->` anchor inside the plan file body. Single writer rules:

- Only the **developer** ever writes the marker — after the dual-approval gate (reviewer `APPROVED` + user `approved`) clears.
- The **reviewer** reads the marker but never writes it.
- The **architect** edits future phases via amendment, never the status line of the current phase.
- The **team lead** orchestrates; it does not mutate the plan body.

No concurrent writer means no race. Atomicity on a single-line edit is provided by the host filesystem; nothing else competes.

Branch switching is not a real failure mode either: the plan file lives in the working tree alongside the code, so a branch switch carries the marker with the code it describes.

---

## What the synthesis proposed

Three marker types in `artifacts/plans/`:

- `<plan>.phase-N.done` — written by the developer after both approvals.
- `<plan>.phase-N.reviewed` — written by the reviewer after `APPROVED`.
- `<plan>.amending` — written by the architect during an amendment, removed when done.

The claimed wins were:

1. **Atomicity** — file create vs prose edit.
2. **Grep-ability** — `ls artifacts/plans/*.done` instead of body grep.
3. **Branch-switch survival** — markers persist across switches.
4. **Race safety** — distinct files per writer.

None survive scrutiny in AISpec's topology:

| Claimed win | Reality in AISpec |
|---|---|
| Atomicity | The single-line in-file edit is already atomic on every supported filesystem. |
| Grep-ability | `grep -B1 'Status: Complete' artifacts/plans/<file>.md` already lists complete phases. |
| Branch-switch survival | The plan file is in the same tree as the code; it switches with the code. |
| Race safety | One writer per artifact already; no race exists to prevent. |

The cost side, however, is concrete:

- **Fragmentation.** Phase state lives in two places — the plan body (`**Status: Complete**`) and the marker files. Two sources of truth invite drift.
- **Reviewer/architect must learn a second protocol.** Reading status today is "scan the plan body"; under marker files, it becomes "stat the directory, then scan the plan body for anchors, then cross-check".
- **Cleanup discipline.** Markers must be cleaned up when a phase is rejected and re-implemented (step 13 in `developer.md`). The in-file marker is simply un-inserted by editing the same line.
- **Amendment churn.** The `.amending` flag would have to be set/unset by the architect on every amendment, creating ceremony where today there is none.

---

## When to revisit

Activate this follow-up only when one of these concrete signals appears:

- A reviewer or architect writes to the **plan body** directly (introducing a second writer that races with the developer's `**Status: Complete**` edit).
- An incident shows the in-file marker was lost or mis-set due to a tooling race (e.g., concurrent `Edit` calls from parallel teammates on the same line).
- Phase counts cross a threshold (e.g., a single plan with ≥20 phases) where body-grep becomes meaningfully slower than a directory listing.

None of those are present at the time of this decision.

---

## Non-goals

- **Auto-generated activity logs.** If the team ever wants a chronological "what phase finished when" view, that is a job for the developer's plan-progress memory file (`templates/progress.md`), not for filesystem markers.
- **CI integration on phase completion.** Same answer — the progress memory file is the structured record CI would consume.

---

## Cross-references

- `.claude/agents/developer.md` — step 12 (writes `**Status: Complete**`).
- `.claude/skills/documenting/templates/plan.md` — defines the `<!-- status:phase-N -->` anchor and the marker rule.
- `.claude/skills/documenting/templates/progress.md` — chronological plan-progress memory.
- `tmp/followup-artifact-indexes.md` — scrapped for the same "premature infrastructure" reason; same logic applies here.
