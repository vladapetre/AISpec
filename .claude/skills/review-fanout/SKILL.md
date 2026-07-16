---
name: review-fanout
description: >
  Run the reviewer.cumulative-review workflow: end-of-plan cumulative review
  with the five dimensions (AC alignment, ADR drift, cross-flow, removed
  guards, code checklists) fanned out in parallel and every Critical/Major
  finding adversarially verified before it can block. Use when the user
  invokes `/review-fanout`, or asks to "fan out the review" / "use the review
  workflow" for a cumulative pass. Invoking this command IS the user's
  explicit opt-in to multi-agent orchestration. Default cumulative reviews
  still go to the reviewer teammate.
---

# Skill: review-fanout

Thin launcher for the `reviewer.cumulative-review` workflow. Invoking it is the explicit opt-in the Workflow tool requires.

## User input

```text
$ARGUMENTS
```

## Steps

1. Resolve the **plan**: explicit path in the input wins; else the plan of the active `## All Phases Complete` summary in this conversation; else lex-sort `artifacts/plans/` and ask if multiple. Carry the developer summary text and commit range when available.
2. Call the workflow:
   `Workflow { name: "reviewer.cumulative-review", args: { plan: "<path>", summary: "<All Phases Complete text or omit>", range: "<first..last or omit>", date: "<today YYYY-MM-DD>" } }`
3. When the result lands, relay the review block and route the verdict exactly as a teammate review would be routed (CLAUDE.md `## Implementation Review`): `CHANGES REQUIRED` → developer; `ARCHITECT AMENDMENT NEEDED:` → architect first; `APPROVED` → done. The workflow already wrote the reviewer memory line.
