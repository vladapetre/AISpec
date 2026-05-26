# Agent Definition Template

> **What this is.** A template for authoring Claude Code subagent definitions in
> `.claude/agents/<name>.md`. It merges this project's existing agent conventions
> (XML-tagged sections, artifact-chain discipline, flag-token hand-offs, structured output
> contracts, the team-lead relay model) with the research-backed 7-component agent
> structure from the Forge methodology (jdforsythe/forge).
>
> **Research basis.** PRISM (persona effectiveness), vocabulary routing, MAST failure
> taxonomy, MetaGPT (structured hand-offs), DeepMind multi-agent scaling. Sources:
> `.opensrc/repos/github.com/jdforsythe/forge/master/docs/research/`.
>
> **How to use.** Copy this file to `.claude/agents/<name>.md`. Fill every `[...]`
> placeholder. Delete every `> **Guidance**` blockquote, every `<!-- ... -->` comment, and
> the trailing checklist section. Then run the validation checklist before committing.

---

## Before you author: agent or workflow?

Not every job needs an agent. Add an agent only when the task is genuinely open-ended —
unpredictable steps, many turns, a path that cannot be hardcoded. If the team lead could
do it in one pass with a checklist, or the steps are deterministic, the job belongs in a
**skill, script, or template** — not an agent definition. Deterministic procedure embedded
in an agent prompt is re-executed by hand every turn: slower, higher-variance, and harder
to verify than the same logic in code. (Anthropic, *Building Effective Agents* — the
workflow-vs-agent distinction.) This gate is the first item on the validation checklist.

## Shared assets

Two files under `.claude/agents/assets/`. Agent files **reference** them — they never restate the content.

- **`.claude/agents/assets/tokens.yaml`** — every handoff token, verdict token, and
  in-artifact marker, with its producer, consumer, and meaning. **Runtime asset.** Adding
  a token requires adding a row here first. Agents cite tokens in `<interaction_model>`
  without restating their semantics.
- **`.claude/agents/assets/mast.yaml`** — MAST failure taxonomy + 14 design rules + audit
  checklist (Cemri et al., arXiv:2503.13657). **Designer's reference, not a runtime
  asset.** Consulted when authoring or amending an agent/skill file; not loaded into agent
  prompts. The failure-mode discipline lives in the runtime prompt through the **closing
  self-check** block (see Component 5 / `<instructions>` guidance), not through inline
  `**Avoid (FM-x.x):**` citations.

  Older agent files in this repo may still carry scattered `**Avoid (FM-x.x):**` cues
  from a previous iteration. The current convention is to consolidate that intent into a
  single closing self-check block at the end of `<instructions>` — fewer tokens, more
  salient at end-of-turn, and the architecture itself (output formats, flag tokens,
  templates, typed IDs, gates) carries most of the load.

## Convention: numeric thresholds over adjectives

Any cap, limit, or ceiling in an agent definition must be a **number** (`≤N`, an exact
count, a byte/line cap), not an adjective. Numbers are checkable across runs; adjectives
vary wildly — "be concise" produces 5-line outputs in one run and 80-line outputs in the
next. The same applies to every IF-condition threshold in `<instructions>`.

| Bad | Good |
|---|---|
| "Ask clarifying questions if anything is unclear." | "Ask up to **5 clarifying questions** in one batch. Do not exceed 5 per turn." |
| "Keep the restatement concise." | "Restate in **2-4 lines**." |
| "Limit findings to a manageable count." | "Report **≤50 findings**; if more apply, list the top 50 by severity + a `(N more omitted)` line." |

Research backing: `.claude/agents/assets/mast.yaml` meta-principle — LLM steps are
stochastic, so reliability comes from tightening structure (low variance + high accuracy).
Adjectival caps are under-specification.

## Convention: XML tags

The 7 components are delimited by **XML tags**; content **within** each tag uses markdown
(bullets, tables, `**bold**`, `###` sub-headings).

- XML tags give **explicit, unambiguous boundaries** — a tag has a hard close, unlike a
  markdown `##` header whose scope ends only implicitly at the next header. This matters
  when sections are precisely bounded or nested.
