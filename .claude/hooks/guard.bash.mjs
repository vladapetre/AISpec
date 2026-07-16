#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook for the Bash tool.
 *
 * Goal: replace giant string-prefix allowlists with real evaluation of the
 * command, so that:
 *   - compound commands (a && b, a | b, a ; b) are checked per sub-command
 *   - quoted strings containing ; or | etc. are NOT mistaken for chaining
 *   - command substitution ($(...), `...`), eval, xargs->sh -c, and other
 *     "commands hidden inside commands" are treated as needing a real
 *     prompt instead of being silently allowed or silently trusted
 *
 * This is intentionally conservative: anything it isn't confident about
 * falls through to Claude Code's normal permission prompt (exit code 0,
 * no decision). It only actively ALLOWS things it recognizes as safe,
 * and only actively DENIES things it recognizes as destructive.
 *
 * Wire it up in settings.json:
 *   "hooks": {
 *     "PreToolUse": [
 *       { "matcher": "Bash",
 *         "hooks": [{ "type": "command", "command": "node .claude/hooks/guard.bash.mjs" }] }
 *     ]
 *   }
 *
 * Requires the "shell-quote" npm package (npm install shell-quote).
 *
 * NOTE: the exact PreToolUse hook I/O contract (field names like
 * hookSpecificOutput / permissionDecision) has been iterated on by
 * Anthropic. Verify this still matches the current docs before relying
 * on it in a real workflow: https://docs.claude.com/en/docs/claude-code/hooks
 */

import { readFileSync } from "fs";
import { join } from "path";

// shell-quote is loaded dynamically so a missing node_modules (fresh clone)
// degrades to fall-through — the normal permission prompt — instead of the
// hook erroring on every Bash call. Fail open, never brick the session.
let parse;
try {
  ({ parse } = await import("shell-quote"));
} catch {
  process.exit(0);
}

// ---------------------------------------------------------------------
// Configuration - tune this to your project.
// ---------------------------------------------------------------------

// Command roots that are always safe to auto-approve, regardless of args,
// as long as they appear as a stand-alone segment (not fed through a
// meta-command like xargs/eval/sh -c).
const SAFE_ROOTS = new Set([
  "cd", "pwd", "ls", "dir", "cat", "head", "tail", "wc", "tree", "stat",
  "file", "diff", "echo", "printf", "find", "grep", "rg", "which",
  "Get-ChildItem", "Select-String", "Select-Object", "Sort-Object",
  "Measure-Object",
  // JS/TS project tooling - local dev binaries invoked directly.
  // These lint/typecheck/build/test using project config; they don't
  // touch the network or publish anything by themselves.
  "tsc", "eslint", "prettier", "jest", "vitest", "mocha", "cypress",
  "webpack", "rollup", "esbuild", "vite", "next", "react-scripts",
  "babel", "playwright",
]);

// git subcommands considered read-only / inspection.
const SAFE_GIT_SUBCOMMANDS = new Set([
  "status", "log", "diff", "show", "blame", "branch", "remote", "tag",
  "ls-files", "ls-tree", "rev-parse", "describe", "shortlog", "reflog",
  "stash", // "git stash list" is safe; "git stash drop/pop" is not - handled below
  "config",
]);

// git subcommands that are destructive / state-changing - always deny.
const DENY_GIT_SUBCOMMANDS = new Set([
  "push", "reset", "rebase", "checkout", "merge", "clean", "branch",
  // note: "branch" appears in both lists deliberately - see checkGit()
]);

// Non-git command roots that are always destructive - always deny.
const DENY_ROOTS = new Set([
  "sudo", "rm", "rmdir", "chmod", "chown", "chgrp", "dd", "mkfs",
  "shutdown", "reboot", "kill", "killall", "del", "erase",
  "Remove-Item", "ri",
]);

// Roots that execute another command supplied as an argument/string.
// These are the classic ways to smuggle an unsafe action past a naive
// prefix-matcher (xargs ... sh -c "...", eval "...", find -exec, etc).
// We do NOT try to recursively parse what's inside - we just refuse to
// auto-allow them, so a human sees the real command.
const META_ROOTS = new Set([
  "xargs", "eval", "sh", "bash", "zsh", "ksh", "dash", "env", "nohup",
  "timeout", "watch", "perl", "python", "python3", "node", "ruby",
  "powershell", "powershell.exe", "cmd", "cmd.exe", "pwsh",
  // JS runtimes/executors that run arbitrary code by design.
  "npx", "ts-node", "tsx", "deno", "bun",
]);

