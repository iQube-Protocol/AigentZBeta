/**
 * GET /api/avl/partners/pipeline
 *
 * Returns aggregated BD pipeline stats grouped by stage.
 * Used by the Partners panel pipeline view and Reports panel.
 *
 * Response: { ok, data: { stages: StageCount[], by_tier: TierCount[], by_wave: WaveCount[], timeline: Event[] } }
 */

import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const STAGE_ORDER = [
  'uncontacted',
  'first_contact',
  'responded',
  'active',
  'co_activation_agreed',
  'integration_scoped',
  'integration_active',
  'live_partner',
  'low_signal',
];

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  try {
    const [{ data: partners, error: pErr }, { data: events, error: eErr }] = await Promise.all([
      supabase.from('avl_partner_contacts').select('*'),
      supabase
        .from('avl_partner_stage_events')
        .select('partner_id, to_stage, changed_at')
        .order('changed_at', { ascending: false })
        .limit(50),
    ]);

    if (pErr) throw pErr;
    if (eErr) throw eErr;

    const list = (partners ?? []) as Array<{
      id: string; name: string; org: string; wave: number;
      bd_stage: string; outreach_status: string;
      strategic_value_tier: number | null;
      response_signal: string | null;
    }>;

    const stageCounts = STAGE_ORDER.map((stage) => ({
      stage,
      count: list.filter((p) => p.bd_stage === stage).length,
      tier1_count: list.filter((p) => p.bd_stage === stage && p.strategic_value_tier === 1).length,
    }));

    const byTier = [1, 2, 3].map((tier) => ({
      tier,
      count: list.filter((p) => p.strategic_value_tier === tier).length,
      active: list.filter((p) => p.strategic_value_tier === tier && !['uncontacted', 'low_signal'].includes(p.bd_stage)).length,
    }));

    const byWave = [1, 2].map((wave) => ({
      wave,
      count: list.filter((p) => p.wave === wave).length,
      responded: list.filter((p) => p.wave === wave && p.outreach_status === 'responded').length,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        total: list.length,
        stages: stageCounts,
        by_tier: byTier,
        by_wave: byWave,
        recent_events: events ?? [],
      },
    });
  } catch (err) {
    console.error('[avl/partners/pipeline] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load pipeline' }, { status: 500 });
  }
}
