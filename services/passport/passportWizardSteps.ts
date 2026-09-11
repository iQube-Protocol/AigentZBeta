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
 * public-facing "Polity Agent Passport" (renamed from "Polity Delegate
 * Passport", semantic repair 2026-08-25 — Passporting an agent is
 * sponsorship, not delegation) — the internal identifier is preserved (it
 * also matches the DB/API `agent_participant` family) even though the UI no
 * longer surfaces the word "Participant" or "Delegate".
 */

export type StepId = 'class' | 'account' | 'identity' | 'vault' | 'agent' | 'consents' | 'submit';
export type PassportClass = 'citizen' | 'participant';

/**
 * Citizen route resolvers. Deliberately independent of the Delegate
 * resolvers below (Branch by Constitutional Subject) — a future change to
 * the Citizen path's rule must never leak into the Delegate path, or vice
 * versa. Do not merge these back into one class-branching function; that
 * shape is exactly what caused the 2026-07-31 regression (see the Delegate
 * resolver's comment below).
 */
export function resolveCitizenStepAfterClassChoice(signedIn: boolean): StepId {
  return signedIn ? 'identity' : 'account';
}

/** Only the Citizen route ever reaches the account-creation step. */
export function resolveCitizenStepAfterAccountCreation(): StepId {
  return 'identity';
}

/**
 * Delegate/agent route resolver. ALWAYS 'agent' — never conditional on
 * signedIn/session state. Human Personhood Exclusivity means a Delegate/
 * agent application never visits 'account' or 'identity', full stop.
 *
 * 2026-07-31 regression, fixed here: this used to return 'account' when the
 * applicant had no session yet, reasoning that "it still needs SOME account
 * to act through." That reasoning was wrong — the Agent step's own handlers
 * (handleQuickAgent/handleGenesisAgent) already resolve whatever auth they
 * need independently via authedFetchHeaders(), and an agent is not a human
 * who needs a Bureau account. Do not reintroduce a signedIn parameter here.
 */
export function resolveDelegateStepAfterClassChoice(): StepId {
  return 'agent';
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

/**
 * The canonical, in-Bureau-flow signal that a Citizen Passport has just
 * become USABLE — never merely submitted (CFS-055 coherence pass,
 * 2026-08-13). `application_status` (this list) and `citizen_status` (the
 * separate `polity_passport_records` row `isPassportUsable` reads) are
 * distinct fields, but `services/passport/issuanceService.ts` issues a
 * citizen record with `citizen_status: 'active'` at the exact moment a
 * steward's decision sets `application_status: 'approved'` — so 'approved'
 * on a citizen-class application IS the positive confirmation, not a proxy
 * for it. 'submitted' / 'pending_approval' / 'needs_more_information' /
 * 'denied' must never trigger this — only 'approved' does.
 */
export interface CitizenApplicationStatusSnapshot {
  passportClass: string;
  applicationStatus: string;
}

export function hasApprovedCitizenApplication(applications: CitizenApplicationStatusSnapshot[]): boolean {
  return applications.some((a) => a.passportClass === 'citizen' && a.applicationStatus === 'approved');
}
