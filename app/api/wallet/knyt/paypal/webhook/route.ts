/**
 * PayPal Webhook API
 * POST /api/wallet/knyt/paypal/webhook
 * 
 * Handles PayPal IPN/webhook events for payment confirmations
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, capturePayPalOrder } from '@/services/wallet/knyt/paypalService';
import { creditKnyt } from '@/services/wallet/knyt/knytLedgerService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    
    // Verify webhook signature (skip in dev if no webhook ID)
    if (process.env.PAYPAL_WEBHOOK_ID) {
      const valid = await verifyWebhookSignature(headers, body);
      if (!valid) {
        console.error('[PayPal Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
    
    const event = JSON.parse(body);
    console.log(`[PayPal Webhook] Event: ${event.event_type}`);
    
    // Handle payment capture completed
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      if (orderId) {
        const capture = await capturePayPalOrder(orderId);
        if (capture.success) {
          await creditKnyt(capture.personaId, capture.knytAmount, 'paypal_purchase', {
            fiatAmount: capture.usdAmount,
            fiatCurrency: 'USD',
            paypalOrderId: orderId,
            webhookEvent: event.event_type,
          });
          console.log(`[PayPal Webhook] Credited ${capture.knytAmount} KNYT to ${capture.personaId}`);
        }
      }
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[PayPal Webhook] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
