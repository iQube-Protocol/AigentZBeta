/**
 * THE RESEARCH PROGRAMME ORCHESTRATOR — Track 2's advance-until-human-gate loop
 * (operator ruling, 2026-08-26).
 *
 *   > "Identify the next safe executable acts, execute existing capabilities
 *   >  through a bounded server-side advance-until-human-gate loop, isolate
 *   >  record-local exceptions, and stop only for explicit constitutional
 *   >  authority or genuine global integrity failure."
 *
 *   > "The operator should interact only with consolidated governance decisions
 *   >  and the final freeze; all scientific and clerical work that can be safely
 *   >  automated should proceed automatically and be receipted."
 *
 * ── What this module is, and is emphatically not ────────────────────────────
 *
 * It is GLUE, in exactly the register `services/financialServices/
 * serviceRequestOrchestrator.ts` established: it sequences a lifecycle by
 * calling ONLY existing, frozen modules, and it computes no readiness,
 * eligibility, population, isolation, lifecycle or authority decision of its
 * own.
 *
 *   projection      services/research/track2Programme.ts   (`unblockedStageIds`)
 *   isolation       services/research/exceptionIsolation.ts (`summarizeIsolation`)
 *   cohort          services/research/populationReconciliation.ts
 *   readiness       services/research/crystalReadiness.ts   (read, never re-tiered)
 *   lifecycle       services/research/crystalDomains.ts
 *   extraction      services/invariants/discoveryEngine.ts  (`runConstitutionalDiscovery`)
 *   validation      services/invariants/lifecycle.ts        (`validateInvariant`)
 *   receipts        services/research/lifecycle.ts          (`writeLifecycleReceipt`)
 *
 * **It stores no stage state.** `track2Programme.ts`'s header forbids a stored
 * `currentStage`, and that prohibition binds a loop over the projection exactly
 * as it binds the projection itself: this loop keeps NO cursor. After every act
 * it RE-READS the programme from the substrate and asks again which stages are
 * unblocked. That is what makes it an *advance-until* loop rather than a fixed
 * script, and it is why acting through any underlying surface mid-run is
 * reflected immediately instead of being overwritten.
 *
 * ── THE BOUNDARY THAT WAS NOT MOVED ─────────────────────────────────────────
 *
 * `IRLResearchCopilotTab`'s `RunStageCard` states: *"Running is EXECUTED in
 * metaMe IRL (the EXP-001…005 runner tabs) — not here. Execution stays in the
 * lab; the copilot never runs an experiment."* **That boundary is intact.** An
 * EXPERIMENT RUN and a TRACK 2 PROGRAMME ACT are different objects: this module
 * runs programme acts (extraction over admitted evidence, the validation gate
 * over the promoted cohort) and never invokes an experiment runner. Nothing here
 * publishes a canonical result, and nothing here advances an experiment
 * lifecycle.
 *
 * ── THE FREEZE IS THE HARD STOP ─────────────────────────────────────────────
 *
 * EXP-P1's Crystal vP1 IS FROZEN — it was reviewed as a frozen, hash-verified
 * package, and the operator has refused to modify the frozen artifact: its hash
 * and the readiness results that admitted it stand exactly as reviewed. The
 * remediation lineage is:
 *
 *   prior crystal frozen → external review → instrument remediation →
 *   retrospective falsification of the prior crystal → corpus/extraction
 *   remediation → successor candidate → corrected readiness → successor freeze
 *   → independent re-review
 *
 * **This orchestrator drives the MIDDLE of that chain and must never touch
 * either end.** It never calls `freezeArtifact`, never posts
 * `action: 'freeze'`, and never provisions a crystal-version artifact. The
 * freeze route's own words — *"There is deliberately no single call that does
 * both"* — are a statement about the operator's two acts, not an invitation for
 * a third party to perform either. `tests/research-programme-orchestrator.test.ts`
 * greps this module and fails the build if a freeze action value, the freeze
 * route path, or `freezeArtifact` ever appears in it.
 *
 * ── TWO SHORTCUTS THE OPERATOR EXPLICITLY REFUSED (2026-08-26) ──────────────
 *
 *   > "We will not manually rewrite the 15 statements into stronger invariants.
 *   >  That would contaminate the experiment."
 *
 *   > "We will not silently narrow the 15-namespace boundary simply to fit the
 *   >  material we happened to acquire."
 *
 * Both are exactly what an over-eager automation reaches for, so both are
 * structural here rather than advisory. The act catalogue (`PROGRAMME_ACT_KINDS`)
 * is a CLOSED union of two acts, neither of which can author, edit or re-tag an
 * invariant statement, and neither of which can alter a ratified namespace
 * boundary. Narrowing the boundary is a separate governance decision: if a
 * remediation instrument ever concludes the boundary is too broad, that reaches
 * the operator as a governance stop, never as an applied act. The canary asserts
 * this module imports no statement-mutating or domain-mutating capability.
 *
 * Server-side only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { summarizeAcquisitionSourceUniverse } from '@/services/corpusScout/domainConstitution';
import {
  listCandidates,
  listEvidence,
  runConstitutionalDiscovery,
  type CandidateRow,
  type EvidenceRow,
  type DiscoveryClass,
  type AbstractionLevel,
  type DiscoveryScopeLevel,
  type CompareClassification,
  type ConvergenceInfo,
  type RecurrenceInfo,
} from '@/services/invariants/discoveryEngine';
import { findDuplicates } from '@/services/invariants/comparison';
import { discoveryNamespace } from '@/services/invariants/discoveryDomains';
import { validateInvariant } from '@/services/invariants';
import {
  currentCrystalArtifactId,
  getCurrentCrystalArtifact,
} from '@/services/research/artifacts';
import {
  resolveFrozenPredecessorContext,
  isSuccessorScopedCandidate,
} from '@/services/research/crystalCohortMembership';
import {
  acquisitionBriefApplies,
  buildCrystalAcquisitionBrief,
  type CrystalAcquisitionBrief,
} from '@/services/research/crystalAcquisitionBrief';
import { getActiveAcquisitionApproval } from '@/services/research/crystalAcquisitionJob';
import {
  crystalDeclarationHash,
  crystalDomainForExperiment,
  crystalLifecycleStage,
  crystalReviewStageStatus,
  domainAcceptsAssignment,
  type CrystalDomainDeclaration,
  type CrystalLifecycle,
} from '@/services/research/crystalDomains';
import { runCrystalReadinessReport, type CrystalReadinessReport } from '@/services/research/crystalReadiness';
import {
  buildCriticalPath,
  summarizeIsolation,
  type CriticalPath,
  type DispositionAssignment,
  type GlobalStop,
  type IsolationException,
  type IsolationSummary,
  type PopulationDisclosure,
} from '@/services/research/exceptionIsolation';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import { reconcilePromotedCohort, type ReconciledPromotedCohort } from '@/services/research/populationReconciliation';
import {
  buildTrack2Programme,
  buildTrack2DeepLink,
  type Track2DeepLink,
  type Track2Programme,
  type Track2Stage,
  type Track2StageId,
} from '@/services/research/track2Programme';
import {
  BOUND_CRYSTAL_REMEDIATION_PROFILES,
  remediationProfileBindingState,
  type CrystalRemediationProfile,
  type RemediationProfileBinding,
} from '@/types/crystalRemediation';

/** The acquisition domain upstream of the crystal — the SAME default the Track 2
 *  GET route declared, kept here because the shared signal loader below is now
 *  the one place that reads it. Never guessed from the crystal domain (they are
 *  different namespaces). */
export const DEFAULT_ACQUISITION_DOMAIN = 'financial-services';

// ── THE REMEDIATION PROFILE — CONSUMED AS CONFIGURATION, NEVER INTERPRETED ──

/**
 * THE SHARED OBJECT, and who owns it.
 *
 * `CrystalRemediationProfile` (`types/crystalRemediation.ts`) is the ONE
 * versioned object both tracks converge on (operator ruling, 2026-08-26):
 *
 *   > "I'd also have both tracks converge on one versioned
 *   >  `CrystalRemediationProfile` object so the orchestrator never reads loose
 *   >  reviewer prose or infers thresholds itself… Once that object is frozen,
 *   >  the orchestrator can safely consume it as configuration rather than
 *   >  interpretation."
 *
 * **That type is DEFINED BY TRACK 2 and imported here — this module does not
 * define a second one.** It carries the bound source refs, the check mappings,
 * the task-derived population formula, the boundary requirement and the
 * instrument suite identity, plus the profile version and its binding state.
 * It lives in `types/` so neither track has to import the other's service to
 * read a shape.
 *
 * ── What this module does with it, exactly ──────────────────────────────────
 *
 * It reads ONE fact: is the profile `bound`? And it reads that fact through
 * Track 2's own derivation, `remediationProfileBindingState`, which recomputes
 * the binding from the profile's contents rather than trusting a stored claim.
 * The binding state already encodes both preconditions the sequencing gate
 * needs — a complete, executable profile AND a retrospective that reproduced
 * the reviewer's objections — so this module re-derives neither.
 *
 * **It never parses reviewer prose. It never infers a threshold. It never
 * evaluates the population derivation.** `TaskDerivedPopulationFormula` carries
 * the arithmetic and Track 2's evaluated `minimumCollectionSize`; recomputing it
 * here would make this module a second implementation of an instrument Track 2
 * owns, and the two would disagree the first time the evaluation slice changed.
 * Track 2 owns `crystalReadiness.ts` and every `crystal*` instrument module;
 * this module must not modify any of them.
 *
 * ── No profile is bound ─────────────────────────────────────────────────────
 *
 * `BOUND_CRYSTAL_REMEDIATION_PROFILES` is empty, and that emptiness is a real
 * read rather than a placeholder: no authoritative review artifact has been
 * ingested, because a review pasted into a conversation has no locator and no
 * content hash and therefore cannot be re-read or verified. So the gate below
 * is closed. Nothing in this module names a reviewer, a review number or a
 * finding — one named review must be REPRESENTABLE, never PRIVILEGED.
 */

// ── THE MEASUREMENT-LAYER GATE — the objective may not outrun the instruments ─

/**
 * THE HARD SEQUENCING GATE (operator ruling, 2026-08-26).
 *
 *   > "Do not let the orchestrator outrun the hardened measurement layer. Track
 *   >  1 may build and test its control loop, but the prepare-crystal-v2
 *   >  objective should stop before new extraction or crystal construction until
 *   >  Track 2 has produced a versioned remediation profile whose gates are
 *   >  executable and the vP1 retrospective test has passed."
 *
 * The required chain, verbatim:
 *
 *   orchestrator ready → hardened instruments ready → retrospective vP1
 *   falsification passes → remediation profile bound/frozen → v2 autonomous
 *   execution unlocked
 *
 *   > "That prevents automation from outrunning epistemic assurance."
 *
 * ── A DIFFERENT KIND OF STOP ───────────────────────────────────────────────
 *
 * This is deliberately NOT folded into the governance stop. A governance stop
 * awaits an operator DECISION; this one awaits an ENGINEERING DELIVERABLE. The
 * operator can do nothing about it by deciding, so presenting it as a decision
 * would be the "exception terminates in navigation" defect wearing a
 * constitutional face. It gets its own member of the stop-reason union
 * (`blocked-on-measurement-layer`) and names what is outstanding.
 *
 * ── FAIL FAITHFUL ──────────────────────────────────────────────────────────
 *
 * `null` means the substrate could not be read, and an unreadable precondition
 * is NOT a satisfied one — the discipline
 * `services/journey/nextConstitutionalAct.ts` states as *"a `null` fact never
 * collapses to `false`"*, applied in the only direction that is safe here: a
 * fact we cannot read can never open the gate. The gate is closed by absence,
 * by unreadability, and by any binding state other than `bound`. It opens on
 * nothing else.
 *
 * ── The inverted sense of the retrospective, restated ───────────────────────
 *
 * The retrospective PASSES when the hardened instruments **REJECT** the frozen
 * artifact the reviewer rejected. Track 2's type names the field
 * `reproducedReviewerObjections` rather than `ok` for exactly this reason, and
 * nothing here renames it — a gate that read that field as "the crystal is
 * fine" would invert the entire sequencing rule.
 */
