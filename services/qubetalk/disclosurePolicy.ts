/**
 * QubeTalk Communications Membrane — the context/disclosure invariant (§6),
 * implemented as a service/policy boundary, never merely prompt language.
 *
 *   Context may inform; audience constrains disclosure.
 *
 * An Agent (or any composer) may READ everything in `availableContext` to
 * understand a conversation — that is "informing." But only items this
 * function returns in `permissibleContext` may actually be SURFACED in an
 * output addressed to `destinationAudienceParticipantIds`. Items in
 * `excludedContext` remain available for the Agent's own reasoning but MUST
 * NOT appear, be paraphrased, or be alluded to in anything sent to that
 * destination — that is the caller's responsibility to enforce when it
 * assembles the actual output (this function only computes the boundary;
 * see the "must exist" test at the bottom for the concrete §8 example).
 *
 *   permissible = availableContext
 *     ∩ (destination audience is a SUBSET of the item's own origin audience)
 *     ∩ (item.sensitivity === 'standard' OR item.explicitDisclosureAllowed)
 *
 * No Agent-authority/approval gating happens here — that's agentPolicy.ts;
 * this module only answers "may this specific piece of context be shown to
 * this specific audience," never "may the Agent act at all."
 */

import type { QubeTalkMessageSensitivity } from '@/types/qubetalk';

export interface DisclosureContextItem {
  /** The message/note id this context item came from — always present so an
   *  exclusion decision is traceable back to a real source (P5). */
  id: string;
  sensitivity: QubeTalkMessageSensitivity;
  /** Who could see this item where it originated (a channel's two
   *  principals, or a group's audience snapshot at that time). */
  originAudienceParticipantIds: string[];
  /** An explicit, one-time disclosure override — e.g. the original sender
   *  authorized re-sharing this specific item. Never inferred, only set by
   *  an actual authorization act (which itself should be receipted via
   *  'qubetalk_conversation_context_disclosure' — see
   *  services/qubetalk/events.ts callers). Absent/false by default. */
  explicitDisclosureAllowed?: boolean;
}

export interface DisclosureEvaluationInput {
  availableContext: DisclosureContextItem[];
  destinationAudienceParticipantIds: string[];
}

export interface DisclosureEvaluationResult {
  /** Safe to surface in output addressed to the destination audience. */
  permissibleContext: DisclosureContextItem[];
  /** May inform reasoning; must never be surfaced to the destination. */
  excludedContext: DisclosureContextItem[];
}

function isSubset(narrower: string[], wider: string[]): boolean {
  const widerSet = new Set(wider);
  return narrower.every((id) => widerSet.has(id));
}

export function evaluateDisclosure(input: DisclosureEvaluationInput): DisclosureEvaluationResult {
  const permissibleContext: DisclosureContextItem[] = [];
  const excludedContext: DisclosureContextItem[] = [];

  for (const item of input.availableContext) {
    const destinationWithinOrigin = isSubset(input.destinationAudienceParticipantIds, item.originAudienceParticipantIds);
    const sensitivityAllows = item.sensitivity === 'standard' || item.explicitDisclosureAllowed === true;
    if (destinationWithinOrigin && sensitivityAllows) {
      permissibleContext.push(item);
    } else {
      excludedContext.push(item);
    }
  }

  return { permissibleContext, excludedContext };
}

/**
 * The §8 example test, as a reusable predicate rather than only a test file
 * assertion — a caller assembling a group reply can call this directly to
 * decide "is this specific private fact allowed in THIS output."
 */
export function isDisclosableTo(item: DisclosureContextItem, destinationAudienceParticipantIds: string[]): boolean {
  const { permissibleContext } = evaluateDisclosure({
    availableContext: [item],
    destinationAudienceParticipantIds,
  });
  return permissibleContext.length === 1;
}