- Anthropic's prompt-engineering guidance recommends XML tags for Claude; the model is
  trained to attend to them. (Forge's own agents use plain markdown only because Forge is
  deliberately model-agnostic — not because markdown is better here.)
- Tag names are `snake_case`. Reuse the existing project tag names — `<instructions>`,
  `<rules>`, `<output_format>` — for continuity; new components get new tags.
- Do **not** wrap the whole body in a single outer tag, and never leave a stray closing
  tag at EOF. Every tag opened must be closed, and no tag closed without being opened —
  the last line of an agent file is `</output_format>`.

---

## Section ordering & attention budget

LLM attention is strongest at the **start** and **end** of a prompt (primacy/recency).
This template orders the tags accordingly:

| Position | Tags | Why |
|---|---|---|
| START (highest attention) | `<role_identity>`, `<operating_constraints>` | Role anchoring + critical invariants |
| MIDDLE | `<deliverables>`, `<decision_authority>`, `<instructions>`, `<rules>`, optional `<domain_vocabulary>` | Reference + procedure |
| END (high attention) | `<interaction_model>`, `<completion_criteria>`, `<output_format>` | The hand-off, the done-definition, the response contract |

Anti-pattern guidance is **not** a separate section and is **not** inline at every firing
point. The current convention is a single **closing self-check** block at the end of
`<instructions>` — 4–6 plain-language bullets capturing the active failure modes for this
role's emit. The architecture (output formats, flag tokens, templates, typed IDs, gates)
carries most of the load; the closing block is the safety net. See the `<instructions>`
guidance below.

Token budgets (Forge context-engineering research):

| Layer | Budget | Loading |
|---|---|---|
| Role identity | 20-50 tokens | always |
| Domain vocabulary | 100-300 tokens | always |
| Instructions (SOP) | 500-2000 tokens | always (push overflow to a skill) |
| Reference detail (detection tables, filename rules, examples) | 2000+ tokens | on demand — move to a `skills:` skill or template file |

Keep the always-loaded core lean. When `<instructions>` grows past ~2000 tokens, that is
the signal to extract detail into a skill and reference it (progressive disclosure).

---

## YAML Frontmatter

> **Guidance.** These are the Claude Code subagent fields the harness reads — they stay
> YAML, not XML. `description` drives auto-routing: write it in precise vocabulary and
> lead with the trigger condition. Grant tools by least privilege — only what
> `<instructions>` actually uses. Use `opus` for design/judgement agents, `sonnet` for
> implementation agents.

```yaml
---
name: [kebab-case — must match the filename without .md]
description: >
  [One sentence: the role and what it produces.] Use when [precise, observable trigger
  conditions — the situations where the team lead should route to this agent]. [What it
  delivers and where the artifacts land.]
tools: [comma-separated minimal set — e.g. Read, Edit, Write, Bash, Glob, Grep]
skills:
  - [skill name — auto-loaded into this agent's context via this field]
model: [opus | sonnet | haiku]
effort: [high | medium | low]
memory: [project | none]
color: [ui color]
---
```

---

> **Guidance — Component 1: Role Identity.** **Under 50 tokens** — PRISM research shows
> accuracy degrades as persona length grows; the model spends attention budget on the
> persona instead of the task. Use a **real job title** that exists in real organisations.
> Include organisational context (collaborates with / reports to) to establish scope
> boundaries. **Banned flattery** (routes to marketing clusters, degrades output):
> world-class, best, expert, genius, leading, top-tier, 10x, rockstar, ninja. "Senior" is
> allowed — a real seniority level, not a superlative. One role per agent — never stack
> titles.
>
> **Define responsibilities by boundary and output — not by prose.** The identity carries
> only the job title, ONE compact primary-responsibility clause, and org context. The
> *scope* of what the agent owns is defined elsewhere, by the components built for it:
>
> | Concern | Where it belongs |
> |---|---|
> | What the agent decides / does not touch | `<decision_authority>` |
> | What the agent produces | `<deliverables>` |
> | The domain terms that signal expertise | `<domain_vocabulary>` |
> | Operating stance (e.g. recommend vs. present options) | `<rules>` |
>
> Do not re-describe responsibilities in the identity — that is what bloats it past 50
> tokens. The reader still gets a clear picture: the title says *who*, and the four
> components above say *what* with more precision than a prose paragraph ever could.

