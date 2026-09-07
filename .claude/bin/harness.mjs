#!/usr/bin/env node
// The kernel CLI. Every verb prints JSON on stdout (add --pretty for an indented copy, --human for a
// one-line human summary) and exits 0 on success, 1 on a usage error, 2 on a failed check.
//
//   harness admit [--request <file>|--text "<request>"] [--touched a,b]
//   harness new --lane <fast|order|design|research> --title "<title>" [--id <slug>] [--source <ref>]
//   harness list
//   harness state <id>
//   harness next <id>
//   harness preflight <id>
//   harness verify <id> <phase> [--no-tests]
//   harness route <id> --verdict "<TOKEN>" --agent <name> [--phase N] [--scope cumulative|checkpoint|crosscheck] [--through N] [--reason "<why>"]
//   harness cost [--session <id>] [--work <id>]
//   harness find-verdict --text "<block>"
//
import { readFileSync } from "node:fs";
import { admit } from "../lib/admit.mjs";
import { createWork, deriveState, listWork, projectRoot } from "../lib/work.mjs";
import { next } from "../lib/next.mjs";
import { preflight } from "../lib/preflight.mjs";
import { verify } from "../lib/verify.mjs";
import { route, findVerdict } from "../lib/route.mjs";
import { cost } from "../lib/cost.mjs";

function parse(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith("--")) opt[key] = true;
      else opt[key] = argv[++i];
    } else pos.push(a);
  }
  return { pos, opt };
}

function out(value, opt, text) {
  if (opt.human && text) console.log(text(value));
  else console.log(opt.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value));
}

function readRequest(opt) {
  if (opt.text) return String(opt.text);
  if (opt.request) return readFileSync(opt.request === "-" ? 0 : opt.request, "utf8");
  throw new Error("admit needs --text or --request <file|->");
}

function main(argv) {
  const { pos, opt } = parse(argv);
  const [verb, ...rest] = pos;
  const root = opt.root ?? projectRoot();
  switch (verb) {
    case "admit": {
      const r = admit(readRequest(opt), { root, touched: opt.touched ? String(opt.touched).split(",").filter(Boolean) : [] });
      out(r, opt, (v) => `lane: ${v.lane} (${v.reasons.join("; ")})`);
      return 0;
    }
    case "new": {
      if (!opt.lane || !opt.title) throw new Error("new needs --lane and --title");
      const s = createWork({ lane: opt.lane, title: String(opt.title), id: opt.id, source: opt.source, root });
      out({ ...s, dir: `work/${s.id}`, next: next(s.id, root) }, opt, (v) => `created work/${v.id} (${v.lane}) · next: ${v.next.action} by ${v.next.actor}`);
      return 0;
    }
    case "list": {
      const items = listWork(root).map((id) => {
        const d = deriveState(id, root);
        return { id, lane: d.lane, status: d.status, title: d.title, phases: `${d.phases_approved}/${d.phase_count}`, next: next(id, root).action };
      });
      out(items, opt, (v) => v.map((i) => `${i.id}  ${i.lane.padEnd(8)} ${i.status.padEnd(9)} ${i.phases.padEnd(5)} ${i.next.padEnd(16)} ${i.title}`).join("\n") || "(no work items)");
      return 0;
    }
    case "state": {
      if (!rest[0]) throw new Error("state needs <id>");
      out(deriveState(rest[0], root), opt);
      return 0;
    }
    case "next": {
      if (!rest[0]) throw new Error("next needs <id>");
      out(next(rest[0], root), opt, (v) => `${v.action} · ${v.actor ?? "-"}${v.phase ? ` · phase ${v.phase}` : ""} · ${v.detail}${v.options.length ? ` · ${v.options.join(" · ")}` : ""}`);
      return 0;
    }
    case "preflight": {
      if (!rest[0]) throw new Error("preflight needs <id>");
      const r = preflight(rest[0], root);
      out(r, opt, (v) => v.checks.map((c) => `${c.level.padEnd(4)} ${c.name}: ${c.detail}`).join("\n") + `\n${v.ok ? "PREFLIGHT OK" : "PREFLIGHT FAILED"}`);
      return r.ok ? 0 : 2;
    }
    case "verify": {
      if (!rest[0] || !rest[1]) throw new Error("verify needs <id> <phase>");
      const r = verify(rest[0], Number(rest[1]), { root, runTests: !opt["no-tests"] });
      out(r, opt, (v) => v.results.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}${c.detail ? ": " + c.detail : ""}`).join("\n") + `\n${v.ok ? "VERIFIED" : "NOT VERIFIED"}`);
      return r.ok ? 0 : 2;
    }
    case "route": {
      if (!rest[0] || !opt.verdict || !opt.agent) throw new Error("route needs <id> --verdict <TOKEN> --agent <name>");
      const r = route({ id: rest[0], verdict: String(opt.verdict), agent: String(opt.agent), phase: opt.phase ? Number(opt.phase) : undefined, scope: opt.scope, through: opt.through ? Number(opt.through) : undefined, reason: opt.reason, root });
      out(r, opt, (v) => `${v.verdict} applied (${v.applied.join(", ") || "recorded"}) · next: ${v.next.action} by ${v.next.actor ?? "-"}${v.next.phase ? ` · phase ${v.next.phase}` : ""}`);
      return 0;
    }
    case "cost": {
      out(cost({ root, session: opt.session, work_id: opt.work }), opt, (v) => `${v.rows} turns · $${v.cost_usd.toFixed(2)} · cache ${v.cache_hit_ratio == null ? "-" : Math.round(v.cache_hit_ratio * 100) + "%"} · ${v.tokens_per_accepted_line == null ? "-" : Math.round(v.tokens_per_accepted_line)} tok/line · stops ${v.stops} · bounces ${v.bounces}`);
      return 0;
    }
    case "find-verdict": {
      out({ verdict: findVerdict(opt.text ?? readFileSync(0, "utf8")) }, opt, (v) => v.verdict ?? "");
      return 0;
    }
    default:
      throw new Error(`unknown verb "${verb ?? ""}". Verbs: admit new list state next preflight verify route cost find-verdict`);
  }
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (err) {
  console.error(`harness: ${err.message}`);
  process.exit(1);
}
