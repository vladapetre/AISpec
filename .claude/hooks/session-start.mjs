#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const raw = readFileSync(0, "utf8");
const data = JSON.parse(raw);
const cwd = data.cwd ?? process.cwd();
const sessionId = process.env.CLAUDE_CODE_SESSION_ID ?? "";
if (!sessionId) process.exit(0);

const mapDir = join(cwd, "artifacts/sessions/.map");
const mapFile = join(mapDir, sessionId);
if (existsSync(mapFile)) process.exit(0);

const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const started = now.toISOString().replace(/\.\d{3}Z$/, "Z");
const sessionUuid = randomUUID();
const relPath = `${dateStr}/${sessionUuid}`;
const sessionDir = join(cwd, "artifacts/sessions", relPath);

mkdirSync(sessionDir, { recursive: true });
mkdirSync(mapDir, { recursive: true });

const prompt = (data.prompt ?? "").trim().split(/\s+/).join(" ");
const goal = prompt.length > 200 ? prompt.slice(0, 197) + "..." : (prompt || "—");

const templatePath = join(cwd, ".claude/skills/auditing/templates/session.md");
if (!existsSync(templatePath)) process.exit(0);

let content = readFileSync(templatePath, "utf8");
content = content
  .replaceAll("{DATE}", dateStr)
  .replaceAll("{UUID}", sessionUuid)
  .replaceAll("{STARTED}", started)
  .replaceAll("{GOAL}", goal);

writeFileSync(join(sessionDir, "session.md"), content);
writeFileSync(mapFile, relPath);
