export const meta = {
  name: 'analyst.verify-assumptions',
  description: 'Parallel verification of load-bearing assumptions against live code/schema, with adversarial cross-examination of confirmations',
  whenToUse: "The architect's A9b assumption gate produced claims to verify, or any set of independent factual claims about existing code/schema/data needs checking before a design builds on them",
  phases: [
    { title: 'Verify', detail: 'one verifier per claim, in parallel' },
    { title: 'Cross-examine', detail: 'a refuter attacks every CONFIRMED verdict' },
    { title: 'Assemble', detail: 'deterministic verdict table (+ report file for larger sets)' },
  ],
}

// args: { assumptions: [{id?, claim, source?}] | [string] (required),
//         context?: '<one-line framing, e.g. the ADR being designed>', date?: 'YYYY-MM-DD' }
// Defensive: some invocation paths deliver args as a JSON string.
const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
if (!Array.isArray(A.assumptions) || !A.assumptions.length) throw new Error('args.assumptions (array of claims) is required')
const claims = A.assumptions.map((a, i) => (typeof a === 'string' ? { id: `A-${i + 1}`, claim: a } : { id: a.id ?? `A-${i + 1}`, ...a }))
// No Date.now() in workflow scripts (breaks resume) — when the caller omits
// date, downstream agents resolve "today" themselves instead of a sentinel
// leaking into filenames/index lines.
const DATE = A.date ?? 'TODAY (resolve the current ISO date yourself before writing)'

const V_SCHEMA = {
  type: 'object',
  required: ['verdict', 'evidence'],
  properties: {
    verdict: { type: 'string', enum: ['CONFIRMED', 'REFUTED', 'UNRESOLVED'] },
    evidence: { type: 'string' },
    note: { type: 'string' },
  },
}

// ---------------------------------------------------------------- Verify → Cross-examine (pipelined per claim)
phase('Verify')
const results = await pipeline(
  claims,
  (c) =>
    agent(
      `Verify ONE factual claim about the existing codebase/schema/data. Read-only — Grep/Read/git; for DB claims check entity configs, migrations, and raw SQL in the repo.${A.context ? `\nContext: ${A.context}` : ''}
Claim ${c.id}: ${c.claim}${c.source ? `\n(Originating finding/source: ${c.source})` : ''}
Rules: CONFIRMED or REFUTED require dispositive evidence you cite (file:line, migration, config key — something a reader can open). If the sources reachable from this repo cannot settle it, return UNRESOLVED with what WOULD settle it in the note. Never guess; an UNRESOLVED is a valid, useful answer — a wrong CONFIRMED costs amendment rounds.
Return ONLY the JSON.`,
      { label: `verify:${c.id}`, phase: 'Verify', schema: V_SCHEMA }
    ),
  async (v, c) => {
    if (!v) return { ...c, verdict: 'UNRESOLVED', evidence: '', note: 'verifier agent failed' }
    if (v.verdict !== 'CONFIRMED') return { ...c, ...v }
    // A wrong CONFIRMED is the expensive failure — designs build on it. Cross-examine it.
    const x = await agent(
      `Adversarially attack this confirmation. Read-only.
Claim ${c.id}: ${c.claim}
Confirmed with evidence: ${v.evidence}
Open the cited evidence yourself. Is the citation real, current, and does it actually entail the claim (not merely relate to it)? Look for the classic trap: a similarly-named table/column/flag that is NOT the one the claim is about. Return ONLY the JSON: {holds: bool, reason}.`,
      { label: `xexam:${c.id}`, phase: 'Cross-examine', effort: 'medium', schema: { type: 'object', required: ['holds', 'reason'], properties: { holds: { type: 'boolean' }, reason: { type: 'string' } } } }
    )
    // Fail-closed on the expensive side: a dead cross-examiner must not let a
    // CONFIRMED stand unexamined — designs build on CONFIRMED.
    if (!x) return { ...c, verdict: 'UNRESOLVED', evidence: v.evidence, note: 'cross-examiner failed — confirmation unexamined' }
    if (!x.holds) return { ...c, verdict: 'UNRESOLVED', evidence: v.evidence, note: `confirmation challenged: ${x.reason}` }
    return { ...c, ...v }
  }
)

// ---------------------------------------------------------------- Assemble (deterministic)
phase('Assemble')
const by = (verdict) => results.filter((r) => r.verdict === verdict)
const block = `## Assumption Verification — ${A.context ?? claims.length + ' claims'}
**Date:** ${DATE}

| ID | Claim | Verdict | Evidence | Note |
|---|---|---|---|---|
${results.map((r) => `| ${r.id} | ${r.claim} | ${r.verdict} | ${r.evidence ?? ''} | ${r.note ?? ''} |`).join('\n')}

**Summary:** ${by('CONFIRMED').length} confirmed / ${by('REFUTED').length} refuted / ${by('UNRESOLVED').length} unresolved.
${by('REFUTED').length ? 'Refuted claims invalidate the decisions that rest on them — revise before implementation (A9b).' : ''}${by('UNRESOLVED').length ? '\nUnresolved claims must be downgraded to plan [UNKNOWN]s with named fallbacks (A9b) — they cannot silently carry acceptance criteria.' : ''}`

let reportPath = null
if (claims.length >= 4 || A.report) {
  const w = await agent(
    `Write this verification block verbatim to a report file. Derive the stem: run \`node .claude/skills/documenting/scripts/filename.mjs report "verify ${(A.context ?? claims[0].claim).slice(0, 60)}"\`, write to artifacts/reports/<stem>.md, then append ONE index line (≤2 lines/≤50 words) to .claude/agent-memory/analyst/MEMORY.md pointing at it with the summary counts. Return ONLY the JSON: {path}.
---
${block}`,
    { label: 'report', phase: 'Assemble', effort: 'low', schema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } }
  )
  reportPath = w?.path ?? null
}

return {
  confirmed: by('CONFIRMED').map((r) => r.id),
  refuted: by('REFUTED').map((r) => ({ id: r.id, evidence: r.evidence })),
  unresolved: by('UNRESOLVED').map((r) => ({ id: r.id, note: r.note })),
  report: reportPath,
  block,
}
