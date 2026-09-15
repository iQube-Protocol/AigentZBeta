/**
 * services/vela/velaRecipientProvisioningPreflight.ts — recipient
 * provisioning preflight (2026-09-16, Vela masterclass). Two layers:
 *
 *  1. `checkVelaRecipientProvisioning` (the orchestrator) — pure composition
 *     over an injected `VelaRecipientRegistryReader`, tested here with a
 *     deterministic fake reader (mirrors this codebase's existing
 *     `VelaTransport`/`VelaTestTransport` injection pattern).
 *  2. `createVelaClientRecipientRegistryReader` (the REAL, read-only
 *     implementation) — tested against a minimal mocked `ethers` surface
 *     (`Contract`/`JsonRpcProvider`), proving the actual RequestSubmitted ->
 *     decode-calldata -> RequestCompleted chain-of-evidence logic, never a
 *     live network call.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocked ethers surface for createVelaClientRecipientRegistryReader's REAL
// implementation — never a live RPC call. Mirrors this codebase's existing
// convention of faking the network-facing edge (probeVelaRpcReachable mocks
// `fetch`; AgentKeyService/VelaClientAdapter are mocked in
// tests/seed-use-case-zero-demo.test.ts) rather than hitting a real chain. ──

const queryFilterMock = vi.fn();
const parseLogMock = vi.fn();
const getTransactionMock = vi.fn();
const parseTransactionMock = vi.fn();

vi.mock('ethers', () => {
  class FakeContract {
    filters = {
      RequestSubmitted: (...args: unknown[]) => ({ __filter: 'RequestSubmitted', args }),
      RequestCompleted: (...args: unknown[]) => ({ __filter: 'RequestCompleted', args }),
    };
    interface = { parseLog: (...args: unknown[]) => parseLogMock(...args) };
    queryFilter(...args: unknown[]) {
      return queryFilterMock(...args);
    }
    constructor(_address: string, _abi: unknown, _providerOrSigner: unknown) {}
  }
  class FakeJsonRpcProvider {
    getTransaction(...args: unknown[]) {
      return getTransactionMock(...args);
    }
    constructor(_url: string) {}
  }
  class FakeInterface {
    parseTransaction(...args: unknown[]) {
      return parseTransactionMock(...args);
    }
    constructor(_abi: unknown) {}
  }
  return { Contract: FakeContract, JsonRpcProvider: FakeJsonRpcProvider, Interface: FakeInterface };
});

import {
  checkVelaRecipientProvisioning,
  createVelaClientRecipientRegistryReader,
  type VelaRecipientReadinessEvidence,
  type VelaRecipientRegistryReader,
} from '@/services/vela/velaRecipientProvisioningPreflight';

const ADDR_A = '0x1111111111111111111111111111111111111111';
const ADDR_B = '0x2222222222222222222222222222222222222222';
const ADDR_C = '0x3333333333333333333333333333333333333333';
const APP_ID = '42';

function verifiedEvidence(recipientAddress: string, eventSeedStatus: VelaRecipientReadinessEvidence['eventSeedStatus'] = 'VERIFIED'): VelaRecipientReadinessEvidence {
  return {
    recipientAddress,
    associationStatus: 'VERIFIED',
    associationDetail: 'ASSOCIATEKEY request 0xabc completed successfully (errorCode 0).',
    eventSeedStatus,
    eventSeedDetail: eventSeedStatus === 'VERIFIED' ? 'seed present' : 'no seed registered',
  };
}

function missingEvidence(recipientAddress: string): VelaRecipientReadinessEvidence {
  return {
    recipientAddress,
    associationStatus: 'MISSING',
    associationDetail: 'no RequestSubmitted log found from this address for this applicationId.',
    eventSeedStatus: 'UNVERIFIABLE',
    eventSeedDetail: 'no association to check a seed against',
  };
}

function unverifiableEvidence(recipientAddress: string, reason: string): VelaRecipientReadinessEvidence {
  return {
    recipientAddress,
    associationStatus: 'UNVERIFIABLE',
    associationDetail: reason,
    eventSeedStatus: 'UNVERIFIABLE',
    eventSeedDetail: 'association could not be verified, so its event seed cannot be checked either',
  };
}

function fakeReader(byAddress: Record<string, VelaRecipientReadinessEvidence>): VelaRecipientRegistryReader {
  return {
    checkRecipientAssociation: vi.fn(async (_applicationId: string, recipientAddress: string) => {
      const evidence = byAddress[recipientAddress];
      if (!evidence) throw new Error(`fakeReader: no fixture for ${recipientAddress}`);
      return evidence;
    }),
  };
}

describe('checkVelaRecipientProvisioning — every required recipient registered', () => {
  it('ready: true when every recipient is VERIFIED', async () => {
    const reader = fakeReader({ [ADDR_A]: verifiedEvidence(ADDR_A), [ADDR_B]: verifiedEvidence(ADDR_B) });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A, ADDR_B]);
    expect(result.ready).toBe(true);
    expect(result.recipients).toHaveLength(2);
    expect(result.privacyLimitation).toBeNull();
  });

  it('ready: true (vacuously) with zero recipients — never calls the reader at all', async () => {
    const reader = fakeReader({});
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, []);
    expect(result.ready).toBe(true);
    expect(result.recipients).toEqual([]);
    expect(reader.checkRecipientAssociation).not.toHaveBeenCalled();
  });
});

describe('checkVelaRecipientProvisioning — one required recipient missing -> fail closed', () => {
  it('ready: false when ANY recipient is MISSING, even if others are VERIFIED', async () => {
    const reader = fakeReader({ [ADDR_A]: verifiedEvidence(ADDR_A), [ADDR_B]: missingEvidence(ADDR_B) });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A, ADDR_B]);
    expect(result.ready).toBe(false);
    const missing = result.recipients.find((r) => r.recipientAddress === ADDR_B);
    expect(missing?.associationStatus).toBe('MISSING');
  });
});

describe('checkVelaRecipientProvisioning — registry unreachable/unverifiable -> fail closed', () => {
  it('ready: false when a recipient resolves UNVERIFIABLE — never treated as VERIFIED or silently skipped', async () => {
    const reader = fakeReader({
      [ADDR_A]: verifiedEvidence(ADDR_A),
      [ADDR_B]: unverifiableEvidence(ADDR_B, 'registry query (RequestSubmitted) failed: connect ECONNREFUSED'),
    });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A, ADDR_B]);
    expect(result.ready).toBe(false);
    const unverifiable = result.recipients.find((r) => r.recipientAddress === ADDR_B);
    expect(unverifiable?.associationStatus).toBe('UNVERIFIABLE');
  });
});

describe('checkVelaRecipientProvisioning — event-seed optionality', () => {
  it('an ABSENT event seed never blocks readiness, but populates a non-null privacyLimitation', async () => {
    const reader = fakeReader({
      [ADDR_A]: verifiedEvidence(ADDR_A, 'ABSENT'),
      [ADDR_B]: verifiedEvidence(ADDR_B, 'VERIFIED'),
    });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A, ADDR_B]);
    expect(result.ready).toBe(true);
    expect(result.privacyLimitation).toMatch(/1 of 2 recipient\(s\)/);
    expect(result.privacyLimitation).toMatch(/OPTIONAL and its absence never blocks readiness/);
  });

  it('every recipient VERIFIED for both association and event seed -> privacyLimitation is null', async () => {
    const reader = fakeReader({ [ADDR_A]: verifiedEvidence(ADDR_A), [ADDR_B]: verifiedEvidence(ADDR_B) });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A, ADDR_B]);
    expect(result.privacyLimitation).toBeNull();
  });
});

describe('checkVelaRecipientProvisioning — only the parties actually supplied are checked (no inferred/surrounding-state recipients)', () => {
  it('a party never passed in recipientAddresses is never checked and never affects readiness, even though the fixture WOULD have failed it', async () => {
    // ADDR_C is deliberately fixtured as MISSING — proving it is never
    // consulted because it was never named a required recipient in the
    // first place (mirrors "unauthorized/non-recipient parties are not
    // required merely because they exist in surrounding persona state").
    const reader = fakeReader({
      [ADDR_A]: verifiedEvidence(ADDR_A),
      [ADDR_B]: verifiedEvidence(ADDR_B),
      [ADDR_C]: missingEvidence(ADDR_C),
    });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A, ADDR_B]);
    expect(result.ready).toBe(true);
    expect(result.recipients.map((r) => r.recipientAddress).sort()).toEqual([ADDR_A, ADDR_B].sort());
    expect(reader.checkRecipientAssociation).not.toHaveBeenCalledWith(APP_ID, ADDR_C);
  });
});

describe('checkVelaRecipientProvisioning — evidence never carries key/ciphertext material', () => {
  it('the readiness evidence object only ever has the four documented fields — no key/ciphertext-shaped field can even be attached by this orchestrator', async () => {
    const reader = fakeReader({ [ADDR_A]: verifiedEvidence(ADDR_A) });
    const result = await checkVelaRecipientProvisioning(reader, APP_ID, [ADDR_A]);
    expect(Object.keys(result.recipients[0]).sort()).toEqual(
      ['associationDetail', 'associationStatus', 'eventSeedDetail', 'eventSeedStatus', 'recipientAddress'].sort(),
    );
  });
});

// ── createVelaClientRecipientRegistryReader — the REAL, read-only
// implementation, against a mocked ethers surface ──────────────────────────

const DEPLOYMENT = { rpcUrl: 'http://localhost:8545', processorEndpointAddress: '0x' + '9'.repeat(40) };
const REQUEST_ID = '0x' + 'ab'.repeat(32);
const TX_HASH = '0x' + 'cd'.repeat(32);
const KEY_ONLY_PAYLOAD_HEX = '0x' + '11'.repeat(133); // 133 bytes
const KEY_PLUS_SEED_PAYLOAD_HEX = '0x' + '11'.repeat(226); // 226 bytes

function submittedLog() {
  return { transactionHash: TX_HASH };
}

function associateKeyTx() {
  // The tx object itself only needs to be truthy — the "real" payload the
  // reader reads comes from `iface.parseTransaction(...).args.payload`
  // (mocked separately below), never from `tx.data` directly.
  return { data: '0xdeadbeef' };
}

beforeEach(() => {
  queryFilterMock.mockReset();
  parseLogMock.mockReset();
  getTransactionMock.mockReset();
  parseTransactionMock.mockReset();
});

describe('createVelaClientRecipientRegistryReader — real implementation, mocked ethers', () => {
  it('a malformed address resolves UNVERIFIABLE WITHOUT making any network call', async () => {
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, 'not-an-address');
    expect(evidence.associationStatus).toBe('UNVERIFIABLE');
    expect(evidence.eventSeedStatus).toBe('UNVERIFIABLE');
    expect(queryFilterMock).not.toHaveBeenCalled();
  });

  it('a RequestSubmitted query failure resolves UNVERIFIABLE (registry unreachable), never MISSING or VERIFIED', async () => {
    queryFilterMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:8545'));
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    expect(evidence.associationStatus).toBe('UNVERIFIABLE');
    expect(evidence.associationDetail).toMatch(/ECONNREFUSED/);
  });

  it('no RequestSubmitted logs at all resolves MISSING', async () => {
    queryFilterMock.mockResolvedValueOnce([]);
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    expect(evidence.associationStatus).toBe('MISSING');
  });

  it('a RequestSubmitted log whose decoded requestType is NOT ASSOCIATEKEY (e.g. PROCESS) is skipped, resolving MISSING', async () => {
    queryFilterMock.mockResolvedValueOnce([submittedLog()]);
    parseLogMock.mockReturnValueOnce({ args: { requestId: REQUEST_ID } });
    getTransactionMock.mockResolvedValueOnce(associateKeyTx());
    parseTransactionMock.mockReturnValueOnce({ name: 'submitRequest', args: { requestType: 1, payload: KEY_ONLY_PAYLOAD_HEX } });
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    expect(evidence.associationStatus).toBe('MISSING');
  });

  it('an ASSOCIATEKEY request whose RequestCompleted reports a non-zero errorCode is skipped, resolving MISSING (a failed attempt is never treated as a successful association)', async () => {
    queryFilterMock
      .mockResolvedValueOnce([submittedLog()]) // RequestSubmitted
      .mockResolvedValueOnce([{}]); // RequestCompleted
    parseLogMock
      .mockReturnValueOnce({ args: { requestId: REQUEST_ID } }) // RequestSubmitted parse
      .mockReturnValueOnce({ args: { errorCode: 9 } }); // RequestCompleted parse (errorCode 9 = "no Secp521r1_PubKey found")
    getTransactionMock.mockResolvedValueOnce(associateKeyTx());
    parseTransactionMock.mockReturnValueOnce({
      name: 'submitRequest',
      args: { requestType: 3, payload: KEY_ONLY_PAYLOAD_HEX },
    });
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    expect(evidence.associationStatus).toBe('MISSING');
  });

  it('a successfully completed ASSOCIATEKEY with the 133-byte key-only payload resolves VERIFIED / eventSeed ABSENT', async () => {
    queryFilterMock.mockResolvedValueOnce([submittedLog()]).mockResolvedValueOnce([{}]);
    parseLogMock
      .mockReturnValueOnce({ args: { requestId: REQUEST_ID } })
      .mockReturnValueOnce({ args: { errorCode: 0 } });
    getTransactionMock.mockResolvedValueOnce(associateKeyTx());
    parseTransactionMock.mockReturnValueOnce({
      name: 'submitRequest',
      args: { requestType: 3, payload: KEY_ONLY_PAYLOAD_HEX },
    });
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    expect(evidence.associationStatus).toBe('VERIFIED');
    expect(evidence.eventSeedStatus).toBe('ABSENT');
  });

  it('a successfully completed ASSOCIATEKEY with the 226-byte key+seed payload resolves VERIFIED / eventSeed VERIFIED', async () => {
    queryFilterMock.mockResolvedValueOnce([submittedLog()]).mockResolvedValueOnce([{}]);
    parseLogMock
      .mockReturnValueOnce({ args: { requestId: REQUEST_ID } })
      .mockReturnValueOnce({ args: { errorCode: 0 } });
    getTransactionMock.mockResolvedValueOnce(associateKeyTx());
    parseTransactionMock.mockReturnValueOnce({
      name: 'submitRequest',
      args: { requestType: 3, payload: KEY_PLUS_SEED_PAYLOAD_HEX },
    });
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    expect(evidence.associationStatus).toBe('VERIFIED');
    expect(evidence.eventSeedStatus).toBe('VERIFIED');
  });

  it('NEVER includes the raw payload bytes (public key or encrypted seed) anywhere in the returned evidence — only counts/statuses', async () => {
    queryFilterMock.mockResolvedValueOnce([submittedLog()]).mockResolvedValueOnce([{}]);
    parseLogMock
      .mockReturnValueOnce({ args: { requestId: REQUEST_ID } })
      .mockReturnValueOnce({ args: { errorCode: 0 } });
    getTransactionMock.mockResolvedValueOnce(associateKeyTx());
    parseTransactionMock.mockReturnValueOnce({
      name: 'submitRequest',
      args: { requestType: 3, payload: KEY_PLUS_SEED_PAYLOAD_HEX },
    });
    const reader = createVelaClientRecipientRegistryReader(DEPLOYMENT);
    const evidence = await reader.checkRecipientAssociation(APP_ID, ADDR_A);
    const serialised = JSON.stringify(evidence);
    expect(serialised).not.toContain('11'.repeat(133));
    expect(serialised).not.toContain(KEY_PLUS_SEED_PAYLOAD_HEX);
  });
});
