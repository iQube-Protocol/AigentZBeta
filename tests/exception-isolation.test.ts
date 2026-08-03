/**
 * EXCEPTION ISOLATION — the shared operating model for Track 2, the crystal
 * and EXP-P1 preparation (operator ruling, 2026-08-03).
 *
 *   > "Constitutional control constrains the unsafe act; it does not
 *   >  immobilize the safe remainder."
 *
 * ── What these canaries defend ──────────────────────────────────────────────
 *
 * The operator's ten acceptance criteria, and above all #1: *"Three anomalous
 * sources cannot disable admission of thirty eligible sources."*
 *
 * ── OS-9 compliance (2026-08-03 observer-state invariants) ─────────────────
 *
 *   > "A canary must be written against real evidence, not against the
 *   >  assumptions of the code it guards."
 *
 * The fixtures below are built from the SHAPES this pipeline actually
 * produces — a `CandidateSourceRow`'s real fields, a real duplicate pairing, a
 * real `crystalReadiness` check list — not from a convenient stub. Where a
 * behaviour was previously asserted the OTHER way (a no-lineage source being
 * quarantined), the superseding test says so explicitly rather than quietly
 * flipping the expectation.
 */

import { describe, it, expect } from 'vitest';
import {
  EXECUTABLE_DISPOSITIONS,
  RECORD_DISPOSITIONS,
  buildCriticalPath,
  computeFreezeBlocking,
  freezeBlockingExceptions,
  groupExceptionsByCause,
  isExecutable,
  progressionFromCounts,
  renderPopulationDisclosure,
  signalForDisposition,
  summarizeIsolation,
  PRE_REGISTERED_READINESS_CHECKS,
  type DispositionAssignment,
  type IsolationException,
  type RecordDisposition,
} from '@/services/research/exceptionIsolation';
import { buildCohortAuthorization, computeCohortHash } from '@/services/research/cohortAuthorization';
import { buildFreezeCeremonyPackage } from '@/services/research/crystalFreezeCeremony';
import {
  composeAdmissionRecommendation,
  type SourceQualitySignals,
} from '@/services/corpusScout/admissionRecommendation';

// ── Fixtures shaped like the real records ───────────────────────────────────

function exception(overrides: Partial<IsolationException> = {}): IsolationException {
  return {
    scope: 'source',
    recordId: 'SRC-x-0000000001',
    recordLabel: 'A source',
    cause: 'something anomalous',
    causeGroup: 'low-confidence-classification',
    disposition: 'exception',
    stage: 'review-and-admit',
    blocksCurrentStage: false,
    blocksCrystalAssignment: false,
    blocksReadiness: false,
    blocksFreeze: false,
    consequence: 'Does not block continued corpus acquisition.',
    recommendedAction: 'Decide individually.',
    deferrableUntil: null,
    ...overrides,
  };
}

function assignment(id: string, disposition: RecordDisposition): DispositionAssignment {
  return {
    recordId: id,
    disposition,
    exception:
      disposition === 'exception' || disposition === 'refused'
        ? exception({ recordId: id, disposition })
        : undefined,
  };
}

// ── 1 · THE HEADLINE CANARY — acceptance criterion #1 ───────────────────────

