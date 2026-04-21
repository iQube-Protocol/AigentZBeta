/**
 * EVM KNYT Service - On-chain KNYT balance lookup and canonical minting
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const KNYT_CONTRACTS = [
  '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4',
  '0xCf890B7acBB5ffe0540a01860A75D3d765bF0756',
];

// The contract confirmed to hold the minter role
const KNYT_MINTER_CONTRACT = '0xCf890B7acBB5ffe0540a01860A75D3d765bF0756' as const;

const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const MINT_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export interface KnytMintResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

function getPublicClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'),
  });
}

export interface EvmKnytBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceFormatted: string;
}

export async function getEvmKnytBalance(evmAddress: string): Promise<EvmKnytBalance | null> {
  try {
    const client = getPublicClient();
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

/**
 * Canonical EVM KNYT mint — calls mint(to, amount) on the KNYT minter contract.
 * Requires KNYT_MINTER_PRIVATE_KEY to be set to the wallet that holds the minter role.
 */
export async function mintKnyt(toAddress: string, amountKnyt: number): Promise<KnytMintResult> {
  const minterKey = process.env.KNYT_MINTER_PRIVATE_KEY;
  if (!minterKey || !minterKey.startsWith('0x')) {
    return { success: false, error: 'KNYT_MINTER_PRIVATE_KEY not configured' };
  }

  try {
    const account = privateKeyToAccount(minterKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'),
    });
    const publicClient = getPublicClient();

    const amountWei = parseUnits(amountKnyt.toString(), 18);

    const txHash = await walletClient.writeContract({
      address: KNYT_MINTER_CONTRACT,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [toAddress as `0x${string}`, amountWei],
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { success: true, txHash };
  } catch (err: any) {
    console.error('[EVM KNYT] mintKnyt failed:', err?.message);
    return { success: false, error: err?.message ?? 'mint failed' };
  }
}
