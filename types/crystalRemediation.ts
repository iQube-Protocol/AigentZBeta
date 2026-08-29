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
 * EXP-P1 REMEDIATION PROFILE — v1, authored 2026-08-29.
 *
 * The first profile instance this file has ever carried. It is authored from
 * three re-readable, hash-verifiable repo artifacts (never from prose pasted
 * into a chat):
 *
 *   - IRL Review #001 (Austin) — the independent reviewer's four findings on
 *     frozen Crystal vP1, quoted verbatim, and the operator's accepted
 *     response.
 *   - RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001 — the
 *     structured resolution record (observedFailure / rootCauses /
 *     resolution / rejectedApproaches).
 *   - The frozen EXP-P1 protocol README (§3.6/§6 collection-size guard, §5.2
 *     task design, §4 selection procedure, §5.1/§5.4 boundary-authorship
 *     requirements).
 *
 * `contentHash` on each ref is a real sha256 of that file's bytes at
 * authoring time (git commit `938a49309`), independently reproducible with
 * `sha256sum <locator>`. `instrumentSuite` is the real,
 * `crystalInstrumentSuiteIdentity()`-computed identity of the v2.0.0 suite at
 * that same commit (not re-derived here, to keep this file import-free —
 * see the header). `populationFormula` is the real output of
 * `deriveCrystalPopulationRequirement({})` (registered-minimum-task-design
 * basis — no finalized task set exists yet, so every figure is a FLOOR).
 * Neither figure is hand-computed; both were run and copied verbatim.
 *
 * ── `retrospective: null` — NOT YET RUN, honestly ─────────────────────────
 *
 * Computing `CrystalRetrospectiveFalsification` requires a LIVE read of the
 * frozen Crystal vP1 artifact and its invariant rows
 * (`runCrystalReadinessReport` + `buildFrozenCrystalManifest`), which this
 * authoring pass had no live database access to perform. This is why
 * `remediationProfileBindingState` below still reports
 * `'unbound-retrospective-not-reproduced'` for this profile — correctly: the
 * sequencing gate remains CLOSED until the retrospective is actually run.
 *
 * To complete binding: call
 * `GET /api/research/crystal/EXP-P1/instrument-falsification` (steward or
 * admin auth) and, if and only if the response's
 * `retrospective.reproducedReviewerObjections === true`, replace this
 * profile's `retrospective: null` with that exact response's `retrospective`
 * object, verbatim. Never assert a verdict that has not been observed —
 * `CI-2026-08-26-UNASSESSABLE-IS-NOT-REPRODUCED-001`.
 */
