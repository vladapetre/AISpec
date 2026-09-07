// Adapter for the trunk harness (team lead + five named teammates, verdict tokens, artifacts/ tree).
// An adapter knows three things the runner does not: how to install the harness into a fixture repo,
// how to recognise a user gate in the final text and what an eager approver replies, and how to read
// the routing signals (lane, verdicts) out of a run.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { filesMatching } from "../lib/grade.mjs";

export const name = "trunk";

/** Sub-trees of .claude that are per-machine or per-session state, never part of the contract. */
const SKIP = ["telemetry", "state", "agent-memory", "branching", "settings.local.json", "PROJECT-MAP.md"];

export function install(repo, harnessRoot) {
  if (!existsSync(join(harnessRoot, ".claude", "agents", "developer.md"))) {
    throw new Error(`not a trunk harness root: ${harnessRoot}`);
  }
  cpSync(join(harnessRoot, "CLAUDE.md"), join(repo, "CLAUDE.md"));
  cpSync(join(harnessRoot, ".claude"), join(repo, ".claude"), {
    recursive: true,
    filter: (src) => !SKIP.some((s) => src.replaceAll("\\", "/").includes(`/.claude/${s}`)),
  });
  for (const d of ["reports", "api", "inbound", "strategy", "adr", "plans", "sql"]) mkdirSync(join(repo, "artifacts", d), { recursive: true });
  mkdirSync(join(repo, ".claude", "telemetry"), { recursive: true });
  mkdirSync(join(repo, ".claude", "state"), { recursive: true });
  rmSync(join(repo, ".claude", "settings.local.json"), { force: true });
}

const GATES = [
  { kind: "approval", re: /Requesting approval from:\s*USER/ },
  { kind: "ask", re: /^\s*Result:\s*ASK:/m },
  { kind: "paused", re: /^\s*PAUSED\b/m },
  { kind: "irreversible", re: /\[IRREVERSIBLE\][^\n]*\b(confirm|confirmation)\b/i },
  { kind: "stalled", re: /^## Phase \d+ Stalled/m },
  { kind: "bound", re: /CYCLE BOUND REACHED:/ },
];

/**
 * Decide whether the run stopped at a user gate and what the scripted user answers.
 * The persona is an eager approver: it approves every phase, grants any run offer it is shown,
 * and answers open questions with a fixed line so every run of a task sees the same user.
 */
export function gate(text, task) {
  for (const g of GATES) {
    if (!g.re.test(text)) continue;
    if (g.kind === "stalled" || g.kind === "bound") return { isGate: false, kind: g.kind, reply: null };
    if (g.kind === "approval") {
      const offer = text.match(/\*\*Run offer:\*\*\s*phases?\s*(\d+)\s*(?:to|–|-|—)\s*(\d+)/i);
      return { isGate: true, kind: g.kind, reply: offer ? `approved through ${offer[2]}` : "approved" };
    }
    if (g.kind === "irreversible") return { isGate: true, kind: g.kind, reply: "confirmed, proceed" };
    return { isGate: true, kind: g.kind, reply: task.answer ?? "Proceed with your recommended option; do not ask again unless blocked." };
  }
  return { isGate: false, kind: null, reply: null };
}

const VERDICTS = ["SELF_CHECKED", "CROSS_CHECK_REQUESTED", "ALIGNED", "DRIFT DETECTED", "APPROVED", "CHANGES REQUIRED", "ARCHITECT AMENDMENT NEEDED"];

/** Lane and verdict sequence, read from the concatenated final texts and the tool summary. */
export function signals(texts, summary) {
  const text = texts.join("\n");
  const verdicts = [];
  for (const m of text.matchAll(new RegExp(VERDICTS.map((v) => v.replace(/ /g, "\\s+")).join("|"), "g"))) {
    verdicts.push(m[0].replace(/\s+/g, " "));
  }
  let lane = "direct";
  if (/## Phase \d+ Complete/.test(text) || /## All Phases Complete/.test(text)) lane = "pipeline";
  else if (summary.subagents > 0) lane = "delegated";
  if (/expedit/i.test(text) && lane === "direct") lane = "expedited";
  return { lane, verdicts, route: `${lane}:${[...new Set(verdicts)].join(">") || "-"}` };
}

export function reportFiles(repo) {
  return filesMatching(repo, "artifacts/reports/*.md");
}

/** Tools the scripted user would have allowed once and for all. Identical across harnesses. */
export const allowedTools = [
  "Bash(npm *)",
  "Bash(npx *)",
  "Bash(node *)",
  "Bash(echo *)",
  "Bash(mkdir *)",
  "Bash(ls *)",
  "Bash(cat *)",
  "Bash(head *)",
  "Bash(tail *)",
  "Bash(wc *)",
  "Bash(git add *)",
  "Bash(git commit *)",
  "Bash(git status*)",
  "Bash(git diff*)",
  "Bash(git log*)",
  "Bash(git show*)",
  "Bash(git rev-parse*)",
  "Bash(git ls-files*)",
  "Bash(git blame*)",
];
