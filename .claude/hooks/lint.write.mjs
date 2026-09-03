#!/usr/bin/env node
// PostToolUse lint on Write/Edit — feeds violations straight back to the agent
// (exit 2 → stderr is shown to the model, which corrects in the same turn):
//   1. .claude/agent-memory/*/MEMORY.md — the CLAUDE.md memory caps: file ≤150
//      lines (compaction protocol) and index entries ≤2 lines / ≤50 words.
//   2. .claude/MEMORY.md — ## Decisions entries are hooks, not essays (≤120 words).
//   3. artifacts/plans/*.md — anchor/stamp integrity via plan-status.mjs check.
//   4. artifacts/reports/*.md — the documenting report template's own caps
//      (≤50 findings, ≤5 body lines per finding).
//   5. artifacts/plans/*.md with a ## Decisions section (design records) — the
//      revision protocol: D-### bodies changed vs git HEAD need a bumped (rN)
//      marker and a Revision log line; decisions are withdrawn, never deleted.
// Also runnable standalone: `node lint.write.mjs --all` lints every
// agent-memory MEMORY.md plus .claude/MEMORY.md (for periodic sweeps).
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { projectRoot, repoRelative } from "./lib/project-root.mjs";
import { checkArtifactPath, checkMemoryPath } from "./lib/ownership.mjs";

const problems = [];

function lintAgentMemory(path, label) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  if (lines.length > 150)
    problems.push(`${label}: ${lines.length} lines (cap 150) — run the compaction protocol before continuing (CLAUDE.md ## Agent memory layout)`);
  // Index entries: a top-level "- " bullet up to the next bullet/blank/heading.
  let start = -1;
  const flush = (end) => {
    if (start < 0) return;
    const entry = lines.slice(start, end);
    const words = entry.join(" ").split(/\s+/).filter(Boolean).length;
    if (entry.length > 2 || words > 50)
      problems.push(`${label}:${start + 1}: index entry is ${entry.length} lines / ${words} words (cap 2 / 50) — move detail to the per-entity file, keep a hook`);
    start = -1;
  };
  lines.forEach((l, i) => {
    if (/^- /.test(l)) { flush(i); start = i; }
    else if (start >= 0 && (l.trim() === "" || /^#/.test(l))) flush(i);
  });
  flush(lines.length);
}

function lintProjectMemory(path, label) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  let inDecisions = false;
  let start = -1;
  const flush = (end) => {
    if (start < 0) return;
    const words = lines.slice(start, end).join(" ").split(/\s+/).filter(Boolean).length;
    if (words > 120)
      problems.push(`${label}:${start + 1}: decision entry is ${words} words — a decision-log entry is ≤3 sentences + a pointer to its owning artifact (understanding skill)`);
    start = -1;
  };
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) { flush(i); inDecisions = /^##\s+Decisions/.test(l); }
    else if (inDecisions && /^- /.test(l)) { flush(i); start = i; }
    else if (start >= 0 && l.trim() === "") flush(i);
  });
  flush(lines.length);
}

// Analysis reports: the documenting template's own caps (templates/report.md
// ## Caps and overflow), enforced because prose alone measurably is not — on the
// development umbrella the >100-word finding share held at ~40% for three months
// after the caps landed (June mean 101 words/finding, August 103).
function lintReport(path, label) {
  const text = readFileSync(path, "utf8");
  const section = /^## Findings\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];
  if (!section) return;
  const lines = section.split(/\r?\n/);
  const entries = []; // body/words counted with fences excluded — a one-line
  // 300-word paragraph satisfies a line cap, so the word cap does the real work
  let cur = null;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^- \*\*R-\d+/.test(l)) {
      cur = { id: /R-\d+/.exec(l)[0], bodyLines: 0, words: l.split(/\s+/).filter(Boolean).length };
      entries.push(cur);
      continue;
    }
    if (/^#{2,3}\s/.test(l)) { cur = null; continue; }
    if (cur && l.trim() !== "") { cur.bodyLines++; cur.words += l.split(/\s+/).filter(Boolean).length; }
  }
  if (entries.length > 50)
    problems.push(`${label}: ${entries.length} findings (cap 50) — keep the top 50 by severity and move the rest to a sibling extras file (documenting templates/report.md ## Caps and overflow)`);
  const over = entries.filter((e) => e.bodyLines > 5 || e.words > 120);
  if (over.length)
    problems.push(
      `${label}: ${over.length} finding(s) over the per-finding cap (5 body lines / 120 words, fenced snippets excluded): ` +
        over.map((e) => `${e.id} (${e.bodyLines}l/${e.words}w)`).join(", ") +
        ` — split into sibling findings or link a deep-dive note (documenting templates/report.md)`
    );
}

