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
 * ── ISSUER IDENTITY vs. SIGNING KEYS (Phase 5.1a, operator ruling 2026-09-11) ─
 *
 * The Bureau's issuer identity is a STABLE, environment-independent
 * `did:web:...` string (`PASSPORT_BUREAU_ISSUER_DID`), never derived from
 * the live request host — the Bureau is a persistent constitutional
 * institution, not whichever signing key happens to be active. Keys rotate;
 * the issuer identity does not. `requireBureauIssuerDid()` fails closed
 * (throws) when unconfigured — there is no host-derived fallback, per
 * CLAUDE.md's No-Guessing rule. `tryResolveBureauIssuerDid()` is the
 * non-throwing counterpart verification uses, since a verifier must never
 * crash on a missing/misconfigured env var — it fails closed via its
 * returned result instead (see `passportCredentialVerification.ts`).
 *
 * ── KEY LIFECYCLE ≠ CREDENTIAL LIFECYCLE (Phase 5.1a/5.1d, operator ruling
 *    2026-09-11) ──────────────────────────────────────────────────────────
 *
 * Rotating a key out of active issuance (`validUntil`) or marking it
 * compromised (`compromisedAt`) never erases the historical verification
 * material required to validate credentials legitimately signed while that
 * key was authorized. `SigningKeyRecord` therefore carries the key's own
 * validity interval and lifecycle events; `evaluateKeyAuthorizationAtTime`
 * decides ONLY whether a given key was authorized to sign at a given
 * instant — it has no opinion on a credential's current DB-backed status
 * (revoked/superseded), which is a separate, independently-evaluated layer
 * (see `verifyPassportCredentialWithLifecycle` in the verification module).
 * A key revoked before it ever signed a given credential makes that
 * credential's provenance claim false (hard invalid). A key merely
 * SUSPECTED compromised at signing time is NOT auto-decided either way —
 * the outcome is `'UNRESOLVED'`, left to the Bureau's adjudication policy,
 * mirroring `types/confidentialProjection.ts`'s `UNRESOLVED` precedent
 * ("not an error state — it is the honest representation of 'cannot safely
 * decide'").
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

/**
 * The Bureau's stable issuer identity — see the module doc comment's
 * "ISSUER IDENTITY vs. SIGNING KEYS" section. Fails closed (throws) when
 * `PASSPORT_BUREAU_ISSUER_DID` is unset. Used at ISSUANCE time only
 * (`passportCredential.ts`) — a verifier must never crash on missing
 * config, so verification uses `tryResolveBureauIssuerDid()` instead.
 */
export function requireBureauIssuerDid(): string {
  const value = process.env.PASSPORT_BUREAU_ISSUER_DID;
  if (!value) {
    throw new Error(
      'requireBureauIssuerDid(): missing required env var PASSPORT_BUREAU_ISSUER_DID — ' +
        'the Bureau issuer DID must be explicitly configured per environment (a stable ' +
        'did:web identifier on a canonical Bureau-controlled domain), never derived from ' +
        'the request host. Every environment (dev, prod) sets its own explicit value — ' +
        'see codexes/packs/agentiq/updates/2026-09-11_didqube-phase5-1a-issuer-did-key-lifecycle.md.',
    );
  }
  return value;
}

/** Non-throwing counterpart of `requireBureauIssuerDid()` for verification — returns `null` rather than throwing when unconfigured. */
export function tryResolveBureauIssuerDid(): string | null {
  return process.env.PASSPORT_BUREAU_ISSUER_DID || null;
}

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
  /**
   * Versioned verification-method identifier, e.g. `${issuerDid}#key-3`
   * (Phase 5.1a). Optional — absent on entries predating this scheme.
   * Informational today (not yet consumed for multi-suite dispatch); a
   * future second suite is the point at which this becomes load-bearing.
   */
  verificationMethodId?: string;
  /**
   * Explicit per-key suite (Phase 5.1a — "made explicit per-key so a second
   * suite can coexist"). Every key in this registry today is Ed25519;
   * absent on legacy entries, which are `ED25519_SUITE` by construction.
   * Not yet consumed for dispatch — verification still keys off
   * `proof.type`, since no second suite provider exists yet (would be
   * guessing per CLAUDE.md's No-Guessing rule).
   */
  suite?: string;
  /**
   * Key lifecycle bounds (Phase 5.1a/5.1d, operator ruling 2026-09-11): key
   * lifecycle is NOT credential lifecycle. Rotating a key out (`validUntil`)
   * or marking it compromised (`compromisedAt`) never erases the historical
   * verification material for what it legitimately signed while authorized
   * — see `evaluateKeyAuthorizationAtTime` below.
   *
   * LEGACY-SAFE DEFAULT: an entry carrying NONE of these four fields
   * predates this scheme entirely and is treated as unrestricted (always
   * authorized) — retroactively imposing a validity window on a
   * pre-existing key would break verification of credentials it already,
   * legitimately signed, which is exactly the "never break an old code
   * path" discipline the legacy HMAC-stub verification branch already
   * follows. `revokedAt`/`compromisedAt` ARE effective the instant an
   * operator sets them, even on an otherwise-legacy entry — those two
   * fields represent a deliberate operator act, not a retroactive default.
   */
  validFrom?: string | null;
  validUntil?: string | null;
  revokedAt?: string | null;
  compromisedAt?: string | null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * The registry of keys verification will accept, keyed by keyId. Includes
 * every key this issuer has EVER signed with, active or rotated-out —
 * removing an entry here is how a compromised key is fully revoked (no
 * credential it signed remains verifiable), which is a deliberate,
 * separate operator act, never automatic. Preferred practice (Phase 5.1d):
 * mark `compromisedAt` rather than removing the entry — full removal is a
 * harsher, rarely-needed end-state (see the key-rotation runbook).
 */
export function loadKnownSigningKeys(): SigningKeyRecord[] {
  const raw = process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is SigningKeyRecord =>
        typeof k?.keyId === 'string' &&
        typeof k?.publicKeyB64 === 'string' &&
        isOptionalString(k?.verificationMethodId) &&
        isOptionalString(k?.suite) &&
        isOptionalString(k?.validFrom) &&
        isOptionalString(k?.validUntil) &&
        isOptionalString(k?.revokedAt) &&
        isOptionalString(k?.compromisedAt),
    );
  } catch {
    return [];
  }
}

