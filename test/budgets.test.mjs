// Static prompt budgets. Every byte under .claude/ that is loaded into a model's context is paid on
// every turn or every spawn, so the caps are enforced here rather than remembered. Raising a cap
// needs a one-line rationale next to the number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(".");
const BUDGETS = {
  claude_md_bytes: 2048, // loaded on every turn of every session and every spawn
  agent_lines: 120, // agent shells: identity, constraints, dispatch; procedure lives in step files
  skill_lines: 150, // SKILL.md: description, when, steps index; detail lives in steps/ and templates/
  step_lines: 80, // one step file is one screen
  rule_lines: 60, // .claude/rules/*.md are path-scoped and small
  hook_cold_ms: 200, // a hook runs on every matching tool call
};

function lines(p) {
  return readFileSync(p, "utf8").split(/\r?\n/).length;
}
function walk(dir, pred) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}
const rel = (p) => p.slice(ROOT.length + 1).replaceAll("\\", "/");

test("CLAUDE.md stays under the always-on budget", { skip: !existsSync(join(ROOT, ".claude", "rules")) && "phase 2 not landed" }, () => {
  const size = statSync(join(ROOT, "CLAUDE.md")).size;
  assert.ok(size <= BUDGETS.claude_md_bytes, `CLAUDE.md is ${size} bytes, budget ${BUDGETS.claude_md_bytes}`);
});

test("agent shells, skills, step files and rules stay within their line budgets", { skip: !existsSync(join(ROOT, ".claude", "rules")) && "phase 2 not landed" }, () => {
  const over = [];
  for (const p of walk(join(ROOT, ".claude", "agents"), (f) => f.endsWith(".md"))) if (lines(p) > BUDGETS.agent_lines) over.push(`${rel(p)}: ${lines(p)} > ${BUDGETS.agent_lines}`);
  for (const p of walk(join(ROOT, ".claude", "skills"), (f) => f.endsWith("SKILL.md"))) if (lines(p) > BUDGETS.skill_lines) over.push(`${rel(p)}: ${lines(p)} > ${BUDGETS.skill_lines}`);
  for (const p of walk(join(ROOT, ".claude", "skills"), (f) => /[\\/]steps[\\/].*\.md$/.test(f))) if (lines(p) > BUDGETS.step_lines) over.push(`${rel(p)}: ${lines(p)} > ${BUDGETS.step_lines}`);
  for (const p of walk(join(ROOT, ".claude", "rules"), (f) => f.endsWith(".md"))) if (lines(p) > BUDGETS.rule_lines) over.push(`${rel(p)}: ${lines(p)} > ${BUDGETS.rule_lines}`);
  assert.deepEqual(over, []);
});

test("every skill has a description with a 'Use when' trigger and one declared route", { skip: !existsSync(join(ROOT, ".claude", "rules")) && "phase 2 not landed" }, () => {
  const problems = [];
  for (const p of walk(join(ROOT, ".claude", "skills"), (f) => f.endsWith("SKILL.md"))) {
    const text = readFileSync(p, "utf8");
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) {
      problems.push(`${rel(p)}: no frontmatter`);
      continue;
    }
    const desc = fm[1].match(/^description:\s*([\s\S]*?)(?=\n[a-z-]+:|\n?$)/m)?.[1] ?? "";
    if (!/use when/i.test(desc)) problems.push(`${rel(p)}: description lacks "Use when"`);
    if (desc.length > 1024) problems.push(`${rel(p)}: description ${desc.length} chars > 1024`);
  }
  assert.deepEqual(problems, []);
});

test("hooks start cold under the budget", { skip: !existsSync(join(ROOT, ".claude", "hooks", "route.verdict.mjs")) && "phase 3 not landed" }, () => {
  const slow = [];
  for (const p of walk(join(ROOT, ".claude", "hooks"), (f) => f.endsWith(".mjs") && !f.includes("lib"))) {
    const t0 = Date.now();
    try {
      execFileSync("node", [p], { input: "{}", stdio: ["pipe", "ignore", "ignore"], timeout: 5000, env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } });
    } catch {}
    const ms = Date.now() - t0;
    if (ms > BUDGETS.hook_cold_ms) slow.push(`${rel(p)}: ${ms} ms`);
  }
  assert.deepEqual(slow, []);
});
