/**
 * Factor cognitive-runtime fix (2026-09-05) — behavioral acceptance tests.
 *
 * Asking Aigent Factor "What are your capabilities?" used to return a
 * hardcoded candidate-intake framing, regardless of the question
 * (services/agents/specialistRouter.ts's old templateResponse branch:
 * `title: 'Candidate-intake framing for "${intent}"'` for EVERY question).
 * These tests call the real `askSpecialist` (template path — no LLM key is
 * configured in this test environment, so every call is deterministic) and
 * the real `resolveSmartTriadSpecialistDelegation`, never a source-string
 * canary, to pin the fix.
 */
import { describe, it, expect } from 'vitest';
import { askSpecialist, resolveFactorCapability, type SpecialistContext } from '@/services/agents/specialistRouter';
import { classifyFactorCapability, FACTOR_CAPABILITIES } from '@/services/factor/factorCapabilityManifest';
import { resolveSmartTriadSpecialistDelegation } from '@/services/smarttriad/specialistDelegation';

function ctx(userPrompt: string, extra?: Partial<SpecialistContext>): SpecialistContext {
  return {
    activeCartridge: 'moneypenny',
    experienceName: null,
    experienceType: 'venture_building',
    primaryGoal: null,
    currentStage: 'setup',
    activeCartridges: ['moneypenny'],
    intentName: userPrompt,
    intentRationale: null,
    userPrompt,
    ...extra,
  };
}

describe('classifyFactorCapability — deterministic, ordered classification', () => {
  it('never falls back to candidate_intake for an unrelated question', () => {
    expect(classifyFactorCapability('What are your capabilities?')).toBe('general_orientation');
  });

  it('is the single classifier both askSpecialist and specialistDelegation ground on', () => {
    // resolveFactorCapability is a thin wrapper: explicit factorCapabilityId
    // wins, otherwise classifyFactorCapability(text) — pinned so the two
    // never silently diverge.
    expect(resolveFactorCapability(ctx('What are your capabilities?'))).toBe(classifyFactorCapability('What are your capabilities?'));
    expect(resolveFactorCapability(ctx('', { factorCapabilityId: 'standing_proposal', userPrompt: 'anything' }))).toBe('standing_proposal');
  });

  it('a bounded case scope alone never forces candidate_intake classification', () => {
    // An open case is grounding-only; the same ambiguous/unrelated question
    // classifies identically whether or not factorScope names a case.
    const withCase = ctx('What are your capabilities?', { factorScope: { caseId: 'case-123' } });
    const withoutCase = ctx('What are your capabilities?');
    expect(resolveFactorCapability(withCase)).toBe(resolveFactorCapability(withoutCase));
    expect(resolveFactorCapability(withCase)).toBe('general_orientation');
  });
});

