/**
 * services/vela/velaUnderwritingPartyView.ts — Use Case Zero build-order
 * item 10b. Proves the redaction visibility model, verbatim against the
 * operator's own acceptance gates:
 *
 *  1. Select/Admit/Freeze/Receipt/Telemetry are ALWAYS visible, fields
 *     passed through unchanged, regardless of party.
 *  2. Authorize is always visible; `scope.grants` is filtered to grants
 *     where `grant.party === partyLabel OR grant.to === partyLabel`; the
 *     original grant count never leaks.
 *  3. Execute/Quote are visible ONLY when a `DISCLOSE_TO` grant names this
 *     party as `to` — `COMPUTE_WITH` membership alone does NOT grant
 *     visibility.
 *  4. Settle is gated by the SAME check as Execute/Quote.
 *  5. Every step's `state` is always the real state; `reason` is the FIXED
 *     generic string only when `visible === false`.
 *
 * Pure function — no mocks, no I/O.
 */
import { describe, expect, it } from 'vitest';
import {
  redactConstitutionalRiskFlowStateForParty,
  CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
} from '@/services/vela/velaUnderwritingPartyView';
import type { ConstitutionalRiskFlowState } from '@/services/vela/velaUnderwritingChainProjection';
import type { VelaMultiPartyDisclosureScope } from '@/services/vela/velaMultiPartyProjection';

const SCOPE: VelaMultiPartyDisclosureScope = {
  binding: {
    applicationId: 'app-1',
    requestRef: 'req-1',
    operationType: 'joint_consequence_projection',
    outputClass: 'joint_verdict',
  },
  grants: [
    { action: 'COMPUTE_WITH', party: 'party-a' },
    { action: 'COMPUTE_WITH', party: 'party-b' },
    { action: 'DISCLOSE_TO', party: 'party-b', to: 'party-a' },
  ],
};

function fullState(overrides: Partial<ConstitutionalRiskFlowState> = {}): ConstitutionalRiskFlowState {
  return {
    requestRef: 'req-1',
    select: {
      id: 'select',
      state: 'complete',
      reason: 'Factor proposed candidate agent-1 (SIMULATED).',
      selectionRef: 'selection-ref-1',
      candidateAgentId: 'agent-1',
      serviceId: 'service-1',
      counterpartyId: 'counterparty-1',
      providerMode: 'SIMULATED',
      selectionReason: 'best available',
      receiptId: 'receipt-select-1',
    },
    admit: {
      id: 'admit',
      state: 'complete',
      reason: 'Aegis ratified this candidate as admissible',
      admissionRef: 'admission-ref-1',
      admissionStatus: 'ADMITTED',
      assessmentRef: 'assessment-1',
      assessmentVersion: 'v1',
      aegisAgentId: 'aigent-aegis',
      receiptId: 'receipt-admit-1',
    },
    authorize: {
      id: 'authorize',
      state: 'complete',
      reason: 'Disclosure authorized by aigent-moneypenny.',
      authorizationRef: 'authorization-ref-1',
      applicationId: 'app-1',
      authorizedByAgentRef: 'aigent-moneypenny',
      scope: SCOPE,
      receiptId: 'receipt-authorize-1',
    },
    freeze: {
      id: 'freeze',
      state: 'complete',
      reason: 'Envelope envelope-ref-1 was frozen and submitted to Vela.',
      envelopeRef: 'envelope-ref-1',
      applicationId: 'app-1',
      candidateAgentId: 'agent-1',
      receiptId: 'receipt-freeze-1',
    },
    execute: {
      id: 'execute',
      state: 'complete',
      reason: 'Vela resolved ACCEPTABLE (SIMULATED).',
      onChainRequestId: 'onchain-req-1',
      disposition: 'ACCEPTABLE',
      providerMode: 'SIMULATED',
      receiptId: 'receipt-execute-1',
    },
    quote: {
      id: 'quote',
      state: 'complete',
      reason: 'Underwriting quote computed (SIMULATED): ACCEPTABLE.',
      quote: {
        riskBand: 'LOW',
        estimatedExposure: 500,
        riskOfRepair: 'LOW',
        coverageEligible: true,
        coverageLimit: 5000,
        premium: 50,
        conditions: [],
        confidence: 0.8,
        providerMode: 'SIMULATED',
      },
      receiptId: 'receipt-quote-1',
    },
    settle: {
      id: 'settle',
      state: 'complete',
      reason: 'An asset-bearing settlement rode along with this Vela submission.',
      settlementOccurred: true,
    },
    receipt: {
      id: 'receipt',
      state: 'complete',
      reason: '5 causal receipt(s) found for this request.',
      receipts: [
        { receiptId: 'receipt-select-1', actionType: 'factor_selection_proposed', receiptStatus: 'local', createdAt: '2026-09-14T00:00:00.000Z' },
      ],
    },
    telemetry: {
      id: 'telemetry',
      state: 'complete',
      reason: 'Risk-invariant telemetry recorded in golden_cycle_records.',
      telemetryRecordId: 'telemetry-1',
    },
    ...overrides,
  };
}

