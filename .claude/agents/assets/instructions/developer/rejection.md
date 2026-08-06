# Developer — Rejection mode

Loaded by `agents/developer.md` step 2 when the request carries a non-`approved` user reply, a reviewer `CHANGES REQUIRED`, or an architect `RECONCILE WITH ADR:`. Carries feedback classification and re-request.

Pre-flight semantics: `assets/preflight.yaml#developer-rejection`.

## Steps

R1. Classify the feedback first.
   - **Craft feedback** (rename, refactor, restructure, code-quality, "this is subpar") → address yourself; re-run tests and linter per `assets/detectors.yaml`; any test the fix adds obeys `#test_authoring_policy` — a reviewer finding of "missing integration/e2e coverage" is answered with unit coverage plus the step-7a drive, never by adding the excluded kind; if the fix touched a drivable surface, re-run the `implement.md` step-7a verification loop (a rejection fix that breaks the running flow is the worst kind); produce a fresh phase summary per `implement.md` Output format; re-request. Do **not** loop in the architect. The ADR is untouched.
   - **Structural feedback** (the user is asking for a different design decision, a different boundary, a different integration pattern, or a requirement the plan didn't anticipate) → surface for routing to `architect-amendment`; wait for `RECONCILE WITH ADR:` or an amended plan; then address.
   - **Grey zone** (you cannot tell) → ask the user one question per the grey-zone rule in the craftsmanship charter; do not default to escalation.

R2. Architect-initiated feedback (`RECONCILE WITH ADR:` or an amended plan touching the current/just-completed phase) is always addressed and re-requested as craft feedback would be: address → re-run tests/linter → fresh phase summary → re-request.

R3. After the 3rd rejection of the same phase, stop and escalate to the user with a one-paragraph diagnosis (what was rejected, why each attempt missed, what you'd recommend the user decide).

## Output format

After addressing feedback, emit the standard `## Phase N Complete` block from `implement.md`, with the **Decisions made** block carrying any reading-changes prompted by the feedback. At the 3-rejection bound, emit instead:

```
## Phase N Stalled — <title from the plan>

**Plan:** <plan filename>
**Rejections:** 3
**Pattern:** <one-sentence diagnosis of why each attempt missed>
**Recommendation:** <one sentence — what the user should decide>

---
Awaiting user decision: USER
```

## Tokens (this mode)

- **Emits:** `## Phase N Complete` (after fix), `## Phase N Stalled` (at 3-rejection bound), structural escalation surfaced for routing.
- **Consumes:** `CHANGES REQUIRED` (reviewer), `RECONCILE WITH ADR:` (architect), user rejection (non-`approved`).
