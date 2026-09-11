/**
 * services/invariants/relationshipSuggestion.ts (operator direction,
 * 2026-08-04: "The graph engine should perform the reasoning; the human
 * should perform constitutional oversight.") — a SUGGESTION engine, never a
 * writer. These tests lock in the defensive validation: a hallucinated
 * related-id or an invalid relation type is DROPPED, never coerced, because
 * an accepted suggestion becomes a real graph write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallSovereign = vi.fn();
vi.mock('@/services/constitutional/modelRouter', () => ({
  callSovereign: (...args: any[]) => mockCallSovereign(...args),
}));

import { suggestRelationships } from '@/services/invariants/relationshipSuggestion';

const CANDIDATE = { id: 'inv-cyber', statement: 'Robust cybersecurity measures are critical for protecting financial services against threats and vulnerabilities.' };
const MEMBERS = [
  { id: 'inv-cyber', statement: CANDIDATE.statement }, // itself — must be excluded
  { id: 'inv-data', statement: 'Data protection is a core obligation for financial institutions.' },
  { id: 'inv-risk', statement: 'Risk management reduces the operational exposure of financial services.' },
];

beforeEach(() => {
  mockCallSovereign.mockReset();
});

describe('suggestRelationships — happy path', () => {
  it('returns validated, ranked suggestions from the model output', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        suggestions: [
          { relatedInvariantId: 'inv-risk', relationType: 'enables', rationale: 'Cybersecurity reduces operational risk.', confidence: 93 },
          { relatedInvariantId: 'inv-data', relationType: 'supports', rationale: 'Both protect financial assets and information.', confidence: 96 },
        ],
      }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // sorted by confidence descending, even though the model returned them out of order
    expect(result.suggestions.map((s) => s.relatedInvariantId)).toEqual(['inv-data', 'inv-risk']);
    expect(result.suggestions[0]).toMatchObject({ relationType: 'supports', confidence: 96, relatedLabel: MEMBERS[1].statement });
  });

  it('never offers the candidate itself as a related suggestion, even if the model somehow names it', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestions: [{ relatedInvariantId: 'inv-cyber', relationType: 'supports', rationale: 'x', confidence: 99 }] }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions).toEqual([]);
  });
});

describe('suggestRelationships — defensive validation (this becomes a real graph write)', () => {
  it('drops a suggestion whose relatedInvariantId was not in the offered candidate pool', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestions: [{ relatedInvariantId: 'inv-hallucinated', relationType: 'supports', rationale: 'x', confidence: 90 }] }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions).toEqual([]);
  });

  it('drops a suggestion whose relationType is not one of the twelve CFS-003 types', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestions: [{ relatedInvariantId: 'inv-data', relationType: 'is_kinda_like', rationale: 'x', confidence: 90 }] }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions).toEqual([]);
  });

  it('drops a suggestion with no rationale', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestions: [{ relatedInvariantId: 'inv-data', relationType: 'supports', rationale: '   ', confidence: 90 }] }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions).toEqual([]);
  });

  it('clamps an out-of-range confidence rather than trusting it', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ suggestions: [{ relatedInvariantId: 'inv-data', relationType: 'supports', rationale: 'x', confidence: 250 }] }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions[0].confidence).toBe(100);
  });

  it('returns ok:false, never a fabricated suggestion, when the provider call throws', async () => {
    mockCallSovereign.mockRejectedValue(new Error('all providers failed'));
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false, never a fabricated suggestion, when the model does not return parseable JSON', async () => {
    mockCallSovereign.mockResolvedValue({ text: 'Sure, here are some relationships: cybersecurity is nice.' });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(false);
  });

  it('caps suggestions at 5 even if the model returns more', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        suggestions: Array.from({ length: 8 }, (_, i) => ({
          relatedInvariantId: 'inv-data',
          relationType: 'supports',
          rationale: `reason ${i}`,
          confidence: 100 - i,
        })),
      }),
    });
    const result = await suggestRelationships(CANDIDATE, MEMBERS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions.length).toBe(5);
  });
});

describe('suggestRelationships — no candidates', () => {
  it('returns an empty suggestion list without calling the model at all when there are no other members', async () => {
    const result = await suggestRelationships(CANDIDATE, [MEMBERS[0]]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.suggestions).toEqual([]);
    expect(mockCallSovereign).not.toHaveBeenCalled();
  });
});
