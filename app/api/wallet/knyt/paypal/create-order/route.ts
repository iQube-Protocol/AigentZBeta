/**
 * PayPal Create Order API
 * POST /api/wallet/knyt/paypal/create-order
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/services/wallet/knyt/paypalService';
import { getKnytPackages } from '@/services/wallet/knyt/knytPricingService';

export const runtime = 'nodejs';

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
    const { personaId, packageId } = await request.json();
    if (!personaId || !packageId) {
      return withCors(NextResponse.json({ error: 'personaId and packageId required' }, { status: 400 }), origin);
    }
    
    const pkg = getKnytPackages().find(p => p.packageId === packageId);
    if (!pkg) return withCors(NextResponse.json({ error: 'Invalid packageId' }, { status: 400 }), origin);
    
    const result = await createPayPalOrder(personaId, packageId, pkg.usdPrice, pkg.knytAmount + pkg.bonusKnyt);
    return withCors(NextResponse.json(result), origin);
  } catch (error) {
    console.error('[PayPal Create Order] Error:', error);
    return withCors(NextResponse.json({ error: (error as Error).message }, { status: 500 }));
  }
}
