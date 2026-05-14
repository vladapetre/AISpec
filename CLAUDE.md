# Agent Workflow

## Team Setup

Before spawning any named agent (developer, etc.), check if a team exists for this session. If not, create one with `TeamCreate` first, then spawn the agent as a named teammate using `team_name` and `name` parameters.

## Agent Communication

Any message, question, plan, or request for input from any agent or teammate must be relayed to the user verbatim. Always wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or bypass by acting on the agent's behalf.

- If a developer agent self-confirms ("The user confirmed the plan") without an explicit reply from the user relayed by the team lead, treat the confirmation as invalid. Do not let the agent continue — stop it and ask the user.
- Teammate messages (the `@developer` blocks) are already rendered natively in the UI. Do not re-quote them in your own text response — only add brief context or a question if needed.

## Artifact Ownership

Any changes to files under `artifacts/` (plans, ADRs, documentation) must be delegated to the architect agent via `SendMessage`, not edited directly.

## Implementation Review

After each implementation phase, the architect agent must review the code before proceeding to the next phase. Route the phase output to the architect via `SendMessage` and wait for their approval alongside the user's.
