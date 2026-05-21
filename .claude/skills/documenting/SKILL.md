---
name: documenting
description: >
  Use this skill whenever an agent needs to write an analysis report, ADR (architectural
  decision record), implementation plan, bounded-context charter, context map, strategic
  decision record (SDR), or glossary entry to the `artifacts/` directory. Defines the
  filename derivation rules, audience detection, confidence markers, and routes each
  artifact type to its template file under `templates/`. Triggers include "write a report",
  "document this", "create an ADR", "draft a plan", "write a charter", "map the contexts",
  "ubiquitous language", or any request that produces a structured artifact for the
  analyst, architect, consultant, or developer agents. Invoke standalone via
  `/documenting`, or load via the `skills:` frontmatter field on an agent.
---

# Skill: documenting

Central registry for output-format conventions and artifact templates. Agents load this skill to get shared formatting rules and a pointer to the correct template for their artifact type.

**Skill shape:** linear. Dual-mode — invoked standalone via `/documenting`, and loaded via the `skills:` frontmatter field on the analyst, architect, consultant, and developer agents.

---

## Template registry

| Artifact type             | Template file                              | Produced by  |
|---------------------------|--------------------------------------------|--------------|
| Analysis report           | `templates/report.md`                      | analyst      |
| ADR (tactical)            | `templates/adr.md`                         | architect    |
| Implementation plan       | `templates/plan.md`                        | architect    |
| Progress                  | `templates/progress.md`                    | developer    |
| Bounded context charter   | `templates/charter.md`                     | consultant   |
| Context map               | `templates/context-map.md`                 | consultant   |
| Strategic decision (SDR)  | `templates/strategic-adr.md`               | consultant   |
| Glossary entry            | `templates/glossary.md`                    | consultant   |

Read the template file for your artifact type before writing any output.

**Tactical vs strategic ADRs.** `templates/adr.md` is for **tactical** technical decisions (architect — implementation patterns, component design, API shape within a context). `templates/strategic-adr.md` is for **strategic** business-aligned decisions (consultant — subdomain investment, context boundaries, build/buy/outsource, relationship pattern between contexts). Numbering is independent: tactical ADRs are `artifacts/adr/NNNNN-*`, strategic SDRs are `artifacts/strategy/decisions/NNNNN-*`.

---

## Shared conventions

All agents producing artifacts under this skill must follow these rules regardless of artifact type.

### Audience detection

Determine audience from the request:
- Contains "stakeholder", "executive", "non-technical", or "business" → **stakeholder** (omit implementation detail)
- Contains "developer", "engineer", "implementer", or "codebase" → **developer** (include implementation detail)
- Contains "collaborator" or "team" → **collaborator**
- Multiple of the above match → ask: "The request matches more than one audience. Which should I write for: [list matches]?"
- No match → **technical collaborator**

**Audience scope by artifact type:**

| Artifact type | Audience rule |
|---|---|
| Analysis report | Run audience detection above |
| ADR (tactical) | Always developer |
| Implementation plan | Always developer |
| Bounded context charter | Always strategic-stakeholder (business + tech leadership) |
| Context map | Always strategic-stakeholder |
| Strategic decision (SDR) | Always strategic-stakeholder |
| Glossary entry | Always mixed (business + developer) — use business-language definition first, implementation pointer second |
| Progress | Always developer |

Only analysis reports run audience detection. All other types use the fixed audience above.

### Filename derivation

The filename stem is derived deterministically by `scripts/filename.mjs` — a Node script that runs identically on Windows, macOS, and Linux. Run it — do not derive the name by hand:

```bash
node .claude/skills/documenting/scripts/filename.mjs <report|adr|plan> "<subject>"
```

`<subject>` is the subject noun phrase from the request — the thing being analysed/designed/planned. The script strips a leading meta verb, lowercases, drops stopwords, hyphenates, truncates to the per-type token budget (report = 3, ADR/plan = 5), appends `-analysis` for reports, and prepends the next zero-padded 5-digit sequence number for ADRs (scanning `artifacts/adr/`). It prints the stem on stdout.

| Input subject | Type | Printed stem |
|---|---|---|
| "Analysis of the Auth Middleware" | report | `auth-middleware-analysis` |
| "Plan for migrating the user service to gRPC" | plan | `migrating-user-service-grpc` |
| "Design of the Auth Middleware" | adr | `00002-auth-middleware` (prefix depends on `artifacts/adr/`) |
| "Stripe webhook idempotency analysis" | report | `stripe-webhook-idempotency-analysis` |

For a paired ADR and plan, run the script with the **same** `<subject>` for each — the base stem is identical (the ADR adds the numeric prefix, the plan does not). Artifact types without a script mode (charter, context map, SDR, glossary, progress) follow the naming convention in their own template file.

### Confidence markers

The marker strings (`[VERIFIED]`, `[INFERRED]`, `[ASSUMED]`) are defined in `templates/assets/tokens.yaml` — this section defines *when* to apply each. Apply to individual findings in analysis reports (per `### heading`). Use the first rule that matches:

1. Direct quote, observable fact, or value readable from the source without reasoning → **[VERIFIED]**
2. Follows necessarily from one or more VERIFIED facts via explicit deductive steps the reader could reproduce → **[INFERRED]**. A single VERIFIED fact is sufficient when the deduction is mechanical (e.g., reading a constant and stating its scope from the file path).
3. Source does not address the finding, or the finding requires assumptions not grounded in the source → **[ASSUMED]**

A finding that mixes verifiable and inferred content takes the **weakest** marker that applies to any part of it. Split the finding into separate sub-points if you want the verified parts to remain [VERIFIED].

Confidence markers do not apply to ADRs or plans.

---

## Steps (standalone invocation)

Follow in order when invoked directly as `/documenting`:

1. If the request does not include a subject, analysis notes, or source references, ask: "What should I document? Provide a subject and any notes or sources." Stop until answered.
2. Identify the artifact type from the request. If the artifact type is **analysis report**, determine the audience using the **Audience detection** rules above. If the artifact type is **ADR** or **plan**, skip audience detection — these are always developer-facing.
3. Derive the filename stem by running `scripts/filename.mjs` (see **Filename derivation**).
4. Read the template for the artifact type from the **Template registry**.
5. Write the artifact using that template.
6. Write the memory entry as defined in the template file.
7. Output a one-paragraph summary: what was produced, where it was written, and whether architect review is flagged.

Agents that load this skill for format reference run the same procedure: an agent that has already validated input and identified the artifact type joins at step 3.

---

## Bundled resources

```
.claude/skills/documenting/
  SKILL.md                    this file — the always-loaded core
  scripts/filename.mjs        deterministic filename-stem derivation (Node)
  templates/                  one artifact skeleton per registered type (read on demand)
```
