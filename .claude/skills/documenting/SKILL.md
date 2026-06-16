---
name: documenting
description: >
  Routes structured artifact writes — analysis reports, ADRs, implementation plans,
  bounded-context charters, context maps, strategic decision records (SDRs), and
  glossary entries — to template files under `.claude/skills/documenting/templates/`,
  with shared filename derivation, audience detection, and confidence markers. Use
  this skill when the user says "write a report", "document this", "create an ADR",
  "draft a plan", "write a charter", "map the contexts", "add a glossary entry", or
  when a structured artifact must be produced from an unstructured discussion.
  Invoke standalone via `/documenting`, or load via the `skills:` frontmatter field
  on the analyst, architect, and consultant agents.
---

# Skill: documenting

Central registry for output-format conventions and artifact templates. Agents load this skill to get shared formatting rules and a pointer to the right template.

**Shape:** linear. Dual-mode — standalone via `/documenting`, or loaded via `skills:` frontmatter.

---

## Template registry

| Artifact type             | Template                             | Produced by  |
|---------------------------|--------------------------------------|--------------|
| Analysis report           | `templates/report.md`                | analyst      |
| ADR (tactical)            | `templates/adr.md`                   | architect    |
| Implementation plan       | `templates/plan.md`                  | architect    |
| Progress                  | `templates/progress.md`              | developer    |
| Bounded context charter   | `templates/charter.md`               | consultant   |
| Context map               | `templates/context-map.md`           | consultant   |
| Strategic decision (SDR)  | `templates/sdr.md`                   | consultant   |
| Glossary entry            | `templates/glossary.md`              | consultant   |
| REST API documentation    | `templates/api.md`                   | analyst (or user via `/documenting`) |

Read the template for your artifact type before writing. Worked examples (`report`, `adr`, `plan`, `progress`, `api`) live in `examples/<type>.md` — read only if uncertain about tone or section shape after reading the template.

**Tactical ADR vs SDR.** `adr.md` is for tactical decisions (architect — implementation patterns, component design, API shape within a context). `sdr.md` is for strategic decision records (consultant — subdomain investment, context boundaries, build/buy/outsource, relationship pattern). The file name is the disambiguator: never use `adr.md` for a strategic decision. Numbering is independent: tactical at `artifacts/adr/NNNNN-*`, strategic at `artifacts/strategy/decisions/NNNNN-*`.

---

## Shared conventions

### Audience detection

| Signal in request | Audience |
|---|---|
| "stakeholder", "executive", "non-technical", "business" | stakeholder — omit implementation detail |
| "developer", "engineer", "implementer", "codebase" | developer — include implementation detail |
| "collaborator", "team" | collaborator |
| Multiple match | ask which one |
| No match | technical collaborator |

**Per artifact type:**

| Type | Audience rule |
|---|---|
| Analysis report | Run detection above |
| ADR (tactical) | Always developer |
| Implementation plan | Always developer |
| Charter | Always strategic-stakeholder |
| Context map | Always strategic-stakeholder |
| SDR | Always strategic-stakeholder |
| Glossary | Always mixed — business-language definition first, implementation pointer second |
| Progress | Always developer |
| API documentation | Always external integrator — no source access; no implementation leakage |

Only analysis reports run detection. All other types use the fixed audience.

### Filename derivation

Derived deterministically by `scripts/filename.mjs`. Run it — do not derive by hand:

```bash
node .claude/skills/documenting/scripts/filename.mjs <type> "<subject>"
```

Supported types: `report`, `adr`, `plan`, `sdr`, `charter`, `context-map`, `glossary`, `progress`, `api`.

`<subject>` is the subject noun phrase from the request. The script strips a leading meta verb, lowercases, drops stopwords, hyphenates, truncates to 5 tokens, then applies a per-type suffix and (where applicable) a zero-padded 5-digit sequence prefix scanned from the host directory.

| Input subject | Type | Stem |
|---|---|---|
| "Analysis of the Auth Middleware" | report | `auth-middleware-analysis` |
| "Design of the Auth Middleware" | adr | `00002-auth-middleware` |
| "Design of the Auth Middleware" | plan | `00002-auth-middleware` (after paired ADR exists) |
| "Plan for migrating the user service to gRPC" | plan | `migrating-user-service-grpc` (unprefixed — no matching ADR) |
| "Build vs buy for payments" | sdr | `00001-build-vs-buy-payments` (scans `artifacts/strategy/decisions/`) |
| "Charter for the Billing context" | charter | `billing-context-charter` |
| "Context map for the platform" | context-map | `platform-context-map` |
| "Glossary for the Order domain" | glossary | `order-domain-glossary` |
| "auth rewrite" | progress | `plan-auth-rewrite-progress` |
| "POST /v1/rental-orders/confirm" | api | `rental-orders-confirm` (HTTP method + version segment stripped) |

