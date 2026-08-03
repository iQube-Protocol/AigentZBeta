/**
 * THE PIPELINE CONTINUITY CANARY (operator ruling, 2026-08-03).
 *
 *   > "Pipeline continuity invariant: Every stage consumes the declared output
 *   >  population of the previous stage. A stage may narrow that population
 *   >  only through explicit, receipted exclusions. It may never silently
 *   >  substitute a different population."
 *
 * ── The defect this file exists to make impossible ─────────────────────────
 *
 * The Track 2 Experiment Pipeline showed, on ONE SCREEN:
 *
 *   Stage 3  "17 candidate(s) extracted"                          ← the run's cohort
 *   Stage 4  "17 promoted · 0 awaiting review"                    ← the run's cohort
 *   Stage 5  "68 promoted invariant(s) carry no recorded evidence provenance"
 *                                                                 ← the RATIFIED DOMAIN REGISTRY
 *   Stage 5  "Domain 'financial-risk-value-systems' holds no invariants,
 *             so this check has nothing to assess"                 ← the ASSIGNED CRYSTAL
 *
 * Seventeen, sixty-eight and zero, about three different populations, none of
 * them named. The operator's verdict:
 *
 *   > "Those are different populations… the UI simultaneously reports 17
 *   >  promoted invariants exist, and there are no invariants to classify.
 *   >  Both cannot be true."
 *
 * Every assertion below fails against the pre-fix code. The reproduction is
 * kept explicit in `describe('the historical defect')` — a canary that cannot
 * be shown failing against the defect it names is a passing test, not a canary
 * (`CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001`).
 *
 * Candidate invariant: CI-2026-08-03-PIPELINE-CONTINUITY-001.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkPopulationContinuity,
  handoverBreach,
  handoverReconciles,
  renderHandover,
  DECLARED_POPULATIONS,
  type PopulationHandover,
} from '@/services/research/exceptionIsolation';
import {
  buildTrack2Programme,
  type PromotedCohort,
  type Track2ProgrammeSignals,
} from '@/services/research/track2Programme';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { CrystalLifecycle } from '@/services/research/crystalDomains';

// ── Fixtures: the observed screen, reproduced ──────────────────────────────

/** The readiness report over an EMPTY ratified crystal domain — exactly the
 *  state on the observed screen ('financial-risk-value-systems' holds none). */
function emptyCrystalReadiness(): CrystalReadinessReport {
  return {
    ok: false,
    invariantCount: 0,
    eligibleCount: 0,
    populations: { A: 0, B: 0, C: 0, unclassified: 0, ablationCount: 0 },
    derivationEligibleFraction: 0,
    duplicatePairCount: 0,
    graph: {
      relationshipCount: 0,
      relationshipDensity: 0,
      componentCount: 0,
      largestComponentSize: 0,
      connectivityRatio: 0,
      orphanCount: 0,
      orphanFraction: 1,
    },
    checks: [
      {
        name: 'provenance-eligibility',
        passed: false,
        detail: "no invariants found in domain 'financial-risk-value-systems'",
        // The verbatim notice the operator met on Stage 5.
        remedy:
          "Nothing here has failed. Domain 'financial-risk-value-systems' holds no invariants, so this check " +
          'has nothing to assess. The missing thing is the crystal itself: Track 2 corpus acquisition.',
      },
    ],
  } as CrystalReadinessReport;
}

function lifecycle(): CrystalLifecycle {
  return {
    stageId: 'CANDIDATE_NOT_CONSTITUTED',
    label: 'Candidate Crystal Not Yet Constituted',
    marker: '⚪',
    meaning: 'the domain is ratified and nothing has been admitted to it',
    whatIsMissing: 'corpus acquisition',
    remainingWorkKind: 'scientific',
    whoActs: 'Steward',
    ladder: [],
  } as unknown as CrystalLifecycle;
}

function cohortOf(size: number, over: Partial<PromotedCohort> = {}): PromotedCohort {
  return {
    invariantIds: Array.from({ length: size }, (_, i) => `inv-${i}`),
    unclassified: size,
    unvalidated: size,
    graph: { relationshipCount: 0, orphanCount: size },
    excluded: [],
    ...over,
  };
}

