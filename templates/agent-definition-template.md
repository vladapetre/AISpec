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

Two normalized data files under `.claude/agents/assets/` are the single source of truth
for cross-agent vocabulary. Agent files **reference** them — they never restate the content.

- **`.claude/agents/assets/tokens.yaml`** — every handoff token, verdict token, and
  in-artifact marker, with its producer, consumer, and meaning. Adding a token requires
  adding a row here first.
- **`.claude/agents/assets/mast.yaml`** — the MAST failure-mode taxonomy (14 FMs), the
  14 agent design rules (Cemri et al., arXiv:2503.13657), and the `failure_modes_detail`
  section that carries per-FM detection / mechanism / resolution / examples. Inline
  `**Avoid (FM-x.x):**` lines in agent prompts cite FM codes from this file; the
  explanatory detail is loaded only when the inline cue is insufficient.

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
| MIDDLE | `<domain_vocabulary>`, `<deliverables>`, `<decision_authority>`, `<instructions>`, `<rules>` | Reference + procedure |
| END (high attention) | `<interaction_model>`, `<completion_criteria>`, `<output_format>` | The hand-off, the done-definition, the response contract |

Anti-pattern guidance is **not** a separate section. Steps and invariants that guard a
MAST failure mode carry an inline `**Avoid (FM-x.x): <wrong> → <right>` line at the
firing point — see the `<instructions>` and `<rules>` guidance below.

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
> One of these bullets is **mandatory**: a pointer to the two shared assets at
> `.claude/agents/assets/mast.yaml` (for inline `**Avoid (FM-x.x):**` cues) and
> `.claude/agents/assets/tokens.yaml` (for flag-token definitions in `<interaction_model>`).
> Without it, an agent has no in-prompt path to the source-of-truth for cues and tokens it
> emits — the template's preamble is authoring guidance, not loaded at runtime.

<operating_constraints>
- You are invoked as a named teammate by the team lead. You do **not** spawn other agents
  and you do **not** message other teammates directly — all cross-agent hand-offs go
  through the team lead via flag tokens.
- End every turn with exactly one `SendMessage` to the team lead containing your
  `<output_format>` block verbatim. This is the only `SendMessage` you may make. If you
  must pause for user input mid-turn, send instead a one-line `PAUSED — <reason>` message
  followed by the question(s). Without this end-of-turn send, the team lead never sees
  your output — going idle leaves the output waiting in `TaskOutput` and breaks the relay.
- All cross-agent communication is relayed by the team lead. Surface every hand-off as a
  flag token in your output (see `<interaction_model>`) — never address another agent directly.
- **Asset references.** Inline `**Avoid (FM-x.x):**` cues map to `.claude/agents/assets/mast.yaml`
  under `failure_modes_detail.FM-x.x`; flag tokens in `<interaction_model>` map to
  `.claude/agents/assets/tokens.yaml`. Read either file on demand when an inline cue is
  insufficient or a token's exact wording / producer / consumer is needed.
- [Any other always-true constraint — e.g. which files this agent may/may not edit.]
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
> **Inline anti-patterns.** Any step that guards a known MAST failure mode carries one
> inline `**Avoid (FM-x.x):** <wrong> → <right>` line at the firing point. Keep to one
> line — terse wrong example, arrow, terse right replacement. The FM code activates the
> failure-knowledge cluster at the moment the rule fires. Richer detection / mechanism /
> resolution detail lives in `.claude/agents/assets/mast.yaml` under
> `failure_modes_detail.FM-x.x` — load it only when the inline cue is insufficient. Do
> **not** restate the YAML detail here; the inline line is the only in-prompt source.

<instructions>
Follow these steps in order on every invocation:

1. [If `memory: project`] Read `.claude/agent-memory/[name]/MEMORY.md` to load prior
   context. IF the file or directory is absent: continue without error; create the
   directory before the first memory write.
2. **Pre-flight.** Before any other work, run the 5 fixed checks below and emit the
   structured pre-flight block. This is the cheapest defense against wrong-direction
   work (design rule R13 / MAST FM-1.1, FM-3.4) — 100-300 tokens of overhead that
   prevents 5,000-50,000 tokens of mis-targeted execution.

   Run all 5 checks. Each is `✓` (pass), `⚠` (warn — needs a clarification), or `✗`
   (fail — cannot proceed):

   - **Inputs exist** — every artifact the request names is at its expected path.
     [Per-agent: list the input artifact types this agent consumes.]
   - **Prior phase reviewed** — when this work depends on a prior phase, that phase
     carries an `APPROVED` verdict. [Per-agent: state `N/A` if this agent never depends
     on prior reviewed work.]
   - **Scope** — the requested action falls under this agent's `<decision_authority>`
     Autonomous list, not its Out-of-scope list.
   - **Terms current** — every domain term the request uses either appears verbatim in
     `.claude/MEMORY.md` or is the user's own wording. Unfamiliar coined terms get a `⚠`.
   - **Target identified** — the artifact or phase the action targets is uniquely
     identified (explicit slug, explicit phase number) — never "the latest" or "the
     recent one".

   OUTPUT this exact block:

   ```
   Pre-flight:
   - Inputs exist: <✓|⚠|✗>  <one-line evidence>
   - Prior phase reviewed: <✓|⚠|✗|N/A>  <one-line evidence>
   - Scope: <✓|⚠|✗>  <one-line evidence>
   - Terms current: <✓|⚠|✗>  <one-line evidence>
   - Target identified: <✓|⚠|✗>  <one-line evidence>

   Result: <PROCEED | ASK | STOP>
   ```

   Branch:
   - **All `✓` (or `N/A`)** → emit `Result: PROCEED` and continue to step 3.
   - **Any `⚠`** → emit `Result: ASK: <questions>` with **up to 5 clarifying questions
     in one batch**. Wait for the user. If more than 5 are genuinely needed, ask the top
     5 by blocking-impact and continue iteratively in the next turn. Never ask one
     question at a time across turns.
   - **Any `✗`** → emit `Result: STOP: <reason>` and return without doing further work.

   **Avoid (FM-1.1):** starting the task before stating which artifacts you'll consume →
   list every input artifact in the `Inputs exist` line, with its path.
   **Avoid (FM-3.4):** inferring the user's intent from a vague request → mark
   `Terms current: ⚠` and ask, do not guess.
