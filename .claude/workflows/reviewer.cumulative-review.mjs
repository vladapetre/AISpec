export const meta = {
  name: 'reviewer.cumulative-review',
  description: 'Fan-out cumulative review: parallel dimensions, adversarial verification of findings, deterministic verdict',
  whenToUse: 'End-of-plan cumulative review when the user explicitly opts into the accelerated multi-agent path (default remains the reviewer teammate)',
  phases: [
    { title: 'Scope', detail: 'read plan/ADR/summary/diff once; extract criteria, decisions, changed files, gate' },
    { title: 'Review', detail: 'one agent per dimension, in parallel' },
    { title: 'Verify', detail: 'adversarial refutation of Critical/Major findings' },
    { title: 'Assemble', detail: 'deterministic merge, verdict, memory line' },
  ],
}

// args: { plan: 'artifacts/plans/<x>.md' (required), summary?: '<All Phases Complete text>',
//         range?: '<first..last>', date?: 'YYYY-MM-DD' }
const A = args ?? {}
if (!A.plan) throw new Error('args.plan (plan path) is required')
const DATE = A.date ?? '<fill: today>'

// ---------------------------------------------------------------- Scope
phase('Scope')
const SCOPE = await agent(
  `You are scoping a cumulative code review. Read-only. Steps:
1. Read the plan at ${A.plan}. Extract every acceptance criterion as {id: "T-N.seq", text} (verbatim), each phase title, and the **Governing ADR:** pointer.
2. Read the governing ADR (follow the pointer; if it is a supersession -rN, also read each ancestor's Revised decision/Delta consequences plus the root's Decision/Consequences — together they are the effective ADR). Extract each key decision as {id: "D-###", text} including every [IRREVERSIBLE] consequence.
3. Resolve the commit range: ${A.range ? `use ${A.range}` : `take it from this developer summary:\n---\n${A.summary ?? '(none provided — derive from the plan branch: default-branch..HEAD in the repo containing the changed files)'}\n---`}
   Nested-repo rule: run git -C inside the repo that actually contains the changed files.
4. git diff --name-only + --shortstat over the range → changed files, LOC.
5. Apply the framework/concern detection and diff-size gate rules from .claude/skills/reviewing/SKILL.md (read it). Security carve-out per CLAUDE.md ## Security paths.
Return ONLY the JSON.`,
  {
    label: 'scope',
    schema: {
      type: 'object',
      required: ['plan', 'adr', 'range', 'criteria', 'decisions', 'changedFiles', 'gate'],
      properties: {
        plan: { type: 'string' },
        adr: { type: 'string' },
        adrChain: { type: 'array', items: { type: 'string' } },
        range: { type: 'string' },
        repoDir: { type: 'string' },
        criteria: { type: 'array', items: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string' }, phase: { type: 'number' } } } },
        decisions: { type: 'array', items: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string' }, irreversible: { type: 'boolean' } } } },
        changedFiles: { type: 'array', items: { type: 'string' } },
        gate: { type: 'string', enum: ['small', 'medium', 'large'] },
        carveOuts: { type: 'array', items: { type: 'string' } },
        frameworks: { type: 'array', items: { type: 'string' } },
        concerns: { type: 'array', items: { type: 'string' } },
      },
    },
  }
)
if (!SCOPE) throw new Error('scope agent failed')
log(`scope: ${SCOPE.criteria.length} criteria, ${SCOPE.decisions.length} decisions, ${SCOPE.changedFiles.length} files, gate=${SCOPE.gate}`)

const CTX = `Plan: ${SCOPE.plan}\nEffective ADR: ${SCOPE.adr}${SCOPE.adrChain?.length ? ` (chain: ${SCOPE.adrChain.join(', ')})` : ''}\nCommit range: ${SCOPE.range}${SCOPE.repoDir ? ` (run git -C ${SCOPE.repoDir})` : ''}\nChanged files:\n${SCOPE.changedFiles.map((f) => `  - ${f}`).join('\n')}`

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    rows: { type: 'array', items: { type: 'object' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'check', 'file', 'summary'],
        properties: {
          severity: { type: 'string', enum: ['Critical', 'Major', 'Minor', 'Pre-existing'] },
          check: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          summary: { type: 'string' },
        },
      },
    },
  },
}

