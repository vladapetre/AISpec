# Agent Workflow

This file is the **shared contract surface**: every rule here is one that named teammates act on, and agent files, mode files, asset YAMLs, skills, and hooks resolve pointers into its `## Section` anchors by exact name. Never rename or delete a section without re-pointing its references.

Team-lead-only rules — Team Setup, the Agent registry / spawn table, and Agent Communication / relay discipline — live in `.claude/agents/assets/instructions/lead/orchestration.md`, injected into the main session at `SessionStart`. Teammates have no `TeamCreate` or `Agent` tool, so they must not carry it.

## Agent lifecycle — continue, don't respawn

An idle teammate is not a dead teammate: a named agent that ended its turn resumes by name with its context intact. Entry-turn reads (memory, plan, ADR, templates, source familiarity) are paid **once per task** — every respawn pays them again for nothing. Default lifecycle per agent:

- **developer** — ONE instance per plan. Every phase, approval relay, rejection, and reviewer verdict is a continuation turn of that instance. Respawn only on context loss (session died) or a new plan.
- **reviewer** — ONE instance per plan. The cross-check, any checkpoint, re-reviews, and the cumulative pass are continuation turns: the ADR/plan are read once, and a re-review after `CHANGES REQUIRED` has its own prior findings in context. Independence is not compromised — the reviewer verifies the developer's code and the artifacts, never its own prior verdicts.
- **architect** — Design mode spawns fresh per request (clean framing). Amendments to a plan whose architect instance is still resumable continue that instance (the ADR is in context); otherwise spawn fresh — Amendment mode's surgical-context rule bounds the reads either way.
- **analyst** — fresh per source set; delta reports against a source set it already ingested continue the existing instance.
- **consultant** — a discussion thread is one instance; ratification of a direction it discussed continues that instance into Artifact mode.

**Continuation turns never re-read unchanged material** — memory, templates, the plan, the ADR, or previously read source files are already in context. Re-read exactly what changed: the amended plan section after an amendment, `plan-status.mjs check` output after a stamp, the new diff for a re-review. **Exception — files about to be edited:** the developer's per-phase rule "read every file you will touch" is NOT waived by continuation. In-context memory of a file is a belief, not the file; anything may have changed it between phases. Re-reading the touch set is cheap and is the only defense against out-of-band edits.

**Fresh eyes on stall.** Continuation trades a respawn's re-ingestion cost for the author's context — usually the right trade, but the author's context includes the author's *anchoring*. When a phase hits the 3-rejection stall bound (`## Phase N Stalled`), the team lead SHOULD offer respawning a fresh developer instance for the retry alongside the user decision — an instance that hasn't spent three attempts defending one reading is the cheapest way to break the pattern. The per-plan progress file carries the durable state a fresh instance needs.

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

## Agent memory layout

Every named teammate persists memory under `.claude/agent-memory/<agent>/`. The layout is uniform:

- `MEMORY.md` — the agent's **index**. Always present (lazily created on the first write). Carries one-line entries per topic / decision / plan / artifact with a pointer to the per-entity file when one exists.
- `<entity>-<short-title>.md` — optional **per-entity files** when an agent has rich state to keep beyond a one-liner (developer: `plan-<short-title>.md`; analyst: `report-<short-title>.md` only if a long-form follow-up is needed). File naming uses the same short-title the artifact uses, so `git log` and search join cleanly across `artifacts/` and `agent-memory/`.

