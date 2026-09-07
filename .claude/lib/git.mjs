// Read-only git helpers. Every function returns data, never throws on a missing repo.
import { execFileSync } from "node:child_process";

function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function isRepo(root) {
  return git(root, ["rev-parse", "--is-inside-work-tree"]) === "true";
}

export function branch(root) {
  return git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function head(root) {
  return git(root, ["rev-parse", "--short", "HEAD"]);
}

/** Uncommitted paths outside the given prefixes (work/ and .claude/ are the harness's own noise). */
export function dirtyPaths(root, ignorePrefixes = ["work/", ".claude/"]) {
  const out = git(root, ["status", "--porcelain", "--untracked-files=all"]);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.slice(3).trim().replace(/^"|"$/g, ""))
    .filter((p) => !ignorePrefixes.some((pre) => p.startsWith(pre)));
}

/** Paths changed since a commit, working tree included, plus untracked files. */
export function changedSince(root, base) {
  const diffed = git(root, ["diff", "--name-only", base]) ?? "";
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]) ?? "";
  return [...new Set([...diffed.split(/\r?\n/), ...untracked.split(/\r?\n/)].map((s) => s.trim()).filter(Boolean))].sort();
}

export function linesAddedSince(root, base, exclude = [/^work\//, /^\.claude\//, /^artifacts\//]) {
  const out = git(root, ["diff", "--numstat", base]) ?? "";
  let added = 0;
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\t(\d+)\t(.+)$/);
    if (m && !exclude.some((re) => re.test(m[3]))) added += Number(m[1]);
  }
  return added;
}

export function log1(root) {
  return git(root, ["log", "-1", "--format=%h %s"]);
}
