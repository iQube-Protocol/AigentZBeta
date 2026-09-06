/**
 * services/research/crystalCohortMembership.ts — the ONE shared resolver for
 * "successor construction cohort" and "target Crystal membership universe"
 * (operator ruling, 2026-08-31: "successor cohort" and "successor Crystal"
 * are not the same thing).
 *
 * REWRITTEN 2026-09-05 for the generation-identity repair
 * (RES-2026-09-05-TRACK2-MEMBERSHIP-RECOVERY-GENERATION-BLIND-001 /
 * CI-2026-09-05-MEMBERSHIP-RECOVERY-MUST-BOUND-GENERATION-001).
 * `resolveFrozenPredecessorContext` no longer reads via
 * `buildFrozenCrystalManifest`'s domain-scoped, generation-blind
 * `recoveredInvariants` — it reads DIRECTLY via
 * `listInvariants({domain, crystalGenerationId})`, bounded to the frozen
 * predecessor's own generation. These tests mock `listInvariants` instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateRow } from '@/services/invariants/discoveryEngine';

const mockListCandidates = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  listCandidates: (...args: any[]) => mockListCandidates(...args),
  // resolveSuccessorConstructionCohort reads via the across-sub-domains
  // variant (2026-09-03, "EXP-P1 Crystal v2 sub-domain invisibility"
  // repair) — same mock fn, so every existing test's expectations on what
  // was returned still apply unchanged.
  listCandidatesAcrossSubDomains: (...args: any[]) => mockListCandidates(...args),
}));

const mockLatestFrozenCrystalArtifact = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  latestFrozenCrystalArtifact: (...args: any[]) => mockLatestFrozenCrystalArtifact(...args),
}));

const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: any[]) => mockListInvariants(...args),
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
  mockListInvariants.mockReset();
});

describe('resolveFrozenPredecessorContext', () => {
  it('no frozen predecessor — everything null, never guessed', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue(null);
    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(ctx).toEqual({ frozenPredecessor: null, frozenGenerationMemberIds: null, frozenGenerationMembers: null });
    expect(mockListInvariants).not.toHaveBeenCalled();
  });

  it('no declared crystal domain for this experiment — fails to null, never guesses a domain', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'EXP-999/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' });
    const ctx = await resolveFrozenPredecessorContext('EXP-999');
    expect(ctx.frozenPredecessor).not.toBeNull();
    expect(ctx.frozenGenerationMemberIds).toBeNull();
    expect(ctx.frozenGenerationMembers).toBeNull();
    expect(mockListInvariants).not.toHaveBeenCalled();
  });

  it('frozen predecessor exists but the generation-scoped read fails — fails to null, never empty (never a false "no inherited members")', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' });
    mockListInvariants.mockRejectedValue(new Error('db down'));
    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(ctx.frozenPredecessor).not.toBeNull();
    expect(ctx.frozenGenerationMemberIds).toBeNull();
    expect(ctx.frozenGenerationMembers).toBeNull();
  });

  it('reads membership via listInvariants bounded to BOTH the domain and the frozen predecessor\'s own generation id — never domain alone', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' });
    mockListInvariants.mockResolvedValue([
      { id: 'inv-inherited-1', statement: 'Risk management is a fundamental component of financial services.' },
      { id: 'inv-inherited-2', statement: 'Another inherited statement.' },
    ]);
    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(mockListInvariants).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'financial-risk-value-systems', crystalGenerationId: 'EXP-P1/crystal-vP1' }),
    );
    expect(ctx.frozenGenerationMemberIds).toEqual(new Set(['inv-inherited-1', 'inv-inherited-2']));
    expect(ctx.frozenGenerationMembers).toEqual([
      { id: 'inv-inherited-1', statement: 'Risk management is a fundamental component of financial services.' },
      { id: 'inv-inherited-2', statement: 'Another inherited statement.' },
    ]);
  });

  it('THE REGRESSION: predecessor resolver remains 15 after a 53-member successor generation is assigned into the same domain', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' });
    // The fake substrate holds BOTH generations in the same domain — 15
    // predecessor (vP1) + 53 successor (vP2), 68 total, exactly mirroring
    // the live incident. The generation-scoped mock only ever returns rows
    // matching the SPECIFIC crystalGenerationId it was called with — the
    // defect this fix closes was consuming a read that ignored this
    // parameter entirely and returned all 68.
    const predecessor = Array.from({ length: 15 }, (_, i) => ({ id: `vp1-${i}`, statement: `predecessor ${i}` }));
    const successor = Array.from({ length: 53 }, (_, i) => ({ id: `vp2-${i}`, statement: `successor ${i}` }));
    mockListInvariants.mockImplementation(async (filter: { crystalGenerationId?: string }) => {
      if (filter.crystalGenerationId === 'EXP-P1/crystal-vP1') return predecessor;
      if (filter.crystalGenerationId === 'EXP-P1/crystal-vP2') return successor;
      // A caller that forgot to pass crystalGenerationId would see this —
      // deliberately wrong (all 68), so a regression here is loud, not silent.
      return [...predecessor, ...successor];
    });

    const ctx = await resolveFrozenPredecessorContext('EXP-P1');
    expect(ctx.frozenGenerationMemberIds?.size).toBe(15);
    expect(ctx.frozenGenerationMembers).toHaveLength(15);
    expect([...(ctx.frozenGenerationMemberIds ?? [])].every((id) => id.startsWith('vp1-'))).toBe(true);
  });
});

describe('isSuccessorScopedCandidate', () => {
  it('no frozen predecessor at all — every candidate is successor-scoped', () => {
    const ctx = { frozenPredecessor: null, frozenGenerationMemberIds: null };
    expect(isSuccessorScopedCandidate({ status: 'promoted', promotedInvariantId: 'inv-1', createdAt: '2020-01-01' }, ctx)).toBe(true);
  });

  it('a resolved candidate whose invariant IS a frozen-predecessor member is excluded (vP1 own promotion, not v2 construction)', () => {
    const ctx = {
      frozenPredecessor: { id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      frozenGenerationMemberIds: new Set(['inv-inherited-1']),
    };
    expect(isSuccessorScopedCandidate({ status: 'promoted', promotedInvariantId: 'inv-inherited-1', createdAt: '2026-08-31' }, ctx)).toBe(false);
  });

  it('a resolved candidate whose invariant is NOT a frozen-predecessor member is successor-scoped', () => {
    const ctx = {
      frozenPredecessor: { id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      frozenGenerationMemberIds: new Set(['inv-inherited-1']),
    };
    expect(isSuccessorScopedCandidate({ status: 'promoted', promotedInvariantId: 'inv-new-1', createdAt: '2026-08-31' }, ctx)).toBe(true);
  });

  it('THE REGRESSION: the successor cohort does not collapse after Stage 8 — 53 newly-assigned successor members all remain successor-scoped', () => {
    const ctx = {
      frozenPredecessor: { id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      // Correctly bounded to the 15 predecessor ids (the fix) — NOT the 68
      // that a domain-wholesale read would have produced post-assignment.
      frozenGenerationMemberIds: new Set(Array.from({ length: 15 }, (_, i) => `vp1-${i}`)),
    };
    const successorMembers = Array.from({ length: 53 }, (_, i) => ({
      status: 'promoted' as const,
      promotedInvariantId: `vp2-${i}`,
      createdAt: '2026-09-05T10:06:41.303889Z',
    }));
    const scoped = successorMembers.filter((c) => isSuccessorScopedCandidate(c, ctx));
    expect(scoped).toHaveLength(53);
  });

  it('an unresolved candidate is scoped by creation time relative to the freeze', () => {
    const ctx = {
      frozenPredecessor: { id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' } as any,
      frozenGenerationMemberIds: new Set<string>(),
    };
    expect(isSuccessorScopedCandidate({ status: 'candidate', promotedInvariantId: null, createdAt: '2026-08-01' }, ctx)).toBe(false);
    expect(isSuccessorScopedCandidate({ status: 'candidate', promotedInvariantId: null, createdAt: '2026-08-31' }, ctx)).toBe(true);
  });

  it('never excludes on an unreadable freeze boundary', () => {
    const ctx = { frozenPredecessor: { id: 'EXP-P1/crystal-vP1', frozenAt: null } as any, frozenGenerationMemberIds: null };
    expect(isSuccessorScopedCandidate({ status: 'candidate', promotedInvariantId: null, createdAt: '2020-01-01' }, ctx)).toBe(true);
  });
});

describe('resolveSuccessorConstructionCohort', () => {
  const fakeAdmin = {} as unknown as SupabaseClient;

  it('narrows candidates to the successor generation and the promoted subset', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' });
    mockListInvariants.mockResolvedValue([{ id: 'inv-inherited-1', statement: 'inherited' }]);
    mockListCandidates.mockResolvedValue([
      candidate({ id: 'c-inherited', promotedInvariantId: 'inv-inherited-1', status: 'promoted' }), // vP1's own — excluded
      candidate({ id: 'c-new-1', promotedInvariantId: 'inv-new-1', status: 'promoted' }), // v2 construction
      candidate({ id: 'c-new-2', promotedInvariantId: null, status: 'candidate', createdAt: '2026-08-31T00:00:00Z' }), // v2, not yet promoted
    ]);

    const result = await resolveSuccessorConstructionCohort(fakeAdmin, 'EXP-P1', 'financial-services');
    expect(result.successorScopedCandidates?.map((c) => c.id).sort()).toEqual(['c-new-1', 'c-new-2']);
    expect(result.promotedForConstruction?.map((c) => c.id)).toEqual(['c-new-1']);
  });

  it('THE REGRESSION: does not collapse after a 53-member Stage 8 assignment — all 58 successor candidates remain visible', async () => {
    mockLatestFrozenCrystalArtifact.mockResolvedValue({ id: 'EXP-P1/crystal-vP1', frozenAt: '2026-08-04T00:00:00Z' });
    // Generation-scoped read correctly returns only the 15 vP1 members —
    // never the 53 vP2 members also present in the domain.
    mockListInvariants.mockResolvedValue(Array.from({ length: 15 }, (_, i) => ({ id: `vp1-${i}`, statement: `predecessor ${i}` })));
    const eligible = Array.from({ length: 53 }, (_, i) =>
      candidate({ id: `c-eligible-${i}`, promotedInvariantId: `vp2-${i}`, status: 'promoted', createdAt: '2026-09-05T10:06:41.303889Z' }),
    );
    const ineligible = Array.from({ length: 5 }, (_, i) =>
      candidate({ id: `c-ineligible-${i}`, promotedInvariantId: null, status: 'rejected', createdAt: '2026-09-05T10:06:41.303889Z' }),
    );
    mockListCandidates.mockResolvedValue([...eligible, ...ineligible]);

    const result = await resolveSuccessorConstructionCohort(fakeAdmin, 'EXP-P1', 'financial-services');
    expect(result.successorScopedCandidates).toHaveLength(58);
    expect(result.promotedForConstruction).toHaveLength(53);
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
      frozenPredecessor: { id: 'EXP-P1/crystal-vP1' } as any,
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
