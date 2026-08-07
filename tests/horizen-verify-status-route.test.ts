/**
 * GET /api/journey/moneypenny-horizen/verify/status — the exact Aigent
 * Nakamoto regression (2026-08-07).
 *
 * Direct Supabase query on the live `registry_assets` row proved the
 * binding was present and matching (registry=horizen, network=base-sepolia,
 * token_id=8798) while `partner_authorization_requests` already read
 * CONFIRMED and `binding.transparency` was null. So the defect was never a
 * missing fact — the `record.state === 'CONFIRMED'` branch answered
 * `state: 'complete'` straight from the partner-authorization row without
 * ever checking whether that confirmation had been projected onto the
 * binding's `transparency` field, and never retried the (idempotent)
 * enrichment write when it hadn't. This file pins that exact branch.
 *
 * Mirrors tests/horizen-verify-authorize-route.test.ts's convention:
 * vi.mock every real dependency, invoke the exported handler directly,
 * never a live network/DB call. `resolveHorizenRegistrationBinding` is left
 * UNMOCKED and runs for real against the mocked Supabase client, exactly as
 * the authorize-route test already does — it is a pure projection of
 * `registry_assets`, not a second source of truth to fake out.
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

const mockGetPartnerAuthorizationRequest = vi.fn();
vi.mock('@/services/horizen/partnerAuthorizationStore', () => ({
  getPartnerAuthorizationRequest: (...args: any[]) => mockGetPartnerAuthorizationRequest(...args),
}));

const mockVerifyHorizenTransparencyActivation = vi.fn();
vi.mock('@/services/horizen/authorizationClient', () => ({
  verifyHorizenTransparencyActivation: (...args: any[]) => mockVerifyHorizenTransparencyActivation(...args),
  RECONCILABLE_STATES: ['SUBMITTED', 'REFUSED', 'QUARANTINED', 'EXPIRED'],
}));

const mockGetAgentAddresses = vi.fn();
vi.mock('@/services/identity/agentKeyService', () => ({
  AgentKeyService: class {
    getAgentAddresses(agentId: string) {
      return mockGetAgentAddresses(agentId);
    }
  },
}));

const mockEnrichAgentCard = vi.fn();
vi.mock('@/services/horizen/agentCardEnrichment', () => ({
  enrichAgentCardAfterHorizenAuthorization: (...args: any[]) => mockEnrichAgentCard(...args),
}));

import { GET } from '@/app/api/journey/moneypenny-horizen/verify/status/route';

function makeRequest(agentSlug = 'nakamoto'): NextRequest {
  const url = new URL(`https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/verify/status?agentSlug=${agentSlug}`);
  return { nextUrl: url } as unknown as NextRequest;
}

// The exact live binding recovered by direct SQL query, 2026-08-07 —
// present and matching, `transparency` absent.
const NAKAMOTO_BOUND_ROW = {
  metadata: {
    external_registry_bindings: [
      {
        protocol: 'erc-8004',
        registry: 'horizen',
        network: 'base-sepolia',
        token_id: '8798',
        status: 'registered',
        agent_card_url: '/api/agents/nakamoto/agent-card.json',
        registry_alias: null,
        identity_registry_contract: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
      },
    ],
  },
};

const AUTHORIZATION_ID = 'horizen-pulse-auth-aigentqube-nakamoto-8798-base-sepolia';

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetPartnerAuthorizationRequest.mockReset();
  mockVerifyHorizenTransparencyActivation.mockReset();
  mockGetAgentAddresses.mockReset();
  mockEnrichAgentCard.mockReset();
  registryAssetsRow = null;

  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('GET verify/status — CONFIRMED short-circuit must not conflate authorization with enrichment', () => {
  it('retries enrichment inline when CONFIRMED but the binding has never been enriched, then reports complete with receipts', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'CONFIRMED', receiptRef: 'receipt-confirm-1' });
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockEnrichAgentCard.mockResolvedValue({
      ok: true,
      receiptRefs: { pnlTransparencyEnabled: 'r-pnl', agentCardEnriched: 'r-enrich' },
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.state).toBe('complete');
    expect(json.receiptRefs).toEqual({ pnlTransparencyEnabled: 'r-pnl', agentCardEnriched: 'r-enrich' });
    // The already-CONFIRMED short-circuit must never re-run the partner
    // reread — that path is reserved for SUBMITTED/REFUSED/QUARANTINED/EXPIRED.
    expect(mockVerifyHorizenTransparencyActivation).not.toHaveBeenCalled();

    expect(mockEnrichAgentCard).toHaveBeenCalledTimes(1);
    const enrichArgs = mockEnrichAgentCard.mock.calls[0][0];
    expect(enrichArgs.authorizationId).toBe(AUTHORIZATION_ID);
    expect(enrichArgs.tokenId).toBe('8798');
    expect(enrichArgs.network).toBe('base-sepolia');
    expect(enrichArgs.controllerWallet).toBe('0xController');
  });

  it('does not re-run enrichment when the binding is already enriched — no redundant writes', async () => {
    registryAssetsRow = {
      metadata: {
        external_registry_bindings: [
          {
            ...NAKAMOTO_BOUND_ROW.metadata.external_registry_bindings[0],
            transparency: { pulse_enabled: true, pulse_authorization_ref: AUTHORIZATION_ID, pnl_disclosure_authorized: true, pnl_proof_refs: [] },
          },
        ],
      },
    };
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'CONFIRMED', receiptRef: 'receipt-confirm-1' });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.state).toBe('complete');
    expect(json.enrichmentRefusalCode).toBeUndefined();
    expect(mockEnrichAgentCard).not.toHaveBeenCalled();
    expect(mockGetAgentAddresses).not.toHaveBeenCalled();
  });

  it('surfaces an enrichment failure honestly instead of swallowing it into a bare "complete"', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'CONFIRMED', receiptRef: 'receipt-confirm-1' });
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockEnrichAgentCard.mockResolvedValue({
      ok: false,
      refusalCode: 'NO_MATCHING_BINDING',
      detail: 'no external_registry_bindings entry matches tokenId "8798" on network "base-sepolia"',
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    // The constitutional act succeeded; its projection did not. Both facts
    // must be visible in the same response — never one reported as if the
    // other never happened.
    expect(json.state).toBe('complete');
    expect(json.enrichmentRefusalCode).toBe('NO_MATCHING_BINDING');
    expect(json.enrichmentError).toContain('no external_registry_bindings entry matches');
  });

  it('surfaces NO_CONTROLLER_WALLET when the retry cannot resolve a wallet, without throwing', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockGetPartnerAuthorizationRequest.mockResolvedValue({ state: 'CONFIRMED', receiptRef: 'receipt-confirm-1' });
    mockGetAgentAddresses.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.state).toBe('complete');
    expect(json.enrichmentRefusalCode).toBe('NO_CONTROLLER_WALLET');
    expect(mockEnrichAgentCard).not.toHaveBeenCalled();
  });
});
