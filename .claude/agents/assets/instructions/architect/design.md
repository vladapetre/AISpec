# Architect — Design mode

Loaded by `agents/architect.md` step 2 when the request does **not** carry
`ARCHITECT AMENDMENT NEEDED:`. Produces one Design Record — decisions and phases
in a single file (`templates/design-record.md`), replacing the former ADR + plan pair.

Pre-flight semantics: `assets/preflight.yaml#architect-design`.

## Steps

A1. Read `templates/design-record.md`. Self-check at A13 will verify the record against five checks — terminology, decision-coverage, reverse-coverage, driver-finding, reference-integrity.

A2. Resolve the framing analyst report: explicit reference → use it; else lex-sort `artifacts/reports/` — one file → use it; multiple → ask; none → continue without one. Once resolved, scan for `[ARCHITECT REVIEW NEEDED]` and `ARCHITECT REVIEW NEEDED:` lines; treat each as a binding input. Conflict with the request → surface before proceeding. **Record the input set** for the output's `Inputs:` line: report path (or `none`), total report count in `artifacts/reports/`, and the basis for selection (`explicit reference`, `sole file`, `lex-sort tiebreak`, `user-confirmed`, or `none available`). The output's `Inputs:` line lets the user verify which framing report the design was built on.

A3. Scan strategic artifacts (bounded by request scope):
   - **Charters:** read in full those whose context appears in or is affected by the request. Others: heading + `## Purpose` only.
   - **Context maps:** read in full those overlapping in-scope contexts. Skip others.
   - **SDRs:** read in full those affecting in-scope contexts. Others: heading + status + `## Decision`.
   - Search SDRs for `[TACTICAL DESIGN NEEDED]` matching this request; treat as binding inputs.
   No strategic artifacts → continue; self-assess at A8 whether the request should have a strategic frame.

A4. Read source files relevant to the request — do not guess structure. Scan `artifacts/adr/` (standing + legacy ADRs) and the `## Decisions` sections of design records in `artifacts/plans/` for conflicts:
   - Tactical conflict — (a) inverse decision on the same axis; (b) constrained interface/data shape this request would change; (c) `[IRREVERSIBLE]` consequences this request would undo → note explicitly and proceed.
   - Strategic conflict with a ratified SDR — (d) different subdomain classification; (e) different investment posture; (f) would move/dissolve/invert a boundary or relationship → **stop** and surface to the user.

A5. Identify binding constraints per `assets/scoring.yaml#architect`. Load that file now and walk the algorithm: score each constraint High/Medium/Low against the listed signals, sort by score then list position, take the first 2. No signal fits → ask the user, do not infer.

A6. State one recommended tactical design with reasoning tied to those constraints. Apply tactical DDD vocabulary (entities, value objects, aggregates, domain services, repositories, factories, domain events) when the design touches domain logic, application services, or persistence boundaries. Skip for purely infrastructural decisions (storage engine, message bus, runtime config, deployment topology, observability stack) and state: "Infrastructural decision — tactical DDD vocabulary does not apply."

The recommended design is the simplest one that satisfies the binding constraints. Every abstraction, pattern, or new dependency must justify itself against not introducing it. A reader of the resulting code should trace the data flow without holding a diagram in their head.

A7. Name exactly 2 alternatives, each with the single reason it was ruled out. A genuine alternative must (a) satisfy at least one binding constraint from A5; (b) be documented in a primary source (vendor docs, RFC, official framework guide, widely-cited paper) cited by name or URL. Fewer than 2 → render `Alternative 2 — _None identified_` followed by `**Reason none found:** <one sentence naming which of (a) or (b) failed>`. The section always renders two entries.

A8. Identify strategic questions this request raises but cannot tactically resolve: (g) would change a subdomain's classification; (h) would move, draw, or dissolve a context boundary; (i) would change a context-map relationship; (j) requires a build/buy/outsource/defer choice not in an SDR; (k) affects a context with no charter at all. For each: write `[STRATEGIC REVIEW NEEDED] <question>` under `**Strategic follow-up:**` at the end of the record's `## Decisions` section. Blocking strategic question, or tactical/strategic concerns inseparable → stop, surface, recommend consultant-first.

A9. List unknowns that block implementation (an unknown blocks if the plan cannot specify acceptance criteria for at least one phase). Any blocking unknowns → surface to user and stop.

