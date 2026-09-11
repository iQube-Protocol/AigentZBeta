/**
 * The resolution registry dashboard — `npm run report:resolutions`.
 *
 * Prints, in one screen: open resolutions, candidate invariants, validated
 * invariants, unresolved recurrence risks, and the milestone-close check.
 *
 * It DERIVES everything from `services/invariants/resolutionRecords.ts` and
 * reads the registry through that module's one loader. There is no second
 * reader and no hand-maintained summary anywhere — a projection of a registry
 * must be derived in code (`inv.engineering.036`/`037`).
 *
 * Exit code is 1 when the milestone-close check reports a BLOCKER, so this can
 * gate a milestone without anyone having to read the output.
 *
 *   npm run report:resolutions
 *   npm run report:resolutions -- --milestone="Horizen Pilot"
 */

import {
  buildRegistryReport,
  listUncapturedUpdateDocs,
  loadRegistry,
} from '../services/invariants/resolutionRecords';
import {
  CLOSE_OUT_KINDS,
  CLOSE_OUT_RITUAL,
  CONSTITUTIONAL_EXECUTION_PRINCIPLES,
} from '../types/resolutionRecords';

const milestoneArg = process.argv.find((a) => a.startsWith('--milestone='));
const milestone = milestoneArg ? milestoneArg.slice('--milestone='.length) : null;

const registry = loadRegistry();
const filtered = milestone
  ? {
      records: registry.records.filter((r) => r.milestone.includes(milestone)),
      candidates: registry.candidates,
      exploration: registry.exploration,
    }
  : registry;

const report = buildRegistryReport(
  filtered,
  listUncapturedUpdateDocs(registry),
  milestone ?? 'all milestones',
);

const rule = (s: string) => `\n${s}\n${'─'.repeat(s.length)}`;

console.log(rule(`Resolution → Invariant loop — ${report.generatedFor}`));
console.log(
  `${report.totals.resolutions} resolutions · ${report.totals.candidates} candidate invariants · ` +
    `${report.totals.canaries} canaries · ${report.totals.candidatesWithoutCanary} candidate(s) with NO canary`,
);

console.log(rule('Families'));
for (const [family, n] of Object.entries(report.byFamily)) console.log(`  ${family.padEnd(15)} ${n}`);
console.log('  (UX is a PROJECTION TARGET, not a family — operator ruling 2026-08-03)');

console.log(rule('Constitutional Execution Family'));
for (const p of CONSTITUTIONAL_EXECUTION_PRINCIPLES) {
  const c = registry.candidates.find((k) => k.candidateId === p.candidateId);
  console.log(`  ${p.name}  [${c?.status ?? 'MISSING'}]  ${c?.canaries.length ?? 0} canary(ies)`);
}

console.log(rule('Rule trees (derived from parentCandidateId)'));
if (report.ruleTrees.length === 0) console.log('  none');
for (const t of report.ruleTrees) {
  console.log(`  ${t.parentCandidateId}`);
  for (const child of t.children) console.log(`      └── ${child}`);
}

console.log(rule('Exploration Workspace'));
if (report.exploration.length === 0) console.log('  none');
for (const e of report.exploration) console.log(`  [${e.disposition}] ${e.explorationId} — ${e.question}`);

console.log(rule('Pending projections'));
if (report.pendingProjections.length === 0) console.log('  none');
for (const p of report.pendingProjections) {
  console.log(`  ${p.candidateId} → ${p.targets.join(', ')}  (${p.blockedBy})`);
}

console.log(rule('Open resolutions (below `validated`)'));
if (report.openResolutions.length === 0) console.log('  none');
for (const r of report.openResolutions) {
  console.log(`  ${r.resolutionId}  [${r.status}]  ${r.capability}  ← ${r.trigger}`);
}

console.log(rule('Candidate invariants'));
if (report.candidateInvariants.length === 0) console.log('  none');
for (const c of report.candidateInvariants) {
  console.log(`  ${c.candidateId}  [${c.status}]  ×${c.occurrences} seen · ${c.canaries} canary(ies)`);
  console.log(`      ${c.statement}`);
}

console.log(rule('Validated invariants'));
if (report.validatedInvariants.length === 0) {
  console.log('  none — nothing has yet earned promotion by reuse or regression prevention');
}
for (const c of report.validatedInvariants) {
  console.log(`  ${c.candidateId}  [${c.status}]  ×${c.occurrences} seen · ${c.canaries} canary(ies)`);
  console.log(`      ${c.statement}`);
}

console.log(rule('Unresolved recurrence risks'));
if (report.unresolvedRecurrenceRisks.length === 0) console.log('  none');
for (const r of report.unresolvedRecurrenceRisks) {
  console.log(`  ${r.candidateId} — ${r.reason}`);
  console.log(`      ${r.statement}`);
}

console.log(rule('Milestone-close check'));
if (report.milestoneClose.findings.length === 0) console.log('  clear — nothing outstanding');
for (const f of report.milestoneClose.findings) {
  console.log(`  [${f.severity.toUpperCase()}] ${f.subjectId ?? '(registry)'}: ${f.message}`);
}
console.log(rule('Agent close-out checklist'));
for (const k of CLOSE_OUT_KINDS) {
  console.log(`  [ ] ${k.kind}\n        ${k.question}\n        → ${k.destination}`);
}
console.log(`\n  Ritual: ${CLOSE_OUT_RITUAL.join(' → ')}`);

console.log(`\n  clear: ${report.milestoneClose.clear}`);

process.exit(report.milestoneClose.clear ? 0 : 1);
