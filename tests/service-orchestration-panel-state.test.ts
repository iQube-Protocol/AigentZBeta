/**
 * ServiceOrchestrationPanel — cross-agent state isolation canaries (2026-08-23
 * P0 repair). Live browser testing found Nakamoto/Kn0w1 sharing Advisor/
 * Architect input and result state because the panel keyed `intents`/
 * `outcomes` on `serviceId` alone.
 *
 * This repo's tests run in a `node` vitest environment (no jsdom/React
 * Testing Library — see `vitest.config.mjs`), so the panel's state machine
 * was extracted into `app/(shell)/moneypenny/components/
 * serviceOrchestrationPanelState.ts` as a plain, framework-independent
 * reducer the component itself imports (no parallel/duplicated logic) —
 * these are real behavioural proofs of the reducer's transitions, not
 * source-level greps.
 */
import { describe, it, expect } from 'vitest';
import {
  panelReducer,
  initialPanelState,
  selectIntent,
  selectOutcome,
  selectIsRequesting,
  selectServiceError,
  type PanelState,
  type FinancialServiceOutcome,
} from '@/app/(shell)/moneypenny/components/serviceOrchestrationPanelState';

const NAKAMOTO = 'aigent-nakamoto';
const KNOW1 = 'aigent-kn0w1';
const ADVISOR_SERVICE = 'moneypenny-advisor';

function outcome(overrides: Partial<FinancialServiceOutcome> = {}): FinancialServiceOutcome {
  return {
    requestRef: 'req-1',
    serviceId: ADVISOR_SERVICE,
    serviceClass: 'INFORMATIONAL',
    providerMode: 'ADVISOR',
    status: 'DELIVERED',
    reason: "'moneypenny-advisor' delivered in preview mode",
    authorisationRef: null,
    executionRef: null,
    observedConsequenceRef: null,
    validationState: null,
    providerResultRef: 'abc123',
    providerOutput: { kind: 'ADVISOR_RESPONSE', text: 'default response' },
    errorCode: null,
    ...overrides,
  };
}

function selectAgent(state: PanelState, agentId: string, generation: number): PanelState {
  return panelReducer(state, { type: 'SELECT_AGENT', agentId, generation });
}