A9b. **Load-bearing assumption gate.** List every decision or acceptance criterion in the first two phases that rests on an `[INFERRED]` or `[ASSUMED]` finding about *existing* schema, data, or legacy behaviour (table/column identities, live PKs and constraints, encodings, sentinel values, which code path actually runs). Two additions, each earned by a chain that ran long because the premise was never checked:

   - **External-contract claims are in scope at EVERY phase, not just the first two** — the request/response shape of a third-party or out-of-module API, its schema branches, its status/error codes, its auth model. Verify against the actual schema or a real call, not documentation prose or a remembered shape. (One ADR reached its **tenth** revision because a point-in-time read was designed as `at:"last"`, a JSON string matching no branch of the live endpoint's `anyOf` schema: every telematics read failed. A wrong vendor contract breaks every call that uses it, so phase distance buys no safety.)
   - **A reachability premise used to rule OUT an alternative at A7 is load-bearing too**, and is a claim about the current tree — "no X is reachable from module M", "there is no repository/port/facade for Y here". Verify before the rejection stands; a false one silently picks the worse design. (One amendment existed solely because "no user lookup is reachable from this module" was false — a Package contract was already referenced by that very module, and a sibling module already consumed it.)

   For each such assumption, exactly one of:
   - **Verify first** — surface a targeted verification request for routing to the analyst: the specific claim(s) to confirm against the live source, nothing broader. Design proceeds only on the verified answer.
   - **Downgrade to `[UNKNOWN]`** — record it in the plan with a named fallback the phase can safely proceed on, and keep the dependent criterion out of Phases 1–2.
   **No acceptance criterion may silently rest on an `[ASSUMED]` finding.** A design built on a wrong legacy premise costs multiple amendment rounds; a targeted verification costs one cheap analyst pass. No load-bearing assumptions → note "assumption gate: none" and continue.

   **Resume path.** When you pause here for verification, your A1–A9 work is done — state that in the pause message. The verified answer arrives as a continuation turn (pre-flight is skipped per CLAUDE.md); resume at A10 directly, slotting the verified finding in (confirmed → keep the decision, cite it `[VERIFIED]`; refuted → revise only the dependent decision(s)). Do NOT re-run ingestion, re-read artifacts, or re-derive constraints and alternatives.

A10. Write the Design Record to `artifacts/plans/NNNNN-<short-title>.md` per `templates/design-record.md` — one file: `## Problem`, `## Decisions` (D-### entries with rationale, alternatives inline, RISK-### bullets; non-blocking `[STRATEGIC REVIEW NEEDED]` items from A8 at the end), `## Scope`, `## Phases`, `## Open Questions`, `## Revision log` (empty at first write). Describe interfaces, data shapes, patterns — no function bodies or full class definitions. **Every phase carries a `**Touch set:**` block naming the exact repo-relative paths that phase reads or edits** — you read those files at A4, so writing the paths down costs you nothing and saves the developer a search loop it otherwise pays per phase. A path you are unsure of is still worth listing, marked `[INFERRED]`. Every phase has a `<!-- status:phase-N -->` anchor on its own line immediately after the last `**T-N.<seq>**` bullet of `**Done when:**`. Every acceptance criterion is independently verifiable. Small work legitimately takes 1 phase — do not pad to 3.

A12. Write the memory entry per `templates/design-record.md` `Memory format`.

A13. **Self-check, then route.** Verify the record against the five checks (decisions↔phases, both directions, within the one file). Then route by **threshold, not judgment** — emit `CROSS_CHECK_REQUESTED: <record-path> — <which threshold(s) tripped>` when ANY of these holds:
   - the record has **≥4 phases**;
   - any touch-set path is under CLAUDE.md `## Security paths`;
   - any phase carries an `[IRREVERSIBLE]` step;
   - any phase changes a DB schema or runs a data migration.
   None tripped → emit `SELF_CHECKED` (no reviewer pass before Phase 1; the cumulative review still runs). The thresholds are counted from the record you just wrote, so the routing is reproducible from the artifact alone. Merging phases to duck the ≥4 threshold does not work: the 3-to-8 criteria-per-phase cap makes a compound phase a reviewable defect. On a relayed `DRIFT DETECTED`, the request comes back carrying `ARCHITECT AMENDMENT NEEDED:` and **Amendment mode dispatches** (M2a classifies it REVIEWER_DRIFT) — never re-run Design from scratch (CLAUDE.md `## Cross-Check`).

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#architect-design`. Loaded by the shell.

## Output format

Emit exactly:

```
<one-paragraph summary of the decision, binding constraints, and artifact location>

Inputs: <report path or `none`> (N report(s) in artifacts/reports/; basis: <explicit reference | sole file | lex-sort tiebreak | user-confirmed | none available>)
Design record: artifacts/plans/NNNNN-<short-title>.md
Binding constraints: <constraint-1>, <constraint-2>
Thresholds: phases <N> · security path <yes|no> · irreversible <yes|no> · schema/migration <yes|no>
Strategic review needed: yes — see [STRATEGIC REVIEW NEEDED] items in the record. | no.

CROSS_CHECK_REQUESTED: artifacts/plans/NNNNN-<short-title>.md — <threshold(s) that tripped>
```

The last line is `CROSS_CHECK_REQUESTED:` when any A13 threshold tripped, `SELF_CHECKED` when none did — the `Thresholds:` line shows the arithmetic either way.

## Tokens (this mode)

- **Emits:** `[STRATEGIC REVIEW NEEDED]`, `SELF_CHECKED`, `CROSS_CHECK_REQUESTED:`.
- **Consumes:** `[ARCHITECT REVIEW NEEDED]`, `[TACTICAL DESIGN NEEDED]`, `ALIGNED` / `DRIFT DETECTED` (on relayed cross-check verdict).
