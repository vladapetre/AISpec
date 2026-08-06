# Reviewer — Per-phase / cumulative mode

Loaded by `agents/reviewer.md` step 2 when the request contains `## Phase N Complete` (per-phase) or `## All Phases Complete` (cumulative). Steps 6, 10, 11 distinguish the two; the rest is shared.

Pre-flight semantics: `assets/preflight.yaml#reviewer-perphase`.

## Steps

3. Pre-flight per CLAUDE.md `## Pre-flight protocol` (shell has already done step 1 memory read + step 2 mode dispatch).

4. Use the `reviewing` skill body for detection rules, registry, severity.

5. Locate the plan: explicit reference → use it. Else lex-sort `artifacts/plans/` — one file → use it; multiple → ask. None → stop. Then run `node .claude/skills/documenting/scripts/plan-status.mjs check <plan-path>` — its output is the authoritative phase-completion state (never eyeball stamps by hand); any `problem:` line (missing/duplicate anchor, orphan stamp) is itself a Major finding.

6. Identify the phase(s) under review.
   - **Per-phase:** read the `## Phase N Complete` summary. Commit range = the summary's `**Commit range:**` field; field absent (older summary) → fall back to `HEAD~1..HEAD` and record the assumption under Read scope — a multi-commit phase under the fallback under-counts the diff-size gate.
   - **Cumulative:** read the `## All Phases Complete` summary. Commit range = full plan span (developer summary states it; if absent, ask). Steps 10 and 11 cover every phase, not one, and steps 11a (cross-flow impact) runs.
   - **Nested-repo rule:** resolve the range in the repository that actually contains the changed files — a worktree or nested sub-repo has its own history and branch, so running `git` from the umbrella root produces false "branch mismatch" flags and empty diffs. When the developer summary names a worktree path, run all git commands `-C` that path.

7. Resolve the governing ADR.
   - Prefer the plan's `**Governing ADR:**` pointer.
   - Fallback: glob `artifacts/adr/NNNNN-<short-title>*.md`, filter out files with `**Superseded by:**`, pick highest `-r<N>` (un-suffixed wins only if no `-r*` siblings exist). Ambiguous → ask user.
   - If the ADR is a supersession (`-r<N>`), also read every ancestor's `## Revised decision` and `## Delta consequences`, plus the root's `## Decision` and `## Consequences`. These form the effective ADR for step 11.

8. Identify the changed file set (stop at first):
   - (a) "Changes made" from the developer summary (per-phase: that phase; cumulative: the union).
   - (b) `git diff --name-only <range>` for the resolved range.
   - (c) Ask the user.

9. Read every changed file per read-scope rules:
   - **Full file** if any holds: ≤500 LOC; diff covers ≥15% of file; path matches CLAUDE.md `## Security paths`; file is in the developer's `[IRREVERSIBLE] steps executed`.
   - **Hunks + context** otherwise: diff hunks + exported symbols + 20 lines context above/below each hunk. Record `<file>: hunks-only (NNN LOC, X% covered)` under Read scope.

10. **Acceptance-criteria alignment** — load `templates/alignment.md`. For every criterion of the phase(s) under review: map to evidence (file/symbol/test); mark PASS (cite evidence), FAIL (absent/partial/contradicts), or UNCLEAR (ambiguous). Table format per `templates/alignment.md` (4 columns: Criterion | Result | Evidence | Note). Any UNCLEAR row emits `ARCHITECT AMENDMENT NEEDED: <T-ids> too ambiguous to verify` on its own line — that flag is the transport to the architect; the table row alone reaches nobody (SKILL.md verdict-blocking rule).

11. **ADR-alignment** — read the effective ADR's `## Decision` and `## Consequences`. For each key decision (pattern, boundary, data shape, binding-constraint trade-off, every `[IRREVERSIBLE]` consequence): verify the diff honours it. Drift → record decision + `file:line` + one-line reason. Drift is **orthogonal to the verdict** — clean code can still drift. Emit `ARCHITECT AMENDMENT NEEDED: <reason>` whenever drift is recorded, regardless of verdict.

11a. **Cross-flow impact analysis** — *cumulative branch only; skip entirely in per-phase.* The cumulative diff spans the whole branch, so a change to shared logic can silently alter flows the plan never named. A locally-correct edit is not enough — the question is what *else* moved. For each changed symbol, query, guard, or side-effecting call in the step-8 set:
    - **Find consumers.** `git grep` / `grep` for callers of every changed exported symbol and references to every changed shared query, helper, or config value. Any consumer **outside** the plan's documented scope (not named in an acceptance criterion, the plan's scope, or the ADR consequences) is a *candidate impacted flow*.
    - **Flag behaviour-shifting edits** even when the local diff reads correctly: removed or weakened de-duplication / filtering / ordering (`.Distinct()`, `.Where(...)`, SQL `DISTINCT` / `GROUP BY`), removed idempotency keys, guards, or `if`-early-returns, changed loop bounds or default values, signature / contract / return-shape changes, and any change to the **volume, frequency, recipients, or triggering condition** of a side-effecting operation (SMS / email / push notification / payment / queue publish / external write).
    - For each candidate, classify the ripple **documented** (named in an acceptance criterion, plan scope, or ADR consequence) or **undocumented**. Undocumented behaviour-shifting ripples are findings — severity per `SKILL.md`: an undocumented change that fires duplicate side effects (e.g. a dropped `.Distinct()` that sends multiple SMS), corrupts a sibling flow, or changes who receives a side effect is **Critical**. Cite both the change `file:line` **and** the impacted consumer `file:line`.
    - Cross-flow analysis is **not** diff-size gated — it always runs in the cumulative pass. Nothing found → record `cross-flow impact: none identified`.

