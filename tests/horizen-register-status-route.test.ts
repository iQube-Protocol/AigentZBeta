/**
 * POST /api/journey/moneypenny-horizen/register/status — the Register
 * ceremony's status-poll route (2026-07-31; retitled 2026-08-01 when
 * register/prepare and register/broadcast were retired — see
 * tests/register-ceremony-routes.test.ts for their replacements, the
 * wallet-mediated ceremony's own routes). Every real dependency mocked;
 * exercises the route handler directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

const mockCheckStatus = vi.fn();
vi.mock('@/services/horizen/registrationClient', () => ({
  checkAgentRegistrationStatus: (...args: any[]) => mockCheckStatus(...args),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: 'receipt-register-1', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { POST as statusRoute } from '@/app/api/journey/moneypenny-horizen/register/status/route';

function makeRequest(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockCheckStatus.mockReset();
  mockCreateActivityReceipt.mockClear();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('POST register/status', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await statusRoute(makeRequest({ agentSlug: 'moneypenny', txHash: '0x1', ownerWalletAddress: '0xOwner', network: 'base-sepolia' }));
    expect(res.status).toBe(401);
  });

  it('400s when required fields are missing', async () => {
    const res = await statusRoute(makeRequest({ agentSlug: 'moneypenny' }));
    expect(res.status).toBe(400);
  });

  it('reports confirmed:false without error when not yet active', async () => {
    mockCheckStatus.mockResolvedValue({ ok: true, value: { confirmed: false, tokenId: null, registryAlias: null, rawStatus: '{"status":"pending"}', receiptId: null } });
    const res = await statusRoute(makeRequest({ agentSlug: 'moneypenny', txHash: '0x1', ownerWalletAddress: '0xOwner', network: 'base-sepolia' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.confirmed).toBe(false);
  });

  it('reports the resolved tokenId and receiptId once confirmed, and writes the two ceremony evidence receipts alongside horizen_agent_registered', async () => {
    mockCheckStatus.mockImplementation(async (input: any, deps: any) => {
      // Exercise the route's own createRegistrationReceipt callback exactly as checkAgentRegistrationStatus would.
      const receiptId = await deps.createRegistrationReceipt({
        actorPersonaId: input.actorPersonaId,
        agent: { displayName: 'Aigent MoneyPenny', runtimeAgentId: 'aigent-moneypenny', aigentQubeId: 'aigentqube-moneypenny' },
        network: input.network,
        txHash: input.txHash,
      });
      return { ok: true, value: { confirmed: true, tokenId: '4567', registryAlias: '0x11d7', rawStatus: '{"status":"active"}', receiptId } };
    });
    const res = await statusRoute(makeRequest({ agentSlug: 'moneypenny', txHash: '0x1', ownerWalletAddress: '0xOwner', network: 'base-sepolia' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.tokenId).toBe('4567');
    expect(json.receiptId).toBe('receipt-register-1');
    const types = mockCreateActivityReceipt.mock.calls.map((c) => c[0].actionType);
    expect(types).toEqual(['horizen_agent_registered', 'horizen_registration_confirmed', 'agent_registry_binding_recorded']);
  });
});
