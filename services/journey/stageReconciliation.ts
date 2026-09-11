/**
 * Journey stage reconciliation — ExperienceStage is the UNIVERSAL model; the
 * KNYT JourneyStage is the KNYT cartridge's PROJECTION of it (operator direction
 * 2026-07-18: "KNYT Journey should really be the KNYT Cartridge version of the
 * ExperienceStage … with ExperienceStage surviving as the universal").
 *
 * Before this, two parallel, unreconciled stage models existed:
 *   - ExperienceStage  (services/iqube/experienceQube.ts) — setup → alpha_activation
 *     → launch → growth → scale — the venture/experience lifecycle spine.
 *   - JourneyStage     (types/orchestration.ts)          — prospect → acolyte →
 *     keta → keji → first → zero (+ side-state variants) — the KNYT world journey.
 *
 * This module makes ExperienceStage canonical and expresses the KNYT journey as
 * a bidirectional projection of it. Surfaces that computed a KNYT stage in
 * isolation migrate (incrementally) to derive it from the persona's universal
 * ExperienceStage via `journeyStageForExperience`, and to read a persona's
 * universal stage from a KNYT stage via `experienceStageForJourney`.
 *
 * Pure + deterministic. No I/O. Server- or client-safe.
 */

import type { ExperienceStage } from '@/services/iqube/experienceQube';
import type { JourneyStage } from '@/types/orchestration';

/**
 * KNYT JourneyStage → the universal ExperienceStage it projects from.
 *
 * The six linear KNYT stages map onto the five universal stages; `first` and
 * `zero` are both expressions of `scale` (mastery within the scale phase). The
 * side-state variants map to the universal stage that best matches their
 * engagement posture (they are not linear-progression stages).
 */
export const EXPERIENCE_STAGE_FOR_JOURNEY: Record<JourneyStage, ExperienceStage> = {
  prospect: 'setup',
  acolyte: 'alpha_activation',
  keta: 'launch',
  keji: 'growth',
  first: 'scale',
  zero: 'scale',
  // side-states (not linear) — mapped by engagement posture:
  investor_reactivation_candidate: 'growth',
  collector_only: 'alpha_activation',
  creator_contributor: 'launch',
};

/**
 * The universal ExperienceStage → the PRIMARY KNYT JourneyStage projection.
 * (`scale` projects to `first`, the primary linear expression; `zero` is a
 * KNYT-internal deepening of `first` that the cartridge decides, not the
 * universal spine.)
 */
export const JOURNEY_STAGE_FOR_EXPERIENCE: Record<ExperienceStage, JourneyStage> = {
  setup: 'prospect',
  alpha_activation: 'acolyte',
  launch: 'keta',
  growth: 'keji',
  scale: 'first',
};

/** The universal stage a KNYT journey stage projects from. */
export function experienceStageForJourney(journey: JourneyStage): ExperienceStage {
  return EXPERIENCE_STAGE_FOR_JOURNEY[journey] ?? 'setup';
}

/** The primary KNYT journey stage for a universal ExperienceStage. */
export function journeyStageForExperience(stage: ExperienceStage): JourneyStage {
  return JOURNEY_STAGE_FOR_EXPERIENCE[stage] ?? 'prospect';
}

/**
 * Canonical linear order of the universal stages — the single progression axis
 * every cartridge projection (KNYT included) shares. Cartridge-specific
 * deepenings (e.g. KNYT `first`→`zero`) are projections layered ON this order,
 * never a competing progression.
 */
export const UNIVERSAL_STAGE_ORDER: ExperienceStage[] = [
  'setup',
  'alpha_activation',
  'launch',
  'growth',
  'scale',
];

/** Numeric index of a universal stage on the canonical progression axis. */
export function universalStageIndex(stage: ExperienceStage): number {
  const i = UNIVERSAL_STAGE_ORDER.indexOf(stage);
  return i < 0 ? 0 : i;
}
