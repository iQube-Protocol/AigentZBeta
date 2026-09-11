/**
 * Principal-wallet provisioning — a stored envelope is not a proven wallet.
 *
 * The wallet-binding trace (#121) found three provisioning paths writing a
 * well-formed address with no key behind it, and `keyService.deriveEvmAddress`
 * carries a fallback that SHA-256s a private key into a plausible address when
 * ethers fails to load. All of them pass every structural check.
 *
 * The operator's ruling closes that gap by making the terminal state a PROOF
 * rather than a WRITE:
 *
 *   > "Provisioning is not complete when the encrypted envelope is stored.
 *   >  That establishes only SIGNER_CONFIGURED. Completion requires: fresh
 *   >  nonce signature → recovered address matches new bound address →
 *   >  CONTROL_PROVEN receipt."
 *
 * and by forbidding three things from ever reaching the server:
 *
 *   > "Never send: wallet password / plaintext private key / decrypted envelope."
 */

import { describe, it, expect } from 'vitest';

import {
  hasEncryptedEnvelope,
  PROVISIONING_SEQUENCE,
  EXTERNAL_PROOF_IS_NOT_A_PRECONDITION,
  screenProvisioningPayload,
  evaluateProvisioningRequest,
  provisioningCompletion,
  compareRecoveredAddress,
  supersedePlaceholder,
  type ProvisioningRequest,
} from '@/services/wallet/principalWalletProvisioning';
import { readSource, stripComments, forbiddenImportFindings } from './_lib/sourceAuthority';

const NEW_ADDRESS = '0x1111111111111111111111111111111111111111';
const LEGACY = '0xdead000000000000000000000000000000000001';

function baseRequest(over: Partial<ProvisioningRequest> = {}): ProvisioningRequest {
  return {
    subjectPersonaId: 'p-active',
    callerPersonaId: 'p-active',
    activePersonaId: 'p-active',
    derivedAddress: NEW_ADDRESS,
    envelopePresent: true,
    requestId: 'req-1',
    consumedRequestIds: [],
    disallowedAddresses: new Set([LEGACY]),
    existingSignerVerified: false,
    existingEnvelopePresent: false,
    ...over,
  };
}

describe('the sequence is the safety property', () => {
  it('preserves the external binding before superseding the placeholder', () => {
    const seq = [...PROVISIONING_SEQUENCE];
    expect(seq.indexOf('create-linked-external-wallet-record')).toBeLessThan(
      seq.indexOf('supersede-keyless-placeholder'),
    );
  });

  it('stores the envelope before issuing a nonce — a proof needs something to prove', () => {
    const seq = [...PROVISIONING_SEQUENCE];
    expect(seq.indexOf('persist-ciphertext-envelope-and-address')).toBeLessThan(
      seq.indexOf('issue-fresh-control-proof-nonce'),
    );
  });

  it('ends at the proof, not at the write', () => {
    expect(PROVISIONING_SEQUENCE[PROVISIONING_SEQUENCE.length - 1]).toBe('record-control-proven');
  });

  it('records that external proof never gates principal provisioning', () => {
    expect(EXTERNAL_PROOF_IS_NOT_A_PRECONDITION).toMatch(/optional follow-up/i);
    expect(EXTERNAL_PROOF_IS_NOT_A_PRECONDITION).toMatch(/never waits on it/i);
  });
});

