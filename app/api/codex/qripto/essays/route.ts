import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function canonicalThumbnail(row: any): string | null {
  if (row.thumbnail) return row.thumbnail;

  const coverCid = row.ai_metadata?.coverCid || row.content?.cover?.cid || null;
  if (coverCid) {
    return `/api/content/cover/${encodeURIComponent(String(coverCid))}?variant=thumb`;
  }

  const coverAssetId = row.ai_metadata?.coverAssetId || row.content?.cover?.assetId || null;
  if (coverAssetId) {
    return `/api/content/media/${encodeURIComponent(String(coverAssetId))}`;
  }

  return null;
}

/** Canonical Qriptopian Threshold essays projection. */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from('content')
      .select('id,title,slug,excerpt,thumbnail,content,modalities,tags,published_at,created_at,placement,duration,ai_metadata')
      .eq('domain', 'qriptopian')
      .eq('status', 'published')
      .contains('tags', ['thresholds', 'essay']);

    if (error) {
      return NextResponse.json({ error: error.message, essays: [] }, { status: 500 });
    }

    const essays = (data || [])
      .map((row: any) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt || '',
        thumbnail: canonicalThumbnail(row),
        modalities: row.modalities || {},
        tags: row.tags || [],
        publishedAt: row.published_at || row.created_at || null,
        duration: row.duration || row.modalities?.read?.duration || null,
        position: Number(row.placement?.position ?? 999),
        machineReadable: row.ai_metadata?.machineReadable === true,
        machineUrl: row.ai_metadata?.machineEndpoint || (row.slug ? `/api/codex/qripto/essays/${row.slug}/machine` : null),
        series: row.ai_metadata?.series || 'Thresholds',
        seriesNumber: row.ai_metadata?.seriesNumber ?? null,
      }))
      .sort((a: any, b: any) => a.position - b.position || String(a.title).localeCompare(String(b.title)));

    return NextResponse.json({ essays });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load essays', essays: [] },
      { status: 500 },
    );
  }
}
