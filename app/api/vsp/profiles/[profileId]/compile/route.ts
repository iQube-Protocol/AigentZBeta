/**
 * POST /api/vsp/profiles/[profileId]/compile
 *
 * Compiles all approved/corrected facts into the VSP JSON,
 * locks approved facts, saves to vsp_content.
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

export async function POST(req: NextRequest, { params }: { params: { profileId: string } }) {
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

    const { data: profile, error: profErr } = await supabase
      .from('vsp_profiles')
      .select('id, label, profile_type')
      .eq('id', params.profileId)
      .single();

    if (profErr || !profile) {
      return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    // Fetch approved + corrected facts
    const { data: facts, error: factsErr } = await supabase
      .from('vsp_facts')
      .select('id, domain, field, label, extracted_value, principal_value, confidence, status')
      .eq('profile_id', params.profileId)
      .in('status', ['approved', 'corrected'])
      .is('locked_at', null)
      .order('domain')
      .order('created_at');

    if (factsErr) throw factsErr;

    if (!facts || facts.length === 0) {
      return NextResponse.json({ ok: false, error: 'No approved facts to compile' }, { status: 422 });
    }

    // Group by domain
    const domains: Record<string, unknown[]> = {};
    for (const fact of facts) {
      if (!domains[fact.domain]) domains[fact.domain] = [];
      domains[fact.domain].push({
        field: fact.field,
        label: fact.label,
        value: fact.status === 'corrected' && fact.principal_value ? fact.principal_value : fact.extracted_value,
        confidence: fact.confidence,
      });
    }

    const compiledAt = new Date().toISOString();
    const vsp = {
      compiled_at: compiledAt,
      profile_type: profile.profile_type,
      domains,
    };

    // Lock all compiled facts
    const factIds = facts.map(f => f.id);
    await supabase
      .from('vsp_facts')
      .update({ locked_at: compiledAt })
      .in('id', factIds);

    // Save VSP content
    await supabase
      .from('vsp_profiles')
      .update({ vsp_content: vsp, compiled_at: compiledAt })
      .eq('id', params.profileId);

    return NextResponse.json({ ok: true, vsp });
  } catch (err) {
    console.error('[vsp/compile POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
