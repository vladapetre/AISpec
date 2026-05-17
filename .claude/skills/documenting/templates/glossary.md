# Template: Ubiquitous Language Glossary

**Artifact directory:** `artifacts/strategy/glossary/`
**Index file:** `artifacts/strategy/glossary/INDEX.md`
**Entry file path:** `artifacts/strategy/glossary/<term-slug>.md`

`<term-slug>` is the lowercased, hyphen-joined form of the term. If the same word means different things in different bounded contexts, write **one file per (term, context) pair** with the slug `<term>-in-<context>.md`. Do not collapse context-distinct meanings into a single entry — that defeats the purpose of ubiquitous language.

One entry per term-meaning. Update in place when the definition is refined.

---

## Entry template

```
# <Term>

**Context:** <context name(s) where this term applies>
**Status:** Draft | Ratified
**Date:** YYYY-MM-DD

## Definition
One sentence the business and engineering teams both accept. No jargon the business would not use.

## Distinguished from
List terms that are easily confused with this one and the precise difference. If none, write `None.`

## Aliases
Other words people use for the same concept. Empty list means the term is canonical with no synonyms in use.

## Related terms
Link other glossary entries: `- [[<other-term-slug>]] — one-sentence relationship.`

## Anti-examples
1–3 things that are **not** this term, with one-sentence reasons. Anti-examples often clarify more than examples.
```

---

## Index file format (`INDEX.md`)

If the index does not exist, create it with the heading `# Glossary` on the first line. Append one line per entry, sorted alphabetically by term:

```
- **<Term>** (<context>) — [<term-slug>](<term-slug>.md) — one-line definition.
```

On every glossary write, re-sort the index lines alphabetically by term. Determinism requires the file to be stable across runs.

---

## Memory format

The glossary itself is the memory — entries live in `artifacts/strategy/glossary/` and are read directly, not duplicated under `.claude/agent-memory/`. Do not write per-term memory files. The consultant `MEMORY.md` should contain a single line pointing at the glossary index:

```
- [Glossary Index](../../../../artifacts/strategy/glossary/INDEX.md) — ubiquitous language for all bounded contexts.
```

Add this index line once, on first glossary write. Do not duplicate it.