describe('secrets are refused, not ignored', () => {
  it('refuses a password field under any casing or spelling', () => {
    for (const key of ['password', 'walletPassword', 'PASSPHRASE', 'pass_phrase', 'pwd']) {
      const d = screenProvisioningPayload({ derivedAddress: NEW_ADDRESS, [key]: 'hunter2' });
      expect(d.permitted, key).toBe(false);
      expect(d.refusal, key).toBe('PASSWORD_IN_REQUEST');
    }
  });

  it('refuses a plaintext key field', () => {
    for (const key of ['privateKey', 'private_key', 'decryptedKey', 'secret_key', 'mnemonic', 'seedPhrase']) {
      const d = screenProvisioningPayload({ [key]: 'anything' });
      expect(d.permitted, key).toBe(false);
      expect(d.refusal, key).toBe('PLAINTEXT_KEY_IN_PAYLOAD');
    }
  });

  it('refuses a key smuggled through an innocuous field name — by SHAPE', () => {
    const smuggled = 'a'.repeat(64);
    const d = screenProvisioningPayload({ metadata: { note: smuggled } });
    expect(d.permitted).toBe(false);
    expect(d.refusal).toBe('PLAINTEXT_KEY_IN_PAYLOAD');
    expect(d.detail).toMatch(/whatever the field is named/i);
  });

  it('catches the 0x-prefixed form too', () => {
    expect(screenProvisioningPayload({ x: '0x' + 'b'.repeat(64) }).refusal).toBe('PLAINTEXT_KEY_IN_PAYLOAD');
  });

  it('finds secrets at depth and inside arrays', () => {
    expect(screenProvisioningPayload({ a: { b: [{ c: { password: 'x' } }] } }).refusal).toBe('PASSWORD_IN_REQUEST');
  });

  it('permits the legitimate payload — address, publicKey, ciphertext envelope', () => {
    const d = screenProvisioningPayload({
      subjectPersonaId: 'p-active',
      derivedAddress: NEW_ADDRESS,
      publicKey: '0x04' + 'c'.repeat(128),
      encryptedEnvelope: {
        salt: 'aa'.repeat(32),
        iv: 'bb'.repeat(12),
        ciphertext: 'cc'.repeat(40),
        authTag: 'dd'.repeat(16),
      },
    });
    expect(d.permitted).toBe(true);
  });

  it('does NOT flag the envelope salt, which is 64 hex characters by construction', () => {
    // keyService uses a 32-byte salt. A value check applied inside the envelope
    // would refuse every honest request — and a screen that fires on every
    // honest payload is a screen someone deletes.
    const d = screenProvisioningPayload({
      encryptedEnvelope: { salt: 'ab'.repeat(32), iv: 'cd'.repeat(12), ciphertext: 'ef'.repeat(40), authTag: '01'.repeat(16) },
    });
    expect(d.permitted).toBe(true);
  });

  it('refuses anything riding along inside the envelope', () => {
    const d = screenProvisioningPayload({
      encryptedEnvelope: {
        salt: 'ab'.repeat(32),
        iv: 'cd'.repeat(12),
        ciphertext: 'ef'.repeat(40),
        authTag: '01'.repeat(16),
        extra: 'ff'.repeat(32),
      },
    });
    expect(d.permitted).toBe(false);
    expect(d.refusal).toBe('PLAINTEXT_KEY_IN_PAYLOAD');
  });

  it('still applies the NAME check inside the envelope', () => {
    const d = screenProvisioningPayload({ encryptedEnvelope: { password: 'x' } });
    expect(d.refusal).toBe('PASSWORD_IN_REQUEST');
  });

  it('refuses an envelope that is not the expected hex shape', () => {
    expect(screenProvisioningPayload({ encryptedEnvelope: 'not-an-object' }).refusal).toBe('MISSING_ENVELOPE');
    expect(
      screenProvisioningPayload({
        encryptedEnvelope: { salt: 'zz', iv: 'cd'.repeat(12), ciphertext: 'ef'.repeat(40), authTag: '01'.repeat(16) },
      }).refusal,
    ).toBe('MISSING_ENVELOPE');
  });

  it('survives a cyclic payload rather than hanging', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(screenProvisioningPayload(cyclic).permitted).toBe(true);
  });
});

