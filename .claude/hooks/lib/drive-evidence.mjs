// Drive evidence — the machine record behind the developer's `**Verification:**`
// field (implement.md step 7a, detectors.yaml#verification_rules).
//
// Why this exists: step 7a already says the right thing — "Verified means
// OBSERVED at runtime — a command you ran and output you saw. Reading the code
// again is not verification." But guard.verdict only checked that the field was
// non-empty, so `**Verification:** ran the flow, looked fine` passed. The
// contract was well-specified and unenforced: the one place the harness took a
// claim on trust for a fact that opens a gate.
//
// The colleague's harness solves this with a stamp written BY the verify script.
// We have no fixed script — the developer drives the flow with a project-detected
// command — so the evidence comes from OBSERVING what actually ran:
// observe.bash.mjs records every Bash call, and the agent cannot write that log.
//
// Deliberately asymmetric: the classifier below treats anything that is not a
// recognised inspection command as a drive. A false "that was a drive" only
// preserves today's behaviour (a claim passes); a false "that was not a drive"
// would block real work. Bias accordingly.
import { existsSync, appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export const DRIVE_LOG = join(".claude", "state", "drive-log.jsonl");

// Inspection commands: reading the repo, asking git questions, checking syntax.
// None of these can constitute runtime evidence for an acceptance criterion.
const INSPECT = [
  /^git\s+(status|log|diff|show|blame|ls-files|rev-parse|describe|shortlog|branch|remote|stash\s+list|config)\b/,
  /^(rg|grep|egrep|fgrep|ack)\b/,
  /^(cat|head|tail|less|more|bat)\b/,
  /^(ls|dir|find|tree|pwd|cd|stat|file|wc|du|df)\b/,
  /^(sed|awk|cut|sort|uniq|tr|jq|yq)\b/,
  /^(echo|printf|true|false|test|which|type|whoami|date|env|printenv)\b/,
  /^node\s+--check\b/,
  /^(mkdir|touch|cp|mv|ln)\b/, // filesystem shuffling is not runtime evidence
  /^(Get-|Test-Path|Select-String|Measure-Object|Resolve-Path)/i, // read-only PS cmdlets
];

// A compound command counts as a drive if ANY segment does.
export function isDriveCommand(cmd) {
  if (typeof cmd !== "string" || !cmd.trim()) return false;
  const segments = cmd
    .split(/&&|\|\||;|\|/)
    .map((s) => s.trim().replace(/^[({\s]+/, ""))
    .filter(Boolean);
  if (!segments.length) return false;
  return segments.some((seg) => !INSPECT.some((re) => re.test(seg)));
}

// Tree identity, so evidence can be tied to the code it was observed against.
// Documentation and harness bookkeeping are excluded: a phase legitimately ends
// by stamping a plan and writing memory, and neither invalidates a drive.
const EXCLUDES = [
  ":(exclude)*.md",
  ":(exclude)artifacts",
  ":(exclude).claude/agent-memory",
  ":(exclude).claude/state",
  ":(exclude).claude/telemetry",
];

export function treeHash(root) {
  try {
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const dirt = execFileSync("git", ["-C", root, "status", "--porcelain", "--", ".", ...EXCLUDES], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return createHash("sha1").update(`${head}\n${dirt}`).digest("hex").slice(0, 16);
  } catch {
    return null; // not a git repo, or git unavailable — evidence degrades to unstamped
  }
}

export function appendEvidence(root, record) {
  try {
    const path = join(root, DRIVE_LOG);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(record) + "\n");
  } catch {
    // best-effort: evidence recording must never break a tool call
  }
}

export function readEvidence(root) {
  try {
    const path = join(root, DRIVE_LOG);
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// What does the phase summary's `**Verification:**` field actually claim?
// The two exemption forms are contract-legal (implement.md step 7a) and must stay
// passable without evidence — that is the point. Making the exemption the only
// honest way past the gate is the win: it is explicit, and the user sees it.
export function classifyVerification(text) {
  const m = /^\*\*Verification:\*\*\s*(.+)$/m.exec(text);
  if (!m) return { claim: "missing", detail: "" };
  const line = m[1].trim();
  if (!line) return { claim: "missing", detail: "" };
  if (/^no drivable surface\b/i.test(line)) return { claim: "exempt-no-surface", detail: line };
  if (/^not drivable in this environment\b/i.test(line)) return { claim: "exempt-blocked", detail: line };
  return { claim: "drive", detail: line };
}

// Drive evidence relevant to the phase being summarised: entries recorded after
// the previous phase block cleared in this session. Without that boundary a
// single early drive would vouch for every later phase in a long session.
export function drivesForCurrentPhase(root, sessionId) {
  const rows = readEvidence(root).filter((r) => !sessionId || r.session === sessionId);
  let start = 0;
  for (let i = rows.length - 1; i >= 0; i--)
    if (rows[i].marker === "phase-cleared") {
      start = i + 1;
      break;
    }
  return rows.slice(start).filter((r) => r.drive);
}
