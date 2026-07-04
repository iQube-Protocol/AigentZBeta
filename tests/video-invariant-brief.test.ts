/**
 * Invariant-grounded video brief — canaries (CFS-011 §6, Chrysalis EXP-002).
 *
 * getInvariantsByIds/listMembers are mocked (they hit Supabase); this pins
 * the deterministic composition logic: marker formatting, round-robin
 * distribution, continuity block, and the always-available template
 * fallback (useLlm: false — no network dependency).
 */

import { describe, expect, it, vi } from 'vitest';
import type { InvariantRecord } from '@/types/invariants';

vi.mock('@/services/invariants/store', () => ({
  getInvariantsByIds: vi.fn(async (ids: string[]) =>
    ids.map((id) => MOCK_INVARIANTS[id]).filter(Boolean),
  ),
}));
vi.mock('@/services/invariants/collections', () => ({
  listMembers: vi.fn(async (collectionId: string) =>
    (MOCK_COLLECTIONS[collectionId] ?? []).map((invariantId, position) => ({ invariantId, position })),
  ),
}));

function makeInvariant(id: string, seedId: string, statement: string): InvariantRecord {
  return {
    id,
    seedId,
    statement,
    namespace: 'constitutional',
    ontologyClassId: null,
    semanticType: 'principle',
    status: 'proposed',
    confidence: 0.85,
    confidenceBasis: 'principal_verified',
    standing: 0,
    reach: 0,
    timesValidated: 0,
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
    createdAt: '2026-07-04T00:00:00Z',
    updatedAt: '2026-07-04T00:00:00Z',
  };
}

const MOCK_INVARIANTS: Record<string, InvariantRecord> = {
  'style-1': makeInvariant('style-1', 'inv.style.001', "The protagonist's appearance remains identical across every segment."),
  'style-2': makeInvariant('style-2', 'inv.style.002', 'Lighting language and palette remain identical across every segment.'),
  'sem-1': makeInvariant('sem-1', 'inv.constitutional.011', 'Personhood precedes identity.'),
  'sem-2': makeInvariant('sem-2', 'inv.constitutional.012', 'Standing follows action.'),
  'sem-3': makeInvariant('sem-3', 'inv.constitutional.013', 'Authority follows standing.'),
  'sem-4': makeInvariant('sem-4', 'inv.constitutional.060', 'Truth is established through validation, not popularity.'),
  'narr-1': makeInvariant('narr-1', 'inv.narrative.001', 'Opening state.'),
  'narr-2': makeInvariant('narr-2', 'inv.narrative.002', 'Inciting realization.'),
  'narr-3': makeInvariant('narr-3', 'inv.narrative.003', 'Constitutional tension.'),
  'narr-4': makeInvariant('narr-4', 'inv.narrative.004', 'Resolution.'),
  'narr-5': makeInvariant('narr-5', 'inv.narrative.005', 'Constitutional transformation.'),
};

const MOCK_COLLECTIONS: Record<string, string[]> = {
  'style-collection': ['style-1', 'style-2'],
  'semantic-collection': ['sem-1', 'sem-2', 'sem-3', 'sem-4'],
  // Deliberately shuffled insertion order — the generator must sort by seed
  // ordinal, not trust collection membership order, to preserve arc sequence.
  'narrative-collection': ['narr-3', 'narr-1', 'narr-5', 'narr-2', 'narr-4'],
};

const { buildVideoInvariantBrief } = await import('@/services/video/invariantVideoBrief');

