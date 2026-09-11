/**
 * Supersession preserves evidence and removes authority to resolve the
 * superseded record (operator ruling 2026-07-31, following the
 * review.vP1.0eeba9fd8910 / review.vP1.4e379af743c8 incident).
 *
 * A superseded review must remain inspectable (GET still returns it, with
 * supersededBy/supersededReason so the client can render a banner) but must
 * never remain actionable — the server is the authority on this, not the
 * client's disabled buttons, per the same "exercised for real, not only
 * grepped" discipline tests/independent-review-lab-surface.test.ts already
 * established for this route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  // Truthy stand-in only — getReview/upsertReview are mocked below and never
  // actually dereference this client.
  getSupabaseServer: () => ({}),
}));

const mockGetReview = vi.fn();
const mockUpsertReview = vi.fn();
vi.mock('@/services/research/independentReviewStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/research/independentReviewStore')>();
  return {
    ...actual,
    getReview: (...args: unknown[]) => mockGetReview(...args),
    upsertReview: (...args: unknown[]) => mockUpsertReview(...args),
  };
});

import { GET, POST } from '@/app/api/research/review/[reviewId]/route';

function makeRequest(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetReview.mockReset();
  mockUpsertReview.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
});

const SUPERSEDED_ID = 'review.vP1.0eeba9fd8910';
const SUPERSEDING_ID = 'review.vP1.4e379af743c8';

const BASE_RECORD = {
  reviewId: SUPERSEDED_ID,
  queueState: 'planned' as const,
  request: {} as any,
  package: null,
  assignments: [],
  steward: {} as any,
  blockDecisions: [],
  r1Decisions: [],
  r2Decisions: [],
  resolutions: [],
  action: null,
  actionReason: null,
  actionByRef: null,
  actionAt: null,
  receiptId: null,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

describe('GET — a superseded review stays fully readable for audit history', () => {
  it('includes supersededBy and supersededReason in the response', async () => {
    mockGetReview.mockResolvedValue({
      ...BASE_RECORD,
      supersededBy: SUPERSEDING_ID,
      supersededReason: 'later operator-executed package with different governed population',
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ reviewId: SUPERSEDED_ID }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.review.supersededBy).toBe(SUPERSEDING_ID);
    expect(json.review.supersededReason).toBeTruthy();
  });

  it('returns null supersededBy for an ordinary review that was never superseded', async () => {
    mockGetReview.mockResolvedValue({ ...BASE_RECORD, supersededBy: undefined, supersededReason: undefined });
    const res = await GET(makeRequest(), { params: Promise.resolve({ reviewId: SUPERSEDED_ID }) });
    const json = await res.json();
    expect(json.review.supersededBy).toBeNull();
  });
});

describe('POST — a superseded review can no longer be governed-resolved', () => {
  for (const action of ['accept', 'revise', 'defer', 'reject'] as const) {
    it(`refuses "${action}" on a superseded review with REVIEW_SUPERSEDED, and never writes`, async () => {
      mockGetReview.mockResolvedValue({
        ...BASE_RECORD,
        supersededBy: SUPERSEDING_ID,
        supersededReason: 'later operator-executed package with different governed population',
      });
      const res = await POST(makeRequest({ action, reason: 'attempting resolution anyway' }), {
        params: Promise.resolve({ reviewId: SUPERSEDED_ID }),
      });
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.ok).toBe(false);
      expect(json.refusalCode).toBe('REVIEW_SUPERSEDED');
      expect(json.reviewId).toBe(SUPERSEDED_ID);
      expect(json.supersededBy).toBe(SUPERSEDING_ID);
      expect(mockUpsertReview).not.toHaveBeenCalled();
    });
  }

  it('does not rely only on the disabled client buttons — a direct POST is refused just the same', async () => {
    // Same request shape a client bypassing its own disabled-button UI would
    // send. The refusal must come from the server, not from what the button
    // let the user click (the discipline tests/independent-review-lab-surface
    // already established for the same-family guard).
    mockGetReview.mockResolvedValue({ ...BASE_RECORD, supersededBy: SUPERSEDING_ID, supersededReason: 'x' });
    const res = await POST(makeRequest({ action: 'accept', reason: 'bypassing the UI' }), {
      params: Promise.resolve({ reviewId: SUPERSEDED_ID }),
    });
    expect(res.status).toBe(409);
    expect(mockUpsertReview).not.toHaveBeenCalled();
  });

  it('still allows a governed resolution on an ordinary, non-superseded review', async () => {
    mockGetReview.mockResolvedValue({ ...BASE_RECORD, supersededBy: undefined, supersededReason: undefined });
    mockUpsertReview.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ action: 'defer', reason: 'pending governed resolution of contested items' }), {
      params: Promise.resolve({ reviewId: SUPERSEDED_ID }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockUpsertReview).toHaveBeenCalledTimes(1);
  });
});
