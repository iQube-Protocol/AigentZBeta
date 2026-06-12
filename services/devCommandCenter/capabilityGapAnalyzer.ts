/**
 * Capability Gap Analyzer — Capability 3
 *
 * Determines what already exists versus what must be created.
 * Development effort focuses only on capability gaps.
 */

import type {
  CapabilityGapAnalysis,
  ExistingCapability,
  MissingCapability,
  StructuredDevIntent,
} from '@/types/devCommandCenter';

export function createEmptyGapAnalysis(intentId: string): CapabilityGapAnalysis {
  return {
    intentId,
    existing: [],
    missing: [],
    reuseRatio: 0,
    analysedAt: new Date().toISOString(),
  };
}

export function addExistingCapability(
  analysis: CapabilityGapAnalysis,
  capability: ExistingCapability
): CapabilityGapAnalysis {
  const existing = [...analysis.existing, capability];
  return recompute({ ...analysis, existing });
}

export function addMissingCapability(
  analysis: CapabilityGapAnalysis,
  capability: MissingCapability
): CapabilityGapAnalysis {
  const missing = [...analysis.missing, capability];
  return recompute({ ...analysis, missing });
}

function recompute(analysis: CapabilityGapAnalysis): CapabilityGapAnalysis {
  const total = analysis.existing.length + analysis.missing.length;
  return {
    ...analysis,
    reuseRatio: total > 0 ? analysis.existing.length / total : 0,
    analysedAt: new Date().toISOString(),
  };
}

export function buildGapAnalysisSummary(analysis: CapabilityGapAnalysis): string {
  const lines: string[] = [
    `## Capability Gap Analysis`,
    '',
    `**Reuse ratio:** ${Math.round(analysis.reuseRatio * 100)}%`,
    `**Existing:** ${analysis.existing.length} capabilities`,
    `**Missing:** ${analysis.missing.length} capabilities`,
    '',
  ];

  if (analysis.existing.length > 0) {
    lines.push('### Existing Capabilities');
    for (const cap of analysis.existing) {
      lines.push(`- **${cap.name}** (${cap.reuseStrategy}) — ${cap.location}`);
      lines.push(`  ${cap.description}`);
    }
    lines.push('');
  }

  if (analysis.missing.length > 0) {
    lines.push('### Missing Capabilities');
    for (const cap of analysis.missing) {
      lines.push(`- **${cap.name}** [${cap.estimatedComplexity}] — ${cap.suggestedLocation}`);
      lines.push(`  ${cap.description}`);
      if (cap.dependencies.length > 0) {
        lines.push(`  Dependencies: ${cap.dependencies.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}
