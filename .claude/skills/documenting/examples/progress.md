# Worked Example: Progress

Plan: `auth-middleware`. After Phase 1 completes:

**Memory file path:** `.claude/agent-memory/developer/plan-auth-middleware.md`

```
---
name: plan-auth-middleware
description: Progress tracker for the auth middleware migration from per-hop JWT validation to signed claims.
metadata:
  type: project
---
Plan: Auth Middleware. Artifact: artifacts/plans/auth-middleware.md

**Phase 1 (Internal claims header schema and signing helper):** Complete
  - Added pkg/authclaims with signer, verifier, round-trip and skew tests. No deviations.

**How to apply:** Future plans that touch identity propagation should reuse pkg/authclaims rather than re-implementing signing.
```

**Index entry:**

```
- [Plan: Auth Middleware](plan-auth-middleware.md): migration from per-hop JWT to signed claims forwarding
```
