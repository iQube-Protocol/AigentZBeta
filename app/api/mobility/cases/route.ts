/**
 * Mobility cases — list + create.
 *
 * GET  — list cases the caller manages (admin) or owns (citizen).
 * POST — create a new Mobility Activation File (MAF) shell.
 *
 * All case data is Black Cube classified. T0 persona IDs never leave the
 * server. Case owners receive a caseId and summary projection only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { seedWorkstreams } from '../_lib/seedWorkstreams';

export const dynamic = 'force-dynamic';

interface CreateBody {
  caseType?: string;
  priorityLevel?: string;
  classification?: string;
}

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    let query = supabase
      .from('mobility_cases')
      .select('id, case_type, case_status, priority_level, classification, intake_sections_complete, capability_score, continuity_score, recovery_velocity_class, standing_risk_level, housing_risk_level, education_risk_level, business_continuity_risk, intake_completed_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('owner_persona_id', persona.personaId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, cases: data ?? [] });
  } catch (err) {
    console.error('[mobility/cases GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CreateBody;

    const supabase = getSupabaseServer();

    const { data: created, error } = await supabase
      .from('mobility_cases')
      .insert({
        owner_persona_id: persona.personaId,
        case_type: body.caseType ?? 'repatriation',
        priority_level: body.priorityLevel ?? 'critical',
        classification: body.classification ?? 'black_cube',
        case_status: 'intake',
      })
      .select('id, case_type, case_status, priority_level, classification, created_at')
      .single();

    if (error) throw error;

    // Seed the 7 standard workstreams
    await seedWorkstreams(created.id, supabase);

    return NextResponse.json({ ok: true, case: created }, { status: 201 });
  } catch (err) {
    console.error('[mobility/cases POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
