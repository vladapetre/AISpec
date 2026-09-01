#!/usr/bin/env node
// Standalone contract linter — verifies that the harness's four layers still
// agree with each other. Run it, don't wire it: this is a repo-wide sweep like
// `lint.write.mjs --all`, not a per-call hook.
//
//   node .claude/hooks/lint.contract.mjs
//
// Why this exists: the contract is now stated across CLAUDE.md, five agent
// shells, nine mode files, nine YAML assets, six skills, and the hooks — and
// nothing checked that a pointer in one layer resolves in another. An audit
// (artifacts/reports/agent-skill-audit-2026-08-06.md) found five live drifts
// that are all mechanically detectable:
//
//   - reviewing/SKILL.md deferred to CLAUDE.md `**Security paths:**`, a form
//     replaced months earlier by a `## Security paths` SECTION. Masked because
//     the inline fallback list still matched — it would have broken silently the
//     first time a project extended the list.
//   - the consultant's tactical redirect was "step-3" in two files and "step-2"
//     in a third.
//   - `PAUSED` and `**Governing ADR:**` are load-bearing protocol strings that
//     appear in no tokens.*.yaml, against tokens.yaml's own rule that "adding a
//     token requires adding an entry in the matching file first". `PAUSED` can
//     bypass every guard.verdict check.
//   - lib/ownership.mjs admits a memory kind CLAUDE.md does not list.
//   - a skill on disk that no agent, registry, or document references.
//
// The pattern this generalises is already in the repo: lib/ownership.mjs is one
// registry with two callers and a header stating propagation order. Four of
// those findings are places that pattern was not applied. A linter cannot supply
// the single copy, but it can make the copies provably agree.
//
// Everything resolves from the project root via lib/project-root.mjs. No path
// outside the project is read, and no path is hardcoded — this file is deployed
// into host projects with the rest of `.claude/`.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./lib/project-root.mjs";

const ROOT = projectRoot(null);
// This file documents the malformed forms it rejects, so it must exempt itself
// from the pattern scans or it reports its own examples as findings.
const SELF = fileURLToPath(import.meta.url);
const at = (...p) => join(ROOT, ...p);
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");
const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const lineAt = (text, idx) => text.slice(0, idx).split("\n").length;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// --- The contract surface --------------------------------------------------
const AGENTS_DIR = at(".claude", "agents");
const ASSETS_DIR = join(AGENTS_DIR, "assets");
const INSTR_DIR = join(ASSETS_DIR, "instructions");
const SKILLS_DIR = at(".claude", "skills");
const HOOKS_DIR = at(".claude", "hooks");
const CLAUDE_MD = at("CLAUDE.md");

const agentFiles = existsSync(AGENTS_DIR)
  ? readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(AGENTS_DIR, f))
  : [];
const modeFiles = walk(INSTR_DIR).filter((f) => f.endsWith(".md"));
const skillDirs = existsSync(SKILLS_DIR)
  ? readdirSync(SKILLS_DIR).filter((d) => existsSync(join(SKILLS_DIR, d, "SKILL.md")))
  : [];
const skillFiles = skillDirs.map((d) => join(SKILLS_DIR, d, "SKILL.md"));
const assetFiles = existsSync(ASSETS_DIR)
  ? readdirSync(ASSETS_DIR)
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => join(ASSETS_DIR, f))
  : [];

// Prose surface = everything an agent can be told to read. Assets included:
// they carry cross-references too (preflight.yaml points at a consultant step).
const surface = [...agentFiles, ...modeFiles, ...skillFiles, ...assetFiles];
if (existsSync(CLAUDE_MD)) surface.push(CLAUDE_MD);
const docs = new Map(surface.map((p) => [p, read(p)]));

// Files that carry references but not contracts: the hooks themselves cite
// CLAUDE.md sections (ownership.mjs names ## Artifact Ownership as its source of
// truth) and the README names every hook. Scanning them keeps the "cited by
// nobody" check honest — the enforcement layer is a first-class reader.
const pathOnly = [
  join(HOOKS_DIR, "README.md"),
  ...(existsSync(HOOKS_DIR) ? walk(HOOKS_DIR).filter((f) => f.endsWith(".mjs")) : []),
].filter(existsSync);
for (const p of pathOnly) docs.set(p, read(p));

