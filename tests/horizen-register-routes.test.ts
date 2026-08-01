/**
 * POST /api/journey/moneypenny-horizen/register/{prepare,broadcast,status} —
 * the agent-selectable Register stage's 3-step mutation path (2026-07-31).
 * Every real dependency mocked; exercises the route handlers directly.
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

const mockPrepare = vi.fn();
const mockBroadcast = vi.fn();
const mockCheckStatus = vi.fn();
vi.mock('@/services/horizen/registrationClient', () => ({
  prepareAgentRegistration: (...args: any[]) => mockPrepare(...args),
  broadcastAgentRegistration: (...args: any[]) => mockBroadcast(...args),
  checkAgentRegistrationStatus: (...args: any[]) => mockCheckStatus(...args),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: 'receipt-register-1', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

// broadcast/route.ts resolves the owner private key from the agent's own
// custodied wallet (AgentKeyService), never a per-agent env var (operator
// ruling 2026-08-01) — mirrors Verify/Claim's existing AGENT_KEY_REF pattern.
const mockGetAgentKeys = vi.fn();
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: vi.fn().mockImplementation(() => ({
    getAgentKeys: (...args: any[]) => mockGetAgentKeys(...args),
  })),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { POST as prepareRoute } from '@/app/api/journey/moneypenny-horizen/register/prepare/route';
import { POST as broadcastRoute } from '@/app/api/journey/moneypenny-horizen/register/broadcast/route';
import { POST as statusRoute } from '@/app/api/journey/moneypenny-horizen/register/status/route';

function makeRequest(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockPrepare.mockReset();
  mockBroadcast.mockReset();
  mockCheckStatus.mockReset();
  mockCreateActivityReceipt.mockClear();
  mockGetAgentKeys.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('POST register/prepare', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await prepareRoute(makeRequest({ agentSlug: 'moneypenny' }));
    expect(res.status).toBe(401);
  });

  it('400s when agentSlug is missing', async () => {
    const res = await prepareRoute(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('passes through a refusal from prepareAgentRegistration verbatim', async () => {
    mockPrepare.mockResolvedValue({ ok: false, refusalCode: 'ALREADY_REGISTERED', detail: 'already has a tokenId' });
    const res = await prepareRoute(makeRequest({ agentSlug: 'moneypenny' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.refusalCode).toBe('ALREADY_REGISTERED');
  });

  it('returns the unsigned tx on success, unmodified', async () => {
    mockPrepare.mockResolvedValue({ ok: true, value: { agentSlug: 'moneypenny', agentCardUrl: 'https://x/card.json', agentCardHash: 'abc', network: 'base-sepolia', unsignedTx: { to: '0xabc', data: '0x1' } } });
    const res = await prepareRoute(makeRequest({ agentSlug: 'moneypenny' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.unsignedTx).toEqual({ to: '0xabc', data: '0x1' });
    expect(mockPrepare.mock.calls[0][0]).toEqual({ agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' });
  });
});

describe('POST register/broadcast', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await broadcastRoute(makeRequest({ agentSlug: 'moneypenny', confirm: true, unsignedTx: { to: '0xabc', data: '0x1' } }));
    expect(res.status).toBe(401);
  });

  it('400s when confirm is not explicitly true — never signs implicitly', async () => {
    const res = await broadcastRoute(makeRequest({ agentSlug: 'moneypenny', unsignedTx: { to: '0xabc', data: '0x1' } }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.refusalCode).toBe('CONFIRM_REQUIRED');
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('400s for an unknown agentSlug before ever resolving the agent\'s custodied wallet', async () => {
    const res = await broadcastRoute(makeRequest({ agentSlug: 'not-a-real-agent', confirm: true, unsignedTx: { to: '0xabc', data: '0x1' } }));
    expect(res.status).toBe(400);
    expect(mockBroadcast).not.toHaveBeenCalled();
    expect(mockGetAgentKeys).not.toHaveBeenCalled();
  });

  it('409s with OWNER_KEY_NOT_CONFIGURED when the agent has no custodied wallet on record', async () => {
    mockGetAgentKeys.mockResolvedValue(null);
    const res = await broadcastRoute(makeRequest({ agentSlug: 'moneypenny', confirm: true, unsignedTx: { to: '0xabc', data: '0x1' } }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('OWNER_KEY_NOT_CONFIGURED');
    expect(mockBroadcast).not.toHaveBeenCalled();
    expect(mockGetAgentKeys).toHaveBeenCalledWith('aigent-moneypenny');
  });

  it('broadcasts once confirm is true and the agent\'s custodied wallet resolves', async () => {
    mockGetAgentKeys.mockResolvedValue({ evmPrivateKey: '0x' + '11'.repeat(32), evmAddress: '0xOwner' });
    mockBroadcast.mockResolvedValue({ ok: true, value: { txHash: '0xdeadbeef', ownerWalletAddress: '0xOwner', network: 'base-sepolia' } });
    const res = await broadcastRoute(makeRequest({ agentSlug: 'moneypenny', confirm: true, unsignedTx: { to: '0xabc', data: '0x1' } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.txHash).toBe('0xdeadbeef');
  });
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

  it('reports the resolved tokenId and receiptId once confirmed', async () => {
    mockCheckStatus.mockResolvedValue({ ok: true, value: { confirmed: true, tokenId: '4567', registryAlias: '0x11d7', rawStatus: '{"status":"active"}', receiptId: 'receipt-register-1' } });
    const res = await statusRoute(makeRequest({ agentSlug: 'moneypenny', txHash: '0x1', ownerWalletAddress: '0xOwner', network: 'base-sepolia' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.tokenId).toBe('4567');
    expect(json.receiptId).toBe('receipt-register-1');
  });
});
