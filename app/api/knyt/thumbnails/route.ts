/**
 * Public API: KNYT store thumbnail URLs
 *
 * GET /api/knyt/thumbnails?series=metaKnyts
 *
 * Returns cover_thumb_url and character_poster thumb_url per episode.
 * No auth required — these are Supabase Storage public URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../_lib/supabaseServer';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get('series') || 'metaKnyts';

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ covers: [], characters: [] });
  }

  const { data, error } = await supabase
    .from('codex_media_assets')
    .select('episode_number, asset_kind, cover_thumb_url, rarity_tier, title')
    .eq('series', series)
    .eq('status', 'active')
    .in('asset_kind', ['cover_image', 'cover_pdf', 'character_poster'])
    .not('cover_thumb_url', 'is', null)
    .order('episode_number', { ascending: true })
    .order('asset_kind', { ascending: true }); // cover_image before cover_pdf

  if (error) {
    console.error('[knyt/thumbnails]', error.message);
    return NextResponse.json({ covers: [], characters: [] });
  }

  const assets = data ?? [];

  const covers = assets
    .filter((a) => a.asset_kind === 'cover_image' || a.asset_kind === 'cover_pdf')
    .map((a) => ({
      episodeNumber: a.episode_number as number,
      thumbUrl: a.cover_thumb_url as string,
      rarityTier: a.rarity_tier as string | null,
    }));

  const characters = assets
    .filter((a) => a.asset_kind === 'character_poster')
    .map((a) => ({
      episodeNumber: a.episode_number as number,
      thumbUrl: a.cover_thumb_url as string,
      title: a.title as string,
    }));

  return NextResponse.json(
    { covers, characters },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
}
