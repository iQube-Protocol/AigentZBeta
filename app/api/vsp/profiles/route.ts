/**
 * GET  /api/vsp/profiles — list caller's VSP profiles
 * POST /api/vsp/profiles — create a new VSP profile
 *
 * T0 discipline: owner_persona_id never serialised to response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    let query = supabase
      .from('vsp_profiles')
      .select('id, label, profile_type, status, compiled_at, kybe_did_public_ref, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('owner_persona_id', persona.personaId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, profiles: data ?? [] });
  } catch (err) {
    console.error('[vsp/profiles GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { label?: string; profile_type?: string };

    const supabase = getSupabaseServer();

    const { data: created, error } = await supabase
      .from('vsp_profiles')
      .insert({
        owner_persona_id: persona.personaId,
        label: body.label ?? 'Standing Profile',
        profile_type: body.profile_type ?? 'general',
      })
      .select('id, label, profile_type, status, compiled_at, kybe_did_public_ref, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, profile: created }, { status: 201 });
  } catch (err) {
    console.error('[vsp/profiles POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
