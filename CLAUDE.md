# Agent Workflow

## Team Setup

Before spawning any named agent (analyst, consultant, architect, developer, reviewer), check if a team exists for this session. If not, create one with `TeamCreate` first, then spawn the agent as a named teammate using `team_name` and `name` parameters.

Each agent auto-loads its declared skills via the `skills:` frontmatter field — do not re-invoke those skills from the team lead.

## Agent Communication

Any message, question, plan, or request for input from any agent or teammate must be relayed to the user verbatim. Always wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or bypass by acting on the agent's behalf.

- If a developer agent self-confirms ("The user confirmed the plan") without an explicit reply from the user relayed by the team lead, treat the confirmation as invalid. Do not let the agent continue — stop it and ask the user.
- Teammate messages (the `@developer` blocks) are already rendered natively in the UI. Do not re-quote them in your own text response — only add brief context or a question if needed.
- **Idle = turn ended, output waiting.** When a teammate goes idle, or the harness reports it as "idle and available," that is the signal its turn ended without an outbound `SendMessage`. Call `TaskOutput` for that teammate to retrieve its final `<output_format>` block before treating the idle ping as noise. Relay the retrieved block to the user verbatim. Repeated idle pings with no new content mean the same prior output is still waiting — fetch it once, then dismiss further pings for that turn.

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

When the architect publishes an ADR/plan pair in Mode A, its output carries a `CROSS_CHECK_REQUESTED: <plan-path>` summary line. Route that line to the reviewer via `SendMessage` and **wait** — do not invite the developer to start Phase 1 until the reviewer relays one of the cross-check verdicts:

- `ALIGNED` — the ADR/plan pair is mutually consistent; route the plan to the developer for Phase 1.
- `DRIFT DETECTED` — route the cross-check report back to the architect, who reconciles via amendment and re-emits `CROSS_CHECK_REQUESTED:`. Repeat until `ALIGNED` clears.

The cross-check is a single read-only artifact↔artifact pass per ADR/plan pair (not per phase). It fires before Phase 1, never between phases — those use the per-phase review below.

## Implementation Review

After each implementation phase, the reviewer agent reviews the code before the phase advances. The phase summary is routed to the reviewer **and** presented to the user **in the same turn** — the two approvals are independent and run in parallel. Send to the reviewer via `SendMessage` and ask the user in the same response; collect the two `APPROVED` / `approved` verdicts in whichever order they arrive (dual-approval gate). The final phase is reviewed the same way — there is no separate cumulative pass.

The reviewer's per-phase review includes an ADR-alignment check: it verifies the diff still honours the governing ADR's key decisions. If it detects design-level drift, it emits `ARCHITECT AMENDMENT NEEDED: <reason>` alongside its verdict. Route that flag to the architect via `SendMessage` as soon as the reviewer's output is received — do not wait for the user's verdict, and do not wait for the phase to advance. The architect's amendment runs in parallel with the user's approval and may arrive after the dual gate has already cleared (the developer handles that case by un-marking `**Status: Complete**` if needed). The architect amends the ADR — and the plan if the amendment changes a future phase's acceptance criteria. The architect no longer gates phases by default; they re-engage only on this flag.

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
