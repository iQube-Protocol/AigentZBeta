/**
 * services/research/crystalRelationshipAdjudication.ts — the durable
 * "reviewed, no defensible edge" fact for Track 2 Stage 7 (operator report,
 * 2026-08-31, "a crystal member may legitimately have zero relationships").
 *
 * The admin Supabase client is a minimal chainable stub, not a real client —
 * same style as tests/crystal-acquisition-job.test.ts.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeCohortFingerprint,
  getValidNoDefensibleEdgeInvariantIds,
  recordNoDefensibleEdgeAdjudication,
} from '@/services/research/crystalRelationshipAdjudication';

function createMockAdmin(queue: Array<{ data: unknown; error: unknown }>) {
  let idx = 0;
  const next = () => queue[Math.min(idx++, queue.length - 1)] ?? { data: null, error: null };
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const record = (method: string, args: unknown[]) => calls.push({ method, args });

  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => { record('select', args); return builder; },
    eq: (...args: unknown[]) => { record('eq', args); return builder; },
    in: (...args: unknown[]) => { record('in', args); return builder; },
    order: (...args: unknown[]) => { record('order', args); return builder; },
    insert: (...args: unknown[]) => { record('insert', args); return builder; },
    single: async () => next(),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(next()).then(resolve, reject),
  };
  const admin = {
    from: (table: string) => { record('from', [table]); return builder; },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

describe('computeCohortFingerprint', () => {
  it('is order-independent — same membership, any order, same fingerprint', () => {
    const a = computeCohortFingerprint(['inv-1', 'inv-2', 'inv-3']);
    const b = computeCohortFingerprint(['inv-3', 'inv-1', 'inv-2']);
    expect(a).toBe(b);
  });

  it('changes when cohort membership genuinely changes', () => {
    const before = computeCohortFingerprint(['inv-1', 'inv-2']);
    const after = computeCohortFingerprint(['inv-1', 'inv-2', 'inv-3']);
    expect(before).not.toBe(after);
  });
});

describe('getValidNoDefensibleEdgeInvariantIds', () => {
  it('returns an empty set without querying when the cohort is empty', async () => {
    const { admin, calls } = createMockAdmin([]);
    const result = await getValidNoDefensibleEdgeInvariantIds(admin, { experimentId: 'EXP-P1', cohortMemberIds: [] });
    expect(result.size).toBe(0);
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });

  it('fails closed to an empty set on a query error — an unreadable log never satisfies Stage 7', async () => {
    const { admin } = createMockAdmin([{ data: null, error: { message: 'boom' } }]);
    const result = await getValidNoDefensibleEdgeInvariantIds(admin, {
      experimentId: 'EXP-P1',
      cohortMemberIds: ['inv-1'],
    });
    expect(result.size).toBe(0);
  });

  it('includes a member whose latest adjudication fingerprint matches the current cohort', async () => {
    const cohort = ['inv-1', 'inv-2'];
    const fp = computeCohortFingerprint(cohort);
    const { admin } = createMockAdmin([{
      data: [{ invariant_id: 'inv-1', cohort_fingerprint: fp, adjudicated_at: '2026-08-31T00:00:00Z' }],
      error: null,
    }]);
    const result = await getValidNoDefensibleEdgeInvariantIds(admin, { experimentId: 'EXP-P1', cohortMemberIds: cohort });
    expect(result.has('inv-1')).toBe(true);
  });

  it('excludes a member whose latest adjudication was reached under a DIFFERENT (stale) cohort — reopens automatically', async () => {
    const cohort = ['inv-1', 'inv-2', 'inv-3']; // cohort has grown since the adjudication
    const staleFp = computeCohortFingerprint(['inv-1', 'inv-2']);
    const { admin } = createMockAdmin([{
      data: [{ invariant_id: 'inv-1', cohort_fingerprint: staleFp, adjudicated_at: '2026-08-30T00:00:00Z' }],
      error: null,
    }]);
    const result = await getValidNoDefensibleEdgeInvariantIds(admin, { experimentId: 'EXP-P1', cohortMemberIds: cohort });
    expect(result.has('inv-1')).toBe(false);
  });

  it('uses only the LATEST row per invariant — an older stale row must not resurrect after a fresh valid one exists', async () => {
    const cohort = ['inv-1', 'inv-2'];
    const currentFp = computeCohortFingerprint(cohort);
    const staleFp = computeCohortFingerprint(['inv-1']);
    // Rows arrive newest-first (order('adjudicated_at', {ascending:false})) —
    // the fresh, valid re-adjudication comes before the older stale one.
    const { admin } = createMockAdmin([{
      data: [
        { invariant_id: 'inv-1', cohort_fingerprint: currentFp, adjudicated_at: '2026-08-31T12:00:00Z' },
        { invariant_id: 'inv-1', cohort_fingerprint: staleFp, adjudicated_at: '2026-08-30T00:00:00Z' },
      ],
      error: null,
    }]);
    const result = await getValidNoDefensibleEdgeInvariantIds(admin, { experimentId: 'EXP-P1', cohortMemberIds: cohort });
    expect(result.has('inv-1')).toBe(true);
  });
});

describe('recordNoDefensibleEdgeAdjudication', () => {
  it('inserts the fact with the server-computed cohort fingerprint and the no-defensible-edge disposition', async () => {
    const cohort = ['inv-1', 'inv-2'];
    const { admin, calls } = createMockAdmin([{
      data: { id: 'row-1', cohort_fingerprint: computeCohortFingerprint(cohort), adjudicated_at: '2026-08-31T00:00:00Z' },
      error: null,
    }]);
    const result = await recordNoDefensibleEdgeAdjudication(admin, {
      experimentId: 'EXP-P1',
      crystalDomain: 'financial-risk-value-systems',
      invariantId: 'inv-1',
      cohortMemberIds: cohort,
      adjudicatedByPersonaId: 'persona-1',
      reviewedCandidateIds: ['inv-2:supports'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.adjudication.id).toBe('row-1');
    expect(result.adjudication.cohortFingerprint).toBe(computeCohortFingerprint(cohort));

    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall?.args[0]).toMatchObject({
      experiment_id: 'EXP-P1',
      crystal_domain: 'financial-risk-value-systems',
      invariant_id: 'inv-1',
      disposition: 'no-defensible-edge',
      cohort_fingerprint: computeCohortFingerprint(cohort),
      reviewed_candidate_ids: ['inv-2:supports'],
      adjudicated_by_persona_id: 'persona-1',
    });

    // No edge is ever written to satisfy Stage 7 — the only table this
    // module touches is the adjudication log itself, never invariant_edges.
    const fromCalls = calls.filter((c) => c.method === 'from').map((c) => c.args[0]);
    expect(fromCalls).toEqual(['crystal_relationship_adjudications']);
  });

  it('returns ok:false when the insert fails, never a fabricated success', async () => {
    const { admin } = createMockAdmin([{ data: null, error: { message: 'insert failed' } }]);
    const result = await recordNoDefensibleEdgeAdjudication(admin, {
      experimentId: 'EXP-P1',
      crystalDomain: 'financial-risk-value-systems',
      invariantId: 'inv-1',
      cohortMemberIds: ['inv-1'],
      adjudicatedByPersonaId: 'persona-1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toBe('insert failed');
  });
});
