/**
 * Pilot treasury authority gate — canaries for
 * `services/treasury/pilotTreasuryAuthority.js` and
 * `scripts/_lib/treasuryMandateLedger.js`.
 *
 * Status: PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE (operator-ratified
 * 2026-07-30). See
 * codexes/packs/agentiq/updates/2026-07-30_pilot-treasury-authority.md.
 *
 * Covers the full required chain (operator's exact instruction): mandate
 * shape/expiry/replay -> passcode -> required signatory approval (with the
 * "no permissive-signer-shopping" invariant: a required-signatory refusal
 * never falls through to the observer as a substitute) -> mandate-vs-real-tx
 * match. Plus the CLI-side lockout ledger, tested against a real temp
 * directory (this module is plain filesystem IO, not subject to the
 * services/research/review/* determinism discipline).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PILOT_SECURITY_STATUS,
  EXECUTION_AGENT,
  TRANSACTION_CLASS_POLICY,
  computeMandateCommitment,
  validateMandateShape,
  assertMandateNotExpired,
  assertReplaySafe,
  assertMandateMatchesTransaction,
  verifyNakamotoApproval,
  verifyAletheonObservation,
  verifyKn0w1Observation,
  evaluateSignatories,
  deriveOperatorPasscodeHash,
  verifyOperatorPasscode,
  authorizeTreasuryAction,
} from '@/services/treasury/pilotTreasuryAuthority';

import {
  createFileBackedNonceStore,
  recordFailedPasscodeAttempt,
  assertNotLockedOut,
  MAX_FAILED_ATTEMPTS,
} from '@/scripts/_lib/treasuryMandateLedger';

const SALT = 'test-salt';
const PASSCODE = 'correct-horse-battery-staple';
const PASSCODE_HASH = deriveOperatorPasscodeHash(PASSCODE, SALT);

function baseMandate(overrides: Record<string, unknown> = {}) {
  return {
    action: 'bitcent-testnet-etch',
    asset: 'BITCENT',
    amount: 100_000_000,
    source: 'tb1qsource',
    destination: 'tb1qdest',
    network: 'testnet',
    agent: EXECUTION_AGENT,
    nonce: 'nonce-1',
    expiry: '2026-08-01T00:00:00.000Z',
    executionMode: 'testnet-broadcast',
    expectedTxSummary: 'Etch BITCENT to tb1qdest',
    transactionClass: 'bitcent-treasury-ordinary',
    ...overrides,
  };
}

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    issuanceRecordRatified: true,
    network: 'testnet',
    mainnetMandateExplicit: false,
    treasuryCap: null,
    operatorIsSolePrincipal: true,
    ...overrides,
  };
}

function inMemoryNonceStore() {
  const used = new Set<string>();
  return {
    hasBeenUsed: (n: string) => used.has(n),
    markUsed: (n: string) => used.add(n),
  };
}

describe('mandate shape validation', () => {
  it('accepts a complete, well-formed mandate', () => {
    expect(() => validateMandateShape(baseMandate())).not.toThrow();
  });

  it('refuses a mandate missing a required field', () => {
    const m = baseMandate();
    delete (m as Record<string, unknown>).destination;
    expect(() => validateMandateShape(m)).toThrowError(/missing required field.*destination/);
  });

  it('refuses a mandate naming an unrecognised execution agent', () => {
    expect(() => validateMandateShape(baseMandate({ agent: 'aigent-nakamoto' }))).toThrowError(
      /unrecognised-execution-agent|expected 'aigent-z'/,
    );
  });

  it('refuses an unknown transaction class', () => {
    expect(() => validateMandateShape(baseMandate({ transactionClass: 'made-up-class' }))).toThrowError(
      /unknown-transaction-class|no policy entry/,
    );
  });
});

describe('mandate expiry and replay', () => {
  it('refuses an expired mandate', () => {
    expect(() => assertMandateNotExpired(baseMandate({ expiry: '2020-01-01T00:00:00.000Z' }), '2026-08-01T00:00:00.000Z'))
      .toThrowError(/mandate-expired|expired/);
  });

  it('accepts a mandate whose expiry has not passed', () => {
    expect(() => assertMandateNotExpired(baseMandate(), '2026-07-31T00:00:00.000Z')).not.toThrow();
  });

  it('refuses replay of an already-used nonce', () => {
    const store = inMemoryNonceStore();
    const mandate = baseMandate({ nonce: 'used-once' });
    expect(() => assertReplaySafe(mandate, store)).not.toThrow();
    store.markUsed('used-once');
    expect(() => assertReplaySafe(mandate, store)).toThrowError(/nonce-already-used|already been consumed/);
  });
});

describe('mandate-vs-transaction match', () => {
  it('passes when the generated transaction matches the mandate', () => {
    const mandate = baseMandate();
    expect(() =>
      assertMandateMatchesTransaction(mandate, { asset: 'BITCENT', amount: 100_000_000, destination: 'tb1qdest', network: 'testnet' }),
    ).not.toThrow();
  });

  it('refuses when the real destination differs from the approved mandate', () => {
    const mandate = baseMandate();
    expect(() =>
      assertMandateMatchesTransaction(mandate, { asset: 'BITCENT', amount: 100_000_000, destination: 'tb1qDIFFERENT', network: 'testnet' }),
    ).toThrowError(/mandate-transaction-mismatch|destination/);
  });

  it('refuses when the real amount differs', () => {
    const mandate = baseMandate();
    expect(() =>
      assertMandateMatchesTransaction(mandate, { asset: 'BITCENT', amount: 1, destination: 'tb1qdest', network: 'testnet' }),
    ).toThrowError(/mandate-transaction-mismatch|amount/);
  });
});

describe('signatory policy — required signatory refusal never falls through to the observer', () => {
  it('bitcent-treasury-ordinary requires Nakamoto approval and observes via Kn0w1', () => {
    expect(TRANSACTION_CLASS_POLICY['bitcent-treasury-ordinary']).toEqual({
      requiredSignatory: 'aigent-nakamoto',
      observer: 'aigent-kn0w1',
    });
  });

  it('an approving Nakamoto + Kn0w1 context authorises', () => {
    const result = evaluateSignatories(baseMandate(), baseContext());
    expect(result.requiredApproval.approved).toBe(true);
    expect(result.observerResult.approved).toBe(true);
  });

  it('Nakamoto refuses on an unratified issuance record — this alone stops the mandate', () => {
    const context = baseContext({ issuanceRecordRatified: false });
    expect(() => evaluateSignatories(baseMandate(), context)).toThrowError(
      /required-signatory-refused|issuance record is not fully ratified/,
    );
  });

  it('a condition only Nakamoto checks (treasury cap) is NOT silently bypassed by a permissive observer', () => {
    // Kn0w1 (the observer for this class) does not check treasuryCap at all
    // -- it would approve this mandate on its own. Proving evaluateSignatories
    // still refuses shows the required signatory's check is never
    // substituted by a more permissive observer's opinion.
    const context = baseContext({ treasuryCap: 1000 });
    const mandate = baseMandate({ amount: 1_000_001 });
    expect(verifyKn0w1Observation(mandate, context).approved).toBe(true);
    expect(() => evaluateSignatories(mandate, context)).toThrowError(/required-signatory-refused|exceeds the treasury cap/);
  });

  it('mainnet execution without an explicit mainnet mandate is refused by Nakamoto', () => {
    const mandate = baseMandate({ network: 'mainnet' });
    expect(verifyNakamotoApproval(mandate, baseContext()).approved).toBe(false);
  });

  it('an amount over the treasury cap is refused', () => {
    const context = baseContext({ treasuryCap: 1000 });
    expect(verifyNakamotoApproval(baseMandate({ amount: 1_000_001 }), context).approved).toBe(false);
  });

  it('the constitutional-exception class flips required signatory to Aletheon, observed by Nakamoto', () => {
    const mandate = baseMandate({ transactionClass: 'bitcent-treasury-constitutional-exception' });
    const result = evaluateSignatories(mandate, baseContext());
    expect(result.requiredSignatory).toBe('aletheon');
    expect(result.observer).toBe('aigent-nakamoto');
  });

  it('Aletheon refuses without a confirmed sole-principal context', () => {
    expect(verifyAletheonObservation(baseMandate(), baseContext({ operatorIsSolePrincipal: false })).approved).toBe(false);
  });
});

describe('operator passcode verification', () => {
  it('accepts the correct passcode', () => {
    expect(() => verifyOperatorPasscode({ providedPasscode: PASSCODE, expectedHash: PASSCODE_HASH, salt: SALT })).not.toThrow();
  });

  it('refuses an incorrect passcode', () => {
    expect(() => verifyOperatorPasscode({ providedPasscode: 'wrong', expectedHash: PASSCODE_HASH, salt: SALT }))
      .toThrowError(/passcode-incorrect|did not verify/);
  });

  it('refuses when the passcode is not configured at all — never treats absence as "no passcode required"', () => {
    expect(() => verifyOperatorPasscode({ providedPasscode: PASSCODE, expectedHash: undefined, salt: undefined }))
      .toThrowError(/passcode-not-configured|not both set/);
  });

  it('never stores or derives the passcode itself from the hash (one-way)', () => {
    // The stored artifact is a scrypt hash, not the plaintext or anything
    // trivially invertible to it.
    expect(PASSCODE_HASH).not.toContain(PASSCODE);
  });
});

describe('the full authorizeTreasuryAction chain', () => {
  it('positive path: a fully valid mandate + correct passcode + approving signatories authorises and consumes the nonce', () => {
    const store = inMemoryNonceStore();
    const mandate = baseMandate({ nonce: 'positive-path-nonce' });
    const result = authorizeTreasuryAction({
      mandate,
      generatedTx: { asset: 'BITCENT', amount: 100_000_000, destination: 'tb1qdest', network: 'testnet' },
      providedPasscode: PASSCODE,
      passcodeConfig: { hash: PASSCODE_HASH, salt: SALT },
      context: baseContext(),
      nonceStore: store,
      nowIso: '2026-07-31T00:00:00.000Z',
    });
    expect(result.status).toBe(PILOT_SECURITY_STATUS);
    expect(result.executionAgent).toBe(EXECUTION_AGENT);
    expect(result.mandateCommitment).toBe(computeMandateCommitment(mandate));
    expect(store.hasBeenUsed('positive-path-nonce')).toBe(true);
  });

  it('a failed attempt (wrong passcode) does NOT consume the nonce — it must remain retryable', () => {
    const store = inMemoryNonceStore();
    const mandate = baseMandate({ nonce: 'retryable-nonce' });
    expect(() =>
      authorizeTreasuryAction({
        mandate,
        providedPasscode: 'wrong-passcode',
        passcodeConfig: { hash: PASSCODE_HASH, salt: SALT },
        context: baseContext(),
        nonceStore: store,
        nowIso: '2026-07-31T00:00:00.000Z',
      }),
    ).toThrowError(/did not verify/);
    expect(store.hasBeenUsed('retryable-nonce')).toBe(false);

    // Retrying with the CORRECT passcode now succeeds — the failed attempt
    // above did not burn the mandate.
    const result = authorizeTreasuryAction({
      mandate,
      providedPasscode: PASSCODE,
      passcodeConfig: { hash: PASSCODE_HASH, salt: SALT },
      context: baseContext(),
      nonceStore: store,
      nowIso: '2026-07-31T00:00:00.000Z',
    });
    expect(result.status).toBe(PILOT_SECURITY_STATUS);
  });

  it('refuses a mandate/generated-tx mismatch even after passcode and signatories pass', () => {
    const store = inMemoryNonceStore();
    const mandate = baseMandate({ nonce: 'mismatch-nonce' });
    expect(() =>
      authorizeTreasuryAction({
        mandate,
        generatedTx: { asset: 'BITCENT', amount: 100_000_000, destination: 'tb1qHIJACKED', network: 'testnet' },
        providedPasscode: PASSCODE,
        passcodeConfig: { hash: PASSCODE_HASH, salt: SALT },
        context: baseContext(),
        nonceStore: store,
        nowIso: '2026-07-31T00:00:00.000Z',
      }),
    ).toThrowError(/differs from the approved mandate/);
    // A mismatch is caught AFTER signatories/passcode pass -- the nonce must
    // still not be burned, since the real tx never executed.
    expect(store.hasBeenUsed('mismatch-nonce')).toBe(false);
  });
});

describe('the file-backed passcode-attempt ledger (lockout)', () => {
  let dir: string;
  let ledgerPath: string;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('allows attempts under the threshold, then locks out at MAX_FAILED_ATTEMPTS', () => {
    dir = mkdtempSync(join(tmpdir(), 'treasury-ledger-test-'));
    ledgerPath = join(dir, 'ledger.json');
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      expect(() => assertNotLockedOut(ledgerPath)).not.toThrow();
      recordFailedPasscodeAttempt(ledgerPath);
    }
    // One more failure reaches the threshold.
    recordFailedPasscodeAttempt(ledgerPath);
    expect(() => assertNotLockedOut(ledgerPath)).toThrowError(/locked out/);
  });

  it('nonce marked used in the file-backed store is reported as used', () => {
    dir = mkdtempSync(join(tmpdir(), 'treasury-ledger-test-'));
    ledgerPath = join(dir, 'ledger.json');
    const store = createFileBackedNonceStore(ledgerPath);
    expect(store.hasBeenUsed('n1')).toBe(false);
    store.markUsed('n1', 'commitment-abc');
    expect(store.hasBeenUsed('n1')).toBe(true);
  });
});
