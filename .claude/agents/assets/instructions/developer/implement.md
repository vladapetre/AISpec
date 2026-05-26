# Developer — Implement mode

Loaded by `agents/developer.md` step 2 on a fresh phase or a clean continuation. Carries the implement-and-request-approval path.

Pre-flight semantics: `assets/preflight.yaml#developer`.

## Steps

5. Read every file you will touch. Verify no conflict with completed phases (overwrites earlier work, depends on something removed, criteria require redoing completed work). Conflict → surface and stop.

6. Implement the phase. Apply the craftsmanship charter — part of the job, not extra. Do not implement ahead. Plan prescribes a **craft** anti-pattern → silently apply your authority (rename, split, restructure). Plan prescribes a **structural** anti-pattern (contradicts a real constraint, or has been overtaken by a requirement) → stop and propose an alternative to the architect.

7. Run tests and linter. Load `assets/detectors.yaml` for the test/lint cascade and failure-handling rules (first match wins per category).

8. Produce the phase summary per the Output format below.

9. Stop and request review. **Required approver every phase: user.** The reviewer runs cumulatively at end-of-plan unless the user explicitly requests an ad-hoc per-phase review (then also name the reviewer).

10. Wait for the team lead to relay the user's `approved` (case-insensitive). Anything else is a rejection.

11. On approval: insert `**Status: Complete**` immediately after the phase's `<!-- status:phase-N -->` anchor (missing anchor → after `**Done when:**` and note the deviation). Update the per-plan progress file. Final phase → emit `## All Phases Complete` summary covering the full plan and route to the reviewer for cumulative review. Otherwise re-read the plan (architect may have amended a future phase) and advance.

## Output format

Emit before requesting review. Always render every block; use `_None_` for empty lists.

```
## Phase N Complete — <title from the plan>

**Plan:** <plan filename> — <N> phases total, <M> complete after this phase

**Changes made:**
- files modified or created

**Decisions made:**
- ambiguities resolved and the reading chosen (with one-line reason) | _None_

**Pushed back on (structural only):**
- design issues raised to the architect because they're structural, not craft | _None_

**Tests:** passed | failed (list) | no test suite detected
**Linter:** passed | failed (list) | no linter detected

**[IRREVERSIBLE] steps executed:**
- list | _None_

**Deviations from plan:**
- deviation and reason | _None_

---
Requesting approval from: USER
(reviewer runs cumulatively at end-of-plan unless ad-hoc review was requested)
```

At end-of-plan, after the final phase's user approval, emit instead:

```
## All Phases Complete — <plan short-title>

**Plan:** <plan filename> — all <N> phases complete
**Commit range:** <first..last>
**Files changed (union):** <list>

---
Requesting cumulative review from: REVIEWER
```

## Tokens (this mode)

- **Emits:** `## Phase N Complete`, `## All Phases Complete`, `**Status: Complete**`, `[PRE-EXISTING]`.
- **Consumes:** `approved` (user).
