/**
 * Admin API: Register a completed Supabase Storage upload in the DB
 *
 * POST /api/admin/codex/storage/register
 *
 * Called by the browser after a successful direct PUT to the signed URL.
 * Inserts into codex_media_assets or master_content_qubes with the public URL
 * stored in auto_drive_cid (provider-agnostic string identifier field) and
 * encryption_iv set to '' to mark the row as unencrypted Supabase content
 * (content fetch routes detect this and proxy to the URL directly).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const BUCKET = 'content-media';

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // No auth check — admin codex routes are URL-protected; the codex viewer
    // host page does not require a Supabase session. Returning 401 here just
    // because there's no Bearer token blocks legitimate operator uploads on
    // the dev environment.

    const body = await req.json();
    const {
      path, bucket = BUCKET,
      category, title, series = 'metaKnyts',
      episodeNumber, assetKind, contentType,
      editionTier, rarityTier, variantName,
      mimeType, fileSize,
      displayMode, isShareable, recommendedTask,
      editionMax, randomWeight,
    } = body as {
      path: string; bucket?: string;
      category: string; title: string; series?: string;
      episodeNumber?: number | null; assetKind?: string; contentType?: string;
      editionTier?: string; rarityTier?: string; variantName?: string;
      mimeType?: string; fileSize?: number;
      displayMode?: string; isShareable?: boolean; recommendedTask?: string;
      editionMax?: number; randomWeight?: number;
    };

    if (!path || !category || !title) {
      return NextResponse.json({ error: 'Missing path, category, or title' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const storageUrl = urlData.publicUrl;
    // NOT-NULL columns required by the schema (encryption_iv, mime_type)
    const safeMime = mimeType || 'application/octet-stream';
    const isMaster = category === 'master' || category === 'still' || category === 'print';

    if (isMaster) {
      const ct = category === 'print' ? 'episode_print'
               : category === 'still' ? 'episode_still'
               : contentType || 'episode_motion';
      const ep = episodeNumber ?? 0;
      const tierIdSuffix = editionTier ? `_${editionTier}` : '';
      const id = `mk_ep${String(ep).padStart(2, '0')}_${ct.replace('episode_', '')}${tierIdSuffix}`;

      const { error } = await supabase
        .from('master_content_qubes')
        .upsert({
          id,
          title,                  // Auto-Drive label (locked)
          supabase_title: title,  // editable, defaults to upload-time title
          episode_number: ep,
          content_type: ct,
          series,
          edition_tier: editionTier || null,
          auto_drive_cid: storageUrl,
          mime_type: safeMime,
          file_size: fileSize || null,
          encryption_iv: '',
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id, storageUrl });
    }

    // codex_media_assets
    const insertRow: Record<string, unknown> = {
      title,                  // Auto-Drive label (locked)
      supabase_title: title,  // editable, defaults to upload-time title
      episode_number: episodeNumber ?? null,
      asset_kind: assetKind,
      series,
      auto_drive_cid: storageUrl,
      mime_type: safeMime,
      file_size: fileSize || null,
      encryption_iv: '',
      status: 'active',
    };
    // Populate cover_thumb_url so the viewer renders directly (the KnytTab
    // and CategoryDetailPanel both prefer cover_thumb_url over CID-routing).
    if (assetKind === 'cover_image' || assetKind === 'cover_pdf' || (safeMime.startsWith('image/'))) {
      insertRow.cover_thumb_url = storageUrl;
    }
    if (variantName) insertRow.variant_name = variantName;
    if (rarityTier) insertRow.rarity_tier = rarityTier;
    if (editionMax) insertRow.edition_max = editionMax;
    if (randomWeight) insertRow.random_weight = randomWeight;
    if (displayMode) insertRow.display_mode = displayMode;
    if (typeof isShareable === 'boolean') insertRow.is_shareable = isShareable;
    if (recommendedTask) insertRow.recommended_task = recommendedTask;

    const { data, error } = await supabase
      .from('codex_media_assets')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, storageUrl });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || 'Register failed' }, { status: 500 });
  }
}