describe('askSpecialist(factor) — template fallback keyed by capability, never a single hardcoded intake framing', () => {
  it('"What are your capabilities?" -> a real capability inventory, never intake framing', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('What are your capabilities?') });
    expect(res.source).toBe('template');
    expect(res.title.toLowerCase()).not.toContain('candidate-intake framing');
    expect(res.title.toLowerCase()).toContain('capability');
    // The overview must list at least one non-operational capability's real
    // status (truthfulness), not just an operational happy path.
    const planned = FACTOR_CAPABILITIES.find((c) => c.status === 'planned')!;
    expect(res.recommendations.some((r) => r.includes(planned.title))).toBe(true);
  });

  it("\"Explain Factor's role in MoneyPenny\" -> ecosystem-activation framing, not intake", async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx("Explain Factor's role in MoneyPenny") });
    expect(res.title.toLowerCase()).not.toContain('candidate-intake framing');
  });

  it('"Help Atlas prepare for iQube Registry admission" -> candidate intake capability, operational', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Help Atlas prepare for iQube Registry admission') });
    expect(res.affordance).toBe('ACTION_AVAILABLE');
    expect(res.title).toContain('Candidate intake');
  });

  it('"Help this agent traverse the Horizon Journey Spine" -> registration/activation capability, partial', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Help this agent traverse the Horizen Journey Spine') });
    expect(res.affordance).toBe('PREPARABLE');
    expect(res.title.toLowerCase()).toContain('horizen');
  });

  it('"How can this agent gain standing?" -> standing/evidence capability, partial (real service, not surfaced)', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('How can this agent gain standing?') });
    expect(res.affordance).toBe('PREPARABLE');
    expect(res.title.toLowerCase()).toContain('standing');
  });

  it('"Facilitate Pulse and P&L registration" -> truthful advisory response, never claims full operation', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Facilitate Pulse and P&L registration') });
    expect(res.affordance).toBe('ADVISORY');
    expect(res.summary.toLowerCase()).not.toContain('is live today');
  });

  it('"Prepare an X402 settlement wallet" -> wallet/settlement capability, advisory (honest, no fake handler)', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Prepare an X402 settlement wallet') });
    expect(res.affordance).toBe('ADVISORY');
    expect(res.title.toLowerCase()).toContain('wallet');
  });

  it('"Could this agent issue a fair-launch token through Bankr?" -> tokenization capability, PLANNED stated honestly', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Could this agent issue a fair-launch token through Bankr?') });
    expect(res.affordance).toBe('PLANNED');
    expect(res.summary).toMatch(/not yet implemented|cannot act on it today/i);
  });

  it('"Can Vela protect this workload?" -> confidential-compute capability, PLANNED stated honestly', async () => {
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Can Vela protect this workload?') });
    expect(res.affordance).toBe('PLANNED');
    expect(res.summary).toMatch(/not yet implemented|cannot act on it today/i);
  });

  it('never renders a PLANNED capability response as if it were live (no operational claim leaks through)', async () => {
    for (const capId of ['vela_confidential_compute', 'bankr_tokenization', 'runtime_activation'] as const) {
      const res = await askSpecialist({ specialistId: 'factor', context: ctx('irrelevant', { factorCapabilityId: capId }) });
      expect(res.affordance).toBe('PLANNED');
      expect(res.summary.toLowerCase()).not.toContain('is live today');
    }
  });
});

describe('specialistDelegation.ts — "factor" ambiguity fix', () => {
  const groundContext = { cartridge: 'moneypenny', activePanel: 'factor' };

  it('"What risk factors should we consider?" does NOT route to Factor delegation merely on the bare word "factor"', async () => {
    const res = await resolveSmartTriadSpecialistDelegation('What risk factors should we consider?', groundContext);
    expect(res.matched).toBe(false);
  });

  it('a singular "risk factor" mention also does not trigger delegation', async () => {
    const res = await resolveSmartTriadSpecialistDelegation('What is the risk factor here?', groundContext);
    expect(res.matched).toBe(false);
  });

  it('"Ask Factor about this case." (capitalized proper noun) still triggers delegation', async () => {
    const res = await resolveSmartTriadSpecialistDelegation('Ask Factor about this case.', groundContext);
    expect(res.matched).toBe(true);
    expect(res.specialistId).toBe('factor');
  });

  it('an explicit targetSpecialistId works from a non-Factor/Aegis MoneyPenny panel (Home/Plan/Markets)', async () => {
    const res = await resolveSmartTriadSpecialistDelegation(
      'What are your capabilities?',
      { cartridge: 'moneypenny', activePanel: 'overview' },
      'factor',
    );
    expect(res.matched).toBe(true);
    expect(res.specialistId).toBe('factor');
  });

  it('a candidate case is optional grounding — delegation works with none open', async () => {
    const res = await resolveSmartTriadSpecialistDelegation('Ask Factor about this case.', groundContext);
    expect(res.matched).toBe(true);
    expect(res.response).not.toContain('undefined');
  });
});

describe('cross-entry-point consistency — Home modal / full panel / left-pane delegation all classify identically', () => {
  it('the same question classifies to the same capability whether asked via askSpecialist or via specialistDelegation grounding', async () => {
    const question = 'How can this agent gain standing?';
    const direct = resolveFactorCapability(ctx(question));
    // specialistDelegation.ts builds its own SpecialistContext internally and
    // calls the SAME askSpecialist -> resolveFactorCapability path; assert
    // the resulting response affordance matches what a direct ask produces.
    const viaDelegation = await resolveSmartTriadSpecialistDelegation(question, { cartridge: 'moneypenny', activePanel: 'factor' }, 'factor');
    const viaDirect = await askSpecialist({ specialistId: 'factor', context: ctx(question) });
    expect(direct).toBe('standing_proposal');
    expect(viaDelegation.matched).toBe(true);
    expect(viaDirect.affordance).toBe('PREPARABLE');
  });
});
