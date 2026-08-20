---
name: branching
description: >
  Manage per-feature git worktrees across the nested repositories of a multi-repo
  umbrella. Auto-generates and self-heals a repository manifest, then creates, resumes,
  lists, or removes worktrees for a named branch — one isolated working folder per repo
  the feature touches. Use this skill when the user wants to start, resume, or clean up
  work on a feature branch across the umbrella's sub-repos — phrasings like "start a
  branch", "spin up a worktree", "resume work on <branch>", "set up branches for this
  feature", "list my worktrees", or "tear down the worktree for <branch>". Requires an
  explicit branch name — never invents one. Invoke standalone via `/branching <branch>`,
  or load via the `skills:` frontmatter field on the developer agent.
---

# Skill: branching

Per-feature worktree manager for a multi-repo umbrella whose sub-repositories are **separate nested git repos** under a scan root (default `src/`). A worktree gives each repo an isolated working folder on a feature branch, backed by that repo's own shared history — so one feature can progress across several repos at once without checkout-thrashing or file collisions.

**Shape:** linear. Dual-mode — standalone via `/branching <branch>`, or loaded via `skills:` frontmatter on the developer agent.

**Scope (Stage 0 — deliberately simple).** One branch per repo per feature; one worktree per (repo, branch). No within-repo parallel story branches, no automated merge orchestration. The branch name is the identity that ties a feature's worktrees together across repos.

---

## User input

```text
$ARGUMENTS
```

The input is the **branch name**, optionally preceded by an operation flag (below). Treat the branch name as the source of truth and the feature identity.

**The branch name is mandatory for create/resume and remove.** If the operation needs a branch name and none is given, present the operation list and ask the user explicitly for the branch name, then stop. **Never invent, randomize, or infer a branch name.**

---

## Operation flags

Use the **first** matching flag; default is create-or-resume. Strip the flag before treating the remainder as the branch name.

| Flag        | Operation        | Branch name | Effect                                                                                  |
|-------------|------------------|-------------|-----------------------------------------------------------------------------------------|
| (none)      | create-or-resume | required    | Resume the branch's existing worktrees if any exist; otherwise create them in the repos you select. Default. |
| `--list`    | list             | optional    | List active worktrees across all mapped repos (filter to one branch if a name is given). Read-only. |
| `--remove`  | remove           | required    | Remove the named branch's worktree(s), scoped — never a blanket prune.                   |

---

## The manifest

A generated map of the umbrella's nested repos. **Location: `.claude/branching/manifest.yaml`** (outside this skill's bundle — it is generated state, not skill definition). Single purpose: map each repo to its path, git directory, and detected default branch. It is **not** a record of branches or worktrees — that truth is read live from git, so there is only ever one source of truth and nothing to go stale.

Schema (see `templates/manifest.example.yaml`):

```yaml
version: 1
scan_root: src              # immediate children of this dir are scanned for git repos
generated: <YYYY-MM-DD>      # stamp with the current date on each (re)scan
repos:
  - name: <dir-name>
    path: src/<dir-name>     # forward slashes; relative to the umbrella root
    git_dir: <absolute-git-dir>
    default_branch: <name>   # cached hint; re-validated on self-heal
```

### Manifest lifecycle (run on every invocation, before any operation)

1. **Absent** → run **Scan**, write the manifest, report `manifest created (<N> repos)`.
2. **Present** → load and **validate** every entry:
   - `path` exists AND `git -C <path> rev-parse --is-inside-work-tree` is `true`.
   - `git_dir` resolves (`git -C <path> rev-parse --absolute-git-dir`).
   - Detect any immediate child of `scan_root` that is a git repo but **absent** from the manifest.
3. **All valid and no new repos** → use as-is, silently.
4. **Any broken entry OR any new repo** → this is the **self-heal** path: re-run **Scan**, rewrite the manifest, and report the delta (`added: …`, `removed: …`, `repaired: …`). Then continue with the requested operation.

### Scan procedure

Read-only discovery (no mutations):

1. Enumerate immediate child directories of `scan_root`.
2. For each, test for a git repo: a `.git` entry exists (directory **or** gitlink file) **or** `git -C <dir> rev-parse --git-dir` succeeds. Skip non-repos.
3. For each repo, resolve `git_dir` via `git -C <dir> rev-parse --absolute-git-dir` (handles `.git` gitlink files too).
4. Detect `default_branch` via the cascade below.
5. Write the manifest with the current date in `generated:`.

Only immediate children of `scan_root` are scanned. If the umbrella nests repos deeper, note it and ask before widening the scan.

### Default-branch detection cascade (per repo)

First match wins — this is the **base** for new branches in that repo:

1. `git -C <repo> symbolic-ref --quiet --short refs/remotes/origin/HEAD` → strip leading `origin/`.
2. Else the current branch: `git -C <repo> rev-parse --abbrev-ref HEAD` (unless detached / `HEAD`).
3. Else whichever of `main` / `master` exists as a local ref; failing that `git -C <repo> config init.defaultBranch`.

Record the resolved name. Each repo is resolved independently — they need not agree.

---

## Operations

### create-or-resume (default)

1. Ensure the manifest (lifecycle above).
2. No branch name → present operations and **ask for the branch name explicitly**; stop. Never generate one.
3. **Resume check** — for each mapped repo, parse `git -C <repo> worktree list --porcelain` for `branch refs/heads/<branch>`. Collect every repo where the branch is already checked out in a worktree.
   - **One or more found → RESUME.** Report each existing worktree path and its repo; make no changes. Done.
