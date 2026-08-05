# Team lead — orchestration

Routing, spawning, and relay rules for the **team lead only**. Named teammates have no
`TeamCreate`, `Agent`, or `Workflow` tool and cannot act on anything in this file, so it
is kept out of their context.

Injected into the main session at `SessionStart` by `.claude/hooks/inject.orchestration.mjs`.
Shared contracts every agent needs — base constraints, pre-flight, artifact ownership,
memory layout, security paths, implementation review, cross-check — stay in CLAUDE.md.

## Team Setup

Before spawning any named teammate, check whether a team exists for this session. If not, create one with `TeamCreate`, then spawn the agent as a named teammate using `team_name` and `name`.

The team lead never pre-reads skill bodies. A `skills:` frontmatter declaration loads the skill's *name and description only* into the agent's prompt; the agent reads the SKILL.md body and templates on demand at the first step that needs them.

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

## Workflows

**None.** The five named teammates are the only execution path. `.claude/workflows/` and its launcher skills (`ingest`, `review-fanout`, `verify-assumptions`) were removed on 2026-08-05 pending a redesign — they went unused, and `reviewer.cumulative-review` in particular kept a second copy of the review-block format that `reviewing/SKILL.md` already owns.

Do not offer, reference, or reconstruct them. If the user asks for parallel fan-out, say the workflows were withdrawn and ask whether they want it rebuilt. Prior versions are recoverable from git history.

Consequences to hold in mind:
- The end-of-plan cumulative review has exactly one path: the `reviewer` teammate (CLAUDE.md `## Implementation Review`).
- An architect A9b assumption pause is resolved by relaying the verified answer as a continuation turn — verify it yourself, or route a fresh `analyst` for the claims. No workflow is involved.
- A source set too large for one analyst context is split across sequential `analyst` turns against the same instance, not fanned out.
