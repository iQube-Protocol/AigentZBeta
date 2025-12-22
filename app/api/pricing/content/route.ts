/**
 * API Route: Content Pricing
 * GET /api/pricing/content?productType=xxx
 * 
 * Gets multi-rail pricing for a content product.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMultiRailPricing, ContentType, KNYT_USD_RATE, RAIL_CONFIG } from '@/services/wallet/knyt/knytPricingService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productType = searchParams.get('productType') as ContentType;
    
    if (!productType) {
      return NextResponse.json({ error: 'productType is required' }, { status: 400 });
    }
    
    const pricing = getMultiRailPricing('content', productType);
    
    return NextResponse.json({
      productType: pricing.contentType,
      baseKnytPrice: pricing.baseKnytPrice,
      usdBasePrice: pricing.usdBasePrice,
      rails: pricing.rails,
      config: {
        knytUsdRate: KNYT_USD_RATE,
        ...RAIL_CONFIG,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching pricing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