const yamlTopKeys = (text) => new Set([...text.matchAll(/^([A-Za-z_][\w-]*):/gm)].map((m) => m[1]));
const frontmatter = (text) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";

// ---------------------------------------------------------------------------
// A. `<asset>.yaml#<key>` references resolve to a real top-level key.
//    Catches a renamed or deleted registry entry that every agent still cites.
// ---------------------------------------------------------------------------
const assetKeys = new Map(assetFiles.map((p) => [basename(p), yamlTopKeys(read(p))]));

for (const [p, text] of docs) {
  for (const m of text.matchAll(/([a-z][\w.-]*\.yaml)#([^\s`)\]"',;]+)/g)) {
    const file = m[1];
    const key = m[2].replace(/[.,:)\]]+$/, "");
    if (key.includes("<")) continue; // templated, e.g. selfcheck.yaml#<agent>-<mode>
    const where = `${rel(p)}:${lineAt(text, m.index)}`;
    if (!assetKeys.has(file)) {
      err(where, `references ${file}, which is not an asset under .claude/agents/assets/`);
      continue;
    }
    if (!assetKeys.get(file).has(key)) err(where, `${file}#${key} — no top-level key "${key}" in that file`);
  }
}

// ---------------------------------------------------------------------------
// B. CLAUDE.md `## Section` anchors resolve — and the deprecated bold-pointer
//    form is rejected outright. CLAUDE.md's own header says a section must
//    never be renamed or deleted "without re-pointing its references"; this is
//    the check that makes that enforceable.
// ---------------------------------------------------------------------------
const claudeText = docs.get(CLAUDE_MD) ?? "";
const claudeSections = [...claudeText.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
const cited = new Set();

// A reference may name only the section's leading phrase: tokens.routing.yaml
// cites "## Agent lifecycle" for the section titled "## Agent lifecycle —
// continue, don't respawn". Prefix-match on a word boundary, not equality.
function resolveSection(name) {
  return claudeSections.find((s) => s === name || s.startsWith(name + " ") || s.startsWith(name + "—"));
}

for (const [p, text] of docs) {
  if (p === SELF) continue; // this file quotes both forms as documentation
  for (const m of text.matchAll(/CLAUDE\.md\s*`(##\s*[^`\n]+)`|CLAUDE\.md\s+(##\s+[^\n,.;:)`]+)/g)) {
    const raw = (m[1] ?? m[2]).replace(/^##\s*/, "").replace(/\s+/g, " ").trim();
    const where = `${rel(p)}:${lineAt(text, m.index)}`;
    // The unbackticked form runs into the sentence that follows it
    // ("CLAUDE.md ## Artifact Ownership first, then an entry here"), so accept
    // the longest leading phrase that resolves rather than guessing where a
    // heading ends from punctuation.
    const words = raw.split(" ");
    let hit = null;
    for (let n = words.length; n > 0 && !hit; n--) hit = resolveSection(words.slice(0, n).join(" "));
    if (hit) cited.add(hit);
    else err(where, `CLAUDE.md has no "## ${raw}" section`);
  }
  // The pre-2026-08 pointer style. It resolves to nothing and fails silently
  // wherever an inline fallback happens to agree with the section's contents.
  for (const m of text.matchAll(/CLAUDE\.md\s*`?\*\*([^*\n]+?):\*\*/g)) {
    err(
      `${rel(p)}:${lineAt(text, m.index)}`,
      `deprecated pointer form \`**${m[1]}:**\` — CLAUDE.md anchors are "## Section" headings`
    );
  }
}

// Reverse direction: an always-on section nobody points at is a candidate for
// CLAUDE.md's own admission test ("load-bearing for more than one actor").
// Warn-only — some sections are standing rules read by every agent rather than
// referenced by name, and that is legitimate.
for (const s of claudeSections)
  if (!cited.has(s)) warn("CLAUDE.md", `"## ${s}" is referenced by no agent, mode file, skill, or asset`);

