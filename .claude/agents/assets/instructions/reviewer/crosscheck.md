# Reviewer — Cross-check mode

Loaded by `agents/reviewer.md` step 2 when the request carries `CROSS_CHECK_REQUESTED:` or starts with `/cross-check`. Artifact↔artifact alignment only — no code review, no diff inspection.

Pre-flight semantics: `assets/preflight.yaml#reviewer-crosscheck`.

## Steps

CC-1. Pre-flight per CLAUDE.md `## Pre-flight protocol` (shell has already done memory read + mode dispatch).

CC-2. **Scope resolution — full vs delta.** The pass is **delta-scoped** when BOTH hold:
   - the ADR under check is a supersession (`-r<N>` filename), AND
   - reviewer memory holds a prior cross-check entry for the same ADR/plan pair whose verdict was `ALIGNED`.
   Otherwise (first check of a pair, or the prior verdict was `DRIFT DETECTED`) the pass is **full**. Record `scope: full` or `scope: delta (prior ALIGNED <date>)`.

CC-2a. Read in one batch, per the resolved scope:
   - **Full:** `templates/cross-check.md`, the plan, the ADR, every report/SDR/charter the ADR `## Context` cites by path.
   - **Delta:** `templates/cross-check.md`, the supersession ADR's `## Revised decision` and `## Delta consequences` only, the specific plan phase(s) the amendment edited (per its `Plan edit` field), and the plan's `**Governing ADR:**` pointer line. Do NOT re-read the root ADR, untouched phases, or cited reports — the prior `ALIGNED` already covered them.

CC-3. Run the five checks from `templates/cross-check.md` in order: terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity — against the resolved scope only. One row per finding; cap 30 rows (delta: cap 10).

CC-4. Verdict: `ALIGNED` if no critical or major rows; `DRIFT DETECTED` otherwise. `minor`/`pre-existing` never block.

CC-5. Emit the cross-check output. Final line is exactly `ALIGNED` or `DRIFT DETECTED`. No per-phase verdict tokens.

CC-6. Write memory. **Clean pass** (`ALIGNED`, zero critical/major rows) → one index line in `MEMORY.md` only; write NO per-review file. **Findings-bearing pass** (any critical/major row, or `DRIFT DETECTED`) → per-review file named `review-<plan-stem>-crosscheck[-rN]-<YYYY-MM-DD>.md` (plan-stem = plan filename without `.md`; `-rN` when the ADR is a supersession) plus the index line. Every entry records: ADR path, plan path, scope (full/delta), verdict, counts per check.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#reviewer-crosscheck`. Loaded by the shell.

## Output format

Emit exactly:

```
## Cross-check: <plan-short-title> ↔ <adr-short-title>

**Date:** YYYY-MM-DD
**Scope:** full | delta (prior ALIGNED <date>)
**Inputs:** ADR `artifacts/adr/NNNNN-<title>.md`, plan `artifacts/plans/<title>.md`, cited: <paths or none>

| ID    | Check | Severity | Location | Summary | Recommendation |
|-------|-------|----------|----------|---------|----------------|
| X-001 | terminology / decision-coverage / reverse-coverage / driver-finding / reference-integrity | critical / major / minor / pre-existing | <artifact#anchor> | <one-line> | <one-line> |

**Verdict:** ALIGNED | DRIFT DETECTED

ALIGNED | DRIFT DETECTED
```

The final line is exactly the verdict token, nothing else on that line.

## Tokens (this mode)

- **Emits:** `ALIGNED`, `DRIFT DETECTED`.
- **Consumes:** `CROSS_CHECK_REQUESTED:`.
