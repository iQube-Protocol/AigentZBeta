/**
 * PayPal return handler — /api/billing/checkout/paypal-return
 *
 * PayPal redirects the buyer here after they approve the payment on
 * PayPal's hosted approval page. Query params carry `token` (the PayPal
 * orderId) and `tierKey` (packed into the `custom_id` of the order at
 * creation time via a redirect state cookie).
 *
 * Flow:
 *   1. Read `token` (PayPal orderId) from query string
 *   2. Read `tierKey` from the `plan_billing_pending` session cookie set
 *      by the POST /api/billing/checkout step-1 response handler
 *   3. POST to /api/billing/checkout with { tierKey, rail:'paypal', paypalOrderId }
 *      — re-uses the capture + plan-upsert + receipt logic already there
 *   4. Redirect to /billing/upgrade?paypal=success or ?paypal=error
 *
 * The `plan_billing_pending` cookie carries { tierKey } and is set by the
 * client after receiving the step-1 redirect response. Server-side setting
 * is not feasible because the POST response is consumed by the browser
 * before the PayPal redirect — the cookie must be set in client JS after
 * receiving `approvalUrl`.
 *
 * T0 safety: personaId is resolved server-side inside the checkout POST;
 * this handler never touches T0 identifiers directly.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VALID_TIER_KEYS = new Set([
  'sovereign_citizen',
  'steward',
  'venture_lite',
  'venture_pro',
  'venture_elite',
]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get('token'); // PayPal orderId
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/billing/upgrade?paypal=error&reason=missing_token`);
  }

  // Read tierKey from the short-lived session cookie written by the client
  // after receiving the step-1 approvalUrl.
  const pendingCookie = req.cookies.get('plan_billing_pending')?.value;
  let tierKey: string | null = null;
  if (pendingCookie) {
    try {
      const parsed = JSON.parse(pendingCookie) as { tierKey?: string };
      tierKey = parsed.tierKey ?? null;
    } catch {
      // malformed cookie — fall through to error redirect
    }
  }

  if (!tierKey || !VALID_TIER_KEYS.has(tierKey)) {
    return NextResponse.redirect(
      `${baseUrl}/billing/upgrade?paypal=error&reason=missing_tier`,
    );
  }

  // Delegate capture + plan upsert + receipt to the checkout POST handler.
  // We call it internally via fetch so the existing auth + debit logic
  // runs once rather than being duplicated here.
  try {
    const checkoutRes = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies so the checkout route can resolve the persona.
        Cookie: req.headers.get('cookie') ?? '',
        Authorization: req.headers.get('authorization') ?? '',
      },
      body: JSON.stringify({ tierKey, rail: 'paypal', paypalOrderId: token }),
    });

    const data = (await checkoutRes.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      const reason = encodeURIComponent(data.error ?? 'capture_failed');
      return NextResponse.redirect(`${baseUrl}/billing/upgrade?paypal=error&reason=${reason}`);
    }
  } catch (e) {
    const reason = encodeURIComponent(e instanceof Error ? e.message : 'unexpected');
    return NextResponse.redirect(`${baseUrl}/billing/upgrade?paypal=error&reason=${reason}`);
  }

  // Clear the pending cookie and redirect to the success surface.
  const res = NextResponse.redirect(`${baseUrl}/billing/upgrade?paypal=success&tier=${tierKey}`);
  res.cookies.set('plan_billing_pending', '', { maxAge: 0, path: '/' });
  return res;
}
