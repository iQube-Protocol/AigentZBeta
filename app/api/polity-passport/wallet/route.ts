/**
 * GET /api/polity-passport/wallet — passport credentials for the active
 * persona's wallet (PassportQube surface).
 *
 * Returns ALL polity_passport_records where persona_id matches the caller.
 * Each row includes claim state and (for claimed passports) the lazily-built
 * W3C-VC credential envelope. T1-safe only — never exposes T0 identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  buildPassportCredential,
  isClaimable,
  type PassportRecordRow,
} from '@/services/passport/passportCredential';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data, error } = await admin
      .from('polity_passport_records')
      .select(
        'passport_id, passport_class, citizen_status, participant_status, passport_grade, kybe_did_public_ref, persona_public_ref, registry_record_id, issuer_id, issued_at, expires_at, revoked, credential_claimed_at',
      )
      .eq('persona_id', persona.personaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const host = req.nextUrl.origin;
    const passportQubes = (data ?? []).map((row) => {
      const record = row as unknown as PassportRecordRow;
      const claimedAt = (row as Record<string, unknown>).credential_claimed_at as string | null;
      const claimCheck = isClaimable(record);
      return {
        passportId: record.passport_id,
        passportClass: record.passport_class,
        passportGrade: record.passport_grade,
        passportStatus: record.citizen_status ?? record.participant_status,
        issuedAt: record.issued_at,
        claimedAt,
        claimable: claimCheck.claimable,
        claimableReason: claimCheck.reason,
        credential: claimedAt ? buildPassportCredential(record, host) : undefined,
      };
    });

    return NextResponse.json(
      { ok: true, passportQubes },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Wallet load failed' },
      { status: 500 },
    );
  }
}
