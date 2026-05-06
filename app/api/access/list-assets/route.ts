/**
 * GET /api/access/list-assets
 *
 * Admin-only operator helper. Lists asset ids from master_content_qubes
 * and codex_media_assets so the operator can browse what's actually
 * seeded without guessing names.
 *
 * Query params:
 *   ?prefix=mk_ep01     filter master_content_qubes ids by id prefix
 *   ?limit=50           default 50, max 200
 *   ?source=master|asset|both    default both
 *
 * Auth: requires getActivePersona().cartridgeFlags.isAdmin === true.
 * Non-admin callers get 403. Unauthenticated callers get 401.
 *
 * Response is intentionally minimal — id + content_type/asset_kind +
 * episode_number — so it's safe to expose via DevTools without leaking
 * encryption keys, CIDs, or anything an attacker would value.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getActivePersona } from '@/services/identity/getActivePersona';

export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase configuration missing');
  return createClient(url, key);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getActivePersona(req);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!ctx.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const prefix = url.searchParams.get('prefix')?.trim() ?? '';
  const source = (url.searchParams.get('source') ?? 'both') as 'master' | 'asset' | 'both';
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 50 : limitRaw), 200);

  const supabase = adminClient();
  const out: {
    masters: Array<{ id: string; content_type: string | null; episode_number: number | null; gating_kind: string | null }>;
    assets: Array<{ id: string; asset_kind: string | null; episode_number: number | null; gating_kind: string | null }>;
  } = { masters: [], assets: [] };

  if (source === 'master' || source === 'both') {
    let q = supabase
      .from('master_content_qubes')
      .select('id, content_type, episode_number, gating_kind')
      .order('id', { ascending: true })
      .limit(limit);
    if (prefix) q = q.ilike('id', `${prefix}%`);
    const { data } = await q;
    out.masters = (data || []) as typeof out.masters;
  }

  if (source === 'asset' || source === 'both') {
    let q = supabase
      .from('codex_media_assets')
      .select('id, asset_kind, episode_number, gating_kind')
      .order('episode_number', { ascending: true, nullsFirst: false })
      .limit(limit);
    if (prefix) q = q.ilike('asset_kind', `${prefix}%`);
    const { data } = await q;
    out.assets = (data || []) as typeof out.assets;
  }

  return NextResponse.json(
    {
      filters: { prefix, source, limit },
      counts: { masters: out.masters.length, assets: out.assets.length },
      ...out,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
