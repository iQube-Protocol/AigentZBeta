/**
 * Canary — Crystal Freeze Recommendation (CFS-054 §5 / PRD-EPI-001 §3.1
 * Workstream 4). Pure-composition tests over synthetic readiness/statistics
 * inputs — no I/O, no substrate mocking needed.
 *
 * Pins: (1) the verdict is a MECHANICAL derivation of `readiness.ok`, never
 * a separate judgement; (2) every named rationale item traces to a real
 * check by name — a mutation that stops reading `readiness.checks` fails
 * this; (3) the advisory note is present verbatim on every recommendation,
 * regardless of verdict; (4) this module never mutates or writes anything.
 */

import {
  crystalMilestone,
  isReviewableScientificObject,
  EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT,
} from '@/services/research/crystalDomains';
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { composeCrystalFreezeRecommendation } from '../services/research/crystalFreezeRecommendation';
import type { CrystalReadinessReport } from '../services/research/crystalReadiness';
import type { CrystalStatisticsReport } from '../services/research/crystalStatistics';

function passingReadiness(): CrystalReadinessReport {
  const names = [
    'selection-space',
    'derivation-headroom',
    'structural-diversity',
    'duplicate-detection',
    'provenance-eligibility',
    'lifecycle-validation-integrity',
    'relationship-density',
    'graph-connectivity',
    'orphan-detection',
  ];
  return {
    ok: true,
    checks: names.map((name) => ({ name, passed: true, detail: `${name} ok` })),
    invariantCount: 10,
    eligibleCount: 10,
    populations: { A: 10, B: 0, C: 0, unclassified: 0, ablationCount: 10 },
    derivationEligibleFraction: 0.4,
    duplicatePairCount: 0,
    graph: {
      relationshipCount: 8,
      relationshipDensity: 0.3,
      componentCount: 1,
      largestComponentSize: 10,
      connectivityRatio: 1,
      orphanCount: 0,
      orphanFraction: 0,
    },
  };
}

function statsFor(readiness: CrystalReadinessReport, overrides: Partial<CrystalStatisticsReport> = {}): CrystalStatisticsReport {
  return {
    ok: readiness.ok,
    experimentId: 'EXP-P1',
    crystalDomain: 'd',
    computedAt: new Date(0).toISOString(),
    invariantCount: readiness.invariantCount,
    sourceCount: 3,
    documentCount: 3,
    externalSources: ['Source A', 'Source B', 'Source C'],
    relationshipCount: readiness.graph.relationshipCount,
    averageValidationDepth: 4,
    standingDistribution: [],
    compositionDensity: readiness.graph.relationshipDensity,
    semanticDiversity: 1.2,
    namespaceDistributionEntropy: 1.2,
    coverageEstimate: { boundaryNamespaceCount: 15, representedNamespaceCount: 3, ratio: 0.2 },
    derivationHeadroom: readiness.derivationEligibleFraction,
    sliceRatio: 0.4,
    selectionEntropy: 1.2,
    duplicateRatio: 0,
    frozenHash: 'deadbeef'.repeat(8),
    substrateError: null,
    ...overrides,
  };
}

