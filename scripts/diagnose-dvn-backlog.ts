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
  const pos = await getAnonymousActor<{
    get_pending_count: () => Promise<bigint>;
    get_anchor_status: () => Promise<string>;
    get_batches: () => Promise<
      Array<{
        root: string;
        receipts: Array<{ id: string; data_hash: string; timestamp: bigint }>;
        btc_anchor_txid: [string] | [];
        btc_block_height: [bigint] | [];
      }>
    >;
  }>(POS_ID, posIdl);

  console.log('── Canister-side counts (read-only query calls) ──────────────────────');
  /*
   * THREE-VALUED, NEVER COLLAPSED TO ZERO (fix, 2026-08-08). The first run of
   * this script caught `get_ready_messages` failing with IC0504 — the ready set
   * had grown to 5.7 MB against the IC's 3 MiB query-response cap — and then
   * reported "get_ready_messages(): 0", because the catch returned []. That is
   * the same fail-silent shape this whole investigation is about: "could not
   * read" rendered as "nothing there". An unreadable accessor is now reported
   * as UNREADABLE, with its error, and never as an empty set.
   */
  type SetRead = { readable: true; messages: DVNMessage[] } | { readable: false; error: string };
  const readSet = async (label: string, call: () => Promise<DVNMessage[]>): Promise<SetRead> => {
    try {
      return { readable: true, messages: await call() };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`  ${label}: UNREADABLE — ${error.split('\n')[0]}`);
      return { readable: false, error };
    }
  };

  const [pendingRead, readyRead, posPendingCount] = await Promise.all([
    readSet('get_pending_messages', () => dvn.get_pending_messages()),
    readSet('get_ready_messages', () => dvn.get_ready_messages()),
    pos.get_pending_count().catch((e) => { console.error('get_pending_count failed:', e.message); return BigInt(-1); }),
  ]);
  const pending = pendingRead.readable ? pendingRead.messages : [];

  console.log(`DVN get_pending_messages(): ${pendingRead.readable ? pendingRead.messages.length : 'UNREADABLE'}`);
  console.log(`DVN get_ready_messages():   ${readyRead.readable ? readyRead.messages.length : 'UNREADABLE'}`);
  console.log(`PoS get_pending_count():    ${Number(posPendingCount)}`);
  if (pendingRead.readable) {
    console.log(`drift = |PoS - DVN pending| = ${Math.abs(Number(posPendingCount) - pending.length)}`);
  }
  if (!readyRead.readable) {
    console.log('\n  !! get_ready_messages() CANNOT BE READ. finalizeReadyActivityReceipts()');
    console.log('     depends on it entirely, so NO receipt can ever reach dvn_recorded');
    console.log('     while this holds. If the error is IC0504/payload-too-large, the set is');
    console.log('     larger than the IC query cap and grows monotonically — every further');
    console.log('     pending->ready promotion makes it strictly worse.');
  }
  console.log('');

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

  console.log('\n── dvn_pending rows: where is each one, exactly? ──────────────────────');
  const { data: dvnPendingRows } = await admin
    .from('activity_receipts')
    .select('id, action_type, agents_invoked, dvn_receipt_id, created_at')
    .eq('receipt_status', 'dvn_pending')
    .limit(2000);
  const pendingIds = new Set(pending.map((m) => m.id));
  const readyIds = new Set(readyRead.readable ? readyRead.messages.map((m) => m.id) : []);

  /*
   * `no dvn_receipt_id` is broken out separately from `id not found`. All three
   * writers of receipt_status='dvn_pending' (activityReceiptDvnPipeline's
   * enqueue, admin/dvn-retry-all, assistant/receipts/[id]/retry-dvn) set
   * dvn_receipt_id ATOMICALLY with it, so a dvn_pending row with a null id
   * cannot come from any known path — it would indicate a fourth writer. The
   * first run of this script lumped both into one "orphaned" bucket and could
   * not tell them apart.
   */
  let noMessageId = 0, inPending = 0, inReady = 0, notFound = 0;
  const notFoundSamples: string[] = [];
  for (const row of dvnPendingRows ?? []) {
    if (!row.dvn_receipt_id) { noMessageId++; continue; }
    if (pendingIds.has(row.dvn_receipt_id)) inPending++;
    else if (readyIds.has(row.dvn_receipt_id)) inReady++;
    else { notFound++; if (notFoundSamples.length < 5) notFoundSamples.push(row.dvn_receipt_id); }
  }
  console.log(`  total local dvn_pending rows: ${dvnPendingRows?.length ?? 0}`);
  console.log(`  no dvn_receipt_id at all (unexplained — no known writer does this): ${noMessageId}`);
  console.log(`  still in canister pending set:                        ${inPending}`);
  console.log(`  in canister ready set (finalizer never ran):          ${inReady}${readyRead.readable ? '' : '  [ready set UNREADABLE — cannot classify]'}`);
  console.log(`  message id not found in either readable set:          ${notFound}`);

  /*
   * THE DECISIVE PROBE. `get_dvn_message(id)` returns ONE message, so its
   * response is small and is not subject to the cap that makes
   * get_ready_messages unreadable. If the canister still HAS these messages,
   * they propagated successfully and the only thing that failed is our local
   * acknowledgement — which is a reconciliation defect, never a reason to
   * recreate the constitutional events.
   */
  if (notFoundSamples.length > 0) {
    console.log('\n── Per-id probe of "not found" ids (get_dvn_message — small response, unaffected by the cap) ──');
    for (const messageId of notFoundSamples) {
      try {
        const opt = await dvn.get_dvn_message(messageId);
        const present = Array.isArray(opt) ? opt.length > 0 : opt != null;
        console.log(`  ${messageId}`);
        console.log(`    canister ${present ? 'HAS this message' : 'does NOT have this message'}` +
          (present && pendingIds.size === 0 ? ' — and the pending set is empty, so it is past pending' : ''));
      } catch (e) {
        console.log(`  ${messageId}\n    probe failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
      }
    }
  }

  /*
   * `local` is NOT uniformly a defect: a receipt whose action type is not in
   * ANCHORABLE_ACTION_TYPES is never submitted at all and correctly stays
   * local forever. Only anchorable types sitting in local are stalled.
   */
  console.log('\n── `local` rows: stalled, or legitimately never anchorable? ───────────');
  const { shouldAnchorActionType } = await import('../services/dvn/activityReceiptDvnPipeline');
  const { data: localRows } = await admin
    .from('activity_receipts')
    .select('action_type')
    .eq('receipt_status', 'local')
    .limit(5000);
  let anchorableLocal = 0, notAnchorableLocal = 0;
  const stalledByType = new Map<string, number>();
  for (const row of localRows ?? []) {
    if (shouldAnchorActionType(row.action_type)) {
      anchorableLocal++;
      stalledByType.set(row.action_type, (stalledByType.get(row.action_type) ?? 0) + 1);
    } else notAnchorableLocal++;
  }
  console.log(`  anchorable but still local (STALLED — never submitted): ${anchorableLocal}`);
  console.log(`  not an anchorable action type (correctly local forever): ${notAnchorableLocal}`);
  if (stalledByType.size > 0) {
    console.log('  stalled anchorable types:');
    for (const [t, c] of [...stalledByType.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(c).padStart(4)}  ${t}`);
    }
  }

  console.log('\n── The specific receipts named in the operator report ──────────────────');
  /*
   * EVERY STATUS, NOT JUST dvn_failed (fix, 2026-08-08). The first run filtered
   * on receipt_status='dvn_failed' and so could not see that the receipts the
   * operator had SEEN badged "DVN FAILED" (agent_card_enriched /
   * horizen_pnl_transparency_enabled, 2026-08-07 16:33) were absent from the
   * result. A filtered query cannot distinguish "that row no longer has this
   * status" from "that row does not exist" — and the first is the interesting
   * answer, because retry-dvn flips dvn_failed -> dvn_pending on a successful
   * resubmit. Reporting present state means reporting it whatever it now is.
   */
  const { data: nakamotoRows } = await admin
    .from('activity_receipts')
    .select('id, action_type, receipt_status, dvn_receipt_id, summary, created_at')
    .contains('agents_invoked', ['aigent-nakamoto'])
    .order('created_at', { ascending: false })
    .limit(20);
  console.log('Nakamoto receipts (ALL statuses, most recent 20) — present state:');
  for (const r of nakamotoRows ?? []) {
    console.log(`  ${r.receipt_status.padEnd(12)} ${r.action_type.padEnd(38)} ${r.created_at}  msgId=${r.dvn_receipt_id ?? 'null'}`);
  }
  const nakamotoByStatus = new Map<string, number>();
  for (const r of nakamotoRows ?? []) nakamotoByStatus.set(r.receipt_status, (nakamotoByStatus.get(r.receipt_status) ?? 0) + 1);
  console.log(`  → ${[...nakamotoByStatus.entries()].map(([s, c]) => `${s}: ${c}`).join(' · ')}`);

  const { data: delegationRows } = await admin
    .from('activity_receipts')
    .select('id, action_type, receipt_status, dvn_receipt_id, summary, agents_invoked, created_at')
    .in('action_type', ['agent_delegated', 'agent_delegation_revoked'])
    .eq('receipt_status', 'dvn_failed')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('\nOne ordinary failed delegation receipt (most recent 5 shown):');
  console.log(JSON.stringify(delegationRows, null, 2));

  /*
   * ── WHAT IS ACTUALLY ANCHORED TO BITCOIN (operator question, 2026-08-08) ──
   *
   * The Ops dashboard defines `drift = |PoS.get_pending_count() −
   * DVN.get_pending_messages().length|`, which only means anything if the two
   * canisters hold representations of the SAME acts. This section tests that
   * premise against the PoS canister's own batch contents rather than against
   * the counter.
   *
   * `data_hash` is the only thing `issue_receipt(text)` accepts, so grouping
   * the anchored hashes by prefix shows exactly which subsystems ever reached
   * Bitcoin. `sync_repair_*` is the synthetic filler `/api/ops/sync/repair`'s
   * `balance` strategy injects purely to make the drift counter agree — every
   * one of those is batched and BTC-anchored for real.
   */
  console.log('\n── What is actually in the BTC-anchored PoS batches? ─────────────────');
  try {
    console.log(`PoS get_anchor_status(): ${await pos.get_anchor_status()}`);
    const batches = await pos.get_batches();
    const anchored = batches.filter((b) => b.btc_anchor_txid.length > 0);
    const receipts = batches.flatMap((b) => b.receipts);
    console.log(`total batches: ${batches.length}`);
    console.log(`batches WITH a btc_anchor_txid: ${anchored.length}`);
    console.log(`total receipts across all batches: ${receipts.length}`);

    const byPrefix = new Map<string, number>();
    for (const r of receipts) {
      // Synthetic/system receipts use a `<subsystem>_...` convention; a real
      // content hash is bare hex. Bucketing on the first underscore separates
      // the two without assuming any particular subsystem name.
      const hash = String(r.data_hash);
      const key = hash.includes('_') ? `${hash.split('_')[0]}_*` : '(bare hex content hash)';
      byPrefix.set(key, (byPrefix.get(key) ?? 0) + 1);
    }
    console.log('\nanchored receipts by data_hash family:');
    [...byPrefix.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${k}`));

    const synthetic = [...byPrefix.entries()]
      .filter(([k]) => /^(sync|test|anchor)_\*$/.test(k))
      .reduce((n, [, v]) => n + v, 0);
    if (receipts.length > 0) {
      const pct = Math.round((synthetic / receipts.length) * 100);
      console.log(
        `\n  ${synthetic}/${receipts.length} (${pct}%) of everything ever BTC-anchored is synthetic ` +
          `(sync-repair filler, tests, anchor probes) rather than a constitutional act.`,
      );
    }
    console.log(
      '\n  NOTE: activity_receipts never calls pos.issue_receipt (see\n' +
        '  services/dvn/activityReceiptDvnPipeline.ts — its only hand-off is\n' +
        '  dvn.submit_dvn_message), so no constitutional receipt can appear above.',
    );
  } catch (err) {
    console.log(`get_batches UNREADABLE: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    console.log('(If IC0504/payload-too-large, the batch set now exceeds the IC query cap too.)');
  }

  console.log('\nDiagnosis complete. Nothing was mutated: only get_pending_messages, ');
  console.log('get_ready_messages, get_pending_count, get_anchor_status, get_batches,');
  console.log('and Supabase SELECTs were called.');
}

main().catch((err) => {
  console.error('Diagnostic script failed:', err);
  process.exit(1);
});
