/**
 * authorizeReviewerAgreement — experiment-scoped Locker write (2026-09-11,
 * Progressive Surface pass, operator item 10: "wire an actual write path so
 * a real countersignature/freeze/reviewer-agreement act tags its Locker
 * record"). A genuine (not idempotent-replay) authorization must write one
 * Locker item via the canonical `addLockerItemForPersona` path, tagged
 * `[EXP:${experimentId}]` — the SAME bracket-tag convention LockerTab's
 * `itemScopeTag` filter already reads. A Locker-write failure must never
 * block the authorization itself (fail-soft, mirroring the existing receipt
 * creation in the same function).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockCreateActivityReceipt = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) => mockCreateActivityReceipt(...args),
}));

const mockAddLockerItemForPersona = vi.fn();
vi.mock('@/services/passport/lockerItems', () => ({
  addLockerItemForPersona: (...args: unknown[]) => mockAddLockerItemForPersona(...args),
}));

import { authorizeReviewerAgreement, EXP_P1_REVIEWER_AGREEMENT_V1 } from '@/services/research/reviewerAgreement';

/** A fake admin client: no existing authorization row (idempotency check
 *  returns null), then a successful insert. */
function fakeAdmin(): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    insert: () => chain,
    single: async () => ({
      data: {
        id: 'auth-new',
        persona_id: 'reviewer-1',
        reviewer_ref: 'ref-reviewer-1',
        passport_ref: null,
        agreement_id: EXP_P1_REVIEWER_AGREEMENT_V1.agreementId,
        agreement_version: EXP_P1_REVIEWER_AGREEMENT_V1.version,
        agreement_hash: 'ignored-in-this-test',
        experiment_id: 'EXP-P1',
        package_scope: '*',
        conflict_declared: false,
        conflict_statement: null,
        authorized_at: '2026-09-11T00:00:00.000Z',
        proof_ref: null,
        receipt_id: 'receipt-new',
        status: 'active',
      },
      error: null,
    }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

beforeEach(() => {
  mockCreateActivityReceipt.mockReset();
  mockCreateActivityReceipt.mockResolvedValue({ id: 'receipt-new' });
  mockAddLockerItemForPersona.mockReset();
  mockAddLockerItemForPersona.mockResolvedValue({ ok: true, item: { itemId: 'locker-1' } });
});

describe('authorizeReviewerAgreement — Locker tagging', () => {
  it('tags a Locker record with [EXP:<experimentId>] on a genuine new authorization', async () => {
    const result = await authorizeReviewerAgreement(fakeAdmin(), {
      personaId: 'reviewer-1',
      definition: EXP_P1_REVIEWER_AGREEMENT_V1,
      acknowledged: true,
      conflictDeclared: false,
    });
    expect(result.ok).toBe(true);

    expect(mockAddLockerItemForPersona).toHaveBeenCalledTimes(1);
    const [personaId, input] = mockAddLockerItemForPersona.mock.calls[0];
    expect(personaId).toBe('reviewer-1');
    expect(input.displayName).toContain('[EXP:EXP-P1]');
    expect(input.contentType).toBe('application/json');
    expect(input.downloadable).toBe(false);

    const payload = JSON.parse(input.plaintext);
    expect(payload.experimentId).toBe('EXP-P1');
    expect(payload.agreementId).toBe(EXP_P1_REVIEWER_AGREEMENT_V1.agreementId);
    expect(payload.receiptId).toBe('receipt-new');
  });

  it('never blocks the authorization when the Locker write fails', async () => {
    mockAddLockerItemForPersona.mockRejectedValue(new Error('locker unavailable'));
    const result = await authorizeReviewerAgreement(fakeAdmin(), {
      personaId: 'reviewer-1',
      definition: EXP_P1_REVIEWER_AGREEMENT_V1,
      acknowledged: true,
      conflictDeclared: false,
    });
    expect(result.ok).toBe(true);
  });
});
