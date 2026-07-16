#!/usr/bin/env node
// Inject .claude/MEMORY.md contents into session context at session start.
// Mirrors the way the harness loads its auto-memory MEMORY.md so the
// project-local glossary maintained by the `understanding` skill is always
// in context.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(0, "utf8");
const data = JSON.parse(raw);
const cwd = data.cwd ?? process.cwd();
const memoryPath = join(cwd, ".claude", "MEMORY.md");

if (!existsSync(memoryPath)) process.exit(0);

let contents;
try {
  contents = readFileSync(memoryPath, "utf8").trim();
} catch {
  process.exit(0);
}
if (!contents) process.exit(0);

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext:
      "# Project MEMORY (.claude/MEMORY.md)\n\n" +
      "Project-local glossary and decision log maintained by the " +
      "`understanding` skill. Treat as authoritative for terminology " +
      "and recorded decisions.\n\n" +
      contents,
  },
};
process.stdout.write(JSON.stringify(output));
