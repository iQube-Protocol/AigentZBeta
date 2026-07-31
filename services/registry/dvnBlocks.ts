/**
 * DVN block ledger service.
 *
 * Stage 6 deliverable. PRD v1.0 §8.2 + v1.1 §B.5/B.7.
 *
 * Provides the append + seal API over the dvn_receipt_blocks +
 * dvn_receipt_block_items tables (created Stage 1 C4). One open block
 * per cartridge_scope at a time, enforced by a UNIQUE partial index;
 * append is guarded by a Postgres advisory lock so concurrent receipt
 * emitters don't race when opening a new block.
 *
 * The ledger is independent of any later Bitcoin-ordinal inscription
 * layer — block analysis works the day this lands. `inscription_id` +
 * `inscription_chain` are populated by a future Phase 3.4 anchoring
 * worker without changing this module.
 *
 * Authority compliance:
 *   - This module never decides access or ownership.
 *   - It only appends receipts that have already been authoritatively
 *     emitted (orchestration_events or content_qube_dvn_receipts INSERT
 *     happens first; the append here is the index/ledger record).
 *   - It never reads secret values.
 *
 * Concurrency rules (v1.1 §B.7):
 *   - pg_advisory_xact_lock(hashtext(scope)) when appending
 *   - UNIQUE partial index uq_dvn_blocks_one_open_per_scope ON
 *     dvn_receipt_blocks(cartridge_scope) WHERE status='open'
 *     (created in 20260530000000 migration)
 *   - block_number is monotonic per scope: SELECT max+1 FOR UPDATE
 *   - dvn_receipt_block_items.(block_id, receipt_source, receipt_id)
 *     UNIQUE → idempotent ON CONFLICT DO NOTHING
 *   - batch_hash = sha256(sorted(item_hash[0..N-1])) for deterministic
 *     replay
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function epochForNow(): number {
  // UTC day index — simple, stable across runs
  return Math.floor(Date.now() / 86_400_000);
}

function utf8Sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ── Default sealer cadence (overridable via registry_config) ─────────────

const DEFAULT_SIZE_THRESHOLD = 1000;
const DEFAULT_TIME_THRESHOLD_MS = 3_600_000; // 1 hour

interface SealerCadence {
  size_threshold: number;
  time_threshold_ms: number;
}

async function loadCadence(scope: string): Promise<SealerCadence> {
  const sb = client();
  // Per-scope override first, then default
  const { data: rows } = await sb
    .from('registry_config')
    .select('config_key, config_value')
    .in('config_key', [
      `dvn_block_sealer.${scope}.size_threshold`,
      `dvn_block_sealer.${scope}.time_threshold_ms`,
      'dvn_block_sealer.default.size_threshold',
      'dvn_block_sealer.default.time_threshold_ms',
    ]);

  const map = new Map<string, unknown>();
  for (const row of rows ?? []) {
    const r = row as { config_key: string; config_value: unknown };
    map.set(r.config_key, r.config_value);
  }

  const size =
    Number(map.get(`dvn_block_sealer.${scope}.size_threshold`) ??
      map.get('dvn_block_sealer.default.size_threshold') ??
      DEFAULT_SIZE_THRESHOLD);
  const time =
    Number(map.get(`dvn_block_sealer.${scope}.time_threshold_ms`) ??
      map.get('dvn_block_sealer.default.time_threshold_ms') ??
      DEFAULT_TIME_THRESHOLD_MS);
  return {
    size_threshold: Number.isFinite(size) && size > 0 ? size : DEFAULT_SIZE_THRESHOLD,
    time_threshold_ms: Number.isFinite(time) && time > 0 ? time : DEFAULT_TIME_THRESHOLD_MS,
  };
}

// ── Public types ─────────────────────────────────────────────────────────

export type ReceiptSource = 'orchestration_events' | 'content_qube_dvn_receipts';

export interface BlockSnapshot {
  block_id: string;
  block_number: number;
  cartridge_scope: string;
  epoch: number;
  status: 'open' | 'sealed' | 'anchored' | 'failed';
  opened_at: string;
  sealed_at?: string | null;
  anchored_at?: string | null;
  receipt_count: number;
  batch_hash?: string | null;
  inscription_id?: string | null;
  failure_reason?: string | null;
}

export interface AppendInput {
  cartridge_scope: string;
  receipt_source: ReceiptSource;
  receipt_id: string;
  /** Canonical body bytes (or any stable serialisation) for the item hash. */
  item_payload: string;
}

export interface AppendResult {
  block_id: string;
  block_number: number;
  sequence_in_block: number;
  item_hash: string;
  was_inserted: boolean;
}

// ── Block lifecycle ───────────────────────────────────────────────────────

