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
| `inject.project-memory.mjs` | SessionStart | — | Injects `.claude/MEMORY.md` (shared glossary + decision log) into the session |
| `guard.write.mjs` | PreToolUse | `Write\|Edit` | Only registered `artifacts/` directories are writable; agent-memory accepts only registered file kinds (CLAUDE.md `## Agent memory layout`) |
| `guard.bash.mjs` | PreToolUse | `Bash` | Real command evaluation instead of prefix matching: compound commands checked per segment; read-only/inspection commands auto-allowed; destructive roots (`rm`, `sudo`, `git push/reset/…`) denied; meta-commands (`xargs`, `eval`, `sh -c`), hidden execution (`$(…)`, backticks), and write redirects fall through to the normal permission prompt. `npm run` scripts are resolved via `package.json` and classified by what they actually execute. Requires `shell-quote` (falls through silently if absent — see `vendor/`) |
| `lint.write.mjs` | PostToolUse | `Write\|Edit` | Memory caps (150-line file, 2-line/50-word entries), `.claude/MEMORY.md` decision-entry size, plan anchor/stamp integrity via `plan-status.mjs` |
| `guard.verdict.mjs` | Stop | — | Review / amendment / phase blocks must close with their exact contract lines (verdict tokens, `Classification:`, routing/approval lines) before the turn may end |
| `emit.metrics.mjs` | Stop | — | Telemetry: appends per-turn session usage plus the emitted block/verdict/classification to `.claude/telemetry/ledger.jsonl` (gitignored) |

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
