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

const milestoneArg = process.argv.find((a) => a.startsWith('--milestone='));
const milestone = milestoneArg ? milestoneArg.slice('--milestone='.length) : null;

const registry = loadRegistry();
const filtered = milestone
  ? {
      records: registry.records.filter((r) => r.milestone.includes(milestone)),
      candidates: registry.candidates,
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
console.log(`\n  clear: ${report.milestoneClose.clear}`);

process.exit(report.milestoneClose.clear ? 0 : 1);
