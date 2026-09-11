import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/codex/qripto/canonical-assets?scope=canonical/constitutional-internet
 *
 * Returns canonical assets (plates, infographics) for the Constitutional
 * Internet Bridge. T2-safe public fields only — no auth required.
 *
 * SCHEMA CORRECTION (2026-08-12 forensic pass): the original query filtered
 * on `cartridge=eq.qriptopian` and `asset_kind=in.("Image","Infographic")` —
 * neither is real. Confirmed against an actual uploaded row
 * (codex_media_assets, agentMe_Plate/IRL_Plate/metaMe_VL_Plate):
 *   - `cartridge` is a real column, but Qriptopian rows are written through
 *     the storage/register route, which never sets it — every row (this
 *     cartridge included) sits at the column DEFAULT ('knyt'). The correct
 *     predicate for "this is a Qriptopian asset" is `series = 'qriptopian'`
 *     (what /api/codex/qripto/papers already filters on).
 *   - "Image"/"Infographic" are the UPLOAD MODAL's UI content-type labels,
 *     never persisted anywhere. The upload modal maps both onto the real
 *     `asset_kind` enum value `social_campaign_image` (see
 *     CodexUploadModal.tsx's `assetKindByCategory`).
 * `series_scope` IS a real column (migration 20260811223027) but was never
 * WRITTEN by the register route until this same pass — so pre-existing rows
 * (including the three plates already uploaded) have it NULL. Query prefers
 * the column when present and falls back to matching the storage-URL/CID
 * filename prefix the upload path embeds (`<scope-with-slashes-as-dashes>_
 * <timestamp>.<ext>`) — the same convention /api/codex/qripto/papers already
 * relies on for legacy rows. New uploads populate the column directly and
 * stop depending on the fallback.
 */

const BUCKET_ROOT = 'https://';

function scopeToFilenamePrefix(scope: string): string {
  return scope.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get('scope');

    if (!scope) {
      return NextResponse.json(
        { error: 'Missing scope parameter' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Real schema, real enum value — see file header. `original_filename`
    // is NOT a real column (2026-08-12 closure pass: it was invented in the
    // prior version of this route and never actually read — the response
    // mapping below already used `title` for `originalFilename`). Selecting
    // it produced `column codex_media_assets.original_filename does not
    // exist`, a 500 masked by Choose's fallback explainer.
    const { data, error } = await supabase
      .from('codex_media_assets')
      .select('id, title, supabase_title, mime_type, asset_kind, series_scope, auto_drive_cid, cover_thumb_url, status')
      .eq('series', 'qriptopian')
      .eq('status', 'active')
      .in('asset_kind', ['social_campaign_image', 'cover_image']);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch assets', detail: error.message },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const filenamePrefix = scopeToFilenamePrefix(scope);

    // Only rows directly renderable via <img src> (a bare Autonomys CID is
    // not a fetchable URL) — excludes the orphaned Auto-Drive-path duplicate
    // rows uploaded before the Supabase-storage path was the default.
    const isDirectlyRenderable = (url: string | null) => typeof url === 'string' && url.startsWith(BUCKET_ROOT);

    const matches = rows.filter((row) => {
      const url = row.auto_drive_cid as string | null;
      if (!isDirectlyRenderable(url)) return false;
      if (row.series_scope === scope) return true;
      // Legacy fallback: no series_scope on the row (pre-fix upload) — match
      // the filename prefix the storage path embeds instead.
      if (!row.series_scope && url && url.includes(`/${filenamePrefix}_`)) return true;
      return false;
    });

    // Map to T2-safe public fields.
    const publicAssets = matches.map((row) => ({
      id: row.id as string,
      title: (row.supabase_title || row.title || 'Untitled') as string,
      originalFilename: (row.title || 'untitled') as string,
      mimeType: row.mime_type as string,
      assetKind: row.asset_kind as string,
      seriesScope: (row.series_scope || scope) as string,
      publicUrl: row.auto_drive_cid as string,
      cid: null as string | null,
    }));

    return NextResponse.json({ assets: publicAssets });
  } catch (error) {
    console.error('[Canonical Assets API]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
