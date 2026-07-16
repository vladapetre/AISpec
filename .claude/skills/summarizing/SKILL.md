---
name: summarizing
description: >
  Summarize the session's work into the repository's pull-request template,
  hard-capped at 4000 characters, delivered as copy-paste-ready markdown. Finds
  the PR template in the working repo — or, in an umbrella repository, in each
  touched sub-repo — fills it from the feature branch's commits plus the
  session's plan/ADR artifacts, ticks applicable checklist items, and verifies
  the character count mechanically before delivering. Use when the user says
  "summarize this session", "write the PR description", "fill in the PR
  template", "prep the pull request", or invokes `/summarizing`.
---

# Skill: summarizing

Turns a session's work into a pipeline-ready PR description: template-shaped, evidence-based, ≤4000 characters (hard limit — the pipeline software rejects longer bodies).

**Shape:** linear. Standalone via `/summarizing [branch or repo hint]`.

---

## User input

```text
$ARGUMENTS
```

Optional: a branch name, sub-repo path, or plan reference to scope the summary. Empty → scope from the current session (see step 2).

---

## Repository resolution (umbrella-aware)

1. `.claude/branching/manifest.yaml` exists → umbrella. Candidate repos = manifest entries; keep those whose feature branch/worktree the session touched (worktree paths recorded in the developer's per-plan progress file, or `git -C <repo> worktree list`).
2. No manifest → probe once: ≥2 nested git repos under `src/` → umbrella (scan those); otherwise single repo (the project root).
3. **One summary per touched repo** — a PR is per-repo. Multiple touched repos → produce one filled template per repo, each independently ≤4000 chars, clearly labelled.

## Template discovery (per repo, first match wins)

| Order | Location |
|---|---|
| 1 | `.azuredevops/pull_request_template.md` (any case) |
| 2 | `.azuredevops/pull_request_template/*.md` — multiple → use `default.md`, else ask which |
| 3 | `.github/PULL_REQUEST_TEMPLATE.md` / `.github/pull_request_template.md` |
| 4 | `.github/PULL_REQUEST_TEMPLATE/*.md` — multiple → use `default.md`, else ask which |
| 5 | `PULL_REQUEST_TEMPLATE.md` / `pull_request_template.md` at repo root or under `docs/` |
| 6 | None found → use the fallback skeleton: `## Summary`, `## Changes`, `## Testing & Verification`, `## Risks / Rollback`, and note "no PR template found — used fallback structure" |

Template handling rules:
- **Keep every heading and required checklist item** — the template is the pipeline's contract. Tick (`- [x]`) items the session's evidence actually satisfies; leave the rest unticked; never delete or invent checklist items.
- **Strip HTML guidance comments** (`<!-- … -->`) — they are instructions to the author, and they eat the character budget.
- Placeholder tokens (`{ticket}`, `[JIRA-ID]`, …) → fill from the plan/ADR/branch name (RC-#### style keys are usually in the branch or plan title); unresolvable → leave the placeholder visibly unfilled rather than guessing.

## Summary sources (priority order)

1. **Git evidence (ground truth):** in each touched repo, `git -C <repo> log <default-branch>..HEAD --oneline` and `git -C <repo> diff <default-branch>...HEAD --stat` on the feature branch (default branch per the manifest, else `origin/HEAD`). Note uncommitted work explicitly — a PR body must not claim uncommitted changes.
2. **Session artifacts:** the plan's phase summaries and `**Verification:**` fields, the governing ADR's decision bullets, reviewer verdicts (cross-check, cumulative), analyst report hooks. These supply the *why* and the test/verification evidence.
3. **The conversation itself** — for context the artifacts don't carry (user rulings, deferred items).

Write for the PR reviewer, not the pipeline: what changed, why, how it was verified, what is deliberately out of scope. Cite verdicts factually ("cumulative review APPROVED, 21/21 AC PASS") — never claim a verification that didn't happen; if tests failed or were skipped, say so.

## Character-limit enforcement (mechanical, never eyeballed)

1. Write the draft body to the scratchpad as `pr-summary-<repo>.md`.
2. `wc -m <file>` → character count (counts characters, multibyte-safe). The count covers the PR **body only** — not the delivery fence.
3. Over 4000 → trim in this priority order and re-count (loop until under): (a) prose detail in Changes bullets — keep one line per change; (b) commit-list tails ("+ N more commits"); (c) Risks/out-of-scope elaboration — keep one line each; (d) NEVER trim: template headings, required checklist items, the Summary paragraph, verification evidence.
4. Record the final count; deliver only when ≤4000.

## Steps (standalone invocation)

1. Resolve scope: `$ARGUMENTS` hint wins; else the session's active plan/feature branch; genuinely ambiguous (multiple unrelated branches this session) → ask which.
2. Resolve repos (umbrella-aware, above). No touched repo with commits → report "nothing to summarize on <branch>" and stop.
3. Per repo: discover the template, gather the summary sources, fill the template.
4. Enforce the 4000-character limit mechanically (above).
5. Deliver each filled template in a fenced markdown block (` ```markdown … ``` `) so it copy-pastes raw, prefixed by one line: repo, branch, template used, final character count. The fenced block is the deliverable — no commentary inside it.

---

## Bundled resources

```
.claude/skills/summarizing/
  SKILL.md    this file
```