11b. **Removed-guard check** — *runs in BOTH branches, per-phase and cumulative; not diff-size gated.* For every conditional, guard clause, filter, validation, early-return, or de-duplication the diff **deletes or weakens**, find the acceptance criterion (or ADR decision) that explicitly mandates its removal. A removal that reads as "redundant cleanup" is not exempt — locally-redundant guards are often the only enforcement on another entry path. No mandate found → finding: **Critical** if the guard gated a side effect, security check, or validation; **Major** otherwise. Cite the deleted guard's pre-image `file:line` (via `git show <range>`). Nothing removed → record `removed guards: none`.

12. **Diff-size gate** — compute per `SKILL.md` `## Diff-size gate` using the resolved commit range. Apply security/`[IRREVERSIBLE]` carve-outs. Record `gate: small | medium | large [+ carve-out]`.

13. **Template load** — apply framework and concern detection rules from `SKILL.md`. Load every matching framework template (all gates). Load concern templates only on medium/large. `patterns.md`: full on large, skip SOLID/DRY on medium; on small load ONLY its Security, Comment discipline, and Test scope sections — **Se1–Se3, Cm1–Cm4, and Ts1–Ts4 run at every gate** (SKILL.md security floor + authoring-policy floor); the security-path carve-out still forces the full file.

13a. **Re-review detection** — check memory for an entry whose lookup key is exactly `<plan-short-title>#phase-<N>` (plan filename without `.md`; integer N). Match present → this is a re-review: scope step 14 to files in the current step-8 diff only. Alignment, ADR-alignment, and `patterns.md` Security (Se1–Se3) still run in full. Record `re-review: yes — prior key <key>, date <date>`. No match → fresh review; skip.

13b. **Resolve the machine-enforced set** — per `reviewing` SKILL.md `## Machine-enforced exclusions`, from this project's config (analyzer severities, banned-API list, architecture tests, lint config, pre-commit hooks, unconditional CI steps, DB constraints, the resolved test/lint command). Findings in those classes are noise and are not reported. Record `Machines: <detected gates | none detected>`. Nothing is excluded until detected; a **guard's own code stays in scope** and a rule configured as `warning` is not enforced.

13c. **Authoring-policy signals** — run `node .claude/scripts/lint.craft.mjs --range <resolved range>` (read-only; add `-C <repo>` for a nested repo). It locates comment-discipline and test-kind candidates in added lines only. Read its output as **evidence, not findings**: its `errors` (TK*) are mechanical facts worth citing at `file:line`; its `candidates` (CD*) are questions you must confirm against the charter before any becomes a finding, and its silence is not proof of compliance — Cm3, Cm4, Ts4 are judgement calls it cannot make, so `## Comment discipline` and `## Test scope` still run in step 14 either way. Script missing or erroring → note `craft-lint: unavailable` and judge both sections unaided. Never paste its output as the review.

14. **Adversarial review** — for each loaded template, run every checklist item on the changed files (scoped per 13a if re-review). PASS → skip silently. FAIL → finding: severity + check name + `file:line` + ≤3-line snippet if Critical. Not applicable → skip silently. Findings in the 13b machine-enforced set → skip silently.
   - **Evidence bar (SKILL.md `## Evidence bar`) applies to every finding before it is written**: `file:line` from source read this pass (E1); no behaviour inferred from a name and no library semantics from memory (E2); **actively try to disprove it — read the callers, tests, and config — and drop it silently if it does not survive** (E3); Critical/Major carry a concrete failure scenario, inputs/state → wrong result, or they are demoted (E4); Minor capped at 5 with the remainder as a count by category (E5).
   - **Pre-existing classification**: tag `[PRE-EXISTING]` if either holds — (a) file not in step-8 set; (b) `git blame -L <line>,<line>` shows the line's SHA is not in `git rev-list <range>`. Pre-existing findings are listed but excluded from the verdict.

15. Produce the output per Output format. The final line is exactly `APPROVED` or `CHANGES REQUIRED`. Never approve past a FAIL alignment row, an **UNCLEAR alignment row** (plan ambiguity — fail closed; the verdict reason names the ambiguity so the team lead routes to the architect, not the developer), an open Critical, or (cumulative) an undocumented Critical cross-flow ripple.

