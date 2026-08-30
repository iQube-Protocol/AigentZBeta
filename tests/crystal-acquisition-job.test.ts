/**
 * Crystal v2 targeted acquisition (`services/research/crystalAcquisitionJob.ts`,
 * 2026-08-30, "turn Discover Sources into a precise Copilot authorization").
 *
 * Every collaborator (corpus-scout discovery, registry verification,
 * provenance, lifecycle receipts) is mocked so the properties under test —
 * the single-active-approval invariant, the bounded one-institution-per-step
 * contract, and the exhausted/remaining bookkeeping — are observable
 * independent of network access or a real Supabase instance. The admin
 * Supabase client itself is a minimal chainable stub, not a real client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/services/corpusScout/domainConstitution', () => ({
  getDomainConstitution: vi.fn(),
}));
vi.mock('@/services/corpusScout/registryVerification', () => ({
  canRunInstitutionDiscovery: vi.fn(),
}));
vi.mock('@/services/corpusScout/discoveryOrchestrator', () => ({
  runDiscoveryForInstitution: vi.fn(),
}));
vi.mock('@/services/corpusScout/provenance', () => ({
  listCandidateSources: vi.fn(),
}));
vi.mock('@/services/research/lifecycle', () => ({
  writeLifecycleReceipt: vi.fn(),
}));

import { getDomainConstitution } from '@/services/corpusScout/domainConstitution';
import { canRunInstitutionDiscovery } from '@/services/corpusScout/registryVerification';
import { runDiscoveryForInstitution } from '@/services/corpusScout/discoveryOrchestrator';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import {
  getActiveAcquisitionApproval,
  approveAcquisitionJob,
  completeAcquisitionJob,
  runOneAcquisitionStep,
} from '@/services/research/crystalAcquisitionJob';
import type { CrystalAcquisitionBrief } from '@/services/research/crystalAcquisitionBrief';

const mGetDomainConstitution = vi.mocked(getDomainConstitution);
const mCanRun = vi.mocked(canRunInstitutionDiscovery);
const mRunDiscovery = vi.mocked(runDiscoveryForInstitution);
const mListCandidateSources = vi.mocked(listCandidateSources);
const mWriteLifecycleReceipt = vi.mocked(writeLifecycleReceipt);

/** A minimal chainable Supabase query-builder stub. Every call in
 *  crystalAcquisitionJob.ts is a straight-line `.from(TABLE).<verb>(...).eq(...)...`
 *  chain, terminated either by `.maybeSingle()`/`.single()` or by awaiting the
 *  chain itself (JS `await` calls `.then` on whatever is returned) — this stub
 *  answers both from the SAME per-call queue, in the order the module code
 *  issues them, so each test only has to say what each successive call
 *  resolves to. */
function createMockAdmin(queue: Array<{ data: unknown; error: unknown }>) {
  let idx = 0;
  const next = () => queue[Math.min(idx++, queue.length - 1)] ?? { data: null, error: null };
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const record = (method: string, args: unknown[]) => calls.push({ method, args });

  const builder: Record<string, unknown> = {
    select: vi.fn((...args: unknown[]) => { record('select', args); return builder; }),
    eq: vi.fn((...args: unknown[]) => { record('eq', args); return builder; }),
    order: vi.fn((...args: unknown[]) => { record('order', args); return builder; }),
    limit: vi.fn((...args: unknown[]) => { record('limit', args); return builder; }),
    insert: vi.fn((...args: unknown[]) => { record('insert', args); return builder; }),
    update: vi.fn((...args: unknown[]) => { record('update', args); return builder; }),
    maybeSingle: vi.fn(async () => next()),
    single: vi.fn(async () => next()),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(next()).then(resolve, reject),
  };
  const admin = {
    from: vi.fn((table: string) => { record('from', [table]); return builder; }),
  } as unknown as SupabaseClient;
  return { admin, calls };
}

