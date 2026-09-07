# Branching: create or resume

1. Ensure the manifest (SKILL.md, Manifest).
2. Resume check: for each mapped repo, parse `git -C <repo> worktree list --porcelain` for `branch refs/heads/<branch>`. Any hit → RESUME: report each path and repo, create nothing, go to step 5.
3. None → NEW. Ask which mapped repos the feature touches (multi-select; never all by default). For each: `safe_dir` = branch with `/` and whitespace replaced by `-`; path = `<repo>/.worktrees/<safe_dir>`. Branch exists locally but is checked out nowhere (`git -C <repo> show-ref --verify --quiet refs/heads/<branch>`) → `git -C <repo> worktree add <path> <branch>`; else `git -C <repo> worktree add <path> -b <branch> <default_branch>`.
4. Show the exact `git worktree add` command(s) for confirmation, run them, report path, repo and base per worktree.
5. Hydrate submodules only where required, for every worktree just created or resumed:
   - Detect: `git -C <worktree> ls-files --stage` has a mode `160000` entry. None → skip silently.
   - Classify with `git -C <worktree> submodule status --recursive`; the first character decides:

   | Prefix | State | Action |
   |---|---|---|
   | `-` | not initialized (the empty dir `worktree add` leaves) | hydrate |
   | space | populated at the recorded commit | nothing; do not run `update` "to be sure" |
   | `+` | populated at a different commit | ask, naming the submodule and both commits; also report `git -C <worktree>/<sub> status --porcelain` if dirty; never hydrate silently |
   | `U` | merge conflicts inside | stop and report |

   - Hydrate only `-` lines: `git -C <worktree> submodule update --init --recursive`, shown for confirmation, then report each submodule path and commit.
   - Say the disk cost once: each worktree gets its own submodule clone under `<repo>/.git/worktrees/<safe_dir>/modules/<sub>`; worktrees share the superproject's history, not their submodules'.

Record the worktree path(s) in the work item (`harness set <id> branch=<branch>`) so later phases resume in place.
