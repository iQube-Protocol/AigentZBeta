/**
 * Experiment-relative independence — the SECOND classification the 2026-07-28
 * ruling requires, and the one that did not previously exist.
 *
 * ── The ruling ──────────────────────────────────────────────────────────────
 *
 * > "Internal provenance is not a blanket exclusion criterion, because the
 * > constitutional corpus itself is substantially derived from internal
 * > doctrine. […] The governing rule is: **exclude self-reference, not internal
 * > knowledge.**"
 *
 * The demarcation is therefore NOT `external = admissible / internal =
 * inadmissible`. It is:
 *
 *     independent of the experimental target
 *   vs
 *     derived from, tailored to, or contaminated by the experimental target
 *
 * ── Why this is a NEW module and not a widened old one ──────────────────────
 *
 * The ruling names two classifications. Only ONE of them is new.
 *
 *   "source provenance"  — external-normative / external-empirical /
 *                          internal-constitutional / internal-operational /
 *                          experimental-derived / observational-derived /
 *                          synthetic
 *
 * That axis ALREADY EXISTS as `ProvenanceClass` (services/corpusScout/types.ts)
 * with five values, ratified 2026-07-27, canary-enforced, and carried on every
 * record. Minting a second seven-value vocabulary for the same question is the
 * `inv.engineering.037` parallel-implementation defect — the exact class
 * CLAUDE.md's source-of-truth-parity rule exists to prevent. So this module
 * does NOT redefine source provenance. `SOURCE_PROVENANCE_SYNONYM` below
 * records the ruling's names against the shipped vocabulary so the two
 * spellings never drift into two systems.
 *
 *   "experiment-relative relationship" — independent / domain-adjacent /
 *                          target-derived / task-derived / outcome-informed /
 *                          unknown
 *
 * THAT is genuinely new. Nothing in the codebase expressed how an invariant
 * relates to the experiment it is about to be used in. It is a property of the
 * PAIR (invariant, experiment) — the same invariant is `independent` of one
 * experiment and `target-derived` for another — which is why it can never be a
 * column on the invariant and never collapses into source provenance.
 *
 * ── Why it is computed per experiment and never stored on the record ────────
 *
 * Same reasoning as `experimentalPopulation`: a stored relation would be a
 * second source of truth that goes stale the moment a different experiment
 * asks. The relation is an input to a FREEZE, recorded in that freeze's
 * manifest with its reason — not a field that follows the invariant around.
 */

import type { ProvenanceClass } from '@/services/corpusScout/types';
import type { InvariantNamespace } from '@/types/invariants';

// ── The new axis ────────────────────────────────────────────────────────────

/**
 * How an invariant relates to ONE experiment's target, tasks and outcomes.
 *
 * `unknown` is a first-class member rather than an omission: an unreviewed
 * invariant must be *sayable* as unreviewed. It fails closed (see
 * {@link isConfirmatoryEligible}) — the same discipline as an unclassified
 * evidence provenance being admitted to no population.
 */
export type ExperimentRelation =
  | 'independent'
  | 'domain-adjacent'
  | 'target-derived'
  | 'task-derived'
  | 'outcome-informed'
  | 'unknown';

export const EXPERIMENT_RELATIONS: readonly ExperimentRelation[] = [
  'independent', 'domain-adjacent', 'target-derived', 'task-derived',
  'outcome-informed', 'unknown',
];

export function isExperimentRelation(v: unknown): v is ExperimentRelation {
  return typeof v === 'string' && (EXPERIMENT_RELATIONS as readonly string[]).includes(v);
}

/**
 * The relations that DISQUALIFY an invariant from a confirmatory freeze, each
 * with the loop it would close. Named as data so an eligibility decision can
 * report *why* rather than only *no*.
 */
export const CONTAMINATING_RELATIONS: Record<
  Exclude<ExperimentRelation, 'independent' | 'domain-adjacent'>,
  string
