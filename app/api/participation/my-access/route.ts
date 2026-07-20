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
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { hasActiveDelegation } from '@/services/delegation/delegationGrantStore';

export const dynamic = 'force-dynamic';

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

  const { data, error } = await admin
    .from('access_grants')
    .select('access_domain, role, status, granted_at')
    .eq('persona_id', persona.personaId)
    .eq('status', 'active');

  // Pre-migration / no grants → clean empty state (still "authenticated").
  const grants = error ? [] : (data ?? []).map((g) => ({
    accessDomain: String(g.access_domain),
    role: String(g.role),
    grantedAt: String(g.granted_at),
  }));

  // Passport issued? Any passport record bound to this persona clears the
  // "Passport" step (claiming the credential happens later at the Locker).
  // Best-effort — a missing table / column pre-migration reads as "no passport".
  let passportIssued = false;
  try {
    const { data: pp } = await admin
      .from('polity_passport_records')
      .select('passport_id')
      .eq('persona_id', persona.personaId)
      .limit(1);
    passportIssued = Array.isArray(pp) && pp.length > 0;
  } catch {
    /* pre-migration → false */
  }

  // Active delegation? Resolved server-side from the SAME active persona (no
  // client persona_id), so the Delegate step reflects the real state.
  const delegationActive = await hasActiveDelegation(persona.personaId);

  return NextResponse.json(
    { ok: true, authenticated: true, grants, passportIssued, delegationActive },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
