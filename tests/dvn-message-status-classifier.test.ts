/**
 * /api/ops/dvn/message-status — the Part B1 read-only DVN message
 * classifier (Horizen Pilot Closure, operator directive, 2026-08-09):
 * "classify DVN message via get_dvn_message/get_message_attestations/
 * attestation count into DVN_RECORDED|WAITING_FOR_ATTESTATIONS|
 * MESSAGE_NOT_FOUND|TARGET_READ_FAILED. No guessing, no re-submission."
 *
 * Every case here asserts submit_attestation/submit_dvn_message are NEVER
 * called — this route only reads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActor = vi.fn();
vi.mock('@/services/ops/icAgent', () => ({
  getActor: (...args: any[]) => mockGetActor(...args),
}));

const mockFindAgentReceiptRefs = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findAgentReceiptRefs: (...args: any[]) => mockFindAgentReceiptRefs(...args),
}));

beforeEach(() => {
  mockGetActor.mockReset();
  mockFindAgentReceiptRefs.mockReset();
  process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';
  process.env.CROSS_CHAIN_SERVICE_CANISTER_ID = 'test-dvn-canister';
});

function makeRequest(qs: string) {
  return new (require('next/server').NextRequest)(
    `https://dev-beta.aigentz.me/api/ops/dvn/message-status${qs}`,
    { headers: { 'x-cron-token': 'test-cron-token' } },
  );
}

describe('GET /api/ops/dvn/message-status — auth', () => {
  it('401s without a valid cron token', async () => {
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const req = new (require('next/server').NextRequest)('https://dev-beta.aigentz.me/api/ops/dvn/message-status?dvnReceiptId=m1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/ops/dvn/message-status — direct dvnReceiptId classification', () => {
  it('DVN_RECORDED: message exists, attestationCount >= 2', async () => {
    mockGetActor.mockResolvedValue({
      get_dvn_message: vi.fn(async () => [{ id: 'm1' }]),
      get_message_attestations: vi.fn(async () => [{ validator: 'a' }, { validator: 'b' }]),
    });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const json = await (await GET(makeRequest('?dvnReceiptId=m1'))).json();
    expect(json.classification).toBe('DVN_RECORDED');
    expect(json.attestationCount).toBe(2);
    expect(json.requiredAttestations).toBe(2);
  });

  it('WAITING_FOR_ATTESTATIONS: message exists, attestationCount below threshold', async () => {
    mockGetActor.mockResolvedValue({
      get_dvn_message: vi.fn(async () => [{ id: 'm1' }]),
      get_message_attestations: vi.fn(async () => [{ validator: 'a' }]),
    });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const json = await (await GET(makeRequest('?dvnReceiptId=m1'))).json();
    expect(json.classification).toBe('WAITING_FOR_ATTESTATIONS');
    expect(json.attestationCount).toBe(1);
  });

  it('MESSAGE_NOT_FOUND: get_dvn_message returns the None variant ([])', async () => {
    const getMessageAttestations = vi.fn();
    mockGetActor.mockResolvedValue({
      get_dvn_message: vi.fn(async () => []),
      get_message_attestations: getMessageAttestations,
    });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const json = await (await GET(makeRequest('?dvnReceiptId=ghost'))).json();
    expect(json.classification).toBe('MESSAGE_NOT_FOUND');
    // Never counts attestations for a message that doesn't exist — same
    // discipline as the finalizer's own readiness predicate.
    expect(getMessageAttestations).not.toHaveBeenCalled();
  });

  it('TARGET_READ_FAILED: the targeted read throws (canister unavailable/timeout)', async () => {
    mockGetActor.mockResolvedValue({
      get_dvn_message: vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
      get_message_attestations: vi.fn(),
    });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const json = await (await GET(makeRequest('?dvnReceiptId=m1'))).json();
    expect(json.classification).toBe('TARGET_READ_FAILED');
    expect(json.error).toContain('ECONNRESET');
  });

  it('never calls submit_attestation or submit_dvn_message — read-only, no re-submission', async () => {
    const submitAttestation = vi.fn();
    const submitDvnMessage = vi.fn();
    mockGetActor.mockResolvedValue({
      get_dvn_message: vi.fn(async () => [{ id: 'm1' }]),
      get_message_attestations: vi.fn(async () => [{ validator: 'a' }, { validator: 'b' }]),
      submit_attestation: submitAttestation,
      submit_dvn_message: submitDvnMessage,
    });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    await GET(makeRequest('?dvnReceiptId=m1'));
    expect(submitAttestation).not.toHaveBeenCalled();
    expect(submitDvnMessage).not.toHaveBeenCalled();
  });
});

describe('GET /api/ops/dvn/message-status — agent-scoped classification', () => {
  it('resolves every receipt for the agent/actionTypes via findAgentReceiptRefs, classifies each, and reports local vs canister state side by side', async () => {
    mockFindAgentReceiptRefs.mockResolvedValue([
      { id: 'r1', actionType: 'standing_accrued', receiptStatus: 'dvn_pending', actionInput: null, createdAt: '2026-01-01T00:00:00Z', dvnReceiptId: 'm1' },
    ]);
    mockGetActor.mockResolvedValue({
      get_dvn_message: vi.fn(async () => [{ id: 'm1' }]),
      get_message_attestations: vi.fn(async () => [{ validator: 'a' }, { validator: 'b' }]),
    });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const json = await (await GET(makeRequest('?agentRuntimeId=aigent-nakamoto&actionTypes=standing_accrued'))).json();

    expect(mockFindAgentReceiptRefs).toHaveBeenCalledWith('aigent-nakamoto', ['standing_accrued'], { limit: 50 });
    expect(json.results).toHaveLength(1);
    expect(json.results[0]).toMatchObject({
      receiptId: 'r1',
      localReceiptStatus: 'dvn_pending',
      classification: 'DVN_RECORDED',
      localAlreadyFinalized: false,
    });
  });

  it('a receipt with no dvn_receipt_id on file is MESSAGE_NOT_FOUND without ever calling the canister for it', async () => {
    mockFindAgentReceiptRefs.mockResolvedValue([
      { id: 'r1', actionType: 'standing_accrued', receiptStatus: 'local', actionInput: null, createdAt: '2026-01-01T00:00:00Z', dvnReceiptId: null },
    ]);
    const getDvnMessage = vi.fn();
    mockGetActor.mockResolvedValue({ get_dvn_message: getDvnMessage, get_message_attestations: vi.fn() });
    const { GET } = await import('@/app/api/ops/dvn/message-status/route');
    const json = await (await GET(makeRequest('?agentRuntimeId=aigent-nakamoto'))).json();

    expect(json.results[0].classification).toBe('MESSAGE_NOT_FOUND');
    expect(getDvnMessage).not.toHaveBeenCalled();
  });
});
