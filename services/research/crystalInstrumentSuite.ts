/**
 * The Crystal Readiness Instrument Suite — its DECLARED CONTRACT, in one place.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 *
 * Three consumers need to know the same three things about the suite: what
 * checks it emits, which tier each sits in, and which version/fingerprint
 * produced a given result.
 *
 *   - `crystalReadiness.ts` assigns each check its tier — previously by writing
 *     the tier literal beside each check, so the check list and the tier
 *     assignment were the same fact recorded twice.
 *   - `CrystalRemediationProfile` (types/crystalRemediation.ts) names the suite
 *     that validated it, so an orchestrator consuming the profile as
 *     configuration can tell whether the configuration matches the running
 *     instruments.
 *   - CFS-054 §2.5 PINS a check-name list constitutionally. Parity between that
 *     specification and the executable contract has to be checkable, which
 *     needs the executable contract to be a value, not a shape spread across a
 *     function body.
 *
 * ── The fingerprint's honest limit, stated up front ───────────────────────
 *
 * `crystalInstrumentSuiteFingerprint()` commits to the DECLARED CONTRACT — check
 * names, tiers, what each gates on, the structural vocabularies, and the
 * population formula's shape. It does NOT hash the source bytes of the
 * instrument modules. A change to how a check computes its answer that leaves
 * the declared contract identical will not move the fingerprint.
 *
 * That is the right trade for a configuration consumer (it moves exactly when
 * the thing they configure against moves) and the wrong one for a tamper seal
 * (it is not one). `suiteVersion` is the field that must be bumped by hand when
 * behaviour changes without the contract changing — and this comment is the
 * instruction to do so.
 *
 * Server-safe, pure, no I/O.
 */

import { commit } from '@/services/research/review/deterministic';
import {
  ARM_C_SLICE_FRACTION_OF_CRYSTAL,
  REGISTERED_MINIMUM_TASK_DESIGN,
} from '@/services/research/crystalPopulationRequirement';
import {
  RELATIONAL_STRUCTURES,
  RELATION_CLASSES,
} from '@/services/research/crystalSemanticStructure';
import type { InstrumentSuiteIdentity } from '@/types/crystalRemediation';

/**
 * v1.x.x — the pre-remediation suite: lexical Jaccard dedup, semanticType-label
 * derivation headroom, `minMeaningfulSliceSize ?? 5`, coverage disclosed as
 * advisory prose and gating nothing.
 *
 * v2.0.0 — IRL Review #001 remediation cycle 1 (2026-08-26). Three pinned
 * checks re-implemented behind their existing names, one new first-class check
 * added:
 *   - `duplicate-detection`   — lexical ∪ SEMANTIC (predicate-argument form).
 *   - `derivation-headroom`   — inferential capacity (conjunction entailment),
 *                               with the old label-diversity figure retained
 *                               and explicitly re-labelled as a proxy.
 *   - `selection-space`       — §3.6-derived population requirement.
 *   - `boundary-coverage`     — NEW NAME. Requires a CFS-054 §2.5 amendment,
 *                               drafted for operator ratification, NOT
 *                               self-ratified.
 *
 * BUMP THIS when instrument behaviour changes, including when the declared
 * contract below does not move — see the fingerprint's limit in the header.
 */
export const CRYSTAL_INSTRUMENT_SUITE_VERSION = '2.0.0';

export type CrystalReadinessTier = 'scientific-readiness' | 'scientific-maturity';

/**
 * The KIND of remediation a failing check actually needs — the vocabulary the
 * operator asked for (2026-08-27, "Crystal v1/v2 lineage collision"): *"Replace
 * the false '<3 minutes' estimate with a derived classification such as
 * `operator cleanup`, `additional acquisition required`, or `governance
 * decision required`."*
 *
 *   `operator-cleanup`                — the material to fix this already
 *                                        exists in the corpus; a steward
 *                                        reviews/merges/validates/relates
 *                                        EXISTING records through an
 *                                        already-built queue.
 *   `additional-acquisition-required` — no amount of relabelling what is
 *                                        already admitted can pass this check;
 *                                        new source material must be found
 *                                        and admitted.
 *   `governance-decision-required`    — resolving this check requires a
 *                                        ratified decision outside the
 *                                        pipeline itself (e.g. a CFS-054 §2.5
 *                                        boundary amendment) — never an
 *                                        automated or steward-clicked fix.
 */
