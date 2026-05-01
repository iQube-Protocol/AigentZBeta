/**
 * EVM KNYT Service - On-chain KNYT balance lookup and canonical minting on Ethereum mainnet (chainId 1)
 */

// Transfer(address,address,uint256) topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// Primary transfer contract (used for purchase payments)
const KNYT_TRANSFER_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4';

export interface EvmTransferVerification {
  verified: boolean;
  amountKnyt: number;
  error?: string;
}

/**
 * Verify that a given tx hash transferred >= minAmountKnyt KNYT to the treasury address.
 * Does NOT credit the DVN ledger — used for purchase payment verification only.
 */
export async function verifyEvmKnytTransfer(
  txHash: string,
  minAmountKnyt = 0,
): Promise<EvmTransferVerification> {
  const treasury = (process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '').toLowerCase();
  if (!treasury) return { verified: false, amountKnyt: 0, error: 'Treasury not configured' };

  const rpc = process.env.ETH_RPC_URL || process.env.ETH_RPC_FALLBACK_URL || 'https://eth.llamarpc.com';
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
    });
    const json = await res.json() as { result?: { status?: string; logs?: Array<{ address?: string; topics?: string[]; data?: string }> } };
    const receipt = json.result;
    if (!receipt) return { verified: false, amountKnyt: 0, error: 'Transaction not found' };
    if (receipt.status !== '0x1') return { verified: false, amountKnyt: 0, error: 'Transaction reverted' };

    for (const log of receipt.logs ?? []) {
      if (log.address?.toLowerCase() !== KNYT_TRANSFER_CONTRACT.toLowerCase()) continue;
      if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      const to = log.topics?.[2];
      if (!to) continue;
      const toAddr = '0x' + to.slice(-40);
      if (toAddr.toLowerCase() !== treasury) continue;
      const raw = (log.data ?? '').replace(/^0x/, '') || '0';
      const raw18 = BigInt('0x' + raw);
      const divisor = 10n ** 18n;
      const amountKnyt = Number(raw18 / divisor) + Number(raw18 % divisor) / Number(divisor);
      if (amountKnyt < minAmountKnyt) {
        return { verified: false, amountKnyt, error: `Transfer amount ${amountKnyt} KNYT < required ${minAmountKnyt}` };
      }
      return { verified: true, amountKnyt };
    }
    return { verified: false, amountKnyt: 0, error: 'No matching KNYT transfer to treasury found' };
  } catch (err) {
    return { verified: false, amountKnyt: 0, error: err instanceof Error ? err.message : 'RPC error' };
  }
}

const KNYT_CONTRACTS = [
  '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4',
  '0xCf890B7acBB5ffe0540a01860A75D3d765bF0756',
];

// The contract confirmed to hold the minter role
const KNYT_MINTER_CONTRACT = '0xCf890B7acBB5ffe0540a01860A75D3d765bF0756';

const ERC20_BALANCE_OF = '0x70a08231'; // balanceOf(address) selector

const MINT_ABI = ['function mint(address to, uint256 amount)'];

// $KNYT is on Ethereum mainnet (chainId 1), not Base.
// Tried in order until one succeeds — 403/5xx on the primary falls through
// to the Cloudflare and PublicNode public endpoints automatically.
// Set ETH_RPC_URL (primary) and ETH_RPC_FALLBACK_URL (secondary) in .env.local.
const ETH_RPC_LIST: string[] = [
  process.env.ETH_RPC_URL,
  process.env.ETH_RPC_FALLBACK_URL,
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
].filter(Boolean) as string[];

export interface EvmKnytBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceFormatted: string;
}

export interface KnytMintResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ─── Read helpers (raw JSON-RPC, no external chain library required) ──────────

async function ethCall(to: string, data: string): Promise<string> {
  let lastErr: Error = new Error('No Ethereum RPC endpoints configured');
  for (const rpc of ETH_RPC_LIST) {
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
      const json = await res.json() as { result?: string; error?: { code?: number; message?: string } };
      if (json.error) throw new Error(`RPC error ${json.error.code ?? ''}: ${json.error.message ?? 'unknown'}`);
      if (!json.result || json.result === '0x') return '0x' + '0'.repeat(64);
      return json.result;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('RPC call failed');
      // try next endpoint
    }
  }
  throw lastErr;
}

function encodeBalanceOf(address: string): string {
  const stripped = address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  return ERC20_BALANCE_OF + stripped;
}

function formatUnits18(hex: string): string {
  const raw = hex.replace(/^0x/, '');
  const n = BigInt('0x' + (raw || '0'));
  if (n === BigInt(0)) return '0';
  const divisor = BigInt(10 ** 18);
  const whole = n / divisor;
  const frac = n % divisor;
  if (frac === BigInt(0)) return whole.toString();
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getEvmKnytBalance(evmAddress: string): Promise<EvmKnytBalance & { rpcError?: string } | null> {
  try {
    const callData = encodeBalanceOf(evmAddress);
    const results = await Promise.allSettled(
      KNYT_CONTRACTS.map(addr => ethCall(addr, callData))
    );

    // If ALL contract calls failed, surface the error rather than returning 0
    const errors = results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason?.message ?? 'RPC error');
    const values = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map(r => r.value);

    if (values.length === 0) {
      const rpcError = errors[0] ?? 'All RPC calls failed';
      console.error('[EVM KNYT] All balance calls failed:', errors);
      return { chainId: 1, chainName: 'Ethereum', balance: '0', balanceFormatted: '0', rpcError };
    }

    const total = values.reduce((sum, hex) => {
      const raw = hex.replace(/^0x/, '') || '0';
      return sum + BigInt('0x' + raw);
    }, BigInt(0));

    return {
      chainId: 1,
      chainName: 'Ethereum',
      balance: total.toString(),
      balanceFormatted: formatUnits18('0x' + total.toString(16)),
    };
  } catch (error) {
    console.error('[EVM KNYT] Error reading balance:', error);
    return null;
  }
}

export async function getAllEvmKnytBalances(evmAddress: string): Promise<EvmKnytBalance[]> {
  const result = await getEvmKnytBalance(evmAddress);
  return result ? [result] : [];
}

export async function getTotalEvmKnytBalance(evmAddress: string): Promise<{ total: string; byChain: EvmKnytBalance[] }> {
  const balances = await getAllEvmKnytBalances(evmAddress);
  return { total: balances[0]?.balanceFormatted || '0', byChain: balances };
}

/**
 * Canonical EVM KNYT mint — calls mint(to, amount) on the KNYT minter contract on Base.
 * Requires KNYT_MINTER_PRIVATE_KEY to be set to the wallet that holds the minter role.
 */
export async function mintKnyt(toAddress: string, amountKnyt: number): Promise<KnytMintResult> {
  const minterKey = process.env.KNYT_MINTER_PRIVATE_KEY;
  if (!minterKey || !minterKey.startsWith('0x')) {
    return { success: false, error: 'KNYT_MINTER_PRIVATE_KEY not configured' };
  }

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(ETH_RPC_LIST[0]);
    const wallet = new ethers.Wallet(minterKey, provider);
    const contract = new ethers.Contract(KNYT_MINTER_CONTRACT, MINT_ABI, wallet);
    const amountWei = ethers.parseUnits(amountKnyt.toString(), 18);
    const tx = await contract.mint(toAddress, amountWei) as { hash: string; wait: () => Promise<unknown> };
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'mint failed';
    console.error('[EVM KNYT] mintKnyt failed:', msg);
    return { success: false, error: msg };
  }
}
