import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWork, deriveState, listWork, newId, readState, setMarker, appendVerdict, writeState } from "../../.claude/lib/work.mjs";

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "harness-work-"));
  mkdirSync(join(root, ".claude"));
  return root;
}

test("newId is date plus slug", () => {
  assert.equal(newId("Add GET /invoices/:id/summary!", new Date("2026-09-07T10:00:00Z")), "20260907-add-get-invoices-id-summary");
});

test("create, read, list", () => {
  const root = tempRoot();
  const s = createWork({ lane: "order", title: "Summary endpoint", root, now: new Date("2026-09-07T10:00:00Z") });
  assert.equal(s.id, "20260907-summary-endpoint");
  assert.equal(readState(s.id, root).status, "open");
  assert.deepEqual(listWork(root), [s.id]);
  assert.throws(() => createWork({ lane: "order", title: "Summary endpoint", root, now: new Date("2026-09-07T10:00:00Z") }), /already exists/);
  assert.throws(() => createWork({ lane: "huge", title: "x", root }), /lane must be/);
  rmSync(root, { recursive: true, force: true });
});

test("state validation refuses unknown fields and blocked without reason", () => {
  const root = tempRoot();
  const s = createWork({ lane: "fast", title: "Fix", root });
  assert.throws(() => writeState({ ...s, status: "blocked" }, root), /blocked without blocked_reason/);
  assert.throws(() => writeState({ ...s, bogus: 1 }, root), /unknown field bogus/);
  rmSync(root, { recursive: true, force: true });
});

test("deriveState reads phases from the artifact and markers from disk", () => {
  const root = tempRoot();
  const s = createWork({ lane: "order", title: "Csv", root });
  writeFileSync(
    join(root, "work", s.id, "order.md"),
    `---\nlane: order\nphases:\n  - n: 1\n    files: [src/http/csv.ts]\n  - n: 2\n    files: [src/http/handlers.ts]\n---\n# Order\n\n## Phase 1: CSV module\n\ntext\n\n## Phase 2: Route\n\ntext\n`,
  );
  let d = deriveState(s.id, root);
  assert.equal(d.phase_count, 2);
  assert.equal(d.current_phase, 1);
  assert.deepEqual(d.phases.map((p) => p.title), ["CSV module", "Route"]);
  setMarker(s.id, 1, "done", root);
  setMarker(s.id, 1, "approved", root);
  appendVerdict(s.id, { agent: "reviewer", verdict: "APPROVED", phase: 1 }, root);
  d = deriveState(s.id, root);
  assert.equal(d.phases_approved, 1);
  assert.equal(d.current_phase, 2);
  assert.equal(d.last_verdict.verdict, "APPROVED");
  rmSync(root, { recursive: true, force: true });
});
