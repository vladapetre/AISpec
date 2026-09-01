# Agent Workflow

This file is the **shared contract surface**: every rule here is one that named teammates act on, and agent files, mode files, asset YAMLs, skills, and hooks resolve pointers into its `## Section` anchors by exact name. Never rename or delete a section without re-pointing its references.

**Admission test — what may live here.** This file is loaded into every session and every teammate spawn, whether or not the rule applies. A rule earns its place only if **both** hold:

1. **Not derivable** — it cannot be read off the repo, and it is not already stated in an asset file, mode file, skill, or hook that its actor loads anyway. A rule restated here *and* in `preflight.yaml`/`selfcheck.yaml`/a mode file is one copy too many, and the two copies will drift.
2. **Load-bearing for more than one actor** — a rule only the architect acts on belongs in the architect's mode file; a rule only the team lead acts on belongs in `instructions/lead/orchestration.md`; a rule the hooks enforce mechanically needs at most a pointer here, not its own restatement.

Everything else goes to the actor that uses it and is *referenced* from here by anchor. Sections carry the decision tables and shared vocabulary; procedure lives with its owner. Adding a section is the last resort, not the default — the honest cost of a rule here is paid on every turn of every session by every agent, including the ones it does not apply to.

Team-lead-only rules — Team Setup, the Agent registry / spawn table, model tiering at spawn, and Agent Communication / relay discipline — live in `.claude/agents/assets/instructions/lead/orchestration.md`, injected into the main session at `SessionStart`. Teammates have no `TeamCreate` or `Agent` tool, so they must not carry it.

## Agent lifecycle — continue, don't respawn

An idle teammate is not a dead teammate: a named agent that ended its turn resumes by name with its context intact, so entry-turn reads (memory, plan, ADR, templates, source familiarity) are paid **once per task**. Which instance handles which request is a spawn decision, and only the team lead can make it — the per-agent lifecycle table and the fresh-eyes-on-stall rule live in `instructions/lead/orchestration.md`.

What every teammate acts on is the other half: **continuation turns never re-read unchanged material.** Memory, templates, the plan, the ADR, and previously read source files are already in context. Re-read exactly what changed — the amended plan section after an amendment, `plan-status.mjs check` output after a stamp, the new diff for a re-review. **Exception — files about to be edited:** the developer's per-phase rule "read every file you will touch" is NOT waived by continuation. In-context memory of a file is a belief, not the file; anything may have changed it between phases. Re-reading the touch set is cheap and is the only defense against out-of-band edits.

## Turn discipline

Every named agent ends each turn with exactly one `SendMessage` to the team lead containing its `<output_format>` block verbatim. If an agent must pause mid-turn, it sends a one-line `PAUSED — <reason>` plus the question(s) instead.

## Asset references

