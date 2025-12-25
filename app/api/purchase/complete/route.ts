/**
 * API Route: Complete Purchase
 * POST /api/purchase/complete
 * 
 * Processes a completed purchase, grants entitlements, and triggers rewards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseHandler } from '@/services/rewards/purchaseHandler';

// CORS headers for cross-origin requests from thin client
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Purchase API] Received body:', JSON.stringify(body, null, 2));
    
    const { personaId, productType, paymentRail, assetIds, paymentReference, metadata } = body;
    
    console.log('[Purchase API] Extracted params:', { personaId, productType, paymentRail });
    
    // TEST MODE: Allow purchases without payment verification in development
    const isTestMode = process.env.NODE_ENV === 'development' || process.env.ENABLE_TEST_PURCHASES === 'true';
    if (isTestMode) {
      console.log('[Purchase API] TEST MODE: Bypassing payment verification');
    }
    
    if (!personaId || !productType || !paymentRail) {
      console.log('[Purchase API] Missing required params:', { 
        hasPersonaId: !!personaId, 
        hasProductType: !!productType, 
        hasPaymentRail: !!paymentRail 
      });
      return NextResponse.json({ 
        error: 'personaId, productType, and paymentRail are required' 
      }, { status: 400, headers: corsHeaders });
    }
    
    if (!['qc', 'knyt', 'usdc', 'paypal'].includes(paymentRail)) {
      return NextResponse.json({ 
        error: 'paymentRail must be qc, knyt, usdc, or paypal' 
      }, { status: 400, headers: corsHeaders });
    }
    
    const purchaseHandler = getPurchaseHandler();
    console.log('[Purchase API] Calling processPurchase with:', { personaId, productType, paymentRail, assetIds });
    
    const result = await purchaseHandler.processPurchase({
      personaId,
      productType,
      paymentRail,
      assetIds,
      paymentReference,
      metadata,
    });
    
    console.log('[Purchase API] Purchase result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('[Purchase API] Purchase failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    
    return NextResponse.json({
      success: true,
      purchaseId: result.purchaseId,
      entitlementsGranted: result.entitlementsGranted,
      rewardsTriggered: result.rewardsTriggered,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[API] Error processing purchase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
