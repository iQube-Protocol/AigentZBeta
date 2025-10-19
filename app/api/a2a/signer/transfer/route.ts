export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Decrypt function for encrypted private keys
function decrypt(encryptedText: string, encryptionKey: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

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

    // Get agent private key from Supabase (server-side only) - Direct client to avoid conflicts
    console.log(`[Transfer] Retrieving keys for agent: ${agentId || 'aigent-z'}`);
    
    let agentKeys;
    
    try {
      // Create isolated Supabase client to avoid AgentiQBootstrap conflicts
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET || process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET;
      
      console.log(`[Transfer] Environment check:`, {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasEncryptionKey: !!encryptionKey,
        supabaseUrlPrefix: supabaseUrl?.substring(0, 20) + '...',
        serviceKeyPrefix: supabaseServiceKey?.substring(0, 20) + '...'
      });
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
      }
      
      if (!encryptionKey) {
        throw new Error('Missing AGENT_KEY_ENCRYPTION_SECRET environment variable');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
      
      const { data, error } = await supabase
        .from('agent_keys')
        .select('*')
        .eq('agent_id', agentId || 'aigent-z')
        .single();
      
      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }
      
      agentKeys = data;
      
      // Decrypt the private key if it's encrypted
      if (agentKeys?.evm_private_key_encrypted) {
        try {
          agentKeys.evm_private_key = decrypt(agentKeys.evm_private_key_encrypted, encryptionKey);
        } catch (decryptError) {
          throw new Error(`Failed to decrypt private key: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
        }
      }
      
      console.log(`[Transfer] Keys retrieved:`, {
        agentId: agentId || 'aigent-z',
        keysFound: !!agentKeys,
        hasEvmKey: !!agentKeys?.evm_private_key,
        evmAddress: agentKeys?.evm_address,
        wasEncrypted: !!agentKeys?.evm_private_key_encrypted
      });
    } catch (error) {
      console.error(`[Transfer] Error retrieving keys:`, error);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: `Failed to retrieve agent keys: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }), { status: 500 });
    }
    
    if (!agentKeys?.evm_private_key) {
      console.error(`[Transfer] No private key found for agent: ${agentId || 'aigent-z'}`);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: `Agent private key not found for ${agentId || 'aigent-z'}. Check Supabase agent_keys table.` 
      }), { status: 500 });
    }
    
    const PK = agentKeys.evm_private_key;
    console.log(`[Transfer] Using private key for address: ${agentKeys.evm_address}`);

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