- `.claude/agents/assets/tokens.yaml` — index + quick-lookup for token vocabulary. Concrete entries live in three sibling files loaded on demand: `tokens.routing.yaml` (handoff), `tokens.verdicts.yaml` (gate decisions), `tokens.markers.yaml` (in-artifact + identifier prefixes). Agents reference token semantics there rather than restating them.
- `.claude/agents/assets/preflight.yaml` — per-agent pre-flight semantics registry. Agents reference their entry by `#<agent>` or `#<agent>-<mode>` instead of restating per-check semantics.
- `.claude/agents/assets/instructions/<agent>/<mode>.md` — mode-specific instructions, output formats, and per-mode token contracts for multi-mode agents (architect, consultant, reviewer). The shell agent file loads exactly one of these at step 2. **Exception:** `instructions/lead/orchestration.md` has no shell and no dispatch — the team lead has no agent file, so `inject.orchestration.mjs` injects it at `SessionStart` instead. It is the one file in this tree that is always-on rather than loaded on demand.
- `.claude/agents/assets/scoring.yaml` — binding-constraint scoring rubrics for `architect` Design mode (A5) and `consultant` Artifact mode (A6). Loaded on demand at the scoring step.
- `.claude/agents/assets/detectors.yaml` — test/lint detection cascade for the developer. Loaded on demand at step 7.
- `.claude/agents/assets/selfcheck.yaml` — closing self-check registry. Each agent's `<instructions>` ends with one line referencing its keys (`#_universal` + `#<agent>` + `#<agent>-<mode>` where applicable). Loaded at the closing self-check step.
- `.claude/agents/assets/mast.yaml` — designer's reference (MAST failure taxonomy + 14 design rules + audit checklist). Not loaded at runtime; consulted when authoring or amending agent/skill files. The runtime self-check boxes live in `selfcheck.yaml`; each box names its MAST FM code.
- `.claude/skills/` — seven skills, each a `SKILL.md` plus bundled templates/examples read on demand. **Auto-loaded** (full body injected at spawn, per the agent's `skills:` frontmatter): `documenting` → analyst, architect, consultant, developer; `reviewing` → reviewer; `branching` → developer. **Deferred** (read at the step that needs them): `understanding`, `ticketing`, `proofreading` (no agent carries it today; user-invoked via `/proofreading`, and model-invocable when a document is headed outside the team). **User-invoked only:** `summarizing` (`/summarizing`; `disable-model-invocation`, so no agent reaches it). A skill absent from this line is unreachable by contract — register it here when adding one.
- `node .claude/hooks/lint.contract.mjs` — verifies the pointers in this file and across every layer still resolve (asset `#key` refs, `## Section` anchors, token registry parity, mode/pre-flight/self-check parity, referenced paths). Run it after moving a rule between layers. Maintainer's tool, not loaded at runtime.

## Agent memory layout

Every named teammate persists memory under `.claude/agent-memory/<agent>/`. The layout is uniform:

- `MEMORY.md` — the agent's **index**. Always present (lazily created on the first write). Carries one-line entries per topic / decision / plan / artifact with a pointer to the per-entity file when one exists.
- `<entity>-<short-title>.md` — optional **per-entity files** when an agent has rich state to keep beyond a one-liner (developer: `plan-<short-title>.md`; analyst: `report-<short-title>.md` only if a long-form follow-up is needed). File naming uses the same short-title the artifact uses, so `git log` and search join cleanly across `artifacts/` and `agent-memory/`.

Rules:
- `MEMORY.md` is the only mandatory file; per-entity files are optional and referenced by name from it. Short-titles match the host artifact's verbatim — no aliasing.
- Never write the same fact twice: the per-entity file holds the detail and `MEMORY.md` the pointer, and a fact already recorded in an artifact gets a pointer rather than a restatement.
- **Caps and file kinds are hook-enforced** — `guard.write` blocks the write, `lint.write` bounces the turn, and `hooks/lib/ownership.mjs` is the registry both read, so it is the copy that must agree with this list. An index entry is ≤2 lines and ≤50 words (a hook, not a summary). The only legal files are `MEMORY.md`, `lessons.md`, and per-entity `plan-*`, `adr-*`, `report-*`, `review-*`, `sdr-*`, `charter-*`, `context-map-*` — no others, no subdirectories. `lessons.md` carries one line per *reusable rule* (a fact that will change a future decision), never history and never a second index.
- **Compaction:** a `MEMORY.md` over 150 lines is compacted on the next entry turn, before work starts — closed or superseded plans and shipped ADRs collapse to one line, and anything whose detail lives in an artifact keeps only the pointer. Note `memory compacted <date>` at the top.

`.claude/MEMORY.md` at project root is the **shared** glossary and decision log owned by the `understanding` skill — separate from per-agent memory.

## Artifact Ownership

Each agent owns a specific artifact directory. Route writes to the owner via `SendMessage` — do not edit owned artifacts directly.

| Directory                | Owner               | Contents                                                       |
| ------------------------ | ------------------- | -------------------------------------------------------------- |
| `artifacts/reports/`     | analyst             | Analysis reports (written directly, not routed)                |
| `artifacts/api/`         | analyst             | REST API documentation (written directly; `documenting` `templates/api.md`) |
| `artifacts/inbound/`     | analyst             | Raw received specs / handoffs, verbatim — ingestion sources, never edited after landing |
| `artifacts/strategy/`    | consultant (Artifact mode) | Bounded-context charters, context maps, SDRs, glossary entries |
| `artifacts/adr/`         | architect            | Architectural decision records (supersession ADRs come from Amendment mode; scope changes live in the supersession's `**Trigger:**` line — no separate scope-change files) |
| `artifacts/plans/`       | architect            | Implementation plans (Amendment mode may edit a future phase + Governing ADR pointer) |
| `artifacts/sql/`         | developer           | Verification / diagnostic queries produced during phases (read-only against the DB) |
| `.claude/MEMORY.md`      | understanding skill | Project glossary and decision log                              |
| `.claude/PROJECT-MAP.md` | analyst             | Where things live: repo/solution layout, module-to-folder map, test/config/DI/migration locations, path conventions (see `## Project facts`) |

Directories not in this table are not written by any agent — a new artifact kind gets a row here first.

Exceptions:
- The developer may edit a plan file in `artifacts/plans/` solely to insert `**Status: Complete**` after a phase's `<!-- status:phase-N -->` anchor once the user has approved the phase (via `plan-status.mjs stamp`).
- The team lead may insert/remove a single `**Spec: ON HOLD — <reason>, <date>**` line beneath a plan's title per `## Spec volatility`.

The analyst writes reports and API documentation directly (no routing). All other owned artifacts go through their owning agent.

## Cross-Check (Pre-Implementation)

**The architect never self-certifies a fresh ADR/plan pair into implementation** (MAST R10 — a producer does not verify its own work into the next stage). By default `architect` (Design mode) runs its A13 five-check self-verification *and then* emits `CROSS_CHECK_REQUESTED: <plan-path>` with a one-line reason. Route to `reviewer` (Cross-check mode); wait for `ALIGNED` or `DRIFT DETECTED`. On `DRIFT DETECTED`, route back to `architect` (the request now carries `ARCHITECT AMENDMENT NEEDED:` — Amendment mode dispatches automatically). On `ALIGNED`, the plan goes to the developer for Phase 1.

**Self-certify carve-out.** `architect` may skip the pass and emit `SELF_CHECKED` instead, but only for a plan that is both trivial and low-risk. Escalation is the rule, self-certification the exception; the four conditions that must *all* hold are the architect's to evaluate and live in `design.md` A13.

The cross-check is a read-only artifact↔artifact pass per ADR/plan pair, before Phase 1. Between-phase work uses the per-phase flow below.

**Post-amendment re-checks are delta-scoped**, never a fresh full pass: the reviewer scopes to the amendment's revised decisions, delta consequences, and edited phase(s) (CC-2), and Amendment mode may waive the re-check entirely with `SELF_CHECKED (delta)` under its own four conditions (M5a). Reviewer-driven drift always re-checks; `CODE_DRIFT` changes no artifact and needs no re-check. Repeated `DRIFT DETECTED` on one plan is bounded — see `## Cycle bounds`.

## Implementation Review

**Between phases: user approval, plus checkpoints on long plans.** After each phase the developer emits its `## Phase N Complete` summary — carrying the `**Verification:**` evidence field from the `implement.md` step 7a verification loop, since tests alone don't gate a phase — and waits for the user's `approved` reply. The user is the gate on every phase advancement. The reviewer is not invoked between *ordinary* phases, only at the checkpoints defined next.

**Mid-plan checkpoints.** So design drift cannot compound unseen across many phases, some approved phases route an automatic reviewer pass (Per-phase mode — diff-size gated, so small phases stay cheap) before the developer advances. The triggering conditions — plan midpoint, irreversible steps, security-path touch — are the developer's to evaluate and live in `implement.md` step 11. A checkpoint never replaces the end-of-plan cumulative review, and a plan that trips none keeps the user-approval-only flow.

**At end-of-plan: one cumulative reviewer pass.** After the final phase is approved, the developer emits `## All Phases Complete` covering the full plan (every phase, full commit range, union of changed files) and routes it to `reviewer`. The reviewer (Per-phase mode, cumulative branch) runs one adversarial review across the entire branch diff and emits a single `APPROVED` or `CHANGES REQUIRED`.

Model tiering at spawn is the team lead's alone (`instructions/lead/orchestration.md` — teammates cannot spawn and never act on it).

The cumulative review includes the ADR-alignment check and may emit `ARCHITECT AMENDMENT NEEDED: <reason>` on design-level drift. Route to `architect` immediately (its mode dispatch will pick Amendment mode). On `CHANGES REQUIRED`, route findings to the developer; the developer addresses them and re-routes a fresh `## All Phases Complete` summary until `APPROVED` clears — bounded at three rounds per `## Cycle bounds`.

**Amendments use supersession, not in-place edits.** `architect` (Amendment mode) writes a new tiny ADR at `artifacts/adr/NNNNM-<short-title>-r<N>.md` carrying only revised decisions and delta consequences; the original is stamped with one `**Superseded by:**` line beneath its title and otherwise frozen. The mode's surgical-context rule bounds its reads (see `amendment.md`).

**Revision budget — deltas stop at r2.** The third amendment against the same ADR does not append `-r3`; it **consolidates** (amendment.md M2b/M3b): one re-issued full ADR at the next free top-level number, folding the chain, `**Consolidates:**` stamped, every superseded file stamped, the plan's `**Governing ADR:**` repointed, `D-###` numbers preserved. Deltas are cheap to write and expensive to read, and the cost lands on every later reader: one chain reached **r10**, so knowing the design meant folding eleven files by hand. Consolidation pays that fold once. `CODE_DRIFT` never counts toward the budget.

**Ad-hoc per-phase review.** The reviewer's `## Phase N Complete` mode remains available when the user explicitly requests review of a single phase (security-sensitive change, long-running plan where mid-stream feedback is wanted). Default flow is end-of-plan only.

## Cycle bounds

Three gates can loop. Each has a bound, and reaching one is a **user decision**, never another automatic round.

| Loop | Counted by | Bound | On reaching it |
| --- | --- | --- | --- |
| Phase rejection (user / reviewer / architect → developer) | developer, per phase | 3 | `## Phase N Stalled` — developer stops with a diagnosis |
| End-of-plan cumulative review (`CHANGES REQUIRED` → fix → resubmit) | reviewer, `<plan>#cumulative` memory key | 3 | `CYCLE BOUND REACHED:` above the verdict; the verdict still renders |
| Cross-check ↔ amendment (`DRIFT DETECTED` → amendment → re-check) | reviewer, `<plan>#crosscheck` memory key | 3 | `CYCLE BOUND REACHED:` above the verdict; the verdict still renders |

The counts live in the reviewer's memory index, which it already writes each pass — no separate bookkeeping to fall out of date. `CYCLE BOUND REACHED:` is orthogonal to the verdict, like `ARCHITECT AMENDMENT NEEDED:`. The architect's r3 consolidation (`amendment.md` M2b) is not a cycle bound: it changes the ADR's shape, it does not break the loop.

## Spec volatility (hold-and-batch)

Two things go volatile mid-plan, and **neither is absorbed one ruling at a time** — each ruling would otherwise cost a full amendment (+ often a re-check) round, and one supersession ADR per ruling is how a design ends up spread across eleven files. The signal for both is the same: the *second* change request against the same plan while a first is still being absorbed.

**Source A — the spec is renegotiated externally** (Jira ticket amended mid-plan, PO rulings pending, the user announces the requirements are moving). Phases must not proceed, because the target itself is moving:

1. The team lead inserts one line beneath the plan's title: `**Spec: ON HOLD — <reason>, <YYYY-MM-DD>**` (this stamp is the team lead's only legal plan edit — see Artifact Ownership).
2. While the stamp is present, the developer's pre-flight marks `Inputs ⚠` and asks — no phase is implemented against a held plan. Completed phases stay completed.
3. Deltas accumulate; when the spec settles, route **one** analyst delta report (what changed vs the framing report/ADR) and **one** architect amendment absorbing all of it, then remove the stamp.

**Source B — the user rules on design shape against a live plan** ("merge those two ports", "make it injectable", "the caller owns the transaction"). These are semantics-preserving structural directives, they arrive at phase gates and after close, and they **cluster** — so unlike Source A they do **not** stop the plan and there is no stamp. The team lead queues them and flushes the batch as ONE amendment; the queueing and flush rules are the lead's and live in `instructions/lead/orchestration.md`. What teammates need: work continues normally, and a phase waits only if a queued ruling changes the shape of the phase about to start.

A ruling that is *not* semantics-preserving (it changes behaviour, a contract surface, or an acceptance criterion) is Source A, not Source B: stamp and hold.

Measured motivation: of 35 supersession revisions across the six longest chains, ~50% were user structural rulings, and they arrived in same-day clusters (one chain took three separate supersession ADRs in a single afternoon, the third explicitly a "follow-up" on the second).

## Agent base constraints

These apply to every named teammate. Each agent's `<operating_constraints>` lists only its agent-specific deltas — do not restate the rules below.

- **Named teammate.** No `Agent` tool. All hand-offs through the team lead. Surface questions for other agents in the output; never message them directly.
- **Bash is read-only by default**: `git log/blame/show/diff/status`, `rg`, `wc`, `npm view`, `pip show`. Any mutating command must be surfaced for routing. The developer's pre-existing-failure stash dance (`git stash --include-untracked && <test> && git stash pop`) is the only standing exception.
- **Write paths are agent-scoped.** Each agent's `<operating_constraints>` names its allowed write roots; nothing else is writable.
- **Look-around is batched, never serial.** Issue every independent search, listing, and file read you can name *right now* in one tool block, then read the results together. One search per turn is the most expensive way to learn a codebase, since each hop costs a full model round trip. Ask three questions at once and you pay one round trip instead of three. This does not license guessing: it licenses asking wide.
- **Skills come to you two ways.** A skill named in your `skills:` frontmatter — marked *(auto-loaded)* in your constraints — has its **full SKILL.md body already injected into your context at spawn**. Never re-load it; treat it as standing instructions you have already read. A skill marked *(deferred)* is **not** in your context: no agent has the `Skill` tool, so load it by reading `.claude/skills/<name>/SKILL.md` at the step that needs it. Bundled `templates/`, `references/`, and `examples/` files are never preloaded either way — read them on demand.

## Security paths

Paths whose changes always load `patterns.md` in full (Se1–Se3), bypass small-gate skipping in the reviewer's diff-size gate (Per-phase mode), and qualify as the surgical-context full-file exception in the architect's Amendment mode.

- `src/auth/`
- `src/crypto/`
- `src/security/`
- `Authentication/`
- `Authorization/`

Projects extend this list by appending paths below — the architect (Amendment mode), the reviewer (Per-phase mode), and `reviewing/SKILL.md` all read this block.

## Project facts

Operational facts about the host project that every agent needs and none should rediscover — nested-repo layout ("`src/Rent` is its own git repo; run git `-C` there"), test conventions ("pipeline-only tests", fixed ports, shared dev DB), tool quirks, build entry points. Projects append facts below as one-liners.

**The project map.** `.claude/PROJECT-MAP.md`, when present, is the standing answer to "where does anything live": the repo and solution layout, the module or bounded-context to folder mapping, where tests, config, DI wiring and migrations sit, and the naming conventions that make a path guessable. **Every agent reads it on entry turns, before searching.** It exists because rediscovery is the single largest measured cost in this workflow, and a map that one agent writes once is a map every later agent reads for free.

It is the analyst's artifact (see `## Artifact Ownership`): ask for it when it is missing or stale, and route a refresh rather than editing it in place. It is a map, not documentation — paths, layout and conventions, capped at what a reader can hold, never per-file prose. A map that tries to describe behaviour goes stale in a week and gets ignored, which is worse than having none.

**Promotion rule.** When an agent records an *environmental* fact in its own memory (not a review/plan/analysis fact), the team lead promotes it to this block and the agent's copy becomes redundant. One discovery, all agents — an operational gotcha that lives in one agent's memory will be rediscovered by every other agent at full cost.

(none recorded yet)

## Hook enforcement layer

The hooks in `.claude/hooks/` (wired in `.claude/settings.json`) mechanically enforce contracts that used to be prompt-discipline: `guard.*` blocks, `lint.*` feeds violations back, `inject.*` adds context. **A blocked call or a bounced stop is the harness working, not an error to route around — fix the violation, don't retry variants.** The matching `selfcheck.yaml` boxes remain: the hook is the backstop, the self-check is the habit.

Per-hook registry, events, and standalone invocations: `.claude/hooks/README.md` (maintainer's reference, not loaded at runtime).

## Stale-snapshot rule

Any agent spawned mid-session inherits a CLAUDE.md snapshot captured at the *session's* start — after in-session edits to CLAUDE.md, that snapshot is stale. The same applies to every hook-injected document (`.claude/MEMORY.md`, `instructions/lead/orchestration.md`), which is read once at `SessionStart` and never refreshed.

Agents verifying contract claims MUST grade against the on-disk file, never the injected snapshot; a "CLAUDE.md lacks X" finding is invalid without a fresh disk read. (Discovered live: a multi-agent analysis run reported two critical contract conflicts that existed only in its stale snapshot.)

Corollary for the team lead: after editing CLAUDE.md or an injected document mid-session, either re-read the changed section before relying on it or note the edit when spawning, since your own copy is equally stale.

## Pre-flight protocol

Every named agent runs the 5-check pre-flight **only on entry turns**: (a) first turn in a session; (b) first turn after an amendment, rejection, or scope change; (c) any turn where the input set has visibly changed (new artifact paths, new phase number, new commit range). On continuation turns within the same task, skip the pre-flight block — and skip the entry-turn reads with it (`## Agent lifecycle`): memory, templates, and unchanged artifacts are already in context.

Checks: **Inputs exist** · **Prior phase reviewed** (`N/A` for pipeline-entry stages) · **Scope** (autonomous, not out-of-scope) · **Terms current** · **Target identified**.

**Branch:** all `✓`/`N/A` → compact one-liner, proceed. Any `⚠` → expanded form + `Result: ASK:` (batch the questions, wait for the user). Any `✗` → expanded form + `Result: STOP: <reason>`.

The exact compact/expanded line formats, the `ASK` question grammar, and each agent's per-check semantics all live in `assets/preflight.yaml` — which every agent already loads at step 2, so restating the formats here would be a second copy of a thing nobody reads twice.

**Universal rules** (apply to every agent — do not restate in agent files):
1. Never start work before naming inputs. List every input artifact, path, or URL under `Inputs exist`.
2. Never fill under-specified scope by your own interpretation. Mark `Terms current: ⚠` or `Target identified: ⚠` and ask — do not guess.

# Source Code Reference

To read a dependency's actual source — not just its types — use `npm run opensrc` (always via the script: it sets `OPENSRC_HOME` so the cache stays in the project's `.opensrc/`). `-- list` shows the cache, `-- path <spec>` prints a path and fetches on miss, `-- fetch <spec>` adds one. A spec is a bare npm name, `pypi:<pkg>`, `crates:<pkg>`, or `<owner>/<repo>`; `-- help` has the rest.
