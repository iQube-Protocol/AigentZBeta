/**
 * Critical dates register for a mobility case (MAF §13).
 *
 * GET  — list all dates for the case.
 * POST — add a critical date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function canAccess(personaId: string, caseId: string, isAdmin: boolean, supabase: ReturnType<typeof getSupabaseServer>): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase.from('mobility_cases').select('id').eq('id', caseId).eq('owner_persona_id', personaId).maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest, props: { params: Promise<{ caseId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const { data, error } = await supabase
      .from('mobility_critical_dates')
      .select('*')
      .eq('case_id', params.caseId)
      .order('due_date');
    if (error) throw error;
    return NextResponse.json({ ok: true, dates: data ?? [] });
  } catch (err) {
    console.error('[mobility/dates GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

interface DateBody {
  label: string;
  date_category: string;
  due_date: string;
  is_hard_deadline?: boolean;
  notes?: string;
  workstream_key?: string;
}

export async function POST(req: NextRequest, props: { params: Promise<{ caseId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const body = (await req.json().catch(() => ({}))) as DateBody;
    if (!body.label || !body.date_category || !body.due_date) {
      return NextResponse.json({ ok: false, error: 'label, date_category, and due_date are required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('mobility_critical_dates')
      .insert({
        case_id: params.caseId,
        label: body.label,
        date_category: body.date_category,
        due_date: body.due_date,
        is_hard_deadline: body.is_hard_deadline ?? true,
        notes: body.notes,
        workstream_key: body.workstream_key,
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, date: data }, { status: 201 });
  } catch (err) {
    console.error('[mobility/dates POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
