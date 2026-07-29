/**
 * EXP-P1 crystal admissibility — the FIRST template instance of IRL-REVIEW-001.
 *
 * Everything experiment-specific lives here and nowhere else: the target
 * statement, what the target is not, the namespace boundary, the ratified Class
 * C block ruling, the scrutiny vocabulary, the chronology and the pinned
 * reviewer pair. The generic layer one directory up carries none of it, and a
 * canary greps that directory to keep the separation honest — because a
 * capability that quietly hardcodes its first caller is a capability with
 * exactly one caller forever.
 *
 * Sources: `codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md`
 * (the general contract) and `codexes/packs/agentiq/updates/2026-07-29_external-review-rulings.md`
 * (the EXP-P1 rulings), plus the operator rulings of 2026-07-29 recorded verbatim below.
 */

import { INVARIANT_NAMESPACES } from '@/types/invariants';
import type { BlockDecisionRuling, BlockExceptionRule, ReviewSubjectRecord } from '../types';
import {
  createdOrRevisedOnOrAfter,
  mentionsAnyTerm,
  unresolvedChronologyOrProvenance,
  flaggedBySampleReview,
} from '../blockDecision';
import type { ReviewerPairSpec } from '../reviewerIndependence';

export const EXP_P1_REVIEW_TEMPLATE_ID = 'template.exp-p1.crystal-admissibility';
export const EXP_P1_TEMPLATE_VERSION = '1.0.0';

// ── The target ──────────────────────────────────────────────────────────────

/**
 * REQUIRED by `buildReviewPackage`, and previously implicit in a triage script's
 * keyword array — which meant the thing every decision turned on existed only
 * as a side effect of a list of strings. It is now an explicit, hashed field.
 */
export const EXP_P1_TARGET_STATEMENT =
  'The target of EXP-P1 is the IRL invariant representation and retrieval/runtime pipeline: how ' +
  'invariants are represented, selected, retrieved, compressed and applied at runtime, and the ' +
  'behaviour and defects of that pipeline. A statement is dependent on the target when it was ' +
  'derived from that pipeline, from the EXP-P1 task set or its expected answers, or from observed ' +
  'EXP-P1 or pilot outcomes.';

/**
 * What the target is NOT. Finance is a test DOMAIN, so finance material is
 * suspect only when target- or task-contaminated — never merely for being about
 * financial services.
 */
export const EXP_P1_NON_TARGETS: readonly string[] = [
  'MoneyPenny — an application agent, not the pipeline under evaluation',
  'The Financial Services Runtime — a test domain, not the target',
  'Marketa — an unrelated application surface',
  'VL-CT-001 — a separate venture experiment',
  'CryptoSent / QriptoCENT — a settlement substrate, not the pipeline under evaluation',
  'Finance as a subject matter — finance is a test DOMAIN; domain relevance is not contamination',
];

export const EXP_P1_CHRONOLOGY: readonly string[] = [
  'The general constitutional and reasoning corpus predates the EXP-P1 apparatus.',
  'Work on the VL-CT-001 pilot and the EXP-P1 apparatus began 2026-07-27.',
  'A bulk classification run created the commercialisation namespace population on 2026-07-28.',
  'Task construction for EXP-P1 had NOT begun at the time this package was built. Nothing in this ' +
    'package can therefore have been derived from an EXP-P1 task or its expected answer, and a ' +
    'reviewer should not infer such derivation without evidence.',
];

/** The date from which authorship may be outcome-informed. */
export const EXP_P1_SCRUTINY_CUTOFF = '2026-07-27';

/**
 * Vocabulary that makes a row worth INDIVIDUAL scrutiny. Matching one does not
 * exclude the row — it withholds the block presumption and sends it to a
 * reviewer.
 *
 * Two groups, and the second is the important one: products that are not the
 * target but whose own doctrine could self-refer, and THE TARGET ITSELF.
 */
export const EXP_P1_TARGET_VOCABULARY: readonly string[] = [
  // Target-specific runtimes that are not the target.
  'moneypenny', 'cryptosent', 'qriptocent', 'marketa', 'financial services runtime',
  'vl-ct-001', 'bitcent',
  // The target.
  'invariant selection', 'invariant retrieval', 'invariant slice', 'invariant compression',
  'grounding', 'crystal', 'exp-p1', 'representation runtime', 'retrieval pipeline',
];