describe('the eight refusal guards', () => {
  it('refuses a request naming another persona', () => {
    const d = evaluateProvisioningRequest(baseRequest({ subjectPersonaId: 'p-other' }));
    expect(d.refusal).toBe('WRONG_PERSONA');
  });

  it('refuses a persona that is not the active one', () => {
    const d = evaluateProvisioningRequest(
      baseRequest({ subjectPersonaId: 'p-mine', callerPersonaId: 'p-mine', activePersonaId: 'p-active' }),
    );
    expect(d.refusal).toBe('NON_ACTIVE_PERSONA');
  });

  it('refuses to replace a signer that is configured AND proven', () => {
    expect(evaluateProvisioningRequest(baseRequest({ existingSignerVerified: true })).refusal).toBe(
      'EXISTING_VERIFIED_SIGNER',
    );
  });

  it('REFUSES when an encrypted envelope already exists, proven or not', () => {
    // The browser run's state. Generating a second keypair here would abandon
    // a key the operator may already hold, at the exact moment the UI is
    // trying to help them finish.
    const d = evaluateProvisioningRequest(baseRequest({ existingEnvelopePresent: true }));
    expect(d.refusal).toBe('PRINCIPAL_ENVELOPE_ALREADY_EXISTS');
    expect(d.detail).toMatch(/prove the existing wallet instead/i);
  });

  it('distinguishes an existing envelope from a proven signer', () => {
    // Different refusals because they have different remedies: one says
    // "prove it", the other says "you already have a working wallet".
    expect(evaluateProvisioningRequest(baseRequest({ existingEnvelopePresent: true })).refusal).toBe(
      'PRINCIPAL_ENVELOPE_ALREADY_EXISTS',
    );
    expect(
      evaluateProvisioningRequest(baseRequest({ existingSignerVerified: true, existingEnvelopePresent: true }))
        .refusal,
    ).toBe('EXISTING_VERIFIED_SIGNER');
  });

  it('permits provisioning over a KEYLESS placeholder — that is the case it is for', () => {
    expect(
      evaluateProvisioningRequest(baseRequest({ existingEnvelopePresent: false, existingSignerVerified: false }))
        .permitted,
    ).toBe(true);
  });

  it('refuses a replayed provisioning request', () => {
    const d = evaluateProvisioningRequest(baseRequest({ requestId: 'req-1', consumedRequestIds: ['req-1'] }));
    expect(d.refusal).toBe('REPLAYED_PROVISIONING_REQUEST');
  });

  it('refuses an address with no envelope behind it — the ADDRESS_ONLY defect', () => {
    const d = evaluateProvisioningRequest(baseRequest({ envelopePresent: false }));
    expect(d.refusal).toBe('MISSING_ENVELOPE');
    expect(d.detail).toMatch(/ADDRESS_ONLY/);
  });

  it('refuses a malformed address', () => {
    expect(evaluateProvisioningRequest(baseRequest({ derivedAddress: '0xnope' })).refusal).toBe('MALFORMED_ADDRESS');
  });

  it('refuses a legacy or compromised address, case-insensitively', () => {
    const d = evaluateProvisioningRequest(baseRequest({ derivedAddress: LEGACY.toUpperCase().replace('0X', '0x') }));
    expect(d.refusal).toBe('COMPROMISED_OR_LEGACY_ADDRESS');
  });

  it('refuses on identity before it refuses on contents', () => {
    // A refusal that names the wrong reason sends the operator to fix the
    // wrong thing. Wrong persona AND malformed address → WRONG_PERSONA.
    const d = evaluateProvisioningRequest(baseRequest({ subjectPersonaId: 'p-other', derivedAddress: 'nope' }));
    expect(d.refusal).toBe('WRONG_PERSONA');
  });

  it('permits the clean case', () => {
    expect(evaluateProvisioningRequest(baseRequest()).permitted).toBe(true);
  });
});

describe('a stored envelope is SIGNER_CONFIGURED and is not complete', () => {
  it('reports SIGNER_CONFIGURED, complete false, with what remains', () => {
    const c = provisioningCompletion({ envelopeStored: true, addressBound: true, controlProven: false });
    expect(c.stage).toBe('SIGNER_CONFIGURED');
    expect(c.complete).toBe(false);
    expect(c.outstanding).toMatch(/fresh nonce/i);
  });

  it('reaches CONTROL_PROVEN only with a proof', () => {
    const c = provisioningCompletion({ envelopeStored: true, addressBound: true, controlProven: true });
    expect(c.stage).toBe('CONTROL_PROVEN');
    expect(c.complete).toBe(true);
    expect(c.outstanding).toBeNull();
  });

  it('refuses to call a proof-without-storage complete', () => {
    const c = provisioningCompletion({ envelopeStored: false, addressBound: false, controlProven: true });
    expect(c.complete).toBe(false);
    expect(c.stage).toBe('NOT_STARTED');
  });

  it('reports NOT_STARTED before anything is persisted', () => {
    expect(provisioningCompletion({ envelopeStored: false, addressBound: false, controlProven: false }).stage).toBe(
      'NOT_STARTED',
    );
  });
});

describe('the recovery comparison', () => {
  it('matches case-insensitively', () => {
    expect(compareRecoveredAddress(NEW_ADDRESS, NEW_ADDRESS.toUpperCase().replace('0X', '0x')).matched).toBe(true);
  });

  it('refuses a mismatch and says the envelope holds the wrong key', () => {
    const c = compareRecoveredAddress(NEW_ADDRESS, '0x2222222222222222222222222222222222222222');
    expect(c.matched).toBe(false);
    expect(c.refusal).toBe('ADDRESS_MISMATCH');
    expect(c.detail).toMatch(/does not hold the key/i);
  });

  it('refuses a failed recovery without calling it a match', () => {
    expect(compareRecoveredAddress(NEW_ADDRESS, null).matched).toBe(false);
  });
});

