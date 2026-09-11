/**
 * Polity Passport credential envelope — Phase A of the "what does the agent
 * actually hold" workstream (operator-approved 2026-06-11); signing upgraded
 * to asymmetric (Phase 3 item 5, 2026-09-07).
 *
 * Builds a W3C-VC-shaped credential from a polity_passport_records row.
 * Issued LAZILY at claim time (GET /api/polity-passport/credential/[passportId])
 * so the Stage 6 steward decision pipeline is untouched. The envelope contains
 * ONLY public-safe fields (commitment refs, status, validity) — never
 * persona_id / kybe_identity_id / root_identity_id (T0 rule).
 *
 * Signing: Ed25519 (`services/passport/passportCredentialSigningProviders.ts`)
 * over the CANONICAL (sorted-key) credential JSON, when a signing key is
 * configured — a publicly verifiable, provider-backed signature
 * (`services/passport/passportCredentialVerification.ts` verifies it
 * independently, needing only the public key). When no key is configured,
 * falls back to the SAME unsigned-stub proof this envelope has always used
 * for that case — structurally complete, explicitly not a signature. The
 * legacy Phase A HMAC stub (`PolityBureauHmacStub/v0`) is RETIRED for new
 * issuance (Ed25519 is strictly its successor) but remains fully verifiable
 * for every credential already issued under it — see the verification
 * module's own legacy-algorithm handling. No already-issued credential is
 * ever re-signed or mutated by this upgrade.
 */

import { signCredentialPayload, buildSignablePayload } from '@/services/passport/passportCredentialSigningProviders';

export interface PassportRecordRow {
  passport_id: string;
  passport_class: string;
  citizen_status: string | null;
  participant_status: string | null;
  passport_grade: string | null;
  kybe_did_public_ref: string | null;
  /**
   * DiDQube Phase 3 item 4 (2026-09-07): the non-citizen subject anchor.
   * Citizens are kybe-anchored (personhood, permanent); every other passport
   * class (agent/robot/organization participant) has no kybe_identity at
   * all — its subject is its RootDID commitment instead. See
   * `resolveCredentialSubjectId` below.
   */
  root_did_public_ref: string | null;
  persona_public_ref: string | null;
  registry_record_id: string | null;
  issuer_id: string;
  issued_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  /**
   * Successor-credential reconciliation (Phase 3 item 3): set when this
   * record supersedes an earlier one (`issueSuccessorPassport`). Carried
   * into the credential as `credentialSubject.supersedesPassportId` so a
   * verifier can see the predecessor reference is PART of the signed
   * payload — tampering with it invalidates the signature exactly like any
   * other claim. `undefined`/absent columns on older rows read as `null`.
   */
  renewal_of_passport_id?: string | null;
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

/**
 * Class-sensitive VC subject anchor (DiDQube Phase 3 item 4, brief §8):
 * citizen → `kybe_did_public_ref` (personhood, permanent); every other
 * passport class → `root_did_public_ref` (a citizen has no RootDID recorded
 * on their own Passport row and an agent/robot/organization has no
 * kybe_identity at all — the two refs are never interchangeable). Applied
 * to NEW issuance only; an already-issued credential's subject is never
 * mutated — a subject change goes through successor issuance (Phase 3
 * item 3), never a rebuild of this same envelope from updated columns.
 */
function resolveCredentialSubjectId(record: PassportRecordRow): string | undefined {
  return (record.passport_class === 'citizen' ? record.kybe_did_public_ref : record.root_did_public_ref) ?? undefined;
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
      // Class-sensitive subject anchor — see resolveCredentialSubjectId.
      id: resolveCredentialSubjectId(record),
      passportId: record.passport_id,
      passportClass: record.passport_class,
      passportGrade: record.passport_grade ?? undefined,
      passportStatus: record.citizen_status ?? record.participant_status ?? undefined,
      personaPublicRef: record.persona_public_ref ?? undefined,
      registryRecordId: record.registry_record_id ?? undefined,
      ...(record.passport_class === 'citizen' ? { citizenPassportIrrevocable: true } : {}),
      ...(record.renewal_of_passport_id ? { supersedesPassportId: record.renewal_of_passport_id } : {}),
    },
    credentialStatus: {
      type: 'PolityPassportRegistryEntry',
      statusListUrl: `${host}/api/polity-passport/registry`,
    },
  };

  const issuedAt = new Date().toISOString();
  const proofPurpose = 'assertionMethod';
  // created/proofPurpose are bound INTO the signed payload (see
  // buildSignablePayload) so tampering either after issuance invalidates
  // the signature exactly like tampering the credential body does.
  const signablePayload = buildSignablePayload(credential, { created: issuedAt, proofPurpose });

  const signed = signCredentialPayload(signablePayload);
  if (signed) {
    return {
      ...credential,
      proof: {
        type: signed.suite,
        created: issuedAt,
        proofPurpose,
        keyId: signed.keyId,
        signatureValue: signed.signatureValue,
      },
    };
  }

  console.warn(
    '[passport credential] no active signing key configured — issuing UNSIGNED stub envelope for',
    record.passport_id,
  );
  return {
    ...credential,
    proof: {
      type: 'PolityBureauUnsignedStub/v0',
      created: issuedAt,
      note: 'No Bureau signing key configured. This envelope is structurally complete but carries no integrity proof.',
    },
  };
}
