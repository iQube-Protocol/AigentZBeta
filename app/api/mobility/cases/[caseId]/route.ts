/**
 * Mobility case detail — read + full profile update.
 *
 * GET   — full case with workstreams and critical dates.
 * PATCH — update any profile section(s) + recalculate scores.
 *
 * T0 discipline: owner_persona_id / assigned_case_manager_id are validated
 * server-side but never serialized into the response body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { computeScores } from '../../_lib/computeScores';
import { markSectionComplete } from '../../_lib/markSectionComplete';

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

export async function GET(req: NextRequest, { params }: { params: { caseId: string } }) {
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

    const [caseRes, workstreamsRes, datesRes] = await Promise.all([
      supabase
        .from('mobility_cases')
        .select('id, case_type, case_status, priority_level, classification, household_profile, capability_profile, continuity_profile, standing_profile, housing_profile, education_profile, business_profile, financial_profile, mobility_profile, family_profile, confidentiality_profile, capability_score, continuity_score, recovery_velocity_class, standing_risk_level, housing_risk_level, education_risk_level, business_continuity_risk, intake_sections_complete, intake_completed_at, srb_status, ies_status, marketa_forward_email, created_at, updated_at')
        .eq('id', params.caseId)
        .single(),
      supabase
        .from('mobility_workstreams')
        .select('id, workstream_key, label, priority, status, notes, tasks, started_at, completed_at')
        .eq('case_id', params.caseId)
        .order('workstream_key'),
      supabase
        .from('mobility_critical_dates')
        .select('id, label, date_category, due_date, is_hard_deadline, status, notes, workstream_key')
        .eq('case_id', params.caseId)
        .order('due_date'),
    ]);

    if (caseRes.error) throw caseRes.error;

    return NextResponse.json({
      ok: true,
      case: caseRes.data,
      workstreams: workstreamsRes.data ?? [],
      criticalDates: datesRes.data ?? [],
    });
  } catch (err) {
    console.error('[mobility/cases/[caseId] GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { caseId: string } }) {
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

    const body = await req.json().catch(() => ({}));

    // Build allowed update payload — only profile sections + status fields
    const PROFILE_SECTIONS = [
      'household_profile', 'capability_profile', 'continuity_profile',
      'standing_profile', 'housing_profile', 'education_profile',
      'business_profile', 'financial_profile', 'mobility_profile',
      'family_profile', 'confidentiality_profile',
    ] as const;
    type ProfileSection = (typeof PROFILE_SECTIONS)[number];

    const updates: Record<string, unknown> = {};
    for (const section of PROFILE_SECTIONS) {
      if (body[section] !== undefined) updates[section] = body[section];
    }
    if (body.case_status !== undefined) updates.case_status = body.case_status;
    if (body.priority_level !== undefined) updates.priority_level = body.priority_level;
    if (body.marketa_forward_email !== undefined) updates.marketa_forward_email = body.marketa_forward_email || null;

    // Mark section complete and compute scores if a profile section changed
    const changedSections = PROFILE_SECTIONS.filter(s => updates[s] !== undefined);
    if (changedSections.length > 0) {
      // Fetch current state to compute scores
      const { data: current } = await supabase
        .from('mobility_cases')
        .select('intake_sections_complete, household_profile, capability_profile, continuity_profile, housing_profile, financial_profile')
        .eq('id', params.caseId)
        .single();

      if (current) {
        const merged = { ...current };
        for (const s of changedSections) merged[s as ProfileSection] = updates[s];

        const scores = computeScores(merged);
        Object.assign(updates, scores);

        const newComplete = markSectionComplete(
          (current.intake_sections_complete as string[]) ?? [],
          changedSections,
        );
        updates.intake_sections_complete = newComplete;

        const REQUIRED = ['household_profile', 'capability_profile', 'continuity_profile', 'housing_profile', 'financial_profile'];
        if (REQUIRED.every(s => newComplete.includes(s)) && !current.intake_sections_complete?.includes('household_profile')) {
          updates.intake_completed_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('mobility_cases')
      .update(updates)
      .eq('id', params.caseId)
      .select('id, case_type, case_status, priority_level, classification, intake_sections_complete, capability_score, continuity_score, recovery_velocity_class, standing_risk_level, housing_risk_level, education_risk_level, business_continuity_risk, intake_completed_at, marketa_forward_email, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, case: updated });
  } catch (err) {
    console.error('[mobility/cases/[caseId] PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
