import { describe, it, expect } from 'vitest';
import {
  resolveCitizenStepAfterClassChoice,
  resolveCitizenStepAfterAccountCreation,
  resolveDelegateStepAfterClassChoice,
  wizardSteps,
} from '../services/passport/passportWizardSteps';

// Guided Journey Runtime — Passport application branching invariants.
// A human Citizen applicant and a non-human Delegate/agent applicant have
// different constitutional requirements; these canaries pin the rule that
// keeps them from being forced through a common linear sequence.
//
// Citizen and Delegate resolvers are separate functions (not one function
// branching on class) BY DESIGN — a 2026-07-31 regression routed Delegate
// applicants through the human Account step whenever they weren't already
// signed in, because the old combined resolver's Delegate branch took a
// `signedIn` parameter at all. These tests pin each resolver's signature as
// well as its behavior: the Delegate resolver must never gain a `signedIn`
// parameter again.

describe('Passport wizard branching — Citizen advances to Account', () => {
  it('an unauthenticated Citizen applicant goes to account first', () => {
    expect(resolveCitizenStepAfterClassChoice(false)).toBe('account');
  });

  it('an already-authenticated Citizen applicant skips straight to personhood binding', () => {
    expect(resolveCitizenStepAfterClassChoice(true)).toBe('identity');
  });
});

describe('Passport wizard branching — Delegate advances directly to Agent, unconditionally', () => {
  it('an already-authenticated Delegate applicant goes straight to the Agent step', () => {
    expect(resolveDelegateStepAfterClassChoice()).toBe('agent');
  });

  it('takes no arguments — session state must never gate the Delegate route again (2026-07-31 regression)', () => {
    expect(resolveDelegateStepAfterClassChoice.length).toBe(0);
  });
});

describe('Passport wizard branching — agent applications never invoke personhood binding', () => {
  it('account creation routes a Citizen applicant to Identity (personhood binding)', () => {
    expect(resolveCitizenStepAfterAccountCreation()).toBe('identity');
  });

  it('the Delegate/agent step sequence never contains the identity (personhood) step', () => {
    expect(wizardSteps('participant')).not.toContain('identity');
  });

  it('the Delegate/agent step sequence never contains the account step', () => {
    expect(wizardSteps('participant')).not.toContain('account');
  });
});

describe('Passport wizard branching — One Journey, Conditional Steps', () => {
  it('the Citizen route is Class, Account, Personhood, Private Vault, Consents, Submit', () => {
    expect(wizardSteps('citizen')).toEqual(['class', 'account', 'identity', 'vault', 'consents', 'submit']);
  });

  it('the Delegate route is Class, Agent, Consents, Submit — no mysteriously skipped steps', () => {
    expect(wizardSteps('participant')).toEqual(['class', 'agent', 'consents', 'submit']);
  });

  it('both routes start at Class and end at Submit', () => {
    expect(wizardSteps('citizen')[0]).toBe('class');
    expect(wizardSteps('participant')[0]).toBe('class');
    expect(wizardSteps('citizen').at(-1)).toBe('submit');
    expect(wizardSteps('participant').at(-1)).toBe('submit');
  });
});

describe('Passport wizard — canonical UI terminology', () => {
  it('the wizard component never renders the retired public-facing term "Participant Passport"', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../app/triad/components/codex/tabs/PassportBureauApplyTab.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/Participant Passport/);
  });

  it('the wizard component uses the canonical "Polity Citizen Passport" / "Polity Agent Passport" terms (semantic repair, 2026-08-25 — "Delegate Passport" retired from public copy)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../app/triad/components/codex/tabs/PassportBureauApplyTab.tsx'),
      'utf8',
    );
    expect(source).toMatch(/Polity Citizen Passport/);
    expect(source).toMatch(/Polity Agent Passport/);
    // "Delegate Passport" conflated Passport issuance with delegation grant
    // issuance — the two are constitutionally distinct acts (item 4, same
    // repair). Never reintroduce it in public copy.
    expect(source).not.toMatch(/Polity Delegate Passport/);
  });

  it('the internal PassportClass identifier is preserved as "participant" (not renamed)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../services/passport/passportWizardSteps.ts'),
      'utf8',
    );
    expect(source).toMatch(/'citizen' \| 'participant'/);
  });
});
