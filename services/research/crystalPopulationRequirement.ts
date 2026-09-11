/**
 * §3.6-derived crystal population requirement — the executable form of the
 * FROZEN collection-size guard (EXP-P1 README §6, cited as "protocol §3.6").
 *
 * ── What this replaces, and why ────────────────────────────────────────────
 *
 * `crystalReadiness.ts`'s `selection-space` check gated on
 * `minMeaningfulSliceSize ?? 5` — "a slice of ≥5 is meaningful". That number
 * appears in no registered constraint. §6 had already ruled, with worked
 * arithmetic, that an 18-invariant collection (slice cap 7) was "plainly
 * insufficient to ground 24 tasks incl. 12 derivation items". A gate whose bar
 * is 5 therefore passed collections the frozen protocol had already rejected —
 * criterion drift against a frozen constraint, and the drift ran in the
 * permissive direction, which is the direction nobody notices.
 *
 * ── The operator's ruling on the arithmetic (2026-08-26, verbatim) ─────────
 *
 *   > "The implementation should derive the minimum crystal population from the
 *   >  frozen EXP-P1 collection-size guard, not from a new hard-coded target.
 *   >  The arithmetic should remain visible:
 *   >      required evaluation slice ÷ 0.40 = minimum collection size
 *   >  So if the task design needs 24 usable statements, the collection floor
 *   >  is 60; if the final task design needs a larger slice, the floor rises
 *   >  mechanically. No new magic number."
 *
 * The 0.40 divisor is the ONLY constant in this module, and it is the frozen
 * guard itself. Everything else is an input from the registered task design or
 * a quotient. If the finalized task set demands a larger slice, the floor rises
 * without a code change.
 *
 * ── Illustrative figures are NOT thresholds ───────────────────────────────
 *
 * The independent reviewer illustrated the same math as "realistically a 20–30
 * statement slice, so a 50–75 crystal". Those numbers are NOT encoded here and
 * must never be: they are one reading of the same constraints, offered as
 * direction. What is encoded is the derivation. That it lands inside both of
 * the reviewer's ranges is corroboration, not calibration.
 *
 * ── Fail to `unknown`, never to a default ─────────────────────────────────
 *
 * If a required input is unavailable, `derivable` is false and
 * `insufficientInputs` names what is missing. The consuming check then reports
 * insufficient-input and fails closed. It NEVER falls back to 5, or to any
 * other number — a silent fallback is how the original drift survived.
 *
 * Server-safe, pure, no I/O.
 */

import { minimumPremisesForTaskKind, type TaskDefinition } from '@/services/research/taskCoverage';

/**
 * THE FROZEN GUARD. EXP-P1 README §6, "Collection-size guard + enlargement
 * discipline (locked at freeze)": *"The fixed Arm C slice ⊆ 40% of Crystal
 * vP1 — a genuine subset, so Arm B's per-task live selection retains
 * discriminatory power…"*
 */
export const ARM_C_SLICE_FRACTION_OF_CRYSTAL = 0.4;

export const SLICE_GUARD_SOURCE_REF =
  'codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md §6 ' +
  '(Collection-size guard + enlargement discipline, locked at freeze)';

/**
 * The REGISTERED MINIMUM task design. Not a target and not this module's
 * invention — EXP-P1 README §5.2: *"Size and composition: minimum 24 tasks:
 * 12 recall … and 12 derivation …"*. Restated identically at
 * `app/api/journey/validation-programme/agent-package/route.ts` (the §5 section
 * fallback) and in EXP-011's README ("12 recall / 12 derivation minimum").
 *
 * A hand-maintained mirror of a markdown source needs a parity canary, per this
 * repo's source-of-truth rule — `tests/source-of-truth-parity.test.ts` reads the
 * README and fails the build if these numbers drift from it.
 */
export const REGISTERED_MINIMUM_TASK_DESIGN = {
  totalTasks: 24,
  recallTasks: 12,
  derivationTasks: 12,
  sourceRef:
    'codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md §5.2 ' +
    '(Task Set — size and composition, minimum)',
} as const;

