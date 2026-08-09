/**
 * services/dvn/activityReceiptDvnPipeline.ts's finalizeReadyActivityReceipts()
 * — targeted-batch readiness read (operator-approved narrow modification,
 * 2026-08-09, "LIVE CLOSURE — MoneyPenny tokenId + DVN targeted
 * finalization", part B).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * The finalizer previously called the canister's global, no-argument
 * `get_ready_messages()` — enumerating EVERY ready message across the
 * canister's entire backlog. Live, this returned ~5.8 MB, exceeding the IC's
 * 3 MiB query-response cap (`IC0504`) and failing the finalizer outright, so
 * `activity_receipts` rows sat at `dvn_pending` indefinitely regardless of
 * whether the underlying DVN message was actually ready.
 *
 * The fix targets only a BOUNDED batch of our own `dvn_pending` receipts and
 * checks each individually via the canister's existing targeted query
 * methods (`get_dvn_message`, `get_message_attestations` — already declared
 * in cross_chain_service's IDL, no canister or IDL change). These canaries
 * prove:
 *   - the global `get_ready_messages()` is never called;
 *   - readiness is EQUIVALENT to the old semantics: ready iff a message
 *     exists on the canister AND attestation_count >= 2 (the deployed
 *     REQUIRED_ATTESTATIONS threshold) — never fewer;
 *   - the read is bounded to one batch per run;
 *   - one receipt's failed/unavailable targeted read does not block the
 *     rest of the batch (exception isolation);
 *   - the function only ever READS the canister — it never resubmits.
 *
 * Mirrors this repo's existing double-mock convention for DVN-pipeline
 * canaries (see tests/layerzero-process-result-truthfulness.test.ts and
 * tests/artifact-runtime-service.test.ts for the getActor + supabaseServer
 * mock shapes this file reuses).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActor = vi.fn();
vi.mock('@/services/ops/icAgent', () => ({
  getActor: (...args: any[]) => mockGetActor(...args),
}));

let pendingRows: Array<{ id: string; dvn_receipt_id: string }> = [];
let pendingError: { message: string } | null = null;
let updateRows: Array<{ id: string }> = [];
let updateError: { message: string } | null = null;
const captured: { select: any; update: any } = { select: {}, update: {} };

function fakeSupabase() {
  return {
    from: (table: string) => {
      if (table !== 'activity_receipts') throw new Error(`unexpected table: ${table}`);
      return {
        select: (columns: string) => {
          captured.select.columns = columns;
          const chain = {
            eq: (col: string, val: string) => {
              captured.select.eq = [col, val];
              return chain;
            },
            not: (col: string, op: string, val: unknown) => {
              captured.select.not = [col, op, val];
              return chain;
            },
            limit: (n: number) => {
              captured.select.limit = n;
              return Promise.resolve({ data: pendingRows, error: pendingError });
            },
          };
          return chain;
        },
        update: (patch: Record<string, unknown>) => {
          captured.update.patch = patch;
          const chain = {
            in: (col: string, ids: string[]) => {
              captured.update.in = [col, ids];
              return chain;
            },
            eq: (col: string, val: string) => {
              captured.update.eq = [col, val];
              return chain;
            },
            select: (_cols: string) => Promise.resolve({ data: updateRows, error: updateError }),
          };
          return chain;
        },
      };
    },
  };
}

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeSupabase(),
}));

import { finalizeReadyActivityReceipts } from '@/services/dvn/activityReceiptDvnPipeline';

/** A DVN actor whose per-message reads are driven by simple lookup maps. */
function fakeDvn(opts: {
  messages?: Record<string, unknown>;
  attestations?: Record<string, unknown[]>;
  throwsOn?: Set<string>;
}) {
  const messages = opts.messages ?? {};
  const attestations = opts.attestations ?? {};
  const throwsOn = opts.throwsOn ?? new Set<string>();
  return {
    get_ready_messages: vi.fn(async () => {
      throw new Error('get_ready_messages must NEVER be called by the targeted finalizer — this is the ~5.8MB call that overflows IC0504');
    }),
    get_dvn_message: vi.fn(async (id: string) => {
      if (throwsOn.has(id)) throw new Error(`simulated unavailable message: ${id}`);
      return id in messages ? [messages[id]] : [];
    }),
    get_message_attestations: vi.fn(async (id: string) => {
      if (throwsOn.has(id)) throw new Error(`simulated unavailable attestations: ${id}`);
      return attestations[id] ?? [];
    }),
    submit_dvn_message: vi.fn(async () => {
      throw new Error('submit_dvn_message must NEVER be called by the finalizer — it only reads and promotes, never resubmits');
    }),
  };
}

