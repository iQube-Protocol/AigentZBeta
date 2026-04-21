/**
 * QCT Canonical Service — Base mainnet on-chain operations
 *
 * Reads QCT balance from the Base mainnet ERC-20 contract and issues
 * canonical on-chain mints via bridgeMint() when the platform has the bridge role.
 *
 * Minting requires:
 *   NEXT_PUBLIC_QCT_BASE_MAINNET  — deployed QCT contract address
 *   QCT_BRIDGE_PRIVATE_KEY        — private key of the wallet set as QCT bridge
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Base mainnet USDC (canonical Circle address)
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const QCT_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'sourceChain', type: 'string' },
      { name: 'sourceTxHash', type: 'string' },
    ],
    name: 'bridgeMint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const RESERVE_ABI = [
  {
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    name: 'mint',
    outputs: [{ name: 'qctAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    name: 'calculateMintFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReserveStats',
    outputs: [
      { name: 'usdcReserves', type: 'uint256' },
      { name: 'qctSupply', type: 'uint256' },
      { name: 'reserveRatio', type: 'uint256' },
      { name: 'deposited', type: 'uint256' },
      { name: 'withdrawn', type: 'uint256' },
      { name: 'minted', type: 'uint256' },
      { name: 'burned', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'mintFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MINT_RATIO',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface QctReserveInfo {
  reserveAddress: string;
  usdcAddress: string;
  /** 1 USDC = mintRatio QCT */
  mintRatio: number;
  /** Fee in basis points (e.g. 10 = 0.1%) */
  mintFeeBps: number;
  usdcReserves: string;
  qctSupply: string;
  reserveRatioPct: number;
}

export interface QctCanonicalBalance {
  address: string;
  balance: string;
  balanceFormatted: string;
  contractAddress: string;
}

export interface QctMintResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

function getReserveAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET;
  if (!addr || !addr.startsWith('0x')) return null;
  return addr as `0x${string}`;
}

function getContractAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_QCT_BASE_MAINNET;
  if (!addr || !addr.startsWith('0x')) return null;
  return addr as `0x${string}`;
}

function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_RPC_BASE_MAINNET || 'https://mainnet.base.org'),
  });
}

/** Read on-chain QCT balance on Base mainnet for an EVM address */
export async function getQctMainnetBalance(evmAddress: string): Promise<QctCanonicalBalance | null> {
  const contractAddress = getContractAddress();
  if (!contractAddress) return null;

  try {
    const client = getPublicClient();
    const balance = await client.readContract({
      address: contractAddress,
      abi: QCT_ABI,
      functionName: 'balanceOf',
      args: [evmAddress as `0x${string}`],
    });

    return {
      address: evmAddress,
      balance: balance.toString(),
      balanceFormatted: formatUnits(balance, 18),
      contractAddress,
    };
  } catch (err: any) {
    console.error('[QCT Canonical] balanceOf failed:', err?.message);
    return null;
  }
}

/**
 * Canonical mint: calls bridgeMint() on the Base mainnet QCT contract.
 * Requires QCT_BRIDGE_PRIVATE_KEY to be set to the wallet configured as bridge.
 */
export async function mintQctCanonical(
  toAddress: string,
  amountQct: number,
  sourceChain: string,
  sourceTxHash: string,
): Promise<QctMintResult> {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    return { success: false, error: 'NEXT_PUBLIC_QCT_BASE_MAINNET not configured' };
  }

  const bridgeKey = process.env.QCT_BRIDGE_PRIVATE_KEY;
  if (!bridgeKey || !bridgeKey.startsWith('0x')) {
    return { success: false, error: 'QCT_BRIDGE_PRIVATE_KEY not configured or invalid' };
  }

  try {
    const account = privateKeyToAccount(bridgeKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_RPC_BASE_MAINNET || 'https://mainnet.base.org'),
    });
    const publicClient = getPublicClient();

    const amountWei = parseUnits(amountQct.toString(), 18);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: QCT_ABI,
      functionName: 'bridgeMint',
      args: [toAddress as `0x${string}`, amountWei, sourceChain, sourceTxHash],
    });

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { success: true, txHash };
  } catch (err: any) {
    console.error('[QCT Canonical] bridgeMint failed:', err?.message);
    return { success: false, error: err?.message ?? 'bridgeMint failed' };
  }
}

/** Read live reserve stats from the QCTReserve contract on Base mainnet */
export async function getQctReserveInfo(): Promise<QctReserveInfo | null> {
  const reserveAddress = getReserveAddress();
  if (!reserveAddress) return null;

  try {
    const client = getPublicClient();
    const [stats, mintFeeBps, mintRatio] = await Promise.all([
      client.readContract({ address: reserveAddress, abi: RESERVE_ABI, functionName: 'getReserveStats' }),
      client.readContract({ address: reserveAddress, abi: RESERVE_ABI, functionName: 'mintFee' }),
      client.readContract({ address: reserveAddress, abi: RESERVE_ABI, functionName: 'MINT_RATIO' }),
    ]);

    const [usdcReserves, qctSupply, reserveRatioBps] = stats as [bigint, bigint, bigint, ...bigint[]];

    return {
      reserveAddress,
      usdcAddress: BASE_USDC_ADDRESS,
      mintRatio: Number(mintRatio),
      mintFeeBps: Number(mintFeeBps),
      usdcReserves: formatUnits(usdcReserves, 6),
      qctSupply: formatUnits(qctSupply, 18),
      reserveRatioPct: Number(reserveRatioBps) / 100,
    };
  } catch (err: any) {
    console.error('[QCT Reserve] getReserveStats failed:', err?.message);
    return null;
  }
}

/**
 * Returns the ABI fragments and addresses the frontend needs to call the
 * reserve's mint() directly from a user wallet (MetaMask / wagmi).
 * The user must first approve USDC spend, then call reserve.mint(usdcAmount).
 */
export function getQctPurchaseContractParams() {
  const reserveAddress = getReserveAddress();
  const qctAddress = getContractAddress();
  if (!reserveAddress || !qctAddress) return null;

  return {
    reserveAddress,
    qctAddress,
    usdcAddress: BASE_USDC_ADDRESS,
    chainId: 8453,
    // 1 USDC (6 decimals) = 100 QCT (18 decimals), fee = 0.1%
    mintRatio: 100,
    mintFeeBps: 10,
    reserveAbi: RESERVE_ABI,
  };
}
