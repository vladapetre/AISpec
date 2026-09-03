# Template: Cross-Artifact Check

**Purpose:** Verify that a design's decisions and its execution phases are mutually consistent — and that both honour the analyst reports and strategic artifacts they cite — **before** the developer starts Phase 1. This is the artifact-consistency pass; the per-phase alignment check covers artifact↔code in-flight.

**Model mapping.** The five checks below are written in the legacy pair's vocabulary. They apply verbatim to a Design Record (one file, `templates/design-record.md`) under this mapping: read "the ADR" as the record's `## Problem` + `## Decisions`, and "the plan" as the record's `## Scope` + `## Phases`. `## Alternatives Considered` maps to the decisions' `**Instead of:**` lines; the ADR's `## Context` citations map to citations in `## Problem`. The worked examples remain pair-shaped; the row grammar is identical either way.

Fires once per design (re-fires on amendment when the architect's M5a conditions trip). Read-only — never writes to artifacts.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| Cross-check finding rows per pass | **≤30** | Past 30, the pair is structurally broken — emit a single `DRIFT DETECTED` row pointing at the structural problem (e.g. "plan has no acceptance criteria") and stop enumerating. |
| Reference-walk depth | **1 hop** (ADR → plan, ADR → cited reports, ADR → cited SDRs) | Never recurse into reports' citations of other reports — out of scope for the pass. |

---

## When to fire

| Trigger | Source |
|---|---|
| `CROSS_CHECK_REQUESTED: <plan-path>` | architect, after publishing both ADR and plan in the same invocation |
| `/cross-check <plan-path>` | user, manual invocation |
| Re-fire on amendment | architect, after editing the ADR or plan in response to a previous `DRIFT DETECTED` |

The pass is **not** a per-phase check. Per-phase drift is the alignment-check template's job.

---

## Five checks

Run all five in order. Each produces zero or more rows. The verdict is computed once all five complete.

### Check 1 — Terminology consistency

Walk every term that appears in **both** the ADR (Context, Decision, Consequences) and the plan (Problem, Scope, Phases). For each term:

- Find its glossary entry under `artifacts/strategy/glossary/`. If absent, that's a separate finding (terminology not yet ratified).
- Compare its usage in the ADR vs the plan. If the same term is used to mean materially different things, emit a row.
- If the plan introduces a domain term that does not appear in the ADR's domain language (and is not common English), emit a row.

### Check 2 — Decision coverage

For every decision the ADR records (the ADR's `## Decision` paragraph, plus every `D-###` if the ADR uses sub-decisions), find at least one plan phase whose `T-<phase>.<seq>` acceptance criteria implement it.

- An ADR decision with zero implementing criteria → `critical` row.
- A `D-###` referenced in the plan that does not exist in the ADR → `critical` row.

### Check 3 — Reverse coverage

For every plan phase, find at least one ADR decision the phase implements.

- A phase whose acceptance criteria implement no ADR decision → `major` row (either scope creep or the ADR is incomplete; the architect decides which).

### Check 4 — Driver-finding resolution

If the ADR's `## Context` cites an analyst report, walk that report's findings (every `R-###`).

- A `critical` or `major` finding from the cited report that is neither resolved by a plan phase nor marked out-of-scope in the ADR's `## Alternatives Considered` → `major` row.
- If the ADR cites a strategic artifact (SDR, charter), walk `TF-###` items in the SDR or `INV-###` in the charter. A `[TACTICAL DESIGN NEEDED]` `TF-###` with no implementing phase → `major` row.

### Check 5 — Reference integrity

Walk every cross-artifact reference of the form `<short-title>#<ID>` in both the ADR and the plan.

- The target artifact does not exist → `critical` row.
- The artifact exists but the ID does not (or is `[withdrawn]`) → `major` row.
- The reference is in prose form (paraphrased — e.g. "the auth audit's session-token finding") without an ID → `minor` row (advisory: future-proof by switching to ID form).

---

## Severity rules

Reuse the reviewing skill's severity definitions; the rubric below resolves any cross-check-specific question:

| Severity | Typical cross-check signal |
|---|---|
| **critical** | Decision-coverage gap (Check 2); broken reference target (Check 5); the pair cannot be implemented as written. |
| **major** | Reverse-coverage gap (Check 3); unresolved driver finding (Check 4); broken reference ID (Check 5). |
| **minor** | Terminology drift between artifacts that already share a glossary entry (Check 1); prose references that work but should be IDs (Check 5). |
| **pre-existing** | Drift inherited from an earlier ratified ADR/plan pair that this pass is not in scope to fix. |

Verdict is binary:

- **ALIGNED** — no `critical` or `major` rows. `minor` rows are recorded but do not block.
- **DRIFT DETECTED** — any `critical` or `major` row. The architect must reconcile (amend ADR, amend plan, or both) before the developer is invited. Re-run cross-check after the amendment.

---

## Output format

```
## Cross-check: <plan-short-title> ↔ <adr-short-title>

**Date:** YYYY-MM-DD
**Inputs:** ADR `artifacts/adr/NNNNN-<title>.md`, plan `artifacts/plans/<title>.md`, cited reports/SDRs/charters: <comma-separated paths or `none`>

| ID    | Check                  | Severity | Location                                  | Summary                                                          | Recommendation                                        |
|-------|------------------------|----------|-------------------------------------------|------------------------------------------------------------------|-------------------------------------------------------|
| X-001 | terminology            | minor    | adr#glossary "session token" vs plan "bearer token" | Same concept named two ways across artifacts.                    | Pick one; update the other; record under glossary.    |
| X-002 | decision-coverage      | critical | adr#D-002 (pessimistic locking)            | No plan phase implements this decision.                          | Add a phase or downgrade D-002 to "future work".      |
| X-003 | reverse-coverage       | major    | plan#Phase 4                               | Phase implements caching; no ADR decision authorises it.         | Either add an ADR decision or drop the phase.         |
| X-004 | driver-finding         | major    | report#R-007 (token logged plaintext)      | Critical finding from the cited report; no plan phase resolves it. | Add resolving phase or mark out-of-scope in ADR.       |
| X-005 | reference-integrity    | critical | plan#Phase 2 cites "auth-audit#R-099"      | Referenced ID does not exist in the named report.                | Fix the reference or remove it.                        |

**Verdict:** ALIGNED | DRIFT DETECTED
```

`X-###` IDs are scoped to the pass — they live in the conversation channel only, never in artifacts. Zero-padded to 3 digits, dense within a single pass; new pass starts at `X-001` again.

---

## Worked examples

### Good — ALIGNED

```
## Cross-check: event-store ↔ event-store

**Date:** 2026-05-24
**Inputs:** ADR `artifacts/adr/00007-event-store.md`, plan `artifacts/plans/event-store.md`, cited reports/SDRs/charters: `artifacts/reports/event-throughput-audit.md`

| ID    | Check                  | Severity | Location | Summary | Recommendation |
|-------|------------------------|----------|----------|---------|----------------|
| _None_ |                       |          |          |         |                |

**Verdict:** ALIGNED
```

### Bad — DRIFT DETECTED (terminology + decision-coverage)

```
## Cross-check: payments-rewrite ↔ payments-rewrite

**Date:** 2026-05-24
**Inputs:** ADR `artifacts/adr/00012-payments-rewrite.md`, plan `artifacts/plans/payments-rewrite.md`, cited reports/SDRs/charters: `artifacts/strategy/decisions/00003-payments-strategy.md`

| ID    | Check              | Severity | Location                                              | Summary                                                         | Recommendation                                              |
|-------|--------------------|----------|-------------------------------------------------------|-----------------------------------------------------------------|-------------------------------------------------------------|
| X-001 | terminology        | minor    | adr "merchant" vs plan "vendor"                       | Same role named two ways across artifacts.                       | Use "merchant" everywhere; update plan; add glossary entry. |
| X-002 | decision-coverage  | critical | adr#D-003 (idempotent retries)                        | No plan phase implements idempotent retry behaviour.             | Add Phase 4 or remove D-003 from the ADR.                   |
| X-003 | driver-finding     | major    | sdr#TF-002 (regional clearing requirement)            | [TACTICAL DESIGN NEEDED] item from the parent SDR is unresolved. | Either add a phase or split into a follow-up ADR/plan pair. |

**Verdict:** DRIFT DETECTED
```
