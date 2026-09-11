#!/usr/bin/env node
// PreToolUse on Write | Edit: two mechanical rules.
//   1. Kernel-owned files are never written by a model: work/<id>/state.yaml, work/<id>/phases/*,
//      work/<id>/verdicts.jsonl, and everything under .claude/ledger/. `harness` writes them.
//   2. Read before edit: an Edit on a file this transcript never Read (or wrote) is denied, with
//      the instruction to read it first. In-context memory of a file is a belief, not the file.
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { wasRead, agentTranscript } from "./lib/transcript.mjs";
import { projectRoot } from "../lib/work.mjs";

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const filePath = data.tool_input?.file_path;
if (!filePath) process.exit(0);

const root = projectRoot(data.cwd);
const rel = relative(root, resolve(data.cwd ?? root, filePath)).replaceAll("\\", "/");

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `guard.scope: ${reason}` } }));
  process.exit(0);
}

if (/^work\/[^/]+\/(state\.yaml|verdicts\.jsonl|phases\/)/.test(rel)) deny(`${rel} is kernel-owned; use \`harness set\`, \`harness route\`, never a direct write`);
if (/^\.claude\/ledger\//.test(rel)) deny(`${rel} is written by the hooks only`);

// A subagent's reads live in its own transcript, not in the session file the payload names.
const own = agentTranscript(data);
if (data.tool_name === "Edit" && own && !wasRead(own, resolve(data.cwd ?? root, filePath))) {
  deny(`read ${rel} with the Read tool before editing it; the file may have changed since you last saw it`);
}
process.exit(0);
