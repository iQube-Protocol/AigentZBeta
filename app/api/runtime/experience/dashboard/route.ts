/**
 * GET /api/runtime/experience/dashboard
 *
 * Aggregate data for the Codex Experience Dashboard (COD-301–307).
 * Returns stage distribution, cohort breakdown, recent NBE plans,
 * and individual journey states for admin/operator views.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'franchise'; // franchise | cohort | individual | nbe
  const cohortKey = searchParams.get('cohort');
  const personaId = searchParams.get('personaId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  if (view === 'franchise') {
    // Stage distribution + funnel health
    const { data: stages } = await supabase
      .from('journey_states')
      .select('stage, depth')
      .order('active_at', { ascending: false });

    const distribution: Record<string, number> = {};
    const depthMap: Record<string, number> = {};
    for (const row of stages ?? []) {
      distribution[row.stage] = (distribution[row.stage] ?? 0) + 1;
      depthMap[row.depth] = (depthMap[row.depth] ?? 0) + 1;
    }

    const { data: nbeOpportunities } = await supabase
      .from('nbe_plans')
      .select('disposition, experience_id')
      .is('expires_at', null)
      .limit(20);

    return NextResponse.json({
      view: 'franchise',
      total_journeys: stages?.length ?? 0,
      stage_distribution: distribution,
      depth_distribution: depthMap,
      nbe_opportunities: nbeOpportunities ?? [],
    });
  }

  if (view === 'cohort') {
    // Group journey states by metadata cohort field if available, else by stage
    const { data: states } = await supabase
      .from('journey_states')
      .select('persona_id, stage, depth, active_at')
      .order('active_at', { ascending: false })
      .limit(limit);

    // Group by stage as proxy for cohort until CRM binding is live
    const cohorts: Record<string, { count: number; depths: Record<string, number>; stalled: number }> = {};
    const now = Date.now();
    for (const s of states ?? []) {
      const key = cohortKey ?? s.stage;
      if (!cohorts[key]) cohorts[key] = { count: 0, depths: {}, stalled: 0 };
      cohorts[key].count++;
      cohorts[key].depths[s.depth] = (cohorts[key].depths[s.depth] ?? 0) + 1;
      // Stalled = no activity in 30 days
      if (s.active_at && now - new Date(s.active_at).getTime() > 30 * 24 * 3600 * 1000) {
        cohorts[key].stalled++;
      }
    }

    return NextResponse.json({ view: 'cohort', cohorts, total: states?.length ?? 0 });
  }

  if (view === 'individual') {
    const query = supabase
      .from('journey_states')
      .select('persona_id, stage, depth, current_experience_id, active_at')
      .order('active_at', { ascending: false })
      .limit(limit);

    if (personaId) query.eq('persona_id', personaId);

    const { data: states } = await query;

    // Fetch NBE plans and analysis cards for these personas
    const personaIds = [...new Set((states ?? []).map((s) => s.persona_id))];

    const [nbePlansRes, analysisCardsRes] = await Promise.all([
      personaIds.length
        ? supabase
            .from('nbe_plans')
            .select('persona_id, disposition, next_experience_depth, rationale')
            .in('persona_id', personaIds)
            .is('expires_at', null)
        : { data: [] },
      personaIds.length
        ? supabase
            .from('analysis_cards')
            .select('persona_id, card_type, score')
            .in('persona_id', personaIds)
            .not('score', 'is', null)
        : { data: [] },
    ]);

    const nbeByPersona: Record<string, (typeof nbePlansRes.data)[0]> = {};
    for (const plan of nbePlansRes.data ?? []) {
      nbeByPersona[plan.persona_id] = plan;
    }

    // COD-601 — aggregate trust scores per persona from analysis cards
    type TrustScores = { goal_alignment: number | null; stage_readiness: number | null; nbe_confidence: number | null };
    const trustByPersona: Record<string, TrustScores> = {};
    for (const card of analysisCardsRes.data ?? []) {
      if (!trustByPersona[card.persona_id]) {
        trustByPersona[card.persona_id] = { goal_alignment: null, stage_readiness: null, nbe_confidence: null };
      }
      if (card.card_type === 'goal_alignment') trustByPersona[card.persona_id].goal_alignment = card.score;
      if (card.card_type === 'stage_readiness') trustByPersona[card.persona_id].stage_readiness = card.score;
      if (card.card_type === 'nbe_confidence') trustByPersona[card.persona_id].nbe_confidence = card.score;
    }

    return NextResponse.json({
      view: 'individual',
      individuals: (states ?? []).map((s) => ({
        ...s,
        nbe: nbeByPersona[s.persona_id] ?? null,
        trust_scores: trustByPersona[s.persona_id] ?? null,
      })),
    });
  }

  if (view === 'nbe') {
    // Admin NBE planner — all active plans with rationale
    const { data: plans } = await supabase
      .from('nbe_plans')
      .select('persona_id, experience_id, disposition, next_experience_depth, rationale, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: strategies } = await supabase
      .from('experience_strategies')
      .select('id, name, target_segments')
      .eq('active', true);

    return NextResponse.json({
      view: 'nbe',
      plans: plans ?? [],
      strategies: strategies ?? [],
    });
  }

  return NextResponse.json({ error: 'invalid view' }, { status: 400 });
}
