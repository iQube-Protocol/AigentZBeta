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

  // Resolve thumb URL: prefer CDN thumb, then a direct URL if auto_drive_cid is
  // already an http(s) URL (Supabase-hosted), then fall back to the decrypting
  // cover proxy for true Auto-Drive CIDs (encoded so slashes don't collapse).
  function resolveThumb(a: { cover_thumb_url: string | null; auto_drive_cid: string | null }): string | null {
    if (a.cover_thumb_url) return a.cover_thumb_url;
    const cid = a.auto_drive_cid;
    if (!cid) return null;
    if (cid.startsWith('http://') || cid.startsWith('https://')) return cid;
    return `/api/content/cover/${encodeURIComponent(cid)}`;
  }

  // Canonical convention (2026-05-16): DB episode_number IS the display number.
  //   codex_media_assets covers:  episode_number ∈ {-1 (GN), 0..12 (episodes)}
  //   codex_media_assets characters: 1-indexed (DB ep 1..13 = display #0..#12)
  // so covers no longer subtract 1, but characters still do.
  const covers = assets
    .filter((a) => a.asset_kind === 'cover_image' || a.asset_kind === 'cover_pdf')
    .map((a) => {
      const thumbUrl = resolveThumb(a);
      if (!thumbUrl) return null;
      return {
        episodeNumber: a.episode_number as number,
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
        // codex_media_assets.character_poster rows are 0-indexed in the
        // actual dev DB (ep 0 = first character, "Deji Ifada / Kn0w1"; ep 12 =
        // last). The historical "characters are 1-indexed" comment in
        // /api/codex/owned was stale — confirmed against live data 2026-05-18.
        // No subtraction.
        episodeNumber: a.episode_number as number,
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
