/**
 * Declared crystal domains — what an experiment's crystal is drawn FROM.
 *
 * ── Why this exists (operator ruling, 2026-08-02) ──────────────────────────
 *
 * EXP-P1's readiness surface reported zero because no `invariant_contexts` row
 * carried its domain tag. The tempting repair was to tag the existing
 * 18-invariant constitutional-reasoning collection into the domain, which the
 * operator expressly refused:
 *
 *   > "Do not tag the existing 18 invariants as `constitutional-reasoning`.
 *   > That would solve the display problem while creating the wrong experiment."
 *
 * The distinction is the whole point. Populating a readiness report is a
 * DISPLAY outcome; declaring what a crystal contains is a CONSTITUTIONAL act
 * that determines what the experiment is actually testing. Relabelling an
 * existing collection to make a surface look populated would have silently
 * substituted one experiment for another — and the substitution would have
 * been invisible afterwards, because the numbers would look right.
 *
 * ── Declaration is not ratification ────────────────────────────────────────
 *
 * A domain here is DECLARED, carrying its boundary statement and eligibility
 * rule. It is not thereby ratified. The ruling's sixth point is explicit:
 *
 *   > "Produce the domain-boundary artifact for operator ratification BEFORE
 *   > any source or invariant is assigned to Crystal vP1."
 *
 * So `ratification` starts at `awaiting-operator-ratification`, and any
 * assignment path must check it. This module never assigns anything; it states
 * what has been declared and whether it has been ratified.
 */

export type DomainRatificationStatus = 'awaiting-operator-ratification' | 'ratified';

/**
 * Which lifecycle states a row must hold to be ELIGIBLE for a crystal.
 *
 * Kept beside the boundary because the two together are the domain's real
 * definition: what the domain is about, and what counts as admitted. Widening
 * this to admit `proposed` is the one change that would make an empty crystal
 * look populated without any new evidence existing — see
 * `DOMAIN_UNPOPULATED_PROVENANCE` in crystalFreezeRecommendation.ts.
 */
export const CRYSTAL_ELIGIBLE_STATUSES = ['validated', 'canonical'] as const;

/**
 * Evidence provenance a row must carry to enter a crystal.
 *
 * Mirrors the `provenance-eligibility` readiness check's Population A
 * (PRD-EPI-001 §9). Stated here too because the operator's ruling attaches it
 * to the DOMAIN, not only to the check: internal metaMe/Qripto risk material
 * stays available to the application and is excluded from Crystal vP1.
 */
export const CRYSTAL_ELIGIBLE_PROVENANCE = ['external-established', 'external-empirical'] as const;

export interface CrystalDomainDeclaration {
  /** The `invariant_contexts.domain` value rows are assigned to. */
  domain: string;
  /** Human-readable name for surfaces. */
  label: string;
  /** The declared boundary — what the domain governs. Operator's own words. */
  boundary: string;
  eligibleStatuses: readonly string[];
  eligibleProvenance: readonly string[];
  /** What is deliberately OUT, and why. Absence of a reason is how scope creeps. */
  exclusions: readonly string[];
  ratification: DomainRatificationStatus;
  /** The chartered workstream that populates it. */
  constitutedBy: string;
}

/**
 * EXP-P1's crystal domain, declared 2026-08-02.
 *
 * NOT `constitutional-reasoning`. That collection remains the historical
 * foundational corpus used by the earlier experiments and keeps its own
 * identity; EXP-P1 now tests a differentiated, independently sourced financial
 * risk and value crystal, and needs a domain of its own to do so honestly.
 */
export const EXP_P1_CRYSTAL_DOMAIN: CrystalDomainDeclaration = Object.freeze({
  domain: 'financial-risk-value-systems',
  label: 'Financial risk and value systems',
  boundary:
    'Structural and constitutional invariants governing financial decision systems under uncertainty, ' +
    'including risk formation, valuation, actuarial mechanics, liquidity, market infrastructure, ' +
    'failure propagation and the governance of those processes.',
  eligibleStatuses: CRYSTAL_ELIGIBLE_STATUSES,
  eligibleProvenance: CRYSTAL_ELIGIBLE_PROVENANCE,
  exclusions: Object.freeze([
    'Internal metaMe / Qripto risk materials — available to the application, excluded from Crystal vP1 ' +
      'so the crystal tests externally sourced material rather than the platform’s own doctrine.',
    'The historical constitutional-reasoning collection — it remains the foundational corpus of the ' +
      'earlier experiments and is not relabelled into this domain.',
  ]),
  ratification: 'awaiting-operator-ratification',
  constitutedBy:
    'Track 2 (crystal enlargement): corpus acquisition → invariant discovery → validation through the ' +
    'normal proposed→validated lifecycle → assignment to this domain. Size is justified mechanically by ' +
    'the frozen task requirements and the ⊆40% Arm C guard — never by a quota.',
});

