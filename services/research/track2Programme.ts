/**
 * The Track 2 programme — eleven stages, one guided surface (operator ruling,
 * 2026-08-02).
 *
 *   > "Surface the existing Corpus Scout, discovery, promotion, provenance
 *   >  classification, validation, crystal assignment, readiness, artifact
 *   >  provisioning and freeze functions as one guided Track 2 operator
 *   >  workflow. The operator must not need to run curl commands."
 *
 * ── What this module is, and is emphatically not ───────────────────────────
 *
 * It is a PROJECTION. Every stage names the capability that already implements
 * it, and every status is DERIVED from signals the platform already computes —
 * candidate-source rows, discovery candidates, the readiness report's own
 * checks, the crystal lifecycle ladder, the persisted artifact. Nothing here
 * stores progress, and nothing here re-implements a stage's work.
 *
 * A stored `currentStage` would be a second source of truth for a fact the
 * substrate already answers, and it would go stale the moment anyone acted
 * through one of the underlying surfaces directly (`inv.engineering.037`). The
 * eleven stages are a way of READING the substrate, not a workflow engine that
 * owns it.
 *
 * ── Honest unknowns ────────────────────────────────────────────────────────
 *
 * Some upstream signals may be unreadable (no substrate, no permission, a
 * corpus domain the caller did not name). Those stages report `unknown` — never
 * `complete`, and never `blocked`. Guessing "done" would advance an operator
 * past work that has not happened; guessing "blocked" would send them to fix
 * something that is not broken. Both errors have been made on this programme
 * already.
 *
 * Server-safe and pure: no I/O in this module. The route composes the signals.
 */

import type { CrystalLifecycle } from '@/services/research/crystalDomains';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import {
  checkPopulationContinuity,
  handoverBreach,
  renderHandover,
  type PopulationContinuityBreak,
  type PopulationDeclaration,
  type PopulationHandover,
} from '@/services/research/exceptionIsolation';
import type { CohortMemberRef, UnaccountedPromotionRecord } from '@/services/research/populationReconciliation';

export type Track2StageId =
  | 'discover-sources'
  | 'review-and-admit'
  | 'extract-candidates'
  | 'review-and-promote'
  | 'classify-provenance'
  | 'validate'
  | 'add-relationships'
  | 'assign-to-crystal'
  | 'run-readiness'
  | 'prepare-independent-review'
  | 'freeze';

/**
 * `unknown` is a first-class value, not a failure mode — see the header. It
 * means "this signal could not be read", which is different from both "not
 * started" and "blocked".
 *
 * `partially-complete` (added 2026-08-03, exception-isolation ruling §6) is
 * the value the isolation model turns on: **every executable record was
 * processed AND some records remain as exceptions.** It is emphatically not
 * `blocked`.
 *
 *   > "A stage may be `partially-complete` because it contains unresolved
 *   >  `exception` records while still having processed all `ready` records."
 *
 * `blocked` now means what it says and only what it says: NO valid subset can
 * safely proceed. A stage holding 29 admissible sources and 3 exceptions is
 * `partially-complete`. Reporting it `blocked` would reintroduce the paralysis
 * at the reporting layer after the execution layer had already been fixed.
 *
 * The record-level counterpart of this axis is `RecordDisposition`
 * (`services/research/exceptionIsolation.ts`) — the two are DIFFERENT
 * dimensions and are deliberately never conflated.
 */
export type Track2StageStatus =
  | 'complete'
  | 'partially-complete'
  | 'in-progress'
  | 'not-started'
  | 'blocked'
  | 'unknown';

export interface Track2Stage {
  id: Track2StageId;
  ordinal: number;
  label: string;
  /** What happens at this stage, in one sentence. */
  does: string;
  /**
   * The EXISTING capability this stage routes to. Never a new implementation —
   * if a stage ever needs one, that is a gap to report, not a thing to build
   * inside a workflow surface.
   */
  capability: string;
  /** Where the operator performs it. A repo path or a named panel, never a guessed URL. */
  surface: string;
  /** Scientific work or a governance act — the distinction the ladder made. */
  workKind: 'scientific' | 'governance';
  /** Who performs it. */
  actor: string;
  status: Track2StageStatus;
  /**
   * WHAT THIS STAGE IS REASONING ABOUT — declared, never implied (operator
   * ruling, 2026-08-03).
   *
   * Required, so a stage cannot be added without saying which population it
   * reads and which it hands on. `checkPopulationContinuity` then proves the
   * chain holds; before this field existed, Stage 5 substituted the ratified
   * domain registry for the crystal it had inherited and nothing in the system
   * could tell.
   */
  population: PopulationDeclaration;
  /** One line stating the observed fact behind `status`. */
  detail: string;
  /**
   * What to do next AT THIS STAGE. Carries the readiness engine's own remedies
   * verbatim where they apply — never a second wording of them.
   */
  remedies: string[];
}

