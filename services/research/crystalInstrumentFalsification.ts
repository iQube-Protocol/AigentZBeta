/**
 * The RETROSPECTIVE FALSIFICATION HARNESS — a release gate for the hardened
 * crystal readiness instruments (operator direction, 2026-08-26).
 *
 * ── The test, in the operator's words (verbatim) ──────────────────────────
 *
 *   > "One important falsification test is that we will then run frozen vP1
 *   >  unchanged through those strengthened instruments. They should
 *   >  independently reproduce the substance of your objections. If they don't,
 *   >  we have not fixed the measurement problem."
 *
 *   > "the retrospective vP1 falsification harness is load-bearing. I would make
 *   >  it a release gate for the hardened instruments. … Do the new gates reject
 *   >  the exact frozen artifact that the independent reviewer rejected? If live
 *   >  vP1 still passes, do not proceed to vP2 extraction yet. Fix the
 *   >  measurement layer first."
 *
 * ── ⚠ THE SENSE OF "PASSED" IS INVERTED. READ THIS BEFORE READING A RESULT ─
 *
 * The retrospective PASSES when the hardened instruments **REJECT** the frozen
 * artifact. `reproducedReviewerObjections: true` means the measurement layer now
 * catches what it previously missed — a GOOD outcome. A result in which the
 * frozen crystal still passes readiness is a FAILURE OF THE REMEDIATION, not a
 * finding about the crystal.
 *
 * No field on this report is called `ok`, deliberately: `ok: true` would be read
 * as "all good" by every consumer, and here the good outcome is a rejection.
 *
 * ── READ-ONLY, AND HASH-ANCHORED ─────────────────────────────────────────
 *
 * Nothing here writes, re-scores, backfills or mutates any frozen artifact, and
 * the historical readiness results that let vP1 through are untouched — they
 * remain the record of what the OLD instruments said. The verdict is computed
 * live and anchored to the freeze commitment: the caller supplies
 * `crystalContentHash` / `verifiedAgainstFreeze` from `buildFrozenCrystalManifest`
 * (which recomputes the same deterministic projection the freeze pinned and
 * compares), so a verdict cannot claim to be about the frozen set while actually
 * describing drifted live rows — CI-2026-08-09-HASH-VERIFIED-FROZEN-PROJECTION-001.
 *
 * ── WHAT THIS MODULE DOES *NOT* CONTAIN ──────────────────────────────────
 *
 * It carries no reviewer prose, no reviewer name, no review number, and no
 * finding text quoted from a review. A review pasted into a chat is not an
 * artifact: it has no locator and no content hash, so it cannot be verified or
 * re-read, and binding a gate to it would put unverifiable content behind a
 * decision about whether a second crystal may be constructed.
 *
 * What the harness reports instead is INSTRUMENT-SIDE: which of the four
 * remediated concerns rejects the frozen artifact, and why. Binding those
 * rejections to an actual review's findings happens through the
 * `CrystalRemediationProfile`'s `checkMappings` (types/crystalRemediation.ts),
 * once an authoritative artifact with a re-readable `sourceRef` exists. The
 * separation is deliberate: the instruments can be validated now; the review can
 * only be bound when it is an artifact.
 *
 * Server-safe, pure composition over an already-run readiness report.
 */

import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import {
  CRYSTAL_INSTRUMENT_SUITE_VERSION,
  crystalInstrumentSuiteFingerprint,
} from '@/services/research/crystalInstrumentSuite';
import {
  deriveRetrospectiveSubstrateAdmissibility,
  type RetrospectiveSubstrateAdmissibility,
} from '@/services/research/crystalRetrospectiveSubstrateAdmissibility';
import type { LegacyFreezeVerificationEvidence } from '@/services/research/crystalLegacyContentVerification';
import type { InstrumentSuiteIdentity } from '@/types/crystalRemediation';

/**
 * The four concerns remediation cycle 1 hardened. These are the INSTRUMENTS'
 * own concerns, named in instrument terms — not a transcription of anybody's
 * findings.
 */
export type RemediatedConcernId =
  /** Near-duplicate statements the lexical pass could not see. */
  | 'duplication'
  /** Statements carrying no relational structure, so conjunctions entail nothing. */
  | 'relational-structure'
  /** A collection too small to ground the registered task design. */
  | 'population-size'
  /** Declared-boundary namespaces the crystal cannot ground. */
  | 'boundary-coverage';

