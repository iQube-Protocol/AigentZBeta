/**
 * services/research/crystalCohortMembership.ts — the ONE shared resolver for
 * "successor construction cohort" and "target Crystal membership universe"
 * (operator ruling, 2026-08-31: "successor cohort" and "successor Crystal"
 * are not the same thing).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateRow } from '@/services/invariants/discoveryEngine';

const mockListCandidates = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  listCandidates: (...args: any[]) => mockListCandidates(...args),
}));

const mockLatestFrozenCrystalArtifact = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (...args: any[]) => mockLatestFrozenCrystalArtifact(...args),
}));

const mockBuildFrozenCrystalManifest = vi.fn();
vi.mock('@/services/research/crystalFrozenManifest', () => ({
  buildFrozenCrystalManifest: (...args: any[]) => mockBuildFrozenCrystalManifest(...args),
}));

import {
  resolveFrozenPredecessorContext,
  isSuccessorScopedCandidate,
  resolveSuccessorConstructionCohort,
  resolveTargetCrystalMembershipUniverse,
} from '@/services/research/crystalCohortMembership';

function candidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: `cand-${Math.random().toString(36).slice(2)}`,
    domain: 'financial-services',
    subDomain: null,
    scopeLevel: 'domain',
    abstractionLevel: 'L2',
    discoveryClass: 'constitutional',
    statement: 'A statement.',
    rationale: '',
    evidenceIds: ['ev-1'],
    confidence: 0.6,
    status: 'promoted',
    promotedInvariantId: null,
    createdAt: '2026-08-31T00:00:00.000Z',
    stage: 'constitutional',
    classification: null,
    coverage: null,
    compression: null,
    crystalExclusion: null,
    ...overrides,
  } as CandidateRow;
}

beforeEach(() => {
  mockListCandidates.mockReset();
  mockLatestFrozenCrystalArtifact.mockReset();
  mockBuildFrozenCrystalManifest.mockReset();
});

describe('resolveFrozenPredecessorContext', () => {
  it('no frozen predecessor — everything null, never guessed', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(ctx).toEqual({ frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null });
    expect(mockBuildFrozenCrystalManifest).not.toHaveBeenCalled();
  });

  it('frozen predecessor exists but its manifest is unreadable — fails to null, never empty (never a false "no inherited members")', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'art-1', frozenAt: '2026-08-04T00:00:00Z' });
    mockBuildFrozenCrystalManifest.mockResolvedValue(null);
    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(ctx.frozenPredecessor).not.toBeNull();
    expect(ctx.frozenGenerationMemberIds).toBeNull();
    expect(ctx.frozenGenerationMembers).toBeNull();
  });

  it('frozen predecessor with a readable manifest — recovers ids AND labeled statements', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'art-1', frozenAt: '2026-08-04T00:00:00Z' });
    mockBuildFrozenCrystalManifest.mockResolvedValue({
      recoveredInvariants: [
        { id: 'inv-inherited-1', statement: 'Risk management is a fundamental component of financial services.' },
        { id: 'inv-inherited-2', statement: 'Another inherited statement.' },
      ],
    });
    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(ctx.frozenGenerationMemberIds).toEqual(new Set(['inv-inherited-1', 'inv-inherited-2']));
    expect(ctx.frozenGenerationMembers).toEqual([
      { id: 'inv-inherited-1', statement: 'Risk management is a fundamental component of financial services.' },
      { id: 'inv-inherited-2', statement: 'Another inherited statement.' },
    ]);
  });
});

describe('isSuccessorScopedCandidate', () => {
  it('no frozen predecessor at all — every candidate is successor-scoped', () => {
    const ctx = { frozenPredecessor: null, frozenGenerationMemberIds: null };
    expect(isSuccessorScopedCandidate({ status: 'promoted', promotedInvariantId: 'inv-1', createdAt: '2020-01-01' }, ctx)).toBe(true);
  });

  it('a resolved candidate whose invariant IS a frozen-predecessor member is excluded (vP1 own promotion, not v2 construction)', () => {
    const ctx = {
      frozenPredecessor: { id: 'art-1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      frozenGenerationMemberIds: new Set(['inv-inherited-1']),
    };
    expect(isSuccessorScopedCandidate({ status: 'promoted', promotedInvariantId: 'inv-inherited-1', createdAt: '2026-08-31' }, ctx)).toBe(false);
  });

  it('a resolved candidate whose invariant is NOT a frozen-predecessor member is successor-scoped', () => {
    const ctx = {
      frozenPredecessor: { id: 'art-1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      frozenGenerationMemberIds: new Set(['inv-inherited-1']),
    };
    expect(isSuccessorScopedCandidate({ status: 'promoted', promotedInvariantId: 'inv-new-1', createdAt: '2026-08-31' }, ctx)).toBe(true);
  });

  it('an unresolved candidate is scoped by creation time relative to the freeze', () => {
    const ctx = {
      frozenPredecessor: { id: 'art-1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      frozenGenerationMemberIds: new Set<string>(),
    };
    expect(isSuccessorScopedCandidate({ status: 'candidate', promotedInvariantId: null, createdAt: '2026-08-01' }, ctx)).toBe(false);
    expect(isSuccessorScopedCandidate({ status: 'candidate', promotedInvariantId: null, createdAt: '2026-08-31' }, ctx)).toBe(true);
  });

  it('never excludes on an unreadable freeze boundary', () => {
    const ctx = { frozenPredecessor: { id: 'art-1', frozenAt: null } as any, frozenGenerationMemberIds: null };
    expect(isSuccessorScopedCandidate({ status: 'candidate', promotedInvariantId: null, createdAt: '2020-01-01' }, ctx)).toBe(true);
  });
});

describe('resolveSuccessorConstructionCohort', () => {
  const fakeAdmin = {} as unknown as SupabaseClient;

  it('narrows candidates to the successor generation and the promoted subset', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'art-1', frozenAt: '2026-08-04T00:00:00Z' });
    mockBuildFrozenCrystalManifest.mockResolvedValue({
      recoveredInvariants: [{ id: 'inv-inherited-1', statement: 'inherited' }],
    });
    mockListCandidates.mockResolvedValue([
      candidate({ id: 'c-inherited', promotedInvariantId: 'inv-inherited-1', status: 'promoted' }), // vP1's own — excluded
      candidate({ id: 'c-new-1', promotedInvariantId: 'inv-new-1', status: 'promoted' }), // v2 construction
      candidate({ id: 'c-new-2', promotedInvariantId: null, status: 'candidate', createdAt: '2026-08-31T00:00:00Z' }), // v2, not yet promoted
    ]);

    const result = await resolveSuccessorConstructionCohort(fakeAdmin, 'EXP-P1', 'financial-services');
    expect(result.successorScopedCandidates?.map((c) => c.id).sort()).toEqual(['c-new-1', 'c-new-2']);
    expect(result.promotedForConstruction?.map((c) => c.id)).toEqual(['c-new-1']);
  });

  it('a domain read failure reports null, never an empty (silently "nothing pending") cohort', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    mockListCandidates.mockRejectedValue(new Error('db down'));
    const result = await resolveSuccessorConstructionCohort(fakeAdmin, 'EXP-P1', 'financial-services');
    expect(result.successorScopedCandidates).toBeNull();
    expect(result.promotedForConstruction).toBeNull();
  });
});

describe('resolveTargetCrystalMembershipUniverse', () => {
  it('unions inherited members with the successor cohort', () => {
    const context = {
      frozenPredecessor: { id: 'art-1' } as any,
      frozenGenerationMemberIds: new Set(['inv-inherited-1']),
      frozenGenerationMembers: [{ id: 'inv-inherited-1', statement: 'inherited' }],
    };
    const universe = resolveTargetCrystalMembershipUniverse(context, ['inv-new-1', 'inv-new-2']);
    expect(universe.memberIds).toEqual(new Set(['inv-inherited-1', 'inv-new-1', 'inv-new-2']));
    expect(universe.inheritedMemberIds).toEqual(new Set(['inv-inherited-1']));
    expect(universe.inheritedMembers).toEqual([{ id: 'inv-inherited-1', statement: 'inherited' }]);
  });

  it('no frozen predecessor — universe is exactly the successor cohort, empty inherited set', () => {
    const context = { frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null };
    const universe = resolveTargetCrystalMembershipUniverse(context, ['inv-new-1']);
    expect(universe.memberIds).toEqual(new Set(['inv-new-1']));
    expect(universe.inheritedMemberIds).toEqual(new Set());
    expect(universe.inheritedMembers).toEqual([]);
  });
});
