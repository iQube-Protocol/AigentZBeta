/**
 * CrystalRemediationProfile — the ONE versioned object both the research
 * programme orchestrator and the crystal readiness instrument suite converge
 * on (operator direction, 2026-08-26).
 *
 * ── Why this lives in `types/` and not in either owner's module ─────────────
 *
 * Two tracks read it and neither owns it. Track 1 (the orchestrator,
 * `services/research/researchProgrammeOrchestrator.ts`) consumes it READ-ONLY
 * as its precondition gate; Track 2 (the instrument suite,
 * `services/research/crystal*.ts`) produces the instrument-side halves of it.
 * A type that lives inside either owner makes the other import a service to
 * read a shape, and the first refactor puts a second copy in the tree — the
 * exact `inv.engineering.036/037` defect this repo's source-of-truth parity
 * rule exists to prevent. So the shape lives here, imports nothing, and both
 * tracks import it.
 *
 * ── What the object is FOR (operator, verbatim) ────────────────────────────
 *
 *   > "I'd also have both tracks converge on one versioned
 *   >  `CrystalRemediationProfile` object so the orchestrator never reads loose
 *   >  reviewer prose or infers thresholds itself. The profile should contain
 *   >  the bound source refs, check mappings, task-derived population formula,
 *   >  boundary requirement, and instrument version/hash. Once that object is
 *   >  frozen, the orchestrator can safely consume it as configuration rather
 *   >  than interpretation."
 *
 * The load-bearing word is CONFIGURATION. An orchestrator that reads a review's
 * prose has to interpret it, and interpretation is where a gate silently
 * becomes an opinion. A frozen profile is data: the orchestrator applies it.
 *
 * ── CONTENT IS DELIBERATELY ABSENT ────────────────────────────────────────
 *
 * No profile instance ships in this repository yet, and none may be authored
 * from a review pasted into a chat. A review artifact needs a `sourceRef` that
 * can be re-read and hashed; without one, populating this object would put
 * unverifiable content behind a gate that governs whether a second crystal may
 * be constructed. `bound: false` is the honest state, and every consumer must
 * fail closed on it — see `remediationProfileBindingState`.
 *
 * Nothing about any particular review belongs in this file: no reviewer name,
 * no review number, no fixed finding set. The shape is generic so the review
 * that raises a different finding next quarter needs no change here.
 */

/**
 * A pointer to an authoritative artifact. BOUND REFS, NOT INLINED PROSE — the
 * profile carries the address of the thing it was derived from so a reader can
 * go and read it, and so a hash mismatch is detectable. A ref whose
 * `contentHash` is null is a locatable but unverifiable source; a consumer that
 * requires verifiability must treat it as insufficient rather than as present.
 */
export interface BoundSourceRef {
  /** Stable identifier for the artifact (e.g. a review id). */
  refId: string;
  /** Where it lives: a repo path, an artifact id, or a URL. Never a summary. */
  locator: string;
  /** sha256 (or the repo's `commit()` projection) over the artifact, when the
   *  artifact is content-addressable. null = locatable but unverifiable. */
  contentHash: string | null;
  /** What kind of artifact this is, in the consumer's own vocabulary. */
  kind: 'external-review' | 'protocol-section' | 'operator-ruling' | 'instrument-suite' | 'other';
  /** Human-readable one-line note. Never a substitute for the locator. */
  note: string | null;
}

/**
 * ONE finding, mapped onto the readiness checks that MEASURE it.
 *
 * `bearsOnChecks` names checks by the readiness engine's own vocabulary. Per
 * the CFS-054 discipline (an implementation correction behind an already-pinned
 * check name is not a contract amendment; a genuinely new first-class check
 * name is), most findings map onto EXISTING pinned names. A finding naming a
 * check the engine does not emit is a GAP — recorded as such, never silently
 * dropped and never silently re-pointed at a check that does exist.
 */
export interface RemediationCheckMapping {
  findingId: string;
  /** The finding in the consumer's terms. Short; the authority is the ref. */
  label: string;
  /** Readiness check names this finding is measured by. */
  bearsOnChecks: readonly string[];
  /** The module that implements the measurement, or null when none does yet. */
  instrument: string | null;
  /** True only when the finding maps onto ≥1 check the engine emits AND names
   *  an implementing instrument. */
  executable: boolean;
  /** Why it is not executable. null when it is. */
  gap: string | null;
}

