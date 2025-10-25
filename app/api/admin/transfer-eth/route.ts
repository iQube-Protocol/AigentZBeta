export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";

/**
 * Transfer ETH from one agent to another for gas fees
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fromAgentId, toAddress, chainId, amount } = body || {};
  
  try {
    console.log(`[ETH Transfer] ${fromAgentId} -> ${toAddress} on chain ${chainId}: ${amount} ETH`);
    
    if (!fromAgentId || !toAddress || !chainId || !amount) {
      return new Response(JSON.stringify({
        ok: false,
        error: "fromAgentId, toAddress, chainId, and amount required"
      }), { status: 400 });
    }

    // Get sender agent private key
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(fromAgentId);
    
    if (!agentKeys?.evmPrivateKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: `No EVM private key found for ${fromAgentId}`
      }), { status: 500 });
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

    const url = rpc(Number(chainId));
    if (!url) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Unsupported chainId: ${chainId}`
      }), { status: 400 });
    }

    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(agentKeys.evmPrivateKey, provider);
    
    // Check sender balance
    const balance = await provider.getBalance(wallet.address);
    const amountWei = ethers.parseEther(amount);
    
    console.log(`[ETH Transfer] Sender balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`[ETH Transfer] Transfer amount: ${amount} ETH`);
    
    if (balance < amountWei) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Insufficient ETH balance: have ${ethers.formatEther(balance)}, need ${amount}`
      }), { status: 400 });
    }

    // Send ETH transaction
    console.log(`[ETH Transfer] Sending ${amount} ETH to ${toAddress}...`);
    
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei
    });
    
    console.log(`[ETH Transfer] Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`[ETH Transfer] Transaction confirmed: ${receipt?.hash} with status ${receipt?.status}`);

    return new Response(JSON.stringify({
      ok: true,
      txHash: tx.hash,
      status: receipt?.status || 1,
      fromAgent: fromAgentId,
      fromAddress: wallet.address,
      toAddress,
      amount,
      chainId,
      chainName: getChainName(chainId)
    }), { status: 200 });
    
  } catch (error: any) {
    console.error('[ETH Transfer] Error:', error);
    
    let errorMessage = "ETH transfer failed";
    if (error?.code === 'NETWORK_ERROR') {
      errorMessage = `RPC connection failed for chain ${chainId}`;
    } else if (error?.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = "Insufficient funds for gas or transfer amount";
    } else if (error?.reason) {
      errorMessage = error.reason;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    return new Response(JSON.stringify({
      ok: false,
      error: errorMessage
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
