/**
 * GET /api/moneypenny/constitutional-risk-flow?party=... — Use Case Zero
 * build-order item 10b. Sibling to
 * `tests/moneypenny-constitutional-risk-flow-route.test.ts` (which stays
 * unmodified — its four original tests prove the `?party=` ABSENT path is
 * byte-for-byte unchanged). This file proves the `?party=` PRESENT path:
 *
 *  - a 403 with the SAME generic message whether no binding exists, the
 *    binding names a different persona, or the binding is scoped to a
 *    different requestRef (anti-enumeration);
 *  - on authorization, the chain state is read against the RESOLVED
 *    flowOwnerPersonaId (never the viewer's own persona) and redacted for
 *    that party;
 *  - `flowOwnerPersonaId` never appears in the response body;
 *  - the operator's own exact regression scenario: party-a/party-b compute
 *    jointly, only party-a is disclosed the result, party-c has no binding
 *    at all.
 *
 * `getConstitutionalRiskFlowState` and `resolvePartyBindingForViewer` are
 * mocked; `redactConstitutionalRiskFlowStateForParty` is used FOR REAL (it
 * is pure) so this file exercises the actual route+redaction integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: any[]) => mockGetActivePersona(...args),
}));

const mockGetConstitutionalRiskFlowState = vi.fn();
vi.mock('@/services/vela/velaUnderwritingChainProjection', () => ({
  getConstitutionalRiskFlowState: (...args: any[]) => mockGetConstitutionalRiskFlowState(...args),
}));

const mockResolvePartyBindingForViewer = vi.fn();
vi.mock('@/services/vela/velaUnderwritingPartyBinding', () => ({
  resolvePartyBindingForViewer: (...args: any[]) => mockResolvePartyBindingForViewer(...args),
}));

import { GET } from '@/app/api/moneypenny/constitutional-risk-flow/route';
import type { ConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';
import type { VelaMultiPartyDisclosureScope } from '@/services/vela/velaMultiPartyProjection';

function req(url: string) {
  return new NextRequest(`https://dev-beta.aigentz.me${url}`, { method: 'GET' });
}

const REQUEST_REF = 'req-1';
const PERSONA_A = 'persona-a-11111111-1111-1111-1111-111111111111';
const PERSONA_B = 'persona-b-22222222-2222-2222-2222-222222222222';
const FLOW_OWNER = 'flow-owner-persona-33333333-3333-3333-3333-333333333333';

const SCOPE: VelaMultiPartyDisclosureScope = {
  binding: {
    applicationId: 'app-1',
    requestRef: REQUEST_REF,
    operationType: 'joint_consequence_projection',
    outputClass: 'joint_verdict',
  },
  grants: [
    { action: 'COMPUTE_WITH', party: 'party-a' },
    { action: 'COMPUTE_WITH', party: 'party-b' },
    { action: 'DISCLOSE_TO', party: 'party-b', to: 'party-a' },
  ],
};

function scenarioState(): ConstitutionalRiskFlowState {
  return {
    requestRef: REQUEST_REF,
    select: {
      id: 'select', state: 'complete', reason: 'Factor proposed candidate agent-1 (SIMULATED).',
      selectionRef: 'selection-ref-1', candidateAgentId: 'agent-1', serviceId: 'service-1',
      counterpartyId: 'counterparty-1', providerMode: 'SIMULATED', selectionReason: 'best available',
      receiptId: 'receipt-select-1',
    },
    admit: {
      id: 'admit', state: 'complete', reason: 'Aegis ratified this candidate as admissible',
      admissionRef: 'admission-ref-1', admissionStatus: 'ADMITTED', assessmentRef: 'assessment-1',
      assessmentVersion: 'v1', aegisAgentId: 'aigent-aegis', receiptId: 'receipt-admit-1',
    },
    authorize: {
      id: 'authorize', state: 'complete', reason: 'Disclosure authorized by aigent-moneypenny.',
      authorizationRef: 'authorization-ref-1', applicationId: 'app-1', authorizedByAgentRef: 'aigent-moneypenny',
      scope: SCOPE, receiptId: 'receipt-authorize-1',
    },
    freeze: {
      id: 'freeze', state: 'complete', reason: 'Envelope envelope-ref-1 was frozen and submitted to Vela.',
      envelopeRef: 'envelope-ref-1', applicationId: 'app-1', candidateAgentId: 'agent-1', receiptId: 'receipt-freeze-1',
    },
    execute: {
      id: 'execute', state: 'complete', reason: 'Vela resolved ACCEPTABLE (SIMULATED).',
      onChainRequestId: 'onchain-req-1', disposition: 'ACCEPTABLE', providerMode: 'SIMULATED',
      receiptId: 'receipt-execute-1',
    },
    quote: {
      id: 'quote', state: 'complete', reason: 'Underwriting quote computed (SIMULATED): ACCEPTABLE.',
      quote: {
        riskBand: 'LOW', estimatedExposure: 500, riskOfRepair: 'LOW', coverageEligible: true,
        coverageLimit: 5000, premium: 50, conditions: [], confidence: 0.8, providerMode: 'SIMULATED',
      },
      receiptId: 'receipt-quote-1',
    },
    settle: {
      id: 'settle', state: 'complete', reason: 'An asset-bearing settlement rode along with this Vela submission.',
      settlementOccurred: true,
    },
    receipt: {
      id: 'receipt', state: 'complete', reason: '5 causal receipt(s) found for this request.',
      receipts: [{ receiptId: 'receipt-select-1', actionType: 'factor_selection_proposed', receiptStatus: 'local', createdAt: '2026-09-14T00:00:00.000Z' }],
    },
    telemetry: {
      id: 'telemetry', state: 'complete', reason: 'Risk-invariant telemetry recorded in golden_cycle_records.',
      telemetryRecordId: 'telemetry-1',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/moneypenny/constitutional-risk-flow?party=... — authorization', () => {
  it('403 with a generic message when no binding exists for (requestRef, party) at all', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_A });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: false });
    const res = await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-c`));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Not authorized to view this party's flow.");
    expect(mockGetConstitutionalRiskFlowState).not.toHaveBeenCalled();
  });

  it('403 with the SAME generic message when a binding exists but names a different persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_B });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: false });
    const res = await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-a`));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not authorized to view this party's flow.");
  });

  it('never leaks flowOwnerPersonaId in the response body on success', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_A });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: true, flowOwnerPersonaId: FLOW_OWNER });
    mockGetConstitutionalRiskFlowState.mockResolvedValue(scenarioState());
    const res = await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-a`));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(FLOW_OWNER);
    expect(mockGetConstitutionalRiskFlowState).toHaveBeenCalledWith({ personaId: FLOW_OWNER, requestRef: REQUEST_REF });
  });

  it('reads the RESOLVED flow owner, never the viewer\'s own persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_A });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: true, flowOwnerPersonaId: FLOW_OWNER });
    mockGetConstitutionalRiskFlowState.mockResolvedValue(scenarioState());
    await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-a`));
    expect(mockGetConstitutionalRiskFlowState).toHaveBeenCalledTimes(1);
    const [args] = mockGetConstitutionalRiskFlowState.mock.calls[0];
    expect(args.personaId).not.toBe(PERSONA_A);
    expect(args.personaId).toBe(FLOW_OWNER);
  });

  it('resolvePartyBindingForViewer is called with the CALLER\'s own resolved persona, never a client-supplied one', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_A });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: true, flowOwnerPersonaId: FLOW_OWNER });
    mockGetConstitutionalRiskFlowState.mockResolvedValue(scenarioState());
    await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-a&personaId=someone-elses-persona`));
    expect(mockResolvePartyBindingForViewer).toHaveBeenCalledWith({
      requestRef: REQUEST_REF,
      partyLabel: 'party-a',
      viewerPersonaId: PERSONA_A,
    });
  });
});

describe('the operator\'s own exact regression scenario', () => {
  const PERSONA_PARTY_A = 'persona-party-a';
  const PERSONA_PARTY_B = 'persona-party-b';

  beforeEach(() => {
    mockGetConstitutionalRiskFlowState.mockResolvedValue(scenarioState());
  });

  it('viewing as personaA with party=party-a: Execute/Quote/Settle visible with real data; Authorize shows only the 2 grants naming party-a', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_PARTY_A });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: true, flowOwnerPersonaId: FLOW_OWNER });

    const res = await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-a`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const state = body.state;

    expect(state.execute.visible).toBe(true);
    expect(state.execute.onChainRequestId).toBe('onchain-req-1');
    expect(state.quote.visible).toBe(true);
    expect(state.quote.quote.riskBand).toBe('LOW');
    expect(state.settle.visible).toBe(true);
    expect(state.settle.settlementOccurred).toBe(true);

    expect(state.authorize.visible).toBe(true);
    expect(state.authorize.scope.grants).toEqual([
      { action: 'COMPUTE_WITH', party: 'party-a' },
      { action: 'DISCLOSE_TO', party: 'party-b', to: 'party-a' },
    ]);
  });

  it('viewing as personaB with party=party-b: Execute/Quote/Settle redacted; Authorize shows the 2 grants naming party-b (its own COMPUTE_WITH AND the DISCLOSE_TO grant it is the discloser on)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_PARTY_B });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: true, flowOwnerPersonaId: FLOW_OWNER });

    const res = await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-b`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const state = body.state;

    expect(state.execute.visible).toBe(false);
    expect(state.execute.onChainRequestId).toBeNull();
    expect(state.execute.reason).toBe('Confidential contribution present — not disclosed to this party.');
    expect(state.quote.visible).toBe(false);
    expect(state.quote.quote).toBeNull();
    expect(state.settle.visible).toBe(false);
    expect(state.settle.settlementOccurred).toBeNull();

    // Asserted explicitly, not assumed: party-b IS the `party` on the
    // DISCLOSE_TO grant (the discloser), so it appears in party-b's own
    // Authorize capsule even though party-b is not the grant's `to`.
    expect(state.authorize.visible).toBe(true);
    expect(state.authorize.scope.grants).toEqual([
      { action: 'COMPUTE_WITH', party: 'party-b' },
      { action: 'DISCLOSE_TO', party: 'party-b', to: 'party-a' },
    ]);

    // Neither party's raw operands (there are none in this evidence to leak
    // in the first place) nor the OTHER party's derived-result fields leak
    // into this redacted view.
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain('onchain-req-1');
    expect(serialized).not.toContain('"riskBand":"LOW"');
    expect(serialized).not.toContain(FLOW_OWNER);
    expect(serialized).not.toMatch(/authority_persona_id|flowOwnerPersonaId|personaId/i);
  });

  it('a request with no binding at all for party=party-c on this requestRef -> 403, regardless of who is authenticated', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'anyone-at-all' });
    mockResolvePartyBindingForViewer.mockResolvedValue({ authorized: false });

    const res = await GET(req(`/api/moneypenny/constitutional-risk-flow?requestRef=${REQUEST_REF}&party=party-c`));
    expect(res.status).toBe(403);
    expect(mockGetConstitutionalRiskFlowState).not.toHaveBeenCalled();
  });
});