const BRIEF: CrystalAcquisitionBrief = {
  experimentId: 'EXP-P1',
  crystalGeneration: 'gen-1',
  domain: 'financial-risk-value-systems',
  readinessReportRef: { invariantCount: 11, generatedAt: '2026-08-30T00:00:00Z' },
  requiredNetNewDistinctMembers: 49,
  currentDistinctMemberCount: 11,
  minimumCollectionSize: 60,
  representedNamespaces: [],
  missingNamespaces: ['causal', 'conditional'],
  boundaryNamespaceCount: 13,
  requiredEntailmentChains: 5,
  currentEntailmentChainCount: 0,
  entailmentChainDeficit: 5,
  requiredRelationalMembersInSlice: 10,
  currentRelationalMemberCount: 0,
  deficientRelationalStructures: ['causal', 'conditional', 'threshold'],
  sourceAdmissibilityConstraints: ['ratified institutions/sources only'],
  alreadyAdmittedInvariantIds: [],
  structuralDiversityOpportunity: null,
  completionCriteria: [],
  generatedAt: '2026-08-30T00:00:00Z',
};

beforeEach(() => {
  mGetDomainConstitution.mockReset();
  mCanRun.mockReset();
  mRunDiscovery.mockReset();
  mListCandidateSources.mockReset();
  mWriteLifecycleReceipt.mockReset();
});

describe('getActiveAcquisitionApproval', () => {
  it('returns null when the query errors', async () => {
    const { admin } = createMockAdmin([{ data: null, error: { message: 'boom' } }]);
    const result = await getActiveAcquisitionApproval(admin, 'EXP-P1', 'financial-risk-value-systems');
    expect(result).toBeNull();
  });

  it('returns null when no active approval exists', async () => {
    const { admin } = createMockAdmin([{ data: null, error: null }]);
    const result = await getActiveAcquisitionApproval(admin, 'EXP-P1', 'financial-risk-value-systems');
    expect(result).toBeNull();
  });

  it('maps the row when an active approval exists', async () => {
    const { admin } = createMockAdmin([{
      data: {
        id: 'row-1', experiment_id: 'EXP-P1', acquisition_domain: 'financial-risk-value-systems',
        crystal_domain: 'financial-risk-value-systems', status: 'approved',
        target_snapshot: { requiredNetNewDistinctMembers: 49, missingNamespaces: [], deficientRelationalStructures: [], sourceAdmissibilityConstraints: [] },
        approved_by_persona_id: 'persona-1', approved_at: '2026-08-30T00:00:00Z', completed_at: null, receipt_id: null,
      },
      error: null,
    }]);
    const result = await getActiveAcquisitionApproval(admin, 'EXP-P1', 'financial-risk-value-systems');
    expect(result?.id).toBe('row-1');
    expect(result?.status).toBe('approved');
  });
});

