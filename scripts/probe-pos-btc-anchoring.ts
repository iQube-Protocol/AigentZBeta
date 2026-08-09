/**
 * READ-ONLY probe of the DEPLOYED proof_of_state canister's Bitcoin semantics
 * (operator directive, 2026-08-08, item 5).
 *
 * The question this answers is NOT "does the checked-in Rust look right" — the
 * source in iQube-Protocol/iQubeBeta-Program has already been read. It is
 * "does the DEPLOYED canister actually do what a constitutional anchor claims",
 * because deployed code can differ from checked-in source and only the live
 * canister's own data can settle it.
 *
 * Five questions, each answered from live data or explicitly reported as
 * unanswerable — never inferred:
 *
 *   1. exact `btc_anchor_txid` FORMAT on recent anchored batches
 *   2. exact `btc_block_height` on those batches
 *   3. do those txids EXIST on the configured Bitcoin network
 *   4. does the batch root cryptographically commit to each receipt's
 *      `data_hash` (our commitment H), or only to its `receipt_id`
 *   5. can a valid inclusion proof for H be produced at all
 *
 * Question 4 is decided CRYPTOGRAPHICALLY, not by reading the source: we
 * recompute candidate roots locally from the batch's own receipts and see which
 * construction reproduces the stored root. A match over ids proves the root
 * commits to ids; a match over data_hashes would prove it commits to H. That is
 * a proof about the DEPLOYED canister, independent of any source file.
 *
 * MUTATES NOTHING. Query calls only (`get_batches`), plus outbound reads of a
 * public Bitcoin block explorer. No update calls, no receipt writes.
 */

import { HttpAgent, Actor } from '@dfinity/agent';
import { createHash } from 'crypto';
import { idlFactory as posIdl } from '../services/ops/idl/proof_of_state';

const POS_ID =
  process.env.PROOF_OF_STATE_CANISTER_ID ||
  process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID ||
  'n2hhv-aaaaa-aaaas-qccza-cai';

const IC_HOST = process.env.IC_HOST || 'https://icp-api.io';

/** How many of the most recent anchored batches to report in detail. */
const SAMPLE = 5;

interface MerkleBatch {
  root: string;
  receipts: Array<{ id: string; data_hash: string; timestamp: bigint; merkle_proof: string[] }>;
  created_at: bigint;
  btc_anchor_txid: [] | [string];
  btc_block_height: [] | [bigint];
}

