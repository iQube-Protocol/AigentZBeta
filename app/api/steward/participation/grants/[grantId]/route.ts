/**
 * PATCH /api/steward/participation/grants/[grantId] — amend an EXISTING
 * access_grants row in place (IRL Stewardship, Access Maintenance, item 1-2).
 *
 * Invitation stays bootstrap-only; this route is the ongoing maintenance
 * mechanism a steward uses instead of "revoke and re-invite" for every scope
 * tweak, role change, expiry extension, suspension, or reinstatement.
 *
 * Body: { action: 'amend' | 'suspend' | 'reinstate' | 'revoke', reason?, ...amend fields }
 *   action 'amend'      → { addExperiments?, removeExperiments?, newRole?, newExpiresAt? }
 *   action 'suspend'    → reversible hold; active → suspended
 *   action 'reinstate'  → suspended → active
 *   action 'revoke'     → permanent; active|suspended → revoked
 *
 * SCOPE CONTAINMENT — same discipline as the invitations route (item 1's
 * "Steward UI... bounded 'Manage access' editor"): a delegated steward may
 * amend only a grant whose domain they administer and whose scope sits
 * inside their own (`grantWithinAuthority`, the same visibility test the GET
 * route already applies) — a steward can never touch a grant they could not
 * otherwise see, and a role change is validated against `issuableRoles` so a
 * delegated steward can never confer (or amend a grant TO) a steward role.
 *
 * Every branch here delegates the actual mutation + receipt writing to
 * `services/passport/participationAccess.ts` (amendAccessGrant /
 * suspendAccessGrant / reinstateAccessGrant / revokeAccessGrantById) — this
 * route's job is authority resolution and scope containment, not the write.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  amendAccessGrant,
  isAccessDomain,
  issuableRoles,
  reinstateAccessGrant,
  revokeAccessGrantById,
  suspendAccessGrant,
} from '@/services/passport/participationAccess';
import { grantWithinAuthority, resolveStewardAuthority } from '@/app/api/steward/participation/_lib/resolveStewardAuthority';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  const resolved = await resolveStewardAuthority(req);
  if ('error' in resolved) return resolved.error;
  const { personaId, authority, admin } = resolved;

  const { data: grantRow, error: grantErr } = await admin
    .from('access_grants')
    .select('access_domain, allowed_experiments')
    .eq('id', grantId)
    .maybeSingle();
  if (grantErr || !grantRow) {
    return NextResponse.json({ ok: false, error: 'Grant not found' }, { status: 404 });
  }
  const grantDomainRaw = String((grantRow as Record<string, unknown>).access_domain);
  const grantScope = ((grantRow as Record<string, unknown>).allowed_experiments as string[] | null) ?? null;
  const containment = grantWithinAuthority(authority, grantDomainRaw, grantScope);
  if (!containment.ok) {
    return NextResponse.json({ ok: false, error: containment.error }, { status: 403 });
  }
  // Containment already proved `grantDomainRaw` is one of `authority.domains`
  // (all AccessDomain values), so the narrowing below is sound.
  if (!isAccessDomain(grantDomainRaw)) {
    return NextResponse.json({ ok: false, error: 'Grant has an unrecognised access domain' }, { status: 500 });
  }
  const grantDomain = grantDomainRaw;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
    addExperiments?: string[];
    removeExperiments?: string[];
    newRole?: string;
    newExpiresAt?: string | null;
  };

  if (body.action === 'amend') {
    // A role change must be one this caller's tier may confer — the same
    // upward-grant refusal the invitation POST already enforces.
    if (body.newRole && !issuableRoles(grantDomain, authority.tier).includes(body.newRole)) {
      return NextResponse.json(
        { ok: false, error: `Not authorized to confer role '${body.newRole}' in '${grantDomain}'` },
        { status: 403 },
      );
    }
    // A scoped steward may only ADD experiments within their own scope —
    // never widen a grant beyond what they themselves hold.
    const own = authority.scopes[grantDomain];
    if (own !== 'all' && own !== undefined && body.addExperiments?.length) {
      const outside = body.addExperiments.filter((e) => !own.includes(e));
      if (outside.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Not authorized to add scope outside your own: ${outside.join(', ')}` },
          { status: 403 },
        );
      }
    }
    const result = await amendAccessGrant(admin, {
      grantId,
      actorPersonaId: personaId,
      addExperiments: body.addExperiments,
      removeExperiments: body.removeExperiments,
      newRole: body.newRole,
      newExpiresAt: body.newExpiresAt,
      reason: body.reason,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, grant: result.grant });
  }

  if (body.action === 'suspend' || body.action === 'reinstate' || body.action === 'revoke') {
    const fn = body.action === 'suspend' ? suspendAccessGrant : body.action === 'reinstate' ? reinstateAccessGrant : revokeAccessGrantById;
    const result = await fn(admin, { grantId, actorPersonaId: personaId, reason: body.reason });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, grant: result.grant });
  }

  return NextResponse.json(
    { ok: false, error: "action must be one of 'amend' | 'suspend' | 'reinstate' | 'revoke'" },
    { status: 400 },
  );
}
