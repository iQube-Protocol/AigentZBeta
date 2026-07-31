/**
 * POST /api/participation/claim — the participant's side of the
 * Constitutional Access Service: redeem a bounded bearer invitation
 * (pinv-… code) into a canonical AccessGrant.
 *
 * Claiming is a HUMAN constitutional act: the caller must be a signed-in
 * persona (spine Bearer). An agent may have prepared everything up to this
 * point (agent-assisted application path), but it cannot claim on the
 * human's behalf — the same boundary as x409 authorization.
 *
 * Body: { code }. Response: the grant (domain, role, grantedAt), receipted
 * as passport_privilege_changed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { claimAccessInvitation } from '@/services/passport/participationAccess';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated — sign in with your persona to claim' }, { status: 401 });
    }
    const admin = getSupabaseServer();
    if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as { code?: string };
    if (!body.code?.trim()) {
      return NextResponse.json({ ok: false, error: 'code is required' }, { status: 400 });
    }

    const result = await claimAccessInvitation(admin, body.code, { personaId: persona.personaId });
    if (!result.ok) {
      const status = result.error.includes('access_invitations') ? 503 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Claim failed' },
      { status: 500 },
    );
  }
}
