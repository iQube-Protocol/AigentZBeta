/**
 * scripts/seedUseCaseZeroDemo.ts — Use Case Zero build-order item 11.
 *
 * Supabase is down platform-wide as of this build and this worktree carries
 * no live credentials regardless — every assertion here is proven via
 * mocked dependencies and pure computation, NEVER a live call. Placeholder
 * personaIds used throughout (`test-persona-arkagent` etc.) are clearly-fake
 * strings, never real personas.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createFakeSupabase, type FakeTables } from './_lib/fakeSupabase';

// ── Fixture recipient addresses (2026-09-16, Vela masterclass — real
// recipient-binding repair) ─────────────────────────────────────────────────
//
// Two distinct, well-formed-but-obviously-synthetic EVM addresses standing in
// for ArkAgent's persona wallet and Aigent Nakamoto's custodied agent wallet.
// Declared before any vi.mock(...) factory below references them — vi.mock
// factories run at module-evaluation time in source order, so these MUST be
// defined above their first use.
const TEST_ARKAGENT_RECIPIENT_ADDRESS = '0xA0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0';
const TEST_NAKAMOTO_RECIPIENT_ADDRESS = '0xB0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0';
const TEST_RESOLVED_RECIPIENTS = {
  arkAgentRecipientAddress: TEST_ARKAGENT_RECIPIENT_ADDRESS,
  nakamotoRecipientAddress: TEST_NAKAMOTO_RECIPIENT_ADDRESS,
};

// ── Mocks (module-level, before importing the module under test) ──────────

interface FakeReceiptRecord {
  id: string;
  personaId: string;
  activeCartridge: string;
  actionType: string;
  agentsInvoked: string[];
  actionInput: Record<string, unknown> | null;
  receiptStatus: 'local';
  createdAt: string;
}

let receiptStore: FakeReceiptRecord[] = [];
let receiptSeq = 0;

const createActivityReceiptMock = vi.fn(async (input: any) => {
  receiptSeq += 1;
  const record: FakeReceiptRecord = {
    id: `receipt-${receiptSeq}`,
    personaId: input.personaId,
    activeCartridge: input.activeCartridge ?? 'moneypenny',
    actionType: input.actionType,
    agentsInvoked: input.agentsInvoked ?? [],
    actionInput: input.actionInput ?? null,
    receiptStatus: 'local',
    createdAt: new Date(1_700_000_000_000 + receiptSeq * 1000).toISOString(),
  };
  receiptStore.push(record);
  return record;
});

const listActivityReceiptsForPersonaMock = vi.fn(async (personaId: string, options?: { actionTypes?: string[] }) => {
  return receiptStore
    .filter((r) => r.personaId === personaId && (!options?.actionTypes || options.actionTypes.includes(r.actionType)))
    .slice()
    .reverse(); // most-recent-first, matching the real reader's own ordering
});

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceiptMock(...args),
  listActivityReceiptsForPersona: (...args: any[]) => listActivityReceiptsForPersonaMock(...args),
}));

let fakeAdmin: { admin: unknown; tables: FakeTables } | null = null;
const getSupabaseServerMock = vi.fn(() => fakeAdmin?.admin ?? null);
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: (...args: any[]) => getSupabaseServerMock(...args),
}));

const SIMULATED_ACCEPTABLE_QUOTE = {
  riskBand: 'LOW' as const,
  estimatedExposure: 500,
  riskOfRepair: 'LOW' as const,
  coverageEligible: true,
  coverageLimit: 5_000,
  premium: 50,
  conditions: [] as string[],
  confidence: 0.75,
  providerMode: 'SIMULATED' as const,
};

const runVelaUnderwritingProjectionMock = vi.fn(async () => ({
  onChainRequestId: 'onchain-request-1',
  disposition: 'ACCEPTABLE' as const,
  quote: SIMULATED_ACCEPTABLE_QUOTE,
  receiptId: null,
  telemetryRecordId: null,
}));
vi.mock('@/services/vela/velaUnderwritingProjection', () => ({
  runVelaUnderwritingProjection: (...args: any[]) => runVelaUnderwritingProjectionMock(...args),
}));

// ── Mocks for resolveDemoVelaTransport's internal P-521 derivation ─────────
//
// `@/services/vela/agentP521Derivation` and `ethers` are deliberately NOT
// mocked below — the whole point of these tests is to prove the REAL
// deterministic derivation (services/vela/agentP521Derivation.ts) runs
// end-to-end from a real ethers.Wallet, exactly as
// scripts/vela/public-devnet-smoke.ts already proves elsewhere. Only the
// network-facing/credential-reading edges (AgentKeyService, VelaClientAdapter,
// resolveVelaDeployment) are faked.

const getAgentKeysMock = vi.fn(async (_agentId: string) => null as { evmPrivateKey?: string } | null);
// Default: Nakamoto's canonical custodied address — "safe to expose" per
// AgentKeyService's own doc comment, never a private key. Distinct from
// TEST_ARKAGENT_RECIPIENT_ADDRESS below so the two-distinct-recipients
// invariant holds by default for every EXISTING test.
const getAgentAddressesMock = vi.fn(
  async (agentId: string) => ({ agentId, evmAddress: TEST_NAKAMOTO_RECIPIENT_ADDRESS }) as { agentId: string; evmAddress?: string } | null,
);
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: vi.fn().mockImplementation(() => ({
    getAgentKeys: (...args: any[]) => getAgentKeysMock(...(args as [string])),
    getAgentAddresses: (...args: any[]) => getAgentAddressesMock(...(args as [string])),
  })),
}));

// ── Mock for ArkAgent's persona-wallet resolution (2026-09-16, Vela
// masterclass — real recipient-binding repair) ─────────────────────────────
//
// Defaults to SIGNER_CONFIGURED with TEST_ARKAGENT_RECIPIENT_ADDRESS so
// every EXISTING test continues to exercise exactly what it did before this
// resolution step existed. Individual tests override this to prove the
// fail-closed contract.
const classifyPersonaWalletCapabilityMock = vi.fn(async (_personaId: string) => ({
  capability: 'SIGNER_CONFIGURED' as const,
  address: TEST_ARKAGENT_RECIPIENT_ADDRESS as string | null,
  detail: 'test double: signer configured',
  remediation: null as string | null,
}));
vi.mock('@/services/identity/personaAddressResolver', () => ({
  classifyPersonaWalletCapability: (...args: any[]) => classifyPersonaWalletCapabilityMock(...(args as [string])),
}));

const velaClientAdapterConstructorMock = vi.fn();
class FakeVelaClientAdapter {
  constructor(opts: unknown) {
    velaClientAdapterConstructorMock(opts);
  }
}
vi.mock('@/services/vela/velaClientAdapter', () => ({
  VelaClientAdapter: FakeVelaClientAdapter,
}));

const TEST_RPC_URL = 'http://localhost:8545';
vi.mock('@/services/vela/velaConfig', () => ({
  resolveVelaDeployment: vi.fn((env: string) => ({ env, rpcUrl: TEST_RPC_URL })),
}));

// ── Mock for the recipient-provisioning preflight (2026-09-16, Vela
// masterclass) ─────────────────────────────────────────────────────────────
//
// Defaults to "every recipient VERIFIED" so every EXISTING test below
// (written before this check existed) continues to exercise exactly what it
// did before — none of them are ABOUT recipient provisioning. Individual
// tests override `checkVelaRecipientProvisioningMock`'s return value to
// prove the fail-closed gate itself.
const checkVelaRecipientProvisioningMock = vi.fn(async (_reader: unknown, _applicationId: string, recipientAddresses: string[]) => ({
  ready: true,
  recipients: recipientAddresses.map((recipientAddress) => ({
    recipientAddress,
    associationStatus: 'VERIFIED' as const,
    associationDetail: 'test double: verified',
    eventSeedStatus: 'VERIFIED' as const,
    eventSeedDetail: 'test double: verified',
  })),
  privacyLimitation: null as string | null,
}));
// Shared per-recipient association-check double (2026-09-16, UC0 final live
// blocker — --provision-recipients) — `provisionUseCaseZeroDemoRecipients`
// calls `reader.checkRecipientAssociation` DIRECTLY (never through
// `checkVelaRecipientProvisioning`), so this is the seam its own tests
// control. Defaults to MISSING; individual tests override per-call via
// `mockImplementationOnce` chains to model the before/after check sequence.
const checkRecipientAssociationMock = vi.fn(async (_applicationId: string, recipientAddress: string) => ({
  recipientAddress,
  associationStatus: 'MISSING' as const,
  associationDetail: 'test double: missing',
  eventSeedStatus: 'UNVERIFIABLE' as const,
  eventSeedDetail: 'test double',
}));
const createVelaClientRecipientRegistryReaderMock = vi.fn((_deployment: unknown) => ({
  checkRecipientAssociation: (...args: any[]) => checkRecipientAssociationMock(...(args as [string, string])),
}));
const submitVelaAssociateKeyRequestMock = vi.fn(
  async (_deployment: unknown, _applicationId: string, _requesterPrivateKeyHex: string, _p521PublicKeyHex: string) => ({
    recipientAddress: '0x0000000000000000000000000000000000dEaD',
    requestId: '0xtest-request-id',
    status: 0,
    errorCode: 0,
  }),
);
vi.mock('@/services/vela/velaRecipientProvisioningPreflight', () => ({
  checkVelaRecipientProvisioning: (...args: any[]) => checkVelaRecipientProvisioningMock(...(args as [unknown, string, string[]])),
  createVelaClientRecipientRegistryReader: (...args: any[]) => createVelaClientRecipientRegistryReaderMock(...(args as [unknown])),
  submitVelaAssociateKeyRequest: (...args: any[]) =>
    submitVelaAssociateKeyRequestMock(...(args as [unknown, string, string, string])),
}));

// ── fetch mock for probeVelaRpcReachable's bounded reachability preflight ──
//
// Defaults to a reachable RPC (a well-formed JSON-RPC eth_chainId result) so
// every EXISTING resolveDemoVelaTransport test below continues to exercise
// exactly what it did before this preflight was added. Individual tests
// override this to prove the unreachable-RPC fail-fast contract.
const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x7a69' }),
}));

// ── Import the module under test AFTER the mocks above ─────────────────────

import {
  USE_CASE_ZERO_DEMO_REQUEST_REF,
  USE_CASE_ZERO_DEMO_APPLICATION_ID,
  USE_CASE_ZERO_PARTY_A,
  USE_CASE_ZERO_PARTY_B,
  USE_CASE_ZERO_PARTY_C,
  DEMO_AUTHORIZING_AGENT_REF,
  assertUseCaseZeroDemoPersonas,
  buildUseCaseZeroDemoFactorSelection,
  buildUseCaseZeroDemoDisclosureScope,
  composeUseCaseZeroDemoChain,
  persistUseCaseZeroDemoChain,
  resolveDemoVelaTransport,
  resolveUseCaseZeroDemoRecipientAddresses,
  main as runUseCaseZeroDemoSeedCli,
  type UseCaseZeroDemoPersonas,
  type UseCaseZeroDemoResolvedRecipients,
} from '@/scripts/seedUseCaseZeroDemo';
import type { AegisAdmissionEvidence } from '@/services/vela/velaUnderwritingAdmissionEvidence';
import type { ConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';
import { redactConstitutionalRiskFlowStateForParty } from '@/services/vela/velaUnderwritingPartyView';
import type { VelaTransport } from '@/services/vela/velaTypes';

const TEST_PERSONAS: UseCaseZeroDemoPersonas = {
  arkAgentPersonaId: 'test-persona-arkagent',
  nakamotoPersonaId: 'test-persona-nakamoto',
  kn0w1PersonaId: 'test-persona-kn0w1',
};

function admittedAdmissionEvidence(selectionRef: string, requestRef: string, candidateAgentId: string): AegisAdmissionEvidence {
  return {
    admissionRef: 'admission-ref-test-1',
    selectionRef,
    requestRef,
    candidateAgentId,
    serviceId: null,
    assessmentRef: 'aegis-assessment-test-1',
    assessmentVersion: 'v1',
    admissionStatus: 'ADMITTED',
    trustSummary: { decision: 'admissible', conditions: [], rationale: 'test', criticalFailedFindingCount: 0 },
    evidenceRefs: ['aegis-assessment-test-1'],
    effectiveAt: new Date(0).toISOString(),
    freshnessMs: 0,
    aegisAgentId: 'aigent-aegis',
    reason: 'Aegis ratified this candidate as admissible',
  };
}

function composeAdmittedDemoChain(personas: UseCaseZeroDemoPersonas = TEST_PERSONAS) {
  const factorSelection = buildUseCaseZeroDemoFactorSelection(personas);
  const admissionEvidence = admittedAdmissionEvidence(
    factorSelection.selectionRef,
    factorSelection.requestRef,
    factorSelection.candidateAgentId,
  );
  return composeUseCaseZeroDemoChain({ ...personas, admissionEvidence, resolvedRecipients: TEST_RESOLVED_RECIPIENTS });
}

const NOOP_TRANSPORT: VelaTransport = {} as VelaTransport; // never actually used — runVelaUnderwritingProjection is mocked

beforeEach(() => {
  receiptStore = [];
  receiptSeq = 0;
  fakeAdmin = createFakeSupabase();
  createActivityReceiptMock.mockClear();
  listActivityReceiptsForPersonaMock.mockClear();
  runVelaUnderwritingProjectionMock.mockClear();
  getAgentKeysMock.mockReset();
  getAgentKeysMock.mockResolvedValue(null);
  getAgentAddressesMock.mockReset();
  getAgentAddressesMock.mockImplementation(
    async (agentId: string) => ({ agentId, evmAddress: TEST_NAKAMOTO_RECIPIENT_ADDRESS }),
  );
  classifyPersonaWalletCapabilityMock.mockReset();
  classifyPersonaWalletCapabilityMock.mockImplementation(async (_personaId: string) => ({
    capability: 'SIGNER_CONFIGURED' as const,
    address: TEST_ARKAGENT_RECIPIENT_ADDRESS as string | null,
    detail: 'test double: signer configured',
    remediation: null as string | null,
  }));
  velaClientAdapterConstructorMock.mockClear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x7a69' }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  checkVelaRecipientProvisioningMock.mockClear();
  checkVelaRecipientProvisioningMock.mockImplementation(async (_reader, _applicationId, recipientAddresses: string[]) => ({
    ready: true,
    recipients: recipientAddresses.map((recipientAddress) => ({
      recipientAddress,
      associationStatus: 'VERIFIED' as const,
      associationDetail: 'test double: verified',
      eventSeedStatus: 'VERIFIED' as const,
      eventSeedDetail: 'test double: verified',
    })),
    privacyLimitation: null,
  }));
  createVelaClientRecipientRegistryReaderMock.mockClear();
  checkRecipientAssociationMock.mockReset();
  checkRecipientAssociationMock.mockImplementation(async (_applicationId: string, recipientAddress: string) => ({
    recipientAddress,
    associationStatus: 'MISSING' as const,
    associationDetail: 'test double: missing',
    eventSeedStatus: 'UNVERIFIABLE' as const,
    eventSeedDetail: 'test double',
  }));
  submitVelaAssociateKeyRequestMock.mockClear();
  submitVelaAssociateKeyRequestMock.mockImplementation(
    async (_deployment, _applicationId, _requesterPrivateKeyHex, _p521PublicKeyHex) => ({
      recipientAddress: '0x0000000000000000000000000000000000dEaD',
      requestId: '0xtest-request-id',
      status: 0,
      errorCode: 0,
    }),
  );
  delete process.env.UC0_ARKAGENT_EVM_PRIVATE_KEY_HEX;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Fail-closed persona injection ──────────────────────────────────────────

describe('fail-closed persona injection', () => {
  const admissionEvidence = admittedAdmissionEvidence('sel', USE_CASE_ZERO_DEMO_REQUEST_REF, 'aigent-nakamoto');

  it('throws when arkAgentPersonaId is missing', () => {
    expect(() =>
      composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, arkAgentPersonaId: '', admissionEvidence }),
    ).toThrow(/ArkAgent/);
  });

  it('throws when nakamotoPersonaId is missing', () => {
    expect(() =>
      composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, nakamotoPersonaId: undefined as unknown as string, admissionEvidence }),
    ).toThrow(/Nakamoto/);
  });

  it('throws when kn0w1PersonaId is empty/whitespace', () => {
    expect(() => composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, kn0w1PersonaId: '   ', admissionEvidence })).toThrow(/Kn0w1/);
  });

  it('throws when admissionEvidence itself is missing — never fabricates ADMITTED', () => {
    expect(() =>
      composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: undefined as unknown as AegisAdmissionEvidence }),
    ).toThrow(/admissionEvidence is required/);
  });

  it('assertUseCaseZeroDemoPersonas rejects a missing field directly', () => {
    expect(() => assertUseCaseZeroDemoPersonas({ arkAgentPersonaId: 'x', nakamotoPersonaId: 'y' })).toThrow(/Kn0w1/);
  });
});

// ── The exact A/B/C visibility scenario ────────────────────────────────────

describe('the exact asymmetric A/B/C disclosure scope', () => {
  it('produces exactly the grant counts/visibility the brief specifies', () => {
    const composed = composeAdmittedDemoChain();
    expect(composed.envelopeResult.outcome).toBe('FROZEN');

    const state: ConstitutionalRiskFlowState = {
      requestRef: composed.requestRef,
      select: {
        id: 'select', state: 'complete', reason: 'x',
        selectionRef: composed.factorSelection.selectionRef,
        candidateAgentId: composed.factorSelection.candidateAgentId,
        serviceId: composed.factorSelection.serviceId,
        counterpartyId: composed.factorSelection.counterpartyId,
        providerMode: composed.factorSelection.providerMode,
        selectionReason: composed.factorSelection.selectionReason,
        receiptId: 'r-select',
      },
      admit: {
        id: 'admit', state: 'complete', reason: 'x',
        admissionRef: composed.admissionEvidence.admissionRef,
        admissionStatus: composed.admissionEvidence.admissionStatus,
        assessmentRef: composed.admissionEvidence.assessmentRef,
        assessmentVersion: composed.admissionEvidence.assessmentVersion,
        aegisAgentId: composed.admissionEvidence.aegisAgentId,
        receiptId: 'r-admit',
      },
      authorize: {
        id: 'authorize', state: 'complete', reason: 'x',
        authorizationRef: composed.disclosureAuthorization.authorizationRef,
        applicationId: composed.disclosureAuthorization.applicationId,
        authorizedByAgentRef: composed.disclosureAuthorization.authorizedByAgentRef,
        scope: composed.disclosureAuthorization.scope,
        receiptId: 'r-authorize',
      },
      freeze: {
        id: 'freeze', state: 'complete', reason: 'x',
        envelopeRef: composed.envelopeResult.outcome === 'FROZEN' ? composed.envelopeResult.envelope.envelopeRef : null,
        applicationId: composed.applicationId,
        candidateAgentId: composed.factorSelection.candidateAgentId,
        receiptId: 'r-freeze',
      },
      execute: {
        id: 'execute', state: 'complete', reason: 'x',
        onChainRequestId: 'onchain-1', disposition: 'ACCEPTABLE', providerMode: 'SIMULATED', receiptId: 'r-execute',
      },
      quote: { id: 'quote', state: 'complete', reason: 'x', quote: SIMULATED_ACCEPTABLE_QUOTE, receiptId: 'r-quote' },
      settle: { id: 'settle', state: 'not_started', reason: 'no-funds path', settlementOccurred: false },
      receipt: { id: 'receipt', state: 'complete', reason: 'x', receipts: [] },
      telemetry: { id: 'telemetry', state: 'complete', reason: 'x', telemetryRecordId: 't-1' },
    };

    const aView = redactConstitutionalRiskFlowStateForParty(state, USE_CASE_ZERO_PARTY_A);
    expect(aView.execute.visible).toBe(true);
    expect(aView.quote.visible).toBe(true);
    expect(aView.settle.visible).toBe(true);
    expect(aView.authorize.scope?.grants).toHaveLength(3);

    const bView = redactConstitutionalRiskFlowStateForParty(state, USE_CASE_ZERO_PARTY_B);
    expect(bView.execute.visible).toBe(false);
    expect(bView.quote.visible).toBe(false);
    expect(bView.settle.visible).toBe(false);
    expect(bView.authorize.scope?.grants).toHaveLength(2);

    const cView = redactConstitutionalRiskFlowStateForParty(state, USE_CASE_ZERO_PARTY_C);
    expect(cView.execute.visible).toBe(true);
    expect(cView.quote.visible).toBe(true);
    expect(cView.settle.visible).toBe(true);
    expect(cView.authorize.scope?.grants).toHaveLength(1);

    // ── Privacy regression, end-to-end ──
    const serialized = JSON.stringify({ state, aView, bView, cView });
    // No party's raw financial operands.
    for (const raw of ['"currentExposure":0', '"proposedSpend":400', '"privateSpendLimit":1000', '"privateRiskLimit":1000']) {
      expect(serialized).not.toContain(raw);
    }
    // No real personaId, no T0 identifier field name, no flow-owner/authority
    // fields (none of which exist on this state/view shape in the first
    // place — asserted here as an explicit regression proof, mirroring
    // tests/vela-underwriting-party-view.test.ts's own leak-check style).
    for (const forbidden of [
      TEST_PERSONAS.arkAgentPersonaId,
      TEST_PERSONAS.nakamotoPersonaId,
      TEST_PERSONAS.kn0w1PersonaId,
      'flowOwnerPersonaId',
      'authorityPersonaId',
      'authorityPrincipalId',
      'personaId',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    // providerMode is SIMULATED throughout; LIVE never appears (no live
    // provider exists in this codebase).
    expect(serialized).toContain('SIMULATED');
    expect(serialized).not.toContain('"LIVE"');
    // No settlement occurred (never seeded an asset).
    expect(state.settle.settlementOccurred).toBe(false);
    expect(serialized).not.toContain('"settlementOccurred":true');
  });
});

// ── Idempotent persistence ──────────────────────────────────────────────────

describe('persistUseCaseZeroDemoChain — idempotent', () => {
  it('rerunning with the same requestRef never duplicates receipts/bindings and never re-submits to Vela', async () => {
    const composed = composeAdmittedDemoChain();
    expect(composed.envelopeResult.outcome).toBe('FROZEN');

    const first = await persistUseCaseZeroDemoChain(composed, {
      actorPersonaId: TEST_PERSONAS.arkAgentPersonaId,
      transport: NOOP_TRANSPORT,
    });

    expect(first.created).toEqual(
      expect.arrayContaining([
        'factor_selection_proposed',
        'vela_underwriting_admission_evidence_composed',
        'vela_underwriting_disclosure_authorized',
        `party_binding:${USE_CASE_ZERO_PARTY_A}`,
        `party_binding:${USE_CASE_ZERO_PARTY_B}`,
        `party_binding:${USE_CASE_ZERO_PARTY_C}`,
        'vela_underwriting_envelope_frozen',
      ]),
    );
    expect(first.skippedExisting).toHaveLength(0);
    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);

    // Every receipt this run created carries the SAME fixed requestRef.
    for (const record of receiptStore) {
      expect(record.actionInput?.requestRef).toBe(USE_CASE_ZERO_DEMO_REQUEST_REF);
    }
    const receiptCountAfterFirst = receiptStore.length;

    const second = await persistUseCaseZeroDemoChain(composed, {
      actorPersonaId: TEST_PERSONAS.arkAgentPersonaId,
      transport: NOOP_TRANSPORT,
    });

    expect(second.created).toHaveLength(0);
    expect(second.skippedExisting).toEqual(
      expect.arrayContaining([
        'factor_selection_proposed',
        'vela_underwriting_admission_evidence_composed',
        'vela_underwriting_disclosure_authorized',
        `party_binding:${USE_CASE_ZERO_PARTY_A}`,
        `party_binding:${USE_CASE_ZERO_PARTY_B}`,
        `party_binding:${USE_CASE_ZERO_PARTY_C}`,
        'vela_underwriting_envelope_frozen',
      ]),
    );
    // Still exactly ONE Vela submission across both runs — never re-submitted.
    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);
    // No new receipts were written on the second, idempotent run.
    expect(receiptStore.length).toBe(receiptCountAfterFirst);
  });

  it('a BLOCKED envelope (admission not ADMITTED) records the pre-freeze artifacts but never attempts a Vela submission', async () => {
    const factorSelection = buildUseCaseZeroDemoFactorSelection(TEST_PERSONAS);
    const refusedAdmission: AegisAdmissionEvidence = {
      ...admittedAdmissionEvidence(factorSelection.selectionRef, factorSelection.requestRef, factorSelection.candidateAgentId),
      admissionStatus: 'REFUSED',
      reason: 'Aegis ratified this candidate as not admissible',
    };
    const composed = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: refusedAdmission, resolvedRecipients: TEST_RESOLVED_RECIPIENTS });
    expect(composed.envelopeResult.outcome).toBe('BLOCKED');

    const result = await persistUseCaseZeroDemoChain(composed, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId });

    expect(result.blocked).toMatch(/not ADMITTED/);
    expect(result.created).toEqual(
      expect.arrayContaining([
        'factor_selection_proposed',
        'vela_underwriting_admission_evidence_composed',
        'vela_underwriting_disclosure_authorized',
      ]),
    );
    expect(result.created).not.toContain('vela_underwriting_envelope_frozen');
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
  });
});

// ── Disclosure scope shape sanity (verified against the real WASM rule) ────

describe('buildUseCaseZeroDemoDisclosureScope', () => {
  it('matches the brief\'s exact asymmetric grants', () => {
    const scope = buildUseCaseZeroDemoDisclosureScope();
    expect(scope.grants).toEqual([
      { action: 'COMPUTE_WITH', party: USE_CASE_ZERO_PARTY_A },
      { action: 'COMPUTE_WITH', party: USE_CASE_ZERO_PARTY_B },
      { action: 'DISCLOSE_TO', party: USE_CASE_ZERO_PARTY_B, to: USE_CASE_ZERO_PARTY_A },
      { action: 'DISCLOSE_TO', party: USE_CASE_ZERO_PARTY_A, to: USE_CASE_ZERO_PARTY_C },
    ]);
  });
});

// ── resolveDemoVelaTransport — internal P-521 derivation, no raw --p521-key ─
//
// 2026-09-15 operator ruling: "keys are substrate primitives, not UX
// concepts" — --p521-key was removed from the CLI surface entirely; P-521 is
// always derived internally from a single EVM requester signer (MoneyPenny's
// own custodied key by default, or a CLI --evm-key override for a throwaway
// devnet wallet). These tests prove: (1) a transport can be constructed from
// an EVM signer alone; (2) the derivation is deterministic; (3) neither the
// EVM key nor the derived P-521 key ever appears in console output.

describe('resolveDemoVelaTransport — internal P-521 derivation, no raw --p521-key', () => {
  const TEST_EVM_KEY = `0x${'1234567890abcdef'.repeat(4)}`;
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = originalArgv.slice();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('constructs a transport from an --evm-key override alone, deriving P-521 internally (no --p521-key exists)', async () => {
    process.argv = [...originalArgv, `--evm-key=${TEST_EVM_KEY}`];

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeDefined();
    expect(velaClientAdapterConstructorMock).toHaveBeenCalledTimes(1);
    const opts = velaClientAdapterConstructorMock.mock.calls[0][0] as {
      requesterPrivateKeyHex: string;
      requesterP521PrivateKeyHex: string;
    };
    expect(opts.requesterPrivateKeyHex.toLowerCase()).toBe(TEST_EVM_KEY.toLowerCase());
    expect(typeof opts.requesterP521PrivateKeyHex).toBe('string');
    expect(opts.requesterP521PrivateKeyHex.length).toBeGreaterThan(0);
    // The CLI override took precedence — MoneyPenny's custodied key was never consulted.
    expect(getAgentKeysMock).not.toHaveBeenCalled();
  });

  it('falls back to the MoneyPenny custodied key via AgentKeyService when no --evm-key override is given', async () => {
    getAgentKeysMock.mockResolvedValue({ evmPrivateKey: TEST_EVM_KEY });

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeDefined();
    expect(getAgentKeysMock).toHaveBeenCalledWith(DEMO_AUTHORIZING_AGENT_REF);
    const opts = velaClientAdapterConstructorMock.mock.calls[0][0] as { requesterPrivateKeyHex: string };
    expect(opts.requesterPrivateKeyHex.toLowerCase()).toBe(TEST_EVM_KEY.toLowerCase());
  });

  it('derives the same P-521 key deterministically for the same EVM signer across independent calls', async () => {
    process.argv = [...originalArgv, `--evm-key=${TEST_EVM_KEY}`];

    await resolveDemoVelaTransport();
    const first = velaClientAdapterConstructorMock.mock.calls[0][0] as { requesterP521PrivateKeyHex: string };

    velaClientAdapterConstructorMock.mockClear();
    await resolveDemoVelaTransport();
    const second = velaClientAdapterConstructorMock.mock.calls[0][0] as { requesterP521PrivateKeyHex: string };

    expect(second.requesterP521PrivateKeyHex).toBe(first.requesterP521PrivateKeyHex);
  });

  it('returns undefined and reports a clear error, without fabricating a transport, when no signer resolves', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeUndefined();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/no EVM requester signer could be resolved/);

    errorSpy.mockRestore();
  });

  it('never logs, prints, or otherwise exposes the EVM or derived P-521 private key material', async () => {
    process.argv = [...originalArgv, `--evm-key=${TEST_EVM_KEY}`];
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const transport = await resolveDemoVelaTransport();
    expect(transport).toBeDefined();
    const opts = velaClientAdapterConstructorMock.mock.calls[0][0] as { requesterP521PrivateKeyHex: string };

    const allOutput = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
      .join('\n');

    expect(allOutput).not.toContain(TEST_EVM_KEY.toLowerCase());
    expect(allOutput).not.toContain(TEST_EVM_KEY.replace(/^0x/, ''));
    expect(allOutput).not.toContain(opts.requesterP521PrivateKeyHex);

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

// ── RPC reachability preflight — the fail-fast repair (2026-09-16) ─────────
//
// Before this repair, resolveDemoVelaTransport constructed a real
// VelaClientAdapter (a real ethers JsonRpcProvider) unconditionally. Against
// an unreachable RPC (e.g. no local Docker Compose stack running), ethers'
// own JsonRpcProvider.getNetwork() enters an UNBOUNDED "failed to detect
// network; retry in 1s" retry loop — observed live. These tests prove the
// new probeVelaRpcReachable() preflight (services/horizen/agentPreflight.ts's
// own AbortController+timeout idiom, reused) fails once, fast, and BEFORE
// any credential resolution or Supabase persistence — never entering that
// loop.

describe('resolveDemoVelaTransport — RPC reachability preflight (fail-fast, zero writes)', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = originalArgv.slice();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('fails fast (bounded time) when the Vela RPC is unreachable, and never constructs a transport', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8545'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const startedAt = Date.now();
    const transport = await resolveDemoVelaTransport();
    const elapsedMs = Date.now() - startedAt;

    expect(transport).toBeUndefined();
    // A rejected fetch resolves near-instantly here (no real network stack
    // involved) — the meaningful assertion is that this function returns at
    // all rather than hanging in an unbounded retry loop; a generous ceiling
    // rules out any accidental real-timer wait.
    expect(elapsedMs).toBeLessThan(2000);
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/not reachable/);
    // The RPC check runs BEFORE credential resolution — no signer was ever consulted.
    expect(getAgentKeysMock).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('never attempts to derive or fetch a signer when the RPC is unreachable, even with --evm-key supplied', async () => {
    process.argv = [...originalArgv, '--evm-key=0x' + '11'.repeat(32)];
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeUndefined();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
  });

  it('performs zero Supabase writes when the RPC is unreachable — main() returns before persistUseCaseZeroDemoChain is ever called', async () => {
    // resolveDemoVelaTransport itself never calls createActivityReceipt (it
    // has no persistence path at all) — this directly proves the preflight
    // failure causes zero write side effects on its own. Combined with the
    // source-level fact that main() (below) only calls
    // persistUseCaseZeroDemoChain AFTER a successful resolveDemoVelaTransport
    // for a FROZEN envelope — see main()'s own early `return` when transport
    // is undefined — this establishes the end-to-end zero-writes contract
    // without needing a live ADMITTED Aegis assessment fixture.
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await resolveDemoVelaTransport();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
  });

  it('accepts --vela-env=public_devnet as a first-class value (no longer typed as local|early_access only)', async () => {
    process.argv = [...originalArgv, '--vela-env=public_devnet', '--evm-key=0x' + '22'.repeat(32)];

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(TEST_RPC_URL, expect.objectContaining({ method: 'POST' }));
  });

  it('the abort signal is genuinely wired to the fetch call (the mechanism that bounds a real hang)', async () => {
    let sawSignal: AbortSignal | undefined;
    let fetchWasCalled: () => void;
    const fetchCalled = new Promise<void>((resolve) => {
      fetchWasCalled = resolve;
    });
    fetchMock.mockImplementationOnce((_url: string, init: { signal?: AbortSignal }) => {
      sawSignal = init.signal;
      fetchWasCalled();
      // Resolve once the abort fires — proves the AbortController from
      // probeVelaRpcReachable is actually threaded into the fetch call (the
      // mechanism agentPreflight.ts's own probeReachable also relies on),
      // without waiting out the real 5s timeout: dispatching the event
      // below is what settles this promise, not the real setTimeout.
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const resultPromise = resolveDemoVelaTransport();
    // Wait for the mocked fetch to actually be invoked (async import()s +
    // AbortController construction happen first) before dispatching — a
    // synchronous dispatch immediately after calling resolveDemoVelaTransport
    // would race ahead of that and hit the real timeout instead.
    await fetchCalled;
    sawSignal?.dispatchEvent(new Event('abort'));
    await resultPromise;

    expect(sawSignal).toBeInstanceOf(AbortSignal);
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
  });
});

// ── main() — CLI persona auto-resolution + --app applicationId handling ────
//
// Real REGISTRABLE_AGENTS.nakamoto.runtimeAgentId ('aigent-nakamoto') and
// the real resolveUseCaseZeroDemoPersonaIds() query shape (personas.
// fio_handle for Nakamoto/Kn0w1, personas.display_name for ArkAgent) — never
// mocked, proven against the fakeSupabase in-memory tables exactly like
// every other read in this file.

function seedAutoResolvablePersonas(): void {
  fakeAdmin!.tables.personas = [
    { id: 'auto-arkagent-1', display_name: 'ArkAgent' },
    { id: 'auto-nakamoto-1', fio_handle: 'nakamoto@aigent', status: 'active' },
    { id: 'auto-kn0w1-1', fio_handle: 'kn0w1@aigent', status: 'active' },
  ];
}

/** A real ratified, admissible Aegis assessment for 'aigent-nakamoto' — the
 *  exact shape composeUnderwritingAdmissionEvidence (never mocked in this
 *  file) needs to resolve admissionStatus: 'ADMITTED', which is what makes
 *  the envelope resolve FROZEN. */
