/**
 * PayPal Service for KNYT Purchases
 */

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('[PayPal KNYT] Missing credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      mode: process.env.PAYPAL_MODE
    });
    throw new Error('PayPal credentials not configured');
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  console.log('[PayPal KNYT] Attempting auth:', {
    api: PAYPAL_API,
    mode: process.env.PAYPAL_MODE,
    clientIdPrefix: clientId.substring(0, 8) + '...'
  });
  
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
  if (order.status !== 'COMPLETED') return { success: false, error: order.status };
  const meta = JSON.parse(order.purchase_units?.[0]?.custom_id || '{}');
  return { success: true, ...meta, usdAmount: parseFloat(order.purchase_units?.[0]?.amount?.value || '0') };
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
