// Workspace trust for bench repos. Claude Code ignores a project's permissions.allow list until the
// workspace has been trusted once interactively ("Ignoring 24 permissions.allow entries from
// .claude/settings.json: this workspace has not been trusted"). Every bench run so far ran
// untrusted, so the harness's own allow list never applied and only the CLI --allowedTools did.
// The trust flag lives in ~/.claude.json under projects[<repo path>]; we set it before a run and
// remove the entry afterwards so the file does not fill with dead run directories.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FILE = join(homedir(), ".claude.json");

function load() {
  if (!existsSync(FILE)) return null;
  try {
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}

function key(repo) {
  return repo.replaceAll("\\", "/");
}

export function trustWorkspace(repo) {
  const j = load();
  if (!j) return false;
  j.projects ??= {};
  j.projects[key(repo)] = { ...(j.projects[key(repo)] ?? {}), hasTrustDialogAccepted: true };
  writeFileSync(FILE, JSON.stringify(j, null, 2));
  return true;
}

/** Drops this run's entry, plus any earlier bench entry whose directory no longer exists. */
export function untrustWorkspace(repo) {
  const j = load();
  if (!j?.projects) return 0;
  let removed = 0;
  for (const k of Object.keys(j.projects)) {
    if (k === key(repo) || (/\/bench\/\.runs\//.test(k) && !existsSync(k))) {
      delete j.projects[k];
      removed++;
    }
  }
  if (removed) writeFileSync(FILE, JSON.stringify(j, null, 2));
  return removed;
}
