import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/codex/qripto/canonical-assets?scope=canonical/constitutional-internet
 *
 * Returns canonical assets (plates, infographics) for the Constitutional Internet Bridge.
 * T2-safe public fields only — no auth required.
 */

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

    // Query Supabase for canonical assets
    const response = await fetch(
      `${supabaseUrl}/rest/v1/codex_media_assets?cartridge=eq.qriptopian&series_scope=eq.${encodeURIComponent(scope)}&asset_kind=in.("Image","Infographic")`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch assets' },
        { status: response.status }
      );
    }

    const assets = await response.json();

    // Map to T2-safe public fields
    const publicAssets = assets.map((asset: any) => ({
      id: asset.id,
      title: asset.canonical_title || asset.original_filename || 'Untitled',
      originalFilename: asset.original_filename,
      mimeType: asset.mime_type,
      assetKind: asset.asset_kind,
      seriesScope: asset.series_scope,
      publicUrl: asset.storage_public_url,
      cid: asset.auto_drive_cid,
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
