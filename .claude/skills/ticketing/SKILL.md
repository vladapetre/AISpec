---
name: ticketing
description: >
  Pull, create, and update tickets on external work-tracking platforms via their MCP
  servers, and draft well-structured items (user story, change request, bug, technical
  debt, spike, epic) from raw specialist input. Routes per provider to template files under
  `.claude/skills/ticketing/templates/<provider>/`. Focused on Jira today, extensible
  to other providers. Use this skill whenever the user wants to create, draft, write,
  pull, fetch, or update a ticket, story, bug, task, epic, spike, change request, or
  technical-debt item — even casual phrasings like "write a ticket", "log a bug",
  "make a Jira item", "pull JIRA-123", or "update that story". Always use this skill
  when the user mentions Jira, tickets, backlog items, issues, or sprint work. Invoke
  standalone via `/ticketing`.
---

# Skill: ticketing

Central registry for ticket templates and the provider routing that maps a work-tracking platform to its MCP tools. The skill drafts a structured item from raw input, then optionally pulls / creates / updates it on the live platform.

**Shape:** linear. Standalone via `/ticketing`.

---

## User input

```text
$ARGUMENTS
```

Treat the user input above as the source of truth. If empty, present the item types (below) and ask what to create, pull, or update before continuing.

---

## Provider registry

Each provider owns a template directory and a set of MCP tools. Resolve the provider first, then route to that provider's templates and tools. Jira is the default when no provider is named.

| Provider | Status   | Templates           | MCP namespace       | Server in `.mcp.json` |
|----------|----------|---------------------|---------------------|-----------------------|
| Jira     | active   | `templates/jira/`   | `mcp__atlassian__*` | `atlassian`           |
| Linear   | future   | `templates/linear/` | `mcp__linear__*`    | not configured        |
| Asana    | future   | `templates/asana/`  | `mcp__asana__*`     | not configured        |
| Notion   | future   | `templates/notion/` | `mcp__notion__*`    | not configured        |

**Adding a provider:** register the provider's MCP server in the project's `.mcp.json` (its server name *is* the namespace — a server named `atlassian` yields `mcp__atlassian__*`), create `templates/<provider>/` with one file per item type (mirror the canonical item set below), add a row here, and add a provider operations block under **Provider operations**. No change to the steps is needed — routing is table-driven. Tools still have to be granted on each agent that needs them (see **Provider operations**).

Only Jira ships templates today. If the user names a `future` provider, say its templates are not authored yet and offer to draft against the Jira structure or scaffold the new provider directory.

---

## Item-type registry

Item types are provider-agnostic. Each maps to a template file `templates/<provider>/<item>.md` and to a provider-native issue type (resolved in **Provider operations**).

Use the **first** matching flag. If none is given, infer from content — "it's broken" / "crash" / "null ref" → `bug`; "we should refactor" / "tech debt" / "cleanup" → `tech-debt`; "investigate" / "decide between" → `spike`; "this spans several sprints" / "umbrella for" / a request that only decomposes into multiple shippable items → `epic`. If still ambiguous, present this list and ask.

| Flag       | Item              | Template file       | Specialist voice                 |
|------------|-------------------|---------------------|----------------------------------|
| `--story`  | User Story        | `user-story.md`     | Stakeholder / Product Manager    |
| `--change` | Change Request    | `change-request.md` | Business Analyst / Domain Expert |
| `--bug`    | Bug / Defect      | `bug.md`            | QA Engineer / Developer          |
| `--debt`   | Technical Debt    | `tech-debt.md`      | Principal Engineer / Architect   |
| `--spike`  | Analysis (SPIKE)  | `spike.md`          | Architect / Tech Lead            |
| `--epic`   | Epic              | `epic.md`           | Product Manager / Programme Lead |

Read the template (mandatory structure) before writing. A worked example per item lives at `examples/<provider>/<item>.md` — read it only if uncertain about tone or section depth after reading the template.

---

## Operation flags

