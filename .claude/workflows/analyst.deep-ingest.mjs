export const meta = {
  name: 'analyst.deep-ingest',
  description: 'Fan-out source ingestion: scout clusters, parallel readers, synthesis into a report, completeness-critic loop',
  whenToUse: 'Analyst-scale ingestion of large or mixed source sets where the single-context coverage cap (60-file BFS) would truncate the analysis',
  phases: [
    { title: 'Scout', detail: 'enumerate and cluster the source set' },
    { title: 'Read', detail: 'one reader per cluster, in parallel' },
    { title: 'Synthesize', detail: 'reconcile findings, assign R-###, write the report' },
    { title: 'Critic', detail: 'completeness check; gap rounds until dry (max 2)' },
  ],
}

// args: { sources: [paths/dirs/URLs/ticket keys] (required), subject: '<report subject>' (required),
//         audience?: 'developer'|'stakeholder'|'collaborator', date?: 'YYYY-MM-DD' }
// Defensive: some invocation paths deliver args as a JSON string.
const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
if (!Array.isArray(A.sources) || !A.sources.length) throw new Error('args.sources (array of paths/dirs/URLs/ticket keys) is required')
if (!A.subject) throw new Error('args.subject (report subject phrase) is required')

const MAX_CLUSTERS_PER_ROUND = 8
const MAX_GAP_ROUNDS = 2

// ---------------------------------------------------------------- Scout
phase('Scout')
const scout = await agent(
  `You are scouting a source set for a fan-out analysis. Read-only; enumerate, do NOT deep-read.
Sources: ${JSON.stringify(A.sources)}
For each directory: list its files (rg --files / ls -R), identify entry points (index.*, main.*, Program.cs, *.module.*, package exports, README "Entry points"). Group EVERYTHING into coherent clusters sized for one reader each (≤25 files per cluster; cluster by subsystem, feature slice, or call-path — never alphabetically). Every URL or ticket key is its own cluster. Every file in the source set must land in exactly one cluster — coverage is the whole point of this workflow.
Return ONLY the JSON.`,
  {
    label: 'scout',
    schema: {
      type: 'object',
      required: ['clusters'],
      properties: {
        clusters: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'members', 'rationale'],
            properties: {
              name: { type: 'string' },
              members: { type: 'array', items: { type: 'string' } },
              rationale: { type: 'string' },
              entryPoints: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        notes: { type: 'string' },
      },
    },
  }
)
if (!scout?.clusters?.length) throw new Error('scout returned no clusters')
log(`scout: ${scout.clusters.length} clusters, ${scout.clusters.reduce((n, c) => n + c.members.length, 0)} members`)

const READER_SCHEMA = {
  type: 'object',
  required: ['cluster', 'findings'],
  properties: {
    cluster: { type: 'string' },
    purpose: { type: 'string' },
    entryPoints: { type: 'array', items: { type: 'string' } },
    dataFlow: { type: 'string' },
    dependencies: { type: 'array', items: { type: 'string' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['statement', 'confidence', 'cite'],
        properties: {
          statement: { type: 'string' },
          confidence: { type: 'string', enum: ['VERIFIED', 'INFERRED', 'ASSUMED'] },
          cite: { type: 'string' },
          nonObvious: { type: 'boolean' },
        },
      },
    },
    unknowns: { type: 'array', items: { type: 'string' } },
  },
}

const readerPrompt = (c) =>
  `You are one reader in a fan-out analysis of: ${A.subject}. Read-only.
Cluster "${c.name}" (${c.rationale}). Read EVERY member IN FULL — never draw a finding from a partial read:
${c.members.map((m) => `  - ${m}`).join('\n')}
${c.entryPoints?.length ? `Entry points: ${c.entryPoints.join(', ')}` : ''}
Answer for this cluster: purpose; entry points; data flow; external dependencies; invariants and behaviours NOT inferrable from identifier names alone (silent failure modes, env-var overrides, hidden coupling, sentinel values) — mark those nonObvious:true. Every finding carries exactly one confidence marker ([VERIFIED] only if directly observed) and a cite (file:line, URL, or ticket key). Questions you cannot answer from these members go in unknowns.
Return ONLY the JSON.`

// ---------------------------------------------------------------- Read (parallel)
phase('Read')
const firstRound = scout.clusters.slice(0, MAX_CLUSTERS_PER_ROUND)
if (scout.clusters.length > MAX_CLUSTERS_PER_ROUND)
  log(`capping round to ${MAX_CLUSTERS_PER_ROUND} clusters; ${scout.clusters.length - MAX_CLUSTERS_PER_ROUND} deferred to gap rounds`)
let readings = (
  await parallel(firstRound.map((c) => () => agent(readerPrompt(c), { label: `read:${c.name}`, phase: 'Read', schema: READER_SCHEMA })))
).filter(Boolean)
let pendingClusters = scout.clusters.slice(MAX_CLUSTERS_PER_ROUND)

