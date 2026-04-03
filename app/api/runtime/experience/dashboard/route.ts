/**
 * GET /api/runtime/experience/dashboard
 *
 * Aggregate data for the Codex Experience Dashboard (COD-301–307).
 * Returns stage distribution, cohort breakdown, recent NBE plans,
 * and individual journey states with full CRM data for admin/operator views.
 *
 * Scoped to tenant_id when provided — e.g. tenantId=nakamoto for KNYT Codex.
 *
 * ?view=franchise  — stage + depth distribution, NBE opportunity summary
 * ?view=cohort     — per-stage counts, depth breakdown, stalled count
 *                    optional: &stage=keta to focus on a single stage
 * ?view=individual — paginated journey states with CRM fields + NBE + trust scores
 *                    optional: &stage=keta, &search=<name|fio_handle>
 * ?view=nbe        — active NBE plans + experience strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'franchise';
  const personaId = searchParams.get('personaId');
  const tenantId = searchParams.get('tenantId') ?? null;
  const stageFilter = searchParams.get('stage') ?? null;
  const searchQuery = searchParams.get('search') ?? null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 1000);

  function applyTenant<T extends ReturnType<typeof supabase.from>>(q: T): T {
    return (tenantId ? (q as any).eq('tenant_id', tenantId) : q) as T;
  }

  // ── Franchise view ──────────────────────────────────────────────────────────
  if (view === 'franchise') {
    // Paginate through ALL journey states — PostgREST hard-caps at 1000 rows
    // per request, so .limit(10000) alone is not sufficient.
    const allStages: { stage: string; depth: string }[] = [];
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: batch } = await applyTenant(
          supabase.from('journey_states').select('stage, depth').range(offset, offset + PAGE - 1)
        );
        if (!batch || batch.length === 0) break;
        allStages.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }
    }

    const distribution: Record<string, number> = {};
    const depthMap: Record<string, number> = {};
    for (const row of allStages) {
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
      tenant_id: tenantId,
      total_journeys: allStages.length,
      stage_distribution: distribution,
      depth_distribution: depthMap,
      nbe_opportunities: nbeOpportunities ?? [],
    });
  }

  // ── Cohort view ─────────────────────────────────────────────────────────────
  if (view === 'cohort') {
    // Paginate through all journey states — PostgREST hard-caps at 1000 rows
    const allCohortStates: { stage: string; depth: string; active_at: string | null }[] = [];
    {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        let batchQ = applyTenant(
          supabase.from('journey_states').select('stage, depth, active_at').range(offset, offset + PAGE - 1)
        );
        if (stageFilter) batchQ = (batchQ as any).eq('stage', stageFilter);
        const { data: batch } = await batchQ;
        if (!batch || batch.length === 0) break;
        allCohortStates.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }
    }
    const states = allCohortStates;

    const cohorts: Record<string, { count: number; depths: Record<string, number>; stalled: number }> = {};
    const now = Date.now();
    for (const s of states ?? []) {
      const key = s.stage;
      if (!cohorts[key]) cohorts[key] = { count: 0, depths: {}, stalled: 0 };
      cohorts[key].count++;
      cohorts[key].depths[s.depth] = (cohorts[key].depths[s.depth] ?? 0) + 1;
      if (s.active_at && now - new Date(s.active_at).getTime() > 30 * 24 * 3600 * 1000) {
        cohorts[key].stalled++;
      }
    }

    return NextResponse.json({
      view: 'cohort',
      tenant_id: tenantId,
      stage_filter: stageFilter,
      cohorts,
      total: states?.length ?? 0,
    });
  }

  // ── Individual view ─────────────────────────────────────────────────────────
  if (view === 'individual') {
    // Build journey_states query with optional filters
    let q = supabase
      .from('journey_states')
      .select('persona_id, stage, depth, current_experience_id, active_at')
      .order('active_at', { ascending: false })
      .limit(limit);

    if (tenantId) q = q.eq('tenant_id', tenantId) as typeof q;
    if (personaId) q = q.eq('persona_id', personaId) as typeof q;
    if (stageFilter) q = q.eq('stage', stageFilter) as typeof q;

    const { data: states } = await q;

    const personaIds = [...new Set((states ?? []).map((s) => s.persona_id))];

    // Fetch NBE plans, analysis cards, and CRM persona data in parallel
    const [nbePlansRes, analysisCardsRes, personasRes] = await Promise.all([
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
      // CRM data from the personas table
      personaIds.length
        ? supabase
            .from('personas')
            .select('id, display_name, fio_handle, order_tier, reputation_tier, reputation_score, reputation_bucket, status, created_at, badges')
            .in('id', personaIds)
        : { data: [] },
    ]);

    const nbeByPersona: Record<string, any> = {};
    for (const plan of nbePlansRes.data ?? []) {
      if (plan) nbeByPersona[plan.persona_id] = plan;
    }

    type TrustScores = { goal_alignment: number | null; stage_readiness: number | null; nbe_confidence: number | null };
    const trustByPersona: Record<string, TrustScores> = {};
    for (const card of analysisCardsRes.data ?? []) {
      if (!card) continue;
      if (!trustByPersona[card.persona_id]) {
        trustByPersona[card.persona_id] = { goal_alignment: null, stage_readiness: null, nbe_confidence: null };
      }
      if (card.card_type === 'goal_alignment') trustByPersona[card.persona_id].goal_alignment = card.score;
      if (card.card_type === 'stage_readiness') trustByPersona[card.persona_id].stage_readiness = card.score;
      if (card.card_type === 'nbe_confidence') trustByPersona[card.persona_id].nbe_confidence = card.score;
    }

    const crmByPersona: Record<string, any> = {};
    for (const p of personasRes.data ?? []) {
      if (p) crmByPersona[p.id] = p;
    }

    // Apply client-side search filter (display_name or fio_handle match)
    let individuals = (states ?? []).map((s) => ({
      ...s,
      nbe: nbeByPersona[s.persona_id] ?? null,
      trust_scores: trustByPersona[s.persona_id] ?? null,
      crm: crmByPersona[s.persona_id] ?? null,
    }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      individuals = individuals.filter((ind) => {
        const crm = ind.crm;
        return (
          ind.persona_id.toLowerCase().includes(q) ||
          (crm?.display_name ?? '').toLowerCase().includes(q) ||
          (crm?.fio_handle ?? '').toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({
      view: 'individual',
      tenant_id: tenantId,
      stage_filter: stageFilter,
      search: searchQuery,
      individuals,
    });
  }

  // ── NBE view ────────────────────────────────────────────────────────────────
  if (view === 'nbe') {
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
      tenant_id: tenantId,
      plans: plans ?? [],
      strategies: strategies ?? [],
    });
  }

  return NextResponse.json({ error: 'invalid view' }, { status: 400 });
}
