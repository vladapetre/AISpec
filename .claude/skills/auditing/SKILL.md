---
name: auditing
description: >
  Maintains a per-session audit trail at artifacts/sessions/{date}/{uuid}/session.md.
  Use this skill to set the session goal, log a milestone checkpoint, or close out a
  session. Invoke standalone as `/auditing <init|checkpoint|close>`; also driven
  programmatically by hooks and by other skills/agents at milestone events.
---

# Skill: auditing

Keeps a structured, auditable record of what a session worked on. Session identity comes
from `$CLAUDE_CODE_SESSION_ID`, so each Claude window gets its own independent trail; the
`UserPromptSubmit`, `Stop`, and `PostToolUse` hooks create the file and maintain the
heartbeat and artifact entries with no LLM involvement.

**Skill shape:** dispatcher. Invoked standalone via `/auditing`, and driven
programmatically by hooks and by other skills/agents at milestone events. Every
invocation must name exactly one subcommand (`init`, `checkpoint`, `close`).

---

## Steps (standalone invocation)

Follow in order when invoked directly as `/auditing`:

1. Parse the subcommand from the invocation. Valid values: `init`, `checkpoint`, `close`.
   IF no subcommand is provided: output `Usage: /auditing <init|checkpoint|close> [args]`
   and stop.
2. Dispatch to the matching `### <subcommand>` section below and execute it exactly.
3. Run exactly one subcommand per invocation — never chain.

---

## Subcommands

The deterministic file edits are performed by `scripts/session.mjs` — a Node script
(runs identically on Windows, macOS, and Linux) that resolves the session file from
`$CLAUDE_CODE_SESSION_ID`, applies the edit, and prints the exact confirmation line.
Never edit the session file by hand.

### init

**When:** user invokes `/auditing init <goal>` to set or override the session goal.

The session file is already created by the `UserPromptSubmit` hook on the first message.
This subcommand only rewrites the `## Goal` section.

Run:
```bash
node .claude/skills/auditing/scripts/session.mjs init "<goal>"
```

Output exactly the script's line: `Goal updated.`

### checkpoint

**When:** user invokes `/auditing checkpoint <note>`, or a milestone occurs (see
*Checkpoint triggers*).

`<note>` is one factual, past-tense sentence, max 100 characters, no newlines — the
script rejects a note that breaks these limits.

Run:
```bash
node .claude/skills/auditing/scripts/session.mjs checkpoint "<note>"
```

Output exactly the script's line: `Checkpoint logged.`

### close

**When:** user invokes `/auditing close`, or the session is ending.

1. Resolve the session file path:
   ```bash
   cat "artifacts/sessions/.map/$CLAUDE_CODE_SESSION_ID"
   ```
2. Edit `artifacts/sessions/{REL}/session.md`: fill the `## Open` section with any
   unresolved questions or next steps — questions only, no answers. Write `—` if none.
   This step needs judgement, so it is not scripted.
3. Run the cleanup helper (removes the session-map entry):
   ```bash
   node .claude/skills/auditing/scripts/session.mjs close
   ```

Output exactly the script's line: `Session closed: artifacts/sessions/{REL}/session.md`

---

## Checkpoint triggers

When another skill or agent drives this skill, call `/auditing checkpoint` automatically at:
- Plan or ADR created or approved
- Implementation phase approved or completed
- Key decision made
- Open question identified or resolved

Do NOT checkpoint for every tool call — only milestone events.

---

## Rules

- Never write code, diffs, or implementation detail into the session file.
- Checkpoint notes are one sentence, past tense, factual.
- The `## Open` section lists questions only — no answers, no resolution detail.
- Do not read other sessions' files unless the user explicitly asks.

---

## Bundled resources

```
.claude/skills/auditing/
  SKILL.md              this file — the always-loaded core
  scripts/session.mjs   deterministic init / checkpoint / close file edits (Node)
  templates/session.md  the session-file skeleton the session-start hook instantiates
```
