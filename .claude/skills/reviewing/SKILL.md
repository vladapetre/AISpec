---
name: reviewing
description: >
  Defines framework detection, concern detection, the template registry, and severity
  definitions used to run per-phase alignment checks and adversarial code reviews;
  loads checklist templates from `.claude/skills/reviewing/templates/` on demand. Use
  this skill when the user says "review this phase", "run an alignment check", "review
  the diff", when a developer phase summary lands and the per-phase quality gate must
  fire, or when `APPROVED` / `CHANGES REQUIRED` verdict tokens must be issued against
  a plan phase. Invoke standalone via `/reviewing`, or load via the `skills:` frontmatter
  field on the reviewer agent.
---

# Skill: reviewing

Central registry for code-review checklists and detection rules. The reviewer agent loads this skill to know which templates apply and how to classify findings.

**Shape:** linear. Dual-mode — standalone via `/reviewing`, or loaded via `skills:` frontmatter.

---

## Template registry

| Template | File | Trigger |
|----------|------|---------|
| Alignment check | `templates/alignment.md` | Always — every per-phase review |
| Cross-artifact check | `templates/cross-check.md` | Cross-check mode — `CROSS_CHECK_REQUESTED:` or `/cross-check`; full pass before Phase 1, delta pass after amendments (mode file CC-2) |
| .NET / C# | `templates/dotnet.md` | Framework: dotnet |
| TypeScript / JS | `templates/typescript.md` | Framework: typescript |
| Clean Architecture | `templates/clean-architecture.md` | Concern: clean-architecture |
| Vertical Slice | `templates/vertical-slice.md` | Concern: vertical-slice |
| General patterns | `templates/patterns.md` | Always (gate-permitting) — every per-phase review |

---

## Framework detection

Apply to changed files and their sibling config. Stop at first match per framework; multiple frameworks may match. Only frameworks with a registered template are listed here — others get recorded under "Frameworks detected" without loading a template (`patterns.md` covers universal concerns).

| Framework | Signal |
|-----------|--------|
| **dotnet** | Any `*.csproj` or `*.sln` in the repo root or a parent of the changed files |
| **typescript** | `tsconfig.json` present AND at least one changed file has `.ts`, `.tsx`, `.mts`, or `.cts` |

No framework matches → record "none detected" and skip all framework templates.

---

## Concern detection

Apply to the project directory structure (not just changed files). Multiple may match.

| Concern | Signal |
|---------|--------|
| **clean-architecture** | Any two of `Domain/`, `Application/`, `Infrastructure/`, `Presentation/` at `src/` depth or one level below — or CLAUDE.md / README mentions "clean architecture" or "onion architecture" |
| **vertical-slice** | A `Features/` directory exists AND ≥50% of its immediate subdirectories (minimum 2) contain a handler file (`*Handler.cs`, `*Handler.ts`, `handler.ts`, equivalent) — or CLAUDE.md / README mentions "vertical slice" or "feature slice" |

**Both match (tie-break):** count changed files covered by each concern's structural signal. Load only the concern with the higher count. Exact tie → `clean-architecture`. Record the choice and counts under "Concerns detected".

No concern matches → record "none detected"; proceed with `patterns.md` alone (plus framework templates).

---

## Diff-size gate

Computed from the step-8 changed-file set: total changed files and total changed LOC (`git diff --shortstat <range>` insertions + deletions, where `<range>` is the resolved commit range — default `HEAD~1..HEAD`, or the override the reviewer obtained from the user when history does not match the one-commit-per-phase convention). The wrong range under-counts a multi-commit phase and routes it to a leaner gate.

| Size | Threshold | Templates loaded |
|---|---|---|
| **Small** | ≤3 files AND ≤50 LOC | `alignment.md` + matching framework templates — **skip** `patterns.md` and concerns |
| **Medium** | not Small, AND LOC <300, AND files <10 | `alignment.md` + `patterns.md` (skip SOLID and DRY sections) + matching framework and concern templates |
| **Large** | ≥300 LOC OR ≥10 files | full set — `alignment.md` + `patterns.md` (all sections) + matching framework and concern templates |

**Boundary rule.** Small is conjunctive — fail either half → Medium. File-count ≥10 alone or LOC ≥300 alone → Large.

**Security floor — Se1–Se3 always run, every gate.** The three security checks in `patterns.md` (hardcoded secrets, injection, insecure defaults) are never diff-size gated: a Small or Medium load that skips the rest of `patterns.md` still executes its Security section against every changed file. A 2-file, 40-LOC change can hardcode a secret as easily as a large one.

