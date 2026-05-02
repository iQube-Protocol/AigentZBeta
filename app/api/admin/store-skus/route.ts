/**
 * Admin API: Store SKUs
 *
 * GET   /api/admin/store-skus           — list every active SKU with its grants
 * PATCH /api/admin/store-skus           — update one SKU's grants by sku_id
 *
 * The grants_* booleans determine which asset categories a SKU unlocks for
 * the buyer (see services/rewards/assetOwnership.ts). Editing here removes the
 * need to run SQL UPDATE statements when adjusting bundle coverage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const ALLOWED_FIELDS = new Set([
  'name',
  'description',
  'grants_episodes_still',
  'grants_episodes_motion',
  'grants_episodes_print',
  'grants_character_cards',
  'grants_gn',
  'grants_lore',
  'episode_numbers',
  'extra_asset_ids',
  'bundle_image_asset_id',
  'is_active',
]);

export async function GET() {
  const { data, error } = await supa()
    .from('store_skus')
    .select('*')
    .order('sku_id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ skus: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const skuId = body.sku_id;
  if (typeof skuId !== 'string' || !skuId) {
    return NextResponse.json({ error: 'sku_id required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'sku_id') continue;
    if (!ALLOWED_FIELDS.has(key)) continue;
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supa()
    .from('store_skus')
    .update(updates)
    .eq('sku_id', skuId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sku: data });
}