describe('buildVideoInvariantBrief — template path (useLlm: false)', () => {
  it('builds a continuity block from style-role groundings only', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'style-collection', role: 'style' },
        { collectionId: 'semantic-collection', role: 'semantic' },
      ],
      segmentCount: 2,
      useLlm: false,
    });
    expect(brief.continuityBlock).toContain('[S-001]');
    expect(brief.continuityBlock).toContain('[S-002]');
    expect(brief.continuityBlock).not.toContain('[C-011]'); // semantic invariants stay out of the continuity block
  });

  it('distributes semantic invariants round-robin across segments with no overlap', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'style-collection', role: 'style' },
        { collectionId: 'semantic-collection', role: 'semantic' },
      ],
      segmentCount: 2,
      useLlm: false,
    });
    expect(brief.segments).toHaveLength(2);
    const allForegrounded = brief.segments.flatMap((s) => s.foregroundedInvariantIds);
    expect(new Set(allForegrounded).size).toBe(allForegrounded.length); // no duplicate assignment
    expect(allForegrounded.sort()).toEqual(['sem-1', 'sem-2', 'sem-3', 'sem-4'].sort());
    // round-robin: segment 0 gets indices 0,2 (sem-1, sem-3); segment 1 gets 1,3 (sem-2, sem-4)
    expect(brief.segments[0].foregroundedInvariantIds).toEqual(['sem-1', 'sem-3']);
    expect(brief.segments[1].foregroundedInvariantIds).toEqual(['sem-2', 'sem-4']);
  });

  it('every segment prompt carries the continuity block (template fallback)', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'style-collection', role: 'style' },
        { collectionId: 'semantic-collection', role: 'semantic' },
      ],
      segmentCount: 4,
      useLlm: false,
    });
    expect(brief.segments).toHaveLength(4);
    for (const segment of brief.segments) {
      expect(segment.composedBy).toBe('template');
      expect(segment.prompt).toContain('[S-001]');
    }
  });

  it('works with raw invariantIds (no pre-existing collection required)', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [{ invariantIds: ['sem-1', 'sem-2'], role: 'semantic' }],
      segmentCount: 2,
      useLlm: false,
    });
    expect(brief.semanticInvariantIds.sort()).toEqual(['sem-1', 'sem-2']);
    expect(brief.styleInvariantIds).toEqual([]);
    expect(brief.continuityBlock).toContain('No style grounding provided');
  });

  it('a segment with no foregrounded invariant still carries the continuity block', async () => {
    // 3 segments, 2 semantic invariants — segment 2 (index 2) gets nothing foregrounded.
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'style-collection', role: 'style' },
        { invariantIds: ['sem-1', 'sem-2'], role: 'semantic' },
      ],
      segmentCount: 3,
      useLlm: false,
    });
    expect(brief.segments[2].foregroundedInvariantIds).toEqual([]);
    expect(brief.segments[2].beat).toContain('no invariant foregrounded');
    expect(brief.segments[2].prompt).toContain('[S-001]'); // continuity still present
  });

  it('rejects a non-positive-integer segmentCount', async () => {
    await expect(
      buildVideoInvariantBrief({ groundings: [{ invariantIds: ['sem-1'], role: 'semantic' }], segmentCount: 0 }),
    ).rejects.toThrow();
  });
});

describe('narrative grounding (CFS-012) — sequential, never round-robin', () => {
  it('maps 5 beats onto 5 segments 1:1, in arc order, regardless of collection insertion order', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'narrative-collection', role: 'narrative' },
        { invariantIds: ['sem-1'], role: 'semantic' },
      ],
      segmentCount: 5,
      useLlm: false,
    });
    expect(brief.segments.map((s) => s.narrativeInvariantId)).toEqual([
      'narr-1', 'narr-2', 'narr-3', 'narr-4', 'narr-5',
    ]);
  });

  it('compresses 5 beats proportionally onto 4 segments without reordering', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'narrative-collection', role: 'narrative' },
        { invariantIds: ['sem-1'], role: 'semantic' },
      ],
      segmentCount: 4,
      useLlm: false,
    });
    const mapped = brief.segments.map((s) => s.narrativeInvariantId);
    // floor(i*5/4) for i=0..3 → 0,1,2,3 → narr-1..narr-4 (narr-5 compressed out
    // at this segment count — never reordered, always monotonic non-decreasing).
    expect(mapped).toEqual(['narr-1', 'narr-2', 'narr-3', 'narr-4']);
    const ordinals = mapped.map((id) => Number(id!.split('-')[1]));
    for (let i = 1; i < ordinals.length; i++) {
      expect(ordinals[i]).toBeGreaterThanOrEqual(ordinals[i - 1]); // monotonic — never goes backward
    }
  });

  it('stretches 5 beats across 8 segments, still monotonic and starting/ending on the first/last beat', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'narrative-collection', role: 'narrative' },
        { invariantIds: ['sem-1'], role: 'semantic' },
      ],
      segmentCount: 8,
      useLlm: false,
    });
    const mapped = brief.segments.map((s) => s.narrativeInvariantId);
    expect(mapped[0]).toBe('narr-1');
    expect(mapped[mapped.length - 1]).toBe('narr-5');
    const ordinals = mapped.map((id) => Number(id!.split('-')[1]));
    for (let i = 1; i < ordinals.length; i++) {
      expect(ordinals[i]).toBeGreaterThanOrEqual(ordinals[i - 1]);
    }
  });

  it('narrative invariants never enter the round-robin semantic pool', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [
        { collectionId: 'narrative-collection', role: 'narrative' },
        { invariantIds: ['sem-1', 'sem-2'], role: 'semantic' },
      ],
      segmentCount: 2,
      useLlm: false,
    });
    const allForegrounded = brief.segments.flatMap((s) => s.foregroundedInvariantIds);
    expect(allForegrounded.some((id) => id.startsWith('narr-'))).toBe(false);
    expect(brief.semanticInvariantIds.some((id) => id.startsWith('narr-'))).toBe(false);
    expect(brief.narrativeInvariantIds.sort()).toEqual(['narr-1', 'narr-2', 'narr-3', 'narr-4', 'narr-5'].sort());
  });

  it('is absent entirely when no narrative grounding is provided', async () => {
    const brief = await buildVideoInvariantBrief({
      groundings: [{ invariantIds: ['sem-1'], role: 'semantic' }],
      segmentCount: 3,
      useLlm: false,
    });
    expect(brief.narrativeInvariantIds).toEqual([]);
    expect(brief.segments.every((s) => s.narrativeInvariantId === null)).toBe(true);
  });
});