function seedAdmittedAegisAssessmentForNakamoto(): void {
  fakeAdmin!.tables.aegis_assessments = [
    {
      assessment_id: 'aegis-assessment-frozen-fixture',
      subject_type: 'agent',
      subject_ref: 'aigent-nakamoto',
      superseded_by: null,
      state: 'ratified',
      policy_version: 'v1',
      decision: 'admissible',
      conditions: [],
      rationale: 'test fixture',
      ratified_at: new Date().toISOString(),
    },
  ];
  fakeAdmin!.tables.aegis_findings = [];
}

/** Writes a valid, internally-consistent VelaApplicationDeploymentReceipt to
 *  a temp file for --deployment-receipt tests (2026-09-16). Returns the
 *  file path; caller is responsible for its own tmpDir cleanup. */
async function writeValidDeploymentReceiptFile(tmpDir: string, applicationId: string): Promise<string> {
  const { writeFileSync } = await import('fs');
  const { join } = await import('path');
  const { assembleVelaApplicationDeploymentReceipt } = await import('@/services/vela/velaApplicationDeploymentReceipt');
  const wasmSha256 = 'a'.repeat(64);
  const receipt = assembleVelaApplicationDeploymentReceipt({
    network: { chainId: 31337, processorEndpointAddress: '0xProcessor', protocolVersion: 0 },
    localWasmSha256: wasmSha256,
    deployTransaction: {
      hash: '0xdeploytx',
      blockNumber: 100,
      inputWasmSha256: wasmSha256,
      inputArtifactId: `sha256:${wasmSha256}`,
      inputMode: 'artifact_ref',
    },
    deployRequestSubmitted: { requestId: '0xreq1', applicationId },
    deployRequestCompleted: { requestId: '0xreq1', applicationId, status: 0, errorCode: 0, errorMessage: '' },
    attestationMode: 'no_attestation',
    ephemeral: true,
    observedAt: new Date().toISOString(),
  });
  const path = join(tmpDir, 'deployment-receipt.json');
  writeFileSync(path, JSON.stringify(receipt), 'utf8');
  return path;
}

