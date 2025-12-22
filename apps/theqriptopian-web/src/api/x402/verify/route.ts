/**
 * x402 Transaction Verification API
 * 
 * Verifies transaction status across multiple chains:
 * - EVM chains: Arbitrum, Base, Polygon, Optimism, Ethereum (testnets)
 * - BTC: Bitcoin Testnet (coming soon)
 * - SOL: Solana Devnet (coming soon)
 */

import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';

// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================

interface ChainRpcConfig {
  rpcUrl: string;
  explorer: string;
  name: string;
  active: boolean;
}

const CHAIN_RPC_CONFIG: Record<string | number, ChainRpcConfig> = {
  // EVM Chains
  421614: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    name: 'Arbitrum Sepolia',
    active: true,
  },
  84532: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    name: 'Base Sepolia',
    active: true,
  },
  80002: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    name: 'Polygon Amoy',
    active: true,
  },
  11155420: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    name: 'Optimism Sepolia',
    active: true,
  },
  11155111: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA || 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    name: 'Ethereum Sepolia',
    active: true,
  },
  // Non-EVM Chains (coming soon)
  'btc-testnet': {
    rpcUrl: process.env.BTC_TESTNET_RPC || '',
    explorer: 'https://mempool.space/testnet',
    name: 'Bitcoin Testnet',
    active: false,
  },
  'sol-devnet': {
    rpcUrl: process.env.SOL_DEVNET_RPC || 'https://api.devnet.solana.com',
    explorer: 'https://explorer.solana.com/?cluster=devnet',
    name: 'Solana Devnet',
    active: false,
  },
};

// =============================================================================
// VERIFICATION HANDLERS
// =============================================================================

interface VerificationResult {
  ok: boolean;
  status: 'confirmed' | 'pending' | 'failed' | 'not_found';
  txHash: string;
  chainId: string | number;
  chainName: string;
  confirmations?: number;
  blockNumber?: number;
  timestamp?: number;
  from?: string;
  to?: string;
  value?: string;
  gasUsed?: string;
  explorerUrl: string;
  error?: string;
}

async function verifyEVMTransaction(
  txHash: string,
  chainId: number,
  config: ChainRpcConfig
): Promise<VerificationResult> {
  const baseResult: VerificationResult = {
    ok: false,
    status: 'not_found',
    txHash,
    chainId,
    chainName: config.name,
    explorerUrl: `${config.explorer}/tx/${txHash}`,
  };

  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      // Transaction not yet mined - check if it exists in mempool
      const tx = await provider.getTransaction(txHash);
      if (tx) {
        return {
          ...baseResult,
          ok: true,
          status: 'pending',
          from: tx.from,
          to: tx.to || undefined,
          value: tx.value.toString(),
        };
      }
      return baseResult;
    }

    // Get current block for confirmation count
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;

    // Get block for timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    
    // Get original transaction for value
    const tx = await provider.getTransaction(txHash);

    return {
      ok: true,
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      txHash,
      chainId,
      chainName: config.name,
      confirmations,
      blockNumber: receipt.blockNumber,
      timestamp: block?.timestamp,
      from: receipt.from,
      to: receipt.to || undefined,
      value: tx?.value.toString(),
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `${config.explorer}/tx/${txHash}`,
    };

  } catch (error: any) {
    return {
      ...baseResult,
      error: error.message || 'Verification failed',
    };
  }
}

async function verifyBTCTransaction(
  txHash: string,
  config: ChainRpcConfig
): Promise<VerificationResult> {
  // Bitcoin verification via mempool.space API
  const baseResult: VerificationResult = {
    ok: false,
    status: 'not_found',
    txHash,
    chainId: 'btc-testnet',
    chainName: config.name,
    explorerUrl: `${config.explorer}/tx/${txHash}`,
  };

  try {
    const response = await fetch(`https://mempool.space/testnet/api/tx/${txHash}`);
    
    if (!response.ok) {
      return baseResult;
    }

    const tx = await response.json();
    
    // Get confirmation status
    const statusResponse = await fetch(`https://mempool.space/testnet/api/tx/${txHash}/status`);
    const status = await statusResponse.json();

    return {
      ok: true,
      status: status.confirmed ? 'confirmed' : 'pending',
      txHash,
      chainId: 'btc-testnet',
      chainName: config.name,
      confirmations: status.block_height ? undefined : 0, // Would need current height to calculate
      blockNumber: status.block_height,
      timestamp: status.block_time,
      from: tx.vin?.[0]?.prevout?.scriptpubkey_address,
      to: tx.vout?.[0]?.scriptpubkey_address,
      value: tx.vout?.reduce((sum: number, out: any) => sum + out.value, 0)?.toString(),
      explorerUrl: `${config.explorer}/tx/${txHash}`,
    };

  } catch (error: any) {
    return {
      ...baseResult,
      error: error.message || 'BTC verification failed',
    };
  }
}

async function verifySOLTransaction(
  txHash: string,
  config: ChainRpcConfig
): Promise<VerificationResult> {
  // Solana verification via JSON-RPC
  const baseResult: VerificationResult = {
    ok: false,
    status: 'not_found',
    txHash,
    chainId: 'sol-devnet',
    chainName: config.name,
    explorerUrl: `${config.explorer}/tx/${txHash}?cluster=devnet`,
  };

  try {
    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          txHash,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ],
      }),
    });

    const result = await response.json();
    
    if (!result.result) {
      return baseResult;
    }

    const tx = result.result;
    
    return {
      ok: true,
      status: tx.meta?.err ? 'failed' : 'confirmed',
      txHash,
      chainId: 'sol-devnet',
      chainName: config.name,
      blockNumber: tx.slot,
      timestamp: tx.blockTime,
      explorerUrl: `${config.explorer}/tx/${txHash}?cluster=devnet`,
    };

  } catch (error: any) {
    return {
      ...baseResult,
      error: error.message || 'SOL verification failed',
    };
  }
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get('txHash');
  const chainIdParam = searchParams.get('chainId');

  if (!txHash) {
    return NextResponse.json(
      { ok: false, error: 'Missing txHash parameter' },
      { status: 400 }
    );
  }

  if (!chainIdParam) {
    return NextResponse.json(
      { ok: false, error: 'Missing chainId parameter' },
      { status: 400 }
    );
  }

  // Parse chainId (can be number or string like 'btc-testnet')
  const chainId = /^\d+$/.test(chainIdParam) ? parseInt(chainIdParam) : chainIdParam;
  
  const config = CHAIN_RPC_CONFIG[chainId];
  
  if (!config) {
    return NextResponse.json(
      { ok: false, error: `Unsupported chain: ${chainId}` },
      { status: 400 }
    );
  }

  if (!config.active) {
    return NextResponse.json(
      { ok: false, error: `Chain ${config.name} is not yet active` },
      { status: 400 }
    );
  }

  let result: VerificationResult;

  // Route to appropriate verification handler
  if (chainId === 'btc-testnet') {
    result = await verifyBTCTransaction(txHash, config);
  } else if (chainId === 'sol-devnet') {
    result = await verifySOLTransaction(txHash, config);
  } else {
    // EVM chain
    result = await verifyEVMTransaction(txHash, chainId as number, config);
  }

  return NextResponse.json(result);
}