function attestationList(n: number) {
  return Array.from({ length: n }, (_, i) => ({ validator: `v${i}`, signature: new Uint8Array(), timestamp: BigInt(1) }));
}

beforeEach(() => {
  mockGetActor.mockReset();
  pendingRows = [];
  pendingError = null;
  updateRows = [];
  updateError = null;
  captured.select = {};
  captured.update = {};
  process.env.CROSS_CHAIN_SERVICE_CANISTER_ID = 'test-dvn-canister';
});

describe('finalizeReadyActivityReceipts — targets our own backlog, never the global enumeration', () => {
  it('never calls get_ready_messages — only targeted get_dvn_message / get_message_attestations', async () => {
    pendingRows = [{ id: 'r1', dvn_receipt_id: 'm1' }];
    updateRows = [{ id: 'r1' }];
    const dvn = fakeDvn({ messages: { m1: { id: 'm1' } }, attestations: { m1: attestationList(2) } });
    mockGetActor.mockResolvedValue(dvn);

    const result = await finalizeReadyActivityReceipts();

    expect(dvn.get_ready_messages).not.toHaveBeenCalled();
    expect(dvn.get_dvn_message).toHaveBeenCalledWith('m1');
    expect(dvn.get_message_attestations).toHaveBeenCalledWith('m1');
    expect(result.ok).toBe(true);
  });

  it('reads its OWN bounded backlog from activity_receipts — dvn_pending with a dvn_receipt_id on file, never the canister\'s global set', async () => {
    pendingRows = [];
    const dvn = fakeDvn({});
    mockGetActor.mockResolvedValue(dvn);

    await finalizeReadyActivityReceipts();

    expect(captured.select.eq).toEqual(['receipt_status', 'dvn_pending']);
    expect(captured.select.not).toEqual(['dvn_receipt_id', 'is', null]);
    expect(typeof captured.select.limit).toBe('number');
    expect(captured.select.limit).toBeGreaterThan(0);
    expect(captured.select.limit).toBeLessThanOrEqual(50);
  });
});

describe('readiness EQUIVALENCE — ready iff attestation_count >= 2, exactly the deployed threshold', () => {
  it('promotes a receipt with EXACTLY 2 attestations (the threshold, not just "more than 1")', async () => {
    pendingRows = [{ id: 'r-two', dvn_receipt_id: 'm-two' }];
    updateRows = [{ id: 'r-two' }];
    const dvn = fakeDvn({ messages: { 'm-two': { id: 'm-two' } }, attestations: { 'm-two': attestationList(2) } });
    mockGetActor.mockResolvedValue(dvn);

    const result = await finalizeReadyActivityReceipts();

    expect(result.readyMessageCount).toBe(1);
    expect(captured.update.in).toEqual(['id', ['r-two']]);
  });

  it('NEVER promotes a receipt with fewer than 2 attestations (0 or 1) — no receipt becomes dvn_recorded below the threshold', async () => {
    pendingRows = [
      { id: 'r-zero', dvn_receipt_id: 'm-zero' },
      { id: 'r-one', dvn_receipt_id: 'm-one' },
    ];
    const dvn = fakeDvn({
      messages: { 'm-zero': { id: 'm-zero' }, 'm-one': { id: 'm-one' } },
      attestations: { 'm-zero': attestationList(0), 'm-one': attestationList(1) },
    });
    mockGetActor.mockResolvedValue(dvn);

    const result = await finalizeReadyActivityReceipts();

    expect(result.readyMessageCount).toBe(0);
    // The update call never happens at all when nothing is ready — never an
    // update with an empty id list either, which would be a no-op but still
    // a wrong signal that promotion was attempted.
    expect(captured.update.in).toBeUndefined();
  });

  it('promotes attestation_count > 2 as well — the threshold is a floor, not an exact match', async () => {
    pendingRows = [{ id: 'r-five', dvn_receipt_id: 'm-five' }];
    updateRows = [{ id: 'r-five' }];
    const dvn = fakeDvn({ messages: { 'm-five': { id: 'm-five' } }, attestations: { 'm-five': attestationList(5) } });
    mockGetActor.mockResolvedValue(dvn);

    const result = await finalizeReadyActivityReceipts();
    expect(result.readyMessageCount).toBe(1);
  });

  it('a message absent from the canister (get_dvn_message returns none) is never promoted, even if attestations were somehow recorded for its id', async () => {
    pendingRows = [{ id: 'r-ghost', dvn_receipt_id: 'm-ghost' }];
    // No entry in `messages` — get_dvn_message returns none (Candid opt: []).
    const dvn = fakeDvn({ messages: {}, attestations: { 'm-ghost': attestationList(3) } });
    mockGetActor.mockResolvedValue(dvn);

    const result = await finalizeReadyActivityReceipts();

    expect(result.readyMessageCount).toBe(0);
    // get_message_attestations must not even need to be consulted once the
    // message itself doesn't exist — mirrors get_ready_messages() never
    // considering a message that isn't on the canister.
    expect(dvn.get_message_attestations).not.toHaveBeenCalledWith('m-ghost');
  });
});

