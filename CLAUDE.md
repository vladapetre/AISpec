# Harness

Four lanes, four agents, one kernel. Code decides what code can decide; the model fills the rest. `harness` below means `node .claude/bin/harness.mjs`.

## Every request

1. A change request: invoke the lane skill straight away, no separate admit call. `expediting` when the change is plainly small (three files at most, no new dependency, no security path, no migration), `ordering` for a bounded feature, `designing` when it touches a security path, a schema, a contract or an irreversible step, `researching` for a question that needs a report. Every lane skill runs `harness admit` on its first line and names the right lane if you guessed wrong. A plain question: answer it.
2. State lives in `work/<id>/`. Read it with `harness state <id>` and `harness next <id>`. Never remember or re-derive it. `harness route` is the only way a verdict changes state.
3. Agents in `.claude/agents/`: analyst, architect, developer, reviewer. Spawn by role name, continue a live instance with `SendMessage`, never respawn one.
4. Stop only at a user gate. The gate packet is `harness next` rendered: one line what happened, one line what changed, the bracket options. Never two stops in a row.
5. Verdict tokens are exact and stand alone on the last line: `APPROVED`, `CHANGES REQUIRED`, `ALIGNED`, `DRIFT DETECTED`, `PHASE DONE`, `PHASE STALLED`, `ARTIFACT WRITTEN`, `REPORT WRITTEN`, `AMENDED`. A near miss is not a verdict.

## Rules

`.claude/rules/` loads by path: `work-items` (work/**), `security-paths`, `harness-authoring` (.claude/**), `prose` (always).

## Project facts

Operational one-liners every agent needs and none should rediscover. Append below.
