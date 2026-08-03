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
const mockListActivityReceiptsForPersona = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
  // Keyed on the AGENT, not a persona — receipts are written against the
  // acting operator's persona, so an agent's own persona never holds them.
  findAgentRegistrationReceipts: (...args: any[]) => mockListReceipts(...args),
  // The resume-without-re-signing check (2026-08-03) — an existing fresh
  // agent_control_proven receipt for THIS agent means the route skips
  // signing entirely. Empty by default so pre-existing tests keep exercising
  // the sign-a-fresh-proof path unchanged.
  listActivityReceiptsForPersona: (...args: any[]) => mockListActivityReceiptsForPersona(...args),
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
  mockListActivityReceiptsForPersona.mockReset();
  mockListActivityReceiptsForPersona.mockResolvedValue([]);
  mockRunMarketaAssessment.mockReset();
  mockGetCurrentAssessment.mockReset();
  registryAssetsRow = null;
  personaRow = null;

  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('GET — observed control state (never a Marketa assessment)', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('reports controlProven false when no proof exists for this agent', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([]);
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, controlProven: false, controlProofReceiptId: null });
  });

  /*
   * THE OBSERVATION THAT ENDS THE ACT (operator, 2026-08-03: "The 'Prove
   * wallet control' button must disappear once the existing proof is
   * observed"). This route previously returned Marketa's assessment, so the
   * surface had no way to learn control was already proven and offered the
   * signing act forever.
   */
  it('reports an existing fresh proof, so the surface can stop offering the act', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([
      {
        id: 'receipt-existing-control',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        actionInput: { aigentQubeId: 'aigentqube-moneypenny', signerWallet: '0xController' },
      },
    ]);
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.controlProven).toBe(true);
    expect(json.controlProofFresh).toBe(true);
    expect(json.controlProofReceiptId).toBe('receipt-existing-control');
    expect(json.signerWallet).toBe('0xController');
  });

  it('never returns a Marketa assessment — Claim has no Marketa dependency', async () => {
    mockListActivityReceiptsForPersona.mockResolvedValue([]);
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json).not.toHaveProperty('assessment');
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

  /*
   * REPLACED, NOT DELETED (operator ruling 2026-08-03; CANARY-REPRODUCES-DEFECT).
   *
   * This asserted `409 VERIFY_NOT_COMPLETE` when Pulse/P&L were unauthorized —
   * a canary DEFENDING a gate that was stricter than the constitution it
   * enforces. Marketa's ratified engine keeps Pulse (MKT-ADM-007) and P&L
   * (MKT-ADM-008) OUT of REFUSAL_RULE_IDS: absent, they are `missing`
   * evidence, never a refusal. The operator: "Verify should be the last
   * Horizen dependent stage and then everything else is our own systems."
   *
   * So the assertion is inverted to the requirement it should always have
   * encoded: unauthorized transparency must NOT stop Claim, and the route
   * must carry on to its real constitutional prerequisites.
   */
  it('does NOT refuse when Pulse/PnL transparency is unauthorized — it carries on to the real prerequisites', async () => {
    registryAssetsRow = { metadata: { external_registry_bindings: [{ token_id: '1234', network: 'base-sepolia' }] } };
    mockGetAgentAddresses.mockResolvedValue(null); // the NEXT, genuine gate
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json.refusalCode, 'an optional partner enrichment must not immobilise Claim').not.toBe('VERIFY_NOT_COMPLETE');
    // It reached the controller-wallet check, which the old gate short-circuited.
    expect(mockGetAgentAddresses).toHaveBeenCalled();
    expect(json.refusalCode).toBe('NO_CONTROLLER_WALLET');
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
  it('proves control and records the receipt — and runs no Marketa assessment', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xController', payloadHash: 'hash', signedAt: '2026-07-31T12:00:00.000Z' } });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.controlProven).toBe(true);
    expect(json.resumedFromExistingProof).toBe(false);

    const receiptCall = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptCall.actionType).toBe('agent_control_proven');
    expect(receiptCall.personaId).toBe('persona-operator-1');
    expect(receiptCall.actionInput.signerWallet).toBe('0xController');

    /*
     * CLAIM = REGISTRATION + CONTROL PROOF, AND NOTHING ELSE (operator ruling
     * 2026-08-03). Marketa is a post-aigentMe financial-services enrichment;
     * running it here made an optional enrichment part of a constitutional
     * act, so a missing assessments table read as a Claim failure.
     */
    expect(mockRunMarketaAssessment, 'Claim must not run a Marketa assessment').not.toHaveBeenCalled();
    expect(json).not.toHaveProperty('assessment');
    expect(json).not.toHaveProperty('assessmentRefusalCode');
  });
});