| Flag       | Operation | Effect                                                                       |
|------------|-----------|------------------------------------------------------------------------------|
| (none)     | draft     | Generate the structured Markdown item from input. Default.                   |
| `--pull`   | pull      | Fetch one or more existing items from the platform and render them.          |
| `--create` | create    | Draft, then create the item on the platform via MCP.                         |
| `--update` | update    | Apply changes to an existing item on the platform via MCP.                   |

Strip all flags from the input before treating the remainder as the item description, ticket key, or query. The platform is the system of record — drafts that aren't created live only in the reply; there is no local file artifact.

---

## Your task (draft / create)

You are a **senior Product Owner** with deep cross-domain experience. You receive raw input from a specialist — architect, QA, tech lead, developer, or stakeholder — and translate it into a precise, complete, actionable item. You are thorough; you surface ambiguity explicitly rather than papering over it.

1. **Understand the intent** — what outcome does the business need?
2. **Structure the work** — what exactly must be built or fixed to call this done?
3. **Define the contract** — write acceptance criteria so unambiguous QA can test them without a follow-up question.
4. **Name the constraints** — what is explicitly out of scope, what are the dependencies, what could go wrong?
5. **Justify the priority** — for tech debt and spikes especially, state the risk of NOT doing the work.

At the top of every item, name the source: `> _Input provided by: **[role]** — [one sentence on their perspective and what they handed you]_`

### Output rules

- Output is **pure Markdown** — no preamble, no "Here is your ticket:", no trailing meta-commentary.
- Follow the section structure of the resolved template exactly — invent no sections, omit none required.
- **Summary line**: ≤ 255 chars, following the template's naming convention for the item type.
- **Acceptance Criteria**: explicit checkboxes (`- [ ]`) in Given/When/Then style or precise testable assertions — never vague ("the feature works correctly" is forbidden).
- **Definition of Done**: a standard checklist plus item-specific additions — never omit.
- Missing required information → write `> ⚠️ REQUIRES INPUT: [what is needed and from whom]` — never guess, never fabricate.
- **Priority**: one of `Critical / High / Medium / Low` with a one-sentence justification.

### Self-check before presenting

- [ ] Summary ≤ 255 chars and follows the item's naming convention
- [ ] Description gives a non-engineer enough context to understand why the work exists
- [ ] Every acceptance criterion is independently testable
- [ ] Out of Scope section present and non-empty
- [ ] Definition of Done present with ≥ 4 items
- [ ] Priority present with justification
- [ ] `REQUIRES INPUT` markers wherever input was insufficient — nothing fabricated

---

## Provider operations

Per-provider MCP wiring for `pull`, `create`, and `update`. Surface any mutating action (create, update, transition, comment) for confirmation before calling — confirm the target project/key with the user when ambiguous.

**Tools are granted on the agent, not here.** A skill cannot grant MCP tools — a named teammate can only call tools in its own `tools:` frontmatter, and a loaded skill can narrow that set but never widen it. The lists below are the *wiring contract*: to enable a provider for an agent, add these tools to that agent's `tools:` field. Standalone `/ticketing` runs in the main session, which already reaches these tools.

### Jira

**Required agent tools** — primary tools, called directly: `mcp__atlassian__getAccessibleAtlassianResources`, `getJiraIssue`, `searchJiraIssuesUsingJql` · mutating primary tools (surface for confirmation): `createJiraIssue`, `editJiraIssue`, `transitionJiraIssue`, `addOrEditJiraIssueComment` · catalog access: `discover`, `executeRead`, `executeWrite`. (All under the `mcp__atlassian__` namespace. `executeDestructive` is deliberately **not** granted: no ticketing operation deletes.)

**Two layers, and the second one bites.** The server exposes about 20 primary tools directly and keeps roughly 220 more in a searchable catalog, reached through `discover` plus an execute-family tool matched to the operation's risk tier: `executeRead` for lookups, `executeWrite` for creates and updates. Six operations this skill needs are catalog-only, so each is called as `executeRead({ name, cloudId, inputs })` rather than as a tool of its own:

