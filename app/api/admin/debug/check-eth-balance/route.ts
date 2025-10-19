export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

// Decrypt function for encrypted private keys
function decrypt(encryptedText: string, encryptionKey: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Debug endpoint to check ETH balance for gas fees
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
  const chainId = parseInt(req.nextUrl.searchParams.get('chainId') || '84532'); // Default to Base Sepolia
  
  try {
    console.log(`[Debug] Checking ETH balance for agent: ${agentId} on chain: ${chainId}`);
    
    // Get agent keys directly from Supabase to avoid client conflicts
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encryptionKey = process.env.AGENT_KEY_ENCRYPTION_SECRET;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing Supabase environment variables'
      }), { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
    
    const { data: agentKeys, error } = await supabase
      .from('agent_keys')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    
    if (error || !agentKeys) {
      return new Response(JSON.stringify({
        ok: false,
        error: `No agent keys found for ${agentId}: ${error?.message || 'Not found'}`
      }), { status: 404 });
    }
    
    // Decrypt private key if encrypted
    let privateKey = agentKeys.evm_private_key;
    if (!privateKey && agentKeys.evm_private_key_encrypted && encryptionKey) {
      try {
        privateKey = decrypt(agentKeys.evm_private_key_encrypted, encryptionKey);
      } catch (decryptError) {
        return new Response(JSON.stringify({
          ok: false,
          error: `Failed to decrypt private key: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`
        }), { status: 500 });
      }
    }
    
    if (!privateKey) {
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
    const wallet = new ethers.Wallet(privateKey, provider);
    
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
