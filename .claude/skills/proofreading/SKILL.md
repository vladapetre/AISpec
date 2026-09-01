---
name: proofreading
description: >
  Proofread a document that will be read outside the team (public documentation,
  a customer email, a README, a release note, a spec handed to another company)
  and report every defect as a located, quoted, rule-backed finding before any
  text is changed. Runs five passes: mechanics and grammar, internal consistency
  and facts, clarity for the named audience, house style, and completeness or
  safety to send. Use this skill when the user says "proofread this", "check this
  before I send it", "is this clear?", "polish this email", "review this doc for
  typos", "make sure this reads well externally", or hands over prose whose next
  stop is a person outside the project. Invoke standalone via
  `/proofreading <path or pasted text>`. Not preloaded into any agent.
---

# Skill: proofreading

Makes a document correct, unambiguous, and safe to send to someone who cannot ask a follow-up question. It reports first and edits only on request, because the author owns the voice and the facts.

**Shape:** linear. Standalone via `/proofreading [path | pasted text]`.

---

## User input

```text
$ARGUMENTS
```

A file path, a directory of documents, a URL, or pasted text. Empty input: ask which document, then stop. Never proofread "the last thing we discussed" by guess.

---

## Non-negotiables

These four rules outrank every check below. They are why this skill is safe to run on a document you did not write.

1. **Report before you change.** The default deliverable is a findings list, not a rewritten document. Rewriting happens only when the user asks, and then only for the findings they accepted.
2. **Preserve the author's voice.** Fix defects, do not impose taste. A sentence longer than you would write it, but clear, correct, and on register, is not a finding.
3. **Never invent a fact.** A number, name, date, version, price, link target, or claim that cannot be verified from the document or the repository is a question for the author, not a correction. Guessing a fact in a document going to a customer is the worst failure this skill can produce.
4. **Every finding quotes the text and names a rule.** A finding with no quoted span and no named reason is an opinion. Drop it.

---

## Step 0: scope the read (always first)

Before the first pass, settle four things. Three come from the user or the document; the fourth you decide.

| Fact | How to get it | If unknown |
|---|---|---|
| **Audience** | Ask, or read it off the document (customer, end user, another dev team, an auditor, a mailing list) | Ask. Clarity is measured against a reader, so with no reader there is no measurement. |
| **Purpose** | What should the reader do or believe after reading? | Ask. |
| **Surface** | Email, public docs site, README, PDF, ticket, changelog | Infer from the path or format, and say what you inferred. |
| **House style applies?** | Yes for prose authored in this repo. No for text pasted from elsewhere or bound to an external style guide. | Default: report house-style hits as level 2, never as errors. |

State all four in one line at the top of the report. A proofread against the wrong audience is worse than none, because it still reads as authoritative.

---

## Change levels

Every finding carries a level, and the level decides what you may do with it.

| Level | Name | Examples | Action |
|---|---|---|---|
| **L0** | Error | Misspelling, doubled word ("the the"), subject/verb disagreement, sentence fragment, broken markdown, dead relative link, wrong list numbering, unbalanced code fence, wrong product-name casing | Report with the exact replacement. Safe to apply in apply mode without a per-item question. |
| **L1** | Clarity defect | Ambiguous pronoun, acronym undefined on first use, a sentence with two readings, a missing step in an instruction, passive voice hiding who acts, dangling modifier | Report with a proposed rewrite. Apply only on the user's go-ahead. |
| **L2** | Style or preference | House-style hits (dashes, bullet-heavy explanation, fancy vocabulary), tone drift, harmless redundancy | List compactly. Never apply unasked. |
| **L3** | Substance | An unverifiable claim, a number that does not add up, a promise the product may not keep, a missing caveat, anything legally or contractually loaded | Ask. Never fix. Mark as blocking when the document leaves the company. |

Two disciplines come from the Distributed Proofreaders guidelines, which govern proofreading against a source you may not alter: **minimal intervention** (change what is wrong, leave what is merely different) and **no silent substantive edits** (a change that alters meaning stops being proofreading and becomes authorship, so it goes back to the author). Both apply here unchanged.

---

## Technique: how to actually catch things

Adapted from the Indiana University Writing Tutorial Services proofreading guide. Reading a document once, top to bottom, looking for everything at once, is the method that misses the most.

- **One error class at a time.** Each sweep in pass 1 hunts a single class (spelling, then commas, then agreement, then pronouns). A sweep looking for everything finds the obvious and skips the rest.
- **Read the sentences in reverse order** for the spelling and grammar sweep: last sentence first. Reading in order lets meaning carry you past a broken sentence, because you read what you expect. In reverse, each sentence stands alone.
- **Never trust a spell checker, and never trust instinct on a word.** A homonym that passes the checker ("its" for "it's", "affect" for "effect", "principle" for "principal") is the most common surviving error. Check the doubtful word against a source, and check every product, person, and API name against the repository or the user, not memory.
- **Keep the recurring-error list.** `references/recurring-errors.md` holds the classes and specific words this project keeps getting wrong. Read it before pass 1, and append a line whenever the same defect turns up a second time across documents. A known-error list turns a general hunt into a targeted one.

---

## The five passes

Run them in order, and keep them separate. Mixing passes is how a typo hunt turns into a rewrite.

### Pass 1: mechanics and grammar

Six classes, one sweep each: **spelling and homonyms** · **punctuation** (commas, apostrophes, terminal punctuation, quote and bracket pairing) · **verbs** (tense that shifts mid-document, passive voice that hides the actor) · **subject/verb agreement** · **pronouns** (agreement with the antecedent, and vague or two-way references) · **other grammar** (fragments, run-ons, misplaced or dangling modifiers).

