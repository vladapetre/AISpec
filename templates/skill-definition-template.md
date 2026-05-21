# Skill Definition Template

> **What this is.** A template for authoring Claude Code skills in
> `.claude/skills/<name>/SKILL.md`. It merges this project's existing skill conventions
> (the registry shape of `documenting` / `reviewing`, the dispatcher shape of `auditing`,
> the `## Steps (standalone invocation)` contract, and dual-mode standalone + agent-loaded
> use) with the progressive-disclosure and workflow-vs-agent guidance behind the agent
> system. It is the skill-side companion to `templates/agent-definition-template.md`.
>
> **Research basis.** Anthropic, *Building Effective Agents* — the workflow-vs-agent
> distinction and progressive disclosure. Anthropic Agent Skills documentation — SKILL.md
> as the entry point, bundled resources, the `description` field as the routing trigger.
> The MAST low-variance meta-principle and determinism rules in `./assets/mast.yaml`
> (Cemri et al., arXiv:2503.13657).
>
> **How to use.** Create the directory `.claude/skills/<name>/` and copy this file to
> `SKILL.md` inside it. Fill every `[...]` placeholder. Delete every `> **Guidance**`
> blockquote, every `<!-- ... -->` comment, the worked-example section, and the trailing
> validation checklist. Then run the checklist before committing.

---

## Before you author: three gates

### Gate 1 — skill, agent, or script?

Pick the right home for the work before writing anything.

- **Agent** — the task is genuinely open-ended: unpredictable steps, many turns, real
  judgement, a path that cannot be hardcoded. → use `agent-definition-template.md`.
- **Skill** — a repeatable procedure, or a body of reference content (registries,
  detection rules, derivation algorithms, format conventions) that is applied the same way
  every time but still needs a model to read and apply it. → this template.
- **Script** — fully deterministic logic that needs no model at all: a lookup table
  checked in order, a fixed shell sequence. → a script the skill or agent calls via `Bash`.

A skill is the **home** for the deterministic procedure that the agent template tells
agents to *extract* from their prompts. If your skill is drifting into open-ended
judgement work, it wants to be an agent. If a section of it needs no model at all, that
section wants to be a script (Gate 3).

### Gate 2 — which skill shape?

This project has two established skill shapes. Choose one before writing the body.

| Shape | Existing examples | Use when | Entry behaviour |
|---|---|---|---|
| **Linear** | `documenting`, `reviewing` | One entry path; every invocation runs the same procedure top to bottom, often after a registry lookup. | `## Steps (standalone invocation)` runs start to finish. |
| **Dispatcher** | `auditing` | Several distinct operations under one skill; each invocation names a subcommand. | `## Steps` is only the dispatch rule; `## Subcommands` holds one `### <name>` block per operation. |

Declare the chosen shape explicitly in the skill body — see *Skill-shape declaration*.

### Gate 3 — prose step or script?

For **every** procedure inside the skill, ask: *does applying it correctly need a model?*

- **Needs judgement** — interpreting a request, weighing signals, choosing an audience,
  classifying a finding → write it as prose steps in SKILL.md.
- **Fully deterministic** — an ordered detection table, a filename algorithm, a fixed
  `git` sequence → bundle it as a script under `scripts/` and have the step *call* it.
  Deterministic prose is re-executed by hand every invocation: slower, higher-variance,
  and harder to verify than the same logic in code (Anthropic, *Building Effective
  Agents*; `tmp/followup-deterministic-block-extraction.md`).

