/**
 * GET /api/research/track2/[experimentId]/bridge-candidates and its batch
 * sibling POST .../accept-bridges — Stage 9's graph-connectivity remediation
 * (operator direction, 2026-08-05). GET reads the SAME intra-crystal edge
 * set the readiness engine computes and proposes relationships only between
 * DIFFERENT components; it never writes. Accept-bridges applies the SAME
 * validation the existing single-edge route enforces, per bridge
 * independently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: any[]) => mockListInvariants(...args),
}));

const mockFetchIntraCrystalEdges = vi.fn();
const mockConnectedComponents = vi.fn();
vi.mock('@/services/research/crystalReadiness', () => ({
  fetchIntraCrystalEdges: (...args: any[]) => mockFetchIntraCrystalEdges(...args),
  connectedComponents: (...args: any[]) => mockConnectedComponents(...args),
}));

const mockSuggestRelationships = vi.fn();
vi.mock('@/services/invariants/relationshipSuggestion', () => ({
  suggestRelationships: (...args: any[]) => mockSuggestRelationships(...args),
}));

const mockAddEdge = vi.fn();
vi.mock('@/services/invariants', () => ({
  addEdge: (...args: any[]) => mockAddEdge(...args),
}));

import { GET } from '@/app/api/research/track2/[experimentId]/bridge-candidates/route';
import { POST as acceptBridges } from '@/app/api/research/track2/[experimentId]/accept-bridges/route';

function makeGetRequest(): NextRequest {
  return {} as unknown as NextRequest;
}
function makePostRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const params = Promise.resolve({ experimentId: 'EXP-P1' });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockListInvariants.mockReset();
  mockListInvariants.mockResolvedValue([
    { id: 'a', statement: 'Statement A' },
    { id: 'b', statement: 'Statement B' },
    { id: 'c', statement: 'Statement C' },
  ]);
  mockFetchIntraCrystalEdges.mockReset();
  mockFetchIntraCrystalEdges.mockResolvedValue({ pairs: [['a', 'b']], degree: new Map() });
  mockConnectedComponents.mockReset();
  mockConnectedComponents.mockReturnValue([['a', 'b'], ['c']]);
  mockSuggestRelationships.mockReset();
  mockAddEdge.mockReset();
});

describe('GET bridge-candidates', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params });
    expect(res.status).toBe(401);
  });

  it('reports zero candidates when the crystal is already one component', async () => {
    mockConnectedComponents.mockReturnValue([['a', 'b', 'c']]);
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(body.componentCount).toBe(1);
    expect(body.candidates).toEqual([]);
    expect(mockSuggestRelationships).not.toHaveBeenCalled();
  });

  it('proposes a bridge from the smaller component to the largest, never within the largest itself', async () => {
    mockSuggestRelationships.mockResolvedValue({
      ok: true,
      suggestions: [{ relatedInvariantId: 'a', relatedLabel: 'Statement A', relationType: 'supports', rationale: 'x', confidence: 77 }],
    });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]).toMatchObject({
      invariantAId: 'c',
      invariantBId: 'a',
      relationType: 'supports',
      componentsJoined: [1, 2],
    });
    // Called with the SMALL component's member as candidate, the LARGEST component as the pool.
    expect(mockSuggestRelationships).toHaveBeenCalledWith(
      { id: 'c', statement: 'Statement C' },
      [{ id: 'a', statement: 'Statement A' }, { id: 'b', statement: 'Statement B' }],
    );
  });

  it('never fabricates a bridge when the engine refuses', async () => {
    mockSuggestRelationships.mockResolvedValue({ ok: false, error: 'inference failed' });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(body.candidates).toEqual([]);
  });
});

describe('POST accept-bridges', () => {
  it('refuses an empty batch', async () => {
    const res = await acceptBridges(makePostRequest({ bridges: [] }), { params });
    expect(res.status).toBe(400);
  });

  it('applies the SAME validation as the single-edge route — bad relation type refused per-item, not batch-wide', async () => {
    const res = await acceptBridges(
      makePostRequest({
        bridges: [
          { fromInvariantId: 'a', toInvariantId: 'b', relation: 'not-a-real-type', rationale: 'x' },
          { fromInvariantId: 'a', toInvariantId: 'c', relation: 'supports', rationale: 'x' },
        ],
      }),
      { params },
    );
    const body = await res.json();
    expect(body.written).toBe(1);
    expect(body.outcomes[0].error).toContain('relation must be one of');
    expect(body.outcomes[1].written).toBe(true);
    expect(mockAddEdge).toHaveBeenCalledTimes(1);
  });

  it('refuses a self-loop and an empty rationale, per item', async () => {
    const res = await acceptBridges(
      makePostRequest({
        bridges: [
          { fromInvariantId: 'a', toInvariantId: 'a', relation: 'supports', rationale: 'x' },
          { fromInvariantId: 'a', toInvariantId: 'b', relation: 'supports', rationale: '' },
        ],
      }),
      { params },
    );
    const body = await res.json();
    expect(body.written).toBe(0);
    expect(body.outcomes[0].error).toContain('cannot relate to itself');
    expect(body.outcomes[1].error).toContain('rationale is required');
  });

  it('one cycle refusal never blocks the other bridges in the same batch', async () => {
    mockAddEdge.mockImplementation(async (input: any) =>
      input.toInvariantId === 'b' ? Promise.reject(new Error('edge would create a cycle')) : { id: 'edge-1' },
    );
    const res = await acceptBridges(
      makePostRequest({
        bridges: [
          { fromInvariantId: 'a', toInvariantId: 'b', relation: 'depends_on', rationale: 'x' },
          { fromInvariantId: 'a', toInvariantId: 'c', relation: 'supports', rationale: 'x' },
        ],
      }),
      { params },
    );
    const body = await res.json();
    expect(body.written).toBe(1);
    expect(body.outcomes[0].error).toContain('cycle');
    expect(body.outcomes[1].written).toBe(true);
  });
});
