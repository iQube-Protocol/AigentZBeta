/**
 * EVM KNYT Service - Read-only on-chain KNYT balance lookup
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet } from 'viem/chains';

const KNYT_CONTRACTS = [
  '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4',
  '0xCf890B7acBB5ffe0540a01860A75D3d765bF0756',
];

const ERC20_ABI = [{ inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }] as const;

export interface EvmKnytBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceFormatted: string;
}

export async function getEvmKnytBalance(evmAddress: string): Promise<EvmKnytBalance | null> {
  try {
    const client = createPublicClient({ chain: mainnet, transport: http(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com') });
    const balances = await Promise.all(KNYT_CONTRACTS.map(addr => 
      client.readContract({ address: addr as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [evmAddress as `0x${string}`] })
    ));
    const total = balances.reduce((sum, b) => sum + b, BigInt(0));
    return { chainId: 1, chainName: 'Ethereum', balance: total.toString(), balanceFormatted: formatUnits(total, 18) };
  } catch (error) {
    console.error('[EVM KNYT] Error:', error);
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
