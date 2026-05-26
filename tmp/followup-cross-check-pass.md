# Follow-up — Cross-Artifact Check Pass

**Predecessor:** Suggestion 10 of the synthesis review (Cross-cutting B — *Cross-artifact analyzer / second-pass reviewer*) from `tmp/findings-_synthesis.md`. Companion to suggestion 8 ([tmp/followup-typed-cross-artifact-ids.md](followup-typed-cross-artifact-ids.md)) — typed IDs make the cross-check cheap; the cross-check makes typed IDs worth having.

**Status:** **Done — 2026-05-24.** Promoted from deferred together with the typed-ID rollout, after the same user pushback ("if you do not add them from the start, how will you know what to reference later"). Added as a mode in the existing reviewer agent — not a new agent — to keep the topology unchanged.

Implementation summary:
- `templates/cross-check.md` added under `.claude/skills/reviewing/templates/` with the five checks (terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity), fixed-column output table, severity rules, caps (≤30 rows; 1-hop reference walk), and good/bad worked examples.
- `reviewing/SKILL.md` registers the template and adds a `## Modes` section distinguishing per-phase from cross-check; the standalone-invocation steps now dispatch on the mode at step 1.
- `reviewer.md` carries a mode dispatch between memory load and pre-flight: cross-check requests jump to a sub-flow (`CC-1`…`CC-6`) with its own pre-flight, runs `templates/cross-check.md`, emits the `ALIGNED` / `DRIFT DETECTED` verdict, and writes a `mode: cross-check`-tagged memory entry. `<deliverables>`, `<decision_authority>`, `<interaction_model>`, `<completion_criteria>`, and `<output_format>` all carry the cross-check branch.
- `architect.md` step A13 emits `CROSS_CHECK_REQUESTED: artifacts/plans/<short-title>.md` at the bottom of every Mode A output; Mode A's `<completion_criteria>` requires the token; the rules document the `DRIFT DETECTED` → re-amendment loop.
- `developer.md` pre-flight `Prior phase reviewed` row now requires the cross-check `ALIGNED` to have cleared before Phase 1.
- `tokens.yaml` registers three new tokens: `CROSS_CHECK_REQUESTED:` (routing, architect→reviewer), `ALIGNED` (verdict, gates Phase 1), `DRIFT DETECTED` (verdict, routes back to architect for amendment).
- `CLAUDE.md` documents the team-lead orchestration: do not invite the developer to start Phase 1 until `ALIGNED` is relayed; route `DRIFT DETECTED` back to the architect for amendment.
- `npm run lint:agents` clean.

The optional `/cross-check` slash command (PR 6 in the original plan) is not yet shipped — the auto-flow via `CROSS_CHECK_REQUESTED:` covers the canonical path. Add the slash command when a user wants to invoke a cross-check outside the architect's publication turn.

---

### Original deferred design (for record)

**Status (prior):** **Deferred — design captured.** Activate together with the typed-ID rollout, or sooner if a reviewer or architect reports a drift incident between the ADR and the plan that the per-phase alignment check missed.

---

## The problem this catches

The reviewer's per-phase alignment check verifies a single phase's diff against (a) the phase's own acceptance criteria and (b) the governing ADR's key decisions. It does **not** verify that the **ADR and the plan are mutually consistent before the developer starts**. Misalignments that the per-phase check cannot catch:

- The ADR specifies "Postgres JSONB"; the plan's Phase 2 reads "MongoDB document". Per-phase alignment catches the first phase that hits the inconsistency — too late to avoid the wasted work.
- The ADR introduces decision `D-007 — pessimistic locking`; the plan never has a phase that implements it. Per-phase alignment doesn't flag an absent reference.
- The plan's vocabulary drifts from the ADR's (`session token` vs `bearer token`). Per-phase alignment fires only when the phase touches the term; cross-check fires once, before any phase starts.
- An analyst report finding (`R-014`) is named as a driver in the ADR but no plan phase resolves it. Cross-check catches this; per-phase alignment doesn't see the report.

These are drift classes the analyst, consultant, architect, and reviewer would each catch within their own artifact — but no one currently catches them **between** artifacts.

---

## Where it lives

A new pass in the **reviewer** agent, invoked **once per plan**, before the developer is invited to start phase 1. Not a new agent — the reviewer already has the read-only stance, the alignment-table format, and the verdict-token protocol.

Two invocation modes:

