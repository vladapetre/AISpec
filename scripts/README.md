# scripts/

Zero-dependency Node scripts that lint the project's authored agent and skill definitions against the canonical templates.

## lint-agents.mjs

Validates `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, and the two templates in `templates/` against the skeleton, pre-flight, FM-citation, numeric-cap, and asset-path rules captured in [tmp/followup-agent-lint-and-backfill.md](../tmp/followup-agent-lint-and-backfill.md). Run via `npm run lint:agents`. Exits non-zero on any error; warnings do not fail.