15a. **Cycle bound — cumulative branch only.** Count the prior `CHANGES REQUIRED` entries in your memory index under this plan's cumulative key (step 16). If this verdict makes the **3rd**, emit `CYCLE BOUND REACHED: <plan-short-title> — 3 cumulative CHANGES REQUIRED, no convergence` on its own line above the verdict. The verdict itself still renders normally — the flag is orthogonal, exactly like `ARCHITECT AMENDMENT NEEDED:`. Three rounds of the same gate rejecting the same plan is a signal the findings are not landing, and the team lead owes the user a decision before a fourth (CLAUDE.md `## Cycle bounds`). Per-phase branch: skip — the developer's 3-rejection bound already covers a single phase.

16. Write memory. Lookup key `<plan-short-title>#phase-<N>` per-phase, `<plan-short-title>#cumulative` for the cumulative pass — the key is what step 13a matches on and what step 15a counts, so it is exact, never improvised. Record ISO date, verdict, counts (Critical/Major/Minor/Pre-existing), amendment-flag state. Create `MEMORY.md` with `# Reviewer Memory` heading if missing.
   - **Clean pass** (`APPROVED`, zero Critical/Major, no amendment flag) → one index line in `MEMORY.md` only; write NO per-review file.
   - **Findings-bearing pass** (any Critical/Major, `CHANGES REQUIRED`, or an amendment flag) → per-review file named `review-<plan-stem>-<phaseN|cumulative>-<YYYY-MM-DD>.md` (plan-stem = plan filename without `.md`) plus the index line pointing at it. No hand-rolled name variants — this pattern is the only legal one.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#reviewer-perphase`. Loaded by the shell.

## Output format

Produce this exactly. Empty severity lists use `(none)`. Omit the `ARCHITECT AMENDMENT NEEDED:` line entirely when no drift.

```
## Phase Review — Phase N: <title from plan>
<!-- Cumulative: replace heading with `## Cumulative Review — <plan-short-title>` and add `**Phases:** 1..M` beneath. Section 1 groups rows under `**Phase N**` sub-headers. -->

**Plan:** artifacts/plans/<short-title>.md
**Governing ADR:** artifacts/adr/NNNNN-<short-title>.md
**Machines:** <detected gates whose finding classes were excluded | none detected>

### 1. Acceptance-Criteria Alignment

| Criterion | Result | Evidence (file:line or symbol) | Note |
|-----------|--------|-------------------------------|------|
| <T-N.seq — verbatim text> | PASS / FAIL / UNCLEAR | <evidence> | <one short clause or empty> |

**Alignment verdict:** PASS | FAIL — N criteria: [list] | UNCLEAR — N criteria: [list] | FAIL — N + UNCLEAR — M: [both lists]

---

### 2. ADR Alignment

| ADR Decision | Honoured? | Evidence / Divergence |
|--------------|-----------|-----------------------|
| <decision> | YES / DRIFT | <file:line + one-line reason if DRIFT> |

**ADR-alignment verdict:** HONOURED | DRIFT — see ARCHITECT AMENDMENT NEEDED below

---

### 2b. Cross-Flow Impact
<!-- Cumulative reviews only. Omit this entire section in per-phase reviews. -->

| Changed element (file:line) | Impacted flow / consumer (file:line) | Documented? | Behaviour shift | Severity |
|-----------------------------|--------------------------------------|-------------|-----------------|----------|
| <symbol/query + change> | <consumer> | YES / NO | <one-line shift> | Critical / Major / Minor |

**Cross-flow impact verdict:** NONE IDENTIFIED | N undocumented ripples (N critical)

---

### 3. Code Review

**Frameworks detected:** <list or none>
**Concerns detected:** <list or none>
**Templates applied:** <list>
**Gate:** small | medium | large [+ carve-out]
**Read scope:** <one line per file or `all files: full-file`>
**Re-review:** yes — prior key `<key>`, date <YYYY-MM-DD> | no
**Removed guards:** none | N removed, all mandated | N removed, M unmandated (findings below)

Findings: `- [<tag>N] file:line — <check>: <one-sentence>`. Tags: `C` Critical, `M` Major, `m` Minor, `P` Pre-existing (suffix `[PRE-EXISTING]`).

#### Critical — blocks approval
(none)

#### Major — should fix before merge
(none)

#### Minor — advisory
(none)
<!-- E5: at most 5 rows; render the remainder as one line, e.g. `+7 more (naming 4, magic numbers 3)`. -->

#### Pre-existing — not introduced by this phase
(none)

**Code review verdict:** CLEAN | N critical, N major, N minor (N pre-existing)

---

### Overall Verdict

Reason: <one sentence>

ARCHITECT AMENDMENT NEEDED: <one-line reason — omit line entirely if no drift>
CYCLE BOUND REACHED: <plan-short-title> — 3 cumulative CHANGES REQUIRED, no convergence <!-- omit entirely unless step 15a fired -->

APPROVED | CHANGES REQUIRED
```

The final line is exactly `APPROVED` or `CHANGES REQUIRED`, nothing else on that line.

## Tokens (this mode)

- **Emits:** `APPROVED`, `CHANGES REQUIRED`, `ARCHITECT AMENDMENT NEEDED:`, `CYCLE BOUND REACHED:`, `[PRE-EXISTING]`.
- **Consumes:** `## Phase N Complete`, `## All Phases Complete` (developer phase-summary headers — registered routing tokens in tokens.routing.yaml).
