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
let personaRow: { id: string } | null = null;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === 'registry_assets') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: registryAssetsRow, error: null }) }) }) };
      }
      if (table === 'personas') {
        return { select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: personaRow, error: null }) }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
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
const mockListReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  listActivityReceiptsForPersona: (...args: any[]) => mockListReceipts(...args),
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
  return { nextUrl: { searchParams: new URLSearchParams() } } as unknown as NextRequest;
}

function makeRequestWithBody(body: Record<string, unknown>): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => body,
  } as unknown as NextRequest;
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
  mockListReceipts.mockReset();
  mockRunMarketaAssessment.mockReset();
  mockGetCurrentAssessment.mockReset();
  registryAssetsRow = null;
  personaRow = null;

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

/*
 * THE ACTUAL FIX (Aigent Nakamoto's live registration, 2026-08-03).
 *
 * "Prove wallet control" answered `no registry_assets row for
 * "aigentqube-moneypenny"` while claiming Nakamoto — a double bug:
 * MarketaEligibilityView never sent agentSlug (fixed above the fold in
 * PilotJourneyTab.tsx / MarketaEligibilityView.tsx), AND even with the
 * correct agentSlug, her registry_assets projection had no tokenId because
 * the OTHER write from her confirmed registration (updateRegistryAssetBinding)
 * had not landed. This proves the route survives the second failure too, via
 * the shared resolveHorizenRegistrationBinding fallback.
 */
describe('POST — the agent is honored, and a stuck registry_assets write does not block Claim', () => {
  it('reads the SELECTED agent (nakamoto), never silently falling back to MoneyPenny', async () => {
    registryAssetsRow = {
      metadata: { external_registry_bindings: [{ token_id: '8798', network: 'base-sepolia', transparency: { pulse_enabled: true, pnl_disclosure_authorized: true } }] },
    };
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xNakamotoWallet' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xNakamotoWallet', payloadHash: 'hash', signedAt: '2026-08-03T00:00:00.000Z' } });
    mockRunMarketaAssessment.mockResolvedValue({
      ok: true,
      record: { assessmentId: 'a2', decision: 'RECOMMENDED', rationale: 'ok', satisfiedRules: [], missingRules: [], failedRules: [] },
    });

    const res = await POST(makeRequestWithBody({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockGetAgentAddresses).toHaveBeenCalledWith('aigent-nakamoto');
    const assessArgs = mockRunMarketaAssessment.mock.calls[0][0];
    expect(assessArgs.agentCardUrl).toBe('https://dev-beta.aigentz.me/api/agents/nakamoto/agent-card.json');
  });

  it('falls back to the confirmation receipt when the registry_assets binding write never landed', async () => {
    // The registry_assets projection — exactly Nakamoto's real state: the
    // row and binding exist (Register wrote the placeholder), but token_id
    // is still null because updateRegistryAssetBinding's write did not stick.
    registryAssetsRow = {
      metadata: { external_registry_bindings: [{ token_id: null, registry_alias: null, status: 'pending-registration' }] },
    };
    personaRow = { id: 'persona-nakamoto-journey' };
    mockListReceipts.mockResolvedValue([
      {
        actionType: 'horizen_agent_registered',
        agentsInvoked: ['aigent-nakamoto'],
        actionInput: {
          registration: {
            tokenId: '8798',
            network: 'base-sepolia',
            registryAddress: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
          },
        },
      },
    ]);
    // Verify's own transparency write DID land (a separate, unaffected act) —
    // only the registry_assets tokenId is stuck.
    registryAssetsRow.metadata.external_registry_bindings[0].transparency = { pulse_enabled: true, pnl_disclosure_authorized: true };

    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xNakamotoWallet' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xNakamotoWallet', payloadHash: 'hash', signedAt: '2026-08-03T00:00:00.000Z' } });
    mockRunMarketaAssessment.mockResolvedValue({
      ok: true,
      record: { assessmentId: 'a3', decision: 'RECOMMENDED', rationale: 'ok', satisfiedRules: [], missingRules: [], failedRules: [] },
    });

    const res = await POST(makeRequestWithBody({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.assessment.decision).toBe('RECOMMENDED');
    // The control-proof receipt itself must carry the RECOVERED tokenId, not a blank.
    const receiptCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptCall.actionInput.tokenId).toBe('8798');
  });

  it('still 409s MISSING_TOKEN_ID when NEITHER the projection NOR any receipt has a tokenId — a real "not registered" is not papered over', async () => {
    registryAssetsRow = {
      metadata: { external_registry_bindings: [{ token_id: null, registry_alias: null, status: 'pending-registration' }] },
    };
    personaRow = { id: 'persona-nakamoto-journey' };
    mockListReceipts.mockResolvedValue([]);

    const res = await POST(makeRequestWithBody({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.refusalCode).toBe('MISSING_TOKEN_ID');
  });
});