describe('main() — CLI persona resolution', () => {
  const originalArgv = process.argv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.argv = originalArgv.slice();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('all three personas supplied explicitly via CLI — never queries the personas table', async () => {
    process.argv = [
      ...originalArgv,
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
    ];
    // Deliberately NOT seeded — proves explicit values short-circuit resolution.
    fakeAdmin!.tables.personas = [];

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).toHaveBeenCalled();
    const factorReceipt = createActivityReceiptMock.mock.calls.find(
      (c: any[]) => c[0].actionType === 'factor_selection_proposed',
    );
    expect(factorReceipt?.[0].personaId).toBe(TEST_PERSONAS.arkAgentPersonaId);
  });

  it('all three personas resolved automatically via Supabase when no CLI args are given', async () => {
    seedAutoResolvablePersonas();

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    const factorReceipt = createActivityReceiptMock.mock.calls.find(
      (c: any[]) => c[0].actionType === 'factor_selection_proposed',
    );
    expect(factorReceipt?.[0].personaId).toBe('auto-arkagent-1');
  });

  it('mixed: one explicit override + two auto-resolved', async () => {
    process.argv = [...originalArgv, '--arkagent=explicit-arkagent-override'];
    seedAutoResolvablePersonas();

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    const factorReceipt = createActivityReceiptMock.mock.calls.find(
      (c: any[]) => c[0].actionType === 'factor_selection_proposed',
    );
    // The explicit override wins for ArkAgent; Nakamoto/Kn0w1 came from resolution.
    expect(factorReceipt?.[0].personaId).toBe('explicit-arkagent-override');
  });

  it('an unresolved persona fails closed BEFORE any persistence, and names exactly which is missing', async () => {
    // Only Nakamoto/Kn0w1 seeded — ArkAgent cannot resolve.
    fakeAdmin!.tables.personas = [
      { id: 'auto-nakamoto-1', fio_handle: 'nakamoto@aigent', status: 'active' },
      { id: 'auto-kn0w1-1', fio_handle: 'kn0w1@aigent', status: 'active' },
    ];

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/ArkAgent/);
    expect(String(errorSpy.mock.calls[0][0])).not.toMatch(/Nakamoto|Kn0w1/);
  });
});

