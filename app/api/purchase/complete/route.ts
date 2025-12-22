/**
 * API Route: Complete Purchase
 * POST /api/purchase/complete
 * 
 * Processes a completed purchase, grants entitlements, and triggers rewards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseHandler } from '@/services/rewards/purchaseHandler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Purchase API] Received body:', JSON.stringify(body, null, 2));
    
    const { personaId, productType, paymentRail, assetIds, paymentReference, metadata } = body;
    
    console.log('[Purchase API] Extracted params:', { personaId, productType, paymentRail });
    
    if (!personaId || !productType || !paymentRail) {
      console.log('[Purchase API] Missing required params:', { 
        hasPersonaId: !!personaId, 
        hasProductType: !!productType, 
        hasPaymentRail: !!paymentRail 
      });
      return NextResponse.json({ 
        error: 'personaId, productType, and paymentRail are required' 
      }, { status: 400 });
    }
    
    if (!['qc', 'knyt', 'usdc', 'paypal'].includes(paymentRail)) {
      return NextResponse.json({ 
        error: 'paymentRail must be qc, knyt, usdc, or paypal' 
      }, { status: 400 });
    }
    
    const purchaseHandler = getPurchaseHandler();
    const result = await purchaseHandler.processPurchase({
      personaId,
      productType,
      paymentRail,
      assetIds,
      paymentReference,
      metadata,
    });
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      purchaseId: result.purchaseId,
      entitlementsGranted: result.entitlementsGranted,
      rewardsTriggered: result.rewardsTriggered,
    });
  } catch (error) {
    console.error('[API] Error processing purchase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