export const CRYSTAL_DOMAINS: readonly CrystalDomainDeclaration[] = Object.freeze([EXP_P1_CRYSTAL_DOMAIN]);

export function crystalDomainForExperiment(experimentId: string): CrystalDomainDeclaration | null {
  // One experiment, one declared domain. Keyed explicitly rather than by
  // convention so a new experiment cannot silently inherit EXP-P1's crystal.
  return experimentId === 'EXP-P1' ? EXP_P1_CRYSTAL_DOMAIN : null;
}

/**
 * May sources or invariants be assigned to this domain yet?
 *
 * The gate for the ruling's sixth point. An unratified boundary means the
 * question "what is in this crystal" has not been settled, and assigning
 * against it would decide by accretion what should be decided deliberately.
 */
export function domainAcceptsAssignment(d: CrystalDomainDeclaration): boolean {
  return d.ratification === 'ratified';
}

// ── Crystal Review stage state (operator ruling, 2026-08-02, point 5) ───────

/**
 * What the Crystal Review stage is actually offering right now.
 *
 *   > "The Crystal Review stage remains visibly 'Preparing Candidate Crystal'
 *   > until a non-empty candidate has passed intrinsic readiness. Then
 *   > transition it to 'Independent Review Open' and notify the assigned
 *   > reviewers."
 *
 * ── Why this is a separate concept from readiness ──────────────────────────
 *
 * Readiness answers "may this crystal be frozen". This answers "is there a
 * review to do". They come apart in exactly the situation we are in: a domain
 * with no rows is not ready AND has nothing to review, but a populated domain
 * that fails a check is not ready and has a great deal to review.
 *
 * Collapsing them is how an external reviewer gets invited to assess an empty
 * set — which is not a smaller version of reviewing, it is a different and
 * useless act. The operator's ruling separates the two invitations for this
 * reason: onboarding may proceed now; the review request may not.
 */
export type CrystalReviewStageState = 'PREPARING_CANDIDATE' | 'INDEPENDENT_REVIEW_OPEN';

export interface CrystalReviewStageStatus {
  state: CrystalReviewStageState;
  label: string;
  /** Addressed to the reviewer. Says what they can do now, and what they cannot yet. */
  message: string;
  /** May a reviewer be ASKED to assess and recommend? Never true on an empty domain. */
  reviewRequestOpen: boolean;
}

/**
 * Derived — never set by hand, and never from the presence of a reviewer.
 *
 * Both conditions are required: a NON-EMPTY candidate (there is something to
 * review) that has PASSED intrinsic readiness (it is worth reviewing). Either
 * alone would open the stage on evidence that is not there.
 */
export function crystalReviewStageStatus(input: {
  invariantCount: number;
  readinessOk: boolean;
}): CrystalReviewStageStatus {
  const open = input.invariantCount > 0 && input.readinessOk;
  if (open) {
    return {
      state: 'INDEPENDENT_REVIEW_OPEN',
      label: 'Independent Review Open',
      message:
        'Candidate Crystal vP1 is constituted and has passed intrinsic readiness. Your independent review is open: ' +
        'inspect the readiness report, statistics, freeze recommendation and records, and record your assessment.',
      reviewRequestOpen: true,
    };
  }
  return {
    state: 'PREPARING_CANDIDATE',
    label: 'Preparing Candidate Crystal',
    message:
      'Candidate Crystal vP1 is currently being constituted under Track 2. The readiness surface is available to ' +
      'inspect, but the independent crystal review has not yet opened — you are not being asked to assess or ' +
      'recommend a freeze on a crystal that does not yet exist. You will be notified when it opens.',
    reviewRequestOpen: false,
  };
}
