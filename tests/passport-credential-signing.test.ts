/**
 * DiDQube Phase 3 item 5 (2026-09-07): asymmetric VC signing.
 *
 * Proves: canonical payload serialization is deterministic regardless of
 * key insertion order; signing falls back to the pre-existing unsigned
 * stub when no key is configured (never silently fabricates a signature);
 * verification is a genuinely independent code path (never calls the
 * signer) that fails closed on every unknown/malformed/legacy-unverifiable
 * case; and — the ruling's explicit tamper matrix — mutating the subject,
 * a claim, the issuance time, the predecessor reference, or the proof
 * metadata each independently invalidates an Ed25519-signed credential.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { buildPassportCredential, type PassportRecordRow } from '@/services/passport/passportCredential';
import { canonicalizeCredentialPayload } from '@/services/passport/passportCredentialSigningProviders';
import { verifyPassportCredential } from '@/services/passport/passportCredentialVerification';

const HOST = 'https://dev-beta.aigentz.me';
const KEY_ID = 'test-signing-key-1';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC_KEY_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const PRIVATE_KEY_B64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');

const ORIGINAL_ENV = { ...process.env };

function setSigningEnv() {
  process.env.PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID = KEY_ID;
  process.env.PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64 = PRIVATE_KEY_B64;
  process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON = JSON.stringify([{ keyId: KEY_ID, publicKeyB64: PUBLIC_KEY_B64 }]);
}

function clearSigningEnv() {
  delete process.env.PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID;
  delete process.env.PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64;
  delete process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON;
  delete process.env.PASSPORT_BUREAU_CREDENTIAL_SECRET;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function participantRecord(overrides: Partial<PassportRecordRow> = {}): PassportRecordRow {
  return {
    passport_id: 'ppp-signing-test-0001',
    passport_class: 'agent_participant',
    citizen_status: null,
    participant_status: 'approved',
    passport_grade: 'agent_participant',
    kybe_did_public_ref: null,
    root_did_public_ref: 'rootdid-commit-xyz789',
    persona_public_ref: 'persona-commit-def456',
    registry_record_id: 'marketa-agent-xyz',
    issuer_id: 'polity-passport-bureau',
    issued_at: '2026-09-07T00:00:00Z',
    expires_at: '2027-09-07T00:00:00Z',
    revoked: false,
    ...overrides,
  };
}

describe('canonicalizeCredentialPayload', () => {
  it('is deterministic regardless of object key insertion order', () => {
    const a = { z: 1, a: { y: 2, b: 3 }, m: [3, 1, 2] };
    const b = { a: { b: 3, y: 2 }, m: [3, 1, 2], z: 1 };
    expect(canonicalizeCredentialPayload(a)).toBe(canonicalizeCredentialPayload(b));
  });

  it('preserves array element order (position is meaningful)', () => {
    expect(canonicalizeCredentialPayload({ m: [1, 2, 3] })).not.toBe(canonicalizeCredentialPayload({ m: [3, 2, 1] }));
  });
});

describe('buildPassportCredential — signing', () => {
  beforeEach(clearSigningEnv);

  it('falls back to the unsigned stub when no signing key is configured', () => {
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    expect(credential.proof.type).toBe('PolityBureauUnsignedStub/v0');
  });

  it('produces a real Ed25519 signature when a signing key is configured', () => {
    setSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    expect(credential.proof.type).toBe('PolityBureauEd25519Signature2026');
    expect(credential.proof.keyId).toBe(KEY_ID);
    expect(typeof credential.proof.signatureValue).toBe('string');
    expect(credential.proof.signatureValue.length).toBeGreaterThan(0);
  });

  it('refuses to sign (falls back to unsigned) when the active key is not in the known-keys registry', () => {
    process.env.PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID = 'not-in-registry';
    process.env.PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64 = PRIVATE_KEY_B64;
    process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON = JSON.stringify([{ keyId: KEY_ID, publicKeyB64: PUBLIC_KEY_B64 }]);
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    expect(credential.proof.type).toBe('PolityBureauUnsignedStub/v0');
  });

  it('threads renewal_of_passport_id into credentialSubject.supersedesPassportId when present', () => {
    setSigningEnv();
    const credential = buildPassportCredential(
      participantRecord({ renewal_of_passport_id: 'ppp-prior-0001' }),
      HOST,
    ) as Record<string, any>;
    expect(credential.credentialSubject.supersedesPassportId).toBe('ppp-prior-0001');
  });
});

describe('verifyPassportCredential — Ed25519 (new)', () => {
  beforeEach(() => {
    clearSigningEnv();
    setSigningEnv();
  });

  function signedCredential(overrides: Partial<PassportRecordRow> = {}) {
    return buildPassportCredential(participantRecord(overrides), HOST) as Record<string, any>;
  }

  it('a genuinely signed credential verifies successfully — a SEPARATE code path from signing', () => {
    const credential = signedCredential();
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.keyId).toBe(KEY_ID);
  });

  it('REFUSES an unknown keyId — fails closed', () => {
    const credential = signedCredential();
    credential.proof.keyId = 'a-key-that-was-never-registered';
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('unknown_key');
  });

  it('REFUSES a malformed public key in the registry', () => {
    process.env.PASSPORT_BUREAU_SIGNING_KEYS_JSON = JSON.stringify([{ keyId: KEY_ID, publicKeyB64: 'not-valid-der-base64!!' }]);
    const credential = signedCredential();
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('malformed_key');
  });

  it('REFUSES an unknown proof.type — fails closed on unknown algorithms', () => {
    const credential = signedCredential();
    credential.proof.type = 'SomeMadeUpSignatureSuite2099';
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('unknown_algorithm');
  });

  it('REFUSES a malformed proof (missing signatureValue)', () => {
    const credential = signedCredential();
    delete credential.proof.signatureValue;
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('malformed_proof');
  });

  it('REFUSES an unknown issuer', () => {
    const credential = signedCredential();
    credential.issuer.id = 'https://not-the-real-issuer.example.invalid/something-else';
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('unknown_issuer');
  });

  describe('tamper matrix — each independently invalidates the signature', () => {
    it('tampering the SUBJECT (credentialSubject.id) invalidates the signature', () => {
      const credential = signedCredential();
      credential.credentialSubject.id = 'a-completely-different-subject-commitment';
      const result = verifyPassportCredential(credential);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe('signature_mismatch');
    });

    it('tampering a CLAIM (passportGrade) invalidates the signature', () => {
      const credential = signedCredential();
      credential.credentialSubject.passportGrade = 'a_different_grade_entirely';
      const result = verifyPassportCredential(credential);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe('signature_mismatch');
    });

    it('tampering the ISSUANCE TIME (validFrom) invalidates the signature', () => {
      const credential = signedCredential();
      credential.validFrom = '2099-01-01T00:00:00Z';
      const result = verifyPassportCredential(credential);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe('signature_mismatch');
    });

    it('tampering the PREDECESSOR REFERENCE (supersedesPassportId) invalidates the signature', () => {
      const credential = signedCredential({ renewal_of_passport_id: 'ppp-real-prior' });
      expect(credential.credentialSubject.supersedesPassportId).toBe('ppp-real-prior');
      credential.credentialSubject.supersedesPassportId = 'ppp-a-DIFFERENT-passport-entirely';
      const result = verifyPassportCredential(credential);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe('signature_mismatch');
    });

    it('tampering PROOF METADATA (proof.created) invalidates the signature', () => {
      const credential = signedCredential();
      credential.proof.created = '2099-01-01T00:00:00Z';
      const result = verifyPassportCredential(credential);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe('signature_mismatch');
    });

    it('tampering proof.proofPurpose invalidates the signature', () => {
      const credential = signedCredential();
      credential.proof.proofPurpose = 'keyAgreement';
      const result = verifyPassportCredential(credential);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe('signature_mismatch');
    });
  });
});

describe('verifyPassportCredential — legacy proof types (never re-signed, verified as originally issued)', () => {
  beforeEach(clearSigningEnv);

  /** Replicates the RETIRED legacy HMAC-stub issuance path exactly, since buildPassportCredential no longer produces it — this proves verification still honors history precisely as issued. */
  function legacyHmacCredential(secret: string): Record<string, any> {
    const record = participantRecord();
    const { createHmac } = require('crypto');
    const credentialBody = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiableCredential', 'PolityAgentParticipantPassport'],
      issuer: { id: `${HOST}/.well-known/polity-passport`, name: record.issuer_id },
      validFrom: record.issued_at,
      validUntil: record.expires_at,
      credentialSubject: {
        id: record.root_did_public_ref,
        passportId: record.passport_id,
        passportClass: record.passport_class,
        passportGrade: record.passport_grade,
        passportStatus: record.participant_status,
        personaPublicRef: record.persona_public_ref,
        registryRecordId: record.registry_record_id,
      },
      credentialStatus: { type: 'PolityPassportRegistryEntry', statusListUrl: `${HOST}/api/polity-passport/registry` },
    };
    const legacyCanonical = JSON.stringify(credentialBody);
    const signatureValue = createHmac('sha256', secret).update(legacyCanonical).digest('base64url');
    return {
      ...credentialBody,
      proof: { type: 'PolityBureauHmacStub/v0', created: '2026-06-11T00:00:00Z', proofPurpose: 'assertionMethod', signatureValue },
    };
  }

  it('a legacy HMAC-stub credential verifies when the Bureau secret is available', () => {
    const credential = legacyHmacCredential('legacy-test-secret');
    process.env.PASSPORT_BUREAU_CREDENTIAL_SECRET = 'legacy-test-secret';
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(true);
  });

  it('a legacy HMAC-stub credential is REFUSED (fails closed) when the Bureau secret is unavailable — never assumed valid', () => {
    const credential = legacyHmacCredential('legacy-test-secret');
    // Secret intentionally NOT set this time.
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('legacy_secret_unavailable');
  });

  it('a tampered legacy HMAC-stub credential is REFUSED even with the correct secret', () => {
    const credential = legacyHmacCredential('legacy-test-secret');
    credential.credentialSubject.passportGrade = 'tampered';
    process.env.PASSPORT_BUREAU_CREDENTIAL_SECRET = 'legacy-test-secret';
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('signature_mismatch');
  });

  it('an unsigned-stub credential NEVER verifies as valid — it never claimed a signature', () => {
    const credential = buildPassportCredential(participantRecord(), HOST) as Record<string, any>;
    expect(credential.proof.type).toBe('PolityBureauUnsignedStub/v0');
    const result = verifyPassportCredential(credential);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('unsigned_stub');
  });
});

describe('T0 canary: signing/verification modules never leak server-internal identifiers', () => {
  it('a signed credential never serialises the private key or the raw secret', () => {
    clearSigningEnv();
    setSigningEnv();
    const credential = buildPassportCredential(participantRecord(), HOST);
    const serialized = JSON.stringify(credential);
    expect(serialized).not.toContain(PRIVATE_KEY_B64);
  });
});
