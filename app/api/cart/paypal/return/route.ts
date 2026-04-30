/**
 * GET /api/cart/paypal/return
 *
 * Handles PayPal's redirect after the user authorises a multi-line cart
 * order. Captures the order, then iterates each purchase_unit and calls
 * processPurchase per qty unit (mirrors /api/cart/complete's per-unit
 * settlement). Returns HTML that posts results back to the opener window
 * and closes the popup — same pattern the single-item /api/purchase/paypal/return
 * uses, just multi-line.
 *
 * Per-unit custom_id was set in /api/cart/paypal/create-order:
 *   { p: personaId, i: lineId, t: contentType, q: qty, c: cartPurchaseId, n: lineIndex }
 */
import { NextRequest, NextResponse } from 'next/server';
import { PurchaseHandler } from '@/services/rewards/purchaseHandler';
import { cartContentTypeToProductType, type CartItem } from '@/types/knyt-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

interface UnitCustom {
  p: string;  // personaId
  i: string;  // lineId
  t: string;  // contentType
  q: number;  // qty
  c: string;  // cartPurchaseId
  n: number;  // lineIndex
}

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('PayPal auth failed');
  const data = await res.json();
  return data.access_token;
}

function popupHtml(payload: Record<string, unknown>): string {
  // Posts the result back to the opener window and closes the popup.
  // Falls back to a plain redirect when not opened in a popup.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const fallback = `${baseUrl}/codex?paypal=${payload.type === 'cart-paypal-success' ? 'success' : 'error'}`;
  return `
    <html>
      <body>
        <script>
          var msg = ${JSON.stringify(payload)};
          if (window.opener) {
            try { window.opener.postMessage(msg, '*'); } catch (_) {}
            try { window.close(); } catch (_) {}
          } else {
            window.location.href = ${JSON.stringify(fallback)};
          }
        </script>
      </body>
    </html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return new NextResponse(popupHtml({ type: 'cart-paypal-error', error: 'missing_token' }), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const accessToken = await getAccessToken();
    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const order = await captureRes.json();

    if (order.status !== 'COMPLETED') {
      return new NextResponse(popupHtml({ type: 'cart-paypal-error', error: 'payment_failed', status: order.status }), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const units: Array<{ custom_id?: string; reference_id?: string; amount?: { value?: string } }> =
      order.purchase_units ?? [];

    if (units.length === 0) {
      return new NextResponse(popupHtml({ type: 'cart-paypal-error', error: 'no_purchase_units' }), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const handler = new PurchaseHandler();
    const results: Array<{ id: string; success: boolean; purchaseId?: string; error?: string }> = [];

    let cartPurchaseId = '';
    let personaId = '';

    for (const unit of units) {
      let parsed: UnitCustom | null = null;
      try {
        parsed = JSON.parse(unit.custom_id || '{}');
      } catch {
        results.push({ id: unit.reference_id || '', success: false, error: 'unparseable_custom_id' });
        continue;
      }
      if (!parsed?.p || !parsed?.i || !parsed?.t) {
        results.push({ id: parsed?.i || unit.reference_id || '', success: false, error: 'missing_custom_id_fields' });
        continue;
      }
      cartPurchaseId = parsed.c || cartPurchaseId;
      personaId = parsed.p || personaId;

      const productType = cartContentTypeToProductType(
        parsed.t as NonNullable<CartItem['contentType']>,
      );
      if (!productType) {
        results.push({ id: parsed.i, success: false, error: `unknown_contentType:${parsed.t}` });
        continue;
      }

      const qty = parsed.q && parsed.q > 0 ? parsed.q : 1;
      for (let q = 0; q < qty; q += 1) {
        try {
          const result = await handler.processPurchase({
            personaId: parsed.p,
            productType,
            paymentRail: 'paypal',
            assetIds: [parsed.i],
            paymentReference: token,
            metadata: {
              source: 'cart_paypal',
              cartPurchaseId: parsed.c,
              cartLineIndex: parsed.n,
              cartLineQtyIndex: q,
              cartLineQty: qty,
              paypalOrderId: order.id,
              unitAmountUsd: parseFloat(unit.amount?.value || '0'),
            },
          });
          if (result.success) {
            results.push({ id: parsed.i, success: true, purchaseId: result.purchaseId });
          } else {
            results.push({ id: parsed.i, success: false, error: result.error || 'processPurchase_failed' });
          }
        } catch (err) {
          results.push({ id: parsed.i, success: false, error: err instanceof Error ? err.message : 'unknown_error' });
        }
      }
    }

    const totalSettled = results.filter((r) => r.success).length;
    const totalFailed = results.length - totalSettled;
    const fullySettled = totalFailed === 0;

    return new NextResponse(
      popupHtml({
        type: fullySettled ? 'cart-paypal-success' : 'cart-paypal-partial',
        cartPurchaseId,
        personaId,
        totalSettled,
        totalFailed,
        results,
      }),
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (error) {
    console.error('[Cart PayPal Return] Error:', error);
    return new NextResponse(
      popupHtml({ type: 'cart-paypal-error', error: error instanceof Error ? error.message : 'server_error' }),
      { headers: { 'Content-Type': 'text/html' } },
    );
  }
}