export interface MeasurementLayerReadiness {
  /** The profile governing this experiment, or `null` when none is ingested /
   *  the substrate could not be read. */
  profile: CrystalRemediationProfile | null;
  /**
   * `false` means the profile substrate could not be read AT ALL — different
   * from "read successfully, and there is none". Both close the gate; only one
   * is a defect to chase.
   */
  profileReadable: boolean;
}

export interface MeasurementLayerGate {
  satisfied: boolean;
  /** Track 2's own binding state, verbatim. `null` when nothing was read. */
  binding: RemediationProfileBinding | null;
  /** Every reason the profile is not bound, from Track 2's derivation. */
  gaps: readonly string[];
  /** The profile version the gate read, or `null`. Carried so a run report says
   *  WHICH configuration it was gated by. */
  profileVersion: string | null;
  detail: string;
}

/**
 * Pure. The gate is Track 2's binding derivation and nothing else — this
 * function adds no judgment of its own, which is the point: a second opinion
 * about whether a profile is bound is a second gate.
 */
export function evaluateMeasurementLayerGate(readiness: MeasurementLayerReadiness): MeasurementLayerGate {
  if (!readiness.profileReadable) {
    return {
      satisfied: false,
      binding: null,
      gaps: ['the remediation-profile substrate could not be read — unreadable is not satisfied'],
      profileVersion: null,
      detail:
        'new acquisition, extraction and crystal construction are blocked: the remediation-profile substrate ' +
        'could not be read, and an unreadable precondition is never a satisfied one',
    };
  }
  const profile = readiness.profile;
  if (!profile) {
    return {
      satisfied: false,
      binding: 'unbound-no-artifact',
      gaps: [
        'no CrystalRemediationProfile is bound for this experiment — no authoritative review artifact has ' +
          'been ingested, and a review pasted into a conversation is not an artifact (it has no locator and ' +
          'no content hash, so it cannot be re-read or verified)',
      ],
      profileVersion: null,
      detail:
        'new acquisition, extraction and crystal construction are blocked until a versioned ' +
        'CrystalRemediationProfile is bound and its retrospective has reproduced the reviewer’s objections',
    };
  }
  // DERIVED, never read off `profile.binding` — a profile must not be able to
  // claim `bound` while carrying a gap.
  const derived = remediationProfileBindingState(profile);
  const satisfied = derived.binding === 'bound';
  return {
    satisfied,
    binding: derived.binding,
    gaps: derived.bindingGaps,
    profileVersion: profile.profileVersion,
    detail: satisfied
      ? `the measurement layer is hardened and demonstrated under bound profile '${profile.profileVersion}' — ` +
        'v2 acquisition and extraction may proceed'
      : `new acquisition, extraction and crystal construction are blocked — profile ` +
        `'${profile.profileVersion}' is '${derived.binding}': ${derived.bindingGaps.join(' · ')}`,
  };
}

/**
 * THE ONE WIRING POINT for the profile read.
 *
 * Reads Track 2's own registry (`BOUND_CRYSTAL_REMEDIATION_PROFILES`) and
 * selects the profile governing this experiment. The registry is a module
 * constant, so the read always succeeds — `profileReadable` is `true` and an
 * empty registry honestly means "no profile is bound" rather than "we could not
 * tell". Both close the gate; distinguishing them is what lets a reader tell a
 * missing artifact from a broken reader.
 *
 * When Track 2 moves the registry behind a store, ONLY this function body
 * changes. No caller changes, no gate logic changes, and the canary asserting
 * that an acquisition-class act cannot run behind a closed gate keeps holding
 * either way.
 */
export async function resolveMeasurementLayerReadiness(
  experimentId: string,
): Promise<MeasurementLayerReadiness> {
  const profile =
    BOUND_CRYSTAL_REMEDIATION_PROFILES.find((p) => p.experimentId === experimentId) ?? null;
  return { profile, profileReadable: true };
}

// ── THE SHARED SIGNAL COMPOSITION — one loader, two callers ─────────────────

export interface Track2ProgrammeState {
  experimentId: string;
  acquisitionDomain: string;
  declaration: CrystalDomainDeclaration;
  declarationHash: string;
  programme: Track2Programme;
  readiness: CrystalReadinessReport;
  lifecycle: CrystalLifecycle;
  reviewStage: ReturnType<typeof crystalReviewStageStatus>;
  /** Stages 5–7's population, as resolved for this read. `null` = unreadable. */
  cohort: ReconciledPromotedCohort | null;
  /** The raw signal counts, carried so the population disclosure is built from
   *  the SAME read the programme was built from rather than a second query. */
  signalCounts: {
    candidateSources: { total: number; pendingReview: number; admitted: number } | null;
    discoveryCandidates: { total: number; awaitingReview: number; promoted: number } | null;
  };
  /** Which signals could not be read at all — named, never silently zeroed. */
  unreadableSignals: string[];
  /**
   * THE OUTSTANDING HUMAN/GOVERNANCE GATE, if any — recomputed from
   * `programme` on every read via `firstPendingDecision` (2026-08-26).
   * `null` means every unblocked stage is either complete or machine-runnable
   * right now; it does NOT mean the programme is finished. A caller must
   * treat this as authoritative on every read, including a plain GET/mount —
   * never only after a `POST .../advance` run.
   */
  pendingDecision: PendingGovernanceDecision | null;
}

/**
 * COMPOSE THE TRACK 2 SIGNALS AND BUILD THE PROGRAMME — the ONE loader.
 *
 * This composition previously lived inline in `GET /api/research/track2/
 * [experimentId]`. The orchestrator needs the identical composition on every
 * loop iteration, and a second copy would be the stale one the first time a
 * signal changes (`inv.engineering.036`/`037`). So the route now calls THIS
 * function, and so does the loop — one read model, one set of fail-soft rules,
 * and the loop can never disagree with the surface the operator is looking at.
 *
 * Fail-soft is preserved exactly: an unreadable upstream signal becomes `null`,
 * which the programme renders as `unknown` — never `complete`, never `blocked`.
 * `unreadableSignals` names each one, because a count of zero derived from an
 * unreadable substrate and a count of zero that is genuinely zero are different
 * facts.
 */
export async function loadTrack2ProgrammeState(input: {
  experimentId: string;
  acquisitionDomain?: string;
  /** Optional instrumentation sink (2026-08-30, "empty 504" repair) — when
   *  supplied, `readiness` is timed SEPARATELY from the rest of this
   *  function's own composition work, per the operator's explicit request to
   *  distinguish those two phases. Omitted entirely by the plain GET route,
   *  which has no timing budget to protect and no diagnostics contract to
   *  extend — this stays additive, never a second read model. */
  timer?: PhaseTimer;
}): Promise<Track2ProgrammeState | { error: string; status: 404 }> {
  const declaration = crystalDomainForExperiment(input.experimentId);
  if (!declaration) {
    return {
      error: `no crystal domain is declared for experiment '${input.experimentId}'`,
      status: 404,
    };
  }
  const acquisitionDomain = input.acquisitionDomain?.trim() || DEFAULT_ACQUISITION_DOMAIN;

  const admin = getSupabaseServer();
  const readiness = input.timer
    ? await input.timer.time('readiness', () =>
        runCrystalReadinessReport({ experimentId: input.experimentId, crystalDomain: declaration.domain }),
      )
    : await runCrystalReadinessReport({
        experimentId: input.experimentId,
        crystalDomain: declaration.domain,
      });
  // Marks the start of "programme-state derivation" (everything in this
  // function OTHER than readiness, timed separately above) — recorded at the
  // function's return points below, since the branching between here and
  // there is awkward to wrap in one closure.
  const restStart = input.timer?.now() ?? 0;

  // Best-effort, fail-soft. `null` becomes `unknown`, never `complete`.
  const [sources, candidates, artifact, frozenContext, acquisitionSourceUniverse] = await Promise.all([
    admin ? listCandidateSources(admin, { campaignDomain: acquisitionDomain }).catch(() => null) : null,
    admin ? listCandidates(admin, acquisitionDomain).catch(() => null) : null,
    // Lineage-safe (operator ruling 2026-08-27, "Crystal v1/v2 lineage
    // collision"): NEVER the plain first-match `getArtifact` lookup, which
    // cannot tell a frozen predecessor from the active successor candidate —
    // see currentCrystalArtifactId's doc comment. Still a pure read; this
    // module's freeze-canary is untouched (it forbids upsertArtifact/
    // freezeArtifact/action:'freeze', none of which this calls).
    getCurrentCrystalArtifact(input.experimentId).catch(() => null),
    // The frozen predecessor generation + its domain-recovered manifest, if
    // one exists — services/research/crystalCohortMembership.ts, the ONE
    // shared resolver every cohort-consuming route now uses (2026-08-31,
    // "successor cohort vs successor Crystal" operator ruling). Moved here
    // verbatim from this module's own inline block; behaviour unchanged.
    resolveFrozenPredecessorContext(input.experimentId),
    // The acquisition domain's ratified/verified institution counts
    // (2026-08-31, "targeted-acquisition domain/source-universe handoff"
    // repair) — lets Stage 1's own derivation distinguish "nothing ratified
    // yet" from "ratified but unverified" (a valid targeted-acquisition
    // approval can exist while this is empty) rather than collapsing both
    // into a generic "not started". Read over the SAME `acquisitionDomain`
    // every other acquisition surface (Stage 2, the Copilot, run-step)
    // already resolves — one canonical domain, never a second guess.
    admin ? summarizeAcquisitionSourceUniverse(admin, acquisitionDomain).catch(() => null) : null,
  ]);

  const unreadableSignals: string[] = [];
  if (!admin) unreadableSignals.push('supabase (no server client) — candidate sources and discovery candidates');
  if (admin && !sources) unreadableSignals.push('corpus_candidate_sources');
  if (admin && !candidates) unreadableSignals.push('discovery_candidates');
  if (admin && !acquisitionSourceUniverse) unreadableSignals.push('corpus_institutional_registry (acquisition source universe)');
  if (frozenContext.frozenPredecessor && !frozenContext.frozenGenerationMemberIds) {
    unreadableSignals.push('frozen predecessor crystal manifest (frozen-generation boundary)');
  }

  const candidateSources = sources
    ? {
        total: sources.length,
        pendingReview: sources.filter((s) => s.reviewWorkflowStatus === 'pending_review').length,
        admitted: sources.filter((s) => Boolean(s.evidenceRowId)).length,
      }
    : null;

  /**
   * THE SUCCESSOR-SCOPE PREDICATE (2026-08-30, "Stage 3→4 handoff gap" fix;
   * moved into services/research/crystalCohortMembership.ts 2026-08-31 so
   * every cohort-consuming route shares it) — this is the ONE predicate
   * Stage 3's `total`, Stage 4's `awaitingReview` AND Stage 4's `promoted`
   * are all narrowed through — so a candidate cannot appear in Stage 3's
   * count while being invisible to Stage 4's. No row is deleted, relabeled,
   * or promoted by it; it is read-only.
   */
  const successorScopedCandidates = candidates
    ? candidates.filter((c) => isSuccessorScopedCandidate(c, frozenContext))
    : null;
  const promotedForConstruction = successorScopedCandidates
    ? successorScopedCandidates.filter((c) => c.status === 'promoted')
    : null;

  const discoveryCandidates = successorScopedCandidates
    ? {
        total: successorScopedCandidates.length,
        awaitingReview: successorScopedCandidates.filter((c) => c.status === 'candidate').length,
        promoted: promotedForConstruction?.length ?? 0,
        // Exhaustive over CandidateRow['status'] ('candidate' | 'promoted' |
        // 'rejected'), all four counted from this SAME successor-scoped
        // array — so `total === awaitingReview + promoted + rejected`
        // holds by construction and Stage 3/4's own detail text can name it.
        rejected: successorScopedCandidates.filter((c) => c.status === 'rejected').length,
      }
    : null;

  // Stages 5–7 read STAGE 4's OWN OUTPUT, resolved from the SAME
  // `promotedForConstruction` set Stage 4's own `promoted` count above is
  // counted from — so the two cannot be about different sets, and neither
  // can ever include a candidate already resolved into the frozen
  // predecessor's own manifest.
  const cohort = promotedForConstruction
    ? await reconcilePromotedCohort(
        promotedForConstruction,
        admin
          ? {
              admin,
              experimentId: input.experimentId,
              // The target-Crystal membership universe's inherited half
              // (operator ruling, 2026-08-31): a successor member's edge to
              // one of these counts toward Stage 7 exactly like an edge to
              // another successor member. `undefined` when there is no
              // frozen predecessor or its manifest is unreadable — falls
              // back to intra-successor-cohort-only, never silently widens.
              inheritedMemberIds: frozenContext.frozenGenerationMemberIds ?? undefined,
            }
          : undefined,
      ).catch(() => null)
    : null;
  if (promotedForConstruction && !cohort) unreadableSignals.push('promoted cohort (reconcilePromotedCohort)');

  const lifecycle = crystalLifecycleStage({
    domainRatified: declaration.ratification === 'ratified',
    invariantCount: readiness.invariantCount,
    readinessOk: readiness.ok,
    // Read off the persisted artifact — never inferred from readiness.
    frozen: artifact?.lifecycle === 'frozen',
  });

  const reviewStage = crystalReviewStageStatus({
    invariantCount: readiness.invariantCount,
    readinessOk: readiness.ok,
  });

  const programme = buildTrack2Programme({
    experimentId: input.experimentId,
    crystalDomain: declaration.domain,
    acquisitionDomain,
    signals: {
      candidateSources,
      discoveryCandidates,
      promotedCohort: cohort,
      readiness,
      lifecycle,
      artifact: artifact ? { id: artifact.id, lifecycle: artifact.lifecycle } : null,
      independentReviewRequestOpen: reviewStage.independentReviewRequestOpen,
      acquisitionSourceUniverse,
    },
  });

  let pendingDecision =
    firstPendingDecision(programme) ??
    (await buildAcquisitionPendingDecision({
      programme,
      declaration,
      readiness,
      artifact,
      admin: admin ?? null,
      acquisitionDomain,
      acquisitionSourceUniverse,
    }));

  // THE REVIEW & PROMOTE QUEUE (2026-08-30) — enriches the SAME decision
  // object `firstPendingDecision` already returns for this stage (Stage 4 is
  // unconditionally human-gated via `HUMAN_GATED_STAGE_IDS`, so it is never
  // the `buildAcquisitionPendingDecision` fallback path). Reuses
  // `successorScopedCandidates`, computed above for Stage 3/4's own counts —
  // never a second candidate query, and never a candidate outside that
  // successor-scoped set (the vP1/historical exclusion this stage's counts
  // already enforce carries through unchanged).
  if (pendingDecision?.stageId === 'review-and-promote' && successorScopedCandidates) {
    const awaitingCandidates = successorScopedCandidates.filter((c) => c.status === 'candidate');
    if (awaitingCandidates.length > 0) {
      const reviewQueue = await buildReviewAndPromoteQueue(admin, awaitingCandidates);
      pendingDecision = { ...pendingDecision, reviewQueue };
    }
  }

  if (input.timer) input.timer.record('programme-state-derivation', input.timer.now() - restStart);

  return {
    experimentId: input.experimentId,
    acquisitionDomain,
    declaration,
    declarationHash: crystalDeclarationHash(declaration),
    programme,
    readiness,
    lifecycle,
    reviewStage,
    cohort,
    signalCounts: { candidateSources, discoveryCandidates },
    unreadableSignals,
    pendingDecision,
  };
}

