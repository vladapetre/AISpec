#!/usr/bin/env node
// PostToolUse observer on Bash — records what was actually executed, so the
// developer's `**Verification:**` claim can be checked against reality instead of
// taken on trust (implement.md step 7a; rationale in lib/drive-evidence.mjs).
//
// The agent cannot write this log, which is the whole point: guard.verdict reads
// it to distinguish "I drove the flow" from "I said I drove the flow".
//
// observe.* naming class: records signal, never blocks, never fails loudly —
// it runs AFTER the tool, so it cannot affect whether the command was allowed.
import { readFileSync } from "node:fs";
import { projectRoot } from "./lib/project-root.mjs";
import { appendEvidence, isDriveCommand, treeHash } from "./lib/drive-evidence.mjs";

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const cmd = data.tool_input?.command;
if (typeof cmd !== "string" || !cmd.trim()) process.exit(0);

try {
  const root = projectRoot(data);
  const drive = isDriveCommand(cmd);
  appendEvidence(root, {
    ts: new Date().toISOString(),
    session: data.session_id ?? null,
    ...(data.agent_id && { agent_id: data.agent_id }),
    ...(data.agent_type && { agent_type: data.agent_type }),
    cmd: cmd.replace(/\s+/g, " ").slice(0, 200),
    drive,
    // Only drives carry a tree hash — it is what ties the observation to the code
    // it ran against, and computing it costs two git calls.
    ...(drive && { tree: treeHash(root) }),
  });
} catch {
  // ignore — observation is best-effort
}
process.exit(0);
