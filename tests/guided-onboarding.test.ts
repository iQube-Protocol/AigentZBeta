/**
 * guided-onboarding.test.ts — canary for the CFS-043a guided onboarding
 * capability. Locks the two load-bearing invariants in CODE:
 *   1. Principal–Delegate Separation (CFS-043 §2): the agent never occupies the
 *      authorizer slot — the only authorize step is actor 'human'.
 *   2. Graded Proof-of-Humanity (CFS-043 §6/§2.1): read-write → captcha,
 *      money-moving → world_id.
 */

import { describe, it, expect } from 'vitest';
import {
  requiredProofGrade,
  recommendDelegatedAuthority,
  buildOnboardingPlan,
  passportDeepLinks,
  type BuildPlanInput,
} from '../services/constitutional/guidedOnboarding';

const AUSTIN: BuildPlanInput = {
  agreementId: 'exp-p1-submit',
  displayLabel: 'EXP-P1 result submission',
  capabilityRef: 'irl:experiment-result:submit',
  agentRef: 'agent:austin-exp-p1',
  agentAcceptorId: 'agent:austin-exp-p1',
  allowedActions: ['publish-result'],
  ttlHours: 336,
  maxActions: 3,
  risk: 'read-write',
};

const MONEY: BuildPlanInput = {
  ...AUSTIN,
  agreementId: 'cfsp-settle',
  capabilityRef: 'cfsp:payment:execute',
  allowedActions: ['execute-payment'],
  risk: 'money-moving',
  valueCeiling: 50000,
};

describe('graded proof-of-humanity', () => {
  it('read-write → captcha (weak)', () => {
    expect(requiredProofGrade('read-write')).toBe('captcha');
  });
  it('money-moving → world_id (strong)', () => {
    expect(requiredProofGrade('money-moving')).toBe('world_id');
  });
});

describe('recommendDelegatedAuthority', () => {
  it('read-write is bounded with a null ceiling and no governance verbs', () => {
    const a = recommendDelegatedAuthority({ capabilityRef: 'x', allowedActions: ['publish-result'], ttlHours: 8, maxActions: 1, risk: 'read-write' });
    expect(a.valueCeiling).toBeNull();
    expect(a.band).toBe('L2');
    for (const verb of ['ratify', 'flip-authoritative', 'edit-crystal', 'read-persona']) {
      expect(a.forbiddenActions).toContain(verb);
    }
    // the allowed set never leaks a forbidden verb
    expect(a.allowedActions.some((x) => a.forbiddenActions.includes(x))).toBe(false);
  });
  it('money-moving carries the declared spend ceiling', () => {
    const a = recommendDelegatedAuthority({ capabilityRef: 'x', allowedActions: ['execute-payment'], ttlHours: 8, maxActions: 1, risk: 'money-moving', valueCeiling: 50000 });
    expect(a.valueCeiling).toBe(50000);
    expect(a.band).toBe('L3');
  });
});

describe('Principal–Delegate Separation (the safeguard canary)', () => {
  it('the ONLY authorize step is actor human — the agent never authorizes', () => {
    for (const input of [AUSTIN, MONEY]) {
      const plan = buildOnboardingPlan(input);
      const authorizeSteps = plan.steps.filter((s) => s.apiCall?.body?.action === 'authorize');
      expect(authorizeSteps.length).toBe(1);
      expect(authorizeSteps[0].actor).toBe('human');
      // no agent-actor step ever performs an authorize call
      const agentAuthorize = plan.steps.filter((s) => s.actor === 'agent' && s.apiCall?.body?.action === 'authorize');
      expect(agentAuthorize.length).toBe(0);
    }
  });

  it('the agent ref only ever appears as selectedAgentRef / agent acceptor — never as authorizer', () => {
    const plan = buildOnboardingPlan(AUSTIN);
    const form = plan.steps.find((s) => s.apiCall?.body?.action === 'form');
    const accept = plan.steps.find((s) => s.apiCall?.body?.action === 'accept');
    const authorize = plan.steps.find((s) => s.apiCall?.body?.action === 'authorize');
    expect(form?.apiCall?.body?.selectedAgentRef).toBe(AUSTIN.agentRef);
    expect(accept?.apiCall?.body?.acceptorType).toBe('agent');
    // the authorize body carries NO agent ref — it is the human's owner-scoped act
    expect(JSON.stringify(authorize?.apiCall?.body)).not.toContain(AUSTIN.agentRef);
  });

  it('the plan carries the prime directive and the graded proof requirement', () => {
    const rw = buildOnboardingPlan(AUSTIN);
    const mm = buildOnboardingPlan(MONEY);
    expect(rw.requiredProof).toBe('captcha');
    expect(mm.requiredProof).toBe('world_id');
    expect(rw.primeDirective).toMatch(/human authorizes/i);
    // the form step records the required proof grade on verificationRequirements
    const rwForm = rw.steps.find((s) => s.apiCall?.body?.action === 'form');
    expect((rwForm?.apiCall?.body?.verificationRequirements as string[])).toContain('captcha-verified-authorizer');
    const mmForm = mm.steps.find((s) => s.apiCall?.body?.action === 'form');
    expect((mmForm?.apiCall?.body?.verificationRequirements as string[])).toContain('world-id-verified-authorizer');
  });
});

describe('passport deep links (IRL OS cartridge tabs)', () => {
  it('point at the irl-os passport tabs', () => {
    const links = passportDeepLinks({ from: 'onboarding' });
    expect(links.apply).toContain('/triad/embed/codex/irl-os');
    expect(links.apply).toContain('tab=irl-os-passport-apply');
    expect(links.delegation).toContain('tab=irl-os-passport-delegation');
  });
});