/**
 * The §3.6-derived population requirement, carried as a FORMULA — never as a
 * baked number (operator, verbatim: *"The implementation should derive the
 * minimum crystal population from the frozen EXP-P1 collection-size guard, not
 * from a new hard-coded target. The arithmetic should remain visible:
 * `required evaluation slice ÷ 0.40 = minimum collection size`. So if the task
 * design needs 24 usable statements, the collection floor is 60; if the final
 * task design needs a larger slice, the floor rises mechanically. No new magic
 * number."*).
 *
 * `sliceFractionOfCrystal` is the ⊆40% guard itself and is the ONLY constant
 * here; everything else is an input or a quotient. `derivationLines` carries
 * the arithmetic with each operand's source named, so a reader can audit the
 * division without reading code.
 */
export interface TaskDerivedPopulationFormula {
  /** The frozen ⊆40% Arm C slice guard. */
  sliceFractionOfCrystal: number;
  /** Where the guard is registered. */
  sliceGuardSourceRef: string;
  /** How the slice demand was obtained: from a finalized task set, or from the
   *  registered minimum task design (a FLOOR, not a target). */
  sliceDemandBasis: 'finalized-task-set' | 'registered-minimum-task-design';
  /** The numerator. null when not derivable from available inputs. */
  requiredEvaluationSliceSize: number | null;
  /** requiredEvaluationSliceSize ÷ sliceFractionOfCrystal, rounded up. */
  minimumCollectionSize: number | null;
  /** The auditable arithmetic, one line per step, each naming its source. */
  derivationLines: readonly string[];
  /** Inputs that were needed and absent. Non-empty ⇒ the formula is not
   *  derivable and a consumer must report unknown rather than substitute a
   *  default. */
  insufficientInputs: readonly string[];
}

/**
 * The namespace-coverage requirement.
 *
 * `mayNarrowBoundary` exists to be permanently false in configuration. Coverage
 * can arithmetically be "fixed" either by extending the corpus or by narrowing
 * the declared boundary, and the second is a governance act that must be
 * surfaced as one — never taken by an instrument, an orchestrator, or an agent
 * as an implementation shortcut. The field is here so that intent is data a
 * consumer can read, not a comment a consumer can miss.
 */
export interface BoundaryCoverageRequirement {
  /** The declared boundary's own source of truth (e.g. a namespace constant). */
  boundarySourceRef: string;
  /** Namespaces the declared boundary contains. */
  declaredNamespaces: readonly string[];
  /** How many of them the crystal must represent for the gate to pass. */
  requiredRepresentedNamespaceCount: number | null;
  /** The only sanctioned remedy for a shortfall. */
  remedy: 'extend-corpus';
  /** Always false. Narrowing the boundary is a separate governance decision. */
  mayNarrowBoundary: false;
}

/**
 * WHICH INSTRUMENT SUITE produced or validated this profile.
 *
 * `contractFingerprint` is a commitment over the suite's DECLARED CONTRACT
 * (check names, tiers, what each gates on, the structural vocabularies, the
 * population formula) — not over the source bytes. That is a deliberate,
 * disclosed limitation: a behaviour change that leaves the declared contract
 * identical will not move the fingerprint. It moves whenever the contract a
 * consumer configures against moves, which is what a consumer needs.
 */
export interface InstrumentSuiteIdentity {
  suiteVersion: string;
  contractFingerprint: string;
  /** Modules the fingerprint claims to cover, for a reader to spot-check. */
  modules: readonly string[];
}

/**
 * THE RETROSPECTIVE FALSIFICATION VERDICT — read in the same breath as the
 * profile's binding state, because the verdict is what licenses the binding.
 *
 * ⚠ THE SENSE OF "PASSED" IS INVERTED HERE AND IS EASY TO GET BACKWARDS.
 * The retrospective PASSES when the hardened instruments **REJECT** the frozen
 * artifact the independent reviewer rejected. A result of "the frozen crystal
 * still passes readiness" is a FAILURE of the remediation, not a success. The
 * field is therefore named `reproducedReviewerObjections` and never `ok`.
 */
export interface RetrospectiveFalsificationRef {
  /** TRUE ⇒ the hardened gates reject the artifact the reviewer rejected. */
  reproducedReviewerObjections: boolean;
  /** Where the full verdict can be re-read and recomputed. */
  verdictRoute: string;
  /** The frozen artifact's content commitment the verdict was computed against,
   *  and whether the live re-query matched it (CI-2026-08-09
   *  HASH-VERIFIED-FROZEN-PROJECTION). */
  crystalContentHash: string | null;
  verifiedAgainstFreeze: boolean | null;
  computedAt: string;
}

/**
 * The profile's own lifecycle. `bound` (equivalently "frozen", in the
 * operator's phrasing) is the state at which a consumer may apply the profile
 * as configuration. Everything below it fails closed.
 */
