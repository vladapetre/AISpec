#!/usr/bin/env node
// PreToolUse guard on Write/Edit — deterministic enforcement of two CLAUDE.md
// contracts that were previously prompt-discipline only:
//   1. artifacts/ writes must target a directory registered in ## Artifact Ownership.
//   2. .claude/agent-memory/<agent>/ writes must be a registered file kind
//      (## Agent memory layout — this is what makes a 192KB shadow file impossible).
// Exit 0 = allow. Exit 2 = block the tool call; stderr is shown to the agent.
// Rules are agent-agnostic by design — no fragile agent-identity detection.
import { readFileSync } from "node:fs";
import { repoRelative } from "./lib/project-root.mjs";
import { checkArtifactPath, checkMemoryPath } from "./lib/ownership.mjs";

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // malformed input — fail open, never brick the session
}

const filePath = data.tool_input?.file_path;
if (!filePath) process.exit(0);

// Anchored to the project root, not the session cwd. Anchoring to cwd meant a
// session started in a subdirectory produced a "../.."-prefixed path, which the
// outside-the-project check then waved through — the guard failed open for
// exactly the writes it exists to stop (see lib/project-root.mjs).
let rel, outside;
try {
  ({ rel, outside } = repoRelative(data, filePath));
} catch {
  process.exit(0);
}
if (outside) process.exit(0); // genuinely outside the project — not ours to police

function deny(reason) {
  process.stderr.write(`guard.write: BLOCKED ${rel} — ${reason}\n`);
  process.exit(2);
}

// Rules live in lib/ownership.mjs, shared with lint.write.mjs --all so the
// write-time block and the bulk sweep cannot disagree about what is registered.
// Rule 1 — registered artifact directories (CLAUDE.md ## Artifact Ownership).
// Rule 2 — registered agent-memory file kinds (CLAUDE.md ## Agent memory layout).
const reason = checkArtifactPath(rel) ?? checkMemoryPath(rel);
if (reason) deny(reason);

process.exit(0);
