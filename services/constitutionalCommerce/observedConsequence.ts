/**
 * Observed Consequence + Consequence Validation — the retrospective half of
 * the VELA-001 chain, downstream of bounded execution
 * (services/constitutionalCommerce/boundedExecution.ts).
 *
 * Compares what was PROJECTED (ConsequenceProjection.disposition) against
 * what was OBSERVED after execution, using the exact vocabulary the operator
 * ratified: MATCHED_PROJECTION | DIVERGED_FROM_PROJECTION | UNRESOLVED.
 *
 * UNRESOLVED here means the same thing it means everywhere else in this
 * ontology: nothing was established. The observation could not be made —
 * execution never actually happened, evidence never arrived, an observer
 * failure — never a synonym for "it didn't match." A definite but
 * unfavourable observation (e.g. the observed disposition really was
 * UNACCEPTABLE) is still a real comparison, not an UNRESOLVED one.
 *
 * TEE attestation independence carries forward unchanged: this module never
 * infers `teeAttestationVerified` from a successful observation, and never
 * treats observation outcome as a substitute for attestation evidence — it
 * only compares dispositions.
 *
 * Server-side only. Pure: no clock, no network.
 */

import { createHash } from 'crypto';
import type {
  CommerceExecution,
  ConsequenceProjection,
  ObservedConsequence,
  ProjectionDisposition,
} from '@/types/constitutionalCommerce';

function ref(namespace: string, value: string): string {
  return createHash('sha256').update(namespace).update(value).digest('hex').slice(0, 32);
}

export type ValidationState = ObservedConsequence['validationState'];

/**
 * Pure comparison. `observedDisposition: null` means the observation itself
 * could not be established (distinct from "observed and it was
 * UNACCEPTABLE", which is a real, definite observed disposition that still
 * compares against the projection normally).
 */
export function compareProjectionToObservation(
  projected: ProjectionDisposition,
  observedDisposition: ProjectionDisposition | null,
): { validationState: ValidationState; reason: string } {
  if (observedDisposition === null) {
    return {
      validationState: 'UNRESOLVED',
      reason: 'observed disposition could not be established — no comparison was possible',
    };
  }
  if (observedDisposition === projected) {
    return {
      validationState: 'MATCHED_PROJECTION',
      reason: `observed disposition '${observedDisposition}' matches the projected disposition`,
    };
  }
  return {
    validationState: 'DIVERGED_FROM_PROJECTION',
    reason: `observed disposition '${observedDisposition}' diverges from the projected disposition '${projected}'`,
  };
}

export interface RecordObservedConsequenceInput {
  execution: CommerceExecution;
  projection: ConsequenceProjection;
  observedState: unknown;
  /** null when the observation itself could not be established. */
  observedDisposition: ProjectionDisposition | null;
  receiptRefs?: string[];
}

/** Build the ObservedConsequence record for one execution. PURE — no clock,
 *  no network; `observedState`/`observedDisposition` are always supplied by
 *  the caller from whatever actually happened. */
export function recordObservedConsequence(
  input: RecordObservedConsequenceInput,
): ObservedConsequence {
  const { execution, projection, observedState, observedDisposition, receiptRefs = [] } = input;
  const { validationState } = compareProjectionToObservation(projection.disposition, observedDisposition);

  return {
    consequenceRef: ref('consequence:', `${execution.executionRef}|${projection.projectionRef}`),
    executionRef: execution.executionRef,
    projectionRef: projection.projectionRef,
    observedState,
    validationState,
    receiptRefs,
  };
}
