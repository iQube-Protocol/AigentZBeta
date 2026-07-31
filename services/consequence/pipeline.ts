/**
 * The Consequence Operating Model — canonical pipeline definition (CFS-006a).
 *
 * This is the single source of truth for the stage order, each stage's
 * output product, and which stages are new in Phase 3. The operating-model
 * runner (operatingModel.ts) executes against this definition; the future
 * chain-template deployment (Phase 3b) mirrors it as intent_chains steps.
 *
 * The pipeline is RECURSIVE, not linear: Knowledge Evolution updates the
 * invariant graph, which feeds the next Intent's Knowledge Curation — the
 * flywheel (CFS-006a §2).
 */

import type { ConsequenceStage, StageDefinition } from '@/types/consequence';

export const CONSEQUENCE_PIPELINE: StageDefinition[] = [
  { stage: 'intent', product: 'IntentQube', isNew: false,
    purpose: 'Establish the desired consequence.' },
  { stage: 'knowledge_curation', product: 'KnowledgeQube', isNew: true,
    purpose: 'Identify the minimum coherent knowledge necessary.' },
  { stage: 'knowledge_compression', product: 'InvariantQube', isNew: true,
    purpose: 'Transform curated information into reusable invariants (curation → reasoning → invariant discovery → knowledge).' },
  { stage: 'risk_analysis', product: 'Risk profile', isNew: false,
    purpose: 'Estimate repair cost, uncertainty, reversibility.' },
  { stage: 'value_analysis', product: 'Value profile', isNew: false,
    purpose: 'Estimate benefit, leverage, acceleration, societal contribution.' },
  { stage: 'capability_composition', product: 'CapabilityQube', isNew: false,
    purpose: 'Compose agents, tools, workflows, models, data.' },
  { stage: 'consequence_forecasting', product: 'Consequence graph', isNew: true,
    purpose: 'Forecast outcomes over enables / constrains / contradicts edges.' },
  { stage: 'planning', product: 'Plan (disposition)', isNew: false,
    purpose: 'Choose disposition from forecasts + risk/value + policy.' },
  { stage: 'execution', product: 'Receipts', isNew: false,
    purpose: 'Delegate. Observe. Complete.' },
  { stage: 'observation', product: 'Observed consequence', isNew: false,
    purpose: 'Capture what actually happened.' },
  { stage: 'standing', product: 'Standing accrual', isNew: false,
    purpose: 'Convert consequence into constitutional capital.' },
  { stage: 'registry_update', product: 'Registry entries', isNew: false,
    purpose: 'Persist validated knowledge.' },
  { stage: 'knowledge_evolution', product: 'Updated invariant graph', isNew: true,
    purpose: 'Feed observed outcomes back into confidence + edges. Closes the loop.' },
];

/** Stages that run before the Planning → Execution approval gate. */
export const PRE_APPROVAL_STAGES: ConsequenceStage[] = [
  'intent',
  'knowledge_curation',
  'knowledge_compression',
  'risk_analysis',
  'value_analysis',
  'capability_composition',
  'consequence_forecasting',
  'planning',
];

/** Stages that run after approval (the execution + flywheel-return arc). */
export const POST_APPROVAL_STAGES: ConsequenceStage[] = [
  'execution',
  'observation',
  'standing',
  'registry_update',
  'knowledge_evolution',
];

export function stageDefinition(stage: ConsequenceStage): StageDefinition {
  const def = CONSEQUENCE_PIPELINE.find((s) => s.stage === stage);
  if (!def) throw new Error(`unknown consequence stage: ${stage}`);
  return def;
}

/** The recursion invariant: the last stage's product feeds the first stage. */
export const FLYWHEEL_RETURN: { from: ConsequenceStage; to: ConsequenceStage } = {
  from: 'knowledge_evolution',
  to: 'knowledge_curation',
};
