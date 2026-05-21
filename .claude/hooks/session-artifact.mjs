#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const raw = readFileSync(0, "utf8");
const data = JSON.parse(raw);
if (!["Write", "Edit"].includes(data.tool_name)) process.exit(0);

const filePath = data.tool_input?.file_path ?? "";
const cwd = data.cwd ?? process.cwd();
const rel = relative(cwd, filePath).split("\\").join("/");

if (!rel.startsWith("artifacts/") || rel.startsWith("artifacts/sessions/")) {
  process.exit(0);
}

const sessionId = process.env.CLAUDE_CODE_SESSION_ID ?? "";
if (!sessionId) process.exit(0);

const mapFile = join(cwd, "artifacts/sessions/.map", sessionId);
if (!existsSync(mapFile)) process.exit(0);

const relPath = readFileSync(mapFile, "utf8").trim();
const sessionFile = join(cwd, "artifacts/sessions", relPath, "session.md");
if (!existsSync(sessionFile)) process.exit(0);

const now = new Date();
const timestamp = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}Z`;
const entry = `- ${timestamp} — artifact: ${rel}`;
const content = readFileSync(sessionFile, "utf8")
  .replace("<!-- end-checkpoints -->", `${entry}\n<!-- end-checkpoints -->`);
writeFileSync(sessionFile, content);