<role_identity>
You are a [seniority] [real job title] responsible for [one compact primary-responsibility
clause] within [team / organisational context]. You collaborate with [adjacent roles].
</role_identity>

### Worked example — shortening a bloated role identity

*(Template guidance — delete this subsection when authoring a real agent.)*

**Before** — a ~150-token intro that conflates four concerns into the identity:

> You are a senior tactical architect grounded in Domain-Driven Design. You operate in the
> tactical half of DDD: designs inside a bounded context — entities, aggregates, value
> objects, domain services, application services, repositories, factories, domain events —
> and the technical decisions that follow. You leave strategic design to the consultant.
> You prioritise the technical side. Produce one concrete tactical design per request; do
> not present options.

**After** — the same information, each piece in the component built for it:

- `<role_identity>` (~40 tokens): "You are a senior software architect responsible for
  tactical design within a bounded context and the technical decisions that follow from
  it. You collaborate with the consultant, the developer, and the reviewer."
- `<domain_vocabulary>`: `**Tactical DDD:** entity, aggregate, value object, domain
  service, application service, repository, factory, domain event (Evans, DDD)`
- `<decision_authority>` → Out of scope: "Strategic design — subdomain classification,
  context boundaries, context-map relationships, build-vs-buy — owned by the consultant."
- `<rules>`: "Produce one concrete recommendation per request. Never present a menu of
  options."

Nothing is lost. The identity is now scannable, and each concern sits where the model
expects to find it.

---

> **Guidance — Operating Constraints.** The harness reality, placed high for attention.
> Always-true invariants for how this agent runs inside the team. 3-5 bullets. This is
> half of Component 7 — the other half (the artifact chain) is `<interaction_model>`.
>
> Cite `tokens.yaml` for the canonical wording of any flag token this agent emits or
> consumes — list them in `<interaction_model>`, not here. Do **not** reference
> `mast.yaml` from `<operating_constraints>`: it is a designer's asset, not a runtime one.
>
> **Anti-restatement rule.** Every operating constraint lives in exactly one place. If you
> repeat it in `<instructions>` steps and again in `<completion_criteria>`, you have
> triple-encoded the rule — that bloats the prompt without improving determinism. Pick
> the most useful home for each rule (constraint, step, or completion check) and leave the
> other two silent.

<operating_constraints>
- You are invoked as a named teammate by the team lead. You do **not** spawn other agents
  and you do **not** message other teammates directly — all cross-agent hand-offs go
  through the team lead via flag tokens.
- End every turn with exactly one `SendMessage` to the team lead containing your
  `<output_format>` block verbatim. If you must pause for user input mid-turn, send a
  one-line `PAUSED — <reason>` plus the question(s) instead.
- `Bash`: [scope — read-only allowlist | tool-specific | none]. Mutating commands → surface, do not execute.
- `Write` only under [allowed paths]. Any other path is out of scope → surface, do not write.
- [Any other always-true invariant specific to this agent — e.g. "single recommendation, never a menu", "[IRREVERSIBLE] marker required on hard-to-reverse decisions", "stable IDs in encounter order, never renumber after publication".]
</operating_constraints>

---

> **Guidance — Component 2: Domain Vocabulary.** The single highest-leverage section.
> Precise terms route the model to expert knowledge clusters; vague terms route to
> beginner blog content. **15-30 terms total, in 3-5 clusters of 3-8 related terms.**
> Attribute named frameworks: "circuit breaker pattern (Nygard)", "bounded context
> (Evans, DDD)". Apply the **15-year practitioner test** to every term: would a senior
> practitioner use this exact word with a peer? **Banned consultant-speak:** best
> practices, leverage, synergy, robust, streamline, holistic, paradigm. Every cluster must
> match the agent's task domain — off-domain vocabulary actively misleads.
>
> **Optional component.** `<domain_vocabulary>` is a priming block — instructions never
> reference its terms directly. Omit the tag entirely unless the agent operates in a
> highly specialised domain (DDD, security, regulated compliance) where the priming
> demonstrably changes output quality. Each occurrence costs ~150-200 tokens per spawn.

