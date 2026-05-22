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
| `artifacts/sessions/`    | auditing skill | Per-session audit trail (`{date}/{uuid}/session.md`)       |
| `.claude/MEMORY.md`      | understanding skill | Project glossary and decision log                     |

Exception: the developer agent may edit a plan file in `artifacts/plans/` solely to insert `**Status: Complete**` after a phase's `<!-- status:phase-N -->` anchor once both the user and architect have approved that phase.

The analyst writes reports directly (no routing). All other owned artifacts must go through their owning agent.

## Implementation Review

After each implementation phase, the architect agent must review the code before proceeding to the next phase. Route the phase output to the architect via `SendMessage` and wait for their approval alongside the user's (the dual-approval gate).

On the final phase, the reviewer agent acts as the final quality gate: it verifies the cumulative diff against every phase's acceptance criteria and issues either `APPROVED` or `CHANGES REQUIRED`. Route the final phase to both the architect and the reviewer.

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