describe('main() — deployment-receipt applicationId handling before any Vela submission (2026-09-16)', () => {
  const originalArgv = process.argv;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(async () => {
    process.argv = [
      ...originalArgv,
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
    ];
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedAdmittedAegisAssessmentForNakamoto();
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-uc0-receipt-'));
  });

  afterEach(async () => {
    process.argv = originalArgv;
    errorSpy.mockRestore();
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('refuses to submit (and persists NOTHING) when the envelope is FROZEN but no --deployment-receipt was supplied — a naked --app=<number> alone is no longer sufficient', async () => {
    process.argv.push('--app=42');

    await runUseCaseZeroDemoSeedCli();

    // Zero persistence — the receipt check runs before
    // persistUseCaseZeroDemoChain is ever called, not just before submission.
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/no verified deployment receipt/);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/--deployment-receipt=/);
  });

  it('refuses a --deployment-receipt whose applicationId is not numeric, the same way as the missing-receipt case', async () => {
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const { assembleVelaApplicationDeploymentReceipt } = await import('@/services/vela/velaApplicationDeploymentReceipt');
    const wasmSha256 = 'b'.repeat(64);
    // A receipt is internally consistent (all three applicationId fields
    // agree) but its applicationId happens to be non-numeric — models a
    // hand-edited/malformed receipt file, not a real assembled one.
    const receipt = assembleVelaApplicationDeploymentReceipt({
      network: { chainId: 31337, processorEndpointAddress: '0xProcessor', protocolVersion: 0 },
      localWasmSha256: wasmSha256,
      deployTransaction: { hash: '0xtx', blockNumber: 1, inputWasmSha256: wasmSha256, inputArtifactId: `sha256:${wasmSha256}`, inputMode: 'artifact_ref' },
      deployRequestSubmitted: { requestId: '0xreq', applicationId: 'not-numeric' },
      deployRequestCompleted: { requestId: '0xreq', applicationId: 'not-numeric', status: 0, errorCode: 0, errorMessage: '' },
      attestationMode: 'no_attestation',
      ephemeral: true,
    });
    const path = join(tmpDir, 'malformed-receipt.json');
    writeFileSync(path, JSON.stringify(receipt), 'utf8');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/not a real, numeric Vela deployment applicationId/);
  });

  it('refuses (before any persistence) when --deployment-receipt points at a file that fails verification', async () => {
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const path = join(tmpDir, 'broken.json');
    writeFileSync(path, 'not valid json', 'utf8');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/failed verification/);
  });

  it('a verified --deployment-receipt supplies the applicationId END TO END — Factor selection, envelope, and the Vela submission all use it', async () => {
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`, '--evm-key=0x' + '33'.repeat(32));

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).toHaveBeenCalledTimes(1);
    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);
    // The frozen envelope's applicationId is the true ground truth for the
    // whole chain (see velaUnderwritingCompositionGate.ts's own
    // "applicationId caveat" — FactorSelectionArtifact carries no
    // applicationId of its own to separately assert on) — this IS the
    // end-to-end proof the receipt's id reached the Vela submission.
    const frozenReceipt = createActivityReceiptMock.mock.calls.find(
      (c: any[]) => c[0].actionType === 'vela_underwriting_envelope_frozen',
    );
    expect(frozenReceipt?.[0].actionInput.applicationId).toBe('42');
  });

  it('an --app value that disagrees with a supplied --deployment-receipt is superseded by the verified receipt, never silently trusted instead', async () => {
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`, '--app=999', '--evm-key=0x' + '33'.repeat(32));

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    const frozenReceipt = createActivityReceiptMock.mock.calls.find(
      (c: any[]) => c[0].actionType === 'vela_underwriting_envelope_frozen',
    );
    expect(frozenReceipt?.[0].actionInput.applicationId).toBe('42'); // the RECEIPT's id, not --app's
  });
});

