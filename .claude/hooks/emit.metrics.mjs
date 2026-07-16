#!/usr/bin/env node
// Stop-event telemetry — appends one JSONL line per turn to
// .claude/telemetry/ledger.jsonl so the workflow can be tuned from data
// instead of artifact archaeology. Captures per-session cumulative token
// usage, model, and (when the turn emitted a pipeline block) the block type,
// verdict, and amendment classification.
//
// emit.* naming class: adds signal, never blocks, never fails loudly.
// Analysis lives in .claude/telemetry/report.mjs.
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

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

let model = null;
let assistantCount = 0;
const usage = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
let lastText = "";

try {
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== "assistant") continue;
    assistantCount++;
    const msg = entry.message ?? {};
    if (msg.model) model = msg.model;
    const u = msg.usage ?? {};
    usage.input += u.input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
    usage.cache_read += u.cache_read_input_tokens ?? 0;
    usage.cache_creation += u.cache_creation_input_tokens ?? 0;
    if (Array.isArray(msg.content)) {
      const t = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      if (t.trim()) lastText = t;
    }
  }
} catch {
  bail();
}

// Block/verdict detection — same content-keyed heuristics as guard.verdict.mjs.
const lines = lastText.split(/\r?\n/).filter((l) => !/^\s*```/.test(l.trim()));
const nonEmpty = lines.filter((l) => l.trim() !== "");
const last = (nonEmpty[nonEmpty.length - 1] ?? "").trim();
let block = null;
if (/^##\s+Cross-check:/m.test(lastText)) block = "crosscheck";
else if (/^##\s+Cumulative Review\s+—/m.test(lastText)) block = "cumulative";
else if (/^##\s+Phase Review\s+—/m.test(lastText)) block = "perphase";
else if (/^##\s+Architect Amendment\s+—/m.test(lastText)) block = "amendment";
else if (/^##\s+All Phases Complete\s+—/m.test(lastText)) block = "all-phases";
else if (/^##\s+Phase\s+\d+\s+(Complete|Stalled)\s+—/m.test(lastText)) block = "phase";
else if (/^Mode:\s+Discussion/m.test(lastText)) block = "discussion";

const VERDICTS = new Set(["ALIGNED", "DRIFT DETECTED", "APPROVED", "CHANGES REQUIRED"]);
const verdict = VERDICTS.has(last) ? last : null;
const classification = /^Classification:\s+(CODE_DRIFT|ADR_AMENDED|PLAN_UPDATED)\s*$/m.exec(lastText)?.[1] ?? null;
const scope = /^\*\*Scope:\*\*\s*(full|delta)/m.exec(lastText)?.[1] ?? null;

const record = {
  ts: new Date().toISOString(),
  session: data.session_id ?? null,
  model,
  turns: assistantCount,
  usage, // cumulative for the session — report.mjs takes the last line per session
  ...(block && { block }),
  ...(verdict && { verdict }),
  ...(classification && { classification }),
  ...(scope && { scope }),
};

try {
  const cwd = data.cwd ?? process.cwd();
  const ledger = join(cwd, ".claude", "telemetry", "ledger.jsonl");
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, JSON.stringify(record) + "\n");
} catch {
  // ignore — telemetry is best-effort
}
process.exit(0);
