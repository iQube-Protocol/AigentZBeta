export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";

const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];


export async function POST(req: NextRequest) {
  const body = await req.json();
  const { chainId, tokenAddress, to, amount, asset, agentId } = body || {};
  
  try {
    const SIGNER_URL = process.env.SIGNER_URL || process.env.NEXT_PUBLIC_SIGNER_URL;
    if (SIGNER_URL) {
      const r = await fetch(`${SIGNER_URL}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json" } });
    }
    
    // Handle BTC/SOL - these require manual payment, return instructions
    if (asset === "BTC_QCENT" || asset === "SOL_QCENT") {
      const instructions = {
        BTC_QCENT: {
          network: "Bitcoin Testnet",
          address: to || "tb1q03256641efc3dd9877560daf26e4d6bb46086a42",
          amount: `${amount} sats`,
          note: "Send Bitcoin testnet transaction to this address, then use the transaction ID for verification"
        },
        SOL_QCENT: {
          network: "Solana Testnet", 
          address: to || "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
          amount: `${amount} lamports (${Number(amount) / 1000000} SOL)`,
          note: "Send Solana testnet transaction to this address, then use the signature for verification"
        }
      };
      
      return new Response(JSON.stringify({
        ok: true,
        txHash: `manual_${asset}_${Date.now()}`, // Placeholder for flow continuity
        status: 1,
        instructions: instructions[asset as keyof typeof instructions],
        requiresManualPayment: true
      }), { status: 200 });
    }
    
    // EVM validation
    if (!chainId || !tokenAddress || !to || !amount) {
      return new Response(JSON.stringify({ ok: false, error: "chainId, tokenAddress, to, amount required" }), { status: 400 });
    }

    // Get agent private key using proper SDK pattern
    console.log(`[Transfer] Retrieving keys for agent: ${agentId || 'aigent-z'}`);
    
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(agentId || 'aigent-z');
    
    if (!agentKeys?.evmPrivateKey) {
      console.error(`[Transfer] No private key found for agent: ${agentId || 'aigent-z'}`);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: `Agent private key not found for ${agentId || 'aigent-z'}. Check agent keys configuration.` 
      }), { status: 500 });
    }
    
    const PK = agentKeys.evmPrivateKey;
    console.log(`[Transfer] Using private key for address: ${agentKeys.evmAddress}`);

    const { ethers } = await import("ethers");
    const rpc = (cid: number) => {
      switch (cid) {
        case 11155111: // Ethereum Sepolia
          return process.env.NEXT_PUBLIC_RPC_SEPOLIA;
        case 421614: // Arbitrum Sepolia
          return process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA;
        case 84532: // Base Sepolia
          return process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA;
        case 11155420: // Optimism Sepolia
          return process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA;
        case 80002: // Polygon Amoy
          return process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY;
        default:
          return undefined;
      }
    };
    const url = rpc(Number(chainId));
    if (!url) return new Response(JSON.stringify({ ok: false, error: "unsupported chainId" }), { status: 400 });
    console.log(`A2A Transfer: ${asset} on chain ${chainId} using RPC: ${url}`);
    
    const provider = new ethers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(PK, provider);
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    
    console.log(`Executing transfer: ${amount} tokens to ${to}`);
    const tx = await erc20.transfer(to, amount);
    console.log(`Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed: ${receipt.hash} with status ${receipt.status}`);

    // Trigger DVN/PoS flow for successful A2A transactions
    if (receipt?.status === 1) {
      try {
        await triggerA2ADVNFlow(tx.hash, chainId, asset || 'QCT');
      } catch (dvnError) {
        console.warn('DVN flow trigger failed:', dvnError);
        // Don't fail the transaction if DVN fails
      }
    }

    return new Response(JSON.stringify({ ok: true, txHash: tx.hash, status: receipt?.status || 1 }), { status: 200 });
  } catch (e: any) {
    console.error('A2A Transfer Error:', {
      chainId: Number(chainId),
      asset: asset || 'QCT',
      error: e?.message,
      code: e?.code,
      reason: e?.reason
    });
    
    // Provide more specific error messages
    let errorMessage = "transfer failed";
    if (e?.code === 'NETWORK_ERROR') {
      errorMessage = `RPC connection failed for chain ${chainId}`;
    } else if (e?.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = "Insufficient funds in signer wallet";
    } else if (e?.reason) {
      errorMessage = e.reason;
    } else if (e?.message) {
      errorMessage = e.message;
    }
    
    return new Response(JSON.stringify({ ok: false, error: errorMessage }), { status: 500 });
  }
}

async function triggerA2ADVNFlow(txHash: string, chainId: number, asset: string) {
  try {
    // 1. Create PoS receipt for the A2A transaction
    const crypto = await import("crypto");
    const dataHash = crypto.createHash("sha256").update(`a2a_${txHash}_${chainId}`).digest("hex");
    
    const posResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ops/pos/issue-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataHash,
        source: `A2A_${asset}_${chainId}`
      })
    });

    if (!posResponse.ok) {
      throw new Error(`PoS receipt failed: ${posResponse.status}`);
    }

    const posResult = await posResponse.json();
    console.log(`A2A PoS receipt created: ${posResult.receiptId}`);

    // 2. Submit DVN message for cross-chain processing
    const dvnResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ops/dvn/monitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash,
        chainId,
        source: 'A2A_PAYMENT'
      })
    });

    if (!dvnResponse.ok) {
      throw new Error(`DVN monitoring failed: ${dvnResponse.status}`);
    }

    const dvnResult = await dvnResponse.json();
    console.log(`A2A DVN message submitted: ${dvnResult.messageId || 'success'}`);

  } catch (error) {
    console.error('A2A DVN flow error:', error);
    throw error;
  }
}