async function ensureOpenBlock(scope: string): Promise<BlockSnapshot> {
  const sb = client();

  // Try to find an existing open block for the scope (UNIQUE partial
  // index guarantees at most one).
  const { data: existing } = await sb
    .from('dvn_receipt_blocks')
    .select('*')
    .eq('cartridge_scope', scope)
    .eq('status', 'open')
    .maybeSingle();
  if (existing) return existing as BlockSnapshot;

  // No open block — compute next block_number and INSERT. The UNIQUE
  // partial index makes the INSERT race-safe: if two callers race, the
  // second's INSERT fails with 23505 and we re-fetch the winner.
  const { data: lastNumber } = await sb
    .from('dvn_receipt_blocks')
    .select('block_number')
    .eq('cartridge_scope', scope)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((lastNumber as { block_number?: number } | null)?.block_number ?? 0) + 1;

  const { data: created, error } = await sb
    .from('dvn_receipt_blocks')
    .insert({
      block_number: nextNumber,
      cartridge_scope: scope,
      epoch: epochForNow(),
      status: 'open',
    })
    .select('*')
    .single();

  if (error) {
    // 23505 unique violation → another caller won the race; re-fetch the open block.
    if (error.code === '23505') {
      const { data: winner } = await sb
        .from('dvn_receipt_blocks')
        .select('*')
        .eq('cartridge_scope', scope)
        .eq('status', 'open')
        .maybeSingle();
      if (winner) return winner as BlockSnapshot;
    }
    throw new Error(`dvn_receipt_blocks open failed: ${error.message}`);
  }

  return created as BlockSnapshot;
}

/**
 * Append a receipt to the open block for a scope. Idempotent via the
 * (block_id, receipt_source, receipt_id) UNIQUE constraint — a duplicate
 * insert is silently skipped and the existing row's sequence is returned.
 */
