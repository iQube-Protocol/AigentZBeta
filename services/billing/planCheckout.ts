/**
 * planCheckout — shared plan-subscription checkout logic.
 *
 * Lives in services/ (not the route file) so both the checkout route and the
 * PayPal return handler can import it. Next.js route files may only export
 * route handlers + config, so shared helpers must live here.
 *
 * Covers:
 *   - Tier configuration (tierKey → plan columns + label)
 *   - PayPal order create / capture (plan-specific)
 *   - T0-safe checkout sessions (plan_checkout_sessions): personaId is
 *     recovered on PayPal return by checkout_id, never sent to PayPal
 *   - persona_plans upsert + plan_purchased receipt
 *
 * Accepted rails: Q¢ · USDC (stub) · PayPal. KNYT is excluded from plan
 * payments — it stays in-cartridge only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  getPhase1PricingKnobs,
  quoteFromUsdBase,
  type PricingKnobs,
} from '@/services/wallet/knyt/knytSkuQuoteService';

// ── Tier configuration ────────────────────────────────────────────────────────

export const TIER_CONFIG = {
  sovereign_citizen: {
    label: 'Tier 1 — Sovereignty',
    planColumns: { plan_tier: 'sovereign_citizen' } as Record<string, string>,
  },
  steward: {
    label: 'Tier 2 — Stewardship',
    planColumns: { plan_tier: 'steward', standing_tier: 'professional' } as Record<string, string>,
  },
  venture_lite: {
    label: 'Founder Office Operator',
    planColumns: { venture_tier: 'lite', standing_tier: 'professional' } as Record<string, string>,
  },
  venture_pro: {
    label: 'Operator Plus',
    planColumns: { venture_tier: 'pro', standing_tier: 'professional' } as Record<string, string>,
  },
  venture_elite: {
    label: 'Portfolio Operator',
    planColumns: { venture_tier: 'elite', standing_tier: 'professional' } as Record<string, string>,
  },
} as const;

export type TierKey = keyof typeof TIER_CONFIG;
export type CheckoutRail = 'qc' | 'usdc' | 'paypal';

const VALID_TIER_KEYS = new Set(Object.keys(TIER_CONFIG));

export function isValidTierKey(tierKey: string): tierKey is TierKey {
  return VALID_TIER_KEYS.has(tierKey);
}

export function listTierKeys(): TierKey[] {
  return Object.keys(TIER_CONFIG) as TierKey[];
}

export function tierLabel(tierKey: TierKey): string {
  return TIER_CONFIG[tierKey].label;
}

/**
 * Reverse of TIER_CONFIG: given a persona_plans row, recover the priced
 * tier_key (or null for a free plan with no renewal). Founder Office tiers
 * (venture_tier) take precedence over the citizen ladder.
 */
export function tierKeyForPlanRow(row: { plan_tier?: string | null; venture_tier?: string | null }): TierKey | null {
  switch (row.venture_tier) {
    case 'elite':
      return 'venture_elite';
    case 'pro':
      return 'venture_pro';
    case 'lite':
      return 'venture_lite';
  }
  if (row.plan_tier === 'steward') return 'steward';
  if (row.plan_tier === 'sovereign_citizen') return 'sovereign_citizen';
  return null; // free citizen — nothing to renew
}

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

export async function createPayPalPlanOrder(tierKey: TierKey, usdAmount: number, checkoutId: string) {
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
          // T0 safety: only the random checkoutId travels to PayPal — never
          // personaId. The return handler recovers personaId from the
          // plan_checkout_sessions row keyed by this id.
          custom_id: checkoutId.slice(0, 127),
        },
      ],
      application_context: {
        brand_name: 'Polity Alpha',
        user_action: 'PAY_NOW',
        return_url: `${baseUrl}/api/billing/checkout/paypal-return`,
        cancel_url: `${baseUrl}/api/billing/checkout/paypal-return?cancelled=1`,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`PayPal order create failed: ${JSON.stringify(err)}`);
  }
  const order = (await res.json()) as { id: string; links: Array<{ rel: string; href: string }> };
  const approvalUrl = order.links.find((l) => l.rel === 'approve')?.href ?? null;
  return { orderId: order.id, approvalUrl };
}

