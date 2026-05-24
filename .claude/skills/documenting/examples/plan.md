# Worked Example: Implementation Plan

Subject: "Design of the Auth Middleware". Pairs with `artifacts/adr/00002-auth-middleware.md`.

**Artifact path:** `artifacts/plans/auth-middleware.md`

```
# Plan: Auth Middleware

## Problem
JWTs are re-validated per hop, blowing the p99 latency budget on fan-out endpoints. We need single-point validation at the edge with trusted internal claims forwarding.

## Scope
**In scope:**
- Edge JWT validation in the API gateway.
- Internal signed claims header (schema, signing, verification helper).
- Rollout to two downstream services as pilot (`orders`, `billing`).

**Out of scope:**
- mTLS enforcement at downstream ingress (tracked separately in the platform plan).
- Token issuance changes — the issuer remains untouched.

## Phases

### Phase 1 — Internal claims header schema and signing helper
**Changes:** add `pkg/authclaims/` with header schema, signer, and verifier. Unit tests cover signing round-trip and skew tolerance.
**Done when:** `go test ./pkg/authclaims/...` passes; helper has no callers yet.
<!-- status:phase-1 -->

### Phase 2 — Gateway emits signed claims header
**Changes:** gateway validates JWT once, attaches signed header via the Phase 1 helper, forwards downstream. JWT validation remains in downstream services as a fallback (dual-mode).
**Done when:** integration test asserts header present on every forwarded request; existing JWT validation tests still pass.
<!-- status:phase-2 -->

### Phase 3 — Pilot downstream services trust the header
**Changes:** `orders` and `billing` services read the signed header first; fall back to JWT validation only if header is absent or invalid. Add metrics for header-trust vs. fallback rates.
**Done when:** staging traffic shows >99% header-trust rate for 24h; p99 latency on fan-out endpoints drops measurably.
<!-- status:phase-3 -->

### Phase 4 — Remove JWT validation from pilot services
**Changes:** delete JWT validation paths from `orders` and `billing` once header-trust rate is stable.
**Done when:** no JWT validation code paths remain in pilot services; metrics confirm zero fallback usage for 7 days.
<!-- status:phase-4 -->
**[IRREVERSIBLE]** — removing JWT validation means rollback requires redeploying the old binary. Confirm header-trust rate before executing.

## Open Questions
- Should the signing key be per-environment or per-cluster? Owner: `@security-team`.
- Acceptable skew window for short-lived claims? Owner: `architect`.
```
