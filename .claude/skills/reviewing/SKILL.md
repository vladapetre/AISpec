---
name: reviewing
description: >
  Use this skill when the reviewer agent needs to run alignment checks or adversarial
  code reviews. Defines framework detection rules, concern detection rules, the template
  registry, and severity definitions. Templates are under `templates/` — load on demand.
  Invoke standalone via `/reviewing`, or load via the `skills:` frontmatter field on
  the reviewer agent.
---

# Skill: reviewing

Central registry for code-review checklists and detection rules. The reviewer agent loads this skill to know which templates apply and how to classify findings.

**Skill shape:** linear. Dual-mode — invoked standalone via `/reviewing`, and loaded via the `skills:` frontmatter field on the reviewer agent.

---

## Template registry

| Template | File | Trigger |
|----------|------|---------|
| Alignment check | `templates/alignment.md` | Always — every review |
| .NET / C# | `templates/dotnet.md` | Framework: dotnet |
| TypeScript / JS | `templates/typescript.md` | Framework: typescript |
| Clean Architecture | `templates/clean-architecture.md` | Concern: clean-architecture |
| Vertical Slice | `templates/vertical-slice.md` | Concern: vertical-slice |
| General patterns | `templates/patterns.md` | Always load — applied on every review, in addition to any framework/concern templates |

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

## Severity definitions

Apply the first rule that matches:

| Severity | Condition |
|----------|-----------|
| **Critical** | Finding would cause incorrect behaviour, data loss, security vulnerability, or unhandled exception in the happy path — OR it is a direct FAIL in the alignment check |
| **Major** | Finding violates a framework-specific best practice that is explicitly listed in the matching template checklist — no Critical condition applies |
| **Minor** | Finding is advisory: style, naming, readability, or a best practice not listed in any template |

A Critical finding blocks APPROVED. Major and Minor do not.

---

## Steps (standalone invocation)

Follow in order when invoked directly as `/reviewing`:

1. IF no plan/phase reference and no changed-file set is provided: ask "Which plan and phase, and which files, should I review?" Stop until answered.
2. Apply the **Framework detection rules** and **Concern detection rules** above. Record what matched.
3. Read the templates that apply: always `templates/alignment.md` and `templates/patterns.md`, plus every matched framework and concern template from the **Template registry**.
4. Run the alignment check (`templates/alignment.md`) against the phase's acceptance criteria, then run every checklist item in each loaded template against the changed files. Assign each finding a severity per the **Severity definitions** above. Tag a finding on a line the phase did not change `[PRE-EXISTING]` and exclude it from the verdict.
5. Output the structured review — an alignment table, then findings grouped by severity — ending with a final line that is exactly `APPROVED` or `CHANGES REQUIRED` (verdict tokens — see `templates/assets/tokens.yaml`). Never emit `APPROVED` while an alignment criterion is FAIL or a Critical finding is open.

The reviewer agent loads this skill and drives the same procedure through its own `<instructions>` and `<output_format>`, which additionally fix the commit range and add `git blame` provenance for the `[PRE-EXISTING]` classification. Standalone runs follow the lighter procedure above.

---

## Bundled resources

```
.claude/skills/reviewing/
  SKILL.md     this file — the always-loaded core
  templates/   one checklist per registered framework / concern, plus alignment.md
               and patterns.md (read on demand per the Template registry)
```