describe('ACCEPTANCE #1 — exceptions never disable admission of the eligible cohort', () => {
  /**
   * The operator's own worked example, verbatim:
   *
   *   33 pending sources
   *   24 ready to admit / 5 ready with warnings / 3 manual-review exceptions / 1 refused
   *   29 sources can proceed now.
   */
  const batch: DispositionAssignment[] = [
    ...Array.from({ length: 24 }, (_, i) => assignment(`SRC-ready-${i}`, 'ready')),
    ...Array.from({ length: 5 }, (_, i) => assignment(`SRC-warn-${i}`, 'ready-with-warning')),
    ...Array.from({ length: 3 }, (_, i) => assignment(`SRC-exc-${i}`, 'exception')),
    assignment('SRC-refused-0', 'refused'),
  ];

  it('a 33-source batch with 3 exceptions and 1 refusal yields an ENABLED action admitting exactly 29', () => {
    const s = summarizeIsolation(batch, null, 'source');
    expect(s.counts.total).toBe(33);
    expect(s.counts.ready).toBe(24);
    expect(s.counts.readyWithWarning).toBe(5);
    expect(s.counts.exceptions).toBe(3);
    expect(s.counts.refused).toBe(1);
    // The number the primary action acts on.
    expect(s.counts.executable).toBe(29);
    expect(s.executableRecordIds).toHaveLength(29);
    // THE assertion. Mutation: make `primaryActionEnabled` consult
    // `counts.exceptions` → three anomalous sources disable thirty eligible
    // ones, which is the exact defect this ruling abolishes.
    expect(s.primaryActionEnabled).toBe(true);
    expect(s.headline).toBe('29 sources can proceed now.');
  });

  it('the ready-with-warning cohort is EXECUTABLE — a warning is not a refusal', () => {
    // Mutation: drop 'ready-with-warning' from EXECUTABLE_DISPOSITIONS → the
    // executable count silently falls to 24 and amber becomes prohibition.
    expect(isExecutable('ready-with-warning')).toBe(true);
    expect([...EXECUTABLE_DISPOSITIONS].sort()).toEqual(['ready', 'ready-with-warning']);
    expect(signalForDisposition('ready-with-warning')).toBe('amber');
  });

  it('the stage reports partially-complete, never blocked', () => {
    const s = summarizeIsolation(batch, null, 'source');
    expect(s.progression).toBe('partially-complete');
    expect(s.progression).not.toBe('blocked');
  });

  it('ONLY a global stop can withhold the action — and it names which of the five held', () => {
    const stopped = summarizeIsolation(batch, {
      reason: 'wrong-corpus-target',
      detail: 'the batch targets a different corpus than the one displayed',
    });
    expect(stopped.primaryActionEnabled).toBe(false);
    expect(stopped.progression).toBe('blocked');
    expect(stopped.headline).toMatch(/different corpus/);
    // The executable set is still REPORTED — a global stop withholds the act,
    // it does not erase what would otherwise have proceeded.
    expect(stopped.counts.executable).toBe(29);
  });

  it('blocked is reserved for "no valid subset can proceed"', () => {
    const allBad = summarizeIsolation(
      [assignment('a', 'exception'), assignment('b', 'refused')],
      null,
      'source',
    );
    expect(allBad.counts.executable).toBe(0);
    expect(allBad.progression).toBe('blocked');
    expect(allBad.primaryActionEnabled).toBe(false);
  });
});

// ── 2 · TWO AXES, never conflated ──────────────────────────────────────────

describe('the two axes stay separate (ruling §1)', () => {
  it('record disposition is FOUR values and is record-kind agnostic', () => {
    expect([...RECORD_DISPOSITIONS]).toEqual(['ready', 'ready-with-warning', 'exception', 'refused']);
  });

  it('a stage with every record executable is in-progress, not partially-complete', () => {
    const s = progressionFromCounts({
      total: 5, ready: 5, readyWithWarning: 0, exceptions: 0, refused: 0, executable: 5,
    });
    expect(s).toBe('in-progress');
  });

  it('partially-complete requires outstanding EXCEPTIONS alongside executable work', () => {
    expect(
      progressionFromCounts({ total: 5, ready: 4, readyWithWarning: 0, exceptions: 1, refused: 0, executable: 4 }),
    ).toBe('partially-complete');
  });
});

// ── 3 · blocksFreeze is DERIVED from the actual crystal (ruling §3) ─────────

