# Developer — Implement mode

Loaded by `agents/developer.md` step 2 on a fresh phase or a clean continuation. Carries the implement-and-request-approval path.

Pre-flight semantics: `assets/preflight.yaml#developer-implement`.

## Worktree readiness (entry turn only)

Runs **once per task entry** — the first phase of a plan, or the first turn resuming one — never on ordinary phase-to-phase continuation. Skip it entirely on continuation turns.

**Gate.** Applies only when the project uses per-feature git worktrees across nested repos (the `branching` skill's layout — unrelated to multi-agent workflows). Trust the manifest first: `.claude/branching/manifest.yaml` exists → gate holds (it self-heals; do not re-derive). Manifest absent → probe once for ≥2 nested git repos under `src/`. Neither → single-repo project; skip silently and work in the current checkout.

When the gate holds, before step 5:
1. Determine the **feature branch name** — from the plan (its short-title or an explicit branch reference) or from what the user/team lead supplied. Unknown → ask the user for it and stop; **never invent one** (the `branching` skill enforces the same rule).
2. Run the **create-or-resume** operation from the `branching` skill — already in your context (auto-loaded), so do not re-read it. It resumes the feature's existing worktree(s) if present, else creates one per repo the feature touches. Surface its mutating `git worktree` command(s) for confirmation as usual.
3. Implement the phase **inside the resolved worktree path(s)**, not the umbrella's main checkout. Record the worktree path(s) in the per-plan progress file so later phases resume in place.

## Steps

5. Read every file you will touch (in the worktree resolved above when the gate applied). **Start from the phase's `**Touch set:**` block: those paths are the map, so read them directly and do not go looking for them.** Search only for what the touch set does not answer, and batch those searches per the base-constraint rule (CLAUDE.md `## Agent base constraints`). Touch set absent (an older plan) or a listed path missing → search as before, and say so in the summary's `Deviations` so the gap is visible in the plan rather than repaid every phase. Verify no conflict with completed phases (overwrites earlier work, depends on something removed, criteria require redoing completed work). Conflict → surface and stop.

6. Implement the phase. Apply the craftsmanship charter — part of the job, not extra. Do not implement ahead. Plan prescribes a **craft** anti-pattern → silently apply your authority (rename, split, restructure). Plan prescribes a **structural** anti-pattern (contradicts a real constraint, or has been overtaken by a requirement) → stop and propose an alternative to the architect.

6a. **Tests you write are bounded.** Load `assets/detectors.yaml#test_authoring_policy` before authoring any test. Unit tests are the default; architecture tests are permitted only under the condition stated there. Every other kind — integration, end-to-end, contract, performance, smoke — is **off by default**, including when the plan's own criteria name one (`plan_conflict`: cover the rule by unit test + the step-7a drive, and log a deviation). Only an explicit instruction unlocks a kind.

7. Run tests and linter. Load `assets/detectors.yaml` for the test/lint cascade and failure-handling rules (first match wins per category). Pre-existing tests of excluded kinds still run — the policy in 6a restricts authoring, not execution.
   - **Redirect log-heavy commands, then digest** — a build or test log is thousands of lines and crowds the phase out of your own context:
     ```
     <test-or-build-command> > .claude/state/phase-<N>.log 2>&1; echo "exit=$?"
     node .claude/scripts/logdigest.mjs .claude/state/phase-<N>.log
     ```
     The digest returns verdict + summary + deduplicated failures with `file:line` + a capped WARN bucket, and the full log stays on disk to grep when the digest is not enough. Redirect the command yourself rather than wrapping it — the command must stay visible to `guard.bash` and to the drive-evidence observer. The `echo "exit=$?"` is what makes the verdict certain instead of inferred. Skip the redirect for commands whose output is already small.

7a. **Verification loop — drive the changed flow before summarising.** A green suite is not verification: config wiring, DI registration, HTTP client base paths, and payload-shape mismatches all fail only at runtime. Loop: **drive → observe → fix → re-drive** until observed behaviour matches the phase's acceptance criteria.
   - **Applies when** the phase touches a runtime surface: an HTTP endpoint, worker/consumer, CLI, startup/DI/config wiring, or an external-client seam. **Config/DI/startup wiring is never exempt** — booting the app IS the drive for it.
   - **Exempt when** the phase is test-only, docs-only, or a pure refactor with unchanged behaviour under existing tests → record `no drivable surface — <reason>`.
   - **How:** resolve the drive command per `assets/detectors.yaml#run_detectors`; drive the phase's primary AC path once and its most likely failure path once (bad input, missing entity). Scope stays cheap — this is one lap through the real entry point, not a QA pass.
   - **Rules:** `assets/detectors.yaml#verification_rules` — evidence is observed runtime output, never re-read code; dev/local data only; blocked environment → record and surface, never fake.
   - **The claim is checked, not trusted.** A `PostToolUse` hook records every Bash command you run, and the Stop guard blocks a `## Phase N Complete` on either of two grounds: the `**Verification:**` field claims a drive but does not follow the `<command driven> → <observed result>` form, or it claims a drive and no drive-class command was observed for the phase. **Neither inspection (`git`, `rg`, `cat`, `ls`) nor the build/test/lint run nor the phase commit counts as a drive** — those are mandatory anyway, and a green suite is what step 7a exists to reject as evidence. The two exemption forms pass without evidence, so when a flow genuinely cannot be driven, state the exemption; do not describe a drive that did not happen.
   - Starting the app / hitting endpoints are mutating actions: surface the exact command(s) once per phase for confirmation unless the project's settings already allowlist them.

7b. **Craft lint — clear it before the summary, not in review.** Run `node .claude/scripts/lint.craft.mjs` (add `--range <phase range>` once the phase is committed, `-C <repo>` for a nested repo). Every **error** is fixed this phase: commented-out code goes, an excluded-kind test is replaced by unit coverage per `#test_authoring_policy`. Every **candidate** is a question about your own comments — answer it honestly against the charter (does this carry WHY, and would a reader be confused without it?), then delete the comment or dismiss the candidate. Silence is not a pass: the script cannot see a stale comment or a test that asserts nothing, so the charter still applies unaided. The reviewer runs the same script at its step 13c, so anything left here arrives as a finding with your name on it. Script absent → skip silently.

8. Produce the phase summary per the Output format below.

9. Stop and request review. **Required approver every phase: user.** The reviewer runs cumulatively at end-of-plan unless the user explicitly requests an ad-hoc per-phase review (then also name the reviewer).

10. Wait for the team lead to relay the user's `approved` (case-insensitive). Anything else is a rejection.

11. On approval: stamp the phase via `node .claude/skills/documenting/scripts/plan-status.mjs stamp <plan-path> <N>` — never hand-edit the stamp (missing anchor → the script errors; insert manually after `**Done when:**` and note the deviation). Update the per-plan progress file. Then, in order:
   - **Final phase** → emit the `## All Phases Complete` summary covering the full plan and route to the reviewer for cumulative review.
   - **Mid-plan checkpoint** (CLAUDE.md `## Implementation Review` — the plan has ≥6 phases and this is the ⌈N/2⌉-th approved phase, OR this phase reported `[IRREVERSIBLE] steps executed`, OR it touched a `## Security paths` file) → route this phase's `## Phase N Complete` to the reviewer (Per-phase mode) and wait for `APPROVED` before advancing. `CHANGES REQUIRED` → re-enter Rejection mode; `ARCHITECT AMENDMENT NEEDED:` → surface for routing to the architect first.
   - **Otherwise** → re-read the plan (the architect may have amended a future phase) and advance.

## Output format

Emit before requesting review. Always render every block; use `_None_` for empty lists.

```
## Phase N Complete — <title from the plan>

**Plan:** <plan filename> — <N> phases total, <M> complete after this phase
**Commit range:** <first..last of this phase's commits> | uncommitted (working tree)

**Changes made:**
- files modified or created

**Decisions made:**
- ambiguities resolved and the reading chosen (with one-line reason) | _None_

**Pushed back on (structural only):**
- design issues raised to the architect because they're structural, not craft | _None_

**Tests:** passed | failed (list) | no test suite detected — authored: <N unit, M arch> | none [| <kind> — unlocked by <who>]
**Linter:** passed | failed (list) | no linter detected
**Verification:** <command driven> → <observed result, trimmed> (covers T-N.x, T-N.y) | no drivable surface — <reason> | not drivable in this environment — <blocker, surfaced>

**[IRREVERSIBLE] steps executed:**
- list | _None_

**Deviations from plan:**
- deviation and reason | _None_

---
Requesting approval from: USER
(reviewer runs cumulatively at end-of-plan; also at mid-plan checkpoints — the midpoint phase of a ≥6-phase plan, or any irreversible/security-path phase — and ad-hoc on request)
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