<domain_vocabulary>
**[Sub-domain cluster 1]:** term1, term2 (Originator), term3, term4
**[Sub-domain cluster 2]:** term5, term6 (Framework, Author), term7, term8
**[Sub-domain cluster 3]:** term9, term10, term11, term12
</domain_vocabulary>

<!-- Worked example (delete):
**System Design:** hexagonal architecture (Cockburn), bounded context (Evans, DDD), event-driven architecture, CQRS, domain model
**Decision Making:** Architecture Decision Record (ADR), fitness functions (Ford/Parsons), trade-off analysis, Cynefin framework (Snowden)
**Quality Attributes:** -ilities (maintainability, scalability, observability), SLA/SLO/SLI, circuit breaker pattern (Nygard), bulkhead isolation
-->

---

> **Guidance — Component 3: Deliverables.** Name the artifact **type** (not "a document" —
> "Architecture Decision Record"). State format, key sections, approximate length, and the
> path it is written to. Every deliverable must be concrete enough to verify it was
> produced correctly. The exact conversation-channel response is specified separately in
> `<output_format>`.

<deliverables>
1. **[Artifact Name]** — [format: markdown with sections X/Y/Z | JSON schema | diagram],
   ~[length]. Written to `[artifacts/.../path]`.
2. **[Artifact Name]** — [format], ~[length]. Written to `[path]`.
</deliverables>

---

> **Guidance — Component 4: Decision Authority.** Prevents MAST FM-2.3 (role confusion —
> agent acts outside its scope) and FM-2.4 (authority vacuum — a decision nobody owns).
> "Out of scope" is the most important line: it defines exactly where this agent stops and
> the next begins. Escalation triggers must be specific and observable, not "if unsure".

