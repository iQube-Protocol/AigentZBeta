/**
 * Admin API — Plan Price Config + Payment Premiums
 *
 * GET  /api/admin/billing/price-config   — all tier prices (USD cents) + premiums (bps)
 * PATCH /api/admin/billing/price-config  — update price for one tier
 *                                          (or { premium_key, value_bps } to update a premium)
 *
 * Requires global admin or metaMe cartridge admin.
 * Prices are stored in USD cents (integer). $29.00 → 2900.
 * Premiums are stored in basis points (integer). 1.00% → 100.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';

const VALID_TIER_KEYS = [
  'sovereign_citizen',
  'steward',
  'venture_lite',
  'venture_pro',
  'venture_elite',
] as const;
type TierKey = (typeof VALID_TIER_KEYS)[number];

const VALID_PREMIUM_KEYS = ['usdc_fee', 'paypal_fee', 'fiat_premium', 'qct_premium'] as const;
type PremiumKey = (typeof VALID_PREMIUM_KEYS)[number];

export async function GET(req: NextRequest) {
  const gate = await requireCartridgeAdmin(req, 'metame');
  if (gate instanceof NextResponse) return gate;

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase unavailable' }, { status: 500 });

  const [pricesRes, premiumsRes] = await Promise.all([
    supabase
      .from('plan_price_config')
      .select('tier_key, price_usd_cents, active, description, updated_by, updated_at')
      .order('tier_key'),
    supabase
      .from('plan_premium_config')
      .select('premium_key, value_bps, description, updated_by, updated_at')
      .order('premium_key'),
  ]);

  if (pricesRes.error) return NextResponse.json({ ok: false, error: pricesRes.error.message }, { status: 500 });
  // Premiums are best-effort: a pending migration shouldn't break the prices view.
  return NextResponse.json({
    ok: true,
    prices: pricesRes.data ?? [],
    premiums: premiumsRes.error ? [] : (premiumsRes.data ?? []),
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireCartridgeAdmin(req, 'metame');
  if (gate instanceof NextResponse) return gate;

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase unavailable' }, { status: 500 });

  const persona = (gate as { displayLabel?: string } | null);

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const updatedBy = persona && typeof persona === 'object' && 'displayLabel' in persona ? String(persona.displayLabel ?? '') : null;

  const rows = Array.isArray(body) ? body : [body];

  // Premium update branch — { premium_key, value_bps }. Detected by premium_key.
  if ((rows as Array<Record<string, unknown>>).some((r) => 'premium_key' in r)) {
    for (const row of rows as Array<Record<string, unknown>>) {
      if (!row.premium_key || typeof row.premium_key !== 'string' || !VALID_PREMIUM_KEYS.includes(row.premium_key as PremiumKey)) {
        return NextResponse.json({ ok: false, error: `premium_key must be one of: ${VALID_PREMIUM_KEYS.join(', ')}` }, { status: 400 });
      }
      const bps = typeof row.value_bps === 'number' ? row.value_bps : parseInt(String(row.value_bps ?? ''), 10);
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
        return NextResponse.json({ ok: false, error: 'value_bps must be an integer between 0 and 10000' }, { status: 400 });
      }
    }
    const premiumRows = (rows as Array<Record<string, unknown>>).map((r) => ({
      premium_key: r.premium_key as string,
      value_bps: typeof r.value_bps === 'number' ? r.value_bps : parseInt(String(r.value_bps ?? ''), 10),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('plan_premium_config').upsert(premiumRows, { onConflict: 'premium_key' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: premiumRows.length, kind: 'premium' });
  }

  for (const row of rows as Array<Record<string, unknown>>) {
    if (!row.tier_key || typeof row.tier_key !== 'string') {
      return NextResponse.json({ ok: false, error: 'tier_key required' }, { status: 400 });
    }
    if (!VALID_TIER_KEYS.includes(row.tier_key as TierKey)) {
      return NextResponse.json({ ok: false, error: `Unknown tier_key: ${row.tier_key}` }, { status: 400 });
    }
    const cents = typeof row.price_usd_cents === 'number' ? row.price_usd_cents : parseInt(String(row.price_usd_cents ?? ''), 10);
    if (!Number.isInteger(cents) || cents < 0) {
      return NextResponse.json({ ok: false, error: 'price_usd_cents must be a non-negative integer' }, { status: 400 });
    }
  }

  const upsertRows = (rows as Array<Record<string, unknown>>).map((r) => ({
    tier_key: r.tier_key as string,
    price_usd_cents: typeof r.price_usd_cents === 'number' ? r.price_usd_cents : parseInt(String(r.price_usd_cents ?? ''), 10),
    active: typeof r.active === 'boolean' ? r.active : true,
    description: typeof r.description === 'string' ? r.description : undefined,
    updated_by: typeof r.updated_by === 'string' ? r.updated_by : (persona && typeof persona === 'object' && 'displayLabel' in persona ? String(persona.displayLabel ?? '') : null),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('plan_price_config')
    .upsert(upsertRows, { onConflict: 'tier_key' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: upsertRows.length });
}
