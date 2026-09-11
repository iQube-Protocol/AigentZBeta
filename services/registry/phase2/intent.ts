/**
 * Phase 2 — Intent-based iQube creation (STUB).
 *
 * PRD v1.0 §13 / v1.1 Phase 2. Interface-only stub. No runtime
 * implementation in this branch; a dedicated Phase 2 PRD scopes the
 * intent → calibration → risk → value → pricing → exchange chain.
 *
 * This file reserves the architectural seam so Stage 1–8 callers can
 * import the types and code-paths around them now, knowing the shape
 * is the contract.
 */

import type { IQubePrimitiveType } from '@/types/iqube/legibility';

export interface IntentCaptureInput {
  /** Free-text intent statement from a user or upstream agent. */
  intent_text: string;
  /** Optional contextual tags from the source surface. */
  context_tags?: string[];
  /** Where the intent originated. */
  source: 'metame_runtime' | 'studio' | 'cartridge' | 'api' | 'agent_to_agent';
  /** When provided, anchors the intent to an existing iqube_id for
   *  remix / derivative work. */
  derived_from_iqube_id?: string;
}

export interface IntentToIQubeProposal {
  /** Proposed primitive type for the iQube to be created. */
  primitive_type: IQubePrimitiveType;
  /** Proposed tool_subtype when primitive_type === 'ToolQube'. */
  tool_subtype?: 'skill' | 'connector' | 'workflow' | 'browser';
  /** Proposed slug + name for human review. */
  proposed_slug: string;
  proposed_name: string;
  /** Confidence score 0..1 for the classification. */
  classification_confidence: number;
  /** Required follow-up steps before the iQube can be canonized. */
  follow_up_steps: Array<
    | 'risk_assessment'
    | 'value_assessment'
    | 'calibration'
    | 'pricing_proposal'
    | 'operator_review'
  >;
}

/**
 * Translate an intent capture into a draft iQube proposal. The proposal
 * is the input to the canonization queue + creates a draft iqube_id_map
 * entry once accepted.
 *
 * @stub — Phase 2 PRD specifies the LLM routing + classification logic.
 *         For Stage 9, this throws to surface accidental use.
 */
export async function intentToIQubeProposal(
  _input: IntentCaptureInput,
): Promise<IntentToIQubeProposal> {
  throw new Error(
    'intentToIQubeProposal is Phase 2 stub — implementation gated on dedicated Phase 2 PRD',
  );
}
