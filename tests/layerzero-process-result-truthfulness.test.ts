/**
 * POST /api/ops/layerzero/process — result truthfulness (operator ruling,
 * 2026-08-08, P0.3).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `submit_attestation` is declared (services/ops/idl/cross_chain_service.ts)
 * as returning a Candid Variant `{ Ok: Text } | { Err: Text }`. An `Err` is a
 * SUCCESSFUL CALL RETURNING A REJECTION — it does not throw, so
 * `Promise.allSettled` records it as `fulfilled`, and this route's mapper
 * previously returned `status: 'processed'` unconditionally. The route could
 * answer "Processed 10/10 messages" when the canister had rejected all ten.
 *
 * That mattered because this is the ONLY path that drains the DVN pending
 * queue, and it was the path whose reported success was used to judge whether
 * a 710-message backlog was clearing. A repair mechanism that cannot
 * distinguish rejection from success is unusable for diagnosis.
 *
 * These tests fix the semantics ONLY. Nothing here asserts anything about
 * validatorId, signature generation, batching strategy, receipt rows or
 * canister behaviour — all of which the operator explicitly held back until a
 * real canister response is observed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActor = vi.fn();
vi.mock('@/services/ops/icAgent', () => ({
  getActor: (...args: any[]) => mockGetActor(...args),
}));

const mockRecordDVNTransaction = vi.fn();
vi.mock('@/services/qct/EventListener', () => ({
  getQCTEventListener: () => ({ recordDVNTransaction: mockRecordDVNTransaction }),
}));

import { POST } from '@/app/api/ops/layerzero/process/route';

/** One pending DVN message, shaped as the canister returns it. */
function pendingMessage(id: string) {
  const payload = Array.from(new TextEncoder().encode(JSON.stringify({ action: 'AIGENTME_ACTIVITY_RECEIPT', receiptId: `r-${id}`, txHash: `0x${id}` })));
  return { id, source_chain: 80002, destination_chain: 0, payload, nonce: BigInt(1), sender: 'test', timestamp: BigInt(Date.now()) };
}

function makeRequest(body: Record<string, unknown> = { action: 'process_pending' }) {
  return { json: async () => body } as unknown as Request;
}

/** A DVN actor whose submit_attestation returns whatever `respond` yields. */
function fakeDvn(messages: any[], respond: (messageId: string) => unknown) {
  return {
    get_pending_messages: vi.fn(async () => messages),
    submit_attestation: vi.fn(async (messageId: string) => respond(messageId)),
  };
}

beforeEach(() => {
  mockGetActor.mockReset();
  mockRecordDVNTransaction.mockReset();
  process.env.CROSS_CHAIN_SERVICE_CANISTER_ID = 'test-dvn-canister';
});

describe('layerzero/process — an Ok variant is processed', () => {
  it('{ Ok } counts as processed, carries the Ok value, and records the DVN transaction', async () => {
    const dvn = fakeDvn([pendingMessage('m1')], () => ({ Ok: 'attestation-accepted' }));
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(1);
    expect(json.rejected).toBe(0);
    expect(json.failed).toBe(0);
    expect(json.results[0]).toMatchObject({ messageId: 'm1', status: 'processed', attestResult: 'attestation-accepted' });
    expect(json.canisterErrors).toEqual([]);
    expect(mockRecordDVNTransaction).toHaveBeenCalledTimes(1);
  });

  it('a plain-string return (looser canister build) is also processed — same dual-shape handling submitActivityReceiptToDvn uses', async () => {
    const dvn = fakeDvn([pendingMessage('m1')], () => 'raw-string-ack');
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(1);
    expect(json.results[0].attestResult).toBe('raw-string-ack');
  });
});

describe('layerzero/process — an Err variant is a FAILURE, never a success (the defect)', () => {
  it('{ Err } does NOT increment processed, is reported as rejected, and preserves the exact canister error', async () => {
    const dvn = fakeDvn([pendingMessage('m1')], () => ({ Err: 'Unauthorized validator principal' }));
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(0);
    expect(json.rejected).toBe(1);
    expect(json.results[0]).toMatchObject({ messageId: 'm1', status: 'rejected', canisterError: 'Unauthorized validator principal' });
    // The exact canister text is surfaced at the top level — the answer to
    // "what is actually being rejected", without opening results[].
    expect(json.canisterErrors).toEqual(['Unauthorized validator principal']);
  });

  it('THE REGRESSION ASSERTION: Promise.allSettled fulfilling with an { Err } cannot increment the processed count', async () => {
    // All ten reject. Every one of these settles as `fulfilled` (an Err
    // variant does not throw), which is exactly how they used to be counted
    // as processed. "Processed 10/10" must now be impossible here.
    const messages = Array.from({ length: 10 }, (_, i) => pendingMessage(`m${i}`));
    const dvn = fakeDvn(messages, (id) => ({ Err: `rejected: ${id}` }));
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(0);
    expect(json.rejected).toBe(10);
    expect(json.message).not.toMatch(/Processed 10\/10/);
    expect(json.message).toContain('rejected by canister');
    // No DVN transaction is recorded for a message that was never attested.
    expect(mockRecordDVNTransaction).not.toHaveBeenCalled();
  });

  it('an unrecognised return shape (neither Ok nor Err) is rejected, never assumed successful', async () => {
    const dvn = fakeDvn([pendingMessage('m1')], () => ({ Unexpected: true }));
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(0);
    expect(json.rejected).toBe(1);
    expect(json.results[0].canisterError).toContain('unexpected shape');
  });

  it('a mixed batch reports each outcome separately and never merges them', async () => {
    const messages = [pendingMessage('ok1'), pendingMessage('err1'), pendingMessage('ok2')];
    const dvn = fakeDvn(messages, (id) => (id.startsWith('ok') ? { Ok: `acked-${id}` } : { Err: `refused-${id}` }));
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(2);
    expect(json.rejected).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.canisterErrors).toEqual(['refused-err1']);
  });
});

describe('layerzero/process — a THROWN call is distinct from a rejection', () => {
  it('a submit_attestation that throws is counted as failed, not rejected and not processed', async () => {
    const dvn = {
      get_pending_messages: vi.fn(async () => [pendingMessage('m1')]),
      submit_attestation: vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    };
    mockGetActor.mockResolvedValue(dvn);

    const json = await (await POST(makeRequest())).json();

    expect(json.processed).toBe(0);
    expect(json.rejected).toBe(0);
    expect(json.failed).toBe(1);
    expect(json.results[0]).toMatchObject({ status: 'failed' });
    expect(json.results[0].error).toContain('ECONNRESET');
  });
});