export interface RemediatedConcernResult {
  concernId: RemediatedConcernId;
  /** The readiness check that measures this concern. */
  bearsOnCheck: string;
  /** What the concern IS, in instrument terms. */
  concern: string;
  /**
   * TRUE when the hardened instrument REJECTS the artifact on this concern —
   * i.e. the concern is reproduced. 'unknown' when the instrument could not
   * assess it at all (no data, unreachable substrate, non-derivable
   * requirement); never silently folded into false.
   */
  rejected: boolean | 'unknown';
  /** The instrument's measurement, verbatim from the check's own detail. */
  instrumentFinding: string;
  /** Whether the PRE-remediation implementation would plausibly have passed
   *  this — recorded per concern so the delta is legible, and computed only
   *  from figures the report carries (never asserted about history). */
  preRemediationSignal: string;
}

export interface CrystalRetrospectiveFalsification {
  experimentId: string;
  crystalDomain: string;
  instrumentSuiteVersion: string;
  instrumentContractFingerprint: string;
  computedAt: string;
  /** The freeze commitment this verdict is anchored to, and whether the live
   *  re-query matched it. null/false ⇒ the verdict is NOT about the frozen set
   *  and says so. */
  crystalContentHash: string | null;
  verifiedAgainstFreeze: boolean | null;
  /**
   * Whether the population this verdict was computed over is admissible as
   * the retrospective substrate — either byte-exact (`verifiedAgainstFreeze
   * === true`) or, for the one artifact a ratified governance ruling names,
   * `legacy-scientific-content` (services/research/
   * crystalRetrospectiveSubstrateAdmissibility.ts). The governing ruling, when
   * one applies, is carried on `governingRuling` so it is VISIBLE in this
   * evidence, never merely implied by a boolean.
   */
  substrateAdmissibility: RetrospectiveSubstrateAdmissibility;
  /**
   * Whether the CURRENT instrument-suite identity matches the remediation
   * profile the caller supplied for comparison. `null` ⇒ no profile was
   * supplied to compare against, which blocks `reproducedReviewerObjections`
   * exactly as a `false` match does — there is nothing permissive about an
   * absent comparison.
   */
  instrumentSuiteMatchesProfile: boolean | null;
  invariantCount: number;
  distinctStatementEstimate: number;
  /**
   * THE GATE. True iff the retrospective substrate is admissible, every one
   * of the four remediated concerns is REJECTED by its hardened instrument,
   * the instrument-suite identity matches the remediation profile, and no
   * blocking gap remains. Named for what it means, never `ok`.
   */
  reproducedReviewerObjections: boolean;
  concerns: RemediatedConcernResult[];
  /** Whether readiness as a whole now refuses the frozen artifact. */
  readinessRejectsFrozenCrystal: boolean;
  /** Every reason the retrospective did NOT pass. Empty iff it passed. */
  blockingGaps: string[];
  /** What the result MEANS, stated in the payload rather than left to a reader
   *  who may not know the sense is inverted. */
  interpretation: string;
}

export interface ComposeRetrospectiveInput {
  experimentId: string;
  crystalDomain: string;
  readiness: CrystalReadinessReport;
  /** From `buildFrozenCrystalManifest` — null when no frozen artifact exists. */
  crystalContentHash: string | null;
  verifiedAgainstFreeze: boolean | null;
  /** From `buildFrozenCrystalManifest.artifactId` — null when no frozen
   *  artifact exists. Required (with `legacyContentVerification`) for a
   *  legacy-substrate ruling to be considered; omitted callers fall through
   *  to admissible-only-when-byte-exact, unchanged from prior behaviour. */
  artifactId?: string | null;
  /** From `buildFrozenCrystalManifest.legacyContentVerification`. */
  legacyContentVerification?: LegacyFreezeVerificationEvidence | null;
  /** The remediation profile's OWN recorded instrument-suite identity — the
   *  caller reads this from the SAME profile the verdict may go on to bind
   *  (never re-derived here). `null`/omitted ⇒ no profile was supplied to
   *  compare against, which blocks `reproducedReviewerObjections` exactly as
   *  a mismatch does. */
  remediationProfileInstrumentSuite?: InstrumentSuiteIdentity | null;
  /** Injectable for determinism in tests; defaults to now. */
  computedAt?: string;
}

function checkDetail(readiness: CrystalReadinessReport, name: string): { passed: boolean | null; detail: string } {
  const check = readiness.checks.find((c) => c.name === name);
  if (!check) return { passed: null, detail: `check '${name}' did not run` };
  return { passed: check.passed, detail: check.detail };
}

/**
 * Compose the retrospective verdict from an already-run readiness report.
 *
 * A concern is `rejected: true` when its check FAILED — that is the whole
 * inversion. A concern whose check did not run, or which the instrument could
 * not assess, is `'unknown'` and blocks the gate: an unassessable concern is not
 * a reproduced one.
 */