describe('blocksFreeze is computed from the remaining crystal, never asserted per record', () => {
  const passingCrystal = {
    checks: PRE_REGISTERED_READINESS_CHECKS.map((name) => ({ name, passed: true, detail: 'ok' })),
    invariantCount: 26,
  };
  const failingCrystal = {
    checks: PRE_REGISTERED_READINESS_CHECKS.map((name) => ({
      name,
      passed: name !== 'relationship-density',
      detail: name === 'relationship-density' ? 'density below threshold' : 'ok',
    })),
    invariantCount: 26,
  };

  it('a SOURCE-scope exception never blocks a freeze, even when the crystal is failing', () => {
    // A source that never entered the corpus is not a member of the crystal,
    // so it cannot be the reason the crystal fails. Mutation: drop the
    // in-crystal-scope guard → every unadmitted source becomes a freeze
    // blocker and the corpus must be perfect before anything can freeze.
    const computed = computeFreezeBlocking([exception({ scope: 'source' })], failingCrystal);
    expect(computed[0].blocksFreeze).toBe(false);
    expect(freezeBlockingExceptions(computed)).toHaveLength(0);
  });

  it('an INVARIANT-scope exception blocks the freeze only while the remaining crystal is failing', () => {
    const inv = exception({ scope: 'invariant', recordId: 'inv-1' });
    expect(computeFreezeBlocking([inv], failingCrystal)[0].blocksFreeze).toBe(true);
    expect(computeFreezeBlocking([inv], passingCrystal)[0].blocksFreeze).toBe(false);
  });

  it('an upstream ASSERTION of blocksFreeze is overridden by the computation', () => {
    // The whole point of "derived, never asserted": a stage that hardcoded
    // `blocksFreeze: true` cannot make a passing crystal unfreezable.
    const lying = exception({ scope: 'source', blocksFreeze: true });
    expect(computeFreezeBlocking([lying], passingCrystal)[0].blocksFreeze).toBe(false);
  });

  it('the nine pre-registered criteria are the readiness engine\'s own check names', () => {
    // Mutation: invent or rename a criterion here → it silently stops matching
    // any check the engine emits, and every exception reads "does not block".
    expect([...PRE_REGISTERED_READINESS_CHECKS].sort()).toEqual([
      'derivation-headroom',
      'duplicate-detection',
      'graph-connectivity',
      'lifecycle-validation-integrity',
      'orphan-detection',
      'provenance-eligibility',
      'relationship-density',
      'selection-space',
      'structural-diversity',
    ]);
  });
});

// ── 4 · Durable receipts for partial progress (ruling §4) ──────────────────

describe('partial progress produces a durable, auditable authorization record', () => {
  const population = {
    discovered: 47, admitted: 32, candidatesExtracted: 68, validated: 54,
    assignedToCrystal: 26, excludedWithWarnings: 4, exceptions: 7, refused: 4,
  };

  it('the cohort hash commits to the SET, independent of order', () => {
    expect(computeCohortHash(['b', 'a', 'c'])).toBe(computeCohortHash(['c', 'b', 'a']));
    expect(computeCohortHash(['a', 'b'])).not.toBe(computeCohortHash(['a', 'b', 'c']));
  });

  it('the receipt carries the cohort hash, the authorizing steward, the exclusions AND the accepted warnings', () => {
    const record = buildCohortAuthorization({
      stage: 'Corpus Scout admission',
      target: 'financial-services',
      executableRecordIds: ['SRC-a', 'SRC-b'],
      counts: { total: 4, ready: 1, readyWithWarning: 1, exceptions: 1, refused: 1, executable: 2 },
      exceptions: [exception({ recordId: 'SRC-c', cause: 'duplicate group' })],
      acceptedWarnings: [{ recordId: 'SRC-b', warnings: ['title unresolved'] }],
      population,
      personaId: '11111111-2222-3333-4444-555555555555',
      rationale: 'Admitting the eligible cohort; exceptions deferred.',
    });
    expect(record.cohortHash).toHaveLength(32);
    expect(record.summary).toContain(record.cohortHash);
    expect(record.summary).toContain('SRC-c');
    expect(record.summary).toMatch(/title unresolved/);
    expect(record.summary).toMatch(/Rationale: Admitting the eligible cohort/);
    // T0 discipline — the raw personaId never reaches the receipt.
    expect(record.summary).not.toContain('11111111-2222-3333-4444-555555555555');
    expect(record.authorizedBy).not.toContain('11111111');
  });

  it('the FULL population rides on the receipt — not just what advanced (ruling §5)', () => {
    // The guardrail. Mutation: record only the executable set → a corpus
    // quietly narrowed until readiness passed would leave no trace of what was
    // dropped, which the operator called a worse failure than batch-blocking.
    const record = buildCohortAuthorization({
      stage: 'Corpus Scout admission',
      target: 'financial-services',
      executableRecordIds: ['SRC-a'],
      counts: { total: 1, ready: 1, readyWithWarning: 0, exceptions: 0, refused: 0, executable: 1 },
      exceptions: [],
      acceptedWarnings: [],
      population,
      personaId: 'p',
      rationale: 'r',
    });
    expect(record.summary).toContain('Discovered: 47');
    expect(record.summary).toContain('Assigned to crystal: 26');
    expect(record.population).toEqual(population);
  });

  it('renderPopulationDisclosure states every line the operator specified', () => {
    expect(renderPopulationDisclosure(population)).toBe(
      'Discovered: 47 / Admitted: 32 / Candidates extracted: 68 / Validated: 54 / ' +
        'Assigned to crystal: 26 / Excluded with warnings: 4 / Exceptions: 7 / Refused: 4',
    );
  });
});

