/**
 * Public API: KNYT bundle hero images
 *
 * GET /api/knyt/bundle-images?series=metaKnyts
 *
 * Returns:
 *   - tier rollup (bronze/silver/gold) by matching codex_media_assets where
 *     asset_kind='bundle_pack' and supabase_title equals the tier key —
 *     legacy fallback mapping consumed via BUNDLE_ID_TO_TIER in the hook
 *   - perSku map: { sku_id -> hero_image_url } for any SKU whose
 *     bundle_image_asset_id column resolves to an active bundle_pack asset.
 *     This is the operator-editable override surface.
 *
 * The hook (useBundleImages) prefers perSku, falls back to tier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export const runtime = 'nodejs';

const TIER_KEYS = ['bundle_bronze', 'bundle_silver', 'bundle_gold'] as const;
type TierKey = typeof TIER_KEYS[number];

function resolveUrl(row: { cover_thumb_url: string | null; auto_drive_cid: string | null }): string | null {
  if (row.cover_thumb_url) return row.cover_thumb_url;
  if (row.auto_drive_cid) return `/api/content/cover/${encodeURIComponent(row.auto_drive_cid)}`;
  return null;
}

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get('series') || 'metaKnyts';
  const supabase = getSupabaseServer();
  const empty = { bronze: null, silver: null, gold: null, perSku: {} as Record<string, string> };

  if (!supabase) {
    return NextResponse.json(empty);
  }

  // Pull every active bundle_pack image once; both lookups (tier + perSku) reuse this.
  const { data: imageRows, error: imageErr } = await supabase
    .from('codex_media_assets')
    .select('id, title, supabase_title, cover_thumb_url, auto_drive_cid, created_at')
    .eq('series', series)
    .eq('status', 'active')
    .eq('asset_kind', 'bundle_pack')
    .order('created_at', { ascending: false });

  if (imageErr) {
    console.error('[knyt/bundle-images] image query', imageErr.message);
    return NextResponse.json(empty);
  }

  const images = imageRows ?? [];
  const imageById = new Map<string, typeof images[number]>();
  for (const row of images) imageById.set(row.id as string, row);

  // Tier rollup (legacy / fallback)
  const byTier: Record<TierKey, string | null> = {
    bundle_bronze: null,
    bundle_silver: null,
    bundle_gold: null,
  };
  for (const row of images) {
    const candidate = (row.supabase_title ?? row.title ?? '').toLowerCase().trim();
    const matchKey = TIER_KEYS.find((k) => candidate === k);
    if (matchKey && !byTier[matchKey]) {
      byTier[matchKey] = resolveUrl(row);
    }
  }

  // Per-SKU override map from store_skus.bundle_image_asset_id
  const perSku: Record<string, string> = {};
  const { data: skuRows } = await supabase
    .from('store_skus')
    .select('sku_id, bundle_image_asset_id')
    .eq('is_active', true)
    .not('bundle_image_asset_id', 'is', null);

  for (const sku of skuRows ?? []) {
    const imageId = sku.bundle_image_asset_id as string | null;
    if (!imageId) continue;
    const image = imageById.get(imageId);
    if (!image) continue;
    const url = resolveUrl(image);
    if (url) perSku[sku.sku_id as string] = url;
  }

  return NextResponse.json({
    bronze: byTier.bundle_bronze,
    silver: byTier.bundle_silver,
    gold: byTier.bundle_gold,
    perSku,
  });
}
