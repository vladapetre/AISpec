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

Central registry for code review checklists and detection rules. The reviewer agent loads this skill to know which templates apply and how to classify findings.

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

1. If no phase summary or plan reference is provided, ask: "Which plan and phase should I review?" Stop until answered.
2. Apply framework and concern detection rules above.
3. Load the templates that match (always alignment.md, plus matched framework/concern templates, plus patterns.md as fallback or always-on).
4. Run the review following the reviewer agent `<instructions>` steps 7–11.
5. Output the structured review in the reviewer agent `<output_format>`.
