// Shared turn-block extraction + contract detection for the Stop / SubagentStop
// hooks (guard.verdict.mjs, emit.metrics.mjs).
//
// Why this exists: a named teammate ends its turn with ONE SendMessage carrying
// its <output_format> block verbatim (CLAUDE.md ## Turn discipline), so the
// contract text lives in a TOOL INPUT inside the *subagent's* transcript — not
// in the team lead's final assistant text, which CLAUDE.md ## Agent
// Communication forbids from re-quoting teammate output at all. Hooks that read
// only the lead's last text therefore see no teammate block, ever. Measured on
// the development umbrella before this fix: 1 gate event in 633 ledger lines,
// against 131 ADRs and 200+ review records on disk.
//
// Both hooks import one extractor and one detection table so the "same
// content-keyed heuristics" claim in their headers is structurally true instead
// of a comment that drifts.
import { openSync, fstatSync, readSync, closeSync, existsSync } from "node:fs";

// --- Transcript reading ----------------------------------------------------
// Scan the tail, not the whole file: a 200-turn transcript is megabytes, and the
// block we want is always in the LAST assistant entry. Windows escalate only if
// no assistant entry is found (very long single lines, e.g. a huge tool input).
const WINDOWS = [512 * 1024, 4 * 1024 * 1024, Infinity];

function readTail(path, maxBytes) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = maxBytes === Infinity ? 0 : Math.max(0, size - maxBytes);
    const len = size - start;
    if (len <= 0) return "";
    const buf = Buffer.allocUnsafe(len);
    readSync(fd, buf, 0, len, start);
    let s = buf.toString("utf8");
    if (start > 0) {
      const nl = s.indexOf("\n"); // drop the partial line the window cut through
      s = nl === -1 ? "" : s.slice(nl + 1);
    }
    return s;
  } finally {
    closeSync(fd);
  }
}

function lastAssistantEntry(path) {
  for (const win of WINDOWS) {
    let chunk;
    try {
      chunk = readTail(path, win);
    } catch {
      return null;
    }
    const lines = chunk.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim() || !line.includes('"assistant"')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // truncated or unrelated line
      }
      if (entry?.type === "assistant" && Array.isArray(entry.message?.content)) return entry;
    }
    if (win === Infinity) break;
  }
  return null;
}

// --- Candidate texts -------------------------------------------------------
// SendMessage is matched loosely: the team tool may surface plain or MCP-scoped.
const SEND_TOOLS = /(^|__)SendMessage$/;
// Preferred payload keys, then longest-string fallback — so a field rename in
// the team tool degrades to "still finds the body" rather than "sees nothing".
const BODY_KEYS = ["message", "content", "text", "body", "summary", "prompt"];

function stringsFrom(value, depth = 0, out = []) {
  if (depth > 3 || value == null) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "object") for (const v of Object.values(value)) stringsFrom(v, depth + 1, out);
  return out;
}

function bodyFromToolInput(input) {
  if (!input || typeof input !== "object") return "";
  for (const k of BODY_KEYS) if (typeof input[k] === "string" && input[k].trim()) return input[k];
  return stringsFrom(input).sort((a, b) => b.length - a.length)[0] ?? "";
}

// --- Contract detection ----------------------------------------------------
// Order is load-bearing and must match the previous emit.metrics.mjs order, so
// the same text keeps classifying to the same block across this change.
const BLOCKS = [
  ["crosscheck", /^##\s+Cross-check:/m],
  ["cumulative", /^##\s+Cumulative Review\s+—/m],
  ["perphase", /^##\s+Phase Review\s+—/m],
  ["amendment", /^##\s+Architect Amendment\s+—/m],
  ["all-phases", /^##\s+All Phases Complete\s+—/m],
  ["phase", /^##\s+Phase\s+\d+\s+(Complete|Stalled)\s+—/m],
  ["discussion", /^Mode:\s+Discussion/m],
];

export function detectBlock(text) {
  if (!text) return null;
  for (const [name, re] of BLOCKS) if (re.test(text)) return name;
  return null;
}

export const VERDICTS = new Set(["ALIGNED", "DRIFT DETECTED", "APPROVED", "CHANGES REQUIRED"]);

export function blockLines(text) {
  const lines = text.split(/\r?\n/).filter((l) => !/^\s*```/.test(l.trim()));
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  return { lines, nonEmpty, last: (nonEmpty[nonEmpty.length - 1] ?? "").trim() };
}

export function detectVerdict(text) {
  const { last } = blockLines(text);
  return VERDICTS.has(last) ? last : null;
}

export function detectClassification(text) {
  return /^Classification:\s+(CODE_DRIFT|ADR_AMENDED|PLAN_UPDATED)\s*$/m.exec(text)?.[1] ?? null;
}

export function detectScope(text) {
  return /^\*\*Scope:\*\*\s*(full|delta)/m.exec(text)?.[1] ?? null;
}

// --- The one entry point both hooks call -----------------------------------
// Returns the turn's contract text plus the model that produced it, from a
// single tail read. Candidate order: SendMessage payloads (newest first), then
// the final assistant text, then the harness-supplied last_assistant_message.
// The first candidate carrying a recognised block header wins; with none, the
// plain final text is returned so non-block turns behave exactly as before.
//
// `includeToolPayloads` defaults to "only on a teammate's turn". The lead relays
// requests to teammates through SendMessage too, and one of those payloads can
// legitimately carry a block header (a forwarded amendment request). Judging the
// lead against a contract that belongs to someone else would invent violations
// and inflate gate counts, so the lead keeps its historical behaviour: its own
// final text, nothing else.
export function readTurn(data, { includeToolPayloads = isSubagentTurn(data) } = {}) {
  const candidates = [];
  let model = null;

  const path = data?.transcript_path;
  const entry = path && existsSync(path) ? lastAssistantEntry(path) : null;
  if (entry) {
    model = entry.message?.model ?? null;
    const content = entry.message.content;
    if (includeToolPayloads)
      for (let i = content.length - 1; i >= 0; i--) {
        const c = content[i];
        if (c?.type === "tool_use" && SEND_TOOLS.test(c.name ?? "")) {
          const body = bodyFromToolInput(c.input);
          if (body.trim()) candidates.push(body);
        }
      }
    const text = content
      .filter((c) => c?.type === "text")
      .map((c) => c.text)
      .join("\n");
    if (text.trim()) candidates.push(text);
  }
  if (typeof data?.last_assistant_message === "string" && data.last_assistant_message.trim())
    candidates.push(data.last_assistant_message);

  for (const c of candidates) if (detectBlock(c)) return { text: c, model };
  return { text: candidates.length ? candidates[candidates.length - 1] : "", model };
}

// True when this invocation is a teammate's turn ending, not the lead's.
export function isSubagentTurn(data) {
  return data?.hook_event_name === "SubagentStop" || Boolean(data?.agent_id);
}
