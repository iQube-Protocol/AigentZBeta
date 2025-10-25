export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

/**
 * Check Aigent Z's Q¢ (QCT) balance across all chains
 * This is used for operational currency monitoring
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');
  
  try {
    if (!agentId) {
      return new Response(JSON.stringify({
        ok: false,
        error: "agentId parameter required"
      }), { status: 400 });
    }

    // TODO: Implement actual Q¢ balance checking across chains
    // For now, return placeholder data
    const mockQctBalance = {
      totalQct: "1250", // Total Q¢ across all chains
      breakdown: {
        ethereum: "500",
        polygon: "300", 
        arbitrum: "200",
        optimism: "150",
        base: "100"
      },
      lastUpdated: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      ok: true,
      agentId,
      agentName: "Aigent Z",
      totalQct: mockQctBalance.totalQct,
      breakdown: mockQctBalance.breakdown,
      lastUpdated: mockQctBalance.lastUpdated,
      note: "Q¢ balance monitoring not yet fully implemented - showing mock data"
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[Check QCT Balance] Error:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Failed to check Q¢ balance',
      agentId
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