/**
 * §6's own worked illustration, retained as a CROSS-CHECK on the derivation
 * rather than as an input to it: *"at the current 18-invariant collection the
 * ⊆40% guard caps the slice at 7 statements — plainly insufficient to ground 24
 * tasks incl. 12 derivation items"*. Any derivation that concluded a slice of 7
 * were sufficient would contradict the frozen protocol, so the derivation is
 * checked against this and the check is reported.
 */
const SECTION_6_INSUFFICIENT_ILLUSTRATION = { collectionSize: 18, sliceCap: 7 } as const;

export interface CrystalPopulationRequirement {
  /** False ⇒ every numeric field is null and the consumer must report unknown. */
  derivable: boolean;
  insufficientInputs: string[];
  /** The frozen ⊆40% guard. */
  sliceFractionOfCrystal: number;
  sliceGuardSourceRef: string;
  /** Whether the slice demand came from a finalized task set or the registered
   *  minimum design (in which case every figure is a FLOOR, not a target). */
  sliceDemandBasis: 'finalized-task-set' | 'registered-minimum-task-design';
  /** The numerator: usable grounding statements the fixed Arm C slice must hold. */
  requiredEvaluationSliceSize: number | null;
  /** requiredEvaluationSliceSize ÷ 0.40, rounded up. */
  minimumCollectionSize: number | null;
  /** Distinct multi-premise entailment chains the derivation tasks demand. */
  requiredEntailmentChains: number | null;
  /** Combinatorial floor on relationally-composable members inside the slice. */
  requiredRelationalMembersInSlice: number | null;
  /** The crystal-level fraction that must carry the slice requirement in
   *  expectation, because the slice is domain-procedure-selected, not
   *  task-selected (README §4). */
  requiredInferentialCapacityFraction: number | null;
  /** The arithmetic, one auditable line per step, each naming its source. */
  derivation: string[];
  /** Whether the derivation is consistent with §6's own worked illustration. */
  crossCheckAgainstSection6: string;
}

/** Smallest k with C(k,2) ≥ pairs — the distinct-premise-pair floor. */
function smallestPoolForDistinctPairs(pairs: number): number {
  let k = 2;
  while ((k * (k - 1)) / 2 < pairs) k += 1;
  return k;
}

export interface DeriveCrystalPopulationRequirementInput {
  /**
   * The FINALIZED task set, when one exists. Its distinct grounding demand is
   * the real numerator; supplying it makes the requirement rise or fall with
   * the actual design rather than with the registered floor.
   */
  tasks?: readonly TaskDefinition[];
}

/**
 * Derive the population requirement from the registered constraints.
 *
 * ── The derivation, in full ───────────────────────────────────────────────
 *
 * 1. Task design: 24 tasks minimum (12 recall + 12 derivation) — README §5.2.
 * 2. Premise demand per task: recall ≥1, derivation ≥2 — the primitive already
 *    encoded in `taskCoverage.ts::minimumPremisesForTaskKind` ("a derivation
 *    requires composing premises"), reused rather than restated.
 * 3. NON-DEGENERACY. §6 requires the slice to leave Arm B's live selection with
 *    discriminatory power ("else Arm C ≈ Arm B degenerately"), and §4's Blinding
 *    note classifies each task selection-neutral or selection-sensitive by
 *    MECHANICAL SET COMPARISON of B's selected slice against C's fixed slice.
 *    Two tasks whose grounding sets are identical are, for that classifier, one
 *    task repeated: they cannot land in different classes and add no
 *    discriminatory power. So each task needs its own usable grounding
 *    statement inside the fixed slice ⇒ required slice ≥ number of tasks.
 * 4. The ⊆40% guard (§6) ⇒ minimum collection size = required slice ÷ 0.40.
 * 5. Derivation-task entailment demand: one distinct multi-premise chain per
 *    derivation task ⇒ required chains = derivation-task count (§5.2, §6(d)).
 * 6. Relationally-composable floor: 12 distinct premise PAIRS need a pool of k
 *    with C(k,2) ≥ 12 ⇒ k ≥ 6.
 * 7. The fixed slice is built by the standard domain procedure applied to the
 *    DOMAIN, not to the tasks (README §4), so the crystal cannot be relied on
 *    to concentrate its relational members inside the slice; the crystal-level
 *    relational fraction must carry the requirement in expectation ⇒
 *    required fraction = required relational members ÷ required slice size.
 *
 * Step 3 is the only step that formalises rather than quotes, and it is
 * labelled as such in the emitted derivation lines so a reader can challenge
 * exactly that step.
 */
