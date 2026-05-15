---
name: auditing
description: >
  Session auditing skill. Creates a per-session audit trail at
  artifacts/sessions/{date}/{uuid}/session.md. Hooks auto-update heartbeat
  and artifact entries without LLM involvement. Invoke as /auditing with
  subcommands: init, checkpoint, close.
---

# Skill: auditing

Maintains a structured, auditable record of what was worked on in a session.
Session identity comes from `$CLAUDE_CODE_SESSION_ID` — each Claude window gets
its own independent trail. Hooks handle heartbeat and artifact logging automatically.

---

## Subcommands

### init

**When:** user invokes `/auditing init <goal>` to set or override the session goal.

The session is already created automatically by the `UserPromptSubmit` hook on the
first message. This subcommand only updates the `## Goal` section.

Run:
```bash
cat "artifacts/sessions/.map/$CLAUDE_CODE_SESSION_ID"
```

Edit `artifacts/sessions/{REL_PATH}/session.md`: replace the current content of
the `## Goal` section with the provided `<goal>` text. The Goal section is the
paragraph between `## Goal` and the next `##` heading.

Output exactly one line: `Goal updated.`

---

### checkpoint

**When:** user invokes `/auditing checkpoint <note>` or a significant milestone occurs
(plan approved, phase complete, key decision made, open question identified).

Run:
```bash
printf "REL=%s\nTIME=%s\n" \
  "$(cat "artifacts/sessions/.map/$CLAUDE_CODE_SESSION_ID")" \
  "$(date -u +'%H:%MZ')"
```

Edit `artifacts/sessions/{REL}/session.md`: insert the following line
immediately before `<!-- end-checkpoints -->`:
```
- {TIME} — {note}
```

`{note}` is the argument from the invocation. Max 100 characters. No newlines.

Output exactly one line: `Checkpoint logged.`

---

### close

**When:** user invokes `/auditing close` or the session is ending.

Run:
```bash
cat "artifacts/sessions/.map/$CLAUDE_CODE_SESSION_ID"
```

Edit `artifacts/sessions/{REL}/session.md`: fill the `## Open` section with
any unresolved questions or next steps. Write `—` if none.

Run:
```bash
rm "artifacts/sessions/.map/$CLAUDE_CODE_SESSION_ID"
```

Output exactly one line: `Session closed: artifacts/sessions/{REL}/session.md`

---

## Checkpoint triggers (when invoked by other skills or agents)

Call `/auditing checkpoint` automatically at:
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
