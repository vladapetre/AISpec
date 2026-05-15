# Template: Architectural Decision Record (ADR)

**Artifact path:** `artifacts/adr/NNNNN-<derived-short-title>.md`

NNNNN is a zero-padded 5-digit integer, incremented from the highest existing ADR number. If no ADRs exist yet, start at `00001`.

Re-scan `artifacts/adr/` for the highest number **immediately before writing the file**, not at the start of the invocation — this minimises (but does not eliminate) the race window when two architect invocations run in parallel. If the target filename already exists when you go to write it, increment and retry up to 3 times. After 3 collisions, stop and surface the conflict to the user.

---

## File template

```
# ADR-NNNNN: Title

**Status:** Proposed
**Date:** YYYY-MM-DD

## Context
What forced this decision. State the binding constraints explicitly. 2–4 sentences.

## Decision
One paragraph. The chosen approach and why it satisfies the constraints.

## Consequences
**Gains:** 2–4 bullet points — what improves.
**Costs:** 2–4 bullet points — what gets harder or more expensive.
**Risks:** 2–4 bullet points — what could go wrong, one mitigation per risk.

## Alternatives Considered
### Alternative: name
Ruled out because: one sentence.
```

---

## Memory format

**Memory directory:** `.claude/agent-memory/architect`
**Index file:** `.claude/agent-memory/architect/MEMORY.md`
**Memory file path:** `.claude/agent-memory/architect/adr-NNNNN-<derived-short-title>.md`

If the memory directory does not exist, create it. If `MEMORY.md` does not exist, create it with the heading `# Architect Memory` on the first line.

```
---
name: adr-NNNNN-<derived-short-title>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
ADR-NNNNN chose <approach> for <system/component>.
**Why:** <the binding constraint that made this the right call>.
**How to apply:** <what future decisions this constrains or informs>.
**Artifacts:** artifacts/adr/NNNNN-<derived-short-title>.md, artifacts/plans/<derived-short-title>.md
```

**Index entry** — append one line to `MEMORY.md`:

```
- [ADR-NNNNN: Title](adr-NNNNN-<derived-short-title>.md) — <one-line hook>
```

---

## Worked example

Subject: "Design of the Auth Middleware". Derived short title: `auth-middleware` (per filename derivation rules in `SKILL.md`). Assume one ADR exists, so this is `00002`.

**Artifact path:** `artifacts/adr/00002-auth-middleware.md`

```
# ADR-00002: Auth Middleware

**Status:** Proposed
**Date:** 2026-05-15

## Context
The API gateway currently re-validates JWTs on every internal hop, doubling p99 latency for fan-out endpoints. Binding constraints: latency (p99 budget is 150ms), operability (security team owns key rotation). Reversibility is medium — middleware can be swapped within one release.

## Decision
Validate JWTs once at the edge, then forward a signed internal claims header to downstream services. Downstream services trust the header when the request arrives over the internal mesh. Satisfies latency by removing N-1 validations; satisfies operability by keeping rotation logic in one place.

## Consequences
**Gains:**
- p99 drops by ~40% on fan-out endpoints (estimated from current per-hop validation cost).
- Single rotation surface for the security team.
- Downstream services no longer carry JWT libraries.

**Costs:**
- Internal mesh must be trusted; misconfigured mesh boundaries become security bugs.
- New header schema to version and maintain.

**Risks:**
- Header spoofing if a service is reachable outside the mesh. *Mitigation:* enforce mTLS at every downstream ingress.
- Clock skew breaks short-lived signed claims. *Mitigation:* allow 30s skew; alert on >10s drift.

## Alternatives Considered
### Alternative: per-hop JWT validation (status quo)
Ruled out because: violates the latency constraint at expected fan-out depth.

### Alternative: opaque session tokens via Redis lookup
Ruled out because: introduces a synchronous external dependency on the auth path, harming both latency and availability.
```
