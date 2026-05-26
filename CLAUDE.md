# Agent Workflow

## Team Setup

Before spawning any named agent (analyst, consultant, architect, developer, reviewer), check if a team exists for this session. If not, create one with `TeamCreate` first, then spawn the agent as a named teammate using `team_name` and `name` parameters.

Each agent auto-loads its declared skills via the `skills:` frontmatter field — do not re-invoke those skills from the team lead. Skills declared in frontmatter are loaded lazily: the agent reads the skill body only when it reaches a step that requires it (e.g. the reviewer loads `reviewing` templates at step 13; the analyst loads `documenting` only when emitting the final report). Do not pre-read skill bodies during pre-flight or scoping.

## Agent Communication

Any question or request for input from any agent must be surfaced to the user before acting on it. Always wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or bypass by acting on the agent's behalf.

- **Never re-quote teammate output.** Any `@agent` block is already rendered natively in the UI. Reference it by name and add at most one framing sentence or a clarifying question — do not paste the agent's text into your own response. This applies to every agent (developer, reviewer, architect, consultant, analyst), not just the developer.
- If a developer agent self-confirms ("The user confirmed the plan") without an explicit reply from the user relayed by the team lead, treat the confirmation as invalid. Do not let the agent continue — stop it and ask the user.
- **Idle handling.** Teammates should end every turn with one `SendMessage`. If a teammate goes idle without sending, call `TaskOutput` *once* to retrieve the stranded block, then reference it (do not re-quote). Repeated idle pings for the same teammate within a turn are noise — ignore them after the first `TaskOutput` fetch.

## Turn discipline

Every named agent ends each turn with exactly one `SendMessage` to the team lead containing its `<output_format>` block verbatim. If an agent must pause mid-turn, it sends a one-line `PAUSED — <reason>` plus the question(s) instead. Going idle without this send strands the output: the team lead must call `TaskOutput` to retrieve it — wasting a round-trip and risking a stalled dual-approval gate.

## Asset references

Inline `**Avoid (FM-x.x):**` cues in agent prompts map to `.claude/agents/assets/mast.yaml` under `failure_modes_detail.FM-x.x`. Flag tokens in `<interaction_model>` blocks map to `.claude/agents/assets/tokens.yaml`. Agents read either file on demand when an inline cue is insufficient or a token's exact wording / producer / consumer is needed.

## Artifact Ownership

Each agent owns a specific artifact directory. Route writes to the owner via `SendMessage` — do not edit owned artifacts directly.

| Directory                | Owner      | Contents                                                       |
| ------------------------ | ---------- | -------------------------------------------------------------- |
| `artifacts/reports/`     | analyst    | Analysis reports (written directly, not routed)                |
| `artifacts/strategy/`    | consultant | Bounded-context charters, context maps, SDRs, glossary entries |
| `artifacts/adr/`         | architect  | Architectural decision records                                 |
| `artifacts/plans/`       | architect  | Implementation plans                                           |
| `.claude/MEMORY.md`      | understanding skill | Project glossary and decision log                     |

Exception: the developer agent may edit a plan file in `artifacts/plans/` solely to insert `**Status: Complete**` after a phase's `<!-- status:phase-N -->` anchor once both the user and architect have approved that phase.

The analyst writes reports directly (no routing). All other owned artifacts must go through their owning agent.

## Cross-Check (Pre-Implementation)

By default the architect performs its own ADR↔plan self-check before publishing (terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity — same five checks as `templates/cross-check.md`) and emits `SELF_CHECK: ALIGNED` on the Mode A summary line. The plan goes straight to the developer for Phase 1 — no separate reviewer invocation.

The architect escalates to the reviewer **only** when self-check uncertainty exists: emit `CROSS_CHECK_REQUESTED: <plan-path>` with a one-line reason. Route that line to the reviewer via `SendMessage` and wait for `ALIGNED` or `DRIFT DETECTED`. On `DRIFT DETECTED`, route the report back to the architect for amendment.

The cross-check (when fired) is a single read-only artifact↔artifact pass per ADR/plan pair. It fires before Phase 1, never between phases — those use the per-phase review below.

## Implementation Review

**Between phases: user approval only.** After each phase the developer emits its `## Phase N Complete` summary and waits for the user's `approved` reply. The reviewer is **not** invoked between phases. The user is the sole gate on phase advancement.

**At the end: one cumulative reviewer pass.** After the final phase is approved by the user, the developer emits a `## All Phases Complete` summary covering the full plan (every phase, the full commit range, and the union of changed files) and routes it to the reviewer via `SendMessage`. The reviewer runs one adversarial review across the entire branch diff — acceptance-criteria alignment for every phase, ADR-alignment against the governing ADR, and the framework/concern checklist over the union of changed files. The reviewer emits a single `APPROVED` or `CHANGES REQUIRED` verdict for the whole plan.