// ---------------------------------------------------------------- Synthesize (barrier — needs all readings)
phase('Synthesize')
const synthPrompt = (rounds) =>
  `You are the synthesis analyst. Subject: ${A.subject}. Audience: ${A.audience ?? 'run the documenting skill audience detection; default technical collaborator'}.
Cluster readings (JSON):
${JSON.stringify(rounds)}

Steps:
1. Reconcile the readings — contradictions between clusters are findings in themselves; note inconsistencies and gaps explicitly.
2. Derive the filename: run \`node .claude/skills/documenting/scripts/filename.mjs report "${A.subject}"\`.
3. Read .claude/skills/documenting/templates/report.md and write the report to artifacts/reports/<derived-stem>.md per the template. Assign stable R-### ids in encounter order. Every finding keeps its confidence marker and cite. Unresolved required questions surface as [UNKNOWN] in Risks — never claim completeness past an open one.
4. Apply the analyst hand-off criteria mechanically: architectural input needed if a finding (a) spans more than one module/service boundary, (b) contradicts an existing ADR, (c) identifies a deferred technical decision → flag [ARCHITECT REVIEW NEEDED]. Strategic if it (d) questions core/supporting/generic classification, (e) implies a context boundary move/split/merge, (f) raises an unresolved build/buy/outsource/defer question → [CONSULTANT REVIEW NEEDED]. Flagged findings echo as summary lines in the report's Recommendations.
5. Append ONE index line (≤2 lines/≤50 words) to .claude/agent-memory/analyst/MEMORY.md pointing at the report.
Return ONLY the JSON: {reportPath, counts: {verified, inferred, assumed, unknown}, flags: {architect: bool, strategic: bool}}.`

const SYNTH_SCHEMA = {
  type: 'object',
  required: ['reportPath', 'counts'],
  properties: {
    reportPath: { type: 'string' },
    counts: { type: 'object', properties: { verified: { type: 'number' }, inferred: { type: 'number' }, assumed: { type: 'number' }, unknown: { type: 'number' } } },
    flags: { type: 'object', properties: { architect: { type: 'boolean' }, strategic: { type: 'boolean' } } },
  },
}
let synth = await agent(synthPrompt(readings), { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA })
if (!synth?.reportPath) throw new Error('synthesis failed to produce a report')

// ---------------------------------------------------------------- Critic loop (until dry, max rounds)
phase('Critic')
for (let round = 1; round <= MAX_GAP_ROUNDS; round++) {
  const critic = await agent(
    `Completeness critic. Read the report at ${synth.reportPath}. Cluster inventory the readers were meant to cover:
${JSON.stringify(scout.clusters.map((c) => ({ name: c.name, members: c.members.length })))}
Deferred clusters not yet read: ${JSON.stringify(pendingClusters.map((c) => c.name))}
Reader-reported unknowns: ${JSON.stringify(readings.flatMap((r) => r.unknowns ?? []))}
What is MISSING — a cluster nobody read, a required model question unanswered without an [UNKNOWN], a claim without a cite, a cross-cluster contradiction the report papers over? Return ONLY the JSON: {gaps: [{what, whereToLook: [paths]}]} — empty gaps array if the report is genuinely complete.`,
    { label: `critic:r${round}`, phase: 'Critic', schema: { type: 'object', required: ['gaps'], properties: { gaps: { type: 'array', items: { type: 'object', required: ['what'], properties: { what: { type: 'string' }, whereToLook: { type: 'array', items: { type: 'string' } } } } } } } }
  )
  const gapClusters = [
    ...pendingClusters,
    ...(critic?.gaps ?? []).filter((g) => g.whereToLook?.length).map((g, i) => ({ name: `gap-${round}-${i}`, members: g.whereToLook, rationale: g.what, entryPoints: [] })),
  ].slice(0, MAX_CLUSTERS_PER_ROUND)
  pendingClusters = pendingClusters.slice(MAX_CLUSTERS_PER_ROUND)
  if (!gapClusters.length && !(critic?.gaps ?? []).length) {
    log(`critic round ${round}: dry — report complete`)
    break
  }
  log(`critic round ${round}: ${critic.gaps.length} gap(s), reading ${gapClusters.length} cluster(s)`)
  const extra = (
    await parallel(gapClusters.map((c) => () => agent(readerPrompt(c), { label: `read:${c.name}`, phase: 'Critic', schema: READER_SCHEMA })))
  ).filter(Boolean)
  readings = readings.concat(extra)
  synth = await agent(
    `Revise the report at ${synth.reportPath} in place with these additional cluster readings (same rules as before: R-### ids continue in encounter order, never renumber; confidence markers; cites; update the analyst MEMORY.md index line if the hook changed):
${JSON.stringify(extra)}
Critic gaps that prompted this round: ${JSON.stringify(critic.gaps)}
Return ONLY the JSON: {reportPath, counts: {verified, inferred, assumed, unknown}, flags: {architect: bool, strategic: bool}}.`,
    { label: `revise:r${round}`, phase: 'Critic', schema: SYNTH_SCHEMA }
  ) ?? synth
}

return {
  report: synth.reportPath,
  counts: synth.counts,
  flags: synth.flags ?? {},
  clustersRead: readings.length,
  clustersUnread: pendingClusters.map((c) => c.name),
}