function programme(over: Partial<Track2ProgrammeSignals> = {}) {
  return buildTrack2Programme({
    experimentId: 'EXP-P1',
    crystalDomain: 'financial-risk-value-systems',
    signals: {
      candidateSources: { total: 35, pendingReview: 33, admitted: 2 },
      discoveryCandidates: { total: 17, awaitingReview: 0, promoted: 17 },
      promotedCohort: cohortOf(17),
      readiness: emptyCrystalReadiness(),
      lifecycle: lifecycle(),
      artifact: null,
      independentReviewRequestOpen: false,
      ...over,
    },
  });
}

const stage = (p: ReturnType<typeof programme>, id: string) => p.stages.find((s) => s.id === id)!;

// ── 1. Every stage declares its population ─────────────────────────────────

describe('every stage declares the population it is reasoning about', () => {
  it('declares a consumed population, a produced population and the substrate behind it', () => {
    for (const s of programme().stages) {
      expect(DECLARED_POPULATIONS, `${s.id} must declare what it reads`).toContain(s.population.consumes);
      expect(DECLARED_POPULATIONS, `${s.id} must declare what it hands on`).toContain(s.population.produces);
      // The declaration is checkable only if it names the substrate. A
      // declaration nobody can check against reality is a claim, not a control.
      expect(s.population.source.length, `${s.id} must name the substrate it reads`).toBeGreaterThan(20);
    }
  });

  it('the pipeline is continuous — every stage consumes what the one before hands on', () => {
    const p = programme();
    expect(checkPopulationContinuity(p.stages)).toEqual([]);
    expect(p.populationContinuity.breaks).toEqual([]);
  });

  it('the population changes at exactly two declared transforms, and nowhere else', () => {
    const transforms = programme()
      .stages.filter((s) => s.population.consumes !== s.population.produces)
      .map((s) => `${s.id}:${s.population.consumes}→${s.population.produces}`);
    // Extraction turns the admitted corpus into the run's cohort; assignment
    // turns that cohort into ratified crystal members. Any third transform is
    // an undeclared change of subject wearing a declaration.
    expect(transforms).toEqual([
      'extract-candidates:admitted-corpus→current-crystal',
      'assign-to-crystal:current-crystal→assigned-crystal',
    ]);
  });

  it('no stage between extraction and assignment reads the ratified corpus', () => {
    // The exact substitution: Stage 5 queried the ratified domain registry
    // while Stages 3 and 4 worked the run's own cohort.
    const span = ['extract-candidates', 'review-and-promote', 'classify-provenance', 'validate', 'add-relationships'];
    for (const id of span) {
      const s = stage(programme(), id);
      expect(s.population.consumes, `${id} must not read the standing registry`).not.toBe('ratified-corpus');
    }
  });

  it('the route resolves the cohort from Stage 4’s output, not by domain query', () => {
    // A DECLARATION IS ONLY WORTH WHAT THE SUBSTRATE READ BEHIND IT IS. The
    // stage says `current-crystal`; this asserts the composing route actually
    // reads that population. The pre-fix line was
    // `listInvariants({ domain: acquisitionDomain, limit: 500 })`.
    const route = readFileSync(
      join(__dirname, '..', 'app', 'api', 'research', 'track2', '[experimentId]', 'route.ts'),
      'utf8',
    );
    // Comments are stripped: the route DOCUMENTS the query it replaced, and
    // the record of a removed defect must not read as the defect.
    const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'the Track 2 route must not resolve a stage population by domain query').not.toMatch(
      /listInvariants\(/,
    );
    expect(route).toMatch(/promotedInvariantId/);
    expect(route).toMatch(/resolvePromotedCohort/);
  });
});

// ── 2. THE HANDOVER IDENTITY — the operator's own canary ───────────────────

