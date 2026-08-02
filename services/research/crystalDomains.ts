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
  /** Who ratified, when, and in what words. Absent until ratification. */
  ratifiedBy?: string;
  ratifiedAt?: string;
  /**
   * The operator's ratifying words, verbatim.
   *
   * Carried rather than summarised: what was ratified is the TEXT, and a
   * paraphrase of a constitutional act is a different act. It is also what a
   * later reader checks the boundary against when asking whether an assignment
   * was in scope.
   */
  ratificationText?: string;
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
  ratification: 'ratified',
  ratifiedBy: 'operator',
  ratifiedAt: '2026-08-02',
  ratificationText:
    'I ratify `financial-risk-value-systems` as the governed domain boundary for EXP-P1 Candidate Crystal ' +
    'vP1. Eligible assignments are limited to externally established or externally empirical invariants in ' +
    '`validated` or `canonical` lifecycle states. Historical constitutional-reasoning materials and ' +
    'internal/platform-derived financial-risk materials remain excluded from the EXP-P1 experimental crystal.',
  constitutedBy:
    'Track 2 (crystal enlargement), UNPAUSED 2026-08-02 and now on the critical path: corpus acquisition → ' +
    'invariant discovery → validation through the normal proposed→validated lifecycle → assignment to this ' +
    'domain. Size is justified mechanically by the frozen task requirements and the ⊆40% Arm C guard — ' +
    'never by a quota.',
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

// ── Crystal Review stage state (operator ruling, 2026-08-02, as corrected) ──

/**
 * TWO ACTIVITIES, NOT ONE WORD (operator correction, 2026-08-02).
 *
 * The first cut of this had two states and said a populated-but-failing crystal
 * "is still worth reviewing but isn't ready for the request" — which is
 * self-contradictory if "review" means one thing. The operator caught it:
 *
 *   > "If the review stage requires readiness to pass, then a populated-but-
 *   > failing crystal is not yet worth sending for the independent
 *   > freeze-readiness review. It may be worth internal diagnosis, but not the
 *   > review Austin is being invited to perform."
 *
 * So they are named separately, because they are different acts by different
 * parties with different consequences:
 *
 *   INTERNAL DIAGNOSTIC REVIEW — the originating team inspecting its own
 *     collection to find out why a check fails. Available as soon as there is
 *     anything to inspect. Produces no independent finding and no freeze input.
 *
 *   INDEPENDENT PRE-FREEZE REVIEW — an external reviewer assessing whether a
 *     crystal that has ALREADY passed intrinsic readiness should be frozen.
 *     Opens only when non-empty AND readiness passes.
 *
 * The originating team completes its own work before independent review begins.
 * Sending a failing crystal to an external reviewer would spend their
 * independence diagnosing our checks — work we can do ourselves, and which is
 * not what independence is for.
 */
export type CrystalReviewStageState =
  /** Nothing to inspect: the domain holds no invariants. */
  | 'PREPARING_CANDIDATE'
  /** Populated but not passing. The originating team diagnoses; no external ask. */
  | 'INTERNAL_DIAGNOSTIC_REVIEW'
  /** Non-empty AND readiness passed. The independent pre-freeze review may open. */
  | 'INDEPENDENT_REVIEW_OPEN';

export interface CrystalReviewStageStatus {
  state: CrystalReviewStageState;
  label: string;
  /** Addressed to the reader. Says what may be done now, and what may not yet. */
  message: string;
  /**
   * May the INDEPENDENT PRE-FREEZE review be opened — i.e. may an external
   * reviewer be ASKED to assess and recommend?
   *
   * Deliberately not called `reviewOpen`: internal diagnosis is also a review,
   * and a flag that answered for both is how the two collapsed in the first
   * place. Any invitation path consults THIS field and no other.
   */
  independentReviewRequestOpen: boolean;
  /** May the originating team inspect the collection? True as soon as it exists. */
  internalDiagnosticAvailable: boolean;
}

/**
 * Derived — never set by hand, and never from the presence of a reviewer.
 */
