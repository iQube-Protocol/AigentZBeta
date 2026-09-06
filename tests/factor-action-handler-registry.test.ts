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

  it('bankr_tokenization gained real actions in Phase 5 — every handlerId registered, explain still unapproved, submit still gated', () => {
    const bankr = FACTOR_CAPABILITIES.find((c) => c.id === 'bankr_tokenization')!;
    expect(bankr.status).toBe('partial');
    expect(bankr.handlerKind).toBe('service');
    expect(bankr.actions.length).toBeGreaterThan(1);
    const explain = bankr.actions.find((a) => a.mode === 'explain')!;
    expect(explain.requiresApproval).toBe(false);
    const submit = bankr.actions.find((a) => a.id === 'bankr_tokenization:submit')!;
    expect(submit.mode).toBe('execute');
    expect(submit.requiresApproval).toBe(true);
    expect(submit.exposure).toBe('external');
    for (const action of bankr.actions) {
      expect(isRegisteredFactorActionHandlerId(action.handlerId)).toBe(true);
    }
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
    const envelope = deriveFactorResponseEnvelope('runtime_activation', { caseId: 'case-1', agentRef: 'agent-1' });
    expect(envelope.affordance).toBe('PLANNED');
    expect(envelope.availableActions).toHaveLength(1);
    expect(envelope.availableActions[0].mode).toBe('explain');
  });

  it('bankr_tokenization (PREPARABLE, Phase 5) offers its scope-bound prepare actions once agentRef is bound', () => {
    const envelope = deriveFactorResponseEnvelope('bankr_tokenization', { agentRef: 'agent-1' });
    expect(envelope.affordance).toBe('PREPARABLE');
    expect(envelope.availableActions.some((a) => a.id === 'bankr_tokenization:assess_readiness')).toBe(true);
    // submit has no requiredScope declared, so it IS offered once the
    // capability's own affordance permits acting at all — its
    // requiresApproval:true is what actually gates real execution, not
    // its presence in this list.
    expect(envelope.availableActions.some((a) => a.id === 'bankr_tokenization:submit')).toBe(true);
  });

  it('bankr_tokenization offers only the explain action when no scope is bound at all', () => {
    const envelope = deriveFactorResponseEnvelope('bankr_tokenization');
    expect(envelope.affordance).toBe('PREPARABLE');
    expect(envelope.availableActions.some((a) => a.id === 'bankr_tokenization:assess_readiness')).toBe(false);
    expect(envelope.availableActions.every((a) => a.mode === 'explain' || isRegisteredFactorActionHandlerId(a.handlerId))).toBe(true);
  });

  it('each action carries its OWN requiresApproval — explain is never gated even on a capability whose real action requires approval', () => {
    const envelope = deriveFactorResponseEnvelope('candidate_intake', { caseId: 'case-1' });
    const explain = envelope.availableActions.find((a) => a.mode === 'explain')!;
    const execute = envelope.availableActions.find((a) => a.id === 'candidate_intake:execute')!;
    expect(explain.requiresApproval).toBe(false);
    expect(execute.requiresApproval).toBe(true);
  });
});
