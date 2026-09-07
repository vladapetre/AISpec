---
name: researching
description: >
  The research lane: a question about code, documents, data or tickets that needs a report,
  not a change. The analyst returns an outline in one turn (summary, section headings, the
  sources it will read) so the user can redirect, then a deep pass fills it. Use when
  `harness admit` answers `research`, or when the user says "how does X work", "explain",
  "map the flow", "write a report on", "before we touch this I need to understand", or "no
  code changes". A plain question with a one-paragraph answer needs no lane: answer it.
user-invocable: true
---

# Researching

Runs in the main session. One analyst per work item, spawned for the outline and continued for the deep pass and for later delta questions on the same sources.

Lane check for this request:

!`node .claude/bin/harness.mjs admit --text "$ARGUMENTS" --human`

`research` continues here. A change request runs its own lane.

## Steps

| `harness next` says | Read |
|---|---|
| `write_artifact` by analyst | `steps/10-outline.md`: open the work item, spawn the analyst for the outline |
| `approve_phase` by user (outline present) | render the packet below, stop; on `d`, `steps/20-deep.md`; on `a`, close |
| `close` | `harness set <id> status=done`, print the report path, stop |

## The packet

```
▶ <id> · outline ready · <the analyst's one-sentence line>
Top: <R-001 one line> · <R-002 one line>
Sources next: <the deep-pass source list, one line>
[a] accept the outline as the answer · [d] deep pass · [x] redirect: <what to look at instead>
```

`d` continues the analyst with `work: <id>`, `deep pass`, plus any redirect. `x <what>` continues it with the redirect and asks for a new outline. The deep pass ends with the same packet minus the `[d]` option.

## Rules of the lane

The analyst writes `work/<id>/report.md` only and never proposes designs; a finding that needs a decision is flagged `[ARCHITECT REVIEW NEEDED]` and the lead offers `ordering` or `designing` in the closing line. Ticket pulls are part of ingestion; any ticket write is surfaced for the user's confirmation before it happens.