// ── Namespace boundary (operator ruling, 2026-07-29) ────────────────────────

/**
 * RULED: `style` and `narrative` are EXCLUDED from the confirmatory vP1
 * population.
 *
 *   > "The gauntlet is reasoning and invariant application — not stylistic
 *   > quality or narrative composition. Including those rows would make the
 *   > boundary effectively universal and introduce constructs measured by
 *   > different outcome measures."
 *
 * Excluded for CONSTRUCT CLARITY, not for lack of value: both namespaces stay
 * in the Live Invariant Corpus and may support a later representation-quality,
 * artifact-generation, narrative-coherence or exploratory experiment.
 *
 * Note what this ruling does to the boundary itself. Before it, the declared
 * boundary excluded nothing — every namespace in the corpus was inside it, so
 * the boundary was inert and the manifest's "outside the boundary" count was
 * structurally zero. It now does work, which means its exclusions are decisions
 * and are recorded as such.
 */
export const EXP_P1_BOUNDARY_EXCLUSIONS: Readonly<Record<string, string>> = {
  style:
    'excluded for construct clarity — stylistic quality is measured by different outcome measures ' +
    'than invariant reasoning; retained in the Live Invariant Corpus for a later ' +
    'representation-quality experiment',
  narrative:
    'excluded for construct clarity — narrative composition is measured by different outcome ' +
    'measures than invariant reasoning; retained in the Live Invariant Corpus for a later ' +
    'narrative-coherence experiment',
};

/**
 * The boundary, DERIVED from the canonical namespace list minus the ruled
 * exclusions — never a hand-copied list. A hand-copied boundary goes stale the
 * moment a namespace is added, and the staleness is invisible: the new
 * namespace simply never appears in any experiment.
 */
export const EXP_P1_NAMESPACE_BOUNDARY: readonly string[] = INVARIANT_NAMESPACES.filter(
  (ns) => !(ns in EXP_P1_BOUNDARY_EXCLUSIONS),
)
  .slice()
  .sort();

/**
 * A task specification that explicitly measures style or narrative reasoning
 * requires a PREREGISTERED boundary amendment before freezing — never an
 * informal inclusion afterward.
 */
export const EXP_P1_BOUNDARY_AMENDMENT_RULE =
  'If the final EXP-P1 task specification includes style or narrative reasoning as measured ' +
  'constructs, the boundary must be amended by preregistration BEFORE the freeze. Informal ' +
  'inclusion after task construction is refused.';

// ── The Class C block ruling (operator-ratified 2026-07-29, verbatim) ───────

export const CLASS_C_BLOCK_RULING: BlockDecisionRuling = {
  rulingId: 'ruling.exp-p1.class-c-block',
  rulingVersion: '1.0.0',
  // VERBATIM. A paraphrase of a ratified ruling is not the ratified ruling, and
  // the reviewer is being asked to review THIS text.
  text:
    'The Class C population is presumptively independent of EXP-P1 because it consists of ' +
    'pre-existing general constitutional and reasoning doctrine, while EXP-P1’s target is the ' +
    'IRL representation and retrieval/runtime pipeline. Class C invariants may therefore enter the ' +
    'experiment-relative admissibility review through a single governed block decision, except ' +
    'where a row is flagged as target-derived, task-derived, outcome-informed, materially revised ' +
    'after the relevant cutoff, or insufficiently evidenced.',
  authority: 'operator-ratified',
  ratifiedAt: '2026-07-29',
};

/**
 * The exception rules that make the block ruling a decision rather than an
 * assertion. Each corresponds to a clause the ruling names.
 *
 * A note on where the exceptions are expected to be found: a substantial part
 * of the `engineering` doctrine in this corpus was derived from observed
 * defects in our own pipeline — which IS the target. Those rows are the
 * likeliest exceptions in the whole population, and they are unremarkable to
 * look at. `mentionsAnyTerm` catches the ones that name the pipeline;
 * `unresolvedChronologyOrProvenance` catches the ones that cannot show where
 * they came from; and the per-namespace representative sample guarantees a
 * human sees engineering rows regardless of how small that namespace is
 * relative to the whole. A proportional sample of a 402-row population would
 * have returned mostly the innocuous majority.
 */
