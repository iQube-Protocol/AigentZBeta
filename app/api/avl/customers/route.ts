/**
 * GET /api/avl/customers
 *
 * MVL-scoped customer list: persona data joined with nakamoto investment signals
 * and journey ladder stage. Purpose-built for pipeline conversion analysis.
 *
 * Query params:
 *   search?          — partial match across name/email/knyt_id (separate ilike, no OR%)
 *   cohort?          — campaign_cohort exact match
 *   campaign_state?  — campaign_state exact match
 *   stage?           — journey_states.stage exact match (zero | first | keta | keji)
 *   ks_backed?       — "true" | "false" — filter by Kickstarter backer status
 *   limit?           — default 50, max 200
 *   offset?          — default 0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function investmentBand(totalInvested: string): string {
  const amount = parseFloat(totalInvested.replace(/[^0-9.]/g, '')) || 0;
  if (amount >= 10000) return '$10k+';
  if (amount >= 5000)  return '$5k–$10k';
  if (amount >= 2000)  return '$2k–$5k';
  if (amount >= 500)   return '$500–$2k';
  if (amount > 0)      return '<$500';
  return 'none';
}

function isKsBacked(csvStatus: string): boolean {
  const s = csvStatus.toLowerCase();
  return s.includes('ks') || s.includes('kickstarter') || s.includes('backer');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search         = searchParams.get('search')?.trim() ?? '';
  const cohort         = searchParams.get('cohort')?.trim() ?? '';
  const campaign_state = searchParams.get('campaign_state')?.trim() ?? '';
  const stage          = searchParams.get('stage')?.trim() ?? '';
  const ksFilter       = searchParams.get('ks_backed') ?? '';
  const limit          = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const offset         = parseInt(searchParams.get('offset') ?? '0', 10);

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  try {
    // ── Resolve persona IDs from search term ──────────────────────────────────
    let searchPersonaIds: Set<string> | null = null;
    if (search) {
      const like = `%${search}%`;
      const [fnRes, lnRes, dispRes, emailRes] = await Promise.all([
        supabase.from('crm_personas').select('identity_persona_id').ilike('first_name', like).not('identity_persona_id', 'is', null).limit(500),
        supabase.from('crm_personas').select('identity_persona_id').ilike('last_name', like).not('identity_persona_id', 'is', null).limit(500),
        supabase.from('crm_personas').select('identity_persona_id').ilike('display_name', like).not('identity_persona_id', 'is', null).limit(500),
        supabase.from('nakamoto_knyt_personas').select('id').ilike('Email', like).limit(500),
      ]);
      searchPersonaIds = new Set<string>();
      for (const r of fnRes.data ?? [])    if (r?.identity_persona_id) searchPersonaIds.add(r.identity_persona_id);
      for (const r of lnRes.data ?? [])    if (r?.identity_persona_id) searchPersonaIds.add(r.identity_persona_id);
      for (const r of dispRes.data ?? [])  if (r?.identity_persona_id) searchPersonaIds.add(r.identity_persona_id);
      // email matches from nakamoto — include their IDs directly
      for (const r of emailRes.data ?? []) if (r?.id) searchPersonaIds.add(r.id as string);
    }

    // ── Load nakamoto personas ─────────────────────────────────────────────────
    let query = supabase
      .from('nakamoto_knyt_personas')
      .select('id, "First-Name", "Last-Name", "Email", "KNYT-ID", "Total-Invested", "csv_investment_status", "OM-Tier-Status", campaign_cohort, campaign_state')
      .order('"First-Name"', { ascending: true });

    if (cohort)         query = query.eq('campaign_cohort', cohort);
    if (campaign_state) query = query.eq('campaign_state', campaign_state);

    const { data: personas, error: pErr } = await query.limit(3000);
    if (pErr) throw pErr;

    // ── Load journey stages for matching persona IDs ──────────────────────────
    const personaIds = (personas ?? []).map((p) => (p as { id: string }).id);
    const { data: journeyRows } = await supabase
      .from('journey_states')
      .select('persona_id, stage, depth')
      .in('persona_id', personaIds.slice(0, 1000));

    const stageMap = new Map<string, { stage: string; depth: string }>();
    for (const row of journeyRows ?? []) {
      stageMap.set(
        (row as { persona_id: string }).persona_id,
        { stage: (row as { stage: string }).stage, depth: (row as { depth: string }).depth },
      );
    }

    // ── Build result rows ─────────────────────────────────────────────────────
    let results = (personas ?? []).map((p) => {
      const id       = str(p['id' as keyof typeof p]);
      const invested = str(p['Total-Invested' as keyof typeof p]);
      const csvStat  = str(p['csv_investment_status' as keyof typeof p]);
      const journey  = stageMap.get(id);
      return {
        persona_id:      id,
        display_name:    [str(p['First-Name' as keyof typeof p]), str(p['Last-Name' as keyof typeof p])].filter(Boolean).join(' ') || 'Unknown',
        email:           str(p['Email' as keyof typeof p]),
        knyt_id:         str(p['KNYT-ID' as keyof typeof p]),
        cohort:          (p['campaign_cohort' as keyof typeof p] as string | null) ?? null,
        campaign_state:  (p['campaign_state' as keyof typeof p] as string | null) ?? null,
        om_tier:         str(p['OM-Tier-Status' as keyof typeof p]),
        ladder_stage:    journey?.stage ?? null,
        ladder_depth:    journey?.depth ?? null,
        investment_band: investmentBand(invested),
        total_invested:  invested,
        ks_backed:       isKsBacked(csvStat),
        offer_fit:       journey?.stage && ['zero', 'first', 'keta'].includes(journey.stage) ? 'high' : invested ? 'medium' : 'low',
      };
    });

    // ── Apply in-memory filters ───────────────────────────────────────────────
    if (searchPersonaIds) {
      results = results.filter((r) => {
        if (searchPersonaIds!.has(r.persona_id)) return true;
        // Also match KNYT-ID directly
        const s = search.toLowerCase();
        return r.display_name.toLowerCase().includes(s) || r.knyt_id.toLowerCase().includes(s);
      });
    }
    if (stage) {
      results = results.filter((r) => r.ladder_stage === stage);
    }
    if (ksFilter === 'true')  results = results.filter((r) => r.ks_backed);
    if (ksFilter === 'false') results = results.filter((r) => !r.ks_backed);

    const total = results.length;
    const page  = results.slice(offset, offset + limit);

    return NextResponse.json({ ok: true, data: { customers: page, total, offset, limit } });
  } catch (err) {
    console.error('[avl/customers] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load customers' }, { status: 500 });
  }
}