describe('Crystal Freeze Recommendation', () => {
  it('recommends READY_FOR_FREEZE only when the readiness report is fully green', () => {
    const readiness = passingReadiness();
    const rec = composeCrystalFreezeRecommendation('EXP-P1', 'd', readiness, statsFor(readiness));
    expect(rec.verdict).toBe('READY_FOR_FREEZE');
    expect(rec.ok).toBe(true);
    expect(rec.rationale.every((r) => r.satisfied)).toBe(true);
  });

  it('recommends NOT_READY the moment a single check fails, and names it in remainingRisks', () => {
    const readiness = passingReadiness();
    const failing = readiness.checks.map((c) => (c.name === 'orphan-detection' ? { ...c, passed: false, detail: '3/10 orphans' } : c));
    const notReady: CrystalReadinessReport = { ...readiness, ok: false, checks: failing };
    const rec = composeCrystalFreezeRecommendation('EXP-P1', 'd', notReady, statsFor(notReady));
    expect(rec.verdict).toBe('NOT_READY');
    expect(rec.rationale.find((r) => r.id === 'no-excess-orphans')?.satisfied).toBe(false);
    expect(rec.remainingRisks.some((r) => r.includes('No excess orphans'))).toBe(true);
  });

  it('always carries the advisory note, on both verdicts', () => {
    const readiness = passingReadiness();
    const ready = composeCrystalFreezeRecommendation('EXP-P1', 'd', readiness, statsFor(readiness));
    expect(ready.advisoryNote).toMatch(/ADVISORY ONLY/);
    expect(ready.advisoryNote).toMatch(/never marks/);

    const notReadyReport: CrystalReadinessReport = { ...readiness, ok: false };
    const notReady = composeCrystalFreezeRecommendation('EXP-P1', 'd', notReadyReport, statsFor(notReadyReport));
    expect(notReady.advisoryNote).toBe(ready.advisoryNote);
  });

  it('flags a non-zero duplicate ratio as a remaining risk even when the gating check passed', () => {
    const readiness = passingReadiness();
    const rec = composeCrystalFreezeRecommendation(
      'EXP-P1',
      'd',
      readiness,
      statsFor(readiness, { duplicateRatio: 0.02 }),
    );
    expect(rec.verdict).toBe('READY_FOR_FREEZE'); // gate itself is unaffected
    expect(rec.remainingRisks.some((r) => r.includes('duplicate ratio'))).toBe(true);
  });

  it('surfaces a statistics substrate error as a remaining risk', () => {
    const readiness = passingReadiness();
    const rec = composeCrystalFreezeRecommendation(
      'EXP-P1',
      'd',
      readiness,
      statsFor(readiness, { substrateError: 'edge substrate down' }),
    );
    expect(rec.remainingRisks.some((r) => r.includes('edge substrate down'))).toBe(true);
  });
});

/**
 * NOTHING TO ASSESS ≠ ASSESSED AND FAILING (operator report, 2026-08-02).
 *
 * The operator's own reviewer bundle showed `NOT_READY` with 9/9 checks
 * failing over `constitutional-reasoning` — and every failure said "0
 * invariants". Read cold, that is nine defects in Crystal vP1. It is not: the
 * domain holds no rows, and each check is correctly declining to certify an
 * empty set.
 *
 * The distinction is not cosmetic. `crystalReadiness.ts`'s own header records
 * that no live `invariant_contexts` row carries the crystal domain tag,
 * because Track 2 — the crystal source-material workstream — is separately
 * chartered and PAUSED. Its plan is explicit that growing the collection is
 * "genuine lab work, not a quick fix", proceeds by receipted accrual, and that
 * "no invariant is authored to hit a number".
 *
 * So the state is "not yet done", not "broken" — and no code change can make
 * it ready. Presenting it as nine failures invites exactly the wrong response
 * from exactly the wrong party: an external reviewer concluding the crystal is
 * defective, or an engineer relaxing the readiness filter to make a count rise.
 */
