/**
 * /api/steward/participation/invitations — steward invitation management
 * (Constitutional Access Service). Admin-gated.
 *
 * POST  { domain, role, label?, intendedRecipient?, maxUses?, expiresInDays? }
 *       → issues a bounded bearer invitation. The RAW code (and its claim
 *       URL) is returned ONCE — only the sha256 hash is stored.
 * PATCH { invitationId, action: 'revoke' } → revoke before exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  createAccessInvitation,
  isAccessDomain,
  revokeAccessInvitation,
} from '@/services/passport/participationAccess';
import { publicOrigin } from '@/utils/publicOrigin';

export const dynamic = 'force-dynamic';

const MIGRATION = '20260725000000_participation_access.sql';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    role?: string;
    label?: string;
    intendedRecipient?: string;
    maxUses?: number;
    expiresInDays?: number;
    allowedExperiments?: string[];
  };
  if (!body.domain || !isAccessDomain(body.domain)) {
    return NextResponse.json({ ok: false, error: 'Valid domain required' }, { status: 400 });
  }
  if (!body.role?.trim()) {
    return NextResponse.json({ ok: false, error: 'role is required' }, { status: 400 });
  }

  const result = await createAccessInvitation(admin, {
    domain: body.domain,
    role: body.role.trim(),
    label: body.label,
    intendedRecipient: body.intendedRecipient,
    maxUses: body.maxUses,
    expiresInDays: body.expiresInDays,
    issuerPersonaId: persona.personaId,
    allowedExperiments: Array.isArray(body.allowedExperiments) ? body.allowedExperiments : undefined,
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
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { invitationId?: string; action?: string };
  if (!body.invitationId || body.action !== 'revoke') {
    return NextResponse.json({ ok: false, error: "invitationId and action:'revoke' required" }, { status: 400 });
  }
  const ok = await revokeAccessInvitation(admin, body.invitationId);
  if (!ok) return NextResponse.json({ ok: false, error: 'Invitation not found or not active' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
