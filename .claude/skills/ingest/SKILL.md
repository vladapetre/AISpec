---
name: ingest
description: >
  Run the analyst.deep-ingest fan-out workflow: scout + cluster a large or mixed
  source set, read every cluster in parallel, synthesize an analyst report with
  R-### findings, then loop a completeness critic until dry. Use when the user
  invokes `/ingest <sources...>` or asks for a deep/fan-out/parallel analysis of
  sources too large for one pass. Invoking this command IS the user's explicit
  opt-in to multi-agent orchestration.
---

# Skill: ingest

Thin launcher for the `analyst.deep-ingest` workflow. Invoking it is the explicit opt-in the Workflow tool requires.

## User input

```text
$ARGUMENTS
```

## Steps

1. Parse the input into **sources** (paths, directories, URLs, Jira keys — whitespace-separated; quoted tokens stay whole) and, if present, a `--subject "<phrase>"` flag. No sources → ask "What should I ingest, and what is the report subject?" and stop.
2. No `--subject` given → derive a subject phrase from the sources (e.g. the dominant directory or ticket cluster) and confirm it in one line before running.
3. Call the workflow — sources as a real JSON array, never a stringified one:
   `Workflow { name: "analyst.deep-ingest", args: { sources: [...], subject: "<phrase>", date: "<today YYYY-MM-DD>" } }`
   Name not found (registry is captured at session start) → invoke by path instead: `Workflow { scriptPath: ".claude/workflows/analyst.deep-ingest.mjs", args: … }`.
4. It runs in the background; when the result lands, relay: report path, confidence counts, hand-off flags (route `ARCHITECT REVIEW NEEDED` / `STRATEGIC REVIEW NEEDED` per CLAUDE.md), and any clusters left unread.
