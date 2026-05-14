---
name: documenting
description: Produces a structured analysis report and memory entry. Use when you have completed analysis of a subject and need to write it up. Can be invoked standalone (/documenting) or loaded by agents as a format reference.
---

# Skill: documenting

Produces a structured, human-readable analysis report and writes a companion memory entry to `.claude/agent-memory/analyst/`.

---

## Steps

Follow in order on every invocation:

1. If the request does not include a subject, analysis notes, or source references, ask: "What should I document? Provide a subject and any notes or sources." Stop until answered.
2. Determine the audience using the rules in the **Audience** section below.
3. Derive the short title using the **Filename Derivation** rules below.
4. Write the report to `artifacts/reports/<derived-short-title>.md` using the **Report Template** below.
5. Write the memory entry using the **Memory Format** below.
6. Output a one-paragraph summary: what was produced, where it was written, and whether architect review is flagged.

Agents that load this skill for format reference and have already completed steps 1–2 should skip to step 3.

---

## Audience

Determine audience from the request using these rules:
- Contains "stakeholder", "executive", "non-technical", or "business" → **stakeholder** (omit implementation detail)
- Contains "developer", "engineer", "implementer", or "codebase" → **developer** (include implementation detail)
- Contains "collaborator" or "team" → **collaborator**
- Multiple of the above match → ask: "The request matches more than one audience. Which should I write for: [list matches]?"
- No match → **technical collaborator**

---

## Filename Derivation

Take exactly the first 3 significant words of the subject (ignore articles, prepositions, conjunctions), lowercase them, hyphenate them. If the subject has fewer than 3 significant words, use all of them.

Example: "Analysis of the Auth Middleware" → `auth-middleware-analysis`

Use this derived short title in all artifact paths and memory file names.

---

## Report Template

Write `artifacts/reports/<derived-short-title>.md` using this template exactly:

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
- Code: one theme per top-level module, package, or architectural layer.
- Documents: one theme per top-level section of the source document.
- Data/logs: one theme per top-level entity, table, or event category.

Each theme is one subsection (### heading) titled exactly as the module/section/entity is named in the source. Each subsection must be at least 2 paragraphs.

Each ### heading must carry a confidence marker assigned by this decision tree — apply the first rule that matches:
1. The finding is a direct quote, an observable fact, or a value that can be read from the source without reasoning → **[VERIFIED]**
2. The finding follows necessarily from two or more VERIFIED facts in the source → **[INFERRED]**
3. The source does not address the finding at all → **[ASSUMED]**

## Dependencies and Relationships
What this subject depends on, and what depends on it. Always produce a bullet list. If the list has more than 5 items, also add an ASCII diagram below it.

## Risks and Unknowns
Exactly 5 items total across the three categories. Populate genuine RISK and UNKNOWN items first; fill remaining slots with ASSUMPTION entries documenting what you took to be true during analysis. Never leave a slot empty.
Each item on its own line: **[RISK | UNKNOWN | ASSUMPTION]** — description.

## Recommendations
Exactly 4 items, ordered by priority (most important first). Each item must be a concrete, actionable instruction — not a general principle.
Flag items needing architectural input with [ARCHITECT REVIEW NEEDED].

## Glossary
One entry per term that meets both conditions: (1) it appears in the Findings section, and (2) it is not a common English word or widely-known acronym (REST, API, JSON, HTTP). Do not add terms that do not appear in Findings. Do not omit terms that do.
```

---

## Memory Format

Memory directory: `.claude/agent-memory/analyst`
Index file: `.claude/agent-memory/analyst/MEMORY.md`

Write one memory file per report, after the report is written.

**Memory file path:** `.claude/agent-memory/analyst/report-<derived-short-title>.md`

**Memory file content** (write this exactly, including frontmatter):

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
