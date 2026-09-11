#!/usr/bin/env node
// Turns one or two results files into the metric table. With two files the second is compared to
// the first (baseline) and --check exits 1 on a regression beyond two standard errors.
//
//   node bench/report.mjs bench/results/trunk.json
//   node bench/report.mjs bench/results/trunk.json bench/results/rework.json --check
//
import { readFileSync } from "node:fs";
import { agreement, cv, mean, passAt1, passHatK, percentile, round, stderr } from "./lib/metrics.mjs";

function load(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function byTask(records) {
  const m = new Map();
  for (const r of records) {
    if (!m.has(r.task)) m.set(r.task, []);
    m.get(r.task).push(r);
  }
  return m;
}

function taskRow(task, rs, k) {
  const n = rs.length;
  const c = rs.filter((r) => r.pass).length;
  const kk = Math.min(k, n);
  return {
    task,
    lane: rs[0].lane_expected,
    n,
    pass1: passAt1(c, n),
    passk: passHatK(c, n, kk),
    route_agree: agreement(rs.map((r) => r.signals?.route ?? "?")),
    lane_ok: mean(rs.map((r) => (laneMatches(r) ? 1 : 0))),
    cost_mean: mean(rs.map((r) => r.cost_usd)),
    cost_cv: cv(rs.map((r) => r.cost_usd)),
    wall_p50: percentile(rs.map((r) => r.wall_ms), 50) / 1000,
    wall_p90: percentile(rs.map((r) => r.wall_ms), 90) / 1000,
    ttfr_p50: percentile(rs.map((r) => r.first_reviewable_ms ?? r.wall_ms), 50) / 1000,
    stops: mean(rs.map((r) => r.stops)),
    denials: mean(rs.map((r) => (r.prompts ?? 0) + r.denials)),
    turns: mean(rs.map((r) => r.turns)),
    tools: mean(rs.map((r) => r.tool_calls)),
    rereads: mean(rs.map((r) => r.rereads)),
    cache: mean(rs.map((r) => r.cache_hit_ratio).filter(Number.isFinite)),
    tokens_per_line: mean(rs.map((r) => (r.lines_added ? r.tokens_total / r.lines_added : NaN)).filter(Number.isFinite)),
  };
}

/** The trunk harness has no lane vocabulary; map its routes onto the intended lane. */
function laneMatches(r) {
  const lane = r.signals?.lane;
  const want = r.lane_expected;
  if (!lane) return false;
  if (r.harness === "rework") return lane === want;
  if (want === "fast") return lane === "direct" || lane === "expedited";
  if (want === "research") return lane === "direct" || lane === "delegated";
  return lane === "pipeline";
}

function suite(rows) {
  const pick = (f) => rows.map((r) => r[f]).filter(Number.isFinite);
  const agg = {};
  for (const f of ["pass1", "passk", "route_agree", "lane_ok", "cost_mean", "cost_cv", "wall_p50", "wall_p90", "ttfr_p50", "stops", "denials", "turns", "tools", "rereads", "cache", "tokens_per_line"]) {
    agg[f] = { mean: mean(pick(f)), se: stderr(pick(f)) };
  }
  return agg;
}

const fmt = (x, d = 2) => (Number.isFinite(x) ? round(x, d).toFixed(d) : "-");
const pct = (x) => (Number.isFinite(x) ? Math.round(x * 100) + "%" : "-");

function table(rows) {
  const head = "| task | lane | n | pass@1 | pass^k | route agree | lane ok | cost $ | cost CV | wall p50 s | wall p90 s | TTFR p50 s | stops | prompts | turns | tools | re-reads | cache | tok/line |";
  const sep = "|" + "---|".repeat(19);
  const body = rows.map(
    (r) =>
      `| ${r.task} | ${r.lane} | ${r.n} | ${pct(r.pass1)} | ${pct(r.passk)} | ${pct(r.route_agree)} | ${pct(r.lane_ok)} | ${fmt(r.cost_mean)} | ${fmt(r.cost_cv)} | ${fmt(r.wall_p50, 0)} | ${fmt(r.wall_p90, 0)} | ${fmt(r.ttfr_p50, 0)} | ${fmt(r.stops, 1)} | ${fmt(r.denials, 1)} | ${fmt(r.turns, 0)} | ${fmt(r.tools, 0)} | ${fmt(r.rereads, 1)} | ${pct(r.cache)} | ${fmt(r.tokens_per_line, 0)} |`,
  );
  return [head, sep, ...body].join("\n");
}

const LANE_FIELDS = ["passk", "cost_mean", "wall_p50", "ttfr_p50", "stops", "denials", "rereads", "cache"];

function suiteTable(a, b, only = null) {
  const fields = [
    ["pass1", "pass@1", pct],
    ["passk", "pass^k", pct],
    ["route_agree", "route agreement", pct],
    ["lane_ok", "lane as intended", pct],
    ["cost_mean", "cost per task $", fmt],
    ["cost_cv", "cost CV", fmt],
    ["wall_p50", "wall p50 s", (x) => fmt(x, 0)],
    ["ttfr_p50", "time to first reviewable p50 s", (x) => fmt(x, 0)],
    ["stops", "stops per task", (x) => fmt(x, 1)],
    ["denials", "permission prompts per task", (x) => fmt(x, 1)],
    ["turns", "turns per task", (x) => fmt(x, 0)],
    ["tools", "tool calls per task", (x) => fmt(x, 0)],
    ["rereads", "re-reads per task", (x) => fmt(x, 1)],
    ["cache", "cache hit ratio", pct],
    ["tokens_per_line", "tokens per added line", (x) => fmt(x, 0)],
  ].filter(([f]) => !only || only.includes(f));
  const head = b ? "| metric | baseline (±SE) | candidate (±SE) | delta |" : "| metric | value (±SE) |";
  const sep = b ? "|---|---|---|---|" : "|---|---|";
  const rows = fields.map(([f, label, F]) => {
    const av = a[f];
    if (!b) return `| ${label} | ${F(av.mean)} ±${F(av.se)} |`;
    const bv = b[f];
    const d = bv.mean - av.mean;
    return `| ${label} | ${F(av.mean)} ±${F(av.se)} | ${F(bv.mean)} ±${F(bv.se)} | ${d >= 0 ? "+" : ""}${F(d)} |`;
  });
  return [head, sep, ...rows].join("\n");
}

/** Regression rule: pass^k may not fall, and cost may not rise, by more than two SE of the baseline. */
function check(a, b) {
  const fails = [];
  const drop = a.passk.mean - b.passk.mean;
  if (drop > 2 * (a.passk.se || 0.05)) fails.push(`pass^k fell by ${pct(drop)} (limit ${pct(2 * (a.passk.se || 0.05))})`);
  const rise = b.cost_mean.mean - a.cost_mean.mean;
  if (rise > 2 * (a.cost_mean.se || 0.5)) fails.push(`cost rose by $${fmt(rise)} (limit $${fmt(2 * (a.cost_mean.se || 0.5))})`);
  return fails;
}

function main() {
  const argv = process.argv.slice(2);
  const doCheck = argv.includes("--check");
  const k = Number((argv.find((a) => a.startsWith("--k=")) ?? "--k=5").slice(4));
  const files = argv.filter((a) => !a.startsWith("--"));
  if (!files.length) throw new Error("usage: report.mjs <baseline.json> [candidate.json] [--check] [--k=5]");
  const sets = files.map((f) => ({ file: f, data: load(f) }));
  const out = [];
  const rowSets = [];
  for (const { file, data } of sets) {
    const rows = [...byTask(data.records).entries()].map(([t, rs]) => taskRow(t, rs, k)).sort((x, y) => x.task.localeCompare(y.task));
    const m = data.manifest ?? {};
    out.push(`## ${m.harness ?? file} @ ${m.harness_commit ?? "?"} · fixture ${m.fixture_hash ?? "?"} · claude ${m.claude_version ?? "?"} · ${data.records.length} runs`);
    out.push("");
    out.push(table(rows));
    out.push("");
    rowSets.push(rows);
  }
  // A comparison is only fair on the tasks both sides ran: a candidate that has finished the fast lane
  // is not compared against a baseline that also carries the design tasks.
  let common = null;
  if (rowSets[1]) {
    const ids = new Set(rowSets[1].map((r) => r.task));
    common = rowSets[0].filter((r) => ids.has(r.task)).map((r) => r.task);
  }
  const restrict = (rows) => (common ? rows.filter((r) => common.includes(r.task)) : rows);
  const suites = rowSets.map((rows) => suite(restrict(rows)));
  out.push(common ? `## Suite (${common.length} task(s) run by both)` : "## Suite");
  out.push("");
  out.push(suiteTable(suites[0], suites[1]));
  if (common) {
    const lanes = [...new Set(rowSets[0].filter((r) => common.includes(r.task)).map((r) => r.lane))];
    for (const lane of lanes) {
      const pick = (rows) => restrict(rows).filter((r) => r.lane === lane);
      const n = pick(rowSets[0]).length;
      out.push("", `### Lane ${lane} (${n} task(s))`, "");
      out.push(suiteTable(suite(pick(rowSets[0])), suite(pick(rowSets[1])), LANE_FIELDS));
    }
  }
  const failedRuns = sets.flatMap(({ data }) => data.records.filter((r) => !r.pass).map((r) => `- ${r.harness} ${r.task} run ${r.run}: ${r.terminal}${r.error ? ", " + r.error.slice(0, 160) : ""}; failed checks: ${r.grade?.checks?.filter((c) => !c.ok).map((c) => c.name).join(", ") || "-"}`));
  if (failedRuns.length) {
    out.push("");
    out.push("## Failed runs");
    out.push("");
    out.push(...failedRuns);
  }
  console.log(out.join("\n"));
  if (doCheck && suites[1]) {
    const fails = check(suites[0], suites[1]);
    if (fails.length) {
      console.error("\nREGRESSION:\n" + fails.map((f) => "- " + f).join("\n"));
      process.exit(1);
    }
    console.log("\nno regression beyond two standard errors");
  }
}

main();
