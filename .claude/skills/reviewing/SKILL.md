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
| Cross-artifact check | `templates/cross-check.md` | Cross-check mode — `CROSS_CHECK_REQUESTED:` or `/cross-check`, once per ADR/plan pair before Phase 1 |
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

**Security carve-out** (overrides Small/Medium): any changed file under `src/auth/`, `src/crypto/`, `src/security/`, `Authentication/`, `Authorization/`, or a path in CLAUDE.md `**Security paths:**` → load `patterns.md` in full (Se1–Se3 must always run). Framework/concern gating still applies.

**[IRREVERSIBLE] carve-out:** developer's `**[IRREVERSIBLE] steps executed:**` is non-empty → treat as Large.

Record `gate: small | medium | large [+ security carve-out | + irreversible carve-out]`.

---

## Severity definitions

First match wins:

| Severity | Condition |
|----------|-----------|
| **Critical** | Incorrect behaviour, data loss, security vulnerability, or unhandled exception in the happy path — OR a direct FAIL in the alignment check |
| **Major** | Violates a framework-specific best practice explicitly listed in the matching template — no Critical condition applies |
| **Minor** | Advisory: style, naming, readability, or a best practice not in any template |

Critical blocks `APPROVED`. Major and Minor do not.

---

## Modes

- **per-phase / cumulative** (default) — fires on a developer phase summary or `## All Phases Complete`. Runs alignment + framework + concern templates + `patterns.md` against the changed files. Emits `APPROVED` or `CHANGES REQUIRED` plus optional `ARCHITECT AMENDMENT NEEDED:`.
- **cross-check** — fires once per ADR/plan pair before Phase 1, on `CROSS_CHECK_REQUESTED:` (architect) or `/cross-check` (user). Runs `templates/cross-check.md` only. Emits `ALIGNED` or `DRIFT DETECTED`. Read-only.

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
