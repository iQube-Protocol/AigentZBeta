/**
 * services/dvn/activityReceiptDvnPipeline.ts — Aigent Me Phase 6.b Part 4.
 *
 * ─── CRITICAL INFRASTRUCTURE — DO NOT MODIFY WITHOUT OPERATOR APPROVAL ───
 * This file is protected under the CLAUDE.md DVN Pipeline Protection rule.
 * The ONLY permitted unilateral change is adding new action types to
 * ANCHORABLE_ACTION_TYPES. Any other modification to this file (state
 * machine logic, canister interaction, payload shape, hashing, identity
 * handling, error paths) requires explicit written approval from the
 * operator. DVN failures are escalated via console.error so they surface
 * in Amplify/CloudWatch logs immediately.
 * ──────────────────────────────────────────────────────────────────────────
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
  'passport_application_submitted',
  'passport_issued',
  'passport_status_changed',
  'passport_revoked',
  'passport_privilege_changed',
  'passport_infraction_recorded',
  // Governance (Operation Chrysalis Phase 0A)
  'governance_decision_ratified',
  'governance_decision_amended',
  'governance_authority_exercised',
  'governance_escalation_triggered',
  // Consumer task runner (Workstream C-b) — task-completion provenance
  'experience_task_completed',
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

/** Canister call timeout — 15 seconds. Prevents indefinite hangs. */
const DVN_CALL_TIMEOUT_MS = 15_000;

/**
 * Validate that the record carries the minimum fields required for a
 * well-formed DVN payload. Returns null when valid, an error string
 * describing the deficiency otherwise.
 */
function validateReceiptForDvn(record: ActivityReceiptRecord, personaId: string): string | null {
  if (!record.id) return 'record.id is empty';
  if (!personaId) return 'personaId is empty';
  if (!record.actionType) return 'record.actionType is empty';
  if (!record.summary) return 'record.summary is empty';
  if (!record.createdAt) return 'record.createdAt is empty';
  return null;
}

/**
 * Submit a single activity receipt to the DVN canister. Returns the
 * canister-assigned messageId on success so the caller can persist it
 * on the receipt row. Best-effort: when the canister env var is missing
 * or the call throws, returns ok:false and leaves the row untouched.
 *
 * Hardened: validates payload fields before calling, enforces a timeout
 * so a hung canister doesn't stall the Lambda indefinitely, and handles
 * both plain-string and Candid Variant responses.
 */
export async function submitActivityReceiptToDvn(
  record: ActivityReceiptRecord,
  personaId: string,
): Promise<ActivityDvnSubmissionResult> {
  try {
    // Pre-flight validation — catches corrupt/partial records before
    // paying the cost of an IC call.
    const validationErr = validateReceiptForDvn(record, personaId);
    if (validationErr) {
      return { ok: false, error: `Payload validation failed: ${validationErr}` };
    }

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

    // Timeout-guarded canister call — prevents Lambda hanging on an
    // unresponsive replica.
    const response = await Promise.race([
      dvn.submit_dvn_message(0, 0, payloadBytes, messageId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`DVN canister call timed out after ${DVN_CALL_TIMEOUT_MS}ms`)), DVN_CALL_TIMEOUT_MS),
      ),
    ]);

    // Canister may return a plain string OR a Candid Variant: { Ok: string } / { Err: string }
    if (typeof response === 'string') {
      return { ok: true, messageId: response };
    }
    const resp = response as Record<string, unknown> | null | undefined;
    if (resp && typeof resp === 'object') {
      if ('Ok' in resp && typeof resp.Ok === 'string') {
        return { ok: true, messageId: resp.Ok };
      }
      if ('Err' in resp && typeof resp.Err === 'string') {
        return { ok: false, error: `Canister Err variant: ${resp.Err}` };
      }
    }
    return { ok: false, error: `submit_dvn_message returned unexpected shape: ${JSON.stringify(response)}` };
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
        // ESCALATION: DVN failures are critical — console.error ensures
        // they appear in CloudWatch/Amplify error-level logs so the
        // operator is alerted immediately.
        console.error(
          `[DVN ESCALATION] Activity receipt ${record.id} submission FAILED — ` +
            `actionType=${record.actionType} cartridge=${record.activeCartridge} ` +
            `error="${result.error ?? 'unknown'}"`,
        );
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
    readyMessages = await Promise.race([
      dvn.get_ready_messages(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`get_ready_messages timed out after ${DVN_CALL_TIMEOUT_MS}ms`)), DVN_CALL_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[DVN ESCALATION] Finalizer canister call FAILED: ${errMsg}`);
    result.error = `Canister call failed: ${errMsg}`;
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
