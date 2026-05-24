# Template: Strategic Decision Record (SDR)

**Artifact path:** `artifacts/strategy/decisions/NNNNN-<derived-short-title>.md`

NNNNN is a zero-padded 5-digit integer, incremented from the highest existing SDR number in `artifacts/strategy/decisions/`. If no SDRs exist yet, start at `00001`. SDR numbering is **independent** of tactical ADR numbering — do not share counters.

Re-scan `artifacts/strategy/decisions/` for the highest number **immediately before writing the file**. If the target filename already exists when you go to write it, increment and retry up to 3 times. After 3 collisions, stop and surface the conflict to the user.

---

## Caps and overflow

Mirrors the tactical-ADR caps with strategic-specific framing:

| Field | Cap | Overflow path |
|---|---|---|
| Total body | **≤400 lines** (excluding fenced code blocks) | Past 400, split the decision into two SDRs linked by `**Supersedes / supersedes:**` headers, or move the deep portfolio reasoning to a sibling strategy note under `artifacts/strategy/notes/`. |
| `## Consequences` per side (`Gains` / `Costs` / `Risks`) | **≤7 bullets per side** | Past 7, the decision is unsettled — consolidate or move the long tail to a sibling note with `(more in <note>.md)` on the last bullet. |
| `## Alternatives Considered` | **≤5 alternatives** | Past 5, the exploration belongs in an analyst report — link the report under `## Context`. |
| `## Tactical follow-up` | **≤10 `[TACTICAL DESIGN NEEDED]` items** | Past 10, the SDR is doing too much — split the decision into multiple SDRs, each with its own tactical follow-up list. |

---

## File template

```
# SDR-NNNNN: Title

**Status:** Proposed | Ratified | Superseded by SDR-XXXXX
**Date:** YYYY-MM-DD
**Affected contexts:** comma-separated context names (must each have a charter)

## Context
What forced this strategic decision. State the business driver in plain language. 2–4 sentences. Cite the constraint, deadline, stakeholder ask, or competitive pressure that made this a strategic — not tactical — choice.

## Decision
One paragraph. The chosen direction and why it serves the business. Frame the choice in strategic terms (which subdomain to invest in, which boundary to draw, which relationship pattern to adopt, which capability to build/buy/outsource) — not in implementation terms.

## Subdomain & investment implications
**Subdomain affected:** name + Core | Supporting | Generic.
**Investment shift:** what changes about where engineering effort goes. State both the increase and the decrease — strategic decisions reallocate, they do not only add.

## Consequences
**Gains:** 2–4 bullets — what improves at the business / portfolio level.
**Costs:** 2–4 bullets — what gets harder, more expensive, or more constrained.
**Risks:** 2–4 bullets — what could go wrong, one mitigation per risk.

## Context-map impact
Which relationships on the context map change as a result. Reference the map by path: `artifacts/strategy/context-maps/<scope>.md`. If a new relationship is introduced or an existing one changes pattern (e.g., Conformist → Anticorruption Layer), name it explicitly. If the map needs a revision to reflect this SDR, say so under [TACTICAL DESIGN NEEDED] (see below).

## Alternatives Considered
### Alternative: name
Ruled out because: one sentence citing the business reason (not the implementation difficulty).

## Tactical follow-up
Items the architect agent must turn into tactical ADRs or plans. Flag each with the literal token `[TACTICAL DESIGN NEEDED]` at the start of the line. If none, write `None.`
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/consultant`
**Index file:** `.claude/agent-memory/consultant/MEMORY.md`
**Memory file path:** `.claude/agent-memory/consultant/sdr-NNNNN-<derived-short-title>.md`

```
---
name: sdr-NNNNN-<derived-short-title>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
SDR-NNNNN chose <strategic direction> for <subdomain/contexts>.
**Why:** <the business driver — not the technical reason>.
**How to apply:** <what future strategic and tactical decisions this constrains>.
**Tactical follow-up:** <one-line summary of any [TACTICAL DESIGN NEEDED] items, or "none">.
**Artifacts:** artifacts/strategy/decisions/NNNNN-<derived-short-title>.md
```

**Index entry** — append one line to `MEMORY.md`:

```
- [SDR-NNNNN: Title](sdr-NNNNN-<derived-short-title>.md) — <one-line hook>
```