// Redirection operators that write to disk - never auto-allow these,
// since "cat foo" is safe but "cat foo > important_file" is not.
const WRITE_REDIRECT_OPS = new Set([">", ">>", "&>", "&>>"]);

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function readStdin() {
  const chunks = [];
  return new Promise((resolve) => {
    process.stdin.on("data", (d) => chunks.push(d));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function decide(decision, reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision, // "allow" | "deny"
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function fallThrough() {
  // No decision emitted -> Claude Code applies its normal permission
  // rules / prompts the user as usual.
  process.exit(0);
}

/**
 * Raw-text pre-checks for constructs shell-quote doesn't turn into a
 * clean operator we can reason about (command substitution, process
 * substitution). These are exactly the kind of thing that let an
 * "innocent" looking command smuggle something dangerous.
 */
function hasHiddenExecution(rawCommand) {
  return (
    /\$\(/.test(rawCommand) || // $(...)
    /`/.test(rawCommand) ||    // `...`
    /<\(/.test(rawCommand) ||  // <(...)
    />\(/.test(rawCommand)     // >(...)
  );
}

/**
 * Split a shell-quote token stream into segments at chaining/piping
 * operators. Subshell grouping parens are dropped (treated as
 * transparent) rather than fully modeled - good enough to stop
 * `(cd /tmp && rm -rf *)` from being misread as one opaque blob, while
 * staying simple.
 */
function splitIntoSegments(tokens) {
  const CHAIN_OPS = new Set(["&&", "||", ";", "|"]);
  const segments = [];
  let current = [];
  let sawWriteRedirect = false;
  let sawBackground = false;

  for (const tok of tokens) {
    if (typeof tok === "object" && tok.op) {
      if (tok.op === "(" || tok.op === ")") {
        continue; // transparent grouping
      }
      if (tok.op === "&") {
        // backgrounding a process - deserves a human look, not silent allow
        sawBackground = true;
        if (current.length) segments.push(current);
        current = [];
        continue;
      }
      if (WRITE_REDIRECT_OPS.has(tok.op)) {
        sawWriteRedirect = true;
        continue;
      }
      if (CHAIN_OPS.has(tok.op)) {
        if (current.length) segments.push(current);
        current = [];
        continue;
      }
      // glob or other op we don't specifically handle - ignore
      continue;
    }
    current.push(tok);
  }
  if (current.length) segments.push(current);
  return { segments, sawWriteRedirect, sawBackground };
}

function checkGit(tokens) {
  const sub = tokens[1];
  if (sub === "stash") {
    const action = tokens[2];
    if (action === "list") return "safe";
    // Bare "git stash" IS "git stash push" — a working-tree mutation — and
    // push/pop/drop/clear all mutate. "unknown" (prompt), NOT "deny": the
    // developer agent's sanctioned pre-existing-failure stash dance
    // (git stash --include-untracked && <test> && git stash pop) must stay
    // approvable by the user / settings rather than hard-blocked here.
    return "unknown";
  }
  if (sub === "branch") {
    // "-d/-D/-m/-M" = delete/move → deny. A positional arg with no flag
    // ("git branch foo") CREATES a branch → mutation → prompt. Only bare
    // "git branch" / flag-only inspection forms ("--list", "-a", "-v") are safe.
    const hasDeleteOrMove = tokens.some(
      (t) => typeof t === "string" && /^-[a-zA-Z]*[DdMm]/.test(t)
    );
    if (hasDeleteOrMove) return "deny";
    const hasPositionalArg = tokens
      .slice(2)
      .some((t) => typeof t === "string" && !t.startsWith("-"));
    return hasPositionalArg ? "unknown" : "safe";
  }
  if (sub === "config") {
    const hasWriteFlag = tokens.some(
      (t) => t === "--global" || t === "--unset" || t === "--add"
    );
    // "git config --get" / "--list" are read-only; bare "git config x y"
    // sets a value - be conservative and only allow clear read patterns.
    const looksReadOnly = tokens.some((t) => t === "--get" || t === "--list");
    return looksReadOnly && !hasWriteFlag ? "safe" : "deny";
  }
  if (DENY_GIT_SUBCOMMANDS.has(sub)) return "deny";
  if (SAFE_GIT_SUBCOMMANDS.has(sub)) return "safe";
  return "unknown";
}

/**
 * dotnet CLI.
 *
 * Safe: build / test / restore / clean / list / sln list / --version /
 *       --info / --list-sdks / --list-runtimes / nuget (read-only ops).
 * Unknown (falls through to a prompt): run / watch (executes your
 *       project's own code - could do anything the app can do), publish,
 *       pack, add / remove / new / sln add|remove (mutate project files
 *       or restructure the solution), tool install/uninstall/update,
 *       format without --verify-no-changes (rewrites source files).
 * Deny: nuget push / nuget delete (publishes/removes a package remotely).
 */
function checkDotnet(tokens) {
  const sub = tokens[1];

  if (sub === "nuget") {
    const action = tokens[2];
    if (action === "push" || action === "delete") return "deny";
    return "safe"; // locals, list, etc.
  }

  if (sub === "format") {
    const verifyOnly = tokens.some((t) => t === "--verify-no-changes");
    return verifyOnly ? "safe" : "unknown"; // otherwise it rewrites files
  }

  if (sub === "sln") {
    const action = tokens[2];
    return action === "list" ? "safe" : "unknown"; // add/remove mutate
  }

  if (sub === "tool") {
    const action = tokens[2];
    if (["install", "uninstall", "update"].includes(action)) return "unknown";
    return "safe"; // "dotnet tool list"
  }

  const SAFE_SUB = new Set([
    "build", "test", "restore", "clean", "list",
    "--version", "--info", "--list-sdks", "--list-runtimes",
  ]);
  if (SAFE_SUB.has(sub)) return "safe";

  // run, watch, publish, pack, add, remove, new, and anything unrecognized
  // execute arbitrary project code or mutate the project - don't guess.
  return "unknown";
}

/**
 * Read package.json in the working directory (best-effort) and return
 * the raw string for scripts[name], or null if unavailable.
 */
function readPackageScript(scriptName, cwd) {
  try {
    const raw = readFileSync(join(cwd, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    return pkg?.scripts?.[scriptName] ?? null;
  } catch {
    return null; // no package.json, unreadable, or no such script
  }
}

/**
 * Resolve what "npm run <script>" (or its aliases) actually executes by
 * reading package.json, then recursively classify THAT command instead
 * of trusting the script name. Falls back to "unknown" if we can't read
 * or fully resolve it - never silently trusts a script we can't see.
 */
function resolvePackageScript(scriptName, cwd, depth = 0) {
  if (!scriptName || depth > 3) return "unknown"; // guard against cycles
  const scriptBody = readPackageScript(scriptName, cwd);
  if (!scriptBody) return "unknown";

  let innerTokens;
  try {
    innerTokens = parse(scriptBody);
  } catch {
    return "unknown";
  }
  if (hasHiddenExecution(scriptBody)) return "unknown";

  const { segments, sawWriteRedirect, sawBackground } = splitIntoSegments(innerTokens);
  if (!segments.length) return "unknown";
  if (sawWriteRedirect || sawBackground) return "unknown";

  const results = segments.map((seg) => classifySegment(seg, cwd, depth + 1));
  if (results.includes("deny")) return "deny";
  if (results.every((r) => r === "safe")) return "safe";
  return "unknown";
}

/**
 * npm / yarn / pnpm.
 *
 * Safe: list / outdated / view / why / audit (report only) /
 *       config get|list (read-only local ops).
 * Deny: publish / unpublish / deprecate / owner / adduser / login /
 *       logout / token (touches the remote registry or credentials).
 * Unknown: install / ci / pack (write node_modules/lockfile/tarball and
 *       run lifecycle scripts), exec / dlx / link / npx-equivalents
 *       (run arbitrary binaries), audit fix, config set, and
 *       "run <script>" / "test" / "start" / "build" - UNLESS
 *       package.json resolution shows the underlying command is
 *       itself fully safe.
 */
function checkNpmFamily(tokens, cwd) {
  const sub = tokens[1];

  const DENY_SUB = new Set([
    "publish", "unpublish", "deprecate", "owner", "adduser",
    "login", "logout", "token",
  ]);
  if (DENY_SUB.has(sub)) return "deny";

  if (sub === "audit") {
    return tokens[2] === "fix" ? "unknown" : "safe";
  }

  if (sub === "config") {
    return ["get", "list", "ls"].includes(tokens[2]) ? "safe" : "unknown";
  }

  const READ_SAFE_SUB = new Set([
    "list", "ls", "outdated", "view", "why", "--version", "-v",
  ]);
  if (READ_SAFE_SUB.has(sub)) return "safe";

  // install/ci write node_modules + lockfile AND run arbitrary lifecycle
  // scripts (postinstall) — an execution vector, not a read. pack writes a
  // tarball. All deserve the normal prompt, not a silent allow.
  if (["install", "i", "ci", "pack"].includes(sub)) return "unknown";

  if (["exec", "dlx", "link"].includes(sub)) return "unknown"; // arbitrary binaries

  const SCRIPT_ALIASES = new Set(["run", "run-script", "test", "start", "build"]);
  if (SCRIPT_ALIASES.has(sub)) {
    const scriptName = sub === "run" || sub === "run-script" ? tokens[2] : sub;
    return resolvePackageScript(scriptName, cwd);
  }

  // Bare "yarn <script>" (yarn allows omitting "run").
  if (sub !== undefined) {
    return resolvePackageScript(sub, cwd);
  }

  return "unknown";
}

/**
 * Classify a single command segment (array of plain string tokens,
 * operators already stripped out by splitIntoSegments).
 * Returns one of: "safe" | "deny" | "unknown"
 */
function classifySegment(tokens, cwd = process.cwd(), depth = 0) {
  if (!tokens.length) return "unknown";
  const root = tokens[0];

  if (root === "git") return checkGit(tokens);
  if (root === "dotnet") return checkDotnet(tokens);
  if (["npm", "yarn", "pnpm"].includes(root)) return checkNpmFamily(tokens, cwd);

  if (DENY_ROOTS.has(root)) return "deny";
  if (META_ROOTS.has(root)) return "unknown"; // never silently allow these

  if (root === "find") {
    // find -exec / -execdir / -ok / -okdir run an arbitrary command per
    // result, and -delete destroys matches directly - all three make
    // "find" behave like a meta-command wearing a safe command's face.
    const isDestructive = tokens.some(
      (t) => typeof t === "string" && /^-(exec|execdir|ok|okdir|delete)$/.test(t)
    );
    return isDestructive ? "unknown" : "safe";
  }

  if (SAFE_ROOTS.has(root)) return "safe";

  return "unknown";
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return fallThrough();
  }

  const rawCommand = input?.tool_input?.command;
  if (typeof rawCommand !== "string" || !rawCommand.trim()) {
    return fallThrough();
  }

  // Claude Code's hook payload typically includes the session's working
  // directory - use it so package.json resolution looks in the right
  // place; fall back to this process's cwd if it's absent.
  const cwd = typeof input?.cwd === "string" ? input.cwd : process.cwd();

  // 1. Anything with command/process substitution is never auto-allowed.
  //    (We still let deny-patterns inside it be caught below if parsing
  //    succeeds, but we never auto-approve.)
  const hiddenExecution = hasHiddenExecution(rawCommand);

  let tokens;
  try {
    tokens = parse(rawCommand);
  } catch {
    // Unparsable -> don't guess, let the normal prompt handle it.
    return fallThrough();
  }

  const { segments, sawWriteRedirect, sawBackground } = splitIntoSegments(tokens);

  if (!segments.length) return fallThrough();

  const classifications = segments.map((seg) => classifySegment(seg, cwd));

  if (classifications.includes("deny")) {
    return decide(
      "deny",
      "guard.bash: command contains a destructive sub-command (e.g. rm, sudo, git push/reset/rebase/checkout/merge/clean)."
    );
  }

  if (hiddenExecution) {
    return fallThrough(); // let the human see it - could be hiding anything
  }

  if (sawWriteRedirect) {
    return fallThrough(); // writing to disk - worth a human glance
  }

  if (sawBackground) {
    return fallThrough(); // backgrounded process - worth a human glance
  }

  if (classifications.every((c) => c === "safe")) {
    return decide(
      "allow",
      "guard.bash: all sub-commands are read-only/inspection commands with no write redirection or hidden execution."
    );
  }

  // Mixed / unknown segments (including any META_ROOTS like xargs, sh -c,
  // eval, python -c, etc.) - don't guess, fall through to normal prompt.
  return fallThrough();
}

main();
