#!/usr/bin/env node
// Lints agent and skill definitions against the canonical skeleton.
// Scope:
//   - .claude/agents/*.md            full lint
//   - .claude/skills/*/SKILL.md      description + structural lint
//   - templates/agent-definition-template.md
//   - templates/skill-definition-template.md
// Zero deps. Run via `npm run lint:agents`.

import { readFileSync as _readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// Normalize CRLF → LF at the boundary so every regex below can rely on \n.
function readFileSync(path, enc) {
  return _readFileSync(path, enc).replace(/\r\n/g, '\n');
}

const AGENTS_DIR = '.claude/agents';
const SKILLS_DIR = '.claude/skills';
const TEMPLATES_DIR = 'templates';
const MAST_PATH = '.claude/agents/assets/mast.yaml';
const AGENT_TEMPLATE = 'templates/agent-definition-template.md';
const SKILL_TEMPLATE = 'templates/skill-definition-template.md';

const REQUIRED_TAGS = [
  'role_identity',
  'operating_constraints',
  // 'domain_vocabulary' is optional — agent-specific priming, may be omitted to reduce always-on context
  'deliverables',
  'decision_authority',
  'instructions',
  // 'rules' is optional — template says "Delete this tag if empty"
  'interaction_model',
  'completion_criteria',
  'output_format',
];

const PRE_FLIGHT_BULLETS = [
  'Inputs exist',
  'Prior phase reviewed',
  'Scope',
  'Terms current',
  'Target identified',
];

const ADJECTIVE_CAPS = /\b(concise|brief|appropriate length|manageable|reasonable|as needed|few|several)\b/i;
const OLD_PATH_RE = /templates\/assets\/(mast|tokens)\.yaml/;

const findings = new Map();
const fmCitations = new Map(); // FM code -> [{file, line}]

function add(file, level, line, msg) {
  if (!findings.has(file)) findings.set(file, []);
  findings.get(file).push({ level, line, msg });
}

function loadMastFMs() {
  if (!existsSync(MAST_PATH)) return new Set();
  const text = readFileSync(MAST_PATH, 'utf8');
  const idx = text.indexOf('\nfailure_modes_detail:');
  if (idx === -1) return new Set();
  const slice = text.slice(idx);
  const fms = new Set();
  for (const m of slice.matchAll(/^\s{2}(FM-\d+\.\d+):/gm)) fms.add(m[1]);
  return fms;
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { fm: null, body: text, raw: '' };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm: null, body: text, raw: '' };
  const raw = text.slice(4, end);
  const body = text.slice(end + 5);
  const fm = {};
  // naive: top-level `key: value` and `key: >` block scalars
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = ln.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val === '>' || val === '>-' || val === '|') {
      const buf = [];
      let j = i + 1;
      while (j < lines.length && /^(\s{2,}|\s*$)/.test(lines[j]) && !/^[a-zA-Z_-]+:/.test(lines[j])) {
        buf.push(lines[j].replace(/^\s{2}/, ''));
        j++;
      }
      val = buf.join(' ').replace(/\s+/g, ' ').trim();
      i = j - 1;
    }
    fm[key] = val;
  }
  return { fm, body, raw, bodyStartLine: 4 + raw.split('\n').length };
}

