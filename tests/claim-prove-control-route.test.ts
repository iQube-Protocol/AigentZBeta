/**
 * GET/POST /api/journey/moneypenny-horizen/claim/prove-control —
 * GJR Phase 5. Every real dependency mocked; exercises the handler
 * directly, never a live network/DB call.
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
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: registryAssetsRow, error: null }) }) }) };
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

const mockSignPartnerAuthorization = vi.fn();
vi.mock('@/services/signing/partnerAuthorizationSigner', () => ({
  signPartnerAuthorization: (...args: any[]) => mockSignPartnerAuthorization(...args),
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

const mockRunMarketaAssessment = vi.fn();
vi.mock('@/services/marketa/admissionAssessmentRunner', () => ({
  runMarketaAdmissionAssessment: (...args: any[]) => mockRunMarketaAssessment(...args),
}));

const mockGetCurrentAssessment = vi.fn();
vi.mock('@/services/marketa/admissionAssessmentStore', () => ({
  getCurrentMarketaAdmissionAssessment: (...args: any[]) => mockGetCurrentAssessment(...args),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

import { GET, POST } from '@/app/api/journey/moneypenny-horizen/claim/prove-control/route';

function makeRequest(): NextRequest {
  return {} as unknown as NextRequest;
}

const VERIFIED_BOUND_ROW = {
  metadata: {
    external_registry_bindings: [
      {
        network: 'base-sepolia',
        token_id: '1234',
        transparency: { pulse_enabled: true, pnl_disclosure_authorized: true, pulse_authorization_ref: 'auth-1', pnl_proof_refs: [] },
      },
    ],
  },
};

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetAgentAddresses.mockReset();
  mockSignPartnerAuthorization.mockReset();
  mockCreateActivityReceipt.mockClear();
  mockRunMarketaAssessment.mockReset();
  mockGetCurrentAssessment.mockReset();
  registryAssetsRow = null;

  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('GET — current assessment lookup', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns null when no assessment exists yet', async () => {
    mockGetCurrentAssessment.mockResolvedValue(null);
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ ok: true, assessment: null });
  });

  it('returns the current assessment, trimmed to the view shape', async () => {
    mockGetCurrentAssessment.mockResolvedValue({
      assessmentId: 'a1', decision: 'RECOMMENDED', mode: 'FINAL', rationale: 'all satisfied',
      satisfiedRules: ['MKT-ADM-001'], missingRules: [], failedRules: [],
    });
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.assessment.decision).toBe('RECOMMENDED');
  });
});

describe('POST — refusals', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('409s NO_PERSISTED_AIGENTQUBE when no registry_assets row exists', async () => {
    registryAssetsRow = null;
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('NO_PERSISTED_AIGENTQUBE');
  });

  it('409s MISSING_TOKEN_ID when Register has not completed', async () => {
    registryAssetsRow = { metadata: { external_registry_bindings: [{ token_id: null }] } };
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('MISSING_TOKEN_ID');
  });

  it('409s VERIFY_NOT_COMPLETE when Pulse/PnL transparency is not yet authorized', async () => {
    registryAssetsRow = { metadata: { external_registry_bindings: [{ token_id: '1234', network: 'base-sepolia' }] } };
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('VERIFY_NOT_COMPLETE');
    expect(mockGetAgentAddresses).not.toHaveBeenCalled();
  });

  it('409s NO_CONTROLLER_WALLET when agent_keys has no evm_address', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue(null);
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('NO_CONTROLLER_WALLET');
  });

  it('422s and passes through a signing refusal verbatim, never running the Marketa assessment', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: false, refusalCode: 'KEY_NOT_FOUND', detail: 'no key' });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.refusalCode).toBe('KEY_NOT_FOUND');
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
    expect(mockRunMarketaAssessment).not.toHaveBeenCalled();
  });
});

describe('POST — success', () => {
  it('proves control, records the receipt, then runs the FINAL Marketa assessment', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xController', payloadHash: 'hash', signedAt: '2026-07-31T12:00:00.000Z' } });
    mockRunMarketaAssessment.mockResolvedValue({
      ok: true,
      record: { assessmentId: 'a1', decision: 'RECOMMENDED', rationale: 'all satisfied', satisfiedRules: ['MKT-ADM-001'], missingRules: [], failedRules: [] },
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.assessment.decision).toBe('RECOMMENDED');

    const receiptCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptCall.actionType).toBe('agent_control_proven');
    expect(receiptCall.personaId).toBe('persona-operator-1');
    expect(receiptCall.actionInput.signerWallet).toBe('0xController');

    const assessArgs = mockRunMarketaAssessment.mock.calls[0][0];
    expect(assessArgs.mode).toBe('FINAL');
    expect(assessArgs.actorPersonaId).toBe('persona-operator-1');
    expect(assessArgs.agentCardUrl).toBe('https://dev-beta.aigentz.me/api/agents/moneypenny/agent-card.json');
  });

  it('reports control proven even if the Marketa assessment itself fails to run', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xController', payloadHash: 'hash', signedAt: '2026-07-31T12:00:00.000Z' } });
    mockRunMarketaAssessment.mockResolvedValue({ ok: false, refusalCode: 'AIGENTQUBE_NOT_FOUND', detail: 'gone' });

    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.assessmentRefusalCode).toBe('AIGENTQUBE_NOT_FOUND');
    expect(json.controlProofReceiptId).toBe('receipt-agent_control_proven');
  });
});
