#!/usr/bin/env node
// PreToolUse guard on Write/Edit — deterministic enforcement of two CLAUDE.md
// contracts that were previously prompt-discipline only:
//   1. artifacts/ writes must target a directory registered in ## Artifact Ownership.
//   2. .claude/agent-memory/<agent>/ writes must be a registered file kind
//      (## Agent memory layout — this is what makes a 192KB shadow file impossible).
// Exit 0 = allow. Exit 2 = block the tool call; stderr is shown to the agent.
// Rules are agent-agnostic by design — no fragile agent-identity detection.
import { readFileSync } from "node:fs";
import { relative, isAbsolute } from "node:path";

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // malformed input — fail open, never brick the session
}

const cwd = data.cwd ?? process.cwd();
const filePath = data.tool_input?.file_path;
if (!filePath) process.exit(0);

let rel = isAbsolute(filePath) ? relative(cwd, filePath) : filePath;
rel = rel.replaceAll("\\", "/").replace(/^\.\//, "");
if (rel.startsWith("..")) process.exit(0); // outside the project — not ours to police

function deny(reason) {
  process.stderr.write(`guard.write: BLOCKED ${rel} — ${reason}\n`);
  process.exit(2);
}

// Rule 1 — registered artifact directories only (CLAUDE.md ## Artifact Ownership).
if (rel.startsWith("artifacts/")) {
  const REGISTERED = ["reports", "api", "inbound", "strategy", "adr", "plans", "sql"];
  const m = /^artifacts\/([^/]+)\//.exec(rel);
  if (!m) deny("files directly under artifacts/ are unregistered; write into a registered subdirectory");
  if (!REGISTERED.includes(m[1]))
    deny(`artifacts/${m[1]}/ is not in the CLAUDE.md ownership table — a new artifact kind gets a row there first`);
}

// Rule 2 — registered agent-memory file kinds only (CLAUDE.md ## Agent memory layout).
const am = /^\.claude\/agent-memory\/[^/]+\/(.+)$/.exec(rel);
if (am) {
  const name = am[1];
  const ok =
    name === "MEMORY.md" ||
    name === "lessons.md" ||
    /^(plan|adr|report|review|sdr|charter|context-map)-[^/]+\.md$/.test(name);
  if (!ok)
    deny(
      "unregistered agent-memory file kind (allowed: MEMORY.md, lessons.md, " +
        "plan-*/adr-*/report-*/review-*/sdr-*/charter-*/context-map-*.md; no subdirectories)"
    );
}

process.exit(0);
