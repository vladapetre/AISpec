# Reviewer — Per-phase / cumulative mode

Loaded by `agents/reviewer.md` step 2 when the request contains `## Phase N Complete` (per-phase) or `## All Phases Complete` (cumulative). Steps 6, 10, 11 distinguish the two; the rest is shared.

Pre-flight semantics: `assets/preflight.yaml#reviewer-perphase`.

## Steps

3. Pre-flight per CLAUDE.md `## Pre-flight protocol` (shell has already done step 1 memory read + step 2 mode dispatch).

4. Use the `reviewing` skill body for detection rules, registry, severity.

5. Locate the plan: explicit reference → use it. Else lex-sort `artifacts/plans/` — one file → use it; multiple → ask. None → stop.

6. Identify the phase(s) under review.
   - **Per-phase:** read the `## Phase N Complete` summary. Commit range = `HEAD~1..HEAD`.
   - **Cumulative:** read the `## All Phases Complete` summary. Commit range = full plan span (developer summary states it; if absent, ask). Steps 10 and 11 cover every phase, not one.

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

10. **Acceptance-criteria alignment** — load `templates/alignment.md`. For every criterion of the phase(s) under review: map to evidence (file/symbol/test); mark PASS (cite evidence), FAIL (absent/partial/contradicts), or UNCLEAR (ambiguous — surface to architect). Table format per `templates/alignment.md` (4 columns: Criterion | Result | Evidence | Note).

11. **ADR-alignment** — read the effective ADR's `## Decision` and `## Consequences`. For each key decision (pattern, boundary, data shape, binding-constraint trade-off, every `[IRREVERSIBLE]` consequence): verify the diff honours it. Drift → record decision + `file:line` + one-line reason. Drift is **orthogonal to the verdict** — clean code can still drift. Emit `ARCHITECT AMENDMENT NEEDED: <reason>` whenever drift is recorded, regardless of verdict.

12. **Diff-size gate** — compute per `SKILL.md` `## Diff-size template gating` using the resolved commit range. Apply security/`[IRREVERSIBLE]` carve-outs. Record `gate: small | medium | large [+ carve-out]`.

13. **Template load** — apply framework and concern detection rules from `SKILL.md`. Load every matching framework template (all gates). Load concern templates only on medium/large. `patterns.md`: full on large, skip SOLID/DRY on medium, skip entirely on small (security carve-out forces full).

13a. **Re-review detection** — check memory for an entry whose lookup key is exactly `<plan-short-title>#phase-<N>` (plan filename without `.md`; integer N). Match present → this is a re-review: scope step 14 to files in the current step-8 diff only. Alignment, ADR-alignment, and `patterns.md` Security (Se1–Se3) still run in full. Record `re-review: yes — prior key <key>, date <date>`. No match → fresh review; skip.

14. **Adversarial review** — for each loaded template, run every checklist item on the changed files (scoped per 13a if re-review). PASS → skip silently. FAIL → finding: severity + check name + `file:line` + ≤3-line snippet if Critical. Not applicable → skip silently.
   - **Pre-existing classification**: tag `[PRE-EXISTING]` if either holds — (a) file not in step-8 set; (b) `git blame -L <line>,<line>` shows the line's SHA is not in `git rev-list <range>`. Pre-existing findings are listed but excluded from the verdict.

15. Produce the output per Output format. The final line is exactly `APPROVED` or `CHANGES REQUIRED`. Never approve past a FAIL alignment row or an open Critical.

16. Write the memory entry: lookup key `<plan-short-title>#phase-<N>`, ISO date, verdict, counts (Critical/Major/Minor/Pre-existing), amendment-flag state. Create file with `# Reviewer Memory` heading if missing.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#reviewer-perphase`. Loaded by the shell.

## Output format

Produce this exactly. Empty severity lists use `(none)`. Omit the `ARCHITECT AMENDMENT NEEDED:` line entirely when no drift.

```
## Phase Review — Phase N: <title from plan>
<!-- Cumulative: replace heading with `## Cumulative Review — <plan-short-title>` and add `**Phases:** 1..M` beneath. Section 1 groups rows under `**Phase N**` sub-headers. -->

**Plan:** artifacts/plans/<short-title>.md
**Governing ADR:** artifacts/adr/NNNNN-<short-title>.md

### 1. Acceptance-Criteria Alignment

| Criterion | Result | Evidence (file:line or symbol) | Note |
|-----------|--------|-------------------------------|------|
| <T-N.seq — verbatim text> | PASS / FAIL / UNCLEAR | <evidence> | <one short clause or empty> |

**Alignment verdict:** PASS | FAIL — N criteria: [list] | UNCLEAR — N criteria: [surface to architect]

---

### 2. ADR Alignment

| ADR Decision | Honoured? | Evidence / Divergence |
|--------------|-----------|-----------------------|
| <decision> | YES / DRIFT | <file:line + one-line reason if DRIFT> |

**ADR-alignment verdict:** HONOURED | DRIFT — see ARCHITECT AMENDMENT NEEDED below

---

### 3. Code Review

**Frameworks detected:** <list or none>
**Concerns detected:** <list or none>
**Templates applied:** <list>
**Gate:** small | medium | large [+ carve-out]
**Read scope:** <one line per file or `all files: full-file`>
**Re-review:** yes — prior key `<key>`, date <YYYY-MM-DD> | no

Findings: `- [<tag>N] file:line — <check>: <one-sentence>`. Tags: `C` Critical, `M` Major, `m` Minor, `P` Pre-existing (suffix `[PRE-EXISTING]`).

#### Critical — blocks approval
(none)

#### Major — should fix before merge
(none)

#### Minor — advisory
(none)

#### Pre-existing — not introduced by this phase
(none)

**Code review verdict:** CLEAN | N critical, N major, N minor (N pre-existing)

---

### Overall Verdict

Reason: <one sentence>

ARCHITECT AMENDMENT NEEDED: <one-line reason — omit line entirely if no drift>

APPROVED | CHANGES REQUIRED
```

The final line is exactly `APPROVED` or `CHANGES REQUIRED`, nothing else on that line.

## Tokens (this mode)

- **Emits:** `APPROVED`, `CHANGES REQUIRED`, `ARCHITECT AMENDMENT NEEDED:`, `[PRE-EXISTING]`.
- **Consumes:** developer summaries (not tokens).
