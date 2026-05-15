# Template: Analysis Report

**Artifact path:** `artifacts/reports/<derived-short-title>.md`

---

## File template

```
# Analysis: Title

**Date:** YYYY-MM-DD
**Audience:** developer | stakeholder | collaborator | <as declared>
**Sources:** list every source ingested

---

## Executive Summary
Exactly 4 sentences in this fixed order: (1) What this subject is. (2) Why it matters or what problem it solves. (3) The single most important finding. (4) What the reader should do with this information. Written for any audience — no jargon.

## Background and Context
Exactly 2 paragraphs, ≤150 words total. First paragraph: what the subject is and where it lives. Second paragraph: why it exists and what problem it solves. Assume no prior knowledge of this specific subject.

## Structure and Organisation
One paragraph (≤80 words) describing the overall shape, then a bullet list of components — no more than 10 bullets. For code: list modules, layers, and entry points. For documents: list sections and their purpose. For data: list tables, entities, or event types with their schema shape.

## Key Concepts
One subsection per Findings theme, capped at 5. For each theme, include its concept only if the term is domain-specific and not defined by common English or a widely-known acronym. If a theme has no such term, skip it — do not pad to reach a count. Each subsection:
- Names the concept
- Explains what it is
- Explains why it matters in this context
- Gives a concrete example from the source

## Findings
Detailed walkthrough of what was discovered. This is the verbose core of the report.

Derive the theme list directly from the source structure — do not invent themes:
- Code: one theme per top-level module, package, or architectural layer.
- Documents: one theme per top-level section of the source document.
- Data/logs: one theme per top-level entity, table, or event category.

Each theme is one subsection (### heading) titled exactly as the module/section/entity is named in the source. Each subsection must be at least 2 paragraphs.

Each ### heading must carry a confidence marker. Apply the rules defined in `SKILL.md` under **Confidence markers** — do not re-derive them here.

## Dependencies and Relationships
What this subject depends on, and what depends on it. Always produce a bullet list. If the list has more than 5 items, also add an ASCII diagram below it.

## Risks and Unknowns
Between 3 and 5 items total across the three categories (at least 3, no more than 5). Populate genuine RISK and UNKNOWN items first; add ASSUMPTION entries only if they add real analytical value. Never fabricate risks or assumptions to reach a count.
Each item on its own line: **[RISK | UNKNOWN | ASSUMPTION]** — description.

## Recommendations
Exactly 4 items, ordered by priority (most important first). Each item must be a concrete, actionable instruction — not a general principle.
Flag items needing architectural input with [ARCHITECT REVIEW NEEDED].

## Glossary
One entry per term that meets both conditions: (1) it appears in the Findings section, and (2) it is not a common English word or widely-known acronym (REST, API, JSON, HTTP). Do not add terms that do not appear in Findings. Do not omit terms that do.
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/analyst`
**Index file:** `.claude/agent-memory/analyst/MEMORY.md`
**Memory file path:** `.claude/agent-memory/analyst/report-<derived-short-title>.md`

```
---
name: report-<derived-short-title>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
Analysed <subject> for <audience>.
**Key findings:** <2-3 sentence summary of the most important discoveries>.
**[ARCHITECT REVIEW NEEDED]:** <list items flagged, or "none">.
**Artifact:** artifacts/reports/<derived-short-title>.md
```

**Index entry** — append one line to `MEMORY.md`:

```
- [Report: Title](report-<derived-short-title>.md) — <what was analysed> + <single most important finding>, ≤100 characters
```

---

## Worked example (abbreviated)

Subject: "Analysis of the Auth Middleware". Derived short title: `auth-middleware-analysis`. Audience: developer (request mentioned "codebase").

**Artifact path:** `artifacts/reports/auth-middleware-analysis.md`

This excerpt shows only the headers and one filled-out finding so the shape, confidence markers, and theme derivation are unambiguous. The full report would expand every section per the template above.

```
# Analysis: Auth Middleware

**Date:** 2026-05-15
**Audience:** developer
**Sources:** pkg/auth/middleware.go, pkg/auth/jwt.go, cmd/gateway/main.go

---

## Executive Summary
The auth middleware validates JWTs on every request hop in the API gateway and the downstream services it fans out to. It exists to enforce request authentication and to surface caller identity to handlers. The most important finding is that JWT validation is repeated N times per fan-out request, which is the dominant contributor to the gateway's p99 latency. Readers planning to refactor the middleware should pair this report with [ARCHITECT REVIEW NEEDED] item 1 below.

## Background and Context
[two paragraphs, ≤150 words…]

## Structure and Organisation
[one paragraph + bullet list of modules…]

## Key Concepts
### Signed claims forwarding
[concept body…]

## Findings

### pkg/auth/middleware.go [VERIFIED]
The middleware exposes `Wrap(handler http.Handler) http.Handler` and is mounted in `cmd/gateway/main.go:42`. Every request runs through `jwt.Validate` (line 17) before the wrapped handler is invoked. Validation is unconditional — there is no short-circuit for already-validated requests, even when the request arrives over the internal mesh.

This pattern is duplicated identically in the `orders` and `billing` services, which both wrap their HTTP mux with the same middleware. The result is that a single inbound request to a fan-out endpoint causes JWT validation in the gateway and again in each downstream — three validations per request in the common path.

### pkg/auth/jwt.go [INFERRED]
[finding body — derived from validator implementation and benchmark file…]

### cmd/gateway/main.go [VERIFIED]
[finding body…]

## Dependencies and Relationships
- Depends on: `github.com/golang-jwt/jwt/v5` (validation), `pkg/authclaims/` (not yet present).
- Depended on by: every HTTP entry point in `cmd/gateway`, `cmd/orders`, `cmd/billing`.

## Risks and Unknowns
- **[RISK]** — Removing duplicate validation without trusted transport opens header-spoofing surface.
- **[UNKNOWN]** — Clock skew tolerance currently allowed by `jwt.Validate` is not documented in code or comments.
- **[ASSUMPTION]** — Read 12 of 14 files in `pkg/auth/`; the two excluded are test fixtures unreferenced from production code.
- **[RISK]** — Rotation cadence for the signing key is owned externally; failure modes during rotation are not surfaced in any of the read sources.
- **[ASSUMPTION]** — The dominant p99 contributor claim is grounded in the existing benchmark file but not validated against production traces.

## Recommendations
1. [ARCHITECT REVIEW NEEDED] Eliminate per-hop validation in favour of signed claims forwarding (see `pkg/auth/middleware.go` finding above).
2. Add a benchmark that measures fan-out latency contribution from `jwt.Validate` so the impact claim can be re-verified.
3. Document the skew tolerance in `pkg/auth/jwt.go` directly above the `Validate` function.
4. Audit any non-mesh ingress that bypasses the gateway — these would need to keep per-hop validation if signed claims forwarding is adopted.

## Glossary
- **JWT** — *(common acronym; omit per template rule)*
- **Fan-out endpoint** — A gateway endpoint that issues parallel requests to multiple downstream services to assemble a single response.
```
