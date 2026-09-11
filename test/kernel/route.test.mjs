import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWork, deriveState } from "../../.claude/lib/work.mjs";
import { route, findVerdict } from "../../.claude/lib/route.mjs";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "harness-route-"));
  mkdirSync(join(root, ".claude"));
  const s = createWork({ lane: "order", title: "Csv", root });
  writeFileSync(join(root, "work", s.id, "order.md"), "---\nlane: order\n---\n# O\n\n## Phase 1: A\n\nt\n\n## Phase 2: B\n\nt\n\n## Phase 3: C\n\nt\n");
  return { root, id: s.id };
}

test("findVerdict matches exact tokens at line start only", () => {
  assert.equal(findVerdict("summary\nAPPROVED\nmore"), "APPROVED");
  assert.equal(findVerdict("CHANGES   REQUIRED because"), "CHANGES REQUIRED");
  assert.equal(findVerdict("the reviewer said it was approved-ish"), null);
  assert.equal(findVerdict("LGTM"), null);
});

test("developer done, user approved with a run grant, reviewer cumulative, close", () => {
  const { root, id } = setup();
  let r = route({ id, verdict: "PHASE DONE", agent: "developer", phase: 1, root });
  assert.deepEqual([r.next.action, r.next.phase], ["approve_phase", 1]);

  assert.throws(() => route({ id, verdict: "approved", agent: "user", phase: 2, root }), /not done/);
  r = route({ id, verdict: "approved", agent: "user", phase: 1, through: 3, root });
  assert.deepEqual([r.next.action, r.next.phase], ["implement_phase", 2]);
  assert.equal(deriveState(id, root).run_through, 3);

  // the grant covers phases 2 and 3: PHASE DONE approves them without another stop
  r = route({ id, verdict: "PHASE DONE", agent: "developer", phase: 2, root });
  assert.ok(r.applied.some((a) => a.includes("2.approved (run grant")));
  assert.deepEqual([r.next.action, r.next.phase], ["implement_phase", 3]);
  r = route({ id, verdict: "PHASE DONE", agent: "developer", phase: 3, root });
  assert.equal(r.next.action, "review_cumulative");

  r = route({ id, verdict: "APPROVED", agent: "reviewer", scope: "cumulative", root });
  assert.equal(r.next.action, "close");
  assert.equal(deriveState(id, root).phases.every((p) => p.reviewed), true);
  rmSync(root, { recursive: true, force: true });
});

test("wrong owner is refused, rejection clears the run grant, drift blocks", () => {
  const { root, id } = setup();
  assert.throws(() => route({ id, verdict: "APPROVED", agent: "developer", root }), /may only come from reviewer/);
  route({ id, verdict: "PHASE DONE", agent: "developer", phase: 1, root });
  route({ id, verdict: "approved", agent: "user", phase: 1, through: 3, root });
  route({ id, verdict: "CHANGES REQUIRED", agent: "reviewer", phase: 2, root });
  assert.equal(deriveState(id, root).run_through, undefined);
  const r = route({ id, verdict: "DRIFT DETECTED", agent: "reviewer", scope: "crosscheck", root });
  assert.equal(r.next.action, "resolve_block");
  assert.equal(deriveState(id, root).status, "blocked");
  rmSync(root, { recursive: true, force: true });
});