function sha256Hex(parts: string[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(Buffer.from(p, 'utf8'));
  return h.digest('hex');
}

/**
 * Does this txid look like a real Bitcoin transaction id? A real one is
 * exactly 64 lowercase hex characters. Anything else cannot be looked up on
 * any Bitcoin network, which by itself answers question 3 for that batch.
 */
function isPlausibleBtcTxid(txid: string): boolean {
  return /^[0-9a-f]{64}$/.test(txid);
}

async function txidExistsOnBitcoin(txid: string): Promise<{ checked: boolean; exists: boolean; detail: string }> {
  if (!isPlausibleBtcTxid(txid)) {
    return {
      checked: false,
      exists: false,
      detail: 'not a 64-hex-character Bitcoin txid — no Bitcoin network can contain this value, so no lookup is possible',
    };
  }
  for (const [name, url] of [
    ['mempool.space (mainnet)', `https://mempool.space/api/tx/${txid}`],
    ['mempool.space (testnet)', `https://mempool.space/testnet/api/tx/${txid}`],
  ] as const) {
    try {
      const res = await fetch(url);
      if (res.ok) return { checked: true, exists: true, detail: `FOUND on ${name}` };
    } catch (err) {
      return { checked: false, exists: false, detail: `lookup failed (${name}): ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  return { checked: true, exists: false, detail: 'NOT FOUND on mempool.space mainnet or testnet' };
}

async function main() {
  console.log(`PoS canister: ${POS_ID}`);
  console.log(`IC host:      ${IC_HOST}\n`);

  const agent = await HttpAgent.create({ host: IC_HOST });
  const pos = Actor.createActor<{ get_batches: () => Promise<MerkleBatch[]> }>(posIdl, {
    agent,
    canisterId: POS_ID,
  });

  let batches: MerkleBatch[];
  try {
    batches = await pos.get_batches();
  } catch (err) {
    // Same failure class as get_ready_messages: if the response exceeds the
    // IC's query payload cap this is UNREADABLE, never "empty". Reporting a
    // read failure as zero is the exact defect that hid the finalization
    // outage for the system's entire history.
    console.error(`get_batches: UNREADABLE — ${err instanceof Error ? err.message : String(err)}`);
    console.error('\nThis is a READ FAILURE, not an empty result. Do not interpret it as "no batches".');
    process.exit(1);
  }

  const anchored = batches.filter((b) => b.btc_anchor_txid.length > 0);
  console.log('── Batch inventory ────────────────────────────────────────────────');
  console.log(`total batches:            ${batches.length}`);
  console.log(`with btc_anchor_txid:     ${anchored.length}`);
  console.log(`without btc_anchor_txid:  ${batches.length - anchored.length}`);

  // ── Q1/Q2/Q3: txid format, block height, real-network existence ──────────
  const recent = anchored.slice(-SAMPLE).reverse();
  console.log(`\n── Q1/Q2/Q3: the ${recent.length} most recent anchored batches ─────────────────`);
  const heights = new Set<string>();
  const formats = new Set<string>();
  for (const b of recent) {
    const txid = b.btc_anchor_txid[0]!;
    const height = b.btc_block_height.length > 0 ? String(b.btc_block_height[0]) : '(none)';
    heights.add(height);
    formats.add(
      isPlausibleBtcTxid(txid) ? '64-hex (plausible Bitcoin txid)' : `NON-BITCOIN FORMAT: ${txid.replace(/[0-9a-f]{4,}/gi, '<hex>')}`,
    );
    const existence = await txidExistsOnBitcoin(txid);
    console.log(`\n  batch root:      ${b.root}`);
    console.log(`  btc_anchor_txid: ${txid}`);
    console.log(`  btc_block_height:${height}`);
    console.log(`  receipts:        ${b.receipts.length}`);
    console.log(`  on Bitcoin?      ${existence.detail}`);
  }
  console.log(`\n  distinct txid formats seen:  ${[...formats].join(' | ')}`);
  console.log(`  distinct block heights seen: ${[...heights].join(', ')}`);
  if (heights.size === 1 && anchored.length > 1) {
    console.log('  !! every anchored batch reports the SAME block height — a constant, not an observation.');
  }

  // ── Q4: does the root commit to data_hash, or only to receipt ids? ───────
  console.log('\n── Q4: what does the batch root cryptographically commit to? ──────');
  console.log('   (recomputed locally from each batch\'s OWN receipts — a proof about');
  console.log('    the deployed canister, not a reading of any source file)\n');
  let idOnly = 0;
  let hashCommitting = 0;
  let neither = 0;
  for (const b of anchored.slice(-SAMPLE * 4)) {
    const overIds = sha256Hex(b.receipts.map((r) => r.id));
    const overHashes = sha256Hex(b.receipts.map((r) => r.data_hash));
    if (overIds === b.root) idOnly++;
    else if (overHashes === b.root) hashCommitting++;
    else neither++;
  }
  console.log(`  root == sha256(concat receipt IDs):        ${idOnly}`);
  console.log(`  root == sha256(concat receipt data_hash):  ${hashCommitting}`);
  console.log(`  matched neither construction:              ${neither}`);
  if (idOnly > 0 && hashCommitting === 0) {
    console.log('\n  !! The root commits to RECEIPT IDs ONLY. A receipt id is `receipt_<ic_time>` —');
    console.log('     derived from the clock, carrying no information about the receipt content.');
    console.log('     The commitment H is therefore NOT covered by the anchored root, so anchoring');
    console.log('     the root proves nothing whatever about the constitutional act.');
  }

  // ── Q5: can an inclusion proof for H be produced? ────────────────────────
  console.log('\n── Q5: is an inclusion proof for H producible? ─────────────────────');
  const withProof = anchored.filter((b) => b.receipts.some((r) => (r.merkle_proof?.length ?? 0) > 0));
  const totalReceipts = anchored.reduce((n, b) => n + b.receipts.length, 0);
  console.log(`  anchored batches whose receipts carry any merkle_proof: ${withProof.length} of ${anchored.length}`);
  console.log(`  receipts in anchored batches:                           ${totalReceipts}`);
  if (withProof.length === 0) {
    console.log('\n  !! merkle_proof is empty on every receipt. Combined with Q4, no inclusion');
    console.log('     proof for H exists or can be constructed: a single sequential SHA256 over');
    console.log('     concatenated ids is not a Merkle tree, so it admits no per-leaf proof —');
    console.log('     verifying one receipt requires re-supplying every id in the batch.');
  }

  console.log('\nProbe complete. Query calls only — nothing was mutated.');
}

main().catch((err) => {
  console.error('probe failed:', err);
  process.exit(1);
});