// ── 5 · The Exceptions surface + critical path ─────────────────────────────

describe('the single Exceptions surface and the critical path', () => {
  it('groups by cause and omits empty groups', () => {
    const groups = groupExceptionsByCause([
      exception({ recordId: 'a', causeGroup: 'exact-duplicate' }),
      exception({ recordId: 'b', causeGroup: 'exact-duplicate' }),
      exception({ recordId: 'c', causeGroup: 'unreadable-content' }),
    ]);
    expect(groups.map((g) => g.causeGroup)).toEqual(['exact-duplicate', 'unreadable-content']);
    expect(groups[0].exceptions).toHaveLength(2);
  });

  it('the critical path says exceptions do NOT block the eligible cohort when nothing blocks the freeze', () => {
    const path = buildCriticalPath({
      stageLabel: 'validation',
      actVerb: 'Validate',
      noun: 'provenance-classified invariant',
      counts: { total: 62, ready: 54, readyWithWarning: 0, exceptions: 8, refused: 0, executable: 54 },
      freezeBlockers: 0,
    });
    expect(path.nextSafeAct).toBe('Validate 54 provenance-classified invariants.');
    expect(path.deferred).toBe('8 exception(s).');
    expect(path.milestoneImpact).toMatch(/do not block validation of the eligible cohort/i);
  });

  it('names the freeze blockers when there genuinely are some', () => {
    const path = buildCriticalPath({
      stageLabel: 'assignment',
      actVerb: 'Assign',
      noun: 'invariant',
      counts: { total: 10, ready: 8, readyWithWarning: 0, exceptions: 2, refused: 0, executable: 8 },
      freezeBlockers: 2,
    });
    expect(path.milestoneImpact).toMatch(/genuinely block the freeze/);
  });
});

// ── 6 · THE END-TO-END ACCEPTANCE TEST (ruling §8) ─────────────────────────

/**
 * The operator's own specification of what proves the model:
 *
 *   > "introduce one bad source, one invalid candidate, one unresolved edge
 *   >  and one eligible cohort, and verify that the eligible cohort reaches
 *   >  readiness while every anomaly remains visible, receipted and excluded
 *   >  from the crystal."
 *
 * Deliberately ONE test spanning the stages rather than four unit tests: the
 * property under test is that anomalies at DIFFERENT stages each isolate
 * locally and none of them stops the cohort reaching readiness.
 */
