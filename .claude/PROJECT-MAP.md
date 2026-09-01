# Project map

Where things live in this project. Read on entry turns, before searching.

Owned by the `analyst` (CLAUDE.md `## Artifact Ownership`). Route a refresh through the team lead rather than editing it in place. It answers "where do I find X", never "how does X behave": behaviour belongs in `artifacts/reports/`, decisions in `artifacts/adr/`, vocabulary in `.claude/MEMORY.md`.

**Status: not yet generated for this project.** An agent that reads this line should say so once and carry on searching, so the gap is visible instead of silently repaid every spawn.

## Repositories and solutions

_One line per repo or solution: path, what it is, and whether it is a nested git repo._

## Module map

_One line per module, bounded context, or top-level feature: name → folder. This is the section that saves the most searching, so it comes before everything optional._

## Where the usual things sit

_Tests, configuration, dependency injection or startup wiring, database migrations, build entry points, generated code. One line each; state the pattern, not every instance._

## Path conventions

_The rules that make a path guessable without a search: naming schemes, folder-per-feature vs folder-per-layer, test project naming, where interfaces live relative to implementations._

## Not here

_Anything a reader would reasonably expect to find in this repo and will not: code that lives in another repo, generated artifacts, vendored trees to leave alone._
