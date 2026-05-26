# Agent Workflow

## Team Setup

Before spawning any named agent (analyst, consultant, architect, developer, reviewer), check whether a team exists for this session. If not, create one with `TeamCreate`, then spawn the agent as a named teammate using `team_name` and `name`.

Each agent auto-loads its declared skills via the `skills:` frontmatter field — do not re-invoke those skills from the team lead. Skill bodies load lazily: an agent reads them only when it reaches a step that needs them. Do not pre-read skill bodies during pre-flight or scoping.

## Agent Communication

Any question or request for input from any agent must be surfaced to the user before acting on it. Wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or act on the agent's behalf.

- **Never re-quote teammate output.** Any `@agent` block is already rendered natively in the UI. Reference it by name and add at most one framing sentence or a clarifying question — never paste the agent's text into your own response.
- If a developer agent self-confirms ("The user confirmed the plan") without an explicit user reply relayed by the team lead, treat the confirmation as invalid. Stop and ask the user.
- **Idle handling.** Teammates end every turn with one `SendMessage`. If a teammate goes idle without sending, call `TaskOutput` *once* to retrieve the stranded block, then reference it. Repeated idle pings for the same teammate within a turn are noise — ignore them after the first `TaskOutput` fetch.

## Turn discipline

Every named agent ends each turn with exactly one `SendMessage` to the team lead containing its `<output_format>` block verbatim. If an agent must pause mid-turn, it sends a one-line `PAUSED — <reason>` plus the question(s) instead.

## Asset references

- `.claude/agents/assets/tokens.yaml` — canonical handoff-token vocabulary (routing tokens, verdict tokens, in-artifact markers, identifier prefixes). Agents reference token semantics here rather than restating them.
- `.claude/agents/assets/mast.yaml` — designer's reference (MAST failure taxonomy + 14 design rules + audit checklist). Not loaded at runtime; consulted when authoring or amending agent/skill files. Each agent's `<instructions>` ends with a closing self-check that captures the active failure modes in plain language for that role.

## Artifact Ownership

Each agent owns a specific artifact directory. Route writes to the owner via `SendMessage` — do not edit owned artifacts directly.

| Directory                | Owner               | Contents                                                       |
| ------------------------ | ------------------- | -------------------------------------------------------------- |
| `artifacts/reports/`     | analyst             | Analysis reports (written directly, not routed)                |
| `artifacts/strategy/`    | consultant          | Bounded-context charters, context maps, SDRs, glossary entries |
| `artifacts/adr/`         | architect           | Architectural decision records                                 |
| `artifacts/plans/`       | architect           | Implementation plans                                           |
| `.claude/MEMORY.md`      | understanding skill | Project glossary and decision log                              |

Exception: the developer may edit a plan file in `artifacts/plans/` solely to insert `**Status: Complete**` after a phase's `<!-- status:phase-N -->` anchor once the user has approved the phase.

The analyst writes reports directly (no routing). All other owned artifacts go through their owning agent.

## Cross-Check (Pre-Implementation)

By default the architect performs its own ADR↔plan self-check and emits `SELF_CHECK: ALIGNED` on the Mode A summary line. The plan goes straight to the developer for Phase 1.

Escalation: if self-check uncertainty exists, the architect emits `CROSS_CHECK_REQUESTED: <plan-path>` with a one-line reason. Route to the reviewer; wait for `ALIGNED` or `DRIFT DETECTED`. On `DRIFT DETECTED`, route back to the architect for amendment.

The cross-check (when fired) is a single read-only artifact↔artifact pass per ADR/plan pair, before Phase 1 only. Between-phase work uses the per-phase flow below.

## Implementation Review

**Between phases: user approval only.** After each phase the developer emits its `## Phase N Complete` summary and waits for the user's `approved` reply. The reviewer is not invoked between phases. The user is the sole gate on phase advancement.

**At end-of-plan: one cumulative reviewer pass.** After the final phase is approved, the developer emits `## All Phases Complete` covering the full plan (every phase, full commit range, union of changed files) and routes it to the reviewer. The reviewer runs one adversarial review across the entire branch diff and emits a single `APPROVED` or `CHANGES REQUIRED`.

