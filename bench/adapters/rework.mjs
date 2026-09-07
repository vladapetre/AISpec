// Adapter for the rework harness (built on branch `rework`). Until Phase 4 lands its gate packets,
// this adapter recognises the same gate lines as trunk plus the packet forms the design names.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { filesMatching } from "../lib/grade.mjs";
import * as trunk from "./trunk.mjs";

export const name = "rework";

const SKIP = ["telemetry", "state", "agent-memory", "branching", "settings.local.json", "PROJECT-MAP.md", "ledger"];

export function install(repo, harnessRoot) {
  if (!existsSync(join(harnessRoot, ".claude"))) throw new Error(`no .claude tree at ${harnessRoot}`);
  cpSync(join(harnessRoot, "CLAUDE.md"), join(repo, "CLAUDE.md"));
  cpSync(join(harnessRoot, ".claude"), join(repo, ".claude"), {
    recursive: true,
    filter: (src) => !SKIP.some((s) => src.replaceAll("\\", "/").includes(`/.claude/${s}`)),
  });
  mkdirSync(join(repo, "work"), { recursive: true });
  rmSync(join(repo, ".claude", "settings.local.json"), { force: true });
}

export function gate(text, task) {
  const packet = text.match(/\[a\]\s*approve(?:\s*·\s*\[r\]\s*run through\s*(\d+))?/i);
  if (packet) return { isGate: true, kind: "approval", reply: packet[1] ? `r ${packet[1]}` : "a" };
  return trunk.gate(text, task);
}

export function signals(texts, summary) {
  const text = texts.join("\n");
  const lane = text.match(/\blane:\s*(fast|order|design|research)\b/i)?.[1]?.toLowerCase();
  const base = trunk.signals(texts, summary);
  return lane ? { ...base, lane, route: `${lane}:${[...new Set(base.verdicts)].join(">") || "-"}` } : base;
}

export function reportFiles(repo) {
  return [...filesMatching(repo, "work/*/report.md"), ...filesMatching(repo, "artifacts/reports/*.md")];
}

export const allowedTools = trunk.allowedTools;
