// The review summary: everything the reviewer used to detect for itself, computed once by code.
// size class, frameworks, concerns, security paths, changed files, and the diff base.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { deriveState, projectRoot } from "./work.mjs";
import { DEFAULT_SECURITY_PATHS } from "./admit.mjs";
import * as git from "./git.mjs";

export const SIZE = Object.freeze({ small: { files: 3, lines: 50 }, medium: { files: 10, lines: 400 } });

function numstat(root, base, head = null) {
  try {
    const out = execFileSync("git", ["-C", root, "diff", "--numstat", base, ...(head ? [head] : [])], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    let added = 0;
    let removed = 0;
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^(\d+)\t(\d+)\t/);
      if (m) {
        added += Number(m[1]);
        removed += Number(m[2]);
      }
    }
    return { added, removed };
  } catch {
    return { added: 0, removed: 0 };
  }
}

export function sizeClass(files, lines) {
  if (files <= SIZE.small.files && lines <= SIZE.small.lines) return "small";
  if (files <= SIZE.medium.files && lines <= SIZE.medium.lines) return "medium";
  return "large";
}

export function detectFrameworks(root) {
  const out = new Set();
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (deps.typescript || existsSync(join(root, "tsconfig.json"))) out.add("typescript");
    if (deps.react) out.add("react");
  }
  if (hasFile(root, (f) => /\.(csproj|sln)$/.test(f), 3)) out.add("dotnet");
  if (existsSync(join(root, "pyproject.toml")) || existsSync(join(root, "requirements.txt"))) out.add("python");
  return [...out].sort();
}

export function detectConcerns(root, changedFiles) {
  const out = new Set();
  const dirs = new Set(changedFiles.map((f) => f.toLowerCase()));
  const has = (re) => [...dirs].some((f) => re.test(f)) || hasFile(root, (f) => re.test(f.toLowerCase()), 4);
  if (has(/(^|\/)(domain|application|infrastructure|usecases?|ports?|adapters?)\//)) out.add("clean-architecture");
  if (has(/(^|\/)(features?|slices?)\/[^/]+\//)) out.add("vertical-slice");
  return [...out].sort();
}

function hasFile(root, pred, depth, dir = root, level = 0) {
  if (level > depth) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
    const rel = join(dir, e.name).slice(root.length + 1).replaceAll("\\", "/");
    if (pred(rel)) return true;
    if (e.isDirectory() && hasFile(root, pred, depth, join(dir, e.name), level + 1)) return true;
  }
  return false;
}

function securityPaths(root) {
  const p = join(root, ".claude", "harness.json");
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")).security_paths ?? DEFAULT_SECURITY_PATHS;
    } catch {}
  }
  return DEFAULT_SECURITY_PATHS;
}

/** The summary for a committed range (a pull request): `git diff base head`, nothing from the working tree. */
export function reviewSummaryRange(root, base, head) {
  let changed = [];
  try {
    changed = execFileSync("git", ["-C", root, "diff", "--name-only", base, head], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((f) => f && !/^(work\/|\.claude\/|artifacts\/)/.test(f))
      .sort();
  } catch {}
  const { added, removed } = numstat(root, base, head);
  const sec = securityPaths(root);
  return {
    base,
    head,
    size: sizeClass(changed.length, added + removed),
    changed_files: changed,
    lines_added: added,
    lines_removed: removed,
    frameworks: detectFrameworks(root),
    concerns: detectConcerns(root, changed),
    security_path: changed.some((f) => sec.some((p) => f.startsWith(p))),
  };
}

/**
 * @param {string} id
 * @param {object} [o]
 * @param {string} [o.root]
 * @param {string} [o.base]  commit to diff against; defaults to the work item's recorded base
 */
export function reviewSummary(id, o = {}) {
  const root = o.root ?? projectRoot();
  const s = deriveState(id, root);
  const base = o.base ?? s.base ?? "HEAD";
  const changed = git.changedSince(root, base).filter((f) => !/^(work\/|\.claude\/|artifacts\/)/.test(f));
  const { added, removed } = numstat(root, base);
  const sec = securityPaths(root);
  return {
    work_id: id,
    base,
    size: sizeClass(changed.length, added + removed),
    changed_files: changed,
    lines_added: added,
    lines_removed: removed,
    frameworks: detectFrameworks(root),
    concerns: detectConcerns(root, changed),
    security_path: changed.some((f) => sec.some((p) => f.startsWith(p))),
    phases: s.phase_count,
  };
}