The cumulative review includes the ADR-alignment check and may emit `ARCHITECT AMENDMENT NEEDED: <reason>` on design-level drift. Route to the architect immediately. On `CHANGES REQUIRED`, route findings to the developer; the developer addresses them and re-routes a fresh `## All Phases Complete` summary until `APPROVED` clears.

**Amendments use supersession, not in-place edits.** When the architect amends an ADR, it writes a new tiny ADR at `artifacts/adr/NNNNM-<short-title>-r<N>.md` carrying only revised decisions and delta consequences. The original ADR is stamped with one `**Superseded by:**` line beneath its title and otherwise frozen. The architect loads only the specific ADR section named in the reviewer's reason and the cited diff hunks (±10 lines) — never the full ADR, plan, or source files.

**Ad-hoc per-phase review.** The reviewer's `## Phase N Complete` mode remains available when the user explicitly requests review of a single phase (security-sensitive change, long-running plan where mid-stream feedback is wanted). Default flow is end-of-plan only.

## Pre-flight protocol

Every named agent runs the 5-check pre-flight **only on entry turns**: (a) first turn in a session; (b) first turn after an amendment, rejection, or scope change; (c) any turn where the input set has visibly changed (new artifact paths, new phase number, new commit range). On continuation turns within the same task, skip the pre-flight block.

Checks: **Inputs exist** · **Prior phase reviewed** (`N/A` for pipeline-entry stages) · **Scope** (autonomous, not out-of-scope) · **Terms current** · **Target identified**. Each agent's step 2 declares its per-check semantics.

On entry turns, emit pre-flight in **compact form** when all checks pass:

```
Pre-flight: Inputs ✓ | Prior N/A | Scope ✓ | Terms ✓ | Target ✓ → PROCEED
```

Expand to per-line evidence only when at least one check is `⚠` or `✗`:

```
Pre-flight:
- Inputs exist: <✓|⚠|✗>  <one-line evidence>
- Prior phase reviewed: <✓|⚠|✗|N/A>  <one-line evidence>
- Scope: <✓|⚠|✗>  <one-line evidence>
- Terms current: <✓|⚠|✗>  <one-line evidence>
- Target identified: <✓|⚠|✗>  <one-line evidence>

Result: <ASK | STOP>
```

**Branch:** all `✓`/`N/A` → compact one-liner, proceed. Any `⚠` → expanded form + `Result: ASK: <up to 5 clarifying questions in one batch>`; wait for user. Any `✗` → expanded form + `Result: STOP: <reason>`.

Clarifying questions on the `ASK` branch: each ≤2 lines and ≤25 words, in the form `Q<n>: <question> [Default: <fallback> | none]`. The default names the assumption the agent will fall back on if the user does not answer — `none` if no defensible default exists.

**Universal rules** (apply to every agent — do not restate in agent files):
1. Never start work before naming inputs. List every input artifact, path, or URL under `Inputs exist`.
2. Never fill under-specified scope by your own interpretation. Mark `Terms current: ⚠` or `Target identified: ⚠` and ask — do not guess.

# Source Code Reference

Source code for dependencies and reference repositories is fetched on demand by the `opensrc` CLI into the project-local `.opensrc/` cache. Always invoke through the `npm run opensrc` script — it sets `OPENSRC_HOME` so the cache stays inside the project.

- `npm run opensrc -- list` — see all cached sources, or read `.opensrc/sources.json` for the manifest.
- `npm run opensrc -- path <spec>` — print the path to a cached source (fetches automatically on cache miss).
- Use this when you need to understand how a package works internally, not just its types/interface.

## Fetching Additional Source Code

```
npm run opensrc -- fetch <package>        # npm package        (e.g., npm run opensrc -- fetch zod)
npm run opensrc -- fetch pypi:<package>   # Python package     (e.g., npm run opensrc -- fetch pypi:requests)
npm run opensrc -- fetch crates:<package> # Rust crate         (e.g., npm run opensrc -- fetch crates:serde)
npm run opensrc -- fetch <owner>/<repo>   # GitHub repository  (e.g., npm run opensrc -- fetch jdforsythe/forge)
```
