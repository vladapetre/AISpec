# Worked Example: Analysis Report (abbreviated)

Subject: "Analysis of the Auth Middleware". Derived short title: `auth-middleware-analysis`. Audience: developer (request mentioned "codebase").

**Artifact path:** `artifacts/reports/auth-middleware-analysis.md`

This excerpt shows only the headers and one filled-out finding so the shape, confidence markers, and theme derivation are unambiguous. The full report would expand every section per the template.

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
The middleware exposes `Wrap(handler http.Handler) http.Handler` and is mounted in `cmd/gateway/main.go:42`. Every request runs through `jwt.Validate` (line 17) before the wrapped handler is invoked. Validation is unconditional: there is no short-circuit for already-validated requests, even when the request arrives over the internal mesh.

This pattern is duplicated identically in the `orders` and `billing` services, which both wrap their HTTP mux with the same middleware. The result is that a single inbound request to a fan-out endpoint causes JWT validation in the gateway and again in each downstream, three validations per request in the common path.

### pkg/auth/jwt.go [INFERRED]
[finding body, derived from validator implementation and benchmark file…]

### cmd/gateway/main.go [VERIFIED]
[finding body…]

## Dependencies and Relationships
- Depends on: `github.com/golang-jwt/jwt/v5` (validation), `pkg/authclaims/` (not yet present).
- Depended on by: every HTTP entry point in `cmd/gateway`, `cmd/orders`, `cmd/billing`.

## Risks and Unknowns
- **[RISK]**: Removing duplicate validation without trusted transport opens header-spoofing surface.
- **[UNKNOWN]**: Clock skew tolerance currently allowed by `jwt.Validate` is not documented in code or comments.
- **[ASSUMPTION]**: Read 12 of 14 files in `pkg/auth/`; the two excluded are test fixtures unreferenced from production code.
- **[RISK]**: Rotation cadence for the signing key is owned externally; failure modes during rotation are not surfaced in any of the read sources.
- **[ASSUMPTION]**: The dominant p99 contributor claim is grounded in the existing benchmark file but not validated against production traces.

## Recommendations
1. [ARCHITECT REVIEW NEEDED] Eliminate per-hop validation in favour of signed claims forwarding (see `pkg/auth/middleware.go` finding above).
2. Add a benchmark that measures fan-out latency contribution from `jwt.Validate` so the impact claim can be re-verified.
3. Document the skew tolerance in `pkg/auth/jwt.go` directly above the `Validate` function.
4. Audit any non-mesh ingress that bypasses the gateway: these would need to keep per-hop validation if signed claims forwarding is adopted.

## Glossary
- **JWT**: *(common acronym; omit per template rule)*
- **Fan-out endpoint**: A gateway endpoint that issues parallel requests to multiple downstream services to assemble a single response.
```
