#!/usr/bin/env node
// Inject the shared writing rules into every named teammate at SubagentStart.
//
// Why a hook and not an agent-file edit: the output style at
// .claude/output-styles/custom.md is a MAIN-THREAD prompt mode
// (repl_main_thread:outputStyle:custom). Teammates run under separate modes
// (agent:custom:<name>) and never receive it, so without this hook the tone rules
// would stop at the session boundary and only the lead's prose would follow them.
// SubagentStart fires once per spawn and accepts additionalContext, which reaches
// the teammate without touching its agent file, its skills, or CLAUDE.md.
//
// Why it extracts a span instead of injecting the whole style: most of custom.md
// is main-session conversation shape (lead with the answer, pre-send check,
// forbidden openers) that a teammate emitting an <output_format> block cannot act
// on. Only the span between the `shared` markers is writing-quality rules that
// apply equally to artifact prose, so only that span ships. Keeping the markers in
// the style file means one source of truth rather than two copies that drift.
//
// FAIL SILENT, unlike inject.orchestration.mjs. A missing orchestration contract
// leaves the lead unable to route; a missing prose rule costs an em dash. Shouting
// at a teammate about punctuation it cannot fix would burn context and invite it to
// go looking for a file it has no reason to read, so every failure path exits 0
// with no output and the teammate simply writes in its default voice.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./lib/project-root.mjs";

const REL = ".claude/output-styles/custom.md";
const SPAN = /<!-- shared:begin -->([\s\S]*?)<!-- shared:end -->/;

// Teammates whose whole output is contract-shaped tokens and verdict lines gain
// nothing from prose rules. Add a name here to opt one out.
const SKIP = new Set([]);

// HARD exemption, injected AHEAD of the rules. The Stop hooks classify a contract
// block by matching an em dash after its heading (lib/turn-block.mjs BLOCKS, and
// guard.verdict.mjs bounces the turn on a miss), so a teammate that "fixed" one of
// these headings to satisfy rule 1 would have its turn rejected and its telemetry
// row lost. Rule 1 has to arrive with the carve-out already stated, not discover it
// after a bounce. Keep this list in sync with lib/turn-block.mjs BLOCKS and the
// heading regexes in guard.verdict.mjs.
const EXEMPT =
  "## Contract headings keep their em dash (this overrides rule 1)\n\n" +
  "The Stop hooks recognise a contract block by matching an em dash after the " +
  "heading, so rewriting one bounces your turn. In these forms the dash is " +
  "protocol, not punctuation, and you MUST emit it verbatim:\n\n" +
  "```\n" +
  "## Phase N Complete — <title>\n" +
  "## Phase N Stalled — <title>\n" +
  "## All Phases Complete — <title>\n" +
  "## Phase Review — <title>\n" +
  "## Cumulative Review — <title>\n" +
  "## Architect Amendment — <title>\n" +
  "_N/A — CODE_DRIFT_\n" +
  "```\n\n" +
  "The same holds for every other line your `<output_format>` fixes verbatim, and " +
  "for verdict tokens: reproduce them exactly, then apply the rules below to the " +
  "prose around them.\n\n";

function quit() {
  process.exit(0);
}

let data = {};
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  quit();
}

if (data.agent_type && SKIP.has(data.agent_type)) quit();

const path = join(projectRoot(data), REL);
if (!existsSync(path)) quit();

let rules;
try {
  rules = SPAN.exec(readFileSync(path, "utf8"))?.[1]?.trim();
} catch {
  quit();
}
if (!rules) quit();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SubagentStart",
      additionalContext:
        `# Writing rules (${REL}, shared span)\n\n` +
        `How your prose reads. These change nothing about WHAT you do: your agent ` +
        `contract, pre-flight, modes, skills, and templates are unaffected. They ` +
        `apply to the prose you write into artifacts and into your output block, ` +
        `never to quoted material, diffs, command output, code, paths, or ` +
        `identifiers.\n\n` +
        EXEMPT +
        rules,
    },
  }),
);
