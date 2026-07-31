/**
 * /api/ops/sync/calibration
 *
 *   GET  → returns current ops_anchor_config row
 *   PUT  → updates K / T / cron cadence / paused state
 *
 * Admin-gated (cartridgeFlags.isAdmin). Edits land in the single-row
 * ops_anchor_config table; the cron-tick endpoint reads from it on
 * every tick so changes take effect immediately on the next scheduled
 * fire (no redeploy needed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConfigRow {
  batch_size_k: number;
  max_age_minutes_t: number;
  cron_cadence_seconds: number;
  is_paused: boolean;
  updated_at: string;
}

const DEFAULT: ConfigRow = {
  batch_size_k: 50,
  max_age_minutes_t: 15,
  cron_cadence_seconds: 60,
  is_paused: false,
  updated_at: new Date(0).toISOString(),
};

export async function GET(_request: NextRequest) {
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ ...DEFAULT, note: 'supabase_unavailable, returning defaults' });

  const { data } = await sb.from('ops_anchor_config').select('*').eq('id', 1).maybeSingle();
  if (!data) return NextResponse.json(DEFAULT);

  return NextResponse.json({
    batch_size_k: Number((data as any).batch_size_k),
    max_age_minutes_t: Number((data as any).max_age_minutes_t),
    cron_cadence_seconds: Number((data as any).cron_cadence_seconds),
    is_paused: Boolean((data as any).is_paused),
    updated_at: (data as any).updated_at,
  });
}

interface PutBody {
  batch_size_k?: number;
  max_age_minutes_t?: number;
  cron_cadence_seconds?: number;
  is_paused?: boolean;
}

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r < min ? min : r > max ? max : r;
}

export async function PUT(request: NextRequest) {
  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.batch_size_k !== undefined) {
    const v = clampInt(body.batch_size_k, 1, 10000);
    if (v === null) return NextResponse.json({ error: 'invalid_batch_size_k' }, { status: 400 });
    update.batch_size_k = v;
  }
  if (body.max_age_minutes_t !== undefined) {
    const v = clampInt(body.max_age_minutes_t, 1, 1440);
    if (v === null) return NextResponse.json({ error: 'invalid_max_age_minutes_t' }, { status: 400 });
    update.max_age_minutes_t = v;
  }
  if (body.cron_cadence_seconds !== undefined) {
    const v = clampInt(body.cron_cadence_seconds, 10, 3600);
    if (v === null) return NextResponse.json({ error: 'invalid_cron_cadence_seconds' }, { status: 400 });
    update.cron_cadence_seconds = v;
  }
  if (body.is_paused !== undefined) {
    update.is_paused = Boolean(body.is_paused);
  }

  const { data, error } = await sb
    .from('ops_anchor_config')
    .update(update)
    .eq('id', 1)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'update_failed', detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({
    batch_size_k: Number((data as any).batch_size_k),
    max_age_minutes_t: Number((data as any).max_age_minutes_t),
    cron_cadence_seconds: Number((data as any).cron_cadence_seconds),
    is_paused: Boolean((data as any).is_paused),
    updated_at: (data as any).updated_at,
  });
}
