/**
 * Treatment-fidelity tests for `services/invariants/taskScopedSelection.ts`
 * — the corrected Arm B selector (2026-09-07 audit + implementation).
 *
 * Proves the six properties the audit required before Arm B could be trusted
 * as a faithful representation of "IRL's complete pipeline... per-task
 * intent-scoped selection" (EXP-P1 README §4):
 *
 *   1. Two materially different tasks over the same pool can produce
 *      different selections (intent actually matters).
 *   2. A highly-standing but irrelevant invariant cannot displace a
 *      lower-standing directly-relevant one solely because of standing.
 *   3. Standing orders comparable (already-relevant) candidates.
 *   4. A graph-required supporting invariant (no direct lexical match) can
 *      enter the selection before truncation.
 *   5. No answer-key field (task.keywords or similar) affects selection —
 *      the function has no such parameter, and two calls differing only in
 *      such out-of-band data produce identical output.
 *   6. The same intent + pool + selector version is deterministic.
 *
 * `listInvariants` (store.ts) and `dependencyClosure` (graph.ts) are mocked —
 * both are real Supabase-backed substrate readers; this suite tests the
 * SELECTION LOGIC composed on top of them, not the DB layer itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InvariantRecord, TraversalResult } from '@/types/invariants';

const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: unknown[]) => mockListInvariants(...args),
}));

const mockDependencyClosure = vi.fn();
vi.mock('@/services/invariants/graph', () => ({
  dependencyClosure: (...args: unknown[]) => mockDependencyClosure(...args),
}));

import { selectTaskScopedInvariants, TASK_SCOPED_SELECTOR_VERSION } from '@/services/invariants/taskScopedSelection';

function inv(overrides: Partial<InvariantRecord> & { id: string; statement: string }): InvariantRecord {
  return {
    seedId: null,
    namespace: 'finance',
    ontologyClassId: null,
    semanticType: null,
    status: 'validated',
    confidence: 0.8,
    confidenceBasis: 'validation-class',
    standing: 50,
    reach: 10,
    timesValidated: 3,
    timesContradicted: 0,
    timesReferenced: 0,
    timesUsed: 0,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    provenance: {},
    reasoningProvenance: {},
    creatorAliasCommitment: null,
    dvnReceiptId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as InvariantRecord;
}

function emptyClosure(rootIds: string[]): TraversalResult {
  return { roots: rootIds, nodes: [], edges: [], truncated: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDependencyClosure.mockImplementation((ids: string[]) => Promise.resolve(emptyClosure(ids)));
});

describe('selectTaskScopedInvariants — treatment-fidelity properties', () => {
  it('1. two materially different tasks over the same pool produce different selections', async () => {
    const pool = [
      inv({ id: 'inv-risk', statement: 'Financial institutions must manage risk exposure carefully.', standing: 40 }),
      inv({ id: 'inv-custody', statement: 'Custody arrangements require segregation of client assets from a custodian\'s own.', standing: 40 }),
    ];
    mockListInvariants.mockResolvedValue(pool);

    const riskTask = await selectTaskScopedInvariants({ intentText: 'What does the record say about risk?' });
    const custodyTask = await selectTaskScopedInvariants({ intentText: 'What does the record say about custody?' });

    expect(riskTask.selectedIds).toEqual(['inv-risk']);
    expect(custodyTask.selectedIds).toEqual(['inv-custody']);
    expect(riskTask.selectedIds).not.toEqual(custodyTask.selectedIds);
    expect(riskTask.usedRelevanceFallback).toBe(false);
    expect(custodyTask.usedRelevanceFallback).toBe(false);
  });

  it('2. a highly-standing but irrelevant invariant cannot displace a lower-standing relevant one', async () => {
    const irrelevantButHighStanding = inv({
      id: 'inv-irrelevant-high-standing',
      statement: 'Payment systems must ensure the protection of personal data.',
      standing: 99,
      confidence: 0.99,
      reach: 99,
    });
    const relevantLowStanding = inv({
      id: 'inv-relevant-low-standing',
      statement: 'Custodians must segregate client assets to manage custody risk.',
      standing: 5,
      confidence: 0.3,
      reach: 1,
    });
    mockListInvariants.mockResolvedValue([irrelevantButHighStanding, relevantLowStanding]);

    const result = await selectTaskScopedInvariants({
      intentText: 'What does the record say about custody?',
      limit: 1,
    });

    // The task asks about custody. The irrelevant invariant shares NO token
    // with the intent and never becomes eligible — no amount of standing
    // lets it in, even with a limit of 1 that would otherwise "waste" the
    // budget on the wrong item if standing were used globally.
    expect(result.selectedIds).toEqual(['inv-relevant-low-standing']);
    expect(result.availableIds).toContain('inv-irrelevant-high-standing');
    expect(result.relevantIds).not.toContain('inv-irrelevant-high-standing');
  });

  it('3. standing orders comparable (already-relevant) candidates', async () => {
    const low = inv({ id: 'inv-low', statement: 'Risk management requires ongoing oversight.', standing: 10 });
    const high = inv({ id: 'inv-high', statement: 'Risk assessments must be conducted regularly.', standing: 90 });
    const mid = inv({ id: 'inv-mid', statement: 'Risk exposure must be documented.', standing: 50 });
    mockListInvariants.mockResolvedValue([low, high, mid]);

    const result = await selectTaskScopedInvariants({ intentText: 'What does the record say about risk?' });

    expect(result.relevantIds.sort()).toEqual(['inv-high', 'inv-low', 'inv-mid'].sort());
    expect(result.selectedIds).toEqual(['inv-high', 'inv-mid', 'inv-low']);
  });

  it('4. a graph-required supporting invariant can enter before truncation, with no direct lexical match', async () => {
    const root = inv({ id: 'inv-root', statement: 'Custodians must comply with custody regulations.', standing: 60 });
    const support = inv({
      id: 'inv-support',
      statement: 'Segregated accounts are maintained under a trust structure.',
      standing: 20,
    });
    mockListInvariants.mockResolvedValue([root, support]);
    mockDependencyClosure.mockImplementation((ids: string[]) =>
      Promise.resolve({
        roots: ids,
        nodes: [
          { invariant: root, depth: 0, viaEdge: null },
          { invariant: support, depth: 1, viaEdge: null },
        ],
        edges: [],
        truncated: false,
      } as TraversalResult),
    );

    const result = await selectTaskScopedInvariants({ intentText: 'What does the record say about custody?', limit: 10 });

    expect(result.relevantIds).toEqual(['inv-root']);
    expect(result.expandedIds.sort()).toEqual(['inv-root', 'inv-support'].sort());
    expect(result.selectedIds).toContain('inv-support');
    const supportItem = result.items.find((i) => i.id === 'inv-support');
    expect(supportItem?.viaGraphExpansion).toBe(true);
    expect(supportItem?.relevanceScore).toBe(0);
  });

  it('5. no answer-key field affects selection — keywords are not a parameter and are never consulted', async () => {
    const pool = [
      inv({ id: 'inv-a', statement: 'Risk oversight is required for all financial products.', standing: 30 }),
      inv({ id: 'inv-b', statement: 'Custody arrangements require regular audits.', standing: 70 }),
    ];
    mockListInvariants.mockResolvedValue(pool);

    // Simulate two "tasks" sharing the same prompt but with different
    // answer-key-shaped metadata that a caller must never forward — the
    // selector's own input type has no field for it, so this is enforced
    // structurally as well as behaviorally.
    const taskA = { prompt: 'What does the record say about risk?', keywords: ['risk'] };
    const taskB = { prompt: 'What does the record say about risk?', keywords: ['custody', 'trust', 'settlement'] };

    const resultA = await selectTaskScopedInvariants({ intentText: taskA.prompt });
    const resultB = await selectTaskScopedInvariants({ intentText: taskB.prompt });

    expect(resultA.selectedIds).toEqual(resultB.selectedIds);
    expect(resultA).toEqual(resultB);
  });

  it('6. the same intent + pool + selector version is deterministic', async () => {
    const pool = [
      inv({ id: 'inv-1', statement: 'Risk governance requires board oversight.', standing: 42.5, confidence: 0.712, reach: 8.3 }),
      inv({ id: 'inv-2', statement: 'Risk reporting must be timely and accurate.', standing: 42.5, confidence: 0.712, reach: 8.3 }),
    ];
    mockListInvariants.mockResolvedValue(pool);

    const first = await selectTaskScopedInvariants({ intentText: 'What does the record say about risk?' });
    const second = await selectTaskScopedInvariants({ intentText: 'What does the record say about risk?' });

    expect(first).toEqual(second);
    // Exact standing/confidence/reach tie — the id-ascending tiebreak makes
    // the order deterministic rather than dependent on incidental array order.
    expect(first.selectedIds).toEqual(['inv-1', 'inv-2']);
    expect(first.selectorVersion).toBe(TASK_SCOPED_SELECTOR_VERSION);
  });

  it('never hard-gates on semanticType — a relevant candidate of any type is eligible', async () => {
    const pool = [
      inv({ id: 'inv-def', statement: 'Custody means the safekeeping of client assets.', semanticType: 'definition', standing: 20 }),
      inv({ id: 'inv-law', statement: 'Custody arrangements are governed by law.', semanticType: 'law', standing: 20 }),
    ];
    mockListInvariants.mockResolvedValue(pool);

    const result = await selectTaskScopedInvariants({ intentText: 'What does the record say about custody?' });

    expect(result.selectedIds.sort()).toEqual(['inv-def', 'inv-law'].sort());
    const defItem = result.items.find((i) => i.id === 'inv-def');
    expect(defItem?.functionalRole).toBe('definition');
  });

  it('empty-relevance case falls back honestly and flags it, never silently substituting standing for relevance', async () => {
    const pool = [
      inv({ id: 'inv-x', statement: 'Completely unrelated statement about weather patterns.', standing: 10 }),
      inv({ id: 'inv-y', statement: 'Another unrelated statement about gardening techniques.', standing: 90 }),
    ];
    mockListInvariants.mockResolvedValue(pool);

    const result = await selectTaskScopedInvariants({ intentText: 'What does the record say about cryptography?' });

    expect(result.usedRelevanceFallback).toBe(true);
    expect(result.selectedIds).toEqual(['inv-y', 'inv-x']); // standing-ranked fallback, still deterministic
    expect(result.items.every((i) => i.relevanceBasis?.includes('fallback'))).toBe(true);
  });

  it('never computes valueEstimate/riskOfRepairEstimate — stage 5 stays a named no-op', async () => {
    mockListInvariants.mockResolvedValue([inv({ id: 'inv-1', statement: 'Risk oversight is required.', standing: 10 })]);
    const result = await selectTaskScopedInvariants({ intentText: 'What about risk?' });
    for (const item of result.items) {
      expect(item.valueEstimate).toBeNull();
      expect(item.riskOfRepairEstimate).toBeNull();
    }
  });

  it('restrictToIds keeps the entire pipeline (pool, relevance, graph expansion) inside a frozen id set', async () => {
    const inScope = inv({ id: 'inv-in', statement: 'Custody arrangements require oversight.', standing: 10 });
    const outOfScope = inv({ id: 'inv-out', statement: 'Custody rules changed after the freeze.', standing: 10 });
    mockListInvariants.mockResolvedValue([inScope, outOfScope]);
    mockDependencyClosure.mockImplementation(() =>
      Promise.resolve({
        roots: ['inv-in'],
        nodes: [
          { invariant: inScope, depth: 0, viaEdge: null },
          { invariant: outOfScope, depth: 1, viaEdge: null }, // a post-freeze graph neighbour
        ],
        edges: [],
        truncated: false,
      } as TraversalResult),
    );

    const result = await selectTaskScopedInvariants({
      intentText: 'What does the record say about custody?',
      restrictToIds: ['inv-in'],
    });

    expect(result.availableIds).toEqual(['inv-in']);
    expect(result.expandedIds).toEqual(['inv-in']);
    expect(result.selectedIds).toEqual(['inv-in']);
  });
});
