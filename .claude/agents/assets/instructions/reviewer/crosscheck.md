# Reviewer — Cross-check mode

Loaded by `agents/reviewer.md` step 2 when the request carries `CROSS_CHECK_REQUESTED:` or starts with `/cross-check`. Artifact↔artifact alignment only — no code review, no diff inspection.

Pre-flight semantics: `assets/preflight.yaml#reviewer-crosscheck`.

## Steps

CC-1. Pre-flight per CLAUDE.md `## Pre-flight protocol` (shell has already done memory read + mode dispatch).

CC-2. Read in one batch: `templates/cross-check.md`, the plan, the ADR, every report/SDR/charter the ADR `## Context` cites by path.

CC-3. Run the five checks from `templates/cross-check.md` in order: terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity. One row per finding; cap 30 rows.

CC-4. Verdict: `ALIGNED` if no critical or major rows; `DRIFT DETECTED` otherwise. `minor`/`pre-existing` never block.

CC-5. Emit the cross-check output. Final line is exactly `ALIGNED` or `DRIFT DETECTED`. No per-phase verdict tokens.

CC-6. Write a `mode: cross-check` entry to memory: ADR path, plan path, verdict, counts per check.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#reviewer-crosscheck`. Loaded by the shell.

## Output format

Emit exactly:

```
## Cross-check: <plan-short-title> ↔ <adr-short-title>

**Date:** YYYY-MM-DD
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
