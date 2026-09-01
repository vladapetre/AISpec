---
name: expediting
description: >
  The fast lane: implement a small, low-risk change end to end in the main session,
  with no ADR, no plan, no teammate spawn and no per-phase relay, while keeping the
  craftsmanship charter, the test and lint run, the runtime drive and the craft lint.
  Use this skill when the user asks for a change that is plainly small and carries no
  design decision — a bug fix, a rename, a guard clause, a log line, a config value, a
  missing null check, a one-endpoint tweak — and phrasings like "just fix", "quick
  change", "small fix", "don't spin up the whole pipeline", "expedite this". Admission
  is gated on five objective conditions; failing any one of them routes the work to the
  full pipeline instead. Invoke standalone via `/expediting <what to change>`. Runs in
  the main session only — no agent carries it.
---

# Skill: expediting

The pipeline exists because design decisions are expensive to get wrong. Most changes carry no design decision, and for those the pipeline is pure cost: an analyst framing, an architect ADR and plan, a reviewer cross-check, a developer phase and a cumulative review, six sequential model turns and two human gates to change two lines.

This skill is the other road. It runs in the main session, so the model that heard the request is the one that writes the code, and the user sees the work as it happens instead of waiting for a relayed block.

**What it drops:** the ADR, the plan, the cross-check, the phase gates, the teammate spawn and every relay hop.

**What it keeps, without exception:** the craftsmanship charter, reading every file before touching it, tests and linter, the runtime drive, the craft lint, and a diff the user approves before anything is called done. Speed comes from removing ceremony, never from removing verification.

## Admission gate

Run this before anything else and state the result in one line. **All five must hold.** Any single failure means this skill is the wrong road: say which condition failed, in one sentence, and recommend the pipeline entry point instead (`architect` for a tactical design, `consultant` for a strategic question, `analyst` when the problem space is not yet understood).

1. **No design decision.** The change does not move a boundary, add or change a contract surface (public API, DB schema, message shape, config contract), introduce a dependency, or choose between defensible alternatives. If you would want to record *why* in an ADR, the gate fails.
2. **One repo, small blast radius.** The change is confined to a single repository and a handful of files. If you cannot name the touch set before starting, you do not understand the change well enough to expedite it.
3. **Nothing under `## Security paths`.** CLAUDE.md names them. A change touching one goes to the pipeline regardless of size.
4. **Not irreversible.** No migration, no data backfill, no deletion of a persisted structure, nothing that would carry an `[IRREVERSIBLE]` marker in a plan.
5. **No open plan owns this code.** If a plan in `artifacts/plans/` has unmarked phases covering these files, the change belongs to that plan's developer instance as a continuation turn, not here. Expediting around a live plan is how two versions of the same intent get written.

The gate is judged on the change, not on the user's urgency. "Just do it quickly" is not a condition, and a user who insists after a failed gate gets the pipeline with a note, or an explicit "you asked me to skip the gate on condition N" recorded in the summary.

## Steps

1. **Gate.** Emit the one-line admission result. Failed → stop and recommend the route.

2. **Clarify, once.** Ask every question you have in a single message, or state your assumption and continue. Do not interview the user across turns; that is the latency this skill exists to remove. Genuinely ambiguous requirement → ask and wait. Defensible reading available → take it and record it under `Decisions made`.

3. **Name the touch set, then read it.** List the files you will read or edit before opening any of them, then read them in one batch. Read `.claude/PROJECT-MAP.md` first when it exists (CLAUDE.md `## Project facts`) rather than searching for layout. Batch every independent search per CLAUDE.md `## Agent base constraints`.

4. **Write the change.** Apply the craftsmanship charter in `.claude/agents/developer.md` — it is the same bar here as in a phase, and this skill claims no exemption from it. Do not implement beyond what was asked.

5. **Tests and linter.** Detect the commands per `.claude/agents/assets/detectors.yaml` (first match wins per category), redirect log-heavy output to `.claude/state/expedite-<short-title>.log` and digest it with `logdigest.mjs`. Tests you author follow `#test_authoring_policy`: unit tests by default, nothing else without an explicit instruction. Failures you introduced are fixed here; pre-existing failures are tagged and reported, never silently absorbed.

6. **Drive the changed flow.** A green suite is not verification. If the change touches a runtime surface (endpoint, worker, CLI, startup, DI, config wiring, external-client seam), drive it once through the real entry point and record `<command driven> → <observed result>`. No drivable surface → say so and why. Same rule as `implement.md` step 7a, same reason: config and wiring fail only at runtime.

7. **Craft lint.** `node .claude/scripts/lint.craft.mjs --range <range>`. Errors are fixed now. Candidates are answered honestly against the charter.

8. **Show the diff and stop.** Emit the summary below and wait. The user is the only gate this road has, so it is not optional and it is not implied by a passing test run.

## Escalation, mid-flight

The gate is a prediction, and predictions fail. The moment the work reveals a design decision, a contract change, a second repo, a security path or an irreversible step, **stop and hand over**: report what you have done so far, what you found, and which condition broke. Do not finish the change on the fast lane because you are nearly done. A change that turns out to need an ADR needed one from the start, and the half-written diff is evidence for the architect, not a reason to skip them.

Escalating is a success of the gate, not a failure of it.

## Output format

```
## Expedited — <short title>

**Gate:** passed (no design decision · 1 repo, <n> files · no security path · reversible · no open plan)
**Files changed:**
- `<path>` — <what changed, one line>

**Decisions made:** <ambiguities you resolved and the reading you took, or _None_>
**Tests:** <command> → <result>. Pre-existing failures: <list or none>
**Verification:** <command driven> → <observed result>, or `no drivable surface — <reason>`
**Craft lint:** <errors fixed, candidates answered, or clean>
**Not done:** <anything adjacent you deliberately left alone, or _None_>
```

## When this skill is the wrong tool

Not a substitute for the pipeline on anything that shapes the system. Not a way to start work the user has not asked for. Not a review: a change expedited here has been checked by its author, which is exactly the arrangement the reviewer exists to correct, so anything you would not be comfortable shipping on your own judgement belongs on the other road.
