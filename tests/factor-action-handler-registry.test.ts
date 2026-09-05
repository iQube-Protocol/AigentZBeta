/**
 * Factor action handler registry — allowlist parity canary (Factor
 * runtime-contract closure, Phase 1 continuation, 2026-09-05).
 *
 * A `FactorActionDescriptor.handlerId` (factorCapabilityManifest.ts) MUST
 * always resolve to a registered handler (factorActionHandlerRegistry.ts) —
 * this is the "file-path actionability" gap closed: a manifest entry can no
 * longer reference a handler that was renamed, deleted, or never existed
 * without this test failing the build.
 */
import { describe, it, expect } from 'vitest';
import { FACTOR_CAPABILITIES, deriveFactorResponseEnvelope } from '@/services/factor/factorCapabilityManifest';
import { isRegisteredFactorActionHandlerId, probeFactorActionHandler } from '@/services/factor/factorActionHandlerRegistry';

describe('every manifest action references a registered, probeable handler', () => {
  for (const cap of FACTOR_CAPABILITIES) {
    it(`${cap.id} — every action's handlerId is registered`, () => {
      expect(cap.actions.length).toBeGreaterThan(0);
      for (const action of cap.actions) {
        expect(isRegisteredFactorActionHandlerId(action.handlerId)).toBe(true);
        expect(probeFactorActionHandler(action.handlerId).reachable).toBe(true);
      }
    });

    it(`${cap.id} — always carries at least one 'explain' action`, () => {
      expect(cap.actions.some((a) => a.mode === 'explain')).toBe(true);
    });
  }

  it('a PLANNED/ADVISORY capability never carries a non-explain action (no fake handler wiring)', () => {
    for (const cap of FACTOR_CAPABILITIES) {
      if (cap.status === 'planned' || cap.handlerKind === 'none') {
        expect(cap.actions.every((a) => a.mode === 'explain')).toBe(true);
      }
    }
  });

  it("bankr_tokenization stays explain-only until its real handler lands (Phase 5)", () => {
    const bankr = FACTOR_CAPABILITIES.find((c) => c.id === 'bankr_tokenization')!;
    expect(bankr.actions).toHaveLength(1);
    expect(bankr.actions[0].mode).toBe('explain');
    expect(bankr.actions[0].requiresApproval).toBe(false);
  });
});

describe('deriveFactorResponseEnvelope — typed availableActions', () => {
  it('always includes the explain action, even when BLOCKED on missing scope', () => {
    const envelope = deriveFactorResponseEnvelope('aegis_referral'); // requiredScope: ['caseId'], none supplied
    expect(envelope.affordance).toBe('BLOCKED');
    expect(envelope.availableActions.some((a) => a.mode === 'explain')).toBe(true);
    expect(envelope.availableActions.every((a) => a.mode === 'explain')).toBe(true);
  });

  it('offers the real action once its required scope is bound', () => {
    const envelope = deriveFactorResponseEnvelope('aegis_referral', { caseId: 'case-1' });
    expect(envelope.affordance).toBe('ACTION_AVAILABLE');
    expect(envelope.availableActions.some((a) => a.id === 'aegis_referral:navigate')).toBe(true);
  });

  it('never offers a non-explain action for a PLANNED capability regardless of scope', () => {
    const envelope = deriveFactorResponseEnvelope('bankr_tokenization', { caseId: 'case-1', agentRef: 'agent-1' });
    expect(envelope.affordance).toBe('PLANNED');
    expect(envelope.availableActions).toHaveLength(1);
    expect(envelope.availableActions[0].mode).toBe('explain');
  });

  it('each action carries its OWN requiresApproval — explain is never gated even on a capability whose real action requires approval', () => {
    const envelope = deriveFactorResponseEnvelope('candidate_intake', { caseId: 'case-1' });
    const explain = envelope.availableActions.find((a) => a.mode === 'explain')!;
    const execute = envelope.availableActions.find((a) => a.id === 'candidate_intake:execute')!;
    expect(explain.requiresApproval).toBe(false);
    expect(execute.requiresApproval).toBe(true);
  });
});
