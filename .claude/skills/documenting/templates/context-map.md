# Template: Context Map

**Artifact path:** `artifacts/strategy/context-maps/<scope>.md`

`<scope>` is the derived short title of the scope this map covers. Default scope name is `current` when the map covers the whole system. Use a scoped name (e.g. `payments-subsystem`) only when the map intentionally covers a subset and a `current.md` already exists for the whole system.

One map per scope. If a map for the scope already exists, **update it in place** and append a `## Revision history` entry.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| `## Relationships` table rows | **≤25 relationships** | Past 25 the map stops being scannable — split into scoped sub-maps (e.g. `payments-subsystem.md`, `identity-subsystem.md`) and keep `current.md` as the inter-subsystem overview. |
| `## Contexts in scope` | **≤20 contexts** | Past 20, do the same split. A single map showing 20+ contexts hides the actual integration topology. |
| `## Diagram` ASCII / Mermaid node count | **≤20 nodes**, matches the contexts cap | Past 20, the diagram is illegible — produce per-subsystem diagrams. |

---

## File template

```
# Context Map: <Scope>

**Status:** Draft | Ratified
**Revision:** N
**Date:** YYYY-MM-DD

## Contexts in scope
Bulleted list of every bounded context shown on this map. Each must link to its charter: `- **<Context Name>** — see [[charter-<context-name>]]`. A context appearing on the map without a charter is invalid — write the charter first or remove the context.

## Relationships
One row per directed relationship. Direction is **upstream → downstream** (the downstream context depends on the upstream).

| Upstream | Downstream | Pattern | Integration | Notes |
|----------|------------|---------|-------------|-------|
| <name>   | <name>     | <pattern> | <sync REST / async event / shared DB / file drop / etc.> | one-sentence why |

**Allowed `Pattern` values** (use exactly one, spelled exactly as listed):
- `Partnership` — two teams succeed or fail together; coordinated planning.
- `Customer-Supplier` — downstream has influence over upstream's backlog.
- `Conformist` — downstream accepts upstream's model as-is, no influence.
- `Anticorruption Layer` — downstream translates upstream's model at its boundary.
- `Open Host Service` — upstream publishes a stable protocol for many downstreams.
- `Published Language` — shared, versioned interchange format between contexts.
- `Shared Kernel` — small shared model both contexts jointly own.
- `Separate Ways` — no integration; duplication accepted.
- `Big Ball of Mud` — boundary is unclear or violated; flag as tech debt.

If a relationship uses a pattern not on this list, **stop** and surface to the user — do not invent a new pattern.

## Diagram
ASCII or Mermaid block showing contexts as nodes and relationships as labelled edges. Direction matches the table above (arrow points downstream).

## Notable absences
List contexts that **could** plausibly relate to one another but intentionally don't — and why (e.g., "Identity and Billing share no kernel; deliberate, to keep PCI scope minimal").

## Revision history
- vN (YYYY-MM-DD): one-sentence summary.
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/consultant`
**Index file:** `.claude/agent-memory/consultant/MEMORY.md`
**Memory file path:** `.claude/agent-memory/consultant/context-map-<scope>.md`

One memory file per map. Update in place on revision.

```
---
name: context-map-<scope>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
Context map **<scope>** — N contexts, M relationships.
**Notable patterns:** <e.g., "Identity is Open Host Service for 3 downstreams; Billing uses ACL against legacy CRM">.
**Watch items:** <any Big Ball of Mud or Shared Kernel rows — these are fragile>.
**Artifacts:** artifacts/strategy/context-maps/<scope>.md
```

**Index entry** — append one line to `MEMORY.md` (or replace on revision):

```
- [Context Map: <Scope>](context-map-<scope>.md) — N contexts, <one-line hook>
```
