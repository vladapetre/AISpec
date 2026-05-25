---
name: reviewing
description: >
  Defines framework detection rules, concern detection rules, the template registry,
  and severity definitions used to run per-phase alignment checks and adversarial code
  reviews; loads checklist templates from `.claude/skills/reviewing/templates/` on
  demand. Use this skill when the user says "review this phase", "run an alignment
  check", "review the diff", when a developer phase summary lands and the per-phase
  quality gate must fire, or when `APPROVED` / `CHANGES REQUIRED` verdict tokens must
  be issued against a plan phase. Invoke standalone via `/reviewing`, or load via the
  `skills:` frontmatter field on the reviewer agent.
---

# Skill: reviewing

Central registry for code-review checklists and detection rules. The reviewer agent loads this skill to know which templates apply and how to classify findings.

**Skill shape:** linear. Dual-mode — invoked standalone via `/reviewing`, and loaded via the `skills:` frontmatter field on the reviewer agent.

---

## Template registry

| Template | File | Trigger |
|----------|------|---------|
| Alignment check | `templates/alignment.md` | Always — every per-phase review |
| Cross-artifact check | `templates/cross-check.md` | Mode: cross-check — fired by `CROSS_CHECK_REQUESTED:` token or `/cross-check` slash command, once per ADR/plan pair before Phase 1 starts |
| .NET / C# | `templates/dotnet.md` | Framework: dotnet |
| TypeScript / JS | `templates/typescript.md` | Framework: typescript |
| Clean Architecture | `templates/clean-architecture.md` | Concern: clean-architecture |
| Vertical Slice | `templates/vertical-slice.md` | Concern: vertical-slice |
| General patterns | `templates/patterns.md` | Always load — applied on every per-phase review, in addition to any framework/concern templates |

---

## Framework detection rules

Apply to the **changed files** and their sibling config files. Stop at first match per framework. A project may match multiple frameworks.

Only frameworks with a registered template (above) are listed here. If you detect another stack, record it under "Frameworks detected" for transparency but do not load a template — `patterns.md` covers universal concerns.

| Framework | Signal (stop at first match, in order) |
|-----------|----------------------------------------|
| **dotnet** | Any `*.csproj` or `*.sln` in the repo root or a parent directory of the changed files |
| **typescript** | `tsconfig.json` present AND at least one changed file has extension `.ts`, `.tsx`, `.mts`, or `.cts` |

If no framework matches, record "none detected" and skip all framework templates.

---

## Concern detection rules

Apply to the **project directory structure** (not just changed files). Multiple concerns may match.

| Concern | Signal |
|---------|--------|
| **clean-architecture** | Any two of these directories exist at `src/` depth or one level below: `Domain/`, `Application/`, `Infrastructure/`, `Presentation/` — or a CLAUDE.md or README mentions "clean architecture" or "onion architecture" |
| **vertical-slice** | A `Features/` directory exists, and at least 50% of its immediate subdirectories (with a minimum of 2) contain a handler file (`*Handler.cs`, `*Handler.ts`, `handler.ts`, or equivalent) — or a CLAUDE.md / README mentions "vertical slice" or "feature slice" |

`patterns.md` is always loaded, whether or not a concern matched. If no concern matches, record "none detected" and proceed with `patterns.md` alone (plus any framework templates).

**Tie-break when both `clean-architecture` and `vertical-slice` match:** count the changed files whose path is covered by each concern's structural signal (files under `Domain/`, `Application/`, `Infrastructure/`, `Presentation/` for clean-arch; files under `Features/<slice>/` for vertical-slice). Load only the concern with the higher count. On an exact tie, load `clean-architecture`. Record the chosen concern and the file counts under "Concerns detected".

---

## Diff-size template gating

The reviewer's per-phase template load is gated by the size of the phase diff. Compute size from the step-7 changed-file set: total changed files and total changed LOC (sum of `git diff --shortstat <range>` insertions+deletions, where `<range>` is the commit range the reviewer resolved at its step 5 — default `HEAD~1..HEAD`, or the override the reviewer obtained from the user if the repo's history does not match the one-commit-per-phase convention). Do not hard-code `HEAD~1..HEAD` here; using the wrong range under-counts a multi-commit phase and silently routes it to a leaner gate.

| Phase size | Threshold | Templates loaded |
|---|---|---|
| **Small** | `≤ 3 files AND ≤ 50 LOC` (both halves must hold) | `alignment.md` + every matching framework template — **skip** `patterns.md` and concern templates |
| **Medium** | not Small, AND LOC `< 300`, AND files `< 10` | `alignment.md` + `patterns.md` + every matching framework and concern template — **but** skip `patterns.md`'s SOLID and DRY sections |
| **Large** | `≥ 300 LOC OR ≥ 10 files` | full set — `alignment.md` + `patterns.md` (all sections) + every matching framework and concern template |

