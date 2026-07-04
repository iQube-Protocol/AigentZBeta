/**
 * Development Loop State Machine — orchestrates the 5 capabilities
 *
 * User Intent → Intent Distillation → Context Pack → Gap Analysis →
 * Consequence Canvas → Claude Code → Consequence Validation →
 * Receipts → Memory Update
 */

import type {
  DevLoopState,
  DevLoopStage,
  StructuredDevIntent,
  ContextPack,
  CapabilityGapAnalysis,
  ConsequenceCanvas,
  ConsequenceValidationReport,
  ImplementationPackage,
} from '@/types/devCommandCenter';

export function createDevLoopSession(): DevLoopState {
  return {
    sessionId: `dls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage: 'intent_capture',
    intent: null,
    contextPack: null,
    gapAnalysis: null,
    consequenceCanvas: null,
    validationReport: null,
    receipts: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const STAGE_ORDER: DevLoopStage[] = [
  'intent_capture',
  'context_assembly',
  'gap_analysis',
  'consequence_modeling',
  'implementation',
  'consequence_validation',
  'complete',
];

export function canAdvance(state: DevLoopState): boolean {
  switch (state.stage) {
    case 'intent_capture':
      return state.intent !== null && state.intent.status !== 'draft';
    case 'context_assembly':
      return state.contextPack !== null && state.contextPack.items.length > 0;
    case 'gap_analysis':
      return state.gapAnalysis !== null;
    case 'consequence_modeling':
      return state.consequenceCanvas !== null && state.consequenceCanvas.successState.length > 0;
    case 'implementation':
      return true;
    case 'consequence_validation':
      return state.validationReport !== null;
    case 'complete':
      return false;
    default:
      return false;
  }
}

export function advanceStage(state: DevLoopState): DevLoopState {
  if (!canAdvance(state)) return state;
  const idx = STAGE_ORDER.indexOf(state.stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return state;
  return {
    ...state,
    stage: STAGE_ORDER[idx + 1],
    updatedAt: new Date().toISOString(),
  };
}

export function getStageIndex(stage: DevLoopStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getStageLabel(stage: DevLoopStage): string {
  const labels: Record<DevLoopStage, string> = {
    intent_capture: 'Intent Capture',
    context_assembly: 'Context Assembly',
    gap_analysis: 'Gap Analysis',
    consequence_modeling: 'Consequence Modeling',
    implementation: 'Implementation',
    consequence_validation: 'Consequence Validation',
    complete: 'Complete',
  };
  return labels[stage];
}

export function buildImplementationPackage(state: DevLoopState): ImplementationPackage | null {
  if (!state.intent || !state.contextPack || !state.gapAnalysis || !state.consequenceCanvas) {
    return null;
  }

  // Prefer the LLM-enriched brief (PRD + architecture plan + task list)
  // approved at the implementation stage; fall back to the derived brief.
  const derivedBrief = [
      `# Implementation Brief: ${state.intent.goal}`,
      '',
      `## Goal`,
      state.intent.goal,
      '',
      `## Desired Outcomes`,
      ...state.intent.desiredOutcomes.map(o => `- ${o}`),
      '',
      `## Success Criteria`,
      ...state.intent.successCriteria.map(c => `- ${c}`),
      '',
      `## Constraints`,
      ...state.intent.constraints.map(c => `- ${c}`),
      '',
      `## Reuse First (${state.gapAnalysis.existing.length} existing capabilities)`,
      ...state.gapAnalysis.existing.map(c => `- ${c.name} (${c.reuseStrategy}) — ${c.location}`),
      '',
      `## Build New (${state.gapAnalysis.missing.length} missing capabilities)`,
      ...state.gapAnalysis.missing.map(c => `- ${c.name} [${c.estimatedComplexity}] — ${c.suggestedLocation}`),
      '',
      `## Consequence Guardrails`,
      '### Must happen:',
      ...state.consequenceCanvas.shouldHappen.map(e => `- ${e.description}`),
      '### Must never happen:',
      ...state.consequenceCanvas.shouldNeverHappen.map(e => `- ${e.description}`),
      '',
      `## Success State`,
      state.consequenceCanvas.successState,
    ].join('\n');

  return {
    intentId: state.intent.intentId,
    brief: state.implementationBrief || derivedBrief,
    contextPack: state.contextPack,
    gapAnalysis: state.gapAnalysis,
    consequenceCanvas: state.consequenceCanvas,
    constraints: state.intent.constraints,
    claudeMdRules: [],
    assembledAt: new Date().toISOString(),
  };
}
