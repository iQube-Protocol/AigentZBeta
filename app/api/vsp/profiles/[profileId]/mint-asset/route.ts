/**
 * POST /api/vsp/profiles/[profileId]/mint-asset
 *
 * Mint a compiled VSP as a Verified Standing Asset — a citizen-owned sovereign
 * iQube (Standing PRD Tier 2). Requires the profile to be compiled. Idempotent.
 *
 * Pay-per-asset: each mint is an outright purchase. The CHARGE is stubbed for
 * now (consistent with the platform-wide checkout stub) — the owner/admin may
 * mint; wiring the per-asset payment is a follow-up. The sovereign-asset
 * registration itself is live.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { registerVspIqube } from '@/services/vsp/registerVspIqube';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { profileId: string } }) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
    }
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    // Ownership / admin gate.
    const { data: profile, error: profErr } = await supabase
      .from('vsp_profiles')
      .select('id, label, profile_type, compiled_at, kybe_did_public_ref, iqube_id, owner_persona_id')
      .eq('id', params.profileId)
      .maybeSingle();
    if (profErr || !profile) {
      return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }
    if (!isAdmin && profile.owner_persona_id !== persona.personaId) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (!profile.compiled_at) {
      return NextResponse.json(
        { ok: false, error: 'Compile the Standing profile before minting it as a sovereign asset.' },
        { status: 400 },
      );
    }
    if (profile.iqube_id) {
      return NextResponse.json({ ok: true, iqubeId: String(profile.iqube_id), created: false });
    }

    // NOTE: pay-per-asset charge stubbed — wire checkout on the payment rails.

    const result = await registerVspIqube({
      admin: supabase,
      vspProfileId: profile.id,
      ownerPersonaId: profile.owner_persona_id,
      vspLabel: profile.label ?? 'Verified Standing',
      profileType: profile.profile_type ?? 'general',
      kybeDidPublicRef: (profile as { kybe_did_public_ref?: string | null }).kybe_did_public_ref ?? null,
    });
    if (!result) {
      return NextResponse.json({ ok: false, error: 'Minting failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, iqubeId: result.iqubeId, vspPublicRef: result.vspPublicRef, created: result.created });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Minting failed' },
      { status: 500 },
    );
  }
}