> = {
  'target-derived':
    'derived from the system under evaluation — using it to test that system is circular',
  'task-derived':
    'derived from the task set or its expected answers — measures recall of the key, not capability',
  'outcome-informed':
    'authored or revised after observing pilot outcomes — the interpretation moved after the result',
  unknown:
    'not yet reviewed for independence — fails closed until a reviewer classifies it',
};

/**
 * Confirmatory eligibility. The single gate.
 *
 * Note what is NOT here: source provenance. An `internal-constitutional`
 * invariant that predates the experiment is eligible; an `external-normative`
 * one selected after seeing the tasks is not. External origin does not make
 * something clean and internal origin does not make it contaminated.
 */
export function isConfirmatoryEligible(relation: ExperimentRelation): boolean {
  return relation === 'independent' || relation === 'domain-adjacent';
}

export function ineligibilityReason(relation: ExperimentRelation): string | null {
  return isConfirmatoryEligible(relation)
    ? null
    : CONTAMINATING_RELATIONS[relation as keyof typeof CONTAMINATING_RELATIONS];
}

// ── Provenance strata (the ruling's C / D / I / T) ──────────────────────────

/**
 * The freeze manifest's reporting partition, so a result can distinguish what
 * general constitutional doctrine contributed from what external domain
 * material contributed — instead of blending them and calling the mixture
 * evidence.
 *
 *   C — general constitutional invariants
 *   D — external domain invariants
 *   I — internal domain invariants, independent of the target
 *   T — target-derived; excluded from confirmatory use, retained in the corpus
 */
export type ProvenanceStratum = 'C' | 'D' | 'I' | 'T';

export const PROVENANCE_STRATA: readonly ProvenanceStratum[] = ['C', 'D', 'I', 'T'];

export const STRATUM_LABEL: Record<ProvenanceStratum, string> = {
  C: 'General constitutional',
  D: 'External domain',
  I: 'Internal domain, target-independent',
  T: 'Target-derived (excluded from confirmatory use)',
};

/**
 * Namespaces that carry GENERAL constitutional doctrine rather than a specific
 * application domain. The C/I split is a question about generality, which the
 * namespace already answers — so it is read, not re-asserted.
 *
 * A namespace absent from this set is a domain namespace (finance,
 * commercialisation, …) and lands in D or I depending on where its EVIDENCE
 * came from.
 */
export const GENERAL_CONSTITUTIONAL_NAMESPACES: ReadonlySet<string> = new Set([
  'constitutional', 'reasoning', 'epistemology', 'polity', 'sovereignty',
  'cybernetics', 'engineering', 'representation', 'interaction', 'capability',
]);

const EXTERNAL_EVIDENCE: ReadonlySet<ProvenanceClass> = new Set<ProvenanceClass>([
  'external-established', 'external-empirical',
]);

/**
 * Stratum is COMPUTED from (relation × evidence provenance × namespace).
 *
 * Order matters and is the ruling's own: contamination is checked FIRST, so a
 * target-derived invariant lands in T no matter how impeccable its source. A
 * clean origin cannot launder a self-referential relationship.
 */
export function provenanceStratum(input: {
  relation: ExperimentRelation;
  evidenceProvenance: ProvenanceClass | null;
  namespace: InvariantNamespace | string;
}): ProvenanceStratum {
  if (!isConfirmatoryEligible(input.relation)) return 'T';
  if (GENERAL_CONSTITUTIONAL_NAMESPACES.has(String(input.namespace))) return 'C';
  return input.evidenceProvenance !== null && EXTERNAL_EVIDENCE.has(input.evidenceProvenance)
    ? 'D'
    : 'I';
}

// ── The ruling's source-provenance names, mapped to the shipped vocabulary ──

/**
 * The 2026-07-28 ruling lists source-provenance values in its own words. They
 * are the SAME axis as `ProvenanceClass`, so this records the correspondence
 * rather than minting a parallel type. Two entries are deliberately `null`:
 * they name distinctions the shipped vocabulary does not yet draw, and writing
 * a false equivalence would be worse than recording the gap.
 */
