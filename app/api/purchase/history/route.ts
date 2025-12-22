/**
 * API Route: Purchase History
 * GET /api/purchase/history?personaId=xxx&limit=20
 * 
 * Gets purchase history for a persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseHandler } from '@/services/rewards/purchaseHandler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    
    const purchaseHandler = getPurchaseHandler();
    const purchases = await purchaseHandler.getPurchaseHistory(personaId, limit);
    
    return NextResponse.json({
      personaId,
      purchases,
      count: purchases.length,
    });
  } catch (error) {
    console.error('[API] Error fetching purchase history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