Borderline: a deterministic *lookup* whose result still feeds a model judgement (e.g.
`reviewing`'s framework detection) may stay as a table in SKILL.md — but it must be
written so it executes identically every time: stop-at-first-match order, explicit
tie-breaks, no ambiguity. If there is no judgement left after the lookup, make it a script.

---

## Shared assets

Two normalized data files under `./assets/` (i.e. `templates/assets/`) are the single
source of truth across agents and skills. Skills **reference** them — never restate them.

- **`tokens.yaml`** — every handoff token, verdict token, and in-artifact marker. If your
  skill emits or consumes a token (e.g. `reviewing` issues `APPROVED` / `CHANGES
  REQUIRED`), cite it from here. Adding a token requires adding a row there first.
- **`mast.yaml`** — the MAST failure taxonomy and its meta-principle: LLM steps are
  stochastic, so the achievable goal is **low variance + high accuracy**. Every
  deterministic rule a skill defines exists to serve that principle.

## Convention: plain markdown

Skill files use **plain markdown** — `##` / `###` headers, tables, fenced code blocks. No
XML tags. (The agent template uses XML because an agent prompt is a tightly-bounded,
nested instruction set; a SKILL.md is a linear reference document read top to bottom, and
all three existing skills are already plain markdown.) Reuse the existing heading names —
`## Steps (standalone invocation)`, `## Template registry`, `## Subcommands`, `## Rules` —
so every skill stays scannable side by side.

## Progressive disclosure & length budget

A skill loads in three stages — keep the always-on cost low:

| Stage | What loads | When |
|---|---|---|
| Routing | `name` + `description` only | always — the harness reads these to decide relevance |
| Body | the rest of SKILL.md | when the skill is invoked (description matched, `/<name>`, or `skills:` frontmatter) |
| Bundled | files under `templates/`, `scripts/`, `assets/` | on demand — only when a step reads or runs one |

Keep SKILL.md the lean core. Push large content out to bundled files: artifact skeletons →
`templates/`; deterministic logic → `scripts/`; bulk data tables → `assets/`. Rule of
thumb — if a section runs past ~150 lines or is a bulk data table, it belongs in a bundled
file the SKILL.md points to, not inline. The three existing skills are 80-120 lines; treat
that as the target range for SKILL.md itself.

## Section ordering

| Position | Sections | Why |
|---|---|---|
| Top | frontmatter, title + purpose, skill-shape declaration | routing + fast orientation |
| Middle | reference content — registries, detection rules, algorithms | the deterministic lookup core |
| Lower | Steps / Subcommands, Rules | the executable procedure |
| End | the output line(s) inside Steps, Bundled resources | the exact hand-off contract |

---

## YAML Frontmatter

> **Guidance.** Only these fields are read by the Claude Code skill loader. `description`
> is the routing trigger — same role as on an agent: lead with the trigger condition, name
> the concrete invocation phrases, write it in precise vocabulary. Use a YAML block scalar
> (`>`), as the existing skills do. `allowed-tools` is optional — set it only to *restrict*
> the skill to a subset of tools; omit it to inherit the caller's tools.

```yaml
---
name: [kebab-case — must match the skill's directory name]
description: >
  [One sentence: what the skill does and what it produces.] Use this skill when
  [precise, observable trigger conditions]. [Name the invocation paths — e.g.
  "Invoke standalone via `/<name>`, or load via the `skills:` frontmatter field on
  the <agent> agent."]
allowed-tools: [optional — comma-separated subset to restrict to; omit to inherit]
---
```

---

> **Guidance — Title & purpose.** One `# Skill: <name>` header, then one or two sentences
> on what the skill is and who loads it. Do not restate the `description`. This is the
> first thing read on invocation — orient the reader fast.

# Skill: [name]

[One or two sentences: what this skill is, and which agents or commands load it.]

---

> **Guidance — Skill-shape declaration.** State the shape (linear or dispatcher) and the
> invocation modes: standalone-only, or dual-mode (standalone `/<name>` **and** loadable
> via an agent's `skills:` frontmatter). `auditing` does this in a single
> `**Skill shape:**` line. This tells both a human reader and any agent loading the skill
> how to drive it. For a dispatcher, also state that every invocation must name a
> subcommand.

**Skill shape:** [linear | dispatcher]. [Standalone-only | Dual-mode — invoked via
`/<name>` and loadable via `skills:` on the <agent> agent.] [If dispatcher: every
invocation must name a subcommand.]

---

> **Guidance — Reference content (linear skills).** The deterministic core: template
> registries, detection rules, derivation algorithms, severity definitions — the lookup
> tables the skill exists to standardize. One `##` section per concern. Every table must
> execute **identically every time**:
> - Detection / lookup tables: state the scan scope, give an explicit order, and say
>   "stop at first match". Provide an explicit tie-break for every case where two rows
>   can match (see `reviewing`'s clean-architecture-vs-vertical-slice tie-break).
> - Algorithms: write "Apply this algorithm exactly. Do not paraphrase or shortcut
>   steps." (as `documenting`'s filename derivation does) and follow it with a
>   **worked-examples table** that runs real inputs through every step.
> - Never select a file or artifact by filesystem modification time — mtime is not
>   preserved across clone or checkout, so it makes runs diverge (`mast.yaml`
>   meta-principle). Select by an explicit key, with lexicographic order as the fallback.
> - Do not restate rules that another skill already owns — reference that skill instead.
>
> Omit this whole block for a pure dispatcher skill that has no shared reference content.

## [Reference section — e.g. Template registry / Detection rules / Severity definitions]

[The table or algorithm. For a registry, include the columns: artifact/case, bundled
file, and producer/trigger. For a detection table, include scan scope + stop-at-first-match
order + tie-breaks. For an algorithm, include the numbered steps + a worked-examples table.]

---

> **Guidance — Steps (standalone invocation).** The entry procedure. Present in **every**
> skill — for a dispatcher it is just the dispatch rule.
> - Step 1 always validates input: if a required input is missing, state the exact
>   question, then "Stop until answered." (every existing skill does this).
> - Imperative verbs; explicit `IF [condition]: [action]` for branches.
> - Reference bundled files by path — "Read `templates/<file>`" — never inline their
>   content.
> - The final step states the exact output: a one-line confirmation, or a structured
>   block. Make it copy-exact if anything downstream parses it (MAST FM-3.1).
> - **Dual-mode reconciliation:** if the skill is also loaded by an agent, say which
>   steps the agent has already done and where it joins — `documenting` ends with
>   "Agents that load this skill ... should skip to step 4." Standalone and agent-loaded
>   runs must not diverge.

## Steps (standalone invocation)

Follow in order when invoked directly as `/[name]`:

1. [Validate input. IF a required input is missing: ask "[exact question]". Stop until
   answered.]
2. [Imperative step. IF [condition]: [branch].]
3. [Imperative step — reference a bundled file by path where one applies.]
4. ... continue in execution order ...
N. Output [the exact one-line confirmation or structured block].

[If dual-mode: Agents that load this skill and have already completed steps [X-Y] should
skip to step [Z].]

---

> **Guidance — Subcommands (dispatcher skills only).** Delete this entire block for a
> linear skill. For a dispatcher: the `## Steps` section above is the dispatch rule — parse
> the subcommand, reject an unknown or missing one with a `Usage:` line, dispatch to the
> matching `### <name>` section, and run exactly one subcommand per invocation. Then give
> one `### <subcommand>` section each, every section with a **When** line, the procedure,
> and the exact output line. See `auditing` for the canonical shape.

## Subcommands

### [subcommand]

**When:** [the exact invocation and trigger.]

[Procedure — imperative steps; reference bundled scripts/files by path.]

Output exactly one line: `[exact text]`

---

> **Guidance — Rules (optional).** Cross-cutting runtime invariants that do not fit a
> single step — e.g. `auditing`'s "Never write code into the session file." Keep only
> genuine always-true invariants; prefer placing guidance inside the relevant step.
> Delete this section if empty.

## Rules

- [Always-true invariant.]
- [Always-true invariant.]

---

> **Guidance — Bundled resources.** Document the skill's directory layout so a reader
> knows where on-demand content lives. Only list the subdirectories the skill actually
> uses. These sit **beside** SKILL.md — distinct from the repo-level `templates/assets/`.

## Bundled resources

```
.claude/skills/[name]/
  SKILL.md       this file — the always-loaded core
  templates/     artifact skeletons a step tells the reader to read
  scripts/       deterministic helpers a step calls via Bash (see Gate 3)
  assets/        bulk data files (yaml/json/csv) a step reads
```

---

## Worked example — making a detection rule deterministic

*(Template guidance — delete this section when authoring a real skill.)*

**Before** — a detection table that two runs could resolve differently:

> | Framework | Signal |
> |---|---|
> | typescript | the project uses TypeScript |

The signal is a judgement call, there is no scan scope, and nothing says what happens
when more than one framework matches.

**After** — the same table, deterministic (this is how `reviewing` actually writes it):

> Apply to the **changed files** and their sibling config files. Stop at first match per
> framework; a project may match several.
>
> | Framework | Signal (stop at first match, in order) |
> |---|---|
> | typescript | `tsconfig.json` present AND ≥1 changed file ends `.ts` / `.tsx` / `.mts` / `.cts` |
>
> Tie-break when both `clean-architecture` and `vertical-slice` match: count changed files
> covered by each concern's structural signal; load the higher; on an exact tie, load
> `clean-architecture`.

Same intent, but now every run produces the same result — which is the entire point of
putting the logic in a skill.

---

## Validation Checklist — delete this section after authoring

- [ ] **Gate 1:** this is a skill — not an agent (open-ended judgement) and not a pure
      script (no model needed). (*Building Effective Agents*)
- [ ] **Gate 2:** the skill shape (linear or dispatcher) is chosen and declared in the body.
- [ ] **Gate 3:** no fully-deterministic procedure is left as prose where a `scripts/`
      helper fits; borderline lookup tables are stop-at-first-match with explicit tie-breaks.
- [ ] Frontmatter: `name` matches the directory name; `description` leads with the trigger
      and names the invocation path(s); block scalar (`>`) used.
- [ ] `# Skill:` title + a one-or-two-sentence purpose that does not restate the description.
- [ ] Skill-shape declaration states shape **and** invocation modes (standalone / dual-mode).
- [ ] Every reference table states its scan scope, has an explicit order, says "stop at
      first match", and has a tie-break for every case two rows can match.
- [ ] Every algorithm says "apply exactly" and is followed by a worked-examples table.
- [ ] No step selects a file or artifact by filesystem modification time. (`mast.yaml`
      meta-principle)
- [ ] `## Steps (standalone invocation)` exists; step 1 validates input and stops if it is
      missing; the final step states the exact output. (MAST FM-3.1)
- [ ] Dual-mode skills reconcile the agent-loaded entry path with the standalone path.
- [ ] Dispatcher skills: the dispatch rule rejects an unknown/missing subcommand with a
      `Usage:` line; one `### <name>` section per subcommand, each with a **When** line.
- [ ] Any emitted or consumed token is cited from `tokens.yaml`; no token is invented here.
- [ ] Large content is in bundled files; SKILL.md itself lands in the ~80-150 line range.