// ── HUMAN GATES — three independent signals, none of them guessed ───────────

/**
 * THE STAGES THE OPERATOR MUST PERFORM — recorded from an existing operator
 * ruling, not inferred.
 *
 * ── Why this is a named set and not a derivation ────────────────────────────
 *
 * The obvious derivation is `Track2Stage.actor`: Stage 2's actor reads
 * *"Steward — approval is never automatic (PRD-ICA-001 §6/§11)"*, which a string
 * test catches. But Stage 4 (`review-and-promote`) and Stage 8
 * (`assign-to-crystal`) carry the BARE actor `'Steward'` — the same bare string
 * Stage 6 (`validate`) carries, and Stage 6 is machine-runnable. So the actor
 * string does not separate them, and inventing a rule that appears to would be a
 * guess dressed as a derivation.
 *
 * What DOES separate them is already recorded in this repository, verbatim, as
 * an operator ruling — `tests/track2-steward-workflow.test.ts`'s own header:
 *
 *   > "no automatic admission · no automatic promotion · no automatic validation
 *   >  no automatic assignment · no automatic freeze · every governance act
 *   >  explicit, receipted and attributable"
 *
 * Stages 5 and 7 are here for a second recorded reason: their own routes say the
 * work is per-record HUMAN CONTENT.
 * `POST …/validate-all`'s header contrasts itself against them —
 * *"Unlike Stage 5's classification (a per-record human judgment: which
 * evidence-provenance class, cited from which sources) and Stage 7's
 * relationships (a per-record human claim: which other invariant, related
 * how)… those two stay per-record queues for exactly that reason."*
 *
 * ── How "no automatic validation" and an automatic validate act coexist ────
 *
 * They coexist because the operator's act is what authorises the run. Pressing
 * *Run until you need me* is one explicit, receipted, attributable steward act,
 * and `validateInvariant` carries no per-record human content —
 * `POST …/validate-all` already exists on exactly that reasoning. Admission,
 * promotion, classification, relationship claims, assignment rationales and the
 * freeze signature all DO carry per-record or per-act human content, so no
 * blanket authorisation can stand in for them.
 *
 * ── Additions ──────────────────────────────────────────────────────────────
 *
 * A NEW stage does not need to be added here to be safe: `isHumanGatedStage`
 * ORs this set with `workKind === 'governance'` and with a generic actor-string
 * test, so a stage that declares its own human authority is gated whether or not
 * anyone remembers to extend the set. The set exists for the three stages whose
 * gate is recorded in a ruling rather than in their own text.
 */
export const HUMAN_GATED_STAGE_IDS: ReadonlySet<Track2StageId> = new Set<Track2StageId>([
  'review-and-admit',
  'review-and-promote',
  'classify-provenance',
  'add-relationships',
  'assign-to-crystal',
  'prepare-independent-review',
  'freeze',
]);

/**
 * A stage whose own `actor` text DECLARES a human authority. Belt-and-braces
 * beside `HUMAN_GATED_STAGE_IDS`: a stage added later that says so in its own
 * words is gated without anyone editing the set above.
 *
 * These are substrings of `actor` strings that EXIST in `track2Programme.ts`
 * today — *"approval is never automatic"*, *"by their own act"*, *"is refused"*
 * — plus the two phrasings the same author would plainly use next. No phrase
 * here is a guess about a stage's meaning: each one is read as "this stage says
 * a human decides", which is precisely what it says.
 */
const HUMAN_AUTHORITY_ACTOR_PHRASES: readonly string[] = [
  'never automatic',
  'by their own act',
  'is refused',
  'human act',
  'explicit steward',
];

export function declaresHumanAuthority(actor: string): boolean {
  const lowered = actor.toLowerCase();
  return HUMAN_AUTHORITY_ACTOR_PHRASES.some((phrase) => lowered.includes(phrase));
}

/** The three signals, ORed. `workKind === 'governance'` is the operator's own
 *  scientific/governance split; the other two catch a scientific stage whose
 *  work is nonetheless a human decision. */
export function isHumanGatedStage(stage: Track2Stage): boolean {
  return (
    stage.workKind === 'governance' ||
    HUMAN_GATED_STAGE_IDS.has(stage.id) ||
    declaresHumanAuthority(stage.actor)
  );
}

// ── THE ACT CATALOGUE — a CLOSED union of machine-runnable acts ─────────────

/**
 * Every act this loop can perform. CLOSED, and deliberately short.
 *
 * An act qualifies only when the capability behind it is machine-run over a
 * server-resolved population with NO per-record human content — the same test
 * `POST …/validate-all` applied to itself.
 *
 * ── TWO STAGES DELIBERATELY EXCLUDED, with reasons ─────────────────────────
 *
 * `discover-sources` (Stage 1, `runDiscoveryForDomain`) is machine-run, and is
 * still excluded, for two reasons that are facts rather than preferences:
 *   1. `IsolationStage` — the ONE shared exception vocabulary — has no
 *      `discover-sources` member, so a discovery exception has nowhere to live
 *      in the shared model. Widening that union is a change to the vocabulary
 *      every stage shares and belongs in its own deliberate act, not as a
 *      side effect of adding a loop.
 *   2. It issues sequential external HTTP requests to every ratified
 *      institution in the domain — unbounded wall-clock against third-party
 *      sites inside one request, which is the one shape a bounded loop cannot
 *      bound.
 *
 * `add-relationships` SUGGESTION (`suggestRelationships`) is read-only and
 * therefore safe, and is still excluded from THIS commit: it is a per-invariant
 * inference call over the orphan set, so its cost scales with the cohort rather
 * than with the act, and preparing recommendations is a distinct surface
 * (a recommendation queue) rather than an advance of the programme. Named here
 * so its absence is a recorded decision rather than an oversight.
 */
export type ProgrammeActKind = 'extract-candidates' | 'validate-cohort';

export const PROGRAMME_ACT_KINDS: readonly ProgrammeActKind[] = ['extract-candidates', 'validate-cohort'];

/** Which stage each act advances. The stage's OWN `capability` string is carried
 *  into the outcome verbatim, so the run reports the capability the projection
 *  declares rather than a second mapping's idea of it. */
export const ACT_STAGE: Record<ProgrammeActKind, Track2StageId> = {
  'extract-candidates': 'extract-candidates',
  'validate-cohort': 'validate',
};

/**
 * WHICH ACTS THE MEASUREMENT-LAYER GATE BLOCKS.
 *
 *   `v2-acquisition`        performs NEW corpus acquisition, extraction or
 *                           crystal construction — i.e. it contributes material
 *                           to a SUCCESSOR crystal. Blocked until the
 *                           measurement layer is hardened AND demonstrated.
 *   `pre-remediation-safe`  operates only over material that already exists and
 *                           contributes nothing new to a successor crystal.
 *                           Runs whatever the gate says.
 *
 * `validate-cohort` is `pre-remediation-safe` on a specific reading, stated so
 * it can be argued with: it applies the validation gate to invariants that were
 * ALREADY promoted, it adds nothing to the corpus, and it cannot admit anything
 * to a crystal (assignment is Stage 8, and Stage 8 is human-gated). Recording a
 * validation outcome against an existing record is not construction of a second
 * crystal, so blocking it would stop safe work for no epistemic gain — which is
 * the "constitutional control immobilises the safe remainder" defect this
 * codebase has already paid for once.
 *
 * `extract-candidates` is `v2-acquisition` unambiguously: it produces the
 * candidate cohort a successor crystal would be built from. That is precisely
 * the act the sequencing gate exists to withhold.
 */
export type ProgrammeActClass = 'v2-acquisition' | 'pre-remediation-safe';

export const ACT_CLASS: Record<ProgrammeActKind, ProgrammeActClass> = {
  'extract-candidates': 'v2-acquisition',
  'validate-cohort': 'pre-remediation-safe',
};

/**
 * THE ACT BUDGET — the loop's hard ceiling, in the same register as
 * `ABSORBED_BATCH_LIMIT`.
 *
 * Two independent bounds hold simultaneously, and either alone terminates the
 * loop:
 *   1. this budget, and
 *   2. **each act kind executes AT MOST ONCE per run.**
 *
 * (2) is what makes a no-op act safe. The loop re-reads the projection after
 * every act; an act that left its stage unchanged would otherwise be selected
 * again forever. With (2), an act that did not advance its stage simply is not
 * offered again, and the run terminates with `no-executable-act-remains` — the
 * honest outcome — instead of spinning to the budget.
 */
export const MAX_ACTS_PER_RUN = 8;

/**
 * THE PER-ACT RECORD CEILING — batching, absorbed.
 *
 * A capacity limit BATCHES, it never truncates
 * (`CI-2026-08-03-CAPACITY-LIMIT-BATCHES-NOT-TRUNCATES-001`), so an act holding
 * more records than this processes the first slice — deterministically, sorted
 * by record id, the discipline `partitionForExecution` already applies — and
 * NAMES every deferred record on the outcome. Deferred is not excluded and is
 * never silently dropped (`CI-2026-08-03-EXCLUSION-VISIBLE-NOT-DISCARDED-001`).
 */
export const MAX_RECORDS_PER_ACT = 25;

