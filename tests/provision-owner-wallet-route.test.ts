/**
 * POST /api/ops/wallet/provision-owner-wallet (2026-09-05, Factor/Aegis
 * identity provisioning + security correction). Proves the ROUTE layer:
 * CRON_TRIGGER_TOKEN fail-closed auth, request validation, and that the
 * response never carries private key material — the underlying
 * idempotency/fail-closed-secret logic is already covered by
 * tests/agent-purpose-wallet-service.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

const mockProvisionOwnerWallet = vi.fn();
vi.mock('@/services/wallet/agentPurposeWalletService', () => ({
  AgentPurposeWalletService: vi.fn().mockImplementation(() => ({
    provisionOwnerWallet: (...args: unknown[]) => mockProvisionOwnerWallet(...args),
  })),
}));

import { POST, GET } from '@/app/api/ops/wallet/provision-owner-wallet/route';

function req(body?: unknown, headers?: Record<string, string>) {
  return new NextRequest('https://dev-beta.aigentz.me/api/ops/wallet/provision-owner-wallet', {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ORIGINAL_TOKEN = process.env.CRON_TRIGGER_TOKEN;

beforeEach(() => {
  mockProvisionOwnerWallet.mockReset();
  process.env.CRON_TRIGGER_TOKEN = 'test-cron-token';
});

afterAll(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.CRON_TRIGGER_TOKEN;
  else process.env.CRON_TRIGGER_TOKEN = ORIGINAL_TOKEN;
});

describe('POST /api/ops/wallet/provision-owner-wallet — auth', () => {
  it('503s when CRON_TRIGGER_TOKEN is not configured server-side', async () => {
    delete process.env.CRON_TRIGGER_TOKEN;
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' }));
    expect(res.status).toBe(503);
    expect(mockProvisionOwnerWallet).not.toHaveBeenCalled();
  });

  it('401s when no token is provided', async () => {
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' }));
    expect(res.status).toBe(401);
    expect(mockProvisionOwnerWallet).not.toHaveBeenCalled();
  });

  it('401s when the wrong token is provided', async () => {
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' }, { 'x-cron-token': 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('accepts the token via x-cron-token', async () => {
    mockProvisionOwnerWallet.mockResolvedValue({ ok: true, address: '0xabc', created: true });
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' }, { 'x-cron-token': 'test-cron-token' }));
    expect(res.status).toBe(200);
  });

  it('accepts the token via Authorization: Bearer', async () => {
    mockProvisionOwnerWallet.mockResolvedValue({ ok: true, address: '0xabc', created: true });
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' }, { authorization: 'Bearer test-cron-token' }));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/ops/wallet/provision-owner-wallet — request validation and response shape', () => {
  it('400s when runtimeAgentId or agentName is missing — never defaults them', async () => {
    const res = await POST(req({}, { 'x-cron-token': 'test-cron-token' }));
    expect(res.status).toBe(400);
    expect(mockProvisionOwnerWallet).not.toHaveBeenCalled();
  });

  it('forwards a refusal (e.g. missing encryption secret) as a 400, not a 500', async () => {
    mockProvisionOwnerWallet.mockResolvedValue({ ok: false, refusalCode: 'AGENT_KEY_ENCRYPTION_SECRET_MISSING', detail: 'missing' });
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor' }, { 'x-cron-token': 'test-cron-token' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.refusalCode).toBe('AGENT_KEY_ENCRYPTION_SECRET_MISSING');
  });

  it('the success response never contains a private key field, however named', async () => {
    mockProvisionOwnerWallet.mockResolvedValue({ ok: true, address: '0xabc123', created: true });
    const res = await POST(req({ runtimeAgentId: 'aigent-factor', agentName: 'Factor', fioHandle: 'factor@aigent' }, { 'x-cron-token': 'test-cron-token' }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.address).toBe('0xabc123');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('privatekey');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('private_key');
  });
});

describe('GET /api/ops/wallet/provision-owner-wallet', () => {
  it('describes the route without requiring auth', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe('POST');
  });
});
