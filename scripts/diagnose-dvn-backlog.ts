/**
 * READ-ONLY diagnostic for the DVN/canister sync drift reported on /ops
 * (operator directive, 2026-08-08): "Trace the 710-item backlog first. Do
 * not mint new receipts or repeat external ceremonies."
 *
 * Makes ONLY query-shaped canister calls (get_pending_messages,
 * get_ready_messages, get_dvn_message, get_pending_count) and read-only
 * Supabase selects. NEVER calls submit_dvn_message, submit_attestation,
 * batch_now, anchor, or any /api/ops/sync/repair or
 * /api/ops/layerzero/process equivalent. Never calls Auto Repair.
 *
 * Usage:
 *   npx tsx scripts/diagnose-dvn-backlog.ts
 *
 * Requires CROSS_CHAIN_SERVICE_CANISTER_ID, PROOF_OF_STATE_CANISTER_ID, and
 * the Supabase env vars in .env.local (dotenv-loaded, matching this repo's
 * other standalone operator scripts).
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getAnonymousActor } from '../services/ops/icAgent';
import { idlFactory as dvnIdl } from '../services/ops/idl/cross_chain_service';
import { idlFactory as posIdl } from '../services/ops/idl/proof_of_state';
import { getSupabaseServer } from '../app/api/_lib/supabaseServer';

interface DVNMessage {
  id: string;
  source_chain: number;
  destination_chain: number;
  payload: number[] | Record<string, number>;
  nonce: bigint;
  sender: string;
  timestamp: bigint;
}

function decodePayload(m: DVNMessage): Record<string, unknown> | null {
  try {
    const bytes = Array.isArray(m.payload) ? m.payload : Object.values(m.payload).map((v) => Number(v));
    const text = new TextDecoder().decode(Uint8Array.from(bytes));
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main() {
  const DVN_ID = process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
  const POS_ID = process.env.PROOF_OF_STATE_CANISTER_ID || process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
  if (!DVN_ID || !POS_ID) {
    console.error('CROSS_CHAIN_SERVICE_CANISTER_ID and PROOF_OF_STATE_CANISTER_ID must both be set in .env.local.');
    process.exit(1);
  }

  console.log(`DVN canister: ${DVN_ID}`);
  console.log(`PoS canister: ${POS_ID}\n`);

  const dvn = await getAnonymousActor<{
    get_pending_messages: () => Promise<DVNMessage[]>;
    get_ready_messages: () => Promise<DVNMessage[]>;
    get_dvn_message: (id: string) => Promise<[DVNMessage] | []>;
  }>(DVN_ID, dvnIdl);
  const pos = await getAnonymousActor<{ get_pending_count: () => Promise<bigint> }>(POS_ID, posIdl);

  console.log('── Canister-side counts (read-only query calls) ──────────────────────');
  const [pending, ready, posPendingCount] = await Promise.all([
    dvn.get_pending_messages().catch((e) => { console.error('get_pending_messages failed:', e.message); return []; }),
    dvn.get_ready_messages().catch((e) => { console.error('get_ready_messages failed:', e.message); return []; }),
    pos.get_pending_count().catch((e) => { console.error('get_pending_count failed:', e.message); return BigInt(-1); }),
  ]);
  console.log(`DVN get_pending_messages(): ${pending.length}`);
  console.log(`DVN get_ready_messages():   ${ready.length}`);
  console.log(`PoS get_pending_count():    ${Number(posPendingCount)}`);
  console.log(`drift = |PoS - DVN pending| = ${Math.abs(Number(posPendingCount) - pending.length)}\n`);

  console.log('── Who produced the pending messages? (decoded action field) ─────────');
  const byAction = new Map<string, number>();
  const receiptIdByMessageId = new Map<string, string>();
  for (const m of pending) {
    const decoded = decodePayload(m);
    const action = (decoded?.action as string) ?? '(undecodable payload)';
    byAction.set(action, (byAction.get(action) ?? 0) + 1);
    if (decoded?.action === 'AIGENTME_ACTIVITY_RECEIPT' && typeof decoded.receiptId === 'string') {
      receiptIdByMessageId.set(m.id, decoded.receiptId);
    }
  }
  for (const [action, count] of [...byAction.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${action}`);
  }
  console.log(`\n  ${receiptIdByMessageId.size} of ${pending.length} pending messages decode as AIGENTME_ACTIVITY_RECEIPT (i.e. correspond to an activity_receipts row).\n`);

  console.log('── Supabase activity_receipts, by receipt_status ──────────────────────');
  const admin = getSupabaseServer();
  if (!admin) {
    console.error('Supabase configuration missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exit(1);
  }
  for (const status of ['local', 'dvn_pending', 'dvn_recorded', 'dvn_failed']) {
    const { count } = await admin.from('activity_receipts').select('id', { count: 'exact', head: true }).eq('receipt_status', status);
    console.log(`  ${status.padEnd(12)} ${count ?? '(error)'}`);
  }

  console.log('\n── dvn_pending rows: are they in the canister pending set, the ready set, or neither (orphaned)? ──');
  const { data: dvnPendingRows } = await admin
    .from('activity_receipts')
    .select('id, action_type, agents_invoked, dvn_receipt_id, created_at')
    .eq('receipt_status', 'dvn_pending')
    .limit(2000);
  const pendingIds = new Set(pending.map((m) => m.id));
  const readyIds = new Set(ready.map((m) => m.id));
  let inPending = 0, inReady = 0, orphaned = 0;
  for (const row of dvnPendingRows ?? []) {
    if (!row.dvn_receipt_id) { orphaned++; continue; }
    if (pendingIds.has(row.dvn_receipt_id)) inPending++;
    else if (readyIds.has(row.dvn_receipt_id)) inReady++;
    else orphaned++;
  }
  console.log(`  total local dvn_pending rows: ${dvnPendingRows?.length ?? 0}`);
  console.log(`  still in canister pending set:      ${inPending}`);
  console.log(`  ALREADY in canister ready set (finalizer never ran): ${inReady}`);
  console.log(`  orphaned (no dvn_receipt_id, or id not found in either set): ${orphaned}`);

  console.log('\n── The specific receipts named in the operator report ──────────────────');
  const { data: nakamotoRows } = await admin
    .from('activity_receipts')
    .select('id, action_type, receipt_status, dvn_receipt_id, summary, created_at')
    .contains('agents_invoked', ['aigent-nakamoto'])
    .eq('receipt_status', 'dvn_failed')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Nakamoto dvn_failed receipts:');
  console.log(JSON.stringify(nakamotoRows, null, 2));

  const { data: delegationRows } = await admin
    .from('activity_receipts')
    .select('id, action_type, receipt_status, dvn_receipt_id, summary, agents_invoked, created_at')
    .in('action_type', ['agent_delegated', 'agent_delegation_revoked'])
    .eq('receipt_status', 'dvn_failed')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('\nOne ordinary failed delegation receipt (most recent 5 shown):');
  console.log(JSON.stringify(delegationRows, null, 2));

  console.log('\nDiagnosis complete. Nothing was mutated: only get_pending_messages, ');
  console.log('get_ready_messages, get_pending_count, and Supabase SELECTs were called.');
}

main().catch((err) => {
  console.error('Diagnostic script failed:', err);
  process.exit(1);
});
