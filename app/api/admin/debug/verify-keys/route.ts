export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";

/**
 * Debug endpoint to verify private keys resolve to correct public addresses
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
  
  try {
    console.log(`[Debug] Verifying keys for agent: ${agentId}`);
    
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(agentId);
    
    if (!agentKeys?.evmPrivateKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: `No EVM private key found for ${agentId}`
      }), { status: 404 });
    }

    // Derive address from private key
    const { ethers } = await import("ethers");
    const wallet = new ethers.Wallet(agentKeys.evmPrivateKey);
    const derivedAddress = wallet.address;
    
    // Compare with stored address
    const storedAddress = agentKeys.evmAddress;
    const addressMatch = derivedAddress.toLowerCase() === storedAddress.toLowerCase();
    
    const result = {
      agentId,
      agentName: agentKeys.agentName,
      storedAddress,
      derivedAddress,
      addressMatch,
      privateKeyLength: agentKeys.evmPrivateKey.length,
      privateKeyFormat: agentKeys.evmPrivateKey.startsWith('0x') ? 'hex with 0x' : 'raw hex'
    };
    
    console.log(`[Debug] Key verification result:`, result);
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Debug] Key verification failed:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to verify keys',
      stack: error.stack
    }), { status: 500 });
  }
}