// ---------------------------------------------------------------- Review + Verify (pipelined per dimension)
const DIMENSIONS = [
  {
    key: 'alignment',
    prompt: `Acceptance-criteria alignment review. Read-only. ${CTX}\n\nFor EVERY criterion below, map it to concrete evidence (file/symbol/test) in the changed code and mark PASS (cite evidence), FAIL (absent/partial/contradicts), or UNCLEAR (too ambiguous to judge). Quote criteria verbatim by id. A FAIL is also a finding with severity Critical.\nCriteria:\n${SCOPE.criteria.map((c) => `${c.id}: ${c.text}`).join('\n')}\nReturn rows as {criterion, result, evidence, note} plus the findings array.`,
  },
  {
    key: 'adr-drift',
    prompt: `ADR-alignment review. Read-only. ${CTX}\n\nFor each ADR decision below (pattern, boundary, data shape, trade-off, every [IRREVERSIBLE] consequence): verify the diff honours it. Drift → row {decision, honoured:"DRIFT", evidence:"file:line — reason"} AND a finding (severity Major, check "adr-drift"). Clean code can still drift — judge against the decision text, not code quality.\nDecisions:\n${SCOPE.decisions.map((d) => `${d.id}: ${d.text}`).join('\n')}\nReturn rows as {decision, honoured, evidence} plus findings.`,
  },
  {
    key: 'cross-flow',
    prompt: `Cross-flow impact analysis. Read-only. ${CTX}\n\nFor each changed exported symbol, shared query, helper, guard, or config value: git grep for consumers OUTSIDE the plan's documented scope. Flag behaviour-shifting edits even when locally correct: removed/weakened dedup/filter/ordering, removed idempotency keys or early-returns, changed defaults or loop bounds, signature/return-shape changes, and ANY change to volume/frequency/recipients/trigger of a side-effecting operation (SMS/email/push/payment/queue/external write). Classify each ripple documented (named in a criterion/plan scope/ADR consequence) or undocumented. Undocumented behaviour-shifting ripple = finding — Critical if it fires duplicate side effects, corrupts a sibling flow, or changes who receives a side effect. Cite BOTH the change file:line and the consumer file:line.\nReturn rows as {changed, consumer, documented, shift, severity} plus findings. Nothing found → empty arrays.`,
  },
  {
    key: 'removed-guards',
    prompt: `Removed-guard check. Read-only. ${CTX}\n\nUsing git show/diff over the range, list every conditional, guard clause, filter, validation, early-return, or de-duplication the diff DELETES or WEAKENS (pre-image file:line). For each, find the acceptance criterion or ADR decision that explicitly mandates its removal:\n${SCOPE.criteria.map((c) => `${c.id}: ${c.text}`).join('\n')}\nA removal that reads as "redundant cleanup" is NOT exempt — locally-redundant guards are often the only enforcement on another entry path. No mandate → finding: Critical if the guard gated a side effect, security check, or validation; Major otherwise. Nothing removed → empty findings.`,
  },
  {
    key: 'code',
    prompt: `Adversarial code review. Read-only. ${CTX}\n\nGate: ${SCOPE.gate}${SCOPE.carveOuts?.length ? ` + ${SCOPE.carveOuts.join(', ')}` : ''}. Frameworks: ${SCOPE.frameworks?.join(', ') || 'none'}. Concerns: ${SCOPE.concerns?.join(', ') || 'none'}.\nLoad the matching checklist templates from .claude/skills/reviewing/templates/ per the registry and gate rules in .claude/skills/reviewing/SKILL.md, then run every applicable checklist item on the changed files. PASS → silent. FAIL → finding with severity per SKILL.md definitions and file:line cite (no cite, no finding). Tag [PRE-EXISTING] via git blame when the line's SHA is outside the range — severity "Pre-existing".`,
  },
]

