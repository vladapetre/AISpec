---
name: documenting
description: >
  Routes structured artifact writes — analysis reports, ADRs, implementation plans,
  bounded-context charters, context maps, strategic decision records (SDRs), and
  glossary entries — to template files under `.claude/skills/documenting/templates/`,
  with shared filename derivation, audience detection, and confidence markers. Use
  this skill when the user says "write a report", "document this", "create an ADR",
  "draft a plan", "write a charter", "map the contexts", "add a glossary entry", or
  when a structured artifact must be produced from an unstructured discussion.
  Invoke standalone via `/documenting`, or load via the `skills:` frontmatter field
  on the analyst, architect, and consultant agents.
---

# Skill: documenting

Central registry for output-format conventions and artifact templates. Agents load this skill to get shared formatting rules and a pointer to the right template.

**Shape:** linear. Dual-mode — standalone via `/documenting`, or loaded via `skills:` frontmatter.

---

## Template registry

| Artifact type             | Template                             | Produced by  |
|---------------------------|--------------------------------------|--------------|
| Analysis report           | `templates/report.md`                | analyst      |
| ADR (tactical)            | `templates/adr.md`                   | architect    |
| Implementation plan       | `templates/plan.md`                  | architect    |
| Progress                  | `templates/progress.md`              | developer    |
| Bounded context charter   | `templates/charter.md`               | consultant   |
| Context map               | `templates/context-map.md`           | consultant   |
| Strategic decision (SDR)  | `templates/sdr.md`                   | consultant   |
| Glossary entry            | `templates/glossary.md`              | consultant   |

Read the template for your artifact type before writing. Worked examples (`report`, `adr`, `plan`, `progress`) live in `examples/<type>.md` — read only if uncertain about tone or section shape after reading the template.

**Tactical ADR vs SDR.** `adr.md` is for tactical decisions (architect — implementation patterns, component design, API shape within a context). `sdr.md` is for strategic decision records (consultant — subdomain investment, context boundaries, build/buy/outsource, relationship pattern). The file name is the disambiguator: never use `adr.md` for a strategic decision. Numbering is independent: tactical at `artifacts/adr/NNNNN-*`, strategic at `artifacts/strategy/decisions/NNNNN-*`.

---

## Shared conventions

### Audience detection

| Signal in request | Audience |
|---|---|
| "stakeholder", "executive", "non-technical", "business" | stakeholder — omit implementation detail |
| "developer", "engineer", "implementer", "codebase" | developer — include implementation detail |
| "collaborator", "team" | collaborator |
| Multiple match | ask which one |
| No match | technical collaborator |

**Per artifact type:**

| Type | Audience rule |
|---|---|
| Analysis report | Run detection above |
| ADR (tactical) | Always developer |
| Implementation plan | Always developer |
| Charter | Always strategic-stakeholder |
| Context map | Always strategic-stakeholder |
| SDR | Always strategic-stakeholder |
| Glossary | Always mixed — business-language definition first, implementation pointer second |
| Progress | Always developer |

Only analysis reports run detection. All other types use the fixed audience.

### Filename derivation

Derived deterministically by `scripts/filename.mjs`. Run it — do not derive by hand:

```bash
node .claude/skills/documenting/scripts/filename.mjs <type> "<subject>"
```

Supported types: `report`, `adr`, `plan`, `sdr`, `charter`, `context-map`, `glossary`, `progress`.

`<subject>` is the subject noun phrase from the request. The script strips a leading meta verb, lowercases, drops stopwords, hyphenates, truncates to 5 tokens, then applies a per-type suffix and (where applicable) a zero-padded 5-digit sequence prefix scanned from the host directory.

| Input subject | Type | Stem |
|---|---|---|
| "Analysis of the Auth Middleware" | report | `auth-middleware-analysis` |
| "Design of the Auth Middleware" | adr | `00002-auth-middleware` |
| "Design of the Auth Middleware" | plan | `00002-auth-middleware` (after paired ADR exists) |
| "Plan for migrating the user service to gRPC" | plan | `migrating-user-service-grpc` (unprefixed — no matching ADR) |
| "Build vs buy for payments" | sdr | `00001-build-vs-buy-payments` (scans `artifacts/strategy/decisions/`) |
| "Charter for the Billing context" | charter | `billing-context-charter` |
| "Context map for the platform" | context-map | `platform-context-map` |
| "Glossary for the Order domain" | glossary | `order-domain-glossary` |
| "auth rewrite" | progress | `plan-auth-rewrite-progress` |

For a paired ADR and plan, run with the **same** `<subject>` for each — write the ADR first so the plan inherits the prefix. SDR numbering is independent of ADR numbering; the script scans `artifacts/strategy/decisions/` for SDR sequence and `artifacts/adr/` for ADR sequence.

### Confidence markers

Marker strings (`[VERIFIED]`, `[INFERRED]`, `[ASSUMED]`) are defined in `tokens.yaml`. This section defines *when* to apply each. First match wins:

1. Direct quote, observable fact, or value readable from the source without reasoning → **[VERIFIED]**
2. Follows necessarily from one or more VERIFIED facts via explicit deductive steps → **[INFERRED]**
3. Source does not address the finding, or the finding requires assumptions not grounded in the source → **[ASSUMED]**

A finding that mixes verifiable and inferred content takes the weakest marker that applies. Split into sub-points to keep verified parts `[VERIFIED]`. Confidence markers do not apply to ADRs or plans.

---

## Steps (standalone invocation)

When invoked directly as `/documenting`:

1. No subject, notes, or sources → ask "What should I document? Provide a subject and any notes or sources." Stop.
2. Identify artifact type. Analysis report → run **Audience detection**. ADR or plan → skip (always developer).
3. Derive filename via `scripts/filename.mjs`.
4. Read the template for the artifact type.
5. Write the artifact using that template.
6. Write the memory entry defined in the template.
7. Output a one-paragraph summary: what was produced, where, and whether architect review is flagged.

Agents that load this skill for format reference join at step 3 once input is validated and artifact type known.

---

## Bundled resources

```
.claude/skills/documenting/
  SKILL.md              this file
  scripts/filename.mjs  deterministic filename-stem derivation (Node)
  templates/            one artifact skeleton per registered type (read on demand)
```