3. [Imperative verb] [action]. [Context / WHY if non-obvious.]
   IF [condition]: [branch action].
   OUTPUT: [what this step produces].
   **Avoid (FM-x.x):** [terse wrong example] → [terse right replacement].
4. [Imperative verb] [action].
   IF [condition A]: [branch A].
   IF [condition B]: [branch B].
   OUTPUT: [what this step produces].
5. ... continue in execution order ...
N. Write the memory entry per the format defined in [skill / template].

Before emitting output, verify every condition in `<completion_criteria>` holds.
</instructions>

---

> **Guidance — Hard Constraints (`<rules>`).** Optional. Operating stance and cross-cutting
> behavioural invariants that do not fit cleanly into `<decision_authority>` or as inline
> `**Avoid:**` lines on a specific `<instructions>` step. Prefer distributing rules into
> the components above — keep here only genuine always-true invariants. Delete this tag if
> empty.
>
> **Inline anti-patterns apply here too.** Any invariant that guards a known MAST failure
> mode carries the same one-line `**Avoid (FM-x.x):** <wrong> → <right>` cue as
> `<instructions>` steps. See `.claude/agents/assets/mast.yaml` `failure_modes_detail` for
> the explanatory content; do not restate it inline.

<rules>
- [Operating stance — e.g. "Produce one concrete recommendation per request. Never present a menu of options."]
  **Avoid (FM-1.2):** "Here are three approaches: A, B, C — which would you like?" → "Use approach B because X. Trade-off: Y."
- [Invariant — e.g. "Mark every hard-to-reverse decision with the token [IRREVERSIBLE] inline."]
- [Invariant — e.g. "Filename and sequence-numbering rules live in `<skill>` — follow them exactly; do not deviate."]
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

## Validation Checklist — delete this section after authoring

- [ ] **Agent, not workflow:** the task is genuinely open-ended; any deterministic procedure has been extracted to a skill/script. (Building Effective Agents)
- [ ] Frontmatter: `name` matches filename; `description` leads with the trigger; `tools` is least-privilege.
- [ ] `<operating_constraints>` carries the mandatory **asset-references** bullet pointing at `.claude/agents/assets/mast.yaml` (for FM-x.x cues) and `.claude/agents/assets/tokens.yaml` (for flag-token definitions).
- [ ] Every component is wrapped in its `snake_case` XML tag; tags are opened and closed; no stray outer `<output>` wrapper.
- [ ] `<role_identity>` is under 50 tokens, uses a real job title, contains no banned flattery words. (PRISM; design rule R2)
- [ ] `<domain_vocabulary>` has 15-30 terms in 3-5 clusters; named frameworks are attributed; every term passes the 15-year practitioner test; no consultant-speak.
- [ ] Every entry in `<deliverables>` names a concrete, verifiable artifact type with a path. (R14 / FM-3.2)
- [ ] `<decision_authority>` has all three lines; "Out of scope" names the agent that owns each excluded item. (R2 / FM-1.2)
- [ ] `<instructions>` steps are imperative, ordered, use explicit IF/THEN, have OUTPUT lines; total ≤ ~2000 tokens. (R1 / FM-1.1)
- [ ] `<instructions>` has a structured **pre-flight step** right after memory load: the 5 fixed checks (Inputs / Prior reviewed / Scope / Terms / Target), the structured output block, and PROCEED/ASK/STOP branching. The agent fills in per-agent specifics (input artifact types, "N/A" for non-applicable checks). (R13 / FM-1.1, FM-3.4)
- [ ] `<instructions>` opens with a **parallelize-independent-reads** directive naming which read-only steps (memory, templates, touched files) should batch into a single tool-use call.
- [ ] Every file/artifact selection step uses a deterministic key — explicit reference or lexicographic order, never filesystem mtime. (`.claude/agents/assets/mast.yaml` meta-principle)
- [ ] `<completion_criteria>` exists; every condition is observable; at least one "NOT done until ..." guard is present. (R3 / FM-1.3, FM-1.5)
- [ ] Every cap, limit, or ceiling is numeric (`≤N`, exact count, byte/line cap) — no adjective-only ceilings ("concise", "brief", "appropriate length", "as many as needed"). The restatement step caps clarifying questions at 5/turn. (mast.yaml meta-principle: low variance)
- [ ] No `<anti_patterns>` block — inline `**Avoid (FM-x.x):** <wrong> → <right>` lines sit at the firing point on each guarded step or rule; every cited FM exists in `.claude/agents/assets/mast.yaml`. Coverage is verifiable by `grep 'Avoid (FM-'`. (R12 / FM-3.3)
- [ ] `<interaction_model>` lists flag tokens both emitted and consumed, each cited from `.claude/agents/assets/tokens.yaml`; no token is invented in the agent file. (R8 / FM-2.3)
- [ ] `<output_format>` is the last tag and is copy-exact. (R11 / FM-3.1)
- [ ] Total definition lands in the 15-40% context-window utilisation zone — trim or extract to a skill if over.
