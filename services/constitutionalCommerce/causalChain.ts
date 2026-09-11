/**
 * Causal Chain assembly — VELA-001. Gathers the reference handles that trace
 * one action end-to-end, EXCLUSIVELY from the already-existing typed records
 * (ProposedAction, ConsequenceProjection, ActionAuthorisation,
 * CommerceExecution, ObservedConsequence). This module duplicates no fields
 * and computes no new refs of its own — it is a read-only projection over
 * records that already exist, per the operator's explicit instruction to
 * gather these refs "from the already-existing typed objects... rather than
 * duplicating fields into a new parallel type."
 *
 * `authorityRef`/`mandateRef` are read from `authorisation` (not a separate
 * `ConstitutionalAuthority` object) because `deriveActionAuthorisation()`
 * already copies them there from the same `projection` that produced the
 * authorisation — reading them a second time from a second object would risk
 * two copies silently disagreeing.
 *
 * Server-side only. Pure.
 */

import type {
  ActionAuthorisation,
  CommerceExecution,
  ObservedConsequence,
  ProposedAction,
  ConsequenceProjection,
} from '@/types/constitutionalCommerce';

export interface CausalChainRefs {
  authorityRef: string;
  mandateRef: string;
  proposedActionRef: string;
  projectionContextRef: string;
  projectionRef: string;
  publicForecastRef: string;
  /** null when the confidential component was NOT_REQUIRED, or REQUIRED evidence never arrived. */
  confidentialEvidenceRef: string | null;
  /** The confidential provider's own request/application reference (e.g. Vela's requestRef). */
  confidentialRequestRef: string | null;
  authorisationRef: string;
  /** null when the authorisation never reached execution (REFUSED/UNRESOLVED, or execution itself was refused). */
  executionRef: string | null;
  /** null when execution never produced an observation. */
  observedConsequenceRef: string | null;
  validationState: ObservedConsequence['validationState'] | null;
}

export interface AssembleCausalChainInput {
  action: ProposedAction;
  projection: ConsequenceProjection;
  authorisation: ActionAuthorisation;
  execution?: CommerceExecution | null;
  observedConsequence?: ObservedConsequence | null;
}

export function assembleCausalChain(input: AssembleCausalChainInput): CausalChainRefs {
  const { action, projection, authorisation, execution, observedConsequence } = input;

  return {
    authorityRef: authorisation.authorityRef,
    mandateRef: authorisation.mandateRef,
    proposedActionRef: action.actionRef,
    projectionContextRef: projection.projectionContextRef,
    projectionRef: projection.projectionRef,
    publicForecastRef: projection.public.forecastRef,
    confidentialEvidenceRef: projection.confidential.evidenceRef,
    confidentialRequestRef: projection.confidential.requestRef,
    authorisationRef: authorisation.authorisationRef,
    executionRef: execution?.executionRef ?? null,
    observedConsequenceRef: observedConsequence?.consequenceRef ?? null,
    validationState: observedConsequence?.validationState ?? null,
  };
}
