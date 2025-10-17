export const dynamic = "force-dynamic";

/**
 * Simple test to check if we can retrieve agent keys
 */

import { AgentKeyService } from '@/services/identity/agentKeyService';

export async function GET() {
  try {
    console.log('=== TEST KEYS ENDPOINT CALLED ===');
    
    const keyService = new AgentKeyService();
    
    console.log('=== ATTEMPTING TO GET AIGENT-Z KEYS ===');
    const keys = await keyService.getAgentKeys('aigent-z');
    
    console.log('=== RESULT ===', {
      found: !!keys,
      hasEvmKey: !!keys?.evmPrivateKey,
      evmAddress: keys?.evmAddress
    });
    
    return new Response(JSON.stringify({
      success: !!keys,
      hasEvmKey: !!keys?.evmPrivateKey,
      evmAddress: keys?.evmAddress,
      message: keys ? 'Keys retrieved successfully!' : 'Failed to retrieve keys'
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('=== ERROR ===', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