export function crystalReviewStageStatus(input: {
  invariantCount: number;
  readinessOk: boolean;
}): CrystalReviewStageStatus {
  const populated = input.invariantCount > 0;

  if (populated && input.readinessOk) {
    return {
      state: 'INDEPENDENT_REVIEW_OPEN',
      label: 'Independent Review Open',
      message:
        'Candidate Crystal vP1 is constituted and has passed intrinsic readiness. The independent pre-freeze ' +
        'review is open: inspect the readiness report, statistics, freeze recommendation and records, and ' +
        'record your assessment.',
      independentReviewRequestOpen: true,
      internalDiagnosticAvailable: true,
    };
  }

  if (populated) {
    return {
      state: 'INTERNAL_DIAGNOSTIC_REVIEW',
      label: 'Internal Diagnostic Review',
      message:
        'Candidate Crystal vP1 is constituted but has not yet passed intrinsic readiness. The originating team ' +
        'is diagnosing the failing checks. This is internal work — the independent pre-freeze review has not ' +
        'opened, and no external reviewer is being asked to assess or recommend a freeze.',
      independentReviewRequestOpen: false,
      internalDiagnosticAvailable: true,
    };
  }

  return {
    state: 'PREPARING_CANDIDATE',
    label: 'Preparing Candidate Crystal',
    message:
      'Candidate Crystal vP1 is currently being constituted under Track 2. The readiness surface is available ' +
      'to inspect, but there is nothing yet to diagnose or review — you are not being asked to assess or ' +
      'recommend a freeze on a crystal that does not yet exist.',
    independentReviewRequestOpen: false,
    internalDiagnosticAvailable: false,
  };
}

// ── The milestone, as a derived statement ───────────────────────────────────

/**
 * Where EXP-P1 actually stands (operator, 2026-08-02).
 *
 *   > "Internal Readiness / Domain ratified / Infrastructure ready /
 *   >  Candidate crystal constitution pending — Track 2"
 *
 * ── Why this is stated rather than inferred from the counts ────────────────
 *
 * A readiness report over an unpopulated domain reads, to anyone who meets
 * the numbers first, as a broken crystal: zero invariants, zero sources,
 * failing checks. It is not. Three of the four things needed are DONE — the
 * boundary is ratified, the infrastructure runs, the package builds
 * deterministically — and the fourth has not been attempted yet.
 *
 * The distinction the operator drew, and the reason this milestone earns a
 * name of its own:
 *
 *   The domain declaration creates the governed BOUNDARY.
 *   Track 2 creates the OBJECT inside that boundary.
 *   Readiness assesses that object.
 *   Freeze ratifies it.
 *
 * Nothing in this software can advance the third line while the second has
 * not run. Saying so plainly is what stops the next reader — human or agent —
 * from debugging an absence.
 */
export interface CrystalMilestone {
  label: string;
  domainRatified: boolean;
  infrastructureReady: boolean;
  candidateConstituted: boolean;
  /** The single sentence a surface should show instead of a count. */
  statement: string;
  /** What actually moves this forward. Never a code change. */
  advancedBy: string;
}

export function crystalMilestone(input: { invariantCount: number }): CrystalMilestone {
  const constituted = input.invariantCount > 0;
  return {
    label: constituted ? 'Candidate Crystal constituted' : 'Internal Readiness',
    domainRatified: EXP_P1_CRYSTAL_DOMAIN.ratification === 'ratified',
    infrastructureReady: true,
    candidateConstituted: constituted,
    statement: constituted
      ? `Candidate Crystal vP1 holds ${input.invariantCount} invariant(s) in ` +
        `'${EXP_P1_CRYSTAL_DOMAIN.domain}'. Readiness now assesses a real object.`
      : `Domain ratified, infrastructure ready, candidate crystal constitution pending — Track 2. The ` +
        `governed boundary '${EXP_P1_CRYSTAL_DOMAIN.domain}' exists and is empty: no invariant has been ` +
        `acquired, validated and assigned to it yet. The zero counts describe an unstarted acquisition, not ` +
        `a defective crystal.`,
    advancedBy: constituted
      ? 'Readiness checks over the populated crystal, then the freeze ceremony.'
      : 'Track 2 corpus acquisition — admit external financial-risk sources, extract candidate invariants, ' +
        'validate them through the receipted lifecycle, and assign eligible validated/canonical invariants to ' +
        'the ratified domain. No change to this software moves it.',
  };
}

