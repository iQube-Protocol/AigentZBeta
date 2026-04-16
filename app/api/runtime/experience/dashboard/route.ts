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
 * ?view=matrix     — aggregate investor cell distribution for KNYT experience matrix
 *                    reads nakamoto_knyt_personas, maps OM-Tier-Status → X-axis,
 *                    all investors default to Y=Collector (they hold collectibles)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCrmClient } from '@/services/crm/crmDataAccess';

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
    // Build all WHERE filters FIRST, then apply order + limit
    // (chaining .eq() after .limit() can silently drop filters in some client versions)
    let baseQ = supabase
      .from('journey_states')
      .select('persona_id, stage, depth, current_experience_id, active_at');

    if (tenantId) baseQ = (baseQ as any).eq('tenant_id', tenantId);
    if (personaId) baseQ = (baseQ as any).eq('persona_id', personaId);
    if (stageFilter) baseQ = (baseQ as any).eq('stage', stageFilter);

    // When a search query is present, resolve matching persona_ids from the CRM
    // tables first — this ensures search works across ALL records, not just the
    // paginated window (the recency-ordered limit would otherwise hide older records).
    if (searchQuery) {
      const like = `%${searchQuery}%`;
      const [personaHitsRes, crmHitsRes, jsHitsRes] = await Promise.all([
        supabase
          .from('personas')
          .select('id')
          .or(`display_name.ilike.${like},fio_handle.ilike.${like},id.ilike.${like}`),
        supabase
          .from('crm_personas')
          .select('identity_persona_id')
          .or(`display_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},fio_handle.ilike.${like}`),
        supabase
          .from('journey_states')
          .select('persona_id')
          .ilike('persona_id', like),
      ]);

      const matchingIds = new Set<string>();
      for (const p of personaHitsRes.data ?? []) if (p?.id) matchingIds.add(p.id);
      for (const cp of crmHitsRes.data ?? []) if (cp?.identity_persona_id) matchingIds.add(cp.identity_persona_id);
      for (const js of jsHitsRes.data ?? []) if (js?.persona_id) matchingIds.add(js.persona_id);

      if (matchingIds.size === 0) {
        return NextResponse.json({
          view: 'individual',
          tenant_id: tenantId,
          stage_filter: stageFilter,
          search: searchQuery,
          total: 0,
          individuals: [],
        });
      }

      baseQ = (baseQ as any).in('persona_id', [...matchingIds]);
    }

    const { data: states, error: statesError } = await (baseQ as any)
      .order('active_at', { ascending: false })
      .limit(searchQuery ? 500 : limit);

    if (statesError) {
      return NextResponse.json(
        { error: `journey_states query failed: ${statesError.message}`, hint: statesError.hint ?? null },
        { status: 500 }
      );
    }

    const personaIds = [...new Set((states ?? []).map((s: any) => s.persona_id))];

    // Fetch NBE plans, analysis cards, and CRM persona data in parallel
    const [nbePlansRes, analysisCardsRes, personasRes, crmPersonasRes] = await Promise.all([
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
      // Primary CRM data from the personas table
      personaIds.length
        ? supabase
            .from('personas')
            .select('id, display_name, fio_handle, order_tier, reputation_tier, reputation_score, reputation_bucket, status, created_at, badges')
            .in('id', personaIds)
        : { data: [] },
      // Fallback enrichment from crm_personas via identity_persona_id link
      personaIds.length
        ? supabase
            .from('crm_personas')
            .select('identity_persona_id, id, email, first_name, last_name, fio_handle, display_name, knyt_id, order_tier')
            .in('identity_persona_id', personaIds)
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

    // Build crm_personas fallback map (keyed by identity_persona_id)
    const crmFallbackByPersona: Record<string, any> = {};
    for (const cp of crmPersonasRes.data ?? []) {
      if (cp?.identity_persona_id) {
        const name = cp.display_name ||
          ((cp.first_name || cp.last_name) ? `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim() : null);
        crmFallbackByPersona[cp.identity_persona_id] = {
          display_name: name,
          fio_handle: cp.fio_handle,
          order_tier: cp.order_tier,
          knyt_id: cp.knyt_id,
          email: cp.email,
        };
      }
    }

    const crmByPersona: Record<string, any> = {};
    for (const p of personasRes.data ?? []) {
      if (!p) continue;
      const fallback = crmFallbackByPersona[p.id] ?? {};
      crmByPersona[p.id] = {
        ...p,
        // Enrich with crm_personas fields when personas table fields are null
        display_name: p.display_name || fallback.display_name || null,
        fio_handle: p.fio_handle || fallback.fio_handle || null,
        order_tier: p.order_tier || fallback.order_tier || null,
        knyt_id: fallback.knyt_id || null,
        email: fallback.email || null,
      };
    }
    // Also seed crmByPersona for personas that had no row in personas table
    // but do have a crm_personas entry linked by identity_persona_id
    for (const [pid, fallback] of Object.entries(crmFallbackByPersona)) {
      if (!crmByPersona[pid]) crmByPersona[pid] = fallback;
    }

    // Apply client-side search filter (display_name or fio_handle match)
    let individuals = (states ?? []).map((s: any) => ({
      ...s,
      nbe: nbeByPersona[s.persona_id] ?? null,
      trust_scores: trustByPersona[s.persona_id] ?? null,
      crm: crmByPersona[s.persona_id] ?? null,
    }));

    // Note: when searchQuery is present the persona_id IN filter above already
    // scopes results to exact matches — no further client-side filtering needed.

    return NextResponse.json({
      view: 'individual',
      tenant_id: tenantId,
      stage_filter: stageFilter,
      search: searchQuery,
      total: individuals.length,
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

  // ── Matrix distribution view ──────────────────────────────────────────────────
  // Reads nakamoto_knyt_personas to build aggregate cell counts for the KNYT
  // experience matrix.
  // Y-axis:
  //   - Has resolved tier (OM-Tier-Status or derived from Total-Invested) → Collector
  //   - No tier / no investment                                            → Observer
  // X-axis: derived from tier value (Keta/Keji/First/Zero/Sat KNYT/Prospect)
  if (view === 'matrix') {
    // OM-Tier-Status (or amount-derived tier) → x_stage label in the KNYT matrix
    const TIER_TO_X: Record<string, string> = {
      SAT: 'Sat KNYT', ZERO: 'Zero', FIRST: 'First', KEJI: 'Keji', KETA: 'Keta',
    };

    // Mirrors normalizeTier() in scripts/import-nakamoto-to-qubebase.js.
    // Raw DB values can be "Sat KNYT", "SAT", "Zero", "ZERO KNYT", etc.
    // Strip all non-alpha chars then substring-match to get the canonical key.
    function normalizeTierKey(raw: string): string {
      const c = raw.toUpperCase().replace(/[^A-Z]/g, '');
      if (c.includes('SAT'))   return 'SAT';
      if (c.includes('ZERO'))  return 'ZERO';
      if (c.includes('FIRST')) return 'FIRST';
      if (c.includes('KEJI'))  return 'KEJI';
      if (c.includes('KETA'))  return 'KETA';
      return '';
    }

    // Mirrors tierFromInvested() in scripts/import-nakamoto-to-qubebase.js
    function deriveTierFromAmount(amount: number): string {
      if (amount >= 25000) return 'SAT';
      if (amount >= 1000)  return 'ZERO';
      if (amount >= 500)   return 'FIRST';
      if (amount >= 250)   return 'KEJI';
      if (amount >= 100)   return 'KETA';
      return '';
    }

    const crmClient = getCrmClient();
    const tierCounts: Record<string, number> = {};
    let totalInvestors = 0;
    let totalProspects = 0;
    let page = 0;
    const PAGE = 1000;

    // Paginate through all records — PostgREST hard-caps at 1000 per request.
    // Use select('*') — hyphenated column names cannot be reliably quoted in
    // the Supabase JS client's select() string syntax.
    while (true) {
      const { data, error } = await crmClient
        .from('nakamoto_knyt_personas')
        .select('*')
        .range(page * PAGE, (page + 1) * PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const r = row as Record<string, unknown>;

        // Prefer explicit OM-Tier-Status; fall back to investment amount.
        // normalizeTierKey handles raw CSV variants: "Sat KNYT", "SAT KNYT", "SAT", "Zero", etc.
        let tier = normalizeTierKey((r['OM-Tier-Status'] as string) || '');
        if (!tier) {
          const investedRaw = String(r['Total-Invested'] || '0');
          const invested = parseFloat(investedRaw.replace(/[^0-9.]/g, '')) || 0;
          tier = deriveTierFromAmount(invested);
        }

        if (tier) {
          // Has a resolved tier → actual investor (Collector on Y-axis)
          tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
          totalInvestors++;
        } else {
          // No tier, no investment → prospect (Observer on Y-axis)
          totalProspects++;
        }
      }
      if (data.length < PAGE) break;
      page++;
    }

    // Build cell map
    // Investors: Y=Collector, X from resolved tier
    const cells: Record<string, number> = {};
    for (const [tier, count] of Object.entries(tierCounts)) {
      const xStage = TIER_TO_X[tier] ?? 'Prospect';
      cells[`Collector:${xStage}`] = (cells[`Collector:${xStage}`] ?? 0) + count;
    }
    // Prospects: Y=Observer, X=Prospect
    if (totalProspects > 0) {
      cells['Observer:Prospect'] = (cells['Observer:Prospect'] ?? 0) + totalProspects;
    }

    return NextResponse.json({
      view: 'matrix',
      total: totalInvestors + totalProspects,
      total_investors: totalInvestors,
      total_prospects: totalProspects,
      y_default: 'Collector',
      tier_distribution: tierCounts,
      cells,
    });
  }

  return NextResponse.json({ error: 'invalid view' }, { status: 400 });
}
