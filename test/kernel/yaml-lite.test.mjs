import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, stringify, frontmatter } from "../../.claude/lib/yaml-lite.mjs";

test("parses scalars, inline lists and nested maps", () => {
  const doc = parse(`
# comment
id: 20260907-pagination
lane: fast
count: 3
flag: true
empty:
tags: [a, "b c", 7]
server:
  port: 8080
  host: "127.0.0.1"
`);
  assert.deepEqual(doc, {
    id: "20260907-pagination",
    lane: "fast",
    count: 3,
    flag: true,
    empty: null,
    tags: ["a", "b c", 7],
    server: { port: 8080, host: "127.0.0.1" },
  });
});

test("parses block lists of maps and of scalars", () => {
  const doc = parse(`
phases:
  - n: 1
    title: Add the route
    files: [src/http/handlers.ts]
    drive: false
  - n: 2
    title: Tests
    files: []
steps:
  - first
  - second
`);
  assert.equal(doc.phases.length, 2);
  assert.deepEqual(doc.phases[0], { n: 1, title: "Add the route", files: ["src/http/handlers.ts"], drive: false });
  assert.deepEqual(doc.phases[1].files, []);
  assert.deepEqual(doc.steps, ["first", "second"]);
});

test("round-trips through stringify", () => {
  const obj = { id: "x-1", lane: "order", title: "Add: a thing, with commas", n: 2, ok: false, tags: ["a", "b"], phases: [{ n: 1, files: ["a.ts"] }, { n: 2, files: [] }] };
  const text = stringify(obj);
  assert.deepEqual(parse(text), obj);
});

test("rejects malformed input instead of guessing", () => {
  assert.throws(() => parse("key without colon"));
  assert.throws(() => parse("a: 1\n   b: 2"));
});

test("frontmatter splits and tolerates its absence", () => {
  const { front, body } = frontmatter("---\nlane: order\n---\n# Title\nbody");
  assert.deepEqual(front, { lane: "order" });
  assert.equal(body, "# Title\nbody");
  assert.deepEqual(frontmatter("# no front").front, {});
});
