export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AgentKeyService } from "@/services/identity/agentKeyService";

/**
 * Debug endpoint to check agent key status
 * Helps diagnose A2A transaction failures related to missing keys
 */
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agentId') || 'aigent-z';
    
    console.log(`[Debug] Checking keys for agent: ${agentId}`);
    
    const keyService = new AgentKeyService();
    const agentKeys = await keyService.getAgentKeys(agentId);
    
    const result = {
      agentId,
      keysFound: !!agentKeys,
      hasEvmPrivateKey: !!agentKeys?.evmPrivateKey,
      hasEvmAddress: !!agentKeys?.evmAddress,
      evmAddress: agentKeys?.evmAddress,
      evmKeyLength: agentKeys?.evmPrivateKey?.length,
      evmKeyStartsWithOx: agentKeys?.evmPrivateKey?.startsWith('0x'),
      hasBtcKey: !!agentKeys?.btcPrivateKey,
      hasSolanaKey: !!agentKeys?.solanaPrivateKey,
      agentName: agentKeys?.agentName
    };
    
    console.log(`[Debug] Agent key status:`, result);
    
    return new Response(JSON.stringify({
      ok: true,
      ...result,
      recommendations: {
        ...((!agentKeys || !agentKeys.evmPrivateKey) && {
          critical: `No EVM private key found for ${agentId}. Run key generation script or check Supabase agent_keys table.`
        }),
        ...(agentKeys?.evmPrivateKey && !agentKeys.evmPrivateKey.startsWith('0x') && {
          warning: 'EVM private key does not start with 0x - may be incorrectly formatted'
        }),
        ...(agentKeys?.evmPrivateKey && agentKeys.evmPrivateKey.length !== 66 && {
          warning: `EVM private key length is ${agentKeys.evmPrivateKey.length}, expected 66 characters`
        })
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Debug] Agent key check failed:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to check agent keys',
      details: {
        errorType: error.constructor.name,
        stack: error.stack
      }
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
