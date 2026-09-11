/**
 * services/dvn/activityReceiptDvnPipeline.ts's reconcileLocalReceiptsToDvn()
 * — durable local -> dvn_pending recovery (Horizen Pilot Closure, "close
 * the DVN lifecycle completely", 2026-08-09).
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 *
 * `createActivityReceipt()` persists `receipt_status: 'local'` and invokes
 * DVN submission through an un-awaited background promise — if the request
 * ends first, the receipt is stranded at `local` with nothing left checking
 * on it. This reconciler drains that backlog using the EXISTING, unmodified
 * `enqueueReceiptLeg(record, personaId, 'dvn')` primitive — NOT reimplemented
 * here. These canaries drive the REAL `enqueueReceiptLeg` (and the REAL
 * `submitActivityReceiptToDvn` beneath it) against fake cross-module
 * dependencies only (`getSupabaseServer`, `getActor`,
 * `findLocalReceiptsPendingDvnAnchor`) — never a mock of anything defined
 * in the same module under test, so the orchestration is exercised for
 * real, not merely asserted about.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindLocal = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/receipts/activityReceiptService')>();
  return { ...actual, findLocalReceiptsPendingDvnAnchor: (...args: unknown[]) => mockFindLocal(...(args as [])) };
});

const mockGetActor = vi.fn();
vi.mock('@/services/ops/icAgent', () => ({
  getActor: (...args: unknown[]) => mockGetActor(...(args as [])),
}));

/** In-memory `activity_receipts` rows, keyed by id — enough for enqueueReceiptLeg's re-read + updates. */
let rows: Record<string, { pos_receipt_id: string | null; dvn_receipt_id: string | null; commitment_hash: string | null }>;

function fakeSupabase() {
  return {
    from: (table: string) => {
      if (table !== 'activity_receipts') throw new Error(`unexpected table: ${table}`);
      return {
        select: (_cols: string) => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: rows[id] ?? null, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            rows[id] = { ...(rows[id] ?? { pos_receipt_id: null, dvn_receipt_id: null, commitment_hash: null }), ...patch } as any;
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    },
  };
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeSupabase(),
}));

import { reconcileLocalReceiptsToDvn } from '@/services/dvn/activityReceiptDvnPipeline';

function fakeRecord(overrides: Partial<{ id: string; actionType: string; createdAt: string }> = {}) {
  return {
    id: overrides.id ?? 'r1',
    sessionId: null,
    intentId: null,
    activeCartridge: 'metame',
    actionType: overrides.actionType ?? 'approval_granted',
    summary: 'test receipt',
    agentsInvoked: [],
    toolsUsed: [],
    iqubesUsed: [],
    invariantsUsed: [],
    contextShared: [],
    artifactsCreated: [],
    approvalsGranted: [],
    policyEnvelopeId: null,
    receiptStatus: 'local',
    dvnReceiptId: null,
    commitmentHash: null,
    posStatus: null,
    dvnStatus: null,
    btcAnchorTxid: null,
    btcBatchRoot: null,
    specialistResponse: null,
    actionConnectorId: null,
    actionConnectorLabel: null,
    actionInput: null,
    createdAt: overrides.createdAt ?? new Date(0).toISOString(),
  } as any;
}

function seedRow(id: string, overrides: Partial<{ pos_receipt_id: string | null; dvn_receipt_id: string | null; commitment_hash: string | null }> = {}) {
  rows[id] = { pos_receipt_id: null, dvn_receipt_id: null, commitment_hash: null, ...overrides };
}

beforeEach(() => {
  mockFindLocal.mockReset();
  mockGetActor.mockReset();
  rows = {};
  process.env.CROSS_CHAIN_SERVICE_CANISTER_ID = 'test-dvn-canister';
});

