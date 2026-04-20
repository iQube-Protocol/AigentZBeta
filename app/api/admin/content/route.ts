/**
 * Admin Content API — List & Create
 * GET  /api/admin/content?section=<s>&tab=<t>&status=all
 * POST /api/admin/content
 *
 * Returns raw content rows from the `content` table for admin editing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

const VALID_SECTIONS = [
  'home-hero',
  'latest-news',
  'second-hero',
  'pennydrops',
  'scrolls',
  '21knowdz',
  'staybull',
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');
  const tab = searchParams.get('tab');
  const statusFilter = searchParams.get('status');

  if (!section || !VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const placement: Record<string, unknown> = { section };
  if (tab) placement.tab = tab;

  let query = supabase
    .from('content')
    .select('*')
    .contains('placement', placement)
    .order('placement->position', { ascending: true });

  if (statusFilter !== 'all') {
    query = query.in('status', ['draft', 'published']);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title || !body.placement || !(body.placement as any).section) {
    return NextResponse.json(
      { error: 'Missing required fields: title, placement.section' },
      { status: 400 },
    );
  }

  const row = {
    domain: 'qriptopian',
    type: body.type ?? 'article',
    format: body.format ?? 'article',
    title: body.title,
    slug: body.slug ?? (body.title as string).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    excerpt: body.excerpt ?? null,
    thumbnail: body.thumbnail ?? null,
    status: body.status ?? 'draft',
    placement: body.placement,
    modalities: body.modalities ?? {},
    tags: body.tags ?? [],
    issue_ref: body.issue_ref ?? null,
    market_data: body.market_data ?? null,
    content: body.content ?? {},
  };

  const { data, error } = await supabase.from('content').insert(row).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