describe('approveAcquisitionJob', () => {
  it('supersedes any prior approved row, inserts the new one, and receipts it', async () => {
    const { admin, calls } = createMockAdmin([
      { data: null, error: null }, // supersede update — result unused
      {
        data: {
          id: 'row-2', experiment_id: 'EXP-P1', acquisition_domain: 'financial-risk-value-systems',
          crystal_domain: 'financial-risk-value-systems', status: 'approved',
          target_snapshot: { requiredNetNewDistinctMembers: 49, missingNamespaces: ['causal', 'conditional'], deficientRelationalStructures: ['causal', 'conditional', 'threshold'], sourceAdmissibilityConstraints: ['ratified institutions/sources only'] },
          approved_by_persona_id: 'persona-1', approved_at: '2026-08-30T00:00:00Z', completed_at: null, receipt_id: null,
        },
        error: null,
      }, // insert
      { data: null, error: null }, // receipt_id update — result unused
    ]);
    mWriteLifecycleReceipt.mockResolvedValue({ ok: true, receiptId: 'receipt-1' });

    const result = await approveAcquisitionJob(admin, {
      experimentId: 'EXP-P1',
      acquisitionDomain: 'financial-risk-value-systems',
      crystalDomain: 'financial-risk-value-systems',
      approvedByPersonaId: 'persona-1',
      brief: BRIEF,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.approval.id).toBe('row-2');
    expect(result.approval.receiptId).toBe('receipt-1');

    // Order: supersede-update BEFORE insert.
    const updateCalls = calls.filter((c) => c.method === 'update');
    expect(updateCalls[0].args[0]).toMatchObject({ status: 'superseded' });
    expect(updateCalls[1].args[0]).toMatchObject({ receipt_id: 'receipt-1' });
    const insertCalls = calls.filter((c) => c.method === 'insert');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].args[0]).toMatchObject({
      experiment_id: 'EXP-P1',
      status: 'approved',
      target_snapshot: expect.objectContaining({ requiredNetNewDistinctMembers: 49 }),
    });

    expect(mWriteLifecycleReceipt).toHaveBeenCalledWith(expect.objectContaining({
      personaId: 'persona-1',
      summary: expect.stringContaining('49 additional distinct member'),
    }));
  });

  it('returns ok:false when the insert fails', async () => {
    const { admin } = createMockAdmin([
      { data: null, error: null }, // supersede
      { data: null, error: { message: 'insert failed' } }, // insert fails
    ]);
    const result = await approveAcquisitionJob(admin, {
      experimentId: 'EXP-P1',
      acquisitionDomain: 'financial-risk-value-systems',
      crystalDomain: 'financial-risk-value-systems',
      approvedByPersonaId: 'persona-1',
      brief: BRIEF,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toBe('insert failed');
  });

  it('still returns ok:true with receiptId null when the lifecycle receipt write fails', async () => {
    const { admin } = createMockAdmin([
      { data: null, error: null },
      {
        data: {
          id: 'row-3', experiment_id: 'EXP-P1', acquisition_domain: 'financial-risk-value-systems',
          crystal_domain: 'financial-risk-value-systems', status: 'approved',
          target_snapshot: {}, approved_by_persona_id: 'persona-1', approved_at: '2026-08-30T00:00:00Z',
          completed_at: null, receipt_id: null,
        },
        error: null,
      },
    ]);
    mWriteLifecycleReceipt.mockRejectedValue(new Error('receipt path down'));

    const result = await approveAcquisitionJob(admin, {
      experimentId: 'EXP-P1',
      acquisitionDomain: 'financial-risk-value-systems',
      crystalDomain: 'financial-risk-value-systems',
      approvedByPersonaId: 'persona-1',
      brief: BRIEF,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.approval.receiptId).toBeNull();
  });
});

describe('completeAcquisitionJob', () => {
  it('updates the row to completed, scoped to the still-approved row only', async () => {
    const { admin, calls } = createMockAdmin([{ data: null, error: null }]);
    await completeAcquisitionJob(admin, 'row-9');
    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall?.args[0]).toMatchObject({ status: 'completed' });
    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['id', 'row-9'] },
      { method: 'eq', args: ['status', 'approved'] },
    ]));
  });
});

const NBER = { pillarKey: 'partnerships', institutionName: 'NBER', status: 'ratified', verificationStatus: 'verified' };
const IMF = { pillarKey: 'macro', institutionName: 'IMF', status: 'ratified', verificationStatus: 'verified' };
const UNVERIFIED = { pillarKey: 'macro', institutionName: 'Unverified Corp', status: 'ratified', verificationStatus: 'pending' };

