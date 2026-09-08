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
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { ED25519_SUITE, buildSignablePayload, verifyEd25519Signature } from '@/services/passport/passportCredentialSigningProviders';

const HMAC_STUB_TYPE = 'PolityBureauHmacStub/v0';
const UNSIGNED_STUB_TYPE = 'PolityBureauUnsignedStub/v0';
const EXPECTED_ISSUER_ID_SUFFIX = '/.well-known/polity-passport';

export type CredentialVerificationResult =
  | { valid: true; suite: string; keyId?: string }
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
        | 'unknown_issuer';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Verify an issued Polity Passport credential's proof. Fails closed on any
 * unrecognised algorithm, key, issuer, or a proof missing the fields its own
 * declared type requires — never treats an unverifiable proof as valid.
 */
export function verifyPassportCredential(credential: unknown): CredentialVerificationResult {
  if (!isRecord(credential)) return { valid: false, reason: 'malformed_proof' };

  const issuer = credential.issuer;
  if (!isRecord(issuer) || typeof issuer.id !== 'string' || !issuer.id.endsWith(EXPECTED_ISSUER_ID_SUFFIX)) {
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
      typeof proof.proofPurpose !== 'string'
    ) {
      return { valid: false, reason: 'malformed_proof' };
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
