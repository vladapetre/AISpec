#!/usr/bin/env node
// Status line: `<lane> · <id> · phase a/b · next: <action> · ctx 41% · $1.20 · cache 93%`.
// Reads Claude Code's status-line JSON on stdin and the newest open work item from disk.
// Enable in the user's settings.json:
//   "statusLine": { "type": "command", "command": "node .claude/bin/statusline.mjs" }
import { readFileSync } from "node:fs";
import { projectRoot, listWork, deriveState } from "../lib/work.mjs";
import { next } from "../lib/next.mjs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {}

const parts = [];
try {
  const root = projectRoot(input.cwd ?? input.workspace?.current_dir);
  const open = listWork(root)
    .map((id) => deriveState(id, root))
    .filter((s) => s.status === "open" || s.status === "blocked")
    .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
  if (open.length) {
    const s = open[0];
    const n = next(s.id, root);
    parts.push(s.lane, s.id, s.phase_count ? `phase ${s.phases_approved}/${s.phase_count}` : null, `next: ${n.action}${n.actor ? ` (${n.actor})` : ""}`);
    if (open.length > 1) parts.push(`+${open.length - 1} open`);
  } else parts.push("no open work");
} catch {
  parts.push("harness: no work dir");
}

const ctx = input.context_window;
if (ctx?.used_percentage != null) parts.push(`ctx ${Math.round(ctx.used_percentage)}%`);
else if (ctx?.used_tokens && ctx?.context_window_size) parts.push(`ctx ${Math.round((ctx.used_tokens / ctx.context_window_size) * 100)}%`);
if (input.cost?.total_cost_usd != null) parts.push(`$${input.cost.total_cost_usd.toFixed(2)}`);
if (input.prompt_cache?.hit_ratio != null) parts.push(`cache ${Math.round(input.prompt_cache.hit_ratio * 100)}%`);
if (input.model?.display_name) parts.push(input.model.display_name);

process.stdout.write(parts.filter(Boolean).join(" · "));
