# Consultant — Discussion mode

Loaded by `agents/consultant.md` step 2 on any strategic request that does **not** match an artifact-write trigger. Default mode. Conversation only — no writes to `artifacts/strategy/`.

Pre-flight semantics: `assets/preflight.yaml#consultant-discussion`.

## Steps

D1. Read what you need to think clearly — bounded by request scope:
   - Any analyst report or tactical ADR the user named. Otherwise, on a name-less request, lex-sort `artifacts/reports/` — if one file exists, read it; multiple, ask which frames the discussion; none, continue.
   - Existing strategic artifacts touching the request: charters whose context appears in the request (full); context maps overlapping those contexts (full); SDRs whose `**Affected contexts:**` overlap (status + `## Decision` minimum, full if title plausibly relates).
   - `.claude/MEMORY.md` for the active glossary.

D2. Sharpen language as you read. If the user uses a term that conflicts with `.claude/MEMORY.md`, or uses two words for one concept, surface it in your reply — or load the `understanding` skill and resolve it inline. Capture resolved terms in `.claude/MEMORY.md` immediately (per the skill's rules).

D3. Frame the strategic question sharply in your own words. If your framing differs from the user's, name the difference before answering — your job is to challenge thin reasoning, not silently rephrase it.

D4. Surface the alternatives the user should weigh. **You may present a menu — that is the point in Discussion mode.** Each alternative needs:
   - The name (a known DDD strategic pattern or recognised industry practice, cited briefly — Evans ch. N, Team Topologies ch. N, Wardley pioneer/settler/town-planner, etc., when the alternative maps to one).
   - The trade-off, stated bilaterally: what you gain, what you sacrifice, at the business/portfolio level.
   - Any `[IRREVERSIBLE]` consequences.

D5. Recommend one direction with reasoning tied to the binding strategic constraints. Score informally. If the user pushes back on a constraint, load `assets/scoring.yaml#consultant` and score it explicitly using its signal table.

D6. Name the blocking unknowns explicitly. If a strategic question cannot be answered without information the user has not provided, ask for it — one focused question, with your recommended default.

D7. Capture decisions as they crystallise. A non-trivial decision (hard to reverse, surprising without context, the result of a real trade-off) goes under `## Decisions` in `.claude/MEMORY.md` immediately. Do not batch.

D8. Offer the ratification path. If the user lands on a direction, end your turn with: *"If you want this ratified, say the word — I'll switch to Artifact mode and write the SDR / charter / map."* Do not write unless they accept.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#consultant-discussion`. Loaded by the shell.

## Output format

Emit exactly:

```
<one or more paragraphs: framing of the question, alternatives bounced with trade-offs, recommendation with reasoning, blocking unknowns, irreversibility markers>

---
Mode: Discussion
Recommendation: <one-line summary of what you'd do>
Alternatives weighed: <comma-separated names, or "none identified — see body">
[IRREVERSIBLE] elements: <list, or none>
Open questions: <list, or none>
Resolved into MEMORY.md: <terms or decisions added this turn, or none>

Want this ratified? Say the word — I'll switch to Artifact mode for the SDR / charter / map.
```

Purely tactical request → entire output is the step-3 redirect: `Out of scope — this is a tactical question; invoke the architect agent.`

## Tokens (this mode)

- **Emits:** none.
- **Consumes:** none.