function checkTagOrder(file, body, bodyStartLine, opts = {}) {
  const opens = [];
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].matchAll(/<(\/?[a-z_]+)>/g);
    for (const m of matches) opens.push({ tag: m[1], line: bodyStartLine + i });
  }
  // Check each required tag appears once opened and once closed, in order.
  let cursor = 0;
  for (const tag of REQUIRED_TAGS) {
    const openIdx = opens.findIndex((t, i) => i >= cursor && t.tag === tag);
    if (openIdx === -1) {
      add(file, 'error', null, `missing required tag <${tag}>`);
      continue;
    }
    const closeIdx = opens.findIndex((t, i) => i > openIdx && t.tag === '/' + tag);
    if (closeIdx === -1) {
      add(file, 'error', opens[openIdx].line, `tag <${tag}> opened but not closed`);
      continue;
    }
    cursor = closeIdx + 1;
  }
  // Last meaningful tag should be </output_format>
  const last = [...opens].reverse().find(t => t.tag === '/output_format');
  if (last) {
    const tail = body.slice(body.lastIndexOf('</output_format>') + '</output_format>'.length).trim();
    if (tail.length > 0 && !opts.allowTrailing) {
      add(file, 'warning', last.line, `content appears after </output_format>`);
    }
  }
  // Banned: <anti_patterns>
  for (const t of opens) {
    if (t.tag === 'anti_patterns') {
      add(file, 'error', t.line, `<anti_patterns> tag is banned — use inline **Avoid (FM-x.x):** cues instead`);
    }
  }
  // Disallow outer wrapper: a tag opened before <role_identity> that wraps the rest.
  const roleIdx = opens.findIndex(t => t.tag === 'role_identity');
  if (roleIdx > 0) {
    const before = opens.slice(0, roleIdx).filter(t => !t.tag.startsWith('/'));
    for (const t of before) {
      add(file, 'warning', t.line, `tag <${t.tag}> appears before <role_identity> — possible outer wrapper`);
    }
  }
}

function extractTagBlock(body, tag) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const i = body.indexOf(open);
  if (i === -1) return null;
  const j = body.indexOf(close, i);
  if (j === -1) return null;
  return body.slice(i + open.length, j);
}

// The canonical pre-flight protocol (output block + branch logic + 5-questions cap)
// lives in CLAUDE.md `## Pre-flight protocol`. Each agent declares only its per-check
// semantics inline and references the protocol. The lint validates both ends:
//   - CLAUDE.md carries the canonical protocol (output block, branch, 5-questions cap).
//   - Each agent's <instructions> has a **Pre-flight.** step listing all 5 check bullets
//     and references the protocol (it should not duplicate the output block inline).
function checkClaudeMdProtocol(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  if (!/^##\s*Pre-flight protocol/m.test(text)) {
    add(file, 'error', null, `missing \`## Pre-flight protocol\` section`);
    return;
  }
  if (!/Result:\s*<?PROCEED\s*\|\s*ASK\s*\|\s*STOP>?/.test(text)) {
    add(file, 'error', null, `pre-flight protocol missing \`Result: <PROCEED | ASK | STOP>\` line`);
  }
  if (!/up to\s*\*?\*?5\s*clarifying questions/i.test(text)) {
    add(file, 'error', null, `pre-flight protocol missing the 5-clarifying-questions cap`);
  }
  for (const bullet of PRE_FLIGHT_BULLETS) {
    const re = new RegExp(`\\*\\*${bullet}\\*\\*`, 'm');
    if (!re.test(text)) add(file, 'error', null, `pre-flight protocol missing bullet \`${bullet}\``);
  }
}

function checkPreFlight(file, body) {
  const ins = extractTagBlock(body, 'instructions');
  if (!ins) return; // skeleton check already complained
  if (!/^\s*\d+\.\s*\*\*Pre-flight\.\*\*/m.test(ins)) {
    add(file, 'error', null, `<instructions> missing structured **Pre-flight.** step`);
    return;
  }
  for (const bullet of PRE_FLIGHT_BULLETS) {
    const re = new RegExp(`-\\s*\\*\\*${bullet}\\*\\*`, 'm');
    if (!re.test(ins)) add(file, 'error', null, `pre-flight missing bullet \`${bullet}\``);
  }
  if (!/CLAUDE\.md\s*`?##\s*Pre-flight protocol`?/i.test(ins)) {
    add(file, 'error', null, `pre-flight step must reference \`CLAUDE.md \`## Pre-flight protocol\`\` (canonical schema lives there)`);
  }
}

