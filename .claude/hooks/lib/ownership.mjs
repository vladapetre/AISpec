// The ownership registry — one copy of the rules that CLAUDE.md
// ## Artifact Ownership and ## Agent memory layout state in prose.
//
// Shared by guard.write.mjs (blocks the write as it happens) and lint.write.mjs
// (`--all` sweeps what already landed). Before this file each had its own copy of
// the registered-directory list and the memory-kind pattern, which is exactly the
// drift the reference harness demonstrates: it argues in one command file that a
// duplicated charter "silently stops catching a class of defect", and its own e2e
// command block had drifted across four files anyway. One copy, two callers.
//
// A new artifact kind gets a row in CLAUDE.md ## Artifact Ownership first, then an
// entry here — in that order, so the table stays the source of truth.

export const REGISTERED_ARTIFACT_DIRS = ["reports", "api", "inbound", "strategy", "adr", "plans", "sql"];

// Per-entity memory files plus the two fixed names. The hyphen is required: it is
// what separates the kind from the short-title, so `review_00030_x.md` is not a
// registered kind (found live: 113 such files against 22 correctly-named ones).
export const MEMORY_KIND_RE = /^(plan|adr|report|review|sdr|charter|context-map)-[^/]+\.md$/;
export const MEMORY_FIXED_NAMES = ["MEMORY.md", "lessons.md"];

// A repo-relative path under artifacts/ — returns a deny reason, or null if legal.
export function checkArtifactPath(rel) {
  if (!rel.startsWith("artifacts/")) return null;
  const m = /^artifacts\/([^/]+)\//.exec(rel);
  if (!m) return "files directly under artifacts/ are unregistered; write into a registered subdirectory";
  if (!REGISTERED_ARTIFACT_DIRS.includes(m[1]))
    return `artifacts/${m[1]}/ is not in the CLAUDE.md ownership table — a new artifact kind gets a row there first`;
  return null;
}

// A repo-relative path under .claude/agent-memory/<agent>/ — deny reason or null.
export function checkMemoryPath(rel) {
  const am = /^\.claude\/agent-memory\/[^/]+\/(.+)$/.exec(rel);
  if (!am) return null;
  const name = am[1];
  if (MEMORY_FIXED_NAMES.includes(name)) return null;
  if (MEMORY_KIND_RE.test(name)) return null;
  return (
    "unregistered agent-memory file kind (allowed: MEMORY.md, lessons.md, " +
    "plan-*/adr-*/report-*/review-*/sdr-*/charter-*/context-map-*.md; no subdirectories)"
  );
}
