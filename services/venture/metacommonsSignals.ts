/**
 * metacommonsSignals — the seam where the metaCommons evaluates a VentureQube
 * and Standing calibrates confidence in its inputs.
 *
 * STATUS: deterministic stub. The metaCommons engine (PoWP aggregation, the
 * Commons field, PoTS learning) is constitutional-only today (see the
 * metaCommons Charter in Polity Core). This module produces deterministic,
 * explainable confidence scores from what the VentureQube already carries plus
 * the operator's Standing — so the Signal Evidence + Governance layers are
 * populated and the UI is real. When the engine ships, replace the body of
 * `evaluateVentureSignals` without changing its signature.
 *
 * Principle (Standing + Founder Office charters): Standing CALIBRATES
 * confidence; it never gates opportunity. A higher Standing signal raises the
 * confidence the venture's declared inputs are truthful — it does not decide
 * whether the venture is "allowed."
 */

import type {
  VentureQubeV1,
  VentureSignalEvidenceLayer,
  VentureGovernanceLayer,
} from '@/types/ventureQube';
import type { StandingForVenture } from './standingForVenture';

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** 0..1 multiplier from the reconciled Standing score (0..100). Floor 0.6 so
 *  no-Standing operators still get a real (uncalibrated) reading rather than
 *  zero; full Standing lifts confidence to its ceiling. Falls back to the
 *  bucket when the reconciled score is unavailable. */
function standingMultiplier(standing: StandingForVenture): number {
  const score = standing.score?.score;
  if (typeof score === 'number') return 0.6 + (Math.max(0, Math.min(100, score)) / 100) * 0.4;
  const bucket = standing.standing?.bucket ?? 0;
  return 0.6 + (Math.max(0, Math.min(4, bucket)) / 4) * 0.4; // 0.6 → 1.0
}

function completeness(parts: Array<unknown>): number {
  const filled = parts.filter((p) => {
    if (p == null) return false;
    if (typeof p === 'string') return p.trim().length > 0;
    if (Array.isArray(p)) return p.length > 0;
    return true;
  }).length;
  return parts.length === 0 ? 0 : filled / parts.length;
}

export interface VentureSignalEvaluation {
  signalEvidence: Pick<
    VentureSignalEvidenceLayer,
    'signalConfidence' | 'opportunityConfidence' | 'demandConfidence' | 'capabilityConfidence'
  >;
  governance: Pick<
    VentureGovernanceLayer,
    'standingConfidence' | 'proofOfWorkPotential' | 'ventureConfidence'
  >;
}

/**
 * Evaluate a VentureQube against (stubbed) metaCommons signals, calibrated by
 * the operator's Standing. Pure + deterministic.
 */
export function evaluateVentureSignals(
  vq: VentureQubeV1,
  standing: StandingForVenture,
): VentureSignalEvaluation {
  const mult = standingMultiplier(standing);

  // Demand — how well the customer + market picture is articulated.
  const demandBase = completeness([
    vq.thesis.problemStatement,
    vq.thesis.valueProposition,
    vq.archetypes,
    vq.thesis.marketTags,
  ]) * 100;

  // Capability — declared/available capability + verified facts + reputation.
  const verifiedCapabilityFacts =
    (standing.factsByDomain['professional']?.length ?? 0) +
    (standing.factsByDomain['founder']?.length ?? 0) +
    (standing.factsByDomain['extraordinary_ability']?.length ?? 0);
  const repEntrepreneurial = standing.reputation?.entrepreneurial ?? 0;
  const capabilityBase = clamp(
    completeness([vq.capability.availableCapabilities, vq.capability.requiredCapabilities]) * 60 +
      Math.min(25, verifiedCapabilityFacts * 5) +
      Math.min(15, repEntrepreneurial),
  );

  // Opportunity — thesis + intent + revenue articulation.
  const opportunityBase = completeness([
    vq.thesis.consequenceThesis,
    vq.intent.ventureIntents,
    vq.revenueArchitecture.engines,
    vq.thesis.mission,
  ]) * 100;

  // Signal — overall evidence density.
  const signalBase = completeness([
    vq.signalEvidence.items,
    vq.thesis.problemStatement,
    vq.archetypes,
    vq.capability.availableCapabilities,
    vq.revenueArchitecture.engines,
  ]) * 100;

  const demandConfidence = clamp(demandBase * mult);
  const capabilityConfidence = clamp(capabilityBase * mult);
  const opportunityConfidence = clamp(opportunityBase * mult);
  const signalConfidence = clamp(signalBase * mult);

  // Proof of Work Potential — estimate of latent capability before it is
  // applied. Standing + lifetime CVS + capability articulation.
  const lifetimeCvs = standing.reputation?.lifetimeCvs ?? 0;
  const standingOverall = standing.standing?.overall ?? 0;
  const powp = clamp(
    capabilityConfidence * 0.5 + Math.min(30, standingOverall) + Math.min(20, lifetimeCvs / 5),
  );

  // Standing confidence — prefer the reconciled veracity-led score.
  const standingScoreVal = standing.score?.score ?? 0;
  const standingConfidence = clamp(
    standingScoreVal > 0
      ? standingScoreVal
      : standingOverall > 0
        ? 40 + Math.min(60, standingOverall)
        : 0,
  );

  // Venture confidence — the headline governance roll-up.
  const ventureConfidence = clamp(
    demandConfidence * 0.3 +
      capabilityConfidence * 0.3 +
      opportunityConfidence * 0.25 +
      signalConfidence * 0.15,
  );

  return {
    signalEvidence: {
      signalConfidence,
      opportunityConfidence,
      demandConfidence,
      capabilityConfidence,
    },
    governance: {
      standingConfidence,
      proofOfWorkPotential: powp,
      ventureConfidence,
    },
  };
}
