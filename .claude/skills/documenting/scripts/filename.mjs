#!/usr/bin/env node
// Deterministic filename-stem derivation for the documenting skill.
// Usage: node filename.mjs <type> "<subject phrase>"
// Types: report, adr, plan, sdr, charter, context-map, glossary, progress
// Prints the derived filename stem on stdout (numbered types include the NNNNN- prefix).
import { readdirSync, existsSync } from 'node:fs';

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

const TYPES = ['report', 'adr', 'plan', 'sdr', 'charter', 'context-map', 'glossary', 'progress'];

const [type, subjectArg] = process.argv.slice(2);
if (!type || !subjectArg) die(`usage: filename.mjs <${TYPES.join('|')}> "<subject>"`);
if (!TYPES.includes(type)) die(`type must be one of ${TYPES.join(', ')}`);

let subject = subjectArg;

// Step 1 — strip a leading meta verb / prefix (case-insensitive, longest first).
const meta = [
  'Specification of', 'Specification for', 'Documentation of',
  'Analysis of', 'Design of', 'Plan for', 'Review of', 'Audit of',
  'Migration to', 'Migration of', 'Refactor of',
  'Charter for', 'Charter of', 'Glossary for', 'Map of', 'Context map of', 'Context map for',
  'Progress for', 'Progress of', 'Progress on', 'SDR for', 'SDR on',
  'Spec of', 'Spec for', 'Scope of', 'Document',
];
for (const m of meta) {
  if (subject.toLowerCase().startsWith(m.toLowerCase() + ' ')) {
    subject = subject.slice(m.length + 1);
    break;
  }
}

// Step 2 — lowercase.
subject = subject.toLowerCase();

// Step 4 — non-alphanumeric becomes a separator.
subject = subject.replace(/[^a-z0-9]+/g, ' ');

// Step 3 — drop stopword tokens.
const stopwords = new Set(
  'a an the of for to in on at with and or but by from as into our your my this that these those'.split(' '),
);
const tokens = subject.split(' ').filter((t) => t && !stopwords.has(t));

// Step 5 — keep the first N tokens (uniform N=5 across types).
const kept = tokens.slice(0, 5);
if (kept.length === 0) die('subject reduced to zero tokens after cleanup');
let stem = kept.join('-');

// Per-type suffix — idempotent (don't double-append if already present in the stem).
function appendOnce(s, suffix) {
  const suffixToken = suffix.replace(/^-/, '');
  return s.split('-').includes(suffixToken) ? s : `${s}${suffix}`;
}
if (type === 'report')      stem = appendOnce(stem, '-analysis');
if (type === 'charter')     stem = appendOnce(stem, '-charter');
if (type === 'glossary')    stem = appendOnce(stem, '-glossary');
if (type === 'progress')    stem = appendOnce(stem, '-progress');
if (type === 'context-map') stem = stem.includes('context-map') ? stem : `${stem}-context-map`;

// Numbered types prepend NNNNN-, scanning their host directory for the next free integer.
function nextSequence(dir) {
  let next = 1;
  if (!existsSync(dir)) return next;
  for (const name of readdirSync(dir)) {
    const match = /^(\d{5})-/.exec(name);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= next) next = num + 1;
    }
  }
  return next;
}

if (type === 'adr') {
  const next = nextSequence('artifacts/adr');
  process.stdout.write(`${String(next).padStart(5, '0')}-${stem}\n`);
} else if (type === 'sdr') {
  const next = nextSequence('artifacts/strategy/decisions');
  process.stdout.write(`${String(next).padStart(5, '0')}-${stem}\n`);
} else if (type === 'plan') {
  // Plans inherit the paired ADR's prefix if a matching stem exists; otherwise unprefixed.
  let prefix = '';
  if (existsSync('artifacts/adr')) {
    const pattern = new RegExp(`^(\\d{5})-${stem}\\.md$`);
    for (const name of readdirSync('artifacts/adr')) {
      const match = pattern.exec(name);
      if (match && match[1] > prefix) prefix = match[1];
    }
  }
  process.stdout.write(prefix ? `${prefix}-${stem}\n` : `${stem}\n`);
} else if (type === 'progress') {
  // Progress files: `plan-<short-title>-progress.md` under .claude/agent-memory/developer/.
  // The subject is expected to be the plan short-title; prepend `plan-` if not already there.
  const out = stem.startsWith('plan-') ? stem : `plan-${stem}`;
  process.stdout.write(`${out}\n`);
} else {
  // report, charter, context-map, glossary — no numeric prefix.
  process.stdout.write(`${stem}\n`);
}
