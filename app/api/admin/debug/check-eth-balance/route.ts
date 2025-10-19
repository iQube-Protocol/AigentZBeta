export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyServiceV2 } from "@/services/identity/agentKeyService.v2";


/**
 * Debug endpoint to check ETH balance for gas fees
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
  const chainId = parseInt(req.nextUrl.searchParams.get('chainId') || '84532'); // Default to Base Sepolia
  
  try {
    console.log(`[Debug] Checking ETH balance for agent: ${agentId} on chain: ${chainId}`);
    
    const keyService = new AgentKeyServiceV2();
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

    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(agentKeys.evmPrivateKey, provider);
    
    // Get ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    const humanEthBalance = ethers.formatEther(ethBalance);
    
    const result = {
      agentId,
      agentName: agentKeys.agentName,
      chainId,
      chainName: getChainName(chainId),
      walletAddress: wallet.address,
      rawEthBalance: ethBalance.toString(),
      humanEthBalance: humanEthBalance,
      hasGasForTx: parseFloat(humanEthBalance) > 0.001, // Rough estimate
      rpcUrl: url.substring(0, 50) + '...'
    };
    
    console.log(`[Debug] ETH balance check result:`, result);
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Debug] ETH balance check failed:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to check ETH balance',
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