/** Exported for `passportCredentialVerification.ts`'s key-authorization-at-issuance-time check (Phase 5.1a) — verification needs the FULL record (lifecycle fields), not just the crypto-relevant fields `verifyEd25519Signature` looks up on its own. */
export function findKnownKey(keyId: string): SigningKeyRecord | null {
  return loadKnownSigningKeys().find((k) => k.keyId === keyId) ?? null;
}

export type KeyAuthorizationOutcome =
  | { authorized: true }
  | { authorized: false; reason: 'key_not_yet_valid' | 'key_expired' | 'key_revoked_before_issuance' }
  | { authorized: 'UNRESOLVED'; reason: 'key_signed_during_suspected_compromise_window' };

/**
 * Was `key` authorized to sign AT `atIso` (the credential's own `proof.created`
 * — the instant this specific signing act occurred, not the underlying
 * Passport row's original `issued_at`, which may predate a lazily-claimed
 * credential envelope by an arbitrary amount and is not what "was this KEY
 * allowed to sign right now" must be evaluated against)?
 *
 * Check order (mirrors the ruling's own stated model — "signing key
 * authorized at T" is evaluated before "signature valid"):
 *   1. `revokedAt` — if `at >= revokedAt`, the key was already revoked at
 *      this instant: a HARD invalid (`key_revoked_before_issuance`). A key
 *      revoked AFTER `at` does not retroactively invalidate an earlier,
 *      legitimate signing.
 *   2. `compromisedAt` — if `at >= compromisedAt`, the signing act falls in
 *      the suspected-compromise window: `'UNRESOLVED'`, never auto-decided
 *      as valid or invalid (Bureau adjudication policy decides, separately
 *      — see the key-rotation runbook).
 *   3. `validFrom`/`validUntil` — closed interval, both bounds inclusive
 *      (`at === validFrom` and `at === validUntil` are both authorized).
 *      Legacy entries missing these fields are unrestricted — see the
 *      LEGACY-SAFE DEFAULT note on `SigningKeyRecord`.
 */
export function evaluateKeyAuthorizationAtTime(key: SigningKeyRecord, atIso: string): KeyAuthorizationOutcome {
  const at = Date.parse(atIso);

  if (key.revokedAt) {
    const revokedAt = Date.parse(key.revokedAt);
    if (!Number.isNaN(revokedAt) && at >= revokedAt) {
      return { authorized: false, reason: 'key_revoked_before_issuance' };
    }
  }
  if (key.compromisedAt) {
    const compromisedAt = Date.parse(key.compromisedAt);
    if (!Number.isNaN(compromisedAt) && at >= compromisedAt) {
      return { authorized: 'UNRESOLVED', reason: 'key_signed_during_suspected_compromise_window' };
    }
  }
  if (key.validFrom) {
    const validFrom = Date.parse(key.validFrom);
    if (!Number.isNaN(validFrom) && at < validFrom) {
      return { authorized: false, reason: 'key_not_yet_valid' };
    }
  }
  if (key.validUntil) {
    const validUntil = Date.parse(key.validUntil);
    if (!Number.isNaN(validUntil) && at > validUntil) {
      return { authorized: false, reason: 'key_expired' };
    }
  }
  return { authorized: true };
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
