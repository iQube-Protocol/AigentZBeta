/**
 * GET /api/mvl/customers/[personaId]
 *
 * Returns full profile for a single customer persona.
 * Joins nakamoto_knyt_personas + crm_personas + journey_states.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function GET(_req: NextRequest, props: { params: Promise<{ personaId: string }> }) {
  const params = await props.params;
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const { personaId } = params;
  if (!personaId) return NextResponse.json({ ok: false, error: 'personaId required' }, { status: 400 });

  try {
    const [{ data: nak }, { data: crm }, { data: journey }] = await Promise.all([
      supabase.from('nakamoto_knyt_personas').select('*').eq('id', personaId).maybeSingle(),
      supabase.from('crm_personas').select('*').eq('identity_persona_id', personaId).maybeSingle(),
      supabase.from('journey_states').select('stage, depth, active_at, updated_at').eq('persona_id', personaId).maybeSingle(),
    ]);

    if (!nak && !crm) {
      return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
    }

    const nakRow = (nak ?? {}) as Record<string, unknown>;
    const crmRow = (crm ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      ok: true,
      data: {
        persona_id:       personaId,
        display_name:     str(crmRow.display_name) || [str(nakRow['First-Name']), str(nakRow['Last-Name'])].filter(Boolean).join(' '),
        email:            str(nakRow['Email']) || str(crmRow.email),
        knyt_id:          str(nakRow['KNYT-ID']),
        om_tier:          str(nakRow['OM-Tier-Status']),
        total_invested:   str(nakRow['Total-Invested']),
        shares:           str(nakRow['Metaiye-Shares-Owned']),
        knyt_coyn:        str(nakRow['KNYT-COYN-Owned']),
        campaign_cohort:  (nakRow['campaign_cohort'] as string | null) ?? null,
        campaign_state:   (nakRow['campaign_state'] as string | null) ?? null,
        csv_inv_status:   str(nakRow['csv_investment_status']),
        ladder_stage:     (journey as { stage?: string } | null)?.stage ?? null,
        ladder_depth:     (journey as { depth?: string } | null)?.depth ?? null,
        ladder_active_at: (journey as { active_at?: string } | null)?.active_at ?? null,
        fio_handle:       str(crmRow.fio_handle),
        reputation_score: (crmRow.reputation_score as number | null) ?? null,
      },
    });
  } catch (err) {
    console.error('[mvl/customers/[personaId]] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load customer' }, { status: 500 });
  }
}
