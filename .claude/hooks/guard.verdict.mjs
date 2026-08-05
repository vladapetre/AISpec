#!/usr/bin/env node
// Stop / SubagentStop guard — verifies output-format invariants on the turn's
// contract block, keyed on the block headers it contains (agent-agnostic:
// whoever emits a review block must close it legally). Exit 2 blocks the stop and
// shows stderr, so the agent finishes its contract instead of ending the turn
// half-emitted. This is the machine check behind tokens.yaml's "verdict tokens
// are matched as exact strings; near-matches are rejections."
//
// Wired to BOTH events on purpose. Named teammates end a turn with ONE
// SendMessage carrying their block verbatim (CLAUDE.md ## Turn discipline), and
// the lead is forbidden from re-quoting it (## Agent Communication) — so a
// Stop-only guard never saw a single teammate block and this check was, in
// practice, prompt-discipline. Extraction lives in lib/turn-block.mjs, shared
// with emit.metrics.mjs; that module also confines SendMessage-payload reading to
// teammate turns, so the lead's behaviour here is unchanged.
//
// The checks below are byte-for-byte the previous ones: this change fixes WHICH
// TEXT is judged, and deliberately does not relax WHAT is required.
import { readFileSync } from "node:fs";
import { readTurn, isSubagentTurn } from "./lib/turn-block.mjs";
import { projectRoot } from "./lib/project-root.mjs";
import { appendEvidence, classifyVerification, drivesForCurrentPhase } from "./lib/drive-evidence.mjs";

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
if (data.stop_hook_active) process.exit(0); // loop guard — never re-block a corrected stop

let text = "";
try {
  text = readTurn(data).text;
} catch {
  process.exit(0); // unreadable transcript — fail open, never brick a turn
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
const isPhaseSummary = has(/^##\s+Phase\s+\d+\s+Complete\s+—/m) && !has(/^##\s+All Phases Complete/m);
if (isPhaseSummary) {
  if (!/Requesting approval from:\s*USER/.test(text))
    violations.push('phase summary must end by requesting approval: "Requesting approval from: USER"');
  if (!/^\*\*Verification:\*\*\s*\S/m.test(text))
    violations.push('phase summary must carry a populated "**Verification:**" field — observed runtime evidence, or an honest exemption/blocker (implement.md step 7a)');

  // A claimed drive must have actually happened. observe.bash.mjs records every
  // Bash call, so "I drove the flow" is checkable rather than trusted. Only the
  // unambiguous case blocks: the field claims a drive and the harness observed
  // NO drive-class command at all for this phase. Both honest exemption forms
  // pass untouched — making the exemption the only way past without evidence is
  // the design, since the user then sees it stated.
  const { claim } = classifyVerification(text);
  if (claim === "drive") {
    let observed = [];
    try {
      observed = drivesForCurrentPhase(projectRoot(data), data.session_id);
    } catch {
      observed = [{ unknown: true }]; // evidence unreadable — never block on our own failure
    }
    if (!observed.length)
      violations.push(
        '"**Verification:**" claims a command was driven, but no drive-class command was observed for this phase. ' +
          "Drive the flow through its real entry point and quote the observed output, or state the honest exemption " +
          '("no drivable surface — <reason>" / "not drivable in this environment — <blocker>"). Re-reading code is not verification.'
      );
  }
}
if (has(/^##\s+All Phases Complete\s+—/m)) {
  if (!/Requesting cumulative review from:\s*REVIEWER/.test(text))
    violations.push('end-of-plan summary must route to the reviewer: "Requesting cumulative review from: REVIEWER"');
}

if (violations.length) {
  const where = isSubagentTurn(data)
    ? `the block you are sending to the team lead${data.agent_type ? ` (${data.agent_type})` : ""}`
    : "the turn's output block";
  process.stderr.write(
    `guard.verdict: ${where} violates its contract —\n` +
      violations.map((v) => `  - ${v}`).join("\n") +
      "\nEmit the corrected block, then stop.\n"
  );
  process.exit(2);
}

// A phase summary that cleared closes the evidence window: drives recorded from
// here on belong to the NEXT phase. Without this boundary one early drive would
// vouch for every later phase in the same session.
if (isPhaseSummary) {
  try {
    appendEvidence(projectRoot(data), {
      ts: new Date().toISOString(),
      session: data.session_id ?? null,
      marker: "phase-cleared",
    });
  } catch {
    // best-effort
  }
}
process.exit(0);
