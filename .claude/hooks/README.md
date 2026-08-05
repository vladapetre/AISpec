# Hook enforcement layer

The hooks in this directory mechanically enforce contracts that used to be prompt
discipline. They are wired in `.claude/settings.json`.

This file is a **maintainer's reference** — like `agents/assets/mast.yaml`, it is not
loaded at runtime. Consult it when authoring, wiring, or debugging a hook. The one
runtime-relevant rule (a blocked call is the harness working — fix the violation, do
not retry variants) stays in CLAUDE.md `## Hook enforcement layer`.

## Naming convention

| Prefix | Behaviour |
|---|---|
| `guard.*` | Blocks the call or bounces the turn |
| `lint.*` | Allows the call, feeds violations back as text |
| `inject.*` | Adds context, never blocks |

## Registry

| Hook | Event | Matcher | Enforces |
|---|---|---|---|
| `inject.project-memory.mjs` | SessionStart | — | Injects `.claude/MEMORY.md` (shared glossary + decision log) into the session. Fails silently (`exit 0`) — acceptable, since a missing glossary degrades quality but breaks no contract |
| `inject.orchestration.mjs` | SessionStart | — | Injects `agents/assets/instructions/lead/orchestration.md` (spawn table, relay discipline, workflow launchers) into the **main session only**, keeping ~5 KB teammates cannot act on out of their context. Fails **loud**: `SessionStart` cannot block and its stderr never reaches Claude, so every error path still exits 0 and injects a warning telling the lead to Read the file directly and report the breakage |
| `guard.write.mjs` | PreToolUse | `Write\|Edit` | Only registered `artifacts/` directories are writable; agent-memory accepts only registered file kinds (CLAUDE.md `## Agent memory layout`) |
| `guard.bash.mjs` | PreToolUse | `Bash` | Real command evaluation instead of prefix matching: compound commands checked per segment; read-only/inspection commands auto-allowed; destructive roots (`rm`, `sudo`, `git push/reset/…`) denied; meta-commands (`xargs`, `eval`, `sh -c`), hidden execution (`$(…)`, backticks), and write redirects fall through to the normal permission prompt. `npm run` scripts are resolved via `package.json` and classified by what they actually execute. Requires `shell-quote` (falls through silently if absent — see `vendor/`) |
| `lint.write.mjs` | PostToolUse | `Write\|Edit` | Memory caps (150-line file, 2-line/50-word entries), `.claude/MEMORY.md` decision-entry size, plan anchor/stamp integrity via `plan-status.mjs` |
| `guard.verdict.mjs` | Stop + **SubagentStop** | — | Review / amendment / phase blocks must close with their exact contract lines (verdict tokens, `Classification:`, routing/approval lines) before the turn may end |
| `emit.metrics.mjs` | Stop + **SubagentStop** | — | Telemetry: appends the emitted block/verdict/classification to `.claude/telemetry/ledger.jsonl` (gitignored), plus per-session token usage on lead turns |
| `lib/turn-block.mjs` | — (library) | — | Not a hook. Shared by the two above: locates the turn's contract block and classifies it. One copy, so the two cannot drift apart |
| `observe.bash.mjs` | PostToolUse | `Bash` | Records every executed command to `.claude/state/drive-log.jsonl` (gitignored) with a drive/inspect classification and, for drives, a tree hash. Never blocks — it runs after the tool |
| `lib/project-root.mjs` | — (library) | — | Not a hook. Resolves the project root and repo-relative paths for every hook that policies or reads one. `CLAUDE_PROJECT_DIR`, else walk up for `.claude/`, else cwd |
| `lib/drive-evidence.mjs` | — (library) | — | Not a hook. The drive/inspect classifier, tree hashing, the evidence log, and `**Verification:**` claim parsing. Shared by `observe.bash.mjs`, `guard.verdict.mjs`, `emit.metrics.mjs` |

**Verification is observed, not trusted.** `implement.md` step 7a already required runtime evidence ("a command you ran and output you saw"), but `guard.verdict` only checked the `**Verification:**` field was non-empty — so `**Verification:** ran the flow, looked fine` passed. It was the one place the harness accepted a claim for a fact that opens a gate. `observe.bash.mjs` now records what actually ran, and the agent cannot write that log.

Two properties, both deliberate:

- **Only the unambiguous case blocks**: the field claims a driven command *and* no drive-class command was observed for that phase. The classifier is biased **broad** (anything not a recognised inspection command counts as a drive) because a false block halts real work while a false pass merely preserves the old behaviour. The two honest exemption forms pass with no evidence — making the exemption the only way past without a drive is the point, since the user then sees it stated.
- **Staleness is measured, not enforced (yet).** `emit.metrics` records `drive_fresh` — whether the last observed drive ran against the *current* tree. A drive followed by an unverified source fix is exactly the defect worth catching, but excluding every legitimate post-drive edit is guesswork until there are numbers. Markdown, `artifacts/`, `agent-memory/`, `state/` and `telemetry/` are already excluded from the tree hash, since a phase legitimately ends by stamping a plan and writing memory. Flip it to blocking once the ledger says the false-positive rate is acceptable.

**Paths are anchored to the project root, never the session cwd.** This repo is an umbrella with nested git repos and a populated `.worktrees/`, so sessions routinely start in a subdirectory — and cwd-anchoring broke every path rule there. `guard.write.mjs` computed `../../artifacts/scope-changes/x.md`, read the leading `..` as "outside the project", and **failed open for exactly the writes it exists to stop**; `lint.write.mjs` silently skipped the memory caps and plan-anchor check; both `inject.*` hooks looked for `.claude/…` under the subdirectory and found nothing. Anchoring at the root makes a path resolve identically wherever the session started.

`guard.bash.mjs` is the deliberate exception: it stays cwd-relative, because a shell command genuinely executes in the session cwd.

**Why the two Stop hooks are wired to both events.** A named teammate ends its turn with one `SendMessage` carrying its `<output_format>` block verbatim, and the lead is forbidden from re-quoting teammate output — so the block only ever exists inside the *subagent's* transcript, in a tool input. Wired to `Stop` alone, both hooks read the lead's final text and saw no teammate block at all: the verdict contract was effectively unenforced, and the ledger recorded **1 gate event in 633 lines** against 131 ADRs on disk. `SubagentStop` is where teammate contracts actually live.

Two properties worth preserving if these are edited:

- **`SendMessage` payloads are read on teammate turns only** (`lib/turn-block.mjs`, `includeToolPayloads`). The lead relays requests through `SendMessage` too, and a forwarded amendment request can carry a block header — judging the lead against someone else's contract would invent violations and inflate gate counts.
- **Teammate telemetry rows carry no `usage`/`turns`.** `report.mjs` treats the last line per session as that session's cumulative total, and teammates share the session id; recording usage on those rows would overwrite it. It also keeps the added per-teammate cost to a single bounded tail read.

## Standalone invocations

```sh
node .claude/hooks/lint.write.mjs --all   # lint every memory + plan file in the repo
node .claude/telemetry/report.mjs         # gate hit rates, amendment mix, token spend
```

Tune carve-outs and cadences from the telemetry numbers, not from feel.

## Relationship to `selfcheck.yaml`

The matching `agents/assets/selfcheck.yaml` boxes remain in place. The hook is the
backstop; the self-check is the habit. Removing a self-check box because a hook covers
it loses the agent-side reasoning that prevents the violation in the first place.
