/**
 * KNYT Living Canon — Reward Grants View
 *
 * Returns a persona's reward grant history for Living Canon activities.
 * Includes milestone history from knyt_order_milestones.
 *
 * GET /api/codex/knyt/living-canon/rewards?persona_id=<id>[&limit=<n>]
 *   Returns: { grants[], milestones[], summary }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('persona_id');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

    if (!personaId) {
      return NextResponse.json({ error: 'persona_id query param required' }, { status: 400 });
    }

    const [grantsResult, milestonesResult] = await Promise.all([
      supabase
        .from('knyt_reward_grants')
        .select('id, task_type, amount_knyt, base_amount_knyt, rep_multiplier, source_event_id, metadata, created_at')
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false })
        .limit(limit),

      supabase
        .from('knyt_order_milestones')
        .select('id, tier, achieved_at, reward_granted, autodrive_cid')
        .eq('persona_id', personaId)
        .order('achieved_at', { ascending: true }),
    ]);

    const grants = grantsResult.data ?? [];
    const milestones = milestonesResult.data ?? [];

    // Summary totals
    const totalEarned = grants.reduce((sum, g) => sum + Number(g.amount_knyt), 0);
    const byType = grants.reduce<Record<string, number>>((acc, g) => {
      acc[g.task_type] = (acc[g.task_type] ?? 0) + Number(g.amount_knyt);
      return acc;
    }, {});

    return NextResponse.json({
      grants,
      milestones,
      summary: {
        total_earned_knyt: totalEarned,
        by_type: byType,
        grant_count: grants.length,
        milestone_count: milestones.length,
      },
    });
  } catch (err) {
    console.error('[living-canon/rewards] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