describe('Stage 4 → Stage 5: N out, N in, minus explicit exclusions', () => {
  it('Stage 5 receives exactly what Stage 4 handed on', () => {
    const p = programme();
    const h = p.populationContinuity.handovers.find(
      (x) => x.fromStageId === 'review-and-promote' && x.toStageId === 'classify-provenance',
    )!;
    expect(h.declaredOut).toBe(17);
    expect(h.received).toBe(17);
    expect(h.excluded).toBe(0);
    expect(handoverReconciles(h)).toBe(true);
    expect(p.populationContinuity.breaches).toEqual([]);
  });

  it('a narrowing is legitimate ONLY as an explicit exclusion carrying a reason', () => {
    const p = programme({
      promotedCohort: cohortOf(15, {
        unclassified: 0,
        excluded: [
          { recordId: 'cand-a', reason: 'promoted with no recorded promoted_invariant_id' },
          { recordId: 'cand-b', reason: 'promoted invariant id does not resolve to an invariant row' },
        ],
      }),
    });
    const h = p.populationContinuity.handovers[0];
    expect(h.received + h.excluded).toBe(h.declaredOut); // 15 + 2 = 17
    expect(handoverReconciles(h)).toBe(true);
    expect(p.populationContinuity.breaches).toEqual([]);
    // Visible, never discarded — the reasons ride the stage the operator reads.
    expect(stage(p, 'classify-provenance').detail).toMatch(/2 explicitly excluded/);
    expect(stage(p, 'classify-provenance').detail).toMatch(/promoted_invariant_id/);
    // And having processed everything it received while holding exclusions is
    // partial completion, not failure (exception-isolation ruling §6).
    expect(stage(p, 'classify-provenance').status).toBe('partially-complete');
  });

  it('an UNEXPLAINED shortfall does not reconcile, and says so in the operator’s terms', () => {
    const h: PopulationHandover = {
      fromStageId: 'review-and-promote',
      toStageId: 'classify-provenance',
      population: 'current-crystal',
      declaredOut: 17,
      received: 15,
      excluded: 0,
      exclusionReasons: [],
    };
    expect(handoverReconciles(h)).toBe(false);
    expect(handoverBreach(h)).toMatch(/POPULATION DISCONTINUITY/);
    expect(handoverBreach(h)).toMatch(/2 record\(s\) unaccounted for/);
    expect(renderHandover(h)).toMatch(/POPULATION DISCONTINUITY/);
  });

  it('receiving MORE than was handed on is a discontinuity too — it is a different set', () => {
    const h: PopulationHandover = {
      fromStageId: 'review-and-promote',
      toStageId: 'classify-provenance',
      population: 'current-crystal',
      declaredOut: 17,
      received: 68,
      excluded: 0,
      exclusionReasons: [],
    };
    expect(handoverReconciles(h)).toBe(false);
    expect(handoverBreach(h)).toMatch(/51 record\(s\) MORE than were handed on/);
    expect(handoverBreach(h)).toMatch(/reading a different population/);
  });
});

// ── 3. THE IMPOSSIBILITY THE OPERATOR NAMED ────────────────────────────────

describe('Stage 5 cannot report “no invariants” while Stage 4 reports more than zero', () => {
  it('holds across the whole range of Stage 4 outputs', () => {
    for (const n of [1, 2, 5, 17, 68, 500]) {
      const p = programme({
        discoveryCandidates: { total: n, awaitingReview: 0, promoted: n },
        promotedCohort: cohortOf(n),
      });
      const s4 = stage(p, 'review-and-promote');
      const s5 = stage(p, 'classify-provenance');
      expect(s4.detail).toContain(`${n} promoted`);
      // The forbidden pair: Stage 4 says N > 0 and Stage 5 says there is
      // nothing to work on.
      expect(s5.status, `Stage 5 must not be idle over ${n} promoted invariants`).not.toBe('not-started');
      expect(s5.detail).toContain(`of ${n} promoted invariant(s)`);
      expect(s5.detail).not.toMatch(/holds no invariants/);
    }
  });

  it('Stage 5 reports nothing to do ONLY when Stage 4 also reported zero', () => {
    const p = programme({
      discoveryCandidates: { total: 3, awaitingReview: 3, promoted: 0 },
      promotedCohort: cohortOf(0, { unclassified: 0, unvalidated: 0, graph: { relationshipCount: 0, orphanCount: 0 } }),
    });
    expect(stage(p, 'review-and-promote').detail).toContain('0 promoted');
    expect(stage(p, 'classify-provenance').status).toBe('not-started');
    expect(p.populationContinuity.breaches).toEqual([]);
  });

  it('an unreadable cohort is `unknown` — never an empty classification queue', () => {
    const p = programme({ promotedCohort: null });
    for (const id of ['classify-provenance', 'validate', 'add-relationships']) {
      expect(stage(p, id).status, `${id} must not be guessed`).toBe('unknown');
      expect(stage(p, id).detail).toMatch(/unknown, not assumed/);
    }
  });
});

// ── 4. THE HISTORICAL DEFECT, REPRODUCED ───────────────────────────────────