describe('END-TO-END — one valid source, one FAILED EXTRACTION, one invalid candidate, one unresolved edge, one valid cohort', () => {
  it('the valid cohort reaches assignment and readiness while every excluded item stays visible and receipted', () => {
    // ── Stage 2: one bad source (unreadable bytes) among a real cohort ──────
    const badSource: SourceQualitySignals = {
      sourceId: 'SRC-bad-0000000001',
      campaignDomain: 'financial-services',
      campaignSubDomain: 'banking',
      issuer: 'CFTC',
      title: 'PDF',
      canonicalUrl: 'https://www.cftc.gov/some/doc.pdf',
      publicationDate: null,
      authors: [],
      extractionStatus: 'failed',
      artifactHash: null,
      extractionWarnings: ['no extractable text'],
      structuralTags: [],
      licenseStatus: 'unknown',
      isDuplicate: false,
      institutionalTier: null,
    };
    const goodSource: SourceQualitySignals = {
      ...badSource,
      sourceId: 'SRC-good-0000000002',
      title: 'Basel III Monitoring Report — March 2026',
      canonicalUrl: 'https://www.bis.org/bcbs/publ/d999.pdf',
      publicationDate: '2026-03-01',
      authors: ['BIS Basel Committee'],
      extractionStatus: 'ok',
      artifactHash: 'a'.repeat(64),
      extractionWarnings: [],
      institutionalTier: 'institutional-authority',
    };
    const bad = composeAdmissionRecommendation({ source: badSource, lineage: [] });
    const good = composeAdmissionRecommendation({ source: goodSource, lineage: [] });

    expect(bad.disposition).toBe('refused');
    expect(bad.exception).toBeDefined();
    expect(isExecutable(good.disposition)).toBe(true);

    // ── Stage 3: one FAILED EXTRACTION (operator's superseding spec) ───────
    //
    // Distinct from the bad SOURCE above: this source was admitted — it is in
    // the corpus — and extraction over it failed afterwards. The record that
    // quarantines is the extraction attempt, and its failure must not stop
    // extraction of the sources beside it.
    const failedExtraction = exception({
      scope: 'source',
      recordId: 'SRC-admitted-extraction-failed',
      recordLabel: 'An admitted source whose extraction failed',
      cause: 'extraction produced no candidate invariants',
      causeGroup: 'unreadable-content',
      stage: 'extract-candidates',
    });

    // ── Stages 4 and 7: one invalid candidate, one unresolved edge ─────────
    const invalidCandidate = exception({
      scope: 'invariant',
      recordId: 'inv-invalid-1',
      recordLabel: 'A candidate that failed validation',
      cause: 'zero validations recorded',
      causeGroup: 'provenance-conflict',
      stage: 'validate',
    });
    const unresolvedEdge = exception({
      scope: 'edge',
      recordId: 'edge-disputed-1',
      recordLabel: 'A disputed relationship',
      cause: 'the relationship is contested',
      causeGroup: 'provenance-conflict',
      stage: 'add-relationships',
    });

    // ── The whole pipeline's records, in ONE shared vocabulary ─────────────
    const all: DispositionAssignment[] = [
      { recordId: good.sourceId, disposition: good.disposition, warnings: good.warnings },
      { recordId: bad.sourceId, disposition: bad.disposition, exception: bad.exception },
      { recordId: failedExtraction.recordId, disposition: 'exception', exception: failedExtraction },
      { recordId: invalidCandidate.recordId, disposition: 'exception', exception: invalidCandidate },
      { recordId: unresolvedEdge.recordId, disposition: 'exception', exception: unresolvedEdge },
    ];
    const summary = summarizeIsolation(all, null, 'record');

    // The eligible cohort proceeds…
    expect(summary.counts.executable).toBe(1);
    expect(summary.primaryActionEnabled).toBe(true);
    expect(summary.progression).toBe('partially-complete');

    // …the crystal that REMAINS passes its pre-registered readiness…
    const remainingCrystal = {
      checks: PRE_REGISTERED_READINESS_CHECKS.map((name) => ({ name, passed: true, detail: 'ok' })),
      invariantCount: 26,
    };
    const computed = computeFreezeBlocking(summary.exceptions, remainingCrystal);

    // …so NOTHING blocks the freeze, including the invariant- and edge-scope
    // anomalies, because the crystal passes without them.
    expect(freezeBlockingExceptions(computed)).toHaveLength(0);

    // …every anomaly stays VISIBLE on the one Exceptions surface…
    expect(summary.exceptions).toHaveLength(4);
    const grouped = groupExceptionsByCause(computed);
    const shown = grouped.flatMap((g) => g.exceptions.map((e) => e.recordId));
    expect(shown).toContain('SRC-bad-0000000001');
    expect(shown).toContain('SRC-admitted-extraction-failed');
    expect(shown).toContain('inv-invalid-1');
    expect(shown).toContain('edge-disputed-1');
    // A failed extraction quarantines ITSELF and nothing else (ruling §7).
    expect(failedExtraction.blocksCurrentStage).toBe(false);

    // …and every one is RECEIPTED, with the full population disclosed, so the
    // crystal cannot look complete while the corpus was quietly narrowed.
    const receipt = buildCohortAuthorization({
      stage: 'Track 2 pipeline',
      target: 'financial-risk-value-systems',
      executableRecordIds: summary.executableRecordIds,
      counts: summary.counts,
      exceptions: computed,
      acceptedWarnings: [{ recordId: good.sourceId, warnings: good.warnings }],
      population: {
        discovered: 47, admitted: 32, candidatesExtracted: 68, validated: 54,
        assignedToCrystal: 26, excludedWithWarnings: 4, exceptions: 7, refused: 4,
      },
      personaId: 'steward-persona',
      rationale: 'Eligible cohort advanced; three anomalies quarantined and disclosed.',
    });
    for (const id of ['SRC-bad-0000000001', 'SRC-admitted-extraction-failed', 'inv-invalid-1', 'edge-disputed-1']) {
      expect(receipt.summary, `${id} must be named in the authorization receipt`).toContain(id);
    }
    expect(receipt.summary).toContain('Discovered: 47');
    expect(receipt.exclusions).toHaveLength(4);

    // …and NO unresolved local record caused a global stop, because a valid
    // subset remained throughout.
    expect(summary.globalStop).toBeNull();
    expect(summary.primaryActionEnabled).toBe(true);
  });
});


