import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

function publicAssetUrl(asset: any): string | null {
  if (asset.pdf_lite_url) return asset.pdf_lite_url;
  if (asset.cover_thumb_url) return asset.cover_thumb_url;
  if (typeof asset.auto_drive_cid === 'string' && /^https?:\/\//i.test(asset.auto_drive_cid)) {
    return asset.auto_drive_cid;
  }
  if (asset.id) return `/api/content/media/${asset.id}`;
  return null;
}

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  const [{ data: contentRows, error: contentError }, { data: assetRows, error: assetError }] = await Promise.all([
    supabase
      .from('content')
      .select('id,title,slug,excerpt,tags,status,published_at,thumbnail,content,market_data')
      .eq('domain', 'qriptopian')
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
    supabase
      .from('codex_media_assets')
      .select('id,title,asset_kind,series,mime_type,auto_drive_cid,cover_thumb_url,pdf_lite_url,created_at,is_shareable,status')
      .eq('status', 'active')
      .eq('is_shareable', true)
      .in('series', ['qriptopian', 'constitutional-internet'])
      .order('created_at', { ascending: false }),
  ]);

  if (contentError) return NextResponse.json({ error: contentError.message }, { status: 500 });
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });

  const publications = (contentRows ?? [])
    .filter((row: any) => {
      const tags = Array.isArray(row.tags) ? row.tags : [];
      return tags.includes('essay') || tags.includes('paper') || row.content?.machineReadable;
    })
    .map((row: any) => ({
      id: row.id,
      kind: row.tags?.includes('essay') ? 'essay' : row.tags?.includes('paper') ? 'paper' : 'publication',
      title: row.title,
      excerpt: row.excerpt ?? null,
      tags: row.tags ?? [],
      status: row.status,
      publishedAt: row.published_at ?? null,
      coverUrl: row.thumbnail ?? null,
      url: `/article?id=${encodeURIComponent(row.id)}&title=${encodeURIComponent(row.title)}`,
      machineReadable: row.content?.machineReadable ?? null,
      access: row.market_data?.pricing_model?.access ?? 'free',
      shareable: row.content?.share?.enabled !== false,
    }));

  const sourceAssets = (assetRows ?? [])
    .filter((row: any) => row.mime_type === 'application/pdf' || row.asset_kind === 'cover_image')
    .map((row: any) => ({
      id: row.id,
      kind: row.mime_type === 'application/pdf' ? 'paper' : 'cover',
      title: row.title,
      series: row.series,
      mimeType: row.mime_type,
      url: publicAssetUrl(row),
      shareable: true,
    }));

  return NextResponse.json({
    schema: 'qriptopian.commentary.sources.v1',
    policy: {
      papersAndEssays: 'free-and-shareable',
      purpose: 'constitutional-commentary-narrative-building',
    },
    publications,
    sourceAssets,
  }, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
  });
}
