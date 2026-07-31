/**
 * tokenQubeMintDispatch — per-chain minter dispatch for iQube tokenQubes.
 *
 * The single seam for "mint a tokenQube on chain X". Base mainnet is wired;
 * adding a reference chain (Optimism / Solana / Bitcoin / …) is just a new case
 * here plus flipping `live: true` in mintChains. Non-live or unimplemented
 * chains return a `skipped` reason so callers (immediate path + deferred batch
 * processor) can queue/skip rather than fail.
 */

import { isChainLive, type MintChain } from '@/services/chain/mintChains';
import { mintPersonaQubeToBase } from '@/services/chain/baseTokenMint';

export interface ChainMintResult {
  ok: boolean;
  tokenId?: string;
  txHash?: string;
  alreadyMinted?: boolean;
  skipped?: string;
  error?: string;
}

export interface ChainMintInput {
  personaId: string;
  ownerAddress: string;
}

export async function mintTokenQubeOnChain(
  chain: MintChain,
  input: ChainMintInput,
): Promise<ChainMintResult> {
  if (!isChainLive(chain)) {
    return { ok: false, skipped: 'chain_not_live' };
  }
  switch (chain) {
    case 'base':
      return mintPersonaQubeToBase({ personaId: input.personaId, ownerAddress: input.ownerAddress });
    // Future reference chains plug in here once their contract + signer are
    // wired and the chain is flipped live in mintChains.ts.
    default:
      return { ok: false, skipped: 'chain_minter_not_implemented' };
  }
}
