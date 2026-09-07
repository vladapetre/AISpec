import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admit, recheck, mentionedPaths } from "../../.claude/lib/admit.mjs";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "harness-admit-"));
  mkdirSync(join(root, ".claude"));
  for (const p of ["src/http/handlers.ts", "src/http/server.ts", "src/config.ts", "src/domain/money.ts", "src/domain/pricing.ts", "data/config.json"]) {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), "");
  }
  return root;
}

test("mentionedPaths keeps only paths that exist", () => {
  const root = repo();
  assert.deepEqual(mentionedPaths("see `src/config.ts` and `src/nope.ts` and src/http/handlers.ts:12", root), ["src/config.ts", "src/http/handlers.ts"]);
  rmSync(root, { recursive: true, force: true });
});

test("the six fast-lane requests land in fast", () => {
  const root = repo();
  const prompts = [
    "GET /invoices?page=1&size=2 skips the two newest invoices. Fix the offset in the list handler and add a unit test.",
    "loadConfig() throws when data/config.json has no server block. Fix the loader and cover the empty-object case with a unit test.",
    "`applyStuff` in src/domain/pricing.ts computes the subtotal and discount. Rename it to something that describes what it returns.",
    "When the port is taken the service exits silently. In src/http/server.ts log the error to stderr before exiting.",
    "Change the default page size from 20 to 25 in the code default and data/config.json.",
    "An invoice at 7% tax shows 1.39; it should be 1.40. The helper in src/domain/money.ts truncates. Make it round half up.",
  ];
  for (const p of prompts) assert.equal(admit(p, { root }).lane, "fast", p);
  rmSync(root, { recursive: true, force: true });
});

test("new surfaces land in order, security and migrations in design, questions in research", () => {
  const root = repo();
  assert.equal(admit("Add an endpoint GET /invoices/:id/summary that returns the totals. Add unit tests.", { root }).lane, "order");
  assert.equal(admit("Accounting wants a CSV of all invoices. Add GET /invoices.csv with a header row. Put the formatting in its own module.", { root }).lane, "order");
  assert.equal(admit("Every endpoint must require an API key. Add an authentication layer under src/auth/.", { root }).lane, "design");
  assert.equal(admit("Add a status field with a data migration that rewrites data/invoices.json once.", { root }).lane, "design");
  assert.equal(admit("Before we touch pricing I need to understand it. Write a short report: how is an invoice total computed? No code changes.", { root }).lane, "research");
  assert.equal(admit("Map the life of a POST /invoices request from the socket to the JSON file. Write it as a report. No code changes.", { root }).lane, "research");
  rmSync(root, { recursive: true, force: true });
});

test("an explicit lane wins and a recheck escalates on overrun", () => {
  const root = repo();
  assert.equal(admit("lane: design. Rename a variable.", { root }).lane, "design");
  const r = recheck("fast", "Fix the pagination offset in the list handler.", ["src/http/handlers.ts", "src/http/router.ts", "src/config.ts", "src/domain/money.ts"], { root });
  assert.equal(r.escalate, true);
  assert.equal(r.lane, "order");
  const ok = recheck("fast", "Fix the pagination offset in the list handler.", ["src/http/handlers.ts"], { root });
  assert.equal(ok.escalate, false);
  rmSync(root, { recursive: true, force: true });
});
