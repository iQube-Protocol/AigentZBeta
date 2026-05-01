/**
 * Public API: KNYT store thumbnail URLs
 *
 * GET /api/knyt/thumbnails?series=metaKnyts
 *
 * Returns cover_thumb_url (preferred) or decrypting cover proxy URL per episode.
 * Falls back to /api/content/cover/{cid} for assets not yet thumbnail-generated.
 * No auth required.
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
    .select('episode_number, asset_kind, cover_thumb_url, auto_drive_cid, rarity_tier, title')
    .eq('series', series)
    .eq('status', 'active') // mirror /api/admin/codex/status — without this an inactive row may shadow an active one
    .in('asset_kind', ['cover_image', 'cover_pdf', 'character_poster'])
    .order('episode_number', { ascending: true })
    .order('asset_kind', { ascending: true })    // cover_image before cover_pdf
    .order('created_at', { ascending: false });  // newest upload wins per episode+kind

  if (error) {
    console.error('[knyt/thumbnails]', error.message);
    return NextResponse.json({ covers: [], characters: [] });
  }

  const assets = data ?? [];

  // Resolve thumb URL: prefer CDN thumb, fall back to decrypting cover proxy (relative so it always works)
  function resolveThumb(a: { cover_thumb_url: string | null; auto_drive_cid: string | null }): string | null {
    if (a.cover_thumb_url) return a.cover_thumb_url;
    if (a.auto_drive_cid) return `/api/content/cover/${a.auto_drive_cid}`;
    return null;
  }

  // DB episode_number convention: 0 = GN, 1 = Episode #0, 2 = Episode #1 ... 13 = Episode #12
  // Pricing episodeNumber convention:    -1 = GN, 0 = Episode #0, 1 = Episode #1 ... 12 = Episode #12
  // Offset: pricingEpisodeNumber = dbEpisodeNumber - 1
  const covers = assets
    .filter((a) => a.asset_kind === 'cover_image' || a.asset_kind === 'cover_pdf')
    .map((a) => {
      const thumbUrl = resolveThumb(a);
      if (!thumbUrl) return null;
      return {
        episodeNumber: (a.episode_number as number) - 1,
        thumbUrl,
        rarityTier: a.rarity_tier as string | null,
      };
    })
    .filter(Boolean) as { episodeNumber: number; thumbUrl: string; rarityTier: string | null }[];

  const characters = assets
    .filter((a) => a.asset_kind === 'character_poster')
    .map((a) => {
      const thumbUrl = resolveThumb(a);
      if (!thumbUrl) return null;
      return {
        episodeNumber: (a.episode_number as number) - 1,
        thumbUrl,
        title: a.title as string,
      };
    })
    .filter(Boolean) as { episodeNumber: number; thumbUrl: string; title: string }[];

  return NextResponse.json(
    { covers, characters },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
}
