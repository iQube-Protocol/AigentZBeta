/**
 * Use Case Zero — "constitutional financial-agent establishment" capability
 * (2026-09-06). Covers step 8's classifier assertion ("confidential
 * financial transactions" routes to Use Case Zero, never general
 * orientation or tokenization) plus the manifest/handler-registry wiring
 * every other capability's own test suite already holds to.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyFactorCapability,
  deriveFactorResponseEnvelope,
  getFactorCapability,
  FACTOR_CAPABILITIES,
} from '@/services/factor/factorCapabilityManifest';
import { isRegisteredFactorActionHandlerId } from '@/services/factor/factorActionHandlerRegistry';

describe('classifyFactorCapability — Use Case Zero phrases', () => {
  const phrases = [
    'confidential financial transactions',
    'private financial operations',
    'set up a financial agent',
    'create an agent with a wallet',
    'bring my agent to MoneyPenny',
    'establish a constitutional financial agent',
  ];

  for (const phrase of phrases) {
    it(`"${phrase}" resolves to constitutional_financial_agent_establishment, never general_orientation or bankr_tokenization`, () => {
      const id = classifyFactorCapability(phrase);
      expect(id).toBe('constitutional_financial_agent_establishment');
    });
  }

  it('does not swallow unrelated Vela/Bankr/wallet questions — those still classify to their own capabilities', () => {
    expect(classifyFactorCapability('Can Vela protect this workload?')).toBe('vela_confidential_compute');
    expect(classifyFactorCapability('Could this agent issue a fair-launch token through Bankr?')).toBe('bankr_tokenization');
    expect(classifyFactorCapability('What is this agent Horizen registration status?')).toBe('horizen_journey_spine');
  });
});

describe('constitutional_financial_agent_establishment — manifest entry', () => {
  const cap = getFactorCapability('constitutional_financial_agent_establishment');

  it('is registered in FACTOR_CAPABILITIES with a real handler, never status "planned"', () => {
    expect(FACTOR_CAPABILITIES.some((c) => c.id === 'constitutional_financial_agent_establishment')).toBe(true);
    expect(cap.status).not.toBe('planned');
    expect(cap.handlerKind).not.toBe('none');
  });

  it('offers exactly the two typed entry actions plus explain', () => {
    const actionIds = cap.actions.map((a) => a.id);
    expect(actionIds).toContain('constitutional_financial_agent_establishment:explain');
    expect(actionIds).toContain('constitutional_financial_agent_establishment:bring_own_agent');
    expect(actionIds).toContain('constitutional_financial_agent_establishment:create_and_establish');
  });

  it('every non-explain action handlerId is actually registered (never a manifest defect)', () => {
    for (const action of cap.actions) {
      expect(isRegisteredFactorActionHandlerId(action.handlerId)).toBe(true);
    }
  });

  it('never claims Factor can approve its own agent/assessment/admission/transaction', () => {
    const boundaryText = cap.boundaries.join(' ').toLowerCase();
    expect(boundaryText).toMatch(/never approves its own/);
  });

  it('the response envelope offers both entry actions once resolved (no scope required to explain the choice)', () => {
    const envelope = deriveFactorResponseEnvelope('constitutional_financial_agent_establishment');
    const actionIds = envelope.availableActions.map((a) => a.id);
    expect(actionIds).toContain('constitutional_financial_agent_establishment:bring_own_agent');
    expect(actionIds).toContain('constitutional_financial_agent_establishment:create_and_establish');
  });
});

describe('vela_confidential_compute — corrected truthfulness (Use Case Zero reconciliation)', () => {
  it('is "partial", not "planned" — a real, tested workload exists', () => {
    const cap = getFactorCapability('vela_confidential_compute');
    expect(cap.status).toBe('partial');
    expect(cap.handlerKind).not.toBe('none');
  });

  it('its prepare action handler is registered', () => {
    const cap = getFactorCapability('vela_confidential_compute');
    const prepare = cap.actions.find((a) => a.mode === 'prepare');
    expect(prepare).toBeTruthy();
    expect(isRegisteredFactorActionHandlerId(prepare!.handlerId)).toBe(true);
  });

  it('honestly states no live Vela deployment is configured — never asserts a live claim', () => {
    const cap = getFactorCapability('vela_confidential_compute');
    const text = (cap.description + ' ' + cap.boundaries.join(' ')).toLowerCase();
    expect(text).toMatch(/simulated|test.?transport/);
    expect(text).not.toMatch(/is live today/);
  });
});

describe('horizen_journey_spine — Factor\'s own registration correction', () => {
  it('states Factor\'s own registration (token 9176, Base Sepolia) without claiming the general capability is fully live', () => {
    const cap = getFactorCapability('horizen_journey_spine');
    expect(cap.description).toMatch(/9176/);
    expect(cap.description).toMatch(/base sepolia/i);
    // The general capability status is unchanged by Factor's own registration.
    expect(cap.status).toBe('partial');
  });
});
