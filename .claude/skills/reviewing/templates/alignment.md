# Template: Alignment Check

**Purpose:** Verify that every acceptance criterion in the plan phase is satisfied by the implementation. This is a mechanical mapping exercise — not a quality judgement.

---

## Caps and overflow

| Field | Cap | Overflow path |
|---|---|---|
| Alignment-table rows per phase | **≤15 acceptance criteria** | Past 15, the phase was too large and should have been split by the architect. The reviewer evaluates the 15 highest-priority criteria (FAIL-eligible first, then UNCLEAR, then PASS candidates) and emits `ARCHITECT AMENDMENT NEEDED: phase too large — N criteria exceed cap` alongside the verdict. |

The cap is on the table, not on the criteria the architect may write — the plan's own per-phase cap (`templates/plan.md`, 3–8 criteria) is what keeps phases reviewable. This row gives the reviewer a deterministic procedure when an over-sized phase reaches them anyway.

---

## How to apply

1. Extract every bullet or sub-item listed under "**Done when:**" in the current phase.
   - If the plan uses a different acceptance section label (e.g., "Acceptance criteria", "Exit criteria"), use that instead.
   - If the phase has no explicit criteria section, use the phase description bullet points.

2. For each criterion, find the code evidence:
   - A function, method, class, or module that implements it.
   - A test assertion that verifies it.
   - A configuration entry or schema definition that satisfies it.

3. Classify:
   - **PASS** — evidence exists and fully satisfies the criterion. Both the "what" and the "how" must match. Example: if the criterion says "returns HTTP 404 when resource not found", the evidence must be a 404 response — a 400 or an exception is a FAIL.
   - **FAIL** — evidence is absent, covers only part of the criterion, or contradicts it.
   - **UNCLEAR** — the criterion uses words like "should", "consider", "as needed", or "if applicable" without defining a concrete condition. Do not attempt to interpret these — mark UNCLEAR and surface to the architect for clarification.

4. Populate the alignment table in the review output.

---

## Alignment-specific severity rules

| Finding | Severity |
|---------|----------|
| Criterion marked FAIL | **Critical** — blocks approval |
| Criterion marked UNCLEAR | **Critical** — blocks approval (architect must clarify before proceeding) |
| Criterion partially satisfied (core behaviour present, edge case missing) | **Major** — note the gap; does not block if the missing edge case is not in the "Done when" text |

---

## Evidence quality rules

Evidence must be direct and traceable:

| Evidence type | Acceptable |
|---------------|------------|
| `file:line` pointing to the exact implementation | Yes |
| Test function name + assertion | Yes |
| Config key + value | Yes |
| "The whole file was updated" | No — be specific |
| "I assume this is handled elsewhere" | No — find the evidence or mark FAIL |
| "The framework handles this automatically" | Only if the framework's documented behaviour matches the criterion — cite the specific mechanism (middleware, attribute, etc.) |
