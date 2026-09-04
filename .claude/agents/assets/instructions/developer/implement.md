# Developer — Implement mode

Loaded by `agents/developer.md` step 2 on a fresh phase or a clean continuation. Carries the implement-and-request-approval path.

Pre-flight semantics: `assets/preflight.yaml#developer-implement`.

## Worktree readiness (entry turn only)

Runs **once per task entry** — the first phase of a plan, or the first turn resuming one — never on ordinary phase-to-phase continuation. Skip it entirely on continuation turns.

**Gate.** Applies only when the project uses per-feature git worktrees across nested repos (the `branching` skill's layout — unrelated to multi-agent workflows). Trust the manifest first: `.claude/branching/manifest.yaml` exists → gate holds (it self-heals; do not re-derive). Manifest absent → probe once for ≥2 nested git repos under `src/`. Neither → single-repo project; skip silently and work in the current checkout.

When the gate holds, before step 5:
1. Determine the **feature branch name** — from the plan (its short-title or an explicit branch reference) or from what the user/team lead supplied. Unknown → ask the user for it and stop; **never invent one** (the `branching` skill enforces the same rule).
2. Read `.claude/skills/branching/SKILL.md` now — it is *(deferred)*, loaded only when this gate holds, because most projects and every ordinary continuation turn never need it. Run its **create-or-resume** operation: it resumes the feature's existing worktree(s) if present, else creates one per repo the feature touches. Surface its mutating `git worktree` command(s) for confirmation as usual.
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

9a. **Run offer — name the batch the user could grant.** Compute the maximal prefix of the REMAINING phases in which every phase is run-eligible: no `[IRREVERSIBLE]` block, no touch-set path under CLAUDE.md `## Security paths`, no schema or data-migration work, and no mid-plan checkpoint boundary (step 11) inside the span. Span non-empty → render the `**Run offer:**` line naming it and the exact grant wording; empty → render `_None — <first blocking reason>_`. The offer is information, never permission: absent the user's own words granting the run, one phase per approval cycle stands (CLAUDE.md `## Implementation Review`). Every stop costs the user minutes, so a grantable run they can see is cheaper than one they must derive from the plan.

10. Wait for the team lead to relay the user's `approved` (case-insensitive). Anything else is a rejection.
    - **Approved run (CLAUDE.md `## Implementation Review`).** When the relayed approval names a range of phases rather than this one ("run phases 1 to 3"), stamp this phase, emit its summary, and continue straight into the next phase without waiting. Stop and wait anyway — the run ends here — on any of: an `[IRREVERSIBLE]` step in the phase about to start, a `## Security paths` file in its touch set, a mid-plan checkpoint firing at step 11, the last phase of the run, or any rejection. Never grant yourself a run: absent an explicit range from the user, one phase per approval cycle stands.

11. On approval: stamp the phase via `node .claude/skills/documenting/scripts/plan-status.mjs stamp <plan-path> <N>` — never hand-edit the stamp (missing anchor → the script errors; insert manually after `**Done when:**` and note the deviation). Update the per-plan progress file. Then, in order:
   - **Final phase** → emit the `## All Phases Complete` summary covering the full plan and route to the reviewer for cumulative review.
   - **Mid-plan checkpoint** (CLAUDE.md `## Implementation Review` — the plan has ≥6 phases and this is the ⌈N/2⌉-th approved phase, OR this phase reported `[IRREVERSIBLE] steps executed`, OR it touched a `## Security paths` file) → route this phase's `## Phase N Complete` to the reviewer (Per-phase mode) and wait for `APPROVED` before advancing. `CHANGES REQUIRED` → re-enter Rejection mode; `ARCHITECT AMENDMENT NEEDED:` → surface for routing to the architect first.
   - **Otherwise** → re-read the plan (the architect may have amended a future phase) and advance.

## Output format

Governed by `assets/brief.yaml#developer-implement` — read that key before emitting. Fields whose value would be `_None_` are not rendered; they are named once on the `Nil:` line. The `always:` fields render every phase regardless.

```
## Phase N Complete — <title from the plan>

<one sentence: what this phase now does that it did not before — brief.yaml answer_first>

**Plan:** <plan filename> · phase N of M · commits <first..last> | uncommitted (working tree)
**Changes:** <n> files — `<path>`, `<path>`, `<path>` [, +<k> more in the progress file]
**Tests:** passed | failed (list) | no test suite detected — authored: <N unit, M arch> | none [| <kind> — unlocked by <who>]
**Linter:** passed | failed (list) | no linter detected
**Verification:** <command driven> → <observed result, trimmed> (covers T-N.x, T-N.y) | no drivable surface — <reason> | not drivable in this environment — <blocker, surfaced>

**Decisions made:**
- <ambiguity resolved, the reading chosen, and the one-line reason>

**Pushed back on (structural only):**
- <design issue raised to the architect because it is structural, not craft>

**[IRREVERSIBLE] steps executed:**
- <step>

**Deviations from plan:**
- <deviation and reason>

Nil: <fields omitted this phase, in output order>
Full: .claude/agent-memory/developer/plan-<short-title>.md

---
Requesting approval from: USER
**Run offer:** phases <N+1>–<M> are run-eligible (reversible, no security path, no schema change, no checkpoint inside) — reply `approved through <M>` to run them without per-phase stops | _None — <first blocking reason>_
```

Field rules:
- **`**Verification:**` is exempt from every collapse**, populated or not. CLAUDE.md `## Implementation Review` makes it the phase gate rather than the test run, and `guard.verdict.mjs` checks its claim against observed drive evidence. The same holds for `**Tests:**` and `**Linter:**`: "no linter detected" is information the user acts on.
- **`**Plan:**` is machine_consumed** — the reviewer's pre-flight resolves the plan path, the phase number, and the commit range off this one line. Compress it, never drop it.
- The four list blocks (`Decisions made`, `Pushed back on`, `[IRREVERSIBLE] steps executed`, `Deviations from plan`) render only when they have entries. An empty phase names all four on the `Nil:` line and costs one line instead of eight.
- Over five changed files: name five and count the rest. The full list is in the progress file, which step 11 writes anyway.
- The standing note about when the reviewer runs (cumulatively at end-of-plan, at mid-plan checkpoints, ad-hoc on request) is contract, not news. It lives in CLAUDE.md `## Implementation Review` and no longer repeats on every phase.

At end-of-plan, after the final phase's user approval, emit instead:

```
## All Phases Complete — <plan short-title>

<one sentence: what the plan delivered>

**Plan:** <plan filename> — all <N> phases complete · commits <first..last>
**Files changed (union):** <list>

---
Requesting cumulative review from: REVIEWER
```

The union list is machine_consumed by the cumulative reviewer and renders in full however long it runs.

## Tokens (this mode)

- **Emits:** `## Phase N Complete`, `## All Phases Complete`, `**Status: Complete**`, `[PRE-EXISTING]`.
- **Consumes:** `approved` (user).
