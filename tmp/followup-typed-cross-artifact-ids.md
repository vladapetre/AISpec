# Follow-up — Typed Cross-Artifact ID Vocabulary

**Predecessor:** Suggestion 8 of the synthesis review (Pattern 5 — *Typed cross-artifact ID vocabulary*) from `tmp/findings-_synthesis.md`.

**Status:** **Done — 2026-05-24.** Promoted from deferred after user pushback ("if you do not add them from the start, how will you know what to reference later"). The deferral logic conflated "the value is zero today" with "the cost is high today" — cost is inverted: low now (templates near-empty), high later (retrofit sweep). Implemented as a template-level convention so the next artifact written emits IDs from day one; no retrofit needed because no artifacts cite each other yet.

Implementation summary:
- `## Identifiers` block + ID prefixes added to every relevant template under `.claude/skills/documenting/templates/`: `R-###` (report findings), `D-###` + `RISK-###` (ADR sub-decisions and risks), `T-<phase>.<seq>` + `OQ-###` (plan acceptance criteria and open questions), `D-###` + `RISK-###` + `TF-###` (SDR), `INV-###` + `OQ-###` (charter), `REL-###` (context-map relationships).
- Severity table standardised on `critical | major | minor | pre-existing` in `report.md` and `adr.md`.
- Stability rule written into `<rules>` for analyst, architect, consultant, reviewer — re-numbering a referenced ID is a critical violation; withdraw via `[withdrawn]` suffix.
- Cross-artifact reference form: `<short-title>#<ID>` (e.g. `auth-audit#R-007`).
- Phase insertion uses next-unused integer + `**Execution order:**` line, never renumber.
- Reviewer alignment table now cites `T-<phase>.<seq>` IDs verbatim per `templates/alignment.md`.
- Lint (`npm run lint:agents`) clean across all 5 agents.