const EXP_P1_REMEDIATION_PROFILE_CONTENT: Omit<CrystalRemediationProfile, 'binding' | 'bindingGaps'> = {
  profileVersion: 'exp-p1-remediation-2026-08-29.v1',
  experimentId: 'EXP-P1',
  sourceRefs: [
    {
      refId: 'IRL-REVIEW-001',
      locator:
        'codexes/packs/agentiq/updates/2026-08-26_crystal-vp1-review-cycle-1-instrument-remediation.md',
      contentHash: 'e0ca4b11c93b61e61e78687d80f1ab1f55014487f095cca864bff6d0582f1904',
      kind: 'external-review',
      note:
        "Austin's independent review of frozen Crystal vP1 (changes_requested) — the four findings, " +
        "quoted verbatim, and the operator's accepted response.",
    },
    {
      refId: 'RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001',
      locator:
        'codexes/packs/agentiq/resolution-records/records/' +
        'RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001.json',
      contentHash: '57b43d2fce6480fc970e5b6a53f95b79c43b43e9a111a8831459017572f4df5f',
      kind: 'operator-ruling',
      note:
        'The structured resolution record: observedFailure / rootCauses / resolution / ' +
        'rejectedApproaches for remediation cycle 1.',
    },
    {
      refId: 'EXP-P1-README',
      locator:
        'codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md',
      contentHash: '5c3f6f072fb80cd42f820f839f411b3a0721b5ebf13d60c1a118c534d25af453',
      kind: 'protocol-section',
      note:
        'The frozen EXP-P1 protocol — §3.6/§6 collection-size guard, §5.2 task design, §4 ' +
        'Blinding/selection procedure, §5.1/§5.4 task-authorship-against-boundary requirements.',
    },
  ],
  checkMappings: [
    {
      findingId: 'AUSTIN-R001-F1-DUPLICATES',
      label:
        'Near-identical statement pairs (1/3, 2/8, 5/10, 4/7) with inverted dependency direction ' +
        'scored near-zero lexical similarity and passed',
      bearsOnChecks: ['duplicate-detection'],
      instrument: 'services/research/crystalSemanticStructure.ts',
      executable: true,
      gap: null,
    },
    {
      findingId: 'AUSTIN-R001-F2-STATEMENT-QUALITY',
      label:
        'All 15 statements are bare "X is essential for Y" generalities carrying none of the seven ' +
        'relational structures (causal, conditional, propagation, constraint, threshold, trade-off, ' +
        'quantitative); conjunctions entail nothing unstated',
      bearsOnChecks: ['derivation-headroom'],
      instrument: 'services/research/crystalSemanticStructure.ts',
      executable: true,
      gap: null,
    },
    {
      findingId: 'AUSTIN-R001-F3-SIZE',
      label:
        'Collection size fails the frozen §3.6 collection-size guard against the registered task ' +
        'design; the prior "slice ≥ 5" bar was criterion drift against that frozen constraint',
      bearsOnChecks: ['selection-space'],
      instrument: 'services/research/crystalPopulationRequirement.ts',
      executable: true,
      gap: null,
    },
    {
      findingId: 'AUSTIN-R001-F4-COVERAGE',
      label:
        'Crystal spans 2 of 15 ratified boundary namespaces — a reviewer cannot author tasks against ' +
        'the declared boundary without broad failure or contamination',
      bearsOnChecks: ['boundary-coverage'],
      instrument: 'services/research/crystalStatistics.ts',
      executable: true,
      gap: null,
    },
  ],
  // Real output of deriveCrystalPopulationRequirement({}) — services/research/
  // crystalPopulationRequirement.ts — run and copied verbatim, not hand-derived.
  populationFormula: {
    sliceFractionOfCrystal: 0.4,
    sliceGuardSourceRef:
      'codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md §6 ' +
      '(Collection-size guard + enlargement discipline, locked at freeze)',
    sliceDemandBasis: 'registered-minimum-task-design',
    requiredEvaluationSliceSize: 24,
    minimumCollectionSize: 60,
    derivationLines: [
      'task design: 24 tasks MINIMUM (12 recall + 12 derivation) — codexes/packs/irl/foundation/' +
        'experiments/exp-p1-representation-runtime-gauntlet/README.md §5.2 (Task Set — size and ' +
        'composition, minimum). No finalized task set was supplied, so every figure below is a FLOOR ' +
        'derived from the registered minimum, never a target.',
      'premise demand per task: recall ≥ 1, derivation ≥ 2 — services/research/taskCoverage.ts::' +
        'minimumPremisesForTaskKind ("a derivation requires composing premises"), reused not restated',
      'NON-DEGENERACY (the one formalising step — challenge this one): §6 requires the fixed slice to ' +
        'leave Arm B\'s live selection with discriminatory power ("else Arm C ≈ Arm B degenerately"), ' +
        'and §4\'s Blinding note classifies each task selection-neutral/selection-sensitive by ' +
        'MECHANICAL SET COMPARISON of B\'s selected slice against C\'s fixed slice. Two tasks with ' +
        'identical grounding sets are one task repeated for that classifier. So each task needs its ' +
        'own usable grounding statement inside the fixed slice ⇒ required evaluation slice ≥ 24.',
      '⊆40% collection-size guard — codexes/packs/irl/foundation/experiments/' +
        'exp-p1-representation-runtime-gauntlet/README.md §6 (Collection-size guard + enlargement ' +
        'discipline, locked at freeze) ⇒ minimum collection size = required evaluation slice ÷ 0.40 = ' +
        '24 ÷ 0.40 = 60',
      'derivation-task entailment demand: one distinct multi-premise chain per derivation task ⇒ 12 ' +
        'chain(s) whose conjunctions entail unstated conclusions (README §5.2 + §6(d))',
      'relationally-composable floor: 12 DISTINCT premise pairs need a pool of k with C(k,2) ≥ 12 ⇒ ' +
        'k ≥ 6 relationally-structured member(s) inside the slice (combinatorial floor, not a chosen ' +
        'number)',
      'the fixed slice is constructed by the standard domain procedure applied to the DOMAIN, not to ' +
        'the tasks (README §4), so the crystal cannot be relied on to concentrate its relational ' +
        'members inside the slice; the crystal-level fraction must carry the requirement in ' +
        'expectation ⇒ 6 ÷ 24 = 0.250',
      'CROSS-CHECK: CONSISTENT with §6\'s own worked illustration: at 18 invariants the guard caps the ' +
        'slice at 7, which §6 calls "plainly insufficient to ground 24 tasks incl. 12 derivation ' +
        'items" — and 7 < 24, so this derivation also rejects it.',
    ],
    insufficientInputs: [],
  },
  boundaryRequirement: {
    boundarySourceRef: 'types/invariants.ts — INVARIANT_NAMESPACES (the ratified 15-namespace invariant ontology)',
    declaredNamespaces: [
      'constitutional', 'reasoning', 'engineering', 'experience', 'capability', 'style', 'narrative',
      'sovereignty', 'cybernetics', 'interaction', 'epistemology', 'representation', 'polity',
      'finance', 'commercialisation',
    ],
    requiredRepresentedNamespaceCount: 15,
    remedy: 'extend-corpus',
    mayNarrowBoundary: false,
  },
  // Real output of crystalInstrumentSuiteIdentity() — services/research/
  // crystalInstrumentSuite.ts — run and copied verbatim at authoring time
  // (git commit 938a49309). Not imported (this file stays import-free — see
  // header); re-run the function and compare if suite drift is suspected.
  instrumentSuite: {
    suiteVersion: '2.0.0',
    contractFingerprint: '9579131e04b1c3c293dd73bec360da68b0169b8021cc78e6542e45018837c8b3',
    modules: [
      'services/research/crystalReadiness.ts',
      'services/research/crystalSemanticStructure.ts',
      'services/research/crystalPopulationRequirement.ts',
      'services/research/crystalStatistics.ts',
      'services/research/crystalInstrumentFalsification.ts',
    ],
  },
  retrospective: null,
};