4. **None found → NEW.** Present the mapped repos and ask which ones this feature touches (multi-select — only the repos the feature actually touches, never all by default). For each selected repo:
   - `safe_dir` = the branch name with `/` and whitespace replaced by `-`.
   - Worktree path = `<repo>/.worktrees/<safe_dir>`.
   - If the branch already exists locally (`git -C <repo> show-ref --verify --quiet refs/heads/<branch>`) but is checked out nowhere → `git -C <repo> worktree add <path> <branch>`.
   - Else (new branch) → `git -C <repo> worktree add <path> -b <branch> <default_branch>`.
5. **Surface the exact `git worktree add` command(s) for confirmation before running** (worktree creation is a mutating action — see base constraints). On confirmation, run them and report each created worktree path + repo + base branch.

### list (`--list`)

For each mapped repo run `git -C <repo> worktree list` (read-only). Group the output by repo; if a branch name was supplied, filter to worktrees on that branch. Report the grouped list.

### remove (`--remove`)

1. Ensure the manifest. No branch name → ask explicitly; stop.
2. Locate the branch's worktrees via the resume check (step 3 above) across all repos.
3. None found → report that there is nothing to remove; stop.
4. **Survey each worktree before proposing anything** (all read-only). Removal refuses for knowable reasons, and knowing which one you face decides the rung you start on:
   - `git -C <worktree-path> status --porcelain` → uncommitted or untracked content.
   - `git -C <worktree-path> ls-files --stage` for mode `160000` entries → **nested submodules**. See the gitlink note below.
5. **Walk the removal ladder**, surfacing each command for confirmation before running it and stopping at the first rung that succeeds:

   | Rung | Command | When |
   |---|---|---|
   | 1 | `git -C <repo> worktree remove <path>` | Always try first. Succeeds on a clean, submodule-free worktree. |
   | 2 | `git -C <repo> worktree remove --force <path>` | Rung 1 refused. **Ask first**, and list exactly what step 4 found would be discarded. |
   | 3 | delete `<path>`, then `git -C <repo> worktree prune` | Rung 2 still refuses (gitlink guard). Two commands, both surfaced. |

6. **The gitlink note.** Git's removal guard scans the worktree's **index** for gitlink entries, not whether those submodules are initialized. So a worktree carrying submodules can refuse at rungs 1 and 2 even when it is entirely clean, and **`git submodule deinit` does not help** — it clears working directories without touching the index the guard reads. Do not attempt it as a workaround; it costs the user a populated submodule and buys nothing. `git rm --cached <submodule>` *would* satisfy the guard, and is equally out: it dirties the branch's index to work around a teardown. Rung 3 is the route.
7. **Prune is scoped, not blanket.** Before running `git -C <repo> worktree prune`, enumerate that repo's registrations with `git -C <repo> worktree list` and report them. Prune only clears registrations whose directory is already gone, and it is per-repo — sibling repos in the manifest are untouched. State which registrations it will clear and note the one residual hazard: a concurrent session mid-`worktree add` in the *same* repo. If the listing shows nothing but the main worktree and the one being torn down, say so — that is what makes the prune safe, and it is worth saying rather than carrying a stale blanket warning.
8. **Sweep the scaffolding.** After a rung-3 deletion, report any directory left empty by it — the `.worktrees/` parent, or intermediate directories created only to host the worktree. Offer removal; never delete silently and never leave them unmentioned.
9. **Report per repo**: which rung cleared it, what was discarded at rung 2, what prune cleared at rung 3. State explicitly that the **branch ref itself still exists** — none of these rungs delete it, and users routinely assume `--remove` did.

**Harness note.** Deletion commands are guard-denied unless every operand names a path *inside* a `.worktrees/<name>` directory (`.claude/hooks/guard.bash.mjs`), and Windows paths must be quoted to qualify. A refusal means the path is wrong or the scope is wider than a single worktree — **fix the path**. Reaching for a different deletion tool to get around the refusal is circumventing the guard, not satisfying it.

---

## Safety invariants

These hold even when two sessions run different features at once (worktrees of one repo share its `.git`; the working folders are isolated):

1. **Feature-scoped naming.** Branch and worktree path both derive from the explicit branch name — never random. Unique branch names make cross-session collisions structurally impossible; a clash only ever produces git's loud "already checked out" error, never corruption.
2. **Resume before create.** Always run the resume check first; never recreate a worktree that already exists for the branch.
3. **Scoped teardown.** Remove only the named worktree. `prune` is permitted as the last rung of the removal ladder, but only in the repo being torn down and only after its registrations have been enumerated and reported — never as a reflex, and never across repos.
4. **No shared untracked state.** Let each worktree own its own `node_modules` / build output / `.env`; do not symlink these across worktrees to "save time" — it reintroduces the collisions worktrees exist to prevent.

Runtime-resource collisions (two test runs binding the same port or hitting the same dev DB) are **out of this skill's scope** — they belong to whoever runs the tests, not to worktree setup. Flag the risk if a created worktree's repo has an obvious fixed-port/shared-DB test setup.

---

## Steps (standalone invocation)

When invoked as `/branching`:

1. Parse the input: resolve the **operation** (default create-or-resume) and the **branch name** (remainder after stripping any flag).
2. Run the **manifest lifecycle** — create, validate, or self-heal as needed; report any delta.
3. Branch name required by the operation but missing → present operations and ask for it explicitly. Stop. Never invent one.
4. Run the resolved operation per **Operations** above, surfacing every mutating `git worktree` command for confirmation before executing.
5. Report: the manifest state (created / healed / unchanged), and for the operation — resumed vs. created worktrees (repo + path + base), the listing, or what was removed.

---

## Bundled resources

```
.claude/skills/branching/
  SKILL.md                      this file
  templates/manifest.example.yaml   the manifest schema, annotated (reference only)

.claude/branching/manifest.yaml  GENERATED on first run; self-healed thereafter (not part of the bundle)
```
