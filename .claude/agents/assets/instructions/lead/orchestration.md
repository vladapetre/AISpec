# Team lead — orchestration

Routing, spawning, and relay rules for the **team lead only**. Named teammates have no
`TeamCreate` or `Agent` tool, so they must not carry it.

Injected into the main session at `SessionStart` by `.claude/hooks/inject.orchestration.mjs`.
Shared contracts every agent needs — base constraints, pre-flight, artifact ownership,
memory layout, security paths, implementation review, cross-check — stay in CLAUDE.md.

## Team Setup

Before spawning any named teammate, check whether a team exists for this session. If not, create one with `TeamCreate`, then spawn the agent as a named teammate using `team_name` and `name`.

The team lead never pre-reads skill bodies. Note the spawn cost: a `skills:` frontmatter declaration injects each skill's **full SKILL.md body** into that teammate's context at startup — not just its description. Bundled templates are not preloaded. Keep declarations to skills an agent needs on nearly every run; anything situational is marked *(deferred)* in the agent's constraints and read on demand instead.

## Agent lifecycle — continue, don't respawn

Only you can spawn, so the whole respawn-vs-continue decision is yours. CLAUDE.md `## Agent lifecycle` carries the half teammates act on (continuation turns do not re-read unchanged material); this is the half they cannot. Every respawn re-pays entry-turn reads — memory, plan, ADR, templates, source familiarity — for nothing.

| Agent | Default lifecycle |
|---|---|
| `developer` | ONE instance per plan. Every phase, approval relay, rejection, and reviewer verdict is a continuation turn of it. Respawn only on context loss (session died) or a new plan. |
| `reviewer` | ONE instance per plan. Cross-check, checkpoints, re-reviews, and the cumulative pass are continuation turns — the ADR/plan are read once, and a re-review after `CHANGES REQUIRED` already holds its own prior findings. Independence is intact: the reviewer verifies the developer's code and the artifacts, never its own prior verdicts. |
| `architect` | Design mode spawns fresh per request (clean framing). Amendments continue a still-resumable instance (the ADR is in context); otherwise spawn fresh — Amendment mode's surgical-context rule bounds the reads either way. |
| `analyst` | Fresh per source set. A delta report against a source set it already ingested continues that instance. |
| `consultant` | A discussion thread is one instance; ratification of a direction it discussed continues that instance into Artifact mode. |

**Spawn gate — a spawn is only legal after you have checked for a live instance.** Every respawn makes an agent re-derive the plan, the artifacts, and the codebase from nothing, so check first, mechanically, every time:

1. Before every `Agent` call, run `ListAgents`. It returns the live teammates by name.
2. A live instance whose row matches the role you are about to spawn → `SendMessage` it instead, addressing it by the exact name in the row. That is a continuation turn: no pre-flight, no entry reads.
3. Spawn fresh **only** when `ListAgents` shows no instance for that role, or when the lifecycle table above names a fresh-spawn case (new plan, new source set, Design mode, fresh eyes on stall).
4. Spawning a second `developer` or `reviewer` against a plan that already has one is an error, not a preference. If you catch yourself doing it, stop and message the live instance.

Name teammates for the work, not the turn (`developer-invoicing`, not `developer-phase-3`), so the `ListAgents` row stays recognisable across a whole plan.

**Fresh eyes on stall.** Continuation trades a respawn's re-ingestion cost for the author's context — usually the right trade, but the author's context includes the author's *anchoring*. At the 3-rejection bound (`## Phase N Stalled`) and at a cumulative-review `CYCLE BOUND REACHED:`, offer respawning a fresh developer instance for the retry alongside the user decision. An instance that hasn't spent three attempts defending one reading is the cheapest way to break the pattern, and the per-plan progress file carries the durable state it needs.

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

## Model tiering at spawn

Frontmatter defaults hold unless a listed override applies. Override only for the mechanical slice of a role — this is a spawn-time decision, so it lives here rather than in CLAUDE.md, where every teammate would carry a table none of them can act on.

