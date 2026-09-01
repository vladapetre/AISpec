#!/usr/bin/env node
// Summarize .claude/telemetry/ledger.jsonl (written by hooks/emit.metrics.mjs).
// Computes the numbers that drive workflow tuning — the same ones the July 2026
// tuning pass dug out of two months of artifacts by hand:
//   - gate hit rates: cross-check ALIGNED vs DRIFT (full vs delta), review
//     APPROVED vs CHANGES REQUIRED (per-phase vs cumulative)
//   - amendment volume by classification
//   - token spend per session and per day (last ledger line per session is
//     that session's cumulative total)
// Usage: node .claude/telemetry/report.mjs [ledger-path]
import { readFileSync, existsSync } from "node:fs";

const ledgerPath = process.argv[2] ?? ".claude/telemetry/ledger.jsonl";
if (!existsSync(ledgerPath)) {
  console.error(`no ledger at ${ledgerPath} — nothing recorded yet`);
  process.exit(1);
}

const rows = readFileSync(ledgerPath, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

if (!rows.length) {
  console.error("ledger is empty");
  process.exit(1);
}

// --- Session totals: last line per session carries cumulative usage.
// Lead turns only. Teammate rows (event "subagent_stop") share the session id
// and carry no usage by design, so including them here would overwrite a
// session's cumulative totals with nothing. Rows predating the `event` field are
// lead rows and still count.
const bySession = new Map();
for (const r of rows) if (r.session && r.event !== "subagent_stop") bySession.set(r.session, r);

const totals = { input: 0, output: 0, cache_read: 0, cache_creation: 0, turns: 0 };
const byDay = new Map();
for (const r of bySession.values()) {
  for (const k of Object.keys(totals)) totals[k] += k === "turns" ? (r.turns ?? 0) : (r.usage?.[k] ?? 0);
  const day = (r.ts ?? "").slice(0, 10);
  const d = byDay.get(day) ?? { sessions: 0, output: 0 };
  d.sessions++; d.output += r.usage?.output ?? 0;
  byDay.set(day, d);
}

// --- Verdict events: dedupe so re-emits don't double-count. The key includes
// the agent, because teammate rows share their session id and two teammates can
// legitimately land the same `turns` count in one session — keying on
// (session, turns) alone would silently drop one of their verdicts.
const seen = new Set();
const verdictEvents = rows.filter((r) => {
  if (!r.verdict) return false;
  const key = `${r.session}#${r.agent_id ?? "main"}#${r.turns ?? r.ts}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const count = (pred) => verdictEvents.filter(pred).length;
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");

const ccAll = count((r) => r.block === "crosscheck");
const ccDrift = count((r) => r.block === "crosscheck" && r.verdict === "DRIFT DETECTED");
const ccDelta = count((r) => r.block === "crosscheck" && r.scope === "delta");
const revAll = count((r) => r.block === "perphase" || r.block === "cumulative");
const revChanges = count((r) => (r.block === "perphase" || r.block === "cumulative") && r.verdict === "CHANGES REQUIRED");
const amendments = rows.filter((r) => r.block === "amendment" && r.classification);
const amendBy = {};
for (const r of amendments) amendBy[r.classification] = (amendBy[r.classification] ?? 0) + 1;

console.log(`ledger: ${rows.length} lines, ${bySession.size} sessions\n`);
console.log("— Gates —");
console.log(`cross-checks: ${ccAll} (${ccDelta} delta-scoped) | DRIFT rate: ${ccDrift}/${ccAll} (${pct(ccDrift, ccAll)})`);
console.log(`reviews:      ${revAll} | CHANGES REQUIRED rate: ${revChanges}/${revAll} (${pct(revChanges, revAll)})`);
console.log(`amendments:   ${amendments.length}${Object.keys(amendBy).length ? " — " + Object.entries(amendBy).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}`);

// Per-agent attribution — only possible since the SubagentStop wiring; tells you
// which teammate is producing the drift, not just that drift happened.
const byAgent = new Map();
for (const r of verdictEvents) {
  const who = r.agent_type ?? "lead";
  const m = byAgent.get(who) ?? new Map();
  m.set(r.verdict, (m.get(r.verdict) ?? 0) + 1);
  byAgent.set(who, m);
}
if (byAgent.size)
  for (const [who, m] of [...byAgent.entries()].sort())
    console.log(`  ${who}: ${[...m.entries()].map(([v, n]) => `${v} ${n}`).join(", ")}`);

const subRows = rows.filter((r) => r.event === "subagent_stop").length;
if (!verdictEvents.length && !subRows)
  console.log(
    "  (no gate events and no teammate turns recorded — if teammates have run, check that\n" +
      "   SubagentStop is wired in .claude/settings.json for emit.metrics.mjs)"
  );
// --- Phase verification: what the summaries claimed, and whether the observed
// drive still matched the tree. `drive_fresh:false` is the defect class staleness
// enforcement would catch — check the count before flipping it to blocking.
const vRows = rows.filter((r) => r.verification);
if (vRows.length) {
  const vBy = {};
  for (const r of vRows) vBy[r.verification] = (vBy[r.verification] ?? 0) + 1;
  const fresh = rows.filter((r) => r.drive_fresh === true).length;
  const stale = rows.filter((r) => r.drive_fresh === false).length;
  console.log("\n— Phase verification —");
  console.log(`claims: ${Object.entries(vBy).map(([k, v]) => `${k}: ${v}`).join(" | ")}`);
  if (fresh + stale)
    console.log(`drive vs current tree: fresh ${fresh}, stale ${stale} (${pct(stale, fresh + stale)} stale)`);
}

// --- Turn duration and per-turn cost. Only rows written after emit.metrics
// started recording `duration_ms` carry these, so the section stays silent on
// an older ledger rather than reporting a misleading zero.
const timed = rows.filter((r) => typeof r.duration_ms === "number");
if (timed.length) {
  const q = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  };
  const fmt = (ms) => (ms >= 60000 ? `${(ms / 60000).toFixed(1)}min` : `${Math.round(ms / 1000)}s`);
  console.log("\n— Turn duration —");
  for (const [label, subset] of [
    ["lead     ", timed.filter((r) => r.event !== "subagent_stop")],
    ["teammates", timed.filter((r) => r.event === "subagent_stop")],
  ]) {
    if (!subset.length) continue;
    const d = subset.map((r) => r.duration_ms);
    console.log(
      `${label}: n=${subset.length} | p50 ${fmt(q(d, 0.5))} | p90 ${fmt(q(d, 0.9))} | max ${fmt(Math.max(...d))}`
    );
  }
  // Output tokens per second separates thinking from waiting: a long turn at a
  // high rate was generating, a long turn at a low rate was running tools or
  // sitting at a gate. The two have opposite fixes.
  const rated = timed.filter((r) => r.turn_usage?.output > 0 && r.duration_ms > 1000);
  if (rated.length) {
    const rate = rated.map((r) => (r.turn_usage.output / r.duration_ms) * 1000);
    console.log(
      `output tokens/sec on working turns: p50 ${q(rate, 0.5).toFixed(1)} | p90 ${q(rate, 0.9).toFixed(1)} ` +
        "(low rate on a long turn = tool or human time, not thinking)"
    );
  }
  const slow = timed.filter((r) => r.duration_ms >= 600000);
  if (slow.length) console.log(`turns over 10 min: ${slow.length} (${pct(slow.length, timed.length)})`);
}

console.log("\n— Tokens (cumulative across sessions) —");
console.log(`turns: ${totals.turns} | in: ${totals.input.toLocaleString()} | out: ${totals.output.toLocaleString()} | cache-read: ${totals.cache_read.toLocaleString()} | cache-write: ${totals.cache_creation.toLocaleString()}`);
console.log("\n— Output tokens by day —");
for (const [day, d] of [...byDay.entries()].sort())
  console.log(`${day}: ${d.sessions} session(s), ${d.output.toLocaleString()} out`);

console.log(
  "\nTuning prompts: DRIFT rate < ~15% → widen the SELF_CHECKED carve-outs; " +
    "CHANGES REQUIRED rate < ~5% → relax checkpoint cadence further; " +
    "high ADR_AMENDED share → assumption gate (A9b) needs tightening; " +
    "stale-drive rate near 0 over ~20 phases → promote drive staleness from measured to blocking " +
    "(hooks/README.md); any drive-claimed-unobserved → a phase summary described a drive that never ran."
);
