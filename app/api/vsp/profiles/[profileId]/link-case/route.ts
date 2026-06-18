/**
 * POST /api/vsp/profiles/[profileId]/link-case
 *
 * Links a VSP profile to a mobility case.
 * Verifies caller owns both resources.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { profileId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    const body = (await req.json().catch(() => ({}))) as { case_id?: string };
    if (!body.case_id) {
      return NextResponse.json({ ok: false, error: 'case_id is required' }, { status: 400 });
    }

    // Verify profile ownership
    const { data: profile } = await supabase
      .from('vsp_profiles')
      .select('id')
      .eq('id', params.profileId)
      .eq(isAdmin ? 'id' : 'owner_persona_id', isAdmin ? params.profileId : persona.personaId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    // Verify case ownership
    const { data: caseRow } = await supabase
      .from('mobility_cases')
      .select('id')
      .eq('id', body.case_id)
      .eq(isAdmin ? 'id' : 'owner_persona_id', isAdmin ? body.case_id : persona.personaId)
      .maybeSingle();

    if (!caseRow) {
      return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });
    }

    await supabase
      .from('mobility_cases')
      .update({ vsp_profile_id: params.profileId })
      .eq('id', body.case_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[vsp/link-case POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