export async function capturePayPalPlanOrder(orderId: string): Promise<true> {
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

// ── Checkout sessions (T0-safe PayPal handoff) ────────────────────────────────

export interface PlanCheckoutSession {
  checkoutId: string;
  personaId: string;
  tierKey: TierKey;
  cents: number;
  status: string;
}

/**
 * Persist a pending checkout so the PayPal return handler can recover the
 * buyer's personaId by checkout_id without personaId ever reaching PayPal.
 */
export async function createCheckoutSession(args: {
  checkoutId: string;
  personaId: string;
  tierKey: TierKey;
  rail: CheckoutRail;
  cents: number;
  paypalOrderId?: string | null;
}): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) throw new Error('Database unavailable');
  const { error } = await admin.from('plan_checkout_sessions').insert({
    checkout_id: args.checkoutId,
    persona_id: args.personaId,
    tier_key: args.tierKey,
    rail: args.rail,
    price_usd_cents: args.cents,
    paypal_order_id: args.paypalOrderId ?? null,
    status: 'pending',
  });
  if (error) throw new Error(`Checkout session insert failed: ${error.message}`);
}

/** Resolve a pending session by PayPal order id (used by the return handler). */
export async function resolveCheckoutSessionByOrderId(
  paypalOrderId: string,
): Promise<PlanCheckoutSession | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data } = await admin
    .from('plan_checkout_sessions')
    .select('checkout_id, persona_id, tier_key, price_usd_cents, status')
    .eq('paypal_order_id', paypalOrderId)
    .maybeSingle();
  if (!data) return null;
  return {
    checkoutId: data.checkout_id as string,
    personaId: data.persona_id as string,
    tierKey: data.tier_key as TierKey,
    cents: data.price_usd_cents as number,
    status: data.status as string,
  };
}

/** Mark a session terminal so a double-capture is a no-op. */
export async function markCheckoutSession(
  checkoutId: string,
  status: 'captured' | 'failed' | 'cancelled',
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) return;
  await admin
    .from('plan_checkout_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('checkout_id', checkoutId);
}

// ── Plan upsert + receipt ─────────────────────────────────────────────────────

/**
 * Upsert the persona_plans row to the purchased tier and set a 30-day period.
 * For alpha there's no Stripe; renewal is a wallet-debit cron (Step 6).
 */
