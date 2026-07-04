/**
 * Post-Prompt Consequence Validator — Capability 5
 *
 * Evaluates generated outputs against intended consequences.
 * Generated code is evaluated against outcomes, not only implementation correctness.
 */

import type {
  ConsequenceCanvas,
  ConsequenceValidationItem,
  ConsequenceValidationReport,
  ValidationVerdict,
} from '@/types/devCommandCenter';

export function createEmptyValidationReport(
  intentId: string,
  canvasId: string
): ConsequenceValidationReport {
  return {
    intentId,
    canvasId,
    satisfied: [],
    unresolved: [],
    unintended: [],
    workflowImpacts: [],
    governanceImpacts: [],
    testingRequirements: [],
    overallVerdict: 'partial',
    validatedAt: new Date().toISOString(),
  };
}

export function addValidationItem(
  report: ConsequenceValidationReport,
  item: ConsequenceValidationItem
): ConsequenceValidationReport {
  const bucket = item.verdict === 'satisfied' ? 'satisfied'
    : item.verdict === 'unintended' ? 'unintended'
    : 'unresolved';

  return recomputeVerdict({
    ...report,
    [bucket]: [...report[bucket], item],
    validatedAt: new Date().toISOString(),
  });
}

function recomputeVerdict(report: ConsequenceValidationReport): ConsequenceValidationReport {
  const total = report.satisfied.length + report.unresolved.length + report.unintended.length;
  if (total === 0) return { ...report, overallVerdict: 'partial' };

  const hasCriticalUnresolved = report.unresolved.some(i => i.severity === 'critical');
  const hasUnintended = report.unintended.length > 0;

  if (hasCriticalUnresolved || hasUnintended) return { ...report, overallVerdict: 'fail' };
  if (report.unresolved.length === 0) return { ...report, overallVerdict: 'pass' };
  return { ...report, overallVerdict: 'partial' };
}

export function buildValidationSummary(report: ConsequenceValidationReport): string {
  const lines: string[] = [
    `## Consequence Validation Report`,
    '',
    `**Overall verdict:** ${report.overallVerdict.toUpperCase()}`,
    `**Satisfied:** ${report.satisfied.length}`,
    `**Unresolved:** ${report.unresolved.length}`,
    `**Unintended:** ${report.unintended.length}`,
    '',
  ];

  if (report.satisfied.length > 0) {
    lines.push('### Satisfied');
    for (const item of report.satisfied) {
      lines.push(`- ${item.description}`);
      lines.push(`  Evidence: ${item.evidence}`);
    }
    lines.push('');
  }

  if (report.unresolved.length > 0) {
    lines.push('### Unresolved');
    for (const item of report.unresolved) {
      lines.push(`- [${item.severity}] ${item.description}`);
      lines.push(`  Evidence: ${item.evidence}`);
    }
    lines.push('');
  }

  if (report.unintended.length > 0) {
    lines.push('### Unintended Consequences');
    for (const item of report.unintended) {
      lines.push(`- [${item.severity}] ${item.description}`);
      lines.push(`  Evidence: ${item.evidence}`);
    }
    lines.push('');
  }

  if (report.workflowImpacts.length > 0) {
    lines.push('### Workflow Impacts');
    for (const w of report.workflowImpacts) lines.push(`- ${w}`);
    lines.push('');
  }

  if (report.governanceImpacts.length > 0) {
    lines.push('### Governance Impacts');
    for (const g of report.governanceImpacts) lines.push(`- ${g}`);
    lines.push('');
  }

  if (report.testingRequirements.length > 0) {
    lines.push('### Testing Requirements');
    for (const t of report.testingRequirements) lines.push(`- ${t}`);
  }

  return lines.join('\n');
}
