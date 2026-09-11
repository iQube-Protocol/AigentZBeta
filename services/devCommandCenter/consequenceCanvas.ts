/**
 * Consequence Canvas — Capability 4
 *
 * Models intended consequences before implementation.
 * Development is guided by desired consequences rather than code artifacts.
 */

import type {
  ConsequenceCanvas,
  ConsequenceEntry,
} from '@/types/devCommandCenter';

export function createEmptyCanvas(intentId: string): ConsequenceCanvas {
  return {
    intentId,
    shouldHappen: [],
    shouldNeverHappen: [],
    workflowsActivated: [],
    systemsAffected: [],
    permissionsRequired: [],
    successState: '',
    createdAt: new Date().toISOString(),
  };
}

let entrySeq = 0;

export function createConsequenceEntry(
  description: string,
  category: ConsequenceEntry['category'],
  severity: ConsequenceEntry['severity'] = 'medium'
): ConsequenceEntry {
  return {
    id: `ce-${Date.now()}-${++entrySeq}`,
    description,
    category,
    severity,
  };
}

export function addShouldHappen(canvas: ConsequenceCanvas, entry: ConsequenceEntry): ConsequenceCanvas {
  return { ...canvas, shouldHappen: [...canvas.shouldHappen, entry] };
}

export function addShouldNeverHappen(canvas: ConsequenceCanvas, entry: ConsequenceEntry): ConsequenceCanvas {
  return { ...canvas, shouldNeverHappen: [...canvas.shouldNeverHappen, entry] };
}

export function buildConsequenceCanvasSummary(canvas: ConsequenceCanvas): string {
  const lines: string[] = [
    `## Consequence Canvas`,
    '',
    `**Success state:** ${canvas.successState || '(not defined)'}`,
    '',
  ];

  if (canvas.shouldHappen.length > 0) {
    lines.push('### Should Happen');
    for (const e of canvas.shouldHappen) {
      lines.push(`- [${e.severity}] ${e.description} (${e.category})`);
    }
    lines.push('');
  }

  if (canvas.shouldNeverHappen.length > 0) {
    lines.push('### Should Never Happen');
    for (const e of canvas.shouldNeverHappen) {
      lines.push(`- [${e.severity}] ${e.description} (${e.category})`);
    }
    lines.push('');
  }

  if (canvas.workflowsActivated.length > 0) {
    lines.push('### Workflows Activated');
    for (const w of canvas.workflowsActivated) lines.push(`- ${w}`);
    lines.push('');
  }

  if (canvas.systemsAffected.length > 0) {
    lines.push('### Systems Affected');
    for (const s of canvas.systemsAffected) lines.push(`- ${s}`);
    lines.push('');
  }

  if (canvas.permissionsRequired.length > 0) {
    lines.push('### Permissions Required');
    for (const p of canvas.permissionsRequired) lines.push(`- ${p}`);
  }

  return lines.join('\n');
}
