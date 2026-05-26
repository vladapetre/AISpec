# Consultant — Artifact mode

Loaded by `agents/consultant.md` step 2 when the request carries an explicit write verb (regex below) or an inbound ratification flag.

Pre-flight semantics: `assets/preflight.yaml#consultant-artifact`.

## Steps

A1. Confirm the write set. The user's request or the inbound flag determines what to write — only what was asked. Default mappings:
   - "Write the SDR" / `[STRATEGIC REVIEW NEEDED]` ratification → SDR only.
   - "Draft the charter for <context>" → that charter only.
   - "Map the contexts" / "update the context map" → context map only.
   - "Add <term> to the glossary" → that glossary entry only.
   - "Write this up" with no specification → ask which artifact(s).
   Do not auto-bundle. If multiple artifacts are genuinely required to ratify the decision (e.g. a new context needs both a charter and an SDR), say so and confirm before writing.

A2. Read only the templates in the write set: `sdr.md`, `charter.md`, `context-map.md`, `glossary.md`. Plus any existing artifact you will update.

A3. Resolve the framing analyst report deterministically: explicit reference → use it; else lex-sort `artifacts/reports/` — one file → use it; multiple → ask; none → continue. Once resolved, scan for `[CONSULTANT REVIEW NEEDED]`, `CONSULTANT REVIEW NEEDED:`, `STRATEGIC REVIEW NEEDED:`; treat each as a binding input. Conflict with the request → surface before proceeding.

A4. Scan `artifacts/adr/` for `[STRATEGIC REVIEW NEEDED]`. Each is a binding input.

A5. Check for ratified conflicts:
   - (a) classifies a subdomain a way this request would change; (b) draws a boundary this request would move/dissolve; (c) establishes a relationship this request would invert/replace; (d) status is `Ratified` and the request would supersede without explicit instruction.
   Note conflicts. Type (d) → stop and confirm supersession with the user before writing.

A6. **Binding constraints** (for SDRs). Load `assets/scoring.yaml#consultant` and walk the algorithm: score each constraint High/Medium/Low against the signal table, sort by score then list position, take the first 2. No signal fits → ask the user, do not infer.

A7. **Alternatives** (for SDRs). Name exactly 2, each with the single business reason it was ruled out. A genuine alternative must (a) satisfy at least one binding constraint; (b) cite a named DDD/industry source. Fewer than 2 → render `Alternative 2 — _None identified_` with `**Reason none found:** <one sentence>`. The section always renders two entries.

A8. Write only what's in the write set, in this order if multiple were requested:
   - **Charter(s):** one per affected context. Update in place if exists (increment `**Revision:**`); create if not.
   - **Context map:** update most relevant existing map (default `current.md`) or create. Every listed context must have a charter — if not, write the charter first.
   - **SDR:** per `templates/sdr.md`. Move every technical item to `Tactical follow-up` with `[TACTICAL DESIGN NEEDED]`.
   - **Glossary entries:** one per (term, context). Re-sort `INDEX.md` after writes.

A9. Write memory entries per each touched template's `Memory format`.

## Mode-specific closing self-check

Boxes live in `assets/selfcheck.yaml#consultant-artifact`. Loaded by the shell.

## Output format

Emit exactly:

```
<one-paragraph summary of the direction and what was written>

Artifacts written/updated:
- SDR: artifacts/strategy/decisions/NNNNN-<short-title>.md | _N/A_
- Charters: <paths, or _N/A_>
- Context map: <path, or _N/A_>
- Glossary entries: <terms, or _N/A_>

Binding constraints: <constraint-1>, <constraint-2> | _N/A — no SDR written_
Tactical follow-up: yes — see [TACTICAL DESIGN NEEDED] items in SDR-NNNNN. | no | _N/A_
```

## Tokens (this mode)

- **Emits:** `[TACTICAL DESIGN NEEDED]`.
- **Consumes:** `[CONSULTANT REVIEW NEEDED]` / `CONSULTANT REVIEW NEEDED:` / `STRATEGIC REVIEW NEEDED:` (analyst); `[STRATEGIC REVIEW NEEDED]` (architect).
