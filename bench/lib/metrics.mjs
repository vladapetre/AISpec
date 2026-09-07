// Pure statistics for the benchmark. No I/O, no LLM. Every function is covered by bench/test/metrics.test.mjs.

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Coefficient of variation: sd / mean. 0 for a constant series, NaN for an empty one. */
export function cv(xs) {
  const m = mean(xs);
  return m === 0 ? 0 : sd(xs) / Math.abs(m);
}

/** Nearest-rank percentile on a sorted copy. p in [0, 100]. */
export function percentile(xs, p) {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Standard error of the mean over a series of per-task values. */
export function stderr(xs) {
  return xs.length ? sd(xs) / Math.sqrt(xs.length) : NaN;
}

/** pass@1 estimated from n trials with c successes: c / n. */
export function passAt1(c, n) {
  return n ? c / n : NaN;
}

/**
 * pass^k: probability that all k of k independent trials succeed, estimated
 * without replacement from n trials with c successes: C(c, k) / C(n, k).
 * This is the estimator used by tau-bench; it is 0 when c < k.
 */
export function passHatK(c, n, k) {
  if (n < k || k <= 0) return NaN;
  if (c < k) return 0;
  return choose(c, k) / choose(n, k);
}

export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Share of runs that agree with the most common value of a categorical signal. */
export function agreement(values) {
  if (!values.length) return NaN;
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Math.max(...counts.values()) / values.length;
}

export function cacheHitRatio(usage) {
  const read = usage.cache_read_input_tokens ?? 0;
  const create = usage.cache_creation_input_tokens ?? 0;
  const fresh = usage.input_tokens ?? 0;
  const denom = read + create + fresh;
  return denom ? read / denom : NaN;
}

export function totalTokens(usage) {
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.output_tokens ?? 0)
  );
}

/** Adds two Claude usage objects field by field. */
export function addUsage(a, b) {
  const keys = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"];
  const out = {};
  for (const k of keys) out[k] = (a?.[k] ?? 0) + (b?.[k] ?? 0);
  return out;
}

export function round(x, digits = 3) {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