Then markdown integrity (heading levels not skipped, list numbering continuous, code fences balanced and labelled, tables well formed) and link integrity (relative links resolve on disk; external links are reported as unverified unless the user allows fetching).

Run the mechanical sweeps with tools rather than by eye. Grep finds every instance; reading finds most of them.

```bash
f=<path>
grep -nEi '\b([a-z]+) \1\b' "$f"                  # doubled words
grep -nE '\b(its|it.s|affect|effect|their|there|they.re|your|you.re|then|than|principle|principal|complement|compliment|ensure|insure)\b' "$f"
grep -nE '[—–]' "$f"                              # dashes (house style)
grep -nE ' +$' "$f"                               # trailing whitespace
grep -nE '\b(TODO|TBD|FIXME|XXX|Lorem ipsum)\b' "$f"   # leftovers that must never ship
grep -cE '^```' "$f"                              # code fences: the count must be even
grep -nE '^#{1,6} ' "$f"                          # heading ladder: check for skipped levels
grep -oE '\]\([^)#][^)]*\)' "$f"                  # relative links: test each target exists
```

The homonym grep lists candidates, not errors: read each hit in context and keep only the wrong ones.

### Pass 2: internal consistency and facts

One name per concept, used the same way throughout; where the project has a glossary at `.claude/MEMORY.md`, the document must agree with it. Numbers that must agree do agree. Dates, versions, environment names, endpoints, and file paths match reality: check identifiers and paths against the repository when the document describes this project. Cross-references resolve ("as described above" points at something that exists). Examples work: a command's flags exist, a JSON sample parses, a code sample would compile.

Anything unverifiable becomes an L3 question. Anything the repo contradicts becomes an L0 with the evidence quoted.

### Pass 3: clarity for the named audience

Read as the audience from step 0, who cannot ask you a question.

Check that the opening says what the document is and who it is for; every acronym and internal term is expanded on first use or dropped; each sentence has exactly one reading (a pronoun with two possible antecedents is a defect, not a nitpick); instructions run in the order they are performed and each step names its actor; anything the reader must do is stated as an action rather than implied; and every abstract claim that matters carries one concrete example with real values.

The test for an instruction is mechanical: could a competent stranger follow it without opening a second document? If not, name what is missing.

### Pass 4: house style

Applies to prose authored in this repo (see step 0). The rules live in `.claude/output-styles/custom.md`: no em or en dashes, prose over bullets, plain English with real examples, lead with the answer, no preamble or padded closers. Flag hits with the replacement at level 2, or at level 0 when the user has said house style is binding for this document.

When the document must match an external style guide instead (a customer's template, a journal, a vendor's docs), ask for the guide and check against that. Do not apply house style to someone else's document.

### Pass 5: completeness and safety to send

The last pass asks what is not there: missing prerequisites, missing failure or error path, missing version or scope statement ("applies to v2.3 and later"), missing contact or next step, an unstated assumption about the reader's setup, an unhedged promise, and anything sensitive that should not leave the building (internal hostnames, credentials or tokens, customer names, unreleased plans, personal data).

A sensitive-content hit goes at the top of the report, above the table, however clean the rest is.

---

## Output format

One header line, then blocking items, then the findings table, then the verdict. No preamble.

```md
**Proofread:** <path> · **Audience:** <who> · **Purpose:** <what they do next> · **Surface:** <email | docs | README | ...> · **House style:** <applied | reported only | external guide: X>

**Blocking (L3 / sensitive):**
- <one line each, or "none">

| # | Loc | Lvl | Finding | Current | Proposed |
|---|---|---|---|---|---|
| 1 | L42 | L0 | Doubled word | "the the request" | "the request" |
| 2 | L57 | L1 | Ambiguous pronoun: "it" reads as the token or the session | "...until it expires" | "...until the token expires" |
| 3 | L60 | L3 | Unverifiable retention claim, customer-facing | "data is deleted within 24h" | ask the author |

**Verdict:** READY TO SEND | NEEDS FIXES (n L0, n L1, n L2, n L3)
```

Table rules: `Loc` is a line number for a file (`L42`) or a short quoted anchor for pasted text. Quote the smallest span that shows the defect, never the whole paragraph. Every L0 and L1 row carries a `Proposed` value ready to paste; an L3 row's proposal is the question to ask. More than five L2 rows collapse into one row with a count and a two-word summary, so preference noise never buries an error.

`READY TO SEND` requires zero L0 and zero blocking L3. L1 and L2 findings may remain, since the author may accept them.

---

## Apply mode

Triggered when the user asks for the fixes ("apply", "fix them", "just do it") or names a subset ("apply the L0s").

1. Apply accepted findings only, one edit per finding, as exact-span replacements. Never reflow a paragraph you were not asked to change, and never restructure the document.
2. Never apply an L3. If the user says "apply everything", apply L0 to L2 and list the L3 items again as still open.
3. For a file under `artifacts/`, respect the ownership table in CLAUDE.md: route the edit to the owning agent instead of writing directly. Any other file is edited in place.
4. After applying, re-run pass 1's mechanical sweeps on the result and report the new counts. An edit that introduces a defect is the common failure here.
5. For pasted text with no file, deliver the corrected document in one fenced block with nothing else inside the fence.
6. Append to `references/recurring-errors.md` any defect class this document repeated three or more times, or that has now appeared in two different documents.

---

## Multiple documents

For a directory or a list: proofread each separately, one table per document, then add one cross-document section for terminology that differs between them. That is the most common defect in a document set and the one a per-file read cannot see. Order the deliverable worst first, by L0 count.

---

## Bundled resources

```
.claude/skills/proofreading/
  SKILL.md                        this file
  references/recurring-errors.md  project-specific error classes, read before pass 1
```