phase('Review')
const reviewed = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA }),
  async (rev, d) => {
    if (!rev) return { key: d.key, rows: [], findings: [], failed: true }
    const toVerify = (rev.findings ?? []).filter((f) => f.severity === 'Critical' || f.severity === 'Major')
    if (!toVerify.length) return { key: d.key, rows: rev.rows ?? [], findings: rev.findings ?? [] }
    const verdicts = await parallel(
      toVerify.map((f) => () =>
        agent(
          `Adversarially REFUTE this code-review finding. Read the actual code (read-only). ${CTX}\n\nFinding [${f.severity}] ${f.check} at ${f.file}${f.line ? ':' + f.line : ''}: ${f.summary}\n\nIs it real — would it produce the claimed defect on concrete inputs? Default to refuted:true if you cannot reproduce the reasoning from the code itself.`,
          { label: `verify:${d.key}`, phase: 'Verify', effort: 'medium', schema: { type: 'object', required: ['refuted', 'reason'], properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } } } }
        ).then((v) => ({ f, refuted: v?.refuted ?? false, reason: v?.reason }))
      )
    )
    const kept = (rev.findings ?? []).filter((f) => {
      const v = verdicts.filter(Boolean).find((x) => x.f === f)
      return !v || !v.refuted
    })
    const dropped = toVerify.length - kept.filter((f) => f.severity === 'Critical' || f.severity === 'Major').length
    if (dropped > 0) log(`${d.key}: ${dropped} finding(s) refuted and dropped`)
    return { key: d.key, rows: rev.rows ?? [], findings: kept }
  }
)

// ---------------------------------------------------------------- Assemble (deterministic)
phase('Assemble')
const dims = Object.fromEntries(reviewed.filter(Boolean).map((r) => [r.key, r]))
const failedDims = reviewed.filter((r) => r?.failed).map((r) => r.key)
const all = reviewed.filter(Boolean).flatMap((r) => (r.findings ?? []).map((f) => ({ ...f, dim: r.key })))
const sev = (s) => all.filter((f) => f.severity === s)
const alignRows = dims['alignment']?.rows ?? []
const alignFails = alignRows.filter((r) => r.result === 'FAIL')
const alignUnclear = alignRows.filter((r) => r.result === 'UNCLEAR')
const driftRows = (dims['adr-drift']?.rows ?? []).filter((r) => r.honoured === 'DRIFT')
const crossRows = dims['cross-flow']?.rows ?? []
const undocCritical = crossRows.filter((r) => r.documented === false && r.severity === 'Critical')

const changesRequired = alignFails.length > 0 || sev('Critical').length > 0 || undocCritical.length > 0 || failedDims.length > 0
const verdict = changesRequired ? 'CHANGES REQUIRED' : 'APPROVED'
const amendment = driftRows.length ? `ARCHITECT AMENDMENT NEEDED: ${driftRows.map((r) => r.decision).join('; ')} — see ADR Alignment` : null

const fLine = (f, i) => `- [${f.severity === 'Critical' ? 'C' : f.severity === 'Major' ? 'M' : f.severity === 'Minor' ? 'm' : 'P'}${i + 1}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.check}: ${f.summary}${f.severity === 'Pre-existing' ? ' [PRE-EXISTING]' : ''}`
const list = (s) => (sev(s).length ? sev(s).map(fLine).join('\n') : '(none)')
const planStem = SCOPE.plan.split('/').pop().replace(/\.md$/, '')