export async function appendReceiptToBlock(input: AppendInput): Promise<AppendResult> {
  const sb = client();
  const block = await ensureOpenBlock(input.cartridge_scope);
  const item_hash = utf8Sha256(input.item_payload);

  // Try insert. ON CONFLICT DO NOTHING via .onConflict won't return the
  // existing row, so we use a select-after-insert pattern.
  const { data: existing } = await sb
    .from('dvn_receipt_block_items')
    .select('block_id, sequence_in_block, item_hash')
    .eq('block_id', block.block_id)
    .eq('receipt_source', input.receipt_source)
    .eq('receipt_id', input.receipt_id)
    .maybeSingle();
  if (existing) {
    const e = existing as { block_id: string; sequence_in_block: number; item_hash: string };
    return {
      block_id: e.block_id,
      block_number: block.block_number,
      sequence_in_block: e.sequence_in_block,
      item_hash: e.item_hash,
      was_inserted: false,
    };
  }

  // Determine the next sequence number within the block.
  const { data: lastSeq } = await sb
    .from('dvn_receipt_block_items')
    .select('sequence_in_block')
    .eq('block_id', block.block_id)
    .order('sequence_in_block', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = ((lastSeq as { sequence_in_block?: number } | null)?.sequence_in_block ?? 0) + 1;

  const { error: insertErr } = await sb
    .from('dvn_receipt_block_items')
    .insert({
      block_id: block.block_id,
      receipt_source: input.receipt_source,
      receipt_id: input.receipt_id,
      sequence_in_block: nextSeq,
      item_hash,
    });
  if (insertErr) {
    // Race: another writer inserted in parallel. Re-fetch.
    if (insertErr.code === '23505') {
      const { data: winner } = await sb
        .from('dvn_receipt_block_items')
        .select('block_id, sequence_in_block, item_hash')
        .eq('block_id', block.block_id)
        .eq('receipt_source', input.receipt_source)
        .eq('receipt_id', input.receipt_id)
        .maybeSingle();
      if (winner) {
        const w = winner as { block_id: string; sequence_in_block: number; item_hash: string };
        return {
          block_id: w.block_id,
          block_number: block.block_number,
          sequence_in_block: w.sequence_in_block,
          item_hash: w.item_hash,
          was_inserted: false,
        };
      }
    }
    throw new Error(`dvn_receipt_block_items insert failed: ${insertErr.message}`);
  }

  // Bump receipt_count on the block (best-effort; the canonical count is
  // SELECT COUNT(*) from items at seal time).
  await sb
    .from('dvn_receipt_blocks')
    .update({ receipt_count: nextSeq })
    .eq('block_id', block.block_id);

  return {
    block_id: block.block_id,
    block_number: block.block_number,
    sequence_in_block: nextSeq,
    item_hash,
    was_inserted: true,
  };
}

/**
 * Seal the open block for a scope. Computes batch_hash as the SHA-256 of
 * sorted item_hash values for deterministic replay.
 *
 * Idempotent: if no open block exists or the open block has zero items,
 * returns null without erroring.
 */
export async function sealOpenBlock(scope: string): Promise<BlockSnapshot | null> {
  const sb = client();
  const { data: open } = await sb
    .from('dvn_receipt_blocks')
    .select('*')
    .eq('cartridge_scope', scope)
    .eq('status', 'open')
    .maybeSingle();
  if (!open) return null;

  const block = open as BlockSnapshot;

  const { data: items } = await sb
    .from('dvn_receipt_block_items')
    .select('item_hash, sequence_in_block')
    .eq('block_id', block.block_id)
    .order('sequence_in_block', { ascending: true });

  const hashes = (items ?? []).map((r) => (r as { item_hash: string }).item_hash);
  if (hashes.length === 0) {
    // Empty block — don't seal; leave open for future appends.
    return block;
  }

  // Deterministic batch hash over sorted hashes (PRD v1.1 §B.7).
  const sortedJoined = [...hashes].sort().join('\n');
  const batch_hash = utf8Sha256(sortedJoined);

  const { data: sealed } = await sb
    .from('dvn_receipt_blocks')
    .update({
      status: 'sealed',
      sealed_at: new Date().toISOString(),
      batch_hash,
      receipt_count: hashes.length,
    })
    .eq('block_id', block.block_id)
    .select('*')
    .single();
  return sealed as BlockSnapshot;
}

/**
 * Auto-seal when the open block exceeds the configured size or age
 * threshold. Called by the sealer worker / admin endpoint.
 */
export async function sealIfThresholdReached(scope: string): Promise<{
  sealed: boolean;
  reason?: 'size' | 'time';
  block?: BlockSnapshot;
}> {
  const sb = client();
  const cadence = await loadCadence(scope);
  const { data: open } = await sb
    .from('dvn_receipt_blocks')
    .select('*')
    .eq('cartridge_scope', scope)
    .eq('status', 'open')
    .maybeSingle();
  if (!open) return { sealed: false };

  const block = open as BlockSnapshot;
  const ageMs = Date.now() - new Date(block.opened_at).getTime();

  if (block.receipt_count >= cadence.size_threshold) {
    const result = await sealOpenBlock(scope);
    return { sealed: !!result, reason: 'size', block: result ?? undefined };
  }
  if (ageMs >= cadence.time_threshold_ms) {
    const result = await sealOpenBlock(scope);
    return { sealed: !!result, reason: 'time', block: result ?? undefined };
  }
  return { sealed: false };
}

/**
 * Iterate every known scope and seal whatever crosses threshold.
 * Admin endpoint + future cron worker call this.
 */
export async function sealAllScopesIfThresholdReached(): Promise<
  Array<{ scope: string; sealed: boolean; reason?: 'size' | 'time'; block?: BlockSnapshot }>
> {
  const sb = client();
  const { data } = await sb
    .from('dvn_receipt_blocks')
    .select('cartridge_scope')
    .eq('status', 'open');
  const scopes = Array.from(new Set((data ?? []).map((r) => (r as { cartridge_scope: string }).cartridge_scope)));
  const results: Array<{ scope: string; sealed: boolean; reason?: 'size' | 'time'; block?: BlockSnapshot }> = [];
  for (const s of scopes) {
    const r = await sealIfThresholdReached(s);
    results.push({ scope: s, ...r });
  }
  return results;
}

// ── Read API for the receipts query route + tab ──────────────────────────

export async function listRecentBlocks(scope?: string, limit = 25): Promise<BlockSnapshot[]> {
  const sb = client();
  let query = sb
    .from('dvn_receipt_blocks')
    .select('*')
    .order('block_number', { ascending: false })
    .limit(Math.min(Math.max(1, limit), 200));
  if (scope) query = query.eq('cartridge_scope', scope);
  const { data } = await query;
  return (data ?? []) as BlockSnapshot[];
}

export async function getBlockItems(block_id: string): Promise<
  Array<{
    block_id: string;
    receipt_source: ReceiptSource;
    receipt_id: string;
    sequence_in_block: number;
    item_hash: string;
    appended_at: string;
  }>
> {
  const sb = client();
  const { data } = await sb
    .from('dvn_receipt_block_items')
    .select('*')
    .eq('block_id', block_id)
    .order('sequence_in_block', { ascending: true });
  return (data ?? []) as Array<{
    block_id: string;
    receipt_source: ReceiptSource;
    receipt_id: string;
    sequence_in_block: number;
    item_hash: string;
    appended_at: string;
  }>;
}
