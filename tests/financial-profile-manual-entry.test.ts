/**
 * MoneyPenny Financial Profile — manual entry (MPY2-2c, SPEC-MPY-002 §5,
 * 2026-09-02, operator direction: "financial-profile preparation... a
 * reviewed financial profile or supported manual preparation — not
 * navigation").
 *
 * Proves: computeManualFinancialProfile shares the SAME envelope policy as
 * the upload path (buildCandidateEnvelope), honestly reports what a single
 * self-reported estimate cannot supply (volatility, recurring commitments,
 * concentration) rather than fabricating or silently omitting them; the
 * manual route requires authentication, validates its input, writes
 * inputSource: 'manual_entry', and reuses the SAME risk-envelope derivation
 * and canonical writer the upload path already uses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { computeManualFinancialProfile } from '@/services/financialServices/financialProfileAggregation';

describe('computeManualFinancialProfile — pure derivation', () => {
  it('positive surplus: proposes a candidate envelope, same policy as the upload path', () => {
    const result = computeManualFinancialProfile({ incomeMonthly: 5000, expenditureMonthly: 3500, liquidityBufferDays: 60 });
    expect(result.ok).toBe(true);
    expect(result.aggregates!.incomeMonthly).toBe(5000);
    expect(result.aggregates!.expenditureMonthly).toBe(3500);
    expect(result.aggregates!.availableSurplusMonthly).toBe(1500);
    expect(result.aggregates!.liquidityBufferDays).toBe(60);
    expect(result.envelope).toBeDefined();
    expect(result.envelope!.strategyConstraints.some((s) => /no authority to trade/i.test(s))).toBe(true);
  });

  it('never fabricates volatility, recurring commitments, or concentration — reports the limitation via notes', () => {
    const result = computeManualFinancialProfile({ incomeMonthly: 4000, expenditureMonthly: 2000 });
    expect(result.aggregates!.cashFlowVolatility).toBeNull();
    expect(result.aggregates!.recurringCommitments).toEqual([]);
    expect(result.aggregates!.topCategories).toEqual([]);
    expect(result.notes.some((n) => /self-reported estimate/i.test(n))).toBe(true);
  });

  it('omitted liquidityBufferDays is null, never guessed', () => {
    const result = computeManualFinancialProfile({ incomeMonthly: 3000, expenditureMonthly: 1000 });
    expect(result.aggregates!.liquidityBufferDays).toBeNull();
  });

  it('non-positive surplus: no candidate envelope is proposed (same rule as the upload path)', () => {
    const result = computeManualFinancialProfile({ incomeMonthly: 2000, expenditureMonthly: 2500 });
    expect(result.envelope).toBeUndefined();
    expect(result.notes.some((n) => /no candidate trading envelope is proposed/i.test(n))).toBe(true);
  });
});

// ── Route-level: authentication, validation, and reuse of the canonical
//    risk-envelope + writer functions (same mocking pattern as
//    tests/codex-upload-authorization.test.ts). ──────────────────────────

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
}));

const mockUpsertFinancialProfileQube = vi.fn();
vi.mock('@/services/iqube/financialProfileQube', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/iqube/financialProfileQube')>();
  return { ...actual, upsertFinancialProfileQube: (...args: unknown[]) => mockUpsertFinancialProfileQube(...args) };
});

import { POST as manualPost } from '@/app/api/moneypenny/financial-profile/manual/route';

function makeRequest(body: unknown) {
  return new NextRequest('https://dev-beta.aigentz.me/api/moneypenny/financial-profile/manual', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/moneypenny/financial-profile/manual', () => {
  beforeEach(() => {
    mockGetActivePersona.mockReset();
    mockUpsertFinancialProfileQube.mockReset();
  });

  it('refuses with 401 when there is no active persona', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await manualPost(makeRequest({ incomeMonthly: 4000, expenditureMonthly: 2000 }));
    expect(res.status).toBe(401);
    expect(mockUpsertFinancialProfileQube).not.toHaveBeenCalled();
  });

  it('refuses with 400 on a negative or non-numeric income/expenditure — never coerced into a guess', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1' });
    const res = await manualPost(makeRequest({ incomeMonthly: -100, expenditureMonthly: 2000 }));
    expect(res.status).toBe(400);
    expect(mockUpsertFinancialProfileQube).not.toHaveBeenCalled();
  });

  it('refuses with 400 on a negative liquidityBufferDays', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1' });
    const res = await manualPost(makeRequest({ incomeMonthly: 4000, expenditureMonthly: 2000, liquidityBufferDays: -5 }));
    expect(res.status).toBe(400);
  });

  it('writes inputSource: manual_entry and sourceUploadCount: 0 — never claims a statement source', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1' });
    mockUpsertFinancialProfileQube.mockResolvedValue({
      meta: { hasProfile: true, lastComputedAt: '2026-09-02T00:00:00.000Z', sourceUploadCount: 0, unreadableUploadCount: 0 },
      blak: { inputSource: 'manual_entry', aggregates: { incomeMonthly: 4000, expenditureMonthly: 2000, availableSurplusMonthly: 2000, cashFlowVolatility: null, liquidityBufferDays: null, recurringCommitments: [], topCategories: [] } },
    });
    const res = await manualPost(makeRequest({ incomeMonthly: 4000, expenditureMonthly: 2000 }));
    expect(res.status).toBe(200);
    expect(mockUpsertFinancialProfileQube).toHaveBeenCalledTimes(1);
    const [, input] = mockUpsertFinancialProfileQube.mock.calls[0];
    expect(input.sourceUploadCount).toBe(0);
    expect(input.blak.inputSource).toBe('manual_entry');
    const body = await res.json();
    expect(body.inputSource).toBe('manual_entry');
  });
});