| Operation | Tier | Purpose |
|-----------|------|---------|
| `listJiraProjects` | `executeRead` | projects visible to the user |
| `listJiraProjectIssueTypesMetadata` | `executeRead` | issue types available in a project |
| `listJiraIssueTransitions` | `executeRead` | available workflow transitions for an issue |
| `listJiraIssueComments` | `executeRead` | an issue's comment thread (Pull step 2) |
| `listJiraIssueLinkTypes` | `executeRead` | valid link type names: Blocks, Relates, Duplicates |
| `createJiraIssueLink` | `executeWrite` | link two issues (mutating: confirm first) |

Three rules the server enforces. `cloudId` is a **top-level** argument on every execute-family call, a sibling of `name` and `inputs`, never inside `inputs`. Never invent an operation name: use one from this table, one already in the tool list, or call `discover` first. And responses default to a compact view that **omits custom fields**, so to read or verify story points pass `view: "evidence"` or name the site's `customfield_*` ID explicitly, because those IDs differ per site.

Item-type → Jira issue type:

| Item            | Jira issue type |
|-----------------|-----------------|
| User Story      | `Story`         |
| Change Request  | `Story`         |
| Bug / Defect    | `Bug`           |
| Technical Debt  | `Task`          |
| Analysis (SPIKE)| `Task`          |
| Epic            | `Epic`          |

**Pull** (`--pull`):
1. By key (e.g. `PROJ-123`) → `mcp__atlassian__getJiraIssue`. By query → `mcp__atlassian__searchJiraIssuesUsingJql`.
2. **Fetch the comments too** — `executeRead` with `name: "listJiraIssueComments"`. `getJiraIssue` reports only *how many* comments an issue has, never their text, and the comment thread is where scope decisions, open questions and blockers actually live. Pulling the issue alone and calling it context is how a ticket gets re-litigated.
3. Before drafting or analysing anything, state what was loaded: issue key, type, status, assignee, comment count, and any thread carrying an open question or a scope change.
4. Render the fetched item; map fields back onto the matching template structure where useful.

**Create** (`--create`):
1. `mcp__atlassian__getAccessibleAtlassianResources` to resolve the cloud id (if not already known).
2. `executeRead` with `name: "listJiraProjects"` to list projects; if the project is ambiguous, ask the user to confirm the project key.
3. Map the item type to the Jira issue type above. Verifying it exists in the project is optional: `createJiraIssue` returns the required fields and their allowed values when it rejects a create, so retry from that rather than pre-fetching. When you do want to check up front, `executeRead` with `name: "listJiraProjectIssueTypesMetadata"`.
4. `mcp__atlassian__createJiraIssue` with summary and description. Custom fields (story points and the like) go in `additional_fields`, keyed by field name or `customfield_*` ID; values resolve automatically, so no field lookup is needed first.
5. Report the created issue key and URL.

**Update** (`--update`):
1. Resolve the target key (ask if not given).
2. Field edits → `mcp__atlassian__editJiraIssue` (clear a field with an explicit `null`). Status change → `executeRead` with `name: "listJiraIssueTransitions"`, then `mcp__atlassian__transitionJiraIssue`. A note → `mcp__atlassian__addOrEditJiraIssueComment` (omit `commentId` to add, pass it to edit; the body takes markdown and the server converts it to ADF).
3. Report what changed and the issue URL.

---

## Steps (standalone invocation)

When invoked as `/ticketing`:

1. Empty input → present item types and ask what to create, pull, or update. Stop.
2. Parse flags: resolve **provider** (default Jira), **item type**, and **operation**.
3. For `pull` → run the provider's Pull operation and render the result. Done.
4. For `draft` / `create` / `update` → read `templates/<provider>/<item>.md`; read the example only if tone is unclear.
5. Write the item using that template; run the self-check.
6. If `--create` / `--update` → run the provider operation (surface the mutating call for confirmation first).
7. Report: what was produced, any created/updated key + URL. A pure draft (no `--create`) lives in the reply only.

---

## Bundled resources

```
.claude/skills/ticketing/
  SKILL.md                       this file
  templates/<provider>/<item>.md mandatory structure per item type (read on demand)
  examples/<provider>/<item>.md  worked output sample per item (read only if tone unclear)
```
