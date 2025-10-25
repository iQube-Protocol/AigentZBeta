export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

/**
 * Check ICP canister cycles balance
 * TODO: Implement actual cycles checking via IC management canister
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const canisterId = searchParams.get('canisterId');
  
  try {
    if (!canisterId) {
      return new Response(JSON.stringify({
        ok: false,
        error: "canisterId parameter required"
      }), { status: 400 });
    }

    // TODO: Implement actual cycles checking
    // For now, return placeholder data based on known canisters
    const knownCanisters: Record<string, { name: string; estimatedCycles: string; status: 'good' | 'low' | 'critical' }> = {
      'sp5ye-2qaaa-aaaao-qkqla-cai': {
        name: 'DVN',
        estimatedCycles: '~5T cycles',
        status: 'good'
      },
      'zdjf3-2qaaa-aaaas-qck4q-cai': {
        name: 'RQH',
        estimatedCycles: '~3T cycles', 
        status: 'good'
      }
    };

    const canisterInfo = knownCanisters[canisterId];
    
    if (!canisterInfo) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Unknown canister: ${canisterId}`
      }), { status: 404 });
    }

    // Simulate cycles check
    return new Response(JSON.stringify({
      ok: true,
      canisterId,
      name: canisterInfo.name,
      cycles: canisterInfo.estimatedCycles,
      status: canisterInfo.status,
      lastChecked: new Date().toISOString(),
      note: "Cycles monitoring via IC management canister not yet implemented"
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Check Canister Cycles] Error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to check canister cycles',
      canisterId
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
