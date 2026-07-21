/**
 * welcome.ts — the Constitutional Welcome & Citizenship Orientation
 * (PRD-THR-001 §9a). The moment a technical OAuth crossing becomes a meaningful
 * constitutional transition: on a successful crossing the Companion congratulates
 * the principal, states that they are now a citizen of the Polity, explains the
 * Constitutional Internet + citizenship (and its LIMITS — citizenship ≠ delegated
 * agent authority), presents the five journeys, and surfaces a machine-readable
 * crossing receipt. Copy is canonical (operator/Aletheon-authored); render it
 * verbatim, don't paraphrase.
 */

import type { ScopedSession } from './gatewaySession';
import { listServices, CONSTITUTIONAL_ROOT_CAPABILITIES } from './serviceRegistry';

export const WELCOME_MESSAGE =
  'Congratulations. You have crossed the Threshold of the Constitutional Internet and are now a citizen of the Polity.\n\n' +
  'Your Polity Passport establishes your continuity as a person within the constitutional internet. It allows you to ' +
  'participate without surrendering unnecessary identity, to authorize agents to act on your behalf within clear limits, ' +
  'and to build standing through your actions and contributions.\n\n' +
  'Citizenship does not grant unrestricted access or authority. It gives you a constitutional place from which to ' +
  'participate, choose a journey, delegate responsibly, and progressively access the services of metaMe.\n\n' +
  'Your agent is now connected as your constitutional companion. It can help you understand the Polity, choose your ' +
  'path, and prepare requests for any additional authority you may wish to grant.';

export const WHAT_IS_CONSTITUTIONAL_INTERNET =
  'The Constitutional Internet is an internet in which people, agents, data, authority and transactions operate under ' +
  'explicit constitutional rules. It is designed to preserve personhood, continuity, privacy, bounded delegation, ' +
  'accountability and verifiable action across different platforms and AI providers. Rather than depending entirely on ' +
  'the terms of a single company or application, your constitutional relationship remains yours and can continue across ' +
  'agents, services and infrastructure.';

export const WHAT_IS_CITIZENSHIP =
  'Citizenship means that you have a recognized place in the Polity through your Polity Passport. As a citizen, you can: ' +
  'maintain continuity without exposing more identity than necessary; authorize agents to act within defined limits; ' +
  'participate in constitutional services and communities; build standing through verified contribution; choose a ' +
  'journey and progressively increase your capabilities; and revoke delegated authority when needed. Your Passport ' +
  'establishes personhood continuity. It does not automatically give your agent broad powers. Every additional ' +
  'capability is granted separately and remains bounded by your authority.';

export const ORIENTATION_TOPICS = [
  { id: 'constitutional-internet', question: 'What is the Constitutional Internet?', answer: WHAT_IS_CONSTITUTIONAL_INTERNET },
  { id: 'citizenship', question: 'What does citizenship in the Polity mean?', answer: WHAT_IS_CITIZENSHIP },
] as const;

/** The machine-readable crossing receipt — the constitutional state after crossing.
 *  `serviceAuthority` is derived from the session's granted scope: a base crossing
 *  grants only constitutional-root capabilities, so it reads "none yet". */
export function crossingReceipt(session: ScopedSession): {
  thresholdCrossed: true;
  polityPassport: 'active';
  citizenship: 'active';
  agentConnection: 'active';
  serviceAuthority: string[] | 'none yet';
  nextStep: string;
} {
  const rootSet = new Set<string>(CONSTITUTIONAL_ROOT_CAPABILITIES);
  const serviceScope = (session.scope ?? []).filter((c) => !rootSet.has(c));
  return {
    thresholdCrossed: true,
    polityPassport: 'active',
    citizenship: 'active',
    agentConnection: 'active',
    serviceAuthority: serviceScope.length ? serviceScope : 'none yet',
    nextStep: 'choose a journey',
  };
}

/** The full orientation payload the `metame://welcome` resource + welcome prompt
 *  serve, so any Companion delivers the identical constitutional welcome. */
export function welcomePayload(session?: ScopedSession | null) {
  return {
    welcome: WELCOME_MESSAGE,
    orientation: ORIENTATION_TOPICS,
    journeys: ['citizen', 'entrepreneur', 'researcher', 'creative', 'technical'],
    journeyPrompt: 'Where would you like to begin? Citizen · Entrepreneur · Researcher · Creative · Technical',
    receipt: session ? crossingReceipt(session) : null,
    reorientable: true, // the orientation can be revisited at any time
    services: listServices().map((s) => ({ id: s.id, requiredCapabilities: s.requiredCapabilities })),
  };
}