describe('exception isolation — one unavailable receipt never blocks the rest of the batch', () => {
  it('a receipt whose targeted read throws is skipped (retried next run) while the rest of the batch still promotes', async () => {
    pendingRows = [
      { id: 'r-bad', dvn_receipt_id: 'm-bad' },
      { id: 'r-good', dvn_receipt_id: 'm-good' },
    ];
    updateRows = [{ id: 'r-good' }];
    const dvn = fakeDvn({
      messages: { 'm-good': { id: 'm-good' } },
      attestations: { 'm-good': attestationList(2) },
      throwsOn: new Set(['m-bad']),
    });
    mockGetActor.mockResolvedValue(dvn);

    const result = await finalizeReadyActivityReceipts();

    expect(result.readyMessageCount).toBe(1);
    expect(result.unresolvable).toBe(1);
    expect(captured.update.in).toEqual(['id', ['r-good']]);
    // The overall run still reports success — one bad message is not a
    // finalizer-wide failure.
    expect(result.ok).toBe(true);
  });
});

describe('never resubmits — read-only, and only promotes an EXISTING dvn_pending row', () => {
  it('submit_dvn_message is never called by the finalizer', async () => {
    pendingRows = [{ id: 'r1', dvn_receipt_id: 'm1' }];
    updateRows = [{ id: 'r1' }];
    const dvn = fakeDvn({ messages: { m1: { id: 'm1' } }, attestations: { m1: attestationList(2) } });
    mockGetActor.mockResolvedValue(dvn);

    await finalizeReadyActivityReceipts();

    expect(dvn.submit_dvn_message).not.toHaveBeenCalled();
  });

  it('the promotion update is gated on receipt_status still being dvn_pending — the same state-machine guard as before', async () => {
    pendingRows = [{ id: 'r1', dvn_receipt_id: 'm1' }];
    updateRows = [{ id: 'r1' }];
    const dvn = fakeDvn({ messages: { m1: { id: 'm1' } }, attestations: { m1: attestationList(2) } });
    mockGetActor.mockResolvedValue(dvn);

    await finalizeReadyActivityReceipts();

    expect(captured.update.patch).toEqual({ receipt_status: 'dvn_recorded' });
    expect(captured.update.eq).toEqual(['receipt_status', 'dvn_pending']);
  });
});

describe('bounded run, clean early exits', () => {
  it('returns ok with zero work when there is no pending backlog at all — never calls the canister actor', async () => {
    pendingRows = [];
    const result = await finalizeReadyActivityReceipts();
    expect(result).toMatchObject({ ok: true, readyMessageCount: 0, receiptsFinalized: 0, pendingChecked: 0 });
    expect(mockGetActor).not.toHaveBeenCalled();
  });

  it('refuses cleanly when CROSS_CHAIN_SERVICE_CANISTER_ID is unset — same contract as before', async () => {
    delete process.env.CROSS_CHAIN_SERVICE_CANISTER_ID;
    delete process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
    const result = await finalizeReadyActivityReceipts();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CROSS_CHAIN_SERVICE_CANISTER_ID/);
  });
});
