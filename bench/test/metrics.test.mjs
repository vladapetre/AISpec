import { test } from "node:test";
import assert from "node:assert/strict";
import { agreement, cacheHitRatio, choose, cv, mean, passAt1, passHatK, percentile, sd, stderr, addUsage, totalTokens } from "../lib/metrics.mjs";

test("mean, sd, cv on a known series", () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(mean(xs), 5);
  assert.ok(Math.abs(sd(xs) - 2.138) < 0.001);
  assert.ok(Math.abs(cv(xs) - 0.4276) < 0.001);
  assert.equal(cv([3, 3, 3]), 0);
  assert.ok(Number.isNaN(mean([])));
});

test("percentile uses nearest rank", () => {
  const xs = [15, 20, 35, 40, 50];
  assert.equal(percentile(xs, 50), 35);
  assert.equal(percentile(xs, 90), 50);
  assert.equal(percentile(xs, 0), 15);
  assert.equal(percentile([7], 90), 7);
});

test("stderr is sd over root n", () => {
  assert.ok(Math.abs(stderr([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138 / Math.sqrt(8)) < 0.001);
});

test("pass@1 and pass^k follow the tau-bench estimator", () => {
  assert.equal(passAt1(3, 5), 0.6);
  assert.equal(passHatK(5, 5, 5), 1);
  assert.equal(passHatK(4, 5, 5), 0);
  assert.equal(passHatK(4, 5, 2), choose(4, 2) / choose(5, 2)); // 6/10
  assert.equal(passHatK(3, 5, 1), 0.6); // pass^1 equals pass@1
  assert.ok(Number.isNaN(passHatK(3, 3, 5)));
});

test("choose", () => {
  assert.equal(choose(5, 2), 10);
  assert.equal(choose(5, 0), 1);
  assert.equal(choose(3, 5), 0);
});

test("agreement is the share of the modal value", () => {
  assert.equal(agreement(["a", "a", "b"]), 2 / 3);
  assert.equal(agreement(["a", "a", "a"]), 1);
  assert.ok(Number.isNaN(agreement([])));
});

test("cache hit ratio and totals", () => {
  const u = { input_tokens: 100, cache_read_input_tokens: 800, cache_creation_input_tokens: 100, output_tokens: 50 };
  assert.equal(cacheHitRatio(u), 0.8);
  assert.equal(totalTokens(u), 1050);
  assert.deepEqual(addUsage(u, u), { input_tokens: 200, cache_read_input_tokens: 1600, cache_creation_input_tokens: 200, output_tokens: 100 });
  assert.ok(Number.isNaN(cacheHitRatio({})));
});
