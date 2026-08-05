#!/usr/bin/env node
// Inject the team lead's orchestration contract into the MAIN session at
// SessionStart. Named teammates never see it: SessionStart is a once-per-session
// event and its additionalContext lands only at the start of the main
// conversation, so the ~5 KB of spawn/routing/workflow rules teammates cannot act
// on (no TeamCreate, Agent, or Workflow tool) stays out of their context.
//
// FAIL LOUD, unlike inject.project-memory.mjs. SessionStart cannot block and its
// stderr is never shown to Claude, so a silent exit(0) on error would leave the
// team lead with ZERO routing rules and no signal. Instead every failure path
// still exits 0 and injects a warning telling the lead to read the file itself
// and report the breakage — the contract degrades to one extra Read rather than
// vanishing.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REL = ".claude/agents/assets/instructions/lead/orchestration.md";

function emit(context) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    }),
  );
}

function fail(reason, path) {
  // stderr is user-visible only on non-zero exit, which would discard stdout —
  // so route the alarm through the model instead and keep exit 0.
  emit(
    `# ORCHESTRATION CONTRACT FAILED TO LOAD\n\n` +
      `\`inject.orchestration.mjs\` could not inject the team lead's orchestration ` +
      `rules: ${reason} (expected at \`${path}\`).\n\n` +
      `You are the team lead and you are currently missing your spawn table, ` +
      `routing rules, relay discipline, and workflow launchers.\n\n` +
      `BEFORE spawning any teammate, routing any verdict token, or launching any ` +
      `workflow: Read \`${REL}\` directly. Tell the user the hook failed and why.`,
  );
  process.exit(0);
}

let cwd = process.cwd();
try {
  const data = JSON.parse(readFileSync(0, "utf8"));
  if (data.cwd) cwd = data.cwd;
} catch {
  // Malformed or absent hook payload — cwd fallback is fine, keep going.
}

const path = join(cwd, REL);

if (!existsSync(path)) fail("file not found", path);

let contents;
try {
  contents = readFileSync(path, "utf8").trim();
} catch (err) {
  fail(`unreadable (${err.code ?? err.message})`, path);
}

if (!contents) fail("file is empty", path);

emit(
  `# Team lead orchestration (${REL})\n\n` +
    `Your own routing contract, injected because named teammates must not carry it. ` +
    `Authoritative for spawning, relaying, and workflow launches. Shared contracts ` +
    `every agent needs stay in CLAUDE.md.\n\n` +
    contents,
);