describe('runOneAcquisitionStep', () => {
  it('picks the first eligible institution with no candidate source on record yet', async () => {
    mGetDomainConstitution.mockResolvedValue({
      domain: 'financial-risk-value-systems', definition: null, pillars: [], dependencies: [],
      institutions: [NBER, IMF], diversity: [], acquisitionSeeds: [],
    } as never);
    mListCandidateSources.mockResolvedValue([]);
    mCanRun.mockImplementation((i: { verificationStatus: string }) => ({ allowed: i.verificationStatus === 'verified' }));
    mRunDiscovery.mockResolvedValue({ ok: true, pagesFetched: 1, candidates: [] } as never);

    const admin = {} as unknown as SupabaseClient;
    const result = await runOneAcquisitionStep(admin, 'financial-risk-value-systems');

    expect(result.exhausted).toBe(false);
    expect(result.institution).toEqual({ pillarKey: 'partnerships', institutionName: 'NBER' });
    expect(mRunDiscovery).toHaveBeenCalledWith(admin, {
      domain: 'financial-risk-value-systems', pillarKey: 'partnerships', institutionName: 'NBER',
    });
  });

  it('skips an institution that already has a candidate source on record', async () => {
    mGetDomainConstitution.mockResolvedValue({
      domain: 'financial-risk-value-systems', definition: null, pillars: [], dependencies: [],
      institutions: [NBER, IMF], diversity: [], acquisitionSeeds: [],
    } as never);
    mListCandidateSources.mockResolvedValue([{ issuer: 'NBER' } as never]);
    mCanRun.mockReturnValue({ allowed: true });
    mRunDiscovery.mockResolvedValue({ ok: true, pagesFetched: 1, candidates: [] } as never);

    const admin = {} as unknown as SupabaseClient;
    const result = await runOneAcquisitionStep(admin, 'financial-risk-value-systems');

    expect(result.institution).toEqual({ pillarKey: 'macro', institutionName: 'IMF' });
    // Exactly one eligible institution remained (IMF); attempting it leaves none.
    expect(result.exhausted).toBe(true);
  });

  it('excludes institutions the ratified/verified allowlist gate refuses', async () => {
    mGetDomainConstitution.mockResolvedValue({
      domain: 'financial-risk-value-systems', definition: null, pillars: [], dependencies: [],
      institutions: [UNVERIFIED, IMF], diversity: [], acquisitionSeeds: [],
    } as never);
    mListCandidateSources.mockResolvedValue([]);
    mCanRun.mockImplementation((i: { verificationStatus: string }) => ({ allowed: i.verificationStatus === 'verified' }));
    mRunDiscovery.mockResolvedValue({ ok: true, pagesFetched: 1, candidates: [] } as never);

    const admin = {} as unknown as SupabaseClient;
    const result = await runOneAcquisitionStep(admin, 'financial-risk-value-systems');

    expect(result.institution).toEqual({ pillarKey: 'macro', institutionName: 'IMF' });
    expect(mRunDiscovery).toHaveBeenCalledTimes(1);
  });

  it('reports exhausted:true and institution:null when nothing is eligible', async () => {
    mGetDomainConstitution.mockResolvedValue({
      domain: 'financial-risk-value-systems', definition: null, pillars: [], dependencies: [],
      institutions: [NBER, IMF], diversity: [], acquisitionSeeds: [],
    } as never);
    mListCandidateSources.mockResolvedValue([{ issuer: 'NBER' } as never, { issuer: 'IMF' } as never]);
    mCanRun.mockReturnValue({ allowed: true });

    const admin = {} as unknown as SupabaseClient;
    const result = await runOneAcquisitionStep(admin, 'financial-risk-value-systems');

    expect(result.exhausted).toBe(true);
    expect(result.institution).toBeNull();
    expect(result.discovery).toBeNull();
    expect(mRunDiscovery).not.toHaveBeenCalled();
  });

  it('a listCandidateSources failure degrades to treating nothing as already attempted (never throws)', async () => {
    mGetDomainConstitution.mockResolvedValue({
      domain: 'financial-risk-value-systems', definition: null, pillars: [], dependencies: [],
      institutions: [NBER], diversity: [], acquisitionSeeds: [],
    } as never);
    mListCandidateSources.mockRejectedValue(new Error('db down'));
    mCanRun.mockReturnValue({ allowed: true });
    mRunDiscovery.mockResolvedValue({ ok: true, pagesFetched: 1, candidates: [] } as never);

    const admin = {} as unknown as SupabaseClient;
    const result = await runOneAcquisitionStep(admin, 'financial-risk-value-systems');
    expect(result.institution).toEqual({ pillarKey: 'partnerships', institutionName: 'NBER' });
  });
});
