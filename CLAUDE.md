# Agent Workflow

## Team Setup

Before spawning any named teammate, check whether a team exists for this session. If not, create one with `TeamCreate`, then spawn the agent as a named teammate using `team_name` and `name`.

**Skill loading.** A `skills:` frontmatter declaration loads the skill's *name and description only* into the agent's prompt — not its body. The agent reads the SKILL.md body (and any templates) on demand at the first step that needs it. The team lead never pre-reads skill bodies.

## Agent registry

The harness has five named teammates. The team lead spawns by role — each agent's own step-2 mode dispatch loads the matching mode file from `.claude/agents/assets/instructions/<agent>/<mode>.md`.

| Agent | Spawn when | Modes |
|---|---|---|
| `analyst` | A source needs ingestion before design (code, docs, URLs, data), OR a ticket must be pulled / created / updated on a ticketing platform (Jira). Pipeline entry; owns ticketing-platform interaction. | single mode |
| `architect` | Tactical design needed, OR request carries `ARCHITECT AMENDMENT NEEDED:` (reviewer drift flag, or team-lead-attached for a user/PO ruling changing an existing ADR). | `design` (default), `amendment` |
| `consultant` | Strategic question, write request, or inbound `[STRATEGIC REVIEW NEEDED]` / `[CONSULTANT REVIEW NEEDED]`. | `discussion` (default), `artifact` (explicit write / ratification) |
| `developer` | An approved plan and an unmarked phase exist. | `implement` (default), `rejection` (feedback path) |
| `reviewer` | Request contains `## Phase N Complete`, `## All Phases Complete`, `CROSS_CHECK_REQUESTED:`, or starts with `/cross-check`. | `perphase` (incl. cumulative), `crosscheck` |

Each multi-mode agent's `<instructions>` step 2 is a deterministic dispatch (regex on trigger tokens) that loads exactly one file under `assets/instructions/<agent>/`. The shell never carries mode-specific steps or output formats.

Per-check pre-flight semantics for every agent-mode pair live in `.claude/agents/assets/preflight.yaml` (keyed by `<agent>-<mode>` for multi-mode agents, by `<agent>` otherwise).

## Agent Communication

Any question or request for input from any agent must be surfaced to the user before acting on it. Wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or act on the agent's behalf.

- **Never re-quote teammate output.** Any `@agent` block is already rendered natively in the UI. Reference it by name and add at most one framing sentence or a clarifying question — never paste the agent's text into your own response.
- If a developer agent self-confirms ("The user confirmed the plan") without an explicit user reply relayed by the team lead, treat the confirmation as invalid. Stop and ask the user.
- **Idle handling.** Teammates end every turn with one `SendMessage`. If a teammate goes idle without sending, call `TaskOutput` *once* to retrieve the stranded block, then reference it. Repeated idle pings for the same teammate within a turn are noise — ignore them after the first `TaskOutput` fetch.

## Turn discipline

Every named agent ends each turn with exactly one `SendMessage` to the team lead containing its `<output_format>` block verbatim. If an agent must pause mid-turn, it sends a one-line `PAUSED — <reason>` plus the question(s) instead.

## Asset references

- `.claude/agents/assets/tokens.yaml` — index + quick-lookup for token vocabulary. Concrete entries live in three sibling files loaded on demand: `tokens.routing.yaml` (handoff), `tokens.verdicts.yaml` (gate decisions), `tokens.markers.yaml` (in-artifact + identifier prefixes). Agents reference token semantics there rather than restating them.
- `.claude/agents/assets/preflight.yaml` — per-agent pre-flight semantics registry. Agents reference their entry by `#<agent>` or `#<agent>-<mode>` instead of restating per-check semantics.
- `.claude/agents/assets/instructions/<agent>/<mode>.md` — mode-specific instructions, output formats, and per-mode token contracts for multi-mode agents (architect, consultant, reviewer). The shell agent file loads exactly one of these at step 2.
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

**Between phases: user approval, plus checkpoints on long plans.** After each phase the developer emits its `## Phase N Complete` summary and waits for the user's `approved` reply. The user is the gate on every phase advancement. The reviewer is not invoked between *ordinary* phases — only at the checkpoints defined next.

**Mid-plan checkpoints.** So design drift cannot compound unseen across many phases, the developer routes an automatic per-phase reviewer pass (reviewer Per-phase mode — diff-size gated, so small phases stay cheap) *after* the user approves a phase and *before* advancing, whenever any of these hold:
- (a) the plan has ≥6 phases AND this is the ⌈N/2⌉-th approved phase (once per plan, at the midpoint);
- (b) the phase summary lists `[IRREVERSIBLE] steps executed`;
- (c) the phase touched a path under `## Security paths`.

On `CHANGES REQUIRED`, route findings to the developer and clear them before the next phase; on `ARCHITECT AMENDMENT NEEDED:`, route to the architect first. Plans with <6 phases and no irreversible/security phase keep the user-approval-only flow and the single end-of-plan cumulative pass. The checkpoint never replaces the end-of-plan cumulative review.

**At end-of-plan: one cumulative reviewer pass.** After the final phase is approved, the developer emits `## All Phases Complete` covering the full plan (every phase, full commit range, union of changed files) and routes it to `reviewer`. The reviewer (Per-phase mode, cumulative branch) runs one adversarial review across the entire branch diff and emits a single `APPROVED` or `CHANGES REQUIRED`.

