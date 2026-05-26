# Follow-up — Tool Gating Per Agent

**Predecessor:** Suggestion 9 of the synthesis review (Pattern 10 — *Tool gating per phase/mode: state machine via tool availability*) from `tmp/findings-_synthesis.md`.

**Status:** Done — 2026-05-24. All five agents now carry explicit path-prefix `Write` rules and read-only `Bash` rules under `<rules>`; the consultant lost its `Bash` grant entirely (its sole prior use was `mkdir -p`, which the harness's `Write` parent-directory autocreation already covers). `npm run lint:agents` clean across all 5 agents. The developer's `Bash` rule whitelists the stash dance from step 8 as the sole tree-mutating exception.

The principle (remove a tool from an agent's grant rather than tell it not to use the tool in prose) is already applied unevenly across AISpec:

| Agent | Current grant | Read-only? | Repo-write? | Notes |
|---|---|---|---|---|
| analyst | `Read, Write, Bash, Glob, Grep, WebFetch, WebSearch, SendMessage` | no | no `Edit` — `Write` is for `artifacts/reports/` and its own memory file | `Bash` used for `git log` / `git blame` during research. |
| consultant | `Read, Edit, Write, Bash, Glob, Grep, SendMessage` | no | yes (strategy artifacts) | `Bash` rarely used; candidate for removal. |
| architect | `Read, Edit, Write, Bash, Glob, Grep, SendMessage` | no | yes (ADRs, plans) | `Bash` used to detect project conventions / config files. |
| developer | `Read, Edit, Write, Bash, Glob, Grep, SendMessage` | no | yes (source, plan status line only) | Needs all of these. |
| reviewer | `Read, Write, Bash, Glob, Grep, SendMessage` | effectively (no `Edit`) | only its own memory file | `Write` retained for memory; lacks `Edit` so cannot mutate source. |

The reviewer's "no `Edit`" already implements the synthesis's headline recommendation that the reviewer be read-only. The analyst's "no `Edit`" similarly prevents in-place source mutation.

What is left is small, targeted tightening — not a rewrite.

---

## What to tighten

### A. Drop `Bash` from `consultant.md`

The consultant produces strategy artifacts (charters, context maps, SDRs, glossary entries). It does not run scripts, detect tooling, or inspect git history — those are analyst/architect concerns. Removing `Bash` enforces the boundary at grant time rather than via prose discipline.

**Action:**
- Edit `.claude/agents/consultant.md` frontmatter: `tools: Read, Edit, Write, Glob, Grep, SendMessage`.
- Verify no step in `<instructions>` invokes `Bash`. (Today the only candidate is opportunistic `git log` reads; the analyst owns that already.)

**Risk:** A consultant who genuinely needs a one-off shell read must instead ask the team lead to relay the data from the analyst. That is the correct topology — the consultant should not be its own researcher.

### B. Re-affirm `Write`-only-to-own-paths in analyst and reviewer

Both agents have `Write` for legitimate reasons (artifacts/reports for analyst; agent-memory for reviewer). The current rule lives in prose. Tighten by **adding an explicit path-prefix rule** to each agent's `<rules>` block:

For `analyst.md`:
```
- Write only under `artifacts/reports/` or `.claude/agent-memory/analyst/`. Any other `Write` target is out of scope — surface the request instead.
```

For `reviewer.md`:
```
- Write only under `.claude/agent-memory/reviewer/`. Never write under `artifacts/`, `src/`, `tests/`, or any plan/ADR path. Findings live in the conversation channel only.
```

These already exist informally; lifting them into `<rules>` makes them lint-checkable later.

### C. Reviewer's `Bash` scope

The reviewer's `Bash` grant is needed for `git log`, `git blame`, `git diff`, and pre-existing-failure detection (`git stash`). It does **not** need write-style Bash (`mv`, `rm`, `git commit`, package installs). Reinforce in `<rules>`:

```
- Bash usage is restricted to read-only git commands and shell utilities that do not modify the working tree (`git log`, `git blame`, `git diff`, `git show`, `git status`, `rg`, `wc`, etc.). Any command that would mutate the tree, the index, or remote state is out of scope — surface the need instead of executing.
```

The same rule, with `git stash --include-untracked && <test command> && git stash pop` whitelisted, belongs in `developer.md`'s pre-existing-failure step. The stash dance temporarily mutates the tree but restores it; it stays in the developer agent's grant.

### D. Developer Planning Mode (deferred)

The synthesis proposes a Planning Mode for the developer where `Edit`/`Write` is removed until the plan is approved. AISpec's current topology routes Planning to a different agent entirely (architect) — the developer is invoked only **after** a plan exists. The mode-switch the synthesis describes is therefore handled by **agent identity**, not by tool removal within a single agent.

No change required. The note is left here so a future reviewer does not re-discover the same conclusion.

### E. Bash on the analyst

The analyst's `Bash` grant is justified by:
- `git log` / `git blame` to attribute and date code regions.
- `wc -l`, `rg` shortcuts inside Bash for measurements that the Glob/Grep tools cannot express as cleanly.
- Project-tooling detection (e.g., reading `pyproject.toml` is fine via Read, but `npm view <pkg>` is a Bash-only check).

Keep `Bash`. Tighten the rule the same way as the reviewer — read-only operations only, with an inline `**Avoid (FM-3.1):**` cue for tool-mutating commands.

---

## What NOT to tighten

- **`SendMessage`** — required on every agent; the team-lead protocol depends on it.
- **`Glob`/`Grep`** — purely read operations; no point removing.
- **`Read`** — universal precondition for every agent.
- **`WebFetch`/`WebSearch` on analyst** — required for external research; only the analyst has them, which is the gate.

---

## Method

One PR per agent, in this order (lowest blast radius first):

1. `consultant.md` — drop `Bash`; verify no step uses it.
2. `analyst.md` — add path-prefix `Write` rule; tighten `Bash` rule.
3. `reviewer.md` — add path-prefix `Write` rule; tighten `Bash` rule.
4. `architect.md` — (optional) add path-prefix `Write` rule restricting writes to `artifacts/adr/`, `artifacts/plans/`, and its memory dir.
5. `developer.md` — no grant change; whitelist the stash dance in `<rules>`.

Run `npm run lint:agents` after each PR.

---

## Lint extensions (later, optional)

Extend `scripts/lint-agents.mjs` with:

- A check that the agent's frontmatter `tools:` list matches the minimum set its `<instructions>` actually exercises (grep agent body for `Bash`, `Edit`, `Write`, etc. usage cues; warn on grants that the body never invokes).
- A check that each agent's `<rules>` carries a path-prefix `Write` rule when `Write` is in the grant.

Not blocking on these — the manual review per agent file is sufficient at AISpec's current size.

---

## Non-goals

- **Phase-based tool removal within a single agent.** AISpec does not have agents that swap tool sets mid-session; mode-switching is by agent identity.
- **MCP-server-based tool gating.** Out of scope; AISpec runs without bespoke MCP infrastructure.
- **Removing `Write` from the reviewer entirely.** It needs `Write` for its memory file. The path-prefix rule is the correct guardrail.

---

## Acceptance for this follow-up phase

- `consultant.md` no longer carries `Bash` in its tool grant; lint clean.
- `analyst.md`, `reviewer.md` each carry an explicit path-prefix `Write` rule and a read-only `Bash` rule under `<rules>`.
- `developer.md` documents the stash dance as the sole tree-mutating Bash whitelisting.
- No agent's tool grant lists a tool that is never used in its `<instructions>` body.
