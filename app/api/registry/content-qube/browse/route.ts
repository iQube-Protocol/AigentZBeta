/**
 * GET /api/registry/content-qube/browse
 *
 * Admin-only operator helper. Lists every row in v_content_qube_registry so
 * the operator can confirm what the ContentQube registry actually contains
 * — independent of any persona-aware codex tab.
 *
 * Query params:
 *   series       (optional) — e.g. 'metaKnyts'. Omit for all.
 *   contentKind  (optional) — e.g. 'episode' | 'character' | 'gn'
 *   limit        (optional) — default 500, max 1000
 *
 * Auth: getActivePersona() with cartridgeFlags.isAdmin === true. Non-admin
 * callers get 403. Unauthenticated callers get 401.
 *
 * Response intentionally omits primary_storage_url / Autonomys CIDs so the
 * browser response stays safe even though the route is admin-gated. The
 * counts + lifecycle_state + storage_kinds are sufficient for the SoT
 * verification use case ("did the migration run? are the rows there?"). If
 * an operator needs storage URLs they can query SQL directly.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegistryRow {
  id: string;
  series: string;
  content_kind: string;
  content_type: string;
  display_number: number | null;
  title: string | null;
  description: string | null;
  lifecycle_state: string;
  master_qube_id: string | null;
  media_asset_id: string | null;
  created_at: string;
  updated_at: string;
  gating_kind: string | null;
  required_sku: string[] | null;
  price_qc: number | null;
  min_identity_level: string | null;
  primary_storage_kind: string | null;
  primary_mime_type: string | null;
  primary_file_size_bytes: number | null;
  primary_content_state: string | null;
  storage_kinds: string[] | null;
  total_editions: number;
  issued_count: number;
  chain_minted_count: number;
  legendary_count: number;
  epic_count: number;
  rare_count: number;
  secret_black_rare_count: number;
  codex_slugs: string[] | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getActivePersona(req).catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!ctx.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin required' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const series      = searchParams.get('series') ?? undefined;
  const contentKind = searchParams.get('contentKind') ?? undefined;
  const rawLimit    = parseInt(searchParams.get('limit') ?? '500', 10);
  const limit       = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 500, 1), 1000);

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase unavailable' }, { status: 500 });
  }

  // Select only T1-safe columns. Storage URLs deliberately excluded.
  let query = supabase
    .from('v_content_qube_registry')
    .select(`
      id, series, content_kind, content_type, display_number, title, description,
      lifecycle_state, master_qube_id, media_asset_id, created_at, updated_at,
      gating_kind, required_sku, price_qc, min_identity_level,
      primary_storage_kind, primary_mime_type, primary_file_size_bytes, primary_content_state,
      storage_kinds,
      total_editions, issued_count, chain_minted_count,
      legendary_count, epic_count, rare_count, secret_black_rare_count,
      codex_slugs
    `)
    .order('series',         { ascending: true })
    .order('content_type',   { ascending: true })
    .order('display_number', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (series)      query = query.eq('series', series);
  if (contentKind) query = query.eq('content_kind', contentKind);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, hint: error.hint ?? null, code: error.code ?? null },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as RegistryRow[];

  // Lightweight summary so the operator can see "what's there" at a glance.
  const summary = {
    total_rows: rows.length,
    by_series: {} as Record<string, number>,
    by_content_type: {} as Record<string, number>,
    by_lifecycle_state: {} as Record<string, number>,
  };
  for (const r of rows) {
    summary.by_series[r.series]                   = (summary.by_series[r.series]                   ?? 0) + 1;
    summary.by_content_type[r.content_type]       = (summary.by_content_type[r.content_type]       ?? 0) + 1;
    summary.by_lifecycle_state[r.lifecycle_state] = (summary.by_lifecycle_state[r.lifecycle_state] ?? 0) + 1;
  }

  return NextResponse.json({ ok: true, data: { rows, summary } });
}