Rules:
- `MEMORY.md` is the only mandatory file. Per-entity files are optional and reference-by-name from `MEMORY.md`.
- Never write the same fact in two places. The per-entity file holds the detail; `MEMORY.md` carries the pointer.
- Short-titles match the host artifact's short-title verbatim — no aliasing.
- **Index-entry cap:** a `MEMORY.md` entry is ≤2 lines and ≤50 words — a hook, not a summary. Overflow goes to the per-entity file (create it if needed); detail already recorded in an artifact is a pointer, never a restatement.
- **Registered file kinds only:** an agent writes `MEMORY.md`, per-entity files (`plan-*`, `adr-*`, `report-*`, `review-*`, `sdr-*`, `charter-*`), and optionally `lessons.md`. No other files. `lessons.md` holds one line per lesson and only *reusable rules* (a fact that will change a future decision) — never history, never a second copy of the index.
- **Compaction protocol:** on an entry turn, if `MEMORY.md` exceeds 150 lines, compact before starting work — entries for closed/superseded plans and shipped ADRs collapse to one line; anything whose detail lives in an artifact loses the inline detail and keeps the pointer. Note `memory compacted <date>` at the top.

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

Directories not in this table are not written by any agent — a new artifact kind gets a row here first.

Exceptions:
- The developer may edit a plan file in `artifacts/plans/` solely to insert `**Status: Complete**` after a phase's `<!-- status:phase-N -->` anchor once the user has approved the phase (via `plan-status.mjs stamp`).
- The team lead may insert/remove a single `**Spec: ON HOLD — <reason>, <date>**` line beneath a plan's title per `## Spec volatility`.

The analyst writes reports and API documentation directly (no routing). All other owned artifacts go through their owning agent.

## Cross-Check (Pre-Implementation)

**The architect never self-certifies a fresh ADR/plan pair into implementation** (MAST R10 — a producer does not verify its own work into the next stage). By default `architect` (Design mode) runs its A13 five-check self-verification *and then* emits `CROSS_CHECK_REQUESTED: <plan-path>` with a one-line reason. Route to `reviewer` (Cross-check mode); wait for `ALIGNED` or `DRIFT DETECTED`. On `DRIFT DETECTED`, route back to `architect` (the request now carries `ARCHITECT AMENDMENT NEEDED:` — Amendment mode dispatches automatically). On `ALIGNED`, the plan goes to the developer for Phase 1.

**Self-certify carve-out.** `architect` may skip the reviewer cross-check and emit `SELF_CHECKED` on the summary line ONLY when the plan is both trivial and low-risk — *all* of: no phase has >3 acceptance criteria; no phase touches a path in `## Security paths`; the ADR cites ≥2 driver findings; no binding-constraint tie fired at A5. If any one fails, cross-check is mandatory. This is the inverse of the old default — escalation is now the rule, self-certification the exception.

The cross-check is a read-only artifact↔artifact pass per ADR/plan pair, before Phase 1. Between-phase work uses the per-phase flow below.

**Post-amendment re-checks are delta-scoped.** When a supersession ADR (`-r<N>`) follows a prior `ALIGNED` for the same pair, the reviewer scopes the pass to the amendment's revised decisions, delta consequences, and edited plan phase(s) only (reviewer CC-2) — never a fresh full pass. The architect's Amendment mode may waive the re-check entirely with `SELF_CHECKED (delta)` when the amendment is user-directed, semantics-preserving, revises ≤2 decisions, and touches no `## Security paths` (M5a). Reviewer-driven drift always re-checks. `CODE_DRIFT` amendments change no artifact and need no re-check.

## Implementation Review

**Between phases: user approval, plus checkpoints on long plans.** After each phase the developer emits its `## Phase N Complete` summary — carrying the `**Verification:**` evidence field from the `implement.md` step 7a verification loop, since tests alone don't gate a phase — and waits for the user's `approved` reply. The user is the gate on every phase advancement. The reviewer is not invoked between *ordinary* phases, only at the checkpoints defined next.

**Mid-plan checkpoints.** So design drift cannot compound unseen across many phases, the developer routes an automatic per-phase reviewer pass (reviewer Per-phase mode — diff-size gated, so small phases stay cheap) *after* the user approves a phase and *before* advancing, whenever any of these hold:
- (a) the plan has ≥6 phases AND this is the ⌈N/2⌉-th approved phase (once per plan, at the midpoint);
- (b) the phase summary lists `[IRREVERSIBLE] steps executed`;
- (c) the phase touched a path under `## Security paths`.

