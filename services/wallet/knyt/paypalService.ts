/**
 * PayPal Service for KNYT Purchases
 */

const mode = (process.env.PAYPAL_MODE || 'live').trim();
const PAYPAL_API = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  
  // DIAGNOSTIC: Log credential details
  console.log('[PayPal KNYT] Runtime env check:', {
    mode,
    modeRaw: process.env.PAYPAL_MODE,
    clientIdDefined: !!clientId,
    clientIdLength: clientId?.length || 0,
    clientIdPrefix: clientId?.substring(0, 12) + '...',
    clientSecretDefined: !!clientSecret,
    clientSecretLength: clientSecret?.length || 0,
    clientSecretPrefix: clientSecret?.substring(0, 12) + '...',
    apiEndpoint: PAYPAL_API
  });
  
  if (!clientId || !clientSecret) {
    console.error('[PayPal KNYT] Missing credentials at runtime');
    throw new Error(`PayPal env missing at runtime (mode=${mode})`);
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  console.log('[PayPal KNYT] Attempting auth with endpoint:', PAYPAL_API);
  
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[PayPal KNYT] Auth failed:', {
      status: res.status,
      error: errorText
    });
    throw new Error(`PayPal auth failed: ${res.status} ${errorText}`);
  }
  
  const data = await res.json();
  console.log('[PayPal KNYT] Auth success');
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export async function createPayPalOrder(personaId: string, packageId: string, usdAmount: number, knytAmount: number) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'USD', value: usdAmount.toFixed(2) }, custom_id: JSON.stringify({ personaId, packageId, knytAmount }) }],
    }),
  });
  const order = await res.json();
  return { orderId: order.id, approvalUrl: order.links?.find((l: any) => l.rel === 'approve')?.href };
}

export async function capturePayPalOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const order = await res.json();
  // Surface a few PayPal error fingerprints so the route can recover from a
  // race (e.g. ORDER_ALREADY_CAPTURED) by reading the order back instead of
  // just bubbling a generic failure.
  const issue = order?.details?.[0]?.issue || order?.name || null;
  if (order.status !== 'COMPLETED') {
    return { success: false, error: order.status || issue || 'UNKNOWN', issue, raw: order };
  }
  const meta = JSON.parse(order.purchase_units?.[0]?.custom_id || '{}');
  return { success: true, ...meta, usdAmount: parseFloat(order.purchase_units?.[0]?.amount?.value || '0') };
}

/**
 * Read a PayPal order without trying to capture. Used by the capture route
 * to recover from races where the order was already captured by a previous
 * poll: we re-derive the credit from the stored order rather than calling
 * /capture again (which would error with ORDER_ALREADY_CAPTURED).
 */
export async function getPayPalOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
    method: 'GET', headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    return { success: false, error: `PayPal getOrder ${res.status}`, status: res.status };
  }
  const order = await res.json();
  if (order.status !== 'COMPLETED') {
    return { success: false, error: order.status || 'NOT_COMPLETED' };
  }
  const meta = JSON.parse(order.purchase_units?.[0]?.custom_id || '{}');
  return { success: true, ...meta, usdAmount: parseFloat(order.purchase_units?.[0]?.amount?.value || '0') };
}

/**
 * Read a PayPal capture by id. The merchant dashboard surfaces capture/
 * transaction ids prominently — they are NOT the same as the v2 order ids
 * the recover route's main path queries. This helper lets the recovery
 * tooling accept either id type:
 *
 *   1. recover(captureId) → get capture → follow up.href to the order →
 *      derive credit from order.purchase_units.custom_id
 *
 * Returns the resolved order metadata in the same shape as getPayPalOrder.
 */
export async function getPayPalCapture(captureId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/payments/captures/${captureId}`, {
    method: 'GET', headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    return { success: false, error: `PayPal getCapture ${res.status}`, status: res.status };
  }
  const capture = await res.json();
  // The capture itself surfaces custom_id directly when set on the
  // purchase_unit at order-create time.
  const customIdRaw = capture?.custom_id || capture?.supplementary_data?.related_ids?.custom_id || '';
  let meta: Record<string, unknown> = {};
  try { meta = customIdRaw ? JSON.parse(customIdRaw) : {}; } catch { /* fall through to up-link */ }

  // If we didn't get usable metadata directly off the capture, follow the
  // "up" HATEOAS link to the parent order and parse from there.
  if (!('personaId' in meta) || !('knytAmount' in meta)) {
    const upLink = (capture?.links || []).find((l: any) => l.rel === 'up');
    if (upLink?.href) {
      const orderRes = await fetch(upLink.href, {
        method: 'GET', headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!orderRes.ok) {
        return { success: false, error: `PayPal up-link ${orderRes.status}`, status: orderRes.status };
      }
      const order = await orderRes.json();
      const orderCustomId = order.purchase_units?.[0]?.custom_id || '';
      try { meta = orderCustomId ? JSON.parse(orderCustomId) : {}; } catch { meta = {}; }
      const usdAmount = parseFloat(order.purchase_units?.[0]?.amount?.value || capture?.amount?.value || '0');
      return { success: true, ...(meta as Record<string, unknown>), usdAmount, orderId: order.id, captureId };
    }
  }

  const usdAmount = parseFloat(capture?.amount?.value || '0');
  return { success: true, ...(meta as Record<string, unknown>), usdAmount, captureId };
}

export async function verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<boolean> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_sig: headers['paypal-transmission-sig'],
      webhook_event: JSON.parse(body),
    }),
  });
  const result = await res.json();
  return result.verification_status === 'SUCCESS';
}
