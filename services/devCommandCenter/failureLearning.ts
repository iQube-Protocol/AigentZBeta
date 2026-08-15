/**
 * failureLearning — Homecoming III Phase 5: the failure-learning path.
 *
 *   failure → risk observation → recurrence/portability assessment →
 *   causal abstraction → candidate
 *
 * ── CANARY-05: failure does not equal invariant ────────────────────────────
 *
 * `recordRiskObservation` can ONLY ever produce a `RiskObservation` — a
 * shape with no `status` field on the invariant ladder (see
 * `types/devLoopLearning.ts` §2). There is no function in this module that
 * takes a single observation and returns a candidate. The ONLY path to a
 * candidate runs through `assessRecurrencePortability`, and even a portable
 * assessment yields a candidate at `DraftCandidateStage` — structurally
 * incapable of expressing anything above `'candidate'` — never
 * `'validated'`, `'ratified'`, or `'canonical'` (requirement 6).
 *
 * ── Reuse, not reimplementation ─────────────────────────────────────────────
 *
 * Recurrence matching reuses `claimKey()` from `bearingDiscovery.ts` — the
 * SAME normaliser that already decides whether two discovered conditions are
 * "the same claim" for convergence purposes. A second, independently-tuned
 * text-similarity function here would be exactly the parallel-implementation
 * defect the resolution-record registry's own `findDuplicateStatements`
 * exists to catch (inv.engineering.036/037).
 *
 * Portability mirrors `InvariantOccurrence`'s own discipline
 * (`types/resolutionRecords.ts`): a `cross-capability` claim requires
 * occurrences in more than one capability. Here, "more than one SITE" is the
 * same requirement restated for a risk observation rather than a resolution.
 */

import { claimKey } from '@/services/devCommandCenter/bearingDiscovery';
import type { CandidateInvariant } from '@/types/resolutionRecords';
import { CANDIDATE_INVARIANT_SCHEMA_VERSION } from '@/types/resolutionRecords';
import {
  RISK_OBSERVATION_SCHEMA_VERSION,
  type DraftCandidateStage,
  type RecurrencePortabilityAssessment,
  type RiskObservation,
} from '@/types/devLoopLearning';

// ---------------------------------------------------------------------------
// Step 1 — the observation. Always and only this shape.
// ---------------------------------------------------------------------------

export interface RecordRiskObservationInput {
  id: string;
  intentRef: string;
  sessionRef: string;
  site: string;
  description: string;
  initiatingCondition: string;
  adverseConsequence: string;
  relatedRiskVectorId?: string | null;
  evidenceRefs?: string[];
  now: string;
}

/**
 * Record a material failure. This is the WHOLE of what a failure earns by
 * being observed: a `RiskObservation`, nothing further. Whatever happens
 * next is a SEPARATE, later act (`assessRecurrencePortability`), never a
 * continuation this function performs itself.
 */
