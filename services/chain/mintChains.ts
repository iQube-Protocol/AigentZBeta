/**
 * mintChains — the tokenQube mint-target registry.
 *
 * iQube tokenQubes are the ownership/bearer primitive. Base mainnet is the only
 * chain live today; the other reference chains are declared here so the mint
 * dispatcher is multi-chain-ready without code changes elsewhere — a chain goes
 * live by flipping `live: true` and wiring its minter. Until then, mints
 * targeting a non-live chain are deferred to the batch-mint queue.
 *
 * The named set below covers the chains the operator referenced (Base live;
 * Optimism / Solana / Bitcoin and further EVM L2s pending). Extend this map as
 * the canonical reference-chain set is finalised — it is the single source for
 * "which chains can a tokenQube mint to."
 */

export type MintChain =
  | 'base'
  | 'optimism'
  | 'arbitrum'
  | 'polygon'
  | 'solana'
  | 'bitcoin';

export interface MintChainConfig {
  id: MintChain;
  label: string;
  /** EVM chainId where applicable (non-EVM chains omit it). */
  chainId?: number;
  family: 'evm' | 'solana' | 'bitcoin';
  /** Only `true` chains mint immediately; others defer to the batch queue. */
  live: boolean;
}

export const MINT_CHAINS: Record<MintChain, MintChainConfig> = {
  base: { id: 'base', label: 'Base', chainId: 8453, family: 'evm', live: true },
  optimism: { id: 'optimism', label: 'Optimism', chainId: 10, family: 'evm', live: false },
  arbitrum: { id: 'arbitrum', label: 'Arbitrum', chainId: 42161, family: 'evm', live: false },
  polygon: { id: 'polygon', label: 'Polygon', chainId: 137, family: 'evm', live: false },
  solana: { id: 'solana', label: 'Solana', family: 'solana', live: false },
  bitcoin: { id: 'bitcoin', label: 'Bitcoin', family: 'bitcoin', live: false },
};

/** The default chain for a new tokenQube mint (the only one live on mainnet). */
export const DEFAULT_MINT_CHAIN: MintChain = 'base';

export function isMintChain(value: string): value is MintChain {
  return value in MINT_CHAINS;
}

export function isChainLive(chain: MintChain): boolean {
  return MINT_CHAINS[chain]?.live === true;
}
