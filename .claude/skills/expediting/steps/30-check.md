# Expediting, step 3: check, drive, commit, close

Run the project's test and lint commands (`harness preflight <id>` lists the detected ones). Redirect long output to a file under `.claude/ledger/` and read its tail; the command stays visible to the hooks that record it.

Drive the changed flow through its real entry point when the change touches one. One command does the whole loop and costs no permission prompt:

```
node .claude/bin/harness.mjs drive --hit "GET /invoices?page=2"        # start on a free port, hit, stop, log
node .claude/bin/harness.mjs drive --run "npm run cli -- list"        # a CLI: run and capture
```

Add one `--hit "POST /path <json>"` per request the change affects; `--start "<cmd>"` overrides the detected start script. Read the statuses and bodies it prints; fix and re-run until they match the request. A green suite is not verification. A change with no runtime surface (a pure function, a test, docs) records `no drivable surface: <reason>` instead. Never describe a drive you did not run; the ledger shows the gap.

Fix what the checks find, then commit the touch set:

```
git add -A -- <touched paths> && git commit -m "<type>(<scope>): <what>, <id>"
```

Close the work item:

```
node .claude/bin/harness.mjs set <id> status=done
```

Emit the `## Expedited` block from `SKILL.md` and stop. No next-step suggestions, no offers, no routing chatter: the fast lane ends when the change is in.
