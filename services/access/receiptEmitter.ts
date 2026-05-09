/**
 * Receipt emitter — Phase 3.2 of the unified IAM foundation plan.
 *
 * Bridges `evaluateAccess` decisions to durable orchestration_events
 * rows. Every receipt-eligible decision lands a row with T2-only
 * attribution (alias commitment + cohort id, NEVER personaId / rootDid).
 *
 * Privacy contract — enforced by construction:
 *   - The persona context (T0) reaches this module but the emitted row
 *     contains ONLY the alias commitment and cohort id. The personaId
 *     never appears in the metadata payload. Tested by canary in
 *     tests/access-spine.test.ts (Phase 3 cases).
 *   - The descriptor's assetId IS included (T2 — public asset reference)
 *     because the receipt would be useless without it.
 *   - Identifiability is captured AT-CALL-TIME from the persona's
 *     current value, so an agent acting on behalf of a human gets the
 *     clamped (most-restrictive) identifiability — already enforced by
 *     getActivePersona, the receipt just reads it.
 *
 * Phase 3.4 picks these rows up via the receiptBatcher and inscribes
 * them as Bitcoin ordinals. Until then they live durably on Supabase
 * with `inscription_id IS NULL`.
 */

import { emitOrchestrationEvent } from '@/services/orchestration/orchestrationEvents';
import type {
  AccessAction,
  AccessDecision,
  ActivePersonaContext,
  ContentAccessDescriptor,
} from '@/types/access';

interface EmitReceiptInput {
  context: ActivePersonaContext;
  descriptor: ContentAccessDescriptor;
  action: AccessAction;
  decision: AccessDecision;
}

/**
 * Translate an AccessDecision into a durable orchestration_events row.
 * Fire-and-forget — caller voids the promise.
 */
export async function emitDecisionReceipt(input: EmitReceiptInput): Promise<void> {
  const { context, descriptor, action, decision } = input;
  const eventId = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Build a metadata payload that's safe to land on Supabase + (later)
  // on Bitcoin. NO T0 fields. The two T2 attribution values come from
  // decision.receipt; the rest are public-asset references and the
  // decision shape itself.
  const metadata: Record<string, unknown> = {
    actor_alias_commitment: decision.receipt.aliasCommitment,
    cohort_id: decision.receipt.cohortId,
    receipt_mode: decision.receipt.mode,
    asset_id: descriptor.assetId,
    asset_state: descriptor.state,
    gating_kind: descriptor.gating.kind,
    action,
    allow: decision.allow,
    reason: decision.reason,
    delivery_mode: decision.deliveryMode,
    identifiability: context.identifiability,
    // Source provenance — debugging only, not security-bearing
    persona_source: context.source,
  };

  await emitOrchestrationEvent({
    event_id: eventId,
    timestamp: new Date().toISOString(),
    event_type: 'access_decision',
    from_role: 'aigent-z',
    to_role: 'aigent-c',
    reason: `${action} ${decision.allow ? 'ALLOW' : 'DENY'}/${decision.reason}`,
    journey_stage: 'acolyte',
    active_cartridge: null,
    active_codex: null,
    receipt_eligible: decision.receipt.mode !== 'none',
    metadata,
  });
}
