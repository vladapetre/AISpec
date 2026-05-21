# Agent Authoring & Coordination Guidelines

Draft findings, grounded in Anthropic's *Building Effective Agents*
(https://www.anthropic.com/engineering/building-effective-agents) and mapped to the
current 5-agent system in `.claude/agents/`.

Status: draft for later use. Not yet adopted into CLAUDE.md.

---

## 1. Where the current system stands vs. the article

The system is an **orchestrator-workers** topology (the team lead orchestrates) that
wraps:

- a **prompt chain** — consultant -> architect -> developer — with approval **gates**
- an **evaluator-optimizer loop** — developer <-> reviewer <-> architect

This is a legitimate, recognized composition of the article's patterns.

**Aligned with the article already:**

- Transparency — ADRs, plans, and phase summaries expose the reasoning.
- Typed handoffs — `[STRATEGIC REVIEW NEEDED]`, `[TACTICAL DESIGN NEEDED]`, etc.
- Poka-yoke'd interfaces — status anchors, exact verdict tokens, absolute paths.
- Minimal tool grants per agent — developer/reviewer have no `Agent`/`SendMessage`.
- Single-recommendation outputs — no decision-paralysis menus.

**Working against the article — simplicity:**

The agent files are 8-13 KB of deeply nested numbered procedure. Much of that
(test-framework detection, constraint-scoring rubrics, filename derivation) is
*deterministic workflow* embedded in an *agent prompt*. The article's core
workflow-vs-agent distinction says predefined code paths belong in code (or in
skills/scripts the agent calls) — not in prose the model re-executes by hand every
turn.

> "Success in the LLM space isn't about building the most sophisticated system.
> It's about building the right system for your needs."

---

## 2. Guidelines for writing an agent

1. **Add an agent only when the task is genuinely open-ended.** The bar: unpredictable
   steps, many turns, path cannot be hardcoded. If the team lead could do it in one
   pass with a checklist or skill, it is not an agent.

2. **One nameable job per agent.** analyst = understand, consultant = strategy,
   architect = tactics, developer = implement, reviewer = verify. If the job needs
   more than three words, the agent is doing too much.

3. **Separate judgment from procedure.** Where an instruction is fully deterministic,
   it is a *workflow* — move it into a skill, template, or script the agent invokes,
   not lines it executes manually. Reserve the agent prompt for parts that need
   genuine judgment. Shrinks prompts, cuts drift, makes deterministic parts actually
   deterministic.

4. **Transparency by default.** Every agent shows its plan/reasoning before acting.
   Already done — keep it.

5. **Treat the handoff interface (ACI) as a first-class artifact.** Minimal tool
   grants. Poka-yoke the seams: absolute paths, required anchors, exact-token verdicts
   (`APPROVED`, never "looks good"). Make outputs machine-checkable.

6. **Every agent ends with a fixed output contract.** A parseable block with exact
   field names and tokens — that contract is what the next stage consumes.

7. **Match the model to the task.** Route simple -> cheap, complex -> capable. Almost
   everything currently runs opus/high — re-justify per agent (developer on sonnet is
   right; not every step needs opus/high-effort).

8. **Test the agent like a tool.** Run example inputs, watch for misuse of handoff
   tokens, iterate the prompt.

---

## 3. Rules for coordinating agents

1. **A gate between every chain step.** Prompt chains need programmatic gates to catch
   errors before they compound. No handoff without a check, a verdict, or a user
   approval.

2. **Handoffs are typed tokens, not prose.** One documented vocabulary (see section
   5). An agent reads its inbox by grepping for its token.

3. **Star topology, single relay.** All cross-agent comms route through the team lead.
   No agent messages another directly. A star is observable and bounds error
   propagation; a mesh compounds it.

4. **Pass pointers, not payloads.** Workers write artifacts to disk; the orchestrator
   forwards the file path + the short summary block, never the full output. Keeps the
   orchestrator's context clean.

5. **Bound every loop.** developer <-> reviewer is an evaluator-optimizer loop and can
   spin forever. Set a max iteration count; after N rejections, escalate to the human
   instead of retrying.

6. **Human gate on irreversible or cross-boundary actions only.** Reversible local
   actions do not need one. Already practiced ([IRREVERSIBLE] confirm, dual approval
   for phase advance) — state it as the general rule.

7. **Ranked conflict resolution.** Every artifact type gets a precedence rank (e.g.
   "ratified SDR outranks tactical ADR"). Conflicts resolve by rank; ties go to the
   human. Agents never silently fight.

---

## 4. Three concrete changes to the current files

- **Extract the deterministic blocks into skills/scripts.** The developer's
  test/linter detection (`developer.md` step 7, ~30 lines) and the architect's
  constraint-scoring rubric (`architect.md` step 6) are pure workflow. A
  `detect-toolchain` script/skill makes them faster, consistent, and frees the prompt
  for judgment.

- **Add an explicit loop bound** to the developer/reviewer rejection cycle
  (`developer.md` step 12) — e.g. "after 3 rejection cycles, stop and escalate to the
  user."

- **Centralize the token vocabulary.** The flag tokens are defined ad hoc across five
  files. The table below is the proposed single source of truth.

---

## 5. Centralized handoff-token table

### 5a. Routing tokens (cross-agent handoffs)

These move work between agents. The producer writes the token into a named artifact
section; the consumer scans for it on its next invocation. All routing physically
passes through the team lead.

| Token | Produced by | Written into | Consumed by | Meaning |
|-------|-------------|--------------|-------------|---------|
| `ARCHITECT REVIEW NEEDED:` (line) / `[ARCHITECT REVIEW NEEDED]` (in-artifact) | analyst | Report Recommendations section + a summary line | architect (its step 3) | A finding needs tactical architectural input. |
| `[STRATEGIC REVIEW NEEDED]` | architect | ADR `## Consequences`, under `**Strategic follow-up:**` | consultant (its step 4) | A tactical request raised a strategic question. |
| `[TACTICAL DESIGN NEEDED]` | consultant | SDR `Tactical follow-up` section | architect (its step 4) | A ratified strategic decision needs tactical design. |
| `[CONSULTANT REVIEW NEEDED]` / `STRATEGIC REVIEW NEEDED:` (line) | analyst | Report Recommendations / summary line | consultant (its step 3) | A finding needs strategic input. |

> Note: the analyst's report-side flag and the architect's ADR-side flag share the
> "ARCHITECT REVIEW NEEDED" wording but live in different artifacts. Consider
> disambiguating (e.g. `[ARCHITECT REVIEW NEEDED]` for in-artifact, a distinct
> summary-line prefix for the conversation output) so a grep is unambiguous.

### 5b. Verdict tokens (gate decisions)

Exact strings. Anything else is a rejection.

| Token | Issued by | Gate | Effect |
|-------|-----------|------|--------|
| `APPROVED` | reviewer | post-phase code review | Phase may proceed to architect/user. |
| `CHANGES REQUIRED` | reviewer | post-phase code review | Phase returns to developer. |
| `APPROVED` | architect | dual-approval gate | One of the two approvals developer needs to advance. |
| `approved` (case-insensitive) | user (relayed) | dual-approval gate | The second approval developer needs to advance. |

### 5c. In-artifact markers (not routing; status/quality annotations)

| Marker | Used by | Purpose |
|--------|---------|---------|
| `<!-- status:phase-N -->` | architect (writes), developer (reads/marks) | Per-phase anchor in plan files. |
| `**Status: Complete**` | developer | Inserted after a phase anchor once both approvals are in. |
| `[IRREVERSIBLE]` | architect, consultant | Marks a hard-to-reverse decision/step; triggers an extra human confirm. |
| `[PRE-EXISTING]` | developer, reviewer | Failure/finding not introduced by the current phase; excluded from verdict. |
| `[VERIFIED]` / `[INFERRED]` / `[ASSUMED]` | analyst | Per-finding confidence marker. |
| `[ASSUMPTION]` | analyst | Coverage/scoping caveat in Risks and Unknowns. |
| `[UNKNOWN]` | analyst | A required question left unanswered after full ingestion. |

### 5d. Rules for the vocabulary

- A token means exactly one thing. Do not overload.
- A producer writes a token only into the artifact section named above — never
  free-floating in conversation, except the designated summary lines.
- A consumer scans for its tokens at a fixed step of every invocation.
- Adding a new token requires adding a row here first.
- Verdict tokens are matched as exact strings; near-matches are rejections.