/**
 * THE WALL-CLOCK BUDGET, in milliseconds. Checked at the TOP of every loop
 * iteration — before the global-stop check, before the act-budget check,
 * before act selection, and before an act starts — never mid-act, and never
 * only after an act has already been chosen. A half-executed capability is
 * exactly the partial state this bound exists to avoid. A run that stops
 * here is `partial`, and says so.
 *
 * SIZED FOR THE REAL HOSTING CEILING, NOT THE DECLARED ONE (2026-08-30,
 * "empty 504" repair). The route declares `maxDuration = 60`, but this
 * repo's own established convention (`app/api/dev-command-center/validate/
 * route.ts`, `remediate/route.ts`) already documents that a declared
 * `maxDuration` is "honored where the platform allows" and every such route
 * is "sized for ~30s regardless." This budget follows the SAME discipline:
 * 45s left only ~15s of margin under a ~30s real ceiling — comfortably
 * enough for the platform to kill the connection mid-response, producing an
 * EMPTY body (the reported 504), never a JSON error the client can render.
 * 20s leaves real margin for JSON serialisation and network flush after the
 * budget check fires clean.
 */
export const DEFAULT_TIME_BUDGET_MS = 20_000;

/**
 * THE HARD BACKSTOP for the ONE-TIME state composition that happens BEFORE
 * the loop can even check `DEFAULT_TIME_BUDGET_MS` — `loadTrack2ProgrammeState`
 * (readiness + candidate/source/artifact reads + frozen-manifest verification
 * + cohort reconciliation) and the measurement-layer gate resolution. This is
 * the ONLY place a slow run can produce zero acts and still exceed a real
 * hosting ceiling: a state with no offerable act (e.g. "Discover Sources"
 * pending) resolves its stop reason on the FIRST loop check, so the loop's
 * own per-iteration budget check never gets a chance to fire — the risk is
 * entirely upstream of it. Racing the initial composition against this
 * deadline, separately from the loop's own budget, means a pathologically
 * slow read still yields a clean, structured response instead of the
 * platform killing the connection first. Smaller than `DEFAULT_TIME_BUDGET_MS`
 * on purpose: bailing here should happen well before the run's own soft
 * budget would have been exhausted by this one call alone.
 */
export const STATE_COMPOSITION_DEADLINE_MS = 15_000;

// ── DIAGNOSTIC TIMING — instrumented, never guessed (2026-08-30) ───────────

/** One named phase's wall-clock duration, in the order it was recorded. */
export interface PhaseTiming {
  phase: string;
  ms: number;
}

/** Records phase durations in call order. Never thrown away: a stop that
 *  fires mid-composition still carries every phase that completed before it,
 *  so a slow run is diagnosable from its own response, not just from logs. */
class PhaseTimer {
  private readonly entries: PhaseTiming[] = [];
  constructor(private readonly clock: () => number) {}

  async time<T>(phase: string, fn: () => Promise<T>): Promise<T> {
    const start = this.clock();
    try {
      return await fn();
    } finally {
      this.entries.push({ phase, ms: this.clock() - start });
    }
  }

  record(phase: string, ms: number): void {
    this.entries.push({ phase, ms });
  }

  /** The raw clock reading, for a caller that must bracket a span the
   *  control flow makes awkward to wrap in a single closure (e.g. a phase
   *  spanning several early-return branches). */
  now(): number {
    return this.clock();
  }

  snapshot(): PhaseTiming[] {
    return [...this.entries];
  }
}

// ── THE RUN'S OWN VOCABULARY ────────────────────────────────────────────────

/** The consolidated decision waiting for the operator — the ONLY thing the
 *  Copilot asks them to look at when the loop stops at a gate. */
export interface PendingGovernanceDecision {
  stageId: Track2StageId;
  stageLabel: string;
  /** `governance` = the operator's own constitutional act. `human-judgment` =
   *  scientific work carrying per-record human content. Different authorities,
   *  never conflated. */
  authority: 'governance' | 'human-judgment';
  /** Who performs it, from the stage's own `actor` field, verbatim. */
  actor: string;
  /** The stage's own capability, verbatim — never a second wording of it. */
  capability: string;
  /** Where the operator performs it, from the stage's own `surface` —
   *  PROSE, for a human to read. Never parsed into a navigable target. */
  surface: string;
  /** The canonical, resolvable navigation target for THIS act (2026-08-26
   *  deep-link contract) — what a caller must consume verbatim to open the
   *  exact stage. See track2Programme.ts's `Track2DeepLink` doc comment. */
  deepLink: Track2DeepLink;
  /** The stage's own remedies, verbatim. Empty when the stage has none. */
  remedies: string[];
  detail: string;
  /**
   * A REAL, EXISTING decision/action surface is available for this stop
   * RIGHT NOW (2026-08-30, "prepare-independent-review is invisible in the
   * Copilot" fix) — carried verbatim from `Track2Stage.actionable` (see that
   * field's own doc comment for the full distinction from `remedies`).
   * `remedies` may legitimately be empty while this is `true` — the review
   * itself is the act, not a repair for something broken. `false` for every
   * stage that never declared it, so an older consumer reading only
   * `remedies`/`detail` sees no change in behavior.
   */
  actionable: boolean;
  /**
   * The already-computed targeted acquisition plan (2026-08-30, "turn Discover
   * Sources into a precise Copilot authorization"), present ONLY when this
   * decision is the `discover-sources` stop `buildAcquisitionPendingDecision`
   * built — every other stage's decision leaves this `undefined`. Lets a
   * consumer render the exact plan (deficit counts, missing namespaces,
   * admissibility constraints) inline, without a second fetch of
   * `GET .../acquisition-brief`.
   */
  acquisitionBrief?: CrystalAcquisitionBrief;
  /**
   * THE ACTUAL SUCCESSOR CANDIDATES awaiting judgment (2026-08-30, "Review &
   * Promote is a description, not a decision surface" fix), present ONLY
   * when this decision is the `review-and-promote` stop AND at least one
   * successor-scoped candidate is `status: 'candidate'`. Mirrors
   * `acquisitionBrief` exactly: every field here is READ from data that
   * already exists (the SAME `successorScopedCandidates` array Stage 3/4's
   * own counts are derived from — `inv.engineering.036`/`037`, never a
   * second candidate query), so a caller can render one bounded review card
   * per candidate without a second fetch. `undefined` on every other stage's
   * decision, and on this stage too once nothing is awaiting review.
   */
  reviewQueue?: ReviewPromoteCandidateEntry[];
  /**
   * A deterministic, bounded, already-Steward-authorised machine act is
   * outstanding and directly executable from THIS decision (2026-08-31,
   * "targeted-acquisition ratified-but-unverified dead end" repair) —
   * present ONLY when the `discover-sources` stop is blocked on ratified
   * institutions that have never completed verification. Distinct from
   * `acquisitionBrief` (which asks for a HUMAN approval) and from
   * `reviewQueue` (per-record human judgment): this is the "Run until you
   * need me" case — the constitutional rule that a deterministic, bounded,
   * already-authorised act must be EXECUTED, never presented as a dead end
   * whose only CTA is "Open Discover Sources". A consumer renders a "Run
   * institution verification" control that drives
   * `POST .../acquisition/verify-step` repeatedly (mirroring how
   * `acquisitionBrief`'s own control drives `.../acquisition/run-step`),
   * never a second verification implementation
   * (`services/corpusScout/registryVerification.ts::verifyInstitutionEntry`
   * is the sole implementation, reused verbatim by both).
   */
  verificationTarget?: { acquisitionDomain: string; ratifiedInstitutionCount: number };
}

/** One evidence row resolved for a review card — an EXCERPT (never the full
 *  body), joined from `candidate.evidenceIds` against the SAME
 *  `listEvidence` read path Stage 1's own evidence list uses. */
export interface ReviewPromoteEvidenceRef {
  id: string;
  title: string;
  sourceKind: string;
  sourceRef: string | null;
  excerpt: string;
}

/** The SAME per-statement check `promoteCandidate` itself runs before
 *  writing (`services/invariants/comparison.ts::findDuplicates`) — surfaced
 *  here as a PRE-FLIGHT warning so a steward sees it before deciding, never
 *  a second, independently-tuned duplicate heuristic that could disagree
 *  with what promotion itself will do. */
export interface ReviewPromoteDuplicateWarning {
  exact: boolean;
  similarity: number;
  existingInvariantId: string;
  existingStatement: string;
}

/**
 * ONE CANDIDATE'S REVIEW CARD — every field is READ off the existing
 * `CandidateRow` (already fetched by `listCandidates` for Stage 3/4's own
 * counts) or derived from an existing, already-reused instrument
 * (`findDuplicates`, `listEvidence`). Nothing here is a new classification —
 * `recommendation` is a deterministic, transparent read of signals that
 * already exist (confidence, convergence, the duplicate check), offered as
 * an ADVISORY ONLY: the Steward retains the promotion decision regardless of
 * what this names.
 */
export interface ReviewPromoteCandidateEntry {
  candidateId: string;
  statement: string;
  rationale: string;
  domain: string;
  subDomain: string | null;
  /** `discoveryNamespace(candidate.domain)` — the SAME derivation
   *  `promoteCandidate` itself uses to resolve the namespace it writes to. */
  proposedNamespace: string;
  discoveryClass: DiscoveryClass;
  abstractionLevel: AbstractionLevel | null;
  scopeLevel: DiscoveryScopeLevel;
  /** The provenance/evidence classification Compare already assigned, when
   *  this candidate went through that stage — `null` for a direct-extraction
   *  candidate that never did. */
  classification: CompareClassification | null;
  confidence: number;
  convergence: ConvergenceInfo | null;
  recurrence: RecurrenceInfo | null;
  evidence: ReviewPromoteEvidenceRef[];
  duplicateWarning: ReviewPromoteDuplicateWarning | null;
  /** ADVISORY ONLY — never authoritative, never blocks either button. */
  recommendation: { action: 'promote' | 'reject' | 'inspect'; reason: string };
}

/**
 * THE ADVISORY RECOMMENDATION — a deterministic read of signals that already
 * exist on the candidate (confidence, convergence) plus the pre-flight
 * duplicate check, never a new scoring model. Named `recommendation` rather
 * than `verdict`/`decision` deliberately: the Steward retains the promotion
 * decision regardless of what this reads.
 */
function deriveReviewRecommendation(
  candidate: Pick<CandidateRow, 'confidence' | 'convergence'>,
  duplicate: ReviewPromoteDuplicateWarning | null,
): { action: 'promote' | 'reject' | 'inspect'; reason: string } {
  if (duplicate?.exact) {
    return {
      action: 'reject',
      reason: `Exact match to an already-admitted invariant (${duplicate.existingInvariantId.slice(0, 8)}…) — promoting would duplicate it.`,
    };
  }
  if (duplicate && duplicate.similarity >= 0.85) {
    return {
      action: 'inspect',
      reason: `${Math.round(duplicate.similarity * 100)}% textual overlap with an existing invariant — inspect before deciding.`,
    };
  }
  const supportCount = candidate.convergence?.supportCount ?? 0;
  if (candidate.confidence >= 0.7 && supportCount >= 2) {
    return {
      action: 'promote',
      reason: `${Math.round(candidate.confidence * 100)}% extraction confidence with ${supportCount} converging source(s), no duplicate found.`,
    };
  }
  if (candidate.confidence < 0.35) {
    return {
      action: 'inspect',
      reason: `Low extraction confidence (${Math.round(candidate.confidence * 100)}%) — verify against the source before deciding.`,
    };
  }
  return { action: 'inspect', reason: 'No strong signal either way — review the evidence before deciding.' };
}

/**
 * BUILD THE REVIEW & PROMOTE QUEUE — every field READ from the SAME
 * `successorScopedCandidates` array `loadTrack2ProgrammeState` already
 * computed for Stage 3/4's own counts (never a second candidate query), plus
 * two existing, already-reused instruments (`listEvidence`, `findDuplicates`)
 * — no new promotion, rejection, or duplicate-detection logic. `admin: null`
 * (no server client) yields an empty queue rather than throwing — the
 * calling stage's own `unreadableSignals` entry already names that failure.
 */
