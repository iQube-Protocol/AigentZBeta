/**
 * Shared steward-authority resolution — ONE mechanism, reused by every
 * /api/steward/participation/** route (GET, invitations, grants, capabilities,
 * research-persona). Extracted 2026-10-01 (IRL Stewardship pass) so a third
 * and fourth route did not hand-copy the same resolution logic
 * (inv.engineering.036/037 — one authoritative location per concern).
 *
 * Resolves who is asking and what they may confer/administer, from the
 * caller's OWN grants only — nothing here reads the request body. Fails
 * CLOSED: an unresolvable self-view yields no grants, hence tier 'none'.
 * "Not answered yet" must never read as "yes".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveInvitationAuthority, type InvitationAuthority } from '@/services/passport/participationAccess';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';

export type ResolvedStewardAuthority = {
  personaId: string;
  authority: InvitationAuthority;
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>;
};

export async function resolveStewardAuthority(
  req: NextRequest,
): Promise<{ error: NextResponse } | ResolvedStewardAuthority> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return { error: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) };
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return { error: NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 }) };
  }
  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  let grants: { accessDomain: string; role: string; allowedScopes: string[] | null }[] = [];
  try {
    const selfView = await resolveParticipationSelfView(req, admin, {
      personaId: persona.personaId,
      authProfileId: persona.authProfileId,
    });
    grants = selfView.grants;
  } catch {
    grants = [];
  }
  const authority = resolveInvitationAuthority(isAdmin, grants);
  if (authority.tier === 'none') {
    return { error: NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 }) };
  }
  return { personaId: persona.personaId, authority, admin };
}

/**
 * Scope-containment check for an action targeting an EXISTING grant (as
 * opposed to issuing a new invitation): the grant's domain must be one the
 * caller administers, and — for a scoped steward — the grant's own
 * `allowedExperiments` must overlap the caller's granted scope. Mirrors the
 * exact visibility filter `GET /api/steward/participation` already applies,
 * so a steward can never mutate a grant they could not otherwise see.
 */
export function grantWithinAuthority(
  authority: InvitationAuthority,
  grantDomain: string,
  grantAllowedExperiments: string[] | null,
): { ok: true } | { ok: false; error: string } {
  if (!(authority.domains as string[]).includes(grantDomain)) {
    return { ok: false, error: `Not authorized for '${grantDomain}'` };
  }
  const own = authority.scopes[grantDomain];
  if (own === 'all' || own === undefined) return { ok: true };
  const gs = grantAllowedExperiments ?? [];
  if (gs.length > 0 && gs.some((s) => own.includes(s))) return { ok: true };
  return { ok: false, error: 'Grant is outside your scoped authority' };
}
