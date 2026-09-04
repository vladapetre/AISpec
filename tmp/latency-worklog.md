# Latency optimisation — working state

Round 1 posted 2026-09-02; round 1b (host-data revision) same day. Status: awaiting
user reaction.

## Round 1b — host-project data (D:\workspace\development, read-only)

Ledger: 46 sessions, 11,284 turns, 12.5M output tokens, 3.2B cache-read. Teammate
turns are SHORT: p50 12s, p90 1.1min (n=88, recent sessions only). Latency is
accumulation of many serial turns + relays + human waits, not slow single turns.

Gate hit-rates (reviewer memory index, ~30 plan chains, 2026-05 → 2026-09):
- Cross-check: at least 9 of ~30 chains record a DRIFT round (≈30%), incl. Criticals
  (00064 appsettings, 00083 9-of-18 oracle gap). Recent telemetry window: DRIFT 1/3.
- Cumulative review: at least 11 of ~30 record a CHANGES REQUIRED round (≈35%), incl.
  a leaked secret (00057) and 4-critical gap remediation.
- **Both gates earn their keep. Round-1 move M2 (flip cross-check default) is KILLED
  by this data.**

Amendment churn is the real repeat cost: 180 ADR files, 96 (53%) are -rN supersession
deltas across 40 chains; depths up to r10 (00054), r6, r5 ×4. Each amendment round =
architect pass + (usually) reviewer delta re-check + 2+ relays. The r2-consolidation
rule and Source-B batching in CLAUDE.md are recent and postdate the worst chains.

## Evidence base

- Telemetry (`report.mjs`): 14 sessions, all lead-only. **Zero teammate turns, zero gate
  events recorded**, even though SubagentStop IS wired in settings.json:156. The pipeline
  has not run in this repo; its real usage happened in host projects whose ledgers are not
  here. Every "gate catches X / never catches X" claim is currently unmeasurable locally.
- Lead turn p50 1.6 min, p90 2.1 min, one 15.6 min turn. Cost is cache-read dominated:
  471M cache-read vs 68.5k fresh input tokens across all sessions.
- Contract surface (wc -c): CLAUDE.md 27.7KB; orchestration.md 12.8KB; agent shells 6 to
  11KB; mode files 2.7 to 15.6KB; auto-loaded skills: documenting 11.4KB, branching
  18.5KB, reviewing 14.3KB. Developer spawn fixed load ≈ 67KB before mode file, assets,
  memory, plan, ADR (≈ 17k tokens, more like 25k+ with entry reads).
- All five agents pin `model: opus`; architect+consultant `effort: high`, rest medium.
  Lead tiering table (orchestration.md:67) downgrades reviewer/analyst/architect-amendment
  to sonnet conditionally; developer never.
- Prior cost audit exists: `artifacts/reports/aispec-toolkit-remaining-cost-token-analysis.md`.
  Key reused finding: **R-064** — the SELF_CHECKED carve-out is nearly unreachable by
  construction (requires no phase with >3 acceptance criteria; the plan template mandates
  3 to 8 per phase), so every fresh ADR/plan pair pays a reviewer cross-check spawn.

## Round 2 — wall-clock decomposition (2026-09-01/02 window, plans 00081–00083)

Only lines since 2026-09-01 carry duration_ms (212 turns, 2 sessions). Method:
per-event intervals [ts − duration, ts], gaps between them banded, breaks >30min
excluded. Script: scratchpad decompose2.mjs.

- Session 766c4c44: effective wall 487.6min, model-active 83.6min (**17%**),
  waiting-on-human 404min. Gap bands: 41×<30s (1.4min), 81×30s–5m (179min),
  17×5–30m (223min). Session 803f4d03: wall 99.9min, model-active 22%, same shape.
- **~80% of effective wall-clock is waiting for the user.** Average short-band stop
  ≈2.2min; every stop also risks a 5–30min away-gap (those 17 gaps cost more than all
  model time combined).
- Tool-heavy turns (<15 tok/s) are 2–4min total: builds/tests are NOT a bottleneck
  in this window.
- Lead owns nearly all model time: 68 of 88 timed subagent_stop lines duplicate a
  lead stop line (same session+duration+output) → teammate time was double-counted.
  TELEMETRY BUG: emit.metrics SubagentStop double-emission. Real named-teammate turns
  in window: ~15.
- Pure relay turns are cheap (36 lead turns <300 out ≈ 2.3min total). The lead's
  expensive turns are working turns (up to 23k out / 37 steps).
- Caveat: 2 sessions, one work mix; entry-read overhead per spawn and the analyst
  stage remain unmeasured (window had few named teammate turns).

**Reframe: the unit of latency cost is the user-facing stop, not the model turn.**
Fewer stops per unit of work > faster turns. Each merged/removed gate stop saves
~2min median human latency and hedges a 5–30min away-gap.

## Ranked cost/latency list (round 1)

1. Time-to-first-reviewable = full ADR + full all-phases plan (architect A1–A13,
   effort high) + cross-check spawn whose skip path is dead (R-064). ~3 spawns + ~4 lead
   relay turns before any code. [minutes figure = guess, flagged]
