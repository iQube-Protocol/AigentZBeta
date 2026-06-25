/**
 * Plan Subscription Checkout
 *
 * GET  /api/billing/checkout?tierKey=  — price quote (no side-effects)
 * POST /api/billing/checkout           — execute purchase
 *
 * Accepted rails: Q¢ · USDC (stub) · PayPal.
 * KNYT is explicitly excluded from plan payments — it stays in-cartridge only.
 *
 * ── Q¢ flow (synchronous) ────────────────────────────────────────────────────
 *   1. Load price from plan_price_config (USD cents = Q¢ since $1 = 100 Q¢)
 *   2. debitQc(personaId, amountQc, 'plan_subscription', checkoutId)
 *   3. applyPlanPurchase — upsert persona_plans + plan_purchased receipt
 *
 * ── PayPal flow (popup + postMessage) ────────────────────────────────────────
 *   Step 1 — POST { tierKey, rail:'paypal' } — no paypalOrderId:
 *     Create PayPal order → persist a T0-safe checkout session keyed by a
 *     random checkoutId → return { step:'redirect', approvalUrl, orderId }.
 *     The client opens approvalUrl in a popup; PayPal redirects the popup to
 *     /api/billing/checkout/paypal-return, which captures + applies + posts a
 *     message back to the opener. personaId never reaches PayPal.
 *
 * ── USDC ─────────────────────────────────────────────────────────────────────
 *   Stub → 501 Not Implemented (post-alpha).
 *
 * T0 safety: personaId never leaves the server; receipts use cohortAliasCommitment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { debitQc } from '@/app/api/community-content/_lib/generate';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  type TierKey,
  isValidTierKey,
  listTierKeys,
  tierLabel,
  getTierPrice,
  priceTierRails,
  getPlanPricingKnobs,
  createPayPalPlanOrder,
  createCheckoutSession,
  applyPlanPurchase,
  buildUsdcPaymentIntent,
  verifyUsdcTransfer,
  resolveCheckoutSessionById,
  markCheckoutSessionSettled,
} from '@/services/billing/planCheckout';

export const dynamic = 'force-dynamic';

function newCheckoutId(): string {
  return `billing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── GET — price quote ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tierKey = req.nextUrl.searchParams.get('tierKey') ?? '';
  if (!isValidTierKey(tierKey)) {
    return NextResponse.json(
      { ok: false, error: `Unknown tierKey: "${tierKey}". Valid keys: ${listTierKeys().join(', ')}` },
      { status: 400 },
    );
  }

  const price = await getTierPrice(tierKey);
  if (!price) {
    return NextResponse.json({ ok: false, error: 'Price not configured for this tier' }, { status: 404 });
  }
  if (!price.active) {
    return NextResponse.json({ ok: false, error: 'This tier is not currently available for purchase' }, { status: 403 });
  }

  const cents = price.cents;
  const rails = priceTierRails(cents, await getPlanPricingKnobs());

  return NextResponse.json({
    ok: true,
    tierKey,
    label: tierLabel(tierKey),
    // Base price (no premium). The Q¢ rail charges exactly this.
    priceUsdCents: cents,
    rails: {
      // Q¢: house currency, no premium. $1 = 100 Q¢ ⇒ qcAmount = base cents.
      qc: { priceCents: rails.qcAmount, currency: 'QC', note: `${rails.qcAmount} Q¢` },
      // USDC: base + ~8% (USDC fee + fiat premium), live on Base mainnet.
      usdc: {
        priceUsd: rails.usdcUsd,
        priceCents: rails.usdcCents,
        currency: 'USDC',
        note: `$${rails.usdcUsd.toFixed(2)} USDC (incl. premium)`,
      },
      // PayPal: base + ~10% (PayPal fee + fiat premium).
      paypal: {
        priceUsd: rails.paypalUsd,
        priceCents: rails.paypalCents,
        currency: 'USD',
        note: `$${rails.paypalUsd.toFixed(2)} USD via PayPal (incl. premium)`,
      },
    },
  });
}

// ── POST — execute checkout ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { tierKey, rail, txHash, chainId, checkoutId: bodyCheckoutId } = body as {
    tierKey?: string;
    rail?: string;
    txHash?: string;
    chainId?: number;
    checkoutId?: string;
  };

  if (!tierKey || !isValidTierKey(tierKey)) {
    return NextResponse.json(
      { ok: false, error: `tierKey must be one of: ${listTierKeys().join(', ')}` },
      { status: 400 },
    );
  }

  if (!rail || !['qc', 'usdc', 'paypal'].includes(rail)) {
    return NextResponse.json(
      { ok: false, error: 'rail must be "qc", "usdc", or "paypal". KNYT is not accepted for plan payments.' },
      { status: 400 },
    );
  }

  const price = await getTierPrice(tierKey);
  if (!price) {
    return NextResponse.json({ ok: false, error: 'Price not configured for this tier' }, { status: 404 });
  }
  if (!price.active) {
    return NextResponse.json({ ok: false, error: 'This tier is not currently available for purchase' }, { status: 403 });
  }

  const cents = price.cents;
  const key = tierKey as TierKey;

  // ── USDC rail (two-step, on-chain settlement on Base) ─────────────────────
  if (rail === 'usdc') {
    // Step 2 — verify the on-chain transfer and apply the plan.
    if (txHash && typeof txHash === 'string' && txHash.trim()) {
      if (!bodyCheckoutId) {
        return NextResponse.json({ ok: false, error: 'checkoutId required to settle USDC' }, { status: 400 });
      }
      const session = await resolveCheckoutSessionById(bodyCheckoutId);
      if (!session || session.personaId !== persona.personaId) {
        return NextResponse.json({ ok: false, error: 'Checkout session not found' }, { status: 404 });
      }
      if (session.status === 'captured') {
        return NextResponse.json({ ok: true, step: 'complete', tierKey, label: tierLabel(key), rail: 'usdc', checkoutId: bodyCheckoutId });
      }
      const resolvedChain = typeof chainId === 'number' ? chainId : 8453;
      const rails = priceTierRails(session.cents, await getPlanPricingKnobs());
      const verified = await verifyUsdcTransfer({
        origin: req.nextUrl.origin,
        txHash: txHash.trim(),
        chainId: resolvedChain,
        amountUsdcMicroUnits: rails.usdcMicroUnits,
      });
      if (!verified.ok) {
        return NextResponse.json({ ok: false, error: verified.error ?? 'USDC verification failed' }, { status: 402 });
      }
      // Record the on-chain ref idempotently (unique index blocks tx reuse).
      const settled = await markCheckoutSessionSettled(bodyCheckoutId, `usdc::${txHash.trim()}`);
      if (!settled.ok) {
        return NextResponse.json({ ok: false, error: settled.error ?? 'Settlement failed' }, { status: 409 });
      }
      await applyPlanPurchase({
        personaId: persona.personaId,
        tierKey: key,
        source: 'checkout',
        receiptSummary: `Plan upgraded to ${tierLabel(key)} via USDC ($${rails.usdcUsd.toFixed(2)}, tx: ${txHash.trim().slice(0, 18)}…)`,
        toolsUsed: ['billing-checkout', 'usdc'],
      });
      return NextResponse.json({ ok: true, step: 'complete', tierKey, label: tierLabel(key), rail: 'usdc', checkoutId: bodyCheckoutId });
    }

    // Step 1 — build the server-authoritative USDC payment intent.
    const resolvedChain = typeof chainId === 'number' ? chainId : 8453;
    const intentResult = buildUsdcPaymentIntent(cents, await getPlanPricingKnobs(), resolvedChain);
    if (!intentResult.ok) {
      return NextResponse.json({ ok: false, error: intentResult.error }, { status: 500 });
    }
    const checkoutId = newCheckoutId();
    await createCheckoutSession({
      checkoutId,
      personaId: persona.personaId,
      tierKey: key,
      rail: 'usdc',
      cents,
    });
    return NextResponse.json({
      ok: true,
      step: 'usdc_pay',
      tierKey,
      label: tierLabel(key),
      rail: 'usdc',
      checkoutId,
      usdc: intentResult.intent,
    });
  }

  const checkoutId = newCheckoutId();

  // ── Q¢ rail ──────────────────────────────────────────────────────────────
  if (rail === 'qc') {
    // $1 = 100 Q¢ = 100 cents → price_usd_cents Q¢ directly
    const qcAmount = cents;
    const admin = getSupabaseServer();
    if (!admin) return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });

    const debitResult = await debitQc(admin, persona.personaId, qcAmount, 'plan_subscription', checkoutId, 'dvn');
    if (!debitResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: debitResult.error,
          needsBuyQc: debitResult.needsBuyQc ?? false,
          ...(debitResult.payment ? { payment: debitResult.payment } : {}),
        },
        { status: (debitResult as { status?: number }).status ?? 402 },
      );
    }

    await applyPlanPurchase({
      personaId: persona.personaId,
      tierKey: key,
      source: 'checkout',
      receiptSummary: `Plan upgraded to ${tierLabel(key)} via Q¢ (${qcAmount} Q¢, ref: ${checkoutId})`,
      toolsUsed: ['billing-checkout'],
    });

    return NextResponse.json({
      ok: true,
      step: 'complete',
      tierKey,
      label: tierLabel(key),
      rail: 'qc',
      qcDebited: qcAmount,
      checkoutId,
    });
  }

  // ── PayPal rail — create order + T0-safe session (capture on return) ───────
  if (rail === 'paypal') {
    // PayPal charges the premium-inclusive amount (base + ~10%).
    const usd = priceTierRails(cents, await getPlanPricingKnobs()).paypalUsd;
    try {
      const { orderId, approvalUrl } = await createPayPalPlanOrder(key, usd, checkoutId);
      // Persist personaId server-side keyed by checkoutId; tag with the
      // PayPal order id so the return handler can recover it. personaId
      // never travels to PayPal (only checkoutId rides in custom_id).
      await createCheckoutSession({
        checkoutId,
        personaId: persona.personaId,
        tierKey: key,
        rail: 'paypal',
        cents,
        paypalOrderId: orderId,
      });
      return NextResponse.json({
        ok: true,
        step: 'redirect',
        tierKey,
        label: tierLabel(key),
        rail: 'paypal',
        orderId,
        approvalUrl,
        priceUsd: usd,
        checkoutId,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : 'PayPal order creation failed' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: false, error: 'Unexpected rail' }, { status: 400 });
}