**Reviewer model tiering.** The reviewer's frontmatter default is `sonnet` — the adversarial gate, drift detection, and severity classification are judgment-heavy, and variance there is the most expensive kind. Reviewer passes are infrequent (≈ one cross-check + one cumulative review per plan), so the cost is bounded. The team lead MAY spawn the reviewer with a `haiku` model override only for a trivially small, low-risk change — the developer summary lists ≤3 changed files, no `[IRREVERSIBLE] steps executed`, and no file under `## Security paths`. Anything else uses the `sonnet` default.

**Architect and analyst tiering.** Frontmatter defaults stay `opus` (full designs and full ingestion reports earn it). The team lead spawns with a `sonnet` override for the mechanical slices of each role:
- `architect` Amendment mode when the trigger is user-directed or the expected classification is `CODE_DRIFT` — the surgical-context rule already bounds the work; keep `opus` when the amendment must produce new design content against a reviewer drift flag. (The classification is a spawn-time guess — it is only determined at M2, inside the run. A wrong guess is harmless: the mode runs identically on either tier, so guess cheap and accept occasional sonnet-quality supersessions rather than paying opus for every one-line reconcile.)
- `analyst` for ticket pulls, JQL searches, ticket drafting, and delta reports against an existing report — keep `opus` for fresh ingestion of code/docs/data.

The cumulative review includes the ADR-alignment check and may emit `ARCHITECT AMENDMENT NEEDED: <reason>` on design-level drift. Route to `architect` immediately (its mode dispatch will pick Amendment mode). On `CHANGES REQUIRED`, route findings to the developer; the developer addresses them and re-routes a fresh `## All Phases Complete` summary until `APPROVED` clears.

**Amendments use supersession, not in-place edits.** `architect` (Amendment mode) writes a new tiny ADR at `artifacts/adr/NNNNM-<short-title>-r<N>.md` carrying only revised decisions and delta consequences. The original ADR is stamped with one `**Superseded by:**` line beneath its title and otherwise frozen. Amendment mode loads only the specific ADR section named in the reviewer's reason and the cited diff hunks (±10 lines) — never the full ADR, plan, or source files.

**Ad-hoc per-phase review.** The reviewer's `## Phase N Complete` mode remains available when the user explicitly requests review of a single phase (security-sensitive change, long-running plan where mid-stream feedback is wanted). Default flow is end-of-plan only.

## Spec volatility (hold-and-batch)

When a plan's governing ticket or spec is being actively renegotiated (Jira ticket amended mid-plan, PO rulings pending, the user announces the requirements are moving), do NOT absorb the changes one ruling at a time — each ruling would otherwise cost a full amendment + re-check round.

1. The team lead inserts one line beneath the plan's title: `**Spec: ON HOLD — <reason>, <YYYY-MM-DD>**` (this stamp is the team lead's only legal plan edit — see Artifact Ownership).
2. While the stamp is present, the developer's pre-flight marks `Inputs ⚠` and asks — no phase is implemented against a held plan. Completed phases stay completed.
3. Deltas accumulate; when the spec settles, route **one** analyst delta report (what changed vs the framing report/ADR) and **one** architect amendment absorbing all of it, then remove the stamp.

The signal to hold is the *second* change request against the same plan while a first is still being absorbed.

## Agent base constraints

These apply to every named teammate (see Agent registry above). Each agent's `<operating_constraints>` lists only its agent-specific deltas — do not restate the rules below.

- **Named teammate.** No `Agent` tool. All hand-offs through the team lead. Surface questions for other agents in the output; never message them directly.
- **Bash is read-only by default**: `git log/blame/show/diff/status`, `rg`, `wc`, `npm view`, `pip show`. Any mutating command must be surfaced for routing. The developer's pre-existing-failure stash dance (`git stash --include-untracked && <test> && git stash pop`) is the only standing exception.
- **Write paths are agent-scoped.** Each agent's `<operating_constraints>` names its allowed write roots; nothing else is writable.
- **Skill bodies load lazily.** Auto-declared skills (`skills:` frontmatter) load their frontmatter only; templates and bodies load on demand at the step that needs them.

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

The hooks in `.claude/hooks/` (wired in `.claude/settings.json`) mechanically enforce contracts that used to be prompt-discipline. Naming: `guard.*` blocks, `lint.*` feeds violations back, `inject.*` adds context. A blocked call or a bounced stop is the harness working, not an error to route around — fix the violation, don't retry variants.

| Hook | Event | Enforces |
|---|---|---|
| `guard.write.mjs` | PreToolUse (Write\|Edit) | Only registered `artifacts/` directories are writable; agent-memory accepts only registered file kinds (`## Agent memory layout`) |
| `guard.bash.mjs` | PreToolUse (Bash) | Real command evaluation instead of prefix matching: compound commands checked per segment; read-only/inspection commands auto-allowed; destructive roots (rm, sudo, git push/reset/…) denied; meta-commands (xargs, eval, sh -c), hidden execution (`$(…)`, backticks), and write redirects fall through to the normal prompt. `npm run` scripts are resolved via package.json and classified by what they actually execute. Requires `shell-quote` (falls through silently if absent) |
| `lint.write.mjs` | PostToolUse (Write\|Edit) | Memory caps (150-line file, 2-line/50-word entries), `.claude/MEMORY.md` decision-entry size, plan anchor/stamp integrity via `plan-status.mjs`. Also runs standalone: `node .claude/hooks/lint.write.mjs --all` |
| `guard.verdict.mjs` | Stop | Review/amendment/phase blocks must close with their exact contract lines (verdict tokens, Classification, routing/approval lines) before the turn may end |

The matching `selfcheck.yaml` boxes remain — the hook is the backstop, the self-check is the habit.

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