1. **Auto:** the architect, after publishing both ADR and plan, sends a `CROSS_CHECK_REQUESTED: <plan-path>` token to the reviewer via the team lead. The reviewer runs the cross-check pass and emits its result.
2. **Manual:** the user invokes `/cross-check <plan-path>` (a new entry on the reviewing skill's slash-command surface).

Either way, the cross-check pass is **read-only** — it never writes to artifacts, never modifies the plan or ADR, never starts implementation.

---

## What it checks

Five fixed checks, each producing a row in a fixed-column markdown table.

### Check 1 — Terminology consistency

Walk every term in the ADR's `## Glossary` (or the inferred glossary if absent), the plan's `## Domain Vocabulary` (or equivalent), and the analyst report(s) the ADR cites. Flag any term that appears in two artifacts with materially different meanings, or any term that appears in the plan but not in the ADR's domain.

### Check 2 — Decision coverage

For every decision in the ADR (every `D-###` if typed-ID rollout is complete; every `## Decision` or `### <subsection>` heading otherwise), find at least one plan phase whose acceptance criteria implement it. Flag uncovered decisions.

### Check 3 — Reverse coverage

For every plan phase, find at least one ADR decision the phase implements. Flag phases that have no parent decision — they are either scope creep or a sign the ADR is incomplete.

### Check 4 — Driver-finding resolution

If the ADR cites an analyst report as a driver, walk the report's findings (every `R-###` if typed-ID rollout is complete; every `## Finding` heading otherwise). Flag findings marked `critical` or `major` in the report that are not resolved by either a plan phase or an explicit "out of scope" note in the ADR's `## Alternatives Considered` or `## Out of Scope` section.

### Check 5 — Reference integrity

Walk every cross-artifact reference (`<short-title>#<ID>` once typed IDs ship; prose references like "see auth-audit.md" today). Flag references that point to a non-existent artifact or, in the typed-ID world, a non-existent or withdrawn ID.

---

## Output format

The reviewer emits a fixed-column markdown table as its cross-check output. No prose preamble; the columns are the spec.

```
## Cross-check: <plan-short-title> ↔ <adr-short-title>

| ID    | Check                  | Severity | Location                                     | Summary                                                                 | Recommendation                              |
|-------|------------------------|----------|----------------------------------------------|-------------------------------------------------------------------------|---------------------------------------------|
| X-001 | terminology            | major    | adr#glossary "session token" vs plan#dv "bearer token" | Same concept named two ways across artifacts.                            | Pick one; update the other; record in MEMORY.md. |
| X-002 | decision-coverage      | critical | adr#D-007 (pessimistic locking)              | No plan phase implements it.                                            | Add Phase N or downgrade D-007 to "future". |
| X-003 | reverse-coverage       | minor    | plan#Phase 4                                 | Phase implements caching; no ADR decision authorises it.                | Either add an ADR decision or drop the phase. |
| X-004 | driver-finding         | major    | report#R-014 (token-in-logs)                 | Critical finding from the cited report; no plan phase resolves it.       | Add resolving phase or mark out-of-scope in ADR. |
| X-005 | reference-integrity    | major    | plan#Phase 2 cites "auth-audit#R-099"        | Referenced ID does not exist in the named report.                       | Fix the reference or remove it.             |

**Verdict:** ALIGNED | DRIFT DETECTED

If DRIFT DETECTED: the architect must reconcile before the developer starts Phase 1. The cross-check re-runs after reconciliation.
```

ID prefix is `X-###` (cross-check), scoped to the pass — never persisted to an artifact, lives in the conversation channel only.

---

## Severity rules

Identical to the reviewer's existing severity table — `critical`, `major`, `minor`, `pre-existing`. Cross-check findings are usually `critical` (decision coverage gap, broken reference) or `major` (terminology drift, unresolved driver finding). `pre-existing` applies when the drift was already present in an earlier accepted ADR/plan pair and is out of scope for the current pair.

The verdict is binary: `ALIGNED` (no `critical` or `major` rows) or `DRIFT DETECTED` (any `critical` or `major` row). `minor` rows are recorded but do not block.

---

## When in the lifecycle

```
architect.publish(ADR)   →   architect.publish(plan)   →   architect.signal(CROSS_CHECK_REQUESTED)
                                                          ↓
                                              reviewer.cross-check pass
                                                          ↓
                                              ALIGNED        |   DRIFT DETECTED
                                                  ↓                       ↓
                                  developer.start(phase 1)      architect.amend → repeat
```

The cross-check fires **between** plan publication and developer start. It is **not** a recurring per-phase check — the per-phase alignment check already covers in-flight drift. Re-runs only when the architect amends in response to drift.

---

## Skill / template changes

### A. New checklist template

`.claude/skills/reviewing/templates/cross-check.md` — a one-page template the reviewer reads on demand. Contents:

- The five checks above, each with its trigger condition.
- The fixed-column markdown table format.
- The severity rules and verdict logic.
- A worked example pair (good — `ALIGNED` table; bad — `DRIFT DETECTED` with one finding per check).

Caps: ≤80 lines including the example. The reviewer reads it lazily.

### B. Reviewing skill — registry addition

`.claude/skills/reviewing/SKILL.md` adds a row to the template registry:

```
| cross-check | reviewing/templates/cross-check.md | triggered by CROSS_CHECK_REQUESTED token, or /cross-check slash command |
```

### C. Reviewer agent — new mode

`.claude/agents/reviewer.md`:

- `<deliverables>` gains a fifth bullet for the cross-check report.
- `<instructions>` gains a branch at step 2 pre-flight: if the trigger is `CROSS_CHECK_REQUESTED` or `/cross-check`, jump to the cross-check sub-flow (steps 4a–4e — read ADR, read plan, read cited reports, build the table, emit verdict). Otherwise continue with per-phase review.
- `<interaction_model>`: new flag tokens consumed (`CROSS_CHECK_REQUESTED`) and emitted (`ALIGNED`, `DRIFT DETECTED`).

### D. Architect agent — new emission

`.claude/agents/architect.md`:

- `<deliverables>`: after publishing both ADR and plan, emit `CROSS_CHECK_REQUESTED: <plan-path>` to the team lead in the same turn that announces the plan.
- `<interaction_model>`: new flag token emitted.
- `<completion_criteria>`: not done until either the cross-check returned `ALIGNED` or a reconciling amendment was made.

### E. Tokens registry

`.claude/agents/assets/tokens.yaml` gets three new entries: `CROSS_CHECK_REQUESTED` (architect→reviewer), `ALIGNED` (reviewer→team lead→architect+user), `DRIFT DETECTED` (same routing).

### F. Optional slash command

`.claude/skills/reviewing/` could expose `/cross-check <plan>` for manual invocation. Low cost; defer until the auto-flow is in use.

---

## Method

One PR per piece, in this order:

1. **PR 1 — Template.** Write `cross-check.md` with the five checks, table format, severity rules, and worked example. Run lint.
2. **PR 2 — Skill registry.** Add the row to `reviewing/SKILL.md`.
3. **PR 3 — Reviewer agent.** Add the cross-check sub-flow under `<instructions>`. Add the deliverable and verdict tokens.
4. **PR 4 — Architect agent.** Emit `CROSS_CHECK_REQUESTED` after publishing both artifacts; gate completion on `ALIGNED` or a reconciling amendment.
5. **PR 5 — Tokens registry.** Update `tokens.yaml`.
6. **PR 6 (optional) — Slash command.** `/cross-check` user-invocable surface.

---

## Numeric caps

- Cross-check finding count: ≤30 per pass. Past that, the ADR/plan pair is structurally broken — return a single `DRIFT DETECTED` row pointing at the structural problem rather than enumerating.
- Reference-walk depth: 1 hop (ADR → plan, ADR → cited reports). Do not recurse into reports' citations of other reports.
- Pass run-time: not bounded numerically; the read budget is bounded by the existing parallelize-reads rule in the reviewer.

---

## Non-goals

- **Per-phase cross-check.** The per-phase alignment check already covers in-flight drift; running cross-check on every phase is redundant.
- **Auto-fixing drift.** The pass is read-only; the architect resolves drift via amendment.
- **Checking code against the ADR.** That is the per-phase reviewer's job, not cross-check's. Cross-check is artifact↔artifact.
- **Linting analyst reports against each other.** Reports are not coupled — only their relation to the cited ADR matters.

---

## Acceptance for this follow-up phase (when activated)

- `cross-check.md` exists under `.claude/skills/reviewing/templates/`, passes lint, includes a worked good/bad example pair.
- `reviewing/SKILL.md` registers it.
- The reviewer agent runs the cross-check pass on the `CROSS_CHECK_REQUESTED` token and emits `ALIGNED` or `DRIFT DETECTED`.
- The architect emits `CROSS_CHECK_REQUESTED` after every paired ADR/plan publication and waits for `ALIGNED` before the developer is invited.
- `tokens.yaml` lists the three new tokens with producer/consumer rows.
- One end-to-end run on a deliberately-drifting ADR/plan pair returns `DRIFT DETECTED` with at least one row per check class.
