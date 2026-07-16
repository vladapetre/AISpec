#!/usr/bin/env node
// Deterministic phase-status bookkeeping for implementation plans.
// The `**Status: Complete**` stamp and its `<!-- status:phase-N -->` anchor are
// mechanical state — this script owns them so no agent hand-edits (or forgets) them.
//
// Usage:
//   node plan-status.mjs check <plan.md>       verify anchor/stamp integrity, print next unmarked phase
//   node plan-status.mjs stamp <plan.md> <N>   insert **Status: Complete** after phase N's anchor (idempotent)
//
// Exit codes: 0 = ok (check: structure sound; stamp: stamped or already stamped),
//             1 = structural problem (missing/duplicate anchor, orphan stamp, bad args).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

const [op, planPath, phaseArg] = process.argv.slice(2);
if (!op || !planPath || !['check', 'stamp'].includes(op)) {
  die('usage: plan-status.mjs check <plan.md> | plan-status.mjs stamp <plan.md> <N>');
}
if (!existsSync(planPath)) die(`plan not found: ${planPath}`);

const raw = readFileSync(planPath, 'utf8');
const lines = raw.split(/\r?\n/);
const ANCHOR = /^\s*<!--\s*status:phase-(\d+)\s*-->\s*$/;
const STAMP = /^\s*\*\*Status:\s*Complete\*\*\s*$/;

// Collect anchors and their stamp state (stamp = first non-blank line after the anchor).
const phases = new Map(); // n -> { line, stamped }
const problems = [];
lines.forEach((line, i) => {
  const m = ANCHOR.exec(line);
  if (!m) return;
  const n = parseInt(m[1], 10);
  if (phases.has(n)) problems.push(`duplicate anchor for phase ${n} (lines ${phases.get(n).line + 1} and ${i + 1})`);
  let j = i + 1;
  while (j < lines.length && lines[j].trim() === '') j++;
  phases.set(n, { line: i, stamped: j < lines.length && STAMP.test(lines[j]) });
});

// Orphan stamps: a stamp line whose nearest preceding non-blank line is not an anchor.
lines.forEach((line, i) => {
  if (!STAMP.test(line)) return;
  let j = i - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  if (j < 0 || !ANCHOR.test(lines[j])) problems.push(`orphan **Status: Complete** at line ${i + 1} (no anchor above it)`);
});

const nums = [...phases.keys()].sort((a, b) => a - b);
if (nums.length === 0) problems.push('no <!-- status:phase-N --> anchors found');
for (let k = 0; k < nums.length; k++) {
  if (nums[k] !== k + 1) { problems.push(`phase numbering gap: expected 1..${nums.length}, found [${nums.join(', ')}]`); break; }
}

if (op === 'check') {
  const done = nums.filter((n) => phases.get(n).stamped);
  const next = nums.find((n) => !phases.get(n).stamped);
  process.stdout.write(`phases: ${nums.length}\n`);
  process.stdout.write(`complete: ${done.length ? done.join(', ') : '(none)'}\n`);
  process.stdout.write(`next unmarked: ${next ?? '(all complete)'}\n`);
  for (const p of problems) process.stderr.write(`problem: ${p}\n`);
  process.exit(problems.length ? 1 : 0);
}

// stamp
const n = parseInt(phaseArg, 10);
if (!Number.isInteger(n) || n < 1) die('stamp needs a positive integer phase number');
// Refuse to stamp a structurally broken plan — with duplicate anchors the last
// occurrence would silently win, and an orphan stamp means state is already
// corrupt. Fix the structure first (check reports it), then stamp.
if (problems.length) {
  for (const p of problems) process.stderr.write(`problem: ${p}\n`);
  die(`plan structure is broken — refusing to stamp; run 'check', fix the problems above, then re-run`);
}
const entry = phases.get(n);
if (!entry) die(`no <!-- status:phase-${n} --> anchor in ${planPath} — sanctioned fallback: insert **Status: Complete** manually after that phase's **Done when:** and record the deviation; flag the missing anchor for the architect to backfill`);
if (entry.stamped) {
  process.stdout.write(`phase ${n}: already stamped — no change\n`);
  process.exit(0);
}
lines.splice(entry.line + 1, 0, '**Status: Complete**');
// Preserve the file's own line endings — rewriting CRLF plans as LF churns
// every line in git.
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
writeFileSync(planPath, lines.join(eol));
process.stdout.write(`phase ${n}: stamped **Status: Complete** (${planPath})\n`);
