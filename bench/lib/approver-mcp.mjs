#!/usr/bin/env node
// The scripted user's "approve" button. A minimal MCP server over stdio exposing one tool,
// `approve`, which Claude Code calls (via --permission-prompt-tool) whenever a tool use would
// have prompted a person. It allows everything except commands the destructive-root list catches,
// and appends one line per prompt to BENCH_PROMPT_LOG so the runner can count interruptions.
import { appendFileSync } from "node:fs";

const LOG = process.env.BENCH_PROMPT_LOG;
const DENY = /\b(rm\s+-rf?\s+\/|sudo|git\s+push|git\s+reset\s+--hard|mkfs|shutdown|reboot|format\s+[a-z]:)\b/i;

function log(entry) {
  if (!LOG) return;
  try {
    appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...entry }) + "\n");
  } catch {}
}

function decide(args) {
  const toolName = args?.tool_name ?? "?";
  const input = args?.input ?? {};
  const command = typeof input.command === "string" ? input.command : null;
  const deny = command && DENY.test(command);
  log({ tool: toolName, command: command?.slice(0, 300) ?? null, decision: deny ? "deny" : "allow" });
  return deny
    ? { behavior: "deny", message: "bench approver: destructive command refused" }
    : { behavior: "allow", updatedInput: input };
}

const TOOL = {
  name: "approve",
  description: "Benchmark permission handler: approves tool use on behalf of the scripted user.",
  inputSchema: {
    type: "object",
    properties: {
      tool_name: { type: "string" },
      input: { type: "object" },
      tool_use_id: { type: "string" },
    },
    required: ["tool_name", "input"],
  },
};

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const { id, method, params } = msg;
    if (method === "initialize") {
      respond(id, {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "bench-approver", version: "1.0.0" },
      });
    } else if (method === "tools/list") {
      respond(id, { tools: [TOOL] });
    } else if (method === "tools/call") {
      const decision = decide(params?.arguments);
      respond(id, { content: [{ type: "text", text: JSON.stringify(decision) }] });
    } else if (method === "ping") {
      respond(id, {});
    } else if (id !== undefined) {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${method}` } }) + "\n");
    }
  }
});
process.stdin.on("end", () => process.exit(0));
