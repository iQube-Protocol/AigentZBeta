/**
 * /api/steward/participation/invitations — steward invitation management
 * (Constitutional Access Service).
 *
 * POST  { domain, role, label?, intendedRecipient?, maxUses?, expiresInDays? }
 *       → issues a bounded bearer invitation. The RAW code (and its claim
 *       URL) is returned ONCE — only the sha256 hash is stored.
 * PATCH { invitationId, action: 'revoke' } → revoke before exhaustion.
 *
 * TWO-TIER AUTHORITY (operator, 2026-07-28). This route is THE scope-containment
 * enforcement point for delegated invitation. It was admin-only; a platform
 * admin remains unrestricted, and a persona holding a STEWARD grant may now
 * issue into the domains that grant covers so the platform stops being the gate
 * for partner-side growth.
 *
 * Every bound is derived server-side from `getActivePersona` +
 * `resolveParticipationSelfView` — the caller's OWN grants. The `domain` in the
 * request body is CHECKED against that derivation, never trusted:
 *
 *   • domain outside the caller's authority        → 403 (privilege escalation)
 *   • role outside `issuableRoles(domain, tier)`   → 403 (grant-upward: a
 *     delegated steward can never confer a steward role, i.e. never confer
 *     invitation authority — that stays a platform-admin act)
 *   • scope outside the caller's own grant scope   → 403 (a steward scoped to
 *     one pilot cannot invite into another)
 *
 * A delegated steward may revoke only invitations they issued, enforced in the
 * UPDATE predicate rather than a read-then-write check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  createAccessInvitation,
  isAccessDomain,
  issuableRoles,
  resolveInvitationAuthority,
  revokeAccessInvitation,
  scopeWithinAuthority,
  type InvitationAuthority,
} from '@/services/passport/participationAccess';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';
import { publicOrigin } from '@/utils/publicOrigin';

export const dynamic = 'force-dynamic';

const MIGRATION = '20260725000000_participation_access.sql';

/**
 * Resolve who is asking and what they may confer. ONE resolution per request,
 * through the spine, from the caller's own grants — nothing here reads the
 * request body.
 */
async function resolveAuthority(
  req: NextRequest,
): Promise<
  | { error: NextResponse }
  | { personaId: string; authority: InvitationAuthority; admin: ReturnType<typeof getSupabaseServer> }
> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return { error: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) };
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return { error: NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 }) };
  }
  const isAdmin = persona.cartridgeFlags?.isAdmin === true;
  // Fails CLOSED: a self-view that cannot be resolved yields no grants, which
  // yields tier 'none'. "Not answered yet" must never read as "yes".
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

export async function POST(req: NextRequest) {
  const resolved = await resolveAuthority(req);
  if ('error' in resolved) return resolved.error;
  const { personaId, authority, admin } = resolved;
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    role?: string;
    label?: string;
    intendedRecipient?: string;
    maxUses?: number;
    expiresInDays?: number;
    allowedExperiments?: string[];
    openPeerChannel?: boolean;
  };
  if (!body.domain || !isAccessDomain(body.domain)) {
    return NextResponse.json({ ok: false, error: 'Valid domain required' }, { status: 400 });
  }
  if (!body.role?.trim()) {
    return NextResponse.json({ ok: false, error: 'role is required' }, { status: 400 });
  }

  // ── SCOPE CONTAINMENT ──────────────────────────────────────────────────────
  // The domain the client named must be one the CALLER administers.
  const domain = body.domain;
  if (!authority.domains.includes(domain)) {
    return NextResponse.json(
      { ok: false, error: `Not authorized to invite into '${domain}'` },
      { status: 403 },
    );
  }
  // The role must be one this TIER may confer. A delegated steward's set
  // excludes every steward role, so delegated authority cannot replicate itself.
  const role = body.role.trim();
  if (!issuableRoles(domain, authority.tier).includes(role)) {
    return NextResponse.json(
      { ok: false, error: `Not authorized to confer role '${role}' in '${domain}'` },
      { status: 403 },
    );
  }
  // The project/pilot/experiment scope must sit inside the caller's own.
  const requestedScopes = Array.isArray(body.allowedExperiments) ? body.allowedExperiments : [];
  const scopeCheck = scopeWithinAuthority(authority, domain, requestedScopes);
  if (!scopeCheck.ok) {
    return NextResponse.json({ ok: false, error: scopeCheck.error }, { status: 403 });
  }

  const result = await createAccessInvitation(admin, {
    domain,
    role,
    label: body.label,
    intendedRecipient: body.intendedRecipient,
    maxUses: body.maxUses,
    expiresInDays: body.expiresInDays,
    issuerPersonaId: personaId,
    allowedExperiments: requestedScopes.length > 0 ? requestedScopes : undefined,
    openPeerChannel: body.openPeerChannel === true,
  });
  if (!result.ok) {
    const status = result.error.includes('access_invitations') ? 503 : 400;
    const error = result.error.includes('access_invitations')
      ? `access_invitations table not provisioned — apply ${MIGRATION}.`
      : result.error;
    return NextResponse.json({ ok: false, error }, { status });
  }

  const origin = publicOrigin(req);
  return NextResponse.json({
    ok: true,
    // Shown once — the steward copies it now or reissues later.
    code: result.rawCode,
    // The accession invitation page — the single entry point (human view +
    // linked machine-readable twin). The page's Begin action carries the
    // code into the Locker claim flow.
    inviteUrl: `${origin}/invite/${result.rawCode}`,
    invitation: result.invitation,
  });
}

export async function PATCH(req: NextRequest) {
  const resolved = await resolveAuthority(req);
  if ('error' in resolved) return resolved.error;
  const { personaId, authority, admin } = resolved;
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { invitationId?: string; action?: string };
  if (!body.invitationId || body.action !== 'revoke') {
    return NextResponse.json({ ok: false, error: "invitationId and action:'revoke' required" }, { status: 400 });
  }
  // A delegated steward revokes only what they issued; the constraint is part of
  // the UPDATE predicate, so it cannot be raced.
  const ok = await revokeAccessInvitation(
    admin,
    body.invitationId,
    authority.tier === 'platform' ? undefined : personaId,
  );
  if (!ok) return NextResponse.json({ ok: false, error: 'Invitation not found or not active' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
