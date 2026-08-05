#!/usr/bin/env node
// PostToolUse lint on Write/Edit — feeds violations straight back to the agent
// (exit 2 → stderr is shown to the model, which corrects in the same turn):
//   1. .claude/agent-memory/*/MEMORY.md — the CLAUDE.md memory caps: file ≤150
//      lines (compaction protocol) and index entries ≤2 lines / ≤50 words.
//   2. .claude/MEMORY.md — ## Decisions entries are hooks, not essays (≤120 words).
//   3. artifacts/plans/*.md — anchor/stamp integrity via plan-status.mjs check.
// Also runnable standalone: `node lint.write.mjs --all` lints every
// agent-memory MEMORY.md plus .claude/MEMORY.md (for periodic sweeps).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { projectRoot, repoRelative } from "./lib/project-root.mjs";

const problems = [];

function lintAgentMemory(path, label) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  if (lines.length > 150)
    problems.push(`${label}: ${lines.length} lines (cap 150) — run the compaction protocol before continuing (CLAUDE.md ## Agent memory layout)`);
  // Index entries: a top-level "- " bullet up to the next bullet/blank/heading.
  let start = -1;
  const flush = (end) => {
    if (start < 0) return;
    const entry = lines.slice(start, end);
    const words = entry.join(" ").split(/\s+/).filter(Boolean).length;
    if (entry.length > 2 || words > 50)
      problems.push(`${label}:${start + 1}: index entry is ${entry.length} lines / ${words} words (cap 2 / 50) — move detail to the per-entity file, keep a hook`);
    start = -1;
  };
  lines.forEach((l, i) => {
    if (/^- /.test(l)) { flush(i); start = i; }
    else if (start >= 0 && (l.trim() === "" || /^#/.test(l))) flush(i);
  });
  flush(lines.length);
}

function lintProjectMemory(path, label) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  let inDecisions = false;
  let start = -1;
  const flush = (end) => {
    if (start < 0) return;
    const words = lines.slice(start, end).join(" ").split(/\s+/).filter(Boolean).length;
    if (words > 120)
      problems.push(`${label}:${start + 1}: decision entry is ${words} words — a decision-log entry is ≤3 sentences + a pointer to its owning artifact (understanding skill)`);
    start = -1;
  };
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) { flush(i); inDecisions = /^##\s+Decisions/.test(l); }
    else if (inDecisions && /^- /.test(l)) { flush(i); start = i; }
    else if (start >= 0 && l.trim() === "") flush(i);
  });
  flush(lines.length);
}

function lintPlan(path, root, label) {
  const script = join(root, ".claude", "skills", "documenting", "scripts", "plan-status.mjs");
  if (!existsSync(script)) return;
  try {
    execFileSync(process.execPath, [script, "check", path], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    const err = (e.stderr ?? "").toString().trim();
    if (err) problems.push(`${label}: ${err.replaceAll("\n", "; ")}`);
  }
}

if (process.argv.includes("--all")) {
  // Root-anchored so a sweep run from a subdirectory still finds every file.
  const root = projectRoot(null);
  const amRoot = join(root, ".claude", "agent-memory");
  if (existsSync(amRoot))
    for (const agent of readdirSync(amRoot)) {
      const idx = join(amRoot, agent, "MEMORY.md");
      if (existsSync(idx)) lintAgentMemory(idx, `.claude/agent-memory/${agent}/MEMORY.md`);
    }
  const pm = join(root, ".claude", "MEMORY.md");
  if (existsSync(pm)) lintProjectMemory(pm, ".claude/MEMORY.md");
} else {
  let data;
  try {
    data = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const filePath = data.tool_input?.file_path;
  if (!filePath) process.exit(0);
  // Root-anchored: cwd-anchoring meant a session started in a subdirectory
  // produced a "../.."-prefixed path that matched none of the rules below, so
  // the memory caps and plan-anchor check were silently skipped.
  let root, rel, abs, outside;
  try {
    ({ root, rel, abs, outside } = repoRelative(data, filePath));
  } catch {
    process.exit(0);
  }
  if (outside || !existsSync(abs)) process.exit(0);
  if (/^\.claude\/agent-memory\/[^/]+\/MEMORY\.md$/.test(rel)) lintAgentMemory(abs, rel);
  else if (rel === ".claude/MEMORY.md") lintProjectMemory(abs, rel);
  else if (/^artifacts\/plans\/[^/]+\.md$/.test(rel)) lintPlan(abs, root, rel);
  else process.exit(0);
}

if (problems.length) {
  process.stderr.write("lint.write:\n" + problems.map((p) => `  - ${p}`).join("\n") + "\n");
  process.exit(2);
}
process.exit(0);
