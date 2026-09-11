/**
 * financialSovereigntyEvidence — the ONE place that names the FS
 * DISCOVER/LEARN/EXPLORE evidence contract (AEE-XP-001 §10/XP-6 follow-up,
 * 2026-09-01). Single source of truth for the LEARN concept-id list and the
 * two interactionKind literals, so KNYTS/CI's state routes and
 * FinancialSovereigntyIntroStage.tsx can never drift against each other
 * (inv.engineering.036/037 — one authoritative location per concern).
 *
 * Thin wrappers over the GENERIC `experienceObservationPromotion.ts` reads —
 * this module owns no persistence of its own and writes nothing.
 */

import { hasObservedExperienceInteraction, hasQualifyingExperienceInteraction } from '@/services/journey/experienceObservationPromotion';
import { getFinancialProfileQube } from '@/services/iqube/financialProfileQube';

/** Mirrors the three-axis MoneyPenny provider-mode vocabulary (Advisor/
 *  Architect/Runtime) the FS spec already establishes. Stable ids, also
 *  used client-side as the concept-card ids in FinancialSovereigntyIntroStage. */
export const FS_LEARN_CONCEPT_IDS = ['advisor', 'architect', 'runtime'] as const;

export const FS_LEARN_INTERACTION_KIND = 'learn-concept-acknowledged';
export const FS_EXPLORE_INTERACTION_KIND = 'moneypenny-capability-interacted';

/** DISCOVER's deliberately weak bar — any observed Continue on fs-discover. */
export function hasDiscoveredFinancialSovereignty(personaId: string | null | undefined, journeyId: string): Promise<boolean> {
  return hasObservedExperienceInteraction(personaId, journeyId, 'fs-discover');
}

/** LEARN's stronger bar — all three concept cards individually acknowledged. */
export function hasLearnedFinancialSovereignty(personaId: string | null | undefined, journeyId: string): Promise<boolean> {
  return hasQualifyingExperienceInteraction(personaId, journeyId, 'fs-learn', FS_LEARN_INTERACTION_KIND, FS_LEARN_CONCEPT_IDS);
}

/** EXPLORE's stronger bar — at least one real MoneyPenny capability interacted with. */
export function hasExploredFinancialSovereignty(personaId: string | null | undefined, journeyId: string): Promise<boolean> {
  return hasQualifyingExperienceInteraction(personaId, journeyId, 'fs-explore', FS_EXPLORE_INTERACTION_KIND, ['*']);
}

/**
 * PREPARE's bar (B1, 2026-09-02, operator directive: "Prepare completion
 * must reflect a reviewed financial profile or supported manual
 * preparation — not navigation"). Reads the REAL FinancialProfileQube
 * (MPY2-2/2-3, services/iqube/financialProfileQube.ts) — never a click/
 * navigation event.
 *
 * Turn E (2026-09-02) correction: `hasProfile === true` alone was being read
 * as "prepared," but it only proves a compute/manual-entry pass produced
 * real aggregates — DATA AVAILABILITY, not that the person reviewed them.
 * Operator directive: "'real aggregates exist' establishes data
 * availability, while prepared evidence reflects the required user review.
 * A successful extraction alone must not silently count as a reviewed
 * profile." This bar now ALSO requires `reviewedAt !== null` — set only by
 * an explicit `POST /api/moneypenny/financial-profile/review` call
 * (markFinancialProfileReviewed), never inferred from a compute pass
 * succeeding or from opening a panel. Selecting an agent candidate (this
 * stage's other, retained affordance) does NOT satisfy this bar either —
 * that is an optional advanced preference per the bridge spec's own
 * migration guidance (B-13 point 3), never financial preparation.
 */
export async function hasPreparedFinancialProfile(personaId: string | null | undefined): Promise<boolean> {
  if (!personaId) return false;
  const record = await getFinancialProfileQube(personaId);
  return record?.meta.hasProfile === true && record?.meta.reviewedAt !== null;
}