const block = `## Cumulative Review — ${planStem}
**Phases:** all
**Plan:** ${SCOPE.plan}
**Governing ADR:** ${SCOPE.adr}
**Mode:** fan-out workflow (dimensions in parallel; Critical/Major findings adversarially verified)${failedDims.length ? `\n**Dimension failures:** ${failedDims.join(', ')} — verdict forced to CHANGES REQUIRED; re-run` : ''}

### 1. Acceptance-Criteria Alignment
| Criterion | Result | Evidence | Note |
|---|---|---|---|
${alignRows.map((r) => `| ${r.criterion} | ${r.result} | ${r.evidence ?? ''} | ${r.note ?? ''} |`).join('\n') || '| (scope agent returned no rows) | UNCLEAR | | |'}

**Alignment verdict:** ${alignFails.length ? `FAIL — ${alignFails.length} criteria` : alignUnclear.length ? `UNCLEAR — ${alignUnclear.length} criteria (surface to architect)` : 'PASS'}

### 2. ADR Alignment
| ADR Decision | Honoured? | Evidence / Divergence |
|---|---|---|
${(dims['adr-drift']?.rows ?? []).map((r) => `| ${r.decision} | ${r.honoured} | ${r.evidence ?? ''} |`).join('\n') || '| (none) | | |'}

**ADR-alignment verdict:** ${driftRows.length ? 'DRIFT — see ARCHITECT AMENDMENT NEEDED below' : 'HONOURED'}

### 2b. Cross-Flow Impact
| Changed element | Impacted consumer | Documented? | Behaviour shift | Severity |
|---|---|---|---|---|
${crossRows.map((r) => `| ${r.changed} | ${r.consumer} | ${r.documented ? 'YES' : 'NO'} | ${r.shift ?? ''} | ${r.severity ?? ''} |`).join('\n') || '| (none identified) | | | | |'}

**Cross-flow impact verdict:** ${crossRows.filter((r) => !r.documented).length ? `${crossRows.filter((r) => !r.documented).length} undocumented ripples (${undocCritical.length} critical)` : 'NONE IDENTIFIED'}

### 3. Code Review
**Gate:** ${SCOPE.gate}${SCOPE.carveOuts?.length ? ` + ${SCOPE.carveOuts.join(', ')}` : ''}
**Frameworks detected:** ${SCOPE.frameworks?.join(', ') || 'none'}
**Concerns detected:** ${SCOPE.concerns?.join(', ') || 'none'}
**Removed guards:** ${dims['removed-guards']?.findings?.length ? `${dims['removed-guards'].findings.length} unmandated (findings below)` : 'none unmandated'}

#### Critical — blocks approval
${list('Critical')}
#### Major — should fix before merge
${list('Major')}
#### Minor — advisory
${list('Minor')}
#### Pre-existing — not introduced by this plan
${list('Pre-existing')}

### Overall Verdict
Reason: ${changesRequired ? `${alignFails.length} alignment FAIL(s), ${sev('Critical').length} Critical, ${undocCritical.length} undocumented critical ripple(s)${failedDims.length ? `, ${failedDims.length} dimension agent(s) failed` : ''}` : 'all criteria PASS; no open Critical; no undocumented critical ripples'}
${amendment ? '\n' + amendment + '\n' : ''}
${verdict}`

// Memory line per reviewer step-16 rules (clean pass → index line only).
await agent(
  `Append ONE line to .claude/agent-memory/reviewer/MEMORY.md (create with "# Reviewer Memory" heading if missing), directly under the heading:\n- [${planStem} — cumulative (fan-out workflow)] — ${DATE}, verdict ${verdict}, ${sev('Critical').length}C/${sev('Major').length}M/${sev('Minor').length}m/${sev('Pre-existing').length}P${amendment ? ', amendment flag' : ''}\n${changesRequired ? `Also write .claude/agent-memory/reviewer/review-${planStem}-cumulative-${DATE}.md containing the review block I give you below, and point the index line at it.\n\n${block}` : 'Clean pass — index line only, no per-review file.'}`,
  { label: 'memory', phase: 'Assemble', effort: 'low' }
)

return { verdict, amendment, counts: { critical: sev('Critical').length, major: sev('Major').length, minor: sev('Minor').length, preExisting: sev('Pre-existing').length }, block }
