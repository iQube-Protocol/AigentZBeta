/**
 * services/research/relationshipCohortPreparation.ts — Track 2 Stage 7's
 * relationship-cohort preparation (2026-09-05, operator audit of the
 * "Accept All High-Confidence (>95%)" batch shortcut). Proves the central
 * constitutional property this module exists to enforce: confidence is
 * NEVER the eligibility gate — disposition depends only on whether a
 * genuinely writable (non-contradicts, non-cycle) relationship exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSuggestRelationships = vi.fn();
vi.mock('@/services/invariants/relationshipSuggestion', () => ({
  suggestRelationships: (...args: any[]) => mockSuggestRelationships(...args),
}));

const mockWouldCreateCycle = vi.fn();
vi.mock('@/services/invariants', () => ({
  wouldCreateCycle: (...args: any[]) => mockWouldCreateCycle(...args),
}));

import {
  prepareRelationshipCohort,
  eligibleRelationshipCohortIds,
} from '@/services/research/relationshipCohortPreparation';

beforeEach(() => {
  mockSuggestRelationships.mockReset();
  mockWouldCreateCycle.mockReset();
  mockWouldCreateCycle.mockResolvedValue(false); // default: never a cycle
});

const MEMBERS = [
  { id: 'orphan-1', statement: 'Orphan one statement' },
  { id: 'orphan-2', statement: 'Orphan two statement' },
  { id: 'related-a', statement: 'Related A statement' },
  { id: 'related-b', statement: 'Related B statement' },
];

describe('prepareRelationshipCohort — confidence is informational, never the eligibility gate', () => {
  it('marks a member ready even with LOW confidence, as long as the suggestion is genuinely writable', async () => {
    mockSuggestRelationships.mockResolvedValueOnce({
      ok: true,
      suggestions: [
        { relatedInvariantId: 'related-a', relatedLabel: 'Related A', relationType: 'supports', rationale: 'r', confidence: 12 },
      ],
    });
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], MEMBERS);
    expect(recommendations[0]).toMatchObject({
      disposition: 'ready',
      relatedInvariantId: 'related-a',
      relationType: 'supports',
      confidence: 12,
    });
  });

  it('never proposes a contradicts edge — skips it and falls through to the next writable suggestion regardless of its (lower) confidence', async () => {
    mockSuggestRelationships.mockResolvedValueOnce({
      ok: true,
      suggestions: [
        { relatedInvariantId: 'related-a', relatedLabel: 'Related A', relationType: 'contradicts', rationale: 'r', confidence: 99 },
        { relatedInvariantId: 'related-b', relatedLabel: 'Related B', relationType: 'supports', rationale: 'r2', confidence: 30 },
      ],
    });
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], MEMBERS);
    expect(recommendations[0]).toMatchObject({ disposition: 'ready', relatedInvariantId: 'related-b', relationType: 'supports', confidence: 30 });
  });

  it('skips a cycle-creating suggestion and falls through to the next candidate', async () => {
    mockSuggestRelationships.mockResolvedValueOnce({
      ok: true,
      suggestions: [
        { relatedInvariantId: 'related-a', relatedLabel: 'Related A', relationType: 'derives_from', rationale: 'r', confidence: 95 },
        { relatedInvariantId: 'related-b', relatedLabel: 'Related B', relationType: 'supports', rationale: 'r2', confidence: 50 },
      ],
    });
    mockWouldCreateCycle.mockImplementation(async (_from: string, to: string) => to === 'related-a');
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], MEMBERS);
    expect(recommendations[0]).toMatchObject({ disposition: 'ready', relatedInvariantId: 'related-b' });
  });

  it("exception 'no-writable-suggestion' when every candidate is contradicts or would create a cycle — never silently skipped, never guessed", async () => {
    mockSuggestRelationships.mockResolvedValueOnce({
      ok: true,
      suggestions: [
        { relatedInvariantId: 'related-a', relatedLabel: 'Related A', relationType: 'contradicts', rationale: 'r', confidence: 99 },
        { relatedInvariantId: 'related-b', relatedLabel: 'Related B', relationType: 'derives_from', rationale: 'r2', confidence: 95 },
      ],
    });
    mockWouldCreateCycle.mockResolvedValue(true);
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], MEMBERS);
    expect(recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'no-writable-suggestion', relatedInvariantId: null });
  });

  it("exception 'no-suggestions' when suggestRelationships returns ok:false, never guessing a relationship", async () => {
    mockSuggestRelationships.mockResolvedValueOnce({ ok: false, error: 'model unavailable' });
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], MEMBERS);
    expect(recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'no-suggestions', exceptionDetail: 'model unavailable' });
  });

  it("exception 'no-suggestions' when suggestRelationships returns zero candidates", async () => {
    mockSuggestRelationships.mockResolvedValueOnce({ ok: true, suggestions: [] });
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], MEMBERS);
    expect(recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'no-suggestions' });
  });

  it("exception 'no-candidates' when no other crystal member exists to relate to — never calls the model", async () => {
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0]], [MEMBERS[0]]);
    expect(recommendations[0]).toMatchObject({ disposition: 'exception', exceptionCause: 'no-candidates' });
    expect(mockSuggestRelationships).not.toHaveBeenCalled();
  });

  it('calls suggestRelationships exactly once PER ORPHAN, concurrently — never serialized, never once per member pair', async () => {
    mockSuggestRelationships.mockResolvedValue({
      ok: true,
      suggestions: [{ relatedInvariantId: 'related-a', relatedLabel: 'Related A', relationType: 'supports', rationale: 'r', confidence: 80 }],
    });
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0], MEMBERS[1]], MEMBERS);
    expect(recommendations).toHaveLength(2);
    expect(mockSuggestRelationships).toHaveBeenCalledTimes(2);
  });

  it('eligibleRelationshipCohortIds returns only the ready subset', async () => {
    mockSuggestRelationships
      .mockResolvedValueOnce({ ok: true, suggestions: [{ relatedInvariantId: 'related-a', relatedLabel: 'A', relationType: 'supports', rationale: 'r', confidence: 80 }] })
      .mockResolvedValueOnce({ ok: true, suggestions: [] });
    const { recommendations } = await prepareRelationshipCohort([MEMBERS[0], MEMBERS[1]], MEMBERS);
    expect(eligibleRelationshipCohortIds(recommendations)).toEqual(['orphan-1']);
  });
});
