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
 *   3. Upsert persona_plans with new tier columns + current_period_end (+30 days)
 *   4. createActivityReceipt('plan_purchased')
 *
 * ── PayPal flow (two-step) ───────────────────────────────────────────────────
 *   Step 1 — POST { tierKey, rail:'paypal' } — no paypalOrderId:
 *     Create PayPal order → return { step:'redirect', approvalUrl, orderId }
 *   Step 2 — POST { tierKey, rail:'paypal', paypalOrderId } — on return:
 *     Capture PayPal order → upsert plan → createActivityReceipt('plan_purchased')
 *
 * ── USDC ─────────────────────────────────────────────────────────────────────
 *   Stub → 501 Not Implemented (post-alpha).
 *
 * T0 safety: personaId never leaves the server; receipts use cohortAliasCommitment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { debitQc } from '@/app/api/community-content/_lib/generate';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

// ── Tier configuration ────────────────────────────────────────────────────────

const TIER_CONFIG = {
  sovereign_citizen: {
    label: 'Tier 1 — Sovereignty',
    planColumns: { plan_tier: 'sovereign_citizen' },
  },
  steward: {
    label: 'Tier 2 — Stewardship',
    planColumns: { plan_tier: 'steward', standing_tier: 'professional' },
  },
  venture_lite: {
    label: 'Founder Office Operator',
    planColumns: { venture_tier: 'lite', standing_tier: 'professional' },
  },
  venture_pro: {
    label: 'Operator Plus',
    planColumns: { venture_tier: 'pro', standing_tier: 'professional' },
  },
  venture_elite: {
    label: 'Portfolio Operator',
    planColumns: { venture_tier: 'elite', standing_tier: 'professional' },
  },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

const VALID_TIER_KEYS = new Set(Object.keys(TIER_CONFIG));

// ── PayPal helpers (plan-specific) ───────────────────────────────────────────

const PAYPAL_API =
  process.env.PAYPAL_MODE === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

let _ppToken: { token: string; expiresAt: number } | null = null;

async function getPayPalAccessToken(): Promise<string> {
  if (_ppToken && Date.now() < _ppToken.expiresAt) return _ppToken.token;
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('PayPal credentials not configured');
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  _ppToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return _ppToken.token;
}

async function createPayPalPlanOrder(tierKey: TierKey, usdAmount: number, checkoutId: string) {
  const token = await getPayPalAccessToken();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: usdAmount.toFixed(2) },
          description: TIER_CONFIG[tierKey].label,
          custom_id: checkoutId.slice(0, 127),
        },
      ],
      application_context: {
        brand_name: 'Polity Alpha',
        user_action: 'PAY_NOW',
        return_url: `${baseUrl}/api/billing/checkout/paypal-return`,
        cancel_url: `${baseUrl}/billing/upgrade?paypal=cancelled`,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`PayPal order create failed: ${JSON.stringify(err)}`);
  }
  const order = (await res.json()) as {
    id: string;
    links: Array<{ rel: string; href: string }>;
  };
  const approvalUrl = order.links.find((l) => l.rel === 'approve')?.href ?? null;
  return { orderId: order.id, approvalUrl };
}

async function capturePayPalPlanOrder(orderId: string) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = (await res.json()) as { status?: string; name?: string };
  if (data.status !== 'COMPLETED' && data.name !== 'ORDER_ALREADY_CAPTURED') {
    throw new Error(`PayPal capture failed: ${JSON.stringify(data)}`);
  }
  return true;
}

// ── Plan upsert ───────────────────────────────────────────────────────────────

async function upsertPersonaPlan(
  personaId: string,
  tierKey: TierKey,
  source: 'checkout' | 'paypal',
) {
  const admin = getSupabaseServer();
  if (!admin) throw new Error('Database unavailable');

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const planColumns = TIER_CONFIG[tierKey].planColumns;

  // Check if a plan row exists
  const { data: existing } = await admin
    .from('persona_plans')
    .select('id')
    .eq('persona_id', personaId)
    .maybeSingle();

  const updatePayload = {
    ...planColumns,
    status: 'active',
    source,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await admin
      .from('persona_plans')
      .update(updatePayload)
      .eq('persona_id', personaId);
    if (error) throw new Error(`Plan update failed: ${error.message}`);
  } else {
    const { error } = await admin.from('persona_plans').insert({
      persona_id: personaId,
      plan_tier: 'citizen',
      venture_tier: 'none',
      standing_tier: 'standing',
      status: 'active',
      source,
      current_period_end: periodEnd,
      ...planColumns,
    });
    if (error) throw new Error(`Plan insert failed: ${error.message}`);
  }
}

