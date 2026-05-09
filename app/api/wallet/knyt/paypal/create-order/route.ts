/**
 * PayPal Create Order API
 * POST /api/wallet/knyt/paypal/create-order
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/services/wallet/knyt/paypalService';
import { getKnytPackages, getKnytUsdPrice, priceForRail } from '@/services/wallet/knyt/knytPricingService';

export const runtime = 'nodejs';

const MIN_CUSTOM_KNYT = 10;

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function withCors(response: NextResponse, origin?: string | null) {
  response.headers.set('Access-Control-Allow-Origin', origin || '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    const { personaId, packageId, customKnytAmount } = await request.json() as {
      personaId?: string;
      packageId?: string;
      customKnytAmount?: number;
    };
    if (!personaId) {
      return withCors(NextResponse.json({ error: 'personaId required' }, { status: 400 }), origin);
    }

    // Resolve either a preset package or a user-entered custom amount. Custom
    // amounts price off the live USD-per-KNYT rate and are floor()ed to whole
    // KNYT units to keep the credit math simple.
    let knytAmount: number;
    let basePriceUsd: number;
    let resolvedPackageId: string;

    if (typeof customKnytAmount === 'number' && customKnytAmount > 0) {
      if (customKnytAmount < MIN_CUSTOM_KNYT) {
        return withCors(
          NextResponse.json({ error: `Minimum custom amount is ${MIN_CUSTOM_KNYT} KNYT` }, { status: 400 }),
          origin
        );
      }
      knytAmount = Math.floor(customKnytAmount);
      const usdPerKnyt = await getKnytUsdPrice();
      basePriceUsd = Math.round(knytAmount * usdPerKnyt * 100) / 100;
      resolvedPackageId = `knyt_custom_${knytAmount}`;
    } else if (packageId) {
      const pkg = getKnytPackages().find(p => p.packageId === packageId);
      if (!pkg) return withCors(NextResponse.json({ error: 'Invalid packageId' }, { status: 400 }), origin);
      knytAmount = pkg.knytAmount;
      basePriceUsd = pkg.usdPrice;
      resolvedPackageId = pkg.packageId;
    } else {
      return withCors(
        NextResponse.json({ error: 'Either packageId or customKnytAmount required' }, { status: 400 }),
        origin
      );
    }

    // Apply the 10% PayPal rail fee on top of the base USD price.
    // The user is charged that amount via PayPal but credited the straight
    // knytAmount — the fee covers PayPal processing.
    const paypalUsdPrice = priceForRail(basePriceUsd, 'paypal');
    const result = await createPayPalOrder(personaId, resolvedPackageId, paypalUsdPrice, knytAmount);
    return withCors(NextResponse.json(result), origin);
  } catch (error) {
    console.error('[PayPal Create Order] Error:', error);
    return withCors(NextResponse.json({ error: (error as Error).message }, { status: 500 }));
  }
}