function checkFmCitations(file, text, knownFMs) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\*\*Avoid\s*\((FM-\d+\.\d+)\)/g);
    if (!m) continue;
    for (const hit of m) {
      const code = hit.match(/FM-\d+\.\d+/)[0];
      if (!fmCitations.has(code)) fmCitations.set(code, []);
      fmCitations.get(code).push({ file, line: i + 1 });
      if (!knownFMs.has(code)) {
        add(file, 'error', i + 1, `cites ${code} which has no entry under failure_modes_detail in ${MAST_PATH}`);
      }
    }
  }
}

function checkAdjectiveCaps(file, body) {
  // Scan <completion_criteria> block and any line that starts with IF or OUTPUT inside <instructions>.
  const cc = extractTagBlock(body, 'completion_criteria');
  if (cc) {
    cc.split('\n').forEach((ln, i) => {
      if (/<!--\s*lint:adj-ok\s*-->/.test(ln)) return;
      if (ADJECTIVE_CAPS.test(ln) && /\b(≤|<=|cap|limit|at most|up to)\b/i.test(ln) === false) {
        // Only flag when the adjective is clearly standing in for a cap (no numeric companion).
        if (/\b\d+\b/.test(ln)) return;
        add(file, 'warning', null, `completion_criteria: adjective-only cap "${ln.match(ADJECTIVE_CAPS)[0]}" — prefer a numeric ceiling`);
      }
    });
  }
  const ins = extractTagBlock(body, 'instructions');
  if (ins) {
    ins.split('\n').forEach((ln) => {
      if (/<!--\s*lint:adj-ok\s*-->/.test(ln)) return;
      const trimmed = ln.trim();
      if (!/^IF\b/.test(trimmed) && !/^OUTPUT:/.test(trimmed)) return;
      if (!ADJECTIVE_CAPS.test(trimmed)) return;
      if (/\b\d+\b/.test(trimmed)) return;
      add(file, 'warning', null, `<instructions> IF/OUTPUT line uses adjective-only cap — prefer numeric`);
    });
  }
}

function checkOldPaths(file, text) {
  text.split('\n').forEach((ln, i) => {
    if (OLD_PATH_RE.test(ln)) {
      add(file, 'error', i + 1, `old asset path \`templates/assets/...\` — use \`.claude/agents/assets/...\``);
    }
  });
}

function lintAgent(file, knownFMs) {
  const text = readFileSync(file, 'utf8');
  const { fm, body, raw, bodyStartLine } = parseFrontmatter(text);
  if (!fm) {
    add(file, 'error', null, `missing or unparseable YAML frontmatter`);
    return;
  }
  const expectedName = basename(file, '.md');
  for (const key of ['name', 'description', 'tools', 'model']) {
    if (!fm[key]) add(file, 'error', null, `frontmatter missing required key \`${key}\``);
  }
  if (fm.name && fm.name !== expectedName) {
    add(file, 'error', null, `frontmatter \`name: ${fm.name}\` must match filename (${expectedName})`);
  }
  checkTagOrder(file, body, bodyStartLine);
  checkPreFlight(file, body);
  checkFmCitations(file, text, knownFMs);
  checkAdjectiveCaps(file, body);
  checkOldPaths(file, text);
}

function lintSkill(file) {
  const text = readFileSync(file, 'utf8');
  const { fm, raw, body } = parseFrontmatter(text);
  if (!fm) {
    add(file, 'error', null, `missing or unparseable YAML frontmatter`);
    return;
  }
  for (const key of ['name', 'description']) {
    if (!fm[key]) add(file, 'error', null, `frontmatter missing required key \`${key}\``);
  }
  const expectedName = basename(file.replace(/[\\/]SKILL\.md$/, ''));
  if (fm.name && fm.name !== expectedName) {
    add(file, 'error', null, `frontmatter \`name: ${fm.name}\` must match directory (${expectedName})`);
  }
  // Description rules.
  if (fm.description) {
    if (fm.description.length > 1024) {
      add(file, 'error', null, `description is ${fm.description.length} chars — hard cap is 1024`);
    }
    if (!/Use this skill when/i.test(fm.description)) {
      add(file, 'error', null, `description must contain literal "Use this skill when" trigger`);
    }
  }
  // Block scalar `>` format check on the raw frontmatter.
  if (!/^description:\s*>\s*\n/m.test(raw)) {
    add(file, 'warning', null, `description should use a block scalar (\`description: >\`)`);
  }
  checkOldPaths(file, text);
  checkFmCitations(file, text, loadMastFMs());
}

