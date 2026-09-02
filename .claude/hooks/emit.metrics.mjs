#!/usr/bin/env node
// Stop / SubagentStop telemetry — appends one JSONL line per turn to
// .claude/telemetry/ledger.jsonl so the workflow can be tuned from data instead
// of artifact archaeology. Captures the block type, verdict, and amendment
// classification when the turn emitted a pipeline block, plus per-session token
// usage on the lead's turns.
//
// Wired to BOTH events on purpose: named teammates emit their contract block
// from a SendMessage inside their own transcript, so a Stop-only hook records
// none of them (measured: 1 gate event in 633 lines). Detection and extraction
// live in lib/turn-block.mjs, shared with guard.verdict.mjs.
//
// Two rules keep the ledger's token accounting honest, since report.mjs treats
// the LAST line per session as that session's cumulative total:
//   - every record carries `event` ("stop" | "subagent_stop");
//   - subagent records carry NO `usage`/`turns` at all, so they can never
//     overwrite a session's totals — and skipping that scan keeps the added
//     per-teammate-turn cost to one bounded tail read.
//
// emit.* naming class: adds signal, never blocks, never fails loudly.
// Analysis lives in .claude/telemetry/report.mjs.
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  readTurn,
  detectBlock,
  detectVerdict,
  detectClassification,
  detectScope,
  isSubagentTurn,
  turnSpan,
} from "./lib/turn-block.mjs";
import { projectRoot } from "./lib/project-root.mjs";
import {
  classifyVerification,
  claimMatchesObserved,
  drivesForCurrentPhase,
  treeHash,
} from "./lib/drive-evidence.mjs";

function bail() {
  process.exit(0); // telemetry must never break a session
}

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  bail();
}

const transcriptPath = data.transcript_path;
if (!transcriptPath || !existsSync(transcriptPath)) bail();

const isSub = isSubagentTurn(data);

// A SubagentStop that hands us the MAIN session transcript has nothing of the
// teammate's to read: turnSpan would re-measure the lead's last turn (measured
// on the development umbrella: 68 of 88 timed subagent rows mirrored a stop
// row's exact duration and usage), and readTurn's tool-payload scan would judge
// the lead's own relayed SendMessages as teammate blocks. A subagent's
// transcript is never the session's own file, so drop the event entirely; if a
// harness version names transcripts differently the check simply never fires.
if (isSub && transcriptPath.replace(/\\/g, "/").endsWith(`/${data.session_id}.jsonl`)) bail();

// The turn's contract text — one bounded tail read, wherever the block lives.
let turn;
try {
  turn = readTurn(data);
} catch {
  bail();
}

const block = detectBlock(turn.text);
const verdict = detectVerdict(turn.text);
const classification = detectClassification(turn.text);
const scope = detectScope(turn.text);

// Phase-verification signal. `verification` is what the summary claimed;
// `drive_fresh` is whether the last observed drive ran against the CURRENT tree.
// Staleness is recorded but NOT enforced: a drive followed by an unverified source
// fix is exactly the defect worth catching, but excluding every legitimate
// post-drive edit is guesswork until there are numbers. Measure first, then set
// the threshold from the data (CLAUDE.md: tune from the numbers, not from feel).
let verification = null;
let driveFresh = null;
let claimMatched = null;
if (block === "phase") {
  try {
    const root = projectRoot(data);
    const { claim, detail } = classifyVerification(turn.text);
    verification = claim;
    if (verification === "drive") {
      const drives = drivesForCurrentPhase(root, data.session_id);
      if (!drives.length) verification = "drive-claimed-unobserved";
      else {
        const now = treeHash(root);
        const last = drives[drives.length - 1]?.tree ?? null;
        if (now && last) driveFresh = now === last;
        // Does the claimed command resemble one actually observed? Measured on
        // the same terms as drive_fresh: a paraphrased claim is not misconduct,
        // so this is a number to set a threshold from, not a gate.
        claimMatched = claimMatchesObserved(detail, drives);
      }
    }
  } catch {
    verification = null;
  }
}

// Token usage: lead turns only. The full-transcript scan is inherent (the ledger
// records cumulative per-session totals) but it is skipped entirely for
// teammates, whose usage would collide on the session key.
let model = turn.model;
let assistantCount = null;
let usage = null;
if (!isSub) {
  usage = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
  assistantCount = 0;
  try {
    for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.type !== "assistant") continue;
      assistantCount++;
      const msg = entry.message ?? {};
      if (msg.model) model = msg.model;
      const u = msg.usage ?? {};
      usage.input += u.input_tokens ?? 0;
      usage.output += u.output_tokens ?? 0;
      usage.cache_read += u.cache_read_input_tokens ?? 0;
      usage.cache_creation += u.cache_creation_input_tokens ?? 0;
    }
  } catch {
    bail();
  }
}

// Per-turn wall-clock and cost, for both events. Cheap (one bounded tail read)
// and it answers the question the cumulative totals cannot: was this turn slow
// because the model thought, because a tool ran, or because a human was away?
// `turn_usage` is deliberately NOT `usage` — see turnSpan's contract.
const span = turnSpan(transcriptPath);

const record = {
  ts: new Date().toISOString(),
  session: data.session_id ?? null,
  event: isSub ? "subagent_stop" : "stop",
  model,
  ...(span.durationMs !== null && { duration_ms: span.durationMs }),
  ...(span.usage && { turn_usage: span.usage }),
  ...(span.assistantTurns !== null && { turn_steps: span.assistantTurns }),
  ...(isSub && data.agent_type && { agent_type: data.agent_type }),
  ...(isSub && data.agent_id && { agent_id: data.agent_id }),
  ...(assistantCount !== null && { turns: assistantCount }),
  ...(usage && { usage }), // cumulative for the session — report.mjs takes the last line
  ...(block && { block }),
  ...(verdict && { verdict }),
  ...(classification && { classification }),
  ...(scope && { scope }),
  ...(verification && { verification }),
  ...(driveFresh !== null && { drive_fresh: driveFresh }),
  ...(claimMatched !== null && { claim_matched: claimMatched }),
};

try {
  // Anchor to the project root, never the session cwd: a session started in a
  // subdirectory forked the ledger (found live at
  // artifacts/.claude/telemetry/ledger.jsonl, 2 orphaned lines).
  //
  // Use projectRoot(), not `env ?? cwd`: without CLAUDE_PROJECT_DIR the inline
  // form fell straight back to the session cwd and reproduced the exact fork
  // this comment describes. projectRoot() walks up for the `.claude/` marker,
  // which is the only derivation that holds from a subdirectory or worktree.
  const ledger = join(projectRoot(data), ".claude", "telemetry", "ledger.jsonl");
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, JSON.stringify(record) + "\n");
} catch {
  // ignore — telemetry is best-effort
}
process.exit(0);
