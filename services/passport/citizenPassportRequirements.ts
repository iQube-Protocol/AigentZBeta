/**
 * Citizen Passport — mandatory-evidence requirements + completeness evaluator.
 *
 * Single source of truth for what "mandatory evidence" means for a Citizen
 * application (inv.engineering.036/037 — the submit route previously
 * hand-declared its own copy of MANDATORY_CONSENTS/MANDATORY_ACKS; that copy
 * now imports from here instead of re-declaring it, so the submit-time gate
 * and the auto-issuance evaluator can never drift apart).
 *
 * Operator ruling, 2026-08-21 (P1, Passport Bureau operationalization):
 * "The system should establish whether the required proof is satisfied.
 * When it is, recognition follows. Human review is for ambiguity and
 * failure cases, not discretionary admission." This module is the
 * "establish whether the required proof is satisfied" half of that ruling
 * — it is a pure predicate over an application row. It NEVER decides
 * issuance (that's services/passport/citizenAutoIssuance.ts) and NEVER
 * writes anything (that's services/passport/issuanceService.ts).
 */

import type { PolityPassportApplicationRow } from '@/services/passport/passportApplicationTypes';

export const MANDATORY_CONSENTS = [
  'passport_terms_accepted',
  'privacy_terms_accepted',
  'registry_pending_record_consent',
  'blackqube_private_storage_consent',
] as const;

export const MANDATORY_ACKS = [
  'private_data_not_stored_in_supabase_acknowledged',
  'bureau_cannot_decrypt_private_payload_acknowledged',
  'sysadmins_cannot_recover_private_payload_acknowledged',
  'loss_of_key_risk_acknowledged',
] as const;

/**
 * Our own small operational vocabulary — distinct from, but cross-referenced
 * to, the JSON schema's `decision_reason_codes`
 * (polity-passport-bureau/schemas/polity-passport.review-decision.schema.json).
 * `decision_reason_codes` describes WHY a decision was reached (an audit/
 * receipt concern); this describes WHAT OPERATIONAL CLASS blocked automatic
 * issuance (an admin-triage concern). Reuse the schema's codes inside
 * `schemaReasonCodes` rather than inventing a parallel "why" vocabulary —
 * this type is only the "what class of exception" label.
 */
export type CitizenEvidenceReasonCode =
  | 'evidence_incomplete'
  | 'evidence_conflict'
  | 'verification_unavailable';

export type CitizenEvidenceEvaluation =
  | { complete: true; schemaReasonCodes: string[] }
  | {
      complete: false;
      reasonCode: CitizenEvidenceReasonCode;
      detail: string;
      schemaReasonCodes: string[];
    };

function hasAllMandatoryConsents(consents: Record<string, unknown> | null | undefined): boolean {
  if (!consents) return false;
  return MANDATORY_CONSENTS.every((c) => consents[c] === true);
}

function hasAllMandatoryAcks(consents: Record<string, unknown> | null | undefined): boolean {
  const acks = (consents?.self_custody_acknowledgements ?? null) as
    | Record<string, unknown>
    | null;
  if (!acks) return false;
  return MANDATORY_ACKS.every((a) => acks[a] === true);
}

/**
 * Pure evaluator — no I/O. `conflictingOpenApplicationExists` and
 * `activeCitizenPassportExists` are passed in (rather than queried here) so
 * this stays a pure, unit-testable predicate; the caller
 * (citizenAutoIssuance.ts) owns the DB round-trips and their own failure
 * handling (a query failure there is `verification_unavailable`, not a
 * completeness verdict this function should fabricate).
 */
export function evaluateCitizenEvidenceCompleteness(
  app: PolityPassportApplicationRow,
  context: {
    conflictingOpenApplicationExists: boolean;
    activeCitizenPassportExists: boolean;
  },
): CitizenEvidenceEvaluation {
  if (context.activeCitizenPassportExists || context.conflictingOpenApplicationExists) {
    return {
      complete: false,
      reasonCode: 'evidence_conflict',
      detail: context.activeCitizenPassportExists
        ? 'An active Citizen Passport already exists for this identity'
        : 'Another open Citizen application already exists for this identity',
      schemaReasonCodes: ['human_review_required'],
    };
  }

  if (!app.persona_id) {
    return {
      complete: false,
      reasonCode: 'evidence_incomplete',
      detail: 'Application carries no persona_id — identity is not bound',
      schemaReasonCodes: ['identity_binding_incomplete'],
    };
  }

  if (!app.personhood_proof_type || !app.personhood_proof_ref) {
    return {
      complete: false,
      reasonCode: 'evidence_incomplete',
      detail: 'Weak proof of personhood is missing or unrecorded',
      schemaReasonCodes: ['personhood_proof_insufficient'],
    };
  }

  if (!hasAllMandatoryConsents(app.consents)) {
    return {
      complete: false,
      reasonCode: 'evidence_incomplete',
      detail: 'One or more mandatory consents were not recorded as accepted',
      schemaReasonCodes: ['obligations_not_accepted'],
    };
  }

  if (!hasAllMandatoryAcks(app.consents)) {
    return {
      complete: false,
      reasonCode: 'evidence_incomplete',
      detail: 'One or more mandatory self-custody acknowledgements were not recorded as accepted',
      schemaReasonCodes: ['obligations_not_accepted'],
    };
  }

  return {
    complete: true,
    schemaReasonCodes: ['schema_valid', 'personhood_proof_valid', 'obligations_accepted'],
  };
}
