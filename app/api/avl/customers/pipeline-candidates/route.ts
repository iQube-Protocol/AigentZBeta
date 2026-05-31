/**
 * GET /api/avl/customers/pipeline-candidates
 *
 * Returns highest-priority MVL pipeline candidates in priority order:
 *   1. Zero KNYT stage + ks_backed
 *   2. First KNYT stage + ks_backed
 *   3. Recruiter campaign_state
 *   4. investment_band >= $2,000 + Zero/First stage
 *
 * Limit: 100 candidates. Used by the pipeline view in RelationshipBuilderTab.
 */

import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function investedAmount(totalInvested: string): number {
  return parseFloat(totalInvested.replace(/[^0-9.]/g, '')) || 0;
}

function investmentBand(amount: number): string {
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

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  try {
    const { data: personas, error: pErr } = await supabase
      .from('nakamoto_knyt_personas')
      .select('id, "First-Name", "Last-Name", "Email", "KNYT-ID", "Total-Invested", "csv_investment_status", "OM-Tier-Status", campaign_cohort, campaign_state')
      .limit(3000);

    if (pErr) throw pErr;

    const personaIds = (personas ?? []).map((p) => (p as { id: string }).id);

    const { data: journeyRows } = await supabase
      .from('journey_states')
      .select('persona_id, stage, depth')
      .in('persona_id', personaIds.slice(0, 1000));

    const stageMap = new Map<string, string>();
    for (const row of journeyRows ?? []) {
      stageMap.set(
        (row as { persona_id: string }).persona_id,
        (row as { stage: string }).stage,
      );
    }

    type Candidate = {
      persona_id: string;
      display_name: string;
      email: string;
      knyt_id: string;
      ladder_stage: string | null;
      investment_band: string;
      total_invested: number;
      ks_backed: boolean;
      campaign_state: string | null;
      priority_tier: number;
      priority_label: string;
    };

    const candidates: Candidate[] = [];

    for (const p of personas ?? []) {
      const id       = str(p['id' as keyof typeof p]);
      const invested = str(p['Total-Invested' as keyof typeof p]);
      const csvStat  = str(p['csv_investment_status' as keyof typeof p]);
      const amount   = investedAmount(invested);
      const ksBacked = isKsBacked(csvStat);
      const ladderStage = stageMap.get(id) ?? null;
      const campState = (p['campaign_state' as keyof typeof p] as string | null) ?? null;

      let priority_tier = 0;
      let priority_label = '';

      if (ladderStage === 'zero' && ksBacked) {
        priority_tier = 4; priority_label = 'Zero + KS Backed';
      } else if (ladderStage === 'first' && ksBacked) {
        priority_tier = 3; priority_label = 'First + KS Backed';
      } else if (campState === 'recruiter') {
        priority_tier = 2; priority_label = 'Recruiter';
      } else if (amount >= 2000 && ['zero', 'first'].includes(ladderStage ?? '')) {
        priority_tier = 1; priority_label = '$2k+ + Zero/First';
      }

      if (priority_tier === 0) continue;

      candidates.push({
        persona_id:      id,
        display_name:    [str(p['First-Name' as keyof typeof p]), str(p['Last-Name' as keyof typeof p])].filter(Boolean).join(' ') || 'Unknown',
        email:           str(p['Email' as keyof typeof p]),
        knyt_id:         str(p['KNYT-ID' as keyof typeof p]),
        ladder_stage:    ladderStage,
        investment_band: investmentBand(amount),
        total_invested:  amount,
        ks_backed:       ksBacked,
        campaign_state:  campState,
        priority_tier,
        priority_label,
      });
    }

    candidates.sort((a, b) => b.priority_tier - a.priority_tier || b.total_invested - a.total_invested);

    return NextResponse.json({
      ok: true,
      data: {
        candidates: candidates.slice(0, 100),
        total: candidates.length,
        summary: {
          zero_ks:    candidates.filter((c) => c.priority_tier === 4).length,
          first_ks:   candidates.filter((c) => c.priority_tier === 3).length,
          recruiter:  candidates.filter((c) => c.priority_tier === 2).length,
          high_value: candidates.filter((c) => c.priority_tier === 1).length,
        },
      },
    });
  } catch (err) {
    console.error('[avl/customers/pipeline-candidates] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load pipeline candidates' }, { status: 500 });
  }
}
