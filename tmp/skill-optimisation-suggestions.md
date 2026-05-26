# Skill & Template Optimisation Suggestions

Backlog of cost/token reductions for the `documenting`, `reviewing`, and `understanding` skills and the templates they route to. The worked-example extraction has already been done — entries below are everything else discussed.

---

## How cost flows in the current setup

| Asset | Loaded when | Cost cadence |
|---|---|---|
| `SKILL.md` (frontmatter-declared) | Agent spawn | Once per spawn, every spawn (full cache miss after 5-min TTL) |
| Template (`templates/<type>.md`) | Agent invokes `Read` | Once per artifact written, cached for 5 min |
| Example (`examples/<type>.md`) | Agent invokes `Read` after seeing pointer | Only when agent is uncertain — rare |
| Asset YAML (`templates/assets/*.yaml`) | Whoever references the path | Should be path-reference only, never inlined |

Current frontmatter load per agent:

| Agent | Skills loaded at spawn | ≈ tokens |
|---|---|---|
| analyst | documenting + understanding | ~3.5k |
| architect | documenting + understanding | ~3.5k |
| consultant | documenting + understanding | ~3.5k |
| developer | documenting | ~2k |
| reviewer | reviewing | ~1.5k |

≈ **14k tokens of skill content in system prompts per team session**, paid every cache miss.

---

## 1. Drop `understanding` from agent frontmatter

**What:** Remove `understanding` from `analyst.md`, `architect.md`, `consultant.md` frontmatter. Keep it user-invocable via `/understanding`.

**Why:** Skill is loaded on 3 agents but fires in maybe 0–1 invocations per team session. ~1.5k × 3 = ~4.5k tokens paid every team session for a near-zero-fire skill.

**Risk:** Agents lose proactive keyword-trigger for the skill. They can still invoke it explicitly when the user asks or when the skill is needed.

**Expected saving:** ~4.5k tokens per team session.

---

## 2. Drop `documenting` from the developer agent

**What:** Remove `documenting` from `developer.md` frontmatter.

**Why:** Developer's only write to artifacts is the `**Status: Complete**` marker insertion on plan files — it doesn't need the routing table, marker rules, or template registry. The skill is dead weight on every developer spawn.

**Risk:** If the developer ever needs to produce a `progress.md` memory entry, it would need to load `documenting` on demand. Verify this is rare enough to be worth the saving.

**Expected saving:** ~2k tokens per developer spawn.

---

## 3. Trim reviewer templates — biggest single hot-path win

**What:** Audit `.claude/skills/reviewing/templates/*.md` for compressible prose. Targets:
- `alignment.md` (48 lines)
- `patterns.md` (55)
- `clean-architecture.md` (45)
- `vertical-slice.md` (45)
- `typescript.md` (65)
- `dotnet.md` (65)

Per phase review reads ~210 lines (alignment + patterns + one framework + one architecture template). Multiplied across phases × plans.

**Compression moves:**
- Remove preambles explaining *what the review type is* — reviewer already knows.
- Convert prose checklist items to `**Check:** X. **Pass when:** Y. **Fail when:** Z.` triplets.
- Drop checklist items that have produced zero CHANGES REQUIRED verdicts in the last 10 reviews.

**Expected saving:** 210 → ~130 lines per review. ≈ 400 tokens × every phase × every plan. Compounds fast.

**How to validate:** before/after token counts on the next 3 phase reviews.

---

## 4. Verify reviewer template selection logic

**What:** Confirm the reviewing skill loads exactly **one** framework template (`typescript.md` XOR `dotnet.md`) and exactly **one** architecture template (`clean-architecture.md` XOR `vertical-slice.md`) per review — not both, defensively.

**Why:** If detection is fuzzy and both load, that's ~110 unnecessary lines per review.

**Action:** Re-read `reviewing/SKILL.md` framework/architecture detection rules. Tighten if they're ambiguous.

---

## 5. Trim `documenting/SKILL.md` — push procedural content to templates

**What:** `documenting/SKILL.md` is 126 lines / ~2k tokens, loaded on every spawn of 4 agents. Anything procedural that belongs to *a specific artifact type* should move into that template instead.

**Candidates for moving down to templates:**
- Per-artifact-type writing rules
- Tactical vs strategic ADR distinction (move to `adr.md` + `strategic-adr.md` each)
- Anything that's only needed when writing one specific artifact

**Must stay in SKILL.md (cross-cutting):**
- Trigger phrases
- Registry table
- Filename derivation rules (used by every template)
- Confidence markers (used across reports + audit chains)
- Memory format conventions if shared