export type CheckRemediationClass =
  | 'operator-cleanup'
  | 'additional-acquisition-required'
  | 'governance-decision-required';

export interface CrystalCheckContract {
  name: string;
  tier: CrystalReadinessTier;
  /** What the check actually measures, in one line. Part of the fingerprint,
   *  so a consumer's configuration breaks when the MEANING of a check moves —
   *  which is the case that burned us: the name stayed, the meaning drifted. */
  gatesOn: string;
  /** True iff CFS-054 §2.5's ratified nine-check list names it. A `false` here
   *  is a governance obligation, not a detail. */
  pinnedByCFS054: boolean;
  /**
   * UI-ROUTING METADATA ONLY — deliberately NOT part of `crystalInstrument
   * SuiteFingerprint()` (see `crystalInstrumentSuiteFingerprint`'s own
   * `.map()`, which cherry-picks fields and does not include these two). What
   * a check MEASURES is a scientific-instrument fact; where a steward goes to
   * FIX it is a Track 2 UI concern layered on top, and the two must be free to
   * change independently — a copy edit to a remediation destination must never
   * move the instrument-suite fingerprint a configuration consumer pins to.
   */
  remediationClass: CheckRemediationClass;
  /** The real Track 2 stage id whose EXISTING control resolves this check —
   *  `null` only when the remediation is rendered inline at the readiness
   *  stage itself (duplicate-detection's queue, and the two maturity checks'
   *  already-wired DiversityCandidateQueue/BridgeRelationshipQueue). Never a
   *  stage chosen for convenience — each one is where a real, already-built
   *  capability for THIS check's own remedy text actually lives. */
  remediationStageAnchor: Track2StageIdForRemediation;
}

/**
 * A deliberately narrow local alias — this module must not import
 * `Track2StageId` from `track2Programme.ts` (that module already imports
 * FROM here via `tierForCheck`'s sibling exports; importing back would be a
 * cycle). The literal union below is kept in sync with `Track2StageId` by
 * `tests/crystal-instrument-remediation.test.ts`'s parity canary, never by
 * hand-checking.
 */
export type Track2StageIdForRemediation =
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
 * THE EXECUTABLE READINESS CONTRACT. `crystalReadiness.ts` derives every
 * check's tier from this list; a check it emits that is absent here, or an
 * entry here it never emits, is a defect the canary catches.
 *
 * Order matches the order the checks are emitted, so a reader comparing a
 * report against this list reads them in the same sequence.
 */
