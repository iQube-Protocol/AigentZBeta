export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * x402 Transaction Verification API
 *
 * Verifies transaction status across multiple chains:
 * - EVM chains: Arbitrum, Base, Polygon, Optimism, Ethereum (testnets)
 * - BTC/SOL are present but inactive by default
 */

import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider } from "ethers";

interface ChainRpcConfig {
  rpcUrl: string;
  explorer: string;
  name: string;
  active: boolean;
}

const CHAIN_RPC_CONFIG: Record<string | number, ChainRpcConfig> = {
  421614: {
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA ||
      process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA ||
      "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    name: "Arbitrum Sepolia",
    active: true,
  },
  84532: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    name: "Base Sepolia",
    active: true,
  },
  80002: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || "https://rpc-amoy.polygon.technology",
    explorer: "https://amoy.polygonscan.com",
    name: "Polygon Amoy",
    active: true,
  },
  11155420: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_OP_SEPOLIA || "https://sepolia.optimism.io",
    explorer: "https://sepolia-optimism.etherscan.io",
    name: "Optimism Sepolia",
    active: true,
  },
  11155111: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://rpc.sepolia.org",
    explorer: "https://sepolia.etherscan.io",
    name: "Ethereum Sepolia",
    active: true,
  },
  "btc-testnet": {
    rpcUrl: process.env.BTC_TESTNET_RPC || "",
    explorer: "https://mempool.space/testnet",
    name: "Bitcoin Testnet",
    active: false,
  },
  "sol-devnet": {
    rpcUrl: process.env.SOL_DEVNET_RPC || "https://api.devnet.solana.com",
    explorer: "https://explorer.solana.com/?cluster=devnet",
    name: "Solana Devnet",
    active: false,
  },
};

interface VerificationResult {
  ok: boolean;
  status: "confirmed" | "pending" | "failed" | "not_found";
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
    status: "not_found",
    txHash,
    chainId,
    chainName: config.name,
    explorerUrl: `${config.explorer}/tx/${txHash}`,
  };

  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      const tx = await provider.getTransaction(txHash);
      if (tx) {
        return {
          ...baseResult,
          ok: true,
          status: "pending",
          from: tx.from,
          to: tx.to || undefined,
          value: tx.value.toString(),
        };
      }
      return baseResult;
    }

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;
    const block = await provider.getBlock(receipt.blockNumber);
    const tx = await provider.getTransaction(txHash);

    return {
      ok: true,
      status: receipt.status === 1 ? "confirmed" : "failed",
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
      error: error.message || "Verification failed",
    };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get("txHash");
  const chainIdParam = searchParams.get("chainId");

  if (!txHash) {
    return NextResponse.json({ ok: false, error: "Missing txHash parameter" }, { status: 400 });
  }

  if (!chainIdParam) {
    return NextResponse.json({ ok: false, error: "Missing chainId parameter" }, { status: 400 });
  }

  const chainId = /^\d+$/.test(chainIdParam) ? parseInt(chainIdParam, 10) : chainIdParam;
  const config = CHAIN_RPC_CONFIG[chainId];

  if (!config) {
    return NextResponse.json({ ok: false, error: `Unsupported chain: ${chainId}` }, { status: 400 });
  }

  if (!config.active) {
    return NextResponse.json(
      { ok: false, error: `Chain ${config.name} is not yet active` },
      { status: 400 }
    );
  }

  const result = await verifyEVMTransaction(txHash, chainId as number, config);
  return NextResponse.json(result);
}
