# Template: Progress (developer plan-progress memory)

**Memory directory:** `.claude/agent-memory/developer`
**Index file:** `.claude/agent-memory/developer/MEMORY.md`
**Memory file path:** `.claude/agent-memory/developer/plan-<derived-short-title>.md`

If the memory directory does not exist, create it. If `MEMORY.md` does not exist, create it with the heading `# Developer Memory` on the first line.

One memory file per plan. Create it when the first phase of a plan completes. Update it in place after each subsequent phase — do not create additional files.

---

## File template

```
---
name: plan-<derived-short-title>
description: <one sentence — used to judge relevance in future sessions>
metadata:
  type: project
---
Plan: <title>. Artifact: artifacts/plans/<derived-short-title>.md

**Phase N — Title:** Complete | In Progress | Rejected
  - <one sentence on what was done and any notable deviation>

(repeat one line per phase as they are completed)

**How to apply:** <what future plans this informs>.
```

---

## Index entry

Add once when the memory file is first created. Do not duplicate on later updates.

```
- [Plan: Title](plan-<derived-short-title>.md) — <one-line hook>
```

---

## Worked example

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

**Phase 1 — Internal claims header schema and signing helper:** Complete
  - Added pkg/authclaims with signer, verifier, round-trip and skew tests. No deviations.

**How to apply:** Future plans that touch identity propagation should reuse pkg/authclaims rather than re-implementing signing.
```

**Index entry:**

```
- [Plan: Auth Middleware](plan-auth-middleware.md) — migration from per-hop JWT to signed claims forwarding
```