export function expP1ClassCExceptionRules(flaggedBySample: readonly string[] = []): BlockExceptionRule[] {
  return [
    mentionsAnyTerm(
      'mentions-experiment-or-target',
      'mentions the experiment, its tasks, arms or expected outcomes, or the pipeline under evaluation',
      EXP_P1_TARGET_VOCABULARY,
    ),
    createdOrRevisedOnOrAfter(
      'created-or-revised-after-cutoff',
      `created or materially revised on or after ${EXP_P1_SCRUTINY_CUTOFF}, during the pilot and ` +
        'apparatus work — may be outcome-informed',
      EXP_P1_SCRUTINY_CUTOFF,
    ),
    unresolvedChronologyOrProvenance(
      'unresolved-chronology-or-provenance',
      'chronology or provenance cannot be resolved from the record — insufficiently evidenced',
    ),
    flaggedBySampleReview(
      'flagged-by-sample-review',
      'flagged for individual review by the stratified sample review',
      flaggedBySample,
    ),
  ];
}

export const CLASS_C_POPULATION_QUERY =
  "SELECT * FROM invariants WHERE namespace IN ('constitutional','reasoning','epistemology'," +
  "'polity','sovereignty','cybernetics','engineering','representation','interaction','capability') " +
  'ORDER BY id ASC  -- general-constitutional stratum (C) per ' +
  'services/research/experimentRelation.ts::GENERAL_CONSTITUTIONAL_NAMESPACES';

// ── Reviewer pair (operator ruling, 2026-07-29) ─────────────────────────────

/**
 * FIXED ids, not aliases. Venice recommends fixed ids where reproducibility
 * matters, and an alias is precisely the mechanism by which two nominally
 * different reviewers end up on one set of weights.
 *
 * Both must be verified against the live catalogue before EACH frozen run:
 * present, not offline, no applicable deprecation date, and resolving to
 * distinct family metadata. If either is unavailable the run is REFUSED and a
 * versioned amendment to this pair is required. There is no substitution path.
 */
export const EXP_P1_REVIEWER_PAIR: ReviewerPairSpec = {
  pairVersion: 'exp-p1-reviewer-pair-v1',
  rationale:
    'Operator ruling 2026-07-29: two genuinely different model families on one provider. Shared ' +
    'hosting is an acceptable correlate; shared weights are not. Changing either slot is a ' +
    'versioned amendment to this pair, recorded as a change rather than absorbed silently.',
  R1: { provider: 'venice', modelId: 'llama-3.3-70b', declaredLineage: 'Meta Llama family' },
  R2: { provider: 'venice', modelId: 'qwen3-235b-a22b-instruct-2507', declaredLineage: 'Alibaba Qwen family' },
};

// ── Coverage configuration ─────────────────────────────────────────────────

export const EXP_P1_COVERAGE = {
  /** Stratified sample of ordinary `independent` first-pass decisions. */
  sampleRate: 0.15,
  /**
   * Committed here, in the repo, before any run. A seed chosen at run time
   * cannot be shown to have been chosen before the results were seen.
   */
  sampleSeed: 'exp-p1-crystal-vP1-coverage-seed-1',
  /** Representative sample per namespace inside the Class C block decision. */
  blockSamplePerNamespace: 5,
  blockSampleSeed: 'exp-p1-class-c-block-sample-seed-1',
} as const;

export const EXP_P1_REVIEW_QUESTION =
  'Is this statement independent enough of the stated target, its tasks and its observed outcomes ' +
  'to be admitted into the confirmatory population?';

/** Mechanical flags computed over a subject — surfaced to second review. */
export function expP1MechanicalFlags(subjects: readonly ReviewSubjectRecord[]): string[] {
  const rules = expP1ClassCExceptionRules();
  return subjects.filter((s) => rules.some((r) => r.test(s))).map((s) => s.subjectRef);
}