describe('the placeholder is preserved, never deleted', () => {
  const s = supersedePlaceholder({
    placeholderAddress: '0xAAA0000000000000000000000000000000000AAA',
    newPrincipalAddress: NEW_ADDRESS,
    supersededAt: '2026-08-02T12:00:00.000Z',
  });

  it('carries the three labels the operator specified', () => {
    expect(s.capability).toBe('ADDRESS_ONLY');
    expect(s.status).toBe('superseded');
    expect(s.signing).toBe('non-signing');
  });

  it('records what superseded it, so the history is followable', () => {
    expect(s.supersededBy).toBe(NEW_ADDRESS.toLowerCase());
    expect(s.address).toBe('0xaaa0000000000000000000000000000000000aaa');
  });

  it('never reinstates or signs against it', () => {
    expect(s.reason).toMatch(/never reinstated/i);
    expect(s.reason).toMatch(/never signed against/i);
  });
});

describe('the routes hold the boundary', () => {
  const provision = readSource('app/api/wallet/principal/provision/route.ts');
  const proof = readSource('app/api/wallet/principal/control-proof/route.ts');

  it('screens the payload before authenticating — a secret must not be parsed and held first', () => {
    const code = stripComments(provision);
    expect(code.indexOf('screenProvisioningPayload')).toBeGreaterThan(-1);
    expect(code.indexOf('screenProvisioningPayload')).toBeLessThan(code.indexOf('getActivePersona(req)'));
  });

  it('both routes screen, including the verify branch', () => {
    expect(stripComments(proof)).toMatch(/screenProvisioningPayload/);
  });

  it('resolves identity through the spine, never from the request body', () => {
    for (const [name, src] of [['provision', provision], ['control-proof', proof]] as const) {
      expect(stripComments(src), name).toMatch(/getActivePersona\(req\)/);
    }
  });

  it('never reads a password or plaintext key out of the body', () => {
    for (const [name, src] of [['provision', provision], ['control-proof', proof]] as const) {
      const code = stripComments(src);
      expect(code, name).not.toMatch(/b\.password|body\.password|b\.privateKey|body\.privateKey/);
    }
  });

  it('recovers from the STORED nonce, never a client-supplied message', () => {
    const code = stripComments(proof);
    expect(code).toMatch(/verifyMessage\(record\.payload, signature\)/);
    expect(code).not.toMatch(/verifyMessage\(\s*b\./);
    // A client-supplied recovered address would make the comparison circular.
    expect(code).not.toMatch(/recoveredAddress\s*=\s*(b|body)\./);
  });

  it('reports complete: false on the provision response', () => {
    const code = stripComments(provision);
    const body = code.slice(code.lastIndexOf('NextResponse.json({'));
    expect(body).toMatch(/complete: completion\.complete/);
    expect(code).toMatch(/controlProven: false/);
  });

  it('preserves the external binding before overwriting the principal address', () => {
    const code = stripComments(provision);
    expect(code.indexOf("from('linked_external_wallets')")).toBeLessThan(
      code.indexOf("from('personas')\n    .update("),
    );
  });

  it('refuses rather than proceeding when the external binding cannot be recorded', () => {
    expect(stripComments(provision)).toMatch(/EXTERNAL_BINDING_NOT_PRESERVED/);
  });

  it('passes the existing-envelope guard to the gate, detecting an OBJECT envelope', () => {
    const code = stripComments(provision);
    expect(code).toMatch(/existingEnvelopePresent: existingHasKey/);
    // Via the SHARED predicate — an inline copy is what drifted and inverted
    // the answer. See the parity block at the end of this file.
    expect(code).toMatch(/existingHasKey = hasEncryptedEnvelope\(/);
  });

  it('does not use wallet_alias_commitments for this purpose', () => {
    for (const [name, src] of [['provision', provision], ['control-proof', proof]] as const) {
      expect(stripComments(src), name).not.toMatch(/wallet_alias_commitments/);
    }
  });
});

describe('the client ceremony keeps secrets in the browser', () => {
  const client = readSource('services/wallet/provisionPrincipalWalletClient.ts');
  const code = stripComments(client);

  it('uses personaFetch for every spine call, never raw fetch', () => {
    expect(code).toMatch(/personaFetch\(/);
    expect(code).not.toMatch(/[^a-zA-Z]fetch\(['"`]\/api/);
  });

  it('sends only address, publicKey and the ciphertext envelope', () => {
    const provisionBody = code.slice(code.indexOf('/api/wallet/principal/provision'));
    const stringified = provisionBody.slice(provisionBody.indexOf('JSON.stringify'), provisionBody.indexOf('});'));
    expect(stringified).toMatch(/derivedAddress/);
    expect(stringified).toMatch(/encryptedEnvelope/);
    expect(stringified).not.toMatch(/password/i);
    expect(stringified).not.toMatch(/plaintextKey/);
  });

  it('never puts the password or plaintext key into any request body', () => {
    // Every JSON.stringify argument in the module, checked together.
    const bodies = code.match(/JSON\.stringify\([\s\S]{0,400}?\)/g) ?? [];
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(b).not.toMatch(/password/i);
      expect(b).not.toMatch(/plaintextKey/);
    }
  });

  it('refuses the fallback derivation before anything is persisted', () => {
    expect(code.indexOf('assertRealDerivation')).toBeLessThan(code.indexOf('/api/wallet/principal/provision'));
    expect(code).toMatch(/FALLBACK_DERIVATION_REFUSED/);
  });

  it('signs locally rather than sending the key to be signed', () => {
    expect(code).toMatch(/signMessage\(issued\.nonce\)/);
  });

  it('reports SIGNER_CONFIGURED — not success — when the proof step fails', () => {
    const tail = code.slice(code.indexOf('recover-and-compare-server-side'));
    expect(tail).toMatch(/'SIGNER_CONFIGURED'/);
  });

  it('never calls the provisioning route from the retry path', () => {
    // "Never regenerate the wallet in this state." Retry proves; it creates
    // nothing, so it must not reach /provision or generateEvmKeyPair.
    const at = code.indexOf('export async function proveExistingPrincipalWallet');
    expect(at).toBeGreaterThan(-1);
    const retry = code.slice(at);
    expect(retry).not.toMatch(/\/api\/wallet\/principal\/provision/);
    expect(retry).not.toMatch(/generateEvmKeyPair/);
  });

  it('the retry path signs the stored envelope locally', () => {
    const at = code.indexOf('export async function proveExistingPrincipalWallet');
    const retry = code.slice(at);
    expect(retry).toMatch(/decryptPrivateKey/);
    expect(retry).toMatch(/signMessage\(issued\.nonce\)/);
  });

  it('does not import the linked-wallet migration helper — that is the server\'s act', () => {
    expect(
      forbiddenImportFindings(client, ['migrateAddressToLinkedBinding'], ['wallet/linkedExternalWallet']),
    ).toEqual([]);
  });
});

describe('one predicate for "is there an envelope"', () => {
  it('accepts the OBJECT shape keyService actually produces', () => {
    // The defect: a string-only check made a real, successfully provisioned
    // wallet invisible to the classifier while the routes could see it. The
    // operator was shown a refusal saying a proven signer existed AND a form
    // offering to create one, at the same instant.
    expect(hasEncryptedEnvelope({ encryptedPrivateKey: { salt: 'aa', iv: 'bb', ciphertext: 'cc', authTag: 'dd' } })).toBe(
      true,
    );
  });

  it('accepts a legacy serialised string', () => {
    expect(hasEncryptedEnvelope({ encryptedPrivateKey: 'legacy-blob' })).toBe(true);
  });

  it('rejects the keyless placeholder — an address with no envelope', () => {
    expect(hasEncryptedEnvelope({ address: '0x1111111111111111111111111111111111111111' })).toBe(false);
  });

  it('rejects empty, null and undefined', () => {
    expect(hasEncryptedEnvelope({ encryptedPrivateKey: '' })).toBe(false);
    expect(hasEncryptedEnvelope({ encryptedPrivateKey: null })).toBe(false);
    expect(hasEncryptedEnvelope(null)).toBe(false);
    expect(hasEncryptedEnvelope(undefined)).toBe(false);
  });

  it('every reader uses it — no module re-implements the check inline', () => {
    // inv.engineering.036. Three inline copies drifted and INVERTED the answer;
    // a parity canary is what the source-of-truth rule requires when a
    // predicate has to be consistent across modules.
    const readers = [
      'services/identity/personaAddressResolver.ts',
      'app/api/wallet/principal/provision/route.ts',
      'app/api/wallet/principal/control-proof/route.ts',
    ];
    for (const file of readers) {
      const code = stripComments(readSource(file));
      expect(code, file).toMatch(/hasEncryptedEnvelope\(/);
      // The specific shape that broke: testing the envelope for a string.
      expect(code, file).not.toMatch(/encryptedPrivateKey\s*===\s*['"]string['"]/);
      expect(code, file).not.toMatch(/typeof\s+\w*[Ee]nv\w*\??\.encryptedPrivateKey\s*===/);
    }
  });
});