On `CHANGES REQUIRED`, route findings to the developer and clear them before the next phase; on `ARCHITECT AMENDMENT NEEDED:`, route to the architect first. Plans with <6 phases and no irreversible/security phase keep the user-approval-only flow and the single end-of-plan cumulative pass. The checkpoint never replaces the end-of-plan cumulative review.

**At end-of-plan: one cumulative reviewer pass.** After the final phase is approved, the developer emits `## All Phases Complete` covering the full plan (every phase, full commit range, union of changed files) and routes it to `reviewer`. The reviewer (Per-phase mode, cumulative branch) runs one adversarial review across the entire branch diff and emits a single `APPROVED` or `CHANGES REQUIRED`.

**Model tiering.** Frontmatter defaults hold unless a listed override applies. The team lead overrides at spawn time only for the mechanical slice of a role:

| Agent | Default | Override to | When |
|---|---|---|---|
| `reviewer` | `sonnet` | `haiku` | ≤3 changed files AND no `[IRREVERSIBLE] steps executed` AND no `## Security paths` file. Anything else keeps `sonnet`. |
| `architect` | `opus` | `sonnet` | Amendment mode, trigger is user-directed or expected `CODE_DRIFT`. Keep `opus` when the amendment must produce new design content against a reviewer drift flag. |
| `analyst` | `opus` | `sonnet` | Ticket pulls, JQL searches, ticket drafting, delta reports against an existing report. Keep `opus` for fresh ingestion of code/docs/data. |

The architect classification is a spawn-time guess (M2 decides for real, inside the run). A wrong guess is harmless — the mode runs identically on either tier, so guess cheap.

The cumulative review includes the ADR-alignment check and may emit `ARCHITECT AMENDMENT NEEDED: <reason>` on design-level drift. Route to `architect` immediately (its mode dispatch will pick Amendment mode). On `CHANGES REQUIRED`, route findings to the developer; the developer addresses them and re-routes a fresh `## All Phases Complete` summary until `APPROVED` clears.

**Amendments use supersession, not in-place edits.** `architect` (Amendment mode) writes a new tiny ADR at `artifacts/adr/NNNNM-<short-title>-r<N>.md` carrying only revised decisions and delta consequences; the original is stamped with one `**Superseded by:**` line beneath its title and otherwise frozen. The mode's surgical-context rule bounds its reads (see `amendment.md`).

**Revision budget — deltas stop at r2.** The third amendment against the same ADR does not append `-r3`; it **consolidates** (amendment.md M2b/M3b): one re-issued full ADR at the next free top-level number, folding the chain, `**Consolidates:**` stamped, every superseded file stamped, the plan's `**Governing ADR:**` repointed, `D-###` numbers preserved. Deltas are cheap to write and expensive to read, and the cost lands on every later reader: one chain reached **r10**, so knowing the design meant folding eleven files by hand. Consolidation pays that fold once. `CODE_DRIFT` never counts toward the budget.

**Ad-hoc per-phase review.** The reviewer's `## Phase N Complete` mode remains available when the user explicitly requests review of a single phase (security-sensitive change, long-running plan where mid-stream feedback is wanted). Default flow is end-of-plan only.

## Spec volatility (hold-and-batch)

Two things go volatile mid-plan, and **neither is absorbed one ruling at a time** — each ruling would otherwise cost a full amendment (+ often a re-check) round, and one supersession ADR per ruling is how a design ends up spread across eleven files. The signal for both is the same: the *second* change request against the same plan while a first is still being absorbed.

**Source A — the spec is renegotiated externally** (Jira ticket amended mid-plan, PO rulings pending, the user announces the requirements are moving). Phases must not proceed, because the target itself is moving:

1. The team lead inserts one line beneath the plan's title: `**Spec: ON HOLD — <reason>, <YYYY-MM-DD>**` (this stamp is the team lead's only legal plan edit — see Artifact Ownership).
2. While the stamp is present, the developer's pre-flight marks `Inputs ⚠` and asks — no phase is implemented against a held plan. Completed phases stay completed.
3. Deltas accumulate; when the spec settles, route **one** analyst delta report (what changed vs the framing report/ADR) and **one** architect amendment absorbing all of it, then remove the stamp.