// ── GET — price quote ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tierKey = req.nextUrl.searchParams.get('tierKey') ?? '';
  if (!VALID_TIER_KEYS.has(tierKey)) {
    return NextResponse.json(
      { ok: false, error: `Unknown tierKey: "${tierKey}". Valid keys: ${[...VALID_TIER_KEYS].join(', ')}` },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await admin
    .from('plan_price_config')
    .select('price_usd_cents, active')
    .eq('tier_key', tierKey)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Price not configured for this tier' }, { status: 404 });
  }
  if (!data.active) {
    return NextResponse.json({ ok: false, error: 'This tier is not currently available for purchase' }, { status: 403 });
  }

  const cents = data.price_usd_cents as number;
  const usd = cents / 100;

  return NextResponse.json({
    ok: true,
    tierKey,
    label: TIER_CONFIG[tierKey as TierKey].label,
    priceUsdCents: cents,
    rails: {
      // Q¢: $1 = 100 Q¢, so price_usd_cents Q¢ = price_usd_cents cents
      qc: { priceCents: cents, currency: 'QC', note: `${cents} Q¢` },
      // USDC: USD amount (stub for alpha)
      usdc: { priceUsd: usd, currency: 'USDC', note: 'Coming soon' },
      // PayPal: USD amount
      paypal: { priceUsd: usd, currency: 'USD', note: `$${usd.toFixed(2)} USD via PayPal` },
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
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { tierKey, rail, paypalOrderId } = body as {
    tierKey?: string;
    rail?: string;
    paypalOrderId?: string;
  };

  if (!tierKey || !VALID_TIER_KEYS.has(tierKey)) {
    return NextResponse.json(
      { ok: false, error: `tierKey must be one of: ${[...VALID_TIER_KEYS].join(', ')}` },
      { status: 400 },
    );
  }

  if (!rail || !['qc', 'usdc', 'paypal'].includes(rail)) {
    return NextResponse.json(
      { ok: false, error: 'rail must be "qc", "usdc", or "paypal". KNYT is not accepted for plan payments.' },
      { status: 400 },
    );
  }

  // USDC — stub for alpha
  if (rail === 'usdc') {
    return NextResponse.json(
      { ok: false, error: 'USDC payments for plan subscriptions are not yet available. Please use Q¢ or PayPal.' },
      { status: 501 },
    );
  }

  // Load price
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });

  const { data: priceRow, error: priceErr } = await admin
    .from('plan_price_config')
    .select('price_usd_cents, active')
    .eq('tier_key', tierKey)
    .maybeSingle();

  if (priceErr || !priceRow) {
    return NextResponse.json({ ok: false, error: 'Price not configured for this tier' }, { status: 404 });
  }
  if (!priceRow.active) {
    return NextResponse.json({ ok: false, error: 'This tier is not currently available for purchase' }, { status: 403 });
  }

  const cents = priceRow.price_usd_cents as number;
  const checkoutId = `billing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = tierKey as TierKey;

  // ── Q¢ rail ──────────────────────────────────────────────────────────────
  if (rail === 'qc') {
    // $1 = 100 Q¢ = 100 cents → price_usd_cents Q¢ directly
    const qcAmount = cents;

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

    await upsertPersonaPlan(persona.personaId, key, 'checkout');

    // DVN receipt (best-effort — don't let receipt failure roll back the purchase)
    try {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'metame',
        actionType: 'plan_purchased',
        summary: `Plan upgraded to ${TIER_CONFIG[key].label} via Q¢ (${qcAmount} Q¢, ref: ${checkoutId})`,
        toolsUsed: ['billing-checkout'],
      });
    } catch (e) {
      console.error('[billing/checkout] receipt creation failed (non-fatal):', e);
    }

    return NextResponse.json({
      ok: true,
      step: 'complete',
      tierKey,
      label: TIER_CONFIG[key].label,
      rail: 'qc',
      qcDebited: qcAmount,
      checkoutId,
    });
  }

  // ── PayPal rail ───────────────────────────────────────────────────────────
  if (rail === 'paypal') {
    const usd = cents / 100;

    // Step 2 — capture an existing order
    if (paypalOrderId && typeof paypalOrderId === 'string' && paypalOrderId.trim()) {
      try {
        await capturePayPalPlanOrder(paypalOrderId.trim());
      } catch (e) {
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : 'PayPal capture failed' },
          { status: 402 },
        );
      }

      await upsertPersonaPlan(persona.personaId, key, 'paypal');

      try {
        await createActivityReceipt({
          personaId: persona.personaId,
          activeCartridge: 'metame',
          actionType: 'plan_purchased',
          summary: `Plan upgraded to ${TIER_CONFIG[key].label} via PayPal ($${usd.toFixed(2)}, orderId: ${paypalOrderId})`,
          toolsUsed: ['billing-checkout', 'paypal'],
        });
      } catch (e) {
        console.error('[billing/checkout] receipt creation failed (non-fatal):', e);
      }

      return NextResponse.json({
        ok: true,
        step: 'complete',
        tierKey,
        label: TIER_CONFIG[key].label,
        rail: 'paypal',
        paypalOrderId,
        checkoutId,
      });
    }

    // Step 1 — create the PayPal order
    try {
      const { orderId, approvalUrl } = await createPayPalPlanOrder(key, usd, checkoutId);
      return NextResponse.json({
        ok: true,
        step: 'redirect',
        tierKey,
        label: TIER_CONFIG[key].label,
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
