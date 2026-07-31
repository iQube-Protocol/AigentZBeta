/**
 * Intent Distillation Engine — Capability 1
 *
 * Transforms raw user requests into structured development intent.
 * All development activity begins from structured intent rather than
 * raw conversation.
 */

import type { StructuredDevIntent } from '@/types/devCommandCenter';

export function createEmptyIntent(rawInput: string): StructuredDevIntent {
  return {
    intentId: `dci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rawInput,
    goal: '',
    users: [],
    constraints: [],
    desiredOutcomes: [],
    successCriteria: [],
    relatedVentures: [],
    relatedCartridges: [],
    priority: 'medium',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function refineIntent(
  intent: StructuredDevIntent,
  updates: Partial<Omit<StructuredDevIntent, 'intentId' | 'rawInput' | 'createdAt'>>
): StructuredDevIntent {
  return {
    ...intent,
    ...updates,
    status: updates.status ?? 'refined',
    updatedAt: new Date().toISOString(),
  };
}

export function isIntentComplete(intent: StructuredDevIntent): boolean {
  return (
    intent.goal.length > 0 &&
    intent.users.length > 0 &&
    intent.desiredOutcomes.length > 0 &&
    intent.successCriteria.length > 0
  );
}

export function buildIntentSummary(intent: StructuredDevIntent): string {
  const lines: string[] = [
    `## Development Intent: ${intent.goal}`,
    '',
    `**Status:** ${intent.status}`,
    `**Priority:** ${intent.priority}`,
    '',
    '### Users',
    ...intent.users.map(u => `- ${u}`),
    '',
    '### Desired Outcomes',
    ...intent.desiredOutcomes.map(o => `- ${o}`),
    '',
    '### Success Criteria',
    ...intent.successCriteria.map(c => `- ${c}`),
  ];

  if (intent.constraints.length > 0) {
    lines.push('', '### Constraints', ...intent.constraints.map(c => `- ${c}`));
  }
  if (intent.relatedCartridges.length > 0) {
    lines.push('', '### Related Cartridges', ...intent.relatedCartridges.map(c => `- ${c}`));
  }
  if (intent.relatedVentures.length > 0) {
    lines.push('', '### Related Ventures', ...intent.relatedVentures.map(v => `- ${v}`));
  }

  return lines.join('\n');
}
