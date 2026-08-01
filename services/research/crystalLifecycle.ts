/**
 * The crystal lifecycle — one ladder, named once (operator ruling via Al,
 * 2026-08-02).
 *
 * ── The defect this closes ─────────────────────────────────────────────────
 *
 * The record-level contested-row remedy shipped calling the steward's act
 * "ratify". It is not a ratification. `ratify` has a constitutional meaning on
 * this platform — the act that makes a crystal canonical — and spending the
 * word on a review-queue operation leaves the real constitutional act with no
 * word of its own. Three distinct acts, performed by three distinct
 * authorities, were collapsing into one verb:
 *
 *     a reviewer         REVIEWS   — submits a signed, independent assessment
 *     a steward          RESOLVES  — chooses between submitted assessments
 *     the constitutional
 *       authority        RATIFIES  — freezes the resulting crystal
 *
 * ── The ladder ─────────────────────────────────────────────────────────────
 *
 *     candidate → under-review → review-resolved → ready-for-freeze
 *               → frozen → canonical
 *
 * Note where RESOLUTION sits: strictly BEFORE freeze. Resolving every
 * contested row settles the REVIEW. It does not admit anything to the corpus,
 * grant Standing, or make anything canonical. Those follow, as separate
 * governed acts, and the authority table in `services/research/review/types.ts`
 * already types the separation (`mayResolveContested` is true for the steward
 * and `mayApproveFreeze` is false for the same role).
 *
 * ── The external reviewer does not come back ───────────────────────────────
 *
 * A reviewer ratifies their OWN assessment by signing and submitting it. They
 * are not asked to approve the steward's resolution afterwards, and no stage
 * below waits on them a second time. What the steward resolves is the
 * DIFFERENCE between assessments that have already been submitted.
 *
 * This module is data, not behaviour: it exists so the vocabulary has one
 * authoritative home and `tests/crystal-lifecycle-vocabulary.test.ts` can fail
 * the build when "ratify" leaks back into the review layer.
 */

export type CrystalLifecycleStage =
  | 'candidate'
  | 'under-review'
  | 'review-resolved'
  | 'ready-for-freeze'
  | 'frozen'
  | 'canonical';

/** Who performs the act that ADVANCES from a stage. */
export type CrystalLifecycleAuthority =
  | 'proposer'
  | 'reviewer'
  | 'independent-review-steward'
  | 'constitutional-authority';

export interface CrystalLifecycleStep {
  stage: CrystalLifecycleStage;
  /** The act that moves the candidate ON from this stage. */
  act: string;
  /** Who may perform it. Mirrors REVIEW_ROLE_AUTHORITY — never a second rule. */
  authority: CrystalLifecycleAuthority;
  next: CrystalLifecycleStage | null;
  /** What this act explicitly does NOT do. Stated because each was misread. */
  doesNot: string;
}

export const CRYSTAL_LIFECYCLE: readonly CrystalLifecycleStep[] = [
  {
    stage: 'candidate',
    act: 'propose',
    authority: 'proposer',
    next: 'under-review',
    doesNot: 'A proposed invariant is not canonical and carries no standing.',
  },
  {
    stage: 'under-review',
    act: 'review',
    authority: 'reviewer',
    next: 'review-resolved',
    doesNot:
      'A reviewer submits a signed, independent assessment and never writes to the corpus. ' +
      'Submitting IS their ratification of their own position; they are not asked again later.',
  },
  {
    stage: 'review-resolved',
    act: 'resolve',
    authority: 'independent-review-steward',
    next: 'ready-for-freeze',
    doesNot:
      'Resolving settles the review by adopting one of the SUBMITTED assessments (or deferring). ' +
      'It admits nothing to the corpus, grants no Standing, and makes nothing canonical.',
  },
  {
    stage: 'ready-for-freeze',
    act: 'ratify (freeze)',
    authority: 'constitutional-authority',
    next: 'frozen',
    doesNot:
      'This is the ONLY act the word "ratify" names. It is never performed by resolving a review, ' +
      'and never implied by a readiness report.',
  },
  {
    stage: 'frozen',
    act: 'publish',
    authority: 'constitutional-authority',
    next: 'canonical',
    doesNot: 'A frozen crystal is committed; publication is what makes it citable as canonical.',
  },
  { stage: 'canonical', act: '—', authority: 'constitutional-authority', next: null, doesNot: '' },
];

/**
 * The verbs the REVIEW layer may use for its own acts.
 *
 * "ratify" is deliberately absent. A review-layer surface that needs a word
 * for the steward's act uses `resolve` (the act) or `adopt` (what it does to a
 * submitted assessment) — never the constitutional one.
 */
export const REVIEW_LAYER_VERBS = ['review', 'assess', 'submit', 'resolve', 'adopt', 'defer'] as const;

/** Reserved for the constitutional freeze, and for nothing else. */
export const CONSTITUTIONAL_RATIFICATION_VERB = 'ratify';

/** Where a stage sits on the ladder. `-1` for an unknown stage. */
export function lifecycleIndex(stage: CrystalLifecycleStage): number {
  return CRYSTAL_LIFECYCLE.findIndex((s) => s.stage === stage);
}

/**
 * Is resolution complete for this review — i.e. may the candidate be
 * CONSIDERED for freeze?
 *
 * Deliberately named "may be considered", not "is ready": a review with no
 * rows left in dispute has finished its review. Readiness for freeze has its
 * own separate evidence (`runCrystalReadinessReport`), and conflating the two
 * is how "the review is done" gets read as "the crystal may be frozen".
 */
export function reviewResolutionComplete(contestedRemaining: number): boolean {
  return contestedRemaining === 0;
}