export function composeCrystalRetrospectiveFalsification(
  input: ComposeRetrospectiveInput,
): CrystalRetrospectiveFalsification {
  const { readiness } = input;
  const computedAt = input.computedAt ?? new Date().toISOString();

  const dup = checkDetail(readiness, 'duplicate-detection');
  const headroom = checkDetail(readiness, 'derivation-headroom');
  const selection = checkDetail(readiness, 'selection-space');
  const coverage = checkDetail(readiness, 'boundary-coverage');

  const substrateUnreadable =
    readiness.checks.length === 1 && readiness.checks[0].name === 'invariant-fetch';
  const nothingToAssess = readiness.invariantCount === 0;

  function resolve(
    concernId: RemediatedConcernId,
    bearsOnCheck: string,
    concern: string,
    result: { passed: boolean | null; detail: string },
    preRemediationSignal: string,
  ): RemediatedConcernResult {
    // An unreadable substrate or an empty collection is NOT a reproduction of
    // anything — every check fails closed in those states, and counting that as
    // "the instrument caught it" would let an infrastructure fault license the
    // release gate. This is the most important line in the module.
    const rejected: boolean | 'unknown' =
      substrateUnreadable || nothingToAssess || result.passed === null ? 'unknown' : !result.passed;
    return { concernId, bearsOnCheck, concern, rejected, instrumentFinding: result.detail, preRemediationSignal };
  }

  const concerns: RemediatedConcernResult[] = [
    resolve(
      'duplication',
      'duplicate-detection',
      'Near-duplicate statements that a word-set comparison structurally cannot see — paraphrases whose ' +
        'relation direction is inverted ("X is essential for Y" / "Y depends on X").',
      dup,
      `lexical pass found ${readiness.duplicates.lexicalPairCount} pair(s); the semantic pass found ` +
        `${readiness.duplicates.semanticOnlyPairCount} that the lexical pass did not. The pre-remediation gate ` +
        `was the lexical count alone, so it would have reported ` +
        `${readiness.duplicates.lexicalPairCount === 0 ? 'PASS' : 'FAIL'} here.`,
    ),
    resolve(
      'relational-structure',
      'derivation-headroom',
      'Statements carrying none of the seven relational structures (causal, conditional, propagation, ' +
        'constraint, threshold, trade-off, quantitative), so their conjunctions entail nothing unstated and ' +
        'the derivation task set cannot be built on them.',
      headroom,
      `label-diversity proxy (the pre-remediation measure) = ` +
        `${(readiness.derivationEligibleFraction * 100).toFixed(1)}%, which cleared the old 20% bar ` +
        `${readiness.derivationEligibleFraction >= 0.2 ? 'YES' : 'NO'}; actual inferential capacity = ` +
        `${(readiness.inferentialCapacity.inferentialCapacityFraction * 100).toFixed(1)}% over ` +
        `${readiness.inferentialCapacity.entailmentChainCount} entailing conjunction(s). A large gap between ` +
        `those two numbers IS the defect the reviewer named.`,
    ),
    resolve(
      'population-size',
      'selection-space',
      'A collection too small for the ⊆40% Arm C slice to hold the usable statements the registered task ' +
        'design demands.',
      selection,
      `the pre-remediation gate required a slice of ≥5 (a number in no registered constraint); the derived ` +
        `requirement is a slice of ${readiness.populationRequirement.requiredEvaluationSliceSize ?? 'unknown'} ` +
        `⇒ a collection of ${readiness.populationRequirement.minimumCollectionSize ?? 'unknown'}. At ` +
        `${readiness.invariantCount} members the slice cap is ` +
        `${Math.floor(readiness.invariantCount * readiness.populationRequirement.sliceFractionOfCrystal)}, which ` +
        `the old bar of 5 would have reported ` +
        `${Math.floor(readiness.invariantCount * readiness.populationRequirement.sliceFractionOfCrystal) >= 5 ? 'PASS' : 'FAIL'}.`,
    ),
    resolve(
      'boundary-coverage',
      'boundary-coverage',
      'Declared-boundary namespaces with no crystal member, so a reviewer authoring tasks against the ' +
        'boundary can author into regions nothing grounds.',
      coverage,
      `coverage is ${readiness.coverage.representedNamespaceCount}/${readiness.coverage.boundaryNamespaceCount}. ` +
        `Pre-remediation this gated NOTHING — it was disclosed by the freeze recommendation as "not itself a ` +
        `gate", so it could not have rejected any artifact however low it was.`,
    ),
  ];

  const blockingGaps: string[] = [];
  if (substrateUnreadable) {
    blockingGaps.push(
      'the invariant substrate could not be read, so no concern was assessed — an infrastructure fault is not ' +
        'a reproduction, and must never license the release gate',
    );
  }
  if (nothingToAssess && !substrateUnreadable) {
    blockingGaps.push(
      `the domain '${input.crystalDomain}' holds no invariants, so every check failed closed on an empty set ` +
        'rather than on findings — this is not a reproduction of anything',
    );
  }
  const substrateAdmissibility = deriveRetrospectiveSubstrateAdmissibility({
    experimentId: input.experimentId,
    artifactId: input.artifactId ?? null,
    verifiedAgainstFreeze: input.verifiedAgainstFreeze,
    legacyContentVerification: input.legacyContentVerification ?? null,
  });
  if (input.crystalContentHash === null) {
    blockingGaps.push(
      'no frozen crystal content hash was supplied, so this verdict cannot claim to be about the FROZEN ' +
        'artifact (it describes whatever the live query returned)',
    );
  } else if (!substrateAdmissibility.admissible) {
    blockingGaps.push(`retrospective substrate is inadmissible (${substrateAdmissibility.basis}): ${substrateAdmissibility.reason}`);
  }

  const instrumentSuiteMatchesProfile: boolean | null = input.remediationProfileInstrumentSuite
    ? input.remediationProfileInstrumentSuite.suiteVersion === CRYSTAL_INSTRUMENT_SUITE_VERSION &&
      input.remediationProfileInstrumentSuite.contractFingerprint === crystalInstrumentSuiteFingerprint()
    : null;
  if (instrumentSuiteMatchesProfile !== true) {
    blockingGaps.push(
      instrumentSuiteMatchesProfile === null
        ? 'no remediation profile was supplied to compare the current instrument-suite identity against'
        : `the current instrument-suite identity (${CRYSTAL_INSTRUMENT_SUITE_VERSION} / ` +
          `${crystalInstrumentSuiteFingerprint()}) does not match the remediation profile's recorded ` +
          `identity (${input.remediationProfileInstrumentSuite!.suiteVersion} / ` +
          `${input.remediationProfileInstrumentSuite!.contractFingerprint}) — the profile is stale relative ` +
          'to the instruments that would license it',
    );
  }
  for (const c of concerns) {
    if (c.rejected === 'unknown') {
      blockingGaps.push(`concern '${c.concernId}' could not be assessed (${c.bearsOnCheck}): ${c.instrumentFinding}`);
    } else if (c.rejected === false) {
      blockingGaps.push(
        `concern '${c.concernId}' is NOT reproduced — the hardened '${c.bearsOnCheck}' check PASSES the frozen ` +
          `artifact: ${c.instrumentFinding}`,
      );
    }
  }

  const allRejected = concerns.every((c) => c.rejected === true);
  const reproducedReviewerObjections = allRejected && blockingGaps.length === 0;

  return {
    experimentId: input.experimentId,
    crystalDomain: input.crystalDomain,
    instrumentSuiteVersion: CRYSTAL_INSTRUMENT_SUITE_VERSION,
    instrumentContractFingerprint: crystalInstrumentSuiteFingerprint(),
    computedAt,
    crystalContentHash: input.crystalContentHash,
    verifiedAgainstFreeze: input.verifiedAgainstFreeze,
    substrateAdmissibility,
    instrumentSuiteMatchesProfile,
    invariantCount: readiness.invariantCount,
    distinctStatementEstimate: readiness.duplicates.distinctStatementEstimate,
    reproducedReviewerObjections,
    concerns,
    readinessRejectsFrozenCrystal: !readiness.ok,
    blockingGaps,
    interpretation: reproducedReviewerObjections
      ? 'RETROSPECTIVE PASSED. The hardened instruments REJECT the frozen artifact on all four remediated ' +
        'concerns. The measurement layer now catches what it previously missed, so the remediation is ' +
        'demonstrated rather than asserted. Note the inverted sense: rejection of the artifact is the ' +
        'successful outcome here.'
      : 'RETROSPECTIVE NOT PASSED. This is a FAILURE OF THE REMEDIATION, not a finding about the crystal: the ' +
        'hardened instruments did not independently reproduce every remediated concern against the artifact ' +
        'that was rejected on review. Do not proceed to v2 extraction. Fix the measurement layer first. ' +
        'Blocking gaps are listed individually — an unassessable concern counts as not reproduced, so an empty ' +
        'domain or an unreadable substrate cannot license this gate.',
  };
}