describe('gate 1 — Select/Admit/Freeze/Receipt/Telemetry always visible, unchanged', () => {
  it('passes those five steps through verbatim, with visible:true, regardless of party', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-c'); // party-c has no grants at all
    expect(view.select).toEqual({ ...state.select, visible: true });
    expect(view.admit).toEqual({ ...state.admit, visible: true });
    expect(view.freeze).toEqual({ ...state.freeze, visible: true });
    expect(view.receipt).toEqual({ ...state.receipt, visible: true });
    expect(view.telemetry).toEqual({ ...state.telemetry, visible: true });
  });
});

describe('gate 2 — Authorize always visible, grants filtered, count never leaked', () => {
  it('filters grants to party === partyLabel OR to === partyLabel', () => {
    const state = fullState();
    const viewA = redactConstitutionalRiskFlowStateForParty(state, 'party-a');
    expect(viewA.authorize.visible).toBe(true);
    // party-a: named as `party` on grant 1, and as `to` on grant 3.
    expect(viewA.authorize.scope?.grants).toEqual([
      { action: 'COMPUTE_WITH', party: 'party-a' },
      { action: 'DISCLOSE_TO', party: 'party-b', to: 'party-a' },
    ]);

    const viewB = redactConstitutionalRiskFlowStateForParty(state, 'party-b');
    // party-b: named as `party` on grant 2 AND grant 3 (party-b is the
    // discloser on the DISCLOSE_TO grant, even though it is not the `to`) —
    // asserted explicitly per the filter rule, not assumed.
    expect(viewB.authorize.scope?.grants).toEqual([
      { action: 'COMPUTE_WITH', party: 'party-b' },
      { action: 'DISCLOSE_TO', party: 'party-b', to: 'party-a' },
    ]);
  });

  it('resolves an empty grants array for a party named in NO grant — never distinguishable from any other empty case', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-c');
    expect(view.authorize.visible).toBe(true);
    expect(view.authorize.scope?.grants).toEqual([]);
    // No total-grant-count hint anywhere on the returned scope/authorize shape.
    expect(JSON.stringify(view.authorize)).not.toMatch(/total/i);
  });

  it('preserves scope.binding unchanged — only grants are filtered', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-a');
    expect(view.authorize.scope?.binding).toEqual(SCOPE.binding);
  });

  it('passes authorize through with scope:null when no authorization exists yet', () => {
    const state = fullState({
      authorize: { id: 'authorize', state: 'not_started', reason: 'No disclosure authorization exists for this request.', authorizationRef: null, applicationId: null, authorizedByAgentRef: null, scope: null, receiptId: null },
    });
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-a');
    expect(view.authorize.visible).toBe(true);
    expect(view.authorize.scope).toBeNull();
  });
});

