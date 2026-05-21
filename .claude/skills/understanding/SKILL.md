---
name: understanding
description: >
  Structured questioning session that stress-tests a plan, design, or feature
  description against the project's existing language and code, sharpens fuzzy
  terminology, and captures resolved understanding inline to `.claude/MEMORY.md`.
  Use this skill when the user wants to pressure-test an idea, reconcile vague
  vocabulary, or build shared understanding before implementation — triggers
  include "question me on this", "stress-test this plan", "challenge my thinking",
  "help me think this through", "interview me", or "sharpen the terminology".
  Invoke standalone via `/understanding`, or load via the `skills:` frontmatter
  field on the consultant, analyst, or architect agents.
---

# Skill: understanding

Structured questioning skill that walks the design tree of a user's plan one branch at a time, resolves ambiguous terms against existing project language, cross-checks claims against the codebase, and captures every resolved term or decision into `.claude/MEMORY.md` as it crystallises.

**Skill shape:** linear. Dual-mode — invoked standalone via `/understanding`, and loadable via the `skills:` frontmatter field on the consultant, analyst, and architect agents.

---

## Memory file conventions

The single output of a session is `.claude/MEMORY.md` at the project root. Create it lazily — only when the first term or decision is resolved. Do **not** create it eagerly at session start.

### Structure

```md
# Project Understanding

{One or two sentences naming the project and what it does.}

## Language

**{Term}**:
{One or two sentence definition — what it IS, not what it does.}
_Avoid_: {alias-1}, {alias-2}

## Flagged ambiguities

- **{Term}** — {how it was used ambiguously, and the resolution.}

## Decisions

- **{Short decision title}** — {one-sentence statement of the choice and why.}
```

### Rules for writing to MEMORY.md

- **Be opinionated.** When several words name the same concept, pick the canonical one and list the rest under `_Avoid_`.
- **One or two sentences per term.** Define what it IS, not what it does.
- **Project-specific only.** General programming concepts (timeouts, retries, error types) do not belong, even if heavily used.
- **Flag conflicts explicitly.** If a term is used two ways in one session, log it under *Flagged ambiguities* with the resolution.
- **Update inline, not in batch.** As soon as a term or decision is resolved during the interview, edit the file. Do not collect a list and write at the end.
- **Group under subheadings** only when natural clusters emerge — a flat `## Language` list is fine for small projects.
- **Never overwrite an existing entry silently.** If the resolved meaning conflicts with an existing entry, surface the conflict to the user and reconcile before writing.

`.claude/MEMORY.md` is a glossary and decision log — it is not a spec, scratch pad, or implementation note repository. Keep implementation detail out.

---

## Interview rules

Apply during the session — these are the deterministic moves that produce the file above.

### Ask one question at a time

Walk the design tree depth-first. Resolve dependencies between decisions one-by-one. Wait for the user's reply on each question before continuing. Provide your recommended answer with every question.

### Prefer code exploration over questions

If a question can be answered by reading the codebase (Grep, Glob, Read), explore the codebase instead of asking. Only ask the user when the answer is not derivable from the code or from `.claude/MEMORY.md`.

### Challenge against existing language

When the user uses a term that conflicts with an entry already in `.claude/MEMORY.md`, surface it immediately. *Example:* "MEMORY.md defines 'cancellation' as the customer-initiated path only, but you seem to mean any termination — which is it?"

### Sharpen fuzzy language

When the user uses a vague or overloaded term, propose a precise canonical name. *Example:* "You're saying 'account' — do you mean Customer or User? Those are different things."

### Stress-test with concrete scenarios

When a relationship between concepts is being discussed, invent a specific scenario that probes the edge. Force the user to be precise about boundaries.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "The code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Capture as you go

The moment a term or decision is resolved, write it to `.claude/MEMORY.md` immediately. Do not batch. Then continue to the next question.

---

## Steps (standalone invocation)

Follow in order when invoked directly as `/understanding`:

1. If the request does not include a plan, feature description, or topic to question, ask: "What should we work through? Provide the plan, design, or idea you want stress-tested." Stop until answered.
2. Read `.claude/MEMORY.md` if it exists. If it does not exist, note that — you will create it lazily on the first resolved term. Do **not** create it now.
3. Skim the relevant parts of the codebase for prior art on the subject (Grep for key nouns from the user's plan). Note any existing terminology that the plan touches.
4. Begin the interview, applying every rule in **Interview rules** above. Ask one question at a time. Provide your recommended answer with each question.
5. As each term resolves, update `.claude/MEMORY.md` inline per **Memory file conventions**. Create the file on the first resolved entry if it does not yet exist.
6. As each non-trivial decision crystallises (hard to reverse, surprising without context, the result of a real trade-off), log it under `## Decisions` in `.claude/MEMORY.md`.
7. When the user signals the session is done — or the design tree is exhausted — output a one-paragraph summary: which terms were added, which ambiguities were flagged, which decisions were recorded, and any open branches the user chose to defer.

Agents that load this skill and have already validated input and read prior context join at step 3.

---

## Rules

- Never write implementation detail, code, or specs into `.claude/MEMORY.md` — it is a glossary and decision log only.
- Never create `.claude/MEMORY.md` eagerly. Create it the moment the first term resolves, not before.
- Never batch updates. Every resolved term or decision is written before the next question is asked.
- Never overwrite an existing entry without surfacing the conflict to the user.

---

## Bundled resources

```
.claude/skills/understanding/
  SKILL.md       this file — the always-loaded core
```
