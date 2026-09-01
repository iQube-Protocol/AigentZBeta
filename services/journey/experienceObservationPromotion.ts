/**
 * experienceObservationPromotion — AEE-XP-001 §10/XP-6 (2026-09-01).
 *
 * The missing seam identified by the audit: the estate already has an
 * observation substrate (DCIR — services/dcir/*), an experience-state model
 * (Journey Spine — services/journey/resolveJourneyState.ts), and an
 * adaptive re-evaluation loop (services/adaptive/journeyAeeOrchestrator.ts),
 * but NOTHING promoted an observed interaction into durable evidence the
 * Journey Spine could read. This is that ONE generic promotion adapter —
 * not a Financial-Sovereignty-specific receipt family, not a new table.
 *
 * Persistence seam decision (see the 2026-09-01 session's audit):
 *   - `types/journey.ts`'s `ExperienceEvidenceProjection` does not exist
 *     anywhere in code — only as a proposed field in a spec doc
 *     (2026-08-24_spec-journey-spine-state-experience-aware-navigation.md),
 *     whose own closing line instructs reusing a compatible existing
 *     projection rather than inventing a new type. No new type is created.
 *   - `services/iqube/experienceQube.ts` (`experience_qubes`) is a
 *     per-persona LIFECYCLE/SETTINGS container (one JSON blob), not an
 *     event log — the wrong semantic home for stage-interaction evidence.
 *   - `services/receipts/activityReceiptService.ts` (`activity_receipts`)
 *     is the correct seam: it already has a generic `action_input` JSONB
 *     column, an established multi-migration pattern for extending its
 *     action-type vocabulary (never a new table), and is the mature,
 *     generic, DVN-anchorable receipt system every other subsystem in this
 *     codebase already uses for "something happened" evidence.
 *
 * Provenance discipline (AEE-XP-001A invariant): this function records
 * OBSERVED behavior only. It never asserts a declared preference and never
 * writes Journey completion itself — `hasObservedExperienceInteraction`
 * below is a pure read; the Journey Spine (resolveJourneyState.ts) is the
 * only place that turns evidence into COMPLETE, via a stage's own
 * `completionEvidence` list.
 */

import {
  createActivityReceipt,
  listActivityReceiptsForPersona,
  type ActivityReceiptRecord,
} from '@/services/receipts/activityReceiptService';

/** `${journeyId}:${stageId}` — the one generic discriminator every caller uses. */
export function buildExperienceRef(journeyId: string, stageId: string): string {
  return `${journeyId}:${stageId}`;
}

export interface PromoteExperienceObservationInput {
  personaId: string;
  journeyId: string;
  stageId: string;
  /** The journeySurfaceRegistry ref the interaction occurred on, for audit/debugging only. */
  surfaceRef?: string | null;
  summary?: string;
  /**
   * Discriminates WHAT KIND of interaction was observed, e.g.
   * 'learn-concept-acknowledged' or 'moneypenny-capability-interacted' —
   * never a new ActivityActionType, just a richer `actionInput` on the same
   * generic literal (AEE-XP-001 §10/XP-6 follow-up, 2026-09-01: "the
   * plumbing is mechanical; the evidence semantics are not"). Omitted for
   * the plain "any observed interaction" bar (fs-discover's own model).
   */
  interactionKind?: string;
  /** The specific concept/capability this interaction was about, e.g. an
   *  FS learning-concept id ('advisor'/'architect'/'runtime') or a real
   *  `FinancialServiceDefinition.id` — never a free-text label. */
  capabilityId?: string;
}

/**
 * Writes ONE `experience_interaction_observed` receipt. Idempotent in
 * effect (not in row count): `hasObservedExperienceInteraction` only checks
 * PRESENCE, so a re-fired observation is harmless — it does not need to be
 * deduplicated at write time.
 */
export async function promoteExperienceObservation(
  input: PromoteExperienceObservationInput,
): Promise<ActivityReceiptRecord | null> {
  const experienceRef = buildExperienceRef(input.journeyId, input.stageId);
  return createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'metame',
    actionType: 'experience_interaction_observed',
    summary: input.summary ?? `Observed interaction: ${experienceRef}`,
    actionInput: {
      experienceRef,
      journeyId: input.journeyId,
      stageId: input.stageId,
      surfaceRef: input.surfaceRef ?? null,
      interactionKind: input.interactionKind ?? null,
      capabilityId: input.capabilityId ?? null,
      // Explicit provenance tag (AEE-XP-001A invariant) — this is OBSERVED
      // behavior, never promoted to 'declared' by this or any other path.
      provenance: 'observed',
    },
  });
}