export type RemediationProfileBinding =
  /** No authoritative review artifact has been ingested. Nothing to bind. */
  | 'unbound-no-artifact'
  /** An artifact exists but the profile is incomplete or non-executable. */
  | 'unbound-incomplete'
  /** Complete and executable, but the retrospective falsification has not
   *  reproduced the reviewer's objections against the frozen artifact. */
  | 'unbound-retrospective-not-reproduced'
  /** Bound/frozen. Safe to consume as configuration. */
  | 'bound';

export interface CrystalRemediationProfile {
  /** Version of THIS profile instance, not of the schema. */
  profileVersion: string;
  /** Which crystal/experiment the profile governs. */
  experimentId: string;
  /** (1) Bound source refs — the authoritative artifacts, by address. */
  sourceRefs: readonly BoundSourceRef[];
  /** (2) Check mappings — finding → the readiness checks that measure it. */
  checkMappings: readonly RemediationCheckMapping[];
  /** (3) The task-derived population formula. */
  populationFormula: TaskDerivedPopulationFormula;
  /** (4) The boundary/namespace-coverage requirement. */
  boundaryRequirement: BoundaryCoverageRequirement;
  /** (5) Which instrument suite produced/validated this profile. */
  instrumentSuite: InstrumentSuiteIdentity;
  /** The retrospective verdict that licenses binding. null = not yet run. */
  retrospective: RetrospectiveFalsificationRef | null;
  binding: RemediationProfileBinding;
  /** Every reason the profile is not bound, named. Empty iff bound. */
  bindingGaps: readonly string[];
}

/**
 * THE INGESTED PROFILES — **EMPTY, DELIBERATELY.** See the file header.
 *
 * A consumer reading this list and finding it empty has learned the truth: no
 * remediation profile is bound, so no v2 extraction act is licensed. That is
 * the fail-closed state, and it is correct until an authoritative review
 * artifact with a re-readable `sourceRef` is ingested.
 */
export const BOUND_CRYSTAL_REMEDIATION_PROFILES: readonly CrystalRemediationProfile[] = [];

/**
 * Resolve a profile's binding state from its own contents — a DERIVATION, never
 * a stored assertion, so a profile cannot claim `bound` while carrying a gap.
 *
 * Deliberately ordered: the earliest unmet condition is the one reported, so a
 * consumer is told the FIRST thing that is missing rather than the last.
 */
export function remediationProfileBindingState(
  profile: Pick<
    CrystalRemediationProfile,
    'sourceRefs' | 'checkMappings' | 'populationFormula' | 'boundaryRequirement' | 'retrospective'
  >,
): { binding: RemediationProfileBinding; bindingGaps: string[] } {
  const gaps: string[] = [];

  if (profile.sourceRefs.length === 0) {
    return {
      binding: 'unbound-no-artifact',
      bindingGaps: [
        'no bound source ref — no authoritative review artifact has been ingested, and a review pasted ' +
          'into a chat is not an artifact (it has no locator and no content hash, so it cannot be re-read ' +
          'or verified)',
      ],
    };
  }
  if (profile.checkMappings.length === 0) {
    gaps.push('no check mappings — nothing in the profile is measurable by any readiness check');
  }
  for (const m of profile.checkMappings) {
    if (!m.executable) gaps.push(`${m.findingId}: ${m.gap ?? 'not executable'}`);
  }
  if (profile.populationFormula.insufficientInputs.length > 0) {
    gaps.push(
      `population formula not derivable: ${profile.populationFormula.insufficientInputs.join('; ')}`,
    );
  }
  if (profile.populationFormula.minimumCollectionSize === null) {
    gaps.push('population formula yields no minimum collection size');
  }
  if (profile.boundaryRequirement.requiredRepresentedNamespaceCount === null) {
    gaps.push('boundary requirement names no required represented-namespace count');
  }
  if (gaps.length > 0) return { binding: 'unbound-incomplete', bindingGaps: gaps };

  // The retrospective is the LAST gate, and its sense is inverted: it passes
  // when the hardened instruments REJECT the artifact the reviewer rejected.
  if (!profile.retrospective) {
    return {
      binding: 'unbound-retrospective-not-reproduced',
      bindingGaps: ['the retrospective falsification against the frozen crystal has not been run'],
    };
  }
  if (!profile.retrospective.reproducedReviewerObjections) {
    return {
      binding: 'unbound-retrospective-not-reproduced',
      bindingGaps: [
        'the hardened instruments did NOT reject the frozen crystal the reviewer rejected — the ' +
          'measurement layer is not fixed, so no v2 extraction act is licensed (this is a failure of the ' +
          'remediation, not of the crystal)',
      ],
    };
  }
  return { binding: 'bound', bindingGaps: [] };
}