/**
 * THE COHORT STAGES 5–7 WORK OVER — resolved from STAGE 4's promoted output,
 * and from nothing else (operator ruling, 2026-08-03).
 *
 * ── The defect this type exists to make impossible ─────────────────────────
 *
 *   > "Stage 5 appears to have reverted to querying the ratified domain
 *   >  registry instead of the crystal it inherited. Those are different
 *   >  populations."
 *
 * Stage 5's old signal was a bare `unclassifiedPromoted: number` counted over
 * `listInvariants({ domain: acquisitionDomain })` — every invariant ever tagged
 * with the acquisition domain, across every run and every sub-domain. Stage 4
 * counted `discovery_candidates WHERE status = 'promoted' AND sub_domain IS
 * NULL`. Seventeen and sixty-eight, on one screen, about two different sets.
 *
 * A bare number cannot be reconciled against the stage that produced it. This
 * shape can: the ids are named, the exclusions are named, and
 * `received + excluded === Stage 4's promoted count` is checkable arithmetic.
 */
export interface PromotedCohort {
  /**
   * The invariants Stage 4 actually promoted, by id — resolved through each
   * promoted candidate's `promoted_invariant_id`, which is the recorded link
   * between the two stages. Never a domain query.
   */
  invariantIds: string[];
  /** Of the received cohort, how many carry no recorded evidence provenance. */
  unclassified: number;
  /** Of the received cohort, how many carry zero recorded validations. */
  unvalidated: number;
  /** Relationships AMONG cohort members, and members with none. Null = unread. */
  graph: { relationshipCount: number; orphanCount: number } | null;
  /**
   * OPERATOR-CONFIRMED exclusions only — a steward acted through the
   * Population Reconciliation Board (services/research/
   * populationReconciliation.ts). The only legitimate narrowing — and
   * visible, never discarded (`CI-2026-08-03-EXCLUSION-VISIBLE-NOT-
   * DISCARDED-001`).
   */
  excluded: { recordId: string; reason: string }[];
  /**
   * Every promoted candidate that is NEITHER a distinct resolved member NOR
   * an operator-confirmed exclusion — named individually, never collapsed
   * into "unaccounted for: N" (al, 2026-08-04). The Population Reconciliation
   * Board renders exactly this list at Stage 5; Stages 6–7 link back to it
   * rather than repeat the diagnosis.
   */
  unaccountedRecords: UnaccountedPromotionRecord[];
  /** Named worklists for the action buttons Stages 5-7 render (al, 2026-08-04: "replace explanation with action; an action needs a record to act on"). */
  unclassifiedRecords: CohortMemberRef[];
  unvalidatedRecords: CohortMemberRef[];
  orphanRecords: CohortMemberRef[];
  members: CohortMemberRef[];
}

/**
 * The three named worklists Stages 5-7 render as executable queues, rather
 * than a count with nowhere to click (al, 2026-08-04 steward-workflow
 * ruling). Present whenever there is a cohort to work over; each list is
 * simply the cohort's own field, carried here so the panel does not have to
 * reach into `reconciliation`/stage internals to find it.
 */
export interface Track2ActionQueues {
  crystalId: string;
  unclassified: CohortMemberRef[];
  unvalidated: CohortMemberRef[];
  orphans: CohortMemberRef[];
  /** Every distinct resolved cohort member — the Relationship Queue's "relate to" picker. */
  members: CohortMemberRef[];
}

/**
 * The Population Reconciliation Board's read model — the Stage 4 → Stage 5
 * handover, with the unaccounted records NAMED rather than only counted (al,
 * 2026-08-04). `crystalId` and the stage ids are carried here so the board's
 * repair/exclude POST can be built without the client inventing any of them.
 */
export interface PopulationReconciliationView {
  crystalId: string;
  fromStageId: Track2StageId;
  toStageId: Track2StageId;
  declaredOut: number;
  received: number;
  explicitlyExcluded: number;
  unaccountedRecords: UnaccountedPromotionRecord[];
}

export interface Track2ProgrammeSignals {
  /** Corpus Scout candidate sources, by review workflow status. Null = unreadable. */
  candidateSources: { total: number; pendingReview: number; admitted: number } | null;
  /** Discovery candidates for the acquisition domain. Null = unreadable. */
  discoveryCandidates: { total: number; awaitingReview: number; promoted: number } | null;
  /** Stages 5–7's population, inherited from Stage 4. Null = unreadable. */
  promotedCohort: PromotedCohort | null;
  /** The crystal readiness report over the DECLARED domain. */
  readiness: CrystalReadinessReport;
  /** The lifecycle ladder, already derived elsewhere. Consumed, not recomputed. */
  lifecycle: CrystalLifecycle;
  /** The persisted crystal-version artifact, or null when none exists. */
  artifact: { id: string; lifecycle: string } | null;
  /** Whether the independent pre-freeze review may open — from crystalReviewStageStatus. */
  independentReviewRequestOpen: boolean;
}