/**
 * Whether this readiness package is a reviewable scientific object.
 *
 *   > "I would not include the current empty readiness package in the material
 *   >  sent to Austin except as historical provenance … It is honest, but it
 *   >  is not yet a reviewable scientific object."
 *
 * Honest and reviewable are different properties, and an external reviewer
 * asked to assess an empty set has been given work that cannot produce a
 * finding. Exposed so any packaging path can refuse to ship it as the subject
 * of a review while still carrying it as provenance.
 */
export function isReviewableScientificObject(input: { invariantCount: number }): boolean {
  return input.invariantCount > 0;
}

export const EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT =
  'A readiness package over an unpopulated domain is a truthful pre-Track-2 baseline and belongs in the ' +
  'eventual research bundle as historical provenance. It is not a reviewable scientific object: an external ' +
  'reviewer asked to assess an empty set cannot produce a finding, and asking them to spends their attention ' +
  'on our unfinished work.';

// ── The lifecycle ladder ────────────────────────────────────────────────────

/**
 * Where a crystal is on its way from a declared boundary to canonical law.
 *
 * ── The UX defect this closes (operator, 2026-08-02) ───────────────────────
 *
 *   > "The UI currently says: Not Ready. What it should really say is:
 *   >  Candidate Crystal not yet constituted. Those are very different
 *   >  messages. The current wording makes you think you've done something
 *   >  wrong. The second tells you exactly what is missing."
 *
 * `NOT_READY` is a verdict about a thing that EXISTS — it says the object was
 * assessed and fell short. When no object has been constituted, that verdict
 * is answering a question nobody asked, and it answers it in the register of
 * failure. A whole session went into debugging nine "failing" checks that were
 * correctly declining to certify an empty set.
 *
 * The deeper error underneath the wording: the surface was offering a FREEZE —
 * a governance act — while the outstanding work was corpus construction, which
 * is SCIENTIFIC. Those are different kinds of work done by different people at
 * different times, and a UI that conflates them sends the operator to perform
 * a ratification when what is missing is evidence. So every stage carries
 * `remainingWorkKind`, and the surface reads it rather than assuming the next
 * step is always a signature.
 *
 * ── Derived, never stored ──────────────────────────────────────────────────
 *
 * Each stage is computed from the same facts `crystalMilestone`,
 * `crystalReviewStageStatus` and the readiness engine already read. This is a
 * PROJECTION of those signals, not a parallel state machine
 * (`inv.engineering.037`) — a stage that could disagree with the milestone
 * would be a second source of truth for one fact, which is the defect class
 * that produced the original confusion.
 */
export type CrystalLifecycleStageId =
  | 'DOMAIN_DECLARED'
  | 'CANDIDATE_NOT_CONSTITUTED'
  | 'CANDIDATE_READY_FOR_REVIEW'
  | 'READY_FOR_FREEZE'
  | 'FROZEN'
  | 'CANONICAL';

/** Which kind of work moves a stage forward. The distinction the UI was missing. */
export type RemainingWorkKind = 'scientific' | 'governance' | 'none';

export interface CrystalLifecycleStage {
  id: CrystalLifecycleStageId;
  /** What to render. Never a verdict about an object that does not exist. */
  label: string;
  marker: string;
  /** Reached, currently here, or still ahead. */
  state: 'done' | 'current' | 'pending';
}

export interface CrystalLifecycle {
  stageId: CrystalLifecycleStageId;
  label: string;
  marker: string;
  /** One sentence: what this stage means, in the operator's own register. */
  meaning: string;
  /** What is missing — the thing "NOT_READY" never said. */
  whatIsMissing: string | null;
  /**
   * Scientific or governance. A surface must not offer a ratification button
   * when the outstanding work is corpus construction.
   */
  remainingWorkKind: RemainingWorkKind;
  /** Who performs the next act. */
  whoActs: string;
  ladder: CrystalLifecycleStage[];
}

const LADDER: { id: CrystalLifecycleStageId; label: string; marker: string }[] = [
  { id: 'DOMAIN_DECLARED', label: 'Domain Declared', marker: '✓' },
  { id: 'CANDIDATE_NOT_CONSTITUTED', label: 'Candidate Crystal Not Yet Constituted', marker: '⚪' },
  { id: 'CANDIDATE_READY_FOR_REVIEW', label: 'Candidate Crystal Ready For Review', marker: '🟡' },
  { id: 'READY_FOR_FREEZE', label: 'Ready For Freeze', marker: '🟢' },
  { id: 'FROZEN', label: 'Frozen', marker: '🔒' },
  { id: 'CANONICAL', label: 'Canonical', marker: '📜' },
];

