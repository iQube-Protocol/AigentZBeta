/**
 * PayPal return handler — /api/billing/checkout/paypal-return
 *
 * PayPal redirects the buyer's popup here after they approve (or cancel) the
 * plan payment. Flow:
 *   1. Read `token` (PayPal orderId) from the query string.
 *   2. Resolve the T0-safe checkout session by that order id → recover
 *      personaId + tierKey (personaId never travelled to PayPal).
 *   3. Capture the order, upsert persona_plans, write the plan_purchased
 *      receipt, mark the session captured.
 *   4. Return a tiny HTML page that postMessages the result to the opener
 *      and closes the popup (matching the canonical purchase-return pattern).
 *
 * T0 safety: personaId is recovered from the server-side session row, not
 * from any PayPal-bound field. It never appears in the page output either.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveCheckoutSessionByOrderId,
  capturePayPalPlanOrder,
  applyPlanPurchase,
  markCheckoutSession,
  priceTierRails,
  getPlanPricingKnobs,
  tierLabel,
} from '@/services/billing/planCheckout';

export const dynamic = 'force-dynamic';

/** Render a popup-closing page that messages the opener, with a redirect fallback. */
function popupResponse(
  message: { type: string; [k: string]: unknown },
  fallbackPath: string,
): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const json = JSON.stringify(message);
  return new NextResponse(
    `<!doctype html><html><body><script>
      (function () {
        try {
          if (window.opener) {
            window.opener.postMessage(${json}, '*');
            window.close();
            return;
          }
        } catch (e) {}
        window.location.href = ${JSON.stringify(baseUrl + fallbackPath)};
      })();
    </script></body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Cancel path — PayPal sent the buyer back without approving.
  if (searchParams.get('cancelled') === '1') {
    return popupResponse(
      { type: 'plan-paypal-cancelled' },
      '/?paypal=cancelled',
    );
  }

  const orderId = searchParams.get('token');
  if (!orderId) {
    return popupResponse(
      { type: 'plan-paypal-error', error: 'missing_token' },
      '/?paypal=error&reason=missing_token',
    );
  }

  // Recover the T0-safe session (personaId + tier) by the PayPal order id.
  const session = await resolveCheckoutSessionByOrderId(orderId);
  if (!session) {
    return popupResponse(
      { type: 'plan-paypal-error', error: 'session_not_found' },
      '/?paypal=error&reason=session_not_found',
    );
  }

  // Idempotent: a previously-captured session is treated as success.
  if (session.status === 'captured') {
    return popupResponse(
      { type: 'plan-paypal-success', tierKey: session.tierKey, label: tierLabel(session.tierKey) },
      '/?paypal=success',
    );
  }

  try {
    await capturePayPalPlanOrder(orderId);
  } catch (e) {
    await markCheckoutSession(session.checkoutId, 'failed');
    return popupResponse(
      { type: 'plan-paypal-error', error: e instanceof Error ? e.message : 'capture_failed' },
      '/?paypal=error&reason=capture_failed',
    );
  }

  // Receipt reflects the premium-inclusive amount actually charged by PayPal.
  const usd = priceTierRails(session.cents, await getPlanPricingKnobs()).paypalUsd.toFixed(2);
  await applyPlanPurchase({
    personaId: session.personaId,
    tierKey: session.tierKey,
    source: 'paypal',
    receiptSummary: `Plan upgraded to ${tierLabel(session.tierKey)} via PayPal ($${usd}, ref: ${session.checkoutId})`,
    toolsUsed: ['billing-checkout', 'paypal'],
  });
  await markCheckoutSession(session.checkoutId, 'captured');

  return popupResponse(
    { type: 'plan-paypal-success', tierKey: session.tierKey, label: tierLabel(session.tierKey) },
    '/?paypal=success',
  );
}