// Design records (artifacts/plans/*.md with a ## Decisions section): the revision
// protocol from documenting templates/design-record.md. Amendments edit decisions
// in place, so the audit trail is the (rN) marker + Revision log line — and git
// history holds the bytes. The baseline is the git-tracked version: an untracked
// file is a draft and the rule stays silent. Markers are monotonic, so the check
// survives the bulk artifact commits measured on the development umbrella
// ("update adr" carrying 17 files): any body that differs from HEAD needs a
// marker higher than HEAD's, however many amendments landed in between.
function parseDecisions(text) {
  const map = new Map(); // id -> { marker, body }
  const re = /^###\s+(D-\d{3})(?:\s+\(r(\d+)\))?[^\n]*\n([\s\S]*?)(?=^###\s|^##\s|(?![\s\S]))/gm;
  const section = /^## Decisions\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1];
  if (section == null) return null;
  let m;
  while ((m = re.exec(section)) !== null)
    map.set(m[1], { marker: m[2] ? parseInt(m[2], 10) : 1, body: m[3].replace(/\s+/g, " ").trim() });
  return map;
}

function lintDesignRecord(path, root, label, rel) {
  const text = readFileSync(path, "utf8");
  const now = parseDecisions(text);
  if (now === null) return; // legacy plan (no ## Decisions) — not a design record
  let headText;
  try {
    headText = execFileSync("git", ["-C", root, "show", `HEAD:${rel}`], {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    return; // untracked or no git — drafting, no ratified baseline to hold against
  }
  const head = parseDecisions(headText);
  if (head === null) return; // tracked version predates the Decisions section
  const log = /^## Revision log\s*$([\s\S]*)$/m.exec(text)?.[1] ?? "";
  for (const [id, was] of head) {
    const cur = now.get(id);
    if (!cur) {
      problems.push(`${label}: ${id} was deleted — decisions are withdrawn with [withdrawn] and a bumped (rN) marker, never removed (design-record.md Revision protocol)`);
      continue;
    }
    if (cur.marker < was.marker)
      problems.push(`${label}: ${id} marker went backwards (r${was.marker} → r${cur.marker}) — markers only increase`);
    else if (cur.body !== was.body && cur.marker === was.marker)
      problems.push(`${label}: ${id} body changed without a marker bump — set "### ${id} (r${was.marker + 1}): ..." and add a Revision log line (design-record.md Revision protocol)`);
    else if (cur.body !== was.body && !log.includes(id))
      problems.push(`${label}: ${id} was revised to r${cur.marker} but ## Revision log has no line naming it — append "- r${cur.marker} <date> — ${id}: <what changed>; <why>"`);
  }
}

function lintPlan(path, root, label) {
  const script = join(root, ".claude", "skills", "documenting", "scripts", "plan-status.mjs");
  if (!existsSync(script)) return;
  try {
    execFileSync(process.execPath, [script, "check", path], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    const err = (e.stderr ?? "").toString().trim();
    if (err) problems.push(`${label}: ${err.replaceAll("\n", "; ")}`);
  }
}

if (process.argv.includes("--all")) {
  // Root-anchored so a sweep run from a subdirectory still finds every file.
  // `--root <path>` audits another checkout (read-only) — useful for auditing a
  // consuming project from the toolkit repo.
  const rootArg = process.argv[process.argv.indexOf("--root") + 1];
  const root = process.argv.includes("--root") && rootArg ? rootArg : projectRoot(null);

  const amRoot = join(root, ".claude", "agent-memory");
  if (existsSync(amRoot))
    for (const agent of readdirSync(amRoot)) {
      const dir = join(amRoot, agent);
      if (!statSync(dir).isDirectory()) continue;
      const idx = join(dir, "MEMORY.md");
      if (existsSync(idx)) lintAgentMemory(idx, `.claude/agent-memory/${agent}/MEMORY.md`);
      // Registered file kinds (CLAUDE.md ## Agent memory layout). The write-time
      // guard blocks these, but files that predate it — or landed while a hook was
      // mis-anchored — sit there unnoticed until someone sweeps.
      for (const name of readdirSync(dir)) {
        const rel = `.claude/agent-memory/${agent}/${name}`;
        if (statSync(join(dir, name)).isDirectory()) {
          problems.push(`${rel}/: subdirectories are not a registered memory kind`);
          continue;
        }
        const reason = checkMemoryPath(rel);
        if (reason) problems.push(`${rel}: ${reason}`);
      }
    }

  const pm = join(root, ".claude", "MEMORY.md");
  if (existsSync(pm)) lintProjectMemory(pm, ".claude/MEMORY.md");

  // Artifact ownership (CLAUDE.md ## Artifact Ownership) — unregistered
  // directories and loose files directly under artifacts/.
  const artRoot = join(root, "artifacts");
  if (existsSync(artRoot))
    for (const name of readdirSync(artRoot)) {
      const isDir = statSync(join(artRoot, name)).isDirectory();
      const rel = `artifacts/${name}${isDir ? "/probe.md" : ""}`;
      const reason = checkArtifactPath(rel);
      if (reason) problems.push(`artifacts/${name}${isDir ? "/" : ""}: ${reason}`);
    }

  // Plan anchor/stamp integrity across every plan, not just the one being written.
  const plansRoot = join(artRoot, "plans");
  if (existsSync(plansRoot))
    for (const name of readdirSync(plansRoot))
      if (name.endsWith(".md")) {
        lintPlan(join(plansRoot, name), root, `artifacts/plans/${name}`);
        lintDesignRecord(join(plansRoot, name), root, `artifacts/plans/${name}`, `artifacts/plans/${name}`);
      }

  // Report caps across every report, for the same reason.
  const reportsRoot = join(artRoot, "reports");
  if (existsSync(reportsRoot))
    for (const name of readdirSync(reportsRoot))
      if (name.endsWith(".md")) lintReport(join(reportsRoot, name), `artifacts/reports/${name}`);
} else {
  let data;
  try {
    data = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const filePath = data.tool_input?.file_path;
  if (!filePath) process.exit(0);
  // Root-anchored: cwd-anchoring meant a session started in a subdirectory
  // produced a "../.."-prefixed path that matched none of the rules below, so
  // the memory caps and plan-anchor check were silently skipped.
  let root, rel, abs, outside;
  try {
    ({ root, rel, abs, outside } = repoRelative(data, filePath));
  } catch {
    process.exit(0);
  }
  if (outside || !existsSync(abs)) process.exit(0);
  if (/^\.claude\/agent-memory\/[^/]+\/MEMORY\.md$/.test(rel)) lintAgentMemory(abs, rel);
  else if (rel === ".claude/MEMORY.md") lintProjectMemory(abs, rel);
  else if (/^artifacts\/plans\/[^/]+\.md$/.test(rel)) { lintPlan(abs, root, rel); lintDesignRecord(abs, root, rel, rel); }
  else if (/^artifacts\/reports\/[^/]+\.md$/.test(rel)) lintReport(abs, rel);
  else process.exit(0);
}

if (problems.length) {
  // Hook mode reports one file, so list it plainly. A --all sweep can surface
  // hundreds of instances of the SAME reason (a real run: 113 mis-named review
  // files, each repeating the full allow-list), and an unbounded wall gets
  // skimmed and ignored — the same failure the reviewing skill's E5 cap avoids.
  // So group by reason, show a few examples, and count the rest.
  let body;
  if (process.argv.includes("--all")) {
    const groups = new Map();
    for (const p of problems) {
      const i = p.indexOf(": ");
      const [where, reason] = i === -1 ? [p, p] : [p.slice(0, i), p.slice(i + 2)];
      const g = groups.get(reason) ?? [];
      g.push(where);
      groups.set(reason, g);
    }
    body = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([reason, where]) => {
        const head = `  - ${where.length}x ${reason}`;
        const shown = where.slice(0, 3).map((w) => `      ${w}`);
        if (where.length > 3) shown.push(`      +${where.length - 3} more`);
        return [head, ...shown].join("\n");
      })
      .join("\n");
  } else {
    body = problems.map((p) => `  - ${p}`).join("\n");
  }
  process.stderr.write(`lint.write:\n${body}\n`);
  process.exit(2);
}
process.exit(0);