export const CRYSTAL_LIFECYCLE_LADDER = LADDER;

export function crystalLifecycleStage(input: {
  domainRatified: boolean;
  invariantCount: number;
  readinessOk: boolean;
  /** A real freeze receipt exists. Defaults false — never inferred from readiness. */
  frozen?: boolean;
  /** Published as canonical law. Defaults false. */
  canonical?: boolean;
}): CrystalLifecycle {
  const stageId: CrystalLifecycleStageId = input.canonical
    ? 'CANONICAL'
    : input.frozen
      ? 'FROZEN'
      : !input.domainRatified
        ? 'DOMAIN_DECLARED'
        : input.invariantCount === 0
          ? 'CANDIDATE_NOT_CONSTITUTED'
          : input.readinessOk
            ? 'READY_FOR_FREEZE'
            : 'CANDIDATE_READY_FOR_REVIEW';

  const at = LADDER.findIndex((s) => s.id === stageId);
  const stage = LADDER[at];

  const detail: Record<CrystalLifecycleStageId, Pick<CrystalLifecycle, 'meaning' | 'whatIsMissing' | 'remainingWorkKind' | 'whoActs'>> = {
    DOMAIN_DECLARED: {
      meaning: 'The governed boundary has not been ratified, so nothing may be assigned to it yet.',
      whatIsMissing: 'Operator ratification of the domain declaration.',
      remainingWorkKind: 'governance',
      whoActs: 'The operator, by ratifying the domain boundary.',
    },
    CANDIDATE_NOT_CONSTITUTED: {
      meaning:
        'The boundary exists and is empty. No invariant has been acquired, validated and assigned to it — ' +
        'so there is no crystal to assess, and nothing here has failed.',
      whatIsMissing:
        'The crystal itself. Track 2 corpus acquisition: admit external sources, extract candidate ' +
        'invariants, validate them through the receipted lifecycle, and assign the eligible ones to the ' +
        'ratified domain.',
      remainingWorkKind: 'scientific',
      whoActs: 'The research team, through Track 2. No governance act and no code change moves this.',
    },
    CANDIDATE_READY_FOR_REVIEW: {
      meaning:
        'A candidate crystal exists and is being assessed. Failing checks here are findings about a real ' +
        'object — the originating team diagnoses them before any independent review opens.',
      whatIsMissing: 'Intrinsic readiness over the constituted crystal.',
      remainingWorkKind: 'scientific',
      whoActs: 'The originating team, diagnosing its own readiness checks.',
    },
    READY_FOR_FREEZE: {
      meaning:
        'The candidate crystal is constituted and has passed intrinsic readiness. Independent pre-freeze ' +
        'review may open, and a freeze becomes a decision rather than a premature act.',
      whatIsMissing: 'Independent review, then the operator’s freeze.',
      remainingWorkKind: 'governance',
      whoActs: 'An independent reviewer, then the operator — outside this UI, by their own governed act.',
    },
    FROZEN: {
      meaning: 'The crystal has been frozen by a governed act. Its content is fixed and receipted.',
      whatIsMissing: 'Publication as canonical.',
      remainingWorkKind: 'governance',
      whoActs: 'The operator, by publishing.',
    },
    CANONICAL: {
      meaning: 'The crystal is published and canonical.',
      whatIsMissing: null,
      remainingWorkKind: 'none',
      whoActs: 'Nobody — this stage is terminal.',
    },
  };

  return {
    stageId,
    label: stage.label,
    marker: stage.marker,
    ...detail[stageId],
    ladder: LADDER.map((s, i) => ({
      ...s,
      state: i < at ? 'done' : i === at ? 'current' : 'pending',
    })),
  };
}

/**
 * A freeze is a governance act and must never be offered while the missing
 * work is scientific. Exported so a surface asks rather than assumes — the
 * original defect was a "Ready for freeze?" affordance sitting above an
 * unconstituted crystal.
 */
export function mayOfferFreezeAffordance(lifecycle: CrystalLifecycle): boolean {
  return lifecycle.stageId === 'READY_FOR_FREEZE';
}
