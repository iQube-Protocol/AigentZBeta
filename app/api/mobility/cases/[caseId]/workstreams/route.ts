/**
 * Mobility workstreams — list + update.
 *
 * GET   — list workstreams for a case.
 * PATCH — update a workstream status / notes / tasks by workstream_key.
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

export async function GET(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const { data, error } = await supabase
      .from('mobility_workstreams')
      .select('*')
      .eq('case_id', params.caseId)
      .order('workstream_key');
    if (error) throw error;
    return NextResponse.json({ ok: true, workstreams: data ?? [] });
  } catch (err) {
    console.error('[mobility/workstreams GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

interface WorkstreamPatch {
  workstream_key: string;
  status?: string;
  notes?: string;
  tasks?: unknown[];
  assigned_agent_id?: string;
}

export async function PATCH(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.caseId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const body = (await req.json().catch(() => ({}))) as WorkstreamPatch;
    if (!body.workstream_key) return NextResponse.json({ ok: false, error: 'workstream_key required' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === 'active') updates.started_at = new Date().toISOString();
      if (body.status === 'complete') updates.completed_at = new Date().toISOString();
    }
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.tasks !== undefined) updates.tasks = body.tasks;
    if (body.assigned_agent_id !== undefined) updates.assigned_agent_id = body.assigned_agent_id;

    const { data, error } = await supabase
      .from('mobility_workstreams')
      .update(updates)
      .eq('case_id', params.caseId)
      .eq('workstream_key', body.workstream_key)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, workstream: data });
  } catch (err) {
    console.error('[mobility/workstreams PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
