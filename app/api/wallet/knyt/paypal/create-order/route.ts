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
  return new NextResponse(null);
}

export async function POST(request: NextRequest) {
  try {
    const { personaId, packageId } = await request.json();
    if (!personaId || !packageId) {
      return NextResponse.json({ error: 'personaId and packageId required' }, { status: 400,  });
    }
    
    const pkg = getKnytPackages().find(p => p.packageId === packageId);
    if (!pkg) return NextResponse.json({ error: 'Invalid packageId' }, { status: 400,  });
    
    const result = await createPayPalOrder(personaId, packageId, pkg.usdPrice, pkg.knytAmount + pkg.bonusKnyt);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[PayPal Create Order] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500,  });
  }
}
