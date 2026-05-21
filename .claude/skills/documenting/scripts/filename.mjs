#!/usr/bin/env node
// Deterministic filename-stem derivation for the documenting skill.
// Usage: node filename.mjs <report|adr|plan> "<subject phrase>"
// Prints the derived filename stem on stdout (ADRs include the NNNNN- prefix).
import { readdirSync, existsSync } from 'node:fs';

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

const [type, subjectArg] = process.argv.slice(2);
if (!type || !subjectArg) {
  die('usage: filename.mjs <report|adr|plan> "<subject>"');
}
if (!['report', 'adr', 'plan'].includes(type)) {
  die('type must be one of report, adr, plan');
}

let subject = subjectArg;

// Step 1 — strip a leading meta verb / prefix (case-insensitive, longest first).
const meta = [
  'Specification of', 'Specification for', 'Documentation of',
  'Analysis of', 'Design of', 'Plan for', 'Review of', 'Audit of',
  'Migration to', 'Migration of', 'Refactor of',
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

// Step 5 — keep the first N tokens (report N=3, adr/plan N=5).
const n = type === 'report' ? 3 : 5;
const kept = tokens.slice(0, n);
if (kept.length === 0) die('subject reduced to zero tokens after cleanup');
let stem = kept.join('-');

// Step 5 suffix — reports append -analysis.
if (type === 'report') stem += '-analysis';

// Step 6 — ADRs prepend the next zero-padded 5-digit sequence number.
if (type === 'adr') {
  let next = 1;
  if (existsSync('artifacts/adr')) {
    for (const name of readdirSync('artifacts/adr')) {
      const match = /^(\d{5})-/.exec(name);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= next) next = num + 1;
      }
    }
  }
  process.stdout.write(`${String(next).padStart(5, '0')}-${stem}\n`);
} else {
  process.stdout.write(`${stem}\n`);
}
