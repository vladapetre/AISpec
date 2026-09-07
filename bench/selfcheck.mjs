#!/usr/bin/env node
// Grader sanity check, no LLM: every hidden test set must FAIL on the unmodified fixture (otherwise
// it cannot tell a solved task from an untouched one), and the fixture's own suite must pass.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { buildTemplate, materializeRun } from "./lib/fixture.mjs";

const BENCH = dirname(fileURLToPath(import.meta.url));

function vitest(repo, args) {
  const out = join(repo, ".selfcheck.json");
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`, ...args], { cwd: repo, stdio: "ignore", shell: true, timeout: 180_000 });
  } catch {}
  if (!existsSync(out)) return { passed: 0, failed: 0, total: 0, missing: true };
  const j = JSON.parse(readFileSync(out, "utf8"));
  return { passed: j.numPassedTests ?? 0, failed: j.numFailedTests ?? 0, total: j.numTotalTests ?? 0, suitesFailed: j.numFailedTestSuites ?? 0 };
}

const { template } = buildTemplate({ fixtureDir: join(BENCH, "fixture"), cacheDir: join(BENCH, ".cache"), log: console.log });
const runDir = join(BENCH, ".runs", "selfcheck");
const { repo, sha } = materializeRun({ template, runDir });
console.log(`fixture sha ${sha}`);

const own = vitest(repo, []);
console.log(`own suite: ${own.passed}/${own.total} passed${own.failed ? " FAILED" : ""}`);
let bad = own.failed > 0 || own.total === 0;

for (const task of readdirSync(join(BENCH, "hidden")).sort()) {
  const target = join(repo, "test", "hidden");
  rmSync(target, { recursive: true, force: true });
  cpSync(join(BENCH, "hidden", task), target, { recursive: true });
  const r = vitest(repo, ["test/hidden"]);
  const failsAsExpected = r.failed > 0 || r.suitesFailed > 0 || r.missing;
  if (!failsAsExpected) bad = true;
  console.log(`${failsAsExpected ? "ok  " : "BAD "} ${task}: ${r.passed} passed, ${r.failed} failed, ${r.suitesFailed ?? 0} suite(s) failed to load`);
}
rmSync(runDir, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
