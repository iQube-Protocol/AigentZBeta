/**
 * KNYT Purchase API
 * POST /api/wallet/knyt/purchase
 * 
 * Purchase content with KNYT or buy KNYT with PayPal
 */

import { NextRequest, NextResponse } from 'next/server';
import { purchaseWithKnyt, purchaseWithKnytSku, purchaseKnytWithPaypal } from '@/services/wallet/knyt/knytPurchaseService';
import {
  getContentPricing,
  getKnytPackages,
  getKnytPackagesAsync,
  getKnytUsdPrice,
  KNYT_BUY_RAIL_FEE_PERCENT,
  priceForRail,
  ContentType,
} from '@/services/wallet/knyt/knytPricingService';
import { quoteSkuOffers } from '@/services/wallet/knyt/knytSkuQuoteService';
import type { PricingKind } from '@/types/smartContent';

export const runtime = 'nodejs';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'purchase_content') {
      // Purchase content with KNYT
      const { personaId, contentId, contentType, customPrice } = body;
      
      if (!personaId || !contentId || !contentType) {
        return NextResponse.json({ error: 'personaId, contentId, contentType required' }, { status: 400,  });
      }
      
      const result = await purchaseWithKnyt(personaId, contentId, contentType as ContentType, customPrice);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400,  });
      }
      
      return NextResponse.json(result);
    }

    if (action === 'purchase_content_sku') {
      const { personaId, sku, tierKind } = body;

      if (!personaId || !sku || !tierKind) {
        return NextResponse.json({ error: 'personaId, sku, tierKind required' }, { status: 400,  });
      }

      const result = await purchaseWithKnytSku(personaId, sku, tierKind as PricingKind);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400,  });
      }

      return NextResponse.json(result);
    }
    
    if (action === 'buy_knyt') {
      // Buy KNYT with PayPal
      const { personaId, packageId, paypalOrderId } = body;
      
      if (!personaId || !packageId || !paypalOrderId) {
        return NextResponse.json({ error: 'personaId, packageId, paypalOrderId required' }, { status: 400,  });
      }
      
      const packages = getKnytPackages();
      const pkg = packages.find(p => p.packageId === packageId);
      
      if (!pkg) {
        return NextResponse.json({ error: 'Invalid packageId' }, { status: 400,  });
      }
      
      const result = await purchaseKnytWithPaypal(personaId, pkg.usdPrice, paypalOrderId, pkg.bonusKnyt);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400,  });
      }
      
      return NextResponse.json({
        ...result,
        knytAmount: pkg.knytAmount + pkg.bonusKnyt,
      });
    }
    
    return NextResponse.json({ error: 'Invalid action. Use purchase_content or buy_knyt' }, { status: 400,  });
  } catch (error) {
    console.error('[KNYT Purchase API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500,  });
  }
}

// GET pricing info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const personaId = searchParams.get('personaId') || undefined;
    const tierKind = (searchParams.get('tierKind') || undefined) as PricingKind | undefined;
    const contentId = searchParams.get('contentId');
    const contentType = searchParams.get('contentType');

    if (sku) {
      const quote = await quoteSkuOffers({ sku, personaId, tierKind });
      return NextResponse.json({ quote });
    }
    
    if (contentId && contentType) {
      const pricing = getContentPricing(contentId, contentType as ContentType);
      return NextResponse.json({ pricing });
    }
    
    // Return KNYT packages with live ETH pricing.
    // Each package is the flat base USD price; per-rail surcharges (Q¢ 0%,
    // USDC 1%, PayPal 10%) are exposed separately so the modal can render a
    // payment-method picker and live total without knowing the rate logic.
    // `usdPerKnyt` lets the modal price arbitrary custom amounts without an
    // extra round-trip — same number used to compute the package prices.
    const packages = await getKnytPackagesAsync();
    const usdPerKnyt = await getKnytUsdPrice();
    const packagesWithRails = packages.map((p) => ({
      ...p,
      rails: {
        qc:     { feePct: KNYT_BUY_RAIL_FEE_PERCENT.qc,     priceUsd: priceForRail(p.usdPrice, 'qc') },
        usdc:   { feePct: KNYT_BUY_RAIL_FEE_PERCENT.usdc,   priceUsd: priceForRail(p.usdPrice, 'usdc') },
        paypal: { feePct: KNYT_BUY_RAIL_FEE_PERCENT.paypal, priceUsd: priceForRail(p.usdPrice, 'paypal') },
      },
    }));
    return NextResponse.json({
      packages: packagesWithRails,
      railFeePercent: KNYT_BUY_RAIL_FEE_PERCENT,
      usdPerKnyt,
      minKnytAmount: 10,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500,  });
  }
}
