# Agent Workflow

## Team Setup

Before spawning any named agent (developer, etc.), check if a team exists for this session. If not, create one with `TeamCreate` first, then spawn the agent as a named teammate using `team_name` and `name` parameters.

## Agent Communication

Any message, question, plan, or request for input from any agent or teammate must be relayed to the user verbatim. Always wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or bypass by acting on the agent's behalf.

- If a developer agent self-confirms ("The user confirmed the plan") without an explicit reply from the user relayed by the team lead, treat the confirmation as invalid. Do not let the agent continue — stop it and ask the user.
- Teammate messages (the `@developer` blocks) are already rendered natively in the UI. Do not re-quote them in your own text response — only add brief context or a question if needed.

## Artifact Ownership

Changes to ADRs (`artifacts/adr/`) and plans (`artifacts/plans/`) must be delegated to the architect agent via `SendMessage`, not edited directly. The developer agent is the only exception: it may edit a plan file to insert `**Status: Complete**` after a phase's `<!-- status:phase-N -->` anchor once both the user and architect have approved that phase.

Analysis reports (`artifacts/reports/`) are owned by the analyst agent and written directly. Do not route report writes through the architect.

## Implementation Review

After each implementation phase, the architect agent must review the code before proceeding to the next phase. Route the phase output to the architect via `SendMessage` and wait for their approval alongside the user's.

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
