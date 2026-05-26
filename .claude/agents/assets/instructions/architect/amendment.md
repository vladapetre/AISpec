# Architect — Amendment mode

Loaded by `agents/architect.md` step 2 when the request carries `ARCHITECT AMENDMENT NEEDED:`. Surgical context only — never re-read the full ADR, plan, or source files.

Pre-flight semantics: `assets/preflight.yaml#architect-amendment`.

> **Token disambiguation.** `ARCHITECT REVIEW NEEDED:` (analyst's hand-off, consumed in Design mode step A2) is **not** `ARCHITECT AMENDMENT NEEDED:` (reviewer's drift flag, the only Amendment-mode trigger). The shell's mode dispatch already separated these — if you reached this file, the trigger is the latter.

## Steps

M1. **Surgical context — load only what the drift requires.** In one batch:
   - The reviewer's `ARCHITECT AMENDMENT NEEDED:` reason line and its ADR-alignment row(s);
   - Only the specific section(s) of the governing ADR named in the reason (typically one decision bullet under `## Decision` plus its paired `## Consequences` bullets). Never the full ADR or `## Context`;
   - Each cited `file:line` from the reviewer — only the hunk ±10 lines (paths in CLAUDE.md `## Security paths` are the sole full-file exception);
   - The plan only if the reason names a phase number — then only that phase's section.
   Do not re-run the reviewer's checklist. Do not re-derive original constraints or alternatives. The supersession ADR carries only the delta.

M2. Classify the drift, exactly one:
   - **CODE_DRIFT** (code drifted from a still-correct ADR) → no supersession ADR; emit `RECONCILE WITH ADR:` naming the specific decisions the developer must restore.
   - **ADR_AMENDED** (ADR was wrong or has been outgrown) → write the supersession ADR (M3). Decide whether it also touches a future phase's criteria.
   - **PLAN_UPDATED** (implies ADR_AMENDED) → M3 + edit affected future phase + update plan `**Governing ADR:**` pointer (M4).

M3. **Write the supersession ADR** at `artifacts/adr/NNNNM-<short-title>-r<N>.md`. Five fields, no padding:

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

M4. IF the amendment changes a future phase's criteria: edit that phase's section AND update the plan's `**Governing ADR:**` pointer to the supersession path — both in the same turn. Never touch a phase whose anchor is followed by `**Status: Complete**`; if the amendment would require redoing completed work, stop and surface.

M5. Append a one-line memory entry: plan name, phase number, classification (CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED), supersession ADR ID if any.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#architect-amendment`. Loaded by the shell.

## Output format

Emit exactly:

```
## Architect Amendment — Phase N of <plan short-title>

Trigger: ARCHITECT AMENDMENT NEEDED — <reviewer's one-line reason>
Original ADR: artifacts/adr/NNNNN-<short-title>.md
Plan: artifacts/plans/<short-title>.md
Classification: CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED

Supersession ADR: artifacts/adr/NNNNM-<short-title>-r<N>.md | _N/A — CODE_DRIFT_
Plan edit: <phase updated + pointer updated> | _None_
Developer impact: <one sentence> | _N/A — CODE_DRIFT_
RECONCILE WITH ADR: <decisions to restore, each with file:line> | _N/A — ADR_AMENDED/PLAN_UPDATED_
```

Field rules:
- **CODE_DRIFT** → `Supersession ADR`, `Plan edit`, `Developer impact` = `_N/A — CODE_DRIFT_`; `RECONCILE WITH ADR` = decision list.
- **ADR_AMENDED** (no plan change) → `Supersession ADR` = path; `Plan edit` = `_None_`; `RECONCILE WITH ADR` = `_N/A — ADR_AMENDED/PLAN_UPDATED_`.
- **PLAN_UPDATED** (implies ADR_AMENDED) → `Supersession ADR` = path; `Plan edit` = updated criteria + pointer-update confirmation.

## Tokens (this mode)

- **Emits:** `RECONCILE WITH ADR:` (CODE_DRIFT only).
- **Consumes:** `ARCHITECT AMENDMENT NEEDED:`.
