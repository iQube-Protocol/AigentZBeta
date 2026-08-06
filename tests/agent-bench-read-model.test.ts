/**
 * `buildAgentBenchRow` (2026-08-05 "Agent Bench — Canonical Agent Lifecycle
 * Brief"). Pins: a registrable-agent-only subject (no Marketa candidate —
 * Aigent Nakamoto's real shape) projects real facts with no fabrication;
 * `runtimeMemberships` is a collection, never a single scalar; a real
 * registrable-agent-derived identity wins over a Marketa candidate's own
 * (steward-entered) fields; and `lifecycleState` stays a single canonical
 * value derived from those memberships plus admission facts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolveAgentAdmissionState = vi.fn();
vi.mock('@/services/journey/agentAdmissionState', () => ({
  resolveAgentAdmissionState: (...args: any[]) => mockResolveAgentAdmissionState(...args),
}));

const mockResolveAgentRegistrationState = vi.fn();
vi.mock('@/services/horizen/agentRegistrationBinding', () => ({
  resolveAgentRegistrationState: (...args: any[]) => mockResolveAgentRegistrationState(...args),
}));

const mockResolveRegistrableAgentByRuntimeId = vi.fn();
vi.mock('@/services/horizen/registrableAgents', () => ({
  resolveRegistrableAgentByRuntimeId: (...args: any[]) => mockResolveRegistrableAgentByRuntimeId(...args),
}));

const mockGetAsset = vi.fn();
vi.mock('@/services/registry/persistence', () => ({
  getAsset: (...args: any[]) => mockGetAsset(...args),
}));

const mockFindAgentReceiptRefs = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findAgentReceiptRefs: (...args: any[]) => mockFindAgentReceiptRefs(...args),
}));

const mockListAgreements = vi.fn();
vi.mock('@/services/constitutional/constitutionalAgreement', () => ({
  listAgreements: () => mockListAgreements(),
}));

import { buildAgentBenchRow } from '@/services/marketa/activation/agentBenchReadModel';

const NAKAMOTO_AGENT = {
  slug: 'nakamoto',
  displayName: 'Aigent Nakamoto',
  runtimeAgentId: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  agentCardPath: '/api/agents/nakamoto/agent-card.json',
  fioHandle: 'nakamoto@aigent',
};

const FULL_ADMISSION = {
  sponsorshipRecorded: true,
  delegatePassportIssued: true,
  delegationActive: true,
  factoryPresent: true,
  agentRootId: 'root-1',
  auditGaps: [],
};

beforeEach(() => {
  mockResolveAgentAdmissionState.mockReset();
  mockResolveAgentRegistrationState.mockReset();
  mockResolveRegistrableAgentByRuntimeId.mockReset();
  mockGetAsset.mockReset();
  mockFindAgentReceiptRefs.mockReset();
  mockFindAgentReceiptRefs.mockResolvedValue([]);
  mockListAgreements.mockReset();
  mockListAgreements.mockResolvedValue([]);
});

describe('buildAgentBenchRow — registrable-agent subject (Nakamoto shape)', () => {
  it('projects real facts with no fabrication when every condition holds — engaged, active membership', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue(FULL_ADMISSION);
    mockResolveAgentRegistrationState.mockResolvedValue({
      registered: true,
      tokenId: '8798',
      registryAgentId: '0x1a5e',
      network: 'base-sepolia',
      evidenceRefs: ['binding:aigentqube-nakamoto'],
      source: 'settled',
      settled: true,
      auditGaps: [],
    });
    mockGetAsset.mockResolvedValue({
      capabilities: [{ name: 'Financial Intelligence' }, { name: 'Treasury' }],
      publicationStatus: 'published',
      trustBand: 'verified',
    });
    mockFindAgentReceiptRefs.mockResolvedValue([
      { id: 'r1', actionType: 'horizen_pulse_authorized' },
      { id: 'r2', actionType: 'horizen_pnl_transparency_enabled' },
    ]);
    mockListAgreements.mockResolvedValue([
      { id: 'agr-1', agreementId: 'agr-1', displayLabel: 'Nakamoto FS agreement', status: 'authorized', selectedAgentRef: 'aigent-nakamoto', createdAt: '2026-08-01T00:00:00Z' },
    ]);

    const row = await buildAgentBenchRow({} as any, { kind: 'registrable-agent', agent: NAKAMOTO_AGENT }, { hasInvitation: false });

    expect(row.candidateId).toBe('aigent-nakamoto');
    expect(row.name).toBe('Aigent Nakamoto');
    expect(row.source).toBe('registrable-agent');
    expect(row.registryProvider).toBe('horizen');
    expect(row.registryNetwork).toBe('base-sepolia');
    expect(row.onChainAgentId).toBe('8798');
    expect(row.capabilities).toEqual(['Financial Intelligence', 'Treasury']);
    expect(row.overallPriorityScore).toBeNull(); // no Marketa scoring exists — never fabricated
    expect(row.registry).toEqual({ publicationStatus: 'published', trustBand: 'verified' });
    expect(row.pulseAuthorized).toBe(true);
    expect(row.pnlEnabled).toBe(true);
    expect(row.runtimeMemberships).toHaveLength(1);
    expect(row.runtimeMemberships[0]).toMatchObject({
      runtimeId: 'financial-services',
      status: 'active',
      activatedAt: '2026-08-01T00:00:00Z',
    });
    expect(row.runtimeMemberships[0].eligibility.outstanding).toEqual([]);
    expect(row.lifecycleState).toBe('engaged');
  });

  it('reports Service Ready even with Pulse/P&L outstanding — verify is optional, never an admission gate (operator ruling 2026-08-06)', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue(FULL_ADMISSION);
    mockResolveAgentRegistrationState.mockResolvedValue({
      registered: true,
      tokenId: '8798',
      registryAgentId: '0x1a5e',
      network: 'base-sepolia',
      evidenceRefs: [],
      source: 'settled',
      settled: true,
      auditGaps: [],
    });
    mockGetAsset.mockResolvedValue({ capabilities: [], publicationStatus: 'published', trustBand: 'verified' });
    mockFindAgentReceiptRefs.mockResolvedValue([]); // neither Pulse nor P&L authorized yet
    mockListAgreements.mockResolvedValue([]);

    const row = await buildAgentBenchRow({} as any, { kind: 'registrable-agent', agent: NAKAMOTO_AGENT }, { hasInvitation: false });

    expect(row.pulseAuthorized).toBe(false);
    expect(row.pnlEnabled).toBe(false);
    // Core admission (sponsorship, passport, delegation) + registry published
    // is sufficient — Pulse/P&L are the journey's optional `verify` stage and
    // must never gate Service Ready (2026-08-05 Agent Bench design §5/§7;
    // reasserted by the operator 2026-08-06 against a live Nakamoto row that
    // was passport-approved and registry-published but held out of Service
    // Ready solely for lacking Pulse/P&L — that was the defect, not the fix).
    expect(row.runtimeMemberships[0].status).toBe('approved');
    expect(row.runtimeMemberships[0].eligibility.satisfied).toContain('sponsorship recorded');
    // Still tracked and surfaced for transparency — just non-gating.
    expect(row.runtimeMemberships[0].eligibility.outstanding).toContain('Pulse authorized');
    expect(row.runtimeMemberships[0].eligibility.outstanding).toContain('P&L transparency enabled');
    expect(row.lifecycleState).toBe('service-ready');
  });

  it('surfaces a registration audit gap as an outstanding eligibility reason, never silently', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue(FULL_ADMISSION);
    mockResolveAgentRegistrationState.mockResolvedValue({
      registered: true,
      tokenId: '8798',
      registryAgentId: null,
      network: 'base-sepolia',
      evidenceRefs: [],
      source: 'receipt-reconstruction',
      settled: true,
      auditGaps: ["Horizen's human-readable page identifier was never returned for this registration"],
    });
    mockGetAsset.mockResolvedValue({ capabilities: [], publicationStatus: 'published', trustBand: 'verified' });
    mockFindAgentReceiptRefs.mockResolvedValue([
      { id: 'r1', actionType: 'horizen_pulse_authorized' },
      { id: 'r2', actionType: 'horizen_pnl_transparency_enabled' },
    ]);
    mockListAgreements.mockResolvedValue([]);

    const row = await buildAgentBenchRow({} as any, { kind: 'registrable-agent', agent: NAKAMOTO_AGENT }, { hasInvitation: false });

    expect(row.runtimeMemberships[0].eligibility.outstanding).toContain(
      "Horizen's human-readable page identifier was never returned for this registration",
    );
  });

  it('reports applying when admission facts resolved but none has landed yet — never not-applied once a real read succeeded', async () => {
    mockResolveAgentAdmissionState.mockResolvedValue({
      sponsorshipRecorded: false,
      delegatePassportIssued: false,
      delegationActive: false,
      factoryPresent: false,
      agentRootId: null,
      auditGaps: [],
    });
    mockResolveAgentRegistrationState.mockResolvedValue({
      registered: false,
      tokenId: null,
      registryAgentId: null,
      network: null,
      evidenceRefs: [],
      source: 'unresolved',
      settled: false,
      auditGaps: ['no registration binding could be resolved from the projection, receipts or the chain'],
    });
    mockGetAsset.mockResolvedValue(null);
    mockListAgreements.mockResolvedValue([]);

    const row = await buildAgentBenchRow({} as any, { kind: 'registrable-agent', agent: NAKAMOTO_AGENT }, { hasInvitation: false });

    expect(row.registryProvider).toBeNull();
    expect(row.registry).toBeNull();
    // The admission read itself succeeded (a real object came back, all facts
    // false rather than undefined) — that is "applying," not "not-applied":
    // not-applied is reserved for when there is no admission read to examine
    // at all (see the Marketa-fallback describe block below).
    expect(row.runtimeMemberships[0].status).toBe('applying');
    expect(row.lifecycleState).toBe('candidate');
  });
});

describe('buildAgentBenchRow — Marketa-candidate subject with no registrable-agent link', () => {
  const CANDIDATE = {
    id: 'cand-1',
    name: 'Example Candidate',
    capabilities: ['Research'],
    scores: { overallPriorityScore: 42 },
    registryProvider: 'horizen' as const,
    registryNetwork: 'base-sepolia',
    onChainAgentId: '999',
    runtimeAgentId: undefined,
  };

  it('falls back to the candidate’s own fields — no registrableAgent, no admission, no fabricated runtime membership', async () => {
    mockResolveRegistrableAgentByRuntimeId.mockReturnValue(null);
    mockListAgreements.mockResolvedValue([]);

    const row = await buildAgentBenchRow({} as any, { kind: 'marketa', candidate: CANDIDATE as any }, { hasInvitation: true });

    expect(mockResolveAgentAdmissionState).not.toHaveBeenCalled();
    expect(row.admission).toBeNull();
    expect(row.registryProvider).toBe('horizen');
    expect(row.onChainAgentId).toBe('999');
    expect(row.capabilities).toEqual(['Research']);
    expect(row.overallPriorityScore).toBe(42);
    expect(row.runtimeMemberships).toEqual([]);
    expect(row.lifecycleState).toBe('invited'); // no admission started, but has an invitation
  });
});
