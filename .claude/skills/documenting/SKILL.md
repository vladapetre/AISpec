---
name: documenting
description: >
  Use this skill whenever an agent needs to write an analysis report, ADR (architectural
  decision record), or implementation plan to the `artifacts/` directory. Defines the
  filename derivation rules, audience detection, confidence markers, and routes each
  artifact type to its template file under `templates/`. Triggers include "write a report",
  "document this", "create an ADR", "draft a plan", or any request that produces a
  structured artifact for the analyst or architect agents. Invoke standalone via
  `/documenting`, or load via the `skills:` frontmatter field on an agent.
---

# Skill: documenting

Central registry for output format conventions and artifact templates. Agents load this skill to get shared formatting rules and a pointer to the correct template for their artifact type.

---

## Template registry

| Artifact type       | Template file                              | Produced by  |
|---------------------|--------------------------------------------|--------------|
| Analysis report     | `templates/report.md`                      | analyst      |
| ADR                 | `templates/adr.md`                         | architect    |
| Implementation plan | `templates/plan.md`                        | architect    |
| Progress            | `templates/progress.md`                    | developer    |

Read the template file for your artifact type before writing any output.

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

Audience detection applies to analysis reports only. ADRs and plans are always written for developers.

### Filename derivation

Apply this algorithm exactly. Do not paraphrase or shortcut steps.

1. Take the **subject noun phrase** from the request — the thing being analysed/designed/planned. Strip any meta verbs / prefixes from this exact list (case-insensitive, match at the start of the subject only): `Analysis of`, `Design of`, `Plan for`, `Review of`, `Audit of`, `Spec of`, `Spec for`, `Specification of`, `Specification for`, `Scope of`, `Migration to`, `Migration of`, `Refactor of`, `Document`, `Documentation of`. If none match, leave the subject as-is.
2. Lowercase the result.
3. Remove all tokens that exactly match this stopword list (case-insensitive):
   `a, an, the, of, for, to, in, on, at, with, and, or, but, by, from, as, into, our, your, my, this, that, these, those`
4. Replace any non-alphanumeric character with a single hyphen. Collapse runs of hyphens. Trim leading/trailing hyphens.
5. Keep the first N tokens (after hyphenation):
   - Analysis reports: N = 3, then append `-analysis`. If fewer than 3 tokens remain, keep all remaining tokens, then append `-analysis`. Do not pad.
   - ADRs and plans: N between 3 and 5 inclusive — take all remaining tokens if ≤ 5, else the first 5. If fewer than 3 tokens remain, keep all remaining tokens. Do not pad and do not append a suffix.
6. For ADRs only: prepend the zero-padded 5-digit sequence number (`NNNNN-`). Scan `artifacts/adr/` for the highest existing number and increment by 1. If `artifacts/adr/` is empty or missing, start at `00001`.

**Worked examples** (apply each step in order):

| Input subject | Step 1 (strip meta) | Step 3 (drop stopwords) | Step 5 (take N) | Final |
|---|---|---|---|---|
| "Analysis of the Auth Middleware" | "the Auth Middleware" | "auth middleware" | report, N=3 | `auth-middleware-analysis` |
| "Design of the Auth Middleware" | "the Auth Middleware" | "auth middleware" | adr/plan, N≤5 | `auth-middleware` (+ `00002-` prefix for ADR) |
| "Plan for migrating the user service to gRPC" | "migrating the user service to gRPC" | "migrating user service grpc" | adr/plan, N=4 | `migrating-user-service-grpc` |
| "Stripe webhook idempotency analysis" | "Stripe webhook idempotency" | "stripe webhook idempotency" | report, N=3 | `stripe-webhook-idempotency-analysis` |

The derived short title must be identical across the paired ADR and plan (ADR adds the numeric prefix, plan does not).

### Confidence markers

Apply to individual findings in analysis reports (per `### heading`). Use the first rule that matches:

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
3. Derive the short title using the **Filename derivation** rules above.
4. Read the template for the artifact type from the **Template registry**.
5. Write the artifact using that template.
6. Write the memory entry as defined in the template file.
7. Output a one-paragraph summary: what was produced, where it was written, and whether architect review is flagged.

Agents that load this skill for format reference and have already completed steps 1–3 should skip to step 4.
