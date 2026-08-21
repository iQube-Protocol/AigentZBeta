import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Canonical Qriptopian Threshold essays projection.
 *
 * Source of truth is the platform `content` table / QubeBase. Essays are
 * distinguished from Papers by editorial class, not storage format:
 *   domain = qriptopian
 *   status = published
 *   tags contains `thresholds` + `essay`
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from('content')
      .select('id,title,slug,excerpt,thumbnail,modalities,tags,published_at,created_at,placement,duration')
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
        thumbnail: row.thumbnail || null,
        modalities: row.modalities || {},
        tags: row.tags || [],
        publishedAt: row.published_at || row.created_at || null,
        duration: row.duration || row.modalities?.read?.duration || null,
        position: Number(row.placement?.position ?? 999),
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