describe('POST — resume from settled state, never re-sign (2026-08-03)', () => {
  /*
   * The operator's requirement, verbatim: "Resume Claim from the existing
   * agent_control_proven receipt. Do not request another signature... the
   * five duplicate control-proof receipts should be treated as corroborating
   * duplicates and never cause another signing prompt." Every prior version
   * of this route signed a FRESH challenge unconditionally on every POST —
   * the actual mechanism that produced those five duplicates.
   */
  it('reuses an existing fresh control-proof receipt for this agent — never signs again', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockListActivityReceiptsForPersona.mockResolvedValue([
      {
        id: 'receipt-existing-control',
        createdAt: new Date(Date.now() - 1000).toISOString(),
        actionInput: { aigentQubeId: 'aigentqube-moneypenny', signerWallet: '0xController' },
      },
    ]);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.controlProofReceiptId).toBe('receipt-existing-control');
    expect(json.resumedFromExistingProof).toBe(true);
    expect(mockGetAgentAddresses, 'no need to resolve a signer wallet when reusing an existing proof').not.toHaveBeenCalled();
    expect(mockSignPartnerAuthorization).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('signs a fresh proof when the existing receipt is stale (older than the freshness window)', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xController', payloadHash: 'hash', signedAt: '2026-07-31T12:00:00.000Z' } });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      {
        id: 'receipt-stale-control',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago — outside the 24h window
        actionInput: { aigentQubeId: 'aigentqube-moneypenny', signerWallet: '0xController' },
      },
    ]);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockSignPartnerAuthorization).toHaveBeenCalled();
    expect(mockCreateActivityReceipt).toHaveBeenCalled();
  });

  it('signs a fresh proof when the only existing receipt is for a different aigentQube', async () => {
    registryAssetsRow = VERIFIED_BOUND_ROW;
    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xController' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xController', payloadHash: 'hash', signedAt: '2026-07-31T12:00:00.000Z' } });
    mockListActivityReceiptsForPersona.mockResolvedValue([
      {
        id: 'receipt-other-agent',
        createdAt: new Date(Date.now() - 1000).toISOString(),
        actionInput: { aigentQubeId: 'aigentqube-someone-else', signerWallet: '0xController' },
      },
    ]);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockSignPartnerAuthorization).toHaveBeenCalled();
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

    const res = await POST(makeRequestWithBody({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockGetAgentAddresses).toHaveBeenCalledWith('aigent-nakamoto');
  });

  it('falls back to the confirmation receipt when the registry_assets binding write never landed', async () => {
    // The registry_assets projection — exactly Nakamoto's real state: the
    // row and binding exist (Register wrote the placeholder), but token_id
    // is still null because updateRegistryAssetBinding's write did not stick.
    registryAssetsRow = {
      metadata: { external_registry_bindings: [{ token_id: null, registry_alias: null, status: 'pending-registration' }] },
    };
    personaRow = { id: 'persona-nakamoto-journey' };
    // The flat facts shape findAgentRegistrationReceipts returns. A receipt
    // carrying its own tokenId short-circuits before any chain call — the
    // pre-enrichment (txHash-only) variant and its on-chain recovery are
    // covered in tests/horizen-agent-registration-binding.test.ts, where the
    // provider can be injected rather than dialled for real.
    mockListReceipts.mockResolvedValue([
      {
        receiptId: 'r-nakamoto',
        txHash: '0xedda5f7388434fd979311b4573d1058ad33219058290ef8ea10b429b64b5dde6',
        network: 'base-sepolia',
        tokenId: '8798',
        registryAddress: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
        ownerAddress: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9',
        createdAt: '2026-08-02T21:09:59.000Z',
      },
    ]);
    // Verify's own transparency write DID land (a separate, unaffected act) —
    // only the registry_assets tokenId is stuck.
    registryAssetsRow.metadata.external_registry_bindings[0].transparency = { pulse_enabled: true, pnl_disclosure_authorized: true };

    mockGetAgentAddresses.mockResolvedValue({ evmAddress: '0xNakamotoWallet' });
    mockSignPartnerAuthorization.mockResolvedValue({ ok: true, result: { signature: '0xsig', signerAddress: '0xNakamotoWallet', payloadHash: 'hash', signedAt: '2026-08-03T00:00:00.000Z' } });

    const res = await POST(makeRequestWithBody({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.controlProven).toBe(true);
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