async function buildReviewAndPromoteQueue(
  admin: SupabaseClient | null,
  awaitingCandidates: readonly CandidateRow[],
): Promise<ReviewPromoteCandidateEntry[]> {
  if (!admin || awaitingCandidates.length === 0) return [];

  const domains = Array.from(new Set(awaitingCandidates.map((c) => c.domain)));
  const evidenceByDomain = new Map<string, EvidenceRow[]>();
  await Promise.all(
    domains.map(async (d) => {
      evidenceByDomain.set(d, await listEvidence(admin, d).catch(() => []));
    }),
  );

  return Promise.all(
    awaitingCandidates.map(async (c) => {
      const evidenceRows = evidenceByDomain.get(c.domain) ?? [];
      const evidence: ReviewPromoteEvidenceRef[] = c.evidenceIds
        .map((id) => evidenceRows.find((e) => e.id === id))
        .filter((e): e is EvidenceRow => Boolean(e))
        .map((e) => ({
          id: e.id,
          title: e.title,
          sourceKind: e.sourceKind,
          sourceRef: e.sourceRef,
          excerpt: e.content.slice(0, 400),
        }));

      const namespace = discoveryNamespace(c.domain);
      const dupes = await findDuplicates(c.statement, { namespace, threshold: 0.75 }).catch(() => []);
      const top = dupes[0] ?? null;
      const duplicateWarning: ReviewPromoteDuplicateWarning | null = top
        ? {
            exact: top.exact,
            similarity: top.similarity,
            existingInvariantId: top.invariant.id,
            existingStatement: top.invariant.statement,
          }
        : null;

      return {
        candidateId: c.id,
        statement: c.statement,
        rationale: c.rationale,
        domain: c.domain,
        subDomain: c.subDomain,
        proposedNamespace: namespace,
        discoveryClass: c.discoveryClass,
        abstractionLevel: c.abstractionLevel,
        scopeLevel: c.scopeLevel,
        classification: c.classification,
        confidence: c.confidence,
        convergence: c.convergence ?? null,
        recurrence: c.recurrence ?? null,
        evidence,
        duplicateWarning,
        recommendation: deriveReviewRecommendation(c, duplicateWarning),
      };
    }),
  );
}

/**
 * WHY THE LOOP STOPPED. A discriminated union, so a surface cannot render
 * "stopped" without saying which of these it was.
 */
export type ProgrammeRunStopReason =
  /** A `workKind === 'governance'` stage is next: the operator's own act. */
  | { kind: 'awaiting-governance'; decision: PendingGovernanceDecision }
  /** A scientific stage is next whose work carries per-record human content. */
  | { kind: 'awaiting-human-judgment'; decision: PendingGovernanceDecision }
  /**
   * THE SEQUENCING GATE. An acquisition-class act is unblocked BY THE PROGRAMME
   * but withheld because the measurement layer is not yet hardened AND
   * demonstrated. Distinct from the two stops above on purpose: this one awaits
   * an ENGINEERING DELIVERABLE, not an operator decision — the operator cannot
   * clear it by deciding anything, so presenting it as a decision would send
   * them looking for an act that does not exist.
   */
  | {
      kind: 'blocked-on-measurement-layer';
      gate: MeasurementLayerGate;
      /** The acts that were offerable and were withheld, named. */
      withheldActs: ProgrammeActKind[];
      detail: string;
    }
  /** One of the five enumerated batch-integrity failures. Never an exception count. */
  | { kind: 'global-integrity-failure'; globalStop: GlobalStop }
  /** Nothing machine-runnable is unblocked — including "the crystal is frozen". */
  | { kind: 'no-executable-act-remains'; detail: string }
  /** `MAX_ACTS_PER_RUN` reached with work still available. */
  | { kind: 'act-budget-exhausted'; budget: number; detail: string }
  /** The wall-clock budget was reached before the next act could start. */
  | { kind: 'time-budget-exhausted'; elapsedMs: number; budgetMs: number; detail: string }
  /** The projection itself could not be read. Never collapsed to "nothing to do". */
  | { kind: 'programme-unreadable'; detail: string };

export interface ProgrammeActOutcome {
  actKind: ProgrammeActKind;
  stageId: Track2StageId;
  /** The stage's own `capability` string, verbatim. */
  capability: string;
  /** Did the CAPABILITY run? Not whether every record passed. */
  ok: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  /** Records this act was responsible for but did not reach, NAMED. */
  deferredRecordIds: string[];
  /** Per-record dispositions, folded into the run's isolation summary. */
  assignments: DispositionAssignment[];
  /** A batch-integrity failure observed BY this act. */
  globalStop: GlobalStop | null;
  detail: string;
}

export interface ProgrammeRunResult {
  experimentId: string;
  crystalDomain: string;
  acquisitionDomain: string;
  /**
   * THE ACTS' OUTCOME — never the PROGRAMME's. Named `actExecution` precisely
   * so `complete` cannot be misread as "the programme is complete": it means
   * "every act this run attempted succeeded", and a run that stopped partway is
   * `partial`. Same vocabulary and same property as
   * `AbsorbedExecutionSummary.outcome`.
   */
  actExecution: 'complete' | 'partial' | 'failed' | 'not-started';
  actsAttempted: number;
  actsSucceeded: number;
  actsFailed: number;
  acts: ProgrammeActOutcome[];
  /** `actsSucceeded + actsFailed === actsAttempted`, and nothing else. */
  reconciles: boolean;
  /** THE SEQUENCING GATE'S STATE — present in EVERY result, satisfied or not, so
   *  a run report always discloses whether acquisition-class work was permitted. */
  measurementLayerGate: MeasurementLayerGate;
  stopReason: ProgrammeRunStopReason;
  /** The consolidated decision awaiting the operator, when that is why it stopped. */
  pendingDecision: PendingGovernanceDecision | null;
  /** Record-local exceptions accumulated across the whole run. Never halts it. */
  isolation: IsolationSummary;
  criticalPath: CriticalPath;
  /** THE COUNTERWEIGHT — present in every result, always. */
  population: PopulationDisclosure;
  /** Signals that could not be read, so a zero is never mistaken for a fact. */
  populationUnreadable: string[];
  /** The programme AS RE-READ after the last act — the surface's new truth. */
  programme: Track2Programme;
  /** The ONE run-level receipt. */
  receipt: { ok: boolean; receiptId: string | null };
  /** The shortcuts this run structurally cannot take, stated. */
  guardrails: readonly string[];
  headline: string;
  /**
   * PHASE TIMING — present in EVERY result (2026-08-30, "empty 504" repair).
   * Every named phase the operator asked to instrument — programme-state
   * derivation, readiness (timed separately from the rest of state
   * composition), measurement-layer resolution, each executed act, and the
   * final re-read — in call order, so a slow run is diagnosable from its own
   * response, never only from server logs. `totalElapsedMs` is the SAME
   * wall-clock this run's own time-budget check reads.
   */
  diagnostics: { timings: PhaseTiming[]; totalElapsedMs: number };
}

/**
 * The refusals carried INTO the result, so the operator reading a run report can
 * see what the automation is forbidden to do rather than having to trust it.
 * Operator wording, 2026-08-26.
 */
export const ORCHESTRATOR_GUARDRAILS: readonly string[] = [
  'Never authors, edits or re-tags an invariant statement — rewriting statements into stronger invariants would contaminate the experiment. Remediation re-runs discovery and extraction; it does not improve rows in place.',
  'Never narrows a ratified namespace boundary. Narrowing the boundary to fit the material that happened to be acquired is a separate governance decision, surfaced as a stop and never applied.',
  'Never freezes, and never provisions a crystal-version artifact. The freeze is the operator’s own act, and frozen Crystal vP1 is not modified by anything here.',
  'Never runs an experiment. Experiment runs stay in metaMe IRL; this loop performs Track 2 programme acts only.',
];

// ── EXCEPTION CONSTRUCTION — the shared shape, filled honestly ──────────────

/**
 * A record-local exception from an act. Every `blocks*` flag is FALSE by
 * construction, which is the whole ruling: *"Constitutional control constrains
 * the unsafe act; it does not immobilize the safe remainder."* `blocksFreeze`
 * is never asserted here — `computeFreezeBlocking` derives it from the crystal
 * that actually remains, and this module does not pre-empt that.
 */
function actException(input: {
  recordId: string;
  recordLabel: string;
  cause: string;
  stage: IsolationException['stage'];
  causeGroup: IsolationException['causeGroup'];
  recommendedAction: string;
  acts: IsolationException['acts'];
}): IsolationException {
  return {
    scope: 'invariant',
    recordId: input.recordId,
    recordLabel: input.recordLabel,
    cause: input.cause,
    causeGroup: input.causeGroup,
    disposition: 'exception',
    stage: input.stage,
    blocksCurrentStage: false,
    blocksCrystalAssignment: false,
    blocksReadiness: false,
    blocksFreeze: false,
    consequence:
      'Does not block the rest of this run. Stays outside the crystal until resolved, and is disclosed in the population.',
    recommendedAction: input.recommendedAction,
    acts: input.acts,
    deferrableUntil: null,
  };
}

// ── THE ACTS ────────────────────────────────────────────────────────────────

/**
 * STAGE 3 — extraction over the ADMITTED evidence.
 *
 * Delegates wholly to `runConstitutionalDiscovery`, which already owns its own
 * context budget AND already reports the evidence rows it could not read as
 * typed `IsolationException`s (exception-isolation ruling §7). Those arrive
 * pre-shaped, so they are folded in verbatim rather than re-described — the
 * capability's own account of its exclusions is the authoritative one.
 */
async function runExtractAct(
  state: Track2ProgrammeState,
  stage: Track2Stage,
): Promise<ProgrammeActOutcome> {
  const base = {
    actKind: 'extract-candidates' as const,
    stageId: stage.id,
    capability: stage.capability,
    deferredRecordIds: [] as string[],
    globalStop: null as GlobalStop | null,
  };
  const admin = getSupabaseServer();
  if (!admin) {
    return {
      ...base,
      ok: false,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      assignments: [],
      detail: 'extraction could not run — no server database client',
    };
  }
  const result = await runConstitutionalDiscovery(admin, state.acquisitionDomain).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  if (!result.ok) {
    return {
      ...base,
      ok: false,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      assignments: [],
      detail: `extraction did not run: ${result.error}`,
    };
  }

  const assignments: DispositionAssignment[] = [
    ...result.candidates.map((c) => ({ recordId: c.id, disposition: 'ready' as const })),
    // The capability's OWN exclusions, carried through unchanged.
    ...result.excludedEvidence.map((e) => ({
      recordId: e.recordId,
      disposition: 'exception' as const,
      exception: e,
    })),
  ];

  return {
    ...base,
    ok: true,
    attempted: result.candidates.length + result.excludedEvidence.length,
    succeeded: result.candidates.length,
    failed: result.excludedEvidence.length,
    assignments,
    detail:
      `${result.candidates.length} candidate(s) extracted from the admitted evidence` +
      (result.excludedEvidence.length > 0
        ? `; ${result.excludedEvidence.length} evidence row(s) did not fit this pass's context budget and are named as exceptions`
        : ''),
  };
}

/**
 * STAGE 6 — the validation gate over the promoted cohort.
 *
 * Calls the SAME `validateInvariant` that `POST /api/invariants/[id]/advance`
 * and `POST …/validate-all` call, over the SAME server-resolved cohort
 * (`cohort.unvalidatedRecords`) — never a caller-supplied id list, so nothing
 * outside this crystal's cohort can be validated.
 *
 * PER RECORD, INDEPENDENTLY. A throw or a failed verdict on one invariant never
 * withholds the outcome already produced for another: acceptance criterion #1
 * applied inside a single act.
 */
