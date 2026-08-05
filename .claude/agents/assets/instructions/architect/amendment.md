# Architect — Amendment mode

Loaded by `agents/architect.md` step 2 when the request carries `ARCHITECT AMENDMENT NEEDED:`. Surgical context only — never re-read the full ADR, plan, or source files.

Pre-flight semantics: `assets/preflight.yaml#architect-amendment`.

> **Token disambiguation.** `ARCHITECT REVIEW NEEDED:` (analyst's hand-off, consumed in Design mode step A2) is **not** `ARCHITECT AMENDMENT NEEDED:` (the Amendment-mode trigger). The shell's mode dispatch already separated these — if you reached this file, the trigger is the latter.
>
> The trigger token is attached by the reviewer (drift flag) **or by the team lead** when a user/PO ruling changes a decision in an existing ADR — both arrive here; M2a classifies which. Under `## Spec volatility` (CLAUDE.md), batched user-directed deltas arrive as ONE amendment request absorbing all of them.

## Steps

M1. **Surgical context — load only what the drift requires.** In one batch:
   - The reviewer's `ARCHITECT AMENDMENT NEEDED:` reason line and its ADR-alignment row(s) — or, for a batched user-ruling flush (CLAUDE.md `## Spec volatility`, Source B), **every** queued ruling in the list. A batch is absorbed as one amendment producing one supersession ADR; never split it back into one ADR per ruling;
   - Only the specific section(s) of the governing ADR named in the reason (typically one decision bullet under `## Decision` plus its paired `## Consequences` bullets). Never the full ADR or `## Context`;
   - Each cited `file:line` from the reviewer — only the hunk ±10 lines (paths in CLAUDE.md `## Security paths` are the sole full-file exception);
   - The plan only if the reason names a phase number — then only that phase's section.
   Do not re-run the reviewer's checklist. Do not re-derive original constraints or alternatives. The supersession ADR carries only the delta.

M2. Classify the drift, exactly one:
   - **CODE_DRIFT** (code drifted from a still-correct ADR) → no supersession ADR; emit `RECONCILE WITH ADR:` naming the specific decisions the developer must restore.
   - **ADR_AMENDED** (ADR was wrong or has been outgrown) → write the supersession ADR (M3, or M3b if the revision budget says consolidate). Decide whether it also touches a future phase's criteria.
   - **PLAN_UPDATED** (implies ADR_AMENDED) → M3/M3b + edit affected future phase + update plan `**Governing ADR:**` pointer (M4).

M2a. Classify the **trigger source**, exactly one — it drives M5a routing:
   - **REVIEWER_DRIFT** — the reason line originates in a reviewer verdict (per-phase, cumulative, or cross-check finding).
   - **USER_DIRECTED** — the reason line records a user/PO ruling, directive, or renegotiated spec (e.g. "user ruled…", "PO decision…", "Jira amendment…"), with no reviewer finding behind it.
   Ambiguous (both present) → REVIEWER_DRIFT.

M2b. **Revision budget — count before you append.** Scan `artifacts/adr/` for existing `NNNNM-<short-title>-r*.md` siblings. If this amendment would be **r3 or higher**, do not append another delta: **consolidate** instead (M3b). Deltas are cheap to write and expensive to read — at r3 the design's truth is spread across four files that every later reader (developer per phase, reviewer per gate, the next architect) must fold by hand. Consolidating pays that fold once.

   `CODE_DRIFT` never counts toward the budget and never consolidates — it changes no artifact.

M3. **Write the supersession ADR** at `artifacts/adr/NNNNM-<short-title>-r<N>.md` — the delta form, for r1 and r2 only. Five fields, no padding:

   ```
   # ADR NNNNM — <short title> (revision r<N>)

   **Supersedes:** artifacts/adr/NNNNN-<short-title>.md (or `-r<N-1>`)
   **Date:** YYYY-MM-DD
   **Trigger:** <reviewer's one-line reason>

   ## Revised decision
   <only the decision bullets that changed — quote and modify by D-### ID>

   ## Delta consequences
   <only the consequences that change. Mark new [IRREVERSIBLE] items if any>
   ```

   Stamp the original ADR with exactly one line beneath its title:

   ```
   **Superseded by:** artifacts/adr/NNNNM-<short-title>-r<N>.md — <YYYY-MM-DD>
   ```

   Nothing else in the original is edited. Scan siblings before naming: `NNNNM` is next free top-level sequence; `r<N>` is next free revision integer for this short-title — never reuse.

M3b. **Consolidate (r3+, per M2b) — re-issue, do not append.** Write ONE full ADR at the **next free top-level number**, `artifacts/adr/NNNNN-<short-title>.md`, that states the design as it now stands: the surviving decisions from the original plus every revision, folded, with the superseded wording gone rather than layered.

   ```
   **Supersedes:** <original path>, <r1 path>, … <r<N-1> path>   (the whole chain, in order)
   **Consolidates:** <N> revisions — <one line on what drove the chain>
   **Date:** YYYY-MM-DD
   **Trigger:** <this amendment's reason(s), same rules as M3>
   ```

   Then stamp **every** file in the chain with its own `**Superseded by:** <new path> — <YYYY-MM-DD>` line beneath the title, and repoint the plan's `**Governing ADR:**` at the new ADR. Decision IDs (`D-###`) keep their numbers so plan phases and prior review records still resolve; a decision dropped along the way is listed once under `## Superseded decisions` with the revision that retired it.

   **This step is the one exception to M1's surgical-context rule** — consolidating requires reading the original and every revision in the chain. That read is the point: it happens once here instead of in every later reader. After consolidation the chain is closed; the next amendment starts a fresh delta at `NNNNNM-<short-title>-r1` against the consolidated ADR.

   `templates/adr.md`'s ≤400-line body cap still applies. A fold that would breach it is a signal the decision has outgrown one ADR: apply the template's own remedy (split by decision, or extract reasoning to `artifacts/adr/notes/`) rather than shipping a 600-line ADR — and never by dropping surviving decisions to fit.

M4. IF the amendment changes a future phase's criteria: edit that phase's section AND update the plan's `**Governing ADR:**` pointer to the new ADR path (the M3 supersession, or the M3b consolidation) — both in the same turn. A consolidation repoints the pointer even when no phase criteria changed, since the chain it replaces is now closed. Never touch a phase whose anchor is followed by `**Status: Complete**`; if the amendment would require redoing completed work, stop and surface.

M5. Append a one-line memory entry: plan name, phase number, classification (CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED), trigger source, supersession ADR ID if any, and `consolidated <N>` when M3b ran (so the next amendment can tell at a glance that its chain restarted at r1).

M5a. **Route the re-check.** CODE_DRIFT needs no cross-check (no artifact changed). For ADR_AMENDED / PLAN_UPDATED, the default is `CROSS_CHECK_REQUESTED: <plan-path> — delta re-check after <supersession-ADR-id>` (the reviewer will delta-scope it per its CC-2 rule). Emit `SELF_CHECKED (delta)` instead — waiving the re-check — ONLY when **all four** hold:

   **On a consolidation (M3b), every condition below — and the reviewer's delta scope — is judged against THIS amendment's changes only, never the folded content.** The rest of a consolidated ADR is a restatement of decisions that already passed their gates; re-checking the fold would pay for the same verification twice. Name the scope in the request: `— delta re-check after consolidation; scope: <this amendment's revised decisions>`. A batched flush (Source B) counts its rulings, not its decisions, against the `≤2` condition — a batch is one absorption event.
   - Trigger source is USER_DIRECTED (M2a) — reviewer-driven drift always re-checks;
   - the supersession revises ≤2 decisions;
   - the trigger states or clearly implies business semantics are unchanged (load-shape, naming, structural simplification, contract-surface relabel);
   - no touched file or plan phase is under CLAUDE.md `## Security paths`.
   Any one fails → `CROSS_CHECK_REQUESTED:` with the failed condition named.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#architect-amendment`. Loaded by the shell.

## Output format

Emit exactly:

```
## Architect Amendment — Phase N of <plan short-title>

Trigger: ARCHITECT AMENDMENT NEEDED — <one-line reason; for a batch, one numbered line per queued ruling>
Trigger source: REVIEWER_DRIFT | USER_DIRECTED
Original ADR: artifacts/adr/NNNNN-<short-title>.md
Plan: artifacts/plans/<short-title>.md
Classification: CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED
Revision: r<N> (delta) | consolidated — folded <N> revisions | _N/A — CODE_DRIFT_

Supersession ADR: artifacts/adr/NNNNM-<short-title>-r<N>.md | artifacts/adr/NNNNN-<short-title>.md (consolidated) | _N/A — CODE_DRIFT_
Plan edit: <phase updated + pointer updated> | _None_
Developer impact: <one sentence> | _N/A — CODE_DRIFT_
RECONCILE WITH ADR: <decisions to restore, each with file:line> | _N/A — ADR_AMENDED/PLAN_UPDATED_

CROSS_CHECK_REQUESTED: <plan-path> — delta re-check after <supersession-ADR-id> | SELF_CHECKED (delta) | _N/A — CODE_DRIFT_
```

Field rules:
- **CODE_DRIFT** → `Supersession ADR`, `Plan edit`, `Developer impact`, `Revision` = `_N/A — CODE_DRIFT_`; `RECONCILE WITH ADR` = decision list; final line = `_N/A — CODE_DRIFT_`.
- **`Revision`** — `r1`/`r2` take the delta form (M3); the third amendment onward is `consolidated` (M2b/M3b) and its `Supersession ADR` is the new top-level path, not an `-r<N>` one.
- **ADR_AMENDED** (no plan change) → `Supersession ADR` = path; `Plan edit` = `_None_`; `RECONCILE WITH ADR` = `_N/A — ADR_AMENDED/PLAN_UPDATED_`.
- **PLAN_UPDATED** (implies ADR_AMENDED) → `Supersession ADR` = path; `Plan edit` = updated criteria + pointer-update confirmation.
- Final line per M5a: `CROSS_CHECK_REQUESTED:` is the default for ADR_AMENDED / PLAN_UPDATED; `SELF_CHECKED (delta)` only under the four-condition carve-out.

## Tokens (this mode)

- **Emits:** `RECONCILE WITH ADR:` (CODE_DRIFT only); `CROSS_CHECK_REQUESTED:` (delta re-check default); `SELF_CHECKED (delta)` (M5a carve-out only).
- **Consumes:** `ARCHITECT AMENDMENT NEEDED:`.
