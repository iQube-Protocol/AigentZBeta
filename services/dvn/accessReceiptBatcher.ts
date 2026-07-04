/**
 * Access Receipt DVN Submitter — Phase 3.4 of the unified IAM foundation plan.
 *
 * Picks up orchestration_events rows produced by the spine's receipt
 * emitter (Phase 3.2), batches them, and submits each as a DVN message
 * via the cross_chain_service canister. The canister handles the
 * Bitcoin ordinal inscription pipeline; we just record the message id.
 *
 * Idempotent: rows with on_chain_tx_id IS NOT NULL are skipped. Safe
 * to re-run on schedule (cron / Lambda task / manual operator script).
 *
 * What the row's payload looks like on chain (T2-only — never T0):
 *   {
 *     action: 'ACCESS_DECISION_RECEIPT',
 *     event_id: <uuid>,
 *     alias_commitment: <64-char hex>,    // T2
 *     cohort_id: <string>,                // T2
 *     asset_id: <string>,                 // public asset reference
 *     gating_kind: 'free' | 'payment' | 'credential',
 *     action: 'read' | 'transfer' | ...,
 *     allow: bool,
 *     reason: <decision reason>,
 *     identifiability: <persona's clamped level>,
 *     timestamp: <ms>
 *   }
 *
 * NO personaId, NO authProfileId, NO rootDid. The canister-side code
 * never sees those values either; the privacy contract holds end-to-end.
 */

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export interface AccessReceiptBatchResult {
  ok: boolean;
  pendingCount: number;
  submitted: number;
  failed: number;
  errors?: Array<{ event_id: string; error: string }>;
}

export interface AccessReceiptBatchOptions {
  /** Max rows to submit in one run. Default 20. */
  limit?: number;
  /** Only batch rows older than this many seconds (lets short-lived test rows
   *  age out before being inscribed). Default 60. */
  minAgeSeconds?: number;
  /** Stop submitting after this many ms to avoid Lambda/API-Gateway 504.
   *  Default 22000 (22s) — well inside the 29s API Gateway hard limit. */
  maxFunctionMs?: number;
}

export async function submitPendingAccessReceipts(
  opts: AccessReceiptBatchOptions = {},
): Promise<AccessReceiptBatchResult> {
  const limit = opts.limit ?? 20;
  const minAgeSeconds = opts.minAgeSeconds ?? 60;
  const maxFunctionMs = opts.maxFunctionMs ?? 20_000;
  const deadline = Date.now() + maxFunctionMs;
  const result: AccessReceiptBatchResult = {
    ok: false,
    pendingCount: 0,
    submitted: 0,
    failed: 0,
  };

  const canisterId =
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
    process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  if (!canisterId) {
    return { ...result, ok: false, errors: [{ event_id: '-', error: 'CROSS_CHAIN_SERVICE_CANISTER_ID not configured' }] };
  }

  const sb = getSupabaseServer();
  if (!sb) {
    return { ...result, errors: [{ event_id: '-', error: 'Supabase unavailable' }] };
  }

  // 1. Pull pending rows. The partial index from Phase 3.2 migration
  //    keeps this scan tight: WHERE receipt_mode != 'none' AND
  //    on_chain_tx_id IS NULL.
  const cutoffIso = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const { data: rows, error: queryErr } = await sb
    .from('orchestration_events')
    .select('event_id, event_type, metadata, created_at, actor_alias_commitment, cohort_id, receipt_mode')
    .eq('event_type', 'access_decision')
    .neq('receipt_mode', 'none')
    .is('on_chain_tx_id', null)
    .lt('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (queryErr) {
    return { ...result, errors: [{ event_id: '-', error: `query: ${queryErr.message}` }] };
  }

  result.pendingCount = rows?.length ?? 0;
  if (!rows || rows.length === 0) {
    return { ...result, ok: true };
  }

  // 2. Submit each row. Sequential — the canister handles concurrency
  //    internally and parallel submissions can race on message ids.
  const errors: Array<{ event_id: string; error: string }> = [];
  let dvn: any;
  try {
    dvn = await getActor<any>(canisterId, dvnIdl);
  } catch (e) {
    return { ...result, errors: [{ event_id: '-', error: `actor init: ${(e as Error).message}` }] };
  }

  for (const row of rows) {
    // Stop before the API Gateway hard timeout so the caller gets a response.
    if (Date.now() >= deadline) {
      const deferred = rows.length - result.submitted - result.failed;
      errors.push({ event_id: '-', error: `deadline reached — ${deferred} rows deferred to next run` });
      break;
    }
    try {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const payload = JSON.stringify({
        action: 'ACCESS_DECISION_RECEIPT',
        event_id: row.event_id,
        alias_commitment: row.actor_alias_commitment,
        cohort_id: row.cohort_id,
        asset_id: meta.asset_id ?? null,
        asset_state: meta.asset_state ?? null,
        gating_kind: meta.gating_kind ?? null,
        decision_action: meta.action ?? null,
        allow: meta.allow ?? null,
        reason: meta.reason ?? null,
        identifiability: meta.identifiability ?? null,
        timestamp: new Date(row.created_at as string).getTime(),
      });

      const payloadBytes = Array.from(new TextEncoder().encode(payload));
      const messageId = `access_receipt_${row.event_id}`;
      // Per-call timeout: abort if the canister doesn't respond within 8 s so
      // one hung submission doesn't consume the entire function window.
      const submitResponse = await Promise.race([
        dvn.submit_dvn_message(0, 0, payloadBytes, messageId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('canister call timeout (8 s)')), 8_000),
        ),
      ]);

      const onChainTxId =
        typeof submitResponse === 'string' ? submitResponse : messageId;

      const { error: upErr } = await sb
        .from('orchestration_events')
        .update({ on_chain_tx_id: onChainTxId })
        .eq('event_id', row.event_id);

      if (upErr) {
        errors.push({ event_id: row.event_id, error: `update: ${upErr.message}` });
        result.failed++;
      } else {
        result.submitted++;
      }
    } catch (e) {
      errors.push({ event_id: row.event_id, error: (e as Error).message });
      result.failed++;
    }
  }

  result.ok = result.failed === 0;
  if (errors.length > 0) result.errors = errors;
  return result;
}
