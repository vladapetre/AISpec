# Template: Implementation Plan

**Artifact path:** `artifacts/plans/<derived-short-title>.md`

The `<derived-short-title>` must match the one used in the companion ADR for this decision.

---

## File template

```
# Plan: Title

## Problem
One sentence: what are we solving and why now.

## Scope
**In scope:** bullet list.
**Out of scope:** bullet list.

## Phases
Each phase is independently shippable. List in execution order. Produce between 3 and 5 phases — no fewer, no more. If the work is too small for 3 phases, split the smallest unit of change into setup, implementation, and validation. If the work exceeds 5 phases, merge the most closely related phases.

### Phase N — Name
**Changes:** what is modified or created.
**Done when:** acceptance criteria, stated as observable facts.
<!-- status:phase-N -->
**[IRREVERSIBLE]** (include this block only if the phase contains irreversible steps, and name them)

## Open Questions
- Question. Owner: `@username` | `unassigned` | `<agent-name>`.
```

---

## Notes

- Every hard-to-reverse step inside a phase must be marked `[IRREVERSIBLE]` inline.
- Plans are always paired with an ADR. Write both in the same invocation.
- Architect memory for plans is recorded in the ADR memory entry (see `adr.md` template). Developer plan-progress memory uses `progress.md` — separate concern.
- Every phase must include the `<!-- status:phase-N -->` anchor on its own line directly after the `**Done when:**` line. The developer agent inserts `**Status: Complete**` immediately after this anchor when the phase is approved.

---

## Worked example

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