export const CRYSTAL_READINESS_CHECK_CONTRACT: readonly CrystalCheckContract[] = [
  {
    name: 'selection-space',
    tier: 'scientific-readiness',
    gatesOn:
      'the ⌊0.40 × N⌋ Arm C slice cap meets the §3.6-derived evaluation-slice demand and remains a proper ' +
      'subset; reports insufficient-input rather than substituting a default when the demand is not derivable',
    pinnedByCFS054: true,
    remediationClass: 'additional-acquisition-required',
    remediationStageAnchor: 'discover-sources',
  },
  {
    name: 'derivation-headroom',
    tier: 'scientific-readiness',
    gatesOn:
      'INFERENTIAL CAPACITY — the count of conjunctions that entail unstated conclusions meets the derived ' +
      'chain demand, and the relationally-structured fraction meets the derived floor; label/lexical ' +
      'diversity is reported alongside as a proxy and no longer gates',
    pinnedByCFS054: true,
    remediationClass: 'additional-acquisition-required',
    remediationStageAnchor: 'discover-sources',
  },
  {
    name: 'structural-diversity',
    tier: 'scientific-maturity',
    gatesOn: 'the collection spans ≥2 semantic_type shapes with no single shape monopolising it',
    pinnedByCFS054: true,
    // Maturity, not a blocker — the remediation already renders inline at
    // Stage 9 (DiversityCandidateQueue). Never surfaced in a freeze-blocker list.
    remediationClass: 'additional-acquisition-required',
    remediationStageAnchor: 'run-readiness',
  },
  {
    name: 'duplicate-detection',
    tier: 'scientific-readiness',
    gatesOn:
      'zero near-duplicate pairs under the UNION of lexical word-set similarity and semantic ' +
      'predicate-argument form comparison (direction-canonicalised)',
    pinnedByCFS054: true,
    // The material is already IN the corpus — a steward reviews each flagged
    // pair and merges/relates via the existing mergeInvariants primitive.
    remediationClass: 'operator-cleanup',
    remediationStageAnchor: 'run-readiness',
  },
  {
    name: 'provenance-eligibility',
    tier: 'scientific-readiness',
    gatesOn: 'every member is Population A — evidence provenance external-established | external-empirical',
    pinnedByCFS054: true,
    remediationClass: 'operator-cleanup',
    remediationStageAnchor: 'classify-provenance',
  },
  {
    name: 'lifecycle-validation-integrity',
    tier: 'scientific-readiness',
    gatesOn: 'every member carries a real, receipted timesValidated > 0 — no bulk-authored filler',
    pinnedByCFS054: true,
    remediationClass: 'operator-cleanup',
    remediationStageAnchor: 'validate',
  },
  {
    name: 'relationship-density',
    tier: 'scientific-readiness',
    gatesOn: 'recorded intra-crystal edge density over the collection meets the floor',
    pinnedByCFS054: true,
    remediationClass: 'operator-cleanup',
    remediationStageAnchor: 'add-relationships',
  },
  {
    name: 'graph-connectivity',
    tier: 'scientific-maturity',
    gatesOn: 'the largest connected component holds enough of the collection',
    pinnedByCFS054: true,
    // Maturity, not a blocker — remediation already renders inline at Stage 9
    // (BridgeRelationshipQueue). Never surfaced in a freeze-blocker list.
    remediationClass: 'operator-cleanup',
    remediationStageAnchor: 'run-readiness',
  },
  {
    name: 'orphan-detection',
    tier: 'scientific-readiness',
    gatesOn: 'few enough members carry zero intra-crystal relationships',
    pinnedByCFS054: true,
    remediationClass: 'operator-cleanup',
    remediationStageAnchor: 'add-relationships',
  },
  {
    name: 'boundary-coverage',
    tier: 'scientific-readiness',
    gatesOn:
      'every namespace in the DECLARED boundary is represented by ≥1 crystal member, so a reviewer authoring ' +
      'tasks against the boundary cannot author into a region the crystal cannot ground; the only sanctioned ' +
      'remedy is corpus extension — narrowing the boundary is a separate governance decision this check ' +
      'never accepts as a fix',
    pinnedByCFS054: false,
    // The check's OWN sanctioned remedy is acquisition (see gatesOn above),
    // never narrowing — `pinnedByCFS054: false` already separately flags that
    // narrowing the boundary itself would be a distinct governance act.
    remediationClass: 'additional-acquisition-required',
    remediationStageAnchor: 'discover-sources',
  },
];

export const CRYSTAL_INSTRUMENT_SUITE_MODULES: readonly string[] = [
  'services/research/crystalReadiness.ts',
  'services/research/crystalSemanticStructure.ts',
  'services/research/crystalPopulationRequirement.ts',
  'services/research/crystalStatistics.ts',
  'services/research/crystalInstrumentFalsification.ts',
];

/** Check names the executable contract emits — the vocabulary a profile's
 *  `checkMappings` must name. */
export function crystalReadinessCheckNames(): string[] {
  return CRYSTAL_READINESS_CHECK_CONTRACT.map((c) => c.name);
}

