/**
 * POST /api/passport/applications/submit — citizen passport application.
 *
 * PRD §9 steps 4–7 (application body, consents, weak proof, submission).
 * Validates the Addendum A self-custody acknowledgements (all four mandatory
 * booleans true), the consent block, the CAPTCHA weak proof, and the vault
 * ref (ciphertext refs only — this route carries NO private payload fields),
 * then writes the polity_passport_applications row and emits the
 * passport_application_submitted receipt through the canonical activity
 * receipt service (which fire-and-forgets DVN anchoring).
 *
 * Application-phase status here is 'submitted' — the passport-phase status
 * machines take over at issuance (Stage 6).
 *
 * Auth: spine — getActivePersona resolves the caller's Bureau persona.
 * T0: response carries the application row id + status only; persona refs
 * stay server-side (the row stores persona_public_ref as the commitment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { verifyWeakProof } from '@/services/passport/personhoodProof';
import { didPublicRef } from '@/services/passport/bureauIdentityService';

export const dynamic = 'force-dynamic';

const MANDATORY_ACKS = [
  'private_data_not_stored_in_supabase_acknowledged',
  'bureau_cannot_decrypt_private_payload_acknowledged',
  'sysadmins_cannot_recover_private_payload_acknowledged',
  'loss_of_key_risk_acknowledged',
] as const;

const MANDATORY_CONSENTS = [
  'passport_terms_accepted',
  'privacy_terms_accepted',
  'registry_pending_record_consent',
  'blackqube_private_storage_consent',
] as const;

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const consents = (body.consents ?? {}) as Record<string, unknown>;
    const acks = (consents.self_custody_acknowledgements ?? {}) as Record<string, unknown>;

    for (const consent of MANDATORY_CONSENTS) {
      if (consents[consent] !== true) {
        return NextResponse.json(
          { ok: false, error: `Consent required: ${consent}` },
          { status: 400 },
        );
      }
    }
    for (const ack of MANDATORY_ACKS) {
      if (acks[ack] !== true) {
        return NextResponse.json(
          { ok: false, error: `Self-custody acknowledgement required: ${ack}` },
          { status: 400 },
        );
      }
    }

    // Vault ref — ciphertext refs only. Private payload is optional (an
    // anonymous citizen application can be ref-free), but when present it
    // must be a completed vault upload.
    const vaultRef = body.selfCustodyRef as
      | { contentId?: string; contentHash?: string }
      | undefined;
    if (vaultRef && (!vaultRef.contentId || !vaultRef.contentHash)) {
      return NextResponse.json(
        { ok: false, error: 'selfCustodyRef must carry contentId + contentHash from the vault upload' },
        { status: 400 },
      );
    }

    // Weak personhood proof (CAPTCHA; strong proof slots in later).
    const proof = await verifyWeakProof(
      typeof body.captchaToken === 'string' ? body.captchaToken : '',
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    );
    if (!proof.ok) {
      return NextResponse.json({ ok: false, error: proof.error }, { status: 400 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }

    // One open citizen application per persona.
    const { data: openApps } = await admin
      .from('polity_passport_applications')
      .select('id, application_status')
      .eq('persona_id', persona.personaId)
      .eq('passport_class', 'citizen')
      .in('application_status', ['submitted', 'pending_approval', 'needs_more_information'])
      .limit(1);
    if (openApps && openApps.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'An open citizen application already exists for this persona',
          applicationId: String(openApps[0].id),
          applicationStatus: String(openApps[0].application_status),
        },
        { status: 409 },
      );
    }

    // Identity Hardening Policy — one natural person → one active Citizen
    // Passport. The open-application check above stops in-flight duplicates;
    // this stops a second application when an issued, still-valid Citizen
    // Passport already exists for this identity. Citizenship is unique;
    // reapplication is routed to the Participant class by the client.
    const { data: activeCitizen } = await admin
      .from('polity_passport_records')
      .select('passport_id, citizen_status')
      .eq('persona_id', persona.personaId)
      .eq('passport_class', 'citizen')
      .in('citizen_status', ['active', 'renewal_due'])
      .limit(1);
    if (activeCitizen && activeCitizen.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'citizen_passport_exists',
          error:
            'You already have an active Citizen Passport under this identity. Citizenship is unique — apply as a Participant instead.',
          passportId: String(activeCitizen[0].passport_id),
          citizenStatus: String(activeCitizen[0].citizen_status),
          suggestedClass: 'participant',
        },
        { status: 409 },
      );
    }

    const beingDeclarations =
      body.beingDeclarations && typeof body.beingDeclarations === 'object'
        ? body.beingDeclarations
        : null;
    const passportGrade =
      typeof body.passportGrade === 'string' && body.passportGrade.trim()
        ? body.passportGrade.trim()
        : 'anonymous_citizen';

    const { data: appRow, error: insertError } = await admin
      .from('polity_passport_applications')
      .insert({
        passport_class: 'citizen',
        application_status: 'submitted',
        persona_id: persona.personaId,
        persona_public_ref: didPublicRef(persona.personaId),
        vault_content_id: vaultRef?.contentId ?? null,
        vault_content_hash: vaultRef?.contentHash ?? null,
        vault_storage_provider: vaultRef ? 'auto_drive' : null,
        personhood_proof_type: proof.proofType,
        personhood_proof_ref: proof.proofRef,
        personhood_proof_at: new Date().toISOString(),
        passport_grade: passportGrade,
        consents,
        being_declarations: beingDeclarations,
        submitted_at: new Date().toISOString(),
      })
      .select('id, application_status')
      .single();
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    // Receipt — rides the canonical pipeline; DVN anchoring is automatic
    // for passport_application_submitted (ANCHORABLE_ACTION_TYPES).
    let receiptId: string | null = null;
    try {
      const receipt = await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: 'polity-passport-bureau',
        actionType: 'passport_application_submitted',
        summary: `Citizen passport application submitted (grade: ${passportGrade})`,
        contextShared: vaultRef ? ['self-custody-vault-ref'] : [],
      });
      receiptId = receipt?.id ?? null;
    } catch (e) {
      // Receipt failure must not lose the application; it is escalated in
      // logs and visible via the receipts UI for retry.
      console.error('[passport submit] receipt write failed:', e);
    }

    return NextResponse.json({
      ok: true,
      applicationId: String(appRow.id),
      applicationStatus: String(appRow.application_status),
      receiptId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Submission failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
