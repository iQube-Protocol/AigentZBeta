/**
 * GET   /api/vsp/profiles/[profileId] — profile + evidence + facts
 * PATCH /api/vsp/profiles/[profileId] — update label or status
 *
 * T0 discipline: owner_persona_id never serialised.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function canAccess(
  personaId: string,
  profileId: string,
  isAdmin: boolean,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase
    .from('vsp_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest, { params }: { params: { profileId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    if (!(await canAccess(persona.personaId, params.profileId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const [profileRes, evidenceRes, factsRes] = await Promise.all([
      supabase
        .from('vsp_profiles')
        .select('id, label, profile_type, status, vsp_content, compiled_at, created_at, updated_at')
        .eq('id', params.profileId)
        .single(),
      supabase
        .from('vsp_evidence')
        .select('id, source_type, label, content_text, extraction_status, extracted_fact_count, extracted_at, created_at')
        .eq('profile_id', params.profileId)
        .order('created_at'),
      supabase
        .from('vsp_facts')
        .select('id, evidence_id, domain, field, label, extracted_value, confidence, status, principal_value, approved_at, locked_at, created_at')
        .eq('profile_id', params.profileId)
        .order('domain')
        .order('created_at'),
    ]);

    if (profileRes.error) throw profileRes.error;

    return NextResponse.json({
      ok: true,
      profile: profileRes.data,
      evidence: evidenceRes.data ?? [],
      facts: factsRes.data ?? [],
    });
  } catch (err) {
    console.error('[vsp/profiles/[profileId] GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { profileId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    if (!(await canAccess(persona.personaId, params.profileId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { label?: string; status?: string };
    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.status !== undefined) updates.status = body.status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vsp_profiles')
      .update(updates)
      .eq('id', params.profileId)
      .select('id, label, profile_type, status, compiled_at, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, profile: data });
  } catch (err) {
    console.error('[vsp/profiles/[profileId] PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
