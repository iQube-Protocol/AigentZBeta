/**
 * Where a pending action goes when the operator acts on it.
 *
 * ── Why a table rather than a switch in the component ──────────────────────
 *
 * Each of the nine purpose-bound actions completes at its own endpoint, and
 * two of them complete in genuinely different WAYS: a principal-role request
 * is completed by a signature the operator's own wallet produces, while an
 * agent-role request is completed by an approval that triggers a bounded
 * custody service — approving IS the act, and no signature comes from the
 * caller.
 *
 * A component that branched on `signerRole` inline would encode that
 * distinction in a place nobody reads when adding the tenth action. Here the
 * shape of the completion is a property of the ACTION, declared beside it,
 * and an action with no route is refused rather than guessed at.
 *
 * ── Actions with no surface yet ────────────────────────────────────────────
 *
 * Most of the nine have no completion route built. They are absent from this
 * table deliberately: the wallet lists them, states that they cannot be
 * completed here yet, and does not offer a button. That is the honest
 * rendering — an action whose route does not exist must not present a control
 * that would 404, which is precisely the defect that produced the
 * "Unexpected token '<'" report on the Register button.
 */

import type { SigningRequestActionKind, SigningRequestSignerRole } from '@/types/signingRequest';

export type CompletionKind =
  /** The operator's own wallet signs the payload; the signature is submitted. */
  | 'principal-signature'
  /** Approval alone completes it — it triggers a bounded custody service. */
  | 'agent-approval';

export interface PendingActionRoute {
  actionKind: SigningRequestActionKind;
  signerRole: SigningRequestSignerRole;
  completion: CompletionKind;
  endpoint: string;
  /** Verb for the button. Never "Sign" for an approval that produces no signature. */
  label: string;
  /** What the operator is agreeing to, in one line, above the request's own consequence text. */
  summary: string;
}

export const PENDING_ACTION_ROUTES: readonly PendingActionRoute[] = Object.freeze([
  Object.freeze({
    actionKind: 'authorize_registration' as const,
    signerRole: 'principal' as const,
    completion: 'principal-signature' as const,
    endpoint: '/api/journey/moneypenny-horizen/register/mandate/approve',
    label: 'Sign with your principal wallet',
    summary:
      'Authorises registering this agent in the Horizen registry under your authority. Your wallet signs the ' +
      'mandate; nothing is broadcast until it does.',
  }),
  Object.freeze({
    actionKind: 'sign_registry_transaction' as const,
    signerRole: 'agent' as const,
    completion: 'agent-approval' as const,
    endpoint: '/api/journey/moneypenny-horizen/register/invocation/approve',
    label: 'Approve invocation of the agent key',
    summary:
      "Approves the agent's own custodied key being invoked to sign and broadcast the registration. The key " +
      'never leaves custody and never reaches this browser — approving is the trigger, not a signature you make.',
  }),
]);

export function routeForAction(
  actionKind: string,
  signerRole: string,
): PendingActionRoute | null {
  return (
    PENDING_ACTION_ROUTES.find((r) => r.actionKind === actionKind && r.signerRole === signerRole) ?? null
  );
}

/**
 * What to say about an action the wallet cannot yet complete.
 *
 * Named rather than inlined so the sentence is the same everywhere and stays
 * honest: the request is real and recorded, the surface is what is missing.
 */
export const NO_COMPLETION_ROUTE_YET =
  'This action is recorded and waiting, but the surface that completes it has not been built yet. It will ' +
  'become actionable here without any further step from you once that ships.';

/**
 * A principal signature must NEVER be produced for an agent-role request.
 *
 * The two completions are not interchangeable and the direction of the error
 * matters: signing an agent request with the principal key would place the
 * operator's constitutional authority behind an act the ruling assigns to
 * bounded custody. Refused structurally rather than by convention.
 */
export function mayProducePrincipalSignature(route: PendingActionRoute): boolean {
  return route.completion === 'principal-signature' && route.signerRole === 'principal';
}
