# Worked Example: ADR

Subject: "Design of the Auth Middleware". Derived short title: `auth-middleware` (per filename derivation rules in `SKILL.md`). Assume one ADR exists, so this is `00002`.

**Artifact path:** `artifacts/adr/00002-auth-middleware.md`

```
# ADR-00002: Auth Middleware

**Status:** Proposed
**Date:** 2026-05-15

## Context
The API gateway currently re-validates JWTs on every internal hop, doubling p99 latency for fan-out endpoints. Binding constraints: latency (p99 budget is 150ms), operability (security team owns key rotation). Reversibility is medium: middleware can be swapped within one release.

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