2. Every spawn is a cold start: ~17–25k tokens of contract + entry reads per teammate,
   re-paid on each spawn; hand-off unit (ADR + plan + memory + report) is scattered, so
   each agent re-assembles context.
3. Relay hops: every teammate hand-off is teammate → lead → teammate; verdict tokens are
   exact-match so the relay adds no judgement, only a round trip.
4. Missing middle road: expediting's 5-condition gate fails → FULL pipeline. No tier for
   "small but has one design decision" work. [share of traffic = guess, flagged]
5. Telemetry blind spot: gate hit-rates (DRIFT, CHANGES REQUIRED, amendment counts) never
   measured; motivation stats in CLAUDE.md are from one host project, prose-only.

Non-issues: hook layer overhead (ms-scale node procs); per-phase USER gate is protected
property, not a target.

## Proposed moves (round 1)

- **M1 Work-order road (BMAD story file).** Middle tier: one self-contained file =
  context extract + inline decisions-with-why + phases + acceptance criteria +
  write-scope. Architect emits in ONE sized pass (no separate ADR, no scoring ceremony),
  developer starts immediately, no cross-check; cumulative review stays. ADR promotion
  only for cross-cutting decisions.
- **M2 KILLED (round 1b): cross-check catches drift on ~30% of chains.** Replacement:
  **M2' Take the cross-check off the critical path.** Developer starts Phase 1
  immediately after the plan lands; the cross-check runs concurrently. DRIFT arriving
  mid-phase stops the phase (bounded exposure: one phase, usually scaffolding).
  ALIGNED (the ~70% case) costs zero wall-clock. Gate semantics, verdict tokens, and
  hit-rate stay identical; only the ordering changes. Open question: does DRIFT often
  invalidate Phase 1 specifically, or later phases?
- **M3 Phase-1-first design output.** Architect's first emission = decisions + Phase 1
  spec (reviewable), remainder follows. Possibly folded into M1.
- **M4 (cost, secondary) Shrink per-spawn contract.** Teammate-core split of CLAUDE.md;
  make `branching` deferred instead of auto-loaded on developer.

## BMAD transfer verdicts

- Story file → transfers (M1). Core of the answer.
- sprint-status.yaml state machine → partial; plan-status.mjs already covers stamping.
  Defer unless M1 lands (a work-order status field would replace stamps naturally).
- Step-file micro-loading → token move, not latency (reads are cheap, round trips are
  not). AISpec is already 2-level (shell → mode file). Low priority.
- persistent_facts → already have (skills frontmatter + inject hooks). No.
- A/P/C menus → anti-transfer (adds round trips).
- Parallel 3-reviewer fan-out → anti-transfer on cost; cumulative-review.mjs already
  exists for the one place it might pay.

## Consolidated address-list (round 2, awaiting go/no-go per item)