export async function upsertPersonaPlan(
  personaId: string,
  tierKey: TierKey,
  source: 'checkout' | 'paypal',
): Promise<void> {
  const admin = getSupabaseServer();
  if (!admin) throw new Error('Database unavailable');

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const planColumns = TIER_CONFIG[tierKey].planColumns;

  const { data: existing } = await admin
    .from('persona_plans')
    .select('id')
    .eq('persona_id', personaId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from('persona_plans')
      .update({
        ...planColumns,
        status: 'active',
        source,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
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

/** Upsert the plan AND write the DVN-anchorable plan_purchased receipt. */
export async function applyPlanPurchase(args: {
  personaId: string;
  tierKey: TierKey;
  source: 'checkout' | 'paypal';
  receiptSummary: string;
  toolsUsed: string[];
}): Promise<void> {
  await upsertPersonaPlan(args.personaId, args.tierKey, args.source);
  try {
    await createActivityReceipt({
      personaId: args.personaId,
      activeCartridge: 'metame',
      actionType: 'plan_purchased',
      summary: args.receiptSummary,
      toolsUsed: args.toolsUsed,
    });
  } catch (e) {
    console.error('[planCheckout] receipt creation failed (non-fatal):', e);
  }
}

// ── Price lookup ──────────────────────────────────────────────────────────────

export interface PriceRow {
  cents: number;
  active: boolean;
}

export async function getTierPrice(tierKey: TierKey): Promise<PriceRow | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data, error } = await admin
    .from('plan_price_config')
    .select('price_usd_cents, active')
    .eq('tier_key', tierKey)
    .maybeSingle();
  if (error || !data) return null;
  return { cents: data.price_usd_cents as number, active: data.active as boolean };
}

// ── Per-rail pricing — mirrors the KNYT cartridge premium model ────────────────
//
// quoteFromUsdBase (services/wallet/knyt/knytSkuQuoteService) is the canonical
// premium engine. Applied to a plan's BASE price (plan_price_config):
//   Q¢     → base × 100, no premium (house currency, best rate)
//   USDC   → base × (1 + usdcFee + fiatPremium)  = base + 8% (default knobs)
//   PayPal → base × (1 + paypalFee + fiatPremium) = base + 10% (default knobs)
// Premiums are env-tunable (USDC_FEE_PERCENT, PAYPAL_FEE_PERCENT, FIAT_PREMIUM_PERCENT).

export interface TierRailPricing {
  /** Base USD cents (no premium) — the plan_price_config value. */
  baseCents: number;
  /** Q¢ amount to debit (= base cents; no premium on the house currency). */
  qcAmount: number;
  /** PayPal charge in USD cents (base + fiat premium). */
  paypalCents: number;
  paypalUsd: number;
  /** USDC charge in USD cents (base + USDC premium) and 6-decimal micro-units. */
  usdcCents: number;
  usdcUsd: number;
  usdcMicroUnits: string;
}

const PREMIUM_KEYS = ['usdc_fee', 'paypal_fee', 'fiat_premium', 'qct_premium'] as const;
export type PremiumKey = (typeof PREMIUM_KEYS)[number];

export function listPremiumKeys(): PremiumKey[] {
  return [...PREMIUM_KEYS];
}

/**
 * Resolve the live pricing knobs. Admin-tunable premiums in plan_premium_config
 * (basis points) override the env/default knobs from getPhase1PricingKnobs.
 * Falls back to env defaults when the table is missing or a row is absent, so
 * a pending migration never breaks checkout.
 */
export async function getPlanPricingKnobs(): Promise<PricingKnobs> {
  const base = getPhase1PricingKnobs();
  const admin = getSupabaseServer();
  if (!admin) return base;
  try {
    const { data, error } = await admin.from('plan_premium_config').select('premium_key, value_bps');
    if (error || !data) return base;
    const bps: Record<string, number> = {};
    for (const row of data as Array<{ premium_key: string; value_bps: number }>) {
      bps[row.premium_key] = row.value_bps;
    }
    return {
      ...base,
      usdcFeePercent: bps.usdc_fee != null ? bps.usdc_fee / 10000 : base.usdcFeePercent,
      paypalFeePercent: bps.paypal_fee != null ? bps.paypal_fee / 10000 : base.paypalFeePercent,
      fiatPremiumPercent: bps.fiat_premium != null ? bps.fiat_premium / 10000 : base.fiatPremiumPercent,
      qctPremiumPercent: bps.qct_premium != null ? bps.qct_premium / 10000 : base.qctPremiumPercent,
    };
  } catch {
    return base;
  }
}

export function priceTierRails(baseCents: number, knobs?: PricingKnobs): TierRailPricing {
  const resolvedKnobs = knobs ?? getPhase1PricingKnobs();
  const usdBase = baseCents / 100;
  const q = quoteFromUsdBase(usdBase, resolvedKnobs);
  // qctBaseAmount already = base × 100 (qctPremiumPercent defaults to 0).
  const qcAmount = q.qctBaseAmount;
  const paypalCents = Math.round(q.paypalTotalUsd * 100);
  const usdcCents = Math.round(q.usdcTotalUsd * 100);
  // USDC has 6 decimals: micro-units = USD × 1_000_000.
  const usdcMicroUnits = (BigInt(usdcCents) * 10_000n).toString();
  return {
    baseCents,
    qcAmount,
    paypalCents,
    paypalUsd: q.paypalTotalUsd,
    usdcCents,
    usdcUsd: q.usdcTotalUsd,
    usdcMicroUnits,
  };
}

// ── USDC settlement (Base mainnet) ────────────────────────────────────────────
//
// The buyer sends USDC to the server-held treasury; the server verifies the
// on-chain transfer via the same facilitator path the Q¢-from-USDC route uses.
// The treasury + token addresses are read from server/public env — never
// hardcoded, never guessed. personaId is recovered from the checkout session.

const USDC_DEFAULT_CHAIN_ID = 8453; // Base mainnet

interface UsdcChainConfig {
  assetKey: string;
  tokenAddress: string | null;
}

function usdcConfigForChain(chainId: number): UsdcChainConfig | null {
  switch (chainId) {
    case 8453: // Base mainnet
      return { assetKey: 'BASE_USDC', tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE || null };
    case 84532: // Base Sepolia (dev/test)
      return { assetKey: 'BASE_USDC', tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA || null };
    default:
      return null;
  }
}

export interface UsdcPaymentIntent {
  chainId: number;
  /** USDC ERC-20 contract on the chosen chain. */
  tokenAddress: string;
  /** Treasury address the USDC must be sent to (server-authoritative). */
  payTo: string;
  /** 6-decimal micro-units the buyer must transfer (premium-inclusive). */
  amountUsdcMicroUnits: string;
  usdcUsd: number;
}

/**
 * Build the server-authoritative USDC payment intent for a tier. Returns an
 * error string when the chain/treasury/token env isn't configured.
 */
export function buildUsdcPaymentIntent(
  baseCents: number,
  knobs?: PricingKnobs,
  chainId: number = USDC_DEFAULT_CHAIN_ID,
): { ok: true; intent: UsdcPaymentIntent } | { ok: false; error: string } {
  const cfg = usdcConfigForChain(chainId);
  if (!cfg) return { ok: false, error: `Unsupported chainId ${chainId} for USDC` };
  if (!cfg.tokenAddress) return { ok: false, error: `USDC token address not configured for chainId ${chainId}` };
  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury) return { ok: false, error: 'TREASURY_ADDRESS not configured' };
  const pricing = priceTierRails(baseCents, knobs);
  return {
    ok: true,
    intent: {
      chainId,
      tokenAddress: cfg.tokenAddress,
      payTo: treasury,
      amountUsdcMicroUnits: pricing.usdcMicroUnits,
      usdcUsd: pricing.usdcUsd,
    },
  };
}

/**
 * Verify a USDC transfer to the treasury matches the expected amount, reusing
 * the generic ERC-20 facilitator verifier. `origin` is the request origin so
 * the server can call its own facilitator route.
 */
export async function verifyUsdcTransfer(args: {
  origin: string;
  txHash: string;
  chainId: number;
  amountUsdcMicroUnits: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = usdcConfigForChain(args.chainId);
  if (!cfg?.tokenAddress) return { ok: false, error: `USDC token not configured for chainId ${args.chainId}` };
  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury) return { ok: false, error: 'TREASURY_ADDRESS not configured' };
  try {
    const res = await fetch(`${args.origin}/api/a2a/facilitator/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        assetKey: cfg.assetKey,
        txHashOrId: args.txHash,
        chainId: args.chainId,
        tokenAddress: cfg.tokenAddress,
        payTo: treasury,
        amount: args.amountUsdcMicroUnits,
      }),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      return { ok: false, error: `USDC verification failed: ${json.error ?? `status ${res.status}`}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'USDC verification error' };
  }
}

/** Look up a session by checkout_id (used by the USDC two-step flow). */
export async function resolveCheckoutSessionById(checkoutId: string): Promise<PlanCheckoutSession | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data } = await admin
    .from('plan_checkout_sessions')
    .select('checkout_id, persona_id, tier_key, price_usd_cents, status')
    .eq('checkout_id', checkoutId)
    .maybeSingle();
  if (!data) return null;
  return {
    checkoutId: data.checkout_id as string,
    personaId: data.persona_id as string,
    tierKey: data.tier_key as TierKey,
    cents: data.price_usd_cents as number,
    status: data.status as string,
  };
}

/** Mark a session captured AND record the on-chain ref (idempotent on external_ref). */
export async function markCheckoutSessionSettled(
  checkoutId: string,
  externalRef: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Database unavailable' };
  const { error } = await admin
    .from('plan_checkout_sessions')
    .update({ status: 'captured', external_ref: externalRef, updated_at: new Date().toISOString() })
    .eq('checkout_id', checkoutId);
  // Unique-violation on external_ref ⇒ this tx already settled a purchase.
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'This transaction was already used to settle a plan purchase.' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
