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
 * The observation itself lives in `services/passport/participationSelfView.ts`
 * so the SPEC-COS-001 substrate-state resolver reads the SAME implementation
 * rather than re-deriving passport/access/delegation (CS-001 discipline). This
 * route's own response shape is unchanged.
 *
 * Owner self-view: returns the caller's own state only, as booleans/roles. No
 * persona identifier of any tier is serialised — everything is keyed to the
 * caller themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';

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

  const view = await resolveParticipationSelfView(req, admin, {
    personaId: persona.personaId,
    authProfileId: persona.authProfileId,
  });

  // isAdmin — server-resolved from the authenticated session only, never a
  // client-supplied value (2026-09-11 fix). Platform admin authority is a
  // `cartridgeFlags.isAdmin` flag, NOT an `access_grants` row, so every
  // consumer of this route that inferred "onboarded"/"has access" purely
  // from `grants` (IRLWelcomeTab, AccessionProgressBar) silently read an
  // admin as not-yet-onboarded. Surfacing it here lets every such consumer
  // treat admin authority explicitly and legibly, rather than each guessing
  // at it independently.
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);

  return NextResponse.json(
    { ok: true, authenticated: true, isAdmin, ...view },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
