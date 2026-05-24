# Template: Bounded Context Charter

**Artifact path:** `artifacts/strategy/charters/<context-name>.md`

`<context-name>` is the derived short title of the bounded context (e.g. `billing`, `order-fulfilment`, `identity`). Apply the **Filename derivation** rules in `SKILL.md` against the context name itself (not the request subject).

One charter per bounded context. If a charter for the context already exists, **update it in place** — do not create a second file. Increment the `**Revision:**` field and append a one-line entry to `## Revision history`.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| Total body | **≤300 lines** | Past 300, the charter is conflating multiple bounded contexts — split into two charters, each with its own scope. |
| `## Scope` / `In scope` and `Out of scope` | **2–6 capabilities per list** (already in the template) | Past 6, fold sibling capabilities into one higher-level capability, or the context is too large — split. |
| `## Ubiquitous language (summary)` | **3–8 terms** (already in the template) | Past 8, the rest belong in the full glossary under `artifacts/strategy/glossary/` but not on the charter's summary list. |
| `## Invariants` | **2–5** (already in the template) | Past 5, some are derived rules — keep only the irreducible business invariants here. |
| `## Open questions` | **≤10 entries** | Past 10, ratification is far off — surface the blocking ones to the user before continuing to write. |

---

## Identifiers

Invariants and open questions carry stable IDs so SDRs, tactical ADRs, plans, and the code-review pass can cite them without paraphrasing.

- **INV-###** — entries under `## Invariants`. Numbered even when only one exists.
- **OQ-###** — entries under `## Open questions`.
- Numbering: zero-padded to 3 digits, encounter order, dense at first write, sparse after edits.
- **Stability:** never re-number after the charter is published. To withdraw an entry, append `[withdrawn]` and leave the ID in place — the consultant logs the withdrawal under `## Revision history`. SDRs cite invariants by ID; a re-numbered `INV-###` silently breaks those references.
- Cross-artifact references use the form `<context-name>#<ID>` (e.g. `billing#INV-002`).
- Charter capability bullets under `## Scope` are not assigned IDs — the bounded-context name + capability noun phrase is already a stable handle.

---

## File template

```
# Charter: <Context Name>

**Status:** Draft | Ratified | Deprecated
**Revision:** N
**Date:** YYYY-MM-DD
**Owning team:** <team name or "unassigned">

## Purpose
One paragraph. What this context exists to do, stated in the business's language. No implementation detail.

## Subdomain classification
**Type:** Core | Supporting | Generic
**Reasoning:** One sentence tying the type to a business signal — competitive differentiation (Core), necessary-but-undifferentiated (Supporting), or commodity (Generic).
**Investment posture:** Build in-house | Buy / adopt | Outsource | Defer

## Scope
**In scope:**
- 2–6 capabilities this context owns end-to-end.

**Out of scope:**
- 2–6 capabilities explicitly handled elsewhere — name the owning context for each.

## Ubiquitous language (summary)
List the 3–8 terms most central to this context. Each term must be defined in `artifacts/strategy/glossary/<term>.md`. Link them: `- **<term>** — see [[<term>]]`.

## Upstream / downstream
**Upstream (this context depends on):** comma-separated context names, or "none". For each, name the relationship type from the context map.
**Downstream (depend on this context):** comma-separated context names, or "none".

Full relationship semantics live in the context map: `artifacts/strategy/context-maps/<scope>.md`.

## Invariants
2–5 business rules this context enforces that cannot be violated regardless of implementation. Each is a bullet led by `**INV-###**`, stated as a single declarative sentence.

## Open questions
List unresolved strategic questions that block ratification. Each is a bullet led by `**OQ-###**` and must name who can answer it. Empty list → set status to Ratified.

## Revision history
- vN (YYYY-MM-DD): one-sentence summary of the change.
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/consultant`
**Index file:** `.claude/agent-memory/consultant/MEMORY.md`
**Memory file path:** `.claude/agent-memory/consultant/charter-<context-name>.md`

If the memory directory does not exist, create it. If `MEMORY.md` does not exist, create it with the heading `# Consultant Memory` on the first line.

One memory file per charter. Update it in place when the charter is revised.

```
---
name: charter-<context-name>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
Bounded context **<Context Name>** — <Core | Supporting | Generic>.
**Purpose:** <one sentence from the charter>.
**Owns:** <2–3 in-scope capabilities>.
**Depends on:** <upstream contexts, or "none">.
**Why classified <type>:** <the business signal>.
**Artifacts:** artifacts/strategy/charters/<context-name>.md
```

**Index entry** — append one line to `MEMORY.md` (or replace the existing entry on revision):

```
- [Charter: <Context Name>](charter-<context-name>.md) — <Core|Supporting|Generic>, <one-line hook>
```
