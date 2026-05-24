# Template: Analysis Report

**Artifact path:** `artifacts/reports/<derived-short-title>.md`

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| `## Findings` total entries | **≤50 findings** | At 50+, list the top 50 by severity / impact, then add a final bullet: `(N more omitted — see artifacts/reports/<short-title>-extras.md)` and write the overflow file. The 50 reported are the ones acted on. |
| Per-finding length | **≤6 lines** (heading + ≤5 body lines, excluding fenced snippets) | Past 6 lines, split into two sibling findings under the same theme, or move the deep dive to a sibling note linked from the finding. |
| `## Recommendations` | **Exactly 4** (already fixed by the template) | If more genuinely warranted, the top 4 are recommendations; the rest become Findings entries with their own action language. |

These caps coexist with the section-level constraints already stated in the file template (e.g. Executive Summary = 4 sentences).

---

## File template

```
# Analysis: Title

**Date:** YYYY-MM-DD
**Audience:** developer | stakeholder | collaborator | <as declared>
**Sources:** list every source ingested

---

## Executive Summary
Exactly 4 sentences in this fixed order: (1) What this subject is. (2) Why it matters or what problem it solves. (3) The single most important finding. (4) What the reader should do with this information. Written for any audience — no jargon.

## Background and Context
Exactly 2 paragraphs, ≤150 words total. First paragraph: what the subject is and where it lives. Second paragraph: why it exists and what problem it solves. Assume no prior knowledge of this specific subject.

## Structure and Organisation
One paragraph (≤80 words) describing the overall shape, then a bullet list of components — no more than 10 bullets. For code: list modules, layers, and entry points. For documents: list sections and their purpose. For data: list tables, entities, or event types with their schema shape.

## Key Concepts
One subsection per Findings theme, capped at 5. For each theme, include its concept only if the term is domain-specific and not defined by common English or a widely-known acronym. If a theme has no such term, skip it — do not pad to reach a count. Each subsection:
- Names the concept
- Explains what it is
- Explains why it matters in this context
- Gives a concrete example from the source

## Findings
Detailed walkthrough of what was discovered. This is the verbose core of the report.

Derive the theme list directly from the source structure — do not invent themes:
- Code: one theme per **top-level unit**, defined as the immediate child directories of the entry-point directory identified in step 4 of the analyst instructions. If the request named individual files (not a directory), each file is its own theme.
- Documents: one theme per top-level (`#` or `##`, whichever is the highest level used) section of the source document.
- Data/logs: one theme per top-level entity, table, or event category.

Each theme is one subsection (### heading) titled exactly as the module/section/entity is named in the source. Each subsection must be at least 2 paragraphs.

Each ### heading must carry a confidence marker. Apply the rules defined in `SKILL.md` under **Confidence markers** — do not re-derive them here.

## Dependencies and Relationships
What this subject depends on, and what depends on it. Always produce a bullet list. If the list has more than 5 items, also add an ASCII diagram below it.

## Risks and Unknowns
Between 3 and 5 items total across the three categories (at least 3, no more than 5). Populate genuine RISK and UNKNOWN items first; add ASSUMPTION entries only if they add real analytical value. Never fabricate risks or assumptions to reach a count.
Each item on its own line: **[RISK | UNKNOWN | ASSUMPTION]** — description.

## Recommendations
Exactly 4 items. Each item must be a concrete, actionable instruction — not a general principle. Flag items needing architectural input with [ARCHITECT REVIEW NEEDED].

Order strictly by this rubric — apply in sequence, do not reorder by your own judgement:
1. Items flagged [ARCHITECT REVIEW NEEDED].
2. Items that remediate a [RISK] entry in Risks and Unknowns.
3. Items grounded in a [VERIFIED] finding.
4. All other items.

Within a tier, preserve the source order in which the underlying finding first appears in the report.

## Glossary
One entry per term that meets both conditions: (1) it appears in the Findings section, and (2) it is not a common English word or widely-known acronym (REST, API, JSON, HTTP). Do not add terms that do not appear in Findings. Do not omit terms that do.
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/analyst`
**Index file:** `.claude/agent-memory/analyst/MEMORY.md`
**Memory file path:** `.claude/agent-memory/analyst/report-<derived-short-title>.md`

If the memory directory does not exist, create it. If `MEMORY.md` does not exist, create it with the heading `# Analyst Memory` on the first line.

```
---
name: report-<derived-short-title>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
Analysed <subject> for <audience>.
**Key findings:** <2-3 sentence summary of the most important discoveries>.
**[ARCHITECT REVIEW NEEDED]:** <list items flagged, or "none">.
**Artifact:** artifacts/reports/<derived-short-title>.md
```

**Index entry** — append one line to `MEMORY.md`:

```
- [Report: Title](report-<derived-short-title>.md) — <what was analysed> + <single most important finding>, ≤100 characters
```

---

## Worked example

See `../examples/report.md` — read only if uncertain about confidence markers, theme derivation, or finding depth.