describe('reconcileLocalReceiptsToDvn — drains the local backlog via the EXISTING per-leg primitive, never a second submission path', () => {
  it('submits a stranded local receipt to DVN and promotes it to dvn_pending', async () => {
    seedRow('r1');
    mockFindLocal.mockResolvedValue([{ record: fakeRecord({ id: 'r1' }), personaId: 'persona-1' }]);
    const submit = vi.fn(async () => 'dvn-msg-1');
    mockGetActor.mockResolvedValue({ submit_dvn_message: submit });

    const result = await reconcileLocalReceiptsToDvn();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(rows['r1']).toMatchObject({ dvn_receipt_id: 'dvn-msg-1' });
    expect(result).toMatchObject({ ok: true, pendingChecked: 1, submitted: 1, alreadySubmitted: 0, failed: 0, skippedNonAnchorable: 0 });
  });

  it('never resubmits a receipt that already has a dvn_receipt_id — counted as alreadySubmitted, canister never called', async () => {
    seedRow('r1', { dvn_receipt_id: 'existing-msg' });
    mockFindLocal.mockResolvedValue([{ record: fakeRecord({ id: 'r1' }), personaId: 'persona-1' }]);
    const submit = vi.fn(async () => 'should-never-be-called');
    mockGetActor.mockResolvedValue({ submit_dvn_message: submit });

    const result = await reconcileLocalReceiptsToDvn();

    expect(submit).not.toHaveBeenCalled();
    expect(result).toMatchObject({ submitted: 0, alreadySubmitted: 1, failed: 0 });
  });

  it('never submits a non-anchorable action type — skipped before the canister is ever reached', async () => {
    seedRow('r1');
    mockFindLocal.mockResolvedValue([{ record: fakeRecord({ id: 'r1', actionType: 'not_a_real_anchorable_type' }), personaId: 'persona-1' }]);
    const submit = vi.fn(async () => 'should-never-be-called');
    mockGetActor.mockResolvedValue({ submit_dvn_message: submit });

    const result = await reconcileLocalReceiptsToDvn();

    expect(submit).not.toHaveBeenCalled();
    expect(mockGetActor).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skippedNonAnchorable: 1, submitted: 0 });
  });

  it('one receipt whose canister call throws does not stop the rest of the bounded batch (exception isolation)', async () => {
    seedRow('r-bad');
    seedRow('r-good');
    mockFindLocal.mockResolvedValue([
      { record: fakeRecord({ id: 'r-bad' }), personaId: 'persona-1' },
      { record: fakeRecord({ id: 'r-good' }), personaId: 'persona-1' },
    ]);
    let callCount = 0;
    mockGetActor.mockResolvedValue({
      submit_dvn_message: vi.fn(async () => {
        callCount += 1;
        if (callCount === 1) throw new Error('simulated canister failure');
        return 'dvn-msg-good';
      }),
    });

    const result = await reconcileLocalReceiptsToDvn();

    expect(result.ok).toBe(true);
    expect(result.pendingChecked).toBe(2);
    // One submission failed at the canister level (enqueueReceiptLeg reports
    // ok:false rather than throwing — see submitActivityReceiptToDvn's own
    // try/catch), the other succeeded.
    expect(result.submitted + result.failed).toBe(2);
    expect(result.submitted).toBeGreaterThanOrEqual(1);
  });

  it('returns ok with zero work when there is no local backlog at all — never calls the canister actor', async () => {
    mockFindLocal.mockResolvedValue([]);

    const result = await reconcileLocalReceiptsToDvn();

    expect(result).toMatchObject({ ok: true, pendingChecked: 0, submitted: 0 });
    expect(mockGetActor).not.toHaveBeenCalled();
  });

  it('a failed read of the local backlog itself is reported, not thrown', async () => {
    mockFindLocal.mockRejectedValue(new Error('supabase down'));

    const result = await reconcileLocalReceiptsToDvn();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('supabase down');
  });

  it('pages forward past a full page of non-anchorable rows to reach an anchorable one behind it (starvation fix)', async () => {
    // Page 1: a full page (50) of non-anchorable rows — before the paging fix,
    // this alone would be re-fetched forever and the anchorable row on page 2
    // would never be reached.
    const page1 = Array.from({ length: 50 }, (_, i) =>
      seedAndBuild(`old-${i}`, 'not_a_real_anchorable_type', new Date(i * 1000).toISOString()),
    );
    const page2 = [seedAndBuild('r-anchorable', 'approval_granted', new Date(50_000).toISOString())];

    mockFindLocal.mockImplementation(async (opts: { afterCreatedAt?: string } = {}) => {
      return opts.afterCreatedAt ? page2 : page1;
    });
    const submit = vi.fn(async () => 'dvn-msg-anchorable');
    mockGetActor.mockResolvedValue({ submit_dvn_message: submit });

    const result = await reconcileLocalReceiptsToDvn();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(rows['r-anchorable']).toMatchObject({ dvn_receipt_id: 'dvn-msg-anchorable' });
    expect(result).toMatchObject({ ok: true, pendingChecked: 51, submitted: 1, skippedNonAnchorable: 50 });

    function seedAndBuild(id: string, actionType: string, createdAt: string) {
      seedRow(id);
      return { record: fakeRecord({ id, actionType, createdAt }), personaId: 'persona-1' };
    }
  });
});
