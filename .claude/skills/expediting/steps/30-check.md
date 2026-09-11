# Expediting, step 3: check, drive, commit, close

Tests and lint, one command, no permission prompt:

```
node .claude/bin/harness.mjs check --human
```

It runs the detected test and lint commands, logs to `.claude/ledger/check-*.log`, prints the failing tail only and stops at the first red step. Fix and re-run until `CHECK OK`. Never shell-redirect test output yourself.

Drive the changed flow through its real entry point when the change touches one. One command does the whole loop and costs no permission prompt:

```
node .claude/bin/harness.mjs drive --hit "GET /invoices?page=2" --human   # start on a free port, hit, stop, restore, log
node .claude/bin/harness.mjs drive --run "npm run cli -- list" --human    # a CLI: run and capture
```

Add one `--hit "POST /path <json>"` per request the change affects; `--start "<cmd>"` overrides the detected start script. Files the drive itself changes (a record the POST created) are restored so the tree stays yours. Read the statuses and bodies it prints; fix and re-run until they match the request. A green suite is not verification. A change with no runtime surface (a pure function, a test, docs) records `no drivable surface: <reason>` instead. Never describe a drive you did not run; the ledger shows the gap.

Fix what the checks find, then commit the touch set:

```
git add -A -- <touched paths> && git commit -m "<type>(<scope>): <what>, <id>"
```

Close the work item:

```
node .claude/bin/harness.mjs set <id> status=done
```

Emit the `## Expedited` block from `SKILL.md` and stop. No next-step suggestions, no offers, no routing chatter: the fast lane ends when the change is in.
