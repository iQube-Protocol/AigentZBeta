/**
 * DVN Receipt Finalization Service
 *
 * Polls get_ready_messages() from the cross_chain_service canister and marks
 * all matching provisional records as finalized:
 *  - registry_receipts  (provisional → false, finalized_at set)
 *  - qc_events          (cascade via receipt_id FK)
 *  - wallet_transactions (dvn_batch_id matches the DVN message ID)
 */

import { getActor } from '@/services/ops/icAgent';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export interface FinalizationResult {
  ok: boolean;
  readyMessageCount: number;
  receiptsFinalized: number;
  qcEventsFinalized: number;
  walletTxsFinalized: number;
  error?: string;
}

export async function finalizeReadyReceipts(): Promise<FinalizationResult> {
  const result: FinalizationResult = {
    ok: false,
    readyMessageCount: 0,
    receiptsFinalized: 0,
    qcEventsFinalized: 0,
    walletTxsFinalized: 0,
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

  // 1. Fetch quorum-passed messages from the DVN canister
  let readyMessages: Array<{ id: string }>;
  try {
    const dvn = await getActor<any>(canisterId, dvnIdl);
    readyMessages = await dvn.get_ready_messages();
  } catch (err: any) {
    result.error = `Canister call failed: ${err?.message ?? 'unknown'}`;
    return result;
  }

  if (!readyMessages || readyMessages.length === 0) {
    result.ok = true;
    return result;
  }

  result.readyMessageCount = readyMessages.length;
  const messageIds = readyMessages.map((m) => m.id).filter(Boolean);
  const now = new Date().toISOString();

  // 2. Finalize registry_receipts — returns the receipt IDs so we can cascade
  const { data: receiptRows, error: receiptErr } = await supabase
    .from('registry_receipts')
    .update({ provisional: false, finalized_at: now })
    .in('dvn_message_id', messageIds)
    .eq('provisional', true)
    .select('id');

  if (receiptErr) {
    result.error = `registry_receipts update failed: ${receiptErr.message}`;
    return result;
  }

  result.receiptsFinalized = receiptRows?.length ?? 0;

  // 3. Cascade finalization to qc_events via receipt_id FK
  if (result.receiptsFinalized > 0) {
    const receiptIds = (receiptRows ?? []).map((r: { id: string }) => r.id);
    const { data: qcRows, error: qcErr } = await supabase
      .from('qc_events')
      .update({ provisional: false, finalized_at: now })
      .in('receipt_id', receiptIds)
      .eq('provisional', true)
      .select('id');

    if (qcErr) {
      console.error('[DVN Finalization] qc_events cascade failed:', qcErr.message);
    } else {
      result.qcEventsFinalized = qcRows?.length ?? 0;
    }
  }

  // 4. Finalize wallet_transactions — dvn_batch_id is set to the DVN message ID by the batcher
  const { data: txRows, error: txErr } = await supabase
    .from('wallet_transactions')
    .update({ provisional: false, finalized_at: now })
    .in('dvn_batch_id', messageIds)
    .eq('provisional', true)
    .select('id');

  if (txErr) {
    console.error('[DVN Finalization] wallet_transactions update failed:', txErr.message);
  } else {
    result.walletTxsFinalized = txRows?.length ?? 0;
  }

  result.ok = true;
  return result;
}
