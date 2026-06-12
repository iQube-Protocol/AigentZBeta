/**
 * Context Pack Generator — Capability 2
 *
 * Automatically assembles the minimum high-signal context required
 * for implementation. Prioritizes: Reuse → Extend → Build New.
 */

import type {
  ContextPack,
  ContextPackItem,
  ContextSourceKind,
  StructuredDevIntent,
} from '@/types/devCommandCenter';

const SOURCE_PATHS: Record<ContextSourceKind, string[]> = {
  prd: ['docs/alpha/agentiq-knyt/'],
  architecture: ['codexes/packs/aigency/items/'],
  update: ['codexes/packs/agentiq/updates/'],
  cartridge: ['data/codex-configs.ts'],
  governance: ['services/governance/'],
  registry_asset: ['services/registry/'],
  prior_decision: ['services/governance/governanceDecisionLog.ts'],
  receipt: ['services/receipts/'],
  codebase: ['services/', 'components/', 'app/api/'],
  claude_md: ['CLAUDE.md'],
};

export function createEmptyContextPack(intentId: string): ContextPack {
  return {
    intentId,
    items: [],
    assembledAt: new Date().toISOString(),
    totalTokenEstimate: 0,
    reuseFirst: [],
    extendSecond: [],
    buildNewLast: [],
  };
}

export function addContextItem(pack: ContextPack, item: ContextPackItem): ContextPack {
  const items = [...pack.items, item].sort((a, b) => b.relevanceScore - a.relevanceScore);
  return classifyItems({
    ...pack,
    items,
    assembledAt: new Date().toISOString(),
  });
}

function classifyItems(pack: ContextPack): ContextPack {
  return {
    ...pack,
    reuseFirst: pack.items.filter(i => i.reuseSignal === 'reuse'),
    extendSecond: pack.items.filter(i => i.reuseSignal === 'extend'),
    buildNewLast: pack.items.filter(i => i.reuseSignal === 'reference'),
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildContextPackSummary(pack: ContextPack): string {
  const lines: string[] = [
    `## Context Pack (${pack.items.length} items)`,
    '',
    `**Reuse:** ${pack.reuseFirst.length} items`,
    `**Extend:** ${pack.extendSecond.length} items`,
    `**Reference:** ${pack.buildNewLast.length} items`,
    `**Est. tokens:** ${pack.totalTokenEstimate.toLocaleString()}`,
    '',
  ];

  if (pack.reuseFirst.length > 0) {
    lines.push('### Reuse First');
    for (const item of pack.reuseFirst) {
      lines.push(`- **${item.title}** (${item.sourceKind}) — ${item.sourcePath}`);
    }
    lines.push('');
  }

  if (pack.extendSecond.length > 0) {
    lines.push('### Extend');
    for (const item of pack.extendSecond) {
      lines.push(`- **${item.title}** (${item.sourceKind}) — ${item.sourcePath}`);
    }
    lines.push('');
  }

  if (pack.buildNewLast.length > 0) {
    lines.push('### Reference Only');
    for (const item of pack.buildNewLast) {
      lines.push(`- **${item.title}** (${item.sourceKind}) — ${item.sourcePath}`);
    }
  }

  return lines.join('\n');
}

export function getSourcePaths(kind: ContextSourceKind): string[] {
  return SOURCE_PATHS[kind] ?? [];
}
