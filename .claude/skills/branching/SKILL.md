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
   - **One or more found → RESUME.** Report each existing worktree path and its repo. Create nothing and move nothing — then go to step 6, which is the one part of this operation a resume still runs (a worktree left with an unpopulated or drifted submodule is exactly what a resume is for).
4. **None found → NEW.** Present the mapped repos and ask which ones this feature touches (multi-select — only the repos the feature actually touches, never all by default). For each selected repo:
   - `safe_dir` = the branch name with `/` and whitespace replaced by `-`.
   - Worktree path = `<repo>/.worktrees/<safe_dir>`.
   - If the branch already exists locally (`git -C <repo> show-ref --verify --quiet refs/heads/<branch>`) but is checked out nowhere → `git -C <repo> worktree add <path> <branch>`.
   - Else (new branch) → `git -C <repo> worktree add <path> -b <branch> <default_branch>`.
5. **Surface the exact `git worktree add` command(s) for confirmation before running** (worktree creation is a mutating action — see base constraints). On confirmation, run them and report each created worktree path + repo + base branch.
6. **Hydrate submodules — only where required.** `git worktree add` populates no submodules: it leaves every gitlink as an empty directory, so a fresh worktree of a submodule-carrying repo does not build. A resumed worktree may also have drifted. Run this step for every worktree just created **and** every worktree just resumed.
   - **Detect first.** `git -C <worktree> ls-files --stage` → any mode `160000` entry. None → skip this step entirely and say nothing about it.
   - **Classify, then act.** `git -C <worktree> submodule status --recursive` (read-only). The first character of each line decides the rest:

     | Prefix  | State                                                      | Action                                            |
     |---------|------------------------------------------------------------|---------------------------------------------------|
     | `-`     | not initialized — the empty dir `worktree add` left behind  | hydrate                                           |
     | (space) | populated, at the commit the superproject records           | nothing to do — do not run `update` "to be sure"   |
     | `+`     | populated, at a **different** commit than recorded          | ask (below); never hydrate silently               |
     | `U`     | merge conflicts inside the submodule                        | stop and report; never auto-update                |

   - Only `-` lines are hydrated: `git -C <worktree> submodule update --init --recursive`. It is a mutating command — surface it for confirmation, then run it and report each submodule path and the commit checked out.
   - A `+` line means someone moved that submodule on purpose. `update` would check the recorded commit back out over their work, so name the submodule and both commits and **ask**. Also run `git -C <worktree>/<sub> status --porcelain`: if it is dirty, report that in the same breath. Never reach for `--force` to get past either.
   - **Say the disk cost once.** Each worktree gets its **own** submodule clone under `<repo>/.git/worktrees/<safe_dir>/modules/<sub>` — worktrees share the superproject's history but **not** their submodules'. Mention it when hydrating a large submodule; the flip side is that teardown of one worktree cannot touch another's submodules.

### list (`--list`)

For each mapped repo run `git -C <repo> worktree list` (read-only). Group the output by repo; if a branch name was supplied, filter to worktrees on that branch. Report the grouped list.

### remove (`--remove`)

1. Ensure the manifest. No branch name → ask explicitly; stop.
2. Locate the branch's worktrees via the resume check (step 3 above) across all repos.
3. None found → report that there is nothing to remove; stop.
4. **Survey each worktree before proposing anything** (all read-only). Removal refuses for knowable reasons, and knowing which one you face decides the rung you start on:
   - `git -C <worktree-path> status --porcelain` → uncommitted or untracked content.
   - `git -C <worktree-path> ls-files --stage` for mode `160000` entries → **nested submodules**. If any exist, follow with `git -C <worktree-path> submodule status --recursive` to learn which are actually **populated** (any line not prefixed `-`). Populated submodules change the teardown order — see step 5 — and unpopulated ones change nothing at all.
   - For each populated submodule, before proposing to release it: `git -C <worktree-path>/<sub> status --porcelain` (uncommitted work) and `git -C <worktree-path>/<sub> log --branches --not --remotes --oneline` (commits that exist nowhere else). This is the only pass that can still save that work — every rung below discards it.
5. **Release submodules before removing the worktree, if any are populated.** Order matters: `git worktree remove` refuses outright while submodules are populated (step 7), and once the worktree directory is gone the submodule working trees go with it, unsurveyed.
   - Report what step 4 found in each submodule — uncommitted content, unpushed commits, or neither — and **ask before releasing anything that is not "neither"**.
   - On confirmation: `git -C <worktree-path> submodule deinit --all --force`. The `--force` is not optional; plain `deinit` refuses on any modified submodule, which is exactly the case you just surfaced and got approval for.
   - **`deinit` writes to the repo's shared config, not the worktree's.** Worktrees of one repo share `.git/config`, so this unregisters `submodule.<name>.url` for the *whole* repo — the main worktree and every sibling worktree included. Nothing already populated breaks, but the next `submodule update` elsewhere needs its `--init` back. Say so; do not let a sibling session discover it.
   - No populated submodules → skip this step entirely and go to the ladder.