describe('an unpopulated domain is reported as such, never as a failing collection', () => {
  it('exposes assessability as a distinct axis from the verdict', async () => {
    const mod = await import('@/services/research/crystalFreezeRecommendation');
    // The verdict stays mechanically derived — an empty domain is emphatically
    // NOT ready — so this must not become a third verdict value.
    expect(mod.DOMAIN_UNPOPULATED_PROVENANCE).toContain('Track 2');
    expect(mod.DOMAIN_UNPOPULATED_PROVENANCE).toContain('CRYSTAL-ENLARGEMENT_plan.md');
  });

  it('the provenance names the accrual discipline and forbids the shortcut', async () => {
    const { DOMAIN_UNPOPULATED_PROVENANCE } = await import('@/services/research/crystalFreezeRecommendation');
    // Two shortcuts a reader might otherwise reach for, both explicitly closed.
    expect(DOMAIN_UNPOPULATED_PROVENANCE).toMatch(/never by authoring invariants to reach a number/i);
    expect(DOMAIN_UNPOPULATED_PROVENANCE).toMatch(/no change to this software can make the domain ready/i);
  });

  it('an empty domain puts the reason FIRST among the remaining risks', () => {
    const src = stripComments(readSource('services/research/crystalFreezeRecommendation.ts'));
    const pushAt = src.indexOf('if (assessability === ');
    const loopAt = src.indexOf('for (const item of rationale)', pushAt);
    expect(pushAt).toBeGreaterThan(-1);
    expect(loopAt).toBeGreaterThan(-1);
    expect(
      pushAt,
      'a reader who meets nine zeroes before the reason draws the wrong conclusion',
    ).toBeLessThan(loopAt);
  });

  it('assessability is derived from the invariant count, never asserted', () => {
    const src = stripComments(readSource('services/research/crystalFreezeRecommendation.ts'));
    expect(src).toMatch(/readiness\.invariantCount === 0 \? 'DOMAIN_UNPOPULATED' : 'ASSESSED'/);
  });

  it('the reviewer-facing route hoists it above the failing checks', () => {
    const src = stripComments(readSource('app/api/research/crystal/[experimentId]/route.ts'));
    // Scope to the RESPONSE literal — `readiness,` also appears in the
    // destructure above it, and matching that would compare the wrong pair.
    const bodyAt = src.indexOf('requestSucceeded: true');
    expect(bodyAt).toBeGreaterThan(-1);
    const body = src.slice(bodyAt);
    const assessAt = body.indexOf('assessability: recommendation.assessability');
    const readinessAt = body.indexOf('readiness,');
    expect(assessAt).toBeGreaterThan(-1);
    expect(readinessAt).toBeGreaterThan(-1);
    expect(assessAt, 'the reason must precede the failures in the payload').toBeLessThan(readinessAt);
  });

  it('the readiness filter is unchanged — an empty count is never fixed by widening it', () => {
    const src = stripComments(readSource('services/research/crystalReadiness.ts'));
    // validated|canonical only. Admitting 'proposed' would raise the count by
    // admitting rows the pre-registered experiment policy excludes — the exact
    // move the provenance forbids.
    expect(src).toMatch(/status:\s*\['validated',\s*'canonical'\]/);
    expect(src).not.toMatch(/status:\s*\[[^\]]*'proposed'/);
  });
});

/**
 * CRYSTAL CONSTITUTION PRECEDES CRYSTAL READINESS (operator ruling, 2026-08-02).
 *
 *   > "Do not tag the existing 18 invariants as `constitutional-reasoning`.
 *   > That would solve the display problem while creating the wrong experiment."
 *
 * …and, revised the same day:
 *
 *   > "I would declare the current milestone as: Internal Readiness. Not
 *   > External Review."
 *
 * Two distinct guards, from two distinct temptations:
 *
 *   1. Relabelling an existing collection to populate a surface. The numbers
 *      would look right afterwards, which is precisely why the substitution
 *      would be invisible — one experiment silently replaced by another.
 *   2. Opening an independent review on a crystal that does not exist yet.
 *      Assessing an empty set is not a smaller review; it is a different and
 *      useless act, and it spends a reviewer's independence on nothing.
 */