export function deriveCrystalPopulationRequirement(
  input: DeriveCrystalPopulationRequirementInput = {},
): CrystalPopulationRequirement {
  const derivation: string[] = [];
  const insufficientInputs: string[] = [];

  const base = {
    derivable: false,
    insufficientInputs,
    sliceFractionOfCrystal: ARM_C_SLICE_FRACTION_OF_CRYSTAL,
    sliceGuardSourceRef: SLICE_GUARD_SOURCE_REF,
    requiredEvaluationSliceSize: null,
    minimumCollectionSize: null,
    requiredEntailmentChains: null,
    requiredRelationalMembersInSlice: null,
    requiredInferentialCapacityFraction: null,
    derivation,
    crossCheckAgainstSection6: 'not computed',
  };

  const tasks = input.tasks;
  let sliceDemandBasis: CrystalPopulationRequirement['sliceDemandBasis'];
  let requiredEvaluationSliceSize: number;
  let derivationTaskCount: number;

  if (tasks && tasks.length > 0) {
    sliceDemandBasis = 'finalized-task-set';
    derivationTaskCount = tasks.filter((t) => t.kind === 'derivation').length;
    // The real numerator: the union of every task's grounding path. A task
    // citing nothing cannot be grounded at all and is counted as a missing
    // input rather than silently contributing zero.
    const ungrounded = tasks.filter(
      (t) => t.requiredInvariantIds.length < minimumPremisesForTaskKind(t.kind),
    );
    if (ungrounded.length > 0) {
      insufficientInputs.push(
        `${ungrounded.length} task(s) in the supplied task set cite fewer grounding invariants than their ` +
          `kind requires (${ungrounded.map((t) => t.id).slice(0, 5).join(', ')}${ungrounded.length > 5 ? ', …' : ''}) ` +
          `— the slice demand cannot be derived from an under-specified task set`,
      );
      return { ...base, sliceDemandBasis };
    }
    const union = new Set<string>();
    for (const t of tasks) for (const id of t.requiredInvariantIds) union.add(id);
    requiredEvaluationSliceSize = union.size;
    derivation.push(
      `task design: FINALIZED task set of ${tasks.length} task(s) (${derivationTaskCount} derivation) as supplied ` +
        `by the caller — not the registered minimum`,
    );
    derivation.push(
      `required evaluation slice = |union of every task's grounding path| = ${requiredEvaluationSliceSize} ` +
        `distinct invariant(s)`,
    );
  } else {
    sliceDemandBasis = 'registered-minimum-task-design';
    const design = REGISTERED_MINIMUM_TASK_DESIGN;
    derivationTaskCount = design.derivationTasks;
    requiredEvaluationSliceSize = design.totalTasks;
    derivation.push(
      `task design: ${design.totalTasks} tasks MINIMUM (${design.recallTasks} recall + ${design.derivationTasks} ` +
        `derivation) — ${design.sourceRef}. No finalized task set was supplied, so every figure below is a ` +
        `FLOOR derived from the registered minimum, never a target.`,
    );
    derivation.push(
      `premise demand per task: recall ≥ ${minimumPremisesForTaskKind('recall')}, derivation ≥ ` +
        `${minimumPremisesForTaskKind('derivation')} — services/research/taskCoverage.ts::` +
        `minimumPremisesForTaskKind ("a derivation requires composing premises"), reused not restated`,
    );
    derivation.push(
      `NON-DEGENERACY (the one formalising step — challenge this one): §6 requires the fixed slice to leave ` +
        `Arm B's live selection with discriminatory power ("else Arm C ≈ Arm B degenerately"), and §4's ` +
        `Blinding note classifies each task selection-neutral/selection-sensitive by MECHANICAL SET ` +
        `COMPARISON of B's selected slice against C's fixed slice. Two tasks with identical grounding sets ` +
        `are one task repeated for that classifier. So each task needs its own usable grounding statement ` +
        `inside the fixed slice ⇒ required evaluation slice ≥ ${design.totalTasks}.`,
    );
  }

  if (requiredEvaluationSliceSize <= 0) {
    insufficientInputs.push('the derived evaluation-slice demand is zero — nothing to ground');
    return { ...base, sliceDemandBasis };
  }

  const minimumCollectionSize = Math.ceil(requiredEvaluationSliceSize / ARM_C_SLICE_FRACTION_OF_CRYSTAL);
  derivation.push(
    `⊆${(ARM_C_SLICE_FRACTION_OF_CRYSTAL * 100).toFixed(0)}% collection-size guard — ${SLICE_GUARD_SOURCE_REF} ⇒ ` +
      `minimum collection size = required evaluation slice ÷ ${ARM_C_SLICE_FRACTION_OF_CRYSTAL.toFixed(2)} = ` +
      `${requiredEvaluationSliceSize} ÷ ${ARM_C_SLICE_FRACTION_OF_CRYSTAL.toFixed(2)} = ${minimumCollectionSize}`,
  );

  const requiredEntailmentChains = derivationTaskCount;
  derivation.push(
    `derivation-task entailment demand: one distinct multi-premise chain per derivation task ⇒ ` +
      `${requiredEntailmentChains} chain(s) whose conjunctions entail unstated conclusions (README §5.2 + §6(d))`,
  );

  const requiredRelationalMembersInSlice =
    requiredEntailmentChains > 0 ? smallestPoolForDistinctPairs(requiredEntailmentChains) : 0;
  derivation.push(
    `relationally-composable floor: ${requiredEntailmentChains} DISTINCT premise pairs need a pool of k with ` +
      `C(k,2) ≥ ${requiredEntailmentChains} ⇒ k ≥ ${requiredRelationalMembersInSlice} relationally-structured ` +
      `member(s) inside the slice (combinatorial floor, not a chosen number)`,
  );

  const requiredInferentialCapacityFraction =
    requiredRelationalMembersInSlice / requiredEvaluationSliceSize;
  derivation.push(
    `the fixed slice is constructed by the standard domain procedure applied to the DOMAIN, not to the tasks ` +
      `(README §4), so the crystal cannot be relied on to concentrate its relational members inside the slice; ` +
      `the crystal-level fraction must carry the requirement in expectation ⇒ ` +
      `${requiredRelationalMembersInSlice} ÷ ${requiredEvaluationSliceSize} = ` +
      `${requiredInferentialCapacityFraction.toFixed(3)}`,
  );

  const section6SliceCap = Math.floor(
    SECTION_6_INSUFFICIENT_ILLUSTRATION.collectionSize * ARM_C_SLICE_FRACTION_OF_CRYSTAL,
  );
  const crossCheckAgainstSection6 =
    section6SliceCap < requiredEvaluationSliceSize
      ? `CONSISTENT with §6's own worked illustration: at ${SECTION_6_INSUFFICIENT_ILLUSTRATION.collectionSize} ` +
        `invariants the guard caps the slice at ${section6SliceCap}, which §6 calls "plainly insufficient to ` +
        `ground 24 tasks incl. 12 derivation items" — and ${section6SliceCap} < ${requiredEvaluationSliceSize}, ` +
        `so this derivation also rejects it.`
      : `CONTRADICTS §6's own worked illustration: this derivation would accept a slice of ${section6SliceCap} ` +
        `(the cap at ${SECTION_6_INSUFFICIENT_ILLUSTRATION.collectionSize} invariants), which §6 explicitly ` +
        `calls "plainly insufficient". A derivation that contradicts the frozen protocol is wrong; do not ` +
        `use this requirement until it is reconciled.`;

  return {
    derivable: true,
    insufficientInputs,
    sliceFractionOfCrystal: ARM_C_SLICE_FRACTION_OF_CRYSTAL,
    sliceGuardSourceRef: SLICE_GUARD_SOURCE_REF,
    sliceDemandBasis,
    requiredEvaluationSliceSize,
    minimumCollectionSize,
    requiredEntailmentChains,
    requiredRelationalMembersInSlice,
    requiredInferentialCapacityFraction,
    derivation,
    crossCheckAgainstSection6,
  };
}