function lintAgentTemplate(file, knownFMs) {
  // The template is meta — we don't enforce frontmatter or pre-flight on it,
  // but we do enforce: every required tag appears at least once (a worked example
  // demonstrating each), the banned <anti_patterns> tag does NOT appear as a
  // structural exemplar, no old paths, and every cited FM-code exists.
  const text = readFileSync(file, 'utf8');
  for (const tag of REQUIRED_TAGS) {
    if (!new RegExp(`<${tag}>`).test(text)) {
      add(file, 'error', null, `template missing worked-example tag <${tag}>`);
    }
  }
  // <anti_patterns> must not appear as a structural tag. Mentions inside backticks
  // (e.g. a checklist item saying "no `<anti_patterns>` block") are intentional.
  text.split('\n').forEach((ln, i) => {
    const stripped = ln.replace(/`[^`]*`/g, '');
    if (/<anti_patterns>/.test(stripped)) {
      add(file, 'error', i + 1, `template still references banned <anti_patterns> tag`);
    }
  });
  checkOldPaths(file, text);
  checkFmCitations(file, text, knownFMs);
}

function lintSkillTemplate(file, knownFMs) {
  const text = readFileSync(file, 'utf8');
  // Must instruct authors that description is ≤1024 chars and contains "Use this skill when".
  if (!/1024/.test(text)) {
    add(file, 'warning', null, `template should state the 1024-character description cap`);
  }
  if (!/Use this skill when/.test(text)) {
    add(file, 'warning', null, `template should reference the literal "Use this skill when" trigger`);
  }
  checkOldPaths(file, text);
  checkFmCitations(file, text, knownFMs);
}

// --- Run -----------------------------------------------------------------

const knownFMs = loadMastFMs();

if (existsSync(AGENTS_DIR)) {
  for (const entry of readdirSync(AGENTS_DIR)) {
    if (!entry.endsWith('.md')) continue;
    lintAgent(join(AGENTS_DIR, entry), knownFMs);
  }
}

if (existsSync(SKILLS_DIR)) {
  for (const dir of readdirSync(SKILLS_DIR)) {
    const skillPath = join(SKILLS_DIR, dir, 'SKILL.md');
    if (existsSync(skillPath)) lintSkill(skillPath);
  }
}

if (existsSync(AGENT_TEMPLATE)) lintAgentTemplate(AGENT_TEMPLATE, knownFMs);
if (existsSync(SKILL_TEMPLATE)) lintSkillTemplate(SKILL_TEMPLATE, knownFMs);

// CLAUDE.md owns the canonical pre-flight protocol and the universal Avoid cues.
checkClaudeMdProtocol('CLAUDE.md');
if (existsSync('CLAUDE.md')) {
  checkFmCitations('CLAUDE.md', readFileSync('CLAUDE.md', 'utf8'), knownFMs);
}

// Dead-detail check: FMs in mast.yaml that no agent/skill cites.
for (const fm of knownFMs) {
  if (!fmCitations.has(fm)) {
    add(MAST_PATH, 'warning', null, `failure_modes_detail.${fm} is defined but never cited (dead detail)`);
  }
}

// --- Report --------------------------------------------------------------

let errCount = 0, warnCount = 0;
const files = [...findings.keys()].sort();
for (const file of files) {
  const items = findings.get(file);
  if (!items.length) continue;
  console.log(file);
  for (const f of items) {
    const where = f.line ? `:${f.line}` : '';
    const tag = f.level === 'error' ? 'error' : 'warn';
    console.log(`  ${tag}${where}  ${f.msg}`);
    if (f.level === 'error') errCount++; else warnCount++;
  }
}

console.log('');
console.log(`lint-agents: ${errCount} error(s), ${warnCount} warning(s)`);
process.exit(errCount > 0 ? 1 : 0);
