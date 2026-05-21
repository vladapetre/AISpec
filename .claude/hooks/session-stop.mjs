#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(0, "utf8");
const data = JSON.parse(raw);
const cwd = data.cwd ?? process.cwd();
const sessionId = process.env.CLAUDE_CODE_SESSION_ID ?? "";
if (!sessionId) process.exit(0);

const mapFile = join(cwd, "artifacts/sessions/.map", sessionId);
if (!existsSync(mapFile)) process.exit(0);

const relPath = readFileSync(mapFile, "utf8").trim();
const sessionFile = join(cwd, "artifacts/sessions", relPath, "session.md");
if (!existsSync(sessionFile)) process.exit(0);

const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const content = readFileSync(sessionFile, "utf8")
  .replace(/^Last active:.*$/m, `Last active: ${timestamp}`);
writeFileSync(sessionFile, content);
