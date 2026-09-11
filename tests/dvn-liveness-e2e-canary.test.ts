/**
 * DVN liveness end-to-end canary (2026-09-06 Factor evidence-defect closure).
 *
 * Two things this canary proves, per the operator's explicit instruction:
 *
 * 1. "An unreadable canister response cannot appear as zero pending" —
 *    `dvn.get_pending_messages()` throwing/rejecting must surface as
 *    `{ readable: false, error }` from `countDvnPendingMessages` and as
 *    `{ ok: false, error }` from `processPendingDvnAttestations` — NEVER as
 *    a genuine empty queue (`{ readable: true, count: 0 }` /
 *    `{ ok: true, processed: 0 }`). This is the exact defect class the
 *    2026-08-08 `get_ready_messages()` IC0504 incident named (see
 *    services/dvn/activityReceiptDvnPipeline.ts's header comment).
 *
 * 2. The full live path — submitted receipt → two accepted test-grade pilot
 *    attestations → targeted readiness observation → the same local receipt
 *    becomes `dvn_recorded` — using an in-memory fake canister actor that
 *    tracks real attestation state across both legs (the attestation
 *    processor's `submit_attestation` calls, and the finalizer's targeted
 *    `get_dvn_message` / `get_message_attestations` reads), and a fake
 *    Supabase client for the finalizer's own bounded backlog read/update.
 *    `finalizeReadyActivityReceipts` itself is PARAMOUNT-protected
 *    (services/dvn/activityReceiptDvnPipeline.ts) and is exercised
 *    UNMODIFIED here via its real module import — only its two
 *    dependencies (getActor, getSupabaseServer) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/qct/EventListener', () => ({
  getQCTEventListener: () => ({ recordDVNTransaction: () => {} }),
}));

describe('countDvnPendingMessages / processPendingDvnAttestations — UNREADABLE is never empty', () => {
  it('countDvnPendingMessages surfaces a canister read failure as readable:false, never count:0', async () => {
    const { countDvnPendingMessages } = await import('@/services/ops/dvnAttestationProcessor');
    const dvn = { get_pending_messages: vi.fn().mockRejectedValue(new Error('IC0504: response too large')) };

    const result = await countDvnPendingMessages(dvn);

    expect(result.readable).toBe(false);
    if (!result.readable) expect(result.error).toContain('IC0504');
  });

  it('countDvnPendingMessages reports a genuine empty queue distinctly, as readable:true, count:0', async () => {
    const { countDvnPendingMessages } = await import('@/services/ops/dvnAttestationProcessor');
    const dvn = { get_pending_messages: vi.fn().mockResolvedValue([]) };

    const result = await countDvnPendingMessages(dvn);

    expect(result).toEqual({ readable: true, count: 0 });
  });

  it('processPendingDvnAttestations surfaces a canister read failure as ok:false, never ok:true/processed:0', async () => {
    const { processPendingDvnAttestations } = await import('@/services/ops/dvnAttestationProcessor');
    const dvn = { get_pending_messages: vi.fn().mockRejectedValue(new Error('canister trapped')) };

    const result = await processPendingDvnAttestations(dvn);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('UNREADABLE');
  });

  it('a non-array resolution (unexpected Candid shape) is also UNREADABLE, never treated as zero pending', async () => {
    const { countDvnPendingMessages } = await import('@/services/ops/dvnAttestationProcessor');
    const dvn = { get_pending_messages: vi.fn().mockResolvedValue({ Err: 'unexpected' }) };

    const result = await countDvnPendingMessages(dvn);

    expect(result.readable).toBe(false);
  });
});

describe('end-to-end DVN liveness: submit -> two accepted attestations -> targeted readiness -> dvn_recorded', () => {
  const MESSAGE_ID = 'msg-e2e-canary-001';
  const RECEIPT_ID = 'receipt-e2e-canary-001';

  /** In-memory canister state shared across the attestation-processor leg and the finalizer leg. */
  function makeFakeCanister() {
    const attestations: string[] = [];
    let updateStatusCalls: unknown[] = [];
    return {
      attestations,
      get_pending_messages: vi.fn(async () =>
        attestations.length < 2 ? [{ id: MESSAGE_ID, source_chain: 'base-sepolia', payload: [], timestamp: Date.now() }] : [],
      ),
      submit_attestation: vi.fn(async (messageId: string, validatorId: string) => {
        expect(messageId).toBe(MESSAGE_ID);
        attestations.push(validatorId);
        return { Ok: `attestation recorded (${attestations.length}/2)` };
      }),
      get_dvn_message: vi.fn(async (id: string) => (id === MESSAGE_ID ? [{ id }] : [])),
      get_message_attestations: vi.fn(async (id: string) => (id === MESSAGE_ID ? attestations.map((v) => ({ validator: v })) : [])),
      _updateStatusCalls: updateStatusCalls,
    };
  }

  function makeFakeSupabase(receiptRow: { id: string; dvn_receipt_id: string; receipt_status: string }) {
    const updated: string[] = [];
    const chain = (resultFactory: () => unknown) => {
      const thenable: any = {
        eq: () => thenable,
        not: () => thenable,
        in: (_col: string, ids: string[]) => {
          ids.forEach((id) => {
            if (id === receiptRow.id) {
              receiptRow.receipt_status = 'dvn_recorded';
              updated.push(id);
            }
          });
          return thenable;
        },
        select: () => thenable,
        limit: () => thenable,
        then: (resolve: (v: unknown) => void) => resolve(resultFactory()),
      };
      return thenable;
    };
    return {
      updated,
      from: (table: string) => {
        expect(table).toBe('activity_receipts');
        return {
          select: () =>
            chain(() =>
              receiptRow.receipt_status === 'dvn_pending'
                ? { data: [{ id: receiptRow.id, dvn_receipt_id: receiptRow.dvn_receipt_id }], error: null }
                : { data: [], error: null },
            ),
          update: () => chain(() => ({ data: updated.map((id) => ({ id })), error: null })),
        };
      },
    };
  }

  beforeEach(() => {
    vi.resetModules();
  });

  it('two real submit_attestation calls reach the canister threshold, and the finalizer promotes the SAME local receipt to dvn_recorded', async () => {
    const canister = makeFakeCanister();
    const receiptRow = { id: RECEIPT_ID, dvn_receipt_id: MESSAGE_ID, receipt_status: 'dvn_pending' };
    const supabase = makeFakeSupabase(receiptRow);

    vi.doMock('@/services/ops/icAgent', () => ({ getActor: vi.fn(async () => canister) }));
    vi.doMock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: () => supabase }));
    process.env.CROSS_CHAIN_SERVICE_CANISTER_ID = 'test-canister-id';

    const { processPendingDvnAttestations } = await import('@/services/ops/dvnAttestationProcessor');
    const { finalizeReadyActivityReceipts } = await import('@/services/dvn/activityReceiptDvnPipeline');

    // Before any attestation, the finalizer must NOT promote the receipt.
    const beforeAttestations = await finalizeReadyActivityReceipts();
    expect(beforeAttestations.readyMessageCount).toBe(0);
    expect(receiptRow.receipt_status).toBe('dvn_pending');

    // First accepted test-grade pilot attestation.
    const pass1 = await processPendingDvnAttestations(canister);
    expect(pass1.ok).toBe(true);
    if (pass1.ok) expect(pass1.processed).toBe(1);
    expect(canister.attestations).toHaveLength(1);

    // Still not ready — only 1 of 2 required attestations.
    const stillPending = await finalizeReadyActivityReceipts();
    expect(stillPending.readyMessageCount).toBe(0);
    expect(receiptRow.receipt_status).toBe('dvn_pending');

    // Second accepted test-grade pilot attestation reaches the threshold.
    const pass2 = await processPendingDvnAttestations(canister);
    expect(pass2.ok).toBe(true);
    if (pass2.ok) expect(pass2.processed).toBe(1);
    expect(canister.attestations).toHaveLength(2);

    // Targeted readiness observation now finds the SAME receipt ready and
    // finalizes it — never a fabricated attestation, never a manual SQL
    // status mutation, just the existing get_dvn_message/
    // get_message_attestations targeted reads this pipeline already uses.
    const finalized = await finalizeReadyActivityReceipts();
    expect(finalized.ok).toBe(true);
    expect(finalized.readyMessageCount).toBe(1);
    expect(finalized.receiptsFinalized).toBe(1);
    expect(receiptRow.receipt_status).toBe('dvn_recorded');
  });
});
