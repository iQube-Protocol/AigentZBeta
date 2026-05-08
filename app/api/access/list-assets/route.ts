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

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  buildDebugBypassContext,
  isDebugBypassEnabled,
  logDebugBypass,
} from '@/services/access/debugBypass';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

function adminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing');
  return client;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let ctx = await getActivePersona(req);
  if (!ctx) {
    if (isDebugBypassEnabled()) {
      logDebugBypass('list-assets');
      ctx = buildDebugBypassContext();
    } else {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
  }
  if (!ctx.cartridgeFlags.isAdmin) {
    if (isDebugBypassEnabled()) {
      // Bypass admin gate too — the bypass context already has isAdmin=true,
      // but a real-but-non-admin caller hitting list-assets while bypass is
      // active still gets through. Loud log as a reminder.
      logDebugBypass('list-assets:admin-bypass');
    } else {
      return NextResponse.json({ error: 'admin-only' }, { status: 403 });
    }
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

  // select('*') because PostgREST silently returns null on any missing
  // column, and gating_kind / gating_credential / mint_status are added
  // by scripts that may not have been applied on every environment yet.
  // Reading the columns we need defensively from the row is the resilient
  // path; over-fetching a few columns is cheap.
  if (source === 'master' || source === 'both') {
    let q = supabase
      .from('master_content_qubes')
      .select('*')
      .order('id', { ascending: true })
      .limit(limit);
    if (prefix) {
      // Multi-column substring match: id, series, content_type. Operator
      // can type 'mk_ep00', 'metaKnyts', or 'episode_motion' and find rows.
      q = q.or(
        `id.ilike.%${prefix}%,series.ilike.%${prefix}%,content_type.ilike.%${prefix}%`,
      );
    }
    const { data } = await q;
    const rows = (data || []) as Array<Record<string, unknown>>;
    out.masters = rows.map((r) => ({
      id: String(r.id ?? ''),
      content_type: (r.content_type as string | null) ?? null,
      episode_number: (r.episode_number as number | null) ?? null,
      gating_kind: (r.gating_kind as string | null) ?? null,
      series: (r.series as string | null) ?? null,
    }));
  }

  if (source === 'asset' || source === 'both') {
    let q = supabase
      .from('codex_media_assets')
      .select('*')
      .order('episode_number', { ascending: true, nullsFirst: false })
      .limit(limit);
    if (prefix) {
      q = q.or(
        `id.ilike.%${prefix}%,series.ilike.%${prefix}%,asset_kind.ilike.%${prefix}%`,
      );
    }
    const { data } = await q;
    const rows = (data || []) as Array<Record<string, unknown>>;
    out.assets = rows.map((r) => ({
      id: String(r.id ?? ''),
      asset_kind: (r.asset_kind as string | null) ?? null,
      episode_number: (r.episode_number as number | null) ?? null,
      gating_kind: (r.gating_kind as string | null) ?? null,
      series: (r.series as string | null) ?? null,
    }));
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