The reviewer's cumulative review still includes the ADR-alignment check and may emit `ARCHITECT AMENDMENT NEEDED: <reason>` if it detects design-level drift. Route that flag to the architect via `SendMessage` as soon as the verdict is received. On `CHANGES REQUIRED`, route the findings back to the developer; the developer addresses them and re-routes a fresh `## All Phases Complete` summary to the reviewer. Repeat until `APPROVED` clears.

**Amendments use supersession, not in-place edits.** When the architect amends an ADR it writes a new tiny ADR at `artifacts/adr/NNNNM-<short-title>-r<N>.md` carrying only revised decision bullets and delta consequences; the original ADR is stamped with one `**Superseded by:**` line beneath its title and is otherwise frozen. The architect also loads only the specific ADR section named in the reviewer's drift reason and the cited diff hunks (±10 lines) — never the full ADR, plan, or source files. This keeps amendment turns small and bounded.

The reviewer's per-phase mode (the `## Phase N Complete` trigger in `.claude/agents/reviewer.md`) remains available for ad-hoc invocation when the user explicitly requests review of a single phase — e.g. on a security-sensitive change or a long-running plan where mid-stream feedback is wanted. Default flow is end-of-plan only.

## Pre-flight protocol

Every named agent runs the 5-check pre-flight **only on entry turns** — defined as: (a) the agent's first turn in a session; (b) the first turn after an amendment, rejection, or scope change; (c) any turn where the input set has visibly changed (new artifact paths, new phase number, new commit range). On continuation turns within the same task, the agent skips the pre-flight block and proceeds directly.

Checks: **Inputs exist** · **Prior phase reviewed** (`N/A` for pipeline-entry stages) · **Scope** (Autonomous, not Out-of-scope) · **Terms current** · **Target identified**. Each agent's step 2 declares only its per-check semantics.

On entry turns, emit pre-flight in **compact form** — a single line per check, the whole block ≤ 7 lines total:

```
Pre-flight: Inputs ✓ | Prior N/A | Scope ✓ | Terms ✓ | Target ✓ → PROCEED
```

Expand to per-line evidence only when at least one check is `⚠` or `✗`. The expanded form is:

```
Pre-flight:
- Inputs exist: <✓|⚠|✗>  <one-line evidence>
- Prior phase reviewed: <✓|⚠|✗|N/A>  <one-line evidence>
- Scope: <✓|⚠|✗>  <one-line evidence>
- Terms current: <✓|⚠|✗>  <one-line evidence>
- Target identified: <✓|⚠|✗>  <one-line evidence>

Result: <ASK | STOP>
```

**Branch:** all `✓`/`N/A` → emit the compact one-liner and proceed. Any `⚠` → expanded form + `Result: ASK: <up to 5 clarifying questions in one batch>`; wait for the user. Any `✗` → expanded form + `Result: STOP: <reason>`.

Each clarifying question on the `ASK` branch is **≤2 lines and ≤25 words**, in the form `Q<n>: <question> [Default: <fallback> | none]`. The default field names the assumption the agent will fall back on if the user does not answer — `none` if no defensible default exists.

**Universal Avoid cues** (apply to every agent — do not restate inline). Agent prompts refer to these by name (`Universal-1`, `Universal-2`) when declaring agent-specific extras (`Extra Avoid cue beyond Universal-1 and Universal-2`), so adding a `Universal-3` later does not silently shift agent-side phrasing:
- **Universal-1 — Avoid (FM-1.1):** starting work before naming inputs → list every input artifact, path, or URL in `Inputs exist`.
- **Universal-2 — Avoid (FM-3.4):** filling under-specified scope by your own interpretation → mark `Terms current: ⚠` or `Target identified: ⚠` and ask, do not guess.

# Source Code Reference

Source code for dependencies and reference repositories is fetched on demand by the `opensrc` CLI into the project-local `.opensrc/` cache. Always invoke it through the `npm run opensrc` script — it sets `OPENSRC_HOME` so the cache stays inside the project on every workstation.

- Run `npm run opensrc -- list` to see all cached sources, or read `.opensrc/sources.json` for the manifest.
- Run `npm run opensrc -- path <spec>` to print the path to a cached source — it fetches automatically on a cache miss.
- Use this source code when you need to understand how a package works internally, not just its types/interface.

## Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```
npm run opensrc -- fetch <package>        # npm package        (e.g., npm run opensrc -- fetch zod)
npm run opensrc -- fetch pypi:<package>   # Python package     (e.g., npm run opensrc -- fetch pypi:requests)
npm run opensrc -- fetch crates:<package> # Rust crate         (e.g., npm run opensrc -- fetch crates:serde)
npm run opensrc -- fetch <owner>/<repo>   # GitHub repository  (e.g., npm run opensrc -- fetch jdforsythe/forge)
```
