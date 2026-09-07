/**
 * Polity Passport credential signing — Phase 3 item 5 (asymmetric VC
 * signing, 2026-09-07). Mirrors the swappable-provider seam already
 * established for agreement acceptance (`services/constitutional/
 * agreementProviders.ts`): the credential ENVELOPE is the primitive
 * (`passportCredential.ts`, platform-owned); the SIGNING mechanism is a
 * replaceable provider behind one interface.
 *
 * ── KEYS ARE SERVER-SIDE AND PROVIDER-BACKED, NEVER IN THE CREDENTIAL ──────
 *
 * A provider's `sign` returns a `keyId` + signature — never key material.
 * `verify` needs only a PUBLIC key, looked up by `keyId` from a small
 * registry (`PASSPORT_BUREAU_SIGNING_KEYS_JSON`) — a verifier never touches
 * the private key, so verification is genuinely independent of issuance
 * (ruling requirement: "verify signatures independently from issuance").
 * The active signing key (used for NEW issuance only) is a SEPARATE env var
 * (`PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID` + the private key material) from
 * the registry of keys verification will accept — a rotated-out key stays
 * verifiable for credentials it already signed without being usable for new
 * ones.
 *
 * ── PROVIDERS ──────────────────────────────────────────────────────────────
 *
 *   - `local-ed25519` — Node's native Ed25519 (`crypto.sign`/`crypto.verify`,
 *     no new dependency). Fully functional; the default when a key is
 *     configured. Suite: `PolityBureauEd25519Signature2026`.
 *   - `unsigned-stub` — the Phase A fallback when no signing key is
 *     configured at all (dev/CI environments). Produces the SAME
 *     `PolityBureauUnsignedStub/v0` proof type `passportCredential.ts`
 *     already emits — never claims to be a real signature.
 *
 * A future KMS/HSM-backed provider (real custodial key management) is a
 * drop-in addition behind the same `SigningProvider` interface — exactly
 * how `agreementProviders.ts`'s `x409` sits beside `local`. Not built here;
 * no real KMS credentials exist to wire, and inventing one would be
 * guessing (CLAUDE.md's No-Guessing rule).
 *
 * ── LEGACY CREDENTIALS ARE NEVER RE-SIGNED ──────────────────────────────────
 *
 * This module only PRODUCES new signatures. It does not touch, does not
 * walk, and is never called against an already-issued credential's stored
 * proof — `passportCredentialVerification.ts` handles verifying whatever
 * proof type a credential (old HMAC stub, old unsigned stub, or new
 * Ed25519) actually carries, exactly as issued.
 */

import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'crypto';

export const ED25519_SUITE = 'PolityBureauEd25519Signature2026';

export interface SigningResult {
  suite: string;
  keyId: string;
  signatureValue: string;
}

/**
 * The proof metadata bound INTO the signed payload — not just carried
 * alongside it. `created`/`proofPurpose` have no other cryptographic
 * anchor, so tampering either after issuance must invalidate the
 * signature exactly like tampering the credential body does. `keyId` and
 * `type` are already implicitly protected (a tampered keyId selects the
 * wrong public key for the ORIGINAL signature; a tampered type re-dispatches
 * verification to the wrong/no branch), so they are not duplicated here.
 */
export interface SignableProofMeta {
  created: string;
  proofPurpose: string;
}

/** The exact structure signed over: the credential body (proof excluded) plus the binding proof metadata. Used identically by signing and verification. */
export function buildSignablePayload(credentialWithoutProof: unknown, proofMeta: SignableProofMeta): string {
  return canonicalizeCredentialPayload({ credential: credentialWithoutProof, proofMeta });
}

export interface SigningKeyRecord {
  keyId: string;
  /** SPKI DER, base64-encoded. Public — safe to publish. */
  publicKeyB64: string;
}

/**
 * The registry of keys verification will accept, keyed by keyId. Includes
 * every key this issuer has EVER signed with, active or rotated-out —
 * removing an entry here is how a compromised key is fully revoked (no
 * credential it signed remains verifiable), which is a deliberate,
 * separate operator act, never automatic.
 */
export function loadKnownSigningKeys(): SigningKeyRecord[] {
  const raw = process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is SigningKeyRecord => typeof k?.keyId === 'string' && typeof k?.publicKeyB64 === 'string',
    );
  } catch {
    return [];
  }
}

function findKnownKey(keyId: string): SigningKeyRecord | null {
  return loadKnownSigningKeys().find((k) => k.keyId === keyId) ?? null;
}

/**
 * Canonical, deterministic serialization of a credential payload for
 * signing/verification — recursively sorts object keys so the signed bytes
 * never depend on incidental JS property insertion order. Arrays keep their
 * own order (position is meaningful there). The `proof` field itself must
 * already be excluded by the caller — this function only canonicalizes
 * what it's given.
 */
export function canonicalizeCredentialPayload(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Sign a canonical payload with the currently ACTIVE signing key. Returns
 * `null` when no active key is configured — the caller (passportCredential.ts)
 * falls back to the unsigned-stub proof, exactly as the Phase A stub already
 * did for a missing HMAC secret.
 */
export function signCredentialPayload(canonicalPayload: string): SigningResult | null {
  const keyId = process.env.PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID;
  const privateKeyB64 = process.env.PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64;
  if (!keyId || !privateKeyB64) return null;

  // The active key MUST also be in the known-keys registry — a signing key
  // that verification would not even recognise is a misconfiguration, not
  // a usable signature. Fail closed (fall back to unsigned) rather than
  // produce a signature nothing can ever verify.
  if (!findKnownKey(keyId)) {
    console.error(
      `[passport credential signing] PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID "${keyId}" is not present in ` +
        'PASSPORT_BUREAU_SIGNING_KEYS_JSON — refusing to sign with an unverifiable key.',
    );
    return null;
  }

  let privateKey;
  try {
    privateKey = createPrivateKey({ key: Buffer.from(privateKeyB64, 'base64'), format: 'der', type: 'pkcs8' });
  } catch (e) {
    console.error('[passport credential signing] malformed PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64:', e);
    return null;
  }

  const signature = cryptoSign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
  return { suite: ED25519_SUITE, keyId, signatureValue: signature.toString('base64url') };
}

export type Ed25519VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'unknown_key' | 'malformed_key' | 'signature_mismatch' };

/**
 * Verify an Ed25519 signature against the known-keys registry — a
 * genuinely independent check from `signCredentialPayload` above (does not
 * call it, does not share any state with it beyond the public registry).
 * Fails closed on any keyId this issuer's registry does not recognise.
 */
export function verifyEd25519Signature(
  canonicalPayload: string,
  keyId: string,
  signatureValueB64Url: string,
): Ed25519VerifyOutcome {
  const known = findKnownKey(keyId);
  if (!known) return { ok: false, reason: 'unknown_key' };

  let publicKey;
  try {
    publicKey = createPublicKey({ key: Buffer.from(known.publicKeyB64, 'base64'), format: 'der', type: 'spki' });
  } catch {
    return { ok: false, reason: 'malformed_key' };
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(signatureValueB64Url, 'base64url');
  } catch {
    return { ok: false, reason: 'signature_mismatch' };
  }

  const matches = cryptoVerify(null, Buffer.from(canonicalPayload, 'utf8'), publicKey, signature);
  return matches ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}

/** sha256, first 16 hex chars — matches services/passport/bureauIdentityService.ts's didPublicRef pattern, reused for keyId hints in logs only (never a security-relevant value). */
export function shortKeyHint(keyId: string): string {
  return createHash('sha256').update(keyId).digest('hex').slice(0, 8);
}
