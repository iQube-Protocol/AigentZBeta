/**
 * GET /api/community-content/quota?personaId=…
 *
 * Returns the persona's current Q¢ pricing context for the remix flow:
 *   - costs for article + story (base + surcharged)
 *   - free generations remaining today
 *   - discard-refund eligibility today
 *
 * No body / mutations. Cheap enough to call on every remix dialog open.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

interface Settings {
  cost_qc_article: number;
  cost_qc_story: number;
  surcharge_pct: number;
  daily_free_quota: number;
  daily_discard_refund: number;
  discard_window_seconds: number;
}

interface Quota {
  persona_id: string;
  daily_free_used: number;
  daily_free_used_date: string;
  last_discard_refund_at: string | null;
  daily_refund_used_date: string | null;
}

const FALLBACK_SETTINGS: Settings = {
  cost_qc_article: 10,
  cost_qc_story: 6,
  surcharge_pct: 50,
  daily_free_quota: 3,
  daily_discard_refund: 1,
  discard_window_seconds: 30,
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function withSurcharge(base: number, pct: number): number {
  return Math.round(base * (1 + pct / 100));
}

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get('personaId')?.trim();
  if (!personaId) {
    return NextResponse.json({ ok: false, error: 'personaId required' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    const [settingsResult, quotaResult] = await Promise.all([
      supabase.from('community_content_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('community_content_quotas').select('*').eq('persona_id', personaId).maybeSingle(),
    ]);

    const settings: Settings = (settingsResult.data as Settings | null) ?? FALLBACK_SETTINGS;
    const quota: Quota | null = quotaResult.data as Quota | null;

    const today = todayISO();
    const usedFreeToday =
      quota && quota.daily_free_used_date === today ? quota.daily_free_used : 0;
    const freeRemaining = Math.max(0, settings.daily_free_quota - usedFreeToday);

    const refundUsedToday =
      quota?.daily_refund_used_date === today ? 1 : 0;
    const refundRemaining = Math.max(0, settings.daily_discard_refund - refundUsedToday);

    const surchargedArticle = withSurcharge(settings.cost_qc_article, settings.surcharge_pct);
    const surchargedStory   = withSurcharge(settings.cost_qc_story,   settings.surcharge_pct);

    return NextResponse.json({
      ok: true,
      personaId,
      freeRemaining,
      refundRemaining,
      costs: {
        article: {
          baseQc:       settings.cost_qc_article,
          surchargedQc: surchargedArticle,
          // The Q¢ figure to display NOW given the user's current quota state
          currentQc:    freeRemaining > 0 ? 0 : surchargedArticle,
        },
        story: {
          baseQc:       settings.cost_qc_story,
          surchargedQc: surchargedStory,
          currentQc:    freeRemaining > 0 ? 0 : surchargedStory,
        },
      },
      limits: {
        dailyFreeQuota:       settings.daily_free_quota,
        dailyDiscardRefund:   settings.daily_discard_refund,
        discardWindowSeconds: settings.discard_window_seconds,
        surchargePct:         settings.surcharge_pct,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
