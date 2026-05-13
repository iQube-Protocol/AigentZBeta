/**
 * services/dvn/activityReceiptDvnPipeline.ts — Aigent Me Phase 6.b Part 4.
 *
 * Anchors aigentMe activity_receipts to the DVN cross-chain service.
 * Mirrors the existing qubetalkReceiptPipeline pattern but targets the
 * activity_receipts table and its receipt_status state machine:
 *
 *   local → dvn_pending → dvn_recorded
 *                       ↘ dvn_failed
 *
 * Privacy contract (PRD §11 + CLAUDE.md):
 *   - personaId is T0; only its T2 form (cohortAliasCommitment, when
 *     available) ever flows on-chain. The DVN payload here uses a hashed
 *     persona reference so the receipt is correlatable to its persona
 *     without leaking the spine identifier.
 *   - Summary text + agents/tools/iqubes/context lists are T1-safe; they
 *     describe the action, not the person.
 *   - No PII, no FIO handles, no auth profile id. The route layer
 *     prevents these from landing in the receipt in the first place.
 *
 * Operational notes:
 *   - When CROSS_CHAIN_SERVICE_CANISTER_ID is unset (dev / alpha), the
 *     pipeline is a no-op that leaves the receipt as 'local'. This keeps
 *     local dev working without canister access.
 *   - Submission is fire-and-forget from the receipt-creation hot path so
 *     a slow canister never delays user-facing latency. The finalizer
 *     reconciles state asynchronously.
 */

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createHash } from 'crypto';
import type { ActivityReceiptRecord } from '@/services/receipts/activityReceiptService';

/** Action types worth anchoring on-chain. Low-value events stay local. */
const ANCHORABLE_ACTION_TYPES = new Set<string>([
  'approval_granted',
  'approval_rejected',
  'artifact_sent',
  'experience_model_updated',
]);

export function shouldAnchorActionType(actionType: string): boolean {
  return ANCHORABLE_ACTION_TYPES.has(actionType);
}

/**
 * T2-safe persona reference. SHA-256 of the personaId, prefix-truncated
 * to 16 hex chars. Reversible only by someone who already knows the
 * personaId — i.e. the spine itself. Suitable for chain-bound payloads.
 */
function hashPersonaRef(personaId: string): string {
  return createHash('sha256').update(personaId).digest('hex').slice(0, 16);
}

export interface ActivityDvnSubmissionResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Submit a single activity receipt to the DVN canister. Returns the
 * canister-assigned messageId on success so the caller can persist it
 * on the receipt row. Best-effort: when the canister env var is missing
 * or the call throws, returns ok:false and leaves the row untouched.
 */
export async function submitActivityReceiptToDvn(
  record: ActivityReceiptRecord,
  personaId: string,
): Promise<ActivityDvnSubmissionResult> {
  try {
    const canisterId =
      process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
      process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
    if (!canisterId) {
      return { ok: false, error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' };
    }
    const dvn = await getActor<{
      submit_dvn_message: (a: number, b: number, payload: number[], id: string) => Promise<string>;
    }>(canisterId, dvnIdl);

    const payload = JSON.stringify({
      action: 'AIGENTME_ACTIVITY_RECEIPT',
      receiptId: record.id,
      personaRef: hashPersonaRef(personaId), // T2-safe; never personaId
      activeCartridge: record.activeCartridge,
      actionType: record.actionType,
      summary: record.summary,
      agentsInvoked: record.agentsInvoked,
      toolsUsed: record.toolsUsed,
      iqubesUsed: record.iqubesUsed,
      contextShared: record.contextShared,
      artifactsCreated: record.artifactsCreated,
      approvalsGranted: record.approvalsGranted,
      timestamp: Date.parse(record.createdAt) || Date.now(),
    });
    const payloadBytes = Array.from(new TextEncoder().encode(payload));
    const messageId = `aigentme_receipt_${record.id}_${Date.now()}`;

    const response = await dvn.submit_dvn_message(0, 0, payloadBytes, messageId);
    if (typeof response === 'string') {
      return { ok: true, messageId: response };
    }
    return { ok: false, error: 'submit_dvn_message returned unexpected result' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Fire-and-forget anchor enqueue for the receipt-creation hot path.
 * Resolves immediately so the caller never blocks on DVN; the submission
 * runs in the background and updates the row's receipt_status when it
 * completes (or fails). Safe to call from any server context.
 */
export function enqueueActivityReceiptAnchor(
  record: ActivityReceiptRecord,
  personaId: string,
): void {
  if (!shouldAnchorActionType(record.actionType)) return;
  if (record.receiptStatus !== 'local') return;
  // Background promise — intentionally not awaited.
  void (async () => {
    const result = await submitActivityReceiptToDvn(record, personaId);
    const supabase = getSupabaseServer();
    if (!supabase) return;
    if (result.ok && result.messageId) {
      await supabase
        .from('activity_receipts')
        .update({
          receipt_status: 'dvn_pending',
          dvn_receipt_id: result.messageId,
        })
        .eq('id', record.id);
    } else {
      // Stay 'local' so a future operator run can retry; only flip to
      // dvn_failed when the canister is reachable and returned an error.
      const isUnreachable = !!result.error?.includes('not configured');
      if (!isUnreachable) {
        await supabase
          .from('activity_receipts')
          .update({ receipt_status: 'dvn_failed' })
          .eq('id', record.id);
      }
    }
  })().catch(() => undefined);
}

/**
 * Finalizer — flips activity_receipts from dvn_pending → dvn_recorded for
 * any rows whose dvn_receipt_id is in the canister's get_ready_messages
 * set. Designed to be invoked from a cron / admin route on a schedule.
 */
export interface ActivityReceiptFinalizationResult {
  ok: boolean;
  readyMessageCount: number;
  receiptsFinalized: number;
  error?: string;
}

export async function finalizeReadyActivityReceipts(): Promise<ActivityReceiptFinalizationResult> {
  const result: ActivityReceiptFinalizationResult = {
    ok: false,
    readyMessageCount: 0,
    receiptsFinalized: 0,
  };
  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  if (!canisterId) {
    result.error = 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured';
    return result;
  }
  const supabase = getSupabaseServer();
  if (!supabase) {
    result.error = 'Supabase unavailable';
    return result;
  }
  let readyMessages: Array<{ id: string }>;
  try {
    const dvn = await getActor<{ get_ready_messages: () => Promise<Array<{ id: string }>> }>(canisterId, dvnIdl);
    readyMessages = await dvn.get_ready_messages();
  } catch (err) {
    result.error = `Canister call failed: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }
  if (!readyMessages || readyMessages.length === 0) {
    result.ok = true;
    return result;
  }
  result.readyMessageCount = readyMessages.length;
  const messageIds = readyMessages.map((m) => m.id).filter(Boolean);
  const { data, error } = await supabase
    .from('activity_receipts')
    .update({ receipt_status: 'dvn_recorded' })
    .in('dvn_receipt_id', messageIds)
    .eq('receipt_status', 'dvn_pending')
    .select('id');
  if (error) {
    result.error = `activity_receipts update failed: ${error.message}`;
    return result;
  }
  result.receiptsFinalized = data?.length ?? 0;
  result.ok = true;
  return result;
}
