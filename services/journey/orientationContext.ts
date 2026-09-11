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

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listActivityReceiptsForPersona,
  type ActivityActionType,
} from '@/services/receipts/activityReceiptService';
import { resolveAgentAdmissionState } from './agentAdmissionState';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';
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

// ═══════════════════════════════════════════════════════════════════════════
// Orient COMPLETION — distinct from the ritual-copy resolution above.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How Orient came to be complete for a given agent/operator pair — never
 * collapsed into one boolean. A caller that needs to know WHETHER this was
 * the explicit ceremony or a legacy compatibility signal reads `source`.
 */
export type OrientationCompletionSource = 'ritual' | 'legacy-precedent' | 'none';

export interface OrientationCompletionResult {
  complete: boolean;
  source: OrientationCompletionSource;
}

/**
 * The three facts a LEGACY admission must already hold before Orient existed
 * as a stage, for its pre-existing progression to satisfy Orient's new
 * position in the spine without fabricating a ritual it never performed.
 */
export interface OrientationDownstreamFacts {
  /** The agent's Delegate Passport has issued — Passport's own outcome. */
  delegatePassportIssued: boolean;
  /** Bounded delegation is active — Delegate's own outcome. */
  delegationActive: boolean;
  /** aigentMe/Operate has activated for this agent. */
  aigentMeActivated: boolean;
}

/**
 * LEGACY ORIENT COMPATIBILITY (Horizen Journey correction, 2026-08-09).
 *
 * Orient is NEWER than several agents' completed admission progressions.
 * Nakamoto's Passport, bounded delegation and aigentMe/Operate activation are
 * all real, canonically-established facts that predate Orient's insertion
 * into the spine — she never performed, and could never have performed, an
 * "orientation_ritual_completed" acknowledgment that did not exist yet.
 *
 * Fabricating that receipt for her would be a counterfeited historical act
 * (operator instruction, 2026-08-09: "Do not counterfeit historical user
 * acknowledgement"). Instead, this is a DERIVED — never written, never
 * persisted, never disguised as the ritual — compatibility signal: an agent
 * who has already crossed the STRONGER downstream constitutional boundary
 * (an issued Delegate Passport, active bounded delegation, and activated
 * aigentMe) has, by construction, already done everything the operator would
 * need Orient to establish. The distinction stays legible via `source`:
 * `'ritual'` for an explicit acknowledgment act, `'legacy-precedent'` for
 * this compatibility path — never merged into an indistinguishable true/false.
 *
 * A NEW agent cannot satisfy this: to reach an issued Passport, active
 * delegation AND activated aigentMe, they must first pass through Orient's
 * gate for real (or fail to reach this state at all) — this predicate can
 * only ever be satisfied by progression that already happened.
 */
export function orientationLegacyPrecedentEstablished(facts: OrientationDownstreamFacts): boolean {
  return facts.delegatePassportIssued && facts.delegationActive && facts.aigentMeActivated;
}

/**
 * The one place Orient's completion is decided from an operator + agent
 * pair, for callers (the orient/acknowledge route) that have not already
 * resolved admission state themselves. `app/api/journey/moneypenny-horizen/
 * state/route.ts` does NOT call this — it already holds `admission`,
 * `passportIssuedForAgent` and `hasReceipt('aigentme_activated')` from its
 * own reads and calls `orientationLegacyPrecedentEstablished` directly with
 * them, so the DECISION RULE lives in exactly one function while each caller
 * supplies its own already-resolved facts (the same shape `resolvePassportEligibility`
 * uses) — never a second copy of the three-fact rule.
 */
export async function resolveOrientationCompletion(
  admin: SupabaseClient,
  actorPersonaId: string,
  agent: RegistrableAgentConfig,
): Promise<OrientationCompletionResult> {
  const ritual = actorPersonaId
    ? await listActivityReceiptsForPersona(actorPersonaId, {
        actionTypes: ['orientation_ritual_completed'],
        agentsInvoked: [agent.runtimeAgentId],
        limit: 1,
      })
    : [];
  if (ritual.length > 0) return { complete: true, source: 'ritual' };

  const [admission, aigentMeReceipts] = await Promise.all([
    resolveAgentAdmissionState(admin, agent),
    actorPersonaId
      ? listActivityReceiptsForPersona(actorPersonaId, {
          actionTypes: ['aigentme_activated'],
          agentsInvoked: [agent.runtimeAgentId],
          limit: 1,
        })
      : Promise.resolve([]),
  ]);

  const legacyPrecedent = orientationLegacyPrecedentEstablished({
    delegatePassportIssued: admission?.delegatePassportIssued === true,
    delegationActive: admission?.delegationActive === true,
    aigentMeActivated: aigentMeReceipts.length > 0,
  });

  return legacyPrecedent ? { complete: true, source: 'legacy-precedent' } : { complete: false, source: 'none' };
}
