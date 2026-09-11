/**
 * Track 2 Stage 5 (Classify Provenance) — EXCEPTION-ONLY REMAINDER status
 * (2026-09-03). Applies the SAME exception-isolation doctrine every other
 * partial-progress stage in track2Programme.ts already uses
 * (`partially-complete` when every executable record was processed and only
 * isolated exceptions remain) to Stage 5, which previously reported
 * `in-progress` FOREVER whenever `unclassified > 0` — even after a
 * provenance cohort ratification classified every mechanically-derivable
 * member and only genuine, individually-reviewable exceptions were left.
 * That withheld Stage 6/7 (`unblockedStageIds` only passes through
 * `complete`/`partially-complete`) from the already-classified remainder,
 * contradicting the exception-isolation ruling's own §6.
 */
import { describe, expect, it } from 'vitest';
import { buildTrack2Programme, type PromotedCohort, type Track2ProgrammeSignals } from '@/services/research/track2Programme';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { CrystalLifecycle } from '@/services/research/crystalDomains';

function readiness(count: number): CrystalReadinessReport {
  return {
    ok: count > 0,
    invariantCount: count,
    eligibleCount: count,
    populations: { A: count, B: 0, C: 0, unclassified: 0, ablationCount: count },
    derivationEligibleFraction: 1,
    duplicatePairCount: 0,
    graph: { relationshipCount: 0, relationshipDensity: 0, componentCount: 0, largestComponentSize: 0, connectivityRatio: 0, orphanCount: 0, orphanFraction: 0 },
    checks: [],
    maturity: { passedCount: 0, totalCount: 0, band: 'nascent' },
  } as unknown as CrystalReadinessReport;
}

function lifecycle(): CrystalLifecycle {
  return { stageId: 'X', label: 'X', marker: '⚪', meaning: 'x', whatIsMissing: 'x', remainingWorkKind: 'scientific', whoActs: 'Steward', ladder: [] } as unknown as CrystalLifecycle;
}

function cohortOf(size: number, over: Partial<PromotedCohort> = {}): PromotedCohort {
  return {
    invariantIds: Array.from({ length: size }, (_, i) => `inv-${i}`),
    unclassified: size,
    unvalidated: size,
    graph: { relationshipCount: 0, orphanCount: 0 },
    excluded: [],
    unaccountedRecords: [],
    unclassifiedRecords: [],
    unvalidatedRecords: [],
    orphanRecords: [],
    members: [],
    ...over,
  };
}

function programme(cohort: PromotedCohort, over: Partial<Track2ProgrammeSignals> = {}) {
  return buildTrack2Programme({
    experimentId: 'EXP-P1',
    crystalDomain: 'financial-risk-value-systems',
    acquisitionDomain: 'financial-services',
    signals: {
      candidateSources: { total: 5, pendingReview: 0, admitted: 5 },
      discoveryCandidates: { total: 58, awaitingReview: 0, promoted: 58 },
      promotedCohort: cohort,
      readiness: readiness(cohort.invariantIds.length - cohort.unclassified),
      lifecycle: lifecycle(),
      artifact: null,
      independentReviewRequestOpen: false,
      acquisitionSourceUniverse: null,
      ...over,
    },
  });
}

function stage(p: ReturnType<typeof programme>, id: string) {
  return p.stages.find((s) => s.id === id)!;
}

describe('classify-provenance stage status — the exception-only-remainder fix', () => {
  it('stays `in-progress` (unchanged, backward-compatible) when unclassifiedExceptionOnly is not set at all', () => {
    const p = programme(cohortOf(58, { unclassified: 7 })); // unclassifiedExceptionOnly omitted
    expect(stage(p, 'classify-provenance').status).toBe('in-progress');
    expect(p.unblockedStageIds).not.toContain('validate');
  });

  it('stays `in-progress` when the remainder still holds classifiable candidates (unclassifiedExceptionOnly: false)', () => {
    const p = programme(cohortOf(58, { unclassified: 30, unclassifiedExceptionOnly: false }));
    expect(stage(p, 'classify-provenance').status).toBe('in-progress');
    expect(p.unblockedStageIds).not.toContain('validate');
  });

  it('reads `partially-complete` — never `in-progress` forever — once the remainder is genuinely exceptions-only, and unblocks Stage 6/7', () => {
    // Reproduces the live post-ratification shape: 58 promoted, 51 classified
    // (48 ratified this act + 3 already classified) and immediately
    // validated by this same act's downstream chain, 7 genuine exceptions
    // remaining unclassified (and so also not yet validatable).
    const p = programme(cohortOf(58, { unclassified: 7, unclassifiedExceptionOnly: true, unvalidated: 7 }));
    const classify = stage(p, 'classify-provenance');
    expect(classify.status).toBe('partially-complete');
    expect(classify.detail).toMatch(/isolated exception/);
    expect(classify.remedies[0]).toMatch(/individual steward review/);
    // THE FIX ITSELF: Stage 6 (Validate) is no longer withheld by classify-
    // provenance's 7 outstanding exceptions — its own gate depends only on
    // EARLIER stages, and classify-provenance now passes through.
    expect(p.unblockedStageIds).toContain('validate');
  });

  it('once validation also completes for the classified remainder, Stage 7 (Add Relationships) unblocks too — the full chain, not just Stage 6', () => {
    const p = programme(cohortOf(58, { unclassified: 7, unclassifiedExceptionOnly: true, unvalidated: 0 }));
    expect(p.unblockedStageIds).toContain('validate');
    expect(p.unblockedStageIds).toContain('add-relationships');
  });

  it('still reads `complete` when nothing at all remains unclassified (unaffected by this fix)', () => {
    const p = programme(cohortOf(58, { unclassified: 0 }));
    expect(stage(p, 'classify-provenance').status).toBe('complete');
  });

  it('a fully-exception cohort (unclassified === total, all exceptions) is partially-complete, not in-progress', () => {
    const p = programme(
      cohortOf(7, { unclassified: 7, unclassifiedExceptionOnly: true }),
      { discoveryCandidates: { total: 7, awaitingReview: 0, promoted: 7 } },
    );
    expect(stage(p, 'classify-provenance').status).toBe('partially-complete');
  });
});
