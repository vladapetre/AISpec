# Reviewer — Cross-check mode

Loaded by `agents/reviewer.md` step 2 when the request carries `CROSS_CHECK_REQUESTED:` or starts with `/cross-check`. Artifact-consistency only — no code review, no diff inspection.

Two artifact models arrive here, distinguished mechanically by the target file:
- **Design Record** (has a `## Decisions` section): the check is section↔section inside one file — decisions against phases — plus grounding in cited sources.
- **Legacy pair** (plan carries `**Governing ADR:**`): the check is the original artifact↔artifact pass, plan against the effective ADR chain.

"The decision source" below means the record's `## Decisions` section, or the legacy effective ADR (root `## Decision`/`## Consequences` plus every ancestor's `## Revised decision`/`## Delta consequences`).

Pre-flight semantics: `assets/preflight.yaml#reviewer-crosscheck`.

## Steps

CC-1. Pre-flight per CLAUDE.md `## Pre-flight protocol` (shell has already done memory read + mode dispatch). Detect the artifact model from the target file's header region and record it.

CC-2. **Scope resolution — full vs delta.** The pass is **delta-scoped** when BOTH hold:
   - the request line carries a delta scope — a Design Record request naming revised `D-###` IDs (`— delta re-check; scope: …`), or a legacy request citing a supersession (`-r<N>`) or consolidation (`**Consolidates:**` line) ADR — AND
   - reviewer memory holds a prior cross-check entry **for the same plan-directory file** whose verdict was `ALIGNED` (matched on the file path, stable across revisions).
   Otherwise (first check, or the most recent prior verdict was `DRIFT DETECTED`) the pass is **full**. Record `scope: full` or `scope: delta (prior ALIGNED <date>, vs <D-### list | prior-adr-id>)`.

   A delta pass verifies only what changed since the prior `ALIGNED` — the rest already passed its gate; re-checking it pays for the same verification twice. (Legacy consolidations especially: the fold is a restatement, only the triggering amendment is new.)

CC-2a. Read in one batch, per the resolved scope and model:
   - **Full, record:** `templates/cross-check.md`, the whole record, every report/SDR/charter its `## Problem` or `## Decisions` cites by path.
   - **Full, legacy:** `templates/cross-check.md`, the plan, the effective ADR chain, every report/SDR/charter the ADR `## Context` cites by path.
   - **Delta, record:** `templates/cross-check.md`, the revised `### D-###` sections, the `## Revision log`, and the phase(s) the amendment edited. Do NOT re-read untouched decisions or phases.
   - **Delta, legacy:** `templates/cross-check.md`, the changed decisions (supersession `## Revised decision`/`## Delta consequences`, or the consolidation's `scope:`-named decisions), the edited phase(s), the plan's `**Governing ADR:**` pointer line. Do NOT re-read the root ADR, folded decisions, untouched phases, or cited reports.

CC-3. Run the five checks from `templates/cross-check.md` in order: terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity — decision source against phases, within the resolved scope only. One row per finding; cap 30 rows (delta: cap 10).
   - **Evidence bar E2–E3 apply** (`reviewing` SKILL.md `## Evidence bar`): never infer an artifact's content from its name or heading — read the section — and actively try to disprove a row before writing it (the criterion may be satisfied in a phase you have not read, or by wording elsewhere in the decision source). A row that does not survive is dropped silently. E1 and E4–E5 are code-review rules and do not apply here.

CC-4. Verdict: `ALIGNED` if no critical or major rows; `DRIFT DETECTED` otherwise. `minor`/`pre-existing` never block.

CC-4a. **Cycle bound.** Count the prior `DRIFT DETECTED` entries in your memory index under this file's cross-check key (CC-6). If this verdict makes the **3rd**, emit `CYCLE BOUND REACHED: <short-title> — 3 cross-check cycles, no convergence` on its own line above the verdict. The verdict still renders normally. Three amendment rounds failing the same gate mean the design is not converging by amendment, and the team lead owes the user a decision before a fourth (CLAUDE.md `## Cycle bounds`).

CC-5. Emit the cross-check output. Final line is exactly `ALIGNED` or `DRIFT DETECTED`. No per-phase verdict tokens.

CC-6. Write memory. Lookup key `<short-title>#crosscheck` — the plan-directory filename without prefix and `.md`, stable across revisions (CC-2 and CC-4a both match on it). **Clean pass** (`ALIGNED`, zero critical/major rows) → one index line in `MEMORY.md` only; write NO per-review file. **Findings-bearing pass** (any critical/major row, or `DRIFT DETECTED`) → per-review file named `review-<stem>-crosscheck[-rN|-consolidated]-<YYYY-MM-DD>.md` plus the index line. Every entry records: target path (+ ADR path when legacy), scope (full/delta), verdict, counts per check.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#reviewer-crosscheck`. Loaded by the shell.

## Output format

Emit exactly:

```
## Cross-check: <short-title>

**Date:** YYYY-MM-DD
**Model:** design record | legacy pair
**Scope:** full | delta (prior ALIGNED <date>)
**Inputs:** record `artifacts/plans/NNNNN-<title>.md` | plan + ADR paths (legacy), cited: <paths or none>

| ID    | Check | Severity | Location | Summary | Recommendation |
|-------|-------|----------|----------|---------|----------------|
| X-001 | terminology / decision-coverage / reverse-coverage / driver-finding / reference-integrity | critical / major / minor / pre-existing | <artifact#anchor> | <one-line> | <one-line> |

**Verdict:** ALIGNED | DRIFT DETECTED

CYCLE BOUND REACHED: <short-title> — 3 cross-check cycles, no convergence <!-- omit entirely unless CC-4a fired -->

ALIGNED | DRIFT DETECTED
```

The final line is exactly the verdict token, nothing else on that line.

## Tokens (this mode)

- **Emits:** `ALIGNED`, `DRIFT DETECTED`, `CYCLE BOUND REACHED:`.
- **Consumes:** `CROSS_CHECK_REQUESTED:`.
