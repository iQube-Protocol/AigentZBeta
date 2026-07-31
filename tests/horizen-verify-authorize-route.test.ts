/**
 * POST /api/journey/moneypenny-horizen/verify/authorize — GJR-VFY-001 Phase
 * 2. Exercises the route handler directly (vi.mock on every real
 * dependency), never a live network/DB call — mirrors
 * tests/independent-review-supersede-authority.test.ts's convention of
 * invoking the exported handler rather than only grepping its source.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

let registryAssetsRow: { metadata: any } | null = null;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table !== 'registry_assets') throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: registryAssetsRow, error: null }),
          }),
        }),
      };
    },
  }),
}));

const mockGetAgentAddresses = vi.fn();
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: class {
    getAgentAddresses(agentId: string) {
      return mockGetAgentAddresses(agentId);
    }
  },
}));

const mockRunHorizenTransparencyAuthorization = vi.fn();
vi.mock('@/services/horizen/authorizationClient', () => ({
  runHorizenTransparencyAuthorization: (...args: any[]) => mockRunHorizenTransparencyAuthorization(...args),
}));

const mockEnrichAgentCard = vi.fn();
vi.mock('@/services/horizen/agentCardEnrichment', () => ({
  enrichAgentCardAfterHorizenAuthorization: (...args: any[]) => mockEnrichAgentCard(...args),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from '@/app/api/journey/moneypenny-horizen/verify/authorize/route';

function makeRequest(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetAgentAddresses.mockReset();
  mockRunHorizenTransparencyAuthorization.mockReset();
  mockEnrichAgentCard.mockReset();
  mockFetch.mockReset();
  registryAssetsRow = null;

  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
  mockFetch.mockResolvedValue({ ok: true, status: 200, text: async () => '{"name":"Aigent MoneyPenny"}' });
});

const BOUND_ROW = {
  metadata: {
    external_registry_bindings: [
      { protocol: 'erc-8004', registry: 'horizen', network: 'base-sepolia', token_id: '1234', registry_alias: '0x4d2', status: 'registered' },
    ],
  },
};

describe('POST verify/authorize — refusals', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('409s with NO_PERSISTED_AIGENTQUBE when no registry_assets row exists', async () => {
    registryAssetsRow = null;
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('NO_PERSISTED_AIGENTQUBE');
  });

  it('409s with MISSING_TOKEN_ID when the binding has no tokenId yet (Register incomplete)', async () => {
    registryAssetsRow = { metadata: { external_registry_bindings: [{ token_id: null, network: 'base-sepolia' }] } };
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('MISSING_TOKEN_ID');
    expect(mockGetAgentAddresses).not.toHaveBeenCalled();
  });

  it('409s with NO_CONTROLLER_WALLET when agent_keys has no evm_address on record', async () => {
    registryAssetsRow = BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue(null);
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('NO_CONTROLLER_WALLET');
  });

  it('502s with AGENT_CARD_UNAVAILABLE when the Agent Card cannot be fetched, never signing over a stale hash', async () => {
    registryAssetsRow = BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.refusalCode).toBe('AGENT_CARD_UNAVAILABLE');
    expect(mockRunHorizenTransparencyAuthorization).not.toHaveBeenCalled();
  });

  it('422s and passes through the authorizationClient refusal verbatim', async () => {
    registryAssetsRow = BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockRunHorizenTransparencyAuthorization.mockResolvedValue({ ok: false, refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND', detail: 'no compatible tool' });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.refusalCode).toBe('HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND');
    expect(mockEnrichAgentCard).not.toHaveBeenCalled();
  });
});

describe('POST verify/authorize — success', () => {
  it('resolves real inputs from registry_assets + agent_keys + a fresh Agent Card fetch, then enriches', async () => {
    registryAssetsRow = BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockRunHorizenTransparencyAuthorization.mockResolvedValue({ ok: true, value: { authorizationId: 'horizen-pulse-auth-aigentqube-moneypenny-1234-base-sepolia', receiptRef: 'receipt-1' } });
    mockEnrichAgentCard.mockResolvedValue({ ok: true, receiptRefs: { pnlTransparencyEnabled: 'r-pnl', agentCardEnriched: 'r-enrich' } });

    const res = await POST(makeRequest({ scope: ['pulse-monitoring', 'pnl-disclosure'] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.receiptRefs).toEqual({ pnlTransparencyEnabled: 'r-pnl', agentCardEnriched: 'r-enrich' });

    const authorizeArgs = mockRunHorizenTransparencyAuthorization.mock.calls[0][0];
    expect(authorizeArgs.actorPersonaId).toBe('persona-operator-1');
    expect(authorizeArgs.controllerWallet).toBe('0xController');
    expect(authorizeArgs.registry).toEqual({ network: 'base-sepolia', tokenId: '1234', registryAlias: '0x4d2' });
    expect(authorizeArgs.keyRef).toBe('aigent-moneypenny');
    expect(typeof authorizeArgs.agentCardHash).toBe('string');
    expect(authorizeArgs.agentCardHash).toHaveLength(64); // sha256 hex
  });

  it('reports the authorization as successful even if enrichment itself fails — a separate, retryable step', async () => {
    registryAssetsRow = BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockRunHorizenTransparencyAuthorization.mockResolvedValue({ ok: true, value: { authorizationId: 'auth-1', receiptRef: 'receipt-1' } });
    mockEnrichAgentCard.mockResolvedValue({ ok: false, refusalCode: 'NO_MATCHING_BINDING', detail: 'binding drifted' });

    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.enrichmentRefusalCode).toBe('NO_MATCHING_BINDING');
  });

  it('defaults scope to pulse-monitoring + pnl-disclosure when no body scope is supplied', async () => {
    registryAssetsRow = BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockRunHorizenTransparencyAuthorization.mockResolvedValue({ ok: true, value: { authorizationId: 'auth-1', receiptRef: null } });
    mockEnrichAgentCard.mockResolvedValue({ ok: true, receiptRefs: { pnlTransparencyEnabled: null, agentCardEnriched: null } });

    await POST(makeRequest());
    expect(mockRunHorizenTransparencyAuthorization.mock.calls[0][0].scope).toEqual(['pulse-monitoring', 'pnl-disclosure']);
  });
});
