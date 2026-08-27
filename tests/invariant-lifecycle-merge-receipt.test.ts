/**
 * services/invariants/lifecycle.ts::mergeInvariants — decisionContext →
 * receipt `actionInput` threading (operator ruling, 2026-08-27, "final
 * corrections" pass on the Crystal v2 duplicate-adjudication queue).
 *
 * `mergeInvariants` gained a 4th, optional `decisionContext` parameter
 * forwarded verbatim to the EXISTING `invariant_superseded` receipt's
 * `actionInput` — no new action type, no change to the edge/context/status
 * preservation semantics this function already had.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetInvariantById = vi.fn();
const mockListEdgesForInvariants = vi.fn();
const mockUpdateEdgeEndpoints = vi.fn();
const mockDeleteEdge = vi.fn();
const mockListContexts = vi.fn();
const mockUpsertContext = vi.fn();
const mockUpdateInvariant = vi.fn();
const mockInsertEdge = vi.fn();
const mockInsertInvariant = vi.fn();

vi.mock('@/services/invariants/store', () => ({
  getInvariantById: (...args: any[]) => mockGetInvariantById(...args),
  listEdgesForInvariants: (...args: any[]) => mockListEdgesForInvariants(...args),
  updateEdgeEndpoints: (...args: any[]) => mockUpdateEdgeEndpoints(...args),
  deleteEdge: (...args: any[]) => mockDeleteEdge(...args),
  listContexts: (...args: any[]) => mockListContexts(...args),
  upsertContext: (...args: any[]) => mockUpsertContext(...args),
  updateInvariant: (...args: any[]) => mockUpdateInvariant(...args),
  insertEdge: (...args: any[]) => mockInsertEdge(...args),
  insertInvariant: (...args: any[]) => mockInsertInvariant(...args),
}));

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

import { mergeInvariants } from '@/services/invariants/lifecycle';

const SURVIVOR = {
  id: 'inv-a',
  statement: 'A statement.',
  timesValidated: 2,
  timesContradicted: 0,
  timesUsed: 1,
};
const MERGED = { id: 'inv-b', statement: 'B statement.' };

beforeEach(() => {
  mockGetInvariantById.mockReset();
  mockGetInvariantById.mockImplementation(async (id: string) => {
    if (id === 'inv-a') return SURVIVOR;
    if (id === 'inv-b') return MERGED;
    return null;
  });
  mockListEdgesForInvariants.mockReset();
  mockListEdgesForInvariants.mockResolvedValue([]);
  mockListContexts.mockReset();
  mockListContexts.mockResolvedValue([]);
  mockUpdateInvariant.mockReset();
  mockUpdateInvariant.mockResolvedValue(SURVIVOR);
  mockInsertEdge.mockReset();
  mockInsertEdge.mockResolvedValue({});
  mockCreateActivityReceipt.mockReset();
  mockCreateActivityReceipt.mockResolvedValue({});
});

const DECISION_CONTEXT = {
  experimentId: 'EXP-P1',
  pairIds: ['inv-a', 'inv-b'],
  survivorId: 'inv-a',
  mergedId: 'inv-b',
  recommendedId: 'inv-a',
  operatorFollowedRecommendation: true,
  confidence: 'high',
  reasons: [{ criterion: 'external-provenance-eligibility', detail: 'inv-a eligible, inv-b not' }],
  operatorOverrideReason: null,
};

describe('mergeInvariants — decisionContext receipt threading', () => {
  it('passes the decisionContext verbatim as actionInput on the invariant_superseded receipt', async () => {
    await mergeInvariants('inv-a', ['inv-b'], { personaId: 'persona-steward' }, DECISION_CONTEXT);
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 'persona-steward',
        actionType: 'invariant_superseded',
        actionInput: DECISION_CONTEXT,
      }),
    );
  });

  it('preserves prior behaviour — actionInput is null when no decisionContext is supplied (call-site compatibility)', async () => {
    await mergeInvariants('inv-a', ['inv-b'], { personaId: 'persona-steward' });
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(expect.objectContaining({ actionInput: null }));
  });

  it('actionInput is null when decisionContext is explicitly null', async () => {
    await mergeInvariants('inv-a', ['inv-b'], { personaId: 'persona-steward' }, null);
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(expect.objectContaining({ actionInput: null }));
  });

  it('does not invent a new action type — still invariant_superseded, the existing closed-union member', async () => {
    await mergeInvariants('inv-a', ['inv-b'], { personaId: 'persona-steward' }, DECISION_CONTEXT);
    const call = mockCreateActivityReceipt.mock.calls[0][0];
    expect(call.actionType).toBe('invariant_superseded');
  });

  it('unchanged preservation semantics: the merged row is marked superseded, not deleted or field-cleared', async () => {
    await mergeInvariants('inv-a', ['inv-b'], { personaId: 'persona-steward' }, DECISION_CONTEXT);
    expect(mockUpdateInvariant).toHaveBeenCalledWith('inv-b', { status: 'superseded' });
  });

  it('records a supersedes edge from survivor to merged', async () => {
    await mergeInvariants('inv-a', ['inv-b'], { personaId: 'persona-steward' }, DECISION_CONTEXT);
    expect(mockInsertEdge).toHaveBeenCalledWith(
      expect.objectContaining({ fromInvariantId: 'inv-a', toInvariantId: 'inv-b', edgeType: 'supersedes' }),
    );
  });
});