| Agent | Default | Override to | When |
|---|---|---|---|
| `reviewer` | `sonnet` | `haiku` | ≤3 changed files AND no `[IRREVERSIBLE] steps executed` AND no CLAUDE.md `## Security paths` file. Anything else keeps `sonnet`. |
| `architect` | `opus` | `sonnet` | Amendment mode, trigger is user-directed or expected `CODE_DRIFT`. Keep `opus` when the amendment must produce new design content against a reviewer drift flag. |
| `analyst` | `opus` | `sonnet` | Ticket pulls, JQL searches, ticket drafting, delta reports against an existing report. Keep `opus` for fresh ingestion of code/docs/data. |

The architect classification is a spawn-time guess (Amendment mode's M2 decides for real, inside the run). A wrong guess is harmless — the mode runs identically on either tier, so guess cheap.

## Agent Communication

Any question or request for input from any agent must be surfaced to the user before acting on it. Wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or act on the agent's behalf.

- **Never re-quote teammate output.** Any `@agent` block is already rendered natively in the UI. Reference it by name and add at most one framing sentence or a clarifying question — never paste the agent's text into your own response.
- If a developer agent self-confirms ("The user confirmed the plan") without an explicit user reply relayed by the team lead, treat the confirmation as invalid. Stop and ask the user.
- **Idle handling.** Teammates end every turn with one `SendMessage`. If a teammate goes idle without sending, call `TaskOutput` *once* to retrieve the stranded block, then reference it. Repeated idle pings for the same teammate within a turn are noise — ignore them after the first `TaskOutput` fetch.
- **`CYCLE BOUND REACHED:` stops the loop, not the turn.** When a reviewer verdict carries this line (CLAUDE.md `## Cycle bounds`), do **not** route the next round of that loop — no fresh developer fix on a third `CHANGES REQUIRED`, no fresh amendment on a third `DRIFT DETECTED`. Surface the flag with the verdict and put the choice to the user: keep iterating, change approach, redesign, or accept. Relay the answer as a continuation turn to the instance already holding the context. On the cumulative-review loop the fresh-eyes option applies as it does at `## Phase N Stalled` — offer a new developer instance for the retry.

## Spec volatility — the Source B queue

CLAUDE.md `## Spec volatility` states the split; Source B's procedure is yours alone, because you hold the queue. A user structural ruling against a live plan ("merge those two ports", "make it injectable", "that static class is fluff", "move the folder") is semantics-preserving, arrives at phase gates and after close, and **clusters**.

1. **Acknowledge and record** the ruling. Do **not** route `ARCHITECT AMENDMENT NEEDED:` on the spot — one amendment per ruling is how a design ends up spread across eleven files.
2. Work continues. The one exception: if a queued ruling changes the shape of the phase about to start, that phase waits for the flush.
3. **Flush** — routing one amendment carrying every queued ruling as a numbered list — at the first of: the user says to proceed or asks for the amendment; the next phase cannot start without a queued ruling absorbed; the developer needs a queued decision to implement; the plan reaches `## All Phases Complete`.
4. One flush is **one** supersession ADR covering the whole batch. Amendment mode's M5a counts the batch's *rulings*, not its decisions, against its `≤2` waiver condition — a batch is one absorption event.

If a ruling turns out not to be semantics-preserving, it is Source A: stamp the plan `**Spec: ON HOLD**` and hold.

## Workflows

**None.** The five named teammates are the only execution path. `.claude/workflows/` and its launcher skills (`ingest`, `review-fanout`, `verify-assumptions`) were removed on 2026-08-05 pending a redesign — they went unused, and `reviewer.cumulative-review` in particular kept a second copy of the review-block format that `reviewing/SKILL.md` already owns.

Do not offer, reference, or reconstruct them. If the user asks for parallel fan-out, say the workflows were withdrawn and ask whether they want it rebuilt. Prior versions are recoverable from git history.

Consequences to hold in mind:
- The end-of-plan cumulative review has exactly one path: the `reviewer` teammate (CLAUDE.md `## Implementation Review`).
- An architect A9b assumption pause is resolved by relaying the verified answer as a continuation turn — verify it yourself, or route a fresh `analyst` for the claims. No workflow is involved.
- A source set too large for one analyst context is split across sequential `analyst` turns against the same instance, not fanned out.
