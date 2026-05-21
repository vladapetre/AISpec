#!/usr/bin/env node
// Deterministic session-file editor for the auditing skill.
// Resolves the session file from $CLAUDE_CODE_SESSION_ID and applies exactly one edit.
// Usage: node session.mjs <init|checkpoint|close> [arg]
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);

const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
if (!sessionId) die('CLAUDE_CODE_SESSION_ID is not set');

const mapPath = `artifacts/sessions/.map/${sessionId}`;
if (!existsSync(mapPath)) {
  die(`no session map at ${mapPath} — is the session-start hook installed?`);
}
const rel = readFileSync(mapPath, 'utf8').trim();
const file = `artifacts/sessions/${rel}/session.md`;
if (!existsSync(file)) die(`session file not found at ${file}`);

if (cmd === 'init') {
  const goal = arg;
  if (!goal) die('init requires a goal argument');
  const out = [];
  let skip = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line === '## Goal') {
      out.push(line, goal, '');
      skip = true;
      continue;
    }
    if (skip) {
      if (line.startsWith('## ')) skip = false;
      else continue;
    }
    out.push(line);
  }
  writeFileSync(file, out.join('\n'));
  process.stdout.write('Goal updated.\n');
} else if (cmd === 'checkpoint') {
  let note = arg;
  if (!note) die('checkpoint requires a note argument');
  note = note.replace(/[\r\n]+/g, ' ');
  if (note.length > 100) {
    die(`checkpoint note exceeds 100 characters (${note.length})`);
  }
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const entry = `- ${hh}:${mm}Z — ${note}`;
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.includes('<!-- end-checkpoints -->')) out.push(entry);
    out.push(line);
  }
  writeFileSync(file, out.join('\n'));
  process.stdout.write('Checkpoint logged.\n');
} else if (cmd === 'close') {
  rmSync(mapPath);
  process.stdout.write(`Session closed: ${file}\n`);
} else {
  die('usage: session.mjs <init|checkpoint|close> [arg]');
}
