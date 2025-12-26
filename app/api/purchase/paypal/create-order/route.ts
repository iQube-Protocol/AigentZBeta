/**
 * PayPal Create Order for Content Purchases
 * POST /api/purchase/paypal/create-order
 * 
 * Creates a PayPal order for content purchases (episodes, characters, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('[PayPal Auth] Missing credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      mode: process.env.PAYPAL_MODE
    });
    throw new Error('PayPal credentials not configured');
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  console.log('[PayPal Auth] Attempting authentication:', {
    api: PAYPAL_API,
    mode: process.env.PAYPAL_MODE,
    clientIdPrefix: clientId.substring(0, 8) + '...',
    clientSecretPrefix: clientSecret.substring(0, 8) + '...',
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length
  });
  
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[PayPal Auth] Failed:', {
      status: res.status,
      statusText: res.statusText,
      error: errorText
    });
    throw new Error(`PayPal authentication failed: ${res.status} ${errorText}`);
  }
  
  const data = await res.json();
  console.log('[PayPal Auth] Success');
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const { personaId, contentType, contentId, contentTitle, amount, version } = await request.json();
    
    if (!personaId || !contentType || !contentId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log('[PayPal Create Order] Creating order for:', {
      personaId,
      contentType,
      contentId,
      amount,
    });
    
    const token = await getAccessToken();
    
    // Create return URL with purchase details
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/purchase/paypal/return`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/codex?paypal=cancelled`;
    
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
        description: `${contentTitle || contentType}`,
        custom_id: JSON.stringify({
          personaId,
          contentType,
          contentId,
          contentTitle,
          version,
          paymentRail: 'paypal',
        }),
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'KNYT Codex',
        user_action: 'PAY_NOW',
      },
    };
    
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
    
    if (!res.ok) {
      const error = await res.json();
      console.error('[PayPal Create Order] Error:', error);
      throw new Error(error.message || 'Failed to create PayPal order');
    }
    
    const order = await res.json();
    const approvalUrl = order.links?.find((l: any) => l.rel === 'approve')?.href;
    
    if (!approvalUrl) {
      throw new Error('No approval URL in PayPal response');
    }
    
    console.log('[PayPal Create Order] Order created:', order.id);
    
    return NextResponse.json({
      orderId: order.id,
      approvalUrl,
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('[PayPal Create Order] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}