// ── 7 · THE GOVERNED FREEZE-PACKAGE SCHEMA (operator-authorized 2026-08-03) ─

/**
 *   > "Without this, an independently verifiable crystal hash could still
 *   >  conceal how much of the original population disappeared before freeze."
 *
 * These canaries defend the amendment itself: the four disclosure fields exist,
 * they are inside the tamper-evident packageHash, and — critically — they do
 * NOT gate. Readiness assesses the assigned crystal; the freeze package
 * preserves the whole acquisition and exclusion history. Folding one into the
 * other is the failure mode both halves exist to prevent.
 */
describe('the freeze package preserves the acquisition and exclusion history', () => {
  const readiness = {
    ok: true,
    checks: PRE_REGISTERED_READINESS_CHECKS.map((name) => ({ name, passed: true, detail: 'ok', remedy: null })),
    excludedFromCrystal: null,
    invariantCount: 26,
    eligibleCount: 26,
    populations: { A: 26, B: 0, C: 0, unclassified: 0, ablationCount: 26 },
    derivationEligibleFraction: 0.5,
    duplicatePairCount: 0,
    graph: {
      relationshipCount: 40, relationshipDensity: 0.12, componentCount: 1,
      largestComponentSize: 26, connectivityRatio: 1, orphanCount: 0, orphanFraction: 0,
    },
  } as never;
  // The REAL CrystalStatisticsReport shape (OS-9: fixture from the type the
  // production code actually consumes, not a convenient stub — a thin stub
  // threw inside composeCrystalFreezeRecommendation on the first run).
  const statistics = {
    ok: true,
    experimentId: 'EXP-P1',
    crystalDomain: 'financial-risk-value-systems',
    computedAt: '2026-08-03T00:00:00.000Z',
    invariantCount: 26,
    sourceCount: 12,
    documentCount: 12,
    externalSources: [],
    relationshipCount: 40,
    averageValidationDepth: 2,
    standingDistribution: [],
    compositionDensity: 0.12,
    semanticDiversity: 1.4,
    namespaceDistributionEntropy: 1.1,
    coverageEstimate: { boundaryNamespaceCount: 4, representedNamespaceCount: 4, ratio: 1 },
    derivationHeadroom: 0.5,
    sliceRatio: 0.4,
    selectionEntropy: 1.1,
    duplicateRatio: 0,
    frozenHash: 'f'.repeat(64),
    substrateError: null,
  } as never;

  const population = {
    discovered: 47, admitted: 32, candidatesExtracted: 68, validated: 54,
    assignedToCrystal: 26, excludedWithWarnings: 4, exceptions: 7, refused: 4,
  };

  const build = (extra: Record<string, unknown> = {}) =>
    buildFreezeCeremonyPackage({
      crystalId: 'EXP-P1/crystal-vP1',
      experimentId: 'EXP-P1',
      crystalDomain: 'financial-risk-value-systems',
      operatorRef: 'steward-ref',
      reviewerRef: null,
      domainBoundary: 'financial risk and value systems',
      knownLimitations: [],
      freezeRationale: 'the crystal is ready',
      ratifiedAt: '2026-08-03T00:00:00.000Z',
      readiness,
      statistics,
      ...extra,
    } as never);

  it('carries population, assignedCohortHash and excludedRecordsHash', () => {
    // Mutation: drop any of the three from `base` -> a verifiable crystal hash
    // can once again conceal how much of the population disappeared.
    const r = build({
      population,
      assignedInvariantIds: ['inv-1', 'inv-2'],
      excludedRecords: [exception({ recordId: 'SRC-bad-1' })],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.package.population).toEqual(population);
    expect(r.package.assignedCohortHash).toBe(computeCohortHash(['inv-1', 'inv-2']));
    expect(r.package.excludedRecordsHash).toBe(computeCohortHash(['SRC-bad-1']));
    expect(r.package.excludedRecords).toHaveLength(1);
  });

  it('the excluded set gets its OWN digest — exclusions are as tamper-evident as inclusions', () => {
    // The operator's specific addition. Two freezes with the same crystal but
    // different exclusion sets must be distinguishable.
    const a = build({ assignedInvariantIds: ['inv-1'], excludedRecords: [exception({ recordId: 'x' })] });
    const b = build({ assignedInvariantIds: ['inv-1'], excludedRecords: [exception({ recordId: 'y' })] });
    if (!a.ok || !b.ok) throw new Error('both packages must build');
    expect(a.package.assignedCohortHash).toBe(b.package.assignedCohortHash);
    expect(a.package.excludedRecordsHash).not.toBe(b.package.excludedRecordsHash);
    // …and the difference reaches the package commitment.
    expect(a.package.packageHash).not.toBe(b.package.packageHash);
  });

  it('the hashes use the SAME scheme as the cohort-authorization receipts', () => {
    // So an id set committed at assignment time and the same set committed at
    // freeze time produce the same digest and a verifier can compare them.
    const r = build({ assignedInvariantIds: ['inv-b', 'inv-a'] });
    if (!r.ok) return;
    expect(r.package.assignedCohortHash).toBe(computeCohortHash(['inv-a', 'inv-b']));
  });

  it('omitting the history yields null, never a fabricated zero', () => {
    // "Nothing was excluded" and "nobody told us what was excluded" are
    // different facts. Mutation: default to `{...zeros}` -> an unsupplied
    // history reads as a complete corpus.
    const r = build();
    if (!r.ok) return;
    expect(r.package.population).toBeNull();
    expect(r.package.assignedCohortHash).toBeNull();
    expect(r.package.excludedRecordsHash).toBeNull();
  });

  it('the disclosure NEVER gates — eligibility is unchanged by exclusions', () => {
    // The division of labour the operator specified. Mutation: fold the
    // exclusion count into `eligibleForRatification` -> the population
    // disclosure leaks into the pass/fail decision, which is exactly what
    // keeping `excludedFromCrystal` out of readiness `ok` was for.
    const without = build();
    const withMany = build({
      population,
      assignedInvariantIds: ['inv-1'],
      excludedRecords: Array.from({ length: 50 }, (_, i) => exception({ recordId: `x-${i}` })),
    });
    if (!without.ok || !withMany.ok) throw new Error('both must build');
    expect(withMany.package.eligibleForRatification).toBe(without.package.eligibleForRatification);
    expect(withMany.package.recommendation.verdict).toBe(without.package.recommendation.verdict);
  });
});
