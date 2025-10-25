export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";

/**
 * Debug endpoint to check actual QCT token balance for agents
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
  const chainId = parseInt(req.nextUrl.searchParams.get('chainId') || '84532'); // Default to Base Sepolia
  
  try {
    console.log(`[Debug] Checking balance for agent: ${agentId} on chain: ${chainId}`);
    
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(agentId);
    
    if (!agentKeys?.evmPrivateKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: `No EVM private key found for ${agentId}`
      }), { status: 404 });
    }

    // Get RPC URL for chain
    const rpc = (cid: number) => {
      switch (cid) {
        case 11155111: return process.env.NEXT_PUBLIC_RPC_SEPOLIA;
        case 421614: return process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA;
        case 84532: return process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA;
        case 11155420: return process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA;
        case 80002: return process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY;
        default: return undefined;
      }
    };

    const url = rpc(chainId);
    if (!url) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Unsupported chainId: ${chainId}`
      }), { status: 400 });
    }

    // QCT token address (same on all chains according to config)
    const qctTokenAddress = "0x4C4f1aD931589449962bB675bcb8e95672349d09";
    
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(agentKeys.evmPrivateKey, provider);
    
    // ERC20 ABI for balance check
    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ];
    
    const erc20 = new ethers.Contract(qctTokenAddress, ERC20_ABI, wallet);
    
    // Get balance, decimals, and symbol
    const [balance, decimals, symbol] = await Promise.all([
      erc20.balanceOf(wallet.address),
      erc20.decimals(),
      erc20.symbol()
    ]);
    
    // Convert balance to human readable format
    const humanBalance = ethers.formatUnits(balance, decimals);
    
    const result = {
      agentId,
      agentName: agentKeys.agentName,
      chainId,
      chainName: getChainName(chainId),
      walletAddress: wallet.address,
      tokenAddress: qctTokenAddress,
      tokenSymbol: symbol,
      rawBalance: balance.toString(),
      humanBalance: humanBalance,
      decimals: decimals.toString(),
      rpcUrl: url.substring(0, 50) + '...'
    };
    
    console.log(`[Debug] Balance check result:`, result);
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Debug] Balance check failed:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to check balance',
      stack: error.stack
    }), { status: 500 });
  }
}

function getChainName(chainId: number): string {
  switch (chainId) {
    case 11155111: return "Ethereum Sepolia";
    case 421614: return "Arbitrum Sepolia";
    case 84532: return "Base Sepolia";
    case 11155420: return "Optimism Sepolia";
    case 80002: return "Polygon Amoy";
    default: return `Chain ${chainId}`;
  }
}
