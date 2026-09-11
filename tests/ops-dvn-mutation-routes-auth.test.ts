/**
 * `/api/ops/layerzero/process` and `/api/ops/dvn/attest` had NO auth gate
 * at all before Horizen Pilot Closure Part B2 (2026-08-09) — any caller
 * could drive DVN attestation submission. Both now go through
 * `services/ops/opsAuth.ts`'s dual-path check: a valid CRON_TRIGGER_TOKEN,
 * OR an authenticated admin persona (the SAME check
 * app/api/admin/dvn-retry-all/route.ts already uses). Preserving the
 * admin-persona path (rather than cron-token-only, like every other
 * /api/ops/** route) is what lets the operator /ops console keep working.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetActor = vi.fn();
vi.mock('@/services/ops/icAgent', () => ({
  getActor: (...args: any[]) => mockGetActor(...args),
}));

const mockRecordDVNTransaction = vi.fn();
vi.mock('@/services/qct/EventListener', () => ({
  getQCTEventListener: () => ({ recordDVNTransaction: mockRecordDVNTransaction }),
}));

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue(null);
  mockGetActor.mockReset();
  mockGetActor.mockResolvedValue({
    get_pending_messages: vi.fn(async () => []),
    submit_attestation: vi.fn(async () => ({ Ok: 'ack' })),
  });
  process.env.CROSS_CHAIN_SERVICE_CANISTER_ID = 'test-dvn-canister';
  process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';
});

function requestWith(headers: Record<string, string>, body: Record<string, unknown>) {
  return new Request('https://dev-beta.aigentz.me/api/ops/layerzero/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as any;
}

describe('/api/ops/layerzero/process — dual auth', () => {
  it('401s an unauthenticated caller with no cron token and no admin persona', async () => {
    const { POST } = await import('@/app/api/ops/layerzero/process/route');
    const res = await POST(requestWith({}, { action: 'process_pending' }));
    expect(res.status).toBe(401);
  });

  it('accepts a valid CRON_TRIGGER_TOKEN with no persona lookup needed', async () => {
    const { POST } = await import('@/app/api/ops/layerzero/process/route');
    const res = await POST(requestWith({ 'x-cron-token': 'test-cron-token' }, { action: 'process_pending' }));
    expect(res.status).toBe(200);
  });

  it('accepts an authenticated admin persona with no cron token', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
    const { POST } = await import('@/app/api/ops/layerzero/process/route');
    const res = await POST(requestWith({}, { action: 'process_pending' }));
    expect(res.status).toBe(200);
  });

  it('rejects an authenticated NON-admin persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const { POST } = await import('@/app/api/ops/layerzero/process/route');
    const res = await POST(requestWith({}, { action: 'process_pending' }));
    expect(res.status).toBe(401);
  });

  it('a wrong cron token falls through to the persona check, never a bypass', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const { POST } = await import('@/app/api/ops/layerzero/process/route');
    const res = await POST(requestWith({ 'x-cron-token': 'wrong-token' }, { action: 'process_pending' }));
    expect(res.status).toBe(401);
  });
});

describe('/api/ops/dvn/attest — dual auth', () => {
  function attestRequest(headers: Record<string, string>) {
    return new Request('https://dev-beta.aigentz.me/api/ops/dvn/attest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ messageId: 'm1', validator: 'v1', signatureHex: 'aa' }),
    }) as any;
  }

  it('401s an unauthenticated caller', async () => {
    const { POST } = await import('@/app/api/ops/dvn/attest/route');
    const res = await POST(attestRequest({}));
    expect(res.status).toBe(401);
  });

  it('accepts a valid CRON_TRIGGER_TOKEN', async () => {
    mockGetActor.mockResolvedValue({ submit_attestation: vi.fn(async () => ({ Ok: 'ack' })) });
    const { POST } = await import('@/app/api/ops/dvn/attest/route');
    const res = await POST(attestRequest({ 'x-cron-token': 'test-cron-token' }));
    expect(res.status).toBe(200);
  });

  it('accepts an authenticated admin persona', async () => {
    mockGetActor.mockResolvedValue({ submit_attestation: vi.fn(async () => ({ Ok: 'ack' })) });
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
    const { POST } = await import('@/app/api/ops/dvn/attest/route');
    const res = await POST(attestRequest({}));
    expect(res.status).toBe(200);
  });
});