async function runValidateAct(
  state: Track2ProgrammeState,
  stage: Track2Stage,
  personaId: string,
): Promise<ProgrammeActOutcome> {
  const base = {
    actKind: 'validate-cohort' as const,
    stageId: stage.id,
    capability: stage.capability,
    globalStop: null as GlobalStop | null,
  };
  const cohort = state.cohort;
  if (!cohort) {
    return {
      ...base,
      ok: false,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      deferredRecordIds: [],
      assignments: [],
      detail: 'the promoted cohort could not be read — validation did not run, and nothing is assumed about it',
    };
  }

  // Deterministic slice: sorted by id BEFORE packing, the same discipline
  // `partitionForExecution` applies, so a re-run reconciles against this one.
  const ordered = [...cohort.unvalidatedRecords].sort((a, b) => a.id.localeCompare(b.id));
  const targets = ordered.slice(0, MAX_RECORDS_PER_ACT);
  const deferredRecordIds = ordered.slice(MAX_RECORDS_PER_ACT).map((r) => r.id);

  const assignments: DispositionAssignment[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      const { verdict } = await validateInvariant(target.id, { personaId });
      if (verdict.ok) {
        succeeded += 1;
        assignments.push({ recordId: target.id, disposition: 'ready' });
        continue;
      }
      failed += 1;
      const failing = verdict.checks.filter((c) => !c.passed);
      assignments.push({
        recordId: target.id,
        disposition: 'exception',
        exception: actException({
          recordId: target.id,
          recordLabel: target.label,
          stage: 'validate',
          causeGroup: 'validation-check-failed',
          cause:
            `the validation gate did not pass: ` +
            failing.map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ''}`).join('; '),
          recommendedAction:
            'Resolve the failing check on this record, then re-run the validation gate. The orchestrator does not edit statements or provenance.',
          acts: [
            {
              actId: `revalidate:${target.id}`,
              kind: 're-check',
              label: 'Re-run the validation gate',
              target: target.id,
              detail: "POST /api/invariants/[id]/advance { action: 'validate' }",
            },
          ],
        }),
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      assignments.push({
        recordId: target.id,
        disposition: 'exception',
        exception: actException({
          recordId: target.id,
          recordLabel: target.label,
          stage: 'validate',
          causeGroup: 'validation-check-failed',
          cause: `the validation gate could not be applied: ${message}`,
          recommendedAction:
            'Open this record and apply the validation gate directly; the reason it could not be applied is stated above.',
          acts: [
            {
              actId: `open-invariant:${target.id}`,
              kind: 'open-stage',
              label: 'Open this invariant',
              target: target.id,
              detail: 'Invariant Registry — invariant detail',
            },
          ],
        }),
      });
    }
  }

  return {
    ...base,
    ok: true,
    attempted: targets.length,
    succeeded,
    failed,
    deferredRecordIds,
    assignments,
    detail:
      `${succeeded} of ${targets.length} cohort member(s) passed the validation gate` +
      (failed > 0 ? `; ${failed} did not and are named as exceptions` : '') +
      (deferredRecordIds.length > 0
        ? `; ${deferredRecordIds.length} member(s) were NOT reached in this act (per-act ceiling ${MAX_RECORDS_PER_ACT}) and are named`
        : ''),
  };
}

// ── THE LOOP ────────────────────────────────────────────────────────────────

/** The stage a projection offers for a given act, or null when the act is not
 *  currently offerable. Reads `unblockedStageIds` — never `ordinal >
 *  current.ordinal`, which the projection's own doc comment forbids. */
function offerableStage(programme: Track2Programme, actKind: ProgrammeActKind): Track2Stage | null {
  const stageId = ACT_STAGE[actKind];
  if (!programme.unblockedStageIds.includes(stageId)) return null;
  const stage = programme.stages.find((s) => s.id === stageId);
  if (!stage) return null;
  if (stage.status === 'complete') return null;
  // An `unknown` status means the signal could not be READ. Acting on a stage
  // whose state is unreadable would be acting on a guess.
  if (stage.status === 'unknown') return null;
  if (isHumanGatedStage(stage)) return null;
  return stage;
}

/**
 * THE FIRST STAGE THE OPERATOR MUST ACT ON — the consolidated decision.
 * Ordered by ordinal, so it is the EARLIEST outstanding one rather than an
 * arbitrary pick.
 *
 * EXPORTED (2026-08-26 deep-link fix) so `loadTrack2ProgrammeState` — the ONE
 * loader both the read-only GET route and the advance loop already share —
 * can compute the SAME pending decision on a plain read, not only mid-loop.
 * Before this, `pendingDecision` existed ONLY on a `POST .../advance`
 * response; a GET-only caller (a mount/remount, a page refresh) had no way to
 * observe an outstanding human gate at all. Reusing this exact function
 * rather than a second derivation is what guarantees the GET-time preview and
 * the POST-time run can never disagree about what is pending
 * (`inv.engineering.036`/`037`).
 */
export function firstPendingDecision(programme: Track2Programme): PendingGovernanceDecision | null {
  const candidates = programme.stages
    .filter((s) => programme.unblockedStageIds.includes(s.id))
    .filter((s) => s.status !== 'complete' && s.status !== 'unknown')
    /*
     * A `partially-complete` stage carrying NO remedies AND NO actionable
     * control has nothing left to ask the operator to DO (2026-08-30,
     * "Classify Provenance manufactures a false human gate" fix, GENERALIZED
     * 2026-08-30 by the "prepare-independent-review is invisible in the
     * Copilot" follow-up). `partially-complete` legitimately means "every
     * eligible member was processed; the remainder is explicitly excluded and
     * inert" (exception-isolation ruling §6) as often as it means "real
     * outstanding work remains" (e.g. Stage 2 with sources still awaiting
     * review, or Stage 10 with the independent review request genuinely
     * open) — telling the two apart is NOT "does `remedies` happen to be
     * non-empty": `remedies` names REMEDIATION PROSE for a gap, and a stage
     * can have a real, existing action surface with nothing to "fix" at all
     * (Stage 10 — the review itself is the act; `checkFreezeGate` never
     * requires it and there is no failing check to remediate). So the
     * generic rule is `remedies.length > 0 || stage.actionable === true` —
     * `track2Programme.ts`'s own `actionable` field declares, from the
     * stage's own observed state, "a real decision/action surface is
     * available now," exactly parallel to how it already declares `status`/
     * `detail`/`remedies`. This is deliberately NOT a stage-id check: a
     * consumer here must never special-case a name to recover a distinction
     * the stage itself is better positioned to declare. This does NOT touch
     * `stage.status` itself — that derivation, and the `partially-complete`
     * value it can produce, is untouched and remains ratified
     * (CI-2026-08-03-BOUNDED-PROCESSOR-PARTIAL-COMPLETION-001) — it only
     * stops an already-resolved bookkeeping fact from being presented as a
     * live governance/human-judgment gate, and now also stops a genuinely
     * actionable one from being wrongly presented as resolved.
     */
    .filter((s) => !(s.status === 'partially-complete' && s.remedies.length === 0 && s.actionable !== true))
    .filter((s) => isHumanGatedStage(s))
    .sort((a, b) => a.ordinal - b.ordinal);
  const stage = candidates[0];
  if (!stage) return null;
  return {
    stageId: stage.id,
    stageLabel: stage.label,
    authority: stage.workKind === 'governance' ? 'governance' : 'human-judgment',
    actor: stage.actor,
    capability: stage.capability,
    surface: stage.surface,
    deepLink: buildTrack2DeepLink(programme.experimentId, stage.id, stage.label),
    remedies: stage.remedies,
    detail: stage.detail,
    // Carried verbatim from the stage's own declaration — never re-derived
    // here (the SAME discipline `remedies`/`detail` already follow). `false`
    // when the stage never set it, so an older stage's decision reads
    // exactly as it always has.
    actionable: stage.actionable === true,
  };
}

/**
 * THE ACQUISITION BRIDGE (2026-08-30, "acquisition dead end" fix).
 *
 * `crystalAcquisitionBrief.ts` computes a precise, targeted acquisition plan
 * from readiness's own deficits (net-new members required, missing
 * namespaces, deficient relational structures) — but it is pure reporting
 * with no consumer: nothing ever turned it into a CTA. Stage 1
 * (`discover-sources`) is deliberately excluded from both the automatic act
 * catalogue (unbounded external HTTP — see `PROGRAMME_ACT_KINDS`'s own header)
 * and `HUMAN_GATED_STAGE_IDS` (it is a per-stage-completion signal, "does any
 * source material exist", not "does ENOUGH exist for what v2 needs" — a
 * question Stage 1's own status can never express). So when the brief applies
 * and nothing else is pending, the operator was left with a targeted plan and
 * no button.
 *
 * This function is the SMALLEST bridge: it never runs discovery itself
 * (`runDiscoveryForDomain` stays manual-only, exactly as it is today — no
 * ratified source list is widened, no unbounded HTTP is triggered
 * automatically), it only turns an applicable brief into ONE correctly-named,
 * correctly-routed `PendingGovernanceDecision` — pointing at Stage 1's own
 * existing surface (Corpus Scout tab) via the SAME deep-link contract every
 * other stage's decision uses, carrying the brief's own concrete deficits as
 * `remedies` — so the loop stops at one real acquisition authorization
 * instead of silently reporting nothing left to do.
 */
export async function buildAcquisitionPendingDecision(input: {
  programme: Track2Programme;
  declaration: CrystalDomainDeclaration;
  readiness: CrystalReadinessReport;
  /** The active crystal-version artifact, from the SAME read
   *  `loadTrack2ProgrammeState` already made — never re-fetched here. `null`
   *  means nothing is provisioned yet, and the next unused generation id is
   *  resolved lazily below, only once every earlier early-return has passed. */
  artifact: { id: string; lifecycle: string } | null;
  /** Server admin client + the SAME resolved `acquisitionDomain` every other
   *  acquisition surface reads (2026-08-31, "targeted-acquisition
   *  state-machine" repair) — used to consult the durable approval fact
   *  before ever offering "Approve targeted acquisition" again. `admin: null`
   *  degrades to the pre-fix behaviour (always offer the ask) rather than
   *  throwing — this function's own existing contract is fail-soft. */
  admin: SupabaseClient | null;
  acquisitionDomain: string;
  /** The SAME signal `loadTrack2ProgrammeState` already computed for Stage
   *  1's own derivation (`summarizeAcquisitionSourceUniverse`) — never a
   *  second query for the identical fact (inv.engineering.036/037). */
  acquisitionSourceUniverse: { ratifiedInstitutionCount: number; eligibleInstitutionCount: number } | null;
}): Promise<PendingGovernanceDecision | null> {
  if (!acquisitionBriefApplies(input.readiness)) return null;
  const stage = input.programme.stages.find((s) => s.id === 'discover-sources');
  if (!stage) return null;
  // Stage 1 must genuinely be next — never surfaced ahead of an earlier,
  // still-outstanding stage (e.g. sources awaiting review at Stage 2 would
  // already have been named by `firstPendingDecision`; this is a fallback,
  // never a competing gate).
  if (!input.programme.unblockedStageIds.includes('discover-sources')) return null;

  // ── THE HUMAN JUDGEMENT IS CONSUMED ONCE (2026-08-31 state-machine repair,
  // the operator's canonical rule: "After it is constitutionally recorded,
  // the system must advance to the consequence of that judgement, even when
  // that consequence is another blocked gate.") — an ACTIVE approval already
  // exists means a steward already made this decision. This function must
  // NEVER manufacture a second "Approve targeted acquisition" ask for it;
  // it routes to the actual consequence instead. ────────────────────────────
  const activeApproval = input.admin
    ? await getActiveAcquisitionApproval(input.admin, input.programme.experimentId, input.acquisitionDomain).catch(() => null)
    : null;

  if (activeApproval) {
    // The source-universe signal itself is unreadable — never guess a
    // reason; report the failure honestly rather than assuming blocked OR
    // executable.
    if (input.acquisitionSourceUniverse === null) {
      return {
        stageId: stage.id,
        stageLabel: stage.label,
        authority: 'governance',
        actor: 'Steward',
        capability: stage.capability,
        surface: stage.surface,
        deepLink: buildTrack2DeepLink(input.programme.experimentId, stage.id, stage.label),
        remedies: [],
        actionable: false,
        detail:
          `Targeted acquisition was already approved for domain '${input.acquisitionDomain}' — the same ` +
          'judgement is not being re-asked. The acquisition source universe could not be read to determine ' +
          'what happens next — status unknown, not assumed.',
      };
    }
    // Zero ratified+verified institutions: nothing is executable, and
    // nothing about clicking "Approve" again would change that — the
    // approval already exists and is not the blocker. This is
    // TARGETED_ACQUISITION_APPROVED -> BLOCKED_SOURCE_UNIVERSE_UNCONSTITUTED,
    // never DISCOVER_SOURCES_NOT_STARTED and never a second approval ask.
    if (input.acquisitionSourceUniverse.eligibleInstitutionCount === 0) {
      const { ratifiedInstitutionCount } = input.acquisitionSourceUniverse;
      // Nothing ratified at all — a genuine governance act (ratifying a
      // domain constitution / an institution) is the outstanding decision.
      // No bounded machine act exists to execute here — this branch stays
      // diagnostic-only, `actionable: false`, exactly as before.
      if (ratifiedInstitutionCount === 0) {
        return {
          stageId: stage.id,
          stageLabel: stage.label,
          authority: 'governance',
          actor: 'Steward',
          capability: stage.capability,
          surface: stage.surface,
          deepLink: buildTrack2DeepLink(input.programme.experimentId, stage.id, stage.label),
          remedies: [
            `Ratify a domain constitution and at least one institution for '${input.acquisitionDomain}' before acquisition can run.`,
          ],
          actionable: false,
          detail:
            `Targeted acquisition was approved for domain '${input.acquisitionDomain}', but no institution is ` +
            'yet ratified for that domain — the source universe is not constituted. This is a separate, ' +
            'already-authorized decision from institution ratification; re-approving acquisition will not help.',
        };
      }
      // Ratified but unverified (the live EXP-P1 case: 19 ratified, 0
      // verified). Verification is a DETERMINISTIC, BOUNDED, already-
      // Steward-authorised machine act (traced from
      // registryVerification.ts::verifyInstitutionEntry before this branch
      // was written — no human judgement decides its outcome) — the
      // constitutional rule is that such an act is EXECUTED by "Run until
      // you need me", never left as a diagnostic dead end whose only CTA is
      // "Open Discover Sources". `actionable: true` + `verificationTarget`
      // give the Copilot/Track 2 panel a REAL control that runs it.
      return {
        stageId: stage.id,
        stageLabel: stage.label,
        authority: 'governance',
        actor:
          'Steward-authorised machine act — bounded, one institution per call, deterministic; no separate ' +
          'approval beyond the acquisition already granted.',
        capability: stage.capability,
        surface: stage.surface,
        deepLink: buildTrack2DeepLink(input.programme.experimentId, stage.id, stage.label),
        remedies: [],
        actionable: true,
        detail:
          `Targeted acquisition was approved for domain '${input.acquisitionDomain}' — ${ratifiedInstitutionCount} ` +
          'institution(s) are ratified, but NONE have completed verification (SPEC-CIR-001 §9). Institution ' +
          'verification is a bounded machine act, not a new judgement — run it to make eligible institutions ' +
          'available for discovery.',
        verificationTarget: { acquisitionDomain: input.acquisitionDomain, ratifiedInstitutionCount },
      };
    }
    // Eligible institutions exist and an approval is already active — the
    // approval is executable, not a new judgement to ask for. Falls through
    // to `null`: no NEW human decision is pending here (the existing
    // approval already authorizes `run-step`/`advance` to continue; a
    // reload before a round finishes shows no acquisition card rather than
    // a duplicate ask, which is the honest reflection of "already decided,
    // still executing").
    return null;
  }

  const crystalGeneration =
    input.artifact?.id ?? (await currentCrystalArtifactId(input.programme.experimentId).catch(() => input.programme.experimentId));

  const brief = buildCrystalAcquisitionBrief({
    experimentId: input.programme.experimentId,
    crystalGeneration,
    domain: input.declaration,
    report: input.readiness,
    // Informational dedup list only (crystalAcquisitionBrief.ts's own doc
    // comment) — not read by any of the brief's required-count derivations,
    // so an empty list here never affects `requiredNetNewDistinctMembers`,
    // `missingNamespaces` or any other targeted-plan figure.
    admittedInvariantIds: [],
  });

  // Named per the EXACT failing readiness check, never a single hardcoded
  // figure — `requiredNetNewDistinctMembers` can be 0 while boundary-coverage
  // or derivation-headroom is still what makes `acquisitionBriefApplies` true,
  // and a remedy list that only ever cited the raw count would misreport that
  // case as "0 needed" while still blocking.
  const outstanding = brief.completionCriteria.filter((c) => !c.satisfied);
  const remedies = outstanding.map((c) => c.remedy ?? `${c.checkName}: ${c.currentMeasure} of ${c.requiredMeasure}`);

  return {
    stageId: stage.id,
    stageLabel: stage.label,
    authority: 'human-judgment',
    actor:
      'Steward — bounded, ratified-institution discovery is a deliberate act, never automatic (unbounded external HTTP).',
    capability: stage.capability,
    surface: stage.surface,
    deepLink: buildTrack2DeepLink(input.programme.experimentId, stage.id, stage.label),
    remedies,
    // A real, existing control (Approve targeted acquisition) is available
    // right now — this decision is never presented merely from remedy text.
    actionable: true,
    acquisitionBrief: brief,
    detail:
      `The targeted acquisition plan is not yet satisfied — ${outstanding.map((c) => c.checkName).join(', ')}. ` +
      (brief.missingNamespaces.length > 0
        ? `${brief.missingNamespaces.length} namespace(s) unrepresented: ${brief.missingNamespaces.join(', ')}. `
        : '') +
      'Run Discover Sources for the missing material, then Extract Candidates.',
  };
}

/**
 * ADVANCE THE PROGRAMME UNTIL A HUMAN IS GENUINELY NEEDED.
 *
 * The loop, in full:
 *
 *   1. Read the projection (`loadTrack2ProgrammeState`).
 *   2. A `GlobalStop` observed by any act ⇒ stop. Nothing else stops the run:
 *      no quantity of record-local exceptions ever does (acceptance criterion #1).
 *   3. The next offerable machine act, from `unblockedStageIds`. None ⇒ stop
 *      with the pending human decision if there is one, else
 *      `no-executable-act-remains`.
 *   4. Execute it. Accumulate its per-record dispositions.
 *   5. **Re-read the projection** and go to 2. No cursor is advanced, and no
 *      stage state is stored.
 *
 * Bounded three ways: the act budget, one-execution-per-act-kind, and the
 * wall-clock budget checked before each act starts.
 */
export async function advanceResearchProgramme(input: {
  experimentId: string;
  personaId: string;
  acquisitionDomain?: string;
  /** Defaults to `MAX_ACTS_PER_RUN`; clamped to it so a caller cannot widen it. */
  maxActs?: number;
  timeBudgetMs?: number;
  /** Clamped to `STATE_COMPOSITION_DEADLINE_MS`, same discipline as
   *  `timeBudgetMs` — a caller can only ever NARROW this, never widen it.
   *  Exists so the race itself is testable without a real 15s wait; the
   *  route passes nothing. */
  stateCompositionDeadlineMs?: number;
  /** Injectable clock, so the bound is testable without a real wall clock. */
  now?: () => number;
  /**
   * Injectable measurement-layer read, so the sequencing gate is testable
   * without Track 2's store. Defaults to `resolveMeasurementLayerReadiness`,
   * which fails closed. A caller CANNOT widen the gate by supplying a satisfied
   * readiness in production: the route passes nothing, and the gate is evaluated
   * from the profile's own predicates rather than from a boolean the caller
   * asserts.
   */
  resolveMeasurementLayer?: () => Promise<MeasurementLayerReadiness>;
}): Promise<ProgrammeRunResult | { error: string; status: 404 | 503 }> {
  const clock = input.now ?? (() => Date.now());
  const startedAt = clock();
  const timeBudgetMs = Math.max(1, Math.min(input.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS, DEFAULT_TIME_BUDGET_MS));
  const budget = Math.max(1, Math.min(input.maxActs ?? MAX_ACTS_PER_RUN, MAX_ACTS_PER_RUN));
  const timer = new PhaseTimer(clock);

  // THE HARD BACKSTOP (2026-08-30, "empty 504" repair) — races the ONE-TIME
  // state composition against STATE_COMPOSITION_DEADLINE_MS, separately from
  // the loop's own per-iteration budget below. This is the ONLY call that can
  // produce an empty-504 with ZERO acts attempted: a state with nothing
  // offerable (e.g. "Discover Sources" pending) resolves its stop reason on
  // the loop's FIRST check, so the loop's own budget guard never gets a
  // chance to fire — the risk here is entirely upstream of the loop. Losing
  // the race still returns a clean, structured `{error, status}` body (never
  // nothing); the orphaned read is left to finish or be recycled with the
  // Lambda, and its outcome is logged (not awaited) purely for forensic
  // diagnosis of which phase was actually slow.
  const stateCompositionDeadlineMs = Math.max(
    1,
    Math.min(input.stateCompositionDeadlineMs ?? STATE_COMPOSITION_DEADLINE_MS, STATE_COMPOSITION_DEADLINE_MS),
  );
  const statePromise = timer.time('programme-state-load', () =>
    loadTrack2ProgrammeState({ experimentId: input.experimentId, acquisitionDomain: input.acquisitionDomain, timer }),
  );
  const stateOrTimeout = await Promise.race([
    statePromise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), stateCompositionDeadlineMs)),
  ]);
  if (stateOrTimeout === 'timeout') {
    // eslint-disable-next-line no-console
    console.error(
      `[research-programme-orchestrator] state composition exceeded its ${stateCompositionDeadlineMs}ms deadline ` +
        `for experiment '${input.experimentId}' — returning a clean stop rather than letting the request die. ` +
        'Re-run once the underlying read completes; nothing was written.',
    );
    // Forensic only, never awaited: when the orphaned read eventually settles,
    // log what it found and how long each phase actually took, so the NEXT
    // invocation is not the first data point about where time went.
    statePromise
      .then((late) =>
        // eslint-disable-next-line no-console
        console.error(
          `[research-programme-orchestrator] the timed-out state read for '${input.experimentId}' later ` +
            `${'error' in late ? `failed: ${late.error}` : 'completed'}. Phase timings: ` +
            JSON.stringify(timer.snapshot()),
        ),
      )
      .catch((err: unknown) =>
        // eslint-disable-next-line no-console
        console.error(
          `[research-programme-orchestrator] the timed-out state read for '${input.experimentId}' later threw: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    return {
      error:
        `programme state composition exceeded its ${stateCompositionDeadlineMs}ms safety budget for ` +
        `experiment '${input.experimentId}'. Nothing was written and no act was attempted — re-run.`,
      status: 503,
    };
  }
  const state = stateOrTimeout;
  if ('error' in state) return state;
  // Narrowed once, so the loop below reads a `Track2ProgrammeState` rather than
  // re-asserting the narrowing at every use.
  let current: Track2ProgrammeState = state;

  // THE SEQUENCING GATE, read ONCE per run and BEFORE any act. Reading it once
  // is deliberate: a gate that could flip mid-run would let a run be partly
  // authorised, and "which half of this run was permitted?" is not a question a
  // receipt should ever have to answer.
  const measurementLayerGate = evaluateMeasurementLayerGate(
    await timer.time('measurement-layer-resolution', () =>
      (input.resolveMeasurementLayer
        ? input.resolveMeasurementLayer()
        : resolveMeasurementLayerReadiness(input.experimentId)
      ).catch(
        // An unreadable measurement layer is a CLOSED gate, never an open one.
        () => ({ profile: null, profileReadable: false }) as MeasurementLayerReadiness,
      ),
    ),
  );

  const acts: ProgrammeActOutcome[] = [];
  const assignments: DispositionAssignment[] = [];
  const executed = new Set<ProgrammeActKind>();
  let stopReason: ProgrammeRunStopReason | null = null;

  /*
   * THE ONE GLOBAL STOP THIS LOOP CAN OBSERVE.
   *
   * `GlobalStopReason` is a CLOSED five-value union and nothing here adds a
   * sixth. Of the five, exactly one is a fact about the request that this loop
   * is in a position to observe: the governing domain declaration being absent
   * or unratified. `POST …/crystal/[id]/assign` already treats it as a global
   * stop for the same reason its own canary states — *"an unratified boundary is
   * a GLOBAL stop, not N per-record refusals"*: evaluating it per record would
   * report N identical refusals for one fact about the domain.
   *
   * The other four are not observable here and are therefore not asserted:
   * `steward-identity-unresolved` is refused upstream by the route's persona
   * gate, and `wrong-acquisition-domain`, `wrong-corpus-target` and
   * `recommendation-set-changed` are facts about a DISPLAYED batch that the
   * operator is confirming — this loop displays no batch and confirms none.
   * Claiming one of them here would be an assertion about a comparison that was
   * never made.
   */
  let globalStop: GlobalStop | null = domainAcceptsAssignment(current.declaration)
    ? null
    : {
        reason: 'governing-declaration-absent',
        detail:
          `domain '${current.declaration.domain}' is '${current.declaration.ratification}' — no act may proceed ` +
          'against an unratified boundary, and this is one fact about the domain rather than one refusal per record',
      };

  while (stopReason === null) {
    // THE WALL-CLOCK CHECK, at the TOP of every iteration — before the
    // global-stop check, the act-budget check, and act selection, not only
    // after a next act is already chosen (2026-08-30, "empty 504" repair).
    // This is what makes a slow STATE LOAD alone (not just a slow act)
    // observable to the loop: the very first iteration checks elapsed time
    // before doing anything else, so even a run with zero offerable acts
    // reports cleanly if composing the state already consumed the budget.
    const elapsedAtTop = clock() - startedAt;
    if (elapsedAtTop >= timeBudgetMs) {
      stopReason = {
        kind: 'time-budget-exhausted',
        elapsedMs: elapsedAtTop,
        budgetMs: timeBudgetMs,
        detail:
          'the wall-clock budget was reached before this iteration\'s next act could be selected and started. ' +
          'It was NOT begun, so nothing is half-applied; re-running continues from here.',
      };
      break;
    }

    // A genuine batch-integrity failure — one of the five enumerated reasons —
    // is the ONLY thing besides exhaustion or a gate that halts the run.
    if (globalStop) {
      stopReason = { kind: 'global-integrity-failure', globalStop };
      break;
    }
    if (acts.length >= budget) {
      stopReason = {
        kind: 'act-budget-exhausted',
        budget,
        detail:
          `the run reached its ceiling of ${budget} act(s) with work still available. Nothing was left ` +
          'half-executed: the budget is checked between acts, never inside one.',
      };
      break;
    }

    // Everything the projection offers that this run has not already executed.
    const offerable = PROGRAMME_ACT_KINDS.filter(
      (kind) => !executed.has(kind) && offerableStage(current.programme, kind) !== null,
    );
    // THE GATE, applied. An acquisition-class act is WITHHELD, not skipped:
    // withheld acts are named on the stop reason so the run says what it did not
    // do and why (`CI-2026-08-03-EXCLUSION-VISIBLE-NOT-DISCARDED-001` applied to
    // acts rather than records).
    const withheldActs = measurementLayerGate.satisfied
      ? []
      : offerable.filter((kind) => ACT_CLASS[kind] === 'v2-acquisition');
    const permitted = offerable.filter((kind) => !withheldActs.includes(kind));

    const nextKind = permitted[0];
    if (!nextKind) {
      if (withheldActs.length > 0) {
        stopReason = {
          kind: 'blocked-on-measurement-layer',
          gate: measurementLayerGate,
          withheldActs,
          detail:
            `${withheldActs.length} acquisition-class act(s) are unblocked by the programme but withheld: ` +
            `${withheldActs.join(', ')}. ${measurementLayerGate.detail}`,
        };
        break;
      }
      const pending = current.pendingDecision;
      if (pending) {
        stopReason =
          pending.authority === 'governance'
            ? { kind: 'awaiting-governance', decision: pending }
            : { kind: 'awaiting-human-judgment', decision: pending };
      } else {
        stopReason = {
          kind: 'no-executable-act-remains',
          detail: current.programme.stages.every((s) => s.status === 'complete')
            ? 'every Track 2 stage is complete'
            : `no machine-runnable act is unblocked — the programme is at '${current.programme.currentStageId}'`,
        };
      }
      break;
    }

    const stage = offerableStage(current.programme, nextKind) as Track2Stage;
    executed.add(nextKind);
    const outcome = await timer.time(`act:${nextKind}`, () =>
      nextKind === 'extract-candidates'
        ? runExtractAct(current, stage)
        : runValidateAct(current, stage, input.personaId),
    );
    acts.push(outcome);
    assignments.push(...outcome.assignments);
    if (outcome.globalStop) globalStop = outcome.globalStop;

    // RE-READ, never advance a cursor. The projection is the source of truth for
    // what is unblocked, and it may have changed in ways this act did not intend.
    const reread = await timer.time('final-state-recomputation', () =>
      loadTrack2ProgrammeState({ experimentId: input.experimentId, acquisitionDomain: input.acquisitionDomain }),
    );
    if ('error' in reread) {
      stopReason = {
        kind: 'programme-unreadable',
        detail: `the programme could not be re-read after the '${nextKind}' act: ${reread.error}`,
      };
      break;
    }
    current = reread;
  }

  const finalState = current;
  const isolation = summarizeIsolation(assignments, globalStop, 'record');
  const actsSucceeded = acts.filter((a) => a.ok).length;
  const actsFailed = acts.length - actsSucceeded;
  const actExecution: ProgrammeRunResult['actExecution'] =
    acts.length === 0 ? 'not-started' : actsFailed === 0 ? 'complete' : actsSucceeded === 0 ? 'failed' : 'partial';

  const pendingDecision =
    stopReason?.kind === 'awaiting-governance' || stopReason?.kind === 'awaiting-human-judgment'
      ? stopReason.decision
      : finalState.pendingDecision;

  const criticalPath = buildCriticalPath({
    stageLabel: pendingDecision?.stageLabel ?? finalState.programme.currentStageId,
    actVerb: 'Advance',
    noun: 'record',
    counts: isolation.counts,
    freezeBlockers: 0,
  });

  const population = buildRunPopulation(finalState, assignments, isolation);
  const headline = renderRunHeadline({
    actExecution,
    acts,
    stopReason: stopReason as ProgrammeRunStopReason,
    isolation,
  });
  const gateNote = measurementLayerGate.satisfied
    ? ''
    : ` Sequencing gate CLOSED — ${measurementLayerGate.detail}`;

  // THE ONE RUN-LEVEL RECEIPT. Rides the SAME `research_lifecycle_transition`
  // action type every research approval rides — `writeLifecycleReceipt`'s own
  // header: "NEVER FORK THIS". A second action type for an orchestrated run
  // would be a second receipt path for the same class of event.
  // `invariantSeedIds: []` is the established value at every non-experiment
  // call site (assign, bulk-review, observer-review); inventing seed ids here
  // would be a guess.
  const receipt = await writeLifecycleReceipt({
    personaId: input.personaId,
    summary:
      `Research programme run over ${finalState.experimentId} (${finalState.declaration.domain}): ` +
      `${acts.length} act(s) attempted, ${actsSucceeded} succeeded, ${actsFailed} failed [${actExecution}]. ` +
      `Stopped: ${stopReason?.kind ?? 'unknown'}` +
      (pendingDecision ? ` at '${pendingDecision.stageId}' (${pendingDecision.authority})` : '') +
      `. Exceptions isolated: ${isolation.counts.exceptions}; refused: ${isolation.counts.refused}. ` +
      `Sequencing gate: ${measurementLayerGate.satisfied ? `open under profile '${measurementLayerGate.profileVersion}'` : 'CLOSED (acquisition-class acts withheld)'}. ` +
      `Population — ${renderPopulationLine(population)}. No freeze, no statement edit, no boundary change.`,
    invariantSeedIds: [],
  }).catch(() => ({ ok: false, receiptId: null }));

  return {
    experimentId: finalState.experimentId,
    crystalDomain: finalState.declaration.domain,
    acquisitionDomain: finalState.acquisitionDomain,
    actExecution,
    actsAttempted: acts.length,
    actsSucceeded,
    actsFailed,
    acts,
    reconciles: actsSucceeded + actsFailed === acts.length,
    measurementLayerGate,
    stopReason: stopReason as ProgrammeRunStopReason,
    pendingDecision,
    isolation,
    criticalPath,
    population,
    populationUnreadable: finalState.unreadableSignals,
    programme: finalState.programme,
    receipt,
    guardrails: ORCHESTRATOR_GUARDRAILS,
    headline: `${headline}${gateNote}`,
    diagnostics: { timings: timer.snapshot(), totalElapsedMs: clock() - startedAt },
  };
}

// ── POPULATION DISCLOSURE — the counterweight, in every result ──────────────

/**
 * THE EIGHT FIELDS, from the SAME read the programme was built from.
 *
 *   > "isolating exceptions must not allow the system to quietly reduce the
 *   >  corpus until readiness passes."
 *
 * A signal that could not be read contributes 0 AND is named in
 * `populationUnreadable`, because a zero derived from an unreadable substrate
 * and a genuine zero are different facts and this shape cannot express the
 * difference on its own.
 */
function buildRunPopulation(
  state: Track2ProgrammeState,
  assignments: readonly DispositionAssignment[],
  isolation: IsolationSummary,
): PopulationDisclosure {
  const sources = state.signalCounts.candidateSources;
  const candidates = state.signalCounts.discoveryCandidates;
  const cohort = state.cohort;
  return {
    discovered: sources?.total ?? 0,
    admitted: sources?.admitted ?? 0,
    candidatesExtracted: candidates?.total ?? 0,
    validated: cohort ? cohort.invariantIds.length - cohort.unvalidated : 0,
    assignedToCrystal: state.readiness.invariantCount,
    excludedWithWarnings: assignments.filter((a) => a.disposition === 'ready-with-warning').length,
    exceptions: isolation.counts.exceptions,
    refused: isolation.counts.refused,
  };
}

/** One line, for the receipt. Mirrors `renderPopulationDisclosure`'s field order
 *  without importing a second renderer for a receipt-length string. */
function renderPopulationLine(p: PopulationDisclosure): string {
  return (
    `discovered ${p.discovered}, admitted ${p.admitted}, extracted ${p.candidatesExtracted}, ` +
    `validated ${p.validated}, assigned ${p.assignedToCrystal}, warnings ${p.excludedWithWarnings}, ` +
    `exceptions ${p.exceptions}, refused ${p.refused}`
  );
}

/**
 * ONE line stating what happened, in the operator's register — and it can never
 * describe a partial run as complete. `actExecution` is derived from whether
 * every attempted act succeeded, and the headline names the stop reason in every
 * branch, so "stopped" is never reported without why.
 */
function renderRunHeadline(input: {
  actExecution: ProgrammeRunResult['actExecution'];
  acts: readonly ProgrammeActOutcome[];
  stopReason: ProgrammeRunStopReason;
  isolation: IsolationSummary;
}): string {
  const { actExecution, acts, stopReason, isolation } = input;
  const ran =
    actExecution === 'not-started'
      ? 'No act was executed'
      : actExecution === 'complete'
        ? `${acts.length} act(s) executed, all succeeded`
        : actExecution === 'failed'
          ? `${acts.length} act(s) attempted, NONE succeeded`
          : `PARTIAL — ${acts.filter((a) => a.ok).length} of ${acts.length} act(s) succeeded`;

  const why = (() => {
    switch (stopReason.kind) {
      case 'awaiting-governance':
        return `Stopped for your act: ${stopReason.decision.stageLabel} — ${stopReason.decision.actor}.`;
      case 'awaiting-human-judgment':
        return `Stopped for your judgment: ${stopReason.decision.stageLabel} — ${stopReason.decision.actor}.`;
      case 'blocked-on-measurement-layer':
        return (
          `Stopped BEFORE new extraction or crystal construction: the measurement layer is not yet hardened ` +
          `and demonstrated, so ${stopReason.withheldActs.join(', ')} was withheld. This is an engineering ` +
          `precondition, not a decision for you — ` +
          stopReason.gate.gaps.join('; ') +
          '.'
        );
      case 'global-integrity-failure':
        return `Stopped on a batch-integrity failure: ${stopReason.globalStop.reason} — ${stopReason.globalStop.detail}.`;
      case 'no-executable-act-remains':
        return `Nothing further can be automated — ${stopReason.detail}.`;
      case 'act-budget-exhausted':
        return `Stopped at the ${stopReason.budget}-act ceiling with work still available — re-run to continue.`;
      case 'time-budget-exhausted':
        return `Stopped at the time budget (${stopReason.elapsedMs}ms of ${stopReason.budgetMs}ms) before the next act began — re-run to continue.`;
      case 'programme-unreadable':
        return `Stopped because the programme could not be re-read: ${stopReason.detail}.`;
    }
  })();

  const isolated =
    isolation.counts.exceptions + isolation.counts.refused > 0
      ? ` ${isolation.counts.exceptions} record(s) isolated as exceptions${isolation.counts.refused > 0 ? `, ${isolation.counts.refused} refused` : ''} — they did not hold the run back.`
      : '';

  return `${ran}. ${why}${isolated}`;
}
