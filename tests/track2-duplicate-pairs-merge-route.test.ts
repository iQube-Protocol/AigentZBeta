/**
 * POST /api/research/track2/[experimentId]/duplicate-pairs/merge (operator
 * ruling, 2026-08-27, "final corrections" pass): the route re-reads the
 * SAME authoritative `loadTrack2ProgrammeState` composition every Track 2
 * GET uses, refuses a pair that reading no longer names (409, stale-pair
 * rejection), and derives every receipt field itself — the client submits
 * only survivorId/mergedId/an optional override reason.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockMergeInvariants = vi.fn();
vi.mock('@/services/invariants/lifecycle', () => ({
  mergeInvariants: (...args: any[]) => mockMergeInvariants(...args),
}));

const mockLoadTrack2ProgrammeState = vi.fn();
vi.mock('@/services/research/researchProgrammeOrchestrator', () => ({
  loadTrack2ProgrammeState: (...args: any[]) => mockLoadTrack2ProgrammeState(...args),
}));

import { POST } from '@/app/api/research/track2/[experimentId]/duplicate-pairs/merge/route';

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

const params = Promise.resolve({ experimentId: 'EXP-P1' });

const RECOMMENDATION_A = {
  recommendedId: 'inv-a',
  otherId: 'inv-b',
  confidence: 'high' as const,
  reasons: [{ criterion: 'external-provenance-eligibility', detail: 'inv-a eligible, inv-b not' }],
};

function stateWithPairs(pairs: any[]) {
  return {
    experimentId: 'EXP-P1',
    readiness: {
      checks: [
        {
          name: 'duplicate-detection',
          tier: 'scientific-readiness',
          passed: pairs.length === 0,
          detail: '',
          remedy: null,
          duplicatePairs: pairs,
        },
      ],
    },
  };
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockMergeInvariants.mockReset();
  mockMergeInvariants.mockResolvedValue({ id: 'inv-a' });
  mockLoadTrack2ProgrammeState.mockReset();
  mockLoadTrack2ProgrammeState.mockResolvedValue(
    stateWithPairs([
      {
        aId: 'inv-a',
        bId: 'inv-b',
        aStatement: 'Statement A.',
        bStatement: 'Statement B.',
        recommendation: RECOMMENDATION_A,
      },
    ]),
  );
});

describe('POST duplicate-pairs/merge — auth', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    expect(res.status).toBe(401);
    expect(mockLoadTrack2ProgrammeState).not.toHaveBeenCalled();
  });

  it('refuses a non-steward caller', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    expect(res.status).toBe(403);
  });
});

describe('POST duplicate-pairs/merge — input validation', () => {
  it('refuses a body missing survivorId or mergedId', async () => {
    const res = await POST(makeRequest({ survivorId: 'inv-a' }), { params });
    expect(res.status).toBe(400);
  });

  it('refuses survivorId === mergedId', async () => {
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-a' }), { params });
    expect(res.status).toBe(400);
  });

  it('refuses invalid JSON', async () => {
    const req = { json: async () => { throw new Error('bad json'); } } as unknown as NextRequest;
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });
});

describe('POST duplicate-pairs/merge — pair staleness (arbitrary/out-of-scope pair rejection)', () => {
  it('rejects with 409 a pair the fresh authoritative reading no longer names', async () => {
    mockLoadTrack2ProgrammeState.mockResolvedValue(stateWithPairs([])); // resolved by someone else already
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockMergeInvariants).not.toHaveBeenCalled();
  });

  it('rejects with 409 an arbitrary pair of ids never named as near-duplicates at all', async () => {
    // Only inv-a~inv-b is a real near-duplicate pair in this reading; a
    // client submitting two unrelated ids must never be able to force a
    // merge that the readiness engine never recommended.
    const res = await POST(makeRequest({ survivorId: 'inv-x', mergedId: 'inv-y' }), { params });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(mockMergeInvariants).not.toHaveBeenCalled();
  });

  it('propagates a 404 from an unknown experiment (loadTrack2ProgrammeState error)', async () => {
    mockLoadTrack2ProgrammeState.mockResolvedValue({ error: 'no crystal domain declared', status: 404 });
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    expect(res.status).toBe(404);
  });

  it('matches the pair regardless of which id the client names survivor vs merged', async () => {
    // The readiness engine named the pair (inv-a, inv-b) with no inherent
    // order; the client keeping inv-b (merging inv-a into it) must match
    // the SAME pair.
    const res = await POST(makeRequest({ survivorId: 'inv-b', mergedId: 'inv-a' }), { params });
    expect(res.status).toBe(200);
    expect(mockMergeInvariants).toHaveBeenCalledTimes(1);
  });
});

describe('POST duplicate-pairs/merge — server-derived receipt context', () => {
  it('derives the full decisionContext server-side and passes it to mergeInvariants, never trusting client fields', async () => {
    const res = await POST(
      makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b', recommendedId: 'SHOULD-BE-IGNORED', confidence: 'IGNORED' }),
      { params },
    );
    expect(res.status).toBe(200);
    expect(mockMergeInvariants).toHaveBeenCalledWith(
      'inv-a',
      ['inv-b'],
      { personaId: 'persona-steward' },
      {
        experimentId: 'EXP-P1',
        pairIds: ['inv-a', 'inv-b'],
        survivorId: 'inv-a',
        mergedId: 'inv-b',
        recommendedId: 'inv-a',
        operatorFollowedRecommendation: true,
        confidence: 'high',
        reasons: RECOMMENDATION_A.reasons,
        operatorOverrideReason: null,
      },
    );
  });

  it('reports pairIds in stable lexical order regardless of which side is aId/bId in the reading', async () => {
    mockLoadTrack2ProgrammeState.mockResolvedValue(
      stateWithPairs([
        { aId: 'inv-z', bId: 'inv-m', aStatement: 'Z.', bStatement: 'M.', recommendation: null },
      ]),
    );
    const res = await POST(makeRequest({ survivorId: 'inv-z', mergedId: 'inv-m' }), { params });
    expect(res.status).toBe(200);
    const [, , , decisionContext] = mockMergeInvariants.mock.calls[0];
    expect(decisionContext.pairIds).toEqual(['inv-m', 'inv-z']);
  });

  it('defaults confidence to low and reasons to [] when the reading carried no recommendation', async () => {
    mockLoadTrack2ProgrammeState.mockResolvedValue(
      stateWithPairs([
        { aId: 'inv-a', bId: 'inv-b', aStatement: 'A.', bStatement: 'B.', recommendation: null },
      ]),
    );
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    expect(res.status).toBe(200);
    const [, , , decisionContext] = mockMergeInvariants.mock.calls[0];
    expect(decisionContext.recommendedId).toBeNull();
    expect(decisionContext.operatorFollowedRecommendation).toBe(false);
    expect(decisionContext.confidence).toBe('low');
    expect(decisionContext.reasons).toEqual([]);
  });
});

describe('POST duplicate-pairs/merge — follow vs. override', () => {
  it('marks operatorFollowedRecommendation true when the kept survivor matches the recommendation', async () => {
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    expect(res.status).toBe(200);
    const [, , , decisionContext] = mockMergeInvariants.mock.calls[0];
    expect(decisionContext.operatorFollowedRecommendation).toBe(true);
    expect(decisionContext.operatorOverrideReason).toBeNull();
  });

  it('marks operatorFollowedRecommendation false and carries the override reason when the steward keeps the OTHER side', async () => {
    const res = await POST(
      makeRequest({ survivorId: 'inv-b', mergedId: 'inv-a', operatorOverrideReason: 'inv-b has the citation the extractor missed' }),
      { params },
    );
    expect(res.status).toBe(200);
    const [survivorArg, mergedArg, , decisionContext] = mockMergeInvariants.mock.calls[0];
    expect(survivorArg).toBe('inv-b');
    expect(mergedArg).toEqual(['inv-a']);
    expect(decisionContext.recommendedId).toBe('inv-a');
    expect(decisionContext.operatorFollowedRecommendation).toBe(false);
    expect(decisionContext.operatorOverrideReason).toBe('inv-b has the citation the extractor missed');
  });

  it('ignores a blank/whitespace-only override reason (normalises to null)', async () => {
    const res = await POST(
      makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b', operatorOverrideReason: '   ' }),
      { params },
    );
    expect(res.status).toBe(200);
    const [, , , decisionContext] = mockMergeInvariants.mock.calls[0];
    expect(decisionContext.operatorOverrideReason).toBeNull();
  });
});

describe('POST duplicate-pairs/merge — response shape', () => {
  it('keeps the existing minimal response shape — no invented ActivityReceipt contract', async () => {
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    const body = await res.json();
    expect(body).toEqual({ ok: true, survivorId: 'inv-a', mergedId: 'inv-b' });
  });

  it('reports 409 when mergeInvariants itself throws', async () => {
    mockMergeInvariants.mockRejectedValue(new Error('survivor invariant not found'));
    const res = await POST(makeRequest({ survivorId: 'inv-a', mergedId: 'inv-b' }), { params });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('survivor invariant not found');
  });
});
