/**
 * Stage 9 duplicate-pair adjudication — server-derived survivor
 * recommendation (operator ruling, 2026-08-27, "final corrections" pass on
 * the Crystal v2 duplicate-adjudication queue).
 *
 * Pure and deterministic: the same two records and the same edge counts
 * always produce the same recommendation, so a receipt built from this
 * function's output can always be re-derived and audited independently of
 * when it ran.
 *
 * ── Why this does NOT rank by `PROVENANCE_CLASSES` order ───────────────────
 *
 * `PROVENANCE_CLASSES` (`services/corpusScout/types.ts`) is documented as an
 * ENUMERATION of the evidence-provenance vocabulary, not a declared strength
 * order — its own doc comment is explicit that `platform-doctrine` is "not a
 * weaker form of evidence; it is evidence offered for a different purpose."
 * Treating its array position as a ranking would assert a constitutional
 * ordering the ratifying text refuses to assert. The only provenance
 * distinction this resolver is entitled to make is the one Crystal itself
 * already draws and enforces elsewhere: `inPrimaryPopulation` — eligible
 * external evidence (Population A: `external-established` /
 * `external-empirical`) versus everything else.
 *
 * ── The criterion order (operator ruling, 2026-08-27) ───────────────────────
 *
 *   1. external-provenance-eligibility — `inPrimaryPopulation`, established.
 *   2. lifecycle-status — `InvariantRecord.status` rank (canonical > validated
 *      > proposed > draft; the terminal statuses cannot appear here because
 *      `runCrystalReadinessReport` only feeds `validated`/`canonical` rows
 *      into duplicate detection, but the rank is total for defensiveness).
 *   3. standing — `InvariantRecord.standing`, CFS-001 §6 / Law XII validation
 *      confidence (never adoption — `reach` is a different, orthogonal field
 *      and is deliberately not used here).
 *   4. live-relationship-count — graph degree (`listEdgesForInvariants`,
 *      both directions), supplied by the caller so this module stays a pure
 *      function with no DB access of its own.
 *   5. ratified-source — `InvariantRecord.ratifiedSource !== null`.
 *   6. deterministic-tiebreak — lexically lower id, LOW confidence, with an
 *      explicit statement that the candidates are equivalent on available
 *      evidence. Never a `hold-for-review` outcome: no existing rule in this
 *      model requires withholding a recommendation, only labelling it low
 *      confidence when the evidence does not distinguish the pair.
 */

import type { InvariantRecord, InvariantStatus } from '@/types/invariants';
import { inPrimaryPopulation } from '@/services/research/experimentalPopulations';

export type DuplicateRecommendationConfidence = 'high' | 'medium' | 'low';

export type DuplicateRecommendationCriterion =
  | 'external-provenance-eligibility'
  | 'lifecycle-status'
  | 'standing'
  | 'live-relationship-count'
  | 'ratified-source'
  | 'deterministic-tiebreak';

export interface DuplicateRecommendationReason {
  criterion: DuplicateRecommendationCriterion;
  detail: string;
}

export interface DuplicateSurvivalRecommendation {
  recommendedId: string;
  otherId: string;
  confidence: DuplicateRecommendationConfidence;
  /** The full criterion-by-criterion trail walked to reach this
   *  recommendation, in evaluation order, ending with the entry that
   *  decided it. Criteria after the deciding one are never evaluated and
   *  never appear — this is an honest record of what was actually checked,
   *  not a claim about criteria that were never reached. */
  reasons: DuplicateRecommendationReason[];
}

/** Total rank over every `InvariantStatus`, even though only `validated` and
 *  `canonical` rows can reach this resolver today (the readiness engine's
 *  own filter). Terminal statuses rank lowest defensively; they carry no
 *  claim about relative merit, since they cannot occur here. */
const LIFECYCLE_RANK: Record<InvariantStatus, number> = {
  canonical: 3,
  validated: 2,
  proposed: 1,
  draft: 0,
  rejected: -1,
  deprecated: -1,
  superseded: -1,
};