The lint-side ID monotonicity check (extending `scripts/lint-agents.mjs` to scan artifacts) is deliberately deferred — activates when the corpus is large enough to make local checks worth their run-time. The social enforcement (reviewer's cross-check pass) is in place from day one.

---

### Original deferred design (for record)

**Status (prior):** **Deferred — design captured, implementation gated.** Activate when the first cross-artifact reference drift incident occurs, OR when any single artifact under `artifacts/` accumulates ≥15 cross-references to other artifacts by prose label. Until then, the in-prose `<short-title>` pairing convention (ADR↔plan filename match) is doing the job at AISpec's current artifact count.

---

## What the synthesis proposed

A closed-vocabulary ID space across markdown artifacts:

| Prefix | Meaning | Owner | Lives in |
|---|---|---|---|
| `R-###` | Finding in an analyst report | analyst | `artifacts/reports/<slug>.md` |
| `D-###` | Decision inside an ADR | architect | `artifacts/adr/<slug>.md` |
| `T-###` | Task / acceptance criterion inside a plan phase | architect | `artifacts/plans/<slug>.md` |
| `RISK-###` | Risk row in any artifact that has a `## Risks` block | author of host artifact | wherever it appears |
| `CHK-###` | Checklist item inside a reviewer alignment table | reviewer | conversation-channel only |
| `FM-x.x` | MAST failure-mode reference | already in use | `.claude/agents/assets/mast.yaml` |

ID rules:
- Each ID is **stable** for the life of the artifact — never re-numbered, even when entries above are deleted.
- IDs are **scoped to the host artifact** — `R-014` in `auth-audit.md` is unrelated to `R-014` in `payment-audit.md`. Cross-artifact references must qualify: `auth-audit.md#R-014`.
- IDs are **dense** at first write (consecutive integers) and **sparse** after edits (gaps from deletions are kept).
- Severity classifications live in a fixed table inside the host artifact's frontmatter or a leading section, not inside the ID itself (i.e., do not encode severity into the ID prefix — keeps the ID stable across re-classification).

---

## Why deferred

At the time of this decision:

- `artifacts/reports/` has **1** report.
- `artifacts/adr/` has **0** ADRs.
- `artifacts/plans/` has **0** plans.
- No artifact references another by ID-style anchor; the `<short-title>` filename pairing (architect convention) carries the entire cross-reference load.

A typed-ID scheme is overhead until the corpus grows enough to need anchor-grade references inside prose. Two specific signals indicate it has grown enough:

1. **Drift incident:** a reviewer or architect cites a finding/decision/task by **paraphrased prose** and a subsequent change to the host artifact silently renders the reference wrong (GSD's "paraphrasing rules caused 5-of-8 agents to violate them" failure mode).
2. **Density threshold:** any one artifact carries ≥15 prose references to entries in another artifact (signals that an anchor-grade reference is now cheaper than re-reading the source each time).

Until one of those fires, the cost (template churn, agent-prompt churn, lint additions, backfill) exceeds the benefit (zero, since nothing currently cross-references).

---

## Schema (when activated)

### A. ID line format

Inside an artifact, every taggable entry opens with its ID in bold at the head of the bullet or heading:

```markdown
- **R-007** [major] Auth middleware writes session tokens in plaintext to logs.
  - Evidence: src/auth/session.ts:142, log fixture in tests/auth/session.spec.ts:88.
  - Recommendation: redact at the logger formatter, not at call sites.
```

```markdown
### D-003 — Storage engine for the events table
**Decision:** PostgreSQL with a JSONB `payload` column and per-aggregate sequence index.
```

```markdown
### Phase 2 — Backfill writer
**Done when:**
- **T-2.1** Existing rows have `created_at` populated from `inserted_at`.
- **T-2.2** New writes set both columns until the cut-over migration runs.
```

Task IDs are namespaced by phase (`T-<phase>.<seq>`) to keep them stable when phases are added or removed in the middle of the plan.

### B. Cross-artifact references

Inside any artifact, reference another artifact's ID with `<short-title>#<ID>`:

```markdown
Resolves auth-audit#R-007 — see also auth-token-storage#D-003.
```

The `<short-title>` matches the artifact filename without the `.md` extension. Renaming an artifact requires a sweep of every artifact under `artifacts/` for stale references — captured as a numeric cap (≤1 rename per PR) to keep the sweep manageable.

### C. Severity table convention

Each artifact that uses an ID prefix carries a leading severity table — fixed columns, no synonyms:

```markdown
## Severity

| Severity | Means |
|---|---|
| critical | Blocks the artifact's purpose; must resolve before merge / acceptance. |
| major | Significant defect; resolve before final approval. |
| minor | Quality issue; resolve when convenient. |
| pre-existing | Present before this artifact's commit range; record but do not block. |
```

The severity column appears in square brackets after the ID: `**R-007** [major] ...`. Reviewer and architect cite severity from this table verbatim — never paraphrased.

### D. Stability rule

> **Changing or re-numbering an ID after another artifact references it is a CRITICAL violation** of artifact discipline. The owning agent must add a new ID and mark the old one `[withdrawn]` rather than re-using its number.

This is enforced socially by the reviewer (cross-check pass — see `tmp/followup-cross-check-pass.md`) until lint covers it.

---

## Where each ID lives — template-level changes

The implementation is mostly template-level. When activated:

| Template | Edit |
|---|---|
| `templates/report.md` | Add the severity table block before `## Findings`. Switch finding bullets to `**R-###** [<severity>] ...`. Numeric caps unchanged. |
| `templates/adr.md` | Number decisions inside an ADR as `D-###` when an ADR records multiple distinct sub-decisions. Single-decision ADRs (the common case) need no ID — the ADR slug IS the ID. |
| `templates/plan.md` | Acceptance-criteria bullets become `**T-<phase>.<seq>** ...`. The reviewer cites these in alignment tables. |
| `templates/charter.md`, `templates/context-map.md`, `templates/glossary.md`, `templates/strategic-adr.md` | Optional `RISK-###` rows when a `## Risks` block exists. Strategic ADRs follow the same multi-decision rule as tactical ADRs. |
| `.claude/skills/reviewing/templates/alignment.md` | The alignment table's left column becomes `T-<phase>.<seq>` cited from the plan. The reviewer's own findings use `CHK-###` only inside the conversation block — no artifact file. |

---

## Agent-side changes

Owning agents add one new step to their `<instructions>` block — assign the next ID in sequence at write time, never re-number after publish:

```
N. Assign IDs:
   - Walk the artifact's existing entries (if amending) and record the highest ID per prefix.
   - For each new entry, assign the next integer after that high-water mark — even if earlier IDs were withdrawn.
   - Never re-number an existing ID. Withdraw by appending `[withdrawn]` and leaving the line in place.
```

Reviewer adds one rule to its alignment check:

```
- Every reference of the form `<short-title>#<ID>` resolves to an existing entry in the named artifact. A reference to a withdrawn or missing ID is a critical finding.
```

Architect's amendment flow gets one rule:

```
- When amending an ADR or plan, NEVER re-number an ID. Add a new ID and mark the old one `[withdrawn]`.
```

---

## Lint additions (when activated)

Extend `scripts/lint-agents.mjs` (or a sibling `scripts/lint-artifacts.mjs`) to check:

- Every `**<prefix>-<n>**` ID appears in increasing order within its artifact section, with no duplicates.
- No `[withdrawn]` ID is referenced elsewhere without an explicit replacement pointer (`replaced by R-014`).
- Cross-artifact references `<short-title>#<ID>` resolve — both the file and the in-file ID must exist.

The lint becomes a pre-commit hook once the corpus is large enough to make the local check worth its run-time.

---

## Bootstrap (when activated)

1. Sweep existing artifacts and assign IDs in encounter order — preserves chronology.
2. Update each template per the table above; lint passes on all templates.
3. Update each owning agent's `<instructions>` and `<rules>` per the agent-side section above.
4. Add the cross-reference rule to the reviewer.
5. Add the lint script (or extend the existing one) and gate the templates on it.

---

## Non-goals

- **Encoding semantics in the ID prefix beyond owner.** No `R-CRIT-007` or `D-API-003`. The classification belongs in a column, not the ID — IDs must survive re-classification.
- **Cross-repo ID stability.** IDs are scoped to AISpec's `artifacts/` tree. A future fork is free to re-number.
- **Auto-generated IDs from external trackers** (Jira, Linear). IDs are owned by the artifacts themselves, not mirrored from external systems.

---

## Acceptance for this follow-up phase (when activated)

- Every artifact template under `.claude/skills/documenting/templates/` that emits enumerable entries carries the typed-ID convention and a severity table where applicable.
- Every owning agent (analyst, architect, reviewer) has the ID-assignment step and the never-renumber rule.
- A lint check exists for ID monotonicity, withdrawn-ID handling, and cross-artifact reference resolution.
- The existing artifact under `artifacts/reports/` is backfilled with IDs.
- The reviewer cites IDs (not paraphrased prose) in every alignment table.