export interface Track2Programme {
  experimentId: string;
  crystalDomain: string;
  stages: Track2Stage[];
  /** The lowest-ordinal stage that is not complete. The programme's "you are here". */
  currentStageId: Track2StageId;
  /**
   * Every stage that MAY PROCEED NOW — each one whose earlier stages are all
   * either `complete` or `partially-complete` (exception-isolation ruling §6).
   *
   * This is what a surface must gate its controls on, NOT `ordinal >
   * current.ordinal`. A partially-complete Stage 2 holding 3 unresolved
   * exceptions does not withhold Stage 3 from the 29 sources it already
   * admitted: *"Stage 3 may begin extraction over the 29 admitted sources
   * IMMEDIATELY. Do not require every Stage-1-discovered source to be resolved
   * before Stage 3 can operate over admitted evidence."*
   */
  unblockedStageIds: Track2StageId[];
  /**
   * THE PIPELINE'S OWN ACCOUNT OF ITS SUBJECT (operator ruling, 2026-08-03).
   *
   * `breaks` is empty when every stage consumes what the previous one hands
   * on. `handovers` carries the arithmetic between the stages whose counts the
   * operator can actually compare — today, Stage 4 → Stage 5. A non-empty
   * `breaks`, or a handover that does not reconcile, is a defect in the
   * PIPELINE, not in the data, and is surfaced as such rather than rendered as
   * an empty queue.
   */
  populationContinuity: {
    breaks: PopulationContinuityBreak[];
    handovers: PopulationHandover[];
    /** Every unreconciled handover's breach sentence, verbatim. */
    breaches: string[];
  };
  /**
   * THE POPULATION RECONCILIATION BOARD'S DATA (al, 2026-08-04) — the same
   * Stage 4 → Stage 5 handover as `populationContinuity`, but carrying the
   * NAMED unaccounted records rather than only a breach sentence. `null`
   * when there is no cohort to reconcile at all (nothing promoted yet).
   * Rendered ONCE, at Stage 5 — Stage 6/7 link back to it rather than repeat
   * the diagnosis.
   */
  reconciliation: PopulationReconciliationView | null;
  /** Stages 5-7's action-queue worklists (al, 2026-08-04). `null` when there is no cohort to work over yet. */
  actionQueues: Track2ActionQueues | null;
  /** Every remedy on the current stage, hoisted so a surface leads with it. */
  nextActions: string[];
  /** Stated on the payload: this is read, not stored. */
  derivationNote: string;
}

const DERIVATION_NOTE =
  'Every stage status is DERIVED from the substrate at request time — candidate-source rows, discovery ' +
  'candidates, the readiness report, the crystal lifecycle ladder and the persisted artifact. No progress is ' +
  'stored anywhere, so acting through any underlying surface directly is reflected here immediately, and this ' +
  'programme can never disagree with the reports it reads.';

/**
 * Which readiness checks a stage is answerable for. Used to pull the engine's
 * own remedies through, verbatim — never to restate them.
 *
 * ── ONLY STAGES THAT DECLARE `assigned-crystal` MAY APPEAR HERE ────────────
 *
 * `runCrystalReadinessReport` assesses the ASSIGNED crystal — `listInvariants`
 * filtered to the ratified crystal domain. Its remedies are therefore
 * statements about the assigned crystal, and hanging them on a stage that
 * works over the CURRENT crystal imports a foreign population through the
 * remedy channel.
 *
 * That is exactly what happened: Stage 5 carried `provenance-eligibility`,
 * whose remedy over an empty crystal domain reads *"Domain
 * 'financial-risk-value-systems' holds no invariants, so this check has
 * nothing to assess"* — rendered beside a count of sixty-eight, on a stage
 * holding seventeen. Three populations, one stage. `classify-provenance`,
 * `validate` and `add-relationships` were removed here on 2026-08-03 and now
 * derive their remedies from the cohort they actually work over; the same
 * checks remain on `run-readiness`, which does declare `assigned-crystal`, so
 * no remedy was lost — only relocated to the stage whose subject it describes.
 */
const CHECKS_BY_STAGE: Partial<Record<Track2StageId, string[]>> = {
  'assign-to-crystal': ['selection-space'],
  'run-readiness': [
    'selection-space',
    'derivation-headroom',
    'structural-diversity',
    'duplicate-detection',
    'provenance-eligibility',
    'lifecycle-validation-integrity',
    'relationship-density',
    'graph-connectivity',
    'orphan-detection',
  ],
};

