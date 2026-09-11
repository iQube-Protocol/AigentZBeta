/**
 * POST /api/research/track2/[experimentId]/reconcile (al, 2026-08-04).
 *
 * Applies each treatment through the EXISTING canonical capability, never a
 * parallel write path, and receipts each one INDIVIDUALLY — a partial batch
 * failure must disclose exactly which records were treated and which were
 * not, never a single pass/fail summary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockRepair = vi.fn();
const mockExclude = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  repairPromotedCandidateInvariantLink: (...args: any[]) => mockRepair(...args),
  excludeCandidateFromCrystal: (...args: any[]) => mockExclude(...args),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}-${Math.random()}` }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { POST } from '@/app/api/research/track2/[experimentId]/reconcile/route';

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockRepair.mockReset();
  mockExclude.mockReset();
  mockCreateActivityReceipt.mockClear();
});

const params = Promise.resolve({ experimentId: 'EXP-P1' });

describe('POST reconcile — auth and validation', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest({ treatments: [] }), { params });
    expect(res.status).toBe(401);
  });

  it('refuses a non-steward caller', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest({ treatments: [] }), { params });
    expect(res.status).toBe(403);
  });

  it('refuses an empty treatments array', async () => {
    const res = await POST(makeRequest({ treatments: [] }), { params });
    expect(res.status).toBe(400);
  });

  it('refuses an exclude treatment with no reason', async () => {
    const res = await POST(makeRequest({ treatments: [{ candidateId: 'c1', treatment: 'exclude' }] }), { params });
    expect(res.status).toBe(400);
  });

  it('refuses an unknown experiment', async () => {
    const res = await POST(makeRequest({ treatments: [{ candidateId: 'c1', treatment: 'exclude', reason: 'x' }] }), {
      params: Promise.resolve({ experimentId: 'not-a-real-experiment' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST reconcile — repair', () => {
  it('calls the canonical repair capability and receipts the outcome', async () => {
    mockRepair.mockResolvedValue({ ok: true, invariantId: 'inv-repaired' });
    const res = await POST(makeRequest({ treatments: [{ candidateId: 'c1', treatment: 'repair' }] }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.outcomes[0]).toMatchObject({ candidateId: 'c1', treatment: 'repair', ok: true, invariantId: 'inv-repaired' });
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'population_record_repaired', personaId: 'persona-steward' }),
    );
  });

  it('reports a repair refusal (e.g. no deterministic match) as a failed outcome, not an HTTP error', async () => {
    mockRepair.mockResolvedValue({ ok: false, reason: 'no-deterministic-match', detail: 'steward judgment required' });
    const res = await POST(makeRequest({ treatments: [{ candidateId: 'c1', treatment: 'repair' }] }), { params });
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body.ok).toBe(false);
    expect(body.outcomes[0]).toMatchObject({ ok: false, detail: 'steward judgment required' });
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });
});

describe('POST reconcile — exclude', () => {
  it('calls the canonical exclude capability with the operator-supplied reason and receipts it', async () => {
    mockExclude.mockResolvedValue({ ok: true });
    const res = await POST(
      makeRequest({ treatments: [{ candidateId: 'c2', treatment: 'exclude', reason: 'duplicate resolution' }] }),
      { params },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockExclude).toHaveBeenCalledWith(
      expect.anything(),
      'c2',
      expect.objectContaining({ reason: 'duplicate resolution', excludedBy: 'persona-steward', crystalId: 'EXP-P1' }),
    );
    expect(mockCreateActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'population_record_excluded' }),
    );
    expect(body.outcomes[0]).toMatchObject({ candidateId: 'c2', treatment: 'exclude', ok: true });
  });
});

describe('POST reconcile — batch discloses partial failure per record', () => {
  it('one repair succeeds and one exclude fails — both outcomes reported individually, receipt only for the success', async () => {
    mockRepair.mockResolvedValue({ ok: true, invariantId: 'inv-x' });
    mockExclude.mockResolvedValue({ ok: false, reason: 'not-found', detail: 'no candidate "c-ghost"' });
    const res = await POST(
      makeRequest({
        treatments: [
          { candidateId: 'c1', treatment: 'repair' },
          { candidateId: 'c-ghost', treatment: 'exclude', reason: 'x' },
        ],
      }),
      { params },
    );
    const body = await res.json();
    expect(res.status).toBe(207); // multi-status — partial success
    expect(body.ok).toBe(false);
    expect(body.outcomes).toHaveLength(2);
    expect(body.outcomes[0]).toMatchObject({ candidateId: 'c1', ok: true });
    expect(body.outcomes[1]).toMatchObject({ candidateId: 'c-ghost', ok: false, detail: 'no candidate "c-ghost"' });
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(1);
  });

  it('a batch of two identical deterministic repairs ("repair both") produces two receipts', async () => {
    mockRepair.mockResolvedValueOnce({ ok: true, invariantId: 'inv-a' }).mockResolvedValueOnce({ ok: true, invariantId: 'inv-b' });
    const res = await POST(
      makeRequest({
        treatments: [
          { candidateId: 'c1', treatment: 'repair' },
          { candidateId: 'c2', treatment: 'repair' },
        ],
      }),
      { params },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.outcomes.map((o: any) => o.invariantId)).toEqual(['inv-a', 'inv-b']);
    expect(mockCreateActivityReceipt).toHaveBeenCalledTimes(2);
  });
});
