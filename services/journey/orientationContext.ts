/**
 * Orient stage — orientation ritual, resolved from STATE, never from agent
 * name (Threshold Journey — Orient stage + Consequence Fork, operator spec,
 * 2026-08-09).
 *
 * Orient sits between Claim and Passport (services/journey/horizenMoneyPennyJourney.ts):
 * "I have proved I control this agent. What must become constitutionally
 * true before I can act as the principal from whom its authority
 * originates?" Two ritual kinds answer that, and which one applies is a fact
 * about the OPERATOR's own prior constitutional history, never a fact about
 * which agent (MoneyPenny, Nakamoto, or any future registrable agent) is
 * currently selected:
 *
 *   - `principal-first-constitutional-act` — this operator has never
 *     recorded a Passport-adjacent constitutional act (a sponsorship or an
 *     issued Passport) for ANY agent. This is their first.
 *   - `acknowledge-existing-relationship` — this operator already holds at
 *     least one such act for some agent. Orient does not ask them to
 *     duplicate it; it asks them to acknowledge that the same constitutional
 *     standing extends to the agent now in front of them.
 *
 * The signal is read via the existing, persona-scoped, cross-agent receipt
 * reader (`listActivityReceiptsForPersona` — services/receipts/activityReceiptService.ts),
 * deliberately WITHOUT an `agentsInvoked` filter: the question is "has this
 * PERSON already done this," not "has this person already done this for
 * this agent" (that second question is Passport's own, answered by
 * `resolvePassportEligibility`, not by Orient).
 *
 * Capsule copy draws briefly from "The Constitutional Internet for Agents" —
 * control does not establish authority; authority originates from a
 * principal. It is a concise orientation, not the book.
 */

import {
  listActivityReceiptsForPersona,
  type ActivityActionType,
} from '@/services/receipts/activityReceiptService';
import { renderJourneyCopy } from './journeyCopyTemplate';

export type OrientationRitualKind =
  | 'principal-first-constitutional-act'
  | 'acknowledge-existing-relationship';

export interface OrientationContext {
  ritualKind: OrientationRitualKind;
  /** The concise Constitutional-Internet-for-Agents capsule, agent-name-substituted. */
  capsule: string;
  /** Label for the one guided action this stage permits. */
  acknowledgeActionLabel: string;
}

/**
 * A prior Passport-adjacent constitutional act, for ANY agent this operator
 * has acted on. `agent_sponsorship_recorded` is the sponsoring act itself;
 * `passport_issued` covers a Passport already issued under an older receipt
 * shape that never separately recorded the sponsorship. Either is sufficient
 * evidence that this operator has already been through Orient's founding
 * ritual once.
 */
const PRIOR_PRINCIPAL_ACT_TYPES: ActivityActionType[] = ['agent_sponsorship_recorded', 'passport_issued'];

export async function resolveOrientationContext(
  actorPersonaId: string,
  agent: { displayName: string },
): Promise<OrientationContext> {
  const priorActs = actorPersonaId
    ? await listActivityReceiptsForPersona(actorPersonaId, { actionTypes: PRIOR_PRINCIPAL_ACT_TYPES, limit: 1 })
    : [];

  if (priorActs.length > 0) {
    return {
      ritualKind: 'acknowledge-existing-relationship',
      capsule: renderJourneyCopy(
        "You have proved control of {{agentDisplayName}}. You have already established constitutional " +
          'authority as a principal on the Constitutional Internet for Agents — this orientation ' +
          'acknowledges that standing relationship extends to {{agentDisplayName}}, rather than repeating ' +
          'the founding act.',
        agent,
      ),
      acknowledgeActionLabel: renderJourneyCopy('Acknowledge — I am already a constituted principal for {{agentDisplayName}}', agent),
    };
  }

  return {
    ritualKind: 'principal-first-constitutional-act',
    capsule: renderJourneyCopy(
      'You have proved control of {{agentDisplayName}}. Control does not yet establish constitutional ' +
        'authority. The next step establishes the person or principal from whom legitimate authority may ' +
        'originate — the first constitutional act you take as a principal on the Constitutional Internet ' +
        'for Agents.',
      agent,
    ),
    acknowledgeActionLabel: renderJourneyCopy("I understand — I am {{agentDisplayName}}'s principal", agent),
  };
}