6. **Walk the removal ladder**, surfacing each command for confirmation before running it and stopping at the first rung that succeeds:

   | Rung | Command | When |
   |---|---|---|
   | 1 | `git -C <repo> worktree remove <path>` | Always try first. Succeeds on a clean worktree that has never had a submodule initialized. |
   | 2 | `git -C <repo> worktree remove --force <path>` | Rung 1 refused. **Ask first**, and list exactly what step 4 found would be discarded. This is also the expected clearing rung after a step-5 deinit — see the note below. |
   | 3 | delete `<path>`, then `git -C <repo> worktree prune` | Rung 2 still refuses. Two commands, both surfaced. |

7. **The submodule guard, and why deinit does not spare you rung 2.** Git refuses to remove a worktree whose `<repo>/.git/worktrees/<safe_dir>/modules/` directory exists — that directory is created the moment a submodule is first initialized *in that worktree*, and it **outlives `git submodule deinit`**, which clears working directories and shared config but leaves the submodule git dirs in place. So on a worktree that ever hydrated a submodule, rung 1 refuses and rung 2 is where it clears, deinit or no deinit. (Verified against git 2.35.1: unpopulated gitlinks pass rung 1 untouched; a populated one fails rung 1, still fails it after `deinit --all -f`, and clears at rung 2 — which also removes the admin directory and its `modules/`, leaving nothing to prune.)

   Step 5 still runs first, and not as a workaround: it is the surveyed, confirmed release of the submodule working trees. Skipping it does not make rung 2 fail — it makes rung 2 delete that content without anyone having looked at it.

   Two things remain out of bounds. `git rm --cached <submodule>` dirties the branch's index to work around a teardown; and reaching for a deletion tool the guard does not cover is circumventing the guard, not satisfying it.
8. **Prune is scoped, not blanket.** Before running `git -C <repo> worktree prune`, enumerate that repo's registrations with `git -C <repo> worktree list` and report them. Prune only clears registrations whose directory is already gone, and it is per-repo — sibling repos in the manifest are untouched. State which registrations it will clear and note the one residual hazard: a concurrent session mid-`worktree add` in the *same* repo. If the listing shows nothing but the main worktree and the one being torn down, say so — that is what makes the prune safe, and it is worth saying rather than carrying a stale blanket warning.
9. **Sweep the scaffolding.** After a rung-3 deletion, report any directory left empty by it — the `.worktrees/` parent, or intermediate directories created only to host the worktree. Offer removal; never delete silently and never leave them unmentioned.
10. **Report per repo**: which rung cleared it, what was discarded at rung 2, what prune cleared at rung 3. State explicitly that the **branch ref itself still exists** — none of these rungs delete it, and users routinely assume `--remove` did.

**Harness note.** Deletion commands are guard-denied unless every operand names a path *inside* a `.worktrees/<name>` directory (`.claude/hooks/guard.bash.mjs`), and Windows paths must be quoted to qualify. A refusal means the path is wrong or the scope is wider than a single worktree — **fix the path**. Reaching for a different deletion tool to get around the refusal is circumventing the guard, not satisfying it.

---

## Safety invariants

These hold even when two sessions run different features at once (worktrees of one repo share its `.git`; the working folders are isolated):

1. **Feature-scoped naming.** Branch and worktree path both derive from the explicit branch name — never random. Unique branch names make cross-session collisions structurally impossible; a clash only ever produces git's loud "already checked out" error, never corruption.
2. **Resume before create.** Always run the resume check first; never recreate a worktree that already exists for the branch.
3. **Scoped teardown.** Remove only the named worktree. `prune` is permitted as the last rung of the removal ladder, but only in the repo being torn down and only after its registrations have been enumerated and reported — never as a reflex, and never across repos.
4. **Submodules are hydrated on the way in and released on the way out.** A worktree is only usable once its gitlinks are populated, and only removable once they are not — so hydration belongs to create/resume and `deinit` belongs to teardown, each gated on `submodule status` rather than run reflexively. Neither direction ever runs with `--force` against content that has not been surveyed and confirmed first.
5. **No shared untracked state.** Let each worktree own its own `node_modules` / build output / `.env`; do not symlink these across worktrees to "save time" — it reintroduces the collisions worktrees exist to prevent.

Runtime-resource collisions (two test runs binding the same port or hitting the same dev DB) are **out of this skill's scope** — they belong to whoever runs the tests, not to worktree setup. Flag the risk if a created worktree's repo has an obvious fixed-port/shared-DB test setup.

---

## Steps (standalone invocation)

When invoked as `/branching`:

1. Parse the input: resolve the **operation** (default create-or-resume) and the **branch name** (remainder after stripping any flag).
2. Run the **manifest lifecycle** — create, validate, or self-heal as needed; report any delta.
3. Branch name required by the operation but missing → present operations and ask for it explicitly. Stop. Never invent one.
4. Run the resolved operation per **Operations** above, surfacing every mutating `git worktree` command for confirmation before executing.
5. Report: the manifest state (created / healed / unchanged), and for the operation — resumed vs. created worktrees (repo + path + base) plus any submodules hydrated or left alone, the listing, or what was removed (which rung cleared it, and which submodules were deinitialized first).

---

## Bundled resources

```
.claude/skills/branching/
  SKILL.md                      this file
  templates/manifest.example.yaml   the manifest schema, annotated (reference only)

.claude/branching/manifest.yaml  GENERATED on first run; self-healed thereafter (not part of the bundle)
```