/**
 * Pure read: has this persona ever had an experience interaction observed
 * for this exact journeyId+stageId? Consumed directly by a journey state
 * route's `AuthoritativePlatformState` assembly — see
 * app/api/journey/knyts-bridge/state/route.ts and
 * app/api/journey/constitutional-internet-bridge/state/route.ts.
 */
export async function hasObservedExperienceInteraction(
  personaId: string | null | undefined,
  journeyId: string,
  stageId: string,
): Promise<boolean> {
  if (!personaId) return false;
  const experienceRef = buildExperienceRef(journeyId, stageId);
  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['experience_interaction_observed'],
    limit: 50,
  });
  return receipts.some((r) => {
    const actionInput = r.actionInput as Record<string, unknown> | null;
    return actionInput?.experienceRef === experienceRef;
  });
}

/**
 * The STRONGER bar (AEE-XP-001 §10/XP-6 follow-up, 2026-09-01): satisfied
 * only by observed interactions carrying the given `interactionKind` AND
 * covering every id in `requiredCapabilityIds` — never by mere presence of
 * any receipt for the stage. "Observed engagement is evidence of
 * engagement. It is not automatically evidence of competence" — this is
 * the read side of that rule. Used by LEARN (all three FS concept cards
 * acknowledged) and EXPLORE (at least one real MoneyPenny capability
 * interacted with — pass a single-element `requiredCapabilityIds` of the
 * literal wildcard '*' to mean "any one real capability id", never "any
 * receipt regardless of kind").
 */
export async function hasQualifyingExperienceInteraction(
  personaId: string | null | undefined,
  journeyId: string,
  stageId: string,
  interactionKind: string,
  requiredCapabilityIds: readonly string[],
): Promise<boolean> {
  if (!personaId) return false;
  const experienceRef = buildExperienceRef(journeyId, stageId);
  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['experience_interaction_observed'],
    limit: 200,
  });
  const observedCapabilityIds = new Set<string>();
  for (const r of receipts) {
    const actionInput = r.actionInput as Record<string, unknown> | null;
    if (actionInput?.experienceRef !== experienceRef) continue;
    if (actionInput?.interactionKind !== interactionKind) continue;
    const capabilityId = actionInput?.capabilityId;
    if (typeof capabilityId === 'string' && capabilityId.length > 0) {
      observedCapabilityIds.add(capabilityId);
    }
  }
  if (requiredCapabilityIds.length === 1 && requiredCapabilityIds[0] === '*') {
    return observedCapabilityIds.size > 0;
  }
  return requiredCapabilityIds.every((id) => observedCapabilityIds.has(id));
}

export interface ObservedExperienceInteraction {
  stageId: string;
  interactionKind: string | null;
  capabilityId: string | null;
  observedAt: string;
}

/**
 * Structured read (AEE-XP-001 §6 XP-1 follow-up — ExperienceIntentProjection
 * activation, 2026-09-01): every real `experience_interaction_observed`
 * receipt for this persona within ONE journey, as structured records — not
 * a boolean. This is what `services/adaptive/experienceIntentAssembly.ts`
 * uses to populate `observedBehavior`; `hasObservedExperienceInteraction`/
 * `hasQualifyingExperienceInteraction` above remain the boolean gates
 * Journey stage evidence reads use — this is a DIFFERENT consumer (AEE
 * presentation context), not a replacement for either.
 */
export async function listObservedExperienceInteractions(
  personaId: string | null | undefined,
  journeyId: string,
): Promise<ObservedExperienceInteraction[]> {
  if (!personaId) return [];
  const journeyPrefix = `${journeyId}:`;
  const receipts = await listActivityReceiptsForPersona(personaId, {
    actionTypes: ['experience_interaction_observed'],
    limit: 200,
  });
  const results: ObservedExperienceInteraction[] = [];
  for (const r of receipts) {
    const actionInput = r.actionInput as Record<string, unknown> | null;
    const experienceRef = actionInput?.experienceRef;
    if (typeof experienceRef !== 'string' || !experienceRef.startsWith(journeyPrefix)) continue;
    const stageId = experienceRef.slice(journeyPrefix.length);
    const interactionKind = actionInput?.interactionKind;
    const capabilityId = actionInput?.capabilityId;
    results.push({
      stageId,
      interactionKind: typeof interactionKind === 'string' ? interactionKind : null,
      capabilityId: typeof capabilityId === 'string' ? capabilityId : null,
      observedAt: r.createdAt,
    });
  }
  return results;
}