1. **Stops-per-task reduction** (new #1). Candidates: default-propose batched phase
   approval on low-risk phase runs; one-stop gate packets (verdict + diff + question
   in a single stop, never two consecutive stops); notification on gate-reached to
   shrink away-gaps.
1b. **Lever 2 sizing (round 3) — SMALL, downgraded.** Host reports all-time = 611k
   output tokens, only ~5% of the 12.5M total. Template caps ALREADY exist (≤50
   findings, ≤6 lines/finding, capped wrappers) in both repos, and are ignored at a
   stable rate (June mean 101 w/finding, Aug 103; 40% of findings >100w; worst report
   2026-08-31, 50 findings at 220w avg, post-cap). Enforcing the finding cap saves
   47k tokens all-time (~600/report ≈ 10s); halving the 8 wrapper sections saves 96k
   (~1.2k/report ≈ 15-25s). Median save ≈ 15-35s/report; only the 90KB monsters lose
   minutes. ADR/plan/review files are already lean (reviews mean 3.4KB).
   → Keep only: lint.write enforcement of the existing caps (cheap, also fixes the
   ignored-prose-cap credibility problem). Not a structural move.
   → Implication: durable artifacts ≈ 1.8M of 12.5M output tokens (~14%). The
   generation time lives mostly in the other ~86%: thinking, code edits/tool args,
   conversation and summary blocks. Next measurement if we pursue generation volume:
   split turn_usage by agent on timed window + git-diff volume as code proxy.

2. **M1 work-order road** — middle tier, one self-contained file, no separate
   ADR/cross-check stop. Also the answer to expediting's all-or-nothing gate.
3. **M2' concurrent cross-check** — gate kept, moved off the critical path.
4. **M3' cheaper amendment rounds** — concurrent delta re-check and/or absorb
   minor-only drift without a re-check turn. (Batching + r2 consolidation already
   landed earlier and cover part of this.)
5. **M4 contract-surface trim** — cost move, low priority: teammate-core split of
   CLAUDE.md, defer `branching` on developer.
6. **Telemetry fixes** — dedupe SubagentStop double-emission; (gate events already
   land since ~Sep 1).

## Agreed

- Landed 9c24229: telemetry SubagentStop mirror fix (source + historical dedupe in
  report.mjs). Host ledger verified: 68 mirrors dropped, teammates n=20 real.
- Landed 8deadad: report finding caps enforced (template ≤120 words/finding added;
  lint.write bounces; 168 historical host findings would have bounced).
- **Design Record model landed 2026-09-03**, six commits, each revertible:
  - e2be6d2 template + filename.mjs `design` type + skill registry
  - 392871e lint.write revision protocol (marker bump vs git HEAD; tested 5 rules
    against a scratch repo, legacy plans verified silent on host's 78 plans)
  - ca8e3b5 architect: one record, A13 thresholds (≥4 phases / security path /
    [IRREVERSIBLE] / schema-migration), amendment in place, legacy path kept
  - 3f8720b reviewer: single-file cross-check, model detection, no chain union
  - f39415b asset registries both-model wording; (rN) + ## Revision log registered
  - a8553fe CLAUDE.md ## Cross-Check + amendments + ownership rows; orchestration.md
  - Decision names kept for continuity: ADR_AMENDED/PLAN_UPDATED classifications,
    "ADR-alignment" section, adr- memory prefix, RECONCILE WITH ADR token.
  - lint.contract clean (2 pre-existing warnings). Host project untouched — deploys
    whenever the user syncs its .claude tree; open legacy chains close under old rules.

## M1 proposal — the work-order road (round 4, awaiting user rulings)

A work order is a PLAN VARIANT living in `artifacts/plans/` (same filename scheme,
same `<!-- status:phase-N -->` anchors, same stamping) with two differences: a
`## Decisions` section inline (D-### + one-line why each, ≤5) instead of a
`**Governing ADR:**` pointer, and a hard cap of ≤3 phases. Everything downstream
(developer flow, plan-status.mjs, lint.write, cumulative review) works unchanged.

Admission (all must hold; any failure → full pipeline):
1. Single repo, single bounded context.
2. No `## Security paths` file, nothing `[IRREVERSIBLE]`.
3. Decisions are local: no new dependency, no cross-context contract change, no
   schema migration.
4. Fits ≤3 phases and ≤5 recorded decisions. (Overflow = evidence it was never
   middle-band.)
5. No open strategic question (consultant not involved).

Written by: architect, new lightweight mode `order` (skips A5 scoring, A9b
assumption fan-out, separate ADR; keeps read-the-code framing + acceptance
criteria). Escalates mid-write to Design mode when a decision turns cross-cutting
(same pattern as expediting's mid-flight escalation).

Gates on this road: NO pre-implementation cross-check (bounded by size cap +
cumulative review keeps its 35% hit rate); per-phase user approval unchanged;
no mid-plan checkpoints (≤3 phases never trip them); cumulative review REQUIRED.
Amendments: decision revisions append `D-###-r1` lines inside the same file
(single-file supersession, audit trail kept, no new ADR files).

Saved per middle-band feature: the ADR document (~3.5k tokens gen), the
cross-check turn + relay (critical-path), one artifact re-read chain for every
later reader, and the ADR/plan union work in review.

Open rulings for the user:
(a) plans/ variant (recommended) vs separate artifacts/orders/ dir
(b) architect writes it (recommended) vs lead writes + architect checks
(c) cross-check dropped (recommended) vs kept diff-size-gated
(d) phase cap: 3 (recommended) vs 2

- **Stops reduction landed 2026-09-03**, 8fea4d7 (one commit, three files):
  - implement.md 9a + output line: **Run offer:** names the maximal run-eligible
    prefix of remaining phases (no [IRREVERSIBLE], no security path, no
    schema/migration, no checkpoint inside) with the exact grant wording; user's
    own words still the only grant, silence still not a run.
  - CLAUDE.md batched-approval paragraph references the offer.
  - orchestration.md "## Stops — end your turn only at a user gate": mechanical
    verdict relays route onward same-turn; PushNotification at genuine gates.

- **Tiering landed 2026-09-03**, 0a6d285: reviewer spawns sonnet when the record's
  Thresholds: line shows none tripped (old changed-files condition kept for
  ad-hoc/legacy); legacy consolidation folds always sonnet.
- **branching deferred 2026-09-03**, 7234dcb: removed from developer skills
  frontmatter; read at implement.md's worktree gate instead (18.5KB off every
  developer spawn; single-repo projects never pay it).
- REMAINING (last item): CLAUDE.md teammate-core split — proposal not yet made;
  invasive, needs its own explicit change list and a user go.

## Killed

- M2 flip-cross-check-default — killed by host data (DRIFT ≈30% of chains).
- Hook-layer overhead as a cost item — ms-scale, noise.
- Build/test tool time as a bottleneck — 2–4min per session in decomposition window.

## Open questions

- Traffic mix: what share of real requests lands in the missing middle band?
- Entry-read overhead per spawn: still unmeasured (few named teammate turns in the
  timed window).
- Does DRIFT typically invalidate Phase 1 work (bears on M2' concurrency)?