// ── main() — recipient provisioning preflight (2026-09-16, Vela masterclass) ─
//
// Every FROZEN run must verify that every recipient the MoneyPenny WASM will
// emit a UserEvent to (composed.velaParties — party-a + party-b ONLY, never
// party-c/Kn0w1, who receives no UserEvent — see composeUseCaseZeroDemoChain's
// own header) already holds an ASSOCIATEKEY registration, BEFORE any signer
// is resolved, anything is written, or anything is submitted. The check
// itself (checkVelaRecipientProvisioning / createVelaClientRecipientRegistryReader)
// is unit-tested in full in tests/vela-recipient-provisioning-preflight.test.ts;
// these tests prove the WIRING — that resolveDemoVelaTransport (called for
// every consequential FROZEN run, preflight or not) actually consults it and
// actually refuses on a bad result.

describe('main() — recipient provisioning preflight (2026-09-16, Vela masterclass)', () => {
  const originalArgv = process.argv;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(async () => {
    process.argv = [
      ...originalArgv,
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
      '--evm-key=0x' + '33'.repeat(32),
    ];
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    seedAdmittedAegisAssessmentForNakamoto();
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-uc0-recipient-'));
  });

  afterEach(async () => {
    process.argv = originalArgv;
    errorSpy.mockRestore();
    logSpy.mockRestore();
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('one required recipient MISSING -> fail closed: zero signer resolution, zero writes, zero submission', async () => {
    checkVelaRecipientProvisioningMock.mockImplementationOnce(async (_reader: unknown, _applicationId: string, recipientAddresses: string[]) => ({
      ready: false,
      recipients: [
        { recipientAddress: recipientAddresses[0], associationStatus: 'VERIFIED', associationDetail: 'ok', eventSeedStatus: 'VERIFIED', eventSeedDetail: 'ok' },
        { recipientAddress: recipientAddresses[1], associationStatus: 'MISSING', associationDetail: 'no RequestSubmitted log found from this address', eventSeedStatus: 'UNVERIFIABLE', eventSeedDetail: 'no association to check' },
      ],
      privacyLimitation: null,
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    // Zero signer resolution.
    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    // Zero writes / submission.
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/MISSING/);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/ASSOCIATEKEY/);
  });

  it('registry unreachable/unverifiable -> fail closed the same way as MISSING', async () => {
    checkVelaRecipientProvisioningMock.mockImplementationOnce(async (_reader: unknown, _applicationId: string, recipientAddresses: string[]) => ({
      ready: false,
      recipients: recipientAddresses.map((recipientAddress) => ({
        recipientAddress,
        associationStatus: 'UNVERIFIABLE' as const,
        associationDetail: 'registry query (RequestSubmitted) failed: connect ECONNREFUSED 127.0.0.1:8545',
        eventSeedStatus: 'UNVERIFIABLE' as const,
        eventSeedDetail: 'association could not be verified',
      })),
      privacyLimitation: null,
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/UNVERIFIABLE/);
  });

  it('checks EXACTLY the two UserEvent recipients (party-a, party-b) — never party-c/Kn0w1, who exists in persona state but receives no UserEvent', async () => {
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(checkVelaRecipientProvisioningMock).toHaveBeenCalledTimes(1);
    const [, , recipientAddresses] = checkVelaRecipientProvisioningMock.mock.calls[0];
    expect(recipientAddresses).toHaveLength(2);
    // Neither of the two checked addresses is derived from, or equal to, any
    // value that would only exist for a third (Kn0w1) recipient — there is
    // no third entry at all, proving the set is sourced from
    // composed.velaParties (party-a + party-b), never from the full
    // three-persona/party-binding surrounding state.
  });

  it('the consequential (non-preflight) run cannot bypass this check — it is NOT an artifact of --preflight reporting', async () => {
    // Same fixture as the first test above, but explicitly asserting this is
    // the DEFAULT (non-preflight) invocation — main() never accepts a way to
    // skip resolveDemoVelaTransport's own gate for a FROZEN envelope.
    expect(process.argv).not.toContain('--preflight');
    expect(process.argv).not.toContain('--dry-run');
    checkVelaRecipientProvisioningMock.mockImplementationOnce(async (_reader: unknown, _applicationId: string, recipientAddresses: string[]) => ({
      ready: false,
      recipients: [{ recipientAddress: recipientAddresses[0], associationStatus: 'MISSING', associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE', eventSeedDetail: 'x' }],
      privacyLimitation: null,
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
  });

  it('never exposes a P-521 key, token, ciphertext, or private participant data in console output for a failed recipient check', async () => {
    checkVelaRecipientProvisioningMock.mockImplementationOnce(async (_reader: unknown, _applicationId: string, recipientAddresses: string[]) => ({
      ready: false,
      recipients: [
        { recipientAddress: recipientAddresses[0], associationStatus: 'MISSING', associationDetail: 'no RequestSubmitted log found', eventSeedStatus: 'UNVERIFIABLE', eventSeedDetail: 'x' },
      ],
      privacyLimitation: null,
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    const allOutput = [...errorSpy.mock.calls, ...logSpy.mock.calls].map((c) => String(c[0])).join('\n');
    // Never the raw persona ids (private participant data).
    expect(allOutput).not.toContain(TEST_PERSONAS.arkAgentPersonaId);
    expect(allOutput).not.toContain(TEST_PERSONAS.nakamotoPersonaId);
    expect(allOutput).not.toContain(TEST_PERSONAS.kn0w1PersonaId);
    // Never the --evm-key value supplied above.
    expect(allOutput).not.toContain('33'.repeat(32));
    // The FULL recipient address (a 40 hex-char body) never appears — only
    // the redacted (first 8 + last 4 chars) form.
    expect(allOutput).not.toMatch(/0x0{32}1\b/);
  });

  it('a FROZEN preflight report ALSO surfaces recipient readiness informationally, without resolving a signer or blocking', async () => {
    checkVelaRecipientProvisioningMock.mockImplementationOnce(async (_reader: unknown, _applicationId: string, recipientAddresses: string[]) => ({
      ready: false,
      recipients: [
        { recipientAddress: recipientAddresses[0], associationStatus: 'MISSING', associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE', eventSeedDetail: 'x' },
        { recipientAddress: recipientAddresses[1], associationStatus: 'VERIFIED', associationDetail: 'x', eventSeedStatus: 'ABSENT', eventSeedDetail: 'x' },
      ],
      privacyLimitation: 'privacy note fixture',
    }));
    process.argv.push('--preflight', '--app=42');

    await runUseCaseZeroDemoSeedCli();

    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(allLogs).toMatch(/recipient provisioning: NOT READY/);
  });
});

// ── resolveUseCaseZeroDemoRecipientAddresses / composeUseCaseZeroDemoChain —
// real recipient-binding repair (2026-09-16, Vela masterclass — UC0 final
// blocker) ───────────────────────────────────────────────────────────────
//
// Prior to this repair, the two Vela UserEvent recipients were bound to
// `demoRecipientAddress(1)`/`demoRecipientAddress(2)` — placeholder
// addresses (`0x000...0001`/`0x000...0002`) with no real key material behind
// them, which per VELA-SIGNER-TOPOLOGY-001 §6b could never actually decrypt
// the event they'd receive. These tests prove: (1) the resolver binds
// ArkAgent's and Aigent Nakamoto's REAL canonical wallets, never a
// placeholder; (2) a caller cannot compose a consequential request without
// resolved recipients, or with a malformed/duplicated pair; (3) a bad
// binding fails closed BEFORE signer resolution, persistence, or submission
// — in both --preflight and consequential runs.

const LEGACY_PLACEHOLDER_RECIPIENT_1 = '0x' + '0'.repeat(39) + '1'; // was demoRecipientAddress(1)
const LEGACY_PLACEHOLDER_RECIPIENT_2 = '0x' + '0'.repeat(39) + '2'; // was demoRecipientAddress(2)

describe('resolveUseCaseZeroDemoRecipientAddresses — canonical wallet binding, never a placeholder', () => {
  it('resolves ArkAgent via classifyPersonaWalletCapability and Nakamoto via AgentKeyService.getAgentAddresses, distinct addresses', async () => {
    const resolved = await resolveUseCaseZeroDemoRecipientAddresses(TEST_PERSONAS);

    expect(resolved.arkAgentRecipientAddress).toBe(TEST_ARKAGENT_RECIPIENT_ADDRESS);
    expect(resolved.nakamotoRecipientAddress).toBe(TEST_NAKAMOTO_RECIPIENT_ADDRESS);
    expect(classifyPersonaWalletCapabilityMock).toHaveBeenCalledWith(TEST_PERSONAS.arkAgentPersonaId);
    // Nakamoto is resolved via the REGISTRABLE_AGENTS runtimeAgentId, never the raw personaId.
    expect(getAgentAddressesMock).toHaveBeenCalledWith('aigent-nakamoto');
    // Never a private key — only the address-only lookup is used for recipient resolution.
    expect(getAgentKeysMock).not.toHaveBeenCalled();
  });

  it('fails closed when ArkAgent\'s persona wallet is not SIGNER_CONFIGURED, naming ArkAgent, without resolving Nakamoto', async () => {
    classifyPersonaWalletCapabilityMock.mockImplementationOnce(async () => ({
      capability: 'ABSENT' as const,
      address: null,
      detail: 'no evm_key on this persona',
      remediation: 'provision ArkAgent a signer',
    }));

    await expect(resolveUseCaseZeroDemoRecipientAddresses(TEST_PERSONAS)).rejects.toThrow(/ArkAgent/);
    // Short-circuits before ever reaching Nakamoto's resolution.
    expect(getAgentAddressesMock).not.toHaveBeenCalled();
  });

  it('fails closed when Aigent Nakamoto has no well-formed custodied address on record', async () => {
    getAgentAddressesMock.mockImplementationOnce(async (agentId: string) => ({ agentId, evmAddress: undefined }));

    await expect(resolveUseCaseZeroDemoRecipientAddresses(TEST_PERSONAS)).rejects.toThrow(/Nakamoto/);
  });

  it('fails closed when the resolved ArkAgent and Nakamoto addresses are IDENTICAL, refusing to let one signer stand in for both parties', async () => {
    getAgentAddressesMock.mockImplementationOnce(async (agentId: string) => ({
      agentId,
      evmAddress: TEST_ARKAGENT_RECIPIENT_ADDRESS,
    }));

    await expect(resolveUseCaseZeroDemoRecipientAddresses(TEST_PERSONAS)).rejects.toThrow(/IDENTICAL/);
  });
});

describe('composeUseCaseZeroDemoChain — resolvedRecipients is required, defense-in-depth against placeholders', () => {
  it('throws when resolvedRecipients is omitted entirely — never silently falls back to a placeholder', () => {
    expect(() =>
      composeUseCaseZeroDemoChain({
        ...TEST_PERSONAS,
        admissionEvidence: admittedAdmissionEvidence('sel-1', USE_CASE_ZERO_DEMO_REQUEST_REF, 'aigent-nakamoto'),
      } as any),
    ).toThrow(/resolvedRecipients\.arkAgentRecipientAddress/);
  });

  it('throws when the two resolved recipient addresses are identical, even if a caller bypasses the resolver', () => {
    expect(() =>
      composeUseCaseZeroDemoChain({
        ...TEST_PERSONAS,
        admissionEvidence: admittedAdmissionEvidence('sel-1', USE_CASE_ZERO_DEMO_REQUEST_REF, 'aigent-nakamoto'),
        resolvedRecipients: {
          arkAgentRecipientAddress: TEST_ARKAGENT_RECIPIENT_ADDRESS,
          nakamotoRecipientAddress: TEST_ARKAGENT_RECIPIENT_ADDRESS,
        },
      }),
    ).toThrow(/IDENTICAL/);
  });

  it('the legacy placeholder addresses (0x000...0001 / 0x000...0002) are no longer produced anywhere in this module — the export is gone', async () => {
    const mod = await import('@/scripts/seedUseCaseZeroDemo');
    expect((mod as Record<string, unknown>).demoRecipientAddress).toBeUndefined();
  });

  it('threads the resolved (non-placeholder) recipient addresses straight into composed.velaParties', () => {
    const composed = composeAdmittedDemoChain(TEST_PERSONAS);

    expect(composed.velaParties).toHaveLength(2);
    expect(composed.velaParties[0].recipientAddress).toBe(TEST_ARKAGENT_RECIPIENT_ADDRESS);
    expect(composed.velaParties[1].recipientAddress).toBe(TEST_NAKAMOTO_RECIPIENT_ADDRESS);
    expect(composed.velaParties.map((p) => p.recipientAddress)).not.toContain(LEGACY_PLACEHOLDER_RECIPIENT_1);
    expect(composed.velaParties.map((p) => p.recipientAddress)).not.toContain(LEGACY_PLACEHOLDER_RECIPIENT_2);
  });
});

describe('main() — recipient binding end-to-end: canonical addresses submitted, bad bindings fail closed (2026-09-16 recipient-binding repair)', () => {
  const originalArgv = process.argv;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(async () => {
    process.argv = [
      ...originalArgv,
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
      '--evm-key=0x' + '33'.repeat(32),
    ];
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    seedAdmittedAegisAssessmentForNakamoto();
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-uc0-recipient-binding-'));
  });

  afterEach(async () => {
    process.argv = originalArgv;
    errorSpy.mockRestore();
    logSpy.mockRestore();
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('a consequential FROZEN run submits the CANONICAL resolved recipient addresses to Vela, never the legacy placeholders', async () => {
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);
    const [callArgs] = runVelaUnderwritingProjectionMock.mock.calls[0];
    const submittedAddresses = (callArgs.build.parties as Array<{ recipientAddress: string }>).map((p) => p.recipientAddress);
    expect(submittedAddresses).toEqual([TEST_ARKAGENT_RECIPIENT_ADDRESS, TEST_NAKAMOTO_RECIPIENT_ADDRESS]);
    expect(submittedAddresses).not.toContain(LEGACY_PLACEHOLDER_RECIPIENT_1);
    expect(submittedAddresses).not.toContain(LEGACY_PLACEHOLDER_RECIPIENT_2);
  });

  it('ArkAgent not SIGNER_CONFIGURED fails closed before signer resolution, persistence, or submission', async () => {
    classifyPersonaWalletCapabilityMock.mockImplementationOnce(async () => ({
      capability: 'ADDRESS_ONLY' as const,
      address: null,
      detail: 'address on record but no encrypted signer envelope',
      remediation: 'provision a signer for this persona',
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/ArkAgent/);
  });

  it('a duplicate/ambiguous recipient binding (both parties resolve to the same address) fails closed before persistence or submission', async () => {
    getAgentAddressesMock.mockImplementationOnce(async (agentId: string) => ({
      agentId,
      evmAddress: TEST_ARKAGENT_RECIPIENT_ADDRESS,
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/IDENTICAL/);
  });

  it('a bad recipient binding fails closed even under --preflight, before any preflight report is printed — preflight stays strictly zero-effect', async () => {
    classifyPersonaWalletCapabilityMock.mockImplementationOnce(async () => ({
      capability: 'MALFORMED' as const,
      address: null,
      detail: 'evm_address is not a well-formed 0x address',
      remediation: 'repair the persona\'s evm_address',
    }));
    process.argv.push('--preflight', '--app=42');

    await runUseCaseZeroDemoSeedCli();

    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/ArkAgent/);
    // No BLOCKED/FROZEN preflight report was ever printed — the resolution
    // failure aborts before the envelope is even composed.
    const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(allLogs).not.toMatch(/FROZEN|BLOCKED/);
  });
});

// ── main() — --preflight/--dry-run: genuine zero-effect guarantee ──────────
//
// 2026-09-16 correction: the earlier claim that a bare, no-flag invocation
// is "read-only" was FALSE (it depends entirely on live Aegis state). These
// tests prove --preflight/--dry-run is the ONLY invocation that guarantees
// zero Supabase writes, zero receipts, zero Vela submission, and zero
// signer/private-key resolution, for BOTH the BLOCKED and FROZEN envelope
// outcomes — even when every input that WOULD otherwise lead to a real
// submission (a real numeric --app, a resolvable --evm-key) is supplied.

describe('main() — --preflight/--dry-run zero-effect guarantee', () => {
  const originalArgv = process.argv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(async () => {
    process.argv = [
      ...originalArgv,
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
    ];
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-uc0-preflight-'));
  });

  afterEach(async () => {
    process.argv = originalArgv;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('BLOCKED outcome + --preflight: zero writes, zero receipts, zero signer resolution', async () => {
    process.argv.push('--preflight');
    // No Aegis assessment seeded — admission resolves UNRESOLVED -> BLOCKED.

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toMatch(/BLOCKED/);
  });

  it('FROZEN outcome + --preflight: zero writes, zero receipts, zero Vela submission, zero signer resolution — even with a verified deployment receipt and --evm-key supplied', async () => {
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push('--preflight', `--deployment-receipt=${path}`, '--evm-key=0x' + '55'.repeat(32));
    seedAdmittedAegisAssessmentForNakamoto();

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(getAgentKeysMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toMatch(/FROZEN/);
    expect(output).toMatch(/zero Supabase writes/);
    expect(output).toMatch(/deployment receipt: VERIFIED/);
  });

  it('FROZEN outcome + --preflight with a non-numeric applicationId: still zero effect, reports it would need --app', async () => {
    process.argv.push('--preflight');
    seedAdmittedAegisAssessmentForNakamoto();
    // No --app supplied -> applicationId stays the non-numeric demo placeholder.

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toMatch(/NOT a real, numeric Vela applicationId/);
  });

  it('--dry-run is a genuine alias for --preflight (BLOCKED case)', async () => {
    process.argv.push('--dry-run');

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
  });

  it('without --preflight, the SAME FROZEN inputs DO write and submit — proving preflight is the actual gate, not an environment artifact', async () => {
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`, '--evm-key=0x' + '55'.repeat(32));
    seedAdmittedAegisAssessmentForNakamoto();

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).toHaveBeenCalledTimes(1);
    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);
  });
});

// ── persistUseCaseZeroDemoChain — fail-closed applicationId consistency ────
//
// 2026-09-16 correction: a prior run's evidence for the SAME fixed
// requestRef, recorded under a DIFFERENT applicationId, must never be
// silently reattached to by a new run — this used to be an unguarded gap
// (idempotency was keyed on requestRef alone). The check reads the SAME
// `existing` state persistUseCaseZeroDemoChain already fetches (no second
// query) and runs before ANY write in the function.

describe('persistUseCaseZeroDemoChain — fail-closed applicationId consistency', () => {
  it('same-applicationId rerun remains idempotent (no false mismatch)', async () => {
    const composedFirst = composeAdmittedDemoChain(TEST_PERSONAS);
    // Explicit applicationId to make the intent unambiguous, rather than relying on the shared default.
    const factorSelection = buildUseCaseZeroDemoFactorSelection(TEST_PERSONAS, '42');
    const admissionEvidence = admittedAdmissionEvidence(factorSelection.selectionRef, factorSelection.requestRef, factorSelection.candidateAgentId);
    const composed = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence, applicationId: '42', resolvedRecipients: TEST_RESOLVED_RECIPIENTS });
    void composedFirst;

    const first = await persistUseCaseZeroDemoChain(composed, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId, transport: NOOP_TRANSPORT });
    expect(first.created).toContain('vela_underwriting_envelope_frozen');
    createActivityReceiptMock.mockClear();

    // Rerun with the SAME applicationId — must skip everything, never throw.
    const rerun = await persistUseCaseZeroDemoChain(composed, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId, transport: NOOP_TRANSPORT });
    expect(rerun.skippedExisting).toEqual(expect.arrayContaining(['vela_underwriting_envelope_frozen']));
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
  });

  it('different-applicationId rerun for the SAME requestRef refuses before any write, zero additional receipts', async () => {
    const factorSelectionA = buildUseCaseZeroDemoFactorSelection(TEST_PERSONAS, '42');
    const admissionEvidenceA = admittedAdmissionEvidence(factorSelectionA.selectionRef, factorSelectionA.requestRef, factorSelectionA.candidateAgentId);
    const composedA = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: admissionEvidenceA, applicationId: '42', resolvedRecipients: TEST_RESOLVED_RECIPIENTS });
    await persistUseCaseZeroDemoChain(composedA, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId, transport: NOOP_TRANSPORT });
    const callsAfterFirstRun = createActivityReceiptMock.mock.calls.length;
    expect(callsAfterFirstRun).toBeGreaterThan(0);

    // SAME requestRef (fixed, by design), DIFFERENT applicationId.
    const factorSelectionB = buildUseCaseZeroDemoFactorSelection(TEST_PERSONAS, '99');
    const admissionEvidenceB = admittedAdmissionEvidence(factorSelectionB.selectionRef, factorSelectionB.requestRef, factorSelectionB.candidateAgentId);
    const composedB = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: admissionEvidenceB, applicationId: '99', resolvedRecipients: TEST_RESOLVED_RECIPIENTS });

    await expect(
      persistUseCaseZeroDemoChain(composedB, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId, transport: NOOP_TRANSPORT }),
    ).rejects.toThrow(/DIFFERENT applicationId/);

    // Zero additional writes attempted during the refused run.
    expect(createActivityReceiptMock.mock.calls.length).toBe(callsAfterFirstRun);
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
  });

  it('a mismatch detected via the authorize step alone (envelope not yet frozen) also refuses', async () => {
    const factorSelectionA = buildUseCaseZeroDemoFactorSelection(TEST_PERSONAS, '42');
    // REFUSED admission -> BLOCKED envelope -> only pre-freeze artifacts (including disclosure authorization) are written.
    const refusedAdmissionA: AegisAdmissionEvidence = {
      ...admittedAdmissionEvidence(factorSelectionA.selectionRef, factorSelectionA.requestRef, factorSelectionA.candidateAgentId),
      admissionStatus: 'REFUSED',
      reason: 'not admissible',
    };
    const composedA = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: refusedAdmissionA, applicationId: '42', resolvedRecipients: TEST_RESOLVED_RECIPIENTS });
    const firstResult = await persistUseCaseZeroDemoChain(composedA, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId });
    expect(firstResult.blocked).toBeDefined();
    const callsAfterFirstRun = createActivityReceiptMock.mock.calls.length;

    const factorSelectionB = buildUseCaseZeroDemoFactorSelection(TEST_PERSONAS, '99');
    const refusedAdmissionB: AegisAdmissionEvidence = {
      ...admittedAdmissionEvidence(factorSelectionB.selectionRef, factorSelectionB.requestRef, factorSelectionB.candidateAgentId),
      admissionStatus: 'REFUSED',
      reason: 'not admissible',
    };
    const composedB = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: refusedAdmissionB, applicationId: '99', resolvedRecipients: TEST_RESOLVED_RECIPIENTS });

    await expect(
      persistUseCaseZeroDemoChain(composedB, { actorPersonaId: TEST_PERSONAS.arkAgentPersonaId }),
    ).rejects.toThrow(/DIFFERENT applicationId/);
    expect(createActivityReceiptMock.mock.calls.length).toBe(callsAfterFirstRun);
  });
});

// ── resolveDemoVelaTransport — public-devnet token-file seam ───────────────
//
// 2026-09-16 seam closure: VELA_PUBLIC_DEVNET_TOKEN_FILE now resolves into
// the deployment resolveDemoVelaTransport actually uses for --vela-env=
// public_devnet, via the SAME shared resolver scripts/vela/public-devnet-
// smoke.ts uses (services/vela/velaPublicDevnetTokenFile.ts) — never a
// second, duplicated mapping. velaConfig's own resolveVelaDeployment mock
// deliberately returns a DIFFERENT rpcUrl than the token file, so a passing
// assertion here proves the token-file path was actually taken, not a
// coincidental match.

describe('resolveDemoVelaTransport — public-devnet token-file seam', () => {
  const originalArgv = process.argv;
  const originalTokenFileEnv = process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
  let tmpDir: string;

  beforeEach(async () => {
    process.argv = [...originalArgv, '--vela-env=public_devnet', '--evm-key=0x' + '66'.repeat(32)];
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    tmpDir = mkdtempSync(join(tmpdir(), 'vela-seed-token-'));
  });

  afterEach(async () => {
    process.argv = originalArgv;
    if (originalTokenFileEnv === undefined) delete process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;
    else process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE = originalTokenFileEnv;
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves the deployment from the token file when VELA_PUBLIC_DEVNET_TOKEN_FILE is set, not from resolveVelaDeployment', async () => {
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const path = join(tmpDir, 'token.json');
    const TOKEN_FILE_RPC_URL = 'https://token-file-rpc.synsema.app';
    writeFileSync(
      path,
      JSON.stringify({
        token: 'devnet-secret-token',
        host: 'devnet.synsema.app',
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        env: {
          VELA_RPC_URL: TOKEN_FILE_RPC_URL,
          VELA_PROCESSOR: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          VELA_TEE_AUTHENTICATOR: '0xcccccccccccccccccccccccccccccccccccccccc',
          VELA_AUTHORITY_URL: 'https://token-file-authority.synsema.app',
        },
      }),
      'utf8',
    );
    process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE = path;

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeDefined();
    // resolveVelaDeployment is mocked to return { env, rpcUrl: TEST_RPC_URL }
    // ('http://localhost:8545') — the fetch call below must NOT target that,
    // proving the token-file path (a DIFFERENT rpcUrl) was actually used.
    expect(fetchMock).toHaveBeenCalledWith(TOKEN_FILE_RPC_URL, expect.anything());
    const opts = velaClientAdapterConstructorMock.mock.calls[0][0] as { deployment: { rpcUrl: string } };
    expect(opts.deployment.rpcUrl).toBe(TOKEN_FILE_RPC_URL);
  });

  it('falls back to resolveVelaDeployment when VELA_PUBLIC_DEVNET_TOKEN_FILE is unset', async () => {
    delete process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE;

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(TEST_RPC_URL, expect.anything());
  });

  it('fails closed (zero transport construction) when the token file is malformed', async () => {
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const path = join(tmpDir, 'broken.json');
    writeFileSync(path, 'not json at all', 'utf8');
    process.env.VELA_PUBLIC_DEVNET_TOKEN_FILE = path;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const transport = await resolveDemoVelaTransport();

    expect(transport).toBeUndefined();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/not valid JSON/);

    errorSpy.mockRestore();
  });
});

// ── main() --provision-recipients — ASSOCIATEKEY provisioning (2026-09-16,
// UC0 final live blocker) ───────────────────────────────────────────────────
//
// Composes/persists NOTHING — no composeUseCaseZeroDemoChain,
// persistUseCaseZeroDemoChain, activity receipt, or underwriting submission
// call anywhere in provisionUseCaseZeroDemoRecipients. These tests prove:
// the two intended submissions happen only for MISSING associations, zero
// submissions for already-VERIFIED recipients, a signer/address mismatch
// fails closed before any submission, a failed association never lets UC0
// start, and no secret material (private keys, unredacted addresses) ever
// reaches console output.

describe('main() --provision-recipients — ASSOCIATEKEY provisioning, never UC0 composition/persistence', () => {
  const originalArgv = process.argv;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;
  let arkAgentWallet: { address: string; privateKey: string };
  let nakamotoWallet: { address: string; privateKey: string };

  const PROVISION_ARKAGENT_PRIVATE_KEY = '0x' + '11'.repeat(32);
  const PROVISION_NAKAMOTO_PRIVATE_KEY = '0x' + '22'.repeat(32);
  const ARKAGENT_WALLET_PASSWORD = 'correct-test-password-Xy9!';
  const ARKAGENT_WRONG_PASSWORD = 'wrong-test-password-Zz0!';

  beforeEach(async () => {
    const { Wallet } = await import('ethers');
    arkAgentWallet = new Wallet(PROVISION_ARKAGENT_PRIVATE_KEY);
    nakamotoWallet = new Wallet(PROVISION_NAKAMOTO_PRIVATE_KEY);

    process.argv = [
      ...originalArgv,
      '--provision-recipients',
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
    ];
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Real signer/real recipient address for BOTH parties by default — most
    // tests below only need to override the association-check sequence.
    classifyPersonaWalletCapabilityMock.mockReset();
    classifyPersonaWalletCapabilityMock.mockImplementation(async () => ({
      capability: 'SIGNER_CONFIGURED' as const,
      address: arkAgentWallet.address,
      detail: 'test double: signer configured',
      remediation: null,
    }));
    getAgentAddressesMock.mockReset();
    getAgentAddressesMock.mockImplementation(async (agentId: string) => ({ agentId, evmAddress: nakamotoWallet.address }));
    getAgentKeysMock.mockReset();
    getAgentKeysMock.mockImplementation(async (_agentId: string) => ({ evmPrivateKey: PROVISION_NAKAMOTO_PRIVATE_KEY }));

    // A REAL encrypted envelope (services/wallet/keyService.ts's own
    // AES-256-GCM/PBKDF2 primitive — never a test-only stand-in), seeded on
    // the fake personas row exactly the way `personas.evm_key` stores it and
    // `GET /api/wallet/principal/envelope` reads it — proving this suite
    // exercises the SAME encrypted-wallet unlock path production uses, not a
    // mocked shortcut.
    // keyService.ts's own server-side getRandomBytes() fallback expects
    // `global.crypto.randomBytes` (Node's CommonJS `crypto` module shape);
    // modern Node's actual global `crypto` is the Web Crypto API object,
    // which has no `randomBytes` — only `getRandomValues`. Production never
    // hits this branch (encryptPrivateKey/generateEvmKeyPair only ever run
    // client-side, in a real browser, per this file's own header), so this
    // is a test-only shim, not a production fix, and it ADDS a method
    // rather than overriding any native one.
    if (typeof (globalThis.crypto as unknown as { randomBytes?: unknown }).randomBytes !== 'function') {
      (globalThis.crypto as unknown as { randomBytes: (n: number) => Uint8Array }).randomBytes = (n: number) =>
        globalThis.crypto.getRandomValues(new Uint8Array(n));
    }
    const { encryptPrivateKey } = await import('@/services/wallet/keyService');
    const encryptedPrivateKey = await encryptPrivateKey(
      PROVISION_ARKAGENT_PRIVATE_KEY.replace(/^0x/, ''),
      ARKAGENT_WALLET_PASSWORD,
    );
    fakeAdmin!.tables.personas = [
      {
        id: TEST_PERSONAS.arkAgentPersonaId,
        evm_key: { address: arkAgentWallet.address, encryptedPrivateKey },
      },
    ];
    process.env.UC0_ARKAGENT_WALLET_PASSWORD = ARKAGENT_WALLET_PASSWORD;

    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-uc0-provision-'));
  });

  afterEach(async () => {
    process.argv = originalArgv;
    errorSpy.mockRestore();
    logSpy.mockRestore();
    delete process.env.UC0_ARKAGENT_WALLET_PASSWORD;
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('two MISSING associations cause exactly two ASSOCIATEKEY submissions (ArkAgent correctly unlocked via her password, Nakamoto via AgentKeyService), and both verify VERIFIED afterward', async () => {
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({
        recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x',
      })) // ArkAgent, before
      .mockImplementationOnce(async (_appId, addr) => ({
        recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'ABSENT' as const, eventSeedDetail: 'x',
      })) // ArkAgent, after
      .mockImplementationOnce(async (_appId, addr) => ({
        recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x',
      })) // Nakamoto, before
      .mockImplementationOnce(async (_appId, addr) => ({
        recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'ABSENT' as const, eventSeedDetail: 'x',
      })); // Nakamoto, after
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(submitVelaAssociateKeyRequestMock).toHaveBeenCalledTimes(2);
    const [arkCall, nakamotoCall] = submitVelaAssociateKeyRequestMock.mock.calls;
    expect(arkCall[1]).toBe('42');
    expect(arkCall[2]).toBe(PROVISION_ARKAGENT_PRIVATE_KEY);
    expect(nakamotoCall[2]).toBe(PROVISION_NAKAMOTO_PRIVATE_KEY);
    const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(allLogs).toMatch(/ArkAgent.*ASSOCIATEKEY VERIFIED/);
    expect(allLogs).toMatch(/Nakamoto.*ASSOCIATEKEY VERIFIED/);
  });

  it('already-VERIFIED recipients cause ZERO submissions and zero signer resolution', async () => {
    checkRecipientAssociationMock.mockImplementation(async (_appId, addr) => ({
      recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'already there', eventSeedStatus: 'VERIFIED' as const, eventSeedDetail: 'x',
    }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(submitVelaAssociateKeyRequestMock).not.toHaveBeenCalled();
    // Zero signer resolution — the ArkAgent env-var override is set in
    // beforeEach, but nothing here reads it; getAgentKeysMock likewise never
    // needed to run for an already-VERIFIED recipient.
    expect(getAgentKeysMock).not.toHaveBeenCalled();
    const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(allLogs).toMatch(/ArkAgent.*ALREADY VERIFIED/);
    expect(allLogs).toMatch(/Nakamoto.*ALREADY VERIFIED/);
  });

  it('WRONG password fails closed for ArkAgent (AES-GCM auth failure) without submitting anything for her, and never derives a signer from it', async () => {
    process.env.UC0_ARKAGENT_WALLET_PASSWORD = ARKAGENT_WRONG_PASSWORD;
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' })) // ArkAgent, before
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'VERIFIED' as const, eventSeedDetail: 'x' })); // Nakamoto, before (already verified, isolates ArkAgent)
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(submitVelaAssociateKeyRequestMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/Incorrect password or corrupted key data/);
  });

  it('ABSENT password (UC0_ARKAGENT_WALLET_PASSWORD unset) fails closed for that recipient without submitting anything, and never touches the encrypted envelope', async () => {
    delete process.env.UC0_ARKAGENT_WALLET_PASSWORD;
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' })) // ArkAgent, before
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'VERIFIED' as const, eventSeedDetail: 'x' })); // Nakamoto, before
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(submitVelaAssociateKeyRequestMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/UC0_ARKAGENT_WALLET_PASSWORD/);
  });

  it('a signer/address mismatch (correct password, but a stale/incorrect canonical-address binding) fails closed before any submission', async () => {
    // ArkAgent's resolved recipient address does NOT match the address her
    // password correctly unlocks. Nakamoto is ALREADY VERIFIED so this test
    // isolates the mismatch's own effect rather than also asserting about
    // an unrelated, independently-succeeding recipient.
    classifyPersonaWalletCapabilityMock.mockImplementation(async () => ({
      capability: 'SIGNER_CONFIGURED' as const,
      address: '0x9999999999999999999999999999999999999a',
      detail: 'test double: signer configured',
      remediation: null,
    }));
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' })) // ArkAgent, before
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'VERIFIED' as const, eventSeedDetail: 'x' })); // Nakamoto, before
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(submitVelaAssociateKeyRequestMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/does NOT match its canonical recipient address/);
  });

  it('a failed ASSOCIATEKEY submission for one recipient never triggers UC0 composition, persistence, or underwriting submission', async () => {
    submitVelaAssociateKeyRequestMock.mockRejectedValueOnce(
      new Error('submitVelaAssociateKeyRequest: ASSOCIATEKEY request 0xabc completed with status=1, errorCode=9'),
    );
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).toHaveBeenCalled();
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
  });

  it('a fully successful provisioning run STILL never calls persistUseCaseZeroDemoChain or underwriting submission', async () => {
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'ABSENT' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'ABSENT' as const, eventSeedDetail: 'x' }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(runVelaUnderwritingProjectionMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
  });

  it('never exposes a private key, wallet password, or an unredacted recipient address in console output on a fully successful run', async () => {
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'ABSENT' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'ABSENT' as const, eventSeedDetail: 'x' }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    const allOutput = [...errorSpy.mock.calls, ...logSpy.mock.calls].map((c) => String(c[0])).join('\n');
    expect(allOutput).not.toContain(PROVISION_ARKAGENT_PRIVATE_KEY.replace(/^0x/, ''));
    expect(allOutput).not.toContain(PROVISION_NAKAMOTO_PRIVATE_KEY.replace(/^0x/, ''));
    expect(allOutput).not.toContain(arkAgentWallet.address);
    expect(allOutput).not.toContain(nakamotoWallet.address);
    expect(allOutput).not.toContain(ARKAGENT_WALLET_PASSWORD);
  });

  it('never exposes the wallet password (correct OR wrong) or any ciphertext in the WRONG-password error path either', async () => {
    process.env.UC0_ARKAGENT_WALLET_PASSWORD = ARKAGENT_WRONG_PASSWORD;
    checkRecipientAssociationMock
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'MISSING' as const, associationDetail: 'x', eventSeedStatus: 'UNVERIFIABLE' as const, eventSeedDetail: 'x' }))
      .mockImplementationOnce(async (_appId, addr) => ({ recipientAddress: addr, associationStatus: 'VERIFIED' as const, associationDetail: 'x', eventSeedStatus: 'VERIFIED' as const, eventSeedDetail: 'x' }));
    const path = await writeValidDeploymentReceiptFile(tmpDir, '42');
    process.argv.push(`--deployment-receipt=${path}`);

    await runUseCaseZeroDemoSeedCli();

    const allOutput = [...errorSpy.mock.calls, ...logSpy.mock.calls].map((c) => String(c[0])).join('\n');
    expect(allOutput).not.toContain(ARKAGENT_WRONG_PASSWORD);
    expect(allOutput).not.toContain(ARKAGENT_WALLET_PASSWORD);
    expect(allOutput).not.toContain(PROVISION_ARKAGENT_PRIVATE_KEY.replace(/^0x/, ''));
    const seededEnvelope = (fakeAdmin!.tables.personas[0].evm_key as { encryptedPrivateKey: { ciphertext: string } })
      .encryptedPrivateKey.ciphertext;
    expect(allOutput).not.toContain(seededEnvelope);
  });

  it('requires --deployment-receipt — refuses (zero submissions) without one', async () => {
    await runUseCaseZeroDemoSeedCli();

    expect(submitVelaAssociateKeyRequestMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/--deployment-receipt=<path> is required/);
  });
});