describe('gate 3 — Execute/Quote visible ONLY when DISCLOSE_TO names this party as `to`', () => {
  it('party-a (the DISCLOSE_TO recipient) sees the real Execute/Quote fields', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-a');
    expect(view.execute).toEqual({ ...state.execute, visible: true });
    expect(view.quote).toEqual({ ...state.quote, visible: true });
  });

  it('party-b (COMPUTE_WITH member, but the discloser — never the `to`) does NOT see Execute/Quote', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-b');
    expect(view.execute).toEqual({
      id: 'execute',
      state: 'complete', // real state preserved
      reason: CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
      visible: false,
      onChainRequestId: null,
      disposition: null,
      providerMode: null,
      receiptId: null,
    });
    expect(view.quote).toEqual({
      id: 'quote',
      state: 'complete',
      reason: CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
      visible: false,
      quote: null,
      receiptId: null,
    });
  });

  it('a party named in NO grant at all does NOT see Execute/Quote', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-c');
    expect(view.execute.visible).toBe(false);
    expect(view.quote.visible).toBe(false);
  });

  it('COMPUTE_WITH membership alone never grants visibility, even for the SAME party as an unrelated DISCLOSE_TO.to elsewhere', () => {
    const scope: VelaMultiPartyDisclosureScope = {
      binding: SCOPE.binding,
      grants: [
        { action: 'COMPUTE_WITH', party: 'party-x' },
        { action: 'DISCLOSE_TO', party: 'party-x', to: 'party-y' },
      ],
    };
    const state = fullState({ authorize: { ...fullState().authorize, scope } });
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-x');
    expect(view.execute.visible).toBe(false);
    expect(view.quote.visible).toBe(false);
  });
});

describe('gate 4 — Settle gated by the SAME check as Execute/Quote', () => {
  it('party-a sees the real settlement fact', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-a');
    expect(view.settle).toEqual({ ...state.settle, visible: true });
  });

  it('party-b does NOT see the settlement fact — redacted with the fixed reason, real state preserved', () => {
    const state = fullState();
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-b');
    expect(view.settle).toEqual({
      id: 'settle',
      state: 'complete',
      reason: CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON,
      visible: false,
      settlementOccurred: null,
    });
  });
});

describe('gate 5 — state always real; reason fixed and generic only when redacted', () => {
  it('an unfavourable-but-complete Execute/Quote still redacts to the SAME fixed reason, never leaking the real disposition', () => {
    const state = fullState({
      execute: { id: 'execute', state: 'complete', reason: 'Vela resolved UNACCEPTABLE (SIMULATED).', onChainRequestId: 'onchain-req-2', disposition: 'UNACCEPTABLE', providerMode: 'SIMULATED', receiptId: 'receipt-execute-2' },
      quote: {
        id: 'quote',
        state: 'complete',
        reason: 'Underwriting quote computed (SIMULATED): UNACCEPTABLE.',
        quote: { riskBand: 'HIGH', estimatedExposure: 999999, riskOfRepair: 'HIGH', coverageEligible: false, coverageLimit: 0, premium: 0, conditions: ['ineligible'], confidence: 0.9, providerMode: 'SIMULATED' },
        receiptId: 'receipt-quote-2',
      },
    });
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-b');
    expect(view.execute.reason).toBe(CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON);
    expect(view.quote.reason).toBe(CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON);
    // The real disposition/riskBand/premium never appear anywhere in the
    // redacted view's serialized form.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('UNACCEPTABLE');
    expect(serialized).not.toContain('999999');
  });

  it('an UNRESOLVED execute state is preserved verbatim in `state` even when redacted', () => {
    const state = fullState({
      execute: { id: 'execute', state: 'unresolved', reason: 'Vela could not resolve a disposition.', onChainRequestId: 'onchain-req-3', disposition: 'UNRESOLVED', providerMode: 'SIMULATED', receiptId: 'receipt-execute-3' },
    });
    const view = redactConstitutionalRiskFlowStateForParty(state, 'party-b');
    expect(view.execute.state).toBe('unresolved');
    expect(view.execute.visible).toBe(false);
    expect(view.execute.reason).toBe(CONSTITUTIONAL_RISK_FLOW_REDACTED_REASON);
  });
});

describe('leak check — no raw persona/UUID identifier ever appears (this module never receives one)', () => {
  it('the redacted view for every party contains no field named with a persona/UUID-shaped identifier', () => {
    const state = fullState();
    for (const party of ['party-a', 'party-b', 'party-c']) {
      const view = redactConstitutionalRiskFlowStateForParty(state, party);
      const serialized = JSON.stringify(view);
      expect(serialized).not.toMatch(/personaId|authorityPersonaId|flowOwnerPersonaId|authProfileId|rootDid/i);
    }
  });
});
