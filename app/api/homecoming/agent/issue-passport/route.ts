/**
 * POST /api/homecoming/agent/issue-passport — Agent Homecoming (CFS-023 → L5).
 *
 * Issue + bind a delegate's Participant Passport in one deliberate admin call:
 * submit → approve (admin-as-Bureau) → bind agent_root_identity.bound_passport_id.
 * Reports the delegate's Constitutional Presence after. Idempotent — an
 * already-bound delegate returns its existing passport.
 *
 * This is a distinct authority act (issuing registry citizenship), so it is its
 * own explicit route + button, NOT a silent side-effect of stand-up. Admin-gated;
 * the caller is the reviewing steward. L5 ALSO requires an earned (reputation-
 * gated) delegation grant — this delivers the passport half only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { issueDelegatePassport } from '@/services/homecoming/issueDelegatePassport';
import { assessDelegate } from '@/services/homecoming/constitutionalPresence';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  let body: { delegate?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const delegate = body.delegate as HomecomingDelegateId;
  if (!delegate || !(HOMECOMING_DELEGATES as readonly string[]).includes(delegate)) {
    return NextResponse.json(
      { ok: false, error: `delegate must be one of: ${HOMECOMING_DELEGATES.join(', ')}` },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const result = await issueDelegatePassport({ admin, delegate, stewardPersonaId: persona.personaId });
  const presence = await assessDelegate(admin, delegate).catch(() => null);

  if (!result.ok) {
    return NextResponse.json({ ok: false, delegate, error: result.error, presence }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    delegate,
    passportId: result.passportId,
    alreadyBound: Boolean(result.alreadyBound),
    submitted: Boolean(result.submitted),
    presence,
    note: result.alreadyBound
      ? 'Passport already issued + bound.'
      : 'Participant Passport issued (admin-as-Bureau approval) and bound to the RootDID — the L5 passport signal. L5 also needs an earned delegation grant.',
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note: 'POST { delegate } (admin) to submit → approve → bind a delegate Participant Passport. Idempotent.',
  });
}