const CONFIDENCE_BY_CRITERION: Record<DuplicateRecommendationCriterion, DuplicateRecommendationConfidence> = {
  'external-provenance-eligibility': 'high',
  'lifecycle-status': 'high',
  standing: 'medium',
  'live-relationship-count': 'medium',
  'ratified-source': 'medium',
  'deterministic-tiebreak': 'low',
};

interface CriterionComparison {
  criterion: DuplicateRecommendationCriterion;
  aWins: boolean;
  bWins: boolean;
  detail: string;
}

function buildComparisons(
  a: InvariantRecord,
  b: InvariantRecord,
  edgeCounts: { a: number; b: number },
): CriterionComparison[] {
  const aEligible = inPrimaryPopulation(a.provenance);
  const bEligible = inPrimaryPopulation(b.provenance);
  const aRank = LIFECYCLE_RANK[a.status] ?? -1;
  const bRank = LIFECYCLE_RANK[b.status] ?? -1;
  const aRatified = a.ratifiedSource !== null;
  const bRatified = b.ratifiedSource !== null;

  return [
    {
      criterion: 'external-provenance-eligibility',
      aWins: aEligible && !bEligible,
      bWins: bEligible && !aEligible,
      detail: `Population A (external-established/external-empirical) eligibility — ${a.id}=${aEligible}, ${b.id}=${bEligible}`,
    },
    {
      criterion: 'lifecycle-status',
      aWins: aRank > bRank,
      bWins: bRank > aRank,
      detail: `lifecycle status — ${a.id}=${a.status}, ${b.id}=${b.status}`,
    },
    {
      criterion: 'standing',
      aWins: a.standing > b.standing,
      bWins: b.standing > a.standing,
      detail: `standing (validation confidence) — ${a.id}=${a.standing}, ${b.id}=${b.standing}`,
    },
    {
      criterion: 'live-relationship-count',
      aWins: edgeCounts.a > edgeCounts.b,
      bWins: edgeCounts.b > edgeCounts.a,
      detail: `live relationship (edge) count — ${a.id}=${edgeCounts.a}, ${b.id}=${edgeCounts.b}`,
    },
    {
      criterion: 'ratified-source',
      aWins: aRatified && !bRatified,
      bWins: bRatified && !aRatified,
      detail: `ratifiedSource presence — ${a.id}=${aRatified ? 'present' : 'absent'}, ${b.id}=${bRatified ? 'present' : 'absent'}`,
    },
  ];
}

/**
 * Recommends which of two near-duplicate invariants should survive a merge.
 * `edgeCounts` is the caller-supplied live relationship count for each side
 * (both directions) — this module never queries the invariant store itself,
 * so it stays trivially testable and cannot silently drift from whatever
 * edge set the caller chose to count.
 */
export function recommendDuplicateSurvivor(
  a: InvariantRecord,
  b: InvariantRecord,
  edgeCounts: { a: number; b: number },
): DuplicateSurvivalRecommendation {
  const reasons: DuplicateRecommendationReason[] = [];

  for (const comparison of buildComparisons(a, b, edgeCounts)) {
    if (comparison.aWins === comparison.bWins) continue; // no distinction — not evaluated as a reason
    reasons.push({ criterion: comparison.criterion, detail: comparison.detail });
    return {
      recommendedId: comparison.aWins ? a.id : b.id,
      otherId: comparison.aWins ? b.id : a.id,
      confidence: CONFIDENCE_BY_CRITERION[comparison.criterion],
      reasons,
    };
  }

  // Every criterion was checked and none distinguished the pair. This is a
  // real finding, not a resolver failure: recommend the lexically lower id
  // purely for determinism, at LOW confidence, and say so plainly.
  const aWinsTie = a.id < b.id;
  reasons.push({
    criterion: 'deterministic-tiebreak',
    detail:
      `${a.id} and ${b.id} are equivalent on every available criterion (provenance eligibility, lifecycle ` +
      `status, standing, live relationship count, ratified-source presence). Recommending the lexically lower ` +
      `id (${aWinsTie ? a.id : b.id}) only for a stable, reproducible default — this is not a claim that either ` +
      `candidate is more correct or more authoritative than the other.`,
  });
  return {
    recommendedId: aWinsTie ? a.id : b.id,
    otherId: aWinsTie ? b.id : a.id,
    confidence: 'low',
    reasons,
  };
}