// ---------------------------------------------------------------------------
// C. Token registry parity. tokens.yaml:10 — "Adding a token requires adding an
//    entry in the matching file first." Three directions are checked.
// ---------------------------------------------------------------------------
const tokensIndex = assetFiles.find((p) => basename(p) === "tokens.yaml");
const registered = new Set();
const routedTo = new Map();
if (tokensIndex) {
  const text = read(tokensIndex);
  const block = /quick_lookup:\n([\s\S]*?)(?=\n[A-Za-z_]|\n*$)/.exec(text)?.[1] ?? "";
  for (const m of block.matchAll(/^\s+"([^"]+)":\s*(\w+)/gm)) {
    registered.add(m[1]);
    routedTo.set(m[1], m[2]);
  }
  if (!registered.size) err(rel(tokensIndex), "quick_lookup is empty or unparseable — token checks skipped");
}

// C1 — every quick_lookup entry is actually defined in the file it routes to.
const defFiles = { routing: "tokens.routing.yaml", verdicts: "tokens.verdicts.yaml", markers: "tokens.markers.yaml" };
const defText = {};
for (const [kind, name] of Object.entries(defFiles)) {
  const p = assetFiles.find((f) => basename(f) === name);
  defText[kind] = p ? read(p) : null;
  if (!p) err(rel(ASSETS_DIR), `tokens.yaml routes to ${name}, which does not exist`);
}
for (const [token, kind] of routedTo) {
  const text = defText[kind];
  if (!text) continue;
  // routing/verdicts use `- token: "X"`, and routing additionally declares the
  // conversation form as `summary_line:` on the same entry. Markers are prose
  // bullets, so match on the key's stable prefix instead of inventing a schema:
  // quick_lookup indexes `**Spec: ON HOLD**` while the bullet spells out
  // `**Spec: ON HOLD — <reason>, <date>**`.
  const declared =
    kind === "markers"
      ? text.includes(token) || text.includes(token.replace(/\*\*$/, ""))
      : new RegExp(`^\\s*-?\\s*(token|summary_line):\\s*"${escapeRe(token)}"`, "m").test(text);
  if (!declared) err(rel(tokensIndex), `quick_lookup routes "${token}" to ${defFiles[kind]}, which does not define it`);
}

// C2 — every routing/verdict token is indexed in quick_lookup.
for (const kind of ["routing", "verdicts"]) {
  const text = defText[kind];
  if (!text) continue;
  for (const m of text.matchAll(/^\s*-\s+token:\s*"([^"]+)"/gm))
    if (!registered.has(m[1]))
      err(rel(join(ASSETS_DIR, defFiles[kind])), `token "${m[1]}" is defined but absent from tokens.yaml quick_lookup`);
}

// C3 — every token a mode file declares in its `## Tokens (this mode)` contract
// is registered. This is the handoff contract; an unregistered token here means
// a producer and a consumer can disagree with nothing to arbitrate.
for (const p of modeFiles) {
  const text = docs.get(p);
  const block = /^##\s+Tokens[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/m.exec(text);
  if (!block) continue;
  const offset = block.index;
  for (const m of block[1].matchAll(/`([^`\n]+)`/g)) {
    const token = m[1].trim();
    if (token.includes("<") || !token) continue;
    if (!registered.has(token))
      err(`${rel(p)}:${lineAt(text, offset)}`, `## Tokens declares \`${token}\`, which is not in tokens.yaml quick_lookup`);
  }
}