describe('the crystal is constituted before it is assessed, and assessed before it is reviewed', () => {
  const DOMAINS = 'services/research/crystalDomains.ts';

  it("EXP-P1's declared domain is the new financial one, not the historical collection", async () => {
    const { crystalDomainForExperiment } = await import('@/services/research/crystalDomains');
    const d = crystalDomainForExperiment('EXP-P1');
    expect(d?.domain).toBe('financial-risk-value-systems');
    expect(d?.boundary).toMatch(/risk formation, valuation, actuarial mechanics, liquidity/);
    // The historical corpus keeps its own identity and is named as excluded.
    expect(d?.exclusions.join(' ')).toMatch(/constitutional-reasoning/);
    expect(d?.exclusions.join(' ')).toMatch(/metaMe \/ Qripto/);
  });

  it('the boundary is RATIFIED, and carries the ratifying words verbatim', async () => {
    // Ratified by the operator 2026-08-02, which is what unblocks Track 2
    // assignment. The gate itself is unchanged — it reads the status; it does
    // not assume one.
    const { crystalDomainForExperiment, domainAcceptsAssignment } = await import(
      '@/services/research/crystalDomains'
    );
    const d = crystalDomainForExperiment('EXP-P1')!;
    expect(d.ratification).toBe('ratified');
    expect(domainAcceptsAssignment(d)).toBe(true);
    // The TEXT is what was ratified — a paraphrase would be a different act.
    expect(d.ratificationText).toContain('financial-risk-value-systems');
    expect(d.ratificationText).toMatch(/externally established or externally empirical/);
    expect(d.ratificationText).toMatch(/remain excluded/);
    expect(d.ratifiedBy).toBe('operator');
    expect(d.ratifiedAt).toBe('2026-08-02');
  });

  it('an UNRATIFIED boundary still refuses assignment — the gate reads status, it does not assume', async () => {
    const { domainAcceptsAssignment, crystalDomainForExperiment } = await import(
      '@/services/research/crystalDomains'
    );
    const d = crystalDomainForExperiment('EXP-P1')!;
    expect(domainAcceptsAssignment({ ...d, ratification: 'awaiting-operator-ratification' })).toBe(false);
  });

  it('eligibility stays validated|canonical with external provenance — never widened to raise a count', async () => {
    const { CRYSTAL_ELIGIBLE_STATUSES, CRYSTAL_ELIGIBLE_PROVENANCE } = await import(
      '@/services/research/crystalDomains'
    );
    expect([...CRYSTAL_ELIGIBLE_STATUSES]).toEqual(['validated', 'canonical']);
    expect([...CRYSTAL_ELIGIBLE_STATUSES]).not.toContain('proposed');
    expect([...CRYSTAL_ELIGIBLE_PROVENANCE]).toEqual(['external-established', 'external-empirical']);
  });

  it('another experiment cannot silently inherit EXP-P1’s crystal', async () => {
    const { crystalDomainForExperiment } = await import('@/services/research/crystalDomains');
    expect(crystalDomainForExperiment('EXP-P2')).toBeNull();
    expect(crystalDomainForExperiment('')).toBeNull();
  });

  /**
   * Internal diagnosis and independent pre-freeze review are DIFFERENT ACTS.
   * The operator corrected an earlier formulation that let one word mean both:
   * a populated-but-failing crystal is worth the originating team's diagnosis
   * and is NOT worth an external reviewer's independence.
   */
  it('three states: nothing to inspect, internal diagnosis, independent review', async () => {
    const { crystalReviewStageStatus } = await import('@/services/research/crystalDomains');
    // Empty — nothing to diagnose either, whatever readiness claims.
    for (const readinessOk of [false, true]) {
      const s0 = crystalReviewStageStatus({ invariantCount: 0, readinessOk });
      expect(s0.state).toBe('PREPARING_CANDIDATE');
      expect(s0.internalDiagnosticAvailable).toBe(false);
      expect(s0.independentReviewRequestOpen).toBe(false);
    }
    // Populated but failing — OURS to diagnose, not theirs to review.
    const diag = crystalReviewStageStatus({ invariantCount: 60, readinessOk: false });
    expect(diag.state).toBe('INTERNAL_DIAGNOSTIC_REVIEW');
    expect(diag.internalDiagnosticAvailable).toBe(true);
    expect(diag.independentReviewRequestOpen).toBe(false);
    // Both conditions — and only then.
    const open = crystalReviewStageStatus({ invariantCount: 60, readinessOk: true });
    expect(open.state).toBe('INDEPENDENT_REVIEW_OPEN');
    expect(open.independentReviewRequestOpen).toBe(true);
  });

  it('the independent-review flag is never true without BOTH conditions', async () => {
    const { crystalReviewStageStatus } = await import('@/services/research/crystalDomains');
    const cases = [
      { invariantCount: 0, readinessOk: false },
      { invariantCount: 0, readinessOk: true },
      { invariantCount: 1, readinessOk: false },
      { invariantCount: 999, readinessOk: false },
    ];
    for (const c of cases) {
      expect(
        crystalReviewStageStatus(c).independentReviewRequestOpen,
        `${JSON.stringify(c)} must not open an external reviewer's assessment`,
      ).toBe(false);
    }
  });

  it('the flag is named for the act it authorises, so it cannot answer for the other one', async () => {
    const { crystalReviewStageStatus } = await import('@/services/research/crystalDomains');
    const s0 = crystalReviewStageStatus({ invariantCount: 60, readinessOk: false });
    // A bare `reviewOpen` would have to answer for internal diagnosis too —
    // which is exactly how the two activities collapsed into one word.
    expect(Object.keys(s0)).not.toContain('reviewRequestOpen');
    expect(Object.keys(s0)).toContain('independentReviewRequestOpen');
    expect(Object.keys(s0)).toContain('internalDiagnosticAvailable');
  });

  it('each state says plainly what is NOT being asked', async () => {
    const { crystalReviewStageStatus } = await import('@/services/research/crystalDomains');
    expect(crystalReviewStageStatus({ invariantCount: 0, readinessOk: false }).message).toMatch(
      /not being asked to assess or recommend/i,
    );
    expect(crystalReviewStageStatus({ invariantCount: 60, readinessOk: false }).message).toMatch(
      /no external reviewer is being asked/i,
    );
  });

  it('the reviewer-facing route carries the stage state and the declared boundary', () => {
    const src = stripComments(readSource('app/api/research/crystal/[experimentId]/route.ts'));
    expect(src).toContain('reviewStage: crystalReviewStageStatus(');
    expect(src).toContain('crystalDomainDeclaration: crystalDomainForExperiment(experimentId)');
  });

  it('all three reports resolve the SAME declared domain — never three defaults', () => {
    for (const f of [
      'services/research/crystalReadiness.ts',
      'services/research/crystalStatistics.ts',
      'services/research/crystalFreezeRecommendation.ts',
    ]) {
      const src = stripComments(readSource(f));
      expect(
        src,
        `${f} must resolve the experiment's declared domain, or two reports describe different collections`,
      ).toContain('crystalDomainForExperiment(input.experimentId)?.domain');
    }
  });

  it('the declaration module assigns nothing — it states, it does not write', () => {
    const src = stripComments(readSource(DOMAINS));
    for (const writer of ['.insert(', '.update(', '.upsert(', '.delete(', 'supabase']) {
      expect(src, `crystalDomains.ts must not ${writer} — declaring is not assigning`).not.toContain(writer);
    }
  });
});

