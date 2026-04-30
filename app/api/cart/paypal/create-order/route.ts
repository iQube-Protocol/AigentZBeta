/**
 * POST /api/cart/paypal/create-order
 *
 * Creates a single PayPal order that covers every line in the cart, so the
 * user only authorises once for the full multi-line cart total. Mirrors the
 * shape of /api/purchase/paypal/create-order but uses PayPal's native
 * multi-purchase_unit support: one unit per cart line, with the line's
 * full priceUsd × qty as the unit value and the line metadata in custom_id.
 *
 * Body:
 *   {
 *     personaId: string,
 *     cartPurchaseId?: string,  // optional client-provided id; we generate if absent
 *     lines: [{
 *       id: string,                          // contentId / assetId for entitlement
 *       contentType: CartContentType,        // required
 *       label: string,
 *       priceUsd: number,                    // base USD per unit
 *       qty?: number,                        // default 1
 *       thumbUrl?: string,                   // optional metadata for receipts
 *     }, ...],
 *   }
 *
 * Returns: { orderId, approvalUrl, cartPurchaseId }
 *
 * Constraints:
 * - PayPal allows ≤10 purchase_units per order. Carts with >10 lines are
 *   rejected with a 400 — the user can split or pick a different rail.
 * - PayPal custom_id is 127 chars max per unit. Keep the JSON small.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_MAX_UNITS = 10;
// Mirror knytPricingService's RAIL_CONFIG so cart-PayPal totals match what
// /api/cart/quote returns (and what the modal showed the user).
const PAYPAL_FEE_PERCENT = 0.03;
const FIAT_PREMIUM_PERCENT = 0.07;

interface CartLineInput {
  id: string;
  contentType: string;
  label: string;
  priceUsd: number;
  qty?: number;
  thumbUrl?: string;
}

function withCors(response: NextResponse, origin?: string | null) {
  response.headers.set('Access-Control-Allow-Origin', origin || '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PayPal authentication failed: ${res.status} ${errorText}`);
  }
  const data = await res.json();
  return data.access_token;
}

function clampQty(qty: number | undefined): number {
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 1) return 1;
  return Math.floor(qty);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const body = await request.json();
    const personaId: string | undefined = body.personaId;
    const lines: CartLineInput[] = Array.isArray(body.lines) ? body.lines : [];
    const incomingCartId: string | undefined = body.cartPurchaseId;

    if (!personaId) {
      return withCors(NextResponse.json({ error: 'personaId required' }, { status: 400 }), origin);
    }
    if (lines.length === 0) {
      return withCors(NextResponse.json({ error: 'lines array required and non-empty' }, { status: 400 }), origin);
    }
    if (lines.length > PAYPAL_MAX_UNITS) {
      return withCors(
        NextResponse.json(
          {
            error: `PayPal supports at most ${PAYPAL_MAX_UNITS} cart lines per order. This cart has ${lines.length}. Use KNYT / Q¢ / USDC, or split the cart.`,
          },
          { status: 400 },
        ),
        origin,
      );
    }

    const cartPurchaseId =
      (incomingCartId && incomingCartId.trim()) ||
      (globalThis.crypto?.randomUUID?.() ?? `cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

    // Build per-line purchase_units. Each unit's value = (priceUsd × qty) × (1 + paypal fee + premium).
    const purchaseUnits = lines.map((line, idx) => {
      const qty = clampQty(line.qty);
      const baseUsd = (line.priceUsd ?? 0) * qty;
      const grossUsd = round2(baseUsd * (1 + PAYPAL_FEE_PERCENT + FIAT_PREMIUM_PERCENT));
      const customPayload = JSON.stringify({
        // Trimmed to fit under PayPal's 127-char limit. Truncate fields if needed.
        p: personaId.slice(0, 36),
        i: line.id.slice(0, 32),
        t: line.contentType.slice(0, 24),
        q: qty,
        c: cartPurchaseId.slice(0, 36),
        n: idx,
      });
      return {
        reference_id: `line_${idx}`,
        amount: {
          currency_code: 'USD',
          value: grossUsd.toFixed(2),
        },
        description: (line.label || line.contentType || 'KNYT item').slice(0, 127),
        custom_id: customPayload,
      };
    });

    const token = await getAccessToken();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/api/cart/paypal/return`;
    const cancelUrl = `${baseUrl}/codex?paypal=cancelled`;

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: purchaseUnits,
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'KNYT Codex',
        user_action: 'PAY_NOW',
      },
    };

    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('[Cart PayPal Create Order] Error:', error);
      throw new Error(error.message || 'Failed to create PayPal order');
    }

    const order = await res.json();
    const approvalUrl = order.links?.find((l: { rel?: string }) => l.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new Error('No approval URL in PayPal response');
    }

    return withCors(NextResponse.json({ orderId: order.id, approvalUrl, cartPurchaseId }), origin);
  } catch (error) {
    console.error('[Cart PayPal Create Order] Error:', error);
    return withCors(NextResponse.json({ error: (error as Error).message }, { status: 500 }), origin);
  }
}
