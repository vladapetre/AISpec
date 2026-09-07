import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const BIN = resolve(".claude/bin/harness.mjs");

function run(root, args) {
  const out = execFileSync("node", [BIN, ...args, "--root", root], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  return JSON.parse(out);
}

test("the CLI walks a work item end to end and speaks JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "harness-cli-"));
  mkdirSync(join(root, ".claude"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "a.ts"), "");

  const adm = run(root, ["admit", "--text", "Fix the typo in `src/a.ts`."]);
  assert.equal(adm.lane, "fast");

  const created = run(root, ["new", "--lane", "order", "--title", "Summary endpoint"]);
  assert.match(created.id, /^\d{8}-summary-endpoint$/);
  assert.equal(created.next.action, "write_artifact");

  writeFileSync(join(root, "work", created.id, "order.md"), "---\nlane: order\nphases:\n  - n: 1\n    files: [src/a.ts]\n---\n# O\n\n## Phase 1: A\n\nt\n");
  assert.equal(run(root, ["next", created.id]).action, "implement_phase");

  const pf = run(root, ["preflight", created.id]);
  assert.equal(pf.ok, true);
  assert.ok(pf.checks.some((c) => c.name === "artifact" && c.level === "ok"));

  const v = run(root, ["verify", created.id, "1", "--no-tests"]);
  assert.equal(v.ok, true);

  const r1 = run(root, ["route", created.id, "--verdict", "PHASE DONE", "--agent", "developer", "--phase", "1"]);
  assert.equal(r1.next.action, "approve_phase");
  const r2 = run(root, ["route", created.id, "--verdict", "approved", "--agent", "user", "--phase", "1"]);
  assert.equal(r2.next.action, "review_cumulative");

  const list = run(root, ["list"]);
  assert.equal(list.length, 1);
  assert.equal(list[0].phases, "1/1");

  const c = run(root, ["cost"]);
  assert.equal(c.rows, 0);
  rmSync(root, { recursive: true, force: true });
});

test("usage errors exit 1 with a message on stderr", () => {
  const root = mkdtempSync(join(tmpdir(), "harness-cli-"));
  mkdirSync(join(root, ".claude"));
  assert.throws(() => execFileSync("node", [BIN, "bogus", "--root", root], { stdio: "pipe" }), /unknown verb/);
  assert.throws(() => execFileSync("node", [BIN, "new", "--lane", "order", "--root", root], { stdio: "pipe" }), /needs --lane and --title/);
  rmSync(root, { recursive: true, force: true });
});
