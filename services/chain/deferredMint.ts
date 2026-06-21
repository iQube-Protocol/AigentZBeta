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
import type { MintChain } from '@/services/chain/mintChains';

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

/**
 * STUB — drain pending deferred mints in a batch. Wire this to a cron/admin
 * endpoint when the batch-mint workstream lands; per-chain minters for the
 * non-live reference chains (Optimism / Solana / Bitcoin / …) plug in here.
 */
export async function processDeferredMints(): Promise<{ processed: number; note: string }> {
  return {
    processed: 0,
    note: 'Deferred batch mint not yet implemented — pending rows remain queued in deferred_token_qube_mints.',
  };
}
