/**
 * Polity Passport credential envelope — Phase A of the "what does the agent
 * actually hold" workstream (operator-approved 2026-06-11).
 *
 * Builds a W3C-VC-shaped credential from a polity_passport_records row.
 * Issued LAZILY at claim time (GET /api/polity-passport/credential/[passportId])
 * so the Stage 6 steward decision pipeline is untouched. The envelope contains
 * ONLY public-safe fields (commitment refs, status, validity) — never
 * persona_id / kybe_identity_id / root_identity_id (T0 rule).
 *
 * Signing (Phase A stub): HMAC-SHA256 over the canonical credential JSON
 * using PASSPORT_BUREAU_CREDENTIAL_SECRET. This proves the envelope came
 * from a holder of the Bureau secret but is NOT a publicly verifiable
 * signature. Phase C replaces this with an asymmetric key (custody decision
 * pending: Bureau KMS vs IC canister identity) and a public verification
 * method. The proof.type makes the stub status explicit so no downstream
 * consumer can mistake it for a production VC proof.
 */

import { createHmac } from 'crypto';

export interface PassportRecordRow {
  passport_id: string;
  passport_class: string;
  citizen_status: string | null;
  participant_status: string | null;
  passport_grade: string | null;
  kybe_did_public_ref: string | null;
  persona_public_ref: string | null;
  registry_record_id: string | null;
  issuer_id: string;
  issued_at: string | null;
  expires_at: string | null;
  revoked: boolean;
}

const CLAIMABLE_CITIZEN = new Set(['active', 'renewal_due']);
const CLAIMABLE_PARTICIPANT = new Set(['approved', 'provisionally_issued', 'restricted']);

/** A passport is claimable when it is in force and (for participants) not revoked. */
export function isClaimable(record: PassportRecordRow): { claimable: boolean; reason?: string } {
  if (record.passport_class === 'citizen') {
    if (!record.citizen_status || !CLAIMABLE_CITIZEN.has(record.citizen_status)) {
      return { claimable: false, reason: `citizen passport status is ${record.citizen_status ?? 'unknown'}` };
    }
    return { claimable: true };
  }
  if (record.revoked) return { claimable: false, reason: 'passport is revoked' };
  if (!record.participant_status || !CLAIMABLE_PARTICIPANT.has(record.participant_status)) {
    return { claimable: false, reason: `participant passport status is ${record.participant_status ?? 'unknown'}` };
  }
  return { claimable: true };
}

function credentialType(passportClass: string): string {
  if (passportClass === 'citizen') return 'PolityCitizenPassport';
  if (passportClass === 'robot_participant') return 'PolityRobotParticipantPassport';
  if (passportClass === 'organization_participant') return 'PolityOrganizationParticipantPassport';
  return 'PolityAgentParticipantPassport';
}

export function buildPassportCredential(record: PassportRecordRow, host: string) {
  const credential = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential', credentialType(record.passport_class)],
    issuer: {
      id: `${host}/.well-known/polity-passport`,
      name: record.issuer_id,
    },
    validFrom: record.issued_at ?? undefined,
    validUntil: record.expires_at ?? undefined,
    credentialSubject: {
      // The KybeDID commitment ref is the subject anchor — public-safe by design.
      id: record.kybe_did_public_ref ?? undefined,
      passportId: record.passport_id,
      passportClass: record.passport_class,
      passportGrade: record.passport_grade ?? undefined,
      passportStatus: record.citizen_status ?? record.participant_status ?? undefined,
      personaPublicRef: record.persona_public_ref ?? undefined,
      registryRecordId: record.registry_record_id ?? undefined,
      ...(record.passport_class === 'citizen' ? { citizenPassportIrrevocable: true } : {}),
    },
    credentialStatus: {
      type: 'PolityPassportRegistryEntry',
      statusListUrl: `${host}/api/polity-passport/registry`,
    },
  };

  const secret = process.env.PASSPORT_BUREAU_CREDENTIAL_SECRET;
  const canonical = JSON.stringify(credential);
  const issuedAt = new Date().toISOString();

  if (!secret) {
    console.warn(
      '[passport credential] PASSPORT_BUREAU_CREDENTIAL_SECRET unset — issuing UNSIGNED stub envelope for',
      record.passport_id,
    );
    return {
      ...credential,
      proof: {
        type: 'PolityBureauUnsignedStub/v0',
        created: issuedAt,
        note: 'No Bureau credential secret configured. This envelope is structurally complete but carries no integrity proof.',
      },
    };
  }

  const signatureValue = createHmac('sha256', secret).update(canonical).digest('base64url');
  return {
    ...credential,
    proof: {
      type: 'PolityBureauHmacStub/v0',
      created: issuedAt,
      proofPurpose: 'assertionMethod',
      note: 'Phase A HMAC stub — verifiable only by the Bureau. Phase C replaces this with an asymmetric, publicly verifiable proof.',
      signatureValue,
    },
  };
}
