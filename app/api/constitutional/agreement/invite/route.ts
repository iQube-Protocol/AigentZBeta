/**
 * /api/constitutional/agreement/invite — issue the special invitation link
 * that delivers a formed x409 Constitutional Agreement into an external
 * party's Passport Locker (CFS-042/CFS-044 Locker exchange).
 *
 * POST (admin) — body { agreementId, label? }. Verifies the agreement exists,
 *   mints an unguessable invite code, and returns the invitation URL: the
 *   IRL OS cartridge's Participation → Locker tab with ?x409=<code>. The
 *   invitee signs up, opens their Locker, and the claim seam
 *   (/api/polity-passport/locker/claim-agreement) lands the contract in it.
 * GET (admin) — list issued invitations (status + claim state).
 *
 * Trust model: the code is a capability string (same posture as the public
 * agreementId). Knowing it grants exactly one claim: materialising the
 * agreement as a locker item for the CLAIMANT'S OWN persona. It cannot
 * accept terms, cannot authorize, cannot read anyone else's locker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getAgreement } from '@/services/constitutional/constitutionalAgreement';

export const dynamic = 'force-dynamic';

const MIGRATION = '20260724000000_x409_invitations.sql';

function inviteUrlFor(req: NextRequest, code: string): string {
  const origin = new URL(req.url).origin;
  // Participation → Locker of the public IRL OS cartridge (slug irl-os;
  // locker tab slug irl-os-passport-locker — data/codex-configs.ts).
  return `${origin}/triad/embed/codex/irl-os?tab=irl-os-passport-locker&x409=${code}`;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { agreementId?: string; label?: string };
  if (!body.agreementId?.trim()) {
    return NextResponse.json({ ok: false, error: 'agreementId is required' }, { status: 400 });
  }

  const agreement = await getAgreement(body.agreementId.trim());
  if (!agreement) return NextResponse.json({ ok: false, error: 'Agreement not found' }, { status: 404 });

  const code = `x409-${randomBytes(16).toString('hex')}`;
  const { error } = await admin.from('x409_invitations').insert({
    code,
    agreement_id: agreement.agreementId,
    label: body.label?.trim() || agreement.displayLabel || null,
  });
  if (error) {
    if (error.message.includes('x409_invitations')) {
      return NextResponse.json({ ok: false, error: `x409_invitations table not provisioned — apply ${MIGRATION}.` }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code,
    inviteUrl: inviteUrlFor(req, code),
    agreementId: agreement.agreementId,
    agreementStatus: agreement.status,
  });
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const { data, error } = await admin
    .from('x409_invitations')
    .select('code, agreement_id, label, status, created_at, claimed_at')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message.includes('x409_invitations')) {
      return NextResponse.json({ ok: true, invitations: [], migrationPending: MIGRATION });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    invitations: (data ?? []).map((r) => ({
      code: r.code,
      inviteUrl: inviteUrlFor(req, String(r.code)),
      agreementId: r.agreement_id,
      label: r.label,
      status: r.status,
      createdAt: r.created_at,
      claimedAt: r.claimed_at,
    })),
  });
}