// C4 — token-shaped strings used anywhere in the agent surface but registered
// nowhere. Warn-only: the shape test cannot distinguish a protocol token from a
// field value, so the ignore list carries the known non-tokens.
const NOT_TOKENS = new Set([
  // enumerated field values, not routing tokens
  "CODE_DRIFT", "ADR_AMENDED", "PLAN_UPDATED", "REVIEWER_DRIFT", "USER_DIRECTED",
  "PASS", "FAIL", "UNCLEAR", "CLEAN", "YES", "NO", "HONOURED", "DRIFT",
  "NONE IDENTIFIED", "ASK", "STOP", "PROCEED", "N/A",
  // addressees and roles named in output blocks
  "USER", "REVIEWER", "ARCHITECT", "DEVELOPER",
  // filename sequence placeholders and quoted SQL keywords
  "NNNNN", "NNNNM", "DISTINCT", "GROUP BY",
]);
for (const p of [...agentFiles, ...modeFiles]) {
  const text = docs.get(p);
  const seen = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const candidate = m[1].split(" — ")[0].trim();
    if (!/^(\[[A-Z][A-Z /-]*\]|[A-Z][A-Z_]{2,}(?: [A-Z][A-Z_]*)*:?(?: \(delta\))?)$/.test(candidate)) continue;
    // Prose drops the trailing colon when naming a summary-line token
    // ("the RECONCILE WITH ADR list"); that is the same token, not a new one.
    if (registered.has(candidate) || registered.has(candidate + ":") || registered.has(candidate.replace(/:$/, "")))
      continue;
    if (NOT_TOKENS.has(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    warn(`${rel(p)}:${lineAt(text, m.index)}`, `\`${candidate}\` reads as a protocol token but is registered in no tokens.*.yaml`);
  }
}

// ---------------------------------------------------------------------------
// D. Dispatch / mode-file / preflight / selfcheck parity. Every multi-mode
//    agent's step-2 dispatch must name a file that exists, every mode file must
//    be reachable from a dispatch, and each mode must have both a pre-flight
//    entry and a self-check entry.
// ---------------------------------------------------------------------------
const agentNames = new Map(); // agent name -> shell path
for (const p of agentFiles) {
  const name = /^name:\s*(\S+)/m.exec(frontmatter(docs.get(p)))?.[1];
  if (!name) err(rel(p), "frontmatter has no `name:` field");
  else agentNames.set(name, p);
}

const modesOnDisk = new Map(); // agent -> Set(mode)
for (const p of modeFiles) {
  const agent = basename(dirname(p));
  if (agent === "lead") continue; // documented exception: no shell, no dispatch
  if (!modesOnDisk.has(agent)) modesOnDisk.set(agent, new Set());
  modesOnDisk.get(agent).add(basename(p, ".md"));
}

const dispatched = new Set();
for (const [p, text] of docs) {
  for (const m of text.matchAll(/instructions\/([a-z-]+)\/([a-z-]+)\.md/g)) {
    const [, agent, mode] = m;
    dispatched.add(`${agent}/${mode}`);
    if (!existsSync(join(INSTR_DIR, agent, `${mode}.md`)))
      err(`${rel(p)}:${lineAt(text, m.index)}`, `points at instructions/${agent}/${mode}.md, which does not exist`);
  }
}
for (const [agent, modes] of modesOnDisk)
  for (const mode of modes)
    if (!dispatched.has(`${agent}/${mode}`))
      warn(rel(join(INSTR_DIR, agent, `${mode}.md`)), "exists but no agent shell or document dispatches to it");

// Expected registry keys: `<agent>-<mode>` where modes exist, `<agent>` otherwise.
const expectedKeys = new Set();
for (const agent of agentNames.keys()) {
  const modes = modesOnDisk.get(agent);
  if (modes?.size) for (const m of modes) expectedKeys.add(`${agent}-${m}`);
  else expectedKeys.add(agent);
}

const preflight = assetFiles.find((p) => basename(p) === "preflight.yaml");
if (preflight) {
  const keys = yamlTopKeys(read(preflight));
  keys.delete("emit_format");
  for (const k of expectedKeys) if (!keys.has(k)) err(rel(preflight), `no pre-flight entry for "${k}"`);
  for (const k of keys) if (!expectedKeys.has(k)) warn(rel(preflight), `entry "${k}" matches no agent or mode file`);
}

const selfcheck = assetFiles.find((p) => basename(p) === "selfcheck.yaml");
if (selfcheck) {
  const keys = yamlTopKeys(read(selfcheck));
  if (!keys.has("_universal")) err(rel(selfcheck), 'missing the "_universal" block every agent inherits');
  for (const k of expectedKeys) if (!keys.has(k)) err(rel(selfcheck), `no self-check entry for "${k}"`);
  for (const k of keys) {
    if (k === "_universal" || expectedKeys.has(k) || agentNames.has(k)) continue;
    warn(rel(selfcheck), `entry "${k}" matches no agent or mode file`);
  }
}

// ---------------------------------------------------------------------------
// E. Every skill on disk is reachable. A skill nothing references is invisible
//    to the contract surface even when it works.
// ---------------------------------------------------------------------------
const frontmatterSkills = new Set();
for (const p of agentFiles) {
  const fm = frontmatter(docs.get(p));
  const list = /^skills:\n((?:\s*-\s*\S+\n)+)/m.exec(fm)?.[1] ?? "";
  for (const m of list.matchAll(/-\s*(\S+)/g)) {
    frontmatterSkills.add(m[1]);
    if (!skillDirs.includes(m[1])) err(rel(p), `frontmatter declares skill "${m[1]}", which has no .claude/skills/${m[1]}/SKILL.md`);
  }
}
for (const d of skillDirs) {
  if (frontmatterSkills.has(d)) continue;
  // Scan everything EXCEPT the skill's own file: every SKILL.md names its own
  // slash-command, so a self-match would make an orphan look referenced —
  // which is exactly the state this check exists to find.
  const others = [...docs]
    .filter(([p]) => p !== join(SKILLS_DIR, d, "SKILL.md"))
    .map(([, t]) => t)
    .join("\n");
  const mentioned = new RegExp(`(skills/${escapeRe(d)}/|\`${escapeRe(d)}\`\\s+skill|/${escapeRe(d)}\\b)`).test(others);
  if (!mentioned) warn(rel(join(SKILLS_DIR, d, "SKILL.md")), "no agent declares it and no document references it");
}

// ---------------------------------------------------------------------------
// F. Referenced files exist — skill-relative templates and explicit .claude/
//    paths alike. A template pointer that resolves to nothing fails at the one
//    moment the agent needed it.
// ---------------------------------------------------------------------------
for (const p of skillFiles) {
  const dir = dirname(p);
  const text = docs.get(p);
  for (const m of text.matchAll(/\b(templates|examples|references|scripts)\/([\w./-]+\.\w+)/g)) {
    const target = join(dir, m[1], m[2]);
    if (m[2].includes("<") || m[2].includes("*")) continue;
    // A project-rooted path that happens to contain one of these directory
    // names is not a bundled asset: `.claude/scripts/lint.craft.mjs` is the
    // shared craft linter, not `<skill>/scripts/lint.craft.mjs`. The explicit
    // `.claude/` path check below already verifies it exists.
    if (text.slice(Math.max(0, m.index - 8), m.index) === ".claude/") continue;
    if (!existsSync(target)) err(`${rel(p)}:${lineAt(text, m.index)}`, `${m[1]}/${m[2]} does not exist in this skill`);
  }
}

// Agents and mode files name templates skill-relatively (`templates/adr.md`),
// resolved against whichever skill provides them. Error only if no skill does.
const skillOwned = new Map();
for (const d of skillDirs)
  for (const f of walk(join(SKILLS_DIR, d)))
    skillOwned.set(relative(join(SKILLS_DIR, d), f).replaceAll("\\", "/"), d);
for (const p of [...agentFiles, ...modeFiles]) {
  const text = docs.get(p);
  for (const m of text.matchAll(/\b(templates|examples)\/([\w.-]+\.md)/g)) {
    const ref = `${m[1]}/${m[2]}`;
    if (ref.includes("<")) continue;
    if (!skillOwned.has(ref)) err(`${rel(p)}:${lineAt(text, m.index)}`, `\`${ref}\` is provided by no skill`);
  }
}

// Explicit project paths. Generated locations are excluded — they legitimately
// do not exist until something runs.
const GENERATED = [
  ".claude/state/",
  ".claude/telemetry/ledger.jsonl",
  ".claude/telemetry/guard-bash.log",
  ".claude/agent-memory/",
  ".claude/branching/",
  ".claude/MEMORY.md",
];
for (const [p, text] of docs) {
  // The lookahead matters: without it `ledger.jsonl` matches as `ledger.json`
  // and reports a file that was never referenced.
  for (const m of text.matchAll(/\.claude\/[\w./-]+\.(?:md|mjs|yaml|json|docx)(?![\w.])/g)) {
    const ref = m[0];
    if (ref.includes("<") || ref.includes("*")) continue;
    if (GENERATED.some((g) => ref.startsWith(g))) continue;
    if (!existsSync(at(...ref.split("/")))) err(`${rel(p)}:${lineAt(text, m.index)}`, `${ref} does not exist`);
  }
}

// ---------------------------------------------------------------------------
// G. Hook wiring. A hook on disk that settings.json does not wire and no
//    document describes is dead weight; a wired hook that does not exist is a
//    silently disabled guard.
// ---------------------------------------------------------------------------
const settingsPath = at(".claude", "settings.json");
if (existsSync(settingsPath)) {
  const raw = read(settingsPath);
  let settings = null;
  try {
    settings = JSON.parse(raw);
  } catch {
    err(rel(settingsPath), "is not valid JSON");
  }
  const wired = new Set();
  for (const m of raw.matchAll(/hooks\/([\w.-]+\.mjs)/g)) {
    wired.add(m[1]);
    if (!existsSync(join(HOOKS_DIR, m[1]))) err(rel(settingsPath), `wires hooks/${m[1]}, which does not exist`);
  }

  // Absolute paths in permissions do not travel with the template and match
  // nothing on another machine — the failure is silent in both directions.
  const perms = settings?.permissions ?? {};
  const scan = [...(perms.allow ?? []), ...(perms.ask ?? []), ...(perms.deny ?? []), ...(perms.additionalDirectories ?? [])];
  for (const entry of scan)
    if (/(^|[("\s])(\/(?:home|Users|root|mnt|opt|var)\/|[A-Za-z]:[\\/])/.test(entry))
      err(rel(settingsPath), `permission entry is machine-absolute and will not travel with the template: ${entry}`);

  const readme = pathOnly.map((p) => docs.get(p)).join("\n");
  for (const f of existsSync(HOOKS_DIR) ? readdirSync(HOOKS_DIR).filter((f) => f.endsWith(".mjs")) : [])
    if (!wired.has(f) && !readme.includes(f)) warn(rel(join(HOOKS_DIR, f)), "is neither wired in settings.json nor described in hooks/README.md");
}

// ---------------------------------------------------------------------------
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function render(list, label) {
  if (!list.length) return "";
  const groups = new Map();
  for (const item of list) {
    const i = item.indexOf(": ");
    const [where, reason] = i === -1 ? [item, item] : [item.slice(0, i), item.slice(i + 2)];
    groups.set(reason, [...(groups.get(reason) ?? []), where]);
  }
  // Grouped by reason, same shape as lint.write.mjs --all: one real sweep can
  // surface the same reason dozens of times, and an unbounded wall gets skimmed.
  const body = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([reason, where]) => {
      const shown = where.slice(0, 4).map((w) => `      ${w}`);
      if (where.length > 4) shown.push(`      +${where.length - 4} more`);
      return [`  - ${where.length}x ${reason}`, ...shown].join("\n");
    })
    .join("\n");
  return `${label}:\n${body}\n`;
}

process.stdout.write(render(errors, "errors") + render(warnings, "warnings"));
process.stdout.write(
  errors.length || warnings.length
    ? `\nlint.contract: ${errors.length} error(s), ${warnings.length} warning(s)\n`
    : "lint.contract: clean\n"
);
process.exit(errors.length ? 1 : 0);