export function recordRiskObservation(input: RecordRiskObservationInput): RiskObservation {
  return {
    schemaVersion: RISK_OBSERVATION_SCHEMA_VERSION,
    id: input.id,
    intentRef: input.intentRef,
    sessionRef: input.sessionRef,
    site: input.site,
    description: input.description,
    initiatingCondition: input.initiatingCondition,
    adverseConsequence: input.adverseConsequence,
    relatedRiskVectorId: input.relatedRiskVectorId ?? null,
    evidenceRefs: input.evidenceRefs ?? [],
    observedAt: input.now,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — recurrence / portability. The gate, not a formality.
// ---------------------------------------------------------------------------

/** Normalised claim key for a risk observation — same claim-key function
 *  discovery uses, applied to the SAME causal-condition-shaped text
 *  (`adverseConsequence`), not a bespoke similarity metric. */
function observationClaimKey(o: RiskObservation): string {
  return claimKey(o.adverseConsequence);
}

/**
 * Assess whether an observation has recurred, and whether the recurrence is
 * portable — the same shape failing at a DIFFERENT site, not the same site
 * failing twice.
 *
 * `portable` requires recurrenceCount ≥ 2 AND distinctSites.length ≥ 2.
 * A single site failing three times is recurrenceCount 3 with
 * distinctSites.length 1 — NOT portable: it is a fragile site, which is a
 * fact about that site, not a general lesson.
 */
export function assessRecurrencePortability(
  observation: RiskObservation,
  priorObservations: readonly RiskObservation[],
  now: string,
): RecurrencePortabilityAssessment {
  const key = observationClaimKey(observation);
  const matching = priorObservations.filter((o) => observationClaimKey(o) === key);
  const all = [observation, ...matching];

  const distinctSites = [...new Set(all.map((o) => o.site))];
  const recurrenceCount = all.length;
  const portable = recurrenceCount >= 2 && distinctSites.length >= 2;

  const rationale = portable
    ? `Recurred ${recurrenceCount} times across ${distinctSites.length} distinct sites (${distinctSites.join(', ')}) — the same causal shape, not the same fragile site.`
    : recurrenceCount < 2
      ? 'Single occurrence — one failure is evidence of a risk, not of a pattern.'
      : `Recurred ${recurrenceCount} times but only at ${distinctSites.length} site(s) — a fragile site, not yet a portable lesson.`;

  return {
    observationId: observation.id,
    recurrenceCount,
    distinctSites,
    portable,
    rationale,
    assessedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Step 3 — causal abstraction. Only when the gate opened.
// ---------------------------------------------------------------------------

export interface AbstractCausalCandidateInput {
  candidateId: string;
  observation: RiskObservation;
  assessment: RecurrencePortabilityAssessment;
  /** The causal condition, stated as something that must remain true —
   *  never as a prohibition (the same discipline
   *  `CAUSAL_ABSTRACTION_CONTRACT` states for discovery). Caller-supplied:
   *  restating a failure as a causal condition is a reasoning act, and this
   *  module does not perform reasoning, the same purity boundary
   *  `bearingDiscovery.ts` draws around statement generation. */
  causalStatement: string;
  /** The resolution record id THIS occurrence is captured in — normally the
   *  learning receipt's own draft record, assembled alongside this
   *  candidate by `learningReceipt.ts`. */
  resolutionId: string;
  /** Earlier resolution records this candidate also derives from, where a
   *  prior occurrence of the same portable pattern was already captured. */
  priorResolutionIds?: string[];
}

/**
 * Abstract a candidate invariant from a portable recurrence — or refuse to.
 *
 * Returns `null` when `assessment.portable` is false. This is the ENTIRE
 * enforcement of CANARY-05 at this step: there is no override parameter, no
 * "force" flag, and no path that reaches a `CandidateInvariant` without
 * `portable` having been true first.
 *
 * The returned candidate's `status` is `DraftCandidateStage` —
 * structurally `'candidate'` only. `ratifiedSource` is always `null`:
 * nothing this function returns has been ratified, and nothing calling it
 * may set that field from its own judgement (CLAUDE.md: an agent message is
 * never operator consent).
 */
export function abstractCausalCandidate(input: AbstractCausalCandidateInput): CandidateInvariant | null {
  if (!input.assessment.portable) return null;

  const status: DraftCandidateStage = 'candidate';

  return {
    schemaVersion: CANDIDATE_INVARIANT_SCHEMA_VERSION,
    candidateId: input.candidateId,
    statement: input.causalStatement,
    family: 'engineering',
    governingPrinciple: false,
    parentCandidateId: null,
    projections: {
      targets: ['devon'],
      researchRequired: false,
      ratificationRequired: true,
      track: null,
    },
    classification: null,
    scope: input.assessment.distinctSites.length > 1 ? 'cross-capability' : 'local',
    status,
    canaries: [],
    occurrences: [
      {
        site: input.observation.site,
        defect: input.observation.description,
        resolutionId: input.resolutionId,
        evidence: input.observation.evidenceRefs,
      },
    ],
    derivedFrom: [input.resolutionId, ...(input.priorResolutionIds ?? [])],
    ratifiedSource: null,
    supersededBy: null,
    notes: [input.assessment.rationale],
  };
}
