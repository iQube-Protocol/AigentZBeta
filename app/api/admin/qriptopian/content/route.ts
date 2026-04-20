/**
 * GET  /api/admin/qriptopian/content  — list all Qriptopian smart_content_qubes (admin)
 * POST /api/admin/qriptopian/content  — create a new draft
 *
 * Query params (GET):
 *   section?  — filter by layout_hints->>'section'
 *   status?   — 'draft' | 'published' | 'all' (default: all)
 *   limit?    — default 100
 *   offset?   — default 0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const section  = searchParams.get('section') ?? '';
  const status   = searchParams.get('status') ?? 'all';
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
  const offset   = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    let query = supabase
      .from('smart_content_qubes')
      .select('id, title, slug, description, cover_image_uri, status, created_at, updated_at, layout_hints, structure_data')
      .eq('tenant_id', 'qriptopian')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);
    if (section)          query = query.eq('layout_hints->>section', section);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      title: string;
      slug: string | null;
      description: string | null;
      cover_image_uri: string | null;
      status: string;
      created_at: string;
      updated_at: string | null;
      layout_hints: Record<string, unknown> | null;
      structure_data: Record<string, unknown> | null;
    }>;

    const items = rows.map((r) => ({
      id:              r.id,
      title:           r.title,
      slug:            r.slug,
      excerpt:         r.description,
      cover_image_uri: r.cover_image_uri,
      status:          r.status,
      section:         (r.layout_hints?.['section'] as string) ?? null,
      body_preview:    typeof r.structure_data?.['body'] === 'string'
                         ? (r.structure_data['body'] as string).slice(0, 200)
                         : null,
      created_at:      r.created_at,
      updated_at:      r.updated_at,
    }));

    // Section summary counts
    const allForSummary = await supabase
      .from('smart_content_qubes')
      .select('status, layout_hints')
      .eq('tenant_id', 'qriptopian')
      .is('deleted_at', null);

    const summary: Record<string, { draft: number; published: number }> = {};
    for (const row of allForSummary.data ?? []) {
      const sec = ((row as { layout_hints?: Record<string, unknown> }).layout_hints?.['section'] as string) ?? 'uncategorised';
      const st  = (row as { status: string }).status;
      if (!summary[sec]) summary[sec] = { draft: 0, published: 0 };
      if (st === 'draft')     summary[sec].draft++;
      if (st === 'published') summary[sec].published++;
    }

    return NextResponse.json({ ok: true, data: { items, summary, total: items.length } });
  } catch (err) {
    console.error('[admin/qriptopian/content GET] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load content' }, { status: 500 });
  }
}
