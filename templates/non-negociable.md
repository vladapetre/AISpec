# Non-Negotiable Requirements — Agents & Skills

These rules are **mandatory** when authoring or refactoring any agent or skill in this repository. No exceptions, no "but in this case." If a requirement conflicts with a stylistic preference, the requirement wins.

## 1. Optimized for LLM Consumption

- Write for a reader that is an LLM, not a human browsing docs. Drop prose that exists only for warmth, flow, or narrative.
- Use **structural cues** the model parses cheaply: headings, bullet lists, fenced blocks, tables. Avoid long paragraphs.
- Put the **directive first**, justification second (or omit if obvious). No lead-in sentences ("In this section, we will…").
- Use **imperative voice** ("Write X", "Return Y"). Never "you might want to" or "it could be helpful to".
- Define a **single canonical term** per concept and reuse it verbatim. No synonyms for stylistic variety.
- Refer to other artifacts by **exact path or slug**, never by paraphrase.

## 2. Deterministic Output (≥90% structural determinism)

- Every agent/skill MUST declare an explicit `<output_format>` (or equivalent named contract) that the model fills in.
- The structure — section headings, field names, ordering, fenced-block fences, list vs. table — MUST be identical across runs for the same input class. Free-text *inside* a field may vary; the scaffold may not.
- Forbidden: "optional sections", "include if relevant", "feel free to add". If a section is conditional, specify the **exact trigger** and the **exact placeholder** when absent (e.g. `_None_`).
- Forbidden: open-ended closers like "let me know if…", "hope this helps", trailing summaries that restate the body.
- Every enumerated output (verdicts, severities, statuses) MUST come from a **closed vocabulary** declared in the agent/skill (e.g. `APPROVED | CHANGES REQUIRED`). No ad-hoc labels.
- Filenames, slugs, and identifiers MUST be derived by a stated rule (kebab-case, date prefix, etc.), not invented per run.

## 3. Consistency

- Same input class → same shape of output, same field order, same vocabulary, same tone — across agents, skills, and invocations.
- Cross-references between agents/skills MUST use the canonical slug/path. If `documenting` calls a template `adr.md`, every caller writes `adr.md` — not `ADR template`, not `the ADR doc`.
- Severity, status, and verdict labels are **shared across the repo**. Do not redefine them locally. If a new label is needed, add it to the shared vocabulary first.
- Frontmatter fields (`name`, `description`, `skills`, etc.) MUST follow the existing schema exactly. No new top-level fields without updating every consumer.
- Examples inside an agent/skill MUST exhibit the same structure the agent/skill demands of its output. Lead by example.

## 4. Token Economy

- Every token must earn its place. If removing a sentence does not change behavior, remove it.
- No restating the obvious from CLAUDE.md, no re-explaining tools the agent already has, no recap of what was just said.
- No emojis, no decorative separators (`===`, `---` lines beyond markdown semantics), no ASCII art.
- No multi-paragraph rationale where a single clause suffices. Reasons live on one line, prefixed `Why:` or in parens.
- Prefer **tables and bullets over prose**: a 5-row table beats five paragraphs.
- Examples MUST be **minimal and load-bearing**. One example per pattern, not three variations. Cut dialogue framing ("user said…", "then I replied…") unless the dialogue itself is the pattern.
- Skill/agent bodies SHOULD stay under the smallest size that still encodes the contract. If a section can be replaced by a reference to a template under `templates/`, replace it.
- Avoid restating output schema in both narrative and code-fence form. Pick one — the fenced form.

## 5. Enforcement

- A pull request touching `agents/` or `skills/` MUST be checked against this file. Any deviation requires the deviation to be called out explicitly and justified in the PR description.
- When refactoring an existing agent/skill, the refactor MUST reduce or hold token count — never inflate it — unless the additions are required by a new contract.
- If two requirements above appear to conflict, the order of precedence is: **2 (determinism) → 3 (consistency) → 1 (LLM-readability) → 4 (token economy)**.
