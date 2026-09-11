/**
 * Polity Passport credential verification — Phase 3 item 5 (2026-09-07).
 *
 * Deliberately a SEPARATE module from both `passportCredential.ts` (builds
 * the envelope) and `passportCredentialSigningProviders.ts` (produces new
 * signatures): "verify signatures independently from issuance" means this
 * code path shares no in-memory state or call chain with signing — it
 * re-derives the canonical payload from the credential ITSELF and checks it
 * against the public key registry, exactly as any third-party verifier
 * with no access to this issuer's private key material would.
 *
 * Handles every proof type this issuer has ever produced:
 *   - `PolityBureauEd25519Signature2026` — the new asymmetric signature.
 *   - `PolityBureauHmacStub/v0` — the legacy Phase A HMAC stub. Verified
 *     using the EXACT same (non-canonicalized) serialization it was
 *     originally signed with (`JSON.stringify`, insertion-order-dependent)
 *     — never the new sorted-key canonicalization, which would never match
 *     a legacy signature. This is what "preserve legacy credentials" means
 *     for verification: replicate the historical algorithm precisely,
 *     never "fix" it.
 *   - `PolityBureauUnsignedStub/v0` — never valid; it never claimed a
 *     signature.
 *   - anything else — `unknown_algorithm`, fail closed.
 *
 * Never mutates or re-signs a credential. This module only READS.
 *
 * Phase 5.1a (2026-09-11, operator ruling): the issuer-id check now accepts
 * EITHER the current stable Bureau `did:web` (exact match) OR the legacy
 * host-shaped issuer id (suffix match, unchanged) — see
 * `isRecognisedIssuerId`. The Ed25519 branch additionally checks
 * key-authorization-at-issuance-time BEFORE the cryptographic signature
 * check (`evaluateKeyAuthorizationAtTime` in the signing-providers module) —
 * key lifecycle is a distinct concept from credential lifecycle; see that
 * function's doc comment for the full model.
 *
 * Phase 5.1b (2026-09-11): `verifyPassportCredentialWithLifecycle` composes
 * this module's signature check with DB-backed Passport-row lifecycle facts
 * (revoked / supersededBy) supplied by the caller — this module itself
 * remains DB-free.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import {
  ED25519_SUITE,
  buildSignablePayload,
  verifyEd25519Signature,
  findKnownKey,
  evaluateKeyAuthorizationAtTime,
  tryResolveBureauIssuerDid,
} from '@/services/passport/passportCredentialSigningProviders';

const HMAC_STUB_TYPE = 'PolityBureauHmacStub/v0';
const UNSIGNED_STUB_TYPE = 'PolityBureauUnsignedStub/v0';
// Legacy, host-shaped issuer id — preserved for credentials issued BEFORE
// the stable-DID scheme (Phase 5.1a, operator ruling 2026-09-11). Never
// deleted, exactly like the legacy HMAC-stub proof branch: an already-issued
// credential is never touched, so its verification path must not change.
const EXPECTED_ISSUER_ID_SUFFIX = '/.well-known/polity-passport';

export type CredentialVerificationResult =
  | { valid: true; suite: string; keyId?: string }
  /**
   * A key SUSPECTED compromised at the moment this credential's signature
   * was created — not auto-decided as valid or invalid (operator ruling,
   * 2026-09-11: "credentials issued during or after the suspected-compromise
   * interval should become UNRESOLVED... according to the Bureau's
   * adjudication policy"). Mirrors `types/confidentialProjection.ts`'s
   * `UNRESOLVED` precedent — not an error state, the honest representation
   * of "cannot safely decide here."
   */
  | { valid: 'UNRESOLVED'; suite: string; keyId: string; reason: 'key_signed_during_suspected_compromise_window' }
  | {
      valid: false;
      reason:
        | 'malformed_proof'
        | 'unknown_algorithm'
        | 'unknown_key'
        | 'malformed_key'
        | 'signature_mismatch'
        | 'legacy_secret_unavailable'
        | 'unsigned_stub'
        | 'unknown_issuer'
        // Phase 5.1a key-authorization-at-issuance-time reasons — see
        // evaluateKeyAuthorizationAtTime. Distinct from `unknown_key`
        // (the keyId isn't in the registry at all) and from
        // `signature_mismatch` (the registry has the key, but it was not
        // AUTHORIZED to sign at the time this proof claims it did).
        | 'key_not_yet_valid'
        | 'key_expired'
        | 'key_revoked_before_issuance';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accepts EITHER the current stable Bureau DID (exact match) OR the legacy
 * host-shaped issuer id (suffix match) — see the module-level comment above
 * `EXPECTED_ISSUER_ID_SUFFIX`. Never throws: a verifier must fail closed via
 * its returned result, never crash on a missing/misconfigured env var.
 */
function isRecognisedIssuerId(issuerId: string): boolean {
  const configuredDid = tryResolveBureauIssuerDid();
  if (configuredDid && issuerId === configuredDid) return true;
  return issuerId.endsWith(EXPECTED_ISSUER_ID_SUFFIX);
}

/**
 * Verify an issued Polity Passport credential's proof. Fails closed on any
 * unrecognised algorithm, key, issuer, or a proof missing the fields its own
 * declared type requires — never treats an unverifiable proof as valid.
 */
export function verifyPassportCredential(credential: unknown): CredentialVerificationResult {
  if (!isRecord(credential)) return { valid: false, reason: 'malformed_proof' };

  const issuer = credential.issuer;
  if (!isRecord(issuer) || typeof issuer.id !== 'string' || !isRecognisedIssuerId(issuer.id)) {
    return { valid: false, reason: 'unknown_issuer' };
  }

  const proof = credential.proof;
  if (!isRecord(proof) || typeof proof.type !== 'string') {
    return { valid: false, reason: 'malformed_proof' };
  }

  const { proof: _proof, ...payloadWithoutProof } = credential;

  if (proof.type === ED25519_SUITE) {
    if (
      typeof proof.keyId !== 'string' ||
      typeof proof.signatureValue !== 'string' ||
      typeof proof.created !== 'string' ||
      typeof proof.proofPurpose !== 'string' ||
      Number.isNaN(Date.parse(proof.created))
    ) {
      return { valid: false, reason: 'malformed_proof' };
    }

    // Key-authorization-at-issuance-time (Phase 5.1a, operator ruling
    // 2026-09-11): "signing key authorized at T" is checked BEFORE the
    // cryptographic signature check, mirroring the ruling's own stated
    // model (issuer DID valid at T → signing key authorized at T →
    // signature valid). A key this issuer never registered is
    // `unknown_key`; a registered key that was not authorized to sign AT
    // `proof.created` is a distinct, more specific failure than a generic
    // signature mismatch.
    const knownKey = findKnownKey(proof.keyId);
    if (!knownKey) return { valid: false, reason: 'unknown_key' };

    const authorization = evaluateKeyAuthorizationAtTime(knownKey, proof.created);
    if (authorization.authorized === 'UNRESOLVED') {
      return { valid: 'UNRESOLVED', suite: ED25519_SUITE, keyId: proof.keyId, reason: authorization.reason };
    }
    if (authorization.authorized === false) {
      return { valid: false, reason: authorization.reason };
    }

    // Reconstructed from the STORED proof's own created/proofPurpose — if
    // either was tampered, this recomputes a DIFFERENT signable payload
    // than what was actually signed, so verification fails exactly like
    // tampering the credential body does (see buildSignablePayload).
    const signablePayload = buildSignablePayload(payloadWithoutProof, {
      created: proof.created,
      proofPurpose: proof.proofPurpose,
    });
    const outcome = verifyEd25519Signature(signablePayload, proof.keyId, proof.signatureValue);
    if (!outcome.ok) return { valid: false, reason: outcome.reason };
    return { valid: true, suite: ED25519_SUITE, keyId: proof.keyId };
  }

  if (proof.type === HMAC_STUB_TYPE) {
    if (typeof proof.signatureValue !== 'string') return { valid: false, reason: 'malformed_proof' };
    const secret = process.env.PASSPORT_BUREAU_CREDENTIAL_SECRET;
    if (!secret) return { valid: false, reason: 'legacy_secret_unavailable' };
    // Legacy algorithm, byte-for-byte: plain JSON.stringify, NEVER the new
    // sorted-key canonicalization — this is what the credential was
    // actually signed with at issuance time.
    const legacyCanonical = JSON.stringify(payloadWithoutProof);
    const expected = createHmac('sha256', secret).update(legacyCanonical).digest('base64url');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(proof.signatureValue, 'utf8');
    const matches = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    return matches ? { valid: true, suite: HMAC_STUB_TYPE } : { valid: false, reason: 'signature_mismatch' };
  }

  if (proof.type === UNSIGNED_STUB_TYPE) {
    return { valid: false, reason: 'unsigned_stub' };
  }

  return { valid: false, reason: 'unknown_algorithm' };
}

/**
 * Lifecycle facts about the Passport a credential's signature was
 * independently found to be about — supplied by the caller (this module
 * never queries the database itself; `verifyPassportCredential` above is
 * deliberately DB-free, and this wrapper stays DB-free too, taking
 * already-resolved facts rather than a connection). `supersededBy` is the
 * REVERSE direction of `renewal_of_passport_id` — the passport that named
 * THIS one as its predecessor, if any (resolved by the caller via a query
 * against `polity_passport_records.renewal_of_passport_id`).
 */
export interface PassportLifecycleFacts {
  revoked: boolean;
  supersededBy: string | null;
}

export interface CredentialLifecycleVerificationResult {
  /** The signature/key-authorization-at-issuance-time result — see verifyPassportCredential. Orthogonal to lifecycle: a caller can always ask "is the signature itself valid" independent of "is the passport currently in good standing." */
  signature: CredentialVerificationResult;
  revoked: boolean;
  supersededBy: string | null;
  /**
   * Valid signature AND not revoked. A superseded-but-not-revoked
   * credential is deliberately NOT folded into this boolean — supersession
   * is a fact the caller sees (`supersededBy`) and decides policy on, never
   * a hardcoded verifier opinion (sub-plan Phase 5.1b).
   */
  presentable: boolean;
}

/**
 * Composes the (now key-authorization-at-issuance-time-aware)
 * `verifyPassportCredential` with lifecycle facts about the Passport row
 * backing the credential (Phase 5.1b). Deliberately calls the unchanged
 * signature check FIRST and never merges the two concerns into one
 * function — signature validity must remain separately callable and
 * independently testable from DB-backed lifecycle state.
 */
export function verifyPassportCredentialWithLifecycle(
  credential: unknown,
  lifecycle: PassportLifecycleFacts,
): CredentialLifecycleVerificationResult {
  const signature = verifyPassportCredential(credential);
  return {
    signature,
    revoked: lifecycle.revoked,
    supersededBy: lifecycle.supersededBy,
    presentable: signature.valid === true && !lifecycle.revoked,
  };
}
