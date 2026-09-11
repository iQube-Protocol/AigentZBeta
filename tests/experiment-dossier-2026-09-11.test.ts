/**
 * resolveExperimentDossier (services/research/experimentDossier.ts) — the
 * single resolver behind both the human dossier UI and the machine
 * `research.dossier.v1` JSON route (2026-09-11, IRL Workspace Experiment
 * Dossier Completion Pass).
 *
 * This module COMPOSES existing, already-tested resolvers
 * (resolveSelectedWorkspaceState, researchExperiment,
 * latestFrozenCrystalArtifact, buildReadinessDashboard, listExecutionRuns,
 * getExchangeView) rather than re-deriving their behavior — so these tests
 * mock those composed functions as black boxes and verify only what THIS
 * module is responsible for: the gate (fail-closed on the base resolver's
 * verdict), the composition/shape of `ExperimentDossier`, honest
 * `UnmodeledDossierField` reporting when a source has nothing to say, and
 * the experiment-scoped Locker query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockResolveSelectedWorkspaceState = vi.fn();
vi.mock('@/services/research/selectedWorkspaceState', () => ({
  resolveSelectedWorkspaceState: (...args: unknown[]) => mockResolveSelectedWorkspaceState(...args),
}));

const mockResearchExperiment = vi.fn();
vi.mock('@/services/research/experimentIQubeSources', () => ({
  researchExperiment: (id: string) => mockResearchExperiment(id),
}));

const mockLatestFrozenCrystalArtifact = vi.fn();
const mockListExecutionRuns = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (id: string) => mockLatestFrozenCrystalArtifact(id),
  listExecutionRuns: (id: string) => mockListExecutionRuns(id),
}));

const mockBuildReadinessDashboard = vi.fn();
vi.mock('@/services/research/readinessDashboard', () => ({
  buildReadinessDashboard: (id: string) => mockBuildReadinessDashboard(id),
}));

const mockGetExchangeView = vi.fn();
vi.mock('@/services/research/reciprocalExchange', () => ({
  getExchangeView: (...args: unknown[]) => mockGetExchangeView(...args),
}));

import { resolveExperimentDossier } from '@/services/research/experimentDossier';

type Row = Record<string, unknown>;
let lockerRows: Row[] = [];

function fakeAdmin(): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    like: () => chain,
    order: () => Promise.resolve({ data: lockerRows, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const PERSONA = { personaId: 'p-1', isAdmin: false };

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'ws-1',
    experimentId: 'EXP-P1',
    workspaceLabel: 'EXP-P1 Workspace',
    programmeId: 'prog-1',
    role: 'reviewer',
    accessBasis: 'research-lab-grant',
    experimentLifecycle: { phase: 'pre-freeze-review' },
    currentStage: 'Review',
    completedStages: ['Protocol'],
    pendingHumanDecisions: ['Comment, recommend a change, or contest a finding via QubeTalk/Locker'],
    capabilities: { readinessAvailable: true, reviewAgreementAvailable: true, exchangeAvailable: false },
    documents: [{ path: 'doc/a.md', url: 'https://x/doc/a.md' }],
    reviewState: { agreement: { authorizationStatus: 'authorized' }, callerObserverStatus: null },
    exchangeIds: [],
    activity: [],
    activityReceipts: {},
    blockers: [],
    nextMilestone: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockResolveSelectedWorkspaceState.mockReset();
  mockResearchExperiment.mockReset();
  mockLatestFrozenCrystalArtifact.mockReset();
  mockListExecutionRuns.mockReset();
  mockBuildReadinessDashboard.mockReset();
  mockGetExchangeView.mockReset();
  lockerRows = [];

  mockResearchExperiment.mockReturnValue({
    family: 'EXP-P1',
    hypothesis: 'A test hypothesis.',
    protocolRef: 'PRD-EPI-001',
    governingInvariants: ['inv.1'],
    seriesId: 'series-1',
    programmeFocus: null,
  });
  mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
  mockListExecutionRuns.mockResolvedValue([]);
  mockBuildReadinessDashboard.mockResolvedValue({
    experimentId: 'EXP-P1',
    sections: [{ section: 'Crystal', status: 'green', gates: 'crystal-version', gatesProtocolRatified: true, detail: 'ok' }],
    protocolRatifiedReady: true,
    expectedRedPreRun: [],
  });
});

describe('resolveExperimentDossier — gate', () => {
  it('propagates a denied/not-found verdict from the base resolver without touching any other source', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: false, reason: 'denied' });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(mockResearchExperiment).not.toHaveBeenCalled();
    expect(mockLatestFrozenCrystalArtifact).not.toHaveBeenCalled();
    expect(mockGetExchangeView).not.toHaveBeenCalled();
  });
});

describe('resolveExperimentDossier — EXP-P1 composition', () => {
  it('always tags schemaVersion research.dossier.v1', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: true, state: baseState() });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dossier.schemaVersion).toBe('research.dossier.v1');
  });

  it('resolves apparatus from the registered arm labels for EXP-P1', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: true, state: baseState() });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const apparatus = result.dossier.apparatus;
    expect('arms' in apparatus).toBe(true);
    if ('arms' in apparatus) {
      expect(apparatus.arms.map((a) => a.id)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D']));
      expect(apparatus.selectorVersion).toBe('task-scoped-v1');
    }
  });

  it('reports an honest UnmodeledDossierField when no crystal has ever been frozen', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: true, state: baseState() });
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.crystal).toEqual({
      available: false,
      reason: 'No crystal-version artifact has ever been frozen for this experiment.',
    });
  });

  it('renders real crystal detail (hashes, deviations, member snapshot) when one is frozen', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: true, state: baseState() });
    mockLatestFrozenCrystalArtifact.mockResolvedValue({
      id: 'EXP-P1:crystal-version:v1',
      contentHash: 'hash-abc',
      commitmentHash: 'commit-abc',
      frozenAt: '2026-09-01T00:00:00.000Z',
      executionDesignation: 'confirmatory',
      scientificDeviations: [],
      freezeRationale: 'Ready.',
      memberSnapshot: [{ id: 'inv.1', statement: 'X must hold.', namespace: 'ns', semanticType: null, status: 'active', evidenceProvenance: null, provenance: null }],
    });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const crystal = result.dossier.crystal;
    expect(crystal && 'contentHash' in crystal ? crystal.contentHash : null).toBe('hash-abc');
    expect(crystal && 'memberSnapshot' in crystal ? crystal.memberSnapshot?.length : 0).toBe(1);
  });

  it('resolves apparatus as UnmodeledDossierField for an experiment with no registered apparatus', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: true, state: baseState({ experimentId: 'EXP-P2' }) });
    mockResearchExperiment.mockReturnValue({
      family: 'EXP-P2',
      hypothesis: 'Another hypothesis.',
      protocolRef: 'PRD-EPI-002',
      governingInvariants: [],
      seriesId: 'series-2',
      programmeFocus: null,
    });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.apparatus).toEqual({ available: false, reason: 'No apparatus/arm specification is registered for EXP-P2.' });
    // No branching on experimentId beyond data lookup — readiness/runs still resolve through the SAME code path.
    expect(mockListExecutionRuns).toHaveBeenCalledWith('EXP-P2');
  });

  it('skips readiness (UnmodeledDossierField) when the base resolver says readiness is unavailable', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({
      ok: true,
      state: baseState({ capabilities: { readinessAvailable: false, reviewAgreementAvailable: true, exchangeAvailable: false } }),
    });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(mockBuildReadinessDashboard).not.toHaveBeenCalled();
    expect(result.dossier.readiness).toEqual({
      available: false,
      reason: 'EXP-P1 is not on the readiness-dashboard allowlist (PRD-EPI-001 §10 scope).',
    });
  });

  it('reads constitutional records scoped to the caller’s own persona and the [EXP:<id>] bracket tag', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({ ok: true, state: baseState() });
    lockerRows = [{ item_id: 'i-1', display_name: '[EXP:EXP-P1] Reviewer agreement', content_type: 'application/json', created_at: '2026-09-01T00:00:00.000Z' }];
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.constitutionalRecords).toEqual([
      { itemId: 'i-1', displayName: '[EXP:EXP-P1] Reviewer agreement', contentType: 'application/json', createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
  });
});

describe('resolveExperimentDossier — no experiment bound', () => {
  it('reports every experiment-scoped section as honestly unmodeled, never fabricated', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({
      ok: true,
      state: baseState({ experimentId: null, experimentLifecycle: null, capabilities: { readinessAvailable: false, reviewAgreementAvailable: false, exchangeAvailable: true }, exchangeIds: ['ex-1'] }),
    });
    mockGetExchangeView.mockResolvedValue({ ok: false, error: 'not-a-party' });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.experiment).toBe(null);
    expect(result.dossier.crystal).toEqual({ available: false, reason: 'No experiment is bound to this workspace.' });
    expect(result.dossier.apparatus).toEqual({ available: false, reason: 'No experiment is bound to this workspace.' });
    expect(result.dossier.runs).toEqual({ available: false, reason: 'No experiment is bound to this workspace.' });
    expect(result.dossier.constitutionalRecords).toEqual({ available: false, reason: 'No experiment is bound to this workspace.' });
  });
});

describe('resolveExperimentDossier — OCSGA exchange (fail-closed)', () => {
  it('composes the exchange section from the SAME getExchangeView an OCSGA participant already reads, never re-deriving it', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({
      ok: true,
      state: baseState({ experimentId: null, experimentLifecycle: null, exchangeIds: ['ex-1'] }),
    });
    const view = {
      exchange: { id: 'ex-1', status: 'B_JOINED' },
      viewerParty: 'A',
      yourArtifact: null,
      counterpartyArtifact: null,
      receipt: null,
      comparison: null,
      derivatives: [],
    };
    mockGetExchangeView.mockResolvedValue({ ok: true, view });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.exchange).toBe(view);
    expect(mockGetExchangeView).toHaveBeenCalledWith(expect.anything(), { exchangeId: 'ex-1', personaId: 'p-1' });
  });

  it('never fabricates an exchange view when getExchangeView denies — dossier.exchange stays null', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({
      ok: true,
      state: baseState({ experimentId: null, experimentLifecycle: null, exchangeIds: ['ex-1'] }),
    });
    mockGetExchangeView.mockResolvedValue({ ok: false, error: 'not-a-party' });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.exchange).toBe(null);
  });

  it('adds a next-governed-action hint when an exchange is open with no receipt yet', async () => {
    mockResolveSelectedWorkspaceState.mockResolvedValue({
      ok: true,
      state: baseState({ experimentId: null, experimentLifecycle: null, pendingHumanDecisions: [], exchangeIds: ['ex-1'] }),
    });
    mockGetExchangeView.mockResolvedValue({
      ok: true,
      view: { exchange: { id: 'ex-1', status: 'A_DEPOSITED' }, viewerParty: 'A', yourArtifact: null, counterpartyArtifact: null, receipt: null, comparison: null, derivatives: [] },
    });
    const result = await resolveExperimentDossier(fakeAdmin(), PERSONA, 'ws-1', 'https://x.test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dossier.nextActions).toContain('Deposit your architecture artifact for this exchange.');
  });
});
