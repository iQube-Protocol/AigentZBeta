/**
 * GET /api/polity-passport/wallet — passport credentials for the active
 * persona's wallet (PassportQube surface).
 *
 * Returns ALL polity_passport_records where persona_id matches the caller.
 * Each row includes claim state and (for claimed passports) the lazily-built
 * W3C-VC credential envelope. T1-safe only — never exposes T0 identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listOwnedPersonaIds } from '@/services/identity/passportPrincipal';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  buildPassportCredential,
  isClaimable,
  type PassportRecordRow,
} from '@/services/passport/passportCredential';
import { publicOrigin } from '@/utils/publicOrigin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const callerAuthProfileId = (await getCallerIdentityContext(req))?.authProfileId ?? '';

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // credential_claimed_at ships in migration 20260612100000 — fall back to
    // the legacy column set (all passports read as unclaimed) until it runs.
    /*
     * SCOPED TO EVERY PERSONA THE CALLER OWNS, not just the active one
     * (operator, 2026-08-03).
     *
     * This filtered `.eq('persona_id', persona.personaId)`. A holder with
     * several personas therefore saw their Citizen Passport only while the
     * owning persona happened to be selected — and the Passport Bureau, which
     * consumes this route for its sponsor-eligibility check, rendered "No
     * Citizen Passport application yet" INSIDE a Journey whose own observer
     * had already recognised that same Passport and routed to the Delegate
     * path. One question, two scopes, two answers, on one screen.
     *
     * A credential belongs to the HOLDER, not to whichever persona is active
     * when the question is asked. `listOwnedPersonaIds` is the shared scope
     * the Journey observer uses, so both now answer over the same set.
     */
    const owned = await listOwnedPersonaIds(admin, callerAuthProfileId);
    const scopedPersonaIds = owned.ok ? owned.personaIds : [persona.personaId];

    let { data, error } = await admin
      .from('polity_passport_records')
      .select(
        'passport_id, passport_class, citizen_status, participant_status, passport_grade, kybe_did_public_ref, persona_public_ref, registry_record_id, issuer_id, issued_at, expires_at, revoked, credential_claimed_at',
      )
      .in('persona_id', scopedPersonaIds);

    if (error && error.message.includes('credential_claimed_at')) {
      ({ data, error } = await admin
        .from('polity_passport_records')
        .select(
          'passport_id, passport_class, citizen_status, participant_status, passport_grade, kybe_did_public_ref, persona_public_ref, registry_record_id, issuer_id, issued_at, expires_at, revoked',
        )
        .in('persona_id', scopedPersonaIds));
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Behind Amplify's proxy, req.nextUrl.origin is the INTERNAL
    // localhost:3000 — which then leaks into the passport's issuer +
    // statusListUrl and is unresolvable/unverifiable by any recipient.
    // publicOrigin resolves the externally-reachable host (env / forwarded
    // headers) instead. No hardcoded hostnames (No-Guessing rule).
    const host = publicOrigin(req);
    const passportQubes = (data ?? []).map((row) => {
      const record = row as unknown as PassportRecordRow;
      const claimedAt = ((row as Record<string, unknown>).credential_claimed_at as string | undefined) ?? null;
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

    // Also return pending applications so the Locker can show application
    // status when no passport record has been issued yet.
    const { data: pendingApps } = await admin
      .from('polity_passport_applications')
      .select('id, passport_class, application_status, passport_grade, submitted_at, updated_at')
      .in('persona_id', scopedPersonaIds)
      .in('application_status', ['submitted', 'pending_approval', 'needs_more_information']);

    const pendingApplications = (pendingApps ?? []).map((app) => ({
      applicationId: String(app.id),
      passportClass: app.passport_class,
      applicationStatus: app.application_status,
      passportGrade: app.passport_grade,
      submittedAt: app.submitted_at,
      updatedAt: app.updated_at,
    }));

    return NextResponse.json(
      { ok: true, passportQubes, pendingApplications },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Wallet load failed' },
      { status: 500 },
    );
  }
}
