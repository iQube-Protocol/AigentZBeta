/**
 * GET /api/mobility/cases/[caseId]/export
 *
 * Returns the full MAF as a downloadable JSON file.
 * Strips T0 identifiers (owner_persona_id, assigned_case_manager_id).
 * Includes all profile sections, critical dates, workstreams, SRB, and IES status.
 *
 * T0 discipline: caseId server-side only; owner identity stripped from export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function canAccess(
  personaId: string,
  caseId: string,
  isAdmin: boolean,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase
    .from('mobility_cases')
    .select('id')
    .eq('id', caseId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest, props: { params: Promise<{ caseId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = !!persona.cartridgeFlags?.isAdmin;

    if (!(await canAccess(persona.personaId, params.caseId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const [caseRes, datesRes, workstreamsRes] = await Promise.all([
      supabase
        .from('mobility_cases')
        .select(
          'case_type, priority_level, classification, case_status, ' +
          'intake_sections_complete, ' +
          'household_profile, capability_profile, continuity_profile, ' +
          'standing_profile, housing_profile, education_profile, ' +
          'business_profile, financial_profile, mobility_profile, ' +
          'family_profile, confidentiality_profile, ' +
          'capability_score, continuity_score, recovery_velocity_class, ' +
          'standing_risk_level, housing_risk_level, education_risk_level, business_continuity_risk, ' +
          'srb_content, srb_status, srb_approved_at, ' +
          'ies_content, ies_status, ies_approved_at, ' +
          'created_at, updated_at',
        )
        .eq('id', params.caseId)
        .single(),
      supabase
        .from('mobility_critical_dates')
        .select('label, date_category, due_date, is_hard_deadline, workstream_key, notes')
        .eq('case_id', params.caseId)
        .order('due_date', { ascending: true }),
      supabase
        .from('mobility_workstreams')
        .select('workstream_key, label, status, priority, tasks')
        .eq('case_id', params.caseId)
        .order('workstream_key'),
    ]);

    if (!caseRes.data) {
      return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });
    }

    const maf = {
      _schema: 'MAF/1.0',
      _exported_at: new Date().toISOString(),
      _classification: 'BLACK_CUBE',
      case: caseRes.data,
      critical_dates: datesRes.data ?? [],
      workstreams: workstreamsRes.data ?? [],
    };

    const filename = `MAF_${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(maf, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
