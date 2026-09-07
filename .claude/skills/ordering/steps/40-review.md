# Ordering, step 4: the cumulative review

`harness next <id>` said `review_cumulative`. Compute the summary the reviewer needs; never let the reviewer detect it:

```
node .claude/bin/harness.mjs review-summary <id>
```

It prints `{ size, frameworks, concerns, security_path, changed_files, base }` from the diff between the work item's first phase commit and HEAD. Spawn the reviewer once, named `reviewer` (continue it for re-reviews), with:

```
work: <id>
scope: cumulative
summary: <the JSON, verbatim>
step: .claude/skills/reviewing/steps/10-alignment.md
```

Wait for the verdict. The hook routes it:

`APPROVED`: `harness next` says `close`. Run `harness set <id> status=done`, print the closing block from `SKILL.md`, stop.

`CHANGES REQUIRED`: `SendMessage` the developer with `work: <id>`, `review: <the reviewer's findings verbatim>`, `phase: <the phase each finding belongs to>`. The developer fixes and ends with `PHASE DONE`; re-run this step, continuing the same reviewer so its prior findings stay in context. On the third `CHANGES REQUIRED` for this item, stop with the options `[c] continue with a fresh developer · [d] redesign · [x] accept as is`.

`AMENDMENT NEEDED: D-00x <reason>` above the verdict: the code followed a decision that turned out wrong. Continue the architect with `work: <id>`, `amend: <the line verbatim>`, `step: .claude/skills/designing/steps/40-amend.md`; on `AMENDED`, continue the developer for the affected phase. The user is told in the closing block which decision moved and why.
