# Expediting, step 1: open the work item and confirm the touch set

Run, in one tool batch:

```
node .claude/bin/harness.mjs new --lane fast --title "<six-word title from the request>"
```

plus a Read of every file the request names and a Grep for the symbol or route it names when no file is given. The work id the first command prints is `<id>` for the rest of this lane.

Write the touch set down before editing: the files you will change, at most three. Re-check admission with the real list:

```
node .claude/bin/harness.mjs admit --text "<request>" --touched <a>,<b> --human
```

`lane: fast` confirmed: continue to `steps/20-change.md`. Any other lane: stop, run `harness set <id> status=abandoned`, and start the named lane skill with the request text and the touch set you found; it opens its own work item.

Ask the user only when the request is ambiguous in a way that changes which file you edit. One question, with your recommended default, then stop; never guess between two readings that touch different code.
