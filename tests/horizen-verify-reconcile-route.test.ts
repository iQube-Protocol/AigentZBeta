/**
 * POST /api/journey/moneypenny-horizen/verify/reconcile — the receipted-
 * constitutional-state reconciliation surface (operator directive,
 * 2026-08-08).
 *
 * Mirrors tests/horizen-verify-status-route.test.ts's convention: vi.mock
 * every real dependency, invoke the exported handler directly, never a live
 * network/DB call. `resolveHorizenRegistrationBinding` is left UNMOCKED and
 * runs for real against the mocked Supabase client, same as that file.
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

const mockReconcilePulseConstitutionalState = vi.fn();
vi.mock('@/services/horizen/authorizationClient', () => ({
  reconcilePulseConstitutionalState: (...args: any[]) => mockReconcilePulseConstitutionalState(...args),
}));

import { POST } from '@/app/api/journey/moneypenny-horizen/verify/reconcile/route';

function makeRequest(agentSlug = 'nakamoto'): NextRequest {
  const url = new URL(`https://dev-beta.aigentz.me/api/journey/moneypenny-horizen/verify/reconcile?agentSlug=${agentSlug}`);
  return { nextUrl: url } as unknown as NextRequest;
}

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

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockReconcilePulseConstitutionalState.mockReset();
  registryAssetsRow = null;
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('POST verify/reconcile', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('refuses NOT_STARTED when Register has not completed (no tokenId)', async () => {
    registryAssetsRow = { metadata: { external_registry_bindings: [] } };
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('NOT_STARTED');
    expect(mockReconcilePulseConstitutionalState).not.toHaveBeenCalled();
  });

  it('on agreement, forwards agreement=true and no discrepancy ref — the constitutional state is untouched by this route itself', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockReconcilePulseConstitutionalState.mockResolvedValue({
      ok: true,
      agreement: true,
      receiptedEvidence: { pulseEnrolled: true, pulseCommitmentRecorded: true },
      freshStatus: { pulseEnrolled: true, pulseCommitmentRecorded: true },
      disagreements: [],
      discrepancyReceiptRef: null,
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.agreement).toBe(true);
    expect(json.discrepancyReceiptRef).toBeNull();
    expect(json.authorizationId).toBe('horizen-pulse-auth-aigentqube-nakamoto-8798-base-sepolia');
    const callArgs = mockReconcilePulseConstitutionalState.mock.calls[0];
    expect(callArgs[0]).toBe('horizen-pulse-auth-aigentqube-nakamoto-8798-base-sepolia');
    expect(callArgs[1]).toMatchObject({ registry: { network: 'base-sepolia', tokenId: '8798' } });
  });

  it('on disagreement, forwards agreement=false, the disagreeing fields, and the discrepancy receipt ref', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockReconcilePulseConstitutionalState.mockResolvedValue({
      ok: true,
      agreement: false,
      receiptedEvidence: { pulseEnrolled: true },
      freshStatus: { pulseEnrolled: false },
      disagreements: ['pulseEnrolled'],
      discrepancyReceiptRef: 'receipt-discrepancy-1',
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.agreement).toBe(false);
    expect(json.disagreements).toEqual(['pulseEnrolled']);
    expect(json.discrepancyReceiptRef).toBe('receipt-discrepancy-1');
  });

  it('surfaces a refusal (e.g. NO_RECEIPTED_EVIDENCE) as a 409 with the refusal code named, never a bare 500', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockReconcilePulseConstitutionalState.mockResolvedValue({
      ok: false,
      refusalCode: 'NO_RECEIPTED_EVIDENCE',
      detail: 'nothing to reconcile against',
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.refusalCode).toBe('NO_RECEIPTED_EVIDENCE');
  });

  it('answers with a named JSON refusal, never an empty body, when something throws unexpectedly', async () => {
    registryAssetsRow = NAKAMOTO_BOUND_ROW;
    mockReconcilePulseConstitutionalState.mockRejectedValue(new Error('boom'));

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error).toContain('boom');
  });
});
