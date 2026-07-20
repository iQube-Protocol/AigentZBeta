/**
 * GET /api/participation/my-access — the caller's OWN participation state
 * (Constitutional Access Service, participant self-view). Spine-authenticated.
 *
 * Powers the IRL Welcome home screen's observer awareness AND the accession
 * progress bar: which access domains/roles the signed-in persona holds, whether
 * they have a passport, and whether they have an active delegation — so the
 * onboarding surfaces stop re-surfacing done steps and instead point deeper.
 *
 * This is the SINGLE active-persona source of truth for those surfaces. It
 * exists because the progress bar previously read passport (wallet), access
 * (here), and delegation (a persona_id-keyed route) from THREE endpoints with
 * three persona resolutions — the delegation one took a CLIENT-supplied
 * persona_id that mismatched the server's active persona, leaving the Delegate
 * step stuck even with an active delegation (operator report 2026-07-20).
 * Resolving all three from getActivePersona here removes that whole class.
 *
 * Owner self-view: returns the caller's own state only, as booleans/roles. No
 * persona identifier of any tier is serialised — everything is keyed to the
 * caller themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { hasActiveDelegation } from '@/services/delegation/delegationGrantStore';

export const dynamic = 'force-dynamic';

/**
 * DidQube observation levels (operator ratification 2026-07-20):
 * each credential is observed at ITS constitutional level, never flattened
 * onto the active persona:
 *
 *   - PASSPORT — personhood-level (kybe-DID-rooted; a level BENEATH persona).
 *     A person who holds a passport holds it regardless of which of their
 *     personas is currently active. Until a first-class DidQube personhood
 *     resolver exists, personhood ≡ the caller's merged auth profiles → all
 *     their active personas (the same enumeration the spine itself uses).
 *   - ACCESS — issued "to the person via their persona/passport" (migration
 *     20260725000000's own contract) → observed across the person's personas.
 *   - DELEGATION — persona-scoped by design (an agent is delegated BY a
 *     persona) → observed on the ACTIVE persona only.
 *
 * Flattening passport/access onto the active persona was the 2026-07-20
 * observer regression: switching personas made a real passport read as
 * absent. Composition only — no spine file is modified here.
 */
async function listPersonhoodPersonaIds(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  authProfileId: string,
  activePersonaId: string,
): Promise<string[]> {
  try {
    const linked = await getMergedLinkedAuthProfileIds(authProfileId).catch(() => []);
    const profileIds = Array.from(new Set([authProfileId, ...linked]));
    const { data } = await admin
      .from('personas')
      .select('id')
      .in('auth_profile_id', profileIds)
      .eq('status', 'active');
    const ids = (data ?? []).map((r) => String((r as { id: unknown }).id));
    return ids.length > 0 ? ids : [activePersonaId];
  } catch {
    // Fail-degraded, never fail-open: fall back to the active persona only.
    return [activePersonaId];
  }
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json(
      { ok: true, authenticated: false, grants: [], passportIssued: false, delegationActive: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  // Personhood set — T0, server-internal only. Never serialised; every field
  // returned below is a boolean or role string keyed to the caller themselves.
  const personhoodIds = await listPersonhoodPersonaIds(admin, persona.authProfileId, persona.personaId);

  // ACCESS — person-level (grant issued to the person via persona/passport).
  const { data, error } = await admin
    .from('access_grants')
    .select('access_domain, role, status, granted_at')
    .in('persona_id', personhoodIds)
    .eq('status', 'active');

  // Pre-migration / no grants → clean empty state (still "authenticated").
  const grants = error ? [] : (data ?? []).map((g) => ({
    accessDomain: String(g.access_domain),
    role: String(g.role),
    grantedAt: String(g.granted_at),
  }));

  // PASSPORT — personhood-level. Any passport record held by any of the
  // person's personas clears the Passport step (claiming the credential
  // happens later at the Locker). Best-effort — a missing table pre-migration
  // reads as "no passport".
  let passportIssued = false;
  try {
    const { data: pp } = await admin
      .from('polity_passport_records')
      .select('passport_id')
      .in('persona_id', personhoodIds)
      .limit(1);
    passportIssued = Array.isArray(pp) && pp.length > 0;
  } catch {
    /* pre-migration → false */
  }

  // DELEGATION — persona-scoped by design: observed on the ACTIVE persona.
  const delegationActive = await hasActiveDelegation(persona.personaId);

  return NextResponse.json(
    { ok: true, authenticated: true, grants, passportIssued, delegationActive },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