export const SOURCE_PROVENANCE_SYNONYM: Record<string, ProvenanceClass | null> = {
  'external-normative': 'external-established',
  'external-empirical': 'external-empirical',
  'internal-constitutional': 'platform-doctrine',
  'internal-operational': 'platform-derived',
  'experimental-derived': 'platform-hypothesized',
  // No shipped equivalent. Both would need a sixth/seventh ProvenanceClass and
  // a decision about which experimental population they induce — a ratification,
  // not an inference, so they stay unmapped and visible.
  'observational-derived': null,
  synthetic: null,
};

// ── The eligibility decision, as a recordable object ────────────────────────

export interface EligibilityDecision {
  invariantId: string;
  eligible: boolean;
  relation: ExperimentRelation;
  stratum: ProvenanceStratum;
  evidenceProvenance: ProvenanceClass | null;
  namespace: string;
  /** Present only when `eligible` is false. */
  reason: string | null;
}

/**
 * Decide one invariant's place in one experiment's freeze.
 *
 * Every call produces a decision object whether it admits or excludes, because
 * the ruling requires the manifest to record *both*: "record every inclusion
 * and exclusion decision […] including its reason and provenance stratum."
 * An exclusion that leaves no trace is indistinguishable from an invariant
 * nobody considered.
 */
export function decideEligibility(input: {
  invariantId: string;
  relation: ExperimentRelation;
  evidenceProvenance: ProvenanceClass | null;
  namespace: InvariantNamespace | string;
}): EligibilityDecision {
  const stratum = provenanceStratum(input);
  const eligible = isConfirmatoryEligible(input.relation);
  return {
    invariantId: input.invariantId,
    eligible,
    relation: input.relation,
    stratum,
    evidenceProvenance: input.evidenceProvenance,
    namespace: String(input.namespace),
    reason: ineligibilityReason(input.relation),
  };
}

// ── Selection mode — experiment-scoped, never a mutated runtime default ─────

/**
 * How an arm draws from the frozen population.
 *
 * THE CORRECTED RULE (2026-07-28, superseding "disable standing-primary
 * suppression for P1", which was too broad):
 *
 *   > **Standing must not determine corpus ELIGIBILITY. It may remain part of
 *   > an experimental arm's declared retrieval treatment.**
 *
 * Arm B is defined as IRL's complete live runtime, so stripping its
 * standing-weighted ranking would destroy the ecological validity the arm
 * exists to provide. The asymmetry is removed instead by fixing the
 * POPULATION: both arms draw from the same frozen eligible set, Arm B ranks
 * within it, Arm C takes its pre-registered fixed slice from it. Arm C's
 * denominator can then no longer be enlarged by members Arm B cannot reach.
 *
 * `runtime-standing` is therefore NOT a defect to be removed — it is a
 * declared treatment, recorded as such in the protocol.
 *
 * The mode is always passed EXPLICITLY. No environment-variable switching: a
 * selection rule that changes with ambient configuration is unreproducible,
 * and reproducibility is the whole point of a frozen protocol.
 */
export type InvariantSelectionMode =
  /** Live product behaviour: standing-primary ranking. Arm B's treatment. */
  | 'runtime-standing'
  /** Every eligible member reachable; no standing-derived suppression. */
  | 'experiment-fixed-population'
  /** Draws per provenance stratum by a pre-declared procedure. */
  | 'experiment-stratified';

export const INVARIANT_SELECTION_MODES: readonly InvariantSelectionMode[] = [
  'runtime-standing', 'experiment-fixed-population', 'experiment-stratified',
];

/**
 * Whether a mode lets Standing affect what is REACHABLE.
 *
 * Legal in an arm's treatment, never legal as an eligibility gate — which is
 * why this reports the fact rather than forbidding the mode.
 */
export function standingAffectsReachability(mode: InvariantSelectionMode): boolean {
  return mode === 'runtime-standing';
}

/**
 * The one thing no mode may do. Kept as an explicit predicate so the rule is
 * assertable rather than merely documented: eligibility is decided by
 * {@link decideEligibility} — domain boundary × experiment-relative
 * independence — and Standing is not an input to it in any mode.
 */
export function standingMayGateEligibility(_mode: InvariantSelectionMode): false {
  return false;
}
