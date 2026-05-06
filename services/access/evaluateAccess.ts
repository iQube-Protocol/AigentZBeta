/**
 * evaluateAccess — the single gate every consumer calls.
 *
 * Phase 1.3 of the unified identity-content-access foundation plan.
 *
 * Composition (additive — no existing service is modified):
 *   - ActivePersonaContext (T0)              from getActivePersona
 *   - ContentAccessDescriptor                from getContentDescriptor
 *   - userOwnsAsset                          from services/rewards/assetOwnership
 *   - resolveReceiptMode                     from services/access/policyResolvers
 *   - credentialMatchesCartridgeFlag         from services/access/policyResolvers
 *
 * Phase scope:
 *   This commit captures today's gate behaviour verbatim and exposes it
 *   through the unified contract. It does NOT yet emit DVN receipts or
 *   call ICP canister verifiers — those are Phase 3 (DVN policy hook +
 *   alias-anchored receipts) and Phase 4 (TokenQube on-chain proof).
 *   The receipt handle is constructed deterministically from the
 *   action + content so callers can wire the emission later without
 *   changing the contract.
 *
 * Privacy contract:
 *   - The receipt handle attributes via aliasCommitment + cohortId only.
 *     The personaId / authProfileId / rootDid never appear in the decision
 *     output. Phase 1.3 stub: aliasCommitment is a deterministic
 *     placeholder until cohortAliasService lands; cohortId is 'default'.
 *     Phase 3 replaces both with live values from the Escrow canister.
 */

import {
  userOwnsAsset,
} from '@/services/rewards/assetOwnership';
import {
  credentialMatchesCartridgeFlag,
  credentialRequiresExternalVerifier,
  resolveReceiptMode,
} from '@/services/access/policyResolvers';

import type {
  AccessAction,
  AccessDecision,
  AccessDecisionReason,
  AccessReceiptHandle,
  ActivePersonaContext,
  ContentAccessDescriptor,
  DeliveryMode,
  EvaluateAccessOptions,
  ReceiptMode,
} from '@/types/access';

// ─────────────────────────────────────────────────────────────────────────
// Receipt handle stub (Phase 3 replaces with live alias from Escrow canister)
// ─────────────────────────────────────────────────────────────────────────

const RECEIPT_PLACEHOLDER_ALIAS = '__phase1_pending_alias__';
const DEFAULT_COHORT_ID = 'default';

function buildReceiptHandle(mode: ReceiptMode): AccessReceiptHandle {
  return {
    mode,
    aliasCommitment: RECEIPT_PLACEHOLDER_ALIAS,
    cohortId: DEFAULT_COHORT_ID,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Delivery mode resolution
// ─────────────────────────────────────────────────────────────────────────

function deriveDeliveryMode(descriptor: ContentAccessDescriptor): DeliveryMode {
  switch (descriptor.state) {
    case 'A_open_unqubed':
      return 'plain-redirect';
    case 'B_open_iqubed':
    case 'C_gated_wip':
      // PDFs render via page-image-proxy so the bytes never reach the browser.
      // Other content types use decrypt-stream (server fetches, decrypts, streams).
      if (descriptor.contentClass === 'episode_print' || descriptor.contentClass === 'gn') {
        return 'page-image-proxy';
      }
      return 'decrypt-stream';
    case 'D_gated_canonical_pool':
    case 'E_gated_canonical_sovereign':
      // TokenQube ownership proof (Phase 4). Until the proof endpoint is
      // wired, fall back to decrypt-stream backed by entitlement (state-D
      // backward-compat fallback per plan §Phase 4).
      return 'token-proof-stream';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export async function evaluateAccess(
  context: ActivePersonaContext,
  descriptor: ContentAccessDescriptor,
  action: AccessAction,
  opts: EvaluateAccessOptions = {},
): Promise<AccessDecision> {
  const receiptMode = resolveReceiptMode(action, opts.requireSyncReceipt);
  const receipt = buildReceiptHandle(receiptMode);

  // 1. Free content — open access.
  if (descriptor.gating.kind === 'free') {
    return {
      allow: true,
      reason: 'free',
      deliveryMode: deriveDeliveryMode(descriptor),
      receipt,
    };
  }

  // 2. Credential-gated content — first try cartridge flags (admin/partner).
  if (descriptor.gating.kind === 'credential') {
    const credential = descriptor.gating.credential;
    if (credentialMatchesCartridgeFlag(credential, context.cartridgeFlags)) {
      return {
        allow: true,
        reason: 'credential-met',
        deliveryMode: deriveDeliveryMode(descriptor),
        receipt,
      };
    }
    // External verifier (cohort:* / token:*) — Phase 3 wires this.
    if (credentialRequiresExternalVerifier(credential)) {
      // Conservative default during Phase 1: deny rather than allow when
      // the verifier is not yet live. Once Phase 3 ships, this branch
      // calls the cohort/token verifier and returns the real decision.
      return denyDecision('credential-required', descriptor, receipt);
    }
    // Unknown credential string -> deny (no implicit allow).
    return denyDecision('credential-required', descriptor, receipt);
  }

  // 3. Payment-gated content — entitlement check.
  //    State D/E will additionally check TokenQube ownership in Phase 4.
  //    For now, the entitlement table is the canonical answer.
  const ownership = await userOwnsAsset(context.personaId, descriptor.assetId);
  if (ownership.owned) {
    return {
      allow: true,
      reason: 'owned',
      deliveryMode: deriveDeliveryMode(descriptor),
      receipt,
    };
  }
  return denyDecision('payment-required', descriptor, receipt);
}

function denyDecision(
  reason: AccessDecisionReason,
  descriptor: ContentAccessDescriptor,
  receipt: AccessReceiptHandle,
): AccessDecision {
  return {
    allow: false,
    reason,
    // Even on deny, we surface the delivery mode the caller would have
    // received so the surface can render the right "purchase" or
    // "upgrade credential" CTA (e.g. PDF lock-overlay vs video lock).
    deliveryMode: deriveDeliveryMode(descriptor),
    receipt,
  };
}
