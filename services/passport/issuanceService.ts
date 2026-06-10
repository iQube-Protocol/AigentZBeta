/**
 * Polity Passport Bureau — review decision + issuance service (Stage 6).
 *
 * PRD §10 steps 7–9, §14 (review policy). Applies a steward review decision
 * to an application and, on approval, issues the passport:
 *   - creates the polity_passport_records row with the per-class status
 *   - citizen issuance also creates the privilege-standing row (Addendum D:
 *     privileges are the ONLY reputation-consequence surface for citizens)
 *   - writes the status-transition audit row, driven by the status machine's
 *     rule metadata (receipt + evidence come from the machine, not ad hoc)
 *   - emits the passport_issued / passport_status_changed receipt through
 *     the canonical activity receipt pipeline (DVN anchoring is automatic)
 *
 * Authority: callers gate stewards via the spine
 * (cartridgeFlags.isAdmin || adminCartridges includes
 * 'polity-passport-bureau' — operator decision 3). This service trusts the
 * caller's gate and records the steward persona as the transition actor.
 */

import { randomBytes } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  citizenTransitionRule,
  participantTransitionRule,
  type CitizenPassportStatus,
  type ParticipantPassportStatus,
} from '@/services/passport/passportStatusMachine';

export const PASSPORT_BUREAU_CARTRIDGE_SLUG = 'polity-passport-bureau';

export type ReviewDecision = 'approve' | 'deny' | 'needs_more_information';

export interface ReviewDecisionInput {
  applicationId: string;
  decision: ReviewDecision;
  stewardPersonaId: string;
  notes?: string | null;
  /**
   * Participant approvals may issue as 'approved' (full) or
   * 'provisionally_issued'. Ignored for citizen applications (citizens
   * issue to 'active').
   */
  participantIssueStatus?: 'approved' | 'provisionally_issued';
}

export interface ReviewDecisionResult {
  ok: boolean;
  applicationStatus?: string;
  passportId?: string;
  passportRecordId?: string;
  receiptId?: string | null;
  error?: string;
}

function mintPassportId(passportClass: string): string {
  const prefix = passportClass === 'citizen' ? 'ppc' : 'ppp';
  return `${prefix}-${randomBytes(12).toString('hex')}`;
}