describe('the milestone names what is done and what has not been attempted', () => {
  it('an unpopulated domain is Internal Readiness, not a broken crystal', () => {
    const m = crystalMilestone({ invariantCount: 0 });
    expect(m.label).toBe('Internal Readiness');
    expect(m.domainRatified).toBe(true);
    expect(m.infrastructureReady).toBe(true);
    expect(m.candidateConstituted).toBe(false);
    expect(m.statement).toMatch(/constitution pending — Track 2/);
    // The sentence that stops the next reader debugging an absence.
    expect(m.statement).toMatch(/not\s+a defective crystal/i);
  });

  it('says what advances it, and that it is not a code change', () => {
    const m = crystalMilestone({ invariantCount: 0 });
    expect(m.advancedBy).toMatch(/Track 2 corpus acquisition/);
    expect(m.advancedBy).toMatch(/No change to this software moves it/);
  });

  it('flips on its own once the domain holds invariants', () => {
    const m = crystalMilestone({ invariantCount: 18 });
    expect(m.candidateConstituted).toBe(true);
    expect(m.label).toBe('Candidate Crystal constituted');
    expect(m.statement).toMatch(/18 invariant/);
  });
});

describe('honest and reviewable are different properties', () => {
  it('an empty package is not a reviewable scientific object', () => {
    expect(isReviewableScientificObject({ invariantCount: 0 })).toBe(false);
    expect(isReviewableScientificObject({ invariantCount: 1 })).toBe(true);
  });

  it('names the empty package as provenance, not a subject', () => {
    expect(EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT).toMatch(/historical provenance/i);
    expect(EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT).toMatch(/cannot produce a finding/i);
  });
});

describe('the agent package tells a reviewer whether there is anything to review', () => {
  it('carries crystalSubject beside the endpoint', () => {
    const src = stripComments(readSource('app/api/journey/validation-programme/agent-package/route.ts'));
    expect(src).toMatch(/crystalSubject/);
    expect(src).toMatch(/isReviewableScientificObject/);
  });

  it('an unreadable crystal is unknown, never reviewable', () => {
    // Fabricating reviewability on a failed read would send an agent to work
    // on a set nobody had confirmed exists.
    const src = stripComments(readSource('app/api/journey/validation-programme/agent-package/route.ts'));
    const at = src.indexOf('} catch (e) {', src.indexOf('crystalSubject'));
    const block = src.slice(at, at + 700);
    expect(block).toMatch(/reviewable: false/);
    expect(block).toMatch(/not permission to proceed/i);
  });
});
