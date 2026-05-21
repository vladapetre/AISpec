# Follow-up: Extract Deterministic Blocks Out of Agent Prompts

Status: deferred — not for the current pass. Captured after the 2026-05-21 agent-file
rewrite that brought all five agents onto `templates/agent-definition-template.md`.

## Why this is a separate pass

The template restructure was scoped to the agent `.md` files only. It deliberately left
several **deterministic workflow blocks** inline in the agent prompts. Per
`tmp/agent-guidelines-findings.md` (§3.3, §4) and Anthropic's *Building Effective Agents*:

> Deterministic procedure embedded in an agent prompt is re-executed by hand every turn:
> slower, higher-variance, and harder to verify than the same logic in code.

These blocks belong in **scripts or skills** the agent *calls*, not prose it re-derives.
Extracting them shrinks the always-loaded prompt, removes a drift source, and makes the
deterministic parts actually deterministic.

## Blocks to extract

### 1. Developer — test-suite detection
- **Location:** `.claude/agents/developer.md`, `<instructions>` step 8, "Test detection".
- **What it is:** an ordered list of ~11 file/marker patterns (`package.json` test script,
  `Makefile` test target, `pytest.ini`, `go.mod` + `*_test.go`, `Cargo.toml`, etc.),
  checked in order, stop at first match.
- **Nature:** pure lookup — zero judgement.

### 2. Developer — linter detection
- **Location:** `.claude/agents/developer.md`, `<instructions>` step 8, "Linter detection".
- **What it is:** an ordered list of ~10 config patterns (`biome.json`, `.eslintrc*`,
  `ruff.toml`, `[tool.ruff]`, `.golangci.yaml`, etc.), checked in order.
- **Nature:** pure lookup — zero judgement.

### 3. Developer — pre-existing-failure check
- **Location:** `.claude/agents/developer.md`, `<instructions>` step 8, "Failure handling".
- **What it is:** the `git stash --include-untracked` → run-on-base-commit → `git stash pop`
  procedure that classifies a failing test as introduced vs. pre-existing.
- **Nature:** a fixed shell procedure — scriptable end to end.

### 4. Architect — constraint-scoring Medium-signal table
- **Location:** `.claude/agents/architect.md`, `<instructions>` step A5.
- **What it is:** the **Medium** tier of the rubric — a fixed table of observable repo
  signals (public HTTP endpoint, `docker-compose.*`/`kubernetes/` with replicas, GDPR/
  HIPAA/`COMPLIANCE_*`, batch/ETL entry point, <3 named engineers, Core-classified
  charter).
- **Nature:** the *signal detection* is scriptable; the **High** tier and the "top 2"
  selection keep genuine judgement — do NOT extract those.

### 5. Consultant — constraint-scoring Medium-signal table
- **Location:** `.claude/agents/consultant.md`, `<instructions>` step 9.
- **What it is:** the strategic-constraint analogue of #4 — a fixed Medium-signal table
  (Core charter, `COMPLIANCE_*`, named launch date/competitor, <3 engineers, named
  vendor, `Big Ball of Mud`/`Shared Kernel` edge).
- **Nature:** same as #4 — extract signal detection only, keep the scoring judgement.

## Proposed targets

| Block | Target form | Sketch |
|-------|-------------|--------|
| #1, #2 | **Script** — `detect-toolchain` | Scans the repo, prints the resolved test command and lint command (or "none detected"). Developer runs it via `Bash` and uses the output. |
| #3 | **Script** — fold into `detect-toolchain` or a `classify-failure` helper | Wraps the stash/run/pop procedure; returns `introduced` / `pre-existing` per test. |
| #4, #5 | **Skill** — `constraint-signals` (or a section of a shared skill) | Scans the repo for the observable signals and reports which are present; the agent still does the High-tier read and the top-2 selection. |

A script is the stronger choice for #1–#3 (fully deterministic, no LLM needed). A skill
fits #4–#5 because the output still feeds an agent judgement step.

## Open questions for the follow-up pass

- One `detect-toolchain` script, or separate test/lint detectors? (One is simpler to
  invoke; the developer needs both anyway.)
- Where does the script live — `.claude/scripts/`, a `package.json` script, or the
  `documenting`/a new skill's asset dir? Needs a convention decision.
- Does the architect/consultant signal-scan justify a whole skill, or is it small enough
  to be a script both agents call via `Bash`?
- After extraction, re-check each agent's `<instructions>` token budget against the
  template's ~500–2000 token guidance — this is the metric that says the extraction
  worked.

## Acceptance criteria for the follow-up pass

- No agent prompt contains an ordered detection table or a fixed shell procedure that a
  script could run.
- Each affected agent's `<instructions>` step references the script/skill instead of
  restating the logic.
- The extracted logic has one home — no copy in two agents (developer test/lint; the
  architect/consultant signal scan).
- Behaviour is unchanged: same detection results, same constraint scoring.