<decision_authority>
**Autonomous:** [decisions this agent makes without asking]
**Escalate:** [decisions requiring user approval or another agent's input — name the agent]
**Out of scope:** [things this agent explicitly does NOT handle — and which agent does]
</decision_authority>

---

> **Guidance — Component 5: Instructions (SOP).** Imperative ordered steps. Every step
> starts with a verb. Conditions use explicit `IF [condition]: [action]`. Every step that
> produces something has an `OUTPUT:` line. Include WHY for non-obvious steps. **Budget
> ~500-2000 tokens** — if it grows past that, move detection tables / filename rules / long
> examples into a `skills:` skill and reference it. Start with a memory-load step if
> `memory: project`, then a task-restatement step (design rule R13 / FM-3.4) — the cheapest
> defense against misunderstanding. End by deferring emission to `<completion_criteria>`.
> Any step that selects a file or artifact must use a **deterministic key** — an explicit
> path or identifier from the request, with lexicographic order as the fallback. Never
> select by filesystem modification time ("most recently modified"): mtime is not preserved
> across clone or checkout, so it makes runs diverge (`.claude/agents/assets/mast.yaml` meta-principle: low variance).
>
> **Parallelize independent reads.** Numbered SOP steps imply sequence but do not forbid
> batching. Open the `<instructions>` block with a directive that names which read-only
> steps have no dependency between them (typically: the memory load, any template/skill
> loads, and any "read every file you will touch" step) and tells the agent to issue those
> `Read` tool calls in a single tool-use batch. This is the single biggest latency win on
> agent invocation — sequential reads cost N round-trips, parallel reads cost one. Only
> serialize when a later read genuinely depends on the content of an earlier one.
>
> **Closing self-check (end of `<instructions>`).** Replace scattered inline `**Avoid
> (FM-x.x):**` cues with a single 4–6 bullet block at the end of `<instructions>` titled
> **"Closing self-check (before emitting):"**. Each bullet captures one active failure
> mode for this role's emit, in **plain language** — no FM-code citations. The block sits
> in the end/recency zone, which means it's read just before the agent renders its output
> — far more effective than per-step nags scattered through the file.
>
> Cover the failure modes the architecture itself does *not* catch. Output format and flag
> token shape are enforced by `<output_format>` and `tokens.yaml` — the block focuses on
> behavioural drift: scope (FM-1.2), completeness (FM-3.1/3.2), delegation (FM-2.4),
> role-specific evidence rules.

<instructions>
Follow these steps in order on every invocation.

**Parallelize independent reads** in a single tool-use batch: [list the read-only steps
that have no dependency between them — typically memory load, template load, and any
"read every file you will touch" step]. Sequential reads cost N round-trips; parallel
reads cost one.

1. [If `memory: project`] Read `.claude/agent-memory/[name]/MEMORY.md` to load prior
   context. Missing file or directory → continue without error; the first memory `Write`
   creates the path.
2. **Pre-flight.** Run the canonical 5-check protocol in CLAUDE.md `## Pre-flight protocol`
   with these per-check semantics:
   - **Inputs exist** — [the input artifact types this agent consumes, at expected paths].
   - **Prior phase reviewed** — [`N/A` if pipeline-entry stage; else the specific upstream verdict].
   - **Scope** — [the Out-of-scope cases this agent must refuse].
   - **Terms current** — every domain term appears in `.claude/MEMORY.md`, an existing artifact, or is the user's wording; unfamiliar coined terms get `⚠`.
   - **Target identified** — [the explicit identification pattern — path, slug, phase number — never "the latest" or "the recent one"].
3. [Imperative verb] [action]. [Context / WHY if non-obvious.]
   IF [condition]: [branch action].
   OUTPUT: [what this step produces].
4. [Imperative verb] [action].
5. ... continue in execution order ...
N. Write the memory entry per the format defined in [skill / template].

---

**Closing self-check** (before emitting):
- Role: stayed inside `<decision_authority>`; no [agent-specific scope violation].
- Completeness: every `<output_format>` field rendered; [agent-specific completeness check, e.g. "UNCLEAR rows surfaced", "Risks and Unknowns block populated"].
- Determinism: [agent-specific format invariant — e.g. "verdict is one of the two exact strings on its own line", "exactly 2 binding constraints, exactly 2 alternatives"].
- Delegation: every flag in `<interaction_model>` `emits` is present when its trigger condition fired (and absent otherwise).
- [Agent-specific evidence rule — e.g. "every finding cites file:line", "every recommendation tied to a binding constraint", "every term added to MEMORY.md is project-specific, not general programming".]
- Memory entry written.
</instructions>

---

> **Guidance — Hard Constraints (`<rules>`).** Optional and usually unnecessary. Most
> rules belong in `<operating_constraints>` (always-true invariants) or
> `<decision_authority>` (scope). Use `<rules>` only for cross-cutting behavioural stances
> that don't fit either of those. Delete the tag if empty.
>
> Do not add inline `**Avoid (FM-x.x):**` cues. The closing self-check at the end of
> `<instructions>` covers behavioural drift in one place.

<rules>
- [Cross-cutting operating stance — e.g. "Produce one concrete recommendation per request. Never present a menu of options."]
- [Cross-cutting invariant — e.g. "Mark every hard-to-reverse decision with [IRREVERSIBLE] inline."]
</rules>

---

> **Guidance — Component 7: Interaction Model.** The typed-artifact chain. MetaGPT
> research: structured hand-offs cut error propagation ~40% versus free-form dialogue.
> This project's **flag tokens** ARE the typed hand-offs; they are defined once in
> `.claude/agents/assets/tokens.yaml` — the single source of truth. List here only the
> tokens THIS agent emits and consumes, citing each by its `tokens.yaml` name and where it
> appears. Never invent a token in an agent file — add a row to `tokens.yaml` first
> (design rule R8: standardized protocols).

<interaction_model>
**Receives from:** [upstream role] → [artifact type + path]
**Delivers to:** [downstream role] → [artifact type + path]
**Handoff format:** [structured markdown artifact at a fixed path | flag tokens in the conversation output]
**Flag tokens emitted:** `[FLAG NAME]` — [meaning; which artifact section it is placed in]
**Flag tokens consumed:** `[FLAG NAME]` — [from which upstream artifact this agent reads it]
**Coordination:** [sequential pipeline stage | quality gate | service role callable by any teammate]. The team lead relays all hand-offs.
</interaction_model>

---

> **Guidance — Completion Criteria (project addition — not one of the Forge 7).** Closes
> MAST FM-1.3 (premature termination) and FM-1.5 (unaware of stopping conditions). A
> concrete, testable "done" definition: conditions that must ALL hold before the agent
> emits its output. Every condition must be **observable** — something you can point at,
> not "the work feels complete". Include at least one "NOT done until ..." guard for the
> condition most likely to be skipped. 3-6 bullets. Placed in the end/recency zone so the
> done-check fires just before output.
>
> **Numeric caps on bounded artifacts.** If this agent produces a bounded artifact (a
> list of findings, a table of risks, a sized report), state the cap as a number here —
> `≤50 findings`, `≤N rows`, `≤N lines` — not as an adjective. See *Convention: numeric
> thresholds over adjectives* at the top of this template.

<completion_criteria>
This invocation is complete ONLY when all of the following hold:
- [Observable condition — e.g. every artifact in `<deliverables>` exists at its stated path.]
- [Observable condition — e.g. every flag token in the input has a response or an explicit deferral.]
- [Observable condition — e.g. the `<output_format>` block is fully populated; no placeholder remains.]
- NOT done until [the condition most often skipped — e.g. the memory entry is written].

If any condition fails, continue working — do not emit the output block.
</completion_criteria>

---

> **Guidance — Component 3 (operational half): Output Format.** The exact contract for the
> conversation-channel reply. Kept **last** so it receives recency attention. Make it
> copy-exact — the team lead and downstream agents parse this. Specify which blocks are
> omitted when empty.

<output_format>
After [completing the instructions], output to the conversation in exactly this structure:

```
<one-paragraph summary of what was done and the key result>

<structured fields — artifact paths, verdicts, constraint lists, confidence breakdown>
<flag-token line(s) if any hand-off is needed, e.g.:>
ARCHITECT REVIEW NEEDED: [item]; [item]
```
</output_format>

---

## Optional patterns

Two patterns developed for specific agent shapes. Apply only when the agent fits the
shape — neither is mandatory.

### Pattern: dual-mode agent (conversational + artifact)

Use when the agent's primary value is **thinking with the user**, but it must also produce
structured artifacts when the user (or an inbound flag) explicitly asks. The consultant is
the canonical example. Without this pattern, a conversational agent collapses into a
deliverable factory that writes a full bundle on every turn.

- **Add a `<modes>` block** between `<operating_constraints>` and `<deliverables>` naming
  the two modes (typical names: **Discussion** as default, **Artifact** on explicit ask)
  and the triggers that select each.
- **Mode dispatch is step 2** of `<instructions>` (or step 3 if pre-flight is step 2):
  match the request against the explicit triggers; one branch per mode; no interleaving.
- **`<deliverables>` lists per mode** — Discussion-mode deliverables are
  conversation-shaped (recommendation + alternatives + trade-offs); Artifact-mode
  deliverables are file paths.
- **`<output_format>` carries one block per mode** — a free-prose body with a fixed
  metadata trailer for Discussion mode keeps the conversational feel while preserving the
  parser contract.
- **No auto-bundling in Artifact mode.** The user/inbound flag determines the **write
  set** — only what was asked. Multiple artifacts only when genuinely required (e.g. a new
  context needs both a charter and an SDR); confirm before writing.

### Pattern: craft-vs-structural escalation (for implementer-style agents)

Use when the agent receives user feedback on its work (developer is the canonical
example). Without this pattern, every user nudge routes back up the chain (architect or
designer agent), turning a code-craft refinement into a documented design change. That
churns the upstream agent's memory and the ADR with information that isn't
requirement-relevant.

- **Define the two kinds of change** in `<role_identity>` or a `<craftsmanship_charter>`
  sub-block:
  - **Craft change** — different name, split function, refactor for clarity, refusing a
    plan-prescribed craft-level anti-pattern. Stays with the implementer. Silent. The
    upstream artifact (ADR / plan) is untouched.
  - **Structural change** — the code now expresses a different decision than the upstream
    artifact records (boundary, data shape, integration pattern, an `[IRREVERSIBLE]`
    consequence the artifact did not anticipate, a functional or business requirement the
    plan did not cover). Escalates upstream.
- **`<decision_authority>` says "Escalate to <upstream> on structural conflict only".**
  Craft pushback is autonomous. Absorbing user craft feedback does not escalate.
- **Grey-zone rule.** If feedback might be craft or might be structural and the agent
  genuinely cannot tell, ask the user one question — *"Is this a craft change (I handle
  it) or a design change (I'll loop in <upstream>)?"* — rather than defaulting to
  escalation.
- **Rejection handling step in `<instructions>`:** classify first (craft / structural /
  grey-zone), then route. Craft → handle, re-test, re-request. Structural → surface, wait
  for upstream response. Grey-zone → one user question.
- **Phase-summary field** (if one exists): name it *structural-only* (e.g. `Pushed back
  on (structural only)`) so the developer can't smuggle craft pushback into an
  architect-routed signal.

---

## Validation Checklist — delete this section after authoring

- [ ] **Agent, not workflow:** the task is genuinely open-ended; any deterministic procedure is in a skill/script.
- [ ] Frontmatter: `name` matches filename; `description` leads with the trigger; `tools` is least-privilege.
- [ ] Every component is wrapped in its `snake_case` XML tag; tags are opened and closed; no stray outer `<output>` wrapper.
- [ ] `<role_identity>` is under 50 tokens, uses a real job title, contains no banned flattery words.
- [ ] `<operating_constraints>` does **not** reference `mast.yaml` (designer-only asset). Token semantics are cited from `tokens.yaml` via `<interaction_model>`, not restated here.
- [ ] `<domain_vocabulary>` (optional) — when present, 15-30 terms in 3-5 clusters; named frameworks attributed; every term passes the 15-year practitioner test.
- [ ] Every entry in `<deliverables>` names a concrete, verifiable artifact type with a path.
- [ ] `<decision_authority>` has all three lines; "Out of scope" names the agent that owns each excluded item.
- [ ] `<instructions>` steps are imperative, ordered, use explicit IF/THEN; total ≤ ~2000 tokens.
- [ ] `<instructions>` opens with a **parallelize-independent-reads** directive naming the read-only steps that batch into one tool-use call.
- [ ] Pre-flight step references CLAUDE.md `## Pre-flight protocol`; only per-check semantics are declared inline.
- [ ] **No inline `**Avoid (FM-x.x):**` cues anywhere.** Behavioural drift is covered by the single **closing self-check** block at the end of `<instructions>`. Coverage is verifiable by `grep -c 'Avoid (FM-' <file>` returning `0`.
- [ ] **Closing self-check** block is present at the end of `<instructions>`: 4–6 plain-language bullets, no FM-code citations, covering role / completeness / determinism / delegation / role-specific evidence rules / memory.
- [ ] **Anti-restatement:** no rule appears in all three of `<operating_constraints>`, `<instructions>`, and `<completion_criteria>`. Each rule has one home.
- [ ] Every file/artifact selection step uses a deterministic key — explicit reference or lexicographic order, never filesystem mtime.
- [ ] `<completion_criteria>` conditions are observable; at least one "NOT done until ..." guard is present.
- [ ] Every cap, limit, or ceiling is numeric (`≤N`, exact count, byte/line cap) — no adjective-only ceilings.
- [ ] `<interaction_model>` lists flag tokens emitted and consumed, each cited from `tokens.yaml`; no token is invented in the agent file.
- [ ] `<output_format>` is the last tag and is copy-exact. Verdict tokens are exact strings on their own lines.
- [ ] **Optional patterns** — if the agent is conversational, the **dual-mode pattern** is applied (`<modes>` block + step-2 dispatch + per-mode `<output_format>`). If the agent receives user feedback on its work, the **craft-vs-structural escalation pattern** is applied (rejection-classification step + grey-zone rule + structural-only push-back field).
- [ ] Total definition lands in the 15-40% context-window utilisation zone — trim or extract to a skill if over.
