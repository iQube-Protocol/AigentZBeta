/**
 * deferredMint — queue + (stub) batch processor for tokenQube mints that aren't
 * minted synchronously.
 *
 * A mint is deferred when the caller asks for a batched mint, when the target
 * chain isn't live yet (multi-chain readiness), or when the chain env isn't
 * configured. The batch processor that drains the queue is a future workstream;
 * `processDeferredMints` is a documented stub today.
 *
 * T0-T2: persona_id is T0 (the queue table is service-role RLS only).
 * token_id_commitment is the T2-safe deterministic token id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isChainLive, isMintChain, type MintChain } from '@/services/chain/mintChains';
import { mintTokenQubeOnChain } from '@/services/chain/tokenQubeMintDispatch';

export type DeferReason = 'batch' | 'chain_not_live' | 'env_unconfigured';

export interface EnqueueDeferredMintInput {
  admin: SupabaseClient;
  iqubeId: string | null;
  personaId: string;
  targetChain: MintChain;
  tokenIdCommitment: string;
  ownerAddress: string | null;
  reason: DeferReason;
}

/** Best-effort enqueue — idempotent on (persona, chain, token id). Never throws. */
export async function enqueueDeferredMint(input: EnqueueDeferredMintInput): Promise<boolean> {
  try {
    const { error } = await input.admin
      .from('deferred_token_qube_mints')
      .upsert(
        {
          iqube_id: input.iqubeId,
          persona_id: input.personaId,
          target_chain: input.targetChain,
          token_id_commitment: input.tokenIdCommitment,
          owner_address: input.ownerAddress,
          reason: input.reason,
          status: 'pending',
        },
        { onConflict: 'persona_id,target_chain,token_id_commitment', ignoreDuplicates: true },
      );
    return !error;
  } catch {
    return false;
  }
}

export interface ProcessDeferredMintsResult {
  processed: number;
  minted: number;
  failed: number;
  skipped: number;
  note: string;
}

/**
 * Drain pending deferred tokenQube mints in a batch. For each pending row whose
 * target chain is now live, mint via the per-chain dispatch and reconcile the
 * registry / ownership / persona_qube_mints records with the resolved token id.
 * Non-live chains and rows missing an owner address are left pending (skipped).
 * Best-effort and idempotent — safe to run repeatedly (e.g. from a cron/admin
 * endpoint). Per-chain minters for the reference chains plug in via
 * mintTokenQubeOnChain.
 */
export async function processDeferredMints(
  input: { admin: SupabaseClient; limit?: number },
): Promise<ProcessDeferredMintsResult> {
  const { admin } = input;
  const limit = input.limit ?? 50;
  let minted = 0;
  let failed = 0;
  let skipped = 0;

  const { data: rows, error } = await admin
    .from('deferred_token_qube_mints')
    .select('id, iqube_id, persona_id, target_chain, token_id_commitment, owner_address')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error || !rows || rows.length === 0) {
    return { processed: 0, minted, failed, skipped, note: error ? error.message : 'No pending mints.' };
  }

  for (const row of rows) {
    const chain = String(row.target_chain);
    const owner = (row.owner_address as string | null) ?? '';
    if (!isMintChain(chain) || !isChainLive(chain) || !owner) {
      skipped++;
      continue;
    }
    try {
      const res = await mintTokenQubeOnChain(chain, {
        personaId: String(row.persona_id),
        ownerAddress: owner,
      });
      if (res.ok && (res.tokenId || res.alreadyMinted)) {
        const tokenId = res.tokenId ?? (row.token_id_commitment as string);
        const nowIso = new Date().toISOString();
        await admin
          .from('deferred_token_qube_mints')
          .update({ status: 'minted', tx_hash: res.txHash ?? null, minted_at: nowIso })
          .eq('id', row.id);
        await admin
          .from('persona_qube_mints')
          .update({ base_token_id: tokenId, base_tx_hash: res.txHash ?? null, on_chain: true, mint_mode: 'base', updated_at: nowIso })
          .eq('persona_id', row.persona_id);
        if (row.iqube_id) {
          await admin
            .from('persona_token_qube_ownership')
            .update({
              token_qube_id: tokenId,
              chain_anchor: { chain, token_id: tokenId, tx_hash: res.txHash ?? null },
            })
            .eq('iqube_id', row.iqube_id);
        }
        minted++;
      } else {
        await admin
          .from('deferred_token_qube_mints')
          .update({ status: 'failed', error: res.error ?? res.skipped ?? 'unknown' })
          .eq('id', row.id);
        failed++;
      }
    } catch (e) {
      await admin
        .from('deferred_token_qube_mints')
        .update({ status: 'failed', error: e instanceof Error ? e.message : String(e) })
        .eq('id', row.id);
      failed++;
    }
  }

  return {
    processed: rows.length,
    minted,
    failed,
    skipped,
    note: `Processed ${rows.length} pending mint(s): ${minted} minted, ${failed} failed, ${skipped} skipped (non-live chain or missing owner).`,
  };
}
