/**
 * GET  /api/vsp/profiles/[profileId]/evidence — list evidence items
 * POST /api/vsp/profiles/[profileId]/evidence — add evidence
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

export async function GET(req: NextRequest, props: { params: Promise<{ profileId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.profileId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('vsp_evidence')
      .select('id, source_type, label, content_text, extraction_status, extracted_fact_count, extracted_at, classification, disclosure_policy, verification_status, source_provenance, storage_backend, storage_ref, created_at')
      .eq('profile_id', params.profileId)
      .order('created_at');

    if (error) throw error;

    return NextResponse.json({ ok: true, evidence: data ?? [] });
  } catch (err) {
    console.error('[vsp/evidence GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ profileId: string }> }) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!(await canAccess(persona.personaId, params.profileId, !!persona.cartridgeFlags?.isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      source_type?: string;
      label?: string;
      content_text?: string;
      classification?: string;
      disclosure_policy?: string;
      source_provenance?: string;
    };

    if (!body.source_type || !body.label) {
      return NextResponse.json({ ok: false, error: 'source_type and label are required' }, { status: 400 });
    }

    const validClassifications = ['WHITE', 'GREY', 'BLACK', 'BLAKQUBE'];
    const validPolicies = ['public', 'principal_only', 'service_only', 'restricted'];

    const { data, error } = await supabase
      .from('vsp_evidence')
      .insert({
        profile_id: params.profileId,
        source_type: body.source_type,
        label: body.label,
        content_text: body.content_text ?? '',
        extraction_status: 'pending',
        classification: validClassifications.includes(body.classification ?? '') ? body.classification : 'GREY',
        disclosure_policy: validPolicies.includes(body.disclosure_policy ?? '') ? body.disclosure_policy : 'principal_only',
        source_provenance: body.source_provenance ?? null,
      })
      .select('id, source_type, label, content_text, extraction_status, extracted_fact_count, extracted_at, classification, disclosure_policy, verification_status, source_provenance, storage_backend, storage_ref, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, evidence: data }, { status: 201 });
  } catch (err) {
    console.error('[vsp/evidence POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