const EXP_P1_REMEDIATION_PROFILE_BINDING = remediationProfileBindingState(EXP_P1_REMEDIATION_PROFILE_CONTENT);

const EXP_P1_REMEDIATION_PROFILE_V1: CrystalRemediationProfile = {
  ...EXP_P1_REMEDIATION_PROFILE_CONTENT,
  binding: EXP_P1_REMEDIATION_PROFILE_BINDING.binding,
  bindingGaps: EXP_P1_REMEDIATION_PROFILE_BINDING.bindingGaps,
};

/**
 * THE INGESTED PROFILES.
 *
 * Carries the EXP-P1 v1 profile above — ingested (real, hash-verifiable
 * source refs exist), but NOT bound (the retrospective has not been run; see
 * that profile's own doc comment for the exact completion step). A consumer
 * reading `evaluateMeasurementLayerGate` today therefore sees
 * `binding: 'unbound-retrospective-not-reproduced'`, not
 * `'unbound-no-artifact'` — a real, more specific state than before this
 * profile existed, and the sequencing gate stays correctly CLOSED either
 * way. Every consumer must still fail closed on anything short of `'bound'`.
 */
export const BOUND_CRYSTAL_REMEDIATION_PROFILES: readonly CrystalRemediationProfile[] = [
  EXP_P1_REMEDIATION_PROFILE_V1,
];

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
