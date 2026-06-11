/**
 * GET /api/polity-passport/credential/[passportId] — claim the passport
 * credential envelope (Phase A).
 *
 * The first concrete answer to "what form does the passport take and where
 * does the agent store it": a W3C-VC-shaped JSON envelope the agent/operator
 * downloads and holds. Issued lazily from the passport record at claim time —
 * the steward decision pipeline is untouched. Public route: every field in
 * the envelope already appears in the public registry projection (commitment
 * refs only; T0 identifiers never serialise here).
 *
 * Claimable states — citizen: active / renewal_due; participant: approved /
 * provisionally_issued / restricted, and not revoked. Anything else → 409
 * with the reason, so callers can distinguish "not yet" from "not found".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  buildPassportCredential,
  isClaimable,
  type PassportRecordRow,
} from '@/services/passport/passportCredential';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ passportId: string }> },
) {
  try {
    const { passportId } = await context.params;
    if (!/^[a-z0-9-]{4,80}$/i.test(passportId)) {
      return NextResponse.json({ ok: false, error: 'Invalid passport id' }, { status: 400 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }

    const { data, error } = await admin
      .from('polity_passport_records')
      .select(
        'passport_id, passport_class, citizen_status, participant_status, passport_grade, kybe_did_public_ref, persona_public_ref, registry_record_id, issuer_id, issued_at, expires_at, revoked',
      )
      .eq('passport_id', passportId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Passport not found' }, { status: 404 });
    }

    const record = data as unknown as PassportRecordRow;
    const claim = isClaimable(record);
    if (!claim.claimable) {
      return NextResponse.json(
        { ok: false, error: 'Passport not claimable', reason: claim.reason },
        { status: 409 },
      );
    }

    const host = req.nextUrl.origin;
    const credential = buildPassportCredential(record, host);

    return NextResponse.json(
      {
        ok: true,
        credential,
        note:
          'Hold this envelope — it is your passport credential. Phase A proof is a Bureau HMAC stub; a publicly verifiable asymmetric proof ships in Phase C.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Credential claim failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
