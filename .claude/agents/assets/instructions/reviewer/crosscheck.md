# Reviewer — Cross-check mode

Loaded by `agents/reviewer.md` step 2 when the request carries `CROSS_CHECK_REQUESTED:` or starts with `/cross-check`. Artifact↔artifact alignment only — no code review, no diff inspection.

Pre-flight semantics: `assets/preflight.yaml#reviewer-crosscheck`.

## Steps

CC-1. Pre-flight per CLAUDE.md `## Pre-flight protocol` (shell has already done memory read + mode dispatch).

CC-2. **Scope resolution — full vs delta.** The pass is **delta-scoped** when BOTH hold:
   - the ADR under check is an amendment product — either a supersession (`-r<N>` filename) **or** a consolidation (a top-level filename carrying a `**Consolidates:**` line, amendment.md M3b) — AND
   - reviewer memory holds a prior cross-check entry **for the same plan** whose verdict was `ALIGNED` — matched on the plan path, which is stable across ADR revisions (the prior entry will cite an earlier ADR in the same short-title chain; that is the expected shape, not a mismatch).
   Otherwise (first check of a plan, or the most recent prior verdict for it was `DRIFT DETECTED`) the pass is **full**. Record `scope: full` or `scope: delta (prior ALIGNED <date>, vs <prior-adr-id>)`.

   **A consolidation is not a fresh design and must not be re-checked as one.** Its folded content is decisions that already passed their own gates; only the amendment that triggered the fold is new. Treat the request's `scope: <revised decisions>` clause as the delta — a consolidated ADR is *bigger* than a delta ADR but carries no more unverified content, so scoping on file size instead of provenance would pay for the same verification twice.

CC-2a. Read in one batch, per the resolved scope:
   - **Full:** `templates/cross-check.md`, the plan, the ADR, every report/SDR/charter the ADR `## Context` cites by path.
   - **Delta:** `templates/cross-check.md`, the specific plan phase(s) the amendment edited (per its `Plan edit` field), the plan's `**Governing ADR:**` pointer line, and the changed decisions — for a supersession, its `## Revised decision` and `## Delta consequences` sections; for a consolidation, only the decisions named in the request's `scope:` clause (a consolidated ADR has no delta sections — it reads as a whole ADR). Do NOT re-read the root ADR, untouched or folded decisions, untouched phases, or cited reports — the prior `ALIGNED` already covered them.

CC-3. Run the five checks from `templates/cross-check.md` in order: terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity — against the resolved scope only. One row per finding; cap 30 rows (delta: cap 10).
   - **Evidence bar E2–E3 apply** (`reviewing` SKILL.md `## Evidence bar`): never infer an artifact's content from its name or heading — read the section — and actively try to disprove a row before writing it (the criterion may be satisfied in a phase you have not read, or by wording elsewhere in the ADR). A row that does not survive is dropped silently. E1 and E4–E5 are code-review rules and do not apply here.

CC-4. Verdict: `ALIGNED` if no critical or major rows; `DRIFT DETECTED` otherwise. `minor`/`pre-existing` never block.

CC-5. Emit the cross-check output. Final line is exactly `ALIGNED` or `DRIFT DETECTED`. No per-phase verdict tokens.

CC-6. Write memory. **Clean pass** (`ALIGNED`, zero critical/major rows) → one index line in `MEMORY.md` only; write NO per-review file. **Findings-bearing pass** (any critical/major row, or `DRIFT DETECTED`) → per-review file named `review-<plan-stem>-crosscheck[-rN|-consolidated]-<YYYY-MM-DD>.md` (plan-stem = plan filename without `.md`; `-rN` when the ADR is a supersession, `-consolidated` when it is an M3b consolidation) plus the index line. Every entry records: ADR path, plan path, scope (full/delta), verdict, counts per check.

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