**Source B — the user rules on design shape against a live plan** ("merge those two ports", "make it injectable", "that static class is fluff", "the caller owns the transaction", "move the folder"). These are semantics-preserving structural directives, they arrive at phase gates and after close, and they **cluster** — so unlike Source A they do not stop the plan, and they get a queue rather than a stamp:

1. The team lead **acknowledges and records** the ruling. It does **not** route `ARCHITECT AMENDMENT NEEDED:` on the spot.
2. Work continues, with one exception: if the ruling changes the shape of the phase about to start, that phase waits for the batch to flush.
3. Flush the queue — routing **one** amendment carrying every queued ruling as a numbered list — at the first of: the user says to proceed / asks for the amendment; the next phase cannot start without a queued ruling absorbed; the developer needs a queued decision to implement; or the plan reaches `## All Phases Complete`.
4. One flush is **one** supersession ADR covering the whole batch, not one per ruling.

A ruling that is *not* semantics-preserving (it changes behaviour, a contract surface, or an acceptance criterion) is Source A, not Source B: stamp and hold.

Measured motivation: of 35 supersession revisions across the six longest chains, ~50% were user structural rulings, and they arrived in same-day clusters (one chain took three separate supersession ADRs in a single afternoon, the third explicitly a "follow-up" on the second).

## Agent base constraints

These apply to every named teammate. Each agent's `<operating_constraints>` lists only its agent-specific deltas — do not restate the rules below.

- **Named teammate.** No `Agent` tool. All hand-offs through the team lead. Surface questions for other agents in the output; never message them directly.
- **Bash is read-only by default**: `git log/blame/show/diff/status`, `rg`, `wc`, `npm view`, `pip show`. Any mutating command must be surfaced for routing. The developer's pre-existing-failure stash dance (`git stash --include-untracked && <test> && git stash pop`) is the only standing exception.
- **Write paths are agent-scoped.** Each agent's `<operating_constraints>` names its allowed write roots; nothing else is writable.
- **Skills come to you two ways.** A skill named in your `skills:` frontmatter — marked *(auto-loaded)* in your constraints — has its **full SKILL.md body already injected into your context at spawn**. Never re-load it; treat it as standing instructions you have already read. A skill marked *(deferred)* is **not** in your context: no agent has the `Skill` tool, so load it by reading `.claude/skills/<name>/SKILL.md` at the step that needs it. Bundled `templates/`, `references/`, and `examples/` files are never preloaded either way — read them on demand.

## Security paths

Paths whose changes always load `patterns.md` in full (Se1–Se3), bypass small-gate skipping in the reviewer's diff-size gate (Per-phase mode), and qualify as the surgical-context full-file exception in the architect's Amendment mode.

- `src/auth/`
- `src/crypto/`
- `src/security/`
- `Authentication/`
- `Authorization/`

Projects extend this list by appending paths below — the architect (Amendment mode), the reviewer (Per-phase mode), and `reviewing/SKILL.md` all read this block.

## Compliance signal

The architect (step A5, Design mode) and consultant (step A6, Artifact mode) score the `compliance` binding constraint as **Medium** when any of the following is present:

- GDPR, HIPAA, SOC2, or PCI named in the request, CLAUDE.md, or a referenced artifact.
- An environment variable matching `COMPLIANCE_*` set in the project's deployment manifests (`.env*`, `docker-compose*.yml`, helm/values, CI workflows).
- A regulatory directive appended to this block by the project.

## Project facts

Operational facts about the host project that every agent needs and none should rediscover — nested-repo layout ("`src/Rent` is its own git repo; run git `-C` there"), test conventions ("pipeline-only tests", fixed ports, shared dev DB), tool quirks, build entry points. Projects append facts below as one-liners.

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