function remediesFor(stageId: Track2StageId, readiness: CrystalReadinessReport): string[] {
  const names = CHECKS_BY_STAGE[stageId];
  if (!names) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const check = readiness.checks.find((c) => c.name === name);
    if (!check || check.passed || !check.remedy) continue;
    if (seen.has(check.remedy)) continue; // several checks share the empty-domain remedy
    seen.add(check.remedy);
    out.push(`${check.name}: ${check.remedy}`);
  }
  return out;
}

export function buildTrack2Programme(input: {
  experimentId: string;
  crystalDomain: string;
  signals: Track2ProgrammeSignals;
}): Track2Programme {
  const { signals: s } = input;
  const populated = s.readiness.invariantCount > 0;

  // ── THE STAGE 4 → STAGE 5 HANDOVER, computed once ─────────────────────────
  //
  // `declaredOut` is read from STAGE 4's own signal, and `received` from the
  // cohort — the two numbers the operator saw disagree. Deriving either from
  // the other would make them trivially equal and disclose nothing, which is
  // the mistake `track2Population.ts` already documents for `validated` vs
  // `assignedToCrystal`.
  const cohort = s.promotedCohort;
  const handover: PopulationHandover | null =
    s.discoveryCandidates && cohort
      ? {
          fromStageId: 'review-and-promote',
          toStageId: 'classify-provenance',
          population: 'current-crystal',
          declaredOut: s.discoveryCandidates.promoted,
          received: cohort.invariantIds.length,
          excluded: cohort.excluded.length,
          exclusionReasons: cohort.excluded.map((e) => `${e.recordId}: ${e.reason}`),
        }
      : null;
  const breach = handover ? handoverBreach(handover) : null;

  /**
   * Stages 5–7 all read the cohort, and all fail the same three ways: the
   * signal is unreadable (`unknown`), the handover does not reconcile
   * (`blocked` — a pipeline defect, never an empty queue), or the cohort is
   * genuinely empty because Stage 4 promoted nothing (`not-started`).
   *
   * Written once so the three stages cannot drift into disagreeing about the
   * same cohort — the second copy would be the stale one.
   */
  function cohortGate(): { status: Track2StageStatus; detail: string; remedies: string[] } | null {
    if (!cohort) {
      return {
        status: 'unknown',
        detail: 'the promoted cohort could not be read — status unknown, not assumed',
        remedies: [],
      };
    }
    if (breach) {
      // NAMED RECORDS, NOT A NAVIGATION INSTRUCTION (al, 2026-08-04). The
      // remedy used to send the operator to go find, diagnose and repair
      // these candidates elsewhere. The Population Reconciliation Board
      // (Track2ProgrammePanel.tsx) renders `unaccountedRecords` inline,
      // directly beneath this remedy, with an executable treatment per
      // record — this text now describes THAT act, not a search.
      const repairable = cohort.unaccountedRecords.filter((r) => r.recommendedTreatment === 'repair').length;
      const needsJudgment = cohort.unaccountedRecords.length - repairable;
      return {
        status: 'blocked',
        detail: breach,
        remedies: [
          `This is a defect in the pipeline, not in the data. ${cohort.unaccountedRecords.length} record(s) are ` +
            `named individually in the Population Reconciliation Board below` +
            (repairable > 0 ? ` — ${repairable} can be repaired and included with a recommended act already prepared` : '') +
            (needsJudgment > 0
              ? `${repairable > 0 ? ', and' : ' —'} ${needsJudgment} need${needsJudgment === 1 ? 's' : ''} a steward's ` +
                'explicit exclusion with a reason'
              : '') +
            '. Resolve each below; Stage 5 unlocks automatically once every record is accounted for.',
        ],
      };
    }
    if (cohort.invariantIds.length === 0) {
      return {
        status: 'not-started',
        detail:
          `nothing has been promoted into the current crystal yet` +
          (handover ? ` — ${renderHandover(handover)}` : ''),
        remedies: [],
      };
    }
    return null;
  }

  const cohortSize = cohort?.invariantIds.length ?? 0;
  const excludedNote =
    cohort && cohort.excluded.length > 0
      ? ` · ${cohort.excluded.length} explicitly excluded (${cohort.excluded.map((e) => e.reason).join('; ')})`
      : '';

  type StageOutcome = { status: Track2StageStatus; detail: string; remedies: string[] };

  const classifyOutcome: StageOutcome = cohortGate() ?? {
    status:
      cohort!.unclassified === 0 ? (cohort!.excluded.length > 0 ? 'partially-complete' : 'complete') : 'in-progress',
    detail:
      `${cohort!.unclassified} of ${cohortSize} promoted invariant(s) in the current crystal carry no ` +
      `recorded evidence provenance${excludedNote}`,
    remedies:
      cohort!.unclassified > 0
        ? [
            `Classify the ${cohort!.unclassified} unclassified member(s) of the current crystal. Promotion ` +
              'deliberately leaves evidence provenance unset, so this is expected work, not a fault.',
          ]
        : [],
  };

  const validateOutcome: StageOutcome = cohortGate() ?? {
    status:
      cohort!.unvalidated === 0 ? (cohort!.excluded.length > 0 ? 'partially-complete' : 'complete') : 'in-progress',
    detail:
      `${cohortSize - cohort!.unvalidated} of ${cohortSize} promoted invariant(s) carry a real validation ` +
      `count${excludedNote}`,
    remedies:
      cohort!.unvalidated > 0
        ? [`${cohort!.unvalidated} member(s) of the current crystal carry zero validations — run the validation gate on each.`]
        : [],
  };

  const relationshipsOutcome: StageOutcome =
    cohortGate() ??
    (cohort!.graph === null
      ? {
          // An unread graph is `unknown`, never "no relationships". Falling
          // back to the readiness engine's graph checks here is precisely the
          // substitution being removed — those checks are about the assigned
          // crystal.
          status: 'unknown',
          detail: 'relationships among the current crystal could not be read — status unknown, not assumed',
          remedies: [],
        }
      : {
          status: cohort!.graph.orphanCount === 0 ? 'complete' : 'in-progress',
          detail:
            `${cohort!.graph.relationshipCount} relationship(s) among the ${cohortSize} member(s) of the ` +
            `current crystal; ${cohort!.graph.orphanCount} carry none${excludedNote}`,
          remedies:
            cohort!.graph.orphanCount > 0
              ? [
                  `${cohort!.graph.orphanCount} member(s) of the current crystal carry no relationship to another ` +
                    'member. Acquisition creates no edges, so these arrive as orphans by default — expected work, not a fault.',
                ]
              : [],
        });

  const stages: Track2Stage[] = [
    {
      id: 'discover-sources',
      ordinal: 1,
      label: 'Discover Sources',
      does: 'Run Corpus Scout across every ratified institution in the acquisition domain.',
      capability: 'POST /api/corpus-scout/institution-discovery/domain → runDiscoveryForDomain',
      surface: 'Corpus Scout tab',
      workKind: 'scientific',
      actor: 'Steward',
      // The head of the pipeline: it consumes no upstream stage's output, it
      // WRITES INTO the acquisition corpus. Declared all the same, because a
      // stage whose subject is unstated is the defect regardless of position.
      population: {
        consumes: 'admitted-corpus',
        produces: 'admitted-corpus',
        source: 'corpus_candidate_sources WHERE campaign_domain = <acquisitionDomain> — the head of the pipeline writes into this corpus',
      },
      status:
        s.candidateSources === null ? 'unknown' : s.candidateSources.total > 0 ? 'complete' : 'not-started',
      detail:
        s.candidateSources === null
          ? 'candidate-source substrate could not be read — status unknown, not assumed'
          : `${s.candidateSources.total} candidate source(s) discovered`,
      remedies:
        s.candidateSources?.total === 0
          ? ['Ratify the domain constitution pillars first, then run discovery for the domain.']
          : [],
    },
    {
      id: 'review-and-admit',
      ordinal: 2,
      label: 'Review & Admit',
      does: 'A human approves each source; approval hands it to the Ingestion Broker as evidence.',
      capability: 'POST /api/corpus-scout/candidates/[sourceId]/review → ingestApprovedSource',
      surface: 'Corpus Scout tab',
      workKind: 'scientific',
      actor: 'Steward — approval is never automatic (PRD-ICA-001 §6/§11)',
      population: {
        consumes: 'admitted-corpus',
        produces: 'admitted-corpus',
        source: 'corpus_candidate_sources WHERE campaign_domain = <acquisitionDomain>, partitioned by reviewWorkflowStatus and evidenceRowId',
      },
      // PARTIAL COMPLETION IS THE HONEST ANSWER (exception-isolation ruling
      // §6). Sources admitted AND sources still outstanding is not
      // "in-progress toward all-or-nothing" — it is a stage that has processed
      // everything executable and is holding the remainder. Reporting it as
      // `partially-complete` is what lets Stage 3 proceed over the admitted
      // subset instead of waiting for every discovered source to resolve.
      status:
        s.candidateSources === null
          ? 'unknown'
          : s.candidateSources.admitted > 0
            ? s.candidateSources.pendingReview > 0
              ? 'partially-complete'
              : 'complete'
            : 'not-started',
      detail:
        s.candidateSources === null
          ? 'unreadable'
          : `${s.candidateSources.admitted} admitted · ${s.candidateSources.pendingReview} awaiting review` +
            (s.candidateSources.admitted > 0 && s.candidateSources.pendingReview > 0
              ? ' — the admitted set is available to Stage 3 now; the remainder does not hold it back'
              : ''),
      remedies:
        s.candidateSources && s.candidateSources.pendingReview > 0
          ? [`${s.candidateSources.pendingReview} source(s) await a human decision. Approval is a human act.`]
          : [],
    },
    {
      id: 'extract-candidates',
      ordinal: 3,
      label: 'Extract Candidates',
      does: 'Run constitutional discovery over the admitted evidence to surface candidate invariants.',
      capability: "POST /api/invariants/discovery { action: 'extract' } → runConstitutionalDiscovery",
      surface: 'Invariant Discovery tab',
      workKind: 'scientific',
      actor: 'Steward',
      // THE FIRST DECLARED TRANSFORM: admitted evidence in, a candidate cohort
      // out. Legitimate precisely because it is declared — an undeclared
      // change of population at the same point would be the defect.
      population: {
        consumes: 'admitted-corpus',
        produces: 'current-crystal',
        source: 'discovery_candidates WHERE domain = <acquisitionDomain> AND sub_domain IS NULL, extracted from the admitted evidence rows',
      },
      status:
        s.discoveryCandidates === null ? 'unknown' : s.discoveryCandidates.total > 0 ? 'complete' : 'not-started',
      detail:
        s.discoveryCandidates === null
          ? 'discovery substrate could not be read — status unknown, not assumed'
          : `${s.discoveryCandidates.total} candidate(s) extracted`,
      remedies: [],
    },
    {
      id: 'review-and-promote',
      ordinal: 4,
      label: 'Review & Promote',
      does: 'Promote each accepted candidate — it lands as `proposed`, never canonical.',
      capability: "POST /api/invariants/discovery { action: 'promote' } → promoteCandidate",
      surface: 'Invariant Discovery tab',
      workKind: 'scientific',
      actor: 'Steward',
      population: {
        consumes: 'current-crystal',
        produces: 'current-crystal',
        source: "discovery_candidates WHERE domain = <acquisitionDomain> AND sub_domain IS NULL — the same rows Stage 3 produced, partitioned by status ('candidate' | 'promoted')",
      },
      status:
        s.discoveryCandidates === null
          ? 'unknown'
          : s.discoveryCandidates.promoted > 0
            ? s.discoveryCandidates.awaitingReview > 0
              ? 'in-progress'
              : 'complete'
            : 'not-started',
      detail:
        s.discoveryCandidates === null
          ? 'unreadable'
          : `${s.discoveryCandidates.promoted} promoted · ${s.discoveryCandidates.awaitingReview} awaiting review`,
      remedies: [],
    },
    {
      id: 'classify-provenance',
      ordinal: 5,
      label: 'Classify Provenance',
      does: 'Record each invariant’s real evidence basis. Promotion deliberately leaves it unset.',
      capability: "POST /api/invariants/discovery { action: 'classify' } → applyProvenanceReclassification",
      surface: 'Invariant Discovery tab — classification queue',
      workKind: 'scientific',
      actor: 'Steward — a move into Population A citing only repo-internal sources is refused',
      // THE STAGE THAT SUBSTITUTED (operator, 2026-08-03). It read
      // `listInvariants({ domain: acquisitionDomain })` — the ratified domain
      // registry, all-time, every sub-domain — while Stages 3 and 4 worked the
      // run's own candidate cohort. It now reads the invariants Stage 4
      // promoted, resolved through `promoted_invariant_id`, and nothing else.
      population: {
        consumes: 'current-crystal',
        produces: 'current-crystal',
        source: "the invariants named by Stage 4's promoted candidates, resolved through discovery_candidates.promoted_invariant_id",
      },
      status: classifyOutcome.status,
      detail: classifyOutcome.detail,
      remedies: classifyOutcome.remedies,
    },
    {
      id: 'validate',
      ordinal: 6,
      label: 'Validate',
      does: 'Run the validation gate — consistency, groundedness, canonical form — and receipt it.',
      capability: "POST /api/invariants/[id]/advance { action: 'validate' } → validateInvariant",
      surface: 'Invariant Registry — invariant detail',
      workKind: 'scientific',
      actor: 'Steward',
      // Validation happens BEFORE assignment (Stage 8 admits "eligible
      // VALIDATED invariants"), so a stage that measured the assigned crystal
      // could only ever report "nothing assigned yet" while the cohort it is
      // responsible for sat unvalidated. Same substitution as Stage 5, one
      // stage later.
      population: {
        consumes: 'current-crystal',
        produces: 'current-crystal',
        source: "timesValidated over the invariants named by Stage 4's promoted candidates",
      },
      status: validateOutcome.status,
      detail: validateOutcome.detail,
      remedies: validateOutcome.remedies,
    },
    {
      id: 'add-relationships',
      ordinal: 7,
      label: 'Add Relationships',
      does: 'Record the relationships that hold between crystal members.',
      capability: 'POST /api/invariants/[id]/edges → addEdge (cycle guard + contradiction quarantine)',
      surface: 'Invariant Registry — invariant detail → Related invariants',
      workKind: 'scientific',
      actor: 'Steward',
      population: {
        consumes: 'current-crystal',
        produces: 'current-crystal',
        source: "invariant_edges among the invariants named by Stage 4's promoted candidates (listEdgesForInvariants over the cohort ids)",
      },
      status: relationshipsOutcome.status,
      detail: relationshipsOutcome.detail,
      remedies: relationshipsOutcome.remedies,
    },
    {
      id: 'assign-to-crystal',
      ordinal: 8,
      label: 'Assign to Crystal',
      does: 'Admit eligible validated invariants to the ratified crystal domain.',
      capability: 'POST /api/research/crystal/[experimentId]/assign → evaluateCrystalAssignment + upsertContext',
      surface: 'Track 2 programme — guided assignment',
      workKind: 'scientific',
      actor: 'Steward — dry run first; every admission is receipted',
      // THE SECOND DECLARED TRANSFORM: the run's own cohort in, ratified
      // crystal members out. This is where the population legitimately becomes
      // the assigned crystal — and the only place it may.
      population: {
        consumes: 'current-crystal',
        produces: 'assigned-crystal',
        source: `invariant_contexts WHERE domain = '${input.crystalDomain}' — the ratified crystal domain this stage admits into`,
      },
      status: populated ? 'complete' : 'not-started',
      detail: populated
        ? `${s.readiness.invariantCount} invariant(s) in '${input.crystalDomain}'`
        : `'${input.crystalDomain}' is ratified and empty — nothing has been admitted yet`,
      remedies: remediesFor('assign-to-crystal', s.readiness),
    },
    {
      id: 'run-readiness',
      ordinal: 9,
      label: 'Run Readiness',
      does: 'Assess the constituted crystal against the nine intrinsic readiness checks.',
      capability: 'GET /api/research/crystal/[experimentId] → runCrystalReadinessReport',
      surface: 'Independent Review panel',
      workKind: 'scientific',
      actor: 'The originating team — it diagnoses its own checks',
      // The readiness engine assesses the ASSIGNED crystal and nothing else,
      // so this is the first stage whose remedies may legitimately quote it.
      population: {
        consumes: 'assigned-crystal',
        produces: 'assigned-crystal',
        source: `runCrystalReadinessReport over domain '${input.crystalDomain}', status validated|canonical`,
      },
      // READY FOR FREEZE (`s.readiness.ok`) depends only on the
      // `scientific-readiness`-tier checks — `scientific-maturity` checks
      // (structural-diversity, graph-connectivity) are informational and
      // never block this stage's completion (operator ruling, 2026-08-05:
      // "Can this crystal be frozen? Is this crystal scientifically ideal?
      // Those are not the same question.").
      status: !populated ? 'not-started' : s.readiness.ok ? 'complete' : 'in-progress',
      detail: populated
        ? s.readiness.ok
          ? `all scientific-readiness checks pass — maturity ${s.readiness.maturity.passedCount}/${s.readiness.maturity.totalCount} (${s.readiness.maturity.band})`
          : `${s.readiness.checks.filter((c) => c.tier === 'scientific-readiness' && !c.passed).length}/${s.readiness.checks.filter((c) => c.tier === 'scientific-readiness').length} scientific-readiness checks failing`
        : 'nothing to assess yet',
      remedies: remediesFor('run-readiness', s.readiness),
    },
    {
      id: 'prepare-independent-review',
      ordinal: 10,
      label: 'Prepare Independent Review',
      does: 'Open the independent pre-freeze review — only over a populated crystal that has passed readiness.',
      capability: 'crystalReviewStageStatus → independentReviewRequestOpen',
      surface: 'Independent Review panel',
      workKind: 'governance',
      actor: 'An external reviewer',
      population: {
        consumes: 'assigned-crystal',
        produces: 'assigned-crystal',
        source: 'crystalReviewStageStatus over the same assigned crystal the readiness report assessed',
      },
      // 'partially-complete', not 'in-progress' (al, EXP PP1 Track 2,
      // 2026-08-05): independent review is OPTIONAL to freeze —
      // `checkFreezeGate` never requires it, and `crystalFreezeCeremony`
      // already treats a missing reviewerRef as "reported, never hidden."
      // Stage 10 being merely ELIGIBLE (not necessarily attempted, and
      // never blocked on a reviewer transport failure such as an HTTP
      // 504) is enough for Stage 11 to be workable — the same
      // "produced something to work on" logic PASSES_THROUGH already
      // applies everywhere else in this file. Leaving this at
      // 'in-progress' forever was the actual bug: it silently withheld
      // Stage 11 from `unblockedStageIds` no matter what the reviewer
      // call did, so an infrastructure timeout on Stage 10 LOOKED LIKE a
      // constitutional block on Freeze when nothing downstream ever
      // checked review status at all.
      status: s.independentReviewRequestOpen ? 'partially-complete' : populated ? 'blocked' : 'not-started',
      detail: s.independentReviewRequestOpen
        ? 'the independent pre-freeze review may open — optional; a reviewer transport failure never blocks Freeze'
        : populated
          ? 'readiness has not passed — this is internal diagnostic work, not a reviewer’s to assess'
          : 'nothing to review yet',
      remedies: s.independentReviewRequestOpen
        ? []
        : populated
          ? ['Complete the failing readiness checks first. Sending a failing crystal to an external reviewer spends their independence diagnosing our checks.']
          : [],
    },
    {
      id: 'freeze',
      ordinal: 11,
      label: 'Freeze',
      does: 'Provision the crystal-version artifact, then perform the freeze as an explicit governed act.',
      capability: 'POST /api/research/crystal/[experimentId]/freeze → upsertArtifact / freezeArtifact',
      surface: 'Track 2 programme — freeze ceremony',
      workKind: 'governance',
      actor: 'The operator, by their own act',
      population: {
        consumes: 'assigned-crystal',
        produces: 'assigned-crystal',
        source: 'the persisted crystal-version artifact over the assigned crystal — the freeze package carries the full PopulationDisclosure',
      },
      status:
        s.artifact?.lifecycle === 'frozen'
          ? 'complete'
          : s.lifecycle.stageId === 'READY_FOR_FREEZE'
            ? s.artifact
              ? 'in-progress'
              : 'blocked'
            : 'not-started',
      detail:
        s.artifact?.lifecycle === 'frozen'
          ? 'the crystal is frozen — its content is fixed and receipted'
          : s.artifact
            ? `crystal-version artifact is at '${s.artifact.lifecycle}'`
            : 'no crystal-version artifact has been provisioned',
      remedies:
        s.artifact?.lifecycle === 'frozen'
          ? []
          : s.lifecycle.stageId === 'READY_FOR_FREEZE' && !s.artifact
            ? ['Provision the crystal-version artifact before ratifying (action: "provision"). Nothing is frozen by provisioning.']
            : s.lifecycle.stageId !== 'READY_FOR_FREEZE'
              ? [`A freeze is not the next act at this stage — ${s.lifecycle.whatIsMissing ?? 'earlier stages are outstanding'}`]
              : [],
    },
  ];

  const current = stages.find((st) => st.status !== 'complete') ?? stages[stages.length - 1];

  // A stage may proceed when every EARLIER stage has produced something for it
  // to work on — `complete` or `partially-complete`. `partially-complete`
  // counting as "may proceed" is the entire point: it is what stops three
  // unresolved sources from withholding extraction of the twenty-nine already
  // admitted (exception-isolation ruling §6).
  const PASSES_THROUGH: ReadonlySet<Track2StageStatus> = new Set(['complete', 'partially-complete']);
  const unblockedStageIds = stages
    .filter((st) => stages.every((earlier) => earlier.ordinal >= st.ordinal || PASSES_THROUGH.has(earlier.status)))
    .map((st) => st.id);

  // The continuity check runs over the stages AS BUILT, so a stage added later
  // with a mis-declared population is caught by the programme that contains it
  // rather than by a reviewer noticing.
  const handovers = handover ? [handover] : [];
  const breaches = handovers.map(handoverBreach).filter((b): b is string => b !== null);
  const populationContinuity = {
    breaks: checkPopulationContinuity(stages),
    handovers,
    breaches,
  };

  // THE RECONCILIATION BOARD'S DATA (al, 2026-08-04) — present whenever there
  // is a cohort to reconcile at all, whether or not anything is currently
  // unaccounted, so the board can also render "reconciliation complete".
  const reconciliation: Track2Programme['reconciliation'] =
    cohort && handover
      ? {
          crystalId: input.experimentId,
          fromStageId: 'review-and-promote',
          toStageId: 'classify-provenance',
          declaredOut: handover.declaredOut,
          received: handover.received,
          explicitlyExcluded: cohort.excluded.length,
          unaccountedRecords: cohort.unaccountedRecords,
        }
      : null;

  const actionQueues: Track2Programme['actionQueues'] = cohort
    ? {
        crystalId: input.experimentId,
        unclassified: cohort.unclassifiedRecords,
        unvalidated: cohort.unvalidatedRecords,
        orphans: cohort.orphanRecords,
        members: cohort.members,
      }
    : null;

  return {
    experimentId: input.experimentId,
    crystalDomain: input.crystalDomain,
    stages,
    currentStageId: current.id,
    unblockedStageIds,
    populationContinuity,
    reconciliation,
    actionQueues,
    // A discontinuity is the FIRST thing to act on: every count downstream of
    // it is about a subject nobody has agreed on. It leads `nextActions` ahead
    // of the current stage's own remedies.
    nextActions: [
      ...breaches,
      ...populationContinuity.breaks.map((b) => b.detail),
      ...(current.remedies.length > 0 ? current.remedies : [current.detail]),
    ],
    derivationNote: DERIVATION_NOTE,
  };
}
