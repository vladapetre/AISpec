#!/usr/bin/env node
// Stop / SubagentStop guard — enforces the output-brief contract on the turn's
// block: `assets/brief.yaml` rules `nil_collapse` and `cap`. Exit 2 blocks the
// stop and shows stderr, so the agent re-emits a collapsed block instead of
// ending the turn with a wall of `_None_`.
//
// Why a hook and not prose. Every `## Output format` used to say "always render
// every block; use `_None_` for empty lists", so a two-file phase cost the
// reader the same ~25 lines as a twelve-file one. That rule is now inverted, and
// a length rule stated only in a mode file drifts back within a month — the same
// argument lib/ownership.mjs makes for its own existence. The self-check box is
// the habit; this is the backstop.
//
// Deliberately conservative in both directions. It flags only the unambiguous
// literal placeholders (`_None_`, `(none)`, `_N/A_`), never a judgement call
// like `Strategic review needed: no`, because a false bounce costs a whole turn
// and teaches the agent to pad the block to get past the gate. And the cap only
// bounces well past its soft budget: the target is a block that ignored the
// contract wholesale, not one that ran three lines long carrying real findings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readTurn, isSubagentTurn } from "./lib/turn-block.mjs";
import { projectRoot } from "./lib/project-root.mjs";

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
if (!text || /^PAUSED\b/m.test(text)) process.exit(0);

// --- Which key governs this block ------------------------------------------
// Headings first (they are the contract's own identity), then the distinctive
// field line for the blocks that carry no heading.
const KEYS = [
  ["developer-stalled", /^##\s+Phase\s+\d+\s+Stalled\s+—/m],
  ["reviewer-crosscheck", /^##\s+Cross-check:/m],
  ["reviewer-perphase", /^##\s+(Cumulative Review|Phase Review)\s+—/m],
  ["architect-amendment", /^##\s+Architect Amendment\s+—/m],
  ["developer-implement", /^##\s+(All Phases Complete|Phase\s+\d+\s+Complete)\s+—/m],
  ["consultant-discussion", /^Mode:\s+Discussion\s*$/m],
  ["architect-design", /^Design record:/m],
  ["consultant-artifact", /^Artifacts written\/updated:/m],
  ["analyst", /^Confidence:\s*VERIFIED=/m],
];
const key = KEYS.find(([, re]) => re.test(text))?.[0];
if (!key) process.exit(0); // not a contract block — nothing to govern

// --- The registry ----------------------------------------------------------
// A targeted reader, not a YAML parser: this needs two scalars per key, and a
// vendored parser for that would be more code than the thing it reads. The
// stalled-block budget lives in developer-rejection's `notes:` prose, so it is
// stated here as the one number the file does not carry structurally.
const STALLED_CAP = 8;
function registry() {
  const path = join(projectRoot(data), ".claude", "agents", "assets", "brief.yaml");
  const yaml = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const out = new Map();
  for (const m of yaml.matchAll(/^([a-z][\w-]*):\n((?:[ \t]+\S[^\n]*\n|\n(?=[ \t]))*)/gm)) {
    const body = m[2];
    const cap = /^\s+cap:\s*(\d+)/m.exec(body)?.[1];
    const always = /^\s+always:\s*\[([^\]]*)\]/m.exec(body)?.[1] ?? "";
    if (cap) out.set(m[1], { cap: Number(cap), always: [...always.matchAll(/"([^"]*)"/g)].map((a) => a[1]) });
  }
  return out;
}

let entry;
try {
  entry = key === "developer-stalled" ? { cap: STALLED_CAP, always: [] } : registry().get(key);
} catch {
  process.exit(0); // registry unreadable — fail open
}
if (!entry) process.exit(0);

// --- Line classification ---------------------------------------------------
const raw = text.split(/\r?\n/).filter((l) => !/^\s*```/.test(l.trim()));
const nonEmpty = raw.filter((l) => l.trim() !== "");
const lastLine = (nonEmpty[nonEmpty.length - 1] ?? "").trim();

const isAlways = (line) => entry.always.some((label) => line.trim().startsWith(label));
// Critical/Major finding bullets carry the verdict's evidence and are exempt by
// contract (brief.yaml `cap`). Table rows are the detail files' business, and
// the cumulative block's changed-file union is machine_consumed.
const isExempt = (line) =>
  isAlways(line) ||
  /^\s*-\s*\[[CM]\d*\]/.test(line) ||
  /^\s*\|/.test(line) ||
  /^\s*<!--/.test(line);

// Only literal placeholders count as a rendered nil. `NONE IDENTIFIED` is a
// verdict value, `no` is a judgement, and neither is this hook's business.
const NIL_VALUE = /^(_None_|_None identified_|_N\/A\b[^\n]*|\(none\)|None|none)$/;
const FIELD = /^\s*(?:-\s*)?(\*\*[^*\n]+:\*\*|[A-Z][\w ()/[\]-]{0,40}:)\s*(.*)$/;

const violations = [];

// 1. nil_collapse — a rendered placeholder that should have been one word on the
//    `Nil:` line. The final routing line is exempt: `_N/A — CODE_DRIFT_` there is
//    a routing decision that guard.verdict.mjs requires verbatim.
// A list block renders its emptiness on the NEXT line (`**Deviations from
// plan:**` then `- _None_`), so the placeholder is attributed back to the label
// above it — that is the form the old templates mandated and the one this
// change exists to remove.
const rendered = [];
let label = null;
for (const line of raw) {
  if (line.trim() === lastLine || /^\s*\|/.test(line)) continue;
  const m = FIELD.exec(line);
  if (m) {
    label = m[1].replace(/\*\*/g, "").replace(/:$/, "");
    if (isAlways(line)) {
      label = null;
      continue;
    }
    if (NIL_VALUE.test(m[2].trim())) rendered.push(label);
    continue;
  }
  const bullet = /^\s*[-*]\s*(.+?)\s*$/.exec(line);
  if (bullet && label && NIL_VALUE.test(bullet[1])) {
    rendered.push(label);
    label = null;
  }
}
if (rendered.length)
  violations.push(
    `${rendered.length} field(s) rendered as an empty placeholder: ${rendered.join(", ")}. ` +
      `brief.yaml#rules.nil_collapse — drop the field and name it once on the "Nil:" line instead.`
  );

// 2. cap — bounced only well past the soft budget, so a block carrying real
//    content is never punished for its content.
const counted = nonEmpty.filter((l) => !isExempt(l)).length;
const hard = entry.cap + 10;
if (counted > hard)
  violations.push(
    `block is ${counted} countable lines against a ${entry.cap}-line budget for ${key} ` +
      `(findings, table rows, and always-fields already excluded). ` +
      `brief.yaml#rules.detail_to_artifact — move the tables and metadata to the key's detail file and keep one pointer line.`
  );

if (!violations.length) process.exit(0);

const where = isSubagentTurn(data)
  ? `the block you are sending to the team lead${data.agent_type ? ` (${data.agent_type})` : ""}`
  : "the turn's output block";
process.stderr.write(
  `guard.brief: ${where} exceeds its output-brief contract (assets/brief.yaml#${key}) —\n` +
    violations.map((v) => `  - ${v}`).join("\n") +
    "\nRe-emit the collapsed block, then stop.\n"
);
process.exit(2);