**Target:** SKILL.md under ~60 lines.

**Expected saving:** ~1k tokens × every spawn of analyst/architect/consultant/developer. Recurs every cache miss.

---

## 6. Audit `mast.yaml` and `tokens.yaml` for inlining

**What:** Confirm no SKILL.md or agent definition **inlines** the content of `templates/assets/mast.yaml` (243 lines) or `templates/assets/tokens.yaml` (121 lines). They should be referenced by path and read on demand.

**Why:** If either is inlined, that's up to 5k tokens paid every spawn for reference material consulted maybe once per session.

**Action:** Grep for `mast.yaml` and `tokens.yaml` across `.claude/`. Anywhere the content is pasted in instead of path-referenced, replace with a path reference.

---

## 7. Split `report.md` into structure + guide (conditional)

**What:** `report.md` is the heaviest remaining template at 101 lines (after example extraction). If audit reveals 30+ lines of standalone explanatory prose (not inline per-section hints), split into:
- `report.md` — structure only
- `report-guide.md` — prose, read once on first write per session

**Why:** Inline per-section hints (`"One paragraph: ..."`) must stay in the template — agent needs them while filling. But blocks of meta-explanation (audience selection rationale, depth philosophy) can move.

**Skip if:** the audit shows prose is mostly inline hints rather than standalone blocks. For templates shaped like `charter.md` this split is bookkeeping with no real win.

**Decision rule:** only split if you find a clearly extractable block of ≥30 lines.

---

## 8. Cross-template dedup

**What:** Look for content duplicated across templates:
- `plan.md` re-explaining ADR-amendment process already in `adr.md`?
- `strategic-adr.md` re-explaining markers already in SKILL.md?
- `progress.md` repeating phase-status semantics from `plan.md`?

**Fix:** Replace the duplicate with a one-line reference: "See marker rules in `../SKILL.md`."

**Expected saving:** modest individually, but free quality win — single source of truth.

---

## 9. Make optional sections explicit (output-token saving)

**What:** Audit every template for sections that are often empty in practice. Add explicit guidance:

```
<!-- optional: omit the entire heading and section body if no items -->
```

**Why:** Without this, the agent often reproduces empty section headings in output. The cost is paid in **output tokens** (more expensive than input on most models), not input tokens.

**High-value targets:** `plan.md` Open Questions, `adr.md` Alternatives when only one is meaningful, `report.md` Glossary when no domain-specific terms appear.

---

## 10. Audit anti-pattern compression (in agent files, not skills — adjacent work)

**What:** Not strictly a skill change, but adjacent to template work. Anti-pattern entries in `.claude/agents/*.md` use a verbose 3-line Detection/Why/Resolution structure. Compress to 2-line form referencing the MAST FM code:

Before:
```
### Menu of options (MAST FM-1.2 Disobey Role Specification)
- **Detection:** the ADR or output presents two or more designs without recommending one.
- **Why it fails:** the developer cannot execute a menu...
- **Resolution:** state exactly one recommended design...
```

After:
```
### Menu of options [FM-1.2]
- **Detect:** ≥2 designs without a recommendation.
- **Fix:** one recommended design; rest go to step-A7 alternatives with rule-out reasons.
```

The MAST FM code is the path to the full "why" in `mast.yaml`. ~40-50% reduction in anti-patterns prose across all 5 agents.

---

## Sequencing recommendation

Do in this order, measure after each:

1. **#1 (drop `understanding` from frontmatter)** — biggest immediate win, lowest risk.
2. **#2 (drop `documenting` from developer)** — clean, no behavioural change.
3. **#3 (trim reviewer templates)** — biggest hot-path win.
4. **#6 (audit asset YAML inlining)** — possibly 5k free tokens if anything is inlined.
5. **#5 (trim documenting SKILL.md)** — recurring saving on every cache miss.
6. Stop. Measure. Reassess whether 7–10 are still worth the effort.

The first 4 changes are likely worth 8–12k tokens per team session. The remaining items are progressively smaller and carry more behavioural risk — only worth pursuing if measurement shows the loop is still expensive.

---

## Already done (out of scope here)

- Extracted worked examples from `report.md`, `adr.md`, `plan.md`, `progress.md` into `.claude/skills/documenting/examples/` with one-line pointers in the templates and a single line in `SKILL.md`. Saved ≈166 lines / 2–2.5k tokens per write across those 4 artifact types.
