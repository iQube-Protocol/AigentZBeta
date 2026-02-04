/**
 * PayPal Return Handler - Captures payment and completes purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { PurchaseHandler } from '@/services/rewards/purchaseHandler';

export const dynamic = 'force-dynamic';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('PayPal auth failed');
  const data = await res.json();
  return data.access_token;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/codex?error=missing_token`);
    }

    const accessToken = await getAccessToken();
    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const order = await captureRes.json();
    if (order.status !== 'COMPLETED') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/codex?error=payment_failed`);
    }

    const customData = JSON.parse(order.purchase_units?.[0]?.custom_id || '{}');
    const { personaId, contentType, contentId, version } = customData;

    const purchaseHandler = new PurchaseHandler();
    const result = await purchaseHandler.processPurchase({
      personaId,
      productType: contentType,
      assetIds: [contentId],
      paymentRail: 'paypal',
      paymentReference: token,
      metadata: {
        amount: parseFloat(order.purchase_units?.[0]?.amount?.value || '0'),
        currency: 'USD',
        version,
      },
    });

    if (!result.success) {
      // Return HTML that closes popup and sends error to parent
      return new NextResponse(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'paypal-error', error: 'purchase_failed' }, '*');
                window.close();
              } else {
                window.location.href = '${process.env.NEXT_PUBLIC_APP_URL}/codex?error=purchase_failed';
              }
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Return HTML that closes popup and sends success to parent
    return new NextResponse(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'paypal-success', 
                purchaseId: '${result.purchaseId}',
                entitlementsGranted: ${result.entitlementsGranted || 0}
              }, '*');
              window.close();
            } else {
              window.location.href = '${process.env.NEXT_PUBLIC_APP_URL}/codex?paypal=success';
            }
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('[PayPal Return] Error:', error);
    return new NextResponse(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'paypal-error', error: 'server_error' }, '*');
              window.close();
            } else {
              window.location.href = '${process.env.NEXT_PUBLIC_APP_URL}/codex?error=server_error';
            }
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
}