**Security carve-out** (overrides Small/Medium): any changed file under `src/auth/`, `src/crypto/`, `src/security/`, `Authentication/`, `Authorization/`, or a path in CLAUDE.md `**Security paths:**` → load `patterns.md` in full (Se1–Se3 must always run). Framework/concern gating still applies.

**[IRREVERSIBLE] carve-out:** developer's `**[IRREVERSIBLE] steps executed:**` is non-empty → treat as Large.

Record `gate: small | medium | large [+ security carve-out | + irreversible carve-out]`.

---

## Severity definitions

First match wins:

| Severity | Condition |
|----------|-----------|
| **Critical** | Incorrect behaviour, data loss, security vulnerability, or unhandled exception in the happy path — OR a direct FAIL in the alignment check (the row blocks the verdict; any *companion code-review finding* about the same gap takes its severity from `templates/alignment.md`'s severity rules) |
| **Major** | Violates a framework-specific best practice explicitly listed in the matching template — no Critical condition applies |
| **Minor** | Advisory: style, naming, readability, or a best practice not in any template |
| **Pre-existing** | Introduced before the range under review (`git blame` SHA outside the range, or file outside the changed set) — listed for visibility, excluded from the verdict |

**Verdict blocking — the single authority.** `APPROVED` is blocked by: any open Critical; any FAIL alignment row; any **UNCLEAR** alignment row; (cumulative) any undocumented Critical cross-flow ripple. UNCLEAR blocks *fail-closed* — an unjudgeable criterion is a **plan defect, not a developer defect**: its transport to the architect is `ARCHITECT AMENDMENT NEEDED: <T-ids> too ambiguous to verify` on its own line (a table row alone reaches nobody), and the verdict reason must name the ambiguity so the team lead routes to the architect, not back to the developer. Major, Minor, and Pre-existing never block.

---

## Modes

- **per-phase / cumulative** (default) — fires on a developer phase summary or `## All Phases Complete`. Runs alignment + framework + concern templates + `patterns.md` against the changed files, plus the **removed-guard check** (step 11b, both branches, never gated): every deleted or weakened guard/filter/validation must map to a criterion mandating its removal. The cumulative (full-scope) pass additionally runs a **cross-flow impact analysis** (step 11a): it traces consumers of changed shared logic and flags undocumented behaviour-shifting ripples into flows the plan never named — e.g. a dropped `.Distinct()` that fires duplicate SMS. Emits `APPROVED` or `CHANGES REQUIRED` plus optional `ARCHITECT AMENDMENT NEEDED:`.
- **cross-check** — fires on `CROSS_CHECK_REQUESTED:` (architect) or `/cross-check` (user). Runs `templates/cross-check.md` only. **Full pass** on the first check of an ADR/plan pair; **delta pass** (revised decisions + delta consequences + edited phases only, row cap 10) when the ADR is a supersession following a prior `ALIGNED` (mode file CC-2). Emits `ALIGNED` or `DRIFT DETECTED`. Read-only.

---

## Steps (standalone invocation)

The procedure is owned by the reviewer agent's mode files — the single source of truth, so the standalone and agent paths cannot drift apart. When invoked directly as `/reviewing`, identify the mode, then read the matching mode file and execute its numbered steps using the detection rules, template registry, diff-size gate, and severity definitions above:

- **Cross-check** — invocation contains `CROSS_CHECK_REQUESTED:` or starts with `/cross-check` → `.claude/agents/assets/instructions/reviewer/crosscheck.md`.
- **Per-phase / cumulative** — otherwise → `.claude/agents/assets/instructions/reviewer/perphase.md`. No plan/phase reference and no changed-file set → ask "Which plan and phase, and which files, should I review?" and stop.

Standalone invocation differs from the agent only in provenance depth: the default commit range is `HEAD~1..HEAD`, and when no commit range is supplied the `git blame` step for `[PRE-EXISTING]` falls back to changed-file membership. The final line is exactly the mode's verdict token — `ALIGNED` / `DRIFT DETECTED` (cross-check) or `APPROVED` / `CHANGES REQUIRED` (per-phase); never approve while an alignment criterion is FAIL or a Critical is open.

---

## Bundled resources

```
.claude/skills/reviewing/
  SKILL.md     this file
  templates/   one checklist per registered framework / concern, plus alignment.md
               and patterns.md (read on demand per the registry)
```
