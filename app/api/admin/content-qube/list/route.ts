/**
 * GET /api/admin/content-qube/list
 *
 * Admin-only listing of content_qubes rows for the Canonical Mint
 * panel. Returns the minimal set of fields the UI needs:
 *   id, title, content_kind, content_type, lifecycle_state,
 *   updated_at
 *
 * Filters:
 *   ?series=<string>            — defaults to all series
 *   ?lifecycle=<comma-separated> — defaults to canonized + semi_minted +
 *                                  review_ready + canon_pending +
 *                                  chain_minted (i.e. everything that
 *                                  could either need a mint or already
 *                                  has one). Pass 'all' to drop the
 *                                  filter.
 *   ?limit=<int>                — default 200, max 500
 *
 * Auth: spine `cartridgeFlags.isAdmin` (same gate as the mint route).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) return { ok: false as const, status: 401, error: 'Unauthorized' };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { ok: false as const, status: 403, error: 'Admin required' };
  }
  return { ok: true as const, persona };
}

const DEFAULT_LIFECYCLE_FILTER = [
  'canonized',
  'semi_minted',
  'review_ready',
  'canon_pending',
  'chain_minted',
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await assertAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }

  const url = new URL(req.url);
  const series = url.searchParams.get('series');
  const lifecycleParam = url.searchParams.get('lifecycle');
  const limitRaw = Number(url.searchParams.get('limit') ?? '200');
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 500);

  let q = supabase
    .from('content_qubes')
    .select('id, series, title, content_kind, content_type, lifecycle_state, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (series) q = q.eq('series', series);
  if (lifecycleParam !== 'all') {
    const states = lifecycleParam
      ? lifecycleParam.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_LIFECYCLE_FILTER;
    q = q.in('lifecycle_state', states);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}
