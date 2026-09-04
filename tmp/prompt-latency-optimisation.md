# Prompt: make the harness feel fast

Run in a fresh session on `claude-fable-5`, from the repo root `d:\workspace\github\AISpec`.

---

## The task

This repo is a multi-agent development harness: a team lead in the main session, five
named teammates (analyst, consultant, architect, developer, reviewer), eight skills,
a hook layer that enforces the contracts mechanically, and a set of artifact
directories under `artifacts/`. It works. It is battle tested, it was built by trial
and error, and its outputs are good.

Its problem is not correctness. Its problem is **latency and cost**. A single small
change can cost minutes to tens of minutes of wall clock before the developer sees
anything they can react to, and it burns a large number of tokens getting there.
I want you to fix that without giving up what the harness was built for.

This is a working session, not a report commission. We refine the answer together,
in conversation, and only implement once we both like the shape of it.

## What must survive untouched

These are the reasons the harness exists. A proposal that trades any of them for
speed is a failed proposal:

1. **Determinism and consistency.** The same input takes the same road and produces
   the same shape of artifact. Verdict tokens, gate semantics, and the hook layer stay
   mechanical rather than vibes-based.
2. **Correctness.** Design decisions are still recorded, plans are still phased,
   reviews still catch drift, and irreversible or security-path work still stops for
   a human.
3. **Efficiency and cost.** Fewer tokens is a goal, not a side effect. Do not buy
   latency with a token blowout (for example by fanning out ten agents where one
   would do).
4. **The team-lead plus named-teammates structure.** Keep it. I want orchestration by
   a lead with specialised agents, not a single monolithic prompt. You may change how
   many agents there are, what each one loads, when each one is spawned, and how they
   hand off, but the shape stays.

## What I actually want to feel

The user experience target, in the developer's terms:

- **Time to first reviewable output is the metric that matters**, not total tokens
  and not total wall clock. I want to see something I can react to, approve, or
  redirect within a short interaction, not after a ten minute silence.
- **Streaming, incremental feedback beats one big correct answer at the end.** A
  useful partial answer I can steer is worth more than a perfect one I waited for.
- **Long, heavy processing must be the exception, not the default.** When real depth
  is genuinely needed (a large design, a security-sensitive change, an end-of-plan
  cumulative review) taking longer is fine and expected. Everything else should feel
  near-instant. Today the heavy road is the default road, and that is the core defect.
- **Round trips are the enemy.** Every relay through the team lead, every re-read of
  an unchanged file, every serial look-around, every gate that adds a round trip
  before I get to speak, all of it is latency I pay for personally.

Optimise the thinking process too, not only the file layout: where reasoning depth is
bought and where it is wasted, which steps deserve extended thinking and which are
mechanical, and which model tier each step actually needs.

## Where to look for inspiration

`.opensrc/repos/github.com/` holds a set of comparable open-source harnesses, already
analysed once. The per-repo findings are in `tmp/findings-*.md` and the cross-repo
synthesis in `tmp/findings-_synthesis.md`. Read those first so you do not redo the
analysis, but verify anything you intend to copy against the actual source, since the
findings are a summary and may be stale.

**Focus mainly on `bmad-method`** (`.opensrc/repos/github.com/bmad-code-org/bmad-method`,
findings in `tmp/findings-bmad-method.md`). Its step-file architecture (one micro-file
loaded at a time), its story file as the single self-contained hand-off unit, its
`sprint-status.yaml` state machine, and its `persistent_facts` sticky context are all
directly relevant to what I am asking for. Say clearly which of its ideas transfer,
which do not, and why.

The other repos in that tree (SuperClaude, agent-os, spec-kit, openspec,
claude-task-master, get-shit-done, shotgun) are secondary. Pull from them only where
they beat BMAD on a specific point.

## Where the current cost lives

Do not take my word for any of this. Measure what is cheap to measure, flag what you
are guessing, and tell me where I was wrong. This is the map for round one, not a
checklist you must exhaust before speaking to me.

- The contract surface loaded on every turn and every spawn: `CLAUDE.md`,
  `.claude/agents/*.md`, `.claude/agents/assets/**`, `.claude/skills/*/SKILL.md`,
  `.claude/agents/assets/instructions/lead/orchestration.md` (injected at every
  `SessionStart`), plus the auto-loaded skills that land in an agent's context whether
  the turn needs them or not.
- The gate chain in `CLAUDE.md`: pre-flight, cross-check before Phase 1, per-phase
  user approval, mid-plan checkpoints, end-of-plan cumulative review, amendment and
  supersession, cycle bounds. Each gate costs at least one round trip. For each one,
  answer with evidence: what does it catch, how often does it actually catch it, and
  what would break if it were merged into a neighbouring gate, made conditional, or
  removed.
- The hook layer in `.claude/hooks/` and its per-call overhead.
- Real telemetry: `.claude/telemetry/ledger.jsonl` and `node .claude/telemetry/report.mjs`.
  Use it. Also mine `artifacts/` and `git log` for how the pipeline behaved in
  practice: how many amendments per plan, how many cross-checks came back `ALIGNED`
  with no change, how many cumulative reviews came back `APPROVED` first time. A gate
  that has never once changed an outcome is pure latency.
- The `expediting` skill is the existing fast lane. Work out why it is not carrying
  more of the traffic, and whether the answer is a wider admission gate, a second
  intermediate road, or something else.

## How we work this

No report artifact, no `artifacts/` write, no documenting template. This is a
conversation, and the way we run it should itself demonstrate the property I am
asking you to build: I want to be talking to you early and often, not reading your
output an hour later.

**Round one.** Spend a bounded amount of look-around on the harness and on
bmad-method, then come back with the shortest thing worth reacting to: where the time
and tokens actually go today, in rank order, and the two or three structural moves you
think are worth making. Numbers where you have them, a flagged guess where you do not.
Do not polish it and do not pad it. A rough ranked list I can argue with beats a
finished document I have to read.

**Then we go back and forth.** I will push on individual items, kill some, ask you to
go deeper on others. Follow my lead on depth: when I say go deep on one thing, that
one thing earns the long expensive pass, and nothing else does. Ask me a blocking
question the moment you hit one rather than picking an assumption and running with it.

**Keep the running state in one scratch file** under `tmp/`, plain markdown, whatever
shape suits: the current ranked list, what we agreed, what we killed and why, what is
still open. Update it as we go so we can both see where we are. It is a working
surface for the two of us, not a deliverable, so it does not follow any template and
it never lands in `artifacts/`.

**We implement only when I say so**, one change at a time, each landing independently
and revertible on its own, since the harness is in daily use. No file outside `tmp/`
changes before I say go.

Radical restructuring is allowed and welcome, including collapsing agents, replacing
the artifact chain, or rewriting the gate model, as long as the four protected
properties survive and the team-lead structure stays. Do not restrict yourself to
trimming words out of prompt files: that is the smallest available win and I am asking
for a larger one. And tell me plainly when you think I am wrong about where the cost
is, or when something I want to cut is load bearing.

Since the subject of this task is the harness itself, note the stale-snapshot rule in
`CLAUDE.md`: grade every contract claim against the file on disk, never against the
snapshot injected into your context.
