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
