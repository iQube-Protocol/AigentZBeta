/**
 * GET  /api/community-content/settings
 * POST /api/community-content/settings
 *
 * Admin-tunable Q¢ pricing + caps. Single-row config.
 *
 * GET: returns the current settings.
 * POST: { cost_qc_article?, cost_qc_story?, surcharge_pct?,
 *          daily_free_quota?, daily_discard_refund?,
 *          discard_window_seconds? } — partial update.
 *
 * Admin gating is UI-side (admin codex tab); this route mirrors the
 * pattern used by treasury-admin and other admin endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '../_lib/personaContext';
import { requireCommunityAdmin } from '../_lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK = {
  cost_qc_article: 10,
  cost_qc_story: 6,
  surcharge_pct: 50,
  daily_free_quota: 3,
  daily_discard_refund: 1,
  discard_window_seconds: 30,
};

export async function GET() {
  try {
    const supabase = getCommunityContentSupabase();
    const { data, error } = await supabase
      .from('community_content_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, settings: data ?? FALLBACK });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

interface SettingsPatch {
  adminPersonaId?: string;
  cost_qc_article?: number;
  cost_qc_story?: number;
  surcharge_pct?: number;
  daily_free_quota?: number;
  daily_discard_refund?: number;
  discard_window_seconds?: number;
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export async function POST(req: NextRequest) {
  let body: SettingsPatch;
  try {
    body = (await req.json()) as SettingsPatch;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getCommunityContentSupabase();
  const auth = await requireCommunityAdmin(supabase, body.adminPersonaId?.trim() || null);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const patch: Record<string, number> = {};
  const cArticle = clampInt(body.cost_qc_article, 0, 1000);
  const cStory   = clampInt(body.cost_qc_story,   0, 1000);
  const surcharge = clampInt(body.surcharge_pct,  0, 500);
  const freeQuota = clampInt(body.daily_free_quota,    0, 100);
  const refund    = clampInt(body.daily_discard_refund, 0, 100);
  const window_   = clampInt(body.discard_window_seconds, 5, 600);

  if (cArticle !== null) patch.cost_qc_article = cArticle;
  if (cStory   !== null) patch.cost_qc_story   = cStory;
  if (surcharge !== null) patch.surcharge_pct = surcharge;
  if (freeQuota !== null) patch.daily_free_quota = freeQuota;
  if (refund    !== null) patch.daily_discard_refund = refund;
  if (window_   !== null) patch.discard_window_seconds = window_;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid fields in patch' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('community_content_settings')
      .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, settings: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