**Boundary rule.** Small is conjunctive — a phase that fails either half (e.g. 5 files / 30 LOC, or 3 files / 60 LOC) falls into Medium. Reviewers do not "round down" a phase with a small LOC count but an awkward file count into Small; the conjunctive form is intentional so any single broad dimension still triggers `patterns.md`. If the file-count alone is ≥ 10 or LOC alone is ≥ 300, the phase is Large regardless of the other dimension.

**Security carve-out (overrides Small/Medium):** if any file in the changed set sits under `src/auth/`, `src/crypto/`, `src/security/`, `Authentication/`, `Authorization/`, or a path listed under a `**Security paths:**` entry in CLAUDE.md, load `patterns.md` in full (Se1–Se3 must always run) regardless of diff size. The framework/concern gating still applies.

**[IRREVERSIBLE] carve-out:** if the developer's phase summary lists any `**[IRREVERSIBLE] steps executed:**` other than `_None_`, treat the phase as Large regardless of diff size.

Record the chosen gate under "Templates applied" in the review output: `gate: small | medium | large [+ security carve-out | + irreversible carve-out]`.

---

## Severity definitions

Apply the first rule that matches:

| Severity | Condition |
|----------|-----------|
| **Critical** | Finding would cause incorrect behaviour, data loss, security vulnerability, or unhandled exception in the happy path — OR it is a direct FAIL in the alignment check |
| **Major** | Finding violates a framework-specific best practice that is explicitly listed in the matching template checklist — no Critical condition applies |
| **Minor** | Finding is advisory: style, naming, readability, or a best practice not listed in any template |

A Critical finding blocks APPROVED. Major and Minor do not.

---

## Modes

The reviewing skill drives two distinct passes. Pick the mode at step 1; do not interleave.

- **per-phase review** (default) — fires after every developer phase summary. Runs the alignment check, framework templates, concern templates, and `patterns.md` against the changed files. Emits `APPROVED` or `CHANGES REQUIRED` plus an optional `ARCHITECT AMENDMENT NEEDED:` line.
- **cross-check** — fires once per ADR/plan pair, before the developer starts Phase 1, on the `CROSS_CHECK_REQUESTED:` token (architect-emitted) or the `/cross-check` slash command. Runs `templates/cross-check.md` only — no framework or concern templates load. Emits `ALIGNED` or `DRIFT DETECTED`. Read-only — never writes to artifacts.

---

## Steps (standalone invocation)

Follow in order when invoked directly as `/reviewing`:

1. Identify the mode:
   - Invocation includes `CROSS_CHECK_REQUESTED:` or `/cross-check` → **cross-check mode**.
   - Otherwise → **per-phase review mode**.

2. In **cross-check mode**:
   - Resolve the ADR and plan paths from the trigger (the plan path is explicit; the ADR is paired by short-title).
   - Read both, plus any reports/SDRs/charters the ADR's `## Context` cites.
   - Read `templates/cross-check.md`. Run the five checks in order.
   - Output the fixed-column table per the template, ending with a final line that is exactly `ALIGNED` or `DRIFT DETECTED`.
   - Stop — do not load framework/concern templates and do not run the per-phase steps below.

3. In **per-phase review mode**:
   - IF no plan/phase reference and no changed-file set is provided: ask "Which plan and phase, and which files, should I review?" Stop until answered.
   - Apply the **Framework detection rules** and **Concern detection rules** above. Record what matched.
   - Read the templates that apply: always `templates/alignment.md` and `templates/patterns.md`, plus every matched framework and concern template from the **Template registry**.
   - Run the alignment check (`templates/alignment.md`) against the phase's acceptance criteria (cited by `T-<phase>.<seq>` ID), then run every checklist item in each loaded template against the changed files. Assign each finding a severity per the **Severity definitions** above. Tag a finding on a line the phase did not change `[PRE-EXISTING]` and exclude it from the verdict.
   - Output the structured review — an alignment table, then findings grouped by severity — ending with a final line that is exactly `APPROVED` or `CHANGES REQUIRED` (verdict tokens — see `.claude/agents/assets/tokens.yaml`). Never emit `APPROVED` while an alignment criterion is FAIL or a Critical finding is open.

The reviewer agent loads this skill and drives the same procedure through its own `<instructions>` and `<output_format>`, which additionally fix the commit range and add `git blame` provenance for the `[PRE-EXISTING]` classification. Standalone runs follow the lighter procedure above.

---

## Bundled resources

```
.claude/skills/reviewing/
  SKILL.md     this file — the always-loaded core
  templates/   one checklist per registered framework / concern, plus alignment.md
               and patterns.md (read on demand per the Template registry)
```
