/**
 * EVM KNYT Service - Read-only on-chain KNYT balance lookup on Base (chainId 8453)
 */

const KNYT_CONTRACTS = [
  '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4',
  '0xCf890B7acBB5ffe0540a01860A75D3d765bF0756',
];

const ERC20_BALANCE_OF = '0x70a08231'; // balanceOf(address) selector

const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

export interface EvmKnytBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceFormatted: string;
}

async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });
  const json = await res.json() as { result?: string; error?: unknown };
  if (!json.result || json.result === '0x') return '0x' + '0'.repeat(64);
  return json.result;
}

function encodeBalanceOf(address: string): string {
  // balanceOf(address) — pad address to 32 bytes
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

export async function getEvmKnytBalance(evmAddress: string): Promise<EvmKnytBalance | null> {
  try {
    const callData = encodeBalanceOf(evmAddress);
    const results = await Promise.all(
      KNYT_CONTRACTS.map(addr => ethCall(BASE_RPC, addr, callData))
    );
    const total = results.reduce((sum, hex) => {
      const raw = hex.replace(/^0x/, '') || '0';
      return sum + BigInt('0x' + raw);
    }, BigInt(0));
    return {
      chainId: 8453,
      chainName: 'Base',
      balance: total.toString(),
      balanceFormatted: formatUnits18('0x' + total.toString(16)),
    };
  } catch (error) {
    console.error('[EVM KNYT] Error reading Base balance:', error);
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