describe('ServiceOrchestrationPanel state — cross-agent isolation', () => {
  it('Nakamoto Advisor intent is invisible when Kn0w1 is selected', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = panelReducer(state, { type: 'SET_INTENT', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE, text: 'Nakamoto only intent' });

    // Operator switches to Kn0w1.
    state = selectAgent(state, KNOW1, 2);

    expect(selectIntent(state, KNOW1, ADVISOR_SERVICE)).toBe('');
    expect(selectIntent(state, NAKAMOTO, ADVISOR_SERVICE)).toBe('Nakamoto only intent');
  });

  it('Nakamoto Advisor output is invisible under Kn0w1', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = panelReducer(state, { type: 'REQUEST_START', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE });
    state = panelReducer(state, {
      type: 'REQUEST_SUCCESS',
      agentId: NAKAMOTO,
      serviceId: ADVISOR_SERVICE,
      outcome: outcome({ providerOutput: { kind: 'ADVISOR_RESPONSE', text: 'Nakamoto real advisory answer' } }),
    });

    state = selectAgent(state, KNOW1, 2);

    expect(selectOutcome(state, KNOW1, ADVISOR_SERVICE)).toBeUndefined();
    expect(selectOutcome(state, NAKAMOTO, ADVISOR_SERVICE)?.providerOutput).toEqual({
      kind: 'ADVISOR_RESPONSE',
      text: 'Nakamoto real advisory answer',
    });
  });

  it('Kn0w1 may hold a different Advisor intent/result concurrently with Nakamoto', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = panelReducer(state, { type: 'SET_INTENT', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE, text: "Nakamoto's question" });
    state = panelReducer(state, { type: 'REQUEST_START', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE });
    state = panelReducer(state, {
      type: 'REQUEST_SUCCESS',
      agentId: NAKAMOTO,
      serviceId: ADVISOR_SERVICE,
      outcome: outcome({ providerOutput: { kind: 'ADVISOR_RESPONSE', text: "Nakamoto's answer" } }),
    });

    state = selectAgent(state, KNOW1, 2);
    state = panelReducer(state, { type: 'SET_INTENT', agentId: KNOW1, serviceId: ADVISOR_SERVICE, text: "Kn0w1's DIFFERENT question" });
    state = panelReducer(state, { type: 'REQUEST_START', agentId: KNOW1, serviceId: ADVISOR_SERVICE });
    state = panelReducer(state, {
      type: 'REQUEST_SUCCESS',
      agentId: KNOW1,
      serviceId: ADVISOR_SERVICE,
      outcome: outcome({ providerOutput: { kind: 'ADVISOR_RESPONSE', text: "Kn0w1's DIFFERENT answer" } }),
    });

    // Both agents' state coexists in the same state object without collision.
    expect(selectIntent(state, NAKAMOTO, ADVISOR_SERVICE)).toBe("Nakamoto's question");
    expect(selectIntent(state, KNOW1, ADVISOR_SERVICE)).toBe("Kn0w1's DIFFERENT question");
    expect(selectOutcome(state, NAKAMOTO, ADVISOR_SERVICE)?.providerOutput).toEqual({ kind: 'ADVISOR_RESPONSE', text: "Nakamoto's answer" });
    expect(selectOutcome(state, KNOW1, ADVISOR_SERVICE)?.providerOutput).toEqual({ kind: 'ADVISOR_RESPONSE', text: "Kn0w1's DIFFERENT answer" });
  });

  it('switching back to Nakamoto restores Nakamoto\'s own state exactly — selection never clears any per-(agent,service) state', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = panelReducer(state, { type: 'SET_INTENT', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE, text: 'preserved intent' });
    state = panelReducer(state, { type: 'REQUEST_START', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE });
    state = panelReducer(state, {
      type: 'REQUEST_SUCCESS',
      agentId: NAKAMOTO,
      serviceId: ADVISOR_SERVICE,
      outcome: outcome({ providerOutput: { kind: 'ADVISOR_RESPONSE', text: 'preserved answer' } }),
    });

    state = selectAgent(state, KNOW1, 2);
    expect(selectIntent(state, NAKAMOTO, ADVISOR_SERVICE)).toBe('preserved intent'); // never cleared while away

    state = selectAgent(state, NAKAMOTO, 3);

    expect(selectIntent(state, NAKAMOTO, ADVISOR_SERVICE)).toBe('preserved intent');
    expect(selectOutcome(state, NAKAMOTO, ADVISOR_SERVICE)?.providerOutput).toEqual({ kind: 'ADVISOR_RESPONSE', text: 'preserved answer' });
  });

  it('a Nakamoto request completing after the operator switches to Kn0w1 updates Nakamoto only', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    // requestAgentId is captured as NAKAMOTO when the request begins...
    state = panelReducer(state, { type: 'REQUEST_START', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE });

    // ...the operator switches to Kn0w1 BEFORE the response arrives...
    state = selectAgent(state, KNOW1, 2);
    expect(state.selectedAgentId).toBe(KNOW1);

    // ...and the late-arriving completion still carries the ORIGINAL
    // requestAgentId (Nakamoto) — never re-derived from "selected now".
    state = panelReducer(state, {
      type: 'REQUEST_SUCCESS',
      agentId: NAKAMOTO,
      serviceId: ADVISOR_SERVICE,
      outcome: outcome({ providerOutput: { kind: 'ADVISOR_RESPONSE', text: 'late Nakamoto answer' } }),
    });

    expect(selectOutcome(state, NAKAMOTO, ADVISOR_SERVICE)?.providerOutput).toEqual({ kind: 'ADVISOR_RESPONSE', text: 'late Nakamoto answer' });
    expect(selectOutcome(state, KNOW1, ADVISOR_SERVICE)).toBeUndefined();
    // The requesting/loading flag also resolves only under Nakamoto's key.
    expect(selectIsRequesting(state, NAKAMOTO, ADVISOR_SERVICE)).toBe(false);
    expect(selectIsRequesting(state, KNOW1, ADVISOR_SERVICE)).toBe(false);
  });

  it('a Nakamoto request FAILING after switching to Kn0w1 writes the error under Nakamoto only, never under Kn0w1', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = panelReducer(state, { type: 'REQUEST_START', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE });
    state = selectAgent(state, KNOW1, 2);
    state = panelReducer(state, { type: 'REQUEST_ERROR', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE, error: 'Nakamoto request failed' });

    expect(selectServiceError(state, NAKAMOTO, ADVISOR_SERVICE)).toBe('Nakamoto request failed');
    expect(selectServiceError(state, KNOW1, ADVISOR_SERVICE)).toBeUndefined();
  });

  it('stale discovery for one agent cannot overwrite another agent\'s selected view', () => {
    let state = initialPanelState;
    // Nakamoto's discovery fetch is issued (generation 1)...
    state = selectAgent(state, NAKAMOTO, 1);
    // ...then the operator switches to Kn0w1 before it resolves (generation 2).
    state = selectAgent(state, KNOW1, 2);
    expect(state.discoveryGeneration).toBe(2);

    // Nakamoto's SLOW, now-stale discovery response finally arrives.
    state = panelReducer(state, {
      type: 'DISCOVERY_SUCCESS',
      generation: 1,
      discovery: [{ definition: { serviceId: 'nakamoto-only-service', providerMode: 'ADVISOR', serviceClass: 'INFORMATIONAL', displayName: 'x', attestationRequirement: 'NOT_REQUIRED' }, eligibility: { eligible: true, code: 'OK', reason: 'ok' }, authority: null }],
      admissionDiagnostic: { stale: true },
    });

    // It must be dropped — Kn0w1's (still-empty/loading) discovery view is untouched.
    expect(state.discovery).toBeNull();
    expect(state.admissionDiagnostic).toBeNull();
    expect(state.discoveryGeneration).toBe(2);

    // Kn0w1's OWN (current-generation) discovery response applies normally.
    state = panelReducer(state, {
      type: 'DISCOVERY_SUCCESS',
      generation: 2,
      discovery: [{ definition: { serviceId: 'kn0w1-service', providerMode: 'ADVISOR', serviceClass: 'INFORMATIONAL', displayName: 'y', attestationRequirement: 'NOT_REQUIRED' }, eligibility: { eligible: true, code: 'OK', reason: 'ok' }, authority: null }],
      admissionDiagnostic: { stale: false },
    });
    expect(state.discovery?.[0]?.definition.serviceId).toBe('kn0w1-service');
    expect(state.admissionDiagnostic).toEqual({ stale: false });
  });

  it('a stale DISCOVERY_ERROR is dropped the same way a stale DISCOVERY_SUCCESS is', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = selectAgent(state, KNOW1, 2);
    state = panelReducer(state, { type: 'DISCOVERY_ERROR', generation: 1, error: 'stale Nakamoto failure' });
    expect(state.discoveryError).toBeNull();
    expect(state.loadingDiscovery).toBe(true); // Kn0w1's own fetch is still in flight
  });

  it('SELECT_AGENT never clears intents/outcomes/requestingKeys/serviceErrors — only the discovery view resets', () => {
    let state = initialPanelState;
    state = selectAgent(state, NAKAMOTO, 1);
    state = panelReducer(state, { type: 'SET_INTENT', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE, text: 'kept' });
    state = panelReducer(state, { type: 'REQUEST_START', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE });
    state = panelReducer(state, { type: 'REQUEST_SUCCESS', agentId: NAKAMOTO, serviceId: ADVISOR_SERVICE, outcome: outcome() });
    const beforeSwitch = state;

    state = selectAgent(state, KNOW1, 2);

    expect(state.intents).toBe(beforeSwitch.intents);
    expect(state.outcomes).toBe(beforeSwitch.outcomes);
    expect(state.requestingKeys).toBe(beforeSwitch.requestingKeys);
    expect(state.serviceErrors).toBe(beforeSwitch.serviceErrors);
    // Only the discovery view itself resets.
    expect(state.discovery).toBeNull();
    expect(state.admissionDiagnostic).toBeNull();
  });
});
