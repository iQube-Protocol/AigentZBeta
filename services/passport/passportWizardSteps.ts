/**
 * passportWizardSteps — the Passport application wizard's branching rule
 * (Guided Journey Runtime — Branch by Constitutional Subject).
 *
 * A human Citizen applicant and a non-human Delegate/agent applicant have
 * different constitutional requirements and must not be forced through a
 * common linear sequence. Extracted as pure functions (rather than left as
 * inline closures in the wizard component) so the branching rule has one
 * authoritative, directly testable home — see
 * tests/passport-wizard-branching.test.ts for the canaries this module
 * exists to make possible.
 *
 * `'participant'` is the wizard's internal PassportClass value for the
 * public-facing "Polity Delegate Passport" — the internal identifier is
 * preserved (it also matches the DB/API `agent_participant` family) even
 * though the UI no longer surfaces the word "Participant".
 */

export type StepId = 'class' | 'account' | 'identity' | 'vault' | 'agent' | 'consents' | 'submit';
export type PassportClass = 'citizen' | 'participant';

/**
 * Where the wizard goes immediately after the applicant picks a class.
 *
 * Human Personhood Exclusivity: a Delegate/agent application never binds
 * human personhood, so it never visits 'identity'. If the applicant already
 * has platform access it goes straight to 'agent'; otherwise it still needs
 * SOME account to act through, so it visits 'account' first — but
 * `resolveStepAfterAccountCreation` below ensures that account step still
 * routes onward to 'agent', never 'identity'.
 */
export function resolveStepAfterClassChoice(passportClass: PassportClass, signedIn: boolean): StepId {
  if (passportClass === 'participant') return signedIn ? 'agent' : 'account';
  return signedIn ? 'identity' : 'account';
}

/** Where the wizard goes after account creation/sign-in completes. */
export function resolveStepAfterAccountCreation(passportClass: PassportClass): StepId {
  return passportClass === 'participant' ? 'agent' : 'identity';
}

/**
 * The ordered, class-dependent step sequence (One Journey, Conditional
 * Steps). The Delegate/agent route never includes 'account' or 'identity'
 * at all — not even as a mysteriously-skipped box — because it never visits
 * either. Citizen order is unchanged from the original five-panel flow.
 */
export function wizardSteps(passportClass: PassportClass): StepId[] {
  return passportClass === 'participant'
    ? ['class', 'agent', 'consents', 'submit']
    : ['class', 'account', 'identity', 'vault', 'consents', 'submit'];
}