/** Names NOT pinned by CFS-054 §2.5 — each one is a pending amendment. */
export function checksRequiringCFS054Amendment(): string[] {
  return CRYSTAL_READINESS_CHECK_CONTRACT.filter((c) => !c.pinnedByCFS054).map((c) => c.name);
}

export function tierForCheck(name: string): CrystalReadinessTier {
  const entry = CRYSTAL_READINESS_CHECK_CONTRACT.find((c) => c.name === name);
  if (!entry) {
    // A check emitted without a contract entry must not silently acquire the
    // permissive tier. Failing closed here means an unregistered check GATES,
    // which surfaces the omission on the first run rather than hiding it.
    return 'scientific-readiness';
  }
  return entry.tier;
}

/** What KIND of remediation a check needs — see `CheckRemediationClass`.
 *  An unregistered check name fails closed to the heaviest classification
 *  (`governance-decision-required`), the same "never silently permissive"
 *  discipline `tierForCheck` uses. */
export function remediationClassForCheck(name: string): CheckRemediationClass {
  return CRYSTAL_READINESS_CHECK_CONTRACT.find((c) => c.name === name)?.remediationClass
    ?? 'governance-decision-required';
}

/** The real Track 2 stage whose EXISTING control resolves a check — `null`
 *  for an unregistered check name (nothing to route to, honestly). */
export function remediationStageAnchorForCheck(name: string): Track2StageIdForRemediation | null {
  return CRYSTAL_READINESS_CHECK_CONTRACT.find((c) => c.name === name)?.remediationStageAnchor ?? null;
}

/**
 * The single worst (most consequential) classification among a set of
 * failing check names — `governance-decision-required` outranks
 * `additional-acquisition-required`, which outranks `operator-cleanup`. Used
 * to derive ONE honest overall label for a summary that names several
 * failing checks at once, replacing a fabricated time estimate with a real
 * classification of what remains (operator ruling, 2026-08-27).
 */
export function worstRemediationClass(checkNames: readonly string[]): CheckRemediationClass | null {
  const RANK: Record<CheckRemediationClass, number> = {
    'operator-cleanup': 0,
    'additional-acquisition-required': 1,
    'governance-decision-required': 2,
  };
  let worst: CheckRemediationClass | null = null;
  for (const name of checkNames) {
    const cls = remediationClassForCheck(name);
    if (worst === null || RANK[cls] > RANK[worst]) worst = cls;
  }
  return worst;
}

/**
 * A commitment over the suite's declared contract. Deterministic: same contract,
 * same fingerprint, on any machine, at any time. See the header for what it does
 * and does not cover.
 */
export function crystalInstrumentSuiteFingerprint(): string {
  return commit({
    suiteVersion: CRYSTAL_INSTRUMENT_SUITE_VERSION,
    checks: CRYSTAL_READINESS_CHECK_CONTRACT.map((c) => ({
      name: c.name,
      tier: c.tier,
      gatesOn: c.gatesOn,
      pinnedByCFS054: c.pinnedByCFS054,
    })),
    relationalStructures: [...RELATIONAL_STRUCTURES],
    relationClasses: [...RELATION_CLASSES],
    populationFormula: {
      sliceFractionOfCrystal: ARM_C_SLICE_FRACTION_OF_CRYSTAL,
      registeredMinimumTaskDesign: {
        totalTasks: REGISTERED_MINIMUM_TASK_DESIGN.totalTasks,
        recallTasks: REGISTERED_MINIMUM_TASK_DESIGN.recallTasks,
        derivationTasks: REGISTERED_MINIMUM_TASK_DESIGN.derivationTasks,
      },
      formula: 'required evaluation slice ÷ sliceFractionOfCrystal = minimum collection size',
    },
  });
}

/** The identity a `CrystalRemediationProfile` carries for this suite. */
export function crystalInstrumentSuiteIdentity(): InstrumentSuiteIdentity {
  return {
    suiteVersion: CRYSTAL_INSTRUMENT_SUITE_VERSION,
    contractFingerprint: crystalInstrumentSuiteFingerprint(),
    modules: CRYSTAL_INSTRUMENT_SUITE_MODULES,
  };
}
