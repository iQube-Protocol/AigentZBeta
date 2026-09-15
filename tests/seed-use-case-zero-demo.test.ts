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
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: vi.fn().mockImplementation(() => ({
    getAgentKeys: (...args: any[]) => getAgentKeysMock(...(args as [string])),
  })),
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
  main as runUseCaseZeroDemoSeedCli,
  type UseCaseZeroDemoPersonas,
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
  return composeUseCaseZeroDemoChain({ ...personas, admissionEvidence });
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
  velaClientAdapterConstructorMock.mockClear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x7a69' }),
  }));
  vi.stubGlobal('fetch', fetchMock);
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
    const composed = composeUseCaseZeroDemoChain({ ...TEST_PERSONAS, admissionEvidence: refusedAdmission });
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

describe('main() — --app applicationId handling before any Vela submission', () => {
  const originalArgv = process.argv;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.argv = [
      ...originalArgv,
      `--arkagent=${TEST_PERSONAS.arkAgentPersonaId}`,
      `--nakamoto=${TEST_PERSONAS.nakamotoPersonaId}`,
      `--kn0w1=${TEST_PERSONAS.kn0w1PersonaId}`,
    ];
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedAdmittedAegisAssessmentForNakamoto();
  });

  afterEach(() => {
    process.argv = originalArgv;
    errorSpy.mockRestore();
  });

  it('refuses to submit (and persists NOTHING) when the envelope is FROZEN but --app was never supplied', async () => {
    await runUseCaseZeroDemoSeedCli();

    // Zero persistence — the applicationId check runs before
    // persistUseCaseZeroDemoChain is ever called, not just before submission.
    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/applicationId/);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/--app=/);
  });

  it('refuses a non-numeric --app value the same way as the missing case', async () => {
    process.argv.push('--app=not-a-real-application-id');

    await runUseCaseZeroDemoSeedCli();

    expect(createActivityReceiptMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/applicationId/);
  });

  it('proceeds through to a real Vela submission once a real numeric --app and a signer are both supplied', async () => {
    process.argv.push('--app=42', '--evm-key=0x' + '33'.repeat(32));

    await runUseCaseZeroDemoSeedCli();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(velaClientAdapterConstructorMock).toHaveBeenCalledTimes(1);
    expect(runVelaUnderwritingProjectionMock).toHaveBeenCalledTimes(1);
    const frozenReceipt = createActivityReceiptMock.mock.calls.find(
      (c: any[]) => c[0].actionType === 'vela_underwriting_envelope_frozen',
    );
    expect(frozenReceipt?.[0].actionInput.applicationId).toBe('42');
  });
});
