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

Walks the design tree of a user's plan one branch at a time, resolves ambiguous terms against existing project language, cross-checks claims against the codebase, and captures every resolved term or decision into `.claude/MEMORY.md` as it crystallises.

**Shape:** linear. Dual-mode — standalone via `/understanding`, or loaded via `skills:` frontmatter.

---

## Memory file conventions

The single output is `.claude/MEMORY.md` at project root. Create lazily — only on the first resolved term or decision. Do not create eagerly.

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

- **{Short decision title}** — {≤3 sentences: the choice, why, and what was rejected.} {Pointer to the owning artifact — SDR/ADR path — when one exists.}
```

### Rules

- **Be opinionated.** Several words for one concept → pick the canonical and list the rest under `_Avoid_`.
- **One or two sentences per term.** Define what it IS, not what it does.
- **Decisions are hooks, not essays.** A `## Decisions` entry is ≤3 sentences plus a pointer to the artifact that holds the detail (SDR, ADR, charter). If a decision's detail has no artifact home, that is the signal to ratify it into an SDR — never to inline the detail here. `.claude/MEMORY.md` is loaded every consultant turn; every excess word is a recurring tax.
- **Project-specific only.** General programming concepts do not belong.
- **Flag conflicts explicitly.** Term used two ways in one session → log under *Flagged ambiguities* with the resolution.
- **Update inline, not in batch.** Resolved → edit immediately.
- **Group under subheadings** only when natural clusters emerge.
- **Never overwrite an existing entry silently.** Conflict with existing → surface and reconcile before writing.

`.claude/MEMORY.md` is a glossary and decision log — not a spec, scratch pad, or implementation note repository.

---

## Interview rules

### Ask one question at a time

Walk the design tree depth-first. Resolve dependencies one-by-one. Wait for the user's reply on each question. Provide your recommended answer with every question.

### Prefer code exploration over questions

Question answerable by Grep/Glob/Read → explore the codebase instead. Ask the user only when the answer is not derivable from code or `.claude/MEMORY.md`.

### Challenge against existing language

User term conflicts with an entry in `.claude/MEMORY.md` → surface immediately. *Example:* "MEMORY.md defines 'cancellation' as the customer-initiated path only, but you seem to mean any termination — which is it?"

### Sharpen fuzzy language

User uses a vague or overloaded term → propose a precise canonical name. *Example:* "You're saying 'account' — Customer or User? Those are different things."

### Stress-test with concrete scenarios

Relationship between concepts being discussed → invent a specific scenario that probes the edge. Force precision about boundaries.

### Cross-reference with code

User states how something works → check the code agrees. Contradiction → surface: "The code cancels entire Orders, but you said partial cancellation is possible — which is right?"

### Capture as you go

Resolved term or decision → write to `.claude/MEMORY.md` immediately. Do not batch.

---

## Steps (standalone invocation)

When invoked directly as `/understanding`:

1. No plan/feature/topic in request → ask "What should we work through? Provide the plan, design, or idea you want stress-tested." Stop.
2. Read `.claude/MEMORY.md` if it exists. If not, note that — create lazily on the first resolved term.
3. Skim relevant parts of the codebase for prior art (Grep for key nouns from the user's plan). Note existing terminology the plan touches.
4. Begin the interview, applying every **Interview rule**. One question at a time. Provide your recommended answer with each.
5. As each term resolves, update `.claude/MEMORY.md` inline per **Memory file conventions**. Create the file on first resolved entry if absent.
6. As each non-trivial decision crystallises (hard to reverse, surprising without context, the result of a real trade-off), log under `## Decisions`.
7. Stop at the **first** of these termination conditions and emit the closing summary:
   - **User stop signal.** The user replies with `done`, `stop`, `that's enough`, `enough`, `wrap up`, `summarise` (case-insensitive, on its own line or as the entire turn).
   - **Question cap.** You have asked **12 questions** in this session and none of the last 3 resolved a new term or decision — diminishing returns; offer to continue and stop pending the user's explicit `continue`.
   - **Hard cap.** You have asked **20 questions** in this session — stop unconditionally and recommend ratifying or breaking the topic into a fresh session.
   - **Design tree exhausted.** No open branches remain in your working list AND no new branches surfaced in the last reply.
   Count questions you actually asked the user — not your own internal queries answered by Grep/Read.
8. Closing summary (one paragraph): terms added, ambiguities flagged, decisions recorded, open branches deferred, and which termination condition fired.

Agents that load this skill and have already validated input join at step 3.

---

## Rules

- Never write implementation detail, code, or specs into `.claude/MEMORY.md`.
- Never create `.claude/MEMORY.md` eagerly.
- Never batch updates.
- Never overwrite an existing entry without surfacing the conflict.

---

## Bundled resources

```
.claude/skills/understanding/
  SKILL.md
```