export async function applyReviewDecision(
  input: ReviewDecisionInput,
): Promise<ReviewDecisionResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };

  const { data: app, error: appError } = await admin
    .from('polity_passport_applications')
    .select('*')
    .eq('id', input.applicationId)
    .maybeSingle();
  if (appError) return { ok: false, error: appError.message };
  if (!app) return { ok: false, error: 'Application not found' };

  const openStatuses = ['submitted', 'pending_approval', 'needs_more_information'];
  if (!openStatuses.includes(String(app.application_status))) {
    return {
      ok: false,
      error: `Application is ${String(app.application_status)} — only open applications can be decided`,
    };
  }

  if (input.decision === 'deny' || input.decision === 'needs_more_information') {
    const nextStatus = input.decision === 'deny' ? 'denied' : 'needs_more_information';
    const { error: updateError } = await admin
      .from('polity_passport_applications')
      .update({
        application_status: nextStatus,
        assigned_steward_id: input.stewardPersonaId,
        decided_at: input.decision === 'deny' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.applicationId);
    if (updateError) return { ok: false, error: updateError.message };

    const receiptId = await writeReceipt({
      personaId: String(app.persona_id || '') || null,
      summary:
        input.decision === 'deny'
          ? `Passport application denied (${String(app.passport_class)})`
          : `Passport application needs more information (${String(app.passport_class)})`,
      actionType: 'passport_status_changed',
    });
    return { ok: true, applicationStatus: nextStatus, receiptId };
  }

  // ── Approve → issue ──────────────────────────────────────────────────────
  const passportClass = String(app.passport_class);
  const isCitizen = passportClass === 'citizen';

  // Status-machine validation: issuance is the pending_approval → issued
  // edge; the rule supplies the receipt + evidence contract.
  const issuedStatus: CitizenPassportStatus | ParticipantPassportStatus = isCitizen
    ? 'active'
    : input.participantIssueStatus ?? 'approved';
  const rule = isCitizen
    ? citizenTransitionRule('pending_approval', issuedStatus as CitizenPassportStatus)
    : participantTransitionRule(
        'pending_approval',
        issuedStatus as ParticipantPassportStatus,
      );
  if (!rule) {
    return {
      ok: false,
      error: `Status machine forbids pending_approval → ${issuedStatus} for ${passportClass}`,
    };
  }

  const passportId = mintPassportId(passportClass);
  const { data: record, error: recordError } = await admin
    .from('polity_passport_records')
    .insert({
      passport_id: passportId,
      passport_class: passportClass,
      citizen_status: isCitizen ? issuedStatus : null,
      participant_status: isCitizen ? null : issuedStatus,
      passport_grade: app.passport_grade ?? null,
      persona_id: app.persona_id ?? null,
      did_persona_id: app.did_persona_id ?? null,
      kybe_identity_id: app.kybe_identity_id ?? null,
      root_identity_id: app.root_identity_id ?? null,
      persona_public_ref: app.persona_public_ref ?? null,
      kybe_did_public_ref: app.kybe_did_public_ref ?? null,
      root_did_public_ref: app.root_did_public_ref ?? null,
      vault_content_id: app.vault_content_id ?? null,
      vault_content_hash: app.vault_content_hash ?? null,
      application_id: app.id,
      issued_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (recordError) return { ok: false, error: recordError.message };

  // Citizen issuance creates the privilege-standing row (Addendum D).
  if (isCitizen) {
    const { error: privError } = await admin.from('passport_citizen_privileges').insert({
      passport_record_id: record.id,
    });
    if (privError) {
      console.error('[passport issuance] privilege-standing insert failed:', privError.message);
    }
  }

  // Status-transition audit row — fields come from the machine rule.
  await admin.from('passport_status_transitions').insert({
    passport_record_id: record.id,
    from_status: 'pending_approval',
    to_status: issuedStatus,
    passport_class: passportClass,
    actor_type: 'steward',
    actor_id: input.stewardPersonaId,
    reason: input.notes ?? null,
    evidence_type: rule.evidence,
    receipt_action: rule.receipt,
  });

  const { error: appUpdateError } = await admin
    .from('polity_passport_applications')
    .update({
      application_status: 'approved',
      assigned_steward_id: input.stewardPersonaId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId);
  if (appUpdateError) {
    console.error('[passport issuance] application update failed:', appUpdateError.message);
  }

  const receiptId = await writeReceipt({
    personaId: String(app.persona_id || '') || null,
    summary: `Passport issued: ${passportId} (${passportClass}, ${issuedStatus})`,
    actionType: rule.receipt === 'passport_issued' ? 'passport_issued' : 'passport_status_changed',
  });

  return {
    ok: true,
    applicationStatus: 'approved',
    passportId,
    passportRecordId: String(record.id),
    receiptId,
  };
}

async function writeReceipt(input: {
  personaId: string | null;
  summary: string;
  actionType: 'passport_issued' | 'passport_status_changed';
}): Promise<string | null> {
  const personaId = input.personaId || process.env.PASSPORT_BUREAU_SYSTEM_PERSONA_ID || null;
  if (!personaId) {
    console.error(
      '[passport issuance] no persona for receipt and PASSPORT_BUREAU_SYSTEM_PERSONA_ID unset — receipt skipped:',
      input.summary,
    );
    return null;
  }
  try {
    const receipt = await createActivityReceipt({
      personaId,
      activeCartridge: PASSPORT_BUREAU_CARTRIDGE_SLUG,
      actionType: input.actionType,
      summary: input.summary,
    });
    return receipt?.id ?? null;
  } catch (e) {
    console.error('[passport issuance] receipt write failed:', e);
    return null;
  }
}