For a paired ADR and plan, run with the **same** `<subject>` for each — write the ADR first so the plan inherits the prefix. SDR numbering is independent of ADR numbering; the script scans `artifacts/strategy/decisions/` for SDR sequence and `artifacts/adr/` for ADR sequence.

### Confidence markers

Marker strings (`[VERIFIED]`, `[INFERRED]`, `[ASSUMED]`) are defined in `tokens.yaml`. This section defines *when* to apply each. First match wins:

1. Direct quote, observable fact, or value readable from the source without reasoning → **[VERIFIED]**
2. Follows necessarily from one or more VERIFIED facts via explicit deductive steps → **[INFERRED]**
3. Source does not address the finding, or the finding requires assumptions not grounded in the source → **[ASSUMED]**

A finding that mixes verifiable and inferred content takes the weakest marker that applies. Split into sub-points to keep verified parts `[VERIFIED]`. Confidence markers do not apply to ADRs or plans.

### Export to Word (pandoc)

Any artifact type can be exported to a styled `.docx` after its Markdown is written. API documentation is the primary consumer; the mechanism is general and works for every template.

> **The ONLY supported way to export is `scripts/export.mjs`.** Never call `pandoc` directly and never hand-roll the conversion. A bare `pandoc` call (or one missing `--reference-doc`) produces a document whose styling lives only in named-style *definitions* — which **Word and LibreOffice render but Google Docs and many converters discard, showing an unstyled document**. `export.mjs` applies the reference styling *and* flattens it into direct formatting (via `docx-postprocess.mjs`) so the result renders identically in every viewer. If the script errors, fix the cause and re-run it — do not fall back to plain pandoc.

**Trigger.** The user passes `--export` (optionally `--export <path/file.docx>`) in the request. Parse it before writing:
- Strip the flag (and its optional value) from the input before treating the remainder as the subject.
- No value given → derive the output path from the artifact's own derived short-title in its artifact directory (e.g. `artifacts/api/<short-title>.docx`).
- A value given → use exactly that path; create any missing parent directories.

**Steps** (run only when `--export` was present, after the Markdown file is fully written):

1. Ensure the Markdown is saved to disk at its artifact path.
2. Run the export script exactly as below (cross-OS — Node + pandoc only; no PowerShell or Python). Use the path verbatim; do not substitute a manual `pandoc` invocation:

   ```bash
   node .claude/skills/documenting/scripts/export.mjs --input "<artifact>.md" --output "<artifact>.docx"
   ```

   The script: (a) invokes pandoc with the bundled `scripts/reference.docx` styling, then (b) post-processes the result with `scripts/docx-postprocess.mjs` — rescales tables to the text area, applies table borders, shades and bolds the header row, bands body rows, normalises heading sizes/colours/fonts, strips anchor bookmarks, and **flattens all of that into direct formatting** so styling survives Word, LibreOffice, and Google Docs alike. Pass `--reference <ref.docx>` only to override the styling template.
3. Verify the script printed `Done: <path>` and exited 0. Report the `.md` path, the `.docx` path, and the outcome. If pandoc is not installed the script prints the install message from <https://pandoc.org/installing.html> and exits non-zero — relay that and stop. **Never report success on a non-zero exit, and never produce the `.docx` by any means other than this script.**

---

## Steps (standalone invocation)

When invoked directly as `/documenting`:

1. No subject, notes, or sources → ask "What should I document? Provide a subject and any notes or sources." Stop. Parse any `--export` flag first (see **Export to Word (pandoc)**).
2. Identify artifact type. Analysis report → run **Audience detection**. ADR or plan → skip (always developer). API documentation → skip (always external integrator).
3. Derive filename via `scripts/filename.mjs`.
4. Read the template for the artifact type.
5. Write the artifact using that template.
6. Write the memory entry defined in the template.
7. If `--export` was present, run the export steps under **Export to Word (pandoc)**.
8. Output a one-paragraph summary: what was produced, where, the `.docx` path if exported, and whether architect review is flagged.

Agents that load this skill for format reference join at step 3 once input is validated and artifact type known.

---

## Bundled resources

```
.claude/skills/documenting/
  SKILL.md                      this file
  scripts/filename.mjs          deterministic filename-stem derivation (Node)
  scripts/export.mjs            Markdown → styled .docx via pandoc (cross-OS, Node)
  scripts/docx-postprocess.mjs  in-place .docx table/heading/spacing fixes (pure Node)
  scripts/reference.docx        pandoc reference doc (Word styling template)
  templates/                    one artifact skeleton per registered type (read on demand)
  examples/                     worked examples (report, adr, plan, progress, api)
```
