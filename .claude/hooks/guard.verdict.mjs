#!/usr/bin/env node
// Stop guard — verifies output-format invariants on the turn's final assistant
// message, keyed on the block headers it contains (agent-agnostic: whoever emits
// a review block must close it legally). Exit 2 blocks the stop and shows stderr,
// so the agent finishes its contract instead of ending the turn half-emitted.
// This is the machine check behind tokens.yaml's "verdict tokens are matched as
// exact strings; near-matches are rejections."
import { readFileSync, existsSync } from "node:fs";

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
if (data.stop_hook_active) process.exit(0); // loop guard — never re-block a corrected stop

const transcriptPath = data.transcript_path;
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

let text = "";
try {
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== "assistant") continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    const t = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (t.trim()) text = t; // keep the LAST assistant text
  }
} catch {
  process.exit(0);
}
if (!text) process.exit(0);

// Strip code-fence lines; the templates are shown fenced but emitted content may
// carry the fences through.
const lines = text.split(/\r?\n/).filter((l) => !/^\s*```/.test(l.trim()));
const nonEmpty = lines.filter((l) => l.trim() !== "");
const last = (nonEmpty[nonEmpty.length - 1] ?? "").trim();
const has = (re) => re.test(text);
const violations = [];

// PAUSED turns are legal mid-contract exits for every agent.
if (/^PAUSED\b/m.test(text)) process.exit(0);

if (has(/^##\s+Cross-check:/m)) {
  if (last !== "ALIGNED" && last !== "DRIFT DETECTED")
    violations.push('cross-check block must end with exactly "ALIGNED" or "DRIFT DETECTED" on its own final line');
}
if (has(/^##\s+(Phase Review|Cumulative Review)\s+—/m)) {
  if (last !== "APPROVED" && last !== "CHANGES REQUIRED")
    violations.push('review block must end with exactly "APPROVED" or "CHANGES REQUIRED" on its own final line');
}
if (has(/^##\s+Architect Amendment\s+—/m)) {
  if (!/^Classification:\s+(CODE_DRIFT|ADR_AMENDED|PLAN_UPDATED)\s*$/m.test(text))
    violations.push("amendment block is missing a legal Classification line (CODE_DRIFT | ADR_AMENDED | PLAN_UPDATED)");
  if (!(last.startsWith("CROSS_CHECK_REQUESTED:") || last === "SELF_CHECKED (delta)" || last === "_N/A — CODE_DRIFT_"))
    violations.push('amendment block must end with the M5a routing line: "CROSS_CHECK_REQUESTED: …", "SELF_CHECKED (delta)", or "_N/A — CODE_DRIFT_"');
}
if (has(/^##\s+Phase\s+\d+\s+Complete\s+—/m) && !has(/^##\s+All Phases Complete/m)) {
  if (!/Requesting approval from:\s*USER/.test(text))
    violations.push('phase summary must end by requesting approval: "Requesting approval from: USER"');
}
if (has(/^##\s+All Phases Complete\s+—/m)) {
  if (!/Requesting cumulative review from:\s*REVIEWER/.test(text))
    violations.push('end-of-plan summary must route to the reviewer: "Requesting cumulative review from: REVIEWER"');
}

if (violations.length) {
  process.stderr.write(
    "guard.verdict: the turn's output block violates its contract —\n" +
      violations.map((v) => `  - ${v}`).join("\n") +
      "\nEmit the corrected block, then stop.\n"
  );
  process.exit(2);
}
process.exit(0);
