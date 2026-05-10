/**
 * tokenOwnership — minimal ERC-721 / ERC-1155 ownership check used by
 * the spine's Phase 3.3b token credential resolver.
 *
 * Plain JSON-RPC eth_call with multi-RPC fallback, matching the pattern
 * in services/wallet/knyt/evmKnytService.ts. No external chain library
 * dependency; balance > 0 = owned.
 *
 * Supported chains (extend by adding entries to RPC_LISTS):
 *   ethereum / mainnet
 *   base
 *   optimism
 *   polygon
 *   arbitrum
 *
 * Function selectors:
 *   balanceOf(address)              0x70a08231   — ERC-721 / ERC-20
 *   balanceOf(address,uint256)      0x00fdd58e   — ERC-1155
 */

const ERC721_BALANCE_OF = '0x70a08231';
const ERC1155_BALANCE_OF = '0x00fdd58e';

/** Per-chain RPC URL lists. Operator overrides via env. Public nodes
 *  are last-resort fallbacks. */
const RPC_LISTS: Record<string, string[]> = {
  ethereum: [
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_FALLBACK_URL,
    'https://cloudflare-eth.com',
    'https://ethereum.publicnode.com',
  ].filter(Boolean) as string[],
  base: [
    process.env.BASE_RPC_URL,
    'https://mainnet.base.org',
    'https://base.publicnode.com',
  ].filter(Boolean) as string[],
  optimism: [
    process.env.OPTIMISM_RPC_URL,
    'https://mainnet.optimism.io',
    'https://optimism.publicnode.com',
  ].filter(Boolean) as string[],
  polygon: [
    process.env.POLYGON_RPC_URL,
    'https://polygon-rpc.com',
    'https://polygon.publicnode.com',
  ].filter(Boolean) as string[],
  arbitrum: [
    process.env.ARBITRUM_RPC_URL,
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.publicnode.com',
  ].filter(Boolean) as string[],
};

// Aliases the operator might use in credential strings
const CHAIN_ALIASES: Record<string, string> = {
  eth: 'ethereum',
  mainnet: 'ethereum',
  arb: 'arbitrum',
  op: 'optimism',
  matic: 'polygon',
};

function normalizeChain(chain: string): string {
  const lower = chain.toLowerCase();
  return CHAIN_ALIASES[lower] ?? lower;
}

async function ethCall(chain: string, to: string, data: string): Promise<string> {
  const normalized = normalizeChain(chain);
  const rpcList = RPC_LISTS[normalized];
  if (!rpcList || rpcList.length === 0) {
    throw new Error(`No RPC endpoints configured for chain '${chain}'`);
  }
  let lastErr: Error = new Error('No RPCs');
  for (const rpc of rpcList) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{ to, data }, 'latest'],
        }),
      });
      if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
      const json = await res.json() as { result?: string; error?: { message?: string } };
      if (json.error) throw new Error(`RPC error: ${json.error.message ?? 'unknown'}`);
      if (!json.result || json.result === '0x') return '0x' + '0'.repeat(64);
      return json.result;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('rpc');
    }
  }
  throw lastErr;
}

function padAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function padUint(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function isPositiveHexBalance(hex: string): boolean {
  const n = BigInt(hex);
  return n > BigInt(0);
}

/**
 * Returns true if `address` holds at least one ERC-721 token from
 * `contract` on `chain`. balance > 0 = owned.
 */
export async function ownsErc721(
  chain: string,
  contract: string,
  address: string,
): Promise<boolean> {
  const data = ERC721_BALANCE_OF + padAddress(address);
  try {
    const result = await ethCall(chain, contract, data);
    return isPositiveHexBalance(result);
  } catch (err) {
    console.error('[tokenOwnership] ERC-721 check failed', { chain, contract, err });
    return false;
  }
}

/**
 * Returns true if `address` holds at least one copy of ERC-1155 token
 * `tokenId` from `contract` on `chain`. balanceOf(address, id) > 0.
 */
export async function ownsErc1155(
  chain: string,
  contract: string,
  address: string,
  tokenId: bigint,
): Promise<boolean> {
  const data = ERC1155_BALANCE_OF + padAddress(address) + padUint(tokenId);
  try {
    const result = await ethCall(chain, contract, data);
    return isPositiveHexBalance(result);
  } catch (err) {
    console.error('[tokenOwnership] ERC-1155 check failed', { chain, contract, tokenId: tokenId.toString(), err });
    return false;
  }
}
