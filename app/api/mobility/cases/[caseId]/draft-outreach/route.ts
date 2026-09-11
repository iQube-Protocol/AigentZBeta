/**
 * POST /api/mobility/cases/[caseId]/draft-outreach
 *
 * Generates an Institutional Engagement Strategy (IES) outreach email draft
 * for the given mobility case. The draft is built from case profile data and
 * returned as { subject, body } for operator review.
 *
 * send_via_marketa: true  →  stubbed path (Marketa activation pending)
 * send_via_marketa: false →  returns the draft for manual copy-and-send
 *
 * T0 discipline: caseId is validated server-side; no raw IDs leave this route.
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

export async function POST(req: NextRequest, props: { params: Promise<{ caseId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    if (!(await canAccess(persona.personaId, params.caseId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // no body — treat as generate request
    }

    // Stub: Marketa send path is not yet active
    if (body.send_via_marketa === true) {
      return NextResponse.json({
        ok: false,
        stubbed: true,
        error: 'Marketa send path not yet active — copy draft and send manually',
      });
    }

    // Fetch case data for draft generation
    const { data: caseRow, error: fetchErr } = await supabase
      .from('mobility_cases')
      .select(
        'case_type, priority_level, household_profile, capability_profile, ' +
        'continuity_profile, standing_profile, housing_profile, education_profile, ' +
        'business_profile, financial_profile, mobility_profile, family_profile, ' +
        'capability_score, continuity_score, recovery_velocity_class, ' +
        'standing_risk_level, housing_risk_level, education_risk_level, ' +
        'business_continuity_risk, ies_content, ies_status',
      )
      .eq('id', params.caseId)
      .single();

    if (fetchErr || !caseRow) {
      return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });
    }

    // If a previously saved draft exists, return it immediately
    if (caseRow.ies_status === 'draft' && caseRow.ies_content) {
      const saved = caseRow.ies_content as { subject?: string; body?: string };
      return NextResponse.json({ ok: true, subject: saved.subject ?? '', body: saved.body ?? '', cached: true });
    }

    // Build a structured draft from case profile data
    const household = (caseRow.household_profile as Record<string, unknown>) ?? {};
    const capability = (caseRow.capability_profile as Record<string, unknown>) ?? {};
    const mobility = (caseRow.mobility_profile as Record<string, unknown>) ?? {};

    const familySize: number = typeof household.familySize === 'number' ? household.familySize : 0;
    const primaryOccupation: string =
      typeof capability.primaryOccupation === 'string' ? capability.primaryOccupation : 'professional';
    const targetCountry: string =
      typeof mobility.targetCountry === 'string' ? mobility.targetCountry : 'destination country';
    const rvClass: string = caseRow.recovery_velocity_class ?? 'RV-2';
    const capScore: number | null = caseRow.capability_score ?? null;

    const urgencyLine =
      caseRow.priority_level === 'critical'
        ? 'This case has been flagged as critical priority and requires urgent institutional attention.'
        : caseRow.priority_level === 'high'
        ? 'This case is classified high priority.'
        : 'We are reaching out regarding a mobility case under our active management.';

    const subject = `Human Mobility Services — Institutional Engagement Request (${rvClass})`;

    const draftBody = [
      'Dear Institutional Partner,',
      '',
      urgencyLine,
      '',
      `We are coordinating a ${caseRow.case_type.replace('_', ' ')} case on behalf of a household` +
        (familySize > 0 ? ` of ${familySize}` : '') +
        `. The primary household member is a ${primaryOccupation}` +
        ` with an active relocation pathway towards ${targetCountry}.`,
      '',
      capScore !== null
        ? `The household has been assessed with a capability score of ${capScore}/100 and a recovery velocity classification of ${rvClass}, indicating ${
            rvClass === 'RV-1'
              ? 'potential for immediate recovery within 30 days'
              : rvClass === 'RV-2'
              ? 'rapid recovery potential within 90 days'
              : rvClass === 'RV-3'
              ? 'a moderate recovery trajectory within 180 days'
              : 'a long-term recovery requirement exceeding 180 days'
          }.`
        : `The household has a recovery velocity classification of ${rvClass}.`,
      '',
      'We are reaching out to explore institutional partnership opportunities that could support:',
      '',
      ...(caseRow.housing_risk_level === 'high' ? ['• Temporary and transitional housing provision'] : []),
      ...(caseRow.education_risk_level === 'high' ? ['• Educational continuity for school-age dependants'] : []),
      ...(caseRow.business_continuity_risk === 'high' ? ['• Business continuity and professional re-establishment'] : []),
      '• General resettlement coordination and case management support',
      '',
      'We would welcome the opportunity to discuss how your institution could contribute to this case. Please respond to this message or contact us directly to arrange a brief introductory call.',
      '',
      'All information shared is subject to BlakQube compartmentalisation protocols. Identifying details will be disclosed only through the aigentMe-authorised disclosure pathway upon formal partnership engagement.',
      '',
      'Yours sincerely,',
      'Human Mobility Services — PSC-001 Case Team',
    ].join('\n');

    // Persist the generated draft to ies_content / ies_status
    await supabase
      .from('mobility_cases')
      .update({ ies_content: { subject, body: draftBody }, ies_status: 'draft' })
      .eq('id', params.caseId);

    return NextResponse.json({ ok: true, subject, body: draftBody, cached: false });
  } catch (err) {
    console.error('[draft-outreach] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
