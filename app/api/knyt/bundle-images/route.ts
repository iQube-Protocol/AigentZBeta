/**
 * Public API: KNYT bundle hero images
 *
 * GET /api/knyt/bundle-images?series=metaKnyts
 *
 * Returns the supporting hero image URL for each bundle tier (bronze / silver
 * / gold). Lookup: codex_media_assets where asset_kind='bundle_pack' and the
 * editable supabase_title (or fallback original title) matches the tier key.
 *
 * Used by retail and investor store bundle cards to apply a consistent tier
 * visual across the catalog without hardcoding CIDs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export const runtime = 'nodejs';

const TIER_KEYS = ['bundle_bronze', 'bundle_silver', 'bundle_gold'] as const;
type TierKey = typeof TIER_KEYS[number];

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get('series') || 'metaKnyts';
  const supabase = getSupabaseServer();
  const empty = { bronze: null, silver: null, gold: null };

  if (!supabase) {
    return NextResponse.json(empty);
  }

  const { data, error } = await supabase
    .from('codex_media_assets')
    .select('title, supabase_title, cover_thumb_url, auto_drive_cid, created_at')
    .eq('series', series)
    .eq('status', 'active')
    .eq('asset_kind', 'bundle_pack')
    .order('created_at', { ascending: false }); // newest upload wins per tier

  if (error) {
    console.error('[knyt/bundle-images]', error.message);
    return NextResponse.json(empty);
  }

  function resolveUrl(row: { cover_thumb_url: string | null; auto_drive_cid: string | null }): string | null {
    if (row.cover_thumb_url) return row.cover_thumb_url;
    if (row.auto_drive_cid) return `/api/content/cover/${encodeURIComponent(row.auto_drive_cid)}`;
    return null;
  }

  const byTier: Record<TierKey, string | null> = {
    bundle_bronze: null,
    bundle_silver: null,
    bundle_gold: null,
  };

  for (const row of data ?? []) {
    const candidate = (row.supabase_title ?? row.title ?? '').toLowerCase().trim();
    const matchKey = TIER_KEYS.find((k) => candidate === k);
    if (matchKey && !byTier[matchKey]) {
      byTier[matchKey] = resolveUrl(row);
    }
  }

  return NextResponse.json({
    bronze: byTier.bundle_bronze,
    silver: byTier.bundle_silver,
    gold: byTier.bundle_gold,
  });
}
