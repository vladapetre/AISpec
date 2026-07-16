---
name: verify-assumptions
description: >
  Run the analyst.verify-assumptions workflow: verify a set of independent
  factual claims about existing code/schema/data in parallel, with adversarial
  cross-examination of every CONFIRMED verdict. Use when the user invokes
  `/verify-assumptions <claims...>`, when the architect's A9b assumption gate
  emits claims to verify, or when a design is about to build on [INFERRED] or
  [ASSUMED] findings. Invoking this command IS the user's explicit opt-in to
  multi-agent orchestration.
---

# Skill: verify-assumptions

Thin launcher for the `analyst.verify-assumptions` workflow. Invoking it is the explicit opt-in the Workflow tool requires.

## User input

```text
$ARGUMENTS
```

## Steps

1. Parse the input into **claims** — one per line, or semicolon-separated on a single line; an optional `--context "<framing>"` flag names the ADR/design the claims serve. When the input is an architect A9b pause message, extract its listed load-bearing assumptions verbatim. No claims → ask "Which claims should I verify?" and stop.
2. Call the workflow — claims as a real JSON array:
   `Workflow { name: "analyst.verify-assumptions", args: { assumptions: [...], context: "<framing or omit>", date: "<today YYYY-MM-DD>" } }`
3. When the result lands, relay the verdict block. REFUTED claims invalidate the decisions resting on them — route back to the architect (A9b resume path). UNRESOLVED claims must become plan `[UNKNOWN]`s with named fallbacks, never silent criteria.
