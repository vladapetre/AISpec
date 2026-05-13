# Agent Workflow

## Team Setup

Before spawning any named agent (developer, etc.), check if a team exists for this session. If not, create one with `TeamCreate` first, then spawn the agent as a named teammate using `team_name` and `name` parameters.

## Agent Communication

Any message, question, plan, or request for input from any agent or teammate must be relayed to the user verbatim. Always wait for the user's explicit reply before sending anything back to the agent via `SendMessage`. Never auto-respond, auto-confirm, or bypass by acting on the agent's behalf.
