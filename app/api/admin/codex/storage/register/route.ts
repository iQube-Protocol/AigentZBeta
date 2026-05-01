/**
 * Admin API: Register a completed Supabase Storage upload in the DB
 *
 * POST /api/admin/codex/storage/register
 *
 * Called by the browser after a successful direct PUT to the signed URL.
 * Creates the codex_media_assets or master_content_qubes row just like the
 * Auto-Drive route does, but with provider='supabase' and the storage URL
 * stored in auto_drive_cid (provider-agnostic string identifier field).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '../../../../_lib/supabaseServer';

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
    // Validate auth
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const authHeader = req.headers.get('authorization');
      const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const supabase = getSupabaseServer();
      if (supabase) {
        const { error: authError } = await supabase.auth.getUser(jwt);
        if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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
          title,
          episode_number: ep,
          content_type: ct,
          series,
          edition_tier: editionTier || null,
          auto_drive_cid: storageUrl,
          mime_type: mimeType || null,
          file_size: fileSize || null,
          provider: 'supabase',
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id, storageUrl });
    }

    // codex_media_assets
    const { data, error } = await supabase
      .from('codex_media_assets')
      .insert({
        title,
        episode_number: episodeNumber ?? null,
        asset_kind: assetKind,
        series,
        auto_drive_cid: storageUrl,
        mime_type: mimeType || null,
        file_size: fileSize || null,
        provider: 'supabase',
        variant_name: variantName || null,
        rarity_tier: rarityTier || null,
        edition_max: editionMax || null,
        random_weight: randomWeight || null,
        display_mode: displayMode || null,
        is_shareable: isShareable ?? false,
        recommended_task: recommendedTask || null,
        status: 'active',
      })
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
