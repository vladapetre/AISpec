# Architect — Amendment mode

Loaded by `agents/architect.md` step 2 when the request carries `ARCHITECT AMENDMENT NEEDED:`. Surgical context only — never re-read the full record, ADR, plan, or source files.

Pre-flight semantics: `assets/preflight.yaml#architect-amendment`.

> **Token disambiguation.** `ARCHITECT REVIEW NEEDED:` (analyst's hand-off, consumed in Design mode step A2) is **not** `ARCHITECT AMENDMENT NEEDED:` (the Amendment-mode trigger). The shell's mode dispatch already separated these — if you reached this file, the trigger is the latter.
>
> The trigger token is attached by the reviewer (drift flag) **or by the team lead** when a user/PO ruling changes a recorded decision — both arrive here; M2a classifies which. Batched user-directed deltas (team lead's Source B queue) arrive as ONE amendment request absorbing all of them; never split a batch back into one amendment per ruling.

## Steps

M0. **Target kind — deterministic.** Open the plan-directory file the trigger names (only its header region). It carries a `## Decisions` section → **Design Record**: follow M1–M5a below. It carries a `**Governing ADR:**` line → **legacy ADR/plan pair**: follow `## Legacy pairs` at the end of this file instead.

M1. **Surgical context — load only what the drift requires.** In one batch:
   - The reviewer's `ARCHITECT AMENDMENT NEEDED:` reason line and its alignment row(s) — or, for a batched user-ruling flush, **every** queued ruling in the list;
   - Only the specific `### D-###` section(s) of the record named in the reason. Never the full `## Decisions` or `## Problem`;
   - Each cited `file:line` from the reviewer — only the hunk ±10 lines (paths in CLAUDE.md `## Security paths` are the sole full-file exception);
   - A phase section only if the reason names its phase number.
   Do not re-run the reviewer's checklist. Do not re-derive original constraints or alternatives.

M2. Classify the drift, exactly one (the token names are historical — they predate the single-record model and telemetry keys on them):
   - **CODE_DRIFT** (code drifted from a still-correct record) → no artifact edit; emit `RECONCILE WITH ADR:` naming the specific decisions the developer must restore.
   - **ADR_AMENDED** (a recorded decision was wrong or has been outgrown) → revise the decision(s) in place (M3).
   - **PLAN_UPDATED** (implies ADR_AMENDED) → M3 + edit the affected future phase(s) (M4).

M2a. Classify the **trigger source**, exactly one — it drives M5a routing:
   - **REVIEWER_DRIFT** — the reason line originates in a reviewer verdict (per-phase, cumulative, or cross-check finding).
   - **USER_DIRECTED** — the reason line records a user/PO ruling, directive, or renegotiated spec, with no reviewer finding behind it.
   Ambiguous (both present) → REVIEWER_DRIFT.

M3. **Revise in place — three moves, all three mandatory** (`lint.write` bounces a partial one; `templates/design-record.md` `Revision protocol` is the contract):
   1. Edit only the affected `### D-###` bodies. A decision retired outright keeps its ID and body with `[withdrawn]` appended — never delete it.
   2. Bump each touched heading's revision marker: `### D-002: Name` → `### D-002 (r2): Name` (no marker means r1; markers only increase).
   3. Append ONE line to `## Revision log` covering the whole amendment: `- YYYY-MM-DD — D-002 (r2), D-005 (r3): <what changed>; <why>` — a batch flush lists its rulings by number in the `<why>` clause.
   There are no supersession files and no consolidation: the record is always current, the log line is the reader-facing history, git holds the bytes.

M4. IF the amendment changes a future phase's criteria: edit that phase's section in the same turn. Never touch a phase whose anchor is followed by `**Status: Complete**`; if the amendment would require redoing completed work, stop and surface.

M5. Append a one-line memory entry: record name, phase number, classification (CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED), trigger source, and the D-### IDs revised.

M5a. **Route the re-check.** CODE_DRIFT needs no cross-check (no artifact changed). For ADR_AMENDED / PLAN_UPDATED, emit `CROSS_CHECK_REQUESTED: <record-path> — delta re-check; scope: <revised D-### IDs + edited phase(s)>` when ANY of these holds:
   - trigger source is REVIEWER_DRIFT (reviewer-driven drift always re-checks);
   - the record's `## Revision log` now has **≥2 entries** (churn is itself a drift signal — measured on the development umbrella, two 3-phase features drifted only on their second-plus amendments);
   - this amendment revises **>2 decisions** (a batch counts its rulings, not its decisions);
   - any touched file or edited phase is under CLAUDE.md `## Security paths`.
   None holds → `SELF_CHECKED (delta)`. The reviewer delta-scopes to the revised decisions and edited phases named in the request line.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#architect-amendment`. Loaded by the shell.

## Output format

Emit exactly:

```
## Architect Amendment — Phase N of <record short-title>

Trigger: ARCHITECT AMENDMENT NEEDED — <one-line reason; for a batch, one numbered line per queued ruling>
Trigger source: REVIEWER_DRIFT | USER_DIRECTED
Record: artifacts/plans/NNNNN-<short-title>.md
Classification: CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED
Revision: D-### (rN)[, D-### (rN)…] | _N/A — CODE_DRIFT_

Plan edit: <phase updated> | _None_
Developer impact: <one sentence> | _N/A — CODE_DRIFT_
RECONCILE WITH ADR: <decisions to restore, each with file:line> | _N/A — ADR_AMENDED/PLAN_UPDATED_

CROSS_CHECK_REQUESTED: <record-path> — delta re-check; scope: <D-### IDs + phase(s)> | SELF_CHECKED (delta) | _N/A — CODE_DRIFT_
```

Field rules:
- **CODE_DRIFT** → `Revision`, `Plan edit`, `Developer impact` = `_N/A — CODE_DRIFT_`; `RECONCILE WITH ADR` = decision list; final line = `_N/A — CODE_DRIFT_`.
- **ADR_AMENDED** (no phase change) → `Revision` = bumped IDs; `Plan edit` = `_None_`; `RECONCILE WITH ADR` = `_N/A — ADR_AMENDED/PLAN_UPDATED_`.
- **PLAN_UPDATED** (implies ADR_AMENDED) → `Revision` = bumped IDs; `Plan edit` = updated criteria.
- Final line per M5a: `CROSS_CHECK_REQUESTED:` when any M5a condition holds; `SELF_CHECKED (delta)` when none does.

## Legacy pairs

M0 routed here: the plan carries `**Governing ADR:**`, so the artifact model is the frozen ADR + plan pair. Amendments to a legacy pair use **supersession, never in-place edits** — the original ADR is stamped `**Superseded by:** <path> — <date>` beneath its title and otherwise frozen.

M2b. **Revision budget.** Scan `artifacts/adr/` for `NNNNM-<short-title>-r*.md` siblings. r1/r2 → write a delta supersession ADR (five fields: `# ADR NNNNM — <title> (revision r<N>)`, `**Supersedes:**`, `**Date:**`, `**Trigger:**`, `## Revised decision`, `## Delta consequences`) at the next free top-level number with the next free `r<N>`, stamp the original. **r3 or higher → consolidate**: re-issue ONE full ADR at the next free top-level number folding the whole chain (`**Supersedes:**` the chain in order, `**Consolidates:** <N> revisions`), stamp every file in the chain, keep every `D-###` number, list dropped decisions once under `## Superseded decisions`. Consolidation is the one exception to M1's surgical-context rule — it reads the original and every revision, once, so later readers never have to. The `adr.md` ≤400-line cap still applies to the fold.

M4-legacy. A phase-criteria change additionally repoints the plan's `**Governing ADR:**` at the new ADR path (a consolidation repoints it even when no phase changed). The output format above applies with `Record:` reading the legacy plan path and `Revision:` reading `r<N> (delta)` or `consolidated — folded <N> revisions`, and `Supersession ADR: <path>` inserted before `Plan edit:`. M5a applies unchanged, with "≥2 Revision log entries" read as "the chain already has ≥2 revisions" and the supersession-ADR id named in the re-check line.

**Never convert a legacy pair to a Design Record** — the conversion would rewrite ratified history; legacy chains close out under the rules they were written under.

## Tokens (this mode)

- **Emits:** `RECONCILE WITH ADR:` (CODE_DRIFT only); `CROSS_CHECK_REQUESTED:` (delta re-check); `SELF_CHECKED (delta)` (M5a, no condition tripped).
- **Consumes:** `ARCHITECT AMENDMENT NEEDED:`.