describe('the historical defect — 17 promoted, 68 counted, zero to classify', () => {
  /**
   * The pre-fix Stage 5 counted `listInvariants({ domain: acquisitionDomain })`
   * — the ratified domain registry. Feeding the programme that population as
   * the cohort reproduces the observed screen exactly, and the pipeline now
   * REFUSES it instead of rendering it.
   */
  const observed = () =>
    programme({
      discoveryCandidates: { total: 17, awaitingReview: 0, promoted: 17 },
      promotedCohort: cohortOf(68, { unclassified: 68, unvalidated: 68 }),
    });

  it('is caught as a population discontinuity, not rendered as a count', () => {
    const p = observed();
    expect(p.populationContinuity.breaches).toHaveLength(1);
    expect(p.populationContinuity.breaches[0]).toMatch(/POPULATION DISCONTINUITY/);
    expect(p.populationContinuity.breaches[0]).toMatch(/declared 17/);
    expect(p.populationContinuity.breaches[0]).toMatch(/received 68/);
  });

  it('blocks Stages 5–7 rather than letting them report a foreign population', () => {
    const p = observed();
    for (const id of ['classify-provenance', 'validate', 'add-relationships']) {
      expect(stage(p, id).status, `${id} must refuse a population it cannot account for`).toBe('blocked');
      expect(stage(p, id).detail).toMatch(/POPULATION DISCONTINUITY/);
      // The exception terminates in an act, never in a description
      // (CI-2026-08-03-EXCEPTION-TERMINATES-IN-ACT-001).
      expect(stage(p, id).remedies.join(' ')).toMatch(/defect in the pipeline, not in the data/);
    }
  });

  it('leads with the discontinuity — the operator meets the cause, not the symptom', () => {
    expect(observed().nextActions[0]).toMatch(/POPULATION DISCONTINUITY/);
  });

  it('the empty-crystal readiness notice never reaches a current-crystal stage', () => {
    // "Domain 'financial-risk-value-systems' holds no invariants" is a true
    // statement about the ASSIGNED crystal. On Stage 5 it was a statement about
    // a population Stage 5 does not work over — the third number on the screen.
    const p = programme();
    for (const id of ['classify-provenance', 'validate', 'add-relationships']) {
      expect(
        stage(p, id).remedies.join(' '),
        `${id} must not quote a remedy about the assigned crystal`,
      ).not.toMatch(/holds no invariants/);
    }
    // And it is still carried, verbatim, by the stage that DOES declare that
    // population — relocated, never lost.
    expect(stage(p, 'run-readiness').remedies.join(' ')).toMatch(/holds no invariants/);
    expect(stage(p, 'run-readiness').population.consumes).toBe('assigned-crystal');
  });
});

// ── 5. The model itself ────────────────────────────────────────────────────

describe('checkPopulationContinuity', () => {
  it('names both stages and both populations when the subject changes silently', () => {
    const breaks = checkPopulationContinuity([
      { id: 'a', ordinal: 1, population: { consumes: 'admitted-corpus', produces: 'current-crystal', source: 'x' } },
      { id: 'b', ordinal: 2, population: { consumes: 'ratified-corpus', produces: 'ratified-corpus', source: 'y' } },
    ]);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({
      fromStageId: 'a',
      toStageId: 'b',
      produced: 'current-crystal',
      consumed: 'ratified-corpus',
    });
    expect(breaks[0].detail).toMatch(/different populations/);
  });

  it('constrains the head stage’s output but not its input', () => {
    // The first stage consumes nothing upstream — it must still DECLARE, which
    // the type enforces, but continuity has nothing to compare it against.
    expect(
      checkPopulationContinuity([
        { id: 'head', ordinal: 1, population: { consumes: 'ratified-corpus', produces: 'admitted-corpus', source: 'x' } },
        { id: 'next', ordinal: 2, population: { consumes: 'admitted-corpus', produces: 'admitted-corpus', source: 'y' } },
      ]),
    ).toEqual([]);
  });

  it('checks in ordinal order, not array order', () => {
    expect(
      checkPopulationContinuity([
        { id: 'b', ordinal: 2, population: { consumes: 'current-crystal', produces: 'current-crystal', source: 'y' } },
        { id: 'a', ordinal: 1, population: { consumes: 'admitted-corpus', produces: 'current-crystal', source: 'x' } },
      ]),
    ).toEqual([]);
  });
});
