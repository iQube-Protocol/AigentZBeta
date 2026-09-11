/**
 * Commerce receipts — VELA-001 Authorisation/Execution/Consequence planes.
 *
 * Mirrors services/registry/invocationGateway.ts's `emitCapabilityReceipt()`
 * precedent exactly: best-effort (`.catch(() => undefined)` — a receipt
 * failure must never break the decision it describes), personaId-gated (no
 * caller-resolved persona yet ⇒ the write is silently skipped), and
 * `personaId` is always the caller's own resolved T0 identifier passed
 * separately from every T1-safe ref — never placed inside `actionInput`.
 *
 * Three receipt families, one per plane, using the six ActivityActionType
 * literals declared in services/receipts/activityReceiptService.ts and
 * anchored via ANCHORABLE_ACTION_TYPES in services/dvn/activityReceiptDvnPipeline.ts.
 * Every `actionInput` carries only opaque refs already produced by
 * services/constitutionalCommerce/{actionAuthorisation,boundedExecution,
 * observedConsequence,causalChain}.ts — never a personaId/authProfileId/
 * rootDid, and never a plaintext confidential value.
 */

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ActionAuthorisation, ObservedConsequence } from '@/types/constitutionalCommerce';
import type { BoundedExecutionResult } from './boundedExecution';
import type { CausalChainRefs } from './causalChain';

const AUTHORISATION_RECEIPT_ACTION_TYPE = {
  AUTHORISED: 'commerce_action_authorised',
  REFUSED: 'commerce_action_refused',
  UNRESOLVED: 'commerce_action_unresolved',
} as const;

/** Emits exactly one of commerce_action_{authorised,refused,unresolved}.
 *  EXPIRED/REVOKED (not produced by deriveActionAuthorisation() today) are
 *  intentionally not receipted by this path — silently skipped, never
 *  mis-mapped onto one of the three above. */
export async function emitActionAuthorisationReceipt(
  authorisation: ActionAuthorisation,
  chain: CausalChainRefs,
  personaId: string | undefined,
  originatingSurface: string,
): Promise<void> {
  if (!personaId) return;
  const actionType =
    AUTHORISATION_RECEIPT_ACTION_TYPE[authorisation.status as keyof typeof AUTHORISATION_RECEIPT_ACTION_TYPE];
  if (!actionType) return;
  await createActivityReceipt({
    personaId,
    activeCartridge: originatingSurface,
    actionType,
    summary: `Constitutional Commerce authorisation ${authorisation.status.toLowerCase()} for action '${authorisation.actionRef}'`,
    actionInput: {
      authorisationRef: authorisation.authorisationRef,
      authorityRef: chain.authorityRef,
      mandateRef: chain.mandateRef,
      proposedActionRef: chain.proposedActionRef,
      projectionContextRef: chain.projectionContextRef,
      projectionRef: chain.projectionRef,
      publicForecastRef: chain.publicForecastRef,
      confidentialEvidenceRef: chain.confidentialEvidenceRef,
      confidentialRequestRef: chain.confidentialRequestRef,
      expiresAt: authorisation.expiresAt ?? null,
    },
  }).catch(() => undefined);
}

/** Emits commerce_execution_bound or commerce_execution_refused. */
export async function emitExecutionReceipt(
  result: BoundedExecutionResult,
  chain: CausalChainRefs,
  personaId: string | undefined,
  originatingSurface: string,
): Promise<void> {
  if (!personaId) return;
  await createActivityReceipt({
    personaId,
    activeCartridge: originatingSurface,
    actionType: result.status === 'execution_bound' ? 'commerce_execution_bound' : 'commerce_execution_refused',
    summary:
      result.status === 'execution_bound'
        ? `Execution intent bound for action '${result.execution?.actionRef}'`
        : `Execution refused: ${result.reason}`,
    actionInput: {
      authorisationRef: chain.authorisationRef,
      executionRef: result.execution?.executionRef ?? null,
      signerRef: result.execution?.signerRef ?? null,
      network: result.execution?.network ?? null,
      reason: result.reason,
    },
  }).catch(() => undefined);
}

/** Emits commerce_consequence_recorded, carrying the validationState
 *  (MATCHED_PROJECTION | DIVERGED_FROM_PROJECTION | UNRESOLVED) so the
 *  outcome is queryable from the payload without a second action type. */
export async function emitConsequenceReceipt(
  observed: ObservedConsequence,
  chain: CausalChainRefs,
  personaId: string | undefined,
  originatingSurface: string,
): Promise<void> {
  if (!personaId) return;
  await createActivityReceipt({
    personaId,
    activeCartridge: originatingSurface,
    actionType: 'commerce_consequence_recorded',
    summary: `Observed consequence recorded — validation: ${observed.validationState}`,
    actionInput: {
      consequenceRef: observed.consequenceRef,
      executionRef: observed.executionRef,
      projectionRef: observed.projectionRef,
      validationState: observed.validationState,
      projectionContextRef: chain.projectionContextRef,
    },
  }).catch(() => undefined);
}
