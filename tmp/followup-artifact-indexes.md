# Follow-up — Artifact Index Files

**Predecessor:** Suggestion 5 of the synthesis review (Pattern 9 — *Index files: cheap
retrieval layer before expensive body reads*) from `tmp/findings-_synthesis.md`.

**Status:** **Scrapped on 2026-05-24.** Indexes add a maintenance burden and a drift
surface that consumers can already mitigate without them — agents glob the directory
lexicographically and read frontmatter when needed; the cost at any plausible artifact
count remains lower than maintaining a parallel manifest. Do not revive without first
demonstrating a concrete read-cost problem that globbing cannot solve.

The discipline below is left in place as a record of the design that was rejected.

---

## Why deferred

At the time of this decision:
- `artifacts/adr/` — 0 files
- `artifacts/plans/` — 0 files
- `artifacts/reports/` — 1 file
- `artifacts/sessions/` — ~5 files (not in scope; auto-generated)

Index-file machinery is a database-index-vs-table-scan optimisation. At 0-1 rows, the
scan **is** the index. Building it now would add a maintenance burden (every write
updates two places) and a drift surface (index rows can fall out of sync with files)
with zero current benefit. The synthesis itself flags premature infrastructure as an
anti-pattern (point 8 of *What NOT to copy*).

---

## Trigger to activate

Activate this follow-up when **any one** of these directories crosses the threshold:

| Directory | Threshold | Owner |
|---|---|---|
| `artifacts/adr/` | ≥10 files | architect |
| `artifacts/plans/` | ≥10 files | architect |
| `artifacts/reports/` | ≥10 files | analyst |

10 is the point where a consumer agent globbing the directory and reading frontmatter to
summarise starts costing meaningfully more than reading a single ~30-line YAML index.

The threshold per-directory is independent — when `artifacts/adr/` crosses 10, build the
ADR index even if plans and reports are still small.

`.claude/skills/` is deliberately excluded. The skill loader already exposes
`name + description` to the model at routing time (visible in system reminders); an
in-repo index would be redundant.

---

## Schema (when activated)

One `index.yml` per artifact directory, lexicographically sorted by slug:

```yaml
# artifacts/adr/index.yml
- slug: 0007-payment-gateway
  title: Payment gateway selection
  status: accepted          # proposed | accepted | superseded | deprecated
  date: 2026-04-12
  decision: >
    Stripe over Adyen — lower integration cost outweighs the regional coverage gap.
  supersedes: []
  superseded_by: null

- slug: 0008-event-store
  title: Event store schema
  status: proposed
  date: 2026-05-02
  decision: >
    Single events table with JSONB payload; per-aggregate sequence index.
  supersedes: []
  superseded_by: null
```

Variations per directory:

- **`artifacts/plans/index.yml`** — drop `supersedes`/`superseded_by`; add `phases: <int>`
  and `complete_phases: <int>`. The `decision` field becomes `goal`.
- **`artifacts/reports/index.yml`** — drop `supersedes`/`superseded_by`; add
  `commissioned_by` (the agent or user who asked for it). The `decision` field becomes
  `headline_finding`.

Hard rules:
- Sort by `slug` lexicographically; never by mtime (`mast.yaml` meta-principle).
- Cap each `decision` / `goal` / `headline_finding` field at **≤200 characters**. Past
  that, the consumer must read the body.
- Index file ≤16 KB. At larger sizes, split into year-shards
  (`index-2026.yml`, `index-2027.yml`) with a parent `index.yml` listing the shards.

---

## Maintenance ownership

| Index | Writer | When it updates |
|---|---|---|
| `artifacts/adr/index.yml` | architect | after every ADR write or status change |
| `artifacts/plans/index.yml` | architect | after every plan write, phase status change, or completion |
| `artifacts/reports/index.yml` | analyst | after every report write |

Add to each owning agent's `<instructions>` as a step:

> N. Update `artifacts/<type>/index.yml` to reflect the artifact just written or modified
>    — insert a new row or update the existing row by `slug`. Sort the file
>    lexicographically by `slug` before writing.

Add to each owning agent's `<completion_criteria>`:

> - NOT done until the corresponding `artifacts/<type>/index.yml` row reflects the
>   artifact just written.

---

## Consumer-side change to the agent template

When activating, add one bullet to the parallelize-reads directive at the top of
`<instructions>` in `templates/agent-definition-template.md`:

> When this agent needs to find existing artifacts of a type, **read the corresponding
> `artifacts/<type>/index.yml` first** to identify candidates; load full bodies only for
> rows whose `slug` / `status` / one-line summary matches the need. Never glob the
> directory if an index exists.

And one new validation-checklist line:

> - [ ] Any step that searches for existing artifacts of a type reads the
>       `artifacts/<type>/index.yml` first; full bodies are loaded only for matched rows.

---

## Bootstrap method (when activated)

1. Architect writes `artifacts/adr/index.yml` and `artifacts/plans/index.yml` by
   sweeping the existing files — one row per ADR / plan, fields populated from the
   frontmatter and the first paragraph.
2. Analyst writes `artifacts/reports/index.yml` by sweeping `artifacts/reports/`.
3. Both run the validation script (to be written): every file in the directory has a
   matching row; every row in the index points to a file that exists.
4. Both update their `<instructions>` to maintain the index from this point on.

---

## Drift detection

Once indexes exist, drift between index and filesystem is a real failure mode. Two
mitigations:

- **Pre-flight check** (folds into the agent-template pre-flight added in Suggestion 4):
  add a 6th check **Index current** (when this agent writes to a typed directory) that
  `✓` if `index.yml` row count equals `*.md` file count for that directory, `⚠` if not.
- **Reviewer check** in `.claude/skills/reviewing/`: a phase that writes to an artifact
  directory must also touch the corresponding `index.yml`; missing index update is a
  finding.

---

## Non-goals

- **Skill index.** Skills are routed by `name + description` already exposed to the
  model; no second index needed.
- **Session index.** Sessions are auto-generated; not a manually-curated artifact type.
- **Full-text search.** The index is a router, not a search engine. Bodies still hold
  detail; the index points at them.

---

## Acceptance for this follow-up phase (when activated)

- All three indexes exist and are sorted lexicographically by `slug`.
- Backfill is complete: every existing artifact has a row; every row points to an
  existing file.
- Architect and analyst agent files carry the maintenance step and the
  `<completion_criteria>` "NOT done until" guard.
- Agent template carries the consumer-side bullet and validation checklist line.
- The reviewer skill flags missing index updates as a finding.
- A drift-check script (or pre-flight bullet) verifies index ↔ filesystem alignment.
