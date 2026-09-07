---
name: expediting
description: >
  The fast lane: implement a small, low-risk change end to end in the main session, with no
  artifact, no spawn and no phase gate, while keeping the test run, the runtime drive and the
  craft bar. Use when `harness admit` answers `fast`, or when the user says "just fix",
  "quick change", "small fix", "rename", "add a guard", "change the default", "don't spin up
  the pipeline", or "expedite this". Refuses, naming the lane to use instead, the moment the
  observed touch set or a discovered decision breaks the fast-lane conditions.
user-invocable: true
---

# Expediting

Admission is computed, not felt. The lane skill you are reading runs in the main session; no agent is spawned.

Lane check for this request:

!`node .claude/bin/harness.mjs admit --text "$ARGUMENTS" --human`

If the line above does not say `lane: fast`, stop here and run the named lane skill instead (`ordering`, `designing`, `researching`). Do not argue with it in prose; a forced lane is written into the request as `lane: fast`.

## Steps

Read one step file at a time, in order. Each is under 80 lines.

| Step | Read when |
|---|---|
| `steps/10-admit.md` | the line above says `fast`: open the work item and confirm the touch set |
| `steps/20-change.md` | the touch set is confirmed: make the change to the craft bar |
| `steps/30-check.md` | the change compiles: tests, lint, drive, commit, close |

## Escalation

Re-run `harness admit --text "<request>" --touched <comma-separated paths you have edited or must edit>` whenever the touch set grows or a decision appears (a new dependency, a changed contract, a second module, a security path, a migration). When it answers a heavier lane, stop editing, keep the diff, and hand the lane skill it names both the request and the diff. The gate breaking is the gate working.

## Output

The fast lane prints one block and stops. No routing suggestions, no offers.

```
## Expedited: <id>

<one sentence: what now works that did not>

Files: <path>, <path>
Tests: passed | failed: <what> | no suite detected
Lint: passed | failed: <what> | none detected
Verified: <command> → <observed result> | no drivable surface: <reason>
Commit: <sha>
```
