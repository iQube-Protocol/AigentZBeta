/**
 * PayPal Capture Order API
 * POST /api/wallet/knyt/paypal/capture
 */

import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/services/wallet/knyt/paypalService';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';

export const runtime = 'nodejs';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
}

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400,  });
    }
    
    const capture = await capturePayPalOrder(orderId);
    if (!capture.success) {
      return NextResponse.json({ error: capture.error }, { status: 400,  });
    }
    
    // Credit KNYT to persona
    const credit = await creditKnyt(capture.personaId, capture.knytAmount, 'paypal_purchase', {
      fiatAmount: capture.usdAmount,
      fiatCurrency: 'USD',
      paypalOrderId: orderId,
      packageId: capture.packageId,
    });
    
    return NextResponse.json({
      success: true,
      knytAmount: capture.knytAmount,
      newBalance: credit.newBalance,
      transactionId: credit.transaction?.id,
    });
  } catch (error) {
    console.error('[PayPal Capture] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500,  });
  }
}
