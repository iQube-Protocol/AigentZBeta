/**
 * Admin API: Codex Assets by Category
 *
 * GET /api/admin/codex/assets-by-category?series=metaKnyts&category=covers
 *
 * Returns the detailed list of every asset in a given dashboard category,
 * with title, episode number, asset kind, rarity/edition tier, CID, and
 * (when available) a thumbnail URL — so an admin can identify each asset
 * deterministically and direct content placement.
 *
 * Categories map to the same buckets shown on the Codex Manager dashboard:
 *   episode-masters → master_content_qubes (episode_still + episode_motion)
 *   covers          → codex_media_assets (cover_image + cover_pdf)
 *   characters      → codex_media_assets (character_poster)
 *   lore            → codex_media_assets (background_lore_doc, powers_sheet, twenty_one_sats_concept)
 *   game            → codex_media_assets (game_concept_doc, game_still, game_video)
 *   social          → codex_media_assets (social_campaign_video, social_campaign_image)
 *   rabadges        → codex_media_assets (ra_badge)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Category = 'episode-masters' | 'still-masters' | 'covers' | 'characters' | 'lore' | 'game' | 'social' | 'rabadges' | 'bundles';

const ASSET_KIND_BY_CATEGORY: Record<Exclude<Category, 'episode-masters' | 'still-masters'>, string[]> = {
  covers:     ['cover_image', 'cover_pdf'],
  characters: ['character_poster'],
  lore:       ['background_lore_doc', 'powers_sheet', 'twenty_one_sats_concept'],
  game:       ['game_concept_doc', 'game_still', 'game_video'],
  social:     ['social_campaign_video', 'social_campaign_image'],
  rabadges:   ['ra_badge'],
  bundles:    ['bundle_pack'],
};

interface CategoryAsset {
  id: string;
  title: string | null;          // Auto-Drive title (locked at upload time)
  supabaseTitle: string | null;  // Editable display title used by app
  episodeNumber: number | null;
  assetKind: string;
  contentType?: string;     // for episode-masters
  editionTier?: string | null;
  rarityTier?: string | null;
  cid: string | null;
  thumbUrl?: string | null;
  mimeType?: string | null;
  variantName?: string | null;
  pdfLiteUrl?: string | null;
  createdAt?: string | null;
  status?: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const series = searchParams.get('series') || 'metaKnyts';
  const category = (searchParams.get('category') || '') as Category;
  const includeArchived = searchParams.get('includeArchived') === 'true';

  if (!category) {
    return NextResponse.json({ error: 'Missing category' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase unavailable' }, { status: 503 });
  }

  const statusFilter = includeArchived ? ['active', 'archived'] : ['active'];

  try {
    if (category === 'episode-masters' || category === 'still-masters') {
      // Motion = episode_motion only. Still = everything non-motion (still + print).
      const contentTypeFilter = category === 'episode-masters'
        ? ['episode_motion']
        : ['episode_still', 'episode_print'];
      const { data, error } = await supabase
        .from('master_content_qubes')
        .select('id, episode_number, content_type, edition_tier, title, supabase_title, auto_drive_cid, pdf_lite_url, mime_type, status, created_at')
        .eq('series', series)
        .in('status', statusFilter)
        .in('content_type', contentTypeFilter)
        .order('episode_number', { ascending: true })
        .order('content_type', { ascending: true });

      if (error) throw error;

      const assets: CategoryAsset[] = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        supabaseTitle: row.supabase_title ?? row.title,
        episodeNumber: row.episode_number,
        assetKind: row.content_type,
        contentType: row.content_type,
        editionTier: row.edition_tier,
        cid: row.auto_drive_cid,
        pdfLiteUrl: row.pdf_lite_url,
        mimeType: row.mime_type,
        status: row.status,
        createdAt: row.created_at,
      }));

      return NextResponse.json({ category, series, assets, count: assets.length });
    }

    const kinds = ASSET_KIND_BY_CATEGORY[category as Exclude<Category, 'episode-masters' | 'still-masters'>];
    if (!kinds) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('codex_media_assets')
      .select('id, episode_number, asset_kind, title, supabase_title, auto_drive_cid, cover_thumb_url, mime_type, rarity_tier, variant_name, status, created_at')
      .eq('series', series)
      .in('status', statusFilter)
      .in('asset_kind', kinds)
      .order('episode_number', { ascending: true, nullsFirst: false })
      .order('asset_kind', { ascending: true })
      .order('rarity_tier', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const assets: CategoryAsset[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      supabaseTitle: row.supabase_title ?? row.title,
      episodeNumber: row.episode_number,
      assetKind: row.asset_kind,
      rarityTier: row.rarity_tier,
      cid: row.auto_drive_cid,
      thumbUrl: row.cover_thumb_url,
      mimeType: row.mime_type,
      variantName: row.variant_name,
      status: row.status,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ category, series, assets, count: assets.length });
  } catch (err) {
    console.error('[assets-by-category]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load assets' },
      { status: 500 },
    );
  }
}
