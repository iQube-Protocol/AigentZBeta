/**
 * services/research/reviewExecutiveSummary.ts — a STEWARD-ONLY narrative
 * over data already unredacted to them (operator direction, 2026-08-05).
 * Never touches the sealed package the blinded reviewers receive; these
 * tests lock in the input shape (only the already-visible summary fields)
 * and the defensive validation (a parse failure never silently becomes an
 * empty "no issues" summary).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallSovereign = vi.fn();
vi.mock('@/services/constitutional/modelRouter', () => ({
  callSovereign: (...args: any[]) => mockCallSovereign(...args),
}));

import { summarizeReviewPackage } from '@/services/research/reviewExecutiveSummary';

const INPUT = {
  corpusRowCount: 400,
  inBoundaryCount: 120,
  outOfBoundaryCount: 280,
  classC: { assessed: 40, admitted: 12, extracted: 12, ruling: 'admissible' },
  individuallyEnumerated: 108,
  mechanicallyFlaggedCount: 3,
  reviewerCount: 2,
};

beforeEach(() => {
  mockCallSovereign.mockReset();
});

describe('summarizeReviewPackage — happy path', () => {
  it('returns validated strengths/weaknesses/openQuestions', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        strengths: ['Coverage spans a large corpus.', 'Class C admissibility ruling is clean.'],
        weaknesses: ['Only 3 rows were mechanically flagged for extra scrutiny.'],
        openQuestions: [],
      }),
    });
    const result = await summarizeReviewPackage(INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.strengths).toHaveLength(2);
    expect(result.summary.weaknesses).toHaveLength(1);
    expect(result.summary.openQuestions).toEqual([]);
  });

  it('passes only the already-steward-visible summary fields to the prompt, never a sealed package', async () => {
    mockCallSovereign.mockResolvedValue({ text: JSON.stringify({ strengths: [], weaknesses: [], openQuestions: [] }) });
    await summarizeReviewPackage(INPUT);
    const [, , user] = mockCallSovereign.mock.calls[0];
    expect(user).toContain('400');
    expect(user).toContain('admissible');
    expect(user).not.toMatch(/packageHash|preview|blinded/i);
  });
});

describe('summarizeReviewPackage — defensive validation', () => {
  it('drops non-string entries and caps each list at 5', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({
        strengths: Array.from({ length: 8 }, (_, i) => `strength ${i}`),
        weaknesses: [null, 42, '  ', 'a real weakness'],
        openQuestions: 'not an array',
      }),
    });
    const result = await summarizeReviewPackage(INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.strengths).toHaveLength(5);
    expect(result.summary.weaknesses).toEqual(['a real weakness']);
    expect(result.summary.openQuestions).toEqual([]);
  });

  it('returns ok:false, never a fabricated all-clear summary, when the provider call throws', async () => {
    mockCallSovereign.mockRejectedValue(new Error('all providers failed'));
    const result = await summarizeReviewPackage(INPUT);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false, never a fabricated all-clear summary, when the model does not return parseable JSON', async () => {
    mockCallSovereign.mockResolvedValue({ text: 'Looks fine to me!' });
    const result = await summarizeReviewPackage(INPUT);
    expect(result.ok).toBe(false);
  });
});
