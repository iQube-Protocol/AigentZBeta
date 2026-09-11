/**
 * services/invariants/discoveryEngine.ts — repairPromotedCandidateInvariantLink
 * and excludeCandidateFromCrystal (al, 2026-08-04).
 *
 * "Repair and include" must call the EXISTING canonical capability, never a
 * parallel write path. It does not: it reuses `findDuplicates`
 * (services/invariants/comparison.ts) — the SAME exact-duplicate detection
 * `discoverInvariant` runs internally — and writes the SAME
 * `promoted_invariant_id` column `promoteCandidate` itself writes. This
 * function exists only because `promoteCandidate` REFUSES any row whose
 * `status !== 'candidate'` (this row is already `'promoted'`), so there was
 * no existing path that could complete a broken promotion at all.
 *
 * "Explicitly exclude" writes into `discovery_provenance` — the SAME jsonb
 * column `promoteCandidate`'s own duplicate-resolution path already writes
 * structured facts into (`resolvedAs`, `rediscoveredEvidence`) — never a new
 * column or table for a fact this specific to one candidate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindDuplicates = vi.fn();
vi.mock('@/services/invariants/comparison', () => ({
  findDuplicates: (...args: any[]) => mockFindDuplicates(...args),
  similarity: vi.fn(),
}));

import { repairPromotedCandidateInvariantLink, excludeCandidateFromCrystal } from '@/services/invariants/discoveryEngine';

/** A minimal chainable fake mirroring supabase-js's query-builder shape. */
function fakeAdmin(candidateRow: Record<string, unknown> | null, updateSpy: (patch: Record<string, unknown>) => void = () => {}) {
  const builder: any = {
    select: () => builder,
    update: (patch: Record<string, unknown>) => {
      updateSpy(patch);
      return builder;
    },
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: candidateRow, error: null }),
    then: (resolve: any) => resolve({ data: null, error: null }),
  };
  return { from: vi.fn(() => builder) } as any;
}

beforeEach(() => {
  mockFindDuplicates.mockReset();
});

describe('repairPromotedCandidateInvariantLink', () => {
  it('refuses a candidate that is not promoted — nothing to repair', async () => {
    const admin = fakeAdmin({ id: 'c1', status: 'candidate', promoted_invariant_id: null, domain: 'financial-services', statement: 'x' });
    const result = await repairPromotedCandidateInvariantLink(admin, 'c1');
    expect(result).toMatchObject({ ok: false, reason: 'not-promoted' });
  });

  it('refuses a candidate that already carries a promoted_invariant_id — never overwrites', async () => {
    const admin = fakeAdmin({ id: 'c1', status: 'promoted', promoted_invariant_id: 'inv-1', domain: 'financial-services', statement: 'x' });
    const result = await repairPromotedCandidateInvariantLink(admin, 'c1');
    expect(result).toMatchObject({ ok: false, reason: 'already-linked' });
  });

  it('refuses honestly when no exact-statement match exists — never guesses which invariant to attach', async () => {
    mockFindDuplicates.mockResolvedValue([]);
    const admin = fakeAdmin({ id: 'c1', status: 'promoted', promoted_invariant_id: null, domain: 'financial-services', statement: 'x' });
    const result = await repairPromotedCandidateInvariantLink(admin, 'c1');
    expect(result).toMatchObject({ ok: false, reason: 'no-deterministic-match' });
  });

  it('attaches the exact-match invariant and reports it — the SAME promoted_invariant_id column promoteCandidate writes', async () => {
    mockFindDuplicates.mockResolvedValue([{ invariant: { id: 'inv-exact' }, similarity: 1, exact: true }]);
    let patched: Record<string, unknown> | null = null;
    const admin = fakeAdmin(
      { id: 'c1', status: 'promoted', promoted_invariant_id: null, domain: 'financial-services', statement: 'x', discovery_provenance: { a: 1 } },
      (patch) => (patched = patch),
    );
    const result = await repairPromotedCandidateInvariantLink(admin, 'c1');
    expect(result).toEqual({ ok: true, invariantId: 'inv-exact' });
    expect(patched).toMatchObject({ promoted_invariant_id: 'inv-exact' });
    // The pre-existing provenance is PRESERVED, not clobbered.
    expect((patched as any).discovery_provenance).toMatchObject({ a: 1, resolvedAs: 'repaired-exact-match' });
  });

  it('refuses when the candidate does not exist', async () => {
    const admin = fakeAdmin(null);
    const result = await repairPromotedCandidateInvariantLink(admin, 'ghost');
    expect(result).toMatchObject({ ok: false, reason: 'not-found' });
  });
});

describe('excludeCandidateFromCrystal', () => {
  it('requires a non-empty reason — "an exclusion without a reason is not an exclusion, it is a disappearance"', async () => {
    const admin = fakeAdmin({ id: 'c1', discovery_provenance: {} });
    const result = await excludeCandidateFromCrystal(admin, 'c1', {
      reason: '   ',
      excludedBy: 'persona-1',
      crystalId: 'EXP-P1',
      fromStageId: 'review-and-promote',
      toStageId: 'classify-provenance',
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid-input' });
  });

  it('writes a typed exclusion into discovery_provenance, preserving existing facts', async () => {
    let patched: Record<string, unknown> | null = null;
    const admin = fakeAdmin({ id: 'c1', discovery_provenance: { existing: true } }, (patch) => (patched = patch));
    const result = await excludeCandidateFromCrystal(admin, 'c1', {
      reason: 'duplicate resolution — already counted via candidate c-first',
      excludedBy: 'persona-1',
      crystalId: 'EXP-P1',
      fromStageId: 'review-and-promote',
      toStageId: 'classify-provenance',
    });
    expect(result).toEqual({ ok: true });
    const exclusion = (patched as any).discovery_provenance.crystalExclusion;
    expect(exclusion).toMatchObject({
      reason: 'duplicate resolution — already counted via candidate c-first',
      excludedBy: 'persona-1',
      crystalId: 'EXP-P1',
      fromStageId: 'review-and-promote',
      toStageId: 'classify-provenance',
    });
    expect(typeof exclusion.excludedAt).toBe('string');
    expect((patched as any).discovery_provenance.existing).toBe(true);
  });

  it('refuses when the candidate does not exist', async () => {
    const admin = fakeAdmin(null);
    const result = await excludeCandidateFromCrystal(admin, 'ghost', {
      reason: 'x',
      excludedBy: 'persona-1',
      crystalId: 'EXP-P1',
      fromStageId: 'review-and-promote',
      toStageId: 'classify-provenance',
    });
    expect(result).toMatchObject({ ok: false, reason: 'not-found' });
  });
});
